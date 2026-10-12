/**
 * The Innkeeper's Music Box: a small music player on the engine's music bus.
 *
 * Tracks come from public/audio/music/manifest.json (see docs/sounds.md,
 * "Music box tracks"; built by `pnpm audio:music`, which currently ships one
 * soundtrack piece per game). Five generative music-box tunes back them up,
 * one per game: witcher, skyrim, minecraft, baldurs-gate-3, dragon-age. A
 * manifest track with one of those ids replaces that placeholder one-for-one;
 * tracks with new ids are added. Real tracks are listed first (manifest
 * order), then the placeholders still unclaimed. A real track whose file
 * fails to load plays the tune of its `mood` (which defaults to its id when
 * that is a placeholder id).
 *
 * Real tracks STREAM: nothing is fetched or decoded up front. Three pooled
 * HTMLAudioElements are each wired once with createMediaElementSource (the
 * call throws on reuse, so the nodes live as long as the context): one for
 * the current track, one for the track crossfading out, one spare for warm(),
 * the loop seam or the next start. A track starts as soon as the browser has
 * enough data (a Range request, 206, for the first bytes, and another when
 * seeking to the join-in-progress point); the rest downloads while it plays.
 *
 * Graph (one file voice or synth current, at most one fading out):
 *   file:  <audio> -> MediaElementSource -> voice gain -> music bus
 *   synth: tine voices -> voiceBus -> lowpass -> dry ----------> out -> music bus
 *                                           \-> Convolver -> wet /
 *   music bus -> musicDuck (spells) -> master; analyser tapped on the bus.
 *
 * Switching: every request (tabs, crank, shuffle, next/prev, media keys,
 * resume) takes a new generation; every async step of a start checks it and
 * gives its element back when a newer request or a pause came in. Requests
 * closer together than 150 ms are coalesced (only the last one loads). Each
 * voice has a state (idle / warming / starting / active / fadingOut / seam)
 * and a lease bumped on release, so a late listener, timer or play() promise
 * of an older use can never touch it. When a new track takes over while a
 * crossfade still runs, the older outgoing voice is cut in 60 ms; starting
 * any track fades every other synth tune. Gain changes always hold the
 * value in flight first (cancelAndHoldAtTime, or cancelScheduledValues +
 * setValueAtTime) so a fade never jumps. Dev builds check these rules after
 * each transition and console.warn "[music] invariant violated" otherwise.
 *
 * Looping: a file element has loop=false; when a looping track has under
 * 0.5 s left, the spare element (pre-buffered from 0) fades in over that
 * overlap while the first fades out ("ping-pong"), because a single element's
 * own `loop` can leave a small gap. While a switch or crossfade is in
 * progress, or no element is idle, it falls back to loop=true.
 *
 * API (const music = useMusic()):
 *   musicState                 reactive { tracks, currentId, pendingId,
 *                              playing, position (s), duration (s), loading,
 *                              blocked, buffered }
 *                              pendingId = the track a switch is starting
 *                              blocked = the browser refused play(); stay
 *                              paused and show "tap to play"
 *   loadMusic(): Promise<MusicTrack[]>   fetch the manifest (no audio is
 *                              fetched until a track is chosen); needs the
 *                              Enter gesture
 *   warm(id?): Promise<void>   loadMusic() + preload="auto" on an idle pooled
 *                              element for that track (else the current, else
 *                              the first) so the seal starts from buffered data;
 *                              playTrack adopts the element. Skipped on
 *                              Save-Data, or while that track already plays.
 *   playTrack(id): Promise<void>  ~1.2 s equal-power crossfade from the current
 *                              track; first start of a track this session joins
 *                              in progress at Date.now()/1000 % duration, later
 *                              starts resume where it was left. Turns musicOn on.
 *                              The current track (or the one starting) is a
 *                              no-op; back to the current one cancels a start.
 *   pause() / resume()         resume() plays the track last asked for (the
 *                              first one when nothing was chosen)
 *   seek(seconds)              file tracks only
 *   next() / prev()            wrap around the list, counted from the track
 *                              last asked for (so presses advance while loading)
 *   shuffle(): string | null   play a random other track; returns its id
 *   setMusicOn(on)             settings toggle: mutes the bus; off pauses, on
 *                              resumes (or starts the first track)
 *   getMusicAnalyser()         AnalyserNode on the music bus (null before Enter)
 *   onTrackChange(cb)          cb(track) whenever the current track changes;
 *                              returns an unsubscribe function
 *
 * While music is audible the ambience bed drops to track.ambience (default
 * 0.6) with a 1.5 s ramp, and comes back on pause. A hidden tab suspends the
 * AudioContext (engine behaviour) and pauses the <audio> elements; both carry
 * on when the tab is visible again. Media Session metadata, playbackState,
 * position state and play/pause/next/prev/seekto handlers are set, and since
 * real <audio> elements play, the OS media keys and notification controls
 * route to them.
 *
 * Dev builds add window.__audio.music = { api, state(), gains(), check(), rms() }.
 */
import { reactive } from "vue";
import { musicPort, useAudio } from "./useAudio";
import { useSettings } from "./useSettings";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export interface MusicTrack {
  id: string;
  title: string;
  mood: MusicMood;
  /** One-line flavour text for the player UI. */
  verse: string;
  /** "#rrggbb" accent for the UI / 3D music box. */
  tint: string;
  /** Seconds (one loop for placeholders). */
  duration: number;
  loop: boolean;
  /** Linear gain on top of the music bus. */
  gain: number;
  /** Ambience level while this track plays, 0..1. */
  ambience: number;
  /** "file" = manifest track, "synth" = generative placeholder. */
  kind: "file" | "synth";
  /** Base path under /audio/ without extension (file tracks). */
  files?: string;
}

export interface MusicState {
  tracks: MusicTrack[];
  currentId: string | null;
  /** The track a switch is starting (null when none is in flight). */
  pendingId: string | null;
  playing: boolean;
  position: number;
  duration: number;
  loading: boolean;
  /** play() was refused by the browser (autoplay policy): offer "tap to play". */
  blocked: boolean;
  /**
   * How much of the active (or starting) file is downloaded, 0..1: the end of
   * the buffered range around the playhead over the duration. 0 for synth.
   */
  buffered: number;
}

interface ManifestTrack {
  id?: unknown;
  title?: unknown;
  mood?: unknown;
  verse?: unknown;
  files?: unknown;
  duration?: unknown;
  loop?: unknown;
  gain?: unknown;
  tint?: unknown;
  ambience?: unknown;
}

/* ------------------------------------------------------------------ */
/* Placeholder moods                                                    */
/* ------------------------------------------------------------------ */

/**
 * Each placeholder is a generative music-box tune in a game's flavour. Its
 * id is also its mood: a manifest track with the same id replaces it, and a
 * real track's `mood` picks which tune plays if its file fails to load.
 */
interface MoodDef {
  title: string;
  verse: string;
  tint: string;
  /** Ambience bed level while it plays (0..1). */
  ambience: number;
  /** MIDI note of the tonic in the melody octave. */
  root: number;
  /** Semitone offsets of the mode (5 or 7 notes). */
  scale: number[];
  bpm: number;
  beatsPerBar: number;
  /** Steps per beat (2 = eighths, 3 = compound-time eighths). */
  subdiv: number;
  /** Chance a non-downbeat step sounds a melody note. */
  density: number;
  /** Scale-degree moves for the melody's random walk. */
  moves: number[];
  /** Melody shape: stepwise walk, chord arpeggios, or 2-bar call + answer. */
  style: "walk" | "arp" | "call";
  /** "roots": chord root per bar (+ fifth mid-bar); "walking": every beat;
   *  "drone": tonic re-struck each bar; "fifths": tonic + fifth drone. */
  bass: "roots" | "walking" | "drone" | "fifths";
  /** Chance of a third below on a downbeat (music-box double stop). */
  doubleStop: number;
  /** One chord root (scale degree, 0-based) per bar of a 4-bar phrase. */
  chordsA: number[];
  chordsB: number[];
  seed: number;
}

const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const MINOR_PENTA = [0, 3, 5, 7, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11];
const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];

