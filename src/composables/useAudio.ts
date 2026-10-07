/**
 * WebAudio engine for the inn: recorded CC0 samples with a synth fallback.
 *
 * Sounds live in public/audio/ and are described by public/audio/manifest.json
 * (slot -> variant files, bus, loop points, gain). Files are decoded lazily
 * into AudioBuffers: nothing is fetched until the AudioContext first runs
 * (the "Enter the Inn" gesture); then ambience + common SFX are preloaded and
 * everything else loads on first use. A slot whose files fail to load falls
 * back to a small WebAudio synth voice (where one exists) so the inn is never
 * silent because of a missing file.
 *
 * Graph:
 *   voice -> [gain] -> [StereoPanner] -> bus
 *   fire, fire-crackle -> fireGroup (ambience intensity) -> ambience bus
 *   ambience bus -> duck -> master;  sfx bus -> master;  ui bus -> master
 *   master -> DynamicsCompressor (gentle limiter) -> destination
 *
 * Slots (manifest): fire*, room-tone*, wind-window* (*loops), fire-crackle,
 *   creak | spells: fireball-whoosh, fireball-impact, zap, thunder, gust,
 *   sparkle, clatter | sfx: book-open, book-close, page-turn, sword-ring,
 *   shield-knock, cork-pop, slosh, parchment, tankard, candle-puff,
 *   match-strike, dice, nat20, fanfare | ui: hover
 *
 * API (const audio = useAudio()):
 *   unlock()                         create/resume the context (user gesture)
 *   play(slot, opts?)                one-shot -> Promise<SoundHandle | null>
 *     opts: variant, gain (linear), rate, detune (cents), delay (s),
 *           pan (-1..1) | position {x,y,z} | source (named position),
 *           duck ({amount, ms} or false; spells duck ambience by default)
 *   startLoop(slot, opts?) / stopLoop(slot, fadeMs?)
 *   startAmbience() / stopAmbience(fadeMs?)   fire + room tone + wind loops
 *                                    plus random crackles and creaks
 *   setAmbienceOn(on) / setSfxOn(on) / setBusVolume(bus, 0..1)
 *   setAmbienceIntensity(0..1)       fire loudness + crackle rate
 *   onEmberPop()                     crackle synced to an ember particle
 *   setListener(position, forward)   camera; drives pan + distance falloff
 *   setSourcePosition(name, pos)     named emitters ('fire', 'window', ...)
 *   duck(amount 0..1, ms)            lower ambience, then recover
 *   prefetch(slots[] | category)     e.g. prefetch('spells') on console open
 *   configureSlot(slot, tuning)      pitch/gain jitter, latency, voices
 *   playFlip/playThump/playChime/playClack  legacy helpers
 *
 * Dev builds expose window.__audio = { engine, state(), rms() }.
 */

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type BusName = "ambience" | "sfx" | "ui";
export type SoundCategory = "ambience" | "spells" | "sfx" | "ui";

/** Every slot in the manifest with its category (bus follows from it). */
const SLOT_CATEGORY = {
  fire: "ambience",
  "fire-crackle": "ambience",
  "room-tone": "ambience",
  "wind-window": "ambience",
  creak: "ambience",
  "fireball-whoosh": "spells",
  "fireball-impact": "spells",
  zap: "spells",
  thunder: "spells",
  gust: "spells",
  sparkle: "spells",
  clatter: "spells",
  "book-open": "sfx",
  "book-close": "sfx",
  "page-turn": "sfx",
  "sword-ring": "sfx",
  "shield-knock": "sfx",
  "cork-pop": "sfx",
  slosh: "sfx",
  parchment: "sfx",
  tankard: "sfx",
  "candle-puff": "sfx",
  "match-strike": "sfx",
  dice: "sfx",
  nat20: "sfx",
  fanfare: "sfx",
  hover: "ui",
} as const satisfies Record<string, SoundCategory>;

export type SlotName = keyof typeof SLOT_CATEGORY;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PlayOptions {
  /** Variant index; random (never the same twice in a row) when omitted. */
  variant?: number;
  /** Linear gain multiplier on top of the manifest gain. */
  gain?: number;
  /** Playback rate (1 = original pitch and speed). */
  rate?: number;
  /** Detune in cents. */
  detune?: number;
  /** Start delay in seconds. */
  delay?: number;
  /** Fixed stereo position, -1 (left) .. 1 (right). */
  pan?: number;
  /** World position; pan + distance falloff relative to the listener. */
  position?: Vec3;
  /** Named emitter set via setSourcePosition (e.g. "fire"). */
  source?: string;
  /** Duck ambience under this sound; spells do it unless false. */
  duck?: { amount: number; ms: number } | false;
}

export interface SoundHandle {
  readonly slot: SlotName;
  /** "sample" = recorded file, "synth" = WebAudio fallback voice. */
  readonly kind: "sample" | "synth";
  /** Resolves when the voice has finished (or was stopped). */
  readonly ended: Promise<void>;
  /** Fade out and stop (default 60 ms). */
  stop: (fadeMs?: number) => void;
}

export interface SlotTuning {
  /** Random playback-rate spread, e.g. 0.04 = +-4 %. */
  pitchJitter: number;
  /** Random gain spread in dB, e.g. 2 = +-2 dB. */
  gainJitterDb: number;
  /**
   * How long play() waits for a still-loading file before using the synth.
   * Slots without a synth voice wait at least NO_SYNTH_WAIT_MS instead of
   * dropping the sound.
   */
  maxLatencyMs: number;
  /** Concurrent voices; the oldest is faded out beyond this. */
  maxVoices: number;
}

export interface LoopOptions {
  fadeMs?: number;
  gain?: number;
  /** Named emitter the loop follows (pan + falloff). */
  source?: string;
}

