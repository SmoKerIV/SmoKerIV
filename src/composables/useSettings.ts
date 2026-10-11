import { reactive, watch } from "vue";
import type { Quality, TimeOfDay } from "../three/types";

export interface AppSettings {
  /** Inn ambience (fire, room tone, wind) on. Off by default (autoplay etiquette). */
  ambienceOn: boolean;
  /** Ambience bus volume 0..1. */
  ambienceVolume: number;
  /** Sound effects (and UI ticks) on. */
  sfxOn: boolean;
  /** SFX bus volume 0..1. */
  sfxVolume: number;
  /** UI bus volume 0..1 (hover ticks). */
  uiVolume: number;
  /** The Innkeeper's Music Box on. Off by default (autoplay etiquette). */
  musicOn: boolean;
  /** Music bus volume 0..1. */
  musicVolume: number;
  quality: Quality;
  reducedMotion: boolean;
  /** Inn mood lighting: "auto" follows the visitor's clock. */
  timeOfDay: TimeOfDay;
  /** Storage schema version (see load()). */
  version: number;
}

const STORAGE_KEY = "smokeriv-settings";
/**
 * v1: ambience stored as musicOn/musicVolume. v2: ambienceOn/ambienceVolume
 * (no music). v3: musicOn/musicVolume are the music box.
 */
const VERSION = 3;
const QUALITIES: Quality[] = ["low", "medium", "high"];
const TIMES_OF_DAY: TimeOfDay[] = ["auto", "day", "night"];

function autoQuality(): Quality {
  if (typeof window === "undefined") return "medium";
  // Touch devices: thermals and battery beat sparkle. Phones start low
  // (the ledger lets anyone raise it); tablets can carry medium.
  if (window.matchMedia?.("(pointer: coarse)").matches) {
    return window.matchMedia("(max-width: 960px)").matches ? "low" : "medium";
  }
  const dpr = window.devicePixelRatio ?? 1;
  const cores = navigator.hardwareConcurrency ?? 4;
  return dpr <= 1.5 && cores >= 8 ? "high" : "medium";
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function defaults(): AppSettings {
  return {
    ambienceOn: false,
    ambienceVolume: 0.6,
    sfxOn: true,
    sfxVolume: 0.8,
    uiVolume: 0.5,
    musicOn: false,
    musicVolume: 0.55,
    quality: autoQuality(),
    reducedMotion: prefersReducedMotion(),
    timeOfDay: "auto",
    version: VERSION,
  };
}

/** Stored shape of any version (fields may be missing or wrong-typed). */
interface StoredSettings extends Partial<Omit<AppSettings, "musicOn" | "musicVolume">> {
  musicOn?: unknown;
  musicVolume?: unknown;
}

function volume(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

function load(): AppSettings {
  const base = defaults();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as StoredSettings;
      // v1 (no version, no ambienceOn) stored the ambience toggle/volume as
      // musicOn/musicVolume; from v3 those keys belong to the music box.
      const v1 = typeof saved.version !== "number" && saved.ambienceOn === undefined;
      if (v1) {
        if (typeof saved.musicOn === "boolean") base.ambienceOn = saved.musicOn;
        base.ambienceVolume = volume(saved.musicVolume, base.ambienceVolume);
      } else {
        if (typeof saved.ambienceOn === "boolean") base.ambienceOn = saved.ambienceOn;
        base.ambienceVolume = volume(saved.ambienceVolume, base.ambienceVolume);
        if (typeof saved.version === "number" && saved.version >= 3) {
          if (typeof saved.musicOn === "boolean") base.musicOn = saved.musicOn;
          base.musicVolume = volume(saved.musicVolume, base.musicVolume);
        }
      }
      if (typeof saved.sfxOn === "boolean") base.sfxOn = saved.sfxOn;
      base.sfxVolume = volume(saved.sfxVolume, base.sfxVolume);
      base.uiVolume = volume(saved.uiVolume, base.uiVolume);
      if (saved.quality && QUALITIES.includes(saved.quality)) {
        base.quality = saved.quality;
      }
      if (typeof saved.reducedMotion === "boolean") {
        base.reducedMotion = saved.reducedMotion;
      }
      if (saved.timeOfDay && TIMES_OF_DAY.includes(saved.timeOfDay)) {
        base.timeOfDay = saved.timeOfDay;
      }
    }
  } catch {
    /* corrupted storage — fall back to defaults */
  }
  return base;
}

let instance: AppSettings | null = null;

/**
 * Singleton reactive settings, persisted to localStorage.
 * Every caller of useSettings() shares the same object.
 */
export function useSettings(): AppSettings {
  if (!instance) {
    instance = reactive(load());
    watch(
      instance,
      (value) => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
        } catch {
          /* storage full/unavailable — non-fatal */
        }
      },
      { deep: true },
    );
  }
  return instance;
}
