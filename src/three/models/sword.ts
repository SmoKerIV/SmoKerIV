/**
 * Longsword ~0.93 m, built lying flat along the X axis (blade tip toward +X),
 * resting on its side. The blade is a beveled extrusion (diamond-ish
 * cross-section) with a recessed fuller strip and glowing rune etchings;
 * swept crossguard quillons, ridged leather grip, weighted pommel.
 * The whole sword tilts slightly nose-down so the crossguard supports it
 * and the blade tip kisses the table. Pivot at the underside (y = 0),
 * centered lengthwise.
 */
import * as THREE from "three";
import { ITEM_LABELS } from "../types";
import {
  brassMaterial,
  ironDarkMaterial,
  ironMaterial,
  leatherDarkMaterial,
} from "./materials";
import { makeBladeRuneTexture } from "./textures";

export function buildSword(): THREE.Group {
  const group = new THREE.Group();
  group.name = "sword";

  const iron = ironMaterial();
  const ironDark = ironDarkMaterial();
  const brass = brassMaterial();
  const grip = leatherDarkMaterial();

  // Assemble around x = 0 at the guard, blade axis at local y = 0,
  // then lift + tilt + recenter the whole assembly.
  const parts = new THREE.Group();

  // --- Blade: tapered silhouette, beveled extrusion --------------------------
  const BLADE_LEN = 0.62;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.033);
  shape.lineTo(0.2, 0.029);
  shape.lineTo(0.4, 0.023);
  shape.lineTo(0.51, 0.017);
  shape.quadraticCurveTo(0.585, 0.009, BLADE_LEN, 0);
  shape.quadraticCurveTo(0.585, -0.009, 0.51, -0.017);
  shape.lineTo(0.4, -0.023);
  shape.lineTo(0.2, -0.029);
  shape.lineTo(0, -0.033);
  shape.closePath();
  const bladeGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.005,
    bevelEnabled: true,
    bevelThickness: 0.0035,
    bevelSize: 0.0075,
    bevelSegments: 2,
    curveSegments: 6,
  });
  // Extrusion spans z in [-0.0035, 0.0085]; center it before lying flat.
  bladeGeo.translate(0, 0, -0.0025);
  bladeGeo.rotateX(-Math.PI / 2); // length in X, width in Z, thickness in Y
  const blade = new THREE.Mesh(bladeGeo, iron);
  blade.position.set(0.018, 0, 0);
  blade.castShadow = true;
  parts.add(blade);

  // Fuller (blood groove): dark tapered strip set into the top face
  const fullerShape = new THREE.Shape();
  fullerShape.moveTo(0, 0.0055);
  fullerShape.lineTo(0.28, 0.004);
  fullerShape.lineTo(0.4, 0);
  fullerShape.lineTo(0.28, -0.004);
  fullerShape.lineTo(0, -0.0055);
  fullerShape.closePath();
  const fullerGeo = new THREE.ExtrudeGeometry(fullerShape, {
    depth: 0.0012,
    bevelEnabled: false,
  });
  fullerGeo.rotateX(-Math.PI / 2);
  const fuller = new THREE.Mesh(fullerGeo, ironDark);
  fuller.position.set(0.038, 0.0052, 0);
  parts.add(fuller);

  // Rune etchings glowing faintly inside the fuller (canvas decal)
  const runeTex = makeBladeRuneTexture();
  const runes = new THREE.Mesh(
    new THREE.PlaneGeometry(0.21, 0.02).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({
      map: runeTex,
      emissiveMap: runeTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.6,
      transparent: true,
      depthWrite: false,
      roughness: 0.6,
      metalness: 0.0,
    }),
  );
  runes.position.set(0.15, 0.0068, 0);
  parts.add(runes);

  // --- Crossguard: central block + swept quillons ------------------------------
  const guardBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.046, 0.05),
    brass,
  );
  guardBlock.castShadow = true;
  parts.add(guardBlock);

  const QUILLON_LEN = 0.115;
  const SWEEP = 0.3; // radians, quillons angle toward the blade
  const quillonGeo = new THREE.CylinderGeometry(0.0072, 0.0115, QUILLON_LEN, 8)
    .rotateX(Math.PI / 2); // along Z, narrow end at +Z
  for (const sz of [-1, 1] as const) {
    const quillon = new THREE.Mesh(quillonGeo, brass);
    quillon.rotation.y = sz === 1 ? SWEEP : Math.PI - SWEEP;
    quillon.position.set(0.016, 0, sz * 0.072);
    quillon.castShadow = true;
    parts.add(quillon);
    // Ball finial at each quillon tip
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0105, 8, 6), brass);
    tip.position.set(
      0.016 + (QUILLON_LEN / 2) * Math.sin(SWEEP),
      0,
      sz * (0.072 + (QUILLON_LEN / 2) * Math.cos(SWEEP)),
    );
    tip.castShadow = true;
    parts.add(tip);
  }

  // --- Grip: ridged leather wrap (lathe) with brass ferrules -------------------
  const GRIP_LEN = 0.2;
  const GRIP_START = -0.235; // grip runs from here toward the guard
  const gripPoints: THREE.Vector2[] = [];
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const base = 0.0148 - t * 0.0016; // slight taper toward the pommel end
    const ridge =
      0.0024 *
      Math.abs(Math.sin(t * Math.PI * 6)) *
      Math.sin(t * Math.PI) ** 0.35;
    gripPoints.push(new THREE.Vector2(base + ridge, t * GRIP_LEN));
  }
  const gripGeo = new THREE.LatheGeometry(gripPoints, 12).rotateZ(-Math.PI / 2);
  const gripMesh = new THREE.Mesh(gripGeo, grip);
  gripMesh.position.set(GRIP_START, 0, 0);
  gripMesh.castShadow = true;
  parts.add(gripMesh);
  // Ferrule collars at both ends of the wrap
  const ferruleGeo = new THREE.CylinderGeometry(0.0165, 0.0165, 0.012, 10)
    .rotateZ(Math.PI / 2);
  for (const fx of [-0.04, -0.228]) {
    const ferrule = new THREE.Mesh(ferruleGeo, brass);
    ferrule.position.set(fx, 0, 0);
    ferrule.castShadow = true;
    parts.add(ferrule);
  }

  // --- Pommel: weighted scent-stopper + button ---------------------------------
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.029, 12, 9), brass);
  pommel.scale.set(1.25, 0.88, 1.0);
  pommel.position.set(-0.262, 0, 0);
  pommel.castShadow = true;
  parts.add(pommel);
  const button = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), ironDark);
  button.position.set(-0.297, 0, 0);
  button.castShadow = true;
  parts.add(button);

  // --- Resting pose --------------------------------------------------------------
  // Lift the axis so the guard's underside grazes the table, then tilt
  // nose-down so the tip touches: two-point rest on guard + blade tip.
  const AXIS_Y = 0.024;
  parts.rotation.z = -0.028;
  parts.position.y = AXIS_Y;
  // Recenter lengthwise: sword spans x in [-0.308, +0.638] before the shift.
  parts.position.x = -(0.638 - 0.308) / 2;
  group.add(parts);

  group.userData.itemId = "sword";
  group.userData.label = ITEM_LABELS.sword.name;
  return group;
}