interface ManifestSlot {
  category: SoundCategory;
  bus: BusName;
  files: string[];
  loop: boolean;
  loopStart?: number;
  loopEnd?: number;
  duration: number;
  gain: number;
}

interface Manifest {
  version: number;
  slots: Partial<Record<SlotName, ManifestSlot>>;
}

type AudioFormat = "webm" | "m4a";

/* ------------------------------------------------------------------ */
/* Tuning                                                               */
/* ------------------------------------------------------------------ */

const DEFAULT_TUNING: SlotTuning = {
  pitchJitter: 0.04,
  gainJitterDb: 2,
  maxLatencyMs: 300,
  maxVoices: 4,
};

const tuning: Partial<Record<SlotName, Partial<SlotTuning>>> = {
  "fire-crackle": { pitchJitter: 0.08, gainJitterDb: 3, maxLatencyMs: 0, maxVoices: 4 },
  creak: { pitchJitter: 0.05, maxLatencyMs: 2000, maxVoices: 1 },
  dice: { pitchJitter: 0.05, maxLatencyMs: 0, maxVoices: 6 },
  hover: { pitchJitter: 0.03, gainJitterDb: 1, maxLatencyMs: 0, maxVoices: 2 },
  "page-turn": { maxLatencyMs: 150 },
  nat20: { pitchJitter: 0, gainJitterDb: 0, maxVoices: 1 },
  fanfare: { pitchJitter: 0, gainJitterDb: 0, maxVoices: 1 },
  thunder: { pitchJitter: 0.03, maxLatencyMs: 1500, maxVoices: 2 },
};

const NO_SYNTH_WAIT_MS = 1500;

function tuningFor(slot: SlotName): SlotTuning {
  return { ...DEFAULT_TUNING, ...tuning[slot] };
}

/** Loaded right after the context first runs. */
const PRELOAD_COMMON: SlotName[] = [
  "page-turn",
  "book-open",
  "book-close",
  "dice",
  "nat20",
  "hover",
];
const AMBIENCE_LOOPS: { slot: SlotName; source?: string }[] = [
  { slot: "fire", source: "fire" },
  { slot: "room-tone" },
  { slot: "wind-window", source: "window" },
];
const AMBIENCE_SLOTS: SlotName[] = ["fire", "room-tone", "wind-window", "fire-crackle", "creak"];
/** Slots routed through the fire group (ambience intensity). */
const FIRE_SLOTS = new Set<SlotName>(["fire", "fire-crackle"]);

/** Spatial model: inverse-distance falloff, floored so nothing vanishes. */
const spatial = { refDistance: 2, rolloff: 0.6, minGain: 0.35, panWidth: 0.8 };

/* ------------------------------------------------------------------ */
/* Engine state                                                         */
/* ------------------------------------------------------------------ */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let limiter: DynamicsCompressorNode | null = null;
let analyser: AnalyserNode | null = null;
let duckNode: GainNode | null = null;
let fireGroup: GainNode | null = null;
let buses: Record<BusName, GainNode> | null = null;

const volumes: Record<BusName, number> = { ambience: 0.6, sfx: 0.8, ui: 0.5 };
const enabled: Record<BusName, boolean> = { ambience: false, sfx: true, ui: true };
let intensity = 1;

let format: AudioFormat | null = null;
let manifest: Manifest | null = null;
let manifestPromise: Promise<Manifest | null> | null = null;
let manifestFailed = false;
const fileBuffers = new Map<string, AudioBuffer>();
const fileLoads = new Map<string, Promise<AudioBuffer | null>>();
const failedFiles = new Set<string>();
const slotBuffers = new Map<SlotName, AudioBuffer[]>();
const slotLoads = new Map<SlotName, Promise<AudioBuffer[]>>();
let preloadStarted = false;

const lastVariant = new Map<SlotName, number>();
interface Voice {
  slot: SlotName;
  stop: (fadeMs?: number) => void;
}
const voices = new Map<SlotName, Voice[]>();
const stats = { samples: 0, synth: 0, dropped: 0, fallbacks: {} as Record<string, number> };

let listenerPos: Vec3 = { x: 0, y: 0, z: 0 };
let listenerFwd: Vec3 = { x: 0, y: 0, z: -1 };
const sourcePositions = new Map<string, Vec3>();

interface ActiveLoop {
  slot: SlotName;
  kind: "sample" | "synth";
  env: GainNode;
  spatialGain: GainNode;
  panner: StereoPannerNode;
  source?: string;
  target: number;
  stopAt: (when: number) => void;
}
const loops = new Map<SlotName, ActiveLoop>();
/** Bumped on start/stop so a slow load can't resurrect a stopped loop. */
const loopTokens = new Map<SlotName, number>();

let ambienceRunning = false;
let crackleTimer: ReturnType<typeof setTimeout> | null = null;
let creakTimer: ReturnType<typeof setTimeout> | null = null;
let ambienceStopTimer: ReturnType<typeof setTimeout> | null = null;
let lastEmberAt = 0;
let lastClackAt = 0;
let duckEnd = 0;
let duckDepth = 0;
let visibilityHooked = false;

const audioBase = `${import.meta.env.BASE_URL}audio/`;

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const dbToGain = (db: number) => Math.pow(10, db / 20);

/** Click-free parameter change (exponential approach, ~5 time constants). */
function glide(param: AudioParam, value: number, timeConstant = 0.04): void {
  if (!ctx) return;
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.setTargetAtTime(value, now, timeConstant);
}

/** Slider 0..1 -> gain with a perceptual (squared) curve. */
function busTarget(bus: BusName): number {
  return enabled[bus] ? volumes[bus] * volumes[bus] : 0;
}

