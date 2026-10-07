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
  quality: Quality;
  reducedMotion: boolean;
  /** Inn mood lighting: "auto" follows the visitor's clock. */
  timeOfDay: TimeOfDay;
}

const STORAGE_KEY = "smokeriv-settings";
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
    quality: autoQuality(),
    reducedMotion: prefersReducedMotion(),
    timeOfDay: "auto",
  };
}

/** Fields from the first settings version, migrated on load. */
interface LegacySettings {
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
      const saved = JSON.parse(raw) as Partial<AppSettings> & LegacySettings;
      // v1 stored the ambience toggle/volume as musicOn/musicVolume.
      const ambienceOn = saved.ambienceOn ?? saved.musicOn;
      if (typeof ambienceOn === "boolean") base.ambienceOn = ambienceOn;
      base.ambienceVolume = volume(saved.ambienceVolume ?? saved.musicVolume, base.ambienceVolume);
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
