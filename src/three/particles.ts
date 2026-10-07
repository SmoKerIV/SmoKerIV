import * as THREE from "three";
import type { Quality } from "./types";
import { TABLE_SURFACE_Y } from "./types";
import { makeDotTexture } from "./models/textures";
import { keepBloomMask } from "./models/materials";
import { FIREBOX, FIRE_POS } from "./roomLayout";

const DUST_COUNT: Record<Quality, number> = { low: 60, medium: 120, high: 240 };
const EMBER_COUNT: Record<Quality, number> = { low: 15, medium: 30, high: 30 };
const SPARKLE_COUNT = 40;
/** Pool for the occasional "ember pop" flare-up (4–6 used per burst). */
const BURST_COUNT = 6;
/** Pool for a candle-snuff smoke wisp (6–10 used per puff, ~1.5 s life). */
const SMOKE_COUNT = 10;
/** Ring pool shared by the fireball's flight trail and its impact burst. */
const FIREBALL_EMBER_COUNT = 48;
/** Embers thrown radially by a fireball impact. */
const FIREBALL_BURST_SIZE = 20;

const BOOK_CENTER = new THREE.Vector3(0, TABLE_SURFACE_Y + 0.22, -0.05);

interface DustSystem {
  points: THREE.Points;
  geometry: THREE.BufferGeometry;
  velocities: Float32Array;
}

interface EmberData {
  life: Float32Array;
  maxLife: Float32Array;
  speed: Float32Array;
  wigglePhase: Float32Array;
  baseX: Float32Array;
  baseZ: Float32Array;
}

/**
 * Three point systems: room dust motes, fireplace embers, and teal
 * sparkles that swirl above the spellbook while it is focused.
 */
export class Particles {
  readonly group = new THREE.Group();

  /** Shared, cached (textures.ts) — released by clearTextureCache(). */
  private readonly dotTexture = makeDotTexture();
  private readonly dustMaterial: THREE.PointsMaterial;
  private readonly emberMaterial: THREE.PointsMaterial;
  private readonly sparkleMaterial: THREE.PointsMaterial;

  private dust: DustSystem;
  private emberGeometry: THREE.BufferGeometry;
  private emberPoints: THREE.Points;
  private embers: EmberData;

  private readonly burstMaterial: THREE.PointsMaterial;
  private readonly burstGeometry: THREE.BufferGeometry;
  private readonly burstPoints: THREE.Points;
  private readonly burstLife = new Float32Array(BURST_COUNT);
  private readonly burstMaxLife = new Float32Array(BURST_COUNT);
  private readonly burstSpeed = new Float32Array(BURST_COUNT);
  private readonly burstDriftX = new Float32Array(BURST_COUNT);
  private readonly burstDriftZ = new Float32Array(BURST_COUNT);

  private readonly smokeMaterial: THREE.PointsMaterial;
  private readonly smokeGeometry: THREE.BufferGeometry;
  private readonly smokePoints: THREE.Points;
  private readonly smokeLife = new Float32Array(SMOKE_COUNT);
  private readonly smokeMaxLife = new Float32Array(SMOKE_COUNT);
  private readonly smokeSpeed = new Float32Array(SMOKE_COUNT);
  private readonly smokeDriftX = new Float32Array(SMOKE_COUNT);
  private readonly smokeDriftZ = new Float32Array(SMOKE_COUNT);
  private readonly smokePhase = new Float32Array(SMOKE_COUNT);

  private readonly fireballMaterial: THREE.PointsMaterial;
  private readonly fireballGeometry: THREE.BufferGeometry;
  private readonly fireballPoints: THREE.Points;
  private readonly fireballLife = new Float32Array(FIREBALL_EMBER_COUNT);
  private readonly fireballMaxLife = new Float32Array(FIREBALL_EMBER_COUNT);
  /** Per-particle world velocity, xyz-interleaved. */
  private readonly fireballVel = new Float32Array(FIREBALL_EMBER_COUNT * 3);
  /** Ring cursor so overlapping casts recycle the oldest particles. */
  private fireballCursor = 0;

  private sparkleGeometry: THREE.BufferGeometry;
  private sparklePoints: THREE.Points;
  private sparkleAngles: Float32Array;
  private sparkleRadii: Float32Array;
  private sparkleHeights: Float32Array;
  private sparkleSpeeds: Float32Array;

