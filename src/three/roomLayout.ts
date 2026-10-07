/**
 * Where the inn's fixed features stand, shared by the room builder, the
 * lights (fire and lantern) and the particles (hearth embers), so the
 * light visibly comes from the things that emit it.
 *
 * Room: 7 x 3.2 x 7 m, centred on the origin, floor at y = 0. The camera
 * sits on the +Z side looking toward the -Z (back) wall, so everything
 * meant to be seen behind the table lives on or near that wall.
 */
import * as THREE from "three";

export const ROOM_SIZE = 7;
export const ROOM_HEIGHT = 3.2;
export const BACK_WALL_Z = -ROOM_SIZE / 2;

/** Licensed fireplace model scale (model is 1.43 x 1.6 x 0.67 m). */
export const FIREPLACE_SCALE = 1.15;
/** Model half-depth (its back face sits flush on the back wall). */
const FIREPLACE_HALF_DEPTH = 0.334;
/** Fireplace pivot (bottom centre), back-left of the table. */
export const FIREPLACE_POS = new THREE.Vector3(
  -1.75,
  0,
  BACK_WALL_Z + FIREPLACE_HALF_DEPTH * FIREPLACE_SCALE + 0.004,
);
/**
 * The fire: centre of the firebox floor. The model's firebox (behind the
 * ornate grate) is off-centre: x ≈ 0.17, floor y ≈ 0.31, z ≈ -0.1 in
 * model space.
 */
export const FIRE_POS = new THREE.Vector3(
  FIREPLACE_POS.x + 0.173 * FIREPLACE_SCALE,
  0.315 * FIREPLACE_SCALE,
  FIREPLACE_POS.z - 0.1 * FIREPLACE_SCALE,
);
/** Inner firebox size (for flames/embers): width, height, depth. */
export const FIREBOX = { w: 0.5 * FIREPLACE_SCALE, h: 0.54 * FIREPLACE_SCALE, d: 0.36 };

/** Night window on the back wall (centre), behind the table's right half. */
export const WINDOW_POS = new THREE.Vector3(0.75, 1.62, BACK_WALL_Z + 0.02);
export const WINDOW_SIZE = { w: 0.92, h: 1.06 };

/** Hanging lantern: chain anchor on the ceiling beam and lantern body. */
export const LANTERN_ANCHOR = new THREE.Vector3(1.7, 3.0, -2.1);
/** Length of the chain from the anchor to the lantern's top ring. */
export const LANTERN_DROP = 1.05;

/** Wall shelves (right part of the back wall): x range and plank heights. */
export const SHELF = { x0: 1.6, x1: 2.95, ys: [1.12, 1.56], depth: 0.24 };
