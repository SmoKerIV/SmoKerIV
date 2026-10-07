/**
 * Squat melted pillar candle (~0.15 of wax) in a brass chamberstick:
 * wobbly-profile lathe wax body with a sunken melt crater, dripping wax
 * runs down the side (one pooling on the dish), rolled-rim holder dish
 * with a finger ring, wick stub and a teardrop flame.
 *
 * The flame stays ONE mesh exposed via userData.parts (CandleParts):
 * SceneManager attaches the flickering PointLight to it and toggles
 * `flame.visible` for the snuff easter egg. Pivot at the dish bottom (y = 0).
 */
import * as THREE from "three";
import { ITEM_LABELS } from "../types";
import type { CandleParts } from "../types";
import { brassMaterial, waxMaterial } from "./materials";
import { styleModel } from "../assets";

/** Tiny deterministic PRNG so both candles get an identical melt profile. */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildCandle(): THREE.Group {
  const group = new THREE.Group();
  group.name = "candle";

  const brass = brassMaterial();
  const wax = waxMaterial();
  const rand = mulberry32(31415);

  // --- Brass chamberstick: dish with rolled rim --------------------------------
  const dish = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.002, 0.0),
        new THREE.Vector2(0.03, 0.001),
        new THREE.Vector2(0.052, 0.003),
        new THREE.Vector2(0.06, 0.006),
        new THREE.Vector2(0.064, 0.014),
        new THREE.Vector2(0.061, 0.02),
        new THREE.Vector2(0.057, 0.019),
        new THREE.Vector2(0.054, 0.012),
        new THREE.Vector2(0.046, 0.008),
        new THREE.Vector2(0.028, 0.006),
        new THREE.Vector2(0.002, 0.005),
      ],
      20,
    ),
    brass,
  );
  dish.castShadow = true;
  dish.receiveShadow = true;
  group.add(dish);
  // Finger ring handle on the rim
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.015, 0.004, 7, 14),
    brass,
  );
  ring.rotation.y = Math.PI / 2;
  ring.position.set(0.076, 0.018, 0);
  ring.castShadow = true;
  group.add(ring);
  // Small nub joining ring to dish
  const nub = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.008, 0.01), brass);
  nub.position.set(0.062, 0.016, 0);
  group.add(nub);

  // --- Wax body: irregular melted pillar (wobbly lathe) --------------------------
  const FLOOR_Y = 0.006; // dish floor the candle sits on
  const R = 0.034;
  const SHOULDER_Y = 0.135;
  const RIM_Y = 0.147;
  const POOL_Y = 0.1385; // sunken molten pool inside the crater
  const profile: THREE.Vector2[] = [
    new THREE.Vector2(0.0005, FLOOR_Y),
    new THREE.Vector2(0.03, FLOOR_Y),
    // Melted skirt where old wax pooled at the base
    new THREE.Vector2(0.041, FLOOR_Y + 0.001),
    new THREE.Vector2(0.043, FLOOR_Y + 0.005),
    new THREE.Vector2(0.039, FLOOR_Y + 0.011),
  ];
  // Shaft with seeded wobble and a slight upward taper
  const STEPS = 8;
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const y = 0.022 + t * (SHOULDER_Y - 0.03 - 0.022);
    const wobble = (rand() - 0.5) * 0.0042;
    profile.push(new THREE.Vector2(R - t * 0.003 + wobble, y));
  }
  profile.push(
    // Shoulder pulling in to the rim
    new THREE.Vector2(0.0305, SHOULDER_Y),
    new THREE.Vector2(0.0285, RIM_Y - 0.004),
    new THREE.Vector2(0.027, RIM_Y),
    // Crater: rim rolls inward and down into the molten pool
    new THREE.Vector2(0.022, RIM_Y - 0.003),
    new THREE.Vector2(0.012, POOL_Y + 0.001),
    new THREE.Vector2(0.004, POOL_Y),
    new THREE.Vector2(0.0005, POOL_Y),
  );
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 20), wax);
  body.castShadow = true;
  group.add(body);

  // Irregular rim blobs so the melted lip doesn't read as a perfect circle
  for (const [a, s] of [
    [0.9, 1.5],
    [2.8, 1.2],
    [5.1, 1.7],
  ] as Array<[number, number]>) {
    const blob = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 7, 5), wax);
    blob.scale.set(s, 0.7, 1.1);
    blob.position.set(Math.cos(a) * 0.0265, RIM_Y - 0.001, Math.sin(a) * 0.0265);
    group.add(blob);
  }

  // --- Drip runs down the side -----------------------------------------------------
  // [angle, top y, bottom y, thickness]; the first run reaches the dish.
  const runs: Array<[number, number, number, number]> = [
    [0.6, RIM_Y - 0.004, 0.03, 0.0048],
    [2.3, RIM_Y - 0.006, 0.082, 0.0042],
    [4.6, RIM_Y - 0.002, 0.108, 0.0038],
  ];
  for (const [a, yTop, yBot, thick] of runs) {
    const len = yTop - yBot;
    const rr = R + 0.0015;
    const cx = Math.cos(a) * rr;
    const cz = Math.sin(a) * rr;
    const run = new THREE.Mesh(
      new THREE.CylinderGeometry(thick * 0.8, thick * 1.15, len, 6),
      wax,
    );
    run.position.set(cx, yBot + len / 2, cz);
    run.castShadow = true;
    group.add(run);
    // Hanging droplet at the bottom of the run
    const droplet = new THREE.Mesh(new THREE.SphereGeometry(thick * 1.5, 7, 6), wax);
    droplet.scale.set(0.9, 1.5, 0.9);
    droplet.position.set(cx, yBot, cz);
    group.add(droplet);
  }
  // The long run pools on the dish floor
  const pool = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), wax);
  pool.scale.set(1.3, 0.28, 1.1);
  pool.position.set(Math.cos(0.6) * 0.037, FLOOR_Y + 0.002, Math.sin(0.6) * 0.037);
  group.add(pool);

  // --- Wick stub ---------------------------------------------------------------------
  const wick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0016, 0.0022, 0.013, 5),
    new THREE.MeshStandardMaterial({ color: 0x151009, roughness: 1 }),
  );
  wick.rotation.z = 0.18;
  wick.rotation.x = 0.1;
  wick.position.y = POOL_Y + 0.006;
  group.add(wick);

  // --- Flame: ONE teardrop mesh (scene attaches the flickering light) -----------------
  const flame = makeCandleFlame();
  flame.position.y = POOL_Y + 0.011;
  group.add(flame);

  group.userData.itemId = "candle";
  group.userData.label = ITEM_LABELS.candle.name;
  group.userData.parts = { flame } satisfies CandleParts;
  return group;
}

