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
 * Real tracks STREAM: nothing is fetched or decoded up front. Two pooled
 * HTMLAudioElements (A/B) are each wired once with createMediaElementSource
 * (the call throws on reuse, so the nodes live as long as the context). A
 * track starts as soon as the browser has enough data (a Range request, 206,
 * for the first bytes, and another when seeking to the join-in-progress
 * point); the rest downloads while it plays. Crossfades and the loop seam
 * use the second element.
 *
 * Graph (per playing track; two exist during a crossfade):
 *   file:  <audio> -> MediaElementSource -> voice gain(track.gain) -> out -> music bus
 *   synth: tine voices -> voiceBus -> lowpass -> dry ----------> out -> music bus
 *                                           \-> Convolver -> wet /
 *   music bus -> musicDuck (spells) -> master; analyser tapped on the bus.
 *
 * Looping: a file element has loop=false; when a looping track has under
 * 0.5 s left, the other element (pre-buffered from 0) fades in over that
 * overlap while the first fades out ("ping-pong"), because a single element's
 * own `loop` can leave a small gap. If no second element is free it falls
 * back to loop=true.
 *
 * API (const music = useMusic()):
 *   musicState                 reactive { tracks, currentId, playing,
 *                              position (s), duration (s), loading, blocked }
 *                              blocked = the browser refused play(); stay
 *                              paused and show "tap to play"
 *   loadMusic(): Promise<MusicTrack[]>   fetch the manifest (no audio is
 *                              fetched until a track is chosen); needs the
 *                              Enter gesture
 *   playTrack(id): Promise<void>  ~1.2 s equal-power crossfade from the current
 *                              track; first start of a track this session joins
 *                              in progress at Date.now()/1000 % duration, later
 *                              starts resume where it was left. Turns musicOn on.
 *   pause() / resume()         resume() with nothing chosen plays the first track
 *   seek(seconds)              file tracks only
 *   next() / prev()            wrap around the list
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
 * Dev builds add window.__audio.music = { api, state(), rms() }.
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
  playing: boolean;
  position: number;
  duration: number;
  loading: boolean;
  /** play() was refused by the browser (autoplay policy): offer "tap to play". */
  blocked: boolean;
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
/* Players                                                              */
/* ------------------------------------------------------------------ */

