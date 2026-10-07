import * as THREE from "three";
import gsap from "gsap";
import {
  TABLE_SURFACE_Y,
  PAGE_CSS_W,
  PAGE_CSS_H,
  type CandleParts,
  type ISceneManager,
  type ItemId,
  type Quality,
  type SceneEvents,
  type SceneSettings,
  type SpellbookParts,
  type TimeOfDay,
} from "./types";
import {
  buildCandle,
  buildDice,
  buildPotions,
  buildRoom,
  buildRuneCircle,
  buildScroll,
  buildShield,
  buildSpellbook,
  buildSword,
  buildTable,
  buildTankard,
} from "./models";
import { CameraRig } from "./CameraRig";
import { Lights } from "./lights";
import { Particles } from "./particles";
import {
  clearTextureCache,
  makeBladeRuneTexture,
  makeCrestTexture,
  makeDotTexture,
  makeRuneCircleTexture,
} from "./models/textures";
import {
  leatherMaterial,
  parchmentMaterial,
  plasterMaterial,
  scrollEndMaterial,
  stoneMaterial,
  waxMaterial,
  woodDarkMaterial,
  woodLightMaterial,
  woodStaveMaterial,
} from "./models/materials";
import { DicePhysics } from "./dicePhysics";
import { Interaction, type InteractionEvents } from "./interaction";

const PIXEL_RATIO_CAP: Record<Quality, number> = {
  low: 1,
  medium: 1.5,
  high: 2,
};

const FOG_COLOR = 0x120c08;
const RUNE_IDLE = 0.35;
const RUNE_HOVER = 0.6;

// --- Day/night mood (night = the hand-tuned baseline) ----------------------
const FOG_DENSITY_NIGHT = 0.055;
const FOG_DENSITY_DAY = 0.045;
// The room model's -Z window sky quad, found at runtime by its mesh name.
const WINDOW_SKY_NAME = "windowSky";
const WINDOW_EMISSIVE_NIGHT = 0x24406b;
const WINDOW_SKY_NIGHT = new THREE.Color(0x06101f);
const WINDOW_SKY_DAY = new THREE.Color(0x8fb4d9);
const WINDOW_GLOW_NIGHT = new THREE.Color(WINDOW_EMISSIVE_NIGHT);
const WINDOW_GLOW_DAY = new THREE.Color(0xa8cce8);
const WINDOW_GLOW_INTENSITY_NIGHT = 0.8;
const WINDOW_GLOW_INTENSITY_DAY = 1.5;
const MOOD_TWEEN_DURATION = 1.2;

// --- Idle-life moth ---------------------------------------------------------
const MOTH_TRAVEL_DURATION = 3;

// --- Candle snuff easter egg -------------------------------------------------
/** 5 clicks on the same candle within a rolling 4 s window snuff it. */
const SNUFF_CLICKS = 5;
const SNUFF_WINDOW_MS = 4000;

// --- Console spell effects ---------------------------------------------------
/** Gust of Wind: the match strikes back this long after the candles die. */
const GUST_RELIGHT_MS = 4500;
/** Call Lightning: the window sky flashes toward this white-blue. */
const LIGHTNING_SKY = new THREE.Color(0xeaf4ff);

// --- Fireball (console easter egg) -------------------------------------------
const FIREBALL_FLIGHT_DURATION = 0.8;
/** Trail embers spawn every time the flight advances this far (t units). */
const FIREBALL_TRAIL_STEP = 0.06;
/** How far ahead of the camera the bead detonates (before clamping). */
const FIREBALL_THROW_DISTANCE = 1.7;
const FIREBALL_LIGHT_INTENSITY = 3;

// --- Auto quality fail-down --------------------------------------------------
const FRAME_WINDOW = 90;
/** Rolling window average above this (< 25 fps) triggers a downgrade. */
const SLOW_FRAME_AVG = 0.04;
const MAX_AUTO_DOWNGRADES = 2;
/** Skip measuring right after ready — shader warmup skews deltas. */
const WARMUP_SECONDS = 3;

/**
 * gsap's stock lag smoothing (gsap.ticker has no getter, so the documented
 * defaults are restored). Ref-counted so an HMR remount that briefly
 * overlaps two managers can't restore it under a live one.
 */
const GSAP_LAG_THRESHOLD = 500;
const GSAP_ADJUSTED_LAG = 33;
let lagSmoothingOwners = 0;

/** Loader progress at the end of each start-up stage (first frame = 1). */
const PROGRESS = {
  start: 0.04,
  textures: 0.5,
  models: 0.8,
  shaders: 0.95,
} as const;
const COMPILE_TIMEOUT_MS = 5000;
/** Upper bound on a start-up yield when rAF is throttled (hidden tab). */
const YIELD_FALLBACK_MS = 50;

/**
 * Canvas textures painted up front, one per task, so start-up never blocks
 * the main thread in one long go (the builders then hit the caches).
 */
const TEXTURE_WARMUPS: (() => unknown)[] = [
  woodDarkMaterial,
  woodLightMaterial,
  woodStaveMaterial,
  leatherMaterial,
  () => parchmentMaterial(false),
  () => parchmentMaterial(true),
  plasterMaterial,
  stoneMaterial,
  waxMaterial,
  scrollEndMaterial,
  makeCrestTexture,
  makeBladeRuneTexture,
  makeRuneCircleTexture,
  makeDotTexture,
];

/**
 * Give the browser a turn between start-up chunks: wait for the next frame
 * and then a task, so the loader ring actually repaints (scheduler.yield()
 * continuations outrank rendering and timers, so they don't). Hidden tabs
 * never fire rAF — the timeout keeps start-up going there.
 */
function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      clearTimeout(fallback);
      resolve();
    };
    const fallback = setTimeout(finish, YIELD_FALLBACK_MS);
    requestAnimationFrame(() => setTimeout(finish, 0));
  });
}

interface Placement {
  x: number;
  z: number;
  rotY: number;
}

/** Reusable fireball projectile (emissive core + layered glow sprites). */
interface FireballRig {
  group: THREE.Group;
  /**
   * Traveling warm light. Lives outside the (hidden-when-idle) group and
   * sits at intensity 0 between casts, so the light count is constant.
   */
  light: THREE.PointLight;
  /** Sprite materials — not reached by the dispose() mesh traverse. */
  spriteMaterials: THREE.SpriteMaterial[];
}

/** Tabletop still-life layout (world coords, items rest at TABLE_SURFACE_Y). */
const LAYOUT: Record<ItemId, Placement> & { candleB: Placement } = {
  // The book sits just right of center so its cover can swing open leftward
  // (reaching x ≈ −0.55) without landing on the shield. Everything else is
  // spread so neither table half feels crowded: sword + tankard right-back,
  // shield + potions left, scroll front-left, d20 front-center.
  spellbook: { x: 0.2, z: -0.05, rotY: 0.04 },
  sword: { x: 0.68, z: -0.3, rotY: THREE.MathUtils.degToRad(-25) },
  shield: { x: -0.82, z: 0.15, rotY: 0.4 },
  potion: { x: -0.45, z: -0.5, rotY: 0.2 },
  scroll: { x: -0.35, z: 0.32, rotY: 0.5 },
  dice: { x: 0.05, z: 0.3, rotY: 0.6 },
  tankard: { x: 0.45, z: -0.55, rotY: -0.5 },
  candle: { x: -0.95, z: -0.4, rotY: 0 },
  candleB: { x: 0.95, z: -0.45, rotY: 0 },
};

