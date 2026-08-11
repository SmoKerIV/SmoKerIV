/**
 * d20 — icosahedron of dark red resin, radius 0.045, rotated to rest on a
 * face with the pivot at the contact point (y = 0).
 */
import * as THREE from "three";
import { ITEM_LABELS } from "../types";

export function buildDice(): THREE.Group {
  const group = new THREE.Group();
  group.name = "dice";

  const R = 0.045;
  const geo = new THREE.IcosahedronGeometry(R);

  const mat = new THREE.MeshStandardMaterial({
    color: 0x8e1f1a, // deep resin red
    roughness: 0.3,
    metalness: 0.15,
    flatShading: true,
  });
  const die = new THREE.Mesh(geo, mat);
  die.castShadow = true;

  // Rest on a face: align the first face's normal with -Y, lift by the inradius.
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const a = new THREE.Vector3().fromBufferAttribute(pos, 0);
  const b = new THREE.Vector3().fromBufferAttribute(pos, 1);
  const c = new THREE.Vector3().fromBufferAttribute(pos, 2);
  const normal = new THREE.Vector3()
    .subVectors(b, a)
    .cross(new THREE.Vector3().subVectors(c, a))
    .normalize();
  die.quaternion.setFromUnitVectors(normal, new THREE.Vector3(0, -1, 0));
  const inradius = Math.abs(a.dot(normal)); // distance center -> face plane
  die.position.y = inradius;
  die.rotation.y += 0.4; // casual resting angle
  group.add(die);

  // Faint teal glint at the top vertex (arcane pip)
  const pip = new THREE.Mesh(
    new THREE.SphereGeometry(0.005, 6, 5),
    new THREE.MeshStandardMaterial({
      color: 0x0c2a26,
      emissive: 0x35d0ba,
      emissiveIntensity: 0.6,
      roughness: 0.4,
    }),
  );
  pip.position.y = inradius * 2 + 0.002;
  group.add(pip);

  group.userData.itemId = "dice";
  group.userData.label = ITEM_LABELS.dice.name;
  return group;
}
