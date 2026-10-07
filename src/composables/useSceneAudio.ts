import { useAudio, type Vec3 } from "./useAudio";
import type { ItemId, ScenePoint, SceneSources } from "../three/types";

/**
 * Routes what happens in the inn (scene events, UI moments) to the audio
 * engine. The 3D layer only reports facts (positions, casts, snuffs); every
 * decision about which slot plays, how loud and when lives here, so the
 * scene never imports audio code.
 */

const audio = useAudio();

const rand = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);
const lerpPoint = (a: ScenePoint, b: ScenePoint, t: number): Vec3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});

/* ------------------------------------------------------------------ */
/* State                                                                */
/* ------------------------------------------------------------------ */

let sources: SceneSources | null = null;
/** 0 = night, 1 = day. */
let dayFactor = 0;
/** Candles burning / total (1 until the scene says otherwise). */
let litFraction = 1;
/** Flight time of the last fireball (0 = reduced motion: no flight). */
let lastFlightMs = 800;
let lastHoverAt = 0;
let lastCreakAt = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let idleTimer2: ReturnType<typeof setTimeout> | null = null;

/** Fire loudness / crackle rate: dimmer by day, quieter as candles go out. */
function applyIntensity(): void {
  const base = 1 - 0.2 * dayFactor;
  audio.setAmbienceIntensity(base * (0.45 + 0.55 * litFraction));
}

function itemPosition(item: ItemId): Vec3 | undefined {
  if (!sources) return undefined;
  return sources.items[item] ?? (item === "candle" ? sources.candles[0] : undefined);
}

/** Spells ride on the sfx bus; give every slot a sane voice budget. */
audio.configureSlot("clatter", { maxVoices: 3 });
audio.configureSlot("fire-crackle", { maxVoices: 6 });

/* ------------------------------------------------------------------ */
/* Scene -> audio                                                       */
/* ------------------------------------------------------------------ */