function slotBus(slot: SlotName): BusName {
  const def = manifest?.slots[slot];
  if (def) return def.bus;
  const cat = SLOT_CATEGORY[slot];
  return cat === "spells" ? "sfx" : cat;
}

function slotDestination(slot: SlotName): AudioNode | null {
  if (!buses) return null;
  if (FIRE_SLOTS.has(slot) && fireGroup) return fireGroup;
  return buses[slotBus(slot)];
}

/** World position -> { pan, gain } for the current listener. */
function spatialize(pos: Vec3): { pan: number; gain: number } {
  const dx = pos.x - listenerPos.x;
  const dy = pos.y - listenerPos.y;
  const dz = pos.z - listenerPos.z;
  const dist = Math.hypot(dx, dy, dz);
  // right = forward x up(0,1,0), flattened to the horizontal plane
  let rx = -listenerFwd.z;
  let rz = listenerFwd.x;
  const rLen = Math.hypot(rx, rz) || 1;
  rx /= rLen;
  rz /= rLen;
  const hLen = Math.hypot(dx, dz);
  const pan = hLen > 1e-4 ? ((dx * rx + dz * rz) / hLen) * spatial.panWidth : 0;
  const over = Math.max(0, dist - spatial.refDistance) / spatial.refDistance;
  const gain = Math.max(spatial.minGain, 1 / (1 + spatial.rolloff * over));
  return { pan: clamp(pan, -1, 1), gain };
}

function resolvePlacement(opts: { pan?: number; position?: Vec3; source?: string }): {
  pan: number;
  gain: number;
} | null {
  const pos = opts.position ?? (opts.source ? sourcePositions.get(opts.source) : undefined);
  if (pos) return spatialize(pos);
  if (typeof opts.pan === "number") return { pan: clamp(opts.pan, -1, 1), gain: 1 };
  return null;
}

/* ------------------------------------------------------------------ */
/* Context + buses                                                      */
/* ------------------------------------------------------------------ */

function onVisibilityChange(): void {
  if (!ctx) return;
  if (document.hidden) {
    clearAmbienceTimers();
    void ctx.suspend();
  } else {
    void ctx.resume();
    if (ambienceRunning) scheduleAmbienceTimers();
  }
}

function ensureContext(): AudioContext | null {
  if (ctx) {
    if (ctx.state === "suspended" && !document.hidden) void ctx.resume();
    return ctx;
  }
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  const c = new Ctor({ latencyHint: "interactive" });
  ctx = c;

  limiter = c.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 6;
  limiter.ratio.value = 8;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;
  limiter.connect(c.destination);

  master = c.createGain();
  master.gain.value = 0.9;
  master.connect(limiter);

  if (import.meta.env.DEV) {
    analyser = c.createAnalyser();
    analyser.fftSize = 2048;
    limiter.connect(analyser);
  }

  duckNode = c.createGain();
  duckNode.connect(master);

  const mk = (bus: BusName, dest: AudioNode) => {
    const g = c.createGain();
    g.gain.value = busTarget(bus);
    g.connect(dest);
    return g;
  };
  buses = { ambience: mk("ambience", duckNode), sfx: mk("sfx", master), ui: mk("ui", master) };

  fireGroup = c.createGain();
  fireGroup.gain.value = fireGroupTarget();
  fireGroup.connect(buses.ambience);

  c.addEventListener("statechange", () => {
    if (c.state === "running") startPreload();
  });

  if (!visibilityHooked) {
    document.addEventListener("visibilitychange", onVisibilityChange);
    visibilityHooked = true;
  }
  return c;
}

function applyBus(bus: BusName): void {
  if (buses) glide(buses[bus].gain, busTarget(bus));
}

function fireGroupTarget(): number {
  return 0.35 + 0.65 * intensity;
}

/* ------------------------------------------------------------------ */
/* Loading                                                              */
/* ------------------------------------------------------------------ */

function pickFormat(): AudioFormat {
  if (format) return format;
  try {
    format = new Audio().canPlayType('audio/webm; codecs="opus"') ? "webm" : "m4a";
  } catch {
    format = "m4a";
  }
  return format;
}

function loadManifest(): Promise<Manifest | null> {
  if (!manifestPromise) {
    manifestPromise = (async () => {
      try {
        const res = await fetch(`${audioBase}manifest.json`);
        if (!res.ok) throw new Error(`manifest ${res.status}`);
        const data = (await res.json()) as Manifest;
        if (!data || typeof data.slots !== "object") throw new Error("bad manifest");
        manifest = data;
        return data;
      } catch {
        manifestFailed = true;
        return null;
      }
    })();
  }
  return manifestPromise;
}

class HttpError extends Error {}

async function fetchDecode(url: string): Promise<AudioBuffer> {
  const res = await fetch(url);
  // Vite dev serves index.html for missing files: treat non-audio as missing.
  if (!res.ok || (res.headers.get("content-type") ?? "").includes("text/html")) {
    throw new HttpError(`${res.status} ${url}`);
  }
  const data = await res.arrayBuffer();
  if (!ctx) throw new Error("no context");
  return ctx.decodeAudioData(data);
}

/** Decode one file (base path without extension); deduped and cached. */
function loadFile(base: string): Promise<AudioBuffer | null> {
  const cached = fileBuffers.get(base);
  if (cached) return Promise.resolve(cached);
  const pending = fileLoads.get(base);
  if (pending) return pending;
  const preferred = pickFormat();
  const alternate: AudioFormat = preferred === "webm" ? "m4a" : "webm";
  const p = (async () => {
    try {
      return await fetchDecode(`${audioBase}${base}.${preferred}`);
    } catch (err) {
      // A decode failure (e.g. Safari + Opus in WebAudio) is worth one retry
      // in the other container; a missing file is not.
      if (err instanceof HttpError) throw err;
      return await fetchDecode(`${audioBase}${base}.${alternate}`);
    }
  })()
    .then((buf) => {
      fileBuffers.set(base, buf);
      return buf;
    })
    .catch(() => {
      failedFiles.add(base);
      return null;
    })
    .finally(() => fileLoads.delete(base));
  fileLoads.set(base, p);
  return p;
}

