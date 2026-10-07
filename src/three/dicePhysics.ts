/**
 * d20 physics on cannon-es (lazy-loaded: the engine is fetched the first
 * time it's needed, or by preload() once the stage is up).
 *
 * World: gravity, the tabletop as a static plane with low invisible rims
 * along its edges, and static colliders for every item on the table
 * (oriented boxes / upright cylinders measured from the built item groups,
 * see measureObstacle). The spellbook has a closed and an open collider,
 * swapped by setBookOpen().
 *
 * The die is a ConvexPolyhedron built from the model's own hull
 * (group.userData.d20), stepped at a fixed 1/120 s with an accumulator and
 * rendered from the interpolated state. When the body falls asleep the
 * face whose normal is closest to world +Y is read and mapped through the
 * same face → number table the texture was painted from, so the toast
 * always matches the number on top. A die that comes to rest cocked
 * (against an item) is nudged; after a few nudges it's eased flat.
 *
 * The dice group's pivot rests at the face contact point (see models/dice.ts),
 * so the body tracks the die CENTER and the group transform is derived:
 * group.position = center − orientation * (0, inradius, 0).
 */
import * as THREE from "three";
import gsap from "gsap";
import type * as CANNON from "cannon-es";
import type { D20Shape } from "./models/dice";

type Cannon = typeof CANNON;

const GRAVITY = -9.81;
const FIXED_DT = 1 / 120;
const MAX_SUBSTEPS = 8;

// A big (≈9 cm) resin d20: ~0.28 kg.
const DIE_MASS = 0.28;
const DIE_LINEAR_DAMPING = 0.05;
const DIE_ANGULAR_DAMPING = 0.06;
const SLEEP_SPEED = 0.05;
const SLEEP_TIME = 0.3;

// Throw (m/s, rad/s).
const THROW_FWD_MIN = 1.2;
const THROW_FWD_MAX = 1.7;
const THROW_UP_MIN = 0.6;
const THROW_UP_MAX = 1.0;
const SPIN_MIN = 18;
const SPIN_MAX = 30;
/** Random yaw added to the aim (radians). */
const AIM_JITTER = 0.35;
/** Beyond this distance from home, the die is carried back before a throw. */
const HOME_RADIUS = 0.3;
const PICKUP_DURATION = 0.45;
const PICKUP_LIFT = 0.12;
/** Release height above resting (m) after a carry. */
const PICKUP_RELEASE_HEIGHT = 0.05;

const RIM_HEIGHT = 0.08;
const RIM_THICKNESS = 0.05;

/**
 * cannon has no rolling resistance, so a die rocking on an edge can keep
 * going; past this point damping ramps up until it settles.
 */
const DAMPING_RAMP_AFTER = 1.8;
/** A die that is still awake after this long gets settled anyway. */
const MAX_ROLL_SECONDS = 6;
const COCKED_DOT = 0.98;
const MAX_NUDGES = 3;
const SNAP_DURATION = 0.25;
const REDUCED_RESULT_MS = 140;

// Clatter: velocity change per step that counts as an impact (m/s).
const IMPACT_MIN = 0.3;
const IMPACT_FULL = 2.5;
const IMPACT_GAP = 0.05;

const UP = new THREE.Vector3(0, 1, 0);

/** Static collider in world space: oriented box or upright cylinder. */
export interface ObstacleSpec {
  kind: "box" | "cylinder";
  /** World-space centre of the collider. */
  center: THREE.Vector3;
  /** Half extents in the item's own (yawed) frame; cylinder radius = max(x, z). */
  half: THREE.Vector3;
  /** Yaw of the item (world Y rotation). */
  rotY: number;
}

export interface TableBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface DicePhysicsOptions {
  tableY: number;
  table: TableBounds;
  obstacles: ObstacleSpec[];
  bookClosed?: ObstacleSpec | null;
  bookOpen?: ObstacleSpec | null;
  /** Where throws curve back toward when the die has wandered (world XZ). */
  home: THREE.Vector2;
  onResult: (value: number) => void;
  /** Die struck something; strength 0..1, hard = an item rather than the table. */
  onImpact?: (strength: number, hard: boolean) => void;
}

export interface RollOptions {
  reducedMotion: boolean;
  /** Horizontal throw direction (world); default = away from the camera. */
  aim?: THREE.Vector3 | null;
}

