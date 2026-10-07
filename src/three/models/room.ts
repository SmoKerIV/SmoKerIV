/**
 * Inn room: ~7 x 3.2 x 7 m, centred at the origin, floor at y = 0.
 *
 * Shell: plaster-over-stone walls and a plank floor (canvas colour +
 * normal maps), half-timber framing and ceiling beams merged into one
 * mesh. Back (-Z) wall, as seen behind the table: the stone hearth with
 * its animated fire (licensed model re-skinned, or a procedural stand-in),
 * the night window with moon and drifting clouds, wall shelves with books
 * and jars, a corner of barrels/crate/chest; a hanging lantern over the
 * back of the table; the chair pulled up at the front. Not interactable.
 *
 * Background pieces carry userData.noShadow (receive only): the single
 * shadow map is reserved for the table. Static procedural geometry is
 * merged per material to keep draw calls phone-friendly.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Quality } from "../types";
import type { ModelLibrary } from "../assets";
import {
  BACK_WALL_Z,
  FIREBOX,
  FIRE_POS,
  LANTERN_ANCHOR,
  LANTERN_DROP,
  ROOM_HEIGHT,
  ROOM_SIZE,
  SHELF,
  WINDOW_POS,
  WINDOW_SIZE,
} from "../roomLayout";
import { ironDarkMaterial, stoneMaterial, woodDarkMaterial } from "./materials";
import { cloudTexture, floorMaps, moonTexture, skyTexture, wallMaps } from "./roomTextures";
import { buildHearthFire } from "./hearthFire";
import { makeCandleFlame } from "./candle";
import { dressRoom } from "./roomProps";

export interface RoomRig {
  group: THREE.Group;
  /** Where the lantern's point light should live (sways with the lantern). */
  lanternLightAnchor: THREE.Object3D;
  /** Per-frame: fire flames (level = fire flicker ≈ 1), lantern sway, clouds. */
  update(elapsed: number, delta: number, fireLevel: number, reducedMotion: boolean): void;
  /** 0 = night, 1 = day: moon fades, clouds whiten. */
  setDayFactor(f: number): void;
  /** Low quality hides shelf clutter and some corner props. */
  setQuality(quality: Quality): void;
}

/** Collects transformed geometries and merges them into one mesh. */
class GeometryBatch {
  private readonly parts: THREE.BufferGeometry[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly s = new THREE.Vector3();

  add(
    geometry: THREE.BufferGeometry,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
    scale = 1,
  ): void {
    this.q.setFromEuler(this.e.set(rx, ry, rz));
    this.m.compose(new THREE.Vector3(x, y, z), this.q, this.s.setScalar(scale));
    this.parts.push(geometry.clone().applyMatrix4(this.m));
  }

  build(material: THREE.Material, name: string): THREE.Mesh | null {
    if (this.parts.length === 0) return null;
    const merged = mergeGeometries(this.parts, false);
    for (const part of this.parts) part.dispose();
    if (!merged) return null;
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = name;
    return mesh;
  }
}

export function buildRoom(models: ModelLibrary, quality: Quality): RoomRig {
  const group = new THREE.Group();
  group.name = "room";
  const half = ROOM_SIZE / 2;
  const clutter = new THREE.Group();
  clutter.name = "roomClutter";
  group.add(clutter);

  // --- Floor: planks with grain and gaps -------------------------------------
  const floorTex = floorMaps();
  const floorRepeat = ROOM_SIZE / 2.4;
  const floorMap = floorTex.map.clone();
  floorMap.repeat.set(floorRepeat, floorRepeat);
  const floorNormal = floorTex.normalMap.clone();
  floorNormal.repeat.copy(floorMap.repeat);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({
      map: floorMap,
      normalMap: floorNormal,
      normalScale: new THREE.Vector2(0.9, 0.9),
      color: 0xb4a090,
      roughness: 0.82,
      metalness: 0,
    }),
  );
  floor.name = "floor";
  floor.userData.noShadow = true;
  group.add(floor);