/** Load every variant of a slot; resolves to the usable buffers (maybe []). */
function loadSlot(slot: SlotName): Promise<AudioBuffer[]> {
  const ready = slotBuffers.get(slot);
  if (ready) return Promise.resolve(ready);
  const pending = slotLoads.get(slot);
  if (pending) return pending;
  const p = (async () => {
    const m = await loadManifest();
    const def = m?.slots[slot];
    if (!def || !ctx) return [];
    const bufs = await Promise.all(def.files.map(loadFile));
    const usable = bufs.filter((b): b is AudioBuffer => b !== null);
    slotBuffers.set(slot, usable);
    return usable;
  })().finally(() => slotLoads.delete(slot));
  slotLoads.set(slot, p);
  return p;
}

function prefetch(what: SlotName[] | SoundCategory): void {
  if (!ctx) return;
  const slots = Array.isArray(what)
    ? what
    : (Object.keys(SLOT_CATEGORY) as SlotName[]).filter((s) => SLOT_CATEGORY[s] === what);
  for (const s of slots) void loadSlot(s);
}

/** Runs once, the first time the context is actually running. */
function startPreload(): void {
  if (preloadStarted || !ctx || ctx.state !== "running") return;
  preloadStarted = true;
  void loadManifest().then((m) => {
    if (!m) return;
    if (enabled.ambience) prefetch(AMBIENCE_SLOTS);
    prefetch(PRELOAD_COMMON);
    // then the remaining table SFX (~0.5 MB) in the background; spells
    // wait for prefetch("spells") when the console opens
    void Promise.all(PRELOAD_COMMON.map(loadSlot)).then(() => prefetch("sfx"));
  });
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(undefined), ms);
    void p.then((v) => {
      clearTimeout(t);
      resolve(v);
    });
  });
}

/* ------------------------------------------------------------------ */
/* Synth fallback voices                                                */
/* ------------------------------------------------------------------ */

const noiseCache = new Map<string, AudioBuffer>();

function noiseBuffer(c: BaseAudioContext, seconds: number, brown: boolean): AudioBuffer {
  const key = `${seconds}:${brown}:${c.sampleRate}`;
  const hit = noiseCache.get(key);
  if (hit) return hit;
  const length = Math.floor(c.sampleRate * seconds);
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      data[i] = white;
    }
  }
  noiseCache.set(key, buffer);
  return buffer;
}

type SynthVoice = (c: AudioContext, out: AudioNode, t: number, strength: number) => AudioScheduledSourceNode[];

/** Filtered-noise swish: a page turning. */
const synthFlip: SynthVoice = (c, out, t) => {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 0.3, false);
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(2600, t);
  filter.frequency.exponentialRampToValueAtTime(420, t + 0.24);
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(0.4, t + 0.04);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.27);
  src.connect(filter).connect(env).connect(out);
  src.start(t);
  src.stop(t + 0.3);
  return [src];
};

/** Low sine drop: a heavy tome opening or closing. */
const synthThump: SynthVoice = (c, out, t) => {
  const osc = c.createOscillator();
  osc.frequency.setValueAtTime(110, t);
  osc.frequency.exponentialRampToValueAtTime(38, t + 0.32);
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(0.55, t + 0.015);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
  osc.connect(env).connect(out);
  osc.start(t);
  osc.stop(t + 0.45);
  return [osc];
};

/** Arpeggiated A5-D6-G6 chime: natural 20 / sparkle / fanfare stand-in. */
const synthChime: SynthVoice = (c, out, t) =>
  [880, 1174.66, 1567.98].map((freq, i) => {
    const at = t + i * 0.09;
    const osc = c.createOscillator();
    osc.frequency.value = freq;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(0.18, at + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 1.1);
    osc.connect(env).connect(out);
    osc.start(at);
    osc.stop(at + 1.2);
    return osc;
  });

/** Resonant noise tick + pitched knock: a die on wood (strength 0..1). */
const synthClack: SynthVoice = (c, out, t, strength) => {
  const hard = strength > 1; // >1 encodes "struck an item"
  const s = clamp(hard ? strength - 1 : strength, 0, 1);
  const peak = 0.05 + 0.4 * s * s;
  const jitter = rand(0.9, 1.1);
  const noise = c.createBufferSource();
  noise.buffer = noiseBuffer(c, 0.06, false);
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = (hard ? 3600 : 2200) * jitter * (0.85 + 0.3 * s);
  band.Q.value = hard ? 6 : 3.5;
  const nEnv = c.createGain();
  nEnv.gain.setValueAtTime(0.0001, t);
  nEnv.gain.exponentialRampToValueAtTime(peak, t + 0.002);
  nEnv.gain.exponentialRampToValueAtTime(0.0001, t + (hard ? 0.05 : 0.035));
  noise.connect(band).connect(nEnv).connect(out);
  noise.start(t);
  noise.stop(t + 0.06);
  const knock = c.createOscillator();
  knock.type = "triangle";
  const pitch = (hard ? 1450 : 620) * jitter;
  knock.frequency.setValueAtTime(pitch, t);
  knock.frequency.exponentialRampToValueAtTime(pitch * 0.7, t + 0.05);
  const kEnv = c.createGain();
  kEnv.gain.setValueAtTime(0.0001, t);
  kEnv.gain.exponentialRampToValueAtTime(peak * (hard ? 0.35 : 0.55), t + 0.003);
  kEnv.gain.exponentialRampToValueAtTime(0.0001, t + (hard ? 0.09 : 0.06));
  knock.connect(kEnv).connect(out);
  knock.start(t);
  knock.stop(t + 0.1);
  return [noise, knock];
};

