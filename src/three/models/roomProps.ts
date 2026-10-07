/**
 * Licensed background props placed in the room: the fireplace (re-skinned
 * from pale plaster to dark sooty stone), a corner of barrels, a crate
 * and a chest, books and an inkwell on the wall shelves, and the chair
 * pulled up to the table. Every piece is optional (see assets.ts).
 *
 * Background pieces are tinted darker and less saturated than the table
 * items so the table stays the focus, and receive shadows only.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { styleModel, type ModelKey, type ModelLibrary, type PropLook } from "../assets";
import {
  BACK_WALL_Z,
  FIREPLACE_POS,
  FIREPLACE_SCALE,
  SHELF,
} from "../roomLayout";
import { hearthStoneMaps } from "./roomTextures";

export interface RoomDressing {
  /** The fireplace model was placed (otherwise build the fallback). */
  fireplace: boolean;
}

interface Placement {
  key: ModelKey;
  x: number;
  y?: number;
  z: number;
  rotY?: number;
  rotZ?: number;
  scale?: number;
  look?: PropLook;
  /** Shelf/corner clutter: hidden on low quality. */
  clutter?: boolean;
  /** Keep castShadow (only near the key light, where it helps). */
  castShadow?: boolean;
}

/** Hand-painted set (barrels, books): darker, a little desaturated. */
const PAINTED_BG: PropLook = { tint: 0x8c7f72, roughnessMin: 0.85 };
/** PBR props (crate, chest): darker, iron eased off (no env map). */
const PBR_BG: PropLook = { tint: 0x83776b, metalness: 0.6 };

const shelfTop = (i: number): number => SHELF.ys[i]! + 0.02;
const shelfZ = BACK_WALL_Z + 0.13;

const PLACEMENTS: Placement[] = [
  // Corner under the shelves, right of the window.
  { key: "barrel4", x: 2.95, z: -2.98, rotY: 0.6, scale: 0.82, look: PAINTED_BG },
  { key: "barrel2", x: 2.18, z: -3.06, rotY: 2.1, scale: 0.78, look: PAINTED_BG },
  { key: "barrel1", x: 3.0, z: -2.18, rotY: 1.2, scale: 0.8, look: PAINTED_BG, clutter: true },
  { key: "crate", x: 2.1, z: -2.42, rotY: 0.35, scale: 1, look: PBR_BG },
  { key: "chest", x: 2.62, z: -2.2, rotY: -0.55, scale: 1.05, look: PBR_BG, clutter: true },
  // Shelves: a stack lying down, two books standing, the inkwell.
  { key: "bookStack", x: 1.88, y: shelfTop(0), z: shelfZ, rotY: Math.PI / 2 + 0.08, scale: 0.8, look: PAINTED_BG, clutter: true },
  { key: "ink", x: 2.28, y: shelfTop(0), z: shelfZ, rotY: -0.4, scale: 0.8, look: PAINTED_BG, clutter: true },
  { key: "bookClosed1", x: 2.25, y: shelfTop(1), z: shelfZ, rotY: Math.PI / 2, rotZ: Math.PI / 2, scale: 0.85, look: PAINTED_BG, clutter: true },
  { key: "bookClosed2", x: 2.35, y: shelfTop(1), z: shelfZ, rotY: Math.PI / 2, rotZ: Math.PI / 2, scale: 0.85, look: PAINTED_BG, clutter: true },
  { key: "scroll3", x: 2.56, y: shelfTop(1), z: shelfZ, rotY: Math.PI / 2 - 0.2, scale: 0.9, look: PAINTED_BG, clutter: true },
  // Pulled up to the table's front-left corner, turned toward it.
  { key: "chair", x: -0.62, z: 0.66, rotY: Math.PI - 0.38, scale: 1, look: { tint: 0x9a8a7a }, castShadow: true },
];

export function dressRoom(
  room: THREE.Group,
  clutter: THREE.Group,
  models: ModelLibrary,
): RoomDressing {
  for (const p of PLACEMENTS) {
    const model = models.model(p.key);
    if (!model) continue;
    styleModel(model, { ...p.look, castShadow: p.castShadow ?? false });
    const holder = new THREE.Group();
    holder.name = `prop:${p.key}`;
    model.scale.setScalar(p.scale ?? 1);
    if (p.rotZ) {
      // Stand a lying book on its spine edge: rotate about its length,
      // then lift so it rests on the shelf.
      model.rotation.z = p.rotZ;
      model.updateWorldMatrix(true, true);
      const bounds = new THREE.Box3().setFromObject(model);
      model.position.y = -bounds.min.y;
    }
    holder.add(model);
    holder.position.set(p.x, p.y ?? 0, p.z);
    holder.rotation.y = p.rotY ?? 0;
    (p.clutter ? clutter : room).add(holder);
  }

  const fireplace = models.model("fireplace");
  if (fireplace) {
    reskinFireplace(fireplace);
    fireplace.scale.setScalar(FIREPLACE_SCALE);
    fireplace.position.copy(FIREPLACE_POS);
    fireplace.add(buildLogStore());
    room.add(fireplace);
  }
  return { fireplace: !!fireplace };
}

