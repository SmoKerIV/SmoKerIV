/**
 * WebAudio engine for the inn — fully procedural, no asset files needed.
 *
 * Ambience is synthesized: fire crackle (brown noise → bandpass ~400 Hz with
 * random gain bursts) + low wind (noise → lowpass 220 Hz with a slow LFO).
 *
 * DROP-IN REAL TRACK: put a loopable file at  public/audio/ambient.mp3  and
 * it will be detected (HEAD request) and used through an <audio> element
 * routed into the same music bus — no code changes required.
 *
 * The AudioContext is only created inside a user gesture (unlock()/setters),
 * so autoplay policies are respected. Suspends on tab hide, resumes on show.
 */

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;

let musicOn = false;
let musicVolume = 0.6;
let sfxOn = true;

let ambienceRunning = false;
let ambienceNodes: AudioNode[] = [];
let ambienceSources: AudioBufferSourceNode[] = [];
let ambienceOscs: OscillatorNode[] = [];
let crackleTimer: ReturnType<typeof setTimeout> | null = null;
let ambientEl: HTMLAudioElement | null = null;
let ambientElSource: MediaElementAudioSourceNode | null = null;
/** null = not probed yet, true/false = probe result for /audio/ambient.mp3 */
let realTrackAvailable: boolean | null = null;

let visibilityHooked = false;

function onVisibilityChange(): void {
  if (!ctx) return;
  if (document.hidden) {
    void ctx.suspend();
    if (ambientEl && !ambientEl.paused) ambientEl.pause();
  } else {
    void ctx.resume();
    if (ambientEl && musicOn) void ambientEl.play().catch(() => undefined);
  }
}

function ensureContext(): AudioContext | null {
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  }
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();

  masterGain = ctx.createGain();
  masterGain.gain.value = 1;
  masterGain.connect(ctx.destination);

  musicGain = ctx.createGain();
  musicGain.gain.value = 0;
  musicGain.connect(masterGain);

  sfxGain = ctx.createGain();
  sfxGain.gain.value = sfxOn ? 1 : 0;
  sfxGain.connect(masterGain);

  if (!visibilityHooked) {
    document.addEventListener("visibilitychange", onVisibilityChange);
    visibilityHooked = true;
  }
  return ctx;
}

/* ------------------------------------------------------------------ */
/* Noise helpers                                                        */
/* ------------------------------------------------------------------ */

function makeNoiseBuffer(
  context: AudioContext,
  seconds: number,
  brown: boolean,
): AudioBuffer {
  const length = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(1, length, context.sampleRate);
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
  return buffer;
}

function loopNoise(
  context: AudioContext,
  brown: boolean,
): AudioBufferSourceNode {
  const src = context.createBufferSource();
  src.buffer = makeNoiseBuffer(context, 2.5, brown);
  src.loop = true;
  return src;
}

/* ------------------------------------------------------------------ */
/* Ambience                                                             */
/* ------------------------------------------------------------------ */

async function probeRealTrack(): Promise<boolean> {
  if (realTrackAvailable !== null) return realTrackAvailable;
  try {
    const res = await fetch("/audio/ambient.mp3", { method: "HEAD" });
    const type = res.headers.get("content-type") ?? "";
    // Vite dev server returns index.html for missing files — require audio/*
    realTrackAvailable = res.ok && type.startsWith("audio");
  } catch {
    realTrackAvailable = false;
  }
  return realTrackAvailable;
}

function startSynthAmbience(context: AudioContext, bus: GainNode): void {
  // --- Fire crackle: brown noise → bandpass ~400 Hz → bursty gain ---
  const fire = loopNoise(context, true);
  const fireFilter = context.createBiquadFilter();
  fireFilter.type = "bandpass";
  fireFilter.frequency.value = 400;
  fireFilter.Q.value = 0.7;
  const fireBase = context.createGain();
  fireBase.gain.value = 0.16;
  fire.connect(fireFilter).connect(fireBase).connect(bus);
  fire.start();

  const scheduleCrackle = () => {
    if (!ctx || !ambienceRunning) return;
    const now = ctx.currentTime;
    const strength = 0.3 + Math.random() * 0.55;
    const attack = 0.004 + Math.random() * 0.01;
    const decay = 0.03 + Math.random() * 0.07;
    fireBase.gain.cancelScheduledValues(now);
    fireBase.gain.setValueAtTime(fireBase.gain.value, now);
    fireBase.gain.linearRampToValueAtTime(strength, now + attack);
    fireBase.gain.exponentialRampToValueAtTime(0.16, now + attack + decay);
    crackleTimer = setTimeout(scheduleCrackle, 90 + Math.random() * 550);
  };
  crackleTimer = setTimeout(scheduleCrackle, 300);

  // --- Low wind: white noise → lowpass 220 Hz → slow LFO on gain ---
  const wind = loopNoise(context, false);
  const windFilter = context.createBiquadFilter();
  windFilter.type = "lowpass";
  windFilter.frequency.value = 220;
  const windGainNode = context.createGain();
  windGainNode.gain.value = 0.12;
  wind.connect(windFilter).connect(windGainNode).connect(bus);
  wind.start();

  const lfo = context.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.06;
  const lfoDepth = context.createGain();
  lfoDepth.gain.value = 0.07;
  lfo.connect(lfoDepth).connect(windGainNode.gain);
  lfo.start();

  ambienceSources.push(fire, wind);
  ambienceOscs.push(lfo);
  ambienceNodes.push(fireFilter, fireBase, windFilter, windGainNode, lfoDepth);
}