/** Short bandpassed brown-noise pop: a fire crackle. */
const synthPop: SynthVoice = (c, out, t) => {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 0.08, false);
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = rand(1200, 3200);
  band.Q.value = 2;
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(rand(0.08, 0.2), t + 0.003);
  env.gain.exponentialRampToValueAtTime(0.0001, t + rand(0.03, 0.07));
  src.connect(band).connect(env).connect(out);
  src.start(t);
  src.stop(t + 0.08);
  return [src];
};

/** Tiny high tick for UI hover. */
const synthTick: SynthVoice = (c, out, t) => {
  const osc = c.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = 2400;
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(0.05, t + 0.002);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  osc.connect(env).connect(out);
  osc.start(t);
  osc.stop(t + 0.04);
  return [osc];
};

const SYNTH: Partial<Record<SlotName, SynthVoice>> = {
  "page-turn": synthFlip,
  parchment: synthFlip,
  "book-open": synthThump,
  "book-close": synthThump,
  "shield-knock": synthThump,
  nat20: synthChime,
  sparkle: synthChime,
  fanfare: synthChime,
  dice: synthClack,
  "fire-crackle": synthPop,
  hover: synthTick,
};

/** Synth loops: brown-noise fire with crackle bursts, lowpassed wind. */
function synthLoop(slot: SlotName, c: AudioContext, out: AudioNode): ((when: number) => void) | null {
  if (slot === "fire") {
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, 2.5, true);
    src.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 400;
    filter.Q.value = 0.7;
    const body = c.createGain();
    body.gain.value = 0.16;
    src.connect(filter).connect(body).connect(out);
    src.start();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const burst = () => {
      const now = c.currentTime;
      const attack = rand(0.004, 0.014);
      body.gain.cancelScheduledValues(now);
      body.gain.setValueAtTime(body.gain.value, now);
      body.gain.linearRampToValueAtTime(rand(0.3, 0.85), now + attack);
      body.gain.exponentialRampToValueAtTime(0.16, now + attack + rand(0.03, 0.1));
      timer = setTimeout(burst, rand(90, 640));
    };
    timer = setTimeout(burst, 300);
    return (when) => {
      if (timer) clearTimeout(timer);
      src.stop(when);
    };
  }
  if (slot === "wind-window") {
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, 2.5, false);
    src.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 220;
    const g = c.createGain();
    g.gain.value = 0.12;
    src.connect(filter).connect(g).connect(out);
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.06;
    const depth = c.createGain();
    depth.gain.value = 0.07;
    lfo.connect(depth).connect(g.gain);
    src.start();
    lfo.start();
    return (when) => {
      src.stop(when);
      lfo.stop(when);
    };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* One-shots                                                            */
/* ------------------------------------------------------------------ */

function registerVoice(slot: SlotName, voice: Voice, ended: Promise<void>, max: number): void {
  const list = voices.get(slot) ?? [];
  list.push(voice);
  while (list.length > max) list.shift()!.stop(30);
  voices.set(slot, list);
  void ended.then(() => {
    const l = voices.get(slot);
    if (!l) return;
    const i = l.indexOf(voice);
    if (i >= 0) l.splice(i, 1);
  });
}

function pickVariant(slot: SlotName, count: number, requested?: number): number {
  if (typeof requested === "number") return clamp(Math.floor(requested), 0, count - 1);
  if (count <= 1) return 0;
  const last = lastVariant.get(slot);
  let i = Math.floor(Math.random() * count);
  if (i === last) i = (i + 1 + Math.floor(Math.random() * (count - 1))) % count;
  lastVariant.set(slot, i);
  return i;
}

/** voice gain -> [panner] -> destination; returns the voice input node. */
function voiceChain(c: AudioContext, dest: AudioNode, gain: number, pan: number | null): GainNode {
  const g = c.createGain();
  g.gain.value = gain;
  if (pan !== null && pan !== 0) {
    const p = new StereoPannerNode(c, { pan });
    g.connect(p).connect(dest);
  } else {
    g.connect(dest);
  }
  return g;
}

function makeHandle(
  slot: SlotName,
  kind: "sample" | "synth",
  g: GainNode,
  sources: AudioScheduledSourceNode[],
): SoundHandle {
  let done = false;
  const ended = new Promise<void>((resolve) => {
    let left = sources.length;
    const finish = () => {
      if (--left > 0) return;
      done = true;
      g.disconnect();
      resolve();
    };
    if (!left) resolve();
    for (const s of sources) s.addEventListener("ended", finish, { once: true });
  });
  return {
    slot,
    kind,
    ended,
    stop(fadeMs = 60) {
      if (done || !ctx) return;
      const now = ctx.currentTime;
      const end = now + Math.max(0.005, fadeMs / 1000);
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0, end);
      for (const s of sources) {
        try {
          s.stop(end + 0.01);
        } catch {
          /* already stopped */
        }
      }
    },
  };
}

/**
 * Play a one-shot. Resolves to a handle (stop() / ended), or null when the
 * bus is muted, the context can't start, or the slot has neither a usable
 * file nor a synth fallback.
 */
function play(slot: SlotName, opts: PlayOptions = {}): Promise<SoundHandle | null> {
  return playVoice(slot, opts, 1);
}