const MOODS = {
  witcher: {
    title: "The Witcher",
    verse: "Wind off the Skellige cliffs, a fiddle by the fire",
    tint: "#4f7a8c",
    ambience: 0.6,
    root: 74,
    scale: DORIAN,
    bpm: 110,
    beatsPerBar: 2,
    subdiv: 3,
    density: 0.7,
    moves: [-2, -1, -1, 1, 1, 2],
    style: "walk",
    bass: "drone",
    doubleStop: 0.2,
    chordsA: [0, 6, 0, 4],
    chordsB: [2, 6, 3, 0],
    seed: 1101,
  },
  skyrim: {
    title: "Skyrim",
    verse: "Snow on the eaves, a hearth in Whiterun",
    tint: "#8fa7b8",
    ambience: 0.55,
    root: 74,
    scale: MINOR_PENTA,
    bpm: 70,
    beatsPerBar: 4,
    subdiv: 2,
    density: 0.3,
    moves: [-3, -2, -2, 2, 2, 3],
    style: "walk",
    bass: "fifths",
    doubleStop: 0.15,
    chordsA: [0, 3, 0, 4],
    chordsB: [2, 3, 4, 0],
    seed: 2203,
  },
  minecraft: {
    title: "Minecraft",
    verse: "Soft piano at dusk; the blocks can wait",
    tint: "#6fa86a",
    ambience: 0.7,
    root: 79,
    scale: MAJOR,
    bpm: 66,
    beatsPerBar: 4,
    subdiv: 2,
    density: 0.16,
    moves: [-4, -2, -1, 1, 2, 3],
    style: "walk",
    bass: "roots",
    doubleStop: 0.05,
    chordsA: [0, 3, 5, 4],
    chordsB: [3, 0, 5, 3],
    seed: 3307,
  },
  "baldurs-gate-3": {
    title: "Baldur's Gate 3",
    verse: "Dice on the table, a party far from home",
    tint: "#c08a3e",
    ambience: 0.6,
    root: 74,
    scale: HARMONIC_MINOR,
    bpm: 84,
    beatsPerBar: 4,
    subdiv: 2,
    density: 0.85,
    moves: [-1, 1],
    style: "arp",
    bass: "roots",
    doubleStop: 0,
    chordsA: [0, 5, 3, 4],
    chordsB: [5, 2, 3, 4],
    seed: 4409,
  },
  "dragon-age": {
    title: "Dragon Age",
    verse: "A tavern bard, a lute, the Inquisition marching on",
    tint: "#9b3b2f",
    ambience: 0.6,
    root: 76,
    scale: AEOLIAN,
    bpm: 92,
    beatsPerBar: 4,
    subdiv: 2,
    density: 0.5,
    moves: [-2, -1, -1, 1, 1, 2],
    style: "call",
    bass: "roots",
    doubleStop: 0.3,
    chordsA: [0, 5, 6, 0],
    chordsB: [3, 0, 6, 4],
    seed: 5501,
  },
} satisfies Record<string, MoodDef>;

export type MusicMood = keyof typeof MOODS;

const MOOD_KEYS = Object.keys(MOODS) as MusicMood[];

function placeholderTrack(mood: MusicMood): MusicTrack {
  const m: MoodDef = MOODS[mood];
  return {
    id: mood,
    title: m.title,
    mood,
    verse: m.verse,
    tint: m.tint,
    duration: compose(mood).loopSeconds,
    loop: true,
    gain: 1,
    ambience: m.ambience,
    kind: "synth",
  };
}

/* ------------------------------------------------------------------ */
/* Composition (deterministic per mood)                                 */
/* ------------------------------------------------------------------ */

/** mulberry32: small seeded PRNG. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Note {
  midi: number;
  vel: number;
  bass: boolean;
}

interface Score {
  /** notes[step] = notes starting on that step. */
  steps: Note[][];
  stepSeconds: number;
  loopSeconds: number;
}

const scoreCache = new Map<MusicMood, Score>();

/** MIDI note of scale degree `deg` (may be negative or past the octave). */
function degreeMidi(m: MoodDef, root: number, deg: number): number {
  const n = m.scale.length;
  const oct = Math.floor(deg / n);
  const d = ((deg % n) + n) % n;
  return root + 12 * oct + m.scale[d]!;
}

/**
 * 32 bars: A A' B B' A C C' A'' (4 bars each; primes keep the first two
 * bars of their source). The melody lives in the octave above the tonic and
 * lands on chord tones on strong beats; "arp" spells the chord out instead,
 * "call" answers each 2-bar phrase a little lower and quieter. Phrases end
 * on the tonic.
 */
function compose(mood: MusicMood): Score {
  const hit = scoreCache.get(mood);
  if (hit) return hit;
  const m: MoodDef = MOODS[mood];
  const rng = seeded(m.seed);
  const n = m.scale.length;
  const stepsPerBar = m.beatsPerBar * m.subdiv;
  const stepSeconds = 60 / m.bpm / m.subdiv;
  const lo = n - 2;
  const hi = 2 * n + 1;
  const chordTones = (chord: number) =>
    [0, 2, 4, n, n + 2, n + 4]
      .map((t) => chord + t)
      .filter((t) => t >= lo && t <= hi);
  const nearest = (tones: number[], deg: number) =>
    tones.reduce(
      (best, t) => (Math.abs(t - deg) < Math.abs(best - deg) ? t : best),
      tones[0] ?? n,
    );

  const phrase = (
    chords: number[],
    cadence: boolean,
    vary?: Note[][],
  ): Note[][] => {
    const out: Note[][] = [];
    let deg = n + [0, 2, 4][Math.floor(rng() * 3)]!; // start on a tonic-chord tone
    for (let bar = 0; bar < 4; bar++) {
      const chord = chords[bar]!;
      const answer = m.style === "call" && bar % 2 === 1;
      for (let s = 0; s < stepsPerBar; s++) {
        const idx = bar * stepsPerBar + s;
        if (vary && bar < 2) {
          out.push(vary[idx]!.filter((x) => !x.bass).map((x) => ({ ...x })));
          continue;
        }
        const notes: Note[] = [];
        const downbeat = s === 0;
        const onBeat = s % m.subdiv === 0;
        if (cadence && bar === 3) {
          if (s === 0)
            notes.push({
              midi: degreeMidi(m, m.root, n),
              vel: 0.9,
              bass: false,
            });
          out.push(notes);
          continue;
        }
        if (m.style === "arp") {
          // broken chord up and back down, a rest now and then
          const tones = [0, 2, 4, n, n + 2, n + 4, n + 2, n].map(
            (t) => chord + t,
          );
          if (downbeat || rng() < m.density) {
            const d = Math.min(hi + 2, tones[s % tones.length]!);
            notes.push({
              midi: degreeMidi(m, m.root, d - n),
              vel: downbeat ? 0.8 : onBeat ? 0.6 : 0.5,
              bass: false,
            });
            if (s === stepsPerBar - 1 && rng() < 0.5) {
              notes.push({
                midi: degreeMidi(m, m.root, nearest(chordTones(chord), deg)),
                vel: 0.4,
                bass: false,
              });
            }
          }
          out.push(notes);
          continue;
        }
        // call-and-response: the answer bar leaves its last beat empty
        const breath = answer && s >= stepsPerBar - m.subdiv;
        const density = answer ? m.density * 0.8 : m.density;
        if (
          !breath &&
          (downbeat || rng() < (onBeat ? density + 0.15 : density))
        ) {
          if (onBeat && rng() < 0.6) deg = nearest(chordTones(chord), deg);
          else
            deg = Math.min(
              hi,
              Math.max(lo, deg + m.moves[Math.floor(rng() * m.moves.length)]!),
            );
          const shift = answer ? -2 : 0;
          const base = downbeat ? 0.85 : onBeat ? 0.7 : 0.55;
          notes.push({
            midi: degreeMidi(m, m.root, deg + shift),
            vel: answer ? base * 0.8 : base,
            bass: false,
          });
          if (downbeat && rng() < m.doubleStop) {
            notes.push({
              midi: degreeMidi(m, m.root, deg + shift - 2),
              vel: 0.45,
              bass: false,
            });
          }
        }
        out.push(notes);
      }
    }
    return out;
  };

  const fifth = m.scale.indexOf(7);
  const withBass = (mel: Note[][], chords: number[]): Note[][] =>
    mel.map((notes, idx) => {
      const bar = Math.floor(idx / stepsPerBar);
      const s = idx % stepsPerBar;
      const chord = chords[bar]!;
      const bassRoot = m.root - 24;
      const out = notes.slice();
      const add = (deg: number, vel: number) =>
        out.push({ midi: degreeMidi(m, bassRoot, deg), vel, bass: true });
      switch (m.bass) {
        case "drone":
          if (s === 0) add(0, 0.7);
          if (s === stepsPerBar / 2) add(chord, 0.4);
          break;
        case "fifths":
          if (s === 0) {
            add(0, 0.65);
            add(fifth >= 0 ? fifth : 3, 0.5);
          }
          break;
        case "walking":
          if (s === 0) add(chord, 0.75);
          else if (s % m.subdiv === 0)
            add(chord + ((s / m.subdiv) % 2 === 1 ? 4 : n), 0.5);
          break;
        default:
          if (s === 0) add(chord, 0.75);
          else if (s === stepsPerBar / 2 && m.beatsPerBar % 2 === 0)
            add(chord + 4, 0.45);
      }
      return out;
    });

  const A = phrase(m.chordsA, true);
  const A1 = phrase(m.chordsA, true, A);
  const B = phrase(m.chordsB, false);
  const B1 = phrase(m.chordsB, true, B);
  const cC = [...m.chordsB].reverse();
  const C = phrase(cC, false);
  const C1 = phrase(cC, true, C);
  const A2 = phrase(m.chordsA, true, A1);
  const steps = [
    ...withBass(A, m.chordsA),
    ...withBass(A1, m.chordsA),
    ...withBass(B, m.chordsB),
    ...withBass(B1, m.chordsB),
    ...withBass(A, m.chordsA),
    ...withBass(C, cC),
    ...withBass(C1, cC),
    ...withBass(A2, m.chordsA),
  ];
  const score = { steps, stepSeconds, loopSeconds: steps.length * stepSeconds };
  scoreCache.set(mood, score);
  return score;
}