async function startAmbience(): Promise<void> {
  const context = ensureContext();
  if (!context || !musicGain || ambienceRunning) return;
  ambienceRunning = true;

  if (await probeRealTrack()) {
    if (!ambienceRunning) return; // toggled off while probing
    if (!ambientEl) {
      ambientEl = new Audio("/audio/ambient.mp3");
      ambientEl.loop = true;
      ambientEl.crossOrigin = "anonymous";
      ambientElSource = context.createMediaElementSource(ambientEl);
      ambientElSource.connect(musicGain);
    }
    void ambientEl.play().catch(() => undefined);
    return;
  }
  if (!ambienceRunning) return;
  startSynthAmbience(context, musicGain);
}

function stopAmbience(): void {
  ambienceRunning = false;
  if (crackleTimer) {
    clearTimeout(crackleTimer);
    crackleTimer = null;
  }
  for (const src of ambienceSources) {
    try {
      src.stop();
    } catch {
      /* already stopped */
    }
    src.disconnect();
  }
  for (const osc of ambienceOscs) {
    try {
      osc.stop();
    } catch {
      /* already stopped */
    }
    osc.disconnect();
  }
  for (const node of ambienceNodes) node.disconnect();
  ambienceSources = [];
  ambienceOscs = [];
  ambienceNodes = [];
  if (ambientEl) ambientEl.pause();
}

function rampMusicGain(): void {
  if (!ctx || !musicGain) return;
  const target = musicOn ? musicVolume * 0.9 : 0;
  const now = ctx.currentTime;
  musicGain.gain.cancelScheduledValues(now);
  musicGain.gain.setValueAtTime(musicGain.gain.value, now);
  musicGain.gain.linearRampToValueAtTime(target, now + 0.8);
}

/* ------------------------------------------------------------------ */
/* SFX                                                                  */
/* ------------------------------------------------------------------ */

function sfxReady(): AudioContext | null {
  if (!sfxOn) return null;
  const context = ensureContext();
  if (!context || !sfxGain) return null;
  return context;
}

/** Short filtered-noise swish — a page turning. */
function playFlip(): void {
  const context = sfxReady();
  if (!context || !sfxGain) return;
  const now = context.currentTime;

  const src = context.createBufferSource();
  src.buffer = makeNoiseBuffer(context, 0.3, false);
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(2600, now);
  filter.frequency.exponentialRampToValueAtTime(420, now + 0.24);

  const env = context.createGain();
  env.gain.setValueAtTime(0.0001, now);
  env.gain.exponentialRampToValueAtTime(0.4, now + 0.04);
  env.gain.exponentialRampToValueAtTime(0.0001, now + 0.27);

  src.connect(filter).connect(env).connect(sfxGain);
  src.start(now);
  src.stop(now + 0.3);
}

/** Low sine drop — a heavy tome opening or closing. */
function playThump(): void {
  const context = sfxReady();
  if (!context || !sfxGain) return;
  const now = context.currentTime;

  const osc = context.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(110, now);
  osc.frequency.exponentialRampToValueAtTime(38, now + 0.32);

  const env = context.createGain();
  env.gain.setValueAtTime(0.0001, now);
  env.gain.exponentialRampToValueAtTime(0.55, now + 0.015);
  env.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

  osc.connect(env).connect(sfxGain);
  osc.start(now);
  osc.stop(now + 0.45);
}

/** Small arpeggiated chime — natural 20. */
function playChime(): void {
  const context = sfxReady();
  if (!context || !sfxGain) return;
  const now = context.currentTime;
  const notes = [880, 1174.66, 1567.98]; // A5, D6, G6 — an open, "magic" stack
  notes.forEach((freq, i) => {
    const t = now + i * 0.09;
    const osc = context.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const env = context.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    osc.connect(env).connect(sfxGain!);
    osc.start(t);
    osc.stop(t + 1.2);
  });
}

/* ------------------------------------------------------------------ */
/* Public API                                                           */
/* ------------------------------------------------------------------ */

export interface AudioEngine {
  /** Call inside the first user gesture (Enter the Inn click). */
  unlock: () => void;
  setMusicOn: (on: boolean) => void;
  setMusicVolume: (volume: number) => void;
  setSfxOn: (on: boolean) => void;
  playFlip: () => void;
  playThump: () => void;
  playChime: () => void;
  dispose: () => void;
}

const engine: AudioEngine = {
  unlock() {
    ensureContext();
  },
  setMusicOn(on: boolean) {
    musicOn = on;
    if (on) {
      void startAmbience();
    } else {
      // fade out, then tear down the synth nodes
      rampMusicGain();
      setTimeout(() => {
        if (!musicOn) stopAmbience();
      }, 850);
      return;
    }
    rampMusicGain();
  },
  setMusicVolume(volume: number) {
    musicVolume = Math.min(1, Math.max(0, volume));
    rampMusicGain();
  },
  setSfxOn(on: boolean) {
    sfxOn = on;
    if (sfxGain) sfxGain.gain.value = on ? 1 : 0;
  },
  playFlip,
  playThump,
  playChime,
  dispose() {
    stopAmbience();
    if (visibilityHooked) {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      visibilityHooked = false;
    }
    if (ambientElSource) {
      ambientElSource.disconnect();
      ambientElSource = null;
    }
    ambientEl = null;
    if (ctx) {
      void ctx.close();
      ctx = null;
      masterGain = null;
      musicGain = null;
      sfxGain = null;
    }
    realTrackAvailable = null;
  },
};

/** Module-level singleton — every component talks to the same engine. */
export function useAudio(): AudioEngine {
  return engine;
}
