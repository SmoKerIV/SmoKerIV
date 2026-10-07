import * as THREE from "three";
import gsap from "gsap";
import { PAGE_CSS_W, type ItemId } from "./types";

interface Pose {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

/** Fraction of the frustum width an item may fill in its close-up. */
const FOCUS_FILL = 0.84;

/** Camera offset relative to an item's registered anchor point. */
interface FocusPreset {
  offset: THREE.Vector3;
  targetOffset: THREE.Vector3;
}

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Seated-at-the-table overview, looking from +Z toward the tabletop. */
const TABLE_POSE: Pose = {
  position: v3(0, 1.65, 1.55),
  target: v3(0, 1.0, -0.15),
};

/**
 * Narrow screens can't frame a 2.3 m wide table at the desktop FOV from
 * inside a 3.2 m room, so the vertical FOV widens and the camera pitches
 * down as the aspect drops: t runs 0 (aspect >= WIDE) .. 1 (aspect <= NARROW).
 */
const FOV_BASE = 42;
const FOV_NARROW = 84;
const ASPECT_WIDE = 1.25;
const ASPECT_NARROW = 0.5;
/** Camera pitch (degrees above horizontal, seen from the table target). */
const PITCH_BASE = 21;
const PITCH_NARROW = 40;
/**
 * Screen-space safe area for the table fit (NDC). The layout's lowest
 * point is pinned to the bottom of the safe area (so the frame holds
 * table, not floor) and the camera comes in until the items fill the
 * width; whatever is left above shows the room behind. Phones keep the
 * bottom clear for the overlay's hint and buttons.
 */
const FIT_X_WIDE = 0.82;
const FIT_X_NARROW = 0.96;
const FIT_TOP_WIDE = 0.55;
const FIT_TOP_NARROW = 0.8;
const FIT_BOTTOM_WIDE = 0.84;
const FIT_BOTTOM_NARROW = 0.3;
/** Closest the overview may come (m from the target). */
const MIN_TABLE_DISTANCE = 1.1;
/** The camera never rises above the ceiling beams (≈3.03 m). */
const MAX_CAMERA_Y = 2.75;
const MAX_CAMERA_Z = 3.2;

const FOCUS_PRESETS: Record<ItemId, FocusPreset> = {
  // spellbook uses a computed aspect-aware reading pose (see poseFor).
  spellbook: { offset: v3(0, 0.85, 0.42), targetOffset: v3(0, 0.02, -0.02) },
  sword: { offset: v3(0.05, 0.45, 0.72), targetOffset: v3(0, 0.04, 0) },
  shield: { offset: v3(-0.06, 0.5, 0.62), targetOffset: v3(0, 0.03, 0) },
  potion: { offset: v3(0.08, 0.42, 0.72), targetOffset: v3(0, 0.12, 0) },
  scroll: { offset: v3(0, 0.42, 0.5), targetOffset: v3(0, 0.02, 0) },
  dice: { offset: v3(0, 0.32, 0.42), targetOffset: v3(0, 0.02, 0) },
  tankard: { offset: v3(-0.06, 0.4, 0.62), targetOffset: v3(0, 0.08, 0) },
  candle: { offset: v3(0.14, 0.34, 0.48), targetOffset: v3(0, 0.1, 0) },
};

/** Open spread: cover lands left of the spine; center ≈ x −0.24 off the anchor. */
const READING_TARGET_OFFSET = v3(-0.228, 0.005, -0.01);
/**
 * Half-width of the two parchment pages (2 x 0.46 m). The reading fit is
 * driven by the pages, not the covers: the ink panes are 640 CSS px per
 * 0.46 m page, so filling the width with the pages (covers may run off the
 * edges) keeps the projected text near its CSS size — at 1440x900 the
 * pages project above 1:1; a 4:3 1024 px viewport tops out near 0.78.
 */
const BOOK_PAGES_HALF_W = 0.46;
/** Side air beyond the page edges (fraction of the half-width). */
const BOOK_PAGES_MARGIN = 1.13;
/** Open book half-depth; the margin leaves room for the section tabs
 *  above and the page arrows below. */
const BOOK_OPEN_HALF_D = 0.18;
const BOOK_MARGIN_D = 1.6;
/** World width of one parchment page (m); its ink pane is PAGE_CSS_W px. */
const BOOK_PAGE_W = 0.46;
/** Parchment sits this far (m) above the camera's aim point (measured:
 *  1024x768 two-page scale 0.78, 1280x800 0.99), so it is nearer than d. */
const BOOK_PAGE_RISE = 0.09;
/**
 * One-page reading. When framing both pages would project the ink below
 * this fraction of its CSS size (small text), the camera frames a single
 * page instead and glides between pages.
 */
const SINGLE_PAGE_BELOW = 0.95;
/** Projected scale the single-page frame aims for (1 = CSS size). */
const SINGLE_PAGE_SCALE = 1;
/** Side air beyond the page edge (fraction of the page's half-width). */
const SINGLE_PAGE_MARGIN_W = 1.1;
/** Page half-depth (m) and the air kept above/below it for tabs + arrows. */
const BOOK_PAGE_HALF_D = 0.165;
const SINGLE_PAGE_MARGIN_D = 1.45;
/** Glide between pages (seconds). */
const PAGE_GLIDE_DURATION = 0.6;
/**
 * Near-perfect top-down reading pose (≈1° toward the reader — just enough
 * for lookAt's up vector to stay stable). Straight-down matters: the page
 * planes then project to exact rectangles, so the DOM ink can be pinned
 * with flat 2D transforms. Perspective matrix3d layers made Chromium
 * intermittently blank the text; 2D transforms never hit that path.
 */
const READING_TILT = { y: 0.99995, z: 0.01 };

const FOCUS_DURATION = 1.6;
/** Post-roll peek at the die on narrow screens (seconds / metres). */
const PEEK_IN = 0.75;
const PEEK_HOLD = 1.6;
const PEEK_OUT = 0.9;
const PEEK_OFFSET = { y: 0.42, z: 0.3 };
const xyz = (v: THREE.Vector3): { x: number; y: number; z: number } => ({
  x: v.x,
  y: v.y,
  z: v.z,
});
/** Settled-camera ease when the viewport aspect changes. */
const RETARGET_DURATION = 0.3;
const REDUCED_DURATION = 0.3;
const FOCUS_EASE = "power2.inOut";

/**
 * Reading up vector: the page top sits at world −Z, so up = (0, 0, −1)
 * keeps the spread upright on screen. It also makes the near-vertical
 * lookAt rock-stable — with the default (0, 1, 0) up, the derived roll
 * swings wildly as the view direction approaches −Y (screen "rotates").
 */
const READING_UP = v3(0, 0, -1);
const WORLD_UP = v3(0, 1, 0);

/**
 * Owns the PerspectiveCamera: table pose, per-item focus poses,
 * idle sway and mouse parallax. GSAP animates the base pose vectors;
 * the per-frame update layers sway/parallax on top (never the same
 * property from both sides).
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;

  private readonly basePosition = TABLE_POSE.position.clone();
  private readonly baseTarget = TABLE_POSE.target.clone();
  /**
   * Owned up vector, tweened alongside the pose. GSAP interpolates it
   * (0,1,0) ↔ (0,0,−1) componentwise; along that path it never comes
   * close to parallel with the view direction (which sweeps −Z → −Y
   * while up sweeps +Y → −Z), so lookAt's roll stays steady in flight.
   */
  private readonly upVec = WORLD_UP.clone();
  private readonly lookAt = new THREE.Vector3();