interface Player {
  track: MusicTrack;
  out: GainNode;
  /** Nominal position (s) right now. */
  position: () => number;
  /** Scheduler tick (synth only). */
  tick: (now: number) => void;
  /** Stop all sources at `when` (ctx time) and disconnect afterwards. */
  stopAt: (when: number) => void;
  /** File track ended (non-looping). */
  onEnded?: () => void;
  /** File only: position/duration changed in a way the UI should pick up now. */
  onSync?: () => void;
  /** File only: stop and free its elements at once. */
  kill?: () => void;
  /** File only: free the loop-overlap elements (a new track needs one). */
  dropSpare?: () => void;
  seek?: (seconds: number) => void;
  /** File only: hidden tab, pause the elements / carry on. */
  suspend?: () => void;
  unsuspend?: () => void;
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
const XFADE = 1.2;

function synthPlayer(
  c: AudioContext,
  track: MusicTrack,
  offset: number,
  when: number,
): Player {
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
  let stopped = false;

  const tick = (now: number) => {
    if (stopped) return;
    while (nextTime < now + lookahead) {
      const idx = step % total;
      for (const n of score.steps[idx]!)
        tine(c, voiceBus, nextTime, n.midi, n.bass ? n.vel * 0.8 : n.vel);
      marks.push([nextTime, idx]);
      if (marks.length > 64) marks.shift();
      nextTime += score.stepSeconds * stepFactor(step, total);
      step++;
    }
  };
  tick(c.currentTime);

  return {
    track,
    out,
    tick,
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
    stopAt(at) {
      stopped = true;
      const ms = Math.max(0, (at - c.currentTime) * 1000) + 3200; // let tails ring out
      setTimeout(() => {
        voiceBus.disconnect();
        tone.disconnect();
        conv.disconnect();
        wet.disconnect();
        out.disconnect();
      }, ms);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Streaming voices (pooled <audio> elements)                           */
/* ------------------------------------------------------------------ */

/** Overlap of the ping-pong loop seam, in seconds. */
const SEAM = 0.5;
/** Start buffering the second element this long before the loop point. */
const SEAM_PRELOAD = 8;

interface Voice {
  el: HTMLAudioElement;
  /** createMediaElementSource may only run once per element: cached here. */
  node: MediaElementAudioSourceNode;
  gain: GainNode;
  /** Who holds the voice right now (null = idle). */
  owner: object | null;
  off: (() => void)[];
}

let pool: { ctx: AudioContext; voices: Voice[] } | null = null;

function voicePool(c: AudioContext): Voice[] {
  if (pool && pool.ctx === c) return pool.voices;
  dropPool();
  const make = (): Voice => {
    const el = new Audio();
    el.preload = "none";
    el.loop = false;
    const node = c.createMediaElementSource(el);
    const gain = c.createGain();
    gain.gain.value = 0;
    node.connect(gain);
    return { el, node, gain, owner: null, off: [] };
  };
  pool = { ctx: c, voices: [make(), make()] };
  return pool.voices;
}

/** The context is gone: its elements can never be wired again, so drop them. */
function dropPool(): void {
  if (!pool) return;
  for (const v of pool.voices) resetVoice(v);
  pool = null;
}

function listen(v: Voice, type: string, fn: (e: Event) => void): void {
  v.el.addEventListener(type, fn);
  v.off.push(() => v.el.removeEventListener(type, fn));
}

/** Drop listeners and free the connection (MDN: removeAttribute('src') + load()). */
function resetVoice(v: Voice): void {
  for (const fn of v.off) fn();
  v.off = [];
  const el = v.el;
  el.pause();
  el.loop = false;
  el.removeAttribute("src");
  el.preload = "none";
  el.load();
  v.gain.disconnect();
  v.gain.gain.cancelScheduledValues(0);
  v.gain.gain.value = 0;
}

function freeVoice(v: Voice): void {
  resetVoice(v);
  v.owner = null;
}

/** An idle voice, or null. `steal` may cut a fading tail or loop overlap to get one. */
function leaseVoice(c: AudioContext, owner: object, steal: boolean): Voice | null {
  const vs = voicePool(c);
  const idle = () => vs.find((v) => !v.owner);
  let v = idle();
  if (!v && steal) {
    for (const p of [...fading]) p.kill?.();
    v = idle();
  }
  if (!v && steal) {
    current?.dropSpare?.();
    v = idle();
  }
  if (!v) return null;
  v.owner = owner;
  return v;
}

function streamUrl(track: MusicTrack, fmt: string): string {
  return `${musicPort.base}${track.files}.${fmt}`;
}

/**
 * Point `v` at `url` and start it; resolves on the `playing` event with the
 * offset it started from. The currentTime set before metadata is the
 * "default playback start position", so the first request already lands near
 * the join point and play() is called inside the caller's gesture chain.
 * Rejects on a media error or a refused play() (NotAllowedError).
 */
function startVoice(
  v: Voice,
  url: string,
  track: MusicTrack,
  wanted: (duration: number) => number,
): Promise<{ offset: number; duration: number }> {
  const el = v.el;
  return new Promise((resolve, reject) => {
    let offset = 0;
    const known = () =>
      Number.isFinite(el.duration) && el.duration > 0 ? el.duration : track.duration;
    const play = () => {
      el.play().catch((err: unknown) => reject(err));
    };
    listen(v, "error", () => reject(new Error(`media error ${el.error?.code ?? "?"}`)));
    listen(v, "playing", () => resolve({ offset, duration: known() }));
    listen(v, "loadedmetadata", () => {
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
    });
    el.preload = "auto";
    el.loop = false;
    el.src = url;
    if (track.duration > 0) {
      offset = wanted(track.duration);
      el.currentTime = offset;
      play();
    }
  });
}

function filePlayer(
  c: AudioContext,
  track: MusicTrack,
  first: Voice,
  url: string,
  hooks: { owner: object },
): Player {
  const out = c.createGain();
  out.gain.value = 0;
  let active = first;
  /** Previous voice during a loop overlap (fading out). */
  let tail: Voice | null = null;
  /** Second voice buffering at 0, waiting for the loop point. */
  let spare: Voice | null = null;
  let stopped = false;
  let suspended = false;
  let noSeam = false;
  let retryAt = 0;
  let seamTimer: ReturnType<typeof setTimeout> | null = null;

  const duration = (): number => {
    const d = active.el.duration;
    return Number.isFinite(d) && d > 0 ? d : track.duration;
  };

  const player: Player = {
    track,
    out,
    tick() {
      if (stopped || suspended || !track.loop || tail) return;
      if (noSeam) {
        // no free element last time: try again every second
        if (performance.now() < retryAt) return;
        noSeam = false;
        active.el.loop = false;
      }
      const el = active.el;
      const d = duration();
      if (!(d > SEAM_PRELOAD) || el.paused || el.seeking) return;
      const left = d - el.currentTime;
      if (!spare && left < SEAM_PRELOAD) prepareSpare();
      if (spare && left <= SEAM && spare.el.readyState >= 2) swap();
    },
    position() {
      const d = duration();
      const t = active.el.currentTime;
      return d > 0 ? Math.min(t, d) : t;
    },
    stopAt(at) {
      stopped = true;
      const ms = Math.max(0, (at - c.currentTime) * 1000) + 100;
      setTimeout(() => player.kill?.(), ms);
    },
    kill() {
      stopped = true;
      if (seamTimer) clearTimeout(seamTimer);
      for (const v of new Set([active, tail, spare])) if (v) freeVoice(v);
      tail = spare = null;
      out.disconnect();
      fading.delete(player);
    },
    dropSpare() {
      if (seamTimer) clearTimeout(seamTimer);
      if (tail) freeVoice(tail);
      if (spare) freeVoice(spare);
      tail = spare = null;
    },
    seek(seconds) {
      const d = duration();
      player.dropSpare?.();
      active.el.currentTime = Math.min(Math.max(0, seconds), Math.max(0, d - 0.1));
    },
    suspend() {
      suspended = true;
      for (const v of [active, tail]) v?.el.pause();
    },
    unsuspend() {
      if (!suspended) return;
      suspended = false;
      for (const v of [active, tail]) void v?.el.play().catch(() => undefined);
    },
  };

  function prepareSpare(): void {
    const v = leaseVoice(c, hooks.owner, false);
    if (!v) {
      // no free element for the overlap: let the element loop itself
      noSeam = true;
      retryAt = performance.now() + 1000;
      active.el.loop = true;
      return;
    }
    spare = v;
    v.gain.gain.value = 0;
    v.gain.connect(out);
    v.el.preload = "auto";
    v.el.loop = false;
    v.el.src = url;
    v.el.currentTime = 0;
  }

  function swap(): void {
    const next = spare!;
    const old = active;
    spare = null;
    tail = old;
    active = next;
    attach(next);
    void next.el.play().catch(() => undefined);
    equalPower(c, old.gain.gain, 0, SEAM);
    equalPower(c, next.gain.gain, track.gain, SEAM);
    seamTimer = setTimeout(() => {
      if (tail === old) {
        freeVoice(old);
        tail = null;
      }
    }, SEAM * 1000 + 120);
    player.onSync?.();
  }

  function attach(v: Voice): void {
    const mine = () => active === v && !stopped;
    listen(v, "playing", () => {
      if (!mine()) return;
      if (current === player) musicState.loading = false;
      player.onSync?.();
    });
    for (const type of ["waiting", "stalled"]) {
      listen(v, type, () => {
        // `stalled` also fires when the browser merely stops fetching: only
        // count it when playback really lacks data.
        if (mine() && current === player && !v.el.paused && v.el.readyState < 3)
          musicState.loading = true;
      });
    }
    listen(v, "timeupdate", () => {
      if (mine() && current === player) musicState.position = player.position();
    });
    listen(v, "seeked", () => {
      if (mine()) player.onSync?.();
    });
    listen(v, "ended", () => {
      if (!mine()) return;
      if (track.loop) {
        // the overlap missed (late tick / starved spare): wrap by hand
        active.el.currentTime = 0;
        void active.el.play().catch(() => undefined);
      } else {
        player.onEnded?.();
      }
    });
    listen(v, "error", () => {
      if (!mine()) return;
      // a media error mid-stream: this file is bad, play the tune instead
      failed.add(track.id);
      if (current === player) {
        current = null;
        retire(player, 0.05);
        void playTrack(track.id);
      }
    });
  }

  // the starting voice: drop the startup listeners, keep one set for playback
  for (const fn of first.off) fn();
  first.off = [];
  first.gain.gain.value = track.gain;
  first.gain.connect(out);
  attach(first);
  return player;
}

/** Equal-power fade of `param` from its current value to `to` over `seconds`. */
function equalPower(
  c: AudioContext,
  param: AudioParam,
  to: number,
  seconds: number,
): void {
  const now = c.currentTime;
  const from = param.value;
  param.cancelScheduledValues(now);
  if (seconds <= 0.01) {
    param.setValueAtTime(to, now);
    return;
  }
  const n = 64;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    // cos/sin pair: fade-out uses cos from `from`, fade-in sin up to `to`
    curve[i] =
      to > from
        ? from + (to - from) * Math.sin((x * Math.PI) / 2)
        : to + (from - to) * Math.cos((x * Math.PI) / 2);
  }
  try {
    param.setValueCurveAtTime(curve, now, seconds);
  } catch {
    // an automation still overlapping the curve: plain ramp instead
    param.setValueAtTime(from, now);
    param.linearRampToValueAtTime(to, now + seconds);
  }
}

/* ------------------------------------------------------------------ */
/* State                                                                */
/* ------------------------------------------------------------------ */

export const musicState = reactive<MusicState>({
  tracks: [],
  currentId: null,
  playing: false,
  position: 0,
  duration: 0,
  loading: false,
  blocked: false,
});

const manifestUrl = `${musicPort.base}music/manifest.json`;
let manifestPromise: Promise<MusicTrack[]> | null = null;
let current: Player | null = null;
/** Fading-out players still ticking (synth tails). */
const fading = new Set<Player>();
/** Last nominal position per track id (join-in-progress happens once). */
const positions = new Map<string, number>();
/** Tracks whose file failed: they play their mood's melody instead. */
const failed = new Set<string>();
/** Bumped by every play/pause so a slow start can't take over a newer choice. */
let token = 0;
/** True from the moment playback is requested (before the stream starts). */
let wantPlaying = false;
let ticker: ReturnType<typeof setInterval> | null = null;
let lastTickAt = 0;
let lastPositionAt = 0;
const listeners = new Set<(t: MusicTrack) => void>();
let mediaHooked = false;
/** The element a still-starting playTrack holds (freed if it is superseded). */
let pending: Voice | null = null;

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
    current?.tick(now);
    for (const p of fading) p.tick(now);
    if (wall - lastPositionAt >= 200 && current && musicState.playing) {
      lastPositionAt = wall;
      musicState.position = current.position();
    }
  }, TICK_MS);
}

