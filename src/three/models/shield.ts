/**
 * Round shield, ~0.62 m diameter, LYING flat on the table (contact at y = 0).
 * Shallow lathe dome with a top-down planar-projected painted crest,
 * iron boss in the center and a rim ring.
 */
import * as THREE from "three";
import { ITEM_LABELS } from "../types";
import { ironDarkMaterial, ironMaterial } from "./materials";
import { makeCrestTexture } from "./textures";
import { styleModel } from "../assets";

const RADIUS = 0.31;

/** Re-projects lathe UVs top-down so a painted texture maps like a decal. */
function planarProjectUVs(geo: THREE.BufferGeometry, radius: number): void {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(
      i,
      pos.getX(i) / (radius * 2) + 0.5,
      pos.getZ(i) / (radius * 2) + 0.5,
    );
  }
  uv.needsUpdate = true;
}

export function buildShield(): THREE.Group {
  const group = new THREE.Group();
  group.name = "shield";

  // --- Painted dome body -----------------------------------------------------
  const profile: THREE.Vector2[] = [
    new THREE.Vector2(0.001, 0.062),
    new THREE.Vector2(0.1, 0.057),
    new THREE.Vector2(0.19, 0.046),
    new THREE.Vector2(0.27, 0.03),
    new THREE.Vector2(RADIUS - 0.004, 0.018),
    new THREE.Vector2(RADIUS, 0.012),
    new THREE.Vector2(RADIUS, 0.004),
    new THREE.Vector2(RADIUS - 0.02, 0.002),
  ];
  const domeGeo = new THREE.LatheGeometry(profile, 28);
  planarProjectUVs(domeGeo, RADIUS);
  const crestTex = makeCrestTexture();
  crestTex.wrapS = THREE.ClampToEdgeWrapping;
  crestTex.wrapT = THREE.ClampToEdgeWrapping;
  const dome = new THREE.Mesh(
    domeGeo,
    new THREE.MeshStandardMaterial({
      map: crestTex,
      roughness: 0.75,
      metalness: 0.1,
      side: THREE.DoubleSide,
    }),
  );
  dome.castShadow = true;
  dome.receiveShadow = true;
  group.add(dome);

  // --- Central iron boss -------------------------------------------------------
  const boss = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    ironMaterial(),
  );
  boss.scale.set(1, 0.75, 1);
  boss.position.y = 0.055;
  boss.castShadow = true;
  group.add(boss);
  // Boss base ring
  const bossRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.062, 0.006, 6, 20).rotateX(Math.PI / 2),
    ironDarkMaterial(),
  );
  bossRing.position.y = 0.058;
  group.add(bossRing);

  // --- Rim ------------------------------------------------------------------
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(RADIUS - 0.002, 0.011, 6, 36).rotateX(Math.PI / 2),
    ironDarkMaterial(),
  );
  rim.position.y = 0.011;
  rim.castShadow = true;
  group.add(rim);

  // Rivets around the boss
  const rivetGeo = new THREE.SphereGeometry(0.007, 6, 5);
  const iron = ironMaterial();
  const rivets = 8;
  for (let i = 0; i < rivets; i++) {
    const a = (i / rivets) * Math.PI * 2;
    const rivet = new THREE.Mesh(rivetGeo, iron);
    rivet.position.set(Math.cos(a) * 0.09, 0.055, Math.sin(a) * 0.09);
    group.add(rivet);
  }

  group.userData.itemId = "shield";
  group.userData.label = ITEM_LABELS.shield.name;
  return group;
}

/** Licensed buckler is 0.45 m across; scaled up to hold the shield's spot. */
const BUCKLER_SCALE = 1.22;

/**
 * Wood-and-iron buckler from the licensed model, laid face-up on the
 * table. The model stands upright in XY facing +Z with its pivot at the
 * bottom of the rim; it is tipped back onto its face's normal (+Z → +Y)
 * and re-centred so the group pivot is the disc centre on the table.
 */
export function buildShieldFromModel(model: THREE.Object3D): THREE.Group {
  const group = new THREE.Group();
  group.name = "shield";
  const holder = new THREE.Group();
  // Weathered planks read grey-white under the key spot: warm them up;
  // the iron fittings go near-black without an env map, so soften metal.
  styleModel(model, { tint: 0xcfb899, metalness: 0.55 });
  model.rotation.x = -Math.PI / 2;
  model.scale.setScalar(BUCKLER_SCALE);
  holder.add(model);
  holder.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(holder);
  const center = box.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -box.min.y, -center.z);
  group.add(holder);

  group.userData.itemId = "shield";
  group.userData.label = ITEM_LABELS.shield.name;
  return group;
}