  private readonly anchors = new Map<ItemId, THREE.Vector3>();
  /** Horizontal half-extent (m) of each item, for narrow-aspect close-ups. */
  private readonly halfWidths = new Map<ItemId, number>();
  /** World corners of the table's item layout, for the overview fit. */
  private tableCorners: THREE.Vector3[] = [];
  private readonly fitCamera = new THREE.PerspectiveCamera();
  private readonly fitPoint = new THREE.Vector3();

  private readonly parallaxTarget = new THREE.Vector2();
  private readonly parallax = new THREE.Vector2();

  private reducedMotion: boolean;
  /** Viewport height (px), for the projected-scale estimate of the pages. */
  private viewHeight = 800;
  /** Page the reading camera frames when only one page fits. */
  private readingPage: "left" | "right" = "left";
  /**
   * 0 while reading — a fully static camera means the page 2D matrix
   * transforms stop changing, so the browser never re-rasterizes the ink
   * layer mid-read (per-frame updates made the text flicker on some GPUs);
   * 1 otherwise.
   */
  private swayScale = 1;
  private tween: gsap.core.Timeline | null = null;
  /** Item the camera is posed on / heading to (null = table). */
  private currentItem: ItemId | null = null;
  private resolveActive: (() => void) | null = null;

  private readonly onPointerMove = (event: PointerEvent) => {
    this.parallaxTarget.set(
      (event.clientX / window.innerWidth) * 2 - 1,
      1 - (event.clientY / window.innerHeight) * 2,
    );
  };