/**
 * Teardrop flame (base at y = 0, ~5 cm tall). One mesh per candle: the
 * scene attaches the flickering light beside it and hides it on snuff.
 */
export function makeCandleFlame(): THREE.Mesh {
  const flame = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.0005, 0.0),
        new THREE.Vector2(0.005, 0.005),
        new THREE.Vector2(0.0082, 0.013),
        new THREE.Vector2(0.0088, 0.019),
        new THREE.Vector2(0.0072, 0.027),
        new THREE.Vector2(0.0045, 0.036),
        new THREE.Vector2(0.002, 0.045),
        new THREE.Vector2(0.0004, 0.053),
      ],
      10,
    ),
    new THREE.MeshStandardMaterial({
      color: 0xffd27a,
      emissive: 0xffa229,
      emissiveIntensity: 3.2,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      roughness: 1,
    }),
  );
  flame.name = "candleFlame";
  flame.userData.noShadow = true;
  return flame;
}

/**
 * The licensed holder is one mesh with one material (brass + wax, split by
 * its metalness map). The candle's own point light sits a centimetre above
 * the wax, so the wax sides only ever see it at grazing angles: with the
 * full-strength normal map that broke the lit wax into hard black/white
 * blotches and left the stem under the cup pitch black, which read as
 * broken shadows (the normal map is toned down below). Real wax
 * glows from inside (the flame light scatters through it), so the
 * non-metal texels get a warm, height-faded glow driven by the flame
 * flicker (Lights.attachCandle) — a separate uniform, so the hover emissive
 * snapshot/restore never fights it. Subclassed (not onBeforeCompile on an
 * instance) so SceneManager's per-interactable material.clone() keeps the
 * patch; clones share the glow uniform, so flicker reaches them too.
 */
class CandleWaxMaterial extends THREE.MeshStandardMaterial {
  waxGlow = { value: 1 };
  /** Model-space y range over which the glow fades in (bottom → top). */
  waxRange = { value: new THREE.Vector2(0, 1) };

