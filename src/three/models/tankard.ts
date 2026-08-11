/**
 * Wooden tankard ~0.16 high: stave-textured body, brass hoops, half-torus
 * handle and a cream "foam" (coffee, technically) disc. Pivot at y = 0.
 */
import * as THREE from "three";
import { ITEM_LABELS } from "../types";
import { brassMaterial, woodStaveMaterial } from "./materials";

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
    new THREE.TorusGeometry(0.042, 0.009, 7, 14, Math.PI),
    woodStaveMaterial(),
  );
  handle.rotation.z = -Math.PI / 2; // arc opens toward the body
  handle.position.set(R_TOP + 0.012, HEIGHT / 2, 0);
  handle.castShadow = true;
  group.add(handle);

  // --- Coffee/foam disc just below the rim --------------------------------------
  const foam = new THREE.Mesh(
    new THREE.CylinderGeometry(R_TOP - 0.006, R_TOP - 0.006, 0.008, 12),
    new THREE.MeshStandardMaterial({ color: 0xead9b5, roughness: 0.9 }),
  );
  foam.position.y = HEIGHT - 0.012;
  group.add(foam);
  // A few foam bubbles
  const bubbleMat = new THREE.MeshStandardMaterial({ color: 0xf6ecd2, roughness: 0.85 });
  for (const [x, z, r] of [
    [0.018, 0.01, 0.007],
    [-0.014, -0.016, 0.005],
    [0.002, -0.024, 0.004],
  ] as Array<[number, number, number]>) {
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 5), bubbleMat);
    bubble.position.set(x, HEIGHT - 0.008, z);
    group.add(bubble);
  }

  group.userData.itemId = "tankard";
  group.userData.label = ITEM_LABELS.tankard.name;
  return group;
}
