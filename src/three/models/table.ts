/**
 * Heavy tavern table: top ~2.2 x 1.1 m of uneven planks, top surface at
 * exactly y = TABLE_SURFACE_Y. Pivot at the floor (y = 0). Not interactable.
 */
import * as THREE from "three";
import { TABLE_SURFACE_Y } from "../types";
import { woodDarkMaterial, woodLightMaterial } from "./materials";

/**
 * Breadboard end cap with its grain running along its length (Z) at the
 * planks' texel scale. A plain box squeezed the whole wood texture onto a
 * 9 cm strip with the grain across it: under the nearby candles that read
 * as a bright zigzag moiré beside each candle.
 */
function capGeometry(
  height: number,
  length: number,
  plankLength: number,
  plankWidth: number,
): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(0.09, height, length);
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const normal = geo.getAttribute("normal") as THREE.BufferAttribute;
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (Math.abs(normal.getZ(i)) > 0.5) {
      uv.setXY(i, x / plankWidth, y / plankWidth);
    } else {
      // Top/bottom and the long sides: grain (texture U) along Z.
      const across = Math.abs(normal.getY(i)) > 0.5 ? x : y;
      uv.setXY(i, z / plankLength + 0.5, across / plankWidth);
    }
  }
  return geo;
}

export function buildTable(): THREE.Group {
  const group = new THREE.Group();
  group.name = "table";

  const topWood = woodLightMaterial();
  const frameWood = woodDarkMaterial();

  const TOP_W = 2.2;
  const TOP_D = 1.1;
  const TOP_T = 0.07;

  // --- Top planks (slightly uneven, handmade look) -------------------------
  const planks = 5;
  const plankD = TOP_D / planks;
  // Deterministic jitter values per plank
  const rotJitter = [0.010, -0.007, 0.004, -0.011, 0.008];
  const yJitter = [0, -0.004, 0.002, -0.003, 0.001];
  const xJitter = [0.012, -0.018, 0.006, -0.01, 0.015];
  for (let i = 0; i < planks; i++) {
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(TOP_W, TOP_T, plankD - 0.012),
      topWood,
    );
    plank.position.set(
      xJitter[i],
      TABLE_SURFACE_Y - TOP_T / 2 + yJitter[i],
      -TOP_D / 2 + plankD / 2 + i * plankD,
    );
    plank.rotation.y = rotJitter[i];
    plank.castShadow = true;
    plank.receiveShadow = true;
    group.add(plank);
  }
  // Breadboard end caps
  for (const sx of [-1, 1]) {
    const cap = new THREE.Mesh(capGeometry(TOP_T + 0.01, TOP_D + 0.02, TOP_W, plankD), frameWood);
    cap.position.set(sx * (TOP_W / 2 + 0.03), TABLE_SURFACE_Y - TOP_T / 2 - 0.002, 0);
    cap.castShadow = true;
    cap.receiveShadow = true;
    group.add(cap);
  }

  // --- Aprons under the top ------------------------------------------------
  const apronY = TABLE_SURFACE_Y - TOP_T - 0.06;
  for (const sz of [-1, 1]) {
    const apron = new THREE.Mesh(
      new THREE.BoxGeometry(TOP_W - 0.4, 0.11, 0.06),
      frameWood,
    );
    apron.position.set(0, apronY, sz * (TOP_D / 2 - 0.14));
    apron.castShadow = true;
    group.add(apron);
  }

  // --- Legs -----------------------------------------------------------------
  const legH = TABLE_SURFACE_Y - TOP_T;
  const legX = TOP_W / 2 - 0.22;
  const legZ = TOP_D / 2 - 0.16;
  const legGeo = new THREE.BoxGeometry(0.14, legH, 0.14);
  const legLean = [0.012, -0.01, 0.008, -0.012];
  let li = 0;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, frameWood);
      leg.position.set(sx * legX, legH / 2, sz * legZ);
      leg.rotation.y = legLean[li];
      leg.castShadow = true;
      leg.receiveShadow = true;
      group.add(leg);
      // Chunky foot pad
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.18), frameWood);
      foot.position.set(sx * legX, 0.025, sz * legZ);
      foot.castShadow = true;
      foot.receiveShadow = true;
      group.add(foot);
      li++;
    }
  }

  // --- Stretchers -------------------------------------------------------------
  const stretcherY = 0.2;
  for (const sz of [-1, 1]) {
    const s = new THREE.Mesh(
      new THREE.BoxGeometry(TOP_W - 0.44 - 0.14, 0.09, 0.07),
      frameWood,
    );
    s.position.set(0, stretcherY, sz * legZ);
    s.castShadow = true;
    s.receiveShadow = true;
    group.add(s);
  }
  // Center cross stretcher along Z
  const cross = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.09, TOP_D - 0.32),
    frameWood,
  );
  cross.position.set(0, stretcherY + 0.005, 0);
  cross.castShadow = true;
  cross.receiveShadow = true;
  group.add(cross);

  return group;
}
