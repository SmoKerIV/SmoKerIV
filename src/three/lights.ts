import * as THREE from "three";
import type { Quality } from "./types";

interface Flicker {
  light: THREE.PointLight;
  flame: THREE.Mesh;
  baseIntensity: number;
  phase: number;
  speed: number;
  /** 0 = snuffed, 1 = burning; eased toward litTarget in update(). */
  lit: number;
  litTarget: number;
}

// Night = the hand-tuned baseline; day lerps toward these targets.
const MOON_NIGHT = new THREE.Color(0x4a6fa5);
const MOON_DAY = new THREE.Color(0xffd9a3);
const HEMI_SKY_NIGHT = new THREE.Color(0x1a1f2e);
const HEMI_SKY_DAY = new THREE.Color(0x7c86a0);
const HEMI_GROUND_NIGHT = new THREE.Color(0x2a1a10);
const HEMI_GROUND_DAY = new THREE.Color(0x54402c);
const MOON_INTENSITY_NIGHT = 0.4;
const MOON_INTENSITY_DAY = 1.6;
const HEMI_INTENSITY_NIGHT = 0.22;
const HEMI_INTENSITY_DAY = 0.45;
/** Candles and fire fall to this fraction in full daylight. */
const FLAME_DAY_DIM = 0.6;

const FIRE_BASE = 7;
const GUTTER_DURATION = 1.2;
const FLARE_DURATION = 0.4;
/** Candle light fade in/out on snuff/relight (seconds). */
const SNUFF_FADE = 0.4;
/** Fireball impact flash: instant spike, quadratic decay. */
const IMPACT_FLASH_DURATION = 0.5;
const IMPACT_FLASH_PEAK = 14;

/**
 * All scene lighting for the inn. Exactly one shadow-casting light
 * (a soft warm spot from above the fireplace side) to keep the budget
 * at a single 1024 shadow map.
 */
export class Lights {
  readonly group = new THREE.Group();

  private readonly fire: THREE.PointLight;
  private readonly keySpot: THREE.SpotLight;
  private readonly moon: THREE.DirectionalLight;
  private readonly hemi: THREE.HemisphereLight;
  /** Warm fill that substitutes for candle point lights on low quality. */
  private readonly lowFill: THREE.AmbientLight;
  private readonly arcane: THREE.PointLight;
  /** Dormant fireball-impact flash, repositioned per cast. */
  private readonly impactFlash: THREE.PointLight;
  private readonly candleFlickers: Flicker[] = [];

  private quality: Quality;
  private arcaneLevel = 0;
  /** 0 = night (baseline), 1 = day; tweened by SceneManager. */
  private dayFactor = 0;
  private reducedMotion = false;

  // Idle-life state machines, all driven by the render-loop clock.
  private nextGutterAt = 45 + Math.random() * 45;
  private gutterIndex = -1;
  private gutterStart = 0;
  private flareStart = -1;
  private impactFlashStart = -1;
  private lastElapsed = 0;

  constructor(quality: Quality) {
    this.quality = quality;

    // Fireplace glow from the -X wall recess, flickers in update().
    this.fire = new THREE.PointLight(0xff7a30, 7, 9, 2);
    this.fire.position.set(-3.0, 1.3, 0);
    this.group.add(this.fire);

    // The one shadow caster: warm soft spot from above-left of the table.
    // Kept dim and tight — the room should read candle-lit, not floodlit.
    this.keySpot = new THREE.SpotLight(0xffc78e, 16, 12, 0.5, 0.9, 1.6);
    this.keySpot.position.set(-1.6, 3.0, 1.2);
    this.keySpot.target.position.set(0, 0.95, -0.15);
    this.keySpot.castShadow = true;
    this.keySpot.shadow.mapSize.set(1024, 1024);
    this.keySpot.shadow.bias = -0.0004;
    this.keySpot.shadow.camera.near = 0.5;
    this.keySpot.shadow.camera.far = 8;
    this.group.add(this.keySpot, this.keySpot.target);

    // Cool moonlight rim through the -Z window.
    this.moon = new THREE.DirectionalLight(0x4a6fa5, 0.4);
    this.moon.position.set(0.8, 2.6, -3.4);
    this.moon.target.position.set(0, 1.0, 0);
    this.group.add(this.moon, this.moon.target);

    this.hemi = new THREE.HemisphereLight(0x1a1f2e, 0x2a1a10, 0.22);
    this.group.add(this.hemi);

    this.lowFill = new THREE.AmbientLight(0x35241a, 0.55);
    this.lowFill.visible = false;
    this.group.add(this.lowFill);

    // Arcane teal above the spellbook, driven by setArcane (rune glow).
    this.arcane = new THREE.PointLight(0x55c6b6, 0, 3, 2);
    this.arcane.position.set(0, 1.45, -0.05);
    this.group.add(this.arcane);

    // Fireball impact flash, dormant until flashAt() is called.
    this.impactFlash = new THREE.PointLight(0xff8a3d, 0, 7, 2);
    this.impactFlash.visible = false;
    this.group.add(this.impactFlash);

    this.setQuality(quality);
  }