/**
 * Spring winding down: each loop starts at speed and drags up to ~4 % by the
 * end, with a slight flutter. Position/duration stay in nominal seconds.
 */
function stepFactor(step: number, total: number): number {
  const phase = (step % total) / total;
  return (
    (1 + 0.04 * phase * phase) *
    (1 + 0.01 * Math.sin((2 * Math.PI * step) / 23))
  );
}

/* ------------------------------------------------------------------ */
/* Voices                                                               */
/* ------------------------------------------------------------------ */

/**
 * Music-box tine: sine fundamental, a slightly detuned twin for shimmer and
 * the cantilever-bar overtones (6.27x, 17.55x) that die fast. 3 ms attack,
 * exponential decay (~1.5-3 s; lower teeth ring longer).
 */
function tine(
  c: AudioContext,
  out: AudioNode,
  t: number,
  midi: number,
  vel: number,
): void {
  const f = 440 * Math.pow(2, (midi - 69) / 12);
  const decay = Math.min(3, Math.max(1.5, 3.4 - (midi - 48) * 0.045));
  const partials: [number, number, number][] = [
    [1, 1, decay],
    [1.0025, 0.35, decay * 0.8],
    [6.27, 0.12, decay * 0.12],
    [17.55, 0.04, 0.05],
  ];
  const amp = 0.16 * vel;
  for (const [ratio, a, d] of partials) {
    const freq = f * ratio;
    if (freq > c.sampleRate / 2 - 200) continue;
    const osc = c.createOscillator();
    osc.frequency.value = freq;
    const env = c.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(amp * a, t + 0.003);
    // -60 dB after d seconds: time constant d / ln(1000)
    env.gain.setTargetAtTime(0, t + 0.003, d / 6.9);
    osc.connect(env).connect(out);
    osc.start(t);
    osc.stop(t + d + 0.1);
    osc.addEventListener("ended", () => env.disconnect(), { once: true });
  }
}

let impulse: AudioBuffer | null = null;

/** Short room: 1.6 s stereo noise with an exponential tail, 12 ms pre-delay. */
function reverbImpulse(c: AudioContext): AudioBuffer {
  if (impulse && impulse.sampleRate === c.sampleRate) return impulse;
  const seconds = 1.6;
  const len = Math.floor(c.sampleRate * seconds);
  const pre = Math.floor(c.sampleRate * 0.012);
  const buf = c.createBuffer(2, len, c.sampleRate);
  const rng = seeded(97);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = pre; i < len; i++) {
      const tt = (i - pre) / c.sampleRate;
      data[i] = (rng() * 2 - 1) * Math.exp(-tt * 4.3);
    }
  }
  impulse = buf;
  return buf;
}

/* ------------------------------------------------------------------ */
/* Gain automation                                                      */
/* ------------------------------------------------------------------ */

/**
 * Freeze `param` at its value right now and return that value. A bare
 * cancelScheduledValues() would restore the value from before a ramp that is
 * still running (Web Audio spec), an audible jump mid-fade; cancelAndHoldAtTime
 * keeps the in-flight value. Where it is missing (Firefox) the read value is
 * written back at once instead.
 */
function holdNow(c: AudioContext, param: AudioParam): number {
  const now = c.currentTime;
  const from = param.value;
  if (typeof param.cancelAndHoldAtTime === "function") param.cancelAndHoldAtTime(now);
  else param.cancelScheduledValues(now);
  param.setValueAtTime(from, now);
  return from;
}

/**
 * Equal-power fade of `param` from wherever it is to `to` over `seconds`:
 * hold first, then a chain of short linear ramps along the sin/cos curve
 * (plain ramps never overlap-throw the way setValueCurveAtTime can).
 */
function rampGain(c: AudioContext, param: AudioParam, to: number, seconds: number): void {
  const from = holdNow(c, param);
  const now = c.currentTime;
  if (seconds <= 0.005 || Math.abs(to - from) < 1e-4) {
    param.linearRampToValueAtTime(to, now + 0.005);
    return;
  }
  const n = 16;
  for (let i = 1; i <= n; i++) {
    const x = i / n;
    const v =
      to > from
        ? from + (to - from) * Math.sin((x * Math.PI) / 2)
        : to + (from - to) * Math.cos((x * Math.PI) / 2);
    param.linearRampToValueAtTime(v, now + seconds * x);
  }
}

/* ------------------------------------------------------------------ */
/* Synth players                                                        */
/* ------------------------------------------------------------------ */

interface Synth {
  serial: number;
  track: MusicTrack;
  out: GainNode;
  /** Scheduler alive (false once its fade-out finished). */
  running: boolean;
  /** stop() was called: fading out. */
  stopping: boolean;
  /** Nominal position (s) right now. */
  position: () => number;
  tick: (now: number) => void;
  /** Fade out over `seconds`, stop scheduling, free the graph after the tails. */
  stop: (seconds: number) => void;
}

const LOOKAHEAD = 0.12;
const MAX_LOOKAHEAD = 1;
const TICK_MS = 25;
/**
 * Scheduling horizon: LOOKAHEAD normally; when the main thread is busy
 * (WebGL frames, slow devices) and ticks arrive late, it stretches to 1.5x
 * the observed gap (max 1 s) so the music box never runs out of notes.
 */
let lookahead = LOOKAHEAD;
/** Track-to-track crossfade. */
const XFADE = 1.2;
/** Hard cut of an older outgoing voice (short enough to be "now", long enough not to click). */
const CUT = 0.06;
/** Switch requests closer together than this are coalesced: only the last one loads. */
const COALESCE_MS = 150;
let synthSerial = 0;

/** Every synth scheduler that still exists (the current one and fading ones). */
const synths = new Set<Synth>();

function synthPlayer(c: AudioContext, track: MusicTrack, offset: number, when: number): Synth {
  const score = compose(track.mood);
  const total = score.steps.length;
  const out = c.createGain();
  out.gain.value = 0;
  const voiceBus = c.createGain();
  voiceBus.gain.value = track.gain;
  const tone = c.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 9000;
  const wet = c.createGain();
  wet.gain.value = 0.32;
  const conv = new ConvolverNode(c, { buffer: reverbImpulse(c) });
  voiceBus.connect(tone);
  tone.connect(out);
  tone.connect(conv).connect(wet).connect(out);

  let step = Math.floor(offset / score.stepSeconds) % total;
  let nextTime = when;
  /** recent [ctxTime, step] pairs for position lookup */
  const marks: [number, number][] = [];
  let stopTimer: ReturnType<typeof setTimeout> | null = null;

  const s: Synth = {
    serial: ++synthSerial,
    track,
    out,
    running: true,
    stopping: false,
    tick(now) {
      if (!s.running) return;
      while (nextTime < now + lookahead) {
        const idx = step % total;
        for (const n of score.steps[idx]!)
          tine(c, voiceBus, nextTime, n.midi, n.bass ? n.vel * 0.8 : n.vel);
        marks.push([nextTime, idx]);
        if (marks.length > 64) marks.shift();
        nextTime += score.stepSeconds * stepFactor(step, total);
        step++;
      }
    },
    position() {
      const now = c.currentTime;
      for (let i = marks.length - 1; i >= 0; i--) {
        const [t, idx] = marks[i]!;
        if (t <= now) {
          const frac = Math.min(1, (now - t) / score.stepSeconds);
          return (idx + frac) * score.stepSeconds;
        }
      }
      return (marks[0]?.[1] ?? step % total) * score.stepSeconds;
    },
    stop(seconds) {
      s.stopping = true;
      rampGain(c, out.gain, 0, seconds);
      if (stopTimer) clearTimeout(stopTimer);
      // keep scheduling while the fade runs, then stop and let the tails ring out
      stopTimer = setTimeout(() => {
        s.running = false;
        synths.delete(s);
        setTimeout(() => {
          voiceBus.disconnect();
          tone.disconnect();
          conv.disconnect();
          wet.disconnect();
          out.disconnect();
        }, 3200);
        stopTickerIfIdle();
      }, seconds * 1000 + 30);
    },
  };
  synths.add(s);
  s.tick(c.currentTime);
  return s;
}

/* ------------------------------------------------------------------ */
/* Streaming voices (pooled <audio> elements)                           */
/* ------------------------------------------------------------------ */

/** Overlap of the ping-pong loop seam, in seconds. */
const SEAM = 0.5;
/** Start buffering the spare element this long before the loop point. */
const SEAM_PRELOAD = 8;
/** current + outgoing + one spare (warm / seam / the next start). */
const POOL_SIZE = 3;

/**
 * idle      free: paused, no src, gain 0
 * warming   preloading a track for warm() (paused, gain 0)
 * starting  a switch is starting it (gain 0 until it takes over)
 * active    the current track
 * fadingOut crossfading / cutting out; released when the fade ends
 * seam      buffering the current track from 0 for the loop seam (paused, gain 0)
 */