/** Candle flame tips the moth orbits (flame sits ~0.21 above the table). */
const MOTH_ANCHORS: [THREE.Vector3, THREE.Vector3] = [
  new THREE.Vector3(LAYOUT.candle.x, TABLE_SURFACE_Y + 0.21, LAYOUT.candle.z),
  new THREE.Vector3(LAYOUT.candleB.x, TABLE_SURFACE_Y + 0.21, LAYOUT.candleB.z),
];

export class SceneManager implements ISceneManager {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly clock = new THREE.Clock();
  private readonly rig: CameraRig;
  private readonly lights: Lights;
  private readonly particles: Particles;
  /** Created once the stage exists (it snapshots the pickable roots). */
  private interaction: Interaction | null = null;
  private readonly resizeObserver: ResizeObserver;

  private readonly settings: SceneSettings;
  private readonly events: SceneEvents;
  private readonly itemGroups = new Map<ItemId, THREE.Group>();
  /** All pickable roots, including the second candle instance. */
  private readonly interactableRoots: THREE.Group[] = [];
  private runeCircle: THREE.Group | null = null;
  private spellbookParts: SpellbookParts | null = null;

  private _focused: ItemId | null = null;
  /** Which of the two candle roots the current candle focus is anchored to. */
  private focusedCandleRoot: THREE.Group | null = null;
  private focusToken = 0;
  private transitioning = false;
  private transitionTarget: ItemId | null = null;
  private bookOpen = false;
  private bookTl: gsap.core.Timeline | null = null;
  private readonly runeProxy = { v: RUNE_IDLE };
  /** The spellbook's contact-shadow quad + its closed-book footprint. */
  private bookShadow: {
    mesh: THREE.Mesh;
    scaleX: number;
    x: number;
    z: number;
    shift: number;
    cos: number;
    sin: number;
  } | null = null;
  /** 0 = closed book, 1 = fully open spread (drives the contact shadow). */
  private readonly bookOpenProxy = { v: 0 };

  /** Reading pages of the open tome (DOM ink is projected onto these). */
  private readingPages: { left: THREE.Mesh; right: THREE.Mesh } | null = null;
  private reading = false;
  private pageFlipTween: gsap.core.Tween | null = null;
  /** Half-extents of the reading page planes (see spellbook.ts PAGE_W/PAGE_D). */
  private readonly cornerLocal = [
    new THREE.Vector3(-0.23, 0, -0.165), // top-left (away from reader)
    new THREE.Vector3(0.23, 0, -0.165), // top-right
    new THREE.Vector3(-0.23, 0, 0.165), // bottom-left
    new THREE.Vector3(0.23, 0, 0.165), // bottom-right
  ];
  private readonly cornerScratch = new THREE.Vector3();
  /** Preallocated screen-space corners (tl, tr, bl, br) for projectPage. */
  private readonly cornerScreen = Array.from({ length: 4 }, () => ({
    x: 0,
    y: 0,
  }));
  /**
   * Camera matrixWorld + projectionMatrix, left/right page matrixWorld
   * (16 each) and canvas width/height as of the last projection.
   */
  private readonly pageInputCache = new Float64Array(16 * 4 + 2);
  private pageInputValid = false;
  /** Last emitted matrices — identical frames are skipped so the DOM ink
   *  layer stays untouched (and rock-solid) once the camera settles. */
  private lastPageTransforms: { left: string; right: string } | null = null;

  private diceRolling = false;
  private dicePhysics: DicePhysics | null = null;

  /** Reusable fireball projectile, built with the stage. */
  private fireball: FireballRig | null = null;
  private fireballTween: gsap.core.Tween | null = null;

  /** Per-candle-instance snuff state (two roots share the "candle" itemId). */
  private readonly candleStates = new Map<
    THREE.Group,
    { clicks: number[]; snuffed: boolean }
  >();
  /** The actual group instance behind the most recent select. */
  private lastPickedRoot: THREE.Group | null = null;

  /** 0 = night, 1 = day; tweened by setTimeOfDay. */
  private readonly moodProxy = { v: 0 };
  private windowSky: THREE.MeshStandardMaterial | null = null;

  /** Call Lightning: strobe drive (0..1) + the bolt light by the window. */
  private readonly lightningProxy = { v: 0 };
  private readonly lightningLight: THREE.PointLight;
  /** Gust of Wind: pending "a match relights the table" beat. */
  private gustRelightTimer: ReturnType<typeof setTimeout> | null = null;

  private moth: THREE.Group | null = null;
  private mothWingL: THREE.Mesh | null = null;
  private mothWingR: THREE.Mesh | null = null;
  private readonly mothAnchor = MOTH_ANCHORS[0].clone();
  private readonly mothFrom = new THREE.Vector3();
  private readonly mothTo = new THREE.Vector3();
  private mothHome: 0 | 1 = 0;
  private mothTravelStart = -1;
  private nextMothTravelAt = 20 + Math.random() * 20;

  private nextEmberPopAt = 30 + Math.random() * 30;

  private autoQualityDowngrades = 0;
  private frameWindowCount = 0;
  private frameWindowTime = 0;
  private warmupUntil = Number.POSITIVE_INFINITY;

  /** Frames left that must re-render the shadow map (see markShadowsDirty). */
  private shadowDirtyFrames = 0;
  /** performance.now() until which casters may be moving (item hops). */
  private shadowBusyUntil = 0;

  private rafId: number | null = null;
  private resizeRaf: number | null = null;
  private userPaused = false;
  private disposed = false;
  private readyFired = false;
  /** Stage built and every program compiled; the render loop may run. */
  private stageReady = false;

