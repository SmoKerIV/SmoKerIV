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
import { computeMatrix3d } from "./pageProjection";
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
// The room model's -Z window sky quad, found at runtime by its emissive.
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

// --- Auto quality fail-down --------------------------------------------------
const FRAME_WINDOW = 90;
/** Rolling window average above this (< 25 fps) triggers a downgrade. */
const SLOW_FRAME_AVG = 0.04;
const MAX_AUTO_DOWNGRADES = 2;
/** Skip measuring right after ready — shader warmup skews deltas. */
const WARMUP_SECONDS = 3;

interface Placement {
  x: number;
  z: number;
  rotY: number;
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
  private readonly interaction: Interaction;
  private readonly resizeObserver: ResizeObserver;

  private readonly settings: SceneSettings;
  private readonly events: SceneEvents;
  private readonly itemGroups = new Map<ItemId, THREE.Group>();
  /** All pickable roots, including the second candle instance. */
  private readonly interactableRoots: THREE.Group[] = [];
  private runeCircle: THREE.Group | null = null;
  private spellbookParts: SpellbookParts | null = null;

  private _focused: ItemId | null = null;
  private focusToken = 0;
  private transitioning = false;
  private transitionTarget: ItemId | null = null;
  private bookOpen = false;
  private bookTl: gsap.core.Timeline | null = null;
  private readonly runeProxy = { v: RUNE_IDLE };

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
  /** Last emitted matrices — identical frames are skipped so the DOM ink
   *  layer stays untouched (and rock-solid) once the camera settles. */
  private lastPageTransforms: { left: string; right: string } | null = null;

  private diceRolling = false;
  private dicePhysics: DicePhysics | null = null;

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

  private rafId: number | null = null;
  private userPaused = false;
  private disposed = false;
  private progressFrame = 0;
  private readyFired = false;

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

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = settings.quality !== "low";
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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

    this.buildStage();
    this.buildMoth();
    this.applyRune();

    // Default mood: "auto", applied instantly so first paint is correct.
    this.moodProxy.v = this.resolveTimeOfDay("auto") === "day" ? 1 : 0;
    this.applyMood();