type VoiceState = "idle" | "warming" | "starting" | "active" | "fadingOut" | "seam";

interface Voice {
  index: number;
  el: HTMLAudioElement;
  /** createMediaElementSource may only run once per element: cached here. */
  node: MediaElementAudioSourceNode;
  gain: GainNode;
  state: VoiceState;
  trackId: string | null;
  /** Bumped on every release: listeners, timers and promises of an older lease bail. */
  lease: number;
  off: (() => void)[];
  timers: ReturnType<typeof setTimeout>[];
  /** Rejects the startVoice() promise of this lease, if one is waiting. */
  abort?: () => void;
  /** warming: what it is preloading. */
  warm?: { id: string; url: string };
  /** fadingOut: context time the fade ends (the ticker frees it then, if its timer is late). */
  fadeEnd?: number;
}

let pool: { ctx: AudioContext; voices: Voice[] } | null = null;

function voicePool(c: AudioContext): Voice[] {
  if (pool && pool.ctx === c) return pool.voices;
  dropPool();
  const make = (index: number): Voice => {
    const el = new Audio();
    el.preload = "none";
    el.loop = false;
    const node = c.createMediaElementSource(el);
    const gain = c.createGain();
    gain.gain.value = 0;
    node.connect(gain);
    const input = musicPort.input();
    if (input) gain.connect(input);
    return { index, el, node, gain, state: "idle", trackId: null, lease: 0, off: [], timers: [] };
  };
  pool = { ctx: c, voices: Array.from({ length: POOL_SIZE }, (_, i) => make(i)) };
  return pool.voices;
}

/** The context is gone: its elements can never be wired again, so drop them. */
function dropPool(): void {
  if (!pool) return;
  for (const v of pool.voices) {
    releaseVoice(v);
    v.gain.disconnect();
  }
  pool = null;
}

/** Listen for this lease only (removed on release). */
function listen(v: Voice, type: string, fn: (e: Event) => void): void {
  const lease = v.lease;
  const guarded = (e: Event) => {
    if (v.lease === lease) fn(e);
  };
  v.el.addEventListener(type, guarded);
  v.off.push(() => v.el.removeEventListener(type, guarded));
}

/** setTimeout for this lease only (cleared on release). */
function later(v: Voice, ms: number, fn: () => void): void {
  const lease = v.lease;
  const t = setTimeout(() => {
    if (v.lease === lease) fn();
  }, ms);
  v.timers.push(t);
}

/** Downloaded fraction of the file: end of the buffered range at the playhead. */
function bufferedFraction(el: HTMLAudioElement, fallbackDuration: number): number {
  const d = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : fallbackDuration;
  if (!(d > 0)) return 0;
  const r = el.buffered;
  let end = 0;
  for (let i = 0; i < r.length; i++) {
    if (el.currentTime >= r.start(i) - 0.25 && el.currentTime <= r.end(i) + 0.25) end = r.end(i);
  }
  if (!end && r.length) end = r.end(r.length - 1);
  return Math.min(1, end / d);
}

/**
 * Free a voice at once: new lease (so nothing of the old one can touch it),
 * listeners and timers gone, element paused and emptied (removeAttribute('src')
 * + load() releases the connection and rejects a pending play() with
 * AbortError), gain 0. Only call on a silent voice, or after its fade.
 */
function releaseVoice(v: Voice): void {
  if (import.meta.env.DEV && !v.el.paused && v.gain.gain.value > 0.05) {
    stats.invariantViolations++;
    console.warn(
      `[music] invariant violated (release): voice ${v.index} (${v.state}) freed at gain ${v.gain.gain.value.toFixed(3)}`,
      new Error().stack?.split("\n").slice(1, 5).join(" | "),
    );
  }
  v.lease++;
  for (const fn of v.off) fn();
  v.off = [];
  for (const t of v.timers) clearTimeout(t);
  v.timers = [];
  const abort = v.abort;
  v.abort = undefined;
  const el = v.el;
  el.pause();
  el.loop = false;
  if (el.hasAttribute("src")) {
    el.removeAttribute("src");
    el.load();
  }
  el.preload = "none";
  v.warm = undefined;
  v.fadeEnd = undefined;
  v.state = "idle";
  v.trackId = null;
  const c = pool?.ctx;
  if (c && c.state !== "closed") {
    v.gain.gain.cancelScheduledValues(0);
    v.gain.gain.setValueAtTime(0, c.currentTime);
  }
  v.gain.gain.value = 0;
  abort?.();
}

/**
 * Fade a voice out and release it when the fade is done. `wrap`: a looping
 * track near its end wraps during the fade instead of stopping dead (the
 * files are cut to loop); the seam's old lap must not wrap.
 */
function fadeOutVoice(c: AudioContext, v: Voice, seconds: number, wrap: boolean): void {
  for (const fn of v.off) fn();
  v.off = [];
  v.state = "fadingOut";
  v.el.loop = wrap;
  const end = c.currentTime + seconds;
  v.fadeEnd = end;
  rampGain(c, v.gain.gain, 0, seconds);
  // the audio clock is the authority: a timer that fires before the fade is
  // over (audio thread behind) waits for the rest instead of cutting it
  const done = () => {
    // a later fade on the same voice may have moved the end
    const left = (v.fadeEnd ?? end) - c.currentTime;
    if (left > 0.005 && c.state === "running") later(v, left * 1000 + 20, done);
    else releaseVoice(v);
  };
  later(v, seconds * 1000 + 20, done);
}

function streamUrl(track: MusicTrack, fmt: string): string {
  return `${musicPort.base}${track.files}.${fmt}`;
}

/**
 * Point `v` at `url` and start it at gain 0; resolves on the `playing` event
 * with the offset it started from. The currentTime set before metadata is the
 * "default playback start position", so the first request already lands near
 * the join point and play() is called inside the caller's gesture chain.
 * Rejects on a media error, a refused play() (NotAllowedError), or when the
 * voice is released meanwhile (AbortError).
 */
function startVoice(
  v: Voice,
  url: string,
  track: MusicTrack,
  wanted: (duration: number) => number,
  adopt: boolean,
): Promise<{ offset: number; duration: number }> {
  const el = v.el;
  const lease = v.lease;
  return new Promise((resolve, reject) => {
    let offset = 0;
    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (v.lease === lease) v.abort = undefined;
      fn();
    };
    v.abort = () => done(() => reject(new DOMException("voice released", "AbortError")));
    const known = () =>
      Number.isFinite(el.duration) && el.duration > 0 ? el.duration : track.duration;
    const play = () => {
      el.play().catch((err: unknown) => {
        if (v.lease === lease) done(() => reject(err));
      });
    };
    listen(v, "error", () => done(() => reject(new Error(`media error ${el.error?.code ?? "?"}`))));
    listen(v, "playing", () => done(() => resolve({ offset, duration: known() })));
    const onMeta = () => {
      const d = known();
      if (!(track.duration > 0)) {
        offset = wanted(d);
        el.currentTime = offset;
        play();
      } else if (offset >= d - 0.05) {
        // manifest duration was off: wrap into the real one
        offset = wanted(d);
        el.currentTime = offset;
      }
    };
    listen(v, "loadedmetadata", onMeta);
    listen(v, "progress", () => {
      if (pending?.voice === v) musicState.buffered = bufferedFraction(el, track.duration);
    });
    v.gain.gain.cancelScheduledValues(0);
    v.gain.gain.value = 0;
    el.loop = false;
    el.preload = "auto";
    if (adopt) {
      // warm() already set src and started the download: keep it going
      v.warm = undefined;
      if (el.error) {
        done(() => reject(new Error(`media error ${el.error!.code}`)));
        return;
      }
      if (el.readyState >= 1) onMeta();
      musicState.buffered = bufferedFraction(el, track.duration);
      if (!(track.duration > 0)) return;
    } else {
      el.src = url;
    }
    if (track.duration > 0) {
      offset = wanted(track.duration);
      el.currentTime = offset;
      play();
    }
  });
}

/* ------------------------------------------------------------------ */
/* State                                                                */
/* ------------------------------------------------------------------ */

export const musicState = reactive<MusicState>({
  tracks: [],
  currentId: null,
  pendingId: null,
  playing: false,
  position: 0,
  duration: 0,
  loading: false,
  blocked: false,
  buffered: 0,
});

/** What is playing: one file voice or one synth. */
type Slot =
  | {
      kind: "file";
      track: MusicTrack;
      voice: Voice;
      /** voice.lease when the slot took it: a released voice is no longer the slot's. */
      lease: number;
      url: string;
      /** Spare buffering the loop seam, if any. */
      spare: Voice | null;
    }
  | { kind: "synth"; track: MusicTrack; synth: Synth };

const manifestUrl = `${musicPort.base}music/manifest.json`;
let manifestPromise: Promise<MusicTrack[]> | null = null;
let current: Slot | null = null;
/** The one slot crossfading out (older ones are hard-cut). */
let outgoing: Slot | null = null;
/** A start in progress: the generation it belongs to and the element it holds. */
let pending: { gen: number; track: MusicTrack; voice: Voice | null } | null = null;
/**
 * Generation: bumped by every playTrack / pause / next / prev / shuffle /
 * seek. Every async continuation compares its own against it and bails
 * (freeing its voice) when a newer request has come in.
 */
