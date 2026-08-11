/**
 * Flat decorative arcane circle, ~0.8 m diameter, meant to lie on the table
 * under the spellbook. Additive, transparent, no depth write. Built at
 * y = 0.001 to avoid z-fighting with the table top. Not interactable.
 *
 * userData.setIntensity(v): 0..1 maps material opacity from 0.35 to 1.
 */
import * as THREE from "three";
import { makeRuneCircleTexture } from "./textures";

const BASE_OPACITY = 0.35;
const MAX_OPACITY = 1.0;

export function buildRuneCircle(): THREE.Group {
  const group = new THREE.Group();
  group.name = "runeCircle";

  const material = new THREE.MeshBasicMaterial({
    map: makeRuneCircleTexture(),
    color: 0x35d0ba,
    transparent: true,
    opacity: BASE_OPACITY,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 0.8).rotateX(-Math.PI / 2),
    material,
  );
  plane.position.y = 0.001;
  plane.renderOrder = 2; // draw after opaque table/items
  group.add(plane);

  group.userData.setIntensity = (v: number): void => {
    const t = THREE.MathUtils.clamp(v, 0, 1);
    material.opacity = THREE.MathUtils.lerp(BASE_OPACITY, MAX_OPACITY, t);
  };

  return group;
}
