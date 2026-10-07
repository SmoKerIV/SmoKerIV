import * as THREE from "three";
import gsap from "gsap";
import type { ItemId } from "./types";

interface Pose {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

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

/** Portrait screens can't frame the whole spread — center on the tome. */
const PORTRAIT_ASPECT = 0.9;
const TABLE_POSE_PORTRAIT: Pose = {
  position: v3(0, 1.62, 1.05),
  target: v3(0, 0.97, -0.05),
};

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
const READING_TARGET_OFFSET = v3(-0.24, 0.005, -0.01);
const SPREAD_WIDTH = 0.9;
/**
 * Near-perfect top-down reading pose (≈1° toward the reader — just enough
 * for lookAt's up vector to stay stable). Straight-down matters: the page
 * planes then project to exact rectangles, so the DOM ink can be pinned
 * with flat 2D transforms. Perspective matrix3d layers made Chromium
 * intermittently blank the text; 2D transforms never hit that path.
 */
const READING_TILT = { y: 0.99995, z: 0.01 };

const FOCUS_DURATION = 1.6;
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

  private readonly parallaxTarget = new THREE.Vector2();
  private readonly parallax = new THREE.Vector2();

  private reducedMotion: boolean;
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
  registerAnchor(item: ItemId, anchor: THREE.Vector3): void {
    this.anchors.set(item, anchor.clone());
  }

  /** Tween the base pose toward an item (or the table when null). */
  focusTo(item: ItemId | null): Promise<void> {
    this.killTween();
    this.currentItem = item;
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
    this.camera.updateProjectionMatrix();
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

  /** Freeze idle sway/parallax while the tome is being read. */
  setReading(reading: boolean): void {
    this.swayScale = reading ? 0 : 1;
  }

  dispose(): void {
    this.killTween();
    window.removeEventListener("pointermove", this.onPointerMove);
  }

  private upFor(item: ItemId | null): THREE.Vector3 {
    return item === "spellbook" ? READING_UP : WORLD_UP;
  }

  private poseFor(item: ItemId | null): Pose {
    if (item === null) {
      // Portrait (mobile): the tome is the site — keep the view centered on
      // it instead of the table's middle, so it never drifts off to a side.
      const aspect = this.camera.aspect || 1.6;
      if (aspect < PORTRAIT_ASPECT) {
        const book = this.anchors.get("spellbook");
        const x = book ? book.x : 0;
        return {
          position: TABLE_POSE_PORTRAIT.position.clone().setX(x),
          target: TABLE_POSE_PORTRAIT.target.clone().setX(x),
        };
      }
      return {
        position: TABLE_POSE.position.clone(),
        target: TABLE_POSE.target.clone(),
      };
    }
    const anchor = this.anchors.get(item) ?? TABLE_POSE.target;
    if (item === "spellbook") {
      // Aspect-aware reading pose: distance chosen so the open spread fills
      // ~88% of the frustum width, clamped to sane bounds.
      const aspect = this.camera.aspect || 1.6;
      const halfTan = Math.tan((this.camera.fov * Math.PI) / 360);
      const d = THREE.MathUtils.clamp(
        SPREAD_WIDTH / (0.88 * 2 * halfTan * aspect),
        0.62,
        1.4,
      );
      const target = anchor.clone().add(READING_TARGET_OFFSET);
      const position = target
        .clone()
        .add(v3(0, d * READING_TILT.y, d * READING_TILT.z));
      return { position, target };
    }
    const preset = FOCUS_PRESETS[item];
    return {
      position: anchor.clone().add(preset.offset),
      target: anchor.clone().add(preset.targetOffset),
    };
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