function stopTickerIfIdle(): void {
  if (ticker && !current && fading.size === 0) {
    clearInterval(ticker);
    ticker = null;
  }
}

/** Fade a player out over `seconds` and retire it. */
function retire(p: Player, seconds: number): void {
  const c = musicPort.context();
  if (!c) return;
  positions.set(p.track.id, p.position());
  equalPower(c, p.out.gain, 0, seconds);
  const end = c.currentTime + seconds;
  p.stopAt(end + 0.02);
  fading.add(p);
  setTimeout(
    () => {
      fading.delete(p);
      stopTickerIfIdle();
    },
    seconds * 1000 + 100,
  );
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

async function playTrack(id: string): Promise<void> {
  const c = musicPort.context();
  if (!c) return;
  if (!musicState.tracks.length) await loadMusic();
  const track = findTrack(id);
  if (!track) return;
  if (current?.track.id === id && musicState.playing) return;
  const my = ++token;
  wantPlaying = true;
  musicState.blocked = false;
  // pressing play in the music box means "music on"
  useAudio().setMusicOn(true);
  const settings = useSettings();
  if (!settings.musicOn) settings.musicOn = true;
  if (pending) {
    freeVoice(pending);
    pending = null;
  }

  // join in progress: the bard is already playing
  const wanted = (duration: number): number =>
    positions.has(track.id)
      ? positions.get(track.id)! % duration
      : (Date.now() / 1000) % duration;

  let voice: Voice | null = null;
  let url = "";
  let duration = 0;
  let offset = 0;
  const owner = {};
  if (track.kind === "file" && track.files && !failed.has(track.id)) {
    musicState.loading = true;
    voice = leaseVoice(c, owner, true);
    pending = voice;
    let refused = false;
    if (voice) {
      for (const fmt of musicPort.formats()) {
        try {
          url = streamUrl(track, fmt);
          const r = await startVoice(voice, url, track, wanted);
          offset = r.offset;
          duration = r.duration;
          break;
        } catch (err) {
          if (my !== token) break;
          if (err instanceof DOMException && err.name === "NotAllowedError") {
            refused = true;
            break;
          }
          // missing file / unsupported container: try the other one
          resetVoice(voice);
          url = "";
        }
      }
    }
    if (my !== token) {
      // superseded while the stream was starting
      if (voice && voice.owner === owner) freeVoice(voice);
      if (pending === voice) pending = null;
      return;
    }
    if (pending === voice) pending = null;
    if (refused) {
      if (voice) freeVoice(voice);
      wantPlaying = false;
      musicState.loading = false;
      musicState.blocked = true;
      return; // stay as we were; the panel offers "tap to play"
    }
    if (!url && voice) {
      freeVoice(voice);
      voice = null;
      failed.add(track.id);
    }
    if (!voice) failed.add(track.id);
    musicState.loading = false;
  }
  if (c.state === "closed") {
    if (voice) freeVoice(voice);
    return;
  }

  if (!voice) {
    duration = compose(track.mood).loopSeconds;
    offset = wanted(duration);
  }

  const crossfade = !!current && musicState.playing;
  if (current) retire(current, crossfade ? XFADE : 0.05);

  const p = voice
    ? filePlayer(c, track, voice, url, { owner })
    : synthPlayer(c, track, offset, c.currentTime + 0.03);
  const input = musicPort.input();
  if (input) p.out.connect(input);
  equalPower(c, p.out.gain, 1, crossfade ? XFADE : 0.6);
  p.onEnded = () => {
    if (current === p) void next();
  };
  p.onSync = () => {
    if (current !== p) return;
    musicState.position = p.position();
    updateMediaSession();
  };
  current = p;
  positions.set(track.id, offset);

  const changed = musicState.currentId !== track.id;
  musicState.currentId = track.id;
  musicState.playing = true;
  musicState.duration = duration;
  musicState.position = offset;
  startTicker();
  updateBed();
  if (changed) updateMediaMetadata();
  updateMediaSession();
  if (changed) emitChange(track);
}

function pause(): void {
  token++;
  wantPlaying = false;
  musicState.loading = false;
  if (pending) {
    freeVoice(pending);
    pending = null;
  }
  if (current) {
    musicState.position = current.position();
    retire(current, 0.35);
    current = null;
  }
  musicState.playing = false;
  updateBed();
  updateMediaSession();
}

/** Jump within the current file track (the synth tunes can't seek). */
function seek(seconds: number): void {
  if (!current?.seek || !Number.isFinite(seconds)) return;
  current.seek(seconds);
  musicState.position = current.position();
  updateMediaSession();
}

async function resume(): Promise<void> {
  if (musicState.playing || wantPlaying) return;
  if (!musicState.tracks.length) await loadMusic();
  const id = musicState.currentId ?? musicState.tracks[0]?.id;
  if (id) await playTrack(id);
}

function step(delta: number): Promise<void> {
  const list = musicState.tracks;
  if (!list.length) return Promise.resolve();
  const i = list.findIndex((t) => t.id === musicState.currentId);
  const nextIndex = i < 0 ? 0 : (i + delta + list.length) % list.length;
  return playTrack(list[nextIndex]!.id);
}

const next = (): Promise<void> => step(1);
const prev = (): Promise<void> => step(-1);

function shuffle(): string | null {
  const list = musicState.tracks.filter((t) => t.id !== musicState.currentId);
  if (!list.length) return null;
  const pick = list[Math.floor(Math.random() * list.length)]!;
  void playTrack(pick.id);
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
  token++;
  wantPlaying = false;
  current = null;
  pending = null;
  fading.clear();
  dropPool();
  if (ticker) clearInterval(ticker);
  ticker = null;
  manifestPromise = null;
  musicState.playing = false;
  musicState.loading = false;
  musicState.blocked = false;
});