  /**
   * Parent a flickering candle light next to a candle's flame mesh.
   * The light sits beside the flame (same parent), not under it, so the
   * flame mesh can be hidden on snuff while the light fades out on its own.
   */
  attachCandle(flame: THREE.Mesh): void {
    const light = new THREE.PointLight(0xffb46b, 2.4, 2.5, 2);
    const parent = flame.parent ?? flame;
    light.position.copy(flame.position);
    light.position.y += 0.02;
    light.visible = this.quality !== "low";
    parent.add(light);
    this.candleFlickers.push({
      light,
      flame,
      baseIntensity: 2.4,
      phase: Math.random() * Math.PI * 2,
      speed: 6 + Math.random() * 3,
      lit: 1,
      litTarget: 1,
    });
  }

  /** Snuff (lit=false) or relight a candle; the light fades over 0.4 s. */
  setCandleLit(flame: THREE.Mesh, lit: boolean): void {
    const index = this.candleFlickers.findIndex((f) => f.flame === flame);
    if (index < 0) return;
    this.candleFlickers[index].litTarget = lit ? 1 : 0;
    // A snuffed candle can't gutter.
    if (!lit && this.gutterIndex === index) this.cancelGutter();
  }

  /** 0..1, mirrors the rune circle glow during book focus. */
  setArcane(value: number): void {
    this.arcaneLevel = value;
  }

  /** 0 = night baseline, 1 = full day; safe to call every tween tick. */
  setDayFactor(value: number): void {
    this.dayFactor = value;
    this.moon.color.lerpColors(MOON_NIGHT, MOON_DAY, value);
    this.moon.intensity = THREE.MathUtils.lerp(
      MOON_INTENSITY_NIGHT,
      MOON_INTENSITY_DAY,
      value,
    );
    this.hemi.color.lerpColors(HEMI_SKY_NIGHT, HEMI_SKY_DAY, value);
    this.hemi.groundColor.lerpColors(HEMI_GROUND_NIGHT, HEMI_GROUND_DAY, value);
    this.hemi.intensity = THREE.MathUtils.lerp(
      HEMI_INTENSITY_NIGHT,
      HEMI_INTENSITY_DAY,
      value,
    );
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    if (reduced) this.cancelGutter();
  }

  /** Brief fireplace flare (+40% over 0.4 s), paired with an ember burst. */
  igniteFlare(elapsed: number): void {
    this.flareStart = elapsed;
  }

  /**
   * Bright fireball detonation flash at a world position. Re-triggering
   * mid-decay simply restarts the spike (safe for rapid re-casts).
   */
  flashAt(position: THREE.Vector3, elapsed: number): void {
    this.impactFlash.position.copy(position);
    this.impactFlashStart = elapsed;
    this.impactFlash.visible = true;
  }