  constructor(
    canvas: HTMLCanvasElement,
    events: SceneEvents,
    settings: SceneSettings,
  ) {
    this.events = events;
    this.settings = { ...settings };
    // Time-accurate animations even on weak GPUs: without this, gsap's lag
    // smoothing stretches every tween into slow motion at low frame rates.
    gsap.ticker.lagSmoothing(0);
    lagSmoothingOwners++;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = settings.quality !== "low";
    // r185 deprecates PCFSoftShadowMap and swaps it for PCFShadowMap on the
    // first shadow render — a type change that flags every material for
    // recompile right after the warm-up. Ask for PCF directly.
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // The one shadow caster (the key spot) is static, so the shadow map only
    // needs re-rendering when a caster moves or shadow settings change:
    // see markShadowsDirty() and shadowsAnimating().
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, PIXEL_RATIO_CAP[settings.quality]),
    );

    this.scene.background = new THREE.Color(FOG_COLOR);
    this.scene.fog = new THREE.FogExp2(FOG_COLOR, 0.055);

    this.rig = new CameraRig(1, settings.reducedMotion);
    this.lights = new Lights(settings.quality);
    this.lights.setReducedMotion(settings.reducedMotion);
    this.scene.add(this.lights.group);
    this.particles = new Particles(settings.quality);
    this.scene.add(this.particles.group);

    // Cool bolt light just inside the -Z window; dormant (intensity 0, but
    // visible so the light count is stable) between casts.
    this.lightningLight = new THREE.PointLight(0xbfd8ff, 0, 10, 1.8);
    this.lightningLight.position.set(0.4, 2.2, -2.6);
    this.scene.add(this.lightningLight);

    // Default mood: "auto", applied instantly so first paint is correct.
    this.moodProxy.v = this.resolveTimeOfDay("auto") === "day" ? 1 : 0;
    this.applyMood();

    // Single resize source, coalesced to one rAF (mobile URL-bar show/hide
    // and window drags fire bursts).
    this.resizeObserver = new ResizeObserver(this.scheduleResize);
    this.resizeObserver.observe(canvas);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.handleResize();
    this.events.onProgress?.(PROGRESS.start);
    void this.init(canvas);
    // Dev-only escape hatch for debugging camera/scene state in the console.
    if (import.meta.env.DEV) {
      (window as unknown as { __scene?: SceneManager }).__scene = this;
    }
  }

  get focusedItem(): ItemId | null {
    return this._focused;
  }

  focusItem(item: ItemId | null): void {
    // Two candles share one itemId: anchor the pose to the instance that
    // was actually picked (keyboard activation picks the primary one).
    let candleRoot: THREE.Group | null = null;
    if (item === "candle") {
      candleRoot =
        this.lastPickedRoot?.userData.itemId === "candle"
          ? this.lastPickedRoot
          : (this.itemGroups.get("candle") ?? null);
    }
    const sameTarget = (current: ItemId | null): boolean =>
      item === current &&
      (item !== "candle" || candleRoot === this.focusedCandleRoot);

    if (this.transitioning) {
      if (sameTarget(this.transitionTarget)) return;
    } else if (sameTarget(this._focused)) {
      return;
    }

    const token = ++this.focusToken;
    this.transitioning = true;
    this.transitionTarget = item;
    this._focused = item;
    this.focusedCandleRoot = candleRoot;
    // While focused, hover stops but the focused item stays clickable
    // (candle snuffing counts clicks even in the close-up).
    this.interaction?.setFocus(item);
    this.particles.setBookActive(item === "spellbook");

    if (candleRoot) this.registerAnchor("candle", candleRoot);

    const waits: Promise<void>[] = [this.rig.focusTo(item)];
    if (item === "spellbook") {
      waits.push(this.playBookOpen());
    } else if (this.bookOpen) {
      waits.push(this.playBookClose());
    }

    void Promise.all(waits).then(() => {
      if (token !== this.focusToken || this.disposed) return;
      this.transitioning = false;
      this.events.onFocusSettled?.(item);
    });
  }

  highlightNext(direction: 1 | -1): ItemId {
    return this.interaction?.highlightNext(direction) ?? "spellbook";
  }

  activateHighlighted(): void {
    this.interaction?.activateHighlighted();
  }

  rollDice(): void {
    if (this.diceRolling || !this.dicePhysics) return;
    this.diceRolling = true;
    this.dicePhysics.roll(this.settings.reducedMotion);
  }

  castFireball(): void {
    if (this.disposed || !this.stageReady) return;
    const camera = this.rig.camera;
    camera.updateMatrixWorld();
    const dir = camera.getWorldDirection(new THREE.Vector3());
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);

    // Detonate ahead along the current view ray so the flight always crosses
    // the frame, whatever pose the camera is in — clamped above the tabletop
    // (close-up poses look steeply down) and inside the room walls.
    const impact = camera.position
      .clone()
      .addScaledVector(dir, FIREBALL_THROW_DISTANCE);
    impact.y = Math.max(impact.y, TABLE_SURFACE_Y + 0.18);
    impact.x = THREE.MathUtils.clamp(impact.x, -2.6, 2.6);
    impact.z = THREE.MathUtils.clamp(impact.z, -2.6, 2.6);

    this.killFireball();

    if (this.settings.reducedMotion) {
      // No projectile flight — straight to the impact beat.
      this.detonateFireball(impact);
      return;
    }

    // Spawn in the camera's lower-left foreground, hurled from "the hand".
    const spawn = camera.position
      .clone()
      .addScaledVector(dir, 0.4)
      .addScaledVector(right, -0.28)
      .addScaledVector(up, -0.2);
    // Arc scales with the throw so close-up casts don't loop overhead.
    const arc = Math.min(spawn.distanceTo(impact) * 0.22, 0.4);

    const fb = this.ensureFireball();
    fb.group.position.copy(spawn);
    fb.group.visible = true;
    fb.light.position.copy(spawn);
    fb.light.intensity = FIREBALL_LIGHT_INTENSITY;
    const state = { t: 0, lastTrail: 0 };
    this.fireballTween = gsap.to(state, {
      t: 1,
      duration: FIREBALL_FLIGHT_DURATION,
      ease: "power2.in",
      onUpdate: () => {
        fb.group.position.lerpVectors(spawn, impact, state.t);
        fb.group.position.y += Math.sin(Math.PI * state.t) * arc;
        fb.light.position.copy(fb.group.position);
        // t drives position linearly, so fixed t steps = even trail spacing.
        while (state.t - state.lastTrail >= FIREBALL_TRAIL_STEP) {
          state.lastTrail += FIREBALL_TRAIL_STEP;
          this.particles.emitEmberAt(fb.group.position);
        }
      },
      onComplete: () => {
        this.fireballTween = null;
        fb.group.visible = false;
        fb.light.intensity = 0;
        this.detonateFireball(impact);
      },
      onInterrupt: () => {
        fb.group.visible = false;
        fb.light.intensity = 0;
      },
    });
  }

  castLightning(): void {
    if (this.disposed) return;
    gsap.killTweensOf(this.lightningProxy);
    const tl = gsap.timeline({
      onUpdate: this.applyLightning,
      onComplete: () => {
        this.lightningProxy.v = 0;
        this.applyLightning();
      },
    });
    if (this.settings.reducedMotion) {
      // One soft flash — no strobing for motion/photosensitive visitors.
      tl.to(this.lightningProxy, { v: 0.55, duration: 0.12, ease: "power2.out" })
        .to(this.lightningProxy, { v: 0, duration: 0.6, ease: "power2.out" });
      return;
    }
    // Classic double-strike strobe: hit, dim, re-strike, fade.
    tl.to(this.lightningProxy, { v: 1, duration: 0.06, ease: "power3.out" })
      .to(this.lightningProxy, { v: 0.12, duration: 0.09 })
      .to(this.lightningProxy, { v: 0.85, duration: 0.05 })
      .to(this.lightningProxy, { v: 0, duration: 0.5, ease: "power2.out" }, "+=0.05");
  }

  castGustOfWind(): void {
    if (this.disposed) return;
    let snuffedAny = false;
    for (const [root, state] of this.candleStates) {
      if (state.snuffed) continue;
      const flame = (root.userData.parts as CandleParts | undefined)?.flame;
      if (!flame) continue;
      state.snuffed = true;
      state.clicks.length = 0;
      flame.visible = false;
      this.lights.setCandleLit(flame, false);
      this.markShadowsDirty();
      this.particles.puffSmoke(flame.getWorldPosition(new THREE.Vector3()));
      snuffedAny = true;
    }
    if (!snuffedAny) return;
    this.events.onCandleSnuff?.({ snuffed: true, bothOut: true });

    // A match flares once the darkness has had its moment — relights every
    // snuffed candle (including ones the visitor clicked out earlier).
    if (this.gustRelightTimer) clearTimeout(this.gustRelightTimer);
    this.gustRelightTimer = setTimeout(() => {
      this.gustRelightTimer = null;
      if (this.disposed) return;
      let relit = false;
      for (const [root, state] of this.candleStates) {
        if (!state.snuffed) continue;
        const flame = (root.userData.parts as CandleParts | undefined)?.flame;
        if (!flame) continue;
        state.snuffed = false;
        flame.visible = true;
        this.lights.setCandleLit(flame, true);
        this.markShadowsDirty();
        relit = true;
      }
      if (relit) this.events.onCandleSnuff?.({ snuffed: false, bothOut: false });
    }, GUST_RELIGHT_MS);
  }

  castAnimateObjects(): void {
    if (this.disposed) return;
    // The d20 does its own, physically real jump.
    this.rollDice();
    if (this.settings.reducedMotion) return;
    const hoppers: ItemId[] = ["sword", "tankard", "potion", "scroll", "shield"];
    // Last hop starts at 4 × 0.09 s and runs 0.5 s; keep shadows live a bit past.
    this.markShadowsDirty(2, (hoppers.length * 0.09 + 0.6) * 1000);
    hoppers.forEach((id, i) => {
      const group = this.itemGroups.get(id);
      if (!group) return;
      gsap.killTweensOf(group.position);
      gsap.killTweensOf(group.rotation);
      // Always land back exactly on the layout pose so repeated casts
      // never let items drift or sink.
      const baseRot = LAYOUT[id].rotY;
      gsap
        .timeline({ delay: i * 0.09 })
        .to(group.position, {
          y: TABLE_SURFACE_Y + 0.05 + Math.random() * 0.03,
          duration: 0.18,
          ease: "power2.out",
        })
        .to(group.position, {
          y: TABLE_SURFACE_Y,
          duration: 0.32,
          ease: "bounce.out",
        })
        .fromTo(
          group.rotation,
          { y: group.rotation.y },
          {
            y: baseRot + (Math.random() - 0.5) * 0.1,
            duration: 0.4,
            ease: "power1.out",
          },
          0,
        );
    });
  }

  setQuality(quality: Quality): void {
    this.settings.quality = quality;
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, PIXEL_RATIO_CAP[quality]),
    );
    const shadows = quality !== "low";
    if (this.renderer.shadowMap.enabled !== shadows) {
      this.renderer.shadowMap.enabled = shadows;
      // Shadow toggle requires material recompile.
      this.scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        for (const material of materials) material.needsUpdate = true;
      });
    }
    this.lights.setQuality(quality);
    this.particles.setQuality(quality);
    this.updateMothVisibility();
    this.markShadowsDirty();
  }

  setReducedMotion(reduced: boolean): void {
    this.settings.reducedMotion = reduced;
    this.rig.setReducedMotion(reduced);
    this.lights.setReducedMotion(reduced);
    this.updateMothVisibility();
  }

  setTimeOfDay(mode: TimeOfDay): void {
    const target = this.resolveTimeOfDay(mode) === "day" ? 1 : 0;
    gsap.killTweensOf(this.moodProxy);
    this.markShadowsDirty(
      2,
      this.settings.reducedMotion ? 0 : MOOD_TWEEN_DURATION * 1000,
    );
    if (this.settings.reducedMotion) {
      this.moodProxy.v = target;
      this.applyMood();
      return;
    }
    gsap.to(this.moodProxy, {
      v: target,
      duration: MOOD_TWEEN_DURATION,
      ease: "sine.inOut",
      onUpdate: this.applyMood,
    });
  }

  setPaused(paused: boolean): void {
    this.userPaused = paused;
    this.updateRunning();
  }

  /**
   * Re-render the shadow map on the next frames (shadowMap.autoUpdate is
   * off). Call when a shadow caster moves/appears or shadow-relevant
   * settings change; camera moves never need it. Two frames by default so
   * the final resting pose of a just-finished animation is captured too.
   * busyMs keeps it dirty for a span (fire-and-forget gsap animations).
   */
  markShadowsDirty(frames = 2, busyMs = 0): void {
    this.shadowDirtyFrames = Math.max(this.shadowDirtyFrames, frames);
    if (busyMs > 0) {
      this.shadowBusyUntil = Math.max(
        this.shadowBusyUntil,
        performance.now() + busyMs,
      );
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.setReading(false);
    this.updateRunning();

    this.resizeObserver.disconnect();
    if (this.resizeRaf !== null) cancelAnimationFrame(this.resizeRaf);
    this.resizeRaf = null;
    document.removeEventListener("visibilitychange", this.onVisibilityChange);

    this.bookTl?.kill();
    this.pageFlipTween?.kill();
    this.killFireball();
    if (this.fireball) {
      // The scene traverse below only reaches mesh materials; the glow
      // sprites and their shared texture must be released by hand.
      // Its dot texture is the cached one, released with the cache below.
      for (const material of this.fireball.spriteMaterials) material.dispose();
      this.fireball = null;
    }
    this.dicePhysics?.dispose();
    gsap.killTweensOf(this.runeProxy);
    gsap.killTweensOf(this.bookOpenProxy);
    gsap.killTweensOf(this.moodProxy);
    gsap.killTweensOf(this.lightningProxy);
    if (this.gustRelightTimer) {
      clearTimeout(this.gustRelightTimer);
      this.gustRelightTimer = null;
    }
    // Animate Objects hop tweens (position/rotation of item groups).
    for (const group of this.itemGroups.values()) {
      gsap.killTweensOf(group.position);
      gsap.killTweensOf(group.rotation);
    }
    this.interaction?.dispose();
    this.rig.dispose();
    this.lights.dispose();
    this.particles.dispose();

    // Textures are shared across materials (and cached in textures.ts):
    // collect them and release each exactly once after every material.
    const textures = new Set<THREE.Texture>();
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const material of materials) this.disposeMaterial(material, textures);
    });
    for (const texture of textures) texture.dispose();
    clearTextureCache();
    this.scene.clear();
    this.renderer.dispose();

    if (--lagSmoothingOwners === 0) {
      gsap.ticker.lagSmoothing(GSAP_LAG_THRESHOLD, GSAP_ADJUSTED_LAG);
    }
  }

  // ----------------------------------------------------------------- private

  /**
   * Staged, yielding start-up so the loader ring keeps animating and reports
   * real progress: paint the canvas textures, build the models, compile
   * every shader program, then start the loop (ready fires after the first
   * rendered frame). Bails out quietly if disposed mid-way.
   */
  private async init(canvas: HTMLCanvasElement): Promise<void> {
    const report = (value: number): void => {
      if (!this.disposed) this.events.onProgress?.(value);
    };

    for (let i = 0; i < TEXTURE_WARMUPS.length; i++) {
      await yieldToBrowser();
      if (this.disposed) return;
      TEXTURE_WARMUPS[i]!();
      report(
        THREE.MathUtils.lerp(
          PROGRESS.start,
          PROGRESS.textures,
          (i + 1) / TEXTURE_WARMUPS.length,
        ),
      );
    }

    const built = await this.buildStage((fraction) =>
      report(THREE.MathUtils.lerp(PROGRESS.textures, PROGRESS.models, fraction)),
    );
    if (!built || this.disposed) return;
    this.buildMoth();
    this.ensureFireball();
    this.applyRune();
    this.applyMood();
    this.interaction = new Interaction(
      canvas,
      this.rig.camera,
      this.interactableRoots,
      this.interactionEvents,
    );
    // Re-fit the camera now that the layout bounds and anchors exist.
    this.handleResize();
    this.markShadowsDirty();
    report(PROGRESS.models);

    // Compile every program (all lights present and visible) before the
    // first frame, so nothing compiles mid-interaction. Capped so a driver
    // that never reports ready can't hold the loader forever.
    await yieldToBrowser();
    if (this.disposed) return;
    this.rig.camera.updateMatrixWorld();
    await Promise.race([
      this.renderer.compileAsync(this.scene, this.rig.camera),
      new Promise((resolve) => setTimeout(resolve, COMPILE_TIMEOUT_MS)),
    ]);
    if (this.disposed) return;
    report(PROGRESS.shaders);

    this.stageReady = true;
    this.updateRunning();
  }

  private async buildStage(
    onProgress: (fraction: number) => void,
  ): Promise<boolean> {
    const room = buildRoom();
    this.scene.add(room);

    // Day mode repaints the window's sky quad, which room.ts names.
    const sky = room.getObjectByName(WINDOW_SKY_NAME) as THREE.Mesh | undefined;
    if (sky && !Array.isArray(sky.material)) {
      this.windowSky = sky.material as THREE.MeshStandardMaterial;
    }

    const table = buildTable();
    table.position.set(0, 0, -0.15);
    this.scene.add(table);

    this.runeCircle = buildRuneCircle();
    // Slight lift avoids z-fighting with the tabletop.
    this.runeCircle.position.set(
      LAYOUT.spellbook.x,
      TABLE_SURFACE_Y + 0.002,
      LAYOUT.spellbook.z,
    );
    this.scene.add(this.runeCircle);

    const builders: Record<ItemId, () => THREE.Group> = {
      spellbook: buildSpellbook,
      sword: buildSword,
      shield: buildShield,
      potion: buildPotions,
      scroll: buildScroll,
      dice: buildDice,
      tankard: buildTankard,
      candle: buildCandle,
    };

    const entries = Object.entries(builders) as [ItemId, () => THREE.Group][];
    let step = 0;
    for (const [id, build] of entries) {
      await yieldToBrowser();
      if (this.disposed) return false;
      onProgress(++step / (entries.length + 1));
      const group = build();
      // Interactables must own their materials: the hover emissive boost
      // would otherwise light up every mesh sharing a cached material
      // (hovering the scroll used to make parts of the table glow).
      this.makeMaterialsUnique(group);
      this.placeOnTable(group, LAYOUT[id]);
      this.itemGroups.set(id, group);
      this.interactableRoots.push(group);
      this.registerAnchor(id, group);
    }

    // Second candle instance shares the "candle" itemId via its own userData.
    const candleB = buildCandle();
    this.makeMaterialsUnique(candleB);
    this.placeOnTable(candleB, LAYOUT.candleB);
    this.interactableRoots.push(candleB);

    // The overview pose is fitted to this: every item + both candles.
    const layoutBox = new THREE.Box3();
    for (const root of this.interactableRoots) {
      root.updateWorldMatrix(true, true);
      root.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.isMesh && mesh.visible) layoutBox.expandByObject(mesh);
      });
    }
    this.rig.setTableBounds(layoutBox);

    const spellbook = this.itemGroups.get("spellbook");
    this.spellbookParts =
      (spellbook?.userData.parts as SpellbookParts | undefined) ?? null;
    this.readingPages =
      (
        spellbook?.userData.parts as
          | { readingPages?: { left: THREE.Mesh; right: THREE.Mesh } }
          | undefined
      )?.readingPages ?? null;

    for (const candle of [this.itemGroups.get("candle"), candleB]) {
      const parts = candle?.userData.parts as CandleParts | undefined;
      if (!candle || !parts?.flame) continue;
      this.lights.attachCandle(parts.flame);
      this.candleStates.set(candle, { clicks: [], snuffed: false });
    }

    const dice = this.itemGroups.get("dice");
    if (dice) {
      this.dicePhysics = new DicePhysics(dice, TABLE_SURFACE_Y, (value) => {
        this.diceRolling = false;
        if (!this.disposed) this.events.onDiceResult?.(value);
      });
    }

    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) {
        // Models flag non-solid / shell meshes with userData.noShadow
        // (flames, rune decals, glass, room walls): they receive only.
        mesh.castShadow = !mesh.userData.noShadow;
        mesh.receiveShadow = true;
      }
    });

    // After the shadow traverse, so the quads never cast/receive real shadows.
    this.addContactShadows(table, candleB);
    onProgress(1);
    return true;
  }

  private placeOnTable(group: THREE.Group, placement: Placement): void {
    group.position.set(placement.x, TABLE_SURFACE_Y, placement.z);
    group.rotation.y = placement.rotY;
    this.scene.add(group);
  }

  /**
   * Subtle contact shadows: soft radial-gradient quads under each table
   * item and one under the table itself — grounding the single 1024
   * shadow map can't provide at grazing candle angles. The d20 is skipped
   * (it rolls away from any static blob). dispose()'s scene traverse
   * releases the geometry, materials and texture with everything else.
   */
  private addContactShadows(table: THREE.Group, candleB: THREE.Group): void {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    gradient.addColorStop(0, "rgba(0, 0, 0, 0.85)");
    gradient.addColorStop(0.45, "rgba(0, 0, 0, 0.38)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);

    const geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const drop = (
      root: THREE.Object3D,
      y: number,
      opacity: number,
    ): THREE.Mesh | null => {
      const box = new THREE.Box3();
      root.updateWorldMatrix(true, true);
      root.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.isMesh && mesh.visible) box.expandByObject(mesh);
      });
      if (box.isEmpty()) return null;
      const center = box.getCenter(new THREE.Vector3());
      const extent = box.getSize(new THREE.Vector3());
      const shadow = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity,
          depthWrite: false,
        }),
      );
      shadow.scale.set(extent.x * 1.5, 1, extent.z * 1.5);
      shadow.position.set(center.x, y, center.z);
      // Below the rune circle's +0.002 lift and drawn before it.
      shadow.renderOrder = -1;
      this.scene.add(shadow);
      return shadow;
    };

    for (const [id, group] of this.itemGroups) {
      if (id === "dice") continue;
      const shadow = drop(group, TABLE_SURFACE_Y + 0.0012, 0.3);
      if (id === "spellbook" && shadow) {
        // Measured from the closed book; applyBookShadow() widens it toward
        // the opened spread (the cover swings out over the -X side).
        this.bookShadow = {
          mesh: shadow,
          scaleX: shadow.scale.x,
          x: shadow.position.x,
          z: shadow.position.z,
          // Spine sits on the closed book's -X edge: opening shifts the
          // footprint centre half a book-width toward -X (group-local).
          shift: (shadow.scale.x / 1.5) * 0.5,
          cos: Math.cos(group.rotation.y),
          sin: Math.sin(group.rotation.y),
        };
      }
    }
    drop(candleB, TABLE_SURFACE_Y + 0.0012, 0.3);
    drop(table, 0.0015, 0.2);
  }

  /**
   * Clone every material under an interactable root so hover highlights
   * can't leak onto other models sharing the materials.ts cache. Meshes
   * within the root that shared a material keep sharing one clone.
   * dispose() traverses the scene, so the clones are cleaned up with it.
   */
  private makeMaterialsUnique(root: THREE.Group): void {
    const clones = new Map<THREE.Material, THREE.Material>();
    const cloneOf = (material: THREE.Material): THREE.Material => {
      let clone = clones.get(material);
      if (!clone) {
        clone = material.clone();
        clones.set(material, clone);
      }
      return clone;
    };
    root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(cloneOf)
        : cloneOf(mesh.material);
    });
  }

  private registerAnchor(id: ItemId, group: THREE.Group): void {
    // Anchor at the item's footprint center so focus poses frame the
    // whole model regardless of where the builder put the pivot.
    // Skip invisible meshes — the spellbook's hidden reading pages would
    // otherwise drag the anchor toward where the cover will open.
    const box = new THREE.Box3();
    group.updateWorldMatrix(true, true);
    group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh && mesh.visible) box.expandByObject(mesh);
    });
    const center = box.getCenter(new THREE.Vector3());
    this.rig.registerAnchor(
      id,
      new THREE.Vector3(center.x, TABLE_SURFACE_Y, center.z),
      (box.max.x - box.min.x) / 2,
    );
  }

  private resolveTimeOfDay(mode: TimeOfDay): "day" | "night" {
    if (mode !== "auto") return mode;
    const hour = new Date().getHours();
    return hour >= 7 && hour < 19 ? "day" : "night";
  }

  private readonly applyMood = (): void => {
    const f = this.moodProxy.v;
    this.lights.setDayFactor(f);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = THREE.MathUtils.lerp(
        FOG_DENSITY_NIGHT,
        FOG_DENSITY_DAY,
        f,
      );
    }
    if (this.windowSky) {
      this.windowSky.color.lerpColors(WINDOW_SKY_NIGHT, WINDOW_SKY_DAY, f);
      this.windowSky.emissive.lerpColors(WINDOW_GLOW_NIGHT, WINDOW_GLOW_DAY, f);
      this.windowSky.emissiveIntensity = THREE.MathUtils.lerp(
        WINDOW_GLOW_INTENSITY_NIGHT,
        WINDOW_GLOW_INTENSITY_DAY,
        f,
      );
    }
  };

  private buildMoth(): void {
    // Built after buildStage's shadow traverse so the moth casts nothing.
    const moth = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
      color: 0xcfc4a6,
      emissive: 0x5c5340,
      emissiveIntensity: 0.7,
      side: THREE.DoubleSide,
      roughness: 1,
    });
    // Wing quads hinged at the body (geometry offset along +/-X).
    const wingL = new THREE.Mesh(
      new THREE.PlaneGeometry(0.03, 0.018).translate(-0.017, 0, 0),
      material,
    );
    const wingR = new THREE.Mesh(
      new THREE.PlaneGeometry(0.03, 0.018).translate(0.017, 0, 0),
      material,
    );
    moth.add(wingL, wingR);
    moth.position.copy(this.mothAnchor);
    this.scene.add(moth);
    this.moth = moth;
    this.mothWingL = wingL;
    this.mothWingR = wingR;
    this.updateMothVisibility();
  }

  private updateMothVisibility(): void {
    if (!this.moth) return;
    this.moth.visible =
      this.settings.quality !== "low" && !this.settings.reducedMotion;
  }

  private updateMoth(elapsed: number): void {
    const moth = this.moth;
    if (!moth || !moth.visible) return;

    if (this.mothTravelStart < 0 && elapsed >= this.nextMothTravelAt) {
      this.mothTravelStart = elapsed;
      this.mothFrom.copy(MOTH_ANCHORS[this.mothHome]);
      this.mothHome = this.mothHome === 0 ? 1 : 0;
      this.mothTo.copy(MOTH_ANCHORS[this.mothHome]);
      this.nextMothTravelAt =
        elapsed + MOTH_TRAVEL_DURATION + 20 + Math.random() * 20;
    }
    if (this.mothTravelStart >= 0) {
      const t = Math.min(
        (elapsed - this.mothTravelStart) / MOTH_TRAVEL_DURATION,
        1,
      );
      if (t >= 1) this.mothTravelStart = -1;
      const s = t * t * (3 - 2 * t);
      this.mothAnchor.lerpVectors(this.mothFrom, this.mothTo, s);
      // Arc up over the table between the candles.
      this.mothAnchor.y += Math.sin(Math.PI * t) * 0.26;
    } else {
      this.mothAnchor.copy(MOTH_ANCHORS[this.mothHome]);
    }

    // Wandering lissajous orbit around the flame tip.
    const prevX = moth.position.x;
    const prevZ = moth.position.z;
    moth.position.set(
      this.mothAnchor.x +
        Math.sin(elapsed * 0.9) * 0.13 +
        Math.sin(elapsed * 0.37 + 1.2) * 0.04,
      this.mothAnchor.y + Math.sin(elapsed * 1.4 + 0.7) * 0.06 + 0.05,
      this.mothAnchor.z + Math.sin(elapsed * 0.63 + 2.1) * 0.13,
    );
    const dx = moth.position.x - prevX;
    const dz = moth.position.z - prevZ;
    if (dx * dx + dz * dz > 1e-10) moth.rotation.y = Math.atan2(dx, dz);

    // Fast flap (~25 Hz; aliased sin reads as flutter) with amplitude drift.
    const flap =
      Math.sin(elapsed * 157) * (0.75 + 0.2 * Math.sin(elapsed * 1.7));
    if (this.mothWingL) this.mothWingL.rotation.y = -flap;
    if (this.mothWingR) this.mothWingR.rotation.y = flap;
    moth.rotation.z = Math.sin(elapsed * 0.8) * 0.25;
  }

  private updateIdleLife(elapsed: number): void {
    this.updateMoth(elapsed);
    if (elapsed >= this.nextEmberPopAt) {
      this.nextEmberPopAt = elapsed + 30 + Math.random() * 30;
      this.lights.igniteFlare(elapsed);
      this.particles.burstEmbers();
    }
  }

  private measureFrame(delta: number, elapsed: number): void {
    if (
      this.autoQualityDowngrades >= MAX_AUTO_DOWNGRADES ||
      this.settings.quality === "low" ||
      elapsed < this.warmupUntil
    ) {
      return;
    }
    // Camera transitions run heavier gsap work and must not count.
    if (this.transitioning) return;
    this.frameWindowTime += delta;
    if (++this.frameWindowCount < FRAME_WINDOW) return;
    const average = this.frameWindowTime / this.frameWindowCount;
    this.frameWindowCount = 0;
    this.frameWindowTime = 0;
    if (average <= SLOW_FRAME_AVG) return;
    const next: Quality = this.settings.quality === "high" ? "medium" : "low";
    this.autoQualityDowngrades++;
    this.setQuality(next);
    this.events.onAutoQuality?.(next);
  }

  private readonly interactionEvents: InteractionEvents = {
    onHover: (item, screen) => {
      if (this._focused === null && !this.transitioning) {
        this.tweenRune(item === "spellbook" ? RUNE_HOVER : RUNE_IDLE, 0.4);
      }
      this.events.onHover?.(item, screen);
    },
    onSelect: (item, root) => {
      this.lastPickedRoot = root;
      if (item === "candle") this.handleCandleClick(root);
      this.events.onSelect?.(item);
    },
  };

  /**
   * Build the reusable projectile once: emissive core + layered glow.
   * Called after buildStage's shadow traverse, so nothing in it casts.
   */
  private ensureFireball(): FireballRig {
    if (this.fireball) return this.fireball;
    const texture = makeDotTexture();
    const group = new THREE.Group();

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffdfa8 }),
    );
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        color: 0xff7a30,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    halo.scale.setScalar(0.3);
    const innerGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        color: 0xffc46b,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    innerGlow.scale.setScalar(0.16);
    // A traveling warm light sells the projectile against the dark room.
    const light = new THREE.PointLight(0xff9040, 0, 3.5, 2);

    group.add(core, halo, innerGlow);
    group.visible = false;
    this.scene.add(group, light);
    this.fireball = {
      group,
      light,
      spriteMaterials: [halo.material, innerGlow.material],
    };
    return this.fireball;
  }

  /** Impact beat: flash + radial embers + smoke, then the overlay's shake. */
  private detonateFireball(impact: THREE.Vector3): void {
    this.lights.flashAt(impact, this.clock.elapsedTime);
    this.markShadowsDirty();
    this.particles.burstEmbersAt(impact);
    this.particles.puffSmoke(impact);
    this.events.onFireballImpact?.();
  }

  /** Kill any in-flight fireball so a re-cast starts clean. */
  private killFireball(): void {
    this.fireballTween?.kill();
    this.fireballTween = null;
    if (this.fireball) {
      this.fireball.group.visible = false;
      this.fireball.light.intensity = 0;
    }
  }

  /** Snuff easter egg: 5 quick clicks put a candle out; one click relights. */
  private handleCandleClick(root: THREE.Group): void {
    const state = this.candleStates.get(root);
    const flame = (root.userData.parts as CandleParts | undefined)?.flame;
    if (!state || !flame) return;

    if (state.snuffed) {
      // A match flares — relight, no click counting.
      state.snuffed = false;
      state.clicks.length = 0;
      flame.visible = true;
      this.lights.setCandleLit(flame, true);
      this.markShadowsDirty();
      this.events.onCandleSnuff?.({ snuffed: false, bothOut: false });
      return;
    }

    const now = performance.now();
    state.clicks.push(now);
    while (state.clicks.length > 0 && now - state.clicks[0] > SNUFF_WINDOW_MS) {
      state.clicks.shift();
    }
    if (state.clicks.length < SNUFF_CLICKS) return;

    state.clicks.length = 0;
    state.snuffed = true;
    flame.visible = false;
    this.lights.setCandleLit(flame, false);
    this.markShadowsDirty();
    this.particles.puffSmoke(flame.getWorldPosition(new THREE.Vector3()));
    let bothOut = true;
    for (const other of this.candleStates.values()) {
      if (!other.snuffed) bothOut = false;
    }
    this.events.onCandleSnuff?.({ snuffed: true, bothOut });
  }

  /**
   * Drive the lightning strobe: re-derive the mood baseline, then stack
   * the flash on the window sky and the bolt light. Safe at tween rate.
   */
  private readonly applyLightning = (): void => {
    const v = this.lightningProxy.v;
    this.lightningLight.intensity = v * 26;
    this.applyMood();
    if (this.windowSky && v > 0) {
      this.windowSky.emissive.lerp(LIGHTNING_SKY, Math.min(v * 0.85, 1));
      this.windowSky.emissiveIntensity += v * 7;
    }
  };

  /** Widen/shift the book's contact shadow to follow bookOpenProxy. */
  private readonly applyBookShadow = (): void => {
    const b = this.bookShadow;
    if (!b) return;
    const t = this.bookOpenProxy.v;
    b.mesh.scale.x = b.scaleX * (1 + 0.95 * t);
    const d = -b.shift * t;
    b.mesh.position.x = b.x + d * b.cos;
    b.mesh.position.z = b.z - d * b.sin;
  };

  private readonly applyRune = (): void => {    const setIntensity = this.runeCircle?.userData.setIntensity as
      | ((value: number) => void)
      | undefined;
    setIntensity?.(this.runeProxy.v);
    this.lights.setArcane(this.runeProxy.v);
  };

  private tweenRune(value: number, duration: number): void {
    gsap.killTweensOf(this.runeProxy);
    gsap.to(this.runeProxy, {
      v: value,
      duration,
      ease: "sine.inOut",
      onUpdate: this.applyRune,
    });
  }

  /**
   * Cosmetic 3D page turn while reading (the DOM ink crossfades separately).
   * direction 1 = forward (right page sweeps left), -1 = back.
   */
  flipBookPage(direction: 1 | -1): void {
    const parts = this.spellbookParts;
    if (!this.reading || !parts || this.settings.reducedMotion) return;
    const page = parts.flipPages[0];
    if (!page) return;
    this.pageFlipTween?.kill();
    page.visible = true;
    // Start slightly lifted off either stack so the sheet never rests
    // poking through the reading pages.
    page.rotation.z = direction === 1 ? 0.12 : Math.PI - 0.12;
    this.pageFlipTween = gsap.to(page.rotation, {
      z: direction === 1 ? Math.PI - 0.12 : 0.12,
      duration: 0.5,
      ease: "power2.inOut",
      onComplete: () => {
        page.visible = false;
        this.pageFlipTween = null;
      },
      onInterrupt: () => {
        page.visible = false;
      },
    });
  }

  private setReading(reading: boolean): void {
    if (this.reading === reading) return;
    this.reading = reading;
    this.rig.setReading(reading);
    if (!reading) {
      this.lastPageTransforms = null;
      this.pageInputValid = false;
      this.events.onBookPageTransforms?.(null);
    }
  }

  private setReadingPagesVisible(visible: boolean): void {
    if (!this.readingPages) return;
    this.readingPages.left.visible = visible;
    this.readingPages.right.visible = visible;
    this.markShadowsDirty();
  }

  /**
   * Has anything the page projection depends on changed since the last
   * emit? Compares (and refreshes) the cached camera world/projection
   * matrices, both page world matrices and the canvas size. Allocation-free.
   */
  private pageInputsChanged(
    left: THREE.Mesh,
    right: THREE.Mesh,
    width: number,
    height: number,
  ): boolean {
    const cache = this.pageInputCache;
    const camera = this.rig.camera;
    let changed = !this.pageInputValid;
    let o = 0;
    const sync = (elements: ArrayLike<number>): void => {
      for (let i = 0; i < 16; i++, o++) {
        if (cache[o] !== elements[i]) {
          cache[o] = elements[i];
          changed = true;
        }
      }
    };
    sync(camera.matrixWorld.elements);
    sync(camera.projectionMatrix.elements);
    sync(left.matrixWorld.elements);
    sync(right.matrixWorld.elements);
    if (cache[o] !== width || cache[o + 1] !== height) {
      cache[o] = width;
      cache[o + 1] = height;
      changed = true;
    }
    this.pageInputValid = true;
    return changed;
  }

  /**
   * Fit a flat 2D CSS matrix to one page's four projected corners.
   * The reading camera looks (almost) straight down at the flat page, so
   * its projection is affine to within ~1px: pin the ink with a flat 2D
   * matrix least-squares-fit over the four projected corners. This follows
   * the book's slight rotation exactly and never uses matrix3d —
   * perspective-transformed text layers made Chromium blank the ink.
   */
  private projectPage(mesh: THREE.Mesh, width: number, height: number): string {
    const pts = this.cornerScreen;
    for (let i = 0; i < 4; i++) {
      this.cornerScratch
        .copy(this.cornerLocal[i]!)
        .applyMatrix4(mesh.matrixWorld)
        .project(this.rig.camera);
      pts[i]!.x = ((this.cornerScratch.x + 1) / 2) * width;
      pts[i]!.y = ((1 - this.cornerScratch.y) / 2) * height;
    }
    const tl = pts[0]!;
    const tr = pts[1]!;
    const bl = pts[2]!;
    const br = pts[3]!;
    const a = (tr.x - tl.x + (br.x - bl.x)) / (2 * PAGE_CSS_W);
    const b = (tr.y - tl.y + (br.y - bl.y)) / (2 * PAGE_CSS_W);
    const c = (bl.x - tl.x + (br.x - tr.x)) / (2 * PAGE_CSS_H);
    const d = (bl.y - tl.y + (br.y - tr.y)) / (2 * PAGE_CSS_H);
    // Anchor at the centroid so the residual splits evenly across corners.
    const cx = (tl.x + tr.x + bl.x + br.x) / 4;
    const cy = (tl.y + tr.y + bl.y + br.y) / 4;
    const e = cx - (a * PAGE_CSS_W + c * PAGE_CSS_H) / 2;
    const f = cy - (b * PAGE_CSS_W + d * PAGE_CSS_H) / 2;
    return `matrix(${a.toFixed(6)}, ${b.toFixed(6)}, ${c.toFixed(6)}, ${d.toFixed(6)}, ${e.toFixed(2)}, ${f.toFixed(2)})`;
  }

  /**
   * Project both reading pages to screen space and hand the UI transforms.
   * Runs after render (world/projection matrices are fresh). With a settled
   * camera nothing changes, so the whole projection is skipped; the only
   * allocation is the emitted strings/object when the result does change
   * (a fresh object, so the App's ref sees the update).
   */
  private emitPageTransforms(): void {
    const pages = this.readingPages;
    const handler = this.events.onBookPageTransforms;
    if (!pages || !handler) return;
    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    if (!this.pageInputsChanged(pages.left, pages.right, width, height)) return;

    const left = this.projectPage(pages.left, width, height);
    const right = this.projectPage(pages.right, width, height);
    const last = this.lastPageTransforms;
    if (last && last.left === left && last.right === right) return;
    this.lastPageTransforms = { left, right };
    handler(this.lastPageTransforms);
  }

  private playBookOpen(): Promise<void> {
    const parts = this.spellbookParts;
    if (!parts) return Promise.resolve();
    this.bookTl?.kill();
    gsap.killTweensOf(this.runeProxy);
    this.bookOpen = true;

    const reduced = this.settings.reducedMotion;
    return new Promise((resolve) => {
      const tl = gsap.timeline({
        // Start roughly midway through the camera move.
        delay: reduced ? 0.1 : 0.8,
        onComplete: () => {
          this.bookTl = null;
          resolve();
        },
        onInterrupt: resolve,
      });
      tl.to(
        parts.frontCover.rotation,
        // +z lifts the free edge up and over the spine; -z would swing
        // the cover down through the table.
        { z: Math.PI, duration: 1.1, ease: "power3.inOut" },
        0,
      );
      parts.flipPages.forEach((page, i) => {
        tl.to(
          page.rotation,
          { z: Math.PI, duration: 0.35, ease: "power2.inOut" },
          1.1 + i * 0.15,
        );
      });
      tl.to(
        this.bookOpenProxy,
        { v: 1, duration: 1.1, ease: "power3.inOut", onUpdate: this.applyBookShadow },
        0,
      );
      tl.to(
        this.runeProxy,
        // Ramp the rune/arcane glow for the opening flourish, but settle at
        // a dim level — full intensity washes the parchment out while reading.
        { v: 0.55, duration: 1.3, ease: "sine.inOut", onUpdate: this.applyRune },
        0,
      );
      // Once fully open: swap the scribbled flip pages for the clean reading
      // spread and start streaming page transforms to the DOM ink layer.
      tl.call(() => {
        if (!this.bookOpen) return;
        for (const page of parts.flipPages) page.visible = false;
        this.setReadingPagesVisible(true);
        // The sparkle swarm had its moment during the opening; it would
        // drift across the text while reading.
        this.particles.setBookActive(false);
        this.setReading(true);
      });
      if (reduced) tl.timeScale(3.5);
      this.bookTl = tl;
    });
  }

  private playBookClose(): Promise<void> {
    const parts = this.spellbookParts;
    if (!parts) return Promise.resolve();
    this.bookTl?.kill();
    this.pageFlipTween?.kill();
    this.pageFlipTween = null;
    gsap.killTweensOf(this.runeProxy);
    this.bookOpen = false;
    this.setReading(false);
    this.setReadingPagesVisible(false);
    for (const page of parts.flipPages) page.visible = true;

    return new Promise((resolve) => {
      const tl = gsap.timeline({
        onComplete: () => {
          this.bookTl = null;
          resolve();
        },
        onInterrupt: resolve,
      });
      // Pages snap back instantly, hidden under the closing cover.
      for (const page of parts.flipPages) {
        tl.set(page.rotation, { z: 0 }, 0);
      }
      tl.to(
        parts.frontCover.rotation,
        { z: 0, duration: 0.5, ease: "power2.inOut" },
        0,
      );
      tl.to(
        this.bookOpenProxy,
        { v: 0, duration: 0.5, ease: "power2.inOut", onUpdate: this.applyBookShadow },
        0,
      );
      tl.to(
        this.runeProxy,
        {
          v: RUNE_IDLE,
          duration: 0.5,
          ease: "sine.out",
          onUpdate: this.applyRune,
        },
        0,
      );
      if (this.settings.reducedMotion) tl.timeScale(2);
      this.bookTl = tl;
    });
  }

  /** Is any shadow caster moving this frame? */
  private shadowsAnimating(now: number): boolean {
    return (
      this.bookTl !== null ||
      this.pageFlipTween !== null ||
      (this.dicePhysics?.isRolling ?? false) ||
      now < this.shadowBusyUntil
    );
  }

  private readonly loop = (): void => {
    this.rafId = requestAnimationFrame(this.loop);

    // Clamp delta so a resumed tab doesn't jump the simulation.
    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsed = this.clock.elapsedTime;

    this.rig.update(elapsed, delta);
    this.lights.update(elapsed);
    this.particles.update(delta, elapsed);
    this.dicePhysics?.update(delta);
    this.updateIdleLife(elapsed);
    this.interaction?.update();

    if (this.shadowsAnimating(performance.now())) this.markShadowsDirty();
    if (this.shadowDirtyFrames > 0) {
      this.shadowDirtyFrames--;
      this.renderer.shadowMap.needsUpdate = true;
    }
    this.renderer.render(this.scene, this.rig.camera);
    // After render so the camera's world/projection matrices are fresh.
    if (this.reading) {
      // Belt-and-suspenders: no scribbled flip sheet may rest over the ink.
      if (!this.pageFlipTween && this.spellbookParts) {
        for (const page of this.spellbookParts.flipPages) {
          if (!page.visible) continue;
          page.visible = false;
          this.markShadowsDirty();
        }
      }
      this.emitPageTransforms();
    }

    if (!this.readyFired) {
      this.readyFired = true;
      this.events.onProgress?.(1);
      this.warmupUntil = elapsed + WARMUP_SECONDS;
      this.events.onReady?.();
    }
    if (this.readyFired) this.measureFrame(delta, elapsed);
  };

  private readonly scheduleResize = (): void => {
    if (this.resizeRaf !== null || this.disposed) return;
    this.resizeRaf = requestAnimationFrame(() => {
      this.resizeRaf = null;
      this.handleResize(false);
    });
  };

  private handleResize(initial = true): void {
    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    if (width === 0 || height === 0) return;
    this.renderer.setSize(width, height, false);
    this.rig.setSize(width, height);
    // Poses depend on aspect (table/focus framing, reading distance fit to
    // the frustum). Re-aim without killing an in-flight focus tween.
    if (initial) this.rig.snapToPose(this._focused);
    else this.rig.retarget();
  }

  private readonly onVisibilityChange = (): void => {
    this.updateRunning();
  };

  private updateRunning(): void {
    const shouldRun =
      this.stageReady && !this.userPaused && !document.hidden && !this.disposed;
    if (shouldRun && this.rafId === null) {
      this.clock.getDelta(); // Swallow the paused interval.
      this.rafId = requestAnimationFrame(this.loop);
    } else if (!shouldRun && this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private disposeMaterial(
    material: THREE.Material,
    textures: Set<THREE.Texture>,
  ): void {
    for (const value of Object.values(material)) {
      if (value instanceof THREE.Texture) textures.add(value);
    }
    material.dispose();
  }
}