  constructor(aspect: number, reducedMotion: boolean) {
    this.camera = new THREE.PerspectiveCamera(42, aspect, 0.05, 30);
    this.reducedMotion = reducedMotion;
    this.camera.position.copy(this.basePosition);
    this.camera.lookAt(this.baseTarget);
    window.addEventListener("pointermove", this.onPointerMove);
  }

  /** SceneManager registers item world positions once the table is laid out. */
  registerAnchor(
    item: ItemId,
    anchor: THREE.Vector3,
    halfWidth?: number,
  ): void {
    this.anchors.set(item, anchor.clone());
    if (halfWidth !== undefined) this.halfWidths.set(item, halfWidth);
  }

  /**
   * Silhouette points of everything on the table (items, candles with
   * flames): the overview fits these. Real outline points, not bounding-box
   * corners — a rotated shield's or sword's box corners sit well outside
   * the object and pushed a tall phone view far back.
   */
  setTablePoints(points: THREE.Vector3[]): void {
    this.tableCorners = points.map((p) => p.clone());
  }

  /** Tween the base pose toward an item (or the table when null). */
  focusTo(item: ItemId | null): Promise<void> {
    this.killTween();
    this.currentItem = item;
    if (item !== "spellbook") this.readingPage = "left";
    const duration = this.reducedMotion ? REDUCED_DURATION : FOCUS_DURATION;

    return new Promise<void>((resolve) => {
      this.resolveActive = resolve;
      this.tweenToCurrent(duration, FOCUS_EASE, () => {
        this.resolveActive = null;
        resolve();
      });
    });
  }

  /** Tween base pose/up toward the current item's pose. */
  private tweenToCurrent(
    duration: number,
    ease: string,
    onDone?: () => void,
  ): void {
    const item = this.currentItem;
    const pose = this.poseFor(item);
    const up = this.upFor(item);
    this.tween = gsap
      .timeline({
        defaults: { duration, ease },
        onComplete: () => {
          this.tween = null;
          onDone?.();
        },
      })
      .to(this.basePosition, { x: pose.position.x, y: pose.position.y, z: pose.position.z }, 0)
      .to(this.baseTarget, { x: pose.target.x, y: pose.target.y, z: pose.target.z }, 0)
      .to(this.upVec, { x: up.x, y: up.y, z: up.z }, 0);
  }

  update(elapsed: number, delta: number): void {
    if (this.reducedMotion) {
      this.parallax.set(0, 0);
      this.camera.position.copy(this.basePosition);
    } else {
      // Frame-rate independent lerp toward the pointer. Amplitude is kept
      // small: strong parallax makes the items drift away from the cursor
      // exactly while the user is aiming at them.
      this.parallax.lerp(this.parallaxTarget, 1 - Math.exp(-delta * 4));
      const s = this.swayScale;
      const swayX = Math.sin(elapsed * 0.4) * 0.01 * s;
      const swayY = Math.sin(elapsed * 0.27 + 1.3) * 0.01 * s;
      this.camera.position.set(
        this.basePosition.x + swayX + this.parallax.x * 0.012 * s,
        this.basePosition.y + swayY + this.parallax.y * 0.012 * s,
        this.basePosition.z,
      );
    }
    this.lookAt.copy(this.baseTarget);
    // Apply the owned up before lookAt: guard against a degenerate mid-tween
    // vector, then normalize (lookAt assumes unit-ish up).
    if (this.upVec.lengthSq() < 1e-8) this.upVec.copy(WORLD_UP);
    this.camera.up.copy(this.upVec).normalize();
    this.camera.lookAt(this.lookAt);
  }

