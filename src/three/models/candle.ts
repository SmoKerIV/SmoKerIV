/**
 * Single candle ~0.18 high on a small brass holder dish. The flame mesh is
 * exposed via userData.parts (CandleParts) so the scene can attach its
 * flickering PointLight. Pivot at the dish bottom (y = 0).
 */
import * as THREE from "three";
import { ITEM_LABELS } from "../types";
import type { CandleParts } from "../types";
import { brassMaterial, waxMaterial } from "./materials";

export function buildCandle(): THREE.Group {
  const group = new THREE.Group();
  group.name = "candle";

  const brass = brassMaterial();
  const wax = waxMaterial();

  // --- Brass holder dish ------------------------------------------------------
  const dish = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.001, 0.002),
        new THREE.Vector2(0.03, 0.004),
        new THREE.Vector2(0.048, 0.006),
        new THREE.Vector2(0.055, 0.016),
        new THREE.Vector2(0.05, 0.018),
        new THREE.Vector2(0.028, 0.012),
      ],
      16,
    ),
    brass,
  );
  dish.castShadow = true;
  dish.receiveShadow = true;
  group.add(dish);
  // Little carry ring on the dish
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.012, 0.003, 6, 10),
    brass,
  );
  ring.rotation.y = Math.PI / 2;
  ring.position.set(0.062, 0.014, 0);
  group.add(ring);

  // --- Wax body ----------------------------------------------------------------
  const WAX_BASE = 0.01;
  const WAX_H = 0.125;
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.023, WAX_H, 12),
    wax,
  );
  body.position.y = WAX_BASE + WAX_H / 2;
  body.castShadow = true;
  group.add(body);
  // Slightly melted, wider top lip
  const lip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.023, 0.019, 0.012, 12),
    wax,
  );
  lip.position.y = WAX_BASE + WAX_H - 0.002;
  group.add(lip);
  // Wax drips hugging the side
  const dripGeo = new THREE.SphereGeometry(0.006, 6, 5);
  for (const [a, y, s] of [
    [0.4, 0.105, 1.6],
    [2.1, 0.085, 1.3],
    [4.4, 0.115, 1.5],
    [5.3, 0.06, 1.1],
  ] as Array<[number, number, number]>) {
    const drip = new THREE.Mesh(dripGeo, wax);
    drip.scale.set(0.5, s, 0.5);
    drip.position.set(Math.cos(a) * 0.0195, y, Math.sin(a) * 0.0195);
    group.add(drip);
  }

  // --- Wick ----------------------------------------------------------------------
  const wickTop = WAX_BASE + WAX_H + 0.012;
  const wick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0016, 0.0022, 0.014, 5),
    new THREE.MeshStandardMaterial({ color: 0x151009, roughness: 1 }),
  );
  wick.position.y = wickTop - 0.007;
  group.add(wick);

  // --- Flame (scene attaches the flickering PointLight here) ----------------------
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.011, 0.046, 8),
    new THREE.MeshStandardMaterial({
      color: 0xffc266,
      emissive: 0xffa229,
      emissiveIntensity: 3.2,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      roughness: 1,
    }),
  );
  flame.name = "candleFlame";
  flame.position.y = wickTop + 0.016;
  group.add(flame);
  // Hot inner core
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.005, 6, 5),
    new THREE.MeshStandardMaterial({
      color: 0xfff3c0,
      emissive: 0xffe9a0,
      emissiveIntensity: 2.5,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      roughness: 1,
    }),
  );
  core.position.y = wickTop + 0.004;
  group.add(core);

  group.userData.itemId = "candle";
  group.userData.label = ITEM_LABELS.candle.name;
  group.userData.parts = { flame } satisfies CandleParts;
  return group;
}