  // --- Walls: one merged mesh (4 inward planes) -------------------------------
  const wallTex = wallMaps();
  const wallMap = wallTex.map.clone();
  wallMap.repeat.set(2, 1);
  const wallNormal = wallTex.normalMap.clone();
  wallNormal.repeat.set(2, 1);
  const walls = new GeometryBatch();
  const wallGeo = new THREE.PlaneGeometry(ROOM_SIZE, ROOM_HEIGHT);
  walls.add(wallGeo, 0, ROOM_HEIGHT / 2, -half, 0, 0, 0);
  walls.add(wallGeo, 0, ROOM_HEIGHT / 2, half, 0, Math.PI, 0);
  walls.add(wallGeo, -half, ROOM_HEIGHT / 2, 0, 0, Math.PI / 2, 0);
  walls.add(wallGeo, half, ROOM_HEIGHT / 2, 0, 0, -Math.PI / 2, 0);
  wallGeo.dispose();
  const wallMesh = walls.build(
    new THREE.MeshStandardMaterial({
      map: wallMap,
      normalMap: wallNormal,
      normalScale: new THREE.Vector2(1.1, 1.1),
      color: 0x9c8c7c,
      roughness: 0.93,
      metalness: 0,
    }),
    "walls",
  );
  if (wallMesh) {
    wallMesh.userData.noShadow = true;
    group.add(wallMesh);
  }