let gen = 0;
/** The track the latest request asked for (resume() and next() count from it). */
let targetId: string | null = null;
/** True from the moment playback is requested (before the stream starts). */
let wantPlaying = false;
/** Hidden tab: the elements are paused, the seam waits. */
let suspended = false;
let ticker: ReturnType<typeof setInterval> | null = null;
let lastTickAt = 0;
let lastPositionAt = 0;
let lastCheckAt = 0;
const listeners = new Set<(t: MusicTrack) => void>();
let mediaHooked = false;
/** Last nominal position per track id (join-in-progress happens once). */
const positions = new Map<string, number>();
/** Tracks whose file failed: they play their mood's melody instead. */
const failed = new Set<string>();
/** Coalescing: a burst of requests waits for a quiet COALESCE_MS, then the last one runs. */
let lastRequestAt = -Infinity;
let coalesceTimer: ReturnType<typeof setTimeout> | null = null;
let coalesceWaiters: (() => void)[] = [];
const stats = {
  requests: 0,
  coalesced: 0,
  loads: 0,
  superseded: 0,
  hardCuts: 0,
  seams: 0,
  loopFallbacks: 0,
  invariantViolations: 0,
};

function findTrack(id: string | null): MusicTrack | undefined {
  return id ? musicState.tracks.find((t) => t.id === id) : undefined;
}

function isMood(v: unknown): v is MusicMood {
  return typeof v === "string" && (MOOD_KEYS as string[]).includes(v);
}

/** Stable mood for an unknown mood string (so it still has a fallback tune). */
function moodFor(id: string): MusicMood {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return MOOD_KEYS[h % MOOD_KEYS.length]!;
}

function parseTrack(raw: ManifestTrack): MusicTrack | null {
  if (typeof raw.id !== "string" || !raw.id || typeof raw.files !== "string")
    return null;
  const mood = isMood(raw.mood)
    ? raw.mood
    : isMood(raw.id)
      ? raw.id
      : moodFor(raw.id);
  const num = (v: unknown, lo: number, hi: number, d: number) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.min(hi, Math.max(lo, v))
      : d;
  return {
    id: raw.id,
    title: typeof raw.title === "string" && raw.title ? raw.title : raw.id,
    mood,
    verse: typeof raw.verse === "string" ? raw.verse : MOODS[mood].verse,
    tint:
      typeof raw.tint === "string" && /^#[0-9a-f]{6}$/i.test(raw.tint)
        ? raw.tint
        : MOODS[mood].tint,
    duration: num(raw.duration, 0, 36000, 0),
    loop: raw.loop !== false,
    gain: num(raw.gain, 0, 4, 1),
    ambience: num(raw.ambience, 0, 1, MOODS[mood].ambience),
    kind: "file",
    files: raw.files,
  };
}

/* ------------------------------------------------------------------ */
/* Slots                                                                */
/* ------------------------------------------------------------------ */

function slotPosition(s: Slot): number {
  if (s.kind === "synth") return s.synth.position();
  const el = s.voice.el;
  const d = slotDuration(s);
  return d > 0 ? Math.min(el.currentTime, d) : el.currentTime;
}

function slotDuration(s: Slot): number {
  if (s.kind === "synth") return compose(s.track.mood).loopSeconds;
  const d = s.voice.el.duration;
  return Number.isFinite(d) && d > 0 ? d : s.track.duration;
}

/** The slot's voice while the slot still holds it (null once released). */
function slotVoice(s: Slot | null): Voice | null {
  return s?.kind === "file" && s.voice.lease === s.lease ? s.voice : null;
}

function dropSpare(s: Slot): void {
  if (s.kind !== "file" || !s.spare) return;
  releaseVoice(s.spare);
  s.spare = null;
}

/** Fade a slot out over `seconds` (its voice/synth frees itself afterwards). */
function fadeSlot(c: AudioContext, s: Slot, seconds: number): void {
  if (s.kind === "synth") {
    s.synth.stop(seconds);
    return;
  }
  dropSpare(s);
  const v = slotVoice(s);
  // a track fading out wraps if it loops; one already fading (e.g. the seam's
  // old lap, which must not wrap) keeps what it had
  if (v) fadeOutVoice(c, v, seconds, v.state === "fadingOut" ? v.el.loop : s.track.loop);
}

/**
 * `s` stops being current: remember where it was, fade it over `seconds`
 * and make it the one outgoing slot. An older outgoing slot is hard-cut so
 * no more than two things ever sound at once.
 */
function retire(c: AudioContext, s: Slot, seconds: number): void {
  positions.set(s.track.id, slotPosition(s));
  if (outgoing && outgoing !== s) {
    stats.hardCuts++;
    fadeSlot(c, outgoing, CUT);
  }
  fadeSlot(c, s, seconds);
  outgoing = s;
  const mine = s;
  setTimeout(() => {
    if (outgoing === mine) outgoing = null;
    stopTickerIfIdle();
  }, seconds * 1000 + 60);
}

/** Every synth other than `keep` fades out (no orphan schedulers). */
function stopOtherSynths(keep: Synth | null, seconds: number): void {
  for (const s of synths) {
    if (s === keep) continue;
    if (outgoing?.kind === "synth" && outgoing.synth === s) continue;
    s.stop(seconds);
  }
}

/** Is a voice still needed by someone? */
function owned(v: Voice): boolean {
  if (current?.kind === "file" && (current.voice === v || current.spare === v)) return true;
  if (slotVoice(outgoing) === v) return true;
  if (pending?.voice === v) return true;
  return v.state === "warming" || v.state === "fadingOut";
}

/**
 * An element for a new start: an idle one, else the warming one, else the
 * current track's seam spare; as a last resort the outgoing voice is cut.
 */
async function acquireVoice(c: AudioContext, stale: () => boolean): Promise<Voice | null> {
  const vs = voicePool(c);
  // a released voice that nobody references is idle whatever it says
  for (const v of vs) if (v.state !== "idle" && !owned(v)) releaseVoice(v);
  const pick = (): Voice | undefined =>
    vs.find((v) => v.state === "idle") ??
    vs.find((v) => v.state === "warming") ??
    (current?.kind === "file" && current.spare ? current.spare : undefined);
  let v = pick();
  if (!v) {
    // pool full (current + outgoing + one cutting out): cut the oldest and wait for it
    const outVoice = slotVoice(outgoing);
    const victim =
      vs.find((x) => x.state === "fadingOut" && x !== outVoice) ?? outVoice ?? undefined;
    if (victim) {
      stats.hardCuts++;
      fadeOutVoice(c, victim, CUT, victim.el.loop);
      const lease = victim.lease;
      if (outVoice === victim) outgoing = null;
      // fadeOutVoice frees it when the cut is over (audio clock)
      for (let i = 0; i < 20 && victim.lease === lease; i++)
        await new Promise((r) => setTimeout(r, CUT * 1000 + 20));
      if (stale()) return null;
      if (victim.lease === lease) releaseVoice(victim);
      v = pick();
    }
  }
  if (!v) return null;
  if (current?.kind === "file" && current.spare === v) current.spare = null;
  // a warming voice is returned as is: the caller adopts it or frees it
  return v;
}

/* ------------------------------------------------------------------ */
/* Invariant (dev)                                                      */
/* ------------------------------------------------------------------ */

/**
 * At most ONE voice audible-or-fading-in (the current one) plus at most one
 * crossfading out (+ one being hard-cut for CUT seconds); every other voice
 * is paused with gain 0; no synth scheduler runs unless it is current or
 * outgoing. Dev builds warn on a violation.
 */