/** play() with the strength handed to a synth fallback (dice clack). */
async function playVoice(
  slot: SlotName,
  opts: PlayOptions,
  synthStrength: number,
): Promise<SoundHandle | null> {
  const c = ensureContext();
  if (!c || !buses) return null;
  const bus = slotBus(slot);
  if (!enabled[bus]) return null;
  const tune = tuningFor(slot);

  let bufs = slotBuffers.get(slot);
  if (!bufs) {
    const wait = SYNTH[slot] ? tune.maxLatencyMs : Math.max(tune.maxLatencyMs, NO_SYNTH_WAIT_MS);
    bufs = await withTimeout(loadSlot(slot), wait);
  }
  if (!ctx || ctx !== c) return null; // disposed while waiting
  const dest = slotDestination(slot);
  if (!dest) return null;

  const def = manifest?.slots[slot];
  const placement = resolvePlacement(opts);
  const when = c.currentTime + Math.max(0, opts.delay ?? 0);
  const jitterGain = tune.gainJitterDb ? dbToGain(rand(-1, 1) * tune.gainJitterDb) : 1;
  const baseGain = (opts.gain ?? 1) * jitterGain * (placement?.gain ?? 1);
  const pan = placement?.pan ?? null;

  if (bufs && bufs.length) {
    const buffer = bufs[pickVariant(slot, bufs.length, opts.variant)]!;
    const src = c.createBufferSource();
    src.buffer = buffer;
    const rate = (opts.rate ?? 1) * (1 + rand(-1, 1) * tune.pitchJitter);
    src.playbackRate.value = rate;
    if (opts.detune) src.detune.value = opts.detune;
    const g = voiceChain(c, dest, baseGain * (def?.gain ?? 1), pan);
    src.connect(g);
    src.start(when);
    const handle = makeHandle(slot, "sample", g, [src]);
    registerVoice(slot, handle, handle.ended, tune.maxVoices);
    stats.samples++;
    const duck = opts.duck ?? (SLOT_CATEGORY[slot] === "spells" ? { amount: 0.45, ms: Math.min(4000, (buffer.duration / rate) * 800) } : false);
    if (duck) duckAmbience(duck.amount, duck.ms, opts.delay ?? 0);
    return handle;
  }

  const synth = SYNTH[slot];
  stats.fallbacks[slot] = (stats.fallbacks[slot] ?? 0) + 1;
  if (!synth) {
    stats.dropped++;
    return null;
  }
  const g = voiceChain(c, dest, baseGain, pan);
  const handle = makeHandle(slot, "synth", g, synth(c, g, when, synthStrength));
  registerVoice(slot, handle, handle.ended, tune.maxVoices);
  stats.synth++;
  return handle;
}

/* ------------------------------------------------------------------ */
/* Loops                                                                */
/* ------------------------------------------------------------------ */

function loopPlacement(source?: string): { pan: number; gain: number } {
  const pos = source ? sourcePositions.get(source) : undefined;
  return pos ? spatialize(pos) : { pan: 0, gain: 1 };
}

/**
 * Start a looping slot (fade in). Uses the manifest loopStart/loopEnd so the
 * loop is sample-accurate; starts at a random point inside the loop so each
 * visit sounds different. Resolves true if something is playing.
 */
async function startLoop(slot: SlotName, opts: LoopOptions = {}): Promise<boolean> {
  const c = ensureContext();
  if (!c) return false;
  const fade = (opts.fadeMs ?? 1500) / 1000;
  const existing = loops.get(slot);
  const def0 = manifest?.slots[slot];
  if (existing) {
    existing.target = (opts.gain ?? 1) * (def0?.gain ?? 1);
    glide(existing.env.gain, existing.target, fade / 3);
    return true;
  }
  const token = (loopTokens.get(slot) ?? 0) + 1;
  loopTokens.set(slot, token);
  const bufs = await loadSlot(slot);
  if (loopTokens.get(slot) !== token || ctx !== c || loops.has(slot)) return loops.has(slot);
  const dest = slotDestination(slot);
  if (!dest) return false;

  const def = manifest?.slots[slot];
  const target = (opts.gain ?? 1) * (def?.gain ?? 1);
  const place = loopPlacement(opts.source);
  const env = c.createGain();
  const spatialGain = c.createGain();
  spatialGain.gain.value = place.gain;
  const panner = new StereoPannerNode(c, { pan: place.pan });
  env.connect(spatialGain).connect(panner).connect(dest);

  let stopAt: (when: number) => void;
  let kind: "sample" | "synth" = "sample";
  if (bufs.length) {
    const buffer = bufs[0]!;
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const loopEnd = clamp(def?.loopEnd ?? buffer.duration, 0, buffer.duration);
    const loopStart = clamp(def?.loopStart ?? 0, 0, loopEnd);
    if (loopEnd > loopStart) {
      src.loopStart = loopStart;
      src.loopEnd = loopEnd;
    }
    src.connect(env);
    src.start(c.currentTime, rand(loopStart, loopEnd > loopStart ? loopEnd : buffer.duration));
    stopAt = (when) => src.stop(when);
  } else {
    const synth = synthLoop(slot, c, env);
    stats.fallbacks[slot] = (stats.fallbacks[slot] ?? 0) + 1;
    if (!synth) {
      env.disconnect();
      return false;
    }
    kind = "synth";
    stopAt = synth;
  }
  const now = c.currentTime;
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(target, now + fade);
  loops.set(slot, { slot, kind, env, spatialGain, panner, source: opts.source, target, stopAt });
  return true;
}

