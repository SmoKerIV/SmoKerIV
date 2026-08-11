/**
 * Minimal rigid-body integrator for the d20: gravity, table bounces with
 * energy loss, soft table bounds (plus the spellbook treated as a wall),
 * and a settle phase that snaps the nearest face flat under +Y and reports
 * the REAL top-face value so the toast never lies.
 *
 * The dice group's pivot rests at the face contact point (see models/dice.ts),
 * so the simulation tracks the die CENTER and derives the group transform:
 * group.position = center − orientation * (0, inradius, 0).
 */
import * as THREE from "three";
import gsap from "gsap";

const GRAVITY = -9.8;
const FIXED_DT = 1 / 120;
const MAX_SUBSTEPS = 10;

// Toss parameters (m/s, rad/s).
const TOSS_UP_MIN = 1.6;
const TOSS_UP_MAX = 2.2;
const TOSS_SIDE_MIN = 0.5;
const TOSS_SIDE_MAX = 0.9;
const SPIN_MIN = 10;
const SPIN_MAX = 18;

// Bounce response.
const RESTITUTION = 0.35;
const TANGENT_DAMP = 0.7;
const SPIN_DAMP = 0.65;
/** Random torque kick per bounce so the tumble stays alive (rad/s). */
const BOUNCE_KICK = 3;
/** Vertical speed below which an impact stops bouncing and starts rolling. */
const BOUNCE_MIN_SPEED = 0.2;

// Ground drag while rolling flat (exponential rates, 1/s).
const GROUND_LIN_DRAG = 4;
const GROUND_ANG_DRAG = 3.2;

// Settle thresholds.
const SETTLE_SPEED = 0.15;
const SETTLE_SPIN = 1.5;
const MAX_ROLL_SECONDS = 4;
const SNAP_DURATION = 0.25;

// Soft table bounds and the spellbook footprint (world XZ).
const BOUND_X = 1.0;
const BOUND_Z_MIN = -0.6;
const BOUND_Z_MAX = 0.35;
const BOOK = { minX: 0.05, maxX: 0.55, minZ: -0.28, maxZ: 0.18 };
/** Energy kept when glancing off a soft bound / the book. */
const WALL_BOUNCE = 0.8;

const UP = new THREE.Vector3(0, 1, 0);

function randSpin(): number {
  return (
    THREE.MathUtils.randFloat(SPIN_MIN, SPIN_MAX) *
    (Math.random() < 0.5 ? -1 : 1)
  );
}

export class DicePhysics {
  private readonly group: THREE.Group;
  private readonly tableY: number;
  private readonly onResult: (value: number) => void;

  /** Center-to-face distance; the die rests with its center this high. */
  private readonly inradius: number;
  /** Face normals in group-local space, index-aligned with faceValues. */
  private readonly faceNormals: THREE.Vector3[] = [];
  /** Canonical face-index → 1..20 map (opposite faces sum to 21). */
  private readonly faceValues: number[] = [];

  private rolling = false;
  private rollElapsed = 0;
  private accumulator = 0;
  private readonly center = new THREE.Vector3();
  private readonly velocity = new THREE.Vector3();
  private readonly angularVelocity = new THREE.Vector3();
  private readonly orientation = new THREE.Quaternion();
  private snapTween: gsap.core.Tween | null = null;

  private readonly stepQuat = new THREE.Quaternion();
  private readonly scratch = new THREE.Vector3();
  private readonly pivotOffset = new THREE.Vector3();