function checkInvariant(where: string): void {
  if (!import.meta.env.DEV || !pool) return;
  const problems: string[] = [];
  const vs = pool.voices;
  const curVoice = current?.kind === "file" ? current.voice : null;
  const outVoice = slotVoice(outgoing);
  for (const v of vs) {
    const g = v.gain.gain.value;
    const playing = !v.el.paused;
    switch (v.state) {
      case "active":
        if (v !== curVoice) problems.push(`voice ${v.index} active but not current`);
        break;
      case "starting":
        if (pending?.voice !== v) problems.push(`voice ${v.index} starting but not pending`);
        if (g > 0.001) problems.push(`voice ${v.index} starting with gain ${g.toFixed(3)}`);
        break;
      case "fadingOut":
        break;
      case "idle":
      case "warming":
      case "seam":
        if (playing) problems.push(`voice ${v.index} ${v.state} but playing`);
        if (g > 0.001) problems.push(`voice ${v.index} ${v.state} with gain ${g.toFixed(3)}`);
        break;
    }
    if (v.state === "seam" && !(current?.kind === "file" && current.spare === v))
      problems.push(`voice ${v.index} seam but not the current spare`);
    if (v.state === "warming" && v.warm == null) problems.push(`voice ${v.index} warming without a track`);
  }
  if (curVoice && curVoice.state !== "active") problems.push(`current voice ${curVoice.index} is ${curVoice.state}`);
  // one real fade-out at a time; others may only be inside their CUT
  const now = pool.ctx.currentTime;
  const longFades = vs.filter(
    (v) => v.state === "fadingOut" && v.fadeEnd !== undefined && v.fadeEnd - now > CUT + 0.03,
  );
  if (longFades.length > 1) problems.push(`${longFades.length} voices on a long fade-out`);
  if (outVoice && outVoice.state !== "fadingOut" && outVoice.state !== "idle")
    problems.push(`outgoing voice ${outVoice.index} is ${outVoice.state}`);
  const audibleIn = vs.filter((v) => v.state === "active" || v.state === "starting");
  if (audibleIn.length > 2 || vs.filter((v) => v.state === "active").length > 1)
    problems.push(`more than one active voice`);
  const curSynth = current?.kind === "synth" ? current.synth : null;
  const outSynth = outgoing?.kind === "synth" ? outgoing.synth : null;
  const liveSynths = [...synths].filter((s) => s.running);
  // synths still fading count as cut tails; more than current + outgoing + one cut is a leak
  if (liveSynths.length > 3) problems.push(`${liveSynths.length} synth schedulers alive`);
  const stray = liveSynths.filter((s) => s !== curSynth && s !== outSynth && !s.stopping);
  if (stray.length) problems.push(`${stray.length} synth scheduler(s) neither current nor fading`);
  if (curSynth && !curSynth.running) problems.push(`current synth not running`);
  if (!musicState.playing && !pending && current) problems.push(`current set while paused`);
  if (problems.length) {
    stats.invariantViolations++;
    console.warn(`[music] invariant violated (${where}): ${problems.join("; ")}`);
  }
}

/* ------------------------------------------------------------------ */
/* Engine glue                                                          */
/* ------------------------------------------------------------------ */

function updateBed(): void {
  const t = current?.track;
  const audible = musicState.playing && musicPort.enabled() && !!t;
  musicPort.setAmbienceBed(audible ? t!.ambience : 1, 1.5);
}

function startTicker(): void {
  if (ticker) return;
  lastTickAt = performance.now();
  ticker = setInterval(() => {
    const c = musicPort.context();
    if (!c) return;
    const wall = performance.now();
    const gap = (wall - lastTickAt) / 1000;
    lastTickAt = wall;
    // grow at once on a late tick, relax slowly back to LOOKAHEAD
    lookahead = Math.min(
      MAX_LOOKAHEAD,
      Math.max(LOOKAHEAD, gap * 1.5, lookahead * 0.98),
    );
    const now = c.currentTime;
    for (const s of synths) s.tick(now);
    if (current?.kind === "file") seamTick(c, current);
    // a busy main thread can make the release timers late: free finished fades here too
    if (pool)
      for (const v of pool.voices)
        if (v.state === "fadingOut" && v.fadeEnd !== undefined && now > v.fadeEnd + 0.03)
          releaseVoice(v);
    if (wall - lastPositionAt >= 200 && current && musicState.playing) {
      lastPositionAt = wall;
      musicState.position = slotPosition(current);
    }
    if (import.meta.env.DEV && wall - lastCheckAt >= 250) {
      lastCheckAt = wall;
      checkInvariant("tick");
    }
  }, TICK_MS);
}

function stopTickerIfIdle(): void {
  if (ticker && !current && !outgoing && !pending && synths.size === 0) {
    clearInterval(ticker);
    ticker = null;
  }
}

/**
 * Loop seam ("ping-pong"): under SEAM_PRELOAD s left, buffer the track from
 * 0 on a free element; under SEAM s left, crossfade into it. Off while a
 * switch or crossfade is in progress, or when no element is free: then the
 * element loops itself (loop=true; may leave a tiny gap, never stops).
 */
function seamTick(c: AudioContext, s: Extract<Slot, { kind: "file" }>): void {
  if (suspended || !s.track.loop || !musicState.playing) return;
  const el = s.voice.el;
  const d = slotDuration(s);
  if (!(d > SEAM_PRELOAD) || el.paused || el.seeking) return;
  const left = d - el.currentTime;
  // the self-loop fallback wrapped: back to seam mode for the next lap
  if (el.loop && left > SEAM_PRELOAD + 1) el.loop = false;
  const busy = !!pending || !!outgoing || !!coalesceTimer;
  if (busy) {
    if (s.spare) dropSpare(s);
    if (left < SEAM_PRELOAD && !el.loop) {
      el.loop = true;
      stats.loopFallbacks++;
    }
    return;
  }
  if (left < SEAM_PRELOAD && !s.spare && !el.loop) {
    const v = voicePool(c).find((x) => x.state === "idle");
    if (!v) {
      el.loop = true;
      stats.loopFallbacks++;
      return;
    }
    v.state = "seam";
    v.trackId = s.track.id;
    s.spare = v;
    listen(v, "error", () => {
      if (current === s && s.spare === v) s.spare = null;
      releaseVoice(v);
    });
    v.el.preload = "auto";
    v.el.loop = false;
    v.el.src = s.url;
    v.el.currentTime = 0;
    return;
  }
  if (s.spare && left <= SEAM) {
    if (s.spare.el.readyState >= 2) swapSeam(c, s);
    else if (!el.loop) {
      // spare starved: let the element wrap on its own
      el.loop = true;
      stats.loopFallbacks++;
      dropSpare(s);
    }
  }
}

function swapSeam(c: AudioContext, s: Extract<Slot, { kind: "file" }>): void {
  const next = s.spare!;
  const old = s.voice;
  s.spare = null;
  stats.seams++;
  for (const fn of next.off) fn();
  next.off = [];
  next.state = "active";
  s.voice = next;
  s.lease = next.lease;
  attach(s, next);
  void next.el.play().catch(() => undefined);
  rampGain(c, next.gain.gain, s.track.gain, SEAM);
  // the old lap is the outgoing slot for SEAM seconds
  const tail: Slot = { kind: "file", track: s.track, voice: old, lease: old.lease, url: s.url, spare: null };
  if (outgoing) fadeSlot(c, outgoing, CUT);
  fadeOutVoice(c, old, SEAM, false);
  outgoing = tail;
  setTimeout(() => {
    if (outgoing === tail) outgoing = null;
  }, SEAM * 1000 + 60);
  musicState.position = 0;
  updateMediaSession();
  checkInvariant("seam");
}

/** Playback listeners of the current file voice (this lease only). */
function attach(s: Extract<Slot, { kind: "file" }>, v: Voice): void {
  const mine = () => current === s && s.voice === v;
  const track = s.track;
  listen(v, "playing", () => {
    if (!mine()) return;
    if (!pending) musicState.loading = false;
    musicState.position = slotPosition(s);
    updateMediaSession();
  });
  for (const type of ["waiting", "stalled"]) {
    listen(v, type, () => {
      // `stalled` also fires when the browser merely stops fetching: only
      // count it when playback really lacks data.
      if (mine() && !v.el.paused && v.el.readyState < 3) musicState.loading = true;
    });
  }
  listen(v, "timeupdate", () => {
    if (mine()) musicState.position = slotPosition(s);
  });
  listen(v, "progress", () => {
    if (mine() && !pending) musicState.buffered = bufferedFraction(v.el, track.duration);
  });
  listen(v, "seeked", () => {
    if (!mine()) return;
    if (!pending) musicState.buffered = bufferedFraction(v.el, track.duration);
    musicState.position = slotPosition(s);
    updateMediaSession();
  });
  listen(v, "ended", () => {
    if (!mine()) return;
    if (track.loop) {
      // the seam missed (late tick / starved spare): wrap by hand
      v.el.currentTime = 0;
      void v.el.play().catch(() => undefined);
    } else {
      void next();
    }
  });
  listen(v, "error", () => {
    if (!mine()) return;
    // a media error mid-stream: this file is bad, play the tune instead
    failed.add(track.id);
    if (import.meta.env.DEV) console.info(`[music:info] ${track.id}: media error mid-stream`, v.el.error?.code);
    if (current === s) void request(track.id, { force: true });
  });
}

function emitChange(t: MusicTrack): void {
  for (const cb of listeners) {
    try {
      cb(t);
    } catch {
      /* listener errors never break playback */
    }
  }
}

/* ------------------------------------------------------------------ */
/* Media Session                                                        */
/* ------------------------------------------------------------------ */

function media(): MediaSession | null {
  return typeof navigator !== "undefined" && "mediaSession" in navigator
    ? navigator.mediaSession
    : null;
}

function hookMediaSession(): void {
  const ms = media();
  if (!ms || mediaHooked) return;
  mediaHooked = true;
  // the same coalesced request path as the panel
  const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
    ["play", () => void resume()],
    ["pause", () => pause()],
    ["nexttrack", () => void next()],
    ["previoustrack", () => void prev()],
    [
      "seekto",
      (d) => {
        if (typeof d.seekTime === "number") seek(d.seekTime);
      },
    ],
  ];
  for (const [action, fn] of handlers) {
    try {
      ms.setActionHandler(action, fn);
    } catch {
      /* action not supported by this browser */
    }
  }
}