    this.interaction = new Interaction(
      canvas,
      this.rig.camera,
      this.interactableRoots,
      this.interactionEvents,
    );

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(canvas);
    window.addEventListener("resize", this.handleResize);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.handleResize();
    this.updateRunning();
    // Dev-only escape hatch for debugging camera/scene state in the console.
    if (import.meta.env.DEV) {
      (window as unknown as { __scene?: SceneManager }).__scene = this;
    }
  }

  get focusedItem(): ItemId | null {
    return this._focused;
  }

  focusItem(item: ItemId | null): void {
    if (this.transitioning) {
      if (item === this.transitionTarget) return;
    } else if (item === this._focused) {
      return;
    }

    const token = ++this.focusToken;
    this.transitioning = true;
    this.transitionTarget = item;
    this._focused = item;
    // While focused, hover stops but the focused item stays clickable
    // (candle snuffing counts clicks even in the close-up).
    this.interaction.setFocus(item);
    this.particles.setBookActive(item === "spellbook");

    // Two candles share one itemId: anchor the pose to the instance that
    // was actually picked (keyboard activation picks the primary one).
    if (item === "candle") {
      const root =
        this.lastPickedRoot?.userData.itemId === "candle"
          ? this.lastPickedRoot
          : this.itemGroups.get("candle");
      if (root) this.registerAnchor("candle", root);
    }

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
    return this.interaction.highlightNext(direction);
  }

  activateHighlighted(): void {
    this.interaction.activateHighlighted();
  }

  rollDice(): void {
    if (this.diceRolling || !this.dicePhysics) return;
    this.diceRolling = true;
    this.dicePhysics.roll(this.settings.reducedMotion);
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

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.setReading(false);
    this.updateRunning();

    this.resizeObserver.disconnect();
    window.removeEventListener("resize", this.handleResize);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);

    this.bookTl?.kill();
    this.pageFlipTween?.kill();
    this.dicePhysics?.dispose();
    gsap.killTweensOf(this.runeProxy);
    gsap.killTweensOf(this.moodProxy);
    this.interaction.dispose();
    this.rig.dispose();
    this.lights.dispose();
    this.particles.dispose();

    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const material of materials) this.disposeMaterial(material);
    });
    this.scene.clear();
    this.renderer.dispose();
  }

  // ----------------------------------------------------------------- private

  private buildStage(): void {
    const room = buildRoom();
    this.scene.add(room);

    // The window's night-sky quad has no name; identify it by its unique
    // deep-blue emissive so day mode can repaint it without touching models.
    room.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (
        material.isMeshStandardMaterial &&
        material.emissive.getHex() === WINDOW_EMISSIVE_NIGHT
      ) {
        this.windowSky = material;
      }
    });

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

    for (const [id, build] of Object.entries(builders) as [
      ItemId,
      () => THREE.Group,
    ][]) {
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
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  }

  private placeOnTable(group: THREE.Group, placement: Placement): void {
    group.position.set(placement.x, TABLE_SURFACE_Y, placement.z);
    group.rotation.y = placement.rotY;
    this.scene.add(group);
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
    this.particles.puffSmoke(flame.getWorldPosition(new THREE.Vector3()));
    let bothOut = true;
    for (const other of this.candleStates.values()) {
      if (!other.snuffed) bothOut = false;
    }
    this.events.onCandleSnuff?.({ snuffed: true, bothOut });
  }

  private readonly applyRune = (): void => {
    const setIntensity = this.runeCircle?.userData.setIntensity as
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
      this.events.onBookPageTransforms?.(null);
    }
  }

  private setReadingPagesVisible(visible: boolean): void {
    if (!this.readingPages) return;
    this.readingPages.left.visible = visible;
    this.readingPages.right.visible = visible;
  }

  /** Project both reading pages to screen space and hand the UI matrix3ds. */
  private emitPageTransforms(): void {
    const pages = this.readingPages;
    const handler = this.events.onBookPageTransforms;
    if (!pages || !handler) return;
    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;

    const projectPage = (mesh: THREE.Mesh): string => {
      mesh.updateWorldMatrix(true, false);
      const pts = this.cornerLocal.map((corner) => {
        this.cornerScratch
          .copy(corner)
          .applyMatrix4(mesh.matrixWorld)
          .project(this.rig.camera);
        return {
          x: ((this.cornerScratch.x + 1) / 2) * width,
          y: ((1 - this.cornerScratch.y) / 2) * height,
        };
      });
      return computeMatrix3d(
        pts[0]!, pts[1]!, pts[2]!, pts[3]!,
        PAGE_CSS_W, PAGE_CSS_H,
      );
    };

    const left = projectPage(pages.left);
    const right = projectPage(pages.right);
    const last = this.lastPageTransforms;
    if (last && last.left === left && last.right === right) return;
    this.lastPageTransforms = { left, right };
    handler({ left, right });
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

  private readonly loop = (): void => {
    this.rafId = requestAnimationFrame(this.loop);

    if (this.progressFrame < 4) {
      this.progressFrame++;
      this.events.onProgress?.(this.progressFrame / 4);
    }

    // Clamp delta so a resumed tab doesn't jump the simulation.
    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsed = this.clock.elapsedTime;

    this.rig.update(elapsed, delta);
    this.lights.update(elapsed);
    this.particles.update(delta, elapsed);
    this.dicePhysics?.update(delta);
    this.updateIdleLife(elapsed);
    this.interaction.update();

    this.renderer.render(this.scene, this.rig.camera);
    // After render so the camera's world/projection matrices are fresh.
    if (this.reading) {
      // Belt-and-suspenders: no scribbled flip sheet may rest over the ink.
      if (!this.pageFlipTween && this.spellbookParts) {
        for (const page of this.spellbookParts.flipPages) page.visible = false;
      }
      this.emitPageTransforms();
    }

    if (!this.readyFired && this.progressFrame >= 4) {
      this.readyFired = true;
      this.warmupUntil = elapsed + WARMUP_SECONDS;
      this.events.onReady?.();
    }
    if (this.readyFired) this.measureFrame(delta, elapsed);
  };

  private readonly handleResize = (): void => {
    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    if (width === 0 || height === 0) return;
    this.renderer.setSize(width, height, false);
    this.rig.setSize(width, height);
    // Poses depend on aspect (portrait centers the table on the tome; the
    // reading distance is fit to the frustum) — re-apply for the new frame.
    if (!this.transitioning) this.rig.snapToPose(this._focused);
  };

  private readonly onVisibilityChange = (): void => {
    this.updateRunning();
  };

  private updateRunning(): void {
    const shouldRun = !this.userPaused && !document.hidden && !this.disposed;
    if (shouldRun && this.rafId === null) {
      this.clock.getDelta(); // Swallow the paused interval.
      this.rafId = requestAnimationFrame(this.loop);
    } else if (!shouldRun && this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private disposeMaterial(material: THREE.Material): void {
    for (const value of Object.values(material)) {
      if (value instanceof THREE.Texture) value.dispose();
    }
    material.dispose();
  }
}