export const sceneAudio = {
  /** Stage built: register the named emitters once. */
  sources(s: SceneSources): void {
    sources = s;
    audio.setSourcePosition("fire", s.fire);
    audio.setSourcePosition("window", s.window);
    audio.setSourcePosition("lantern", s.lantern);
    audio.setSourcePosition("book", s.book);
  },

  /** Camera pose (~10 Hz while it moves). */
  listener(position: ScenePoint, forward: ScenePoint): void {
    audio.setListener(position, forward);
  },

  /** An ember pop burst: a crackle on the beat, one more as the sparks land. */
  emberPop(): void {
    audio.onEmberPop();
    void audio.play("fire-crackle", { source: "fire", gain: 0.5, delay: 0.4 });
  },

  /** Lantern swing end: an occasional quiet creak from its chain. */
  lanternSway(): void {
    const now = performance.now();
    if (now - lastCreakAt < 25000 || Math.random() > 0.5) return;
    lastCreakAt = now;
    void audio.play("creak", { source: "lantern", gain: rand(0.25, 0.4) });
  },

  timeOfDay(resolved: "day" | "night"): void {
    dayFactor = resolved === "day" ? 1 : 0;
    applyIntensity();
  },

  /** Candle snuffed (click or gust) or relit (click or the match). */
  candleSnuff(e: {
    snuffed: boolean;
    positions: ScenePoint[];
    litCount: number;
    total: number;
    cause: "click" | "gust";
  }): void {
    litFraction = e.total > 0 ? e.litCount / e.total : 1;
    applyIntensity();
    e.positions.forEach((position, i) => {
      if (e.snuffed) {
        const gust = e.cause === "gust";
        if (gust) {
          // the flame gutters before it goes out
          for (let n = 0; n < 2; n++) {
            void audio.play("fire-crackle", {
              position,
              gain: rand(0.3, 0.5),
              delay: 0.05 + i * 0.1 + n * rand(0.1, 0.18),
            });
          }
        }
        void audio.play("candle-puff", {
          position,
          gain: 0.9,
          delay: gust ? 0.4 + i * 0.15 : i * 0.1,
        });
      } else {
        void audio.play("match-strike", { position, delay: i * 0.4 });
      }
    });
  },

  /** Fireball leaves the hand: whoosh heard mid-flight. */
  fireballCast(f: { from: ScenePoint; to: ScenePoint; durationMs: number }): void {
    lastFlightMs = f.durationMs;
    void audio.play("fireball-whoosh", { position: lerpPoint(f.from, f.to, 0.5) });
  },

  /** Fireball detonates: boom, then a few embers settling. */
  fireballImpact(position: ScenePoint): void {
    // reduced motion has no flight, so let the whoosh breathe first
    const delay = lastFlightMs === 0 ? 0.35 : 0;
    void audio.play("fireball-impact", { position, delay });
    for (let n = 0; n < 3; n++) {
      void audio.play("fire-crackle", {
        position,
        gain: rand(0.35, 0.7),
        delay: delay + 0.15 + n * rand(0.12, 0.3),
      });
    }
  },

  /** Lightning: the strike, then thunder rolling in a beat later. */
  lightning(position: ScenePoint): void {
    void audio.play("zap", { position });
    void audio.play("thunder", { position, delay: rand(0.3, 0.9) });
  },

  /** Gust of Wind: the whistle sample on a low noise swell (weak slot). */
  gust(): void {
    void audio.play("gust");
    void audio.playLayer("gust-swell", { gain: 0.8 });
  },

  /** One of the Animate Objects hops: sparkle at the first, clatter on every other. */
  objectHop(h: { position: ScenePoint; index: number }): void {
    if (h.index === 0) void audio.play("sparkle", { position: h.position, gain: 0.7 });
    if (h.index % 2 === 0) {
      void audio.play("clatter", {
        position: h.position,
        gain: rand(0.45, 0.7),
        rate: 1 + h.index * 0.05,
        delay: 0.12 + rand(0, 0.06),
        duck: false,
      });
    }
  },

  /** Animate Objects under reduced motion: nothing hops, only the shimmer. */
  animateStill(): void {
    void audio.play("sparkle", { gain: 0.6 });
  },

  /** A tabletop item took focus (click, tap or keyboard). */
  itemFocus(item: ItemId): void {
    const position = itemPosition(item);
    const at = position ? { position } : {};
    switch (item) {
      case "spellbook":
        void audio.play("book-open", { source: "book" });
        break;
      case "sword":
        void audio.play("sword-ring", at);
        break;
      case "shield":
        void audio.play("shield-knock", at);
        break;
      case "potion":
        void audio.play("cork-pop", at);
        void audio.play("slosh", { ...at, delay: 0.15, gain: 0.8 });
        break;
      case "scroll":
        void audio.play("parchment", at);
        break;
      case "tankard":
        void audio.play("tankard", at);
        void audio.playLayer("metal-clink", { ...at, delay: 0.04, gain: 0.8 });
        break;
      case "candle":
        void audio.play("fire-crackle", { ...at, gain: 0.35 });
        break;
      default:
        break;
    }
  },

  bookClose(): void {
    void audio.play("book-close", { source: "book" });
  },

  /** A page turn; glides within a single-page view are quieter. */
  pageTurn(glide = false): void {
    void audio.play("page-turn", { source: "book", gain: glide ? 0.5 : 1 });
  },

  /** The d20 struck wood or an item. */
  diceImpact(strength: number, hard: boolean): void {
    audio.playClack(strength, hard);
  },

  /** The d20 came to rest. */
  diceResult(value: number): void {
    if (value === 20) {
      void audio.play("nat20");
      void audio.play("sparkle", { delay: 0.15, gain: 0.55 });
    } else if (value === 1) {
      // a low wooden thud for the comedy
      void audio.play("shield-knock", { detune: -600, gain: 0.9, delay: 0.1 });
    }
  },

  konami(): void {
    void audio.play("fanfare");
  },

  /** Quest toasts (hire, touch hint) rustle a scroll. */
  toast(tone: string): void {
    if (tone === "quest") void audio.play("parchment", { gain: 0.4 });
  },

  /** Hover tick (3D item, keyboard highlight, UI control); rate-limited. */
  hover(gain = 0.7): void {
    const now = performance.now();
    if (now - lastHoverAt < 120) return;
    lastHoverAt = now;
    void audio.play("hover", { gain });
  },

  /**
   * Warm the buffers a few seconds after Enter so the first spell or item
   * is never silent: spells first, table sfx right behind.
   */
  afterEnter(): void {
    this.cancelIdle();
    idleTimer = setTimeout(() => {
      audio.prefetch("spells");
      idleTimer2 = setTimeout(() => audio.prefetch("sfx"), 2000);
    }, 5000);
  },

  cancelIdle(): void {
    if (idleTimer) clearTimeout(idleTimer);
    if (idleTimer2) clearTimeout(idleTimer2);
    idleTimer = idleTimer2 = null;
  },
};

/* ------------------------------------------------------------------ */
/* DOM controls: soft hover tick                                        */
/* ------------------------------------------------------------------ */

const UI_SELECTOR =
  'button, a[href], [role="switch"], [role="tab"], select, input[type="range"], summary';

/**
 * Very soft tick when a mouse enters a button / link / toggle, or when one
 * takes keyboard focus. Never for touch or pen. `allowed()` gates it (not
 * before Enter, not in the flat page).
 */
export function installUiHover(allowed: () => boolean): () => void {
  const over = (event: PointerEvent): void => {
    if (event.pointerType !== "mouse" || !allowed()) return;
    const target = (event.target as Element | null)?.closest?.(UI_SELECTOR);
    if (!target || (target as HTMLButtonElement).disabled) return;
    const from = event.relatedTarget as Node | null;
    if (from && target.contains(from)) return; // moved within the same control
    sceneAudio.hover(0.5);
  };
  const focus = (event: FocusEvent): void => {
    if (!allowed()) return;
    const target = event.target as Element | null;
    if (!target?.matches?.(UI_SELECTOR) || !target.matches(":focus-visible")) return;
    sceneAudio.hover(0.5);
  };
  document.addEventListener("pointerover", over, { passive: true });
  document.addEventListener("focusin", focus);
  return () => {
    document.removeEventListener("pointerover", over);
    document.removeEventListener("focusin", focus);
  };
}