/**
 * Collider for one item: the bounding box of its visible meshes measured
 * in the item's own yawed frame (so a diagonal sword gets a tight box),
 * returned in world space. `node` may be a sub-part of `root`.
 */
export function measureObstacle(
  root: THREE.Object3D,
  kind: ObstacleSpec["kind"],
  node: THREE.Object3D = root,
): ObstacleSpec | null {
  root.updateWorldMatrix(true, true);
  const toRoot = root.matrixWorld.clone().invert();
  const box = new THREE.Box3();
  const part = new THREE.Box3();
  const m = new THREE.Matrix4();
  node.traverseVisible((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingBox) return;
    m.multiplyMatrices(toRoot, mesh.matrixWorld);
    box.union(part.copy(geometry.boundingBox).applyMatrix4(m));
  });
  if (box.isEmpty()) return null;
  const center = box.getCenter(new THREE.Vector3()).applyMatrix4(root.matrixWorld);
  const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const rotY = new THREE.Euler().setFromQuaternion(
    root.getWorldQuaternion(new THREE.Quaternion()),
    "YXZ",
  ).y;
  return { kind, center, half, rotY };
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export class DicePhysics {
  private readonly group: THREE.Group;
  private readonly opts: DicePhysicsOptions;
  private readonly shape: D20Shape;

  private cannon: Cannon | null = null;
  private loading: Promise<Cannon> | null = null;
  private world: CANNON.World | null = null;
  private die: CANNON.Body | null = null;
  private bookClosedBody: CANNON.Body | null = null;
  private bookOpenBody: CANNON.Body | null = null;
  private bookIsOpen = false;
  /** Static item colliders (not the tabletop or rims). */
  private readonly itemBodies = new Set<CANNON.Body>();

  /** Waiting for the engine, simulating, snapping or reporting. */
  private busy = false;
  private simulating = false;
  private elapsed = 0;
  private nudges = 0;
  private lastImpactAt = -1;
  private readonly prevVelocity = new THREE.Vector3();
  private readonly prevSpin = new THREE.Vector3();
  private snapTween: gsap.core.Tween | null = null;
  private resultTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  private readonly center = new THREE.Vector3();
  private readonly orientation = new THREE.Quaternion();
  private readonly scratch = new THREE.Vector3();
  private readonly pivotOffset = new THREE.Vector3();

  constructor(group: THREE.Group, opts: DicePhysicsOptions) {
    this.group = group;
    this.opts = opts;
    const shape = group.userData.d20 as D20Shape | undefined;
    if (!shape) throw new Error("dice group is missing userData.d20");
    this.shape = shape;
  }

  get isRolling(): boolean {
    return this.busy;
  }

  /** Fetch + build the world ahead of the first roll (idempotent). */
  preload(): Promise<void> {
    return this.ensureWorld().then(() => undefined);
  }

  setBookOpen(open: boolean): void {
    if (open && !this.bookIsOpen) this.clearBookArea();
    this.bookIsOpen = open;
    const world = this.world;
    if (!world) return;
    const add = open ? this.bookOpenBody : this.bookClosedBody;
    const remove = open ? this.bookClosedBody : this.bookOpenBody;
    if (remove && world.bodies.includes(remove)) world.removeBody(remove);
    if (add && !world.bodies.includes(add)) world.addBody(add);
  }

  /**
   * The cover swings over (and the open spread covers) more of the table
   * than the closed book: a die resting there is lifted aside first.
   */
  private clearBookArea(): void {
    const spec = this.opts.bookOpen;
    if (!spec || this.busy || this.disposed) return;
    this.readGroup();
    const local = this.scratch
      .copy(this.center)
      .sub(spec.center)
      .applyAxisAngle(UP, -spec.rotY);
    const margin = this.shape.inradius * 1.6;
    if (Math.abs(local.x) > spec.half.x + margin || Math.abs(local.z) > spec.half.z + margin) {
      return;
    }
    this.busy = true;
    const from = this.center.clone();
    const to = new THREE.Vector3(
      this.opts.home.x,
      this.opts.tableY + this.shape.inradius,
      this.opts.home.y,
    );
    const proxy = { t: 0 };
    this.snapTween = gsap.to(proxy, {
      t: 1,
      duration: PICKUP_DURATION,
      ease: "power1.inOut",
      onUpdate: () => {
        this.center.lerpVectors(from, to, proxy.t);
        this.center.y += Math.sin(Math.PI * proxy.t) * PICKUP_LIFT;
        this.syncGroup();
      },
      onComplete: () => {
        this.snapTween = null;
        // Same face up, only moved: rest it flat on the table.
        const { index } = this.topFace();
        const worldNormal = this.shape.faceNormals[index]
          .clone()
          .applyQuaternion(this.orientation);
        this.orientation.premultiply(
          new THREE.Quaternion().setFromUnitVectors(worldNormal, UP),
        );
        this.syncGroup();
        this.writeBody();
        this.busy = false;
      },
    });
  }

  /** Throw the die from wherever it rests. */
  roll(options: RollOptions): void {
    if (this.busy || this.disposed) return;
    this.busy = true;
    this.readGroup();

    if (options.reducedMotion) {
      this.instantResult();
      return;
    }

    const aim = options.aim?.clone() ?? null;
    this.ensureWorld()
      .then(() => {
        if (!this.disposed) this.pickUp(aim);
      })
      .catch(() => {
        // Engine failed to load: keep the contract with an honest result.
        if (!this.disposed) this.instantResult();
      });
  }

  /** Advance the simulation; call once per rendered frame. */
  update(delta: number): void {
    const world = this.world;
    const die = this.die;
    if (!this.simulating || !world || !die || !this.cannon) return;

    if (this.elapsed > DAMPING_RAMP_AFTER) {
      const k = Math.min(1, (this.elapsed - DAMPING_RAMP_AFTER) / 1.2);
      die.angularDamping = THREE.MathUtils.lerp(DIE_ANGULAR_DAMPING, 0.9, k);
      die.linearDamping = THREE.MathUtils.lerp(DIE_LINEAR_DAMPING, 0.9, k);
    }
    world.step(FIXED_DT, Math.min(delta, 0.1), MAX_SUBSTEPS);
    this.elapsed += delta;
    this.keepOnTable(die);

    this.center.set(
      die.interpolatedPosition.x,
      die.interpolatedPosition.y,
      die.interpolatedPosition.z,
    );
    this.orientation.set(
      die.interpolatedQuaternion.x,
      die.interpolatedQuaternion.y,
      die.interpolatedQuaternion.z,
      die.interpolatedQuaternion.w,
    );
    this.syncGroup();

    const asleep = die.sleepState === this.cannon.Body.SLEEPING;
    if (asleep || this.elapsed > MAX_ROLL_SECONDS) this.onRest(die);
  }

  dispose(): void {
    this.disposed = true;
    this.snapTween?.kill();
    this.snapTween = null;
    if (this.resultTimer) clearTimeout(this.resultTimer);
    this.resultTimer = null;
    this.simulating = false;
    this.busy = false;
    if (this.world) {
      for (const body of [...this.world.bodies]) this.world.removeBody(body);
    }
    this.world = null;
    this.die = null;
  }

  // ----------------------------------------------------------------- engine

  private ensureWorld(): Promise<Cannon> {
    if (!this.loading) {
      this.loading = import("cannon-es").then((cannon) => {
        if (!this.world && !this.disposed) this.buildWorld(cannon);
        this.cannon = cannon;
        return cannon;
      });
      // Allow a retry on a later roll if the chunk failed to load.
      this.loading.catch(() => {
        this.loading = null;
      });
    }
    return this.loading;
  }

  private buildWorld(C: Cannon): void {
    const { tableY, table, obstacles } = this.opts;
    const world = new C.World({
      gravity: new C.Vec3(0, GRAVITY, 0),
      allowSleep: true,
    });
    world.broadphase = new C.SAPBroadphase(world);
    (world.solver as CANNON.GSSolver).iterations = 12;

    const dieMat = new C.Material("die");
    const woodMat = new C.Material("wood");
    const itemMat = new C.Material("item");
    // Resin on oiled planks: grippy, modest bounce. Items are harder/slicker.
    world.addContactMaterial(
      new C.ContactMaterial(dieMat, woodMat, { friction: 0.26, restitution: 0.36 }),
    );
    world.addContactMaterial(
      new C.ContactMaterial(dieMat, itemMat, { friction: 0.2, restitution: 0.42 }),
    );

    // Tabletop + low rims along its edges.
    const top = new C.Body({ type: C.Body.STATIC, material: woodMat });
    top.addShape(new C.Plane());
    top.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    top.position.set(0, tableY, 0);
    world.addBody(top);

    const w = table.maxX - table.minX;
    const d = table.maxZ - table.minZ;
    const cx = (table.minX + table.maxX) / 2;
    const cz = (table.minZ + table.maxZ) / 2;
    const rimY = tableY + RIM_HEIGHT / 2;
    const rims: [number, number, number, number][] = [
      // x, z, halfX, halfZ
      [table.minX - RIM_THICKNESS / 2, cz, RIM_THICKNESS / 2, d / 2 + RIM_THICKNESS],
      [table.maxX + RIM_THICKNESS / 2, cz, RIM_THICKNESS / 2, d / 2 + RIM_THICKNESS],
      [cx, table.minZ - RIM_THICKNESS / 2, w / 2 + RIM_THICKNESS, RIM_THICKNESS / 2],
      [cx, table.maxZ + RIM_THICKNESS / 2, w / 2 + RIM_THICKNESS, RIM_THICKNESS / 2],
    ];
    for (const [x, z, hx, hz] of rims) {
      const rim = new C.Body({ type: C.Body.STATIC, material: woodMat });
      rim.addShape(new C.Box(new C.Vec3(hx, RIM_HEIGHT / 2, hz)));
      rim.position.set(x, rimY, z);
      world.addBody(rim);
    }

    const makeStatic = (spec: ObstacleSpec): CANNON.Body => {
      const body = new C.Body({ type: C.Body.STATIC, material: itemMat });
      if (spec.kind === "cylinder") {
        const r = Math.max(spec.half.x, spec.half.z);
        body.addShape(new C.Cylinder(r, r, spec.half.y * 2, 14));
      } else {
        body.addShape(new C.Box(new C.Vec3(spec.half.x, spec.half.y, spec.half.z)));
      }
      body.position.set(spec.center.x, spec.center.y, spec.center.z);
      body.quaternion.setFromEuler(0, spec.rotY, 0);
      this.itemBodies.add(body);
      return body;
    };
    for (const spec of obstacles) world.addBody(makeStatic(spec));
    this.bookClosedBody = this.opts.bookClosed ? makeStatic(this.opts.bookClosed) : null;
    this.bookOpenBody = this.opts.bookOpen ? makeStatic(this.opts.bookOpen) : null;

    // The die: convex hull straight from the model.
    const hull = new C.ConvexPolyhedron({
      vertices: this.shape.vertices.map((v) => new C.Vec3(v.x, v.y, v.z)),
      faces: this.shape.faces.map((f) => [...f]),
    });
    const die = new C.Body({
      mass: DIE_MASS,
      material: dieMat,
      linearDamping: DIE_LINEAR_DAMPING,
      angularDamping: DIE_ANGULAR_DAMPING,
      allowSleep: true,
      sleepSpeedLimit: SLEEP_SPEED,
      sleepTimeLimit: SLEEP_TIME,
    });
    die.addShape(hull);
    world.addBody(die);
    die.sleep();

    // Clatter: an impact is a sudden velocity change beyond what gravity
    // and rolling friction can do in one step.
    world.addEventListener("postStep", () => this.detectImpact(world, die));

    this.world = world;
    this.die = die;
    this.setBookOpen(this.bookIsOpen);
  }

  // ------------------------------------------------------------------ rolls

  /**
   * A die that has wandered off (behind the book, by the tankard...) is
   * first scooped up and carried back over the items to the front of the
   * table, like a hand would, so every throw starts where it can be seen.
   */
  private pickUp(aim: THREE.Vector3 | null): void {
    const home = this.opts.home;
    const from = this.center.clone();
    const dist = Math.hypot(home.x - from.x, home.y - from.z);
    if (dist <= HOME_RADIUS) {
      this.launch(aim);
      return;
    }
    const to = new THREE.Vector3(
      home.x,
      this.opts.tableY + this.shape.inradius + PICKUP_RELEASE_HEIGHT,
      home.y,
    );
    const lift = PICKUP_LIFT + dist * 0.25;
    const qFrom = this.orientation.clone();
    const qTo = new THREE.Quaternion()
      .setFromEuler(new THREE.Euler(randRange(-3, 3), randRange(-3, 3), randRange(-3, 3)))
      .multiply(qFrom);
    const proxy = { t: 0 };
    this.snapTween = gsap.to(proxy, {
      t: 1,
      duration: PICKUP_DURATION,
      ease: "power1.inOut",
      onUpdate: () => {
        const t = proxy.t;
        this.center.lerpVectors(from, to, t);
        this.center.y += Math.sin(Math.PI * t) * lift;
        this.orientation.slerpQuaternions(qFrom, qTo, t);
        this.syncGroup();
      },
      onComplete: () => {
        this.snapTween = null;
        if (!this.disposed) this.launch(aim);
      },
    });
  }

  private launch(aim: THREE.Vector3 | null): void {
    const die = this.die;
    const world = this.world;
    if (!die || !world) {
      this.instantResult();
      return;
    }

    const dir = this.throwDirection(aim);
    const fwd = randRange(THROW_FWD_MIN, THROW_FWD_MAX);
    const axis = new THREE.Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5,
    ).normalize();
    // Mostly tumble forward (spin axis ⟂ throw), plus a random component.
    const roll = new THREE.Vector3().crossVectors(UP, dir).multiplyScalar(-1);
    const spinAxis = roll.multiplyScalar(0.6).add(axis.multiplyScalar(0.8)).normalize();
    const spin = randRange(SPIN_MIN, SPIN_MAX);

    die.position.set(this.center.x, this.center.y + 0.002, this.center.z);
    die.quaternion.set(
      this.orientation.x,
      this.orientation.y,
      this.orientation.z,
      this.orientation.w,
    );
    die.previousPosition.copy(die.position);
    die.interpolatedPosition.copy(die.position);
    die.previousQuaternion.copy(die.quaternion);
    die.interpolatedQuaternion.copy(die.quaternion);
    die.velocity.set(dir.x * fwd, randRange(THROW_UP_MIN, THROW_UP_MAX), dir.z * fwd);
    die.angularVelocity.set(spinAxis.x * spin, spinAxis.y * spin, spinAxis.z * spin);
    die.angularDamping = DIE_ANGULAR_DAMPING;
    die.linearDamping = DIE_LINEAR_DAMPING;
    die.wakeUp();
    world.accumulator = 0;

    this.prevVelocity.set(die.velocity.x, die.velocity.y, die.velocity.z);
    this.prevSpin.set(die.angularVelocity.x, die.angularVelocity.y, die.angularVelocity.z);
    this.elapsed = 0;
    this.nudges = 0;
    this.lastImpactAt = -1;
    this.simulating = true;
  }

  /** Aim flattened onto the table, with a little random yaw. */
  private throwDirection(aim: THREE.Vector3 | null): THREE.Vector3 {
    const dir = new THREE.Vector3();
    if (aim) dir.set(aim.x, 0, aim.z);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();
    dir.applyAxisAngle(UP, randRange(-AIM_JITTER, AIM_JITTER));
    return dir;
  }

  /** Physics says it stopped: read the top face, or nudge a cocked die. */
  private onRest(die: CANNON.Body): void {
    this.center.set(die.position.x, die.position.y, die.position.z);
    this.orientation.set(die.quaternion.x, die.quaternion.y, die.quaternion.z, die.quaternion.w);
    this.syncGroup();

    const { index, dot } = this.topFace();
    if (dot >= COCKED_DOT) {
      this.simulating = false;
      this.finish(this.shape.faceValues[index]);
      return;
    }
    if (this.nudges < MAX_NUDGES && this.elapsed <= MAX_ROLL_SECONDS + 2) {
      // Leaning on something: hop it away from where it's propped.
      this.nudges++;
      const away = this.scratch
        .set(this.opts.home.x - this.center.x, 0, this.opts.home.y - this.center.z)
        .normalize()
        .multiplyScalar(0.25);
      die.wakeUp();
      die.velocity.set(away.x, 0.7, away.z);
      die.angularVelocity.set(randRange(-6, 6), randRange(-6, 6), randRange(-6, 6));
      return;
    }
    this.simulating = false;
    this.snapFlat(index);
  }

  /** Index of the face pointing most nearly straight up, and how nearly. */
  private topFace(): { index: number; dot: number } {
    let dot = -Infinity;
    let index = 0;
    this.shape.faceNormals.forEach((n, i) => {
      const y = this.scratch.copy(n).applyQuaternion(this.orientation).y;
      if (y > dot) {
        dot = y;
        index = i;
      }
    });
    return { index, dot };
  }

  /** Ease a stubbornly cocked die flat on its best face, then report it. */
  private snapFlat(index: number): void {
    const worldNormal = this.shape.faceNormals[index]
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
    centerTo.y = this.opts.tableY + this.shape.inradius;

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
        this.writeBody();
        this.finish(this.shape.faceValues[index]);
      },
    });
  }

  /** Reduced motion / no engine: land on a random face in place. */
  private instantResult(): void {
    const index = Math.floor(Math.random() * this.shape.faceNormals.length);
    const qTo = new THREE.Quaternion()
      .setFromUnitVectors(this.shape.faceNormals[index], UP)
      .premultiply(new THREE.Quaternion().setFromAxisAngle(UP, Math.random() * Math.PI * 2));
    this.orientation.copy(qTo);
    this.center.y = this.opts.tableY + this.shape.inradius;
    this.syncGroup();
    this.writeBody();
    // Brief beat so the shadow map catches the new pose before the toast.
    this.resultTimer = setTimeout(() => {
      this.resultTimer = null;
      this.finish(this.shape.faceValues[index]);
    }, REDUCED_RESULT_MS);
  }

  private finish(value: number): void {
    this.busy = false;
    if (!this.disposed) this.opts.onResult(value);
  }

  // ---------------------------------------------------------------- helpers

  private detectImpact(world: CANNON.World, die: CANNON.Body): void {
    const v = die.velocity;
    const w = die.angularVelocity;
    // Gravity alone changes v.y by g·dt each step; remove it.
    const dvx = v.x - this.prevVelocity.x;
    const dvy = v.y - this.prevVelocity.y - GRAVITY * FIXED_DT;
    const dvz = v.z - this.prevVelocity.z;
    const dw = Math.hypot(
      w.x - this.prevSpin.x,
      w.y - this.prevSpin.y,
      w.z - this.prevSpin.z,
    );
    this.prevVelocity.set(v.x, v.y, v.z);
    this.prevSpin.set(w.x, w.y, w.z);
    if (!this.simulating || !this.opts.onImpact) return;

    // An edge strike shows up mostly as a spin change; weigh it by the
    // die's radius to compare in m/s.
    const impact = Math.hypot(dvx, dvy, dvz) + dw * this.shape.inradius * 0.5;
    if (impact < IMPACT_MIN) return;
    if (this.lastImpactAt >= 0 && world.time - this.lastImpactAt < IMPACT_GAP) return;
    this.lastImpactAt = world.time;

    // Items ring harder than the wooden top and rims.
    let hard = false;
    for (const c of world.contacts) {
      const other = c.bi === die ? c.bj : c.bj === die ? c.bi : null;
      if (other && this.itemBodies.has(other)) {
        hard = true;
        break;
      }
    }
    const strength = Math.min(1, (impact - IMPACT_MIN) / (IMPACT_FULL - IMPACT_MIN) + 0.08);
    this.opts.onImpact(strength, hard);
  }

  /** Safety net: never let a glitch drop the die off or through the table. */
  private keepOnTable(die: CANNON.Body): void {
    const { table, tableY } = this.opts;
    const p = die.position;
    const r = this.shape.inradius;
    const out =
      p.y < tableY - 0.02 ||
      p.x < table.minX - 0.02 ||
      p.x > table.maxX + 0.02 ||
      p.z < table.minZ - 0.02 ||
      p.z > table.maxZ + 0.02;
    if (!out) return;
    p.set(
      THREE.MathUtils.clamp(p.x, table.minX + r * 2, table.maxX - r * 2),
      tableY + r * 2,
      THREE.MathUtils.clamp(p.z, table.minZ + r * 2, table.maxZ - r * 2),
    );
    die.velocity.set(0, 0, 0);
    die.previousPosition.copy(p);
    die.interpolatedPosition.copy(p);
  }

  /** Group transform → die centre + orientation. */
  private readGroup(): void {
    this.orientation.copy(this.group.quaternion);
    this.pivotOffset.set(0, this.shape.inradius, 0).applyQuaternion(this.orientation);
    this.center.copy(this.group.position).add(this.pivotOffset);
  }

  /** Mirror the current centre/orientation into a resting body. */
  private writeBody(): void {
    const die = this.die;
    if (!die) return;
    die.position.set(this.center.x, this.center.y, this.center.z);
    die.quaternion.set(
      this.orientation.x,
      this.orientation.y,
      this.orientation.z,
      this.orientation.w,
    );
    die.velocity.set(0, 0, 0);
    die.angularVelocity.set(0, 0, 0);
    die.sleep();
  }

  private syncGroup(): void {
    this.pivotOffset.set(0, this.shape.inradius, 0).applyQuaternion(this.orientation);
    this.group.quaternion.copy(this.orientation);
    this.group.position.copy(this.center).sub(this.pivotOffset);
  }
}
