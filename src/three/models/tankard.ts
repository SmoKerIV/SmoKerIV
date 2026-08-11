/**
 * Wooden tankard ~0.16 high: stave-textured body, brass hoops, half-torus
 * handle. The drink sits ~15% below the rim: a glossy dark-amber surface
 * with a matte off-white foam head clinging to the rim, plus one foam
 * drip escaping over the edge. Pivot at y = 0.
 */
import * as THREE from "three";
import { ITEM_LABELS } from "../types";
import {
  brassMaterial,
  drinkMaterial,
  foamMaterial,
  tankardInnerMaterial,
  woodStaveMaterial,
} from "./materials";

export function buildTankard(): THREE.Group {
  const group = new THREE.Group();
  group.name = "tankard";

  const HEIGHT = 0.16;
  const R_TOP = 0.052;
  const R_BOTTOM = 0.058;

  // --- Body ---------------------------------------------------------------
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(R_TOP, R_BOTTOM, HEIGHT, 12, 1, true),
    woodStaveMaterial(),
  );
  body.position.y = HEIGHT / 2;
  body.castShadow = true;
  group.add(body);
  // Bottom cap
  const bottom = new THREE.Mesh(
    new THREE.CylinderGeometry(R_BOTTOM - 0.002, R_BOTTOM - 0.002, 0.008, 12),
    woodStaveMaterial(),
  );
  bottom.position.y = 0.004;
  group.add(bottom);
  // Dark interior wall visible between the rim and the drink surface
  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(R_TOP - 0.003, R_TOP - 0.001, 0.05, 12, 1, true),
    tankardInnerMaterial(),
  );
  inner.position.y = HEIGHT - 0.025;
  group.add(inner);

  // --- Brass hoops ----------------------------------------------------------
  const brass = brassMaterial();
  for (const [y, r] of [
    [0.02, R_BOTTOM - 0.0015],
    [HEIGHT - 0.02, R_TOP + 0.0008],
  ] as Array<[number, number]>) {
    const hoop = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.004, 6, 18).rotateX(Math.PI / 2),
      brass,
    );
    hoop.position.y = y;
    hoop.castShadow = true;
    group.add(hoop);
  }

  // --- Handle: half torus on the +X side --------------------------------------
  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.042, 0.0095, 7, 14, Math.PI),
    woodStaveMaterial(),
  );
  handle.rotation.z = -Math.PI / 2; // arc opens toward the body
  handle.position.set(R_TOP + 0.012, HEIGHT / 2 + 0.006, 0);
  handle.castShadow = true;
  group.add(handle);

  // --- Drink surface, inset below the rim ---------------------------------------
  const LIQUID_Y = HEIGHT * 0.85; // ~15% below the rim
  const liquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0485, 0.0485, 0.005, 20),
    drinkMaterial(),
  );
  liquid.position.y = LIQUID_Y - 0.0025;
  group.add(liquid);

  // --- Foam head: irregular ring of merged blobs hugging the rim -----------------
  const foam = foamMaterial();
  const foamGeo = new THREE.SphereGeometry(1, 7, 5); // unit sphere, scaled per blob
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * Math.PI * 2 + 0.22 * Math.sin(i * 3.1);
    const ringR = 0.0405 + 0.0028 * Math.sin(i * 2.7);
    const size = 0.006 + 0.0034 * (0.5 + 0.5 * Math.sin(i * 5.3));
    const blob = new THREE.Mesh(foamGeo, foam);
    blob.scale.set(size * 1.15, size * 0.75, size * 1.15);
    blob.position.set(
      Math.cos(a) * ringR,
      LIQUID_Y + 0.002 + 0.0015 * Math.sin(i * 4.1),
      Math.sin(a) * ringR,
    );
    group.add(blob);
  }
  // A few blobs drifting toward the middle of the surface
  for (const [x, z, s] of [
    [0.014, -0.012, 0.008],
    [-0.02, 0.008, 0.0065],
    [-0.004, -0.026, 0.0055],
    [0.024, 0.018, 0.005],
  ] as Array<[number, number, number]>) {
    const blob = new THREE.Mesh(foamGeo, foam);
    blob.scale.set(s * 1.2, s * 0.6, s * 1.2);
    blob.position.set(x, LIQUID_Y + 0.0015, z);
    group.add(blob);
  }

  // --- One foam drip over the edge (opposite the handle) --------------------------
  const dripA = Math.PI + 0.45;
  const rimBlob = new THREE.Mesh(foamGeo, foam);
  rimBlob.scale.set(0.0085, 0.006, 0.0085);
  rimBlob.position.set(
    Math.cos(dripA) * (R_TOP - 0.002),
    HEIGHT - 0.002,
    Math.sin(dripA) * (R_TOP - 0.002),
  );
  group.add(rimBlob);
  const runBlob = new THREE.Mesh(foamGeo, foam);
  runBlob.scale.set(0.004, 0.011, 0.004);
  runBlob.position.set(
    Math.cos(dripA) * (R_TOP + 0.0025),
    HEIGHT - 0.014,
    Math.sin(dripA) * (R_TOP + 0.0025),
  );
  group.add(runBlob);
  const droplet = new THREE.Mesh(foamGeo, foam);
  droplet.scale.set(0.0035, 0.0048, 0.0035);
  droplet.position.set(
    Math.cos(dripA) * (R_TOP + 0.0035),
    HEIGHT - 0.03,
    Math.sin(dripA) * (R_TOP + 0.0035),
  );
  group.add(droplet);

  group.userData.itemId = "tankard";
  group.userData.label = ITEM_LABELS.tankard.name;
  return group;
}
