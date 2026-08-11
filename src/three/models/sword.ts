/**
 * Longsword ~1.05 m, built lying flat along the X axis (blade tip toward +X),
 * resting on its side. Pivot at the underside (y = 0), centered lengthwise.
 */
import * as THREE from "three";
import { ITEM_LABELS } from "../types";
import {
  brassMaterial,
  ironDarkMaterial,
  ironMaterial,
  leatherDarkMaterial,
} from "./materials";

export function buildSword(): THREE.Group {
  const group = new THREE.Group();
  group.name = "sword";

  const iron = ironMaterial();
  const ironDark = ironDarkMaterial();
  const brass = brassMaterial();
  const grip = leatherDarkMaterial();

  // Assemble around x = 0 at the guard, then recenter the whole group.
  const parts = new THREE.Group();

  const restY = 0.018; // mid-plane of the lying sword

  // --- Blade: tapered silhouette extruded flat ------------------------------
  const BLADE_LEN = 0.72;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.027);
  shape.lineTo(0.5, 0.019);
  shape.lineTo(BLADE_LEN - 0.09, 0.013);
  shape.lineTo(BLADE_LEN, 0);
  shape.lineTo(BLADE_LEN - 0.09, -0.013);
  shape.lineTo(0.5, -0.019);
  shape.lineTo(0, -0.027);
  shape.closePath();
  const bladeGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.012,
    bevelEnabled: false,
  });
  bladeGeo.rotateX(-Math.PI / 2); // lie flat: width in Z, thickness in Y
  const blade = new THREE.Mesh(bladeGeo, iron);
  // Extruded thickness spans local y [0, 0.012]; keep the underside on the table.
  blade.position.set(0.015, 0.002, 0);
  blade.castShadow = true;
  parts.add(blade);

  // Fuller groove (subtle darker strip flush with the blade's top face)
  const fuller = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.0025, 0.0045),
    ironDark,
  );
  fuller.position.set(0.28, 0.0148, 0);
  parts.add(fuller);

  // Emissive teal rune strip near the guard
  const runeStrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.0022, 0.006),
    new THREE.MeshStandardMaterial({
      color: 0x0c2a26,
      emissive: 0x35d0ba,
      emissiveIntensity: 0.35,
      roughness: 0.4,
      metalness: 0.2,
    }),
  );
  runeStrip.position.set(0.08, 0.015, 0);
  parts.add(runeStrip);

  // --- Crossguard ------------------------------------------------------------
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, 0.19), brass);
  guard.position.set(0, restY, 0);
  guard.castShadow = true;
  parts.add(guard);
  // Guard tips (small spheres for a finished look)
  for (const sz of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), brass);
    tip.position.set(0, restY, sz * 0.098);
    tip.castShadow = true;
    parts.add(tip);
  }

  // --- Grip: leather-wrapped cylinder with rings ------------------------------
  const GRIP_LEN = 0.24;
  const gripMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.017, GRIP_LEN, 10).rotateZ(Math.PI / 2),
    grip,
  );
  gripMesh.position.set(-0.0175 - GRIP_LEN / 2, restY, 0);
  gripMesh.castShadow = true;
  parts.add(gripMesh);
  // Wrap rings
  const ringGeo = new THREE.TorusGeometry(0.0165, 0.0028, 6, 12).rotateY(Math.PI / 2);
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(ringGeo, grip);
    ring.position.set(-0.055 - i * 0.05, restY, 0);
    parts.add(ring);
  }

  // --- Pommel -----------------------------------------------------------------
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), brass);
  pommel.scale.set(1.15, 1, 1);
  pommel.position.set(-0.0175 - GRIP_LEN - 0.02, restY, 0);
  pommel.castShadow = true;
  parts.add(pommel);

  // Recenter: sword spans roughly [-0.30, +0.735] -> shift to center on origin
  parts.position.x = -(0.735 - 0.3) / 2;
  group.add(parts);

  group.userData.itemId = "sword";
  group.userData.label = ITEM_LABELS.sword.name;
  return group;
}
