/**
 * Cluster of 3 potion bottles (round flask, tall vial, squat jar) with
 * emissive liquids and corks. Single interactable root, itemId "potion".
 * Pivot at the table contact plane (y = 0).
 */
import * as THREE from "three";
import { ITEM_LABELS } from "../types";
import { corkMaterial, glassMaterial, liquidMaterial } from "./materials";

function lathe(points: Array<[number, number]>, segments = 14): THREE.LatheGeometry {
  return new THREE.LatheGeometry(
    points.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );
}

function addCork(parent: THREE.Group, radius: number, y: number): void {
  const cork = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 0.88, 0.02, 8),
    corkMaterial(),
  );
  cork.position.y = y;
  cork.castShadow = true;
  parent.add(cork);
}

export function buildPotions(): THREE.Group {
  const group = new THREE.Group();
  group.name = "potions";

  // --- Round flask (teal) ~0.17 high ----------------------------------------
  const flask = new THREE.Group();
  const flaskGlass = new THREE.Mesh(
    lathe([
      [0.002, 0.0],
      [0.03, 0.0],
      [0.048, 0.018],
      [0.055, 0.055],
      [0.045, 0.09],
      [0.02, 0.112],
      [0.013, 0.12],
      [0.013, 0.15],
      [0.018, 0.154],
      [0.017, 0.162],
    ]),
    glassMaterial(0xcfe8e4),
  );
  flaskGlass.castShadow = true;
  flask.add(flaskGlass);
  const tealLiquid = new THREE.Mesh(
    new THREE.SphereGeometry(0.042, 12, 10),
    liquidMaterial(0x35d0ba),
  );
  tealLiquid.scale.set(1, 0.78, 1);
  tealLiquid.position.y = 0.048;
  flask.add(tealLiquid);
  addCork(flask, 0.012, 0.166);
  flask.position.set(0.005, 0, 0.03);
  group.add(flask);

  // --- Tall vial (crimson) ~0.22 high ----------------------------------------
  const vial = new THREE.Group();
  const vialGlass = new THREE.Mesh(
    lathe([
      [0.002, 0.0],
      [0.02, 0.0],
      [0.025, 0.012],
      [0.025, 0.15],
      [0.012, 0.172],
      [0.012, 0.198],
      [0.016, 0.203],
      [0.015, 0.212],
    ], 12),
    glassMaterial(0xf0dede),
  );
  vialGlass.castShadow = true;
  vial.add(vialGlass);
  const crimsonLiquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.019, 0.019, 0.115, 10),
    liquidMaterial(0xc0392b),
  );
  crimsonLiquid.position.y = 0.065;
  vial.add(crimsonLiquid);
  addCork(vial, 0.011, 0.216);
  vial.position.set(-0.085, 0, -0.045);
  vial.rotation.y = 0.6;
  group.add(vial);

  // --- Squat jar (amber) ~0.14 high -------------------------------------------
  const jar = new THREE.Group();
  const jarGlass = new THREE.Mesh(
    lathe([
      [0.002, 0.0],
      [0.036, 0.0],
      [0.049, 0.02],
      [0.051, 0.06],
      [0.04, 0.1],
      [0.022, 0.114],
      [0.022, 0.128],
      [0.028, 0.131],
      [0.027, 0.138],
    ]),
    glassMaterial(0xf0e6cf),
  );
  jarGlass.castShadow = true;
  jar.add(jarGlass);
  const amberLiquid = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 12, 10),
    liquidMaterial(0xe67e22),
  );
  amberLiquid.scale.set(1.05, 0.85, 1.05);
  amberLiquid.position.y = 0.045;
  jar.add(amberLiquid);
  addCork(jar, 0.02, 0.142);
  jar.position.set(0.09, 0, -0.055);
  jar.rotation.y = -0.4;
  group.add(jar);

  group.userData.itemId = "potion";
  group.userData.label = ITEM_LABELS.potion.name;
  return group;
}