/** Metadata for the current track (call when the track changes). */
function updateMediaMetadata(): void {
  const ms = media();
  const t = findTrack(musicState.currentId);
  if (!ms || !t || typeof MediaMetadata === "undefined") return;
  ms.metadata = new MediaMetadata({
    title: t.title,
    artist: "The Innkeeper's Music Box",
    album: t.verse,
    artwork: [
      {
        src: new URL(`${import.meta.env.BASE_URL}og.jpg`, location.href).href,
        sizes: "1200x630",
        type: "image/jpeg",
      },
    ],
  });
}

function updateMediaSession(): void {
  const ms = media();
  if (!ms) return;
  const t = findTrack(musicState.currentId);
  ms.playbackState = musicState.playing ? "playing" : t ? "paused" : "none";
  if (t && musicState.duration > 0) {
    try {
      ms.setPositionState({
        duration: musicState.duration,
        playbackRate: 1,
        position: Math.min(
          musicState.duration,
          Math.max(0, musicState.position),
        ),
      });
    } catch {
      /* setPositionState unsupported or out of range */
    }
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                           */
/* ------------------------------------------------------------------ */

/** Fetch the track manifest once (after Enter). Placeholders if it has no tracks. */
function loadMusic(): Promise<MusicTrack[]> {
  if (!musicPort.context()) return Promise.resolve(musicState.tracks);
  hookMediaSession();
  if (!manifestPromise) {
    manifestPromise = (async () => {
      let real: MusicTrack[] = [];
      try {
        // /audio/ is served with a 30-day max-age; revalidate so a new deploy's tracks show up.
        const res = await fetch(manifestUrl, { cache: "no-cache" });
        const type = res.headers.get("content-type") ?? "";
        if (res.ok && !type.includes("text/html")) {
          const data = (await res.json()) as { tracks?: ManifestTrack[] };
          if (Array.isArray(data.tracks)) {
            real = data.tracks
              .map(parseTrack)
              .filter((t): t is MusicTrack => t !== null);
          }
        }
      } catch {
        /* no manifest: placeholders only */
      }
      // real tracks first; a real track with a placeholder's id replaces it
      const taken = new Set(real.map((t) => t.id));
      musicState.tracks = [
        ...real,
        ...MOOD_KEYS.filter((k) => !taken.has(k)).map(placeholderTrack),
      ];
      return musicState.tracks;
    })();
  }
  return manifestPromise;
}

function saveData(): boolean {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  return nav.connection?.saveData === true;
}

/**
 * Start downloading a track on an idle pooled element (preload="auto") so
 * pressing play starts from buffered data: the track given, else the current
 * one, else the first. Does nothing on Save-Data connections, for synth
 * tracks, while that track already plays or starts, or when no element is idle.
 */
async function warm(id?: string): Promise<void> {
  const c = musicPort.context();
  if (!c || saveData()) return;
  const tracks = await loadMusic();
  const track = findTrack(id ?? musicState.currentId) ?? tracks[0];
  if (!track || track.kind !== "file" || !track.files || failed.has(track.id)) return;
  if (current?.track.id === track.id && musicState.playing) return;
  if (pending || coalesceTimer) return;
  const vs = voicePool(c);
  if (vs.some((v) => v.state === "warming" && v.warm?.id === track.id)) return;
  // one warm element at most: re-point it, else take an idle one
  const v = vs.find((x) => x.state === "warming") ?? vs.find((x) => x.state === "idle");
  if (!v) return;
  if (v.state === "warming") releaseVoice(v);
  const url = streamUrl(track, musicPort.formats()[0]!);
  v.state = "warming";
  v.trackId = track.id;
  v.warm = { id: track.id, url };
  listen(v, "error", () => {
    // missing file or unsupported container: drop it, playTrack will try both
    releaseVoice(v);
  });
  v.el.preload = "auto";
  v.el.loop = false;
  v.el.src = url;
  // the likely join point, so the first range request already lands near it
  if (track.duration > 0) {
    const t = positions.has(track.id)
      ? positions.get(track.id)! % track.duration
      : (Date.now() / 1000) % track.duration;
    v.el.currentTime = t;
  }
  checkInvariant("warm");
}

/**
 * Every switch goes through here (tabs, crank, shuffle, next/prev, media
 * keys, resume). A new generation at once; requests closer together than
 * COALESCE_MS wait for the burst to end so only the last one loads.
 */
function request(id: string, opts: { force?: boolean } = {}): Promise<void> {
  stats.requests++;
  const now = performance.now();
  const burst = now - lastRequestAt < COALESCE_MS;
  lastRequestAt = now;
  const myGen = ++gen;
  targetId = id;
  wantPlaying = true;
  musicState.blocked = false;
  if (!burst && !coalesceTimer) return begin(id, myGen, opts.force === true);
  stats.coalesced++;
  if (coalesceTimer) clearTimeout(coalesceTimer);
  return new Promise<void>((resolve) => {
    coalesceWaiters.push(resolve);
    coalesceTimer = setTimeout(() => {
      coalesceTimer = null;
      const waiters = coalesceWaiters;
      coalesceWaiters = [];
      void begin(targetId ?? id, gen, opts.force === true).finally(() => {
        for (const w of waiters) w();
      });
    }, COALESCE_MS);
  });
}

function flushCoalesced(): void {
  if (coalesceTimer) clearTimeout(coalesceTimer);
  coalesceTimer = null;
  const waiters = coalesceWaiters;
  coalesceWaiters = [];
  for (const w of waiters) w();
}

/** Cancel a start in progress (its voice goes back to the pool). */
function cancelPending(): void {
  if (!pending) return;
  stats.superseded++;
  if (pending.voice) releaseVoice(pending.voice);
  pending = null;
  musicState.pendingId = null;
  musicState.loading = false;
}

async function begin(id: string, myGen: number, force: boolean): Promise<void> {
  const c = musicPort.context();
  if (!c || myGen !== gen) return;
  if (!musicState.tracks.length) await loadMusic();
  if (myGen !== gen) return;
  const track = findTrack(id);
  if (!track) return;
  // pressing play in the music box means "music on"
  useAudio().setMusicOn(true);
  const settings = useSettings();
  if (!settings.musicOn) settings.musicOn = true;

  // already there: back to the current track cancels a start in flight
  if (!force && current?.track.id === id && musicState.playing) {
    cancelPending();
    checkInvariant("noop");
    return;
  }
  if (!force && pending?.track.id === id) {
    // already starting this one: it carries on under the new generation
    pending.gen = myGen;
    return;
  }
  cancelPending();
  musicState.pendingId = id;

  // join in progress: the bard is already playing
  const wanted = (duration: number): number =>
    positions.has(track.id)
      ? positions.get(track.id)! % duration
      : (Date.now() / 1000) % duration;

  let voice: Voice | null = null;
  let url = "";
  let duration = 0;
  let offset = 0;
  let lastStartError: unknown = null;
  const mine: NonNullable<typeof pending> = { gen: myGen, track, voice: null };
  pending = mine;
  // superseded (a newer request or pause): give the element back if still ours
  const stale = (): boolean => {
    if (pending === mine && mine.gen === gen) return false;
    if (pending === mine) cancelPending();
    return true;
  };
  if (track.kind === "file" && track.files && !failed.has(track.id)) {
    musicState.loading = true;
    musicState.buffered = 0;
    voice = await acquireVoice(c, () => pending !== mine || mine.gen !== gen);
    if (stale()) {
      if (voice && voice.state !== "idle" && !owned(voice)) releaseVoice(voice);
      return;
    }
    if (voice && voice.state === "warming" && voice.warm?.id !== track.id) releaseVoice(voice);
    let refused = false;
    if (voice) {
      const warmed = voice.state === "warming" && voice.warm?.id === track.id ? voice.warm : undefined;
      if (voice.state !== "idle" && !warmed) releaseVoice(voice);
      for (const fn of voice.off) fn();
      voice.off = [];
      voice.state = "starting";
      voice.trackId = track.id;
      mine.voice = voice;
      stats.loads++;
      checkInvariant("starting");
      for (const fmt of musicPort.formats()) {
        try {
          url = streamUrl(track, fmt);
          const adopt = !!warmed && warmed.url === url;
          const r = await startVoice(voice, url, track, wanted, adopt);
          offset = r.offset;
          duration = r.duration;
          break;
        } catch (err) {
          lastStartError = err;
          if (stale()) return; // superseded: whoever superseded us freed the voice
          if (err instanceof DOMException && err.name === "NotAllowedError") {
            refused = true;
            break;
          }
          // missing file / unsupported container: try the other one
          releaseVoice(voice);
          voice.state = "starting";
          voice.trackId = track.id;
          url = "";
        }
      }
    }
    if (stale()) return;
    if (refused) {
      cancelPending();
      wantPlaying = false;
      musicState.blocked = true;
      checkInvariant("refused");
      return; // stay as we were; the panel offers "tap to play"
    }
    if (!url || !voice) {
      if (voice) releaseVoice(voice);
      voice = null;
      failed.add(track.id);
      if (import.meta.env.DEV) console.info(`[music:info] ${track.id}: no playable file, using the tune`, lastStartError);
    }
  }
  if (c.state === "closed") {
    if (voice) releaseVoice(voice);
    pending = null;
    return;
  }
  pending = null;
  musicState.pendingId = null;
  musicState.loading = false;

  if (!voice) {
    duration = compose(track.mood).loopSeconds;
    offset = wanted(duration);
  }

  const crossfade = !!current && musicState.playing;
  const fadeIn = crossfade ? XFADE : 0.6;
  if (current) retire(c, current, crossfade ? XFADE : CUT);

  let slot: Slot;
  if (voice) {
    voice.state = "active";
    for (const fn of voice.off) fn();
    voice.off = [];
    slot = { kind: "file", track, voice, lease: voice.lease, url, spare: null };
    attach(slot, voice);
    rampGain(c, voice.gain.gain, track.gain, fadeIn);
  } else {
    const synth = synthPlayer(c, track, offset, c.currentTime + 0.03);
    const input = musicPort.input();
    if (input) synth.out.connect(input);
    rampGain(c, synth.out.gain, 1, fadeIn);
    slot = { kind: "synth", track, synth };
  }
  current = slot;
  // starting anything silences every other tune
  stopOtherSynths(slot.kind === "synth" ? slot.synth : null, CUT);
  positions.set(track.id, offset);

  const changed = musicState.currentId !== track.id;
  musicState.currentId = track.id;
  musicState.playing = true;
  musicState.duration = duration;
  musicState.position = offset;
  if (voice) musicState.buffered = bufferedFraction(voice.el, track.duration);
  startTicker();
  updateBed();
  if (changed) updateMediaMetadata();
  updateMediaSession();
  if (changed) emitChange(track);
  checkInvariant("activate");
}

function playTrack(id: string): Promise<void> {
  return request(id);
}

function pause(): void {
  gen++;
  flushCoalesced();
  wantPlaying = false;
  cancelPending();
  const c = musicPort.context();
  if (current && c) {
    musicState.position = slotPosition(current);
    retire(c, current, 0.35);
    current = null;
  }
  if (c) stopOtherSynths(null, 0.35);
  musicState.playing = false;
  musicState.loading = false;
  updateBed();
  updateMediaSession();
  checkInvariant("pause");
}

/** Jump within the current file track (the synth tunes can't seek). */
function seek(seconds: number): void {
  if (current?.kind !== "file" || !Number.isFinite(seconds)) return;
  const s = current;
  dropSpare(s);
  const d = slotDuration(s);
  s.voice.el.loop = false;
  s.voice.el.currentTime = Math.min(Math.max(0, seconds), Math.max(0, d - 0.1));
  musicState.position = slotPosition(s);
  updateMediaSession();
}

async function resume(): Promise<void> {
  if ((musicState.playing && !pending) || wantPlaying) return;
  if (!musicState.tracks.length) await loadMusic();
  const id = targetId ?? musicState.currentId ?? musicState.tracks[0]?.id;
  if (id) await request(id);
}

/** next/prev count from the track last asked for, so repeated presses advance while loading. */
function step(delta: number): Promise<void> {
  const list = musicState.tracks;
  if (!list.length) return Promise.resolve();
  const from = (wantPlaying ? targetId : null) ?? musicState.currentId;
  const i = list.findIndex((t) => t.id === from);
  const nextIndex = i < 0 ? 0 : (i + delta + list.length) % list.length;
  return request(list[nextIndex]!.id);
}

const next = (): Promise<void> => step(1);
const prev = (): Promise<void> => step(-1);

function shuffle(): string | null {
  const from = (wantPlaying ? targetId : null) ?? musicState.currentId;
  const list = musicState.tracks.filter((t) => t.id !== from);
  if (!list.length) return null;
  const pick = list[Math.floor(Math.random() * list.length)]!;
  void request(pick.id);
  return pick.id;
}

/** Settings toggle: bus mute + pause / resume. Never starts before loadMusic(). */
function setMusicOn(on: boolean): void {
  // the bus fades either way (engine), the player follows
  useAudio().setMusicOn(on);
  if (!on) {
    if (musicState.playing || wantPlaying) pause();
  } else if (manifestPromise && !wantPlaying) {
    void resume();
  }
  updateBed();
}

function onTrackChange(cb: (t: MusicTrack) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getMusicAnalyser(): AnalyserNode | null {
  return musicPort.analyser();
}

musicPort.onDispose(() => {
  gen++;
  flushCoalesced();
  wantPlaying = false;
  current = null;
  outgoing = null;
  pending = null;
  for (const s of synths) s.running = false;
  synths.clear();
  dropPool();
  if (ticker) clearInterval(ticker);
  ticker = null;
  manifestPromise = null;
  musicState.playing = false;
  musicState.loading = false;
  musicState.blocked = false;
  musicState.buffered = 0;
  musicState.pendingId = null;
});

/* A hidden tab suspends the AudioContext (engine); pause the elements too so
 * their clocks and downloads don't run on silently, and carry on when shown.
 * Only the current voice resumes: fading ones are released by their timers. */
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (!pool) return;
    if (document.hidden) {
      suspended = true;
      for (const v of pool.voices) if (v.state === "active" || v.state === "fadingOut") v.el.pause();
    } else {
      suspended = false;
      if (current?.kind === "file" && musicState.playing)
        void current.voice.el.play().catch(() => undefined);
    }
  });
}