  /** 0..1 fade driven toward bookActive each frame. */
  private sparkleAmount = 0;
  private bookActive = false;
  private quality: Quality;

  constructor(quality: Quality) {
    this.quality = quality;
    this.dustMaterial = new THREE.PointsMaterial({
      color: 0xffe9c9,
      size: 0.022,
      map: this.dotTexture,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    // Lit motes, not light: keep them out of the bloom mask.
    keepBloomMask(this.dustMaterial, true);
    this.emberMaterial = new THREE.PointsMaterial({
      size: 0.03,
      map: this.dotTexture,
      transparent: true,
      opacity: 0.9,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.sparkleMaterial = new THREE.PointsMaterial({
      color: 0x55c6b6,
      size: 0.018,
      map: this.dotTexture,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.dust = this.buildDust(DUST_COUNT[quality]);
    this.group.add(this.dust.points);

    const ember = this.buildEmbers(EMBER_COUNT[quality]);
    this.emberGeometry = ember.geometry;
    this.emberPoints = ember.points;
    this.embers = ember.data;
    this.group.add(this.emberPoints);

    // Ember-pop burst pool: larger, brighter sparks, dormant until fired.
    this.burstMaterial = new THREE.PointsMaterial({
      size: 0.05,
      map: this.dotTexture,
      transparent: true,
      opacity: 1,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.burstGeometry = new THREE.BufferGeometry();
    this.burstGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(BURST_COUNT * 3), 3),
    );
    this.burstGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(BURST_COUNT * 3), 3),
    );
    this.burstPoints = new THREE.Points(this.burstGeometry, this.burstMaterial);
    this.burstPoints.frustumCulled = false;
    this.burstPoints.visible = false;
    this.group.add(this.burstPoints);

    // Candle-snuff smoke wisp pool: soft gray motes rising off the wick.
    this.smokeMaterial = new THREE.PointsMaterial({
      size: 0.035,
      map: this.dotTexture,
      transparent: true,
      opacity: 0.55,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    // Lit motes, not light: keep them out of the bloom mask.
    keepBloomMask(this.smokeMaterial, true);
    this.smokeGeometry = new THREE.BufferGeometry();
    this.smokeGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(SMOKE_COUNT * 3), 3),
    );
    this.smokeGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(SMOKE_COUNT * 3), 3),
    );
    this.smokePoints = new THREE.Points(this.smokeGeometry, this.smokeMaterial);
    this.smokePoints.frustumCulled = false;
    this.smokePoints.visible = false;
    this.group.add(this.smokePoints);

    // Fireball ember ring pool: trail sparks in flight, radial burst on hit.
    this.fireballMaterial = new THREE.PointsMaterial({
      size: 0.04,
      map: this.dotTexture,
      transparent: true,
      opacity: 1,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.fireballGeometry = new THREE.BufferGeometry();
    this.fireballGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(FIREBALL_EMBER_COUNT * 3), 3),
    );
    this.fireballGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(FIREBALL_EMBER_COUNT * 3), 3),
    );
    this.fireballPoints = new THREE.Points(
      this.fireballGeometry,
      this.fireballMaterial,
    );
    this.fireballPoints.frustumCulled = false;
    this.fireballPoints.visible = false;
    this.group.add(this.fireballPoints);

    const sparkle = this.buildSparkles();
    this.sparkleGeometry = sparkle.geometry;
    this.sparklePoints = sparkle.points;
    this.sparkleAngles = sparkle.angles;
    this.sparkleRadii = sparkle.radii;
    this.sparkleHeights = sparkle.heights;
    this.sparkleSpeeds = sparkle.speeds;
    this.sparklePoints.visible = false;
    this.group.add(this.sparklePoints);
  }

  /**
   * A one-shot effect is alive (ember pop, smoke wisp, fireball sparks) or
   * the book sparkles are fading — the render loop keeps full rate.
   * Ambient dust/embers don't count.
   */
  get isAnimating(): boolean {
    if (
      this.burstPoints.visible ||
      this.smokePoints.visible ||
      this.fireballPoints.visible
    ) {
      return true;
    }
    const target = this.bookActive ? 1 : 0;
    return Math.abs(target - this.sparkleAmount) > 0.01;
  }