  override copy(source: CandleWaxMaterial): this {
    super.copy(source);
    if (source.waxGlow) this.waxGlow = source.waxGlow;
    if (source.waxRange) this.waxRange = source.waxRange;
    return this;
  }

  override onBeforeCompile(shader: THREE.WebGLProgramParametersWithUniforms): void {
    shader.uniforms.waxGlow = this.waxGlow;
    shader.uniforms.waxRange = this.waxRange;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vWaxY;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWaxY = position.y;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float vWaxY;\nuniform float waxGlow;\nuniform vec2 waxRange;",
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float waxMask = ( 1.0 - metalnessFactor ) * smoothstep( waxRange.x, waxRange.y, vWaxY );
        totalEmissiveRadiance += diffuseColor.rgb * vec3( 1.0, 0.66, 0.36 ) * waxGlow * waxMask;`,
      );
  }

  override customProgramCacheKey(): string {
    return "candleWax";
  }
}

/** Wax glow at full flame (scaled by the flicker in Lights.update). */
export const CANDLE_WAX_GLOW = 1.2;

/** Licensed holder is 0.25 m tall; a touch smaller sits better by the props. */
const MODEL_CANDLE_SCALE = 0.88;

/**
 * Brass candle holder from the licensed model (it ships with a black wick
 * and no flame) carrying the scene's own flame at the wick tip. Same
 * contract as buildCandle(): pivot on the table, CandleParts.flame.
 */
export function buildCandleFromModel(model: THREE.Object3D): THREE.Group {
  const group = new THREE.Group();
  group.name = "candle";
  // Warm ivory wax and older brass: the raw albedo is near-white and
  // blows out right under the flame; no env map, so ease off the metal.
  styleModel(model, { tint: 0xc9b293, metalness: 0.75 });
  model.scale.setScalar(MODEL_CANDLE_SCALE);
  group.add(model);

  // The wick is the topmost geometry: average the vertices within a few
  // millimetres of the top (in the group's frame) to find its tip.
  group.updateWorldMatrix(true, true);
  const toGroup = group.matrixWorld.clone().invert();
  let topY = -Infinity;
  const points: THREE.Vector3[] = [];
  const v = new THREE.Vector3();
  model.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const m = new THREE.Matrix4().multiplyMatrices(toGroup, mesh.matrixWorld);
    const pos = mesh.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      if (v.y > topY - 0.006) {
        if (v.y > topY) topY = v.y;
        points.push(v.clone());
      }
    }
  });
  const tip = new THREE.Vector3();
  let n = 0;
  for (const p of points) {
    if (p.y < topY - 0.006) continue;
    tip.add(p);
    n++;
  }
  if (n > 0) tip.divideScalar(n);
  tip.y = topY;

  const flame = makeCandleFlame();
  // Base of the teardrop wraps the wick's upper end.
  flame.position.set(tip.x, tip.y - 0.006, tip.z);
  group.add(flame);

  // Swap in the glowing-wax variant of the (already styled) material.
  // Glow fades in over the top ~13 cm of the wax (model units are
  // unscaled, the group's are scaled by MODEL_CANDLE_SCALE).
  const topModel = tip.y / MODEL_CANDLE_SCALE;
  let waxGlow: { value: number } | undefined;
  const swapped = new Map<THREE.Material, CandleWaxMaterial>();
  model.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    let wax = swapped.get(mesh.material);
    if (!wax) {
      wax = new CandleWaxMaterial().copy(
        mesh.material as THREE.MeshStandardMaterial as CandleWaxMaterial,
      );
      // The shipped normal map is far too strong for a light this close:
      // at full scale it carved the wax and stem into black/white facets.
      wax.normalScale.multiplyScalar(0.2);
      wax.waxGlow = { value: CANDLE_WAX_GLOW };
      wax.waxRange = {
        value: new THREE.Vector2(topModel - 0.15 / MODEL_CANDLE_SCALE, topModel - 0.01),
      };
      swapped.set(mesh.material, wax);
    }
    mesh.material = wax;
    waxGlow = wax.waxGlow;
  });

  group.userData.itemId = "candle";
  group.userData.label = ITEM_LABELS.candle.name;
  group.userData.parts = { flame, waxGlow } satisfies CandleParts;
  return group;
}
