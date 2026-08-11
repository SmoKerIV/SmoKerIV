import { reactive, watch } from "vue";
import type { Quality, TimeOfDay } from "../three/types";

export interface AppSettings {
  /** Ambient music/soundscape on. Off by default (autoplay etiquette). */
  musicOn: boolean;
  /** 0..1 */
  musicVolume: number;
  sfxOn: boolean;
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
    musicOn: false,
    musicVolume: 0.6,
    sfxOn: true,
    quality: autoQuality(),
    reducedMotion: prefersReducedMotion(),
    timeOfDay: "auto",
  };
}

function load(): AppSettings {
  const base = defaults();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<AppSettings>;
      if (typeof saved.musicOn === "boolean") base.musicOn = saved.musicOn;
      if (typeof saved.musicVolume === "number") {
        base.musicVolume = Math.min(1, Math.max(0, saved.musicVolume));
      }
      if (typeof saved.sfxOn === "boolean") base.sfxOn = saved.sfxOn;
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