export interface MusicPlayer {
  musicState: MusicState;
  loadMusic: () => Promise<MusicTrack[]>;
  warm: (id?: string) => Promise<void>;
  playTrack: (id: string) => Promise<void>;
  pause: () => void;
  resume: () => Promise<void>;
  seek: (seconds: number) => void;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  shuffle: () => string | null;
  setMusicOn: (on: boolean) => void;
  getMusicAnalyser: () => AnalyserNode | null;
  onTrackChange: (cb: (t: MusicTrack) => void) => () => void;
}

const player: MusicPlayer = {
  musicState,
  loadMusic,
  warm,
  playTrack,
  pause,
  resume,
  seek,
  next,
  prev,
  shuffle,
  setMusicOn,
  getMusicAnalyser,
  onTrackChange,
};

/* ------------------------------------------------------------------ */
/* Dev hook                                                             */
/* ------------------------------------------------------------------ */

function rmsOf(a: AnalyserNode | null): number {
  if (!a) return 0;
  const data = new Float32Array(a.fftSize);
  a.getFloatTimeDomainData(data);
  let sum = 0;
  for (const v of data) sum += v * v;
  return Math.sqrt(sum / data.length);
}

if (import.meta.env.DEV && typeof window !== "undefined") {
  const w = window as unknown as { __audio?: Record<string, unknown> };
  if (w.__audio) {
    w.__audio.music = {
      api: player,
      state: () => ({
        ...(JSON.parse(JSON.stringify(musicState)) as MusicState),
        wantPlaying,
        targetId,
        generation: gen,
        coalescing: coalesceTimer !== null,
        ctxTime: pool ? Number(pool.ctx.currentTime.toFixed(3)) : 0,
        current: current ? `${current.kind}:${current.track.id}` : null,
        outgoing: outgoing ? `${outgoing.kind}:${outgoing.track.id}` : null,
        voices: pool
          ? pool.voices.map((v) => ({
              i: v.index,
              state: v.state,
              track: v.trackId,
              paused: v.el.paused,
              loop: v.el.loop,
              t: Number(v.el.currentTime.toFixed(2)),
              ready: v.el.readyState,
              src: v.el.getAttribute("src"),
              gain: Number(v.gain.gain.value.toFixed(3)),
              eff: Number(v.gain.gain.value.toFixed(3)),
              timers: v.timers.length,
              fadeEnd: v.fadeEnd === undefined ? null : Number(v.fadeEnd.toFixed(3)),
              lease: v.lease,
            }))
          : [],
        players: [...synths].map((s) => ({
          kind: "synth",
          id: s.track.id,
          running: s.running,
          gain: Number(s.out.gain.value.toFixed(3)),
        })),
        failed: [...failed],
        positions: Object.fromEntries(positions),
        ticker: ticker !== null,
        lookahead: Number(lookahead.toFixed(3)),
        stats: { ...stats },
        mediaSession: media()
          ? {
              title: media()!.metadata?.title ?? null,
              artist: media()!.metadata?.artist ?? null,
              playbackState: media()!.playbackState,
            }
          : null,
      }),
      /** Effective gain of every voice and synth right now (stress-test trace). */
      gains: () => [
        ...(pool ? pool.voices.map((v) => ({ key: `v${v.index}`, v: v.el.paused ? 0 : v.gain.gain.value })) : []),
        ...[...synths].map((s) => ({ key: `s${s.serial}`, v: s.out.gain.value })),
      ],
      check: () => checkInvariant("manual"),
      rms: () => rmsOf(musicPort.analyser()),
    };
  }
}

/** Module-level singleton, like useAudio(). */
export function useMusic(): MusicPlayer {
  return player;
}