/** Fade a loop out and stop it (no-op if it isn't running). */
function stopLoop(slot: SlotName, fadeMs = 800): void {
  loopTokens.set(slot, (loopTokens.get(slot) ?? 0) + 1);
  const loop = loops.get(slot);
  if (!loop || !ctx) return;
  loops.delete(slot);
  const now = ctx.currentTime;
  const end = now + Math.max(0.01, fadeMs / 1000);
  loop.env.gain.cancelScheduledValues(now);
  loop.env.gain.setValueAtTime(loop.env.gain.value, now);
  loop.env.gain.linearRampToValueAtTime(0, end);
  try {
    loop.stopAt(end + 0.02);
  } catch {
    /* already stopped */
  }
  setTimeout(() => loop.env.disconnect(), fadeMs + 100);
}

function updateLoopPlacements(): void {
  for (const loop of loops.values()) {
    if (!loop.source) continue;
    const p = loopPlacement(loop.source);
    glide(loop.panner.pan, p.pan, 0.1);
    glide(loop.spatialGain.gain, p.gain, 0.1);
  }
}

/* ------------------------------------------------------------------ */
/* Ducking                                                              */
/* ------------------------------------------------------------------ */

/**
 * Lower ambience by `amount` (0..1 of its level) for `ms`, then recover
 * smoothly. Overlapping ducks keep the deepest amount and the latest end.
 */
function duckAmbience(amount: number, ms: number, delay = 0): void {
  if (!ctx || !duckNode) return;
  const now = ctx.currentTime;
  const start = now + delay;
  const end = start + ms / 1000;
  duckDepth = now < duckEnd ? Math.max(duckDepth, amount) : amount;
  duckEnd = Math.max(duckEnd, end);
  const p = duckNode.gain;
  p.cancelScheduledValues(now);
  p.setValueAtTime(p.value, now);
  p.setTargetAtTime(1 - clamp(duckDepth, 0, 1), start, 0.06);
  p.setTargetAtTime(1, duckEnd, 0.35);
}

/* ------------------------------------------------------------------ */
/* Ambience scene                                                       */
/* ------------------------------------------------------------------ */

function clearAmbienceTimers(): void {
  if (crackleTimer) clearTimeout(crackleTimer);
  if (creakTimer) clearTimeout(creakTimer);
  crackleTimer = creakTimer = null;
}

function scheduleCrackle(): void {
  const rate = 0.4 + 0.6 * intensity;
  crackleTimer = setTimeout(() => {
    crackleTimer = null;
    if (!ambienceRunning || document.hidden) return;
    void play("fire-crackle", { source: "fire", gain: rand(0.45, 1) });
    scheduleCrackle();
  }, rand(600, 3000) / rate);
}

function scheduleCreak(): void {
  creakTimer = setTimeout(() => {
    creakTimer = null;
    if (!ambienceRunning || document.hidden) return;
    void play("creak", { gain: rand(0.25, 0.4), pan: rand(-0.6, 0.6) });
    scheduleCreak();
  }, rand(20000, 60000));
}

function scheduleAmbienceTimers(): void {
  clearAmbienceTimers();
  if (!ambienceRunning || document.hidden) return;
  scheduleCrackle();
  scheduleCreak();
}

/** Fire loop + room tone + wind at the window, plus crackles and creaks. */
function startAmbience(): void {
  if (!ensureContext()) return;
  if (ambienceStopTimer) {
    clearTimeout(ambienceStopTimer);
    ambienceStopTimer = null;
  }
  if (ambienceRunning) return;
  ambienceRunning = true;
  for (const { slot, source } of AMBIENCE_LOOPS) void startLoop(slot, { fadeMs: 2500, source });
  void loadSlot("fire-crackle");
  scheduleAmbienceTimers();
}

function stopAmbience(fadeMs = 1200): void {
  ambienceRunning = false;
  clearAmbienceTimers();
  for (const { slot } of AMBIENCE_LOOPS) stopLoop(slot, fadeMs);
}

/* ------------------------------------------------------------------ */
/* Legacy helpers                                                       */
/* ------------------------------------------------------------------ */

/** Minimum gap between dice clacks (s) so a tumble can't machine-gun. */
const CLACK_GAP = 0.045;

/** Dice clatter; strength 0..1, hard = struck an item rather than wood. */
function playClack(strength: number, hard = false): void {
  if (!ctx) ensureContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  if (now - lastClackAt < CLACK_GAP) return;
  lastClackAt = now;
  const s = clamp(strength, 0, 1);
  void playVoice("dice", { gain: 0.2 + 0.8 * s * s, rate: hard ? 1.12 : 1 }, hard ? 1 + s : s);
}

/* ------------------------------------------------------------------ */
/* Public API                                                           */
/* ------------------------------------------------------------------ */

export interface AudioEngine {
  /** Create/resume the context; call inside a user gesture. */
  unlock: () => void;
  play: (slot: SlotName, opts?: PlayOptions) => Promise<SoundHandle | null>;
  startLoop: (slot: SlotName, opts?: LoopOptions) => Promise<boolean>;
  stopLoop: (slot: SlotName, fadeMs?: number) => void;
  startAmbience: () => void;
  stopAmbience: (fadeMs?: number) => void;
  /** Ambience mute toggle (settings); starts/stops the ambience scene. */
  setAmbienceOn: (on: boolean) => void;
  /** SFX mute toggle (settings); covers the sfx and ui buses. */
  setSfxOn: (on: boolean) => void;
  /** Bus volume 0..1 (perceptual curve, glides without zipper noise). */
  setBusVolume: (bus: BusName, volume: number) => void;
  /** 0..1: fire loudness and crackle rate (snuffed candles, daylight). */
  setAmbienceIntensity: (value: number) => void;
  /** Crackle synced to an ember particle pop (rate-limited). */
  onEmberPop: () => void;
  /** Camera position + forward vector (world space). */
  setListener: (position: Vec3, forward: Vec3) => void;
  /** Named emitter position ("fire", "window", ...); null clears it. */
  setSourcePosition: (name: string, position: Vec3 | null) => void;
  /** Lower ambience by amount (0..1) for ms, then recover. */
  duck: (amount: number, ms: number) => void;
  prefetch: (what: SlotName[] | SoundCategory) => void;
  configureSlot: (slot: SlotName, tuning: Partial<SlotTuning>) => void;
  /** Page turn (BookOverlay). */
  playFlip: () => void;
  /** Book thump (open). */
  playThump: () => void;
  /** Natural-20 chime. */
  playChime: () => void;
  playClack: (strength: number, hard?: boolean) => void;
  dispose: () => void;
}