  // --- Ceiling: lime-washed boards between dark joists -------------------------
  // Pale enough to catch the fire and lantern, so a phone's tall view (which
  // looks up into it) shows a ceiling, not a black band.
  const ceilMap = wallTex.map.clone();
  ceilMap.repeat.set(2, 2);
  const ceilNormal = wallTex.normalMap.clone();
  ceilNormal.repeat.copy(ceilMap.repeat);
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({
      map: ceilMap,
      normalMap: ceilNormal,
      normalScale: new THREE.Vector2(0.6, 0.6),
      color: 0x9a8670,
      // Stand-in for the firelight bounced off the floor: the one face of
      // the room no lamp points at would otherwise render pure black.
      emissive: 0x8a5a3a,
      emissiveMap: ceilMap,
      emissiveIntensity: 1,
      roughness: 0.95,
    }),
  );
  ceiling.name = "ceiling";
  ceiling.position.y = ROOM_HEIGHT;
  ceiling.userData.noShadow = true;
  group.add(ceiling);

  // --- Timber framing, window frame, shelf planks: one dark-wood mesh ---------
  const timber = new GeometryBatch();
  const box = (w: number, h: number, d: number): THREE.BoxGeometry =>
    new THREE.BoxGeometry(w, h, d);
  const inset = half - 0.1;
  // Corner posts
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      timber.add(box(0.18, ROOM_HEIGHT, 0.18), sx * inset, ROOM_HEIGHT / 2, sz * inset);
    }
  }
  // Top plates hugging each wall
  timber.add(box(ROOM_SIZE, 0.16, 0.14), 0, ROOM_HEIGHT - 0.14, -inset);
  timber.add(box(ROOM_SIZE, 0.16, 0.14), 0, ROOM_HEIGHT - 0.14, inset);
  timber.add(box(0.14, 0.16, ROOM_SIZE), -inset, ROOM_HEIGHT - 0.14, 0);
  timber.add(box(0.14, 0.16, ROOM_SIZE), inset, ROOM_HEIGHT - 0.14, 0);
  // Ceiling beams spanning X, joists across them (front to back): their own
  // mesh, with the ceiling's firelight bounce so they read as timber.
  const ceilingTimber = new GeometryBatch();
  // The front beam sits back over the door wall: at z ≈ 2 it filled the
  // top of a phone's (high, close) overview with a beam end-on.
  for (const z of [-2.1, 0.45, 3.0]) {
    ceilingTimber.add(box(ROOM_SIZE, 0.16, 0.2), 0, ROOM_HEIGHT - 0.09, z);
  }
  for (let x = -2.565; x <= 2.6; x += 0.57) {
    ceilingTimber.add(box(0.09, 0.08, ROOM_SIZE - 0.3), x, ROOM_HEIGHT - 0.04, 0);
  }
  const beamMaterial = woodDarkMaterial().clone();
  beamMaterial.emissive.setHex(0x6a4630);
  beamMaterial.emissiveMap = beamMaterial.map;
  const beamMesh = ceilingTimber.build(beamMaterial, "ceilingTimber");
  if (beamMesh) {
    beamMesh.userData.noShadow = true;
    group.add(beamMesh);
  }
  // Back wall half-timbering: posts between the features + a high rail.
  const back = BACK_WALL_Z + 0.035;
  for (const x of [-2.95, -0.48, 1.42]) {
    timber.add(box(0.14, ROOM_HEIGHT, 0.07), x, ROOM_HEIGHT / 2, back);
  }
  timber.add(box(ROOM_SIZE, 0.14, 0.07), 0, 2.42, back);
  // Side walls and front wall studs
  for (const z of [-2.3, 0.2, 2.3]) {
    timber.add(box(0.07, ROOM_HEIGHT, 0.13), -inset - 0.02, ROOM_HEIGHT / 2, z);
    timber.add(box(0.07, ROOM_HEIGHT, 0.13), inset + 0.02, ROOM_HEIGHT / 2, z);
  }
  for (const x of [-1.6, 0.2, 1.9]) {
    timber.add(box(0.13, ROOM_HEIGHT, 0.07), x, ROOM_HEIGHT / 2, inset + 0.02);
  }
  // Skirting board along the back wall (hides the wall/floor seam).
  timber.add(box(ROOM_SIZE, 0.1, 0.03), 0, 0.05, BACK_WALL_Z + 0.015);

  // Window frame (sits proud of the wall) + sill.
  {
    const { w, h } = WINDOW_SIZE;
    const wx = WINDOW_POS.x;
    const wy = WINDOW_POS.y;
    const wz = WINDOW_POS.z + 0.045;
    timber.add(box(w + 0.14, 0.09, 0.08), wx, wy + h / 2 + 0.045, wz);
    timber.add(box(0.09, h + 0.18, 0.08), wx - w / 2 - 0.045, wy, wz);
    timber.add(box(0.09, h + 0.18, 0.08), wx + w / 2 + 0.045, wy, wz);
    timber.add(box(0.05, h, 0.05), wx, wy, wz);
    timber.add(box(w, 0.05, 0.05), wx, wy, wz);
    timber.add(box(w + 0.3, 0.06, 0.2), wx, wy - h / 2 - 0.03, BACK_WALL_Z + 0.1);
  }

  // Shelf planks (+ iron brackets below, separate material).
  const iron = new GeometryBatch();
  const shelfW = SHELF.x1 - SHELF.x0;
  const shelfX = (SHELF.x0 + SHELF.x1) / 2;
  for (const y of SHELF.ys) {
    timber.add(box(shelfW, 0.04, SHELF.depth), shelfX, y, BACK_WALL_Z + SHELF.depth / 2);
    for (const bx of [SHELF.x0 + 0.15, SHELF.x1 - 0.15]) {
      // L-bracket: vertical strap on the wall + diagonal brace.
      iron.add(box(0.025, 0.16, 0.012), bx, y - 0.1, BACK_WALL_Z + 0.008);
      iron.add(
        box(0.02, 0.22, 0.012),
        bx,
        y - 0.085,
        BACK_WALL_Z + 0.08,
        Math.PI / 4,
        0,
        0,
      );
    }
  }

  const timberMesh = timber.build(woodDarkMaterial(), "timber");
  if (timberMesh) {
    timberMesh.userData.noShadow = true;
    group.add(timberMesh);
  }
  const ironMesh = iron.build(ironDarkMaterial(), "shelfIron");
  if (ironMesh) {
    ironMesh.userData.noShadow = true;
    group.add(ironMesh);
  }

  // --- Window: sky, moon, drifting clouds --------------------------------------
  const { w: winW, h: winH } = WINDOW_SIZE;
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(winW, winH),
    new THREE.MeshStandardMaterial({
      color: 0x06101f,
      emissive: 0x24406b,
      emissiveMap: skyTexture(),
      emissiveIntensity: 0.8,
      roughness: 1,
    }),
  );
  // SceneManager repaints this for day/night (and lightning) by name.
  sky.name = "windowSky";
  sky.position.copy(WINDOW_POS);
  sky.userData.noShadow = true;
  group.add(sky);

  const moonMaterial = new THREE.MeshBasicMaterial({
    map: moonTexture(),
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), moonMaterial);
  moon.position.set(WINDOW_POS.x + 0.2, WINDOW_POS.y + 0.24, WINDOW_POS.z + 0.004);
  moon.userData.noShadow = true;
  group.add(moon);

  const clouds = cloudTexture().clone();
  clouds.repeat.set(0.55, 1);
  const cloudMaterial = new THREE.MeshBasicMaterial({
    map: clouds,
    color: 0x6a7590,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const cloudPlane = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), cloudMaterial);
  cloudPlane.position.set(WINDOW_POS.x, WINDOW_POS.y, WINDOW_POS.z + 0.008);
  cloudPlane.userData.noShadow = true;
  group.add(cloudPlane);
  const CLOUD_NIGHT = new THREE.Color(0x5c6884);
  const CLOUD_DAY = new THREE.Color(0xf4f6fa);

  // --- Shelf clutter: procedural jars and bottles (merged per material) --------
  const clay = new GeometryBatch();
  const glass = new GeometryBatch();
  const cork = new GeometryBatch();
  const jarGeo = new THREE.LatheGeometry(
    [
      [0.001, 0],
      [0.045, 0],
      [0.055, 0.03],
      [0.058, 0.08],
      [0.045, 0.12],
      [0.03, 0.135],
      [0.033, 0.15],
      [0.001, 0.15],
    ].map(([r, y]) => new THREE.Vector2(r, y)),
    12,
  );
  const bottleGeo = new THREE.LatheGeometry(
    [
      [0.001, 0],
      [0.035, 0],
      [0.037, 0.11],
      [0.03, 0.14],
      [0.012, 0.17],
      [0.011, 0.21],
      [0.001, 0.21],
    ].map(([r, y]) => new THREE.Vector2(r, y)),
    10,
  );
  const corkGeo = new THREE.CylinderGeometry(0.012, 0.01, 0.025, 6);
  const shelfTop = (i: number): number => SHELF.ys[i]! + 0.02;
  const wallZ = BACK_WALL_Z + 0.12;
  // Lower shelf: two jars on the right; upper: bottles on the left.
  clay.add(jarGeo, 2.62, shelfTop(0), wallZ, 0, 0.4, 0, 1);
  clay.add(jarGeo, 2.78, shelfTop(0), wallZ - 0.02, 0, 1.2, 0, 0.8);
  glass.add(bottleGeo, 1.72, shelfTop(1), wallZ, 0, 0, 0, 1);
  glass.add(bottleGeo, 1.82, shelfTop(1), wallZ + 0.03, 0, 0, 0, 0.85);
  cork.add(corkGeo, 1.72, shelfTop(1) + 0.215, wallZ);
  cork.add(corkGeo, 1.82, shelfTop(1) + 0.215 * 0.85 + 0.004, wallZ + 0.03);
  clay.add(jarGeo, 2.82, shelfTop(1), wallZ, 0, 2.1, 0, 0.9);
  jarGeo.dispose();
  bottleGeo.dispose();
  corkGeo.dispose();
  const clayMesh = clay.build(
    new THREE.MeshStandardMaterial({ color: 0x6e4630, roughness: 0.85 }),
    "jars",
  );
  const glassMesh = glass.build(
    new THREE.MeshStandardMaterial({ color: 0x1f3a26, roughness: 0.22, metalness: 0.1 }),
    "bottles",
  );
  const corkMesh = cork.build(
    new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.95 }),
    "corks",
  );
  for (const mesh of [clayMesh, glassMesh, corkMesh]) {
    if (!mesh) continue;
    mesh.userData.noShadow = true;
    clutter.add(mesh);
  }

  // --- Hanging lantern -----------------------------------------------------------
  const lantern = new THREE.Group();
  lantern.name = "lantern";
  lantern.position.copy(LANTERN_ANCHOR);
  group.add(lantern);
  const lanternIron = new GeometryBatch();
  // Chain: alternating links from the beam down to the lantern ring.
  const link = new THREE.TorusGeometry(0.018, 0.005, 5, 10);
  const linkStep = 0.05;
  const links = Math.floor((LANTERN_DROP - 0.03) / linkStep);
  for (let i = 0; i < links; i++) {
    lanternIron.add(link, 0, -0.02 - i * linkStep, 0, 0, i % 2 ? Math.PI / 2 : 0, 0);
  }
  link.dispose();
  const top = -LANTERN_DROP;
  // Ring, cap, frame
  lanternIron.add(new THREE.TorusGeometry(0.03, 0.006, 6, 14), 0, top - 0.01, 0);
  lanternIron.add(new THREE.ConeGeometry(0.12, 0.09, 4, 1), 0, top - 0.075, 0, 0, Math.PI / 4, 0);
  lanternIron.add(box(0.18, 0.018, 0.18), 0, top - 0.125, 0);
  lanternIron.add(box(0.16, 0.022, 0.16), 0, top - 0.38, 0);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      lanternIron.add(box(0.014, 0.25, 0.014), sx * 0.078, top - 0.25, sz * 0.078);
    }
  }
  // Bottom finial
  lanternIron.add(new THREE.ConeGeometry(0.035, 0.05, 4, 1), 0, top - 0.415, 0, Math.PI, Math.PI / 4, 0);
  const lanternFrame = lanternIron.build(
    new THREE.MeshStandardMaterial({ color: 0x2a2622, metalness: 0.6, roughness: 0.55 }),
    "lanternFrame",
  );
  if (lanternFrame) {
    lanternFrame.userData.noShadow = true;
    lantern.add(lanternFrame);
  }
  const lanternGlass = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.23, 0.15),
    new THREE.MeshStandardMaterial({
      color: 0xffd7a0,
      emissive: 0xff9a40,
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0.38,
      roughness: 0.15,
      depthWrite: false,
    }),
  );
  lanternGlass.position.y = top - 0.25;
  lanternGlass.userData.noShadow = true;
  lanternGlass.renderOrder = 1;
  lantern.add(lanternGlass);
  const stub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.02, 0.06, 8),
    new THREE.MeshStandardMaterial({ color: 0xe8d8b8, roughness: 0.7 }),
  );
  stub.position.y = top - 0.34;
  stub.userData.noShadow = true;
  lantern.add(stub);
  const lanternFlame = makeCandleFlame();
  lanternFlame.scale.setScalar(1.25);
  lanternFlame.position.y = top - 0.31;
  lantern.add(lanternFlame);
  const lanternLightAnchor = new THREE.Object3D();
  lanternLightAnchor.position.y = top - 0.26;
  lantern.add(lanternLightAnchor);

  // --- Hearth: fire at the firebox, stone from the model or procedural ---------
  const fire = buildHearthFire(FIREBOX.w, FIREBOX.h);
  fire.group.position.copy(FIRE_POS);
  group.add(fire.group);

  const dressing = dressRoom(group, clutter, models);
  if (!dressing.fireplace) group.add(buildFallbackHearth());

  const rig: RoomRig = {
    group,
    lanternLightAnchor,
    update(elapsed, delta, fireLevel, reducedMotion) {
      fire.update(elapsed, fireLevel, reducedMotion ? 0.35 : 1);
      if (!reducedMotion) {
        lantern.rotation.z = Math.sin(elapsed * 0.7) * 0.03;
        lantern.rotation.x = Math.sin(elapsed * 0.53 + 1.1) * 0.02;
        clouds.offset.x = (clouds.offset.x + delta * 0.006) % 1;
      }
    },
    setDayFactor(f) {
      moonMaterial.opacity = 1 - f;
      moon.visible = f < 0.999;
      cloudMaterial.color.lerpColors(CLOUD_NIGHT, CLOUD_DAY, f);
    },
    setQuality(q) {
      clutter.visible = q !== "low";
      fire.setQuality(q);
    },
  };
  rig.setQuality(quality);
  rig.setDayFactor(0);
  return rig;
}

