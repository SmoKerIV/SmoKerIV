/**
 * Rolled parchment scroll ~0.34 long, lying flat along X. Wooden dowels,
 * red wax seal, and a slightly unrolled flap curling out toward +Z.
 * Pivot at the table contact plane (y = 0).
 */
import * as THREE from "three";
import { ITEM_LABELS } from "../types";
import { parchmentMaterial, woodDarkMaterial } from "./materials";

const ROLL_R = 0.032;
const ROLL_LEN = 0.3;

/** Flap plane lying in XZ, curling up toward the roll at z = 0. */
function makeFlap(): THREE.Mesh {
  const width = 0.27;
  const depth = 0.16;
  const geo = new THREE.PlaneGeometry(width, depth, 2, 10);
  geo.rotateX(-Math.PI / 2); // into XZ, normal +Y
  geo.translate(0, 0, depth / 2); // spans z in [0, depth]
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    // Curl up into the roll near z=0, flatten outward, tiny lift at far edge
    const curl = 0.05 * Math.exp(-z / 0.04);
    const edgeLift = 0.012 * Math.max(0, (z - depth + 0.045) / 0.045) ** 2;
    pos.setY(i, 0.0015 + curl + edgeLift);
  }
  geo.computeVertexNormals();
  const flap = new THREE.Mesh(geo, parchmentMaterial(true));
  flap.castShadow = true;
  return flap;
}

export function buildScroll(): THREE.Group {
  const group = new THREE.Group();
  group.name = "scroll";

  // --- Main roll --------------------------------------------------------------
  const roll = new THREE.Mesh(
    new THREE.CylinderGeometry(ROLL_R, ROLL_R, ROLL_LEN, 14).rotateZ(Math.PI / 2),
    parchmentMaterial(false),
  );
  roll.position.y = ROLL_R;
  roll.castShadow = true;
  group.add(roll);
  // Inner second winding peeking out at one end
  const innerRoll = new THREE.Mesh(
    new THREE.CylinderGeometry(ROLL_R * 0.72, ROLL_R * 0.72, ROLL_LEN + 0.014, 12)
      .rotateZ(Math.PI / 2),
    parchmentMaterial(false),
  );
  innerRoll.position.set(0.004, ROLL_R, 0);
  group.add(innerRoll);

  // --- Wooden dowels sticking out both ends ------------------------------------
  const dowel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.007, 0.007, ROLL_LEN + 0.1, 8).rotateZ(Math.PI / 2),
    woodDarkMaterial(),
  );
  dowel.position.y = ROLL_R;
  dowel.castShadow = true;
  group.add(dowel);
  // Dowel end knobs
  const knobGeo = new THREE.SphereGeometry(0.011, 8, 6);
  const wood = woodDarkMaterial();
  for (const sx of [-1, 1]) {
    const knob = new THREE.Mesh(knobGeo, wood);
    knob.position.set(sx * (ROLL_LEN / 2 + 0.052), ROLL_R, 0);
    knob.castShadow = true;
    group.add(knob);
  }

  // --- Red wax seal on top of the roll ------------------------------------------
  const seal = new THREE.Mesh(
    new THREE.SphereGeometry(0.016, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xa32b1e, roughness: 0.45 }),
  );
  seal.scale.set(1.1, 0.45, 1.1);
  seal.position.set(0.03, ROLL_R * 2 - 0.002, 0.006);
  seal.castShadow = true;
  group.add(seal);

  // --- Slightly unrolled flap toward +Z ------------------------------------------
  const flap = makeFlap();
  flap.position.set(-0.01, 0, ROLL_R * 0.8);
  flap.rotation.y = 0.05;
  group.add(flap);

  group.userData.itemId = "scroll";
  group.userData.label = ITEM_LABELS.scroll.name;
  return group;
}
