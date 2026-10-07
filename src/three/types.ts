import type * as THREE from "three";

/** Every interactable object on the table. */
export type ItemId =
  | "spellbook"
  | "sword"
  | "shield"
  | "potion"
  | "scroll"
  | "dice"
  | "tankard"
  | "candle";

/** Sections inside the spellbook DOM overlay. */
export type BookSection =
  | "cover"
  | "whoami"
  | "skills"
  | "career"
  | "projects"
  | "runes"
  | "contact";

export type Quality = "low" | "medium" | "high";

/**
 * Scene mood by clock: "auto" resolves to day/night from the visitor's
 * local hour (day = 07:00–18:59). Night = darker inn, stronger candles;
 * day = warm sun shafts through the window instead of moonlight.
 */
export type TimeOfDay = "auto" | "day" | "night";

/**
 * Logical CSS size (px) of one book page pane. The UI lays text out in a
 * PAGE_CSS_W × PAGE_CSS_H div (position fixed at 0,0; transform-origin 0 0)
 * and the scene supplies a flat 2D `matrix(...)` transform that maps it
 * onto the 3D page on screen (the reading camera is top-down, so the page
 * projects to a rectangle — no matrix3d, which Chromium composits badly).
 * Landscape, matching the tome's page proportions (0.46 m × 0.33 m).
 */
export const PAGE_CSS_W = 640;
export const PAGE_CSS_H = 460;

/** CSS transform strings for the open book's two pages. */
export interface BookPageScreenTransforms {
  left: string;
  right: string;
}

export interface SceneSettings {
  quality: Quality;
  reducedMotion: boolean;
}

/**
 * Events emitted by the 3D layer toward the Vue overlay.
 * All callbacks are optional; SceneManager must guard each call.
 */
export interface SceneEvents {
  /** Asset/scene preparation progress, 0..1. Fire 1 exactly once. */
  onProgress?: (progress: number) => void;
  /** First frame rendered; loader can fade out. */
  onReady?: () => void;
  /** Pointer hovers an interactable (null = nothing). screen = CSS px. */
  onHover?: (
    item: ItemId | null,
    screen?: { x: number; y: number },
  ) => void;
  /** An interactable was activated (click / Enter). */
  onSelect?: (item: ItemId) => void;
  /**
   * Camera/animation for a focus transition finished.
   * For "spellbook" this fires AFTER the book-open animation completes,
   * which is the overlay's cue to crossfade the DOM book in.
   */
  onFocusSettled?: (item: ItemId | null) => void;
  /** d20 roll result (1..20), fired when the die comes to rest. */
  onDiceResult?: (value: number) => void;
  /**
   * The rolling d20 struck the table or an item (throttled by the scene).
   * strength 0..1 from the impact speed; hard = an item, not the wood.
   */
  onDiceImpact?: (strength: number, hard: boolean) => void;
  /**
   * The scene downgraded its own quality after sustained slow frames
   * (fail-down for weak GPUs). The overlay should sync its settings UI.
   */
  onAutoQuality?: (quality: Quality) => void;
  /**
   * Emitted every frame while the spellbook is focused and readable
   * (book open + camera settled enough to read), so DOM ink can stick to
   * the 3D pages; emitted once with null when leaving the reading pose.
   */
  onBookPageTransforms?: (t: BookPageScreenTransforms | null) => void;
  /**
   * A candle was snuffed (5 quick clicks) or relit (1 click while out).
   * bothOut is true when every candle on the table is snuffed.
   */
  onCandleSnuff?: (state: { snuffed: boolean; bothOut: boolean }) => void;
  /**
   * The console's fireball detonated (flash + ember burst just fired).
   * The overlay uses this to time its CSS screen shake to the impact.
   */
  onFireballImpact?: () => void;
}

/**
 * Command surface of the 3D layer, implemented by SceneManager.
 * The Vue overlay owns app state and calls these; the scene never
 * mutates app state directly.
 */