/* A hidden tab suspends the AudioContext (engine); pause the elements too so
 * their clocks and downloads don't run on silently, and carry on when shown. */
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      current?.suspend?.();
      for (const p of fading) p.suspend?.();
    } else {
      current?.unsuspend?.();
      for (const p of fading) p.unsuspend?.();
    }
  });
}

export interface MusicPlayer {
  musicState: MusicState;
  loadMusic: () => Promise<MusicTrack[]>;
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
        fading: fading.size,
        voices: pool
          ? pool.voices.map((v) => ({
              busy: !!v.owner,
              paused: v.el.paused,
              t: Number(v.el.currentTime.toFixed(2)),
              ready: v.el.readyState,
              src: v.el.getAttribute("src"),
              gain: Number(v.gain.gain.value.toFixed(3)),
            }))
          : [],
        failed: [...failed],
        positions: Object.fromEntries(positions),
        ticker: ticker !== null,
        lookahead: Number(lookahead.toFixed(3)),
        mediaSession: media()
          ? {
              title: media()!.metadata?.title ?? null,
              artist: media()!.metadata?.artist ?? null,
              playbackState: media()!.playbackState,
            }
          : null,
      }),
      rms: () => rmsOf(musicPort.analyser()),
    };
  }
}

/** Module-level singleton, like useAudio(). */
export function useMusic(): MusicPlayer {
  return player;
}