const engine: AudioEngine = {
  unlock() {
    const c = ensureContext();
    if (!c) return;
    if (c.state === "running") startPreload();
    else if (!document.hidden) void c.resume().then(startPreload, () => undefined);
    if (enabled.ambience && !ambienceRunning) startAmbience();
  },
  play,
  startLoop,
  stopLoop,
  startAmbience,
  stopAmbience,
  setAmbienceOn(on) {
    enabled.ambience = on;
    applyBus("ambience");
    if (on) {
      if (ctx) {
        prefetch(AMBIENCE_SLOTS);
        startAmbience();
      }
    } else if (ambienceRunning && !ambienceStopTimer) {
      // the bus fades out first, then the loops are torn down
      ambienceStopTimer = setTimeout(() => {
        ambienceStopTimer = null;
        if (!enabled.ambience) stopAmbience(50);
      }, 600);
    }
  },
  setSfxOn(on) {
    enabled.sfx = on;
    enabled.ui = on;
    applyBus("sfx");
    applyBus("ui");
  },
  setBusVolume(bus, volume) {
    volumes[bus] = clamp(volume, 0, 1);
    applyBus(bus);
  },
  setAmbienceIntensity(value) {
    intensity = clamp(value, 0, 1);
    if (fireGroup) glide(fireGroup.gain, fireGroupTarget(), 0.5);
  },
  onEmberPop() {
    if (!ctx || !ambienceRunning || document.hidden) return;
    const now = ctx.currentTime;
    if (now - lastEmberAt < 0.35) return;
    lastEmberAt = now;
    void play("fire-crackle", { source: "fire", gain: rand(0.3, 0.6) });
  },
  setListener(position, forward) {
    listenerPos = { ...position };
    listenerFwd = { ...forward };
    updateLoopPlacements();
  },
  setSourcePosition(name, position) {
    if (position) sourcePositions.set(name, { ...position });
    else sourcePositions.delete(name);
    updateLoopPlacements();
  },
  duck(amount, ms) {
    duckAmbience(amount, ms);
  },
  prefetch,
  configureSlot(slot, t) {
    tuning[slot] = { ...tuning[slot], ...t };
  },
  playFlip: () => void play("page-turn"),
  playThump: () => void play("book-open"),
  playChime: () => void play("nat20"),
  playClack,
  dispose() {
    stopAmbience(0);
    if (ambienceStopTimer) clearTimeout(ambienceStopTimer);
    ambienceStopTimer = null;
    if (visibilityHooked) {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      visibilityHooked = false;
    }
    if (ctx) void ctx.close();
    ctx = master = limiter = analyser = duckNode = fireGroup = null;
    buses = null;
    loops.clear();
    voices.clear();
    fileBuffers.clear();
    fileLoads.clear();
    failedFiles.clear();
    slotBuffers.clear();
    slotLoads.clear();
    noiseCache.clear();
    manifest = null;
    manifestPromise = null;
    manifestFailed = false;
    preloadStarted = false;
    duckEnd = duckDepth = 0;
  },
};

/* ------------------------------------------------------------------ */
/* Dev hook                                                             */
/* ------------------------------------------------------------------ */

function debugState() {
  return {
    ctxState: ctx?.state ?? "none",
    currentTime: ctx?.currentTime ?? 0,
    sampleRate: ctx?.sampleRate ?? null,
    format,
    manifestLoaded: !!manifest,
    manifestFailed,
    loadedBuffers: fileBuffers.size,
    loadedSlots: [...slotBuffers.entries()].filter(([, b]) => b.length).map(([s]) => s),
    failedFiles: [...failedFiles],
    inflight: fileLoads.size,
    activeLoops: [...loops.values()].map((l) => ({
      slot: l.slot,
      kind: l.kind,
      gain: Number(l.env.gain.value.toFixed(3)),
      pan: Number(l.panner.pan.value.toFixed(3)),
    })),
    voices: [...voices.values()].reduce((n, l) => n + l.length, 0),
    buses: buses
      ? {
          ambience: buses.ambience.gain.value,
          sfx: buses.sfx.gain.value,
          ui: buses.ui.gain.value,
          duck: duckNode?.gain.value ?? null,
          fireGroup: fireGroup?.gain.value ?? null,
        }
      : null,
    volumes: { ...volumes },
    enabled: { ...enabled },
    ambienceRunning,
    schedulerActive: crackleTimer !== null,
    intensity,
    stats: { ...stats, fallbacks: { ...stats.fallbacks } },
  };
}

/** RMS of the master output right now (dev only). */
function debugRms(): number {
  if (!analyser) return 0;
  const data = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(data);
  let sum = 0;
  for (const v of data) sum += v * v;
  return Math.sqrt(sum / data.length);
}

if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as { __audio: unknown }).__audio = {
    engine,
    state: debugState,
    rms: debugRms,
  };
}

/** Module-level singleton: every component talks to the same engine. */
export function useAudio(): AudioEngine {
  return engine;
}