  constructor(
    group: THREE.Group,
    tableY: number,
    onResult: (value: number) => void,
  ) {
    this.group = group;
    this.tableY = tableY;
    this.onResult = onResult;

    // Find the icosahedron mesh; its geometry defines faces and inradius,
    // its baked rest rotation maps them into group-local space.
    let die: THREE.Mesh | null = null;
    group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!die && mesh.isMesh && mesh.geometry.type === "IcosahedronGeometry") {
        die = mesh;
      }
    });
    const dieMesh = die as THREE.Mesh | null;
    const geometry = dieMesh
      ? (dieMesh.geometry as THREE.BufferGeometry)
      : new THREE.IcosahedronGeometry(0.045);
    const rotation = new THREE.Matrix4();
    if (dieMesh) {
      dieMesh.updateMatrix();
      rotation.extractRotation(dieMesh.matrix);
    }

    const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    let inradius = 0;
    const faceCount = Math.floor(pos.count / 3);
    for (let f = 0; f < faceCount; f++) {
      a.fromBufferAttribute(pos, f * 3);
      b.fromBufferAttribute(pos, f * 3 + 1);
      c.fromBufferAttribute(pos, f * 3 + 2);
      const normal = new THREE.Vector3()
        .subVectors(b, a)
        .cross(this.scratch.subVectors(c, a))
        .normalize();
      if (f === 0) inradius = Math.abs(a.dot(normal));
      // Rotation-only matrix, so transforming the normal directly is valid.
      normal.applyMatrix4(rotation).normalize();
      this.faceNormals.push(normal);
    }
    this.inradius = inradius || 0.0357;
    this.assignFaceValues();
  }

  get isRolling(): boolean {
    return this.rolling || this.snapTween !== null;
  }

  /** Toss the die from wherever it currently rests. */
  roll(reducedMotion: boolean): void {
    if (this.isRolling) return;
    this.rolling = true;
    this.rollElapsed = 0;
    this.accumulator = 0;

    // Read the current group transform back into center-space state.
    this.orientation.copy(this.group.quaternion);
    this.pivotOffset.set(0, this.inradius, 0).applyQuaternion(this.orientation);
    this.center.copy(this.group.position).add(this.pivotOffset);

    // Reduced motion keeps the physics (it's brief) but halves the toss.
    const toss = reducedMotion ? 0.5 : 1;
    // Bias the horizontal throw back toward the table center so soft
    // bounds rarely have to intervene.
    const side = THREE.MathUtils.randFloat(TOSS_SIDE_MIN, TOSS_SIDE_MAX) * toss;
    const toCenter = Math.atan2(-0.15 - this.center.z, -this.center.x);
    const angle = toCenter + THREE.MathUtils.randFloat(-0.9, 0.9);
    this.velocity.set(
      Math.cos(angle) * side,
      THREE.MathUtils.randFloat(TOSS_UP_MIN, TOSS_UP_MAX) * toss,
      Math.sin(angle) * side,
    );
    this.angularVelocity.set(randSpin(), randSpin(), randSpin());
  }

  /** Advance the simulation; call once per rendered frame. */
  update(delta: number): void {
    if (!this.rolling) return;
    this.accumulator += Math.min(delta, 0.1);
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_SUBSTEPS) {
      this.accumulator -= FIXED_DT;
      steps++;
      this.step(FIXED_DT);
      if (!this.rolling) return; // settled mid-frame; snap tween owns it now
    }
    if (steps === MAX_SUBSTEPS) this.accumulator = 0;
    this.syncGroup();
  }

  dispose(): void {
    this.snapTween?.kill();
    this.snapTween = null;
    this.rolling = false;
  }

  // ----------------------------------------------------------------- private

  private step(dt: number): void {
    this.rollElapsed += dt;
    this.velocity.y += GRAVITY * dt;
    this.center.addScaledVector(this.velocity, dt);

    const spin = this.angularVelocity.length();
    if (spin > 1e-6) {
      this.scratch.copy(this.angularVelocity).multiplyScalar(1 / spin);
      this.stepQuat.setFromAxisAngle(this.scratch, spin * dt);
      this.orientation.premultiply(this.stepQuat).normalize();
    }

    const restY = this.tableY + this.inradius;
    let grounded = false;
    if (this.center.y <= restY) {
      this.center.y = restY;
      grounded = true;
      if (this.velocity.y < 0) {
        if (-this.velocity.y > BOUNCE_MIN_SPEED) {
          this.velocity.y = -this.velocity.y * RESTITUTION;
          this.velocity.x *= TANGENT_DAMP;
          this.velocity.z *= TANGENT_DAMP;
          this.angularVelocity.multiplyScalar(SPIN_DAMP);
          // Small random torque kick so each clatter looks alive.
          this.angularVelocity.x += THREE.MathUtils.randFloatSpread(BOUNCE_KICK * 2);
          this.angularVelocity.y += THREE.MathUtils.randFloatSpread(BOUNCE_KICK * 2);
          this.angularVelocity.z += THREE.MathUtils.randFloatSpread(BOUNCE_KICK * 2);
        } else {
          this.velocity.y = 0;
        }
      }
    }

    if (grounded) {
      const lin = Math.exp(-GROUND_LIN_DRAG * dt);
      this.velocity.x *= lin;
      this.velocity.z *= lin;
      this.angularVelocity.multiplyScalar(Math.exp(-GROUND_ANG_DRAG * dt));
    }

    this.applyBounds();

    const settled =
      grounded &&
      Math.abs(this.velocity.y) < 0.05 &&
      Math.hypot(this.velocity.x, this.velocity.z) < SETTLE_SPEED &&
      this.angularVelocity.length() < SETTLE_SPIN;
    if (settled || this.rollElapsed > MAX_ROLL_SECONDS) this.beginSnap();
  }

  /** Reflect off the soft table bounds and the spellbook's footprint. */
  private applyBounds(): void {
    const c = this.center;
    const v = this.velocity;
    if (c.x > BOUND_X) {
      c.x = BOUND_X;
      if (v.x > 0) v.x = -v.x * WALL_BOUNCE;
    } else if (c.x < -BOUND_X) {
      c.x = -BOUND_X;
      if (v.x < 0) v.x = -v.x * WALL_BOUNCE;
    }
    if (c.z > BOUND_Z_MAX) {
      c.z = BOUND_Z_MAX;
      if (v.z > 0) v.z = -v.z * WALL_BOUNCE;
    } else if (c.z < BOUND_Z_MIN) {
      c.z = BOUND_Z_MIN;
      if (v.z < 0) v.z = -v.z * WALL_BOUNCE;
    }

    // The tome is a wall: push out along the shallowest axis and reflect.
    if (c.x > BOOK.minX && c.x < BOOK.maxX && c.z > BOOK.minZ && c.z < BOOK.maxZ) {
      const dxMin = c.x - BOOK.minX;
      const dxMax = BOOK.maxX - c.x;
      const dzMin = c.z - BOOK.minZ;
      const dzMax = BOOK.maxZ - c.z;
      const m = Math.min(dxMin, dxMax, dzMin, dzMax);
      if (m === dxMin) {
        c.x = BOOK.minX;
        if (v.x > 0) v.x = -v.x * WALL_BOUNCE;
      } else if (m === dxMax) {
        c.x = BOOK.maxX;
        if (v.x < 0) v.x = -v.x * WALL_BOUNCE;
      } else if (m === dzMin) {
        c.z = BOOK.minZ;
        if (v.z > 0) v.z = -v.z * WALL_BOUNCE;
      } else {
        c.z = BOOK.maxZ;
        if (v.z < 0) v.z = -v.z * WALL_BOUNCE;
      }
    }
  }

  /** Find the top face, tween it exactly flat, then report its value. */
  private beginSnap(): void {
    this.rolling = false;
    if (this.faceNormals.length === 0) {
      // Degenerate geometry; keep the contract honest anyway.
      this.onResult(1 + Math.floor(Math.random() * 20));
      return;
    }

    let bestDot = -Infinity;
    let bestIndex = 0;
    for (let i = 0; i < this.faceNormals.length; i++) {
      const dot = this.scratch
        .copy(this.faceNormals[i])
        .applyQuaternion(this.orientation).y;
      if (dot > bestDot) {
        bestDot = dot;
        bestIndex = i;
      }
    }
    const value = this.faceValues[bestIndex] ?? 20;

    const worldNormal = this.faceNormals[bestIndex]
      .clone()
      .applyQuaternion(this.orientation)
      .normalize();
    const qFrom = this.orientation.clone();
    const qTo = new THREE.Quaternion()
      .setFromUnitVectors(worldNormal, UP)
      .multiply(this.orientation)
      .normalize();
    const centerFrom = this.center.clone();
    const centerTo = this.center.clone();
    centerTo.y = this.tableY + this.inradius;

    const proxy = { t: 0 };
    this.snapTween = gsap.to(proxy, {
      t: 1,
      duration: SNAP_DURATION,
      ease: "power2.out",
      onUpdate: () => {
        this.orientation.slerpQuaternions(qFrom, qTo, proxy.t);
        this.center.lerpVectors(centerFrom, centerTo, proxy.t);
        this.syncGroup();
      },
      onComplete: () => {
        this.snapTween = null;
        this.onResult(value);
      },
    });
  }

  private syncGroup(): void {
    this.pivotOffset.set(0, this.inradius, 0).applyQuaternion(this.orientation);
    this.group.quaternion.copy(this.orientation);
    this.group.position.copy(this.center).sub(this.pivotOffset);
  }

  /**
   * Deterministic face-index → value map: walk the faces in a canonical
   * sorted-normal order, pair each with its most-opposite unused face and
   * hand the pair (k+1, 20−k) so opposite faces always sum to 21.
   */
  private assignFaceValues(): void {
    const indices = this.faceNormals.map((_, i) => i);
    indices.sort((i, j) => {
      const a = this.faceNormals[i];
      const b = this.faceNormals[j];
      if (a.y !== b.y) return a.y - b.y;
      if (a.x !== b.x) return a.x - b.x;
      return a.z - b.z;
    });
    const used = new Set<number>();
    let pair = 0;
    for (const i of indices) {
      if (used.has(i)) continue;
      used.add(i);
      let opposite = -1;
      let bestDot = Infinity;
      for (const j of indices) {
        if (used.has(j)) continue;
        const dot = this.faceNormals[i].dot(this.faceNormals[j]);
        if (dot < bestDot) {
          bestDot = dot;
          opposite = j;
        }
      }
      this.faceValues[i] = pair + 1;
      if (opposite >= 0) {
        used.add(opposite);
        this.faceValues[opposite] = 20 - pair;
      }
      pair++;
    }
  }
}