  setBookActive(active: boolean): void {
    this.bookActive = active;
  }

  /** Fire 4–6 bright embers upward out of the hearth (ember pop). */
  burstEmbers(): void {
    const posAttr = this.burstGeometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;
    const count = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      this.burstMaxLife[i] = THREE.MathUtils.randFloat(0.9, 1.5);
      this.burstLife[i] = this.burstMaxLife[i];
      this.burstSpeed[i] = THREE.MathUtils.randFloat(0.9, 1.5);
      // Pop out of the firebox toward the room.
      this.burstDriftX[i] = THREE.MathUtils.randFloat(-0.12, 0.12);
      this.burstDriftZ[i] = THREE.MathUtils.randFloat(0.1, 0.35);
      positions[i * 3] = FIRE_POS.x + THREE.MathUtils.randFloat(-0.4, 0.4) * FIREBOX.w;
      positions[i * 3 + 1] = FIRE_POS.y + THREE.MathUtils.randFloat(0.05, 0.25);
      positions[i * 3 + 2] = FIRE_POS.z + THREE.MathUtils.randFloat(0.0, 0.18);
    }
    posAttr.needsUpdate = true;
    this.burstPoints.visible = true;
  }

  /** Small smoke wisp rising from a just-snuffed candle wick. */
  puffSmoke(origin: THREE.Vector3): void {
    const posAttr = this.smokeGeometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;
    const count = 6 + Math.floor(Math.random() * 5); // 6..10
    for (let i = 0; i < count; i++) {
      this.smokeMaxLife[i] = THREE.MathUtils.randFloat(1.1, 1.6);
      this.smokeLife[i] = this.smokeMaxLife[i];
      this.smokeSpeed[i] = THREE.MathUtils.randFloat(0.1, 0.2);
      this.smokeDriftX[i] = THREE.MathUtils.randFloat(-0.025, 0.025);
      this.smokeDriftZ[i] = THREE.MathUtils.randFloat(-0.025, 0.025);
      this.smokePhase[i] = Math.random() * Math.PI * 2;
      positions[i * 3] = origin.x + THREE.MathUtils.randFloat(-0.008, 0.008);
      positions[i * 3 + 1] = origin.y + THREE.MathUtils.randFloat(0, 0.02);
      positions[i * 3 + 2] =
        origin.z + THREE.MathUtils.randFloat(-0.008, 0.008);
    }
    // Retire any pooled leftovers from a previous puff.
    for (let i = count; i < SMOKE_COUNT; i++) this.smokeLife[i] = 0;
    posAttr.needsUpdate = true;
    this.smokePoints.visible = true;
  }

  /** One short-lived trail spark at the fireball's current position. */
  emitEmberAt(origin: THREE.Vector3): void {
    this.writeFireballEmber(
      origin,
      THREE.MathUtils.randFloat(-0.15, 0.15),
      THREE.MathUtils.randFloat(-0.05, 0.25),
      THREE.MathUtils.randFloat(-0.15, 0.15),
      THREE.MathUtils.randFloat(0.3, 0.6),
    );
  }

  /** Radial ember burst at a fireball impact point. */
  burstEmbersAt(origin: THREE.Vector3, count = FIREBALL_BURST_SIZE): void {
    for (let n = 0; n < count; n++) {
      // Random direction with an upward bias so sparks fountain, not sink.
      const theta = Math.random() * Math.PI * 2;
      const y = THREE.MathUtils.randFloat(-0.2, 1);
      const r = Math.sqrt(Math.max(1 - y * y, 0));
      const speed = THREE.MathUtils.randFloat(0.6, 1.8);
      this.writeFireballEmber(
        origin,
        Math.cos(theta) * r * speed,
        y * speed,
        Math.sin(theta) * r * speed,
        THREE.MathUtils.randFloat(0.45, 0.95),
      );
    }
  }

  update(delta: number, elapsed: number): void {
    this.updateDust(delta);
    this.updateEmbers(delta, elapsed);
    this.updateBurst(delta);
    this.updateSmoke(delta, elapsed);
    this.updateFireballEmbers(delta);
    this.updateSparkles(delta, elapsed);
  }

  setQuality(quality: Quality): void {
    // Rebuilding reseeds every mote; only do it when the counts change.
    if (quality === this.quality) return;
    this.quality = quality;
    this.group.remove(this.dust.points);
    this.dust.geometry.dispose();
    this.dust = this.buildDust(DUST_COUNT[quality]);
    this.group.add(this.dust.points);

    this.group.remove(this.emberPoints);
    this.emberGeometry.dispose();
    const ember = this.buildEmbers(EMBER_COUNT[quality]);
    this.emberGeometry = ember.geometry;
    this.emberPoints = ember.points;
    this.embers = ember.data;
    this.group.add(this.emberPoints);
  }

  dispose(): void {
    this.dust.geometry.dispose();
    this.emberGeometry.dispose();
    this.burstGeometry.dispose();
    this.smokeGeometry.dispose();
    this.fireballGeometry.dispose();
    this.sparkleGeometry.dispose();
    this.dustMaterial.dispose();
    this.emberMaterial.dispose();
    this.burstMaterial.dispose();
    this.smokeMaterial.dispose();
    this.fireballMaterial.dispose();
    this.sparkleMaterial.dispose();
  }

  private buildDust(count: number): DustSystem {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = THREE.MathUtils.randFloat(-3.2, 3.2);
      positions[i * 3 + 1] = THREE.MathUtils.randFloat(0.3, 2.9);
      positions[i * 3 + 2] = THREE.MathUtils.randFloat(-3.2, 3.2);
      velocities[i * 3] = THREE.MathUtils.randFloat(-0.03, 0.03);
      velocities[i * 3 + 1] = THREE.MathUtils.randFloat(-0.015, 0.02);
      velocities[i * 3 + 2] = THREE.MathUtils.randFloat(-0.03, 0.03);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geometry, this.dustMaterial);
    points.frustumCulled = false;
    return { points, geometry, velocities };
  }

  private updateDust(delta: number): void {
    const attr = this.dust.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const positions = attr.array as Float32Array;
    const vel = this.dust.velocities;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] += vel[i] * delta;
      positions[i + 1] += vel[i + 1] * delta;
      positions[i + 2] += vel[i + 2] * delta;
      // Wrap within the room volume.
      if (positions[i] > 3.3) positions[i] = -3.3;
      else if (positions[i] < -3.3) positions[i] = 3.3;
      if (positions[i + 1] > 3.0) positions[i + 1] = 0.3;
      else if (positions[i + 1] < 0.2) positions[i + 1] = 2.9;
      if (positions[i + 2] > 3.3) positions[i + 2] = -3.3;
      else if (positions[i + 2] < -3.3) positions[i + 2] = 3.3;
    }
    attr.needsUpdate = true;
  }

  private buildEmbers(count: number): {
    geometry: THREE.BufferGeometry;
    points: THREE.Points;
    data: EmberData;
  } {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const data: EmberData = {
      life: new Float32Array(count),
      maxLife: new Float32Array(count),
      speed: new Float32Array(count),
      wigglePhase: new Float32Array(count),
      baseX: new Float32Array(count),
      baseZ: new Float32Array(count),
    };
    for (let i = 0; i < count; i++) {
      this.respawnEmber(positions, data, i);
      // Stagger initial lifetimes so embers don't pulse in sync.
      data.life[i] = Math.random() * data.maxLife[i];
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const points = new THREE.Points(geometry, this.emberMaterial);
    points.frustumCulled = false;
    return { geometry, points, data };
  }

  private respawnEmber(
    positions: Float32Array,
    data: EmberData,
    i: number,
  ): void {
    // Inside the firebox; they rise and vanish up the flue.
    data.baseX[i] = FIRE_POS.x + THREE.MathUtils.randFloat(-0.4, 0.4) * FIREBOX.w;
    data.baseZ[i] = FIRE_POS.z + THREE.MathUtils.randFloat(-0.1, 0.16);
    data.maxLife[i] = THREE.MathUtils.randFloat(0.9, 1.8);
    data.life[i] = data.maxLife[i];
    data.speed[i] = THREE.MathUtils.randFloat(0.25, 0.55);
    data.wigglePhase[i] = Math.random() * Math.PI * 2;
    positions[i * 3] = data.baseX[i];
    positions[i * 3 + 1] = FIRE_POS.y + THREE.MathUtils.randFloat(0.02, 0.2);
    positions[i * 3 + 2] = data.baseZ[i];
  }

  private updateEmbers(delta: number, elapsed: number): void {
    const posAttr = this.emberGeometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const colorAttr = this.emberGeometry.getAttribute(
      "color",
    ) as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;
    const colors = colorAttr.array as Float32Array;
    const data = this.embers;
    for (let i = 0; i < data.life.length; i++) {
      data.life[i] -= delta;
      if (data.life[i] <= 0) this.respawnEmber(positions, data, i);
      positions[i * 3 + 1] += data.speed[i] * delta;
      const wiggle = elapsed * 3.5 + data.wigglePhase[i];
      positions[i * 3] = data.baseX[i] + Math.sin(wiggle) * 0.06;
      positions[i * 3 + 2] = data.baseZ[i] + Math.cos(wiggle * 0.7) * 0.06;
      // Additive blending: fading to black fades the ember out.
      const t = Math.max(data.life[i] / data.maxLife[i], 0);
      colors[i * 3] = t;
      colors[i * 3 + 1] = t * 0.45;
      colors[i * 3 + 2] = t * 0.1;
    }
    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
  }

  private updateBurst(delta: number): void {
    if (!this.burstPoints.visible) return;
    const posAttr = this.burstGeometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const colorAttr = this.burstGeometry.getAttribute(
      "color",
    ) as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;
    const colors = colorAttr.array as Float32Array;
    let anyAlive = false;
    for (let i = 0; i < BURST_COUNT; i++) {
      if (this.burstLife[i] <= 0) {
        colors[i * 3] = 0;
        colors[i * 3 + 1] = 0;
        colors[i * 3 + 2] = 0;
        continue;
      }
      anyAlive = true;
      this.burstLife[i] -= delta;
      positions[i * 3] += this.burstDriftX[i] * delta;
      positions[i * 3 + 1] += this.burstSpeed[i] * delta;
      positions[i * 3 + 2] += this.burstDriftZ[i] * delta;
      // Hotter than the ambient embers: near-white core fading to orange.
      const t = Math.max(this.burstLife[i] / this.burstMaxLife[i], 0);
      colors[i * 3] = Math.min(t * 1.6, 1);
      colors[i * 3 + 1] = t * 0.7;
      colors[i * 3 + 2] = t * 0.2;
    }
    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    if (!anyAlive) this.burstPoints.visible = false;
  }

  private updateSmoke(delta: number, elapsed: number): void {
    if (!this.smokePoints.visible) return;
    const posAttr = this.smokeGeometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const colorAttr = this.smokeGeometry.getAttribute(
      "color",
    ) as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;
    const colors = colorAttr.array as Float32Array;
    let anyAlive = false;
    for (let i = 0; i < SMOKE_COUNT; i++) {
      if (this.smokeLife[i] <= 0) {
        colors[i * 3] = 0;
        colors[i * 3 + 1] = 0;
        colors[i * 3 + 2] = 0;
        continue;
      }
      anyAlive = true;
      this.smokeLife[i] -= delta;
      const waver = Math.sin(elapsed * 2.2 + this.smokePhase[i]) * 0.015;
      positions[i * 3] += (this.smokeDriftX[i] + waver) * delta;
      positions[i * 3 + 1] += this.smokeSpeed[i] * delta;
      positions[i * 3 + 2] += this.smokeDriftZ[i] * delta;
      // Additive blending: fading the gray to black fades the wisp out.
      const t = Math.max(this.smokeLife[i] / this.smokeMaxLife[i], 0);
      colors[i * 3] = t * 0.42;
      colors[i * 3 + 1] = t * 0.44;
      colors[i * 3 + 2] = t * 0.47;
    }
    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    if (!anyAlive) this.smokePoints.visible = false;
  }

  private writeFireballEmber(
    origin: THREE.Vector3,
    vx: number,
    vy: number,
    vz: number,
    life: number,
  ): void {
    const i = this.fireballCursor;
    this.fireballCursor = (i + 1) % FIREBALL_EMBER_COUNT;
    this.fireballMaxLife[i] = life;
    this.fireballLife[i] = life;
    this.fireballVel[i * 3] = vx;
    this.fireballVel[i * 3 + 1] = vy;
    this.fireballVel[i * 3 + 2] = vz;
    const posAttr = this.fireballGeometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;
    positions[i * 3] = origin.x + THREE.MathUtils.randFloat(-0.01, 0.01);
    positions[i * 3 + 1] = origin.y + THREE.MathUtils.randFloat(-0.01, 0.01);
    positions[i * 3 + 2] = origin.z + THREE.MathUtils.randFloat(-0.01, 0.01);
    posAttr.needsUpdate = true;
    this.fireballPoints.visible = true;
  }

  private updateFireballEmbers(delta: number): void {
    if (!this.fireballPoints.visible) return;
    const posAttr = this.fireballGeometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const colorAttr = this.fireballGeometry.getAttribute(
      "color",
    ) as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;
    const colors = colorAttr.array as Float32Array;
    let anyAlive = false;
    for (let i = 0; i < FIREBALL_EMBER_COUNT; i++) {
      if (this.fireballLife[i] <= 0) {
        colors[i * 3] = 0;
        colors[i * 3 + 1] = 0;
        colors[i * 3 + 2] = 0;
        continue;
      }
      anyAlive = true;
      this.fireballLife[i] -= delta;
      // Light gravity so burst sparks arc down instead of drifting forever.
      this.fireballVel[i * 3 + 1] -= 2.2 * delta;
      positions[i * 3] += this.fireballVel[i * 3] * delta;
      positions[i * 3 + 1] += this.fireballVel[i * 3 + 1] * delta;
      positions[i * 3 + 2] += this.fireballVel[i * 3 + 2] * delta;
      // White-hot core cooling to deep orange as it dies.
      const t = Math.max(this.fireballLife[i] / this.fireballMaxLife[i], 0);
      colors[i * 3] = Math.min(t * 1.8, 1);
      colors[i * 3 + 1] = t * 0.6;
      colors[i * 3 + 2] = t * 0.15;
    }
    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    if (!anyAlive) this.fireballPoints.visible = false;
  }

  private buildSparkles(): {
    geometry: THREE.BufferGeometry;
    points: THREE.Points;
    angles: Float32Array;
    radii: Float32Array;
    heights: Float32Array;
    speeds: Float32Array;
  } {
    const positions = new Float32Array(SPARKLE_COUNT * 3);
    const angles = new Float32Array(SPARKLE_COUNT);
    const radii = new Float32Array(SPARKLE_COUNT);
    const heights = new Float32Array(SPARKLE_COUNT);
    const speeds = new Float32Array(SPARKLE_COUNT);
    for (let i = 0; i < SPARKLE_COUNT; i++) {
      angles[i] = Math.random() * Math.PI * 2;
      radii[i] = THREE.MathUtils.randFloat(0.08, 0.3);
      heights[i] = THREE.MathUtils.randFloat(0, 0.28);
      speeds[i] = THREE.MathUtils.randFloat(0.5, 1.4);
      positions[i * 3] = BOOK_CENTER.x;
      positions[i * 3 + 1] = BOOK_CENTER.y;
      positions[i * 3 + 2] = BOOK_CENTER.z;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geometry, this.sparkleMaterial);
    points.frustumCulled = false;
    return { geometry, points, angles, radii, heights, speeds };
  }

  private updateSparkles(delta: number, elapsed: number): void {
    const target = this.bookActive ? 1 : 0;
    this.sparkleAmount +=
      (target - this.sparkleAmount) * Math.min(delta * 3, 1);
    this.sparkleMaterial.opacity = this.sparkleAmount * 0.85;
    const visible = this.sparkleAmount > 0.01;
    this.sparklePoints.visible = visible;
    if (!visible) return;

    const attr = this.sparkleGeometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const positions = attr.array as Float32Array;
    for (let i = 0; i < SPARKLE_COUNT; i++) {
      const angle = this.sparkleAngles[i] + elapsed * this.sparkleSpeeds[i];
      const bob = Math.sin(elapsed * 1.3 + this.sparkleAngles[i]) * 0.05;
      positions[i * 3] = BOOK_CENTER.x + Math.cos(angle) * this.sparkleRadii[i];
      positions[i * 3 + 1] = BOOK_CENTER.y + this.sparkleHeights[i] + bob;
      positions[i * 3 + 2] =
        BOOK_CENTER.z + Math.sin(angle) * this.sparkleRadii[i];
    }
    attr.needsUpdate = true;
  }
}