  setSize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.viewHeight = height;
    this.camera.fov = this.fovFor(this.camera.aspect);
    this.camera.updateProjectionMatrix();
  }

  /** 0 on wide screens .. 1 on tall phones (smoothstep of the aspect). */
  private narrowness(aspect: number): number {
    const t = THREE.MathUtils.clamp(
      (ASPECT_WIDE - aspect) / (ASPECT_WIDE - ASPECT_NARROW),
      0,
      1,
    );
    return t * t * (3 - 2 * t);
  }

  private fovFor(aspect: number): number {
    return THREE.MathUtils.lerp(FOV_BASE, FOV_NARROW, this.narrowness(aspect));
  }

  /**
   * The aspect changed: re-aim at the (aspect-dependent) pose of the current
   * focus. An in-flight focus tween keeps running — it is re-aimed at the
   * new pose for its remaining time, and its promise still resolves when it
   * lands, so onFocusSettled never fires early. A settled camera eases to
   * the new pose briefly (instantly under reduced motion) so mobile
   * URL-bar show/hide doesn't make the view jump.
   */
  retarget(): void {
    if (this.tween && this.resolveActive) {
      const remaining = Math.max(
        this.tween.duration() * (1 - this.tween.progress()),
        0.05,
      );
      const resolve = this.resolveActive;
      this.tween.kill();
      this.tween = null;
      this.tweenToCurrent(remaining, "power2.out", () => {
        this.resolveActive = null;
        resolve();
      });
      return;
    }
    this.snapOrEase();
  }

  /** Jump straight to an item's pose (first layout). Interrupts any tween. */
  snapToPose(item: ItemId | null): void {
    this.killTween();
    this.currentItem = item;
    const pose = this.poseFor(item);
    this.basePosition.copy(pose.position);
    this.baseTarget.copy(pose.target);
    this.upVec.copy(this.upFor(item));
  }

  /** Settled camera: ease (or snap) to the pose for the current aspect. */
  private snapOrEase(): void {
    if (this.tween) {
      this.tween.kill();
      this.tween = null;
    }
    if (this.reducedMotion) {
      const pose = this.poseFor(this.currentItem);
      this.basePosition.copy(pose.position);
      this.baseTarget.copy(pose.target);
      this.upVec.copy(this.upFor(this.currentItem));
      return;
    }
    this.tweenToCurrent(RETARGET_DURATION, "power2.out");
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  /** A pose tween (focus, retarget) is in flight. */
  get isAnimating(): boolean {
    return this.tween !== null;
  }

  /**
   * Narrow screens: after a roll the d20 is a few pixels across, so lean
   * in over the settled die, hold so its number can be read, then return
   * to the table. Only from a settled table view; any focus or resize
   * cancels it (both kill the tween). No-op under reduced motion.
   */
  peekAt(point: THREE.Vector3): void {
    if (this.reducedMotion || this.currentItem !== null || this.tween) return;
    const target = point.clone();
    target.y += 0.01;
    // Steep, close view from the reader's side.
    const position = target.clone().add(v3(0, PEEK_OFFSET.y, PEEK_OFFSET.z));
    const home = this.poseFor(null);
    this.tween = gsap
      .timeline({
        onComplete: () => {
          this.tween = null;
        },
      })
      .to(this.basePosition, { ...xyz(position), duration: PEEK_IN, ease: FOCUS_EASE }, 0)
      .to(this.baseTarget, { ...xyz(target), duration: PEEK_IN, ease: FOCUS_EASE }, 0)
      .to(this.basePosition, { ...xyz(home.position), duration: PEEK_OUT, ease: FOCUS_EASE }, PEEK_IN + PEEK_HOLD)
      .to(this.baseTarget, { ...xyz(home.target), duration: PEEK_OUT, ease: FOCUS_EASE }, PEEK_IN + PEEK_HOLD);
  }

  /** Freeze idle sway/parallax while the tome is being read. */
  setReading(reading: boolean): void {
    this.swayScale = reading ? 0 : 1;
  }

  dispose(): void {
    this.killTween();
    window.removeEventListener("pointermove", this.onPointerMove);
  }

  /**
   * Which page the reading camera frames (only matters when the two-page
   * fit is too small, see readingSingle). Glides there; instant under
   * reduced motion.
   */
  setReadingPage(page: "left" | "right"): void {
    if (page === this.readingPage) return;
    this.readingPage = page;
    if (this.currentItem !== "spellbook" || !this.readingSingle()) return;
    if (this.reducedMotion) {
      this.snapOrEase();
      return;
    }
    if (this.tween && this.resolveActive) {
      this.retarget(); // a focus flight keeps its promise, re-aimed
      return;
    }
    this.tween?.kill();
    this.tween = null;
    this.tweenToCurrent(PAGE_GLIDE_DURATION, FOCUS_EASE);
  }

  /** True when the reading pose frames one page at a time. */
  readingSingle(): boolean {
    const aspect = this.camera.aspect || 1.6;
    const tanV = Math.tan((this.camera.fov * Math.PI) / 360);
    return this.pagesScale(this.spreadDistance(aspect, tanV), tanV) < SINGLE_PAGE_BELOW;
  }

  /** Camera distance that frames both pages (and the open book's depth). */
  private spreadDistance(aspect: number, tanV: number): number {
    const dH = (BOOK_PAGES_HALF_W * BOOK_PAGES_MARGIN) / (tanV * aspect);
    const dV = (BOOK_OPEN_HALF_D * BOOK_MARGIN_D) / tanV;
    return THREE.MathUtils.clamp(Math.max(dH, dV), 0.6, 1.9);
  }

  /** Projected size of a page's ink relative to its CSS size at distance d. */
  private pagesScale(d: number, tanV: number): number {
    return (
      (BOOK_PAGE_W * this.viewHeight) /
      (2 * (d - BOOK_PAGE_RISE) * tanV * PAGE_CSS_W)
    );
  }

  /** Camera distance for the single-page frame. */
  private singleDistance(aspect: number, tanV: number): number {
    const dW = (BOOK_PAGE_W / 2 * SINGLE_PAGE_MARGIN_W) / (tanV * aspect);
    const dV = (BOOK_PAGE_HALF_D * SINGLE_PAGE_MARGIN_D) / tanV;
    const dScale =
      (BOOK_PAGE_W * this.viewHeight) /
      (2 * tanV * PAGE_CSS_W * SINGLE_PAGE_SCALE);
    return THREE.MathUtils.clamp(
      Math.max(dW, dV, dScale) + BOOK_PAGE_RISE,
      0.4,
      1.9,
    );
  }

  private upFor(item: ItemId | null): THREE.Vector3 {
    return item === "spellbook" ? READING_UP : WORLD_UP;
  }

  private poseFor(item: ItemId | null): Pose {
    const aspect = this.camera.aspect || 1.6;
    const tanV = Math.tan((this.camera.fov * Math.PI) / 360);
    if (item === null) return this.tablePose(aspect);

    const anchor = this.anchors.get(item) ?? TABLE_POSE.target;
    if (item === "spellbook") {
      // Two pages when they project near their CSS size; otherwise one page
      // at a time (the distance then follows that page alone).
      const single = this.readingSingle();
      const d = single
        ? this.singleDistance(aspect, tanV)
        : this.spreadDistance(aspect, tanV);
      const target = anchor.clone().add(READING_TARGET_OFFSET);
      if (single) {
        target.x += (this.readingPage === "left" ? -1 : 1) * (BOOK_PAGE_W / 2);
      }
      const position = target
        .clone()
        .add(v3(0, d * READING_TILT.y, d * READING_TILT.z));
      return { position, target };
    }
    const preset = FOCUS_PRESETS[item];
    const offset = preset.offset.clone();
    // Narrow aspects: back the camera off along its offset until the item's
    // width fits the horizontal FOV.
    const halfW = this.halfWidths.get(item);
    if (halfW !== undefined) {
      const need = halfW / (FOCUS_FILL * tanV * aspect);
      const len = offset.length();
      if (need > len) offset.multiplyScalar(need / len);
    }
    return {
      position: anchor.clone().add(offset),
      target: anchor.clone().add(preset.targetOffset),
    };
  }

  /**
   * Overview pose: pitched view from +Z (steeper on narrow screens). For a
   * candidate distance, the camera is raised/lowered (pitch kept) until the
   * layout's lowest corner sits on the bottom of the safe area; the closest
   * distance whose corners then also fit the sides and top wins (never past
   * the room's ceiling/front wall).
   */
  private tablePose(aspect: number): Pose {
    const t = this.narrowness(aspect);
    const pitch = THREE.MathUtils.degToRad(
      THREE.MathUtils.lerp(PITCH_BASE, PITCH_NARROW, t),
    );
    const fitX = THREE.MathUtils.lerp(FIT_X_WIDE, FIT_X_NARROW, t);
    const fitTop = THREE.MathUtils.lerp(FIT_TOP_WIDE, FIT_TOP_NARROW, t);
    const fitBottom = THREE.MathUtils.lerp(FIT_BOTTOM_WIDE, FIT_BOTTOM_NARROW, t);
    const target = TABLE_POSE.target.clone();
    const dir = v3(0, Math.sin(pitch), Math.cos(pitch));
    const baseDist = TABLE_POSE.position.distanceTo(TABLE_POSE.target);
    const corners = this.tableCorners;
    if (corners.length === 0) {
      return { position: target.clone().addScaledVector(dir, baseDist), target };
    }
    // Centre horizontally on the layout so asymmetric item spreads fit.
    let minX = Infinity;
    let maxX = -Infinity;
    for (const c of corners) {
      minX = Math.min(minX, c.x);
      maxX = Math.max(maxX, c.x);
    }
    target.x = (minX + maxX) / 2;

    const cam = this.fitCamera;
    cam.fov = this.camera.fov;
    cam.aspect = aspect;
    cam.near = this.camera.near;
    cam.far = this.camera.far;
    cam.updateProjectionMatrix();
    cam.up.copy(WORLD_UP);
    const aim = new THREE.Vector3();
    const extent = { x: 0, minY: 0, maxY: 0 };
    const ceilingLift = (d: number): number =>
      MAX_CAMERA_Y - target.y - d * dir.y;
    // Raise the camera and its aim together (same pitch); once the camera
    // meets the ceiling only the aim keeps rising (the view tilts up).
    const place = (d: number, lift: number, out: THREE.Vector3): THREE.Vector3 =>
      out.copy(target).addScaledVector(dir, d).setY(
        target.y + d * dir.y + Math.min(lift, ceilingLift(d)),
      );
    const measure = (d: number, lift: number): typeof extent => {
      aim.copy(target);
      aim.y += lift;
      place(d, lift, cam.position);
      cam.lookAt(aim);
      cam.updateMatrixWorld();
      extent.x = 0;
      extent.minY = Infinity;
      extent.maxY = -Infinity;
      for (const c of corners) {
        const p = this.fitPoint.copy(c).project(cam);
        extent.x = Math.max(extent.x, Math.abs(p.x));
        extent.minY = Math.min(extent.minY, p.y);
        extent.maxY = Math.max(extent.maxY, p.y);
      }
      return extent;
    };
    // Lift (m) that puts the lowest corner on the bottom edge at distance d.
    const liftFor = (d: number): number => {
      let lo = -0.6;
      let hi = 1.2;
      for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2;
        if (measure(d, mid).minY < -fitBottom) hi = mid;
        else lo = mid;
      }
      return lo;
    };
    const fits = (d: number): boolean => {
      const lift = liftFor(d);
      const e = measure(d, lift);
      return e.x <= fitX && e.maxY <= fitTop && e.minY >= -fitBottom - 0.02;
    };
    const dMax = Math.max(
      MIN_TABLE_DISTANCE,
      (MAX_CAMERA_Z - target.z) / dir.z,
    );
    let d = dMax;
    if (fits(MIN_TABLE_DISTANCE)) {
      d = MIN_TABLE_DISTANCE;
    } else if (fits(dMax)) {
      let lo = MIN_TABLE_DISTANCE;
      let hi = dMax;
      for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) hi = mid;
        else lo = mid;
      }
      d = hi;
    }
    const lift = liftFor(d);
    const position = place(d, lift, new THREE.Vector3());
    target.y += lift;
    return { position, target };
  }

  private killTween(): void {
    if (this.tween) {
      this.tween.kill();
      this.tween = null;
    }
    // Resolve an interrupted transition so awaiting callers never hang;
    // SceneManager's focus token discards the stale settle.
    if (this.resolveActive) {
      this.resolveActive();
      this.resolveActive = null;
    }
  }
}