/**
 * The model ships as pale cream plaster with an orange brick firebox.
 * Give it dark dressed stone (box-projected procedural texture + normal
 * map) and bake soot into vertex colours: black inside the firebox,
 * smoke-stained above the opening and up the hood.
 */
function reskinFireplace(root: THREE.Object3D): void {
  const maps = hearthStoneMaps();
  const stone = new THREE.MeshStandardMaterial({
    map: maps.map,
    normalMap: maps.normalMap,
    normalScale: new THREE.Vector2(1.2, 1.2),
    color: 0x8f8579,
    roughness: 0.93,
    metalness: 0,
    vertexColors: true,
  });
  const TILE = 0.55; // model units per texture repeat
  const FIRE_X = 0.173;
  const smooth = THREE.MathUtils.smoothstep;
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.userData.noShadow = true;
    const material = mesh.material as THREE.MeshStandardMaterial;
    // The grating keeps its own black iron.
    if (!material.map) {
      const iron = material.clone();
      iron.metalness = 0.5;
      iron.roughness = 0.6;
      mesh.material = iron;
      return;
    }
    const geometry = mesh.geometry.clone();
    const pos = geometry.getAttribute("position");
    const nrm = geometry.getAttribute("normal");
    const uv = new Float32Array(pos.count * 2);
    const color = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const ax = Math.abs(nrm.getX(i));
      const ay = Math.abs(nrm.getY(i));
      const az = Math.abs(nrm.getZ(i));
      // Box projection by dominant normal axis.
      let u: number;
      let v: number;
      if (ay >= ax && ay >= az) {
        u = x;
        v = z;
      } else if (ax >= az) {
        u = z;
        v = y;
      } else {
        u = x;
        v = y;
      }
      // Hood above the mantel: rendered smooth (sooty render over the
      // stone) — courses on its slope read as roof shingles. Sampling a
      // tiny patch of the texture gives a near-flat, still-mottled tone.
      const hood = y > 0.99 ? 0.08 : 1;
      uv[i * 2] = (u / TILE) * hood;
      uv[i * 2 + 1] = (v / TILE) * hood;

      let soot = 0;
      // Inside the firebox (behind the grate): near black.
      if (x > -0.11 && x < 0.46 && y > 0.29 && y < 0.9 && z < 0.14) soot = 0.82;
      // Smoke stain climbing the mantel and hood above the opening.
      const across = Math.exp(-(((x - FIRE_X) / 0.32) ** 2));
      const climb = smooth(y, 0.78, 0.98) * (1 - 0.55 * smooth(y, 1.05, 1.6));
      soot = Math.max(soot, 0.7 * across * climb);
      // Scorch round the opening's edges.
      const d = Math.hypot(x - FIRE_X, (y - 0.6) * 0.8);
      soot = Math.max(soot, 0.55 * Math.exp(-((d / 0.36) ** 2)));
      // Ground grime along the base.
      soot = Math.max(soot, 0.35 * (1 - smooth(y, 0.0, 0.25)));
      const c = 1 - soot;
      color[i * 3] = c;
      color[i * 3 + 1] = c * 0.97;
      color[i * 3 + 2] = c * 0.94;
    }
    geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geometry.setAttribute("color", new THREE.BufferAttribute(color, 3));
    mesh.geometry = geometry;
    mesh.material = stone;
  });
}

/** Split logs stacked in the fireplace's side niche (model space). */
function buildLogStore(): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [];
  const logs: Array<[number, number, number]> = [
    // x, y, radius
    [-0.395, 0.415, 0.045],
    [-0.29, 0.415, 0.045],
    [-0.342, 0.495, 0.042],
  ];
  for (const [x, y, r] of logs) {
    parts.push(
      new THREE.CylinderGeometry(r, r * 1.05, 0.3, 7)
        .rotateX(Math.PI / 2)
        .translate(x, y, -0.06),
    );
  }
  const merged = mergeGeometries(parts, false)!;
  for (const part of parts) part.dispose();
  const mesh = new THREE.Mesh(
    merged,
    new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.95 }),
  );
  mesh.name = "logStore";
  mesh.userData.noShadow = true;
  return mesh;
}