export interface ISceneManager {
  /**
   * Move the camera to an item (opening/animating it as appropriate)
   * or back to the table view when null. Idempotent.
   */
  focusItem(item: ItemId | null): void;
  /** Currently focused item, null = table overview. */
  readonly focusedItem: ItemId | null;
  /** Cycle keyboard focus through interactables. Returns highlighted item. */
  highlightNext(direction: 1 | -1): ItemId;
  /** Activate the currently highlighted item (keyboard Enter). */
  activateHighlighted(): void;
  /** Roll the d20 (also triggered by clicking it). */
  rollDice(): void;
  /**
   * Console easter egg: hurl a glowing projectile across the current view
   * that detonates (flash + embers + smoke), then fires onFireballImpact.
   * Safe to re-cast immediately; reduced motion skips straight to impact.
   */
  castFireball(): void;
  /**
   * Console spell: lightning beyond the -Z window — the sky quad flares
   * white-blue in a strobe pattern with a matching bolt light. Reduced
   * motion gets a single soft flash instead of the strobe.
   */
  castLightning(): void;
  /**
   * Console spell: a gust snuffs every burning candle (smoke, fading
   * lights, onCandleSnuff with bothOut), then a match relights the table
   * a few seconds later.
   */
  castGustOfWind(): void;
  /**
   * Console spell: the loose tableware takes a small staggered hop and
   * the d20 rolls for real. Reduced motion rolls the die only.
   */
  castAnimateObjects(): void;
  /**
   * Cosmetic 3D page turn while the tome is open (the DOM ink crossfades
   * separately). 1 = forward, -1 = back. No-op unless reading.
   */
  flipBookPage(direction: 1 | -1): void;
  setQuality(quality: Quality): void;
  setReducedMotion(reduced: boolean): void;
  /** Switch the inn's mood lighting; "auto" follows the visitor's clock. */
  setTimeOfDay(mode: TimeOfDay): void;
  /** Pause/resume the render loop (tab hidden, fallback mode). */
  setPaused(paused: boolean): void;
  dispose(): void;
}

/**
 * Contract for procedural model builders (src/three/models/*).
 * - Pivot at the object's resting contact point, Y-up, meters.
 * - The table surface plane is at world y = TABLE_SURFACE_Y; SceneManager
 *   positions items, builders always build around local origin.
 * - Interactable root groups get `group.userData.itemId = <ItemId>` and
 *   `group.userData.label = <display name>`; every descendant mesh keeps
 *   raycast enabled so picking works on the whole group.
 * - Animatable sub-parts are exposed via userData (see below) instead of
 *   scene traversal by name.
 */
export interface SpellbookParts {
  /** Rotate around Z (spine) to open: 0 closed, ~Math.PI open. */
  frontCover: THREE.Group;
  /** A few loose page meshes for the flip animation, front-to-back order. */
  flipPages: THREE.Group[];
}

export interface CandleParts {
  /** Emissive flame mesh; SceneManager attaches the flickering light here. */
  flame: THREE.Mesh;
}

export const TABLE_SURFACE_Y = 0.95;

/** Display names for nameplates/tooltips. */
export const ITEM_LABELS: Record<ItemId, { name: string; flavor: string }> = {
  spellbook: {
    name: "Tome of the Developer",
    flavor: "Every quest, spell and deed — bound in leather.",
  },
  sword: {
    name: "Blade of Experience",
    flavor: "Forged in production, tempered by code review.",
  },
  shield: {
    name: "Crest of Guilds",
    flavor: "Bearing the marks of every guild served.",
  },
  potion: {
    name: "Elixir of Caffeine",
    flavor: "Restores 120 mana. May cause 3am commits.",
  },
  scroll: {
    name: "Summoning Scroll",
    flavor: "Send a raven — or an email.",
  },
  dice: {
    name: "Die of Fate",
    flavor: "Roll for initiative.",
  },
  tankard: {
    name: "Bottomless Tankard",
    flavor: "// coffee, technically",
  },
  candle: {
    name: "Candle of Focus",
    flavor: "Burns at both ends.",
  },
};
