/**
 * Unrolled summoning scroll ~0.40 wide (X) x ~0.28 deep (Z), lying flat.
 * Two parallel wooden rods (turned finial end caps) hold a parchment roll
 * each; the flat roll ends show a spiral cross-section texture. Between
 * them the sheet unrolls with a gentle sag and curled edges, rune writing
 * on top and a red wax seal. Pivot at the table contact plane (y = 0).
 */
import * as THREE from "three";
import { ITEM_LABELS } from "../types";
import {
  parchmentMaterial,
  scrollEndMaterial,
  sealWaxMaterial,
  woodDarkMaterial,
} from "./materials";

const ROLL_LEN = 0.3;
const ROD_LEN = 0.36;
const ROLL_Z = 0.095; // rolls sit at z = -ROLL_Z (back) and +ROLL_Z (front)
const R_BACK = 0.028; // back roll is fatter (more parchment left on it)
const R_FRONT = 0.023;
const SHEET_W = 0.3;

/** Height of the unrolled sheet at (x, z): sag + rise onto each roll + curl. */
function sheetHeight(x: number, z: number): number {
  const zn = THREE.MathUtils.clamp(z / ROLL_Z, -1, 1);
  const rTop = (zn < 0 ? R_BACK : R_FRONT) * 2 - 0.006;
  const t = Math.max(0, (Math.abs(zn) - 0.45) / 0.55);
  let y = 0.003 + rTop * t * t;
  // Side edges curl up slightly, fading out where the sheet meets the rolls
  const xn = Math.abs(x) / (SHEET_W / 2);
  y += 0.006 * xn ** 4 * (1 - Math.abs(zn));
  // Faint waviness so the parchment doesn't read as a perfect plane
  y += 0.0012 * Math.sin(x * 34 + z * 22) * (1 - Math.abs(zn));
  return y;
}

/** One roll: rod + turned end caps + parchment wound around it. */
function makeRoll(radius: number, z: number): THREE.Group {
  const roll = new THREE.Group();
  const wood = woodDarkMaterial();

  // Wooden rod through the middle
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0075, 0.0075, ROD_LEN, 8).rotateZ(-Math.PI / 2),
    wood,
  );
  rod.castShadow = true;
  roll.add(rod);

  // Turned finial caps on both rod ends
  const finialProfile = [
    new THREE.Vector2(0.0035, 0.0),
    new THREE.Vector2(0.009, 0.003),
    new THREE.Vector2(0.01, 0.007),
    new THREE.Vector2(0.0055, 0.011),
    new THREE.Vector2(0.0075, 0.015),
    new THREE.Vector2(0.008, 0.019),
    new THREE.Vector2(0.0045, 0.022),
    new THREE.Vector2(0.0005, 0.0245),
  ];
  for (const sx of [-1, 1] as const) {
    const finial = new THREE.Mesh(
      new THREE.LatheGeometry(finialProfile, 10).rotateZ((-sx * Math.PI) / 2),
      wood,
    );
    finial.position.x = sx * (ROD_LEN / 2);
    finial.castShadow = true;
    roll.add(finial);
  }

  // Parchment wound around the rod; flat ends show the spiral cross-section
  const rollGeo = new THREE.CylinderGeometry(radius, radius, ROLL_LEN, 16, 1)
    .rotateZ(-Math.PI / 2);
  const paper = new THREE.Mesh(rollGeo, [
    parchmentMaterial(false),
    scrollEndMaterial(),
    scrollEndMaterial(),
  ]);
  paper.castShadow = true;
  roll.add(paper);

  roll.position.set(0, radius, z); // rest the roll on the table
  return roll;
}

export function buildScroll(): THREE.Group {
  const group = new THREE.Group();
  group.name = "scroll";

  group.add(makeRoll(R_BACK, -ROLL_Z));
  group.add(makeRoll(R_FRONT, ROLL_Z));

  // --- Unrolled middle sheet (written side up) -----------------------------------
  const sheetGeo = new THREE.PlaneGeometry(SHEET_W, ROLL_Z * 2, 6, 18)
    .rotateX(-Math.PI / 2);
  const pos = sheetGeo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, sheetHeight(pos.getX(i), pos.getZ(i)));
  }
  sheetGeo.computeVertexNormals();
  const sheet = new THREE.Mesh(sheetGeo, parchmentMaterial(true));
  sheet.castShadow = true;
  group.add(sheet);

  // --- Red wax seal pressed onto the sheet -----------------------------------------
  const sealX = 0.07;
  const sealZ = 0.042;
  const sealY = sheetHeight(sealX, sealZ);
  const seal = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), sealWaxMaterial());
  seal.scale.set(1.15, 0.42, 1.15);
  seal.position.set(sealX, sealY + 0.004, sealZ);
  seal.castShadow = true;
  group.add(seal);
  // Stamp imprint on top of the blob
  const imprint = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.0095, 0.002, 12),
    new THREE.MeshStandardMaterial({ color: 0x7a1a10, roughness: 0.5 }),
  );
  imprint.position.set(sealX, sealY + 0.0105, sealZ);
  group.add(imprint);

  group.userData.itemId = "scroll";
  group.userData.label = ITEM_LABELS.scroll.name;
  return group;
}