  update(elapsed: number): void {
    // Local delta for the snuff fades (update only receives elapsed).
    const delta = THREE.MathUtils.clamp(elapsed - this.lastElapsed, 0, 0.1);
    this.lastElapsed = elapsed;

    // Candles and fire dim toward 60% in full daylight.
    const flameDim = THREE.MathUtils.lerp(1, FLAME_DAY_DIM, this.dayFactor);

    // Sin-mix "noise" flicker, roughly +/-10%.
    const fireMix =
      Math.sin(elapsed * 7.3) * 0.6 + Math.sin(elapsed * 13.1 + 1.7) * 0.4;
    let fireBase = FIRE_BASE * flameDim;
    if (this.flareStart >= 0) {
      const t = (elapsed - this.flareStart) / FLARE_DURATION;
      if (t >= 1) this.flareStart = -1;
      else fireBase *= 1 + 0.4 * Math.sin(Math.PI * t);
    }
    this.fire.intensity = fireBase * (1 + 0.1 * fireMix);

    if (this.impactFlashStart >= 0) {
      const t = (elapsed - this.impactFlashStart) / IMPACT_FLASH_DURATION;
      if (t >= 1) {
        this.impactFlashStart = -1;
        this.impactFlash.intensity = 0;
        this.impactFlash.visible = false;
      } else {
        this.impactFlash.intensity = IMPACT_FLASH_PEAK * (1 - t) * (1 - t);
      }
    }

    this.updateGutterSchedule(elapsed);

    const fadeStep = delta / SNUFF_FADE;
    for (let i = 0; i < this.candleFlickers.length; i++) {
      const f = this.candleFlickers[i];
      // Ease toward the snuff/relight target at the 0.4 s fade rate.
      if (f.lit !== f.litTarget) {
        f.lit =
          f.lit < f.litTarget
            ? Math.min(f.lit + fadeStep, f.litTarget)
            : Math.max(f.lit - fadeStep, f.litTarget);
      }
      const mix =
        Math.sin(elapsed * f.speed + f.phase) * 0.55 +
        Math.sin(elapsed * f.speed * 2.7 + f.phase * 1.9) * 0.45;
      let intensity = f.baseIntensity * flameDim * (1 + 0.12 * mix);
      if (i === this.gutterIndex) {
        const t = (elapsed - this.gutterStart) / GUTTER_DURATION;
        if (t >= 1) {
          this.gutterIndex = -1;
          f.flame.scale.setScalar(1);
        } else {
          // Dip toward ~45% at mid-gutter with a fast waver on the depth.
          const envelope = Math.sin(Math.PI * t);
          intensity *= 1 - envelope * (0.55 - 0.1 * Math.sin(elapsed * 47));
          f.flame.scale.setScalar(1 - 0.22 * envelope);
        }
      }
      f.light.intensity = intensity * f.lit;
    }

    const pulse = 1 + 0.08 * Math.sin(elapsed * 2.1);
    this.arcane.intensity = this.arcaneLevel * 2.2 * pulse;
  }

  setQuality(quality: Quality): void {
    this.quality = quality;
    const candlesOn = quality !== "low";
    for (const { light } of this.candleFlickers) light.visible = candlesOn;
    this.lowFill.visible = !candlesOn;
    this.keySpot.castShadow = candlesOn;
    if (!candlesOn) this.cancelGutter();
  }

  dispose(): void {
    this.keySpot.shadow.dispose();
    for (const { light } of this.candleFlickers) light.removeFromParent();
    this.candleFlickers.length = 0;
  }

  // ----------------------------------------------------------------- private

  private updateGutterSchedule(elapsed: number): void {
    if (this.gutterIndex >= 0 || elapsed < this.nextGutterAt) return;
    this.nextGutterAt = elapsed + 45 + Math.random() * 45;
    if (this.reducedMotion || this.quality === "low") return;
    // Only burning candles may gutter — snuffed ones stay dark and still.
    const litIndices: number[] = [];
    for (let i = 0; i < this.candleFlickers.length; i++) {
      if (this.candleFlickers[i].litTarget > 0.5) litIndices.push(i);
    }
    if (litIndices.length === 0) return;
    this.gutterIndex =
      litIndices[Math.floor(Math.random() * litIndices.length)];
    this.gutterStart = elapsed;
  }

  private cancelGutter(): void {
    if (this.gutterIndex < 0) return;
    this.candleFlickers[this.gutterIndex].flame.scale.setScalar(1);
    this.gutterIndex = -1;
  }
}
