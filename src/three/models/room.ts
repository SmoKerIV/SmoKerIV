/**
 * Inn room shell: ~7 x 3.2 x 7 m, centered at origin, floor at y = 0.
 * Inward-facing walls, plank floor, ceiling beams, a night window on the
 * -Z wall and a fireplace suggestion on the -X wall (the scene attaches
 * the flickering light itself). Not interactable.
 */
import * as THREE from "three";
import {
  plasterMaterial,
  stoneMaterial,
  woodDarkMaterial,
} from "./materials";
import { makeWoodTexture } from "./textures";

const ROOM = 7;
const HEIGHT = 3.2;

export function buildRoom(): THREE.Group {
  const group = new THREE.Group();
  group.name = "room";

  // --- Floor: wide plank wood --------------------------------------------
  // Clone of the shared dark wood: own repeat, same canvas source/upload.
  const floorTex = makeWoodTexture("dark").clone();
  floorTex.repeat.set(4, 4);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: 0.9,
    metalness: 0,
  });
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM, ROOM).rotateX(-Math.PI / 2),
    floorMat,
  );
  floor.receiveShadow = true;
  floor.userData.noShadow = true; // room shell receives only
  group.add(floor);

  // --- Walls: inward-facing plaster planes --------------------------------
  const plaster = plasterMaterial();
  const wallGeo = new THREE.PlaneGeometry(ROOM, HEIGHT);
  const walls: Array<[number, number, number]> = [
    // [x, z, rotY] — plane normal faces +Z by default
    [0, -ROOM / 2, 0], // north (-Z)
    [0, ROOM / 2, Math.PI], // south (+Z)
    [-ROOM / 2, 0, Math.PI / 2], // west (-X)
    [ROOM / 2, 0, -Math.PI / 2], // east (+X)
  ];
  for (const [x, z, rotY] of walls) {
    const wall = new THREE.Mesh(wallGeo, plaster);
    wall.position.set(x, HEIGHT / 2, z);
    wall.rotation.y = rotY;
    wall.receiveShadow = true;
    wall.userData.noShadow = true;
    group.add(wall);
  }

  // --- Ceiling -------------------------------------------------------------
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM, ROOM).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x8a7a60, roughness: 0.95 }),
  );
  ceiling.userData.noShadow = true;
  ceiling.position.y = HEIGHT;
  group.add(ceiling);

  // --- Timber framing ------------------------------------------------------
  const wood = woodDarkMaterial();
  const addBeam = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    rotY = 0,
  ): void => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood);
    beam.position.set(x, y, z);
    beam.rotation.y = rotY;
    beam.castShadow = true;
    beam.receiveShadow = true;
    group.add(beam);
  };

  // Corner posts
  const inset = ROOM / 2 - 0.1;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addBeam(0.18, HEIGHT, 0.18, sx * inset, HEIGHT / 2, sz * inset);
    }
  }
  // Top plates hugging each wall
  addBeam(ROOM, 0.16, 0.14, 0, HEIGHT - 0.14, -inset);
  addBeam(ROOM, 0.16, 0.14, 0, HEIGHT - 0.14, inset);
  addBeam(0.14, 0.16, ROOM, -inset, HEIGHT - 0.14, 0);
  addBeam(0.14, 0.16, ROOM, inset, HEIGHT - 0.14, 0);
  // Ceiling beams spanning X
  for (const z of [-2.1, 0, 2.1]) {
    addBeam(ROOM, 0.16, 0.2, 0, HEIGHT - 0.09, z);
  }
  // A few vertical wall studs (skip -Z window bay and -X fireplace bay)
  for (const x of [-2.2, 2.2]) {
    addBeam(0.13, HEIGHT, 0.07, x, HEIGHT / 2, -inset - 0.02);
  }
  for (const z of [-2.3, 2.3]) {
    addBeam(0.07, HEIGHT, 0.13, -inset - 0.02, HEIGHT / 2, z);
  }
  for (const x of [-1.6, 0.2, 1.9]) {
    addBeam(0.13, HEIGHT, 0.07, x, HEIGHT / 2, inset + 0.02);
  }
  for (const z of [-1.6, 0.4, 2.0]) {
    addBeam(0.07, HEIGHT, 0.13, inset + 0.02, HEIGHT / 2, z);
  }

  // --- Window on the -Z wall ----------------------------------------------
  const win = new THREE.Group();
  win.position.set(0.6, 1.75, -ROOM / 2 + 0.02);
  const skyMat = new THREE.MeshStandardMaterial({
    color: 0x06101f,
    emissive: 0x24406b,
    emissiveIntensity: 0.8,
    roughness: 1,
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 1.0), skyMat);
  // SceneManager repaints this for day/night by name.
  sky.name = "windowSky";
  sky.userData.noShadow = true;
  win.add(sky);
  const frameMat = wood;
  const frameParts: Array<[number, number, number, number]> = [
    // [w, h, x, y]
    [1.0, 0.08, 0, 0.54], // top
    [1.0, 0.08, 0, -0.54], // bottom (sill)
    [0.08, 1.16, -0.5, 0], // left
    [0.08, 1.16, 0.5, 0], // right
    [0.05, 1.0, 0, 0], // vertical mullion
    [0.86, 0.05, 0, 0], // horizontal mullion
  ];
  for (const [w, h, x, y] of frameParts) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), frameMat);
    bar.position.set(x, y, 0.045);
    bar.castShadow = true;
    win.add(bar);
  }
  group.add(win);

  // --- Fireplace suggestion on the -X wall ---------------------------------
  const hearth = new THREE.Group();
  hearth.position.set(-ROOM / 2, 0, -0.4);
  const stone = stoneMaterial();
  const stoneBox = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
  ): void => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stone);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    hearth.add(m);
  };
  // Base slab, side pillars, lintel, chimney breast
  stoneBox(0.6, 0.1, 2.0, 0.3, 0.05, 0);
  stoneBox(0.5, 1.15, 0.4, 0.25, 0.675, -0.85);
  stoneBox(0.5, 1.15, 0.4, 0.25, 0.675, 0.85);
  stoneBox(0.5, 0.3, 2.1, 0.25, 1.4, 0);
  stoneBox(0.34, 1.65, 1.5, 0.17, 2.375, 0);
  // Dark recess
  const recess = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 1.05, 1.3),
    new THREE.MeshStandardMaterial({ color: 0x0b0805, roughness: 1 }),
  );
  recess.position.set(0.21, 0.625, 0);
  hearth.add(recess);
  // Emissive ember glow quad (scene adds the flickering PointLight)
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.7),
    new THREE.MeshStandardMaterial({
      color: 0x2a0d00,
      emissive: 0xff7722,
      emissiveIntensity: 1.2,
      roughness: 1,
    }),
  );
  glow.rotation.y = Math.PI / 2;
  glow.position.set(0.44, 0.5, 0);
  glow.name = "fireplaceGlow";
  glow.userData.noShadow = true;
  hearth.add(glow);
  // A couple of log cylinders in the recess
  const logMat = woodDarkMaterial();
  for (const [z, y, rot] of [
    [-0.16, 0.16, 0.15],
    [0.14, 0.16, -0.1],
    [0, 0.28, 0.05],
  ] as Array<[number, number, number]>) {
    const log = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.7, 7).rotateX(Math.PI / 2),
      logMat,
    );
    log.position.set(0.38, y, z);
    log.rotation.y = rot;
    hearth.add(log);
  }
  group.add(hearth);

  return group;
}