/**
 * Procedural stone hearth (no licensed model): pillars, lintel and
 * chimney breast round a dark recess, built facing +Z on the back wall
 * with its opening centred on FIRE_POS.
 */
function buildFallbackHearth(): THREE.Group {
  const hearth = new THREE.Group();
  hearth.name = "fallbackHearth";
  hearth.position.set(FIRE_POS.x, 0, BACK_WALL_Z);
  const stone = new GeometryBatch();
  const add = (w: number, h: number, d: number, x: number, y: number, z: number): void =>
    stone.add(new THREE.BoxGeometry(w, h, d), x, y, z);
  // Raised hearth slab (the fire burns at FIRE_POS.y), side pillars,
  // lintel and chimney breast (x across, z out of the wall).
  const floorY = FIRE_POS.y;
  add(1.9, floorY, 0.62, 0, floorY / 2, 0.31);
  add(0.4, 1.3, 0.5, -0.82, 0.65, 0.25);
  add(0.4, 1.3, 0.5, 0.82, 0.65, 0.25);
  add(2.1, 0.3, 0.52, 0, 1.45, 0.26);
  add(1.5, 1.6, 0.34, 0, 2.4, 0.17);
  const mesh = stone.build(stoneMaterial(), "fallbackHearthStone");
  if (mesh) {
    mesh.userData.noShadow = true;
    hearth.add(mesh);
  }
  // Soot-black cavity (back faces only: seen from inside through the front).
  const recessH = 1.3 - floorY;
  const recess = new THREE.Mesh(
    new THREE.BoxGeometry(1.24, recessH, 0.44),
    new THREE.MeshStandardMaterial({ color: 0x0b0805, roughness: 1, side: THREE.BackSide }),
  );
  recess.position.set(0, floorY + recessH / 2, 0.22);
  recess.userData.noShadow = true;
  hearth.add(recess);
  return hearth;
}
