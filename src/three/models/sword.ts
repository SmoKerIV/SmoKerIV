/**
 * Longsword ~0.9 m, built lying flat along the X axis (blade tip toward +X),
 * resting on its side: blade width in Z, thickness in Y.
 *
 * - Blade: lofted diamond section with a secondary edge bevel and a
 *   rounded fuller that runs out two-thirds down; ogival point. Brushed
 *   steel maps (streaks along the length, polished edge band).
 * - Glowing rune etching laid into the fuller (content-bearing flavour;
 *   emissive, so it lights up on hover like before).
 * - Forged crossguard: beveled block with a langet onto the blade and
 *   octagonal quillons that flare to the tips and sweep toward the blade.
 * - Leather grip with a spiral-wrap normal map, brass ferrules, wheel
 *   pommel with a peened tang button.
 *
 * The sword tilts slightly nose-down so the guard supports it and the tip
 * kisses the table. Pivot at the underside (y = 0), centered lengthwise.
 */
import * as THREE from "three";
import { ITEM_LABELS } from "../types";
import { brassMaterial } from "./materials";
import {
  cachedMaps,
  heightToNormalMap,
  fieldToTexture,
  makeBladeRuneTexture,
  makeCanvas,
  mulberry32,
  noiseField,
  toTexture,
  type PbrMaps,
} from "./textures";

// --- Blade shape -------------------------------------------------------------

const BLADE_X0 = 0.006; // blade root, hidden inside the guard
const BLADE_LEN = 0.632;
const STATIONS = 48;

/** Half-width (Z) of the blade at s in [0, 1] along its length. */
function bladeHalfWidth(s: number): number {
  const linear = 0.0255 - 0.0085 * Math.min(s / 0.78, 1);
  if (s <= 0.7) return linear;
  const u = Math.min((s - 0.7) / 0.3, 1);
  return Math.max(0.00035, linear * Math.cos((Math.PI / 2) * u) ** 0.75);
}

/** Half-thickness (Y) of the diamond ridge at s. */
function bladeHalfThickness(s: number): number {
  const base = 0.0043 * (1 - 0.42 * s);
  if (s <= 0.8) return base;
  const u = Math.min((s - 0.8) / 0.2, 1);
  return Math.max(0.0003, base * (1 - 0.85 * u * u));
}

/** Fuller depth factor: full near the hilt, running out by ~68%. */
function fullerDepth(s: number): number {
  if (s < 0.015) return 0;
  const a = THREE.MathUtils.smoothstep(s, 0.015, 0.04);
  const b = 1 - THREE.MathUtils.smoothstep(s, 0.55, 0.68);
  return a * b;
}

/**
 * Top-half cross-section as (z / halfWidth, y / halfThickness), from the
 * +Z edge to the centre line. Index groups are separate surface strips so
 * the bevel lines stay crisp (normals only smooth within a strip).
 */
function profile(f: number): Array<[number, number]> {
  return [
    [1, 0], // E: cutting edge
    [0.86, 0.26], // B: secondary (sharpening) bevel
    [0.36, 0.9], // R: main bevel shoulder
    [0.31, THREE.MathUtils.lerp(0.92, 0.64, f)], // F1: fuller wall
    [0.16, THREE.MathUtils.lerp(0.97, 0.42, f)], // F2
    [0, THREE.MathUtils.lerp(1.0, 0.37, f)], // C: fuller floor
  ];
}

/** Strips across the top face, as indices into the mirrored point row. */
const ROW = (() => {
  // Mirrored row: E B R F1 F2 C F2' F1' R' B' E' -> indices 0..10
  return {
    strips: [
      [0, 1],
      [1, 2],
      [2, 3, 4, 5, 6, 7, 8],
      [8, 9],
      [9, 10],
    ],
    count: 11,
  };
})();

function rowPoint(f: number, index: number): [number, number] {
  const p = profile(f);
  if (index <= 5) return p[index]!;
  const [z, y] = p[10 - index]!;
  return [-z, y];
}

/** Height of the top face at (s, z) — used to lay the rune decal into the fuller. */
function bladeTopY(s: number, z: number): number {
  const w = bladeHalfWidth(s);
  const t = bladeHalfThickness(s);
  const f = fullerDepth(s);
  const zn = Math.min(Math.abs(z) / w, 1);
  const p = profile(f);
  for (let i = 0; i < p.length - 1; i++) {
    const [z0, y0] = p[i]!;
    const [z1, y1] = p[i + 1]!;
    if (zn <= z0 && zn >= z1) {
      const k = (zn - z1) / (z0 - z1 || 1);
      return (y1 + (y0 - y1) * k) * t;
    }
  }
  return p[p.length - 1]![1] * t;
}

function buildBladeGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const side of [1, -1] as const) {
    for (const strip of ROW.strips) {
      const base = positions.length / 3;
      const k = strip.length;
      for (let i = 0; i <= STATIONS; i++) {
        const s = i / STATIONS;
        const x = BLADE_X0 + s * BLADE_LEN;
        const w = bladeHalfWidth(s);
        const t = bladeHalfThickness(s);
        const f = fullerDepth(s);
        for (const index of strip) {
          const [zn, yn] = rowPoint(f, index);
          positions.push(x, side * yn * t, zn * w);
          uvs.push(s, 0.5 + 0.5 * zn * (side === 1 ? 1 : -1));
        }
      }
      for (let i = 0; i < STATIONS; i++) {
        for (let j = 0; j < k - 1; j++) {
          const a = base + i * k + j;
          const b = base + (i + 1) * k + j;
          const c = b + 1;
          const d = a + 1;
          if (side === 1) indices.push(a, b, c, a, c, d);
          else indices.push(a, c, b, a, d, c);
        }
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Strip conforming to the fuller floor, carrying the rune decal. */
function buildRuneStrip(s0: number, s1: number, halfWidthFrac: number): THREE.BufferGeometry {
  const steps = 32;
  const cols = [-1, -0.5, 0, 0.5, 1];
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const s = s0 + ((s1 - s0) * i) / steps;
    const x = BLADE_X0 + s * BLADE_LEN;
    const hw = bladeHalfWidth(s) * halfWidthFrac;
    for (const c of cols) {
      const z = c * hw;
      positions.push(x, bladeTopY(s, z) + 0.00025, z);
      uvs.push(i / steps, 0.5 - c * 0.5);
    }
  }
  const n = cols.length;
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < n - 1; j++) {
      const a = i * n + j;
      const b = (i + 1) * n + j;
      indices.push(a, b + 1, b, a, a + 1, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// --- Maps ---------------------------------------------------------------------

/** Brushed blade steel: u along the blade, v across (edges at v = 0 / 1). */
function bladeMaps(): PbrMaps {
  return cachedMaps("sword:blade", () => {
    const W = 1024;
    const H = 256;
    // Long streaks: few lattice cells along u, many across v.
    const streak = noiseField(W, H, 9101, 2, 160, 2);
    const blotch = noiseField(W, H, 9102, 6, 3, 4);
    const rand = mulberry32(9103);
    const scratches = new Float32Array(W * H);
    for (let n = 0; n < 260; n++) {
      const y = Math.floor(rand() * H);
      const x0 = Math.floor(rand() * W);
      const len = 30 + rand() * 220;
      const depth = 0.25 + rand() * 0.5;
      for (let x = 0; x < len; x++) {
        const xi = (x0 + x) % W;
        const yi = (y + Math.floor((x * (rand() - 0.5)) / 60) + H) % H;
        scratches[yi * W + xi] = Math.max(scratches[yi * W + xi]!, depth);
      }
    }
    const [canvas, ctx] = makeCanvas(W, H);
    const img = ctx.createImageData(W, H);
    const rough = new Float32Array(W * H);
    const height = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      const v = 1 - y / H;
      const dEdge = Math.min(v, 1 - v); // 0 at the cutting edges
      const edge = 1 - THREE.MathUtils.smoothstep(dEdge, 0.02, 0.08);
      const inFuller = 1 - THREE.MathUtils.smoothstep(Math.abs(v - 0.5), 0.13, 0.17);
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const st = streak[i]!;
        const bl = blotch[i]!;
        const sc = scratches[i]!;
        let g = 172 + (st - 0.5) * 22 + (bl - 0.5) * 18 - sc * 18;
        g += edge * 34; // honed edge reads brighter
        g -= inFuller * 12;
        const p = i * 4;
        img.data[p] = g * 0.96;
        img.data[p + 1] = g * 0.985;
        img.data[p + 2] = g * 1.03;
        img.data[p + 3] = 255;
        rough[i] =
          0.34 + (st - 0.5) * 0.16 + (bl - 0.5) * 0.1 + sc * 0.1 - edge * 0.18 + inFuller * 0.05;
        height[i] = st * 0.35 - sc * 0.4;
      }
    }
    ctx.putImageData(img, 0, 0);
    const map = toTexture(canvas);
    const roughnessMap = fieldToTexture(rough, W, H);
    const normalMap = heightToNormalMap(height, W, H, 1.2);
    for (const t of [map, roughnessMap, normalMap]) {
      t.wrapS = THREE.ClampToEdgeWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      t.anisotropy = 8;
    }
    return { map, roughnessMap, normalMap } satisfies PbrMaps;
  });
}

/** Spiral leather wrap: u around the grip, v along it. */
function gripMaps(): PbrMaps {
  return cachedMaps("sword:grip", () => {
    const S = 512;
    const TURNS = 11; // wraps along the grip
    const grain = noiseField(S, S, 9201, 24, 24, 3);
    const [canvas, ctx] = makeCanvas(S, S);
    const img = ctx.createImageData(S, S);
    const height = new Float32Array(S * S);
    const rough = new Float32Array(S * S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = y * S + x;
        // Diagonal bands in UV space = a helix on the lathe.
        const q = x / S + (y / S) * TURNS;
        const f = q - Math.floor(q);
        // Flat-topped strip with a narrow dark seam where the wraps overlap.
        const crown = Math.min(1, Math.sin(Math.PI * f) * 2.2) ** 0.8;
        const g = grain[i]!;
        height[i] = crown * 0.85 + g * 0.15;
        const shade = 0.55 + crown * 0.45;
        const p = i * 4;
        img.data[p] = (78 + g * 30) * shade;
        img.data[p + 1] = (44 + g * 18) * shade;
        img.data[p + 2] = (28 + g * 12) * shade;
        img.data[p + 3] = 255;
        rough[i] = 0.62 + (1 - crown) * 0.25 - g * 0.08;
      }
    }
    ctx.putImageData(img, 0, 0);
    const map = toTexture(canvas);
    return {
      map,
      normalMap: heightToNormalMap(height, S, S, 4),
      roughnessMap: fieldToTexture(rough, S, S),
    };
  });
}

/** Forged, slightly pitted dark steel for the guard and pommel. */
function forgedMaps(): PbrMaps {
  return cachedMaps("sword:forged", () => {
    const S = 256;
    const n = noiseField(S, S, 9301, 6, 6, 5);
    const pits = noiseField(S, S, 9302, 40, 40, 2);
    const [canvas, ctx] = makeCanvas(S, S);
    const img = ctx.createImageData(S, S);
    const height = new Float32Array(S * S);
    const rough = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) {
      const a = n[i]!;
      const pit = Math.max(0, pits[i]! - 0.7) * 1.2;
      const g = 104 + (a - 0.5) * 36 - pit * 30;
      img.data[i * 4] = g * 0.98;
      img.data[i * 4 + 1] = g * 0.97;
      img.data[i * 4 + 2] = g;
      img.data[i * 4 + 3] = 255;
      height[i] = a * 0.5 - pit * 0.6;
      rough[i] = 0.4 + (0.5 - a) * 0.2 + pit * 0.3;
    }
    ctx.putImageData(img, 0, 0);
    return {
      map: toTexture(canvas),
      normalMap: heightToNormalMap(height, S, S, 1.4),
      roughnessMap: fieldToTexture(rough, S, S),
    };
  });
}

/** Start-up warm-up hook: paint every sword map now (cached). */
export function swordMaps(): void {
  bladeMaps();
  gripMaps();
  forgedMaps();
}

// --- Hilt pieces ---------------------------------------------------------------

/** Octagonal quillon along +Z, flaring to the tip and sweeping toward +X. */
function quillonGeometry(side: 1 | -1): THREE.BufferGeometry {
  const L = 0.104;
  const profilePts: Array<[number, number]> = [
    [0.0072, 0],
    [0.0062, 0.018],
    [0.0051, 0.05],
    [0.0053, 0.072],
    [0.0072, 0.087],
    [0.0088, 0.095],
    [0.0084, 0.1],
    [0.0056, L - 0.0015],
    [0.0001, L],
  ];
  const geo = new THREE.LatheGeometry(
    profilePts.map(([r, y]) => new THREE.Vector2(r, y)),
    10,
  );
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const START = 0.019; // out from the centre block
  const SWEEP = 1.7; // x offset = SWEEP * y^2 (toward the blade)
  for (let i = 0; i < pos.count; i++) {
    const rx = pos.getX(i);
    const ry = pos.getY(i);
    const rz = pos.getZ(i);
    // y = -side * rz keeps the mapping a rotation (faces stay outward).
    pos.setXYZ(i, rx + SWEEP * ry * ry, -side * rz, side * (START + ry));
  }
  geo.computeVertexNormals();
  return geo;
}

/** Centre block with a pointed langet lapping onto the blade (+X). */
function guardBlockGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  // Top view: x along the blade, second axis across (z).
  shape.moveTo(-0.011, -0.021);
  shape.lineTo(0.009, -0.021);
  shape.lineTo(0.013, -0.011);
  shape.lineTo(0.036, -0.0035);
  shape.quadraticCurveTo(0.041, 0, 0.036, 0.0035);
  shape.lineTo(0.013, 0.011);
  shape.lineTo(0.009, 0.021);
  shape.lineTo(-0.011, 0.021);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.024,
    bevelEnabled: true,
    bevelThickness: 0.0035,
    bevelSize: 0.003,
    bevelSegments: 2,
    curveSegments: 4,
  });
  geo.translate(0, 0, -0.012);
  geo.rotateX(Math.PI / 2); // extrusion → Y, shape y → Z
  // Planar UVs for the noise maps
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) * 12 + pos.getY(i) * 6, pos.getZ(i) * 12 + pos.getY(i) * 6);
  }
  return geo;
}

function wheelPommelGeometry(): THREE.BufferGeometry {
  const half: Array<[number, number]> = [
    [0.0001, 0.0158],
    [0.0078, 0.0158],
    [0.0094, 0.0132],
    [0.0118, 0.0112],
    [0.0196, 0.0104],
    [0.0246, 0.0086],
    [0.0272, 0.0048],
    [0.0279, 0.0],
  ];
  const pts = [
    ...half.map(([r, y]) => new THREE.Vector2(r, y)),
    ...half
      .slice(0, -1)
      .reverse()
      .map(([r, y]) => new THREE.Vector2(r, -y)),
  ];
  // Lathe winds bottom-to-top: reverse so the faces point outward.
  return new THREE.LatheGeometry(pts.reverse(), 28);
}

export function buildSword(): THREE.Group {
  const group = new THREE.Group();
  group.name = "sword";

  const blade = bladeMaps();
  const steel = new THREE.MeshStandardMaterial({
    color: 0xd6dbe2,
    map: blade.map,
    roughnessMap: blade.roughnessMap,
    normalMap: blade.normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: 1,
    // No env map in the room: keep some diffuse so the blade never goes
    // black away from the highlights.
    metalness: 0.62,
  });
  const forged = forgedMaps();
  const darkSteel = new THREE.MeshStandardMaterial({
    color: 0xb0a89c,
    map: forged.map,
    normalMap: forged.normalMap,
    roughnessMap: forged.roughnessMap,
    roughness: 1,
    metalness: 0.7,
  });
  const gripTex = gripMaps();
  const leather = new THREE.MeshStandardMaterial({
    map: gripTex.map,
    normalMap: gripTex.normalMap,
    roughnessMap: gripTex.roughnessMap,
    roughness: 1,
    metalness: 0,
  });
  const brass = brassMaterial();

  const parts = new THREE.Group();

  // --- Blade --------------------------------------------------------------------
  const bladeMesh = new THREE.Mesh(buildBladeGeometry(), steel);
  bladeMesh.name = "swordBlade";
  parts.add(bladeMesh);

  // Rune etching glowing in the fuller (canvas decal, conforming strip)
  const runeTex = makeBladeRuneTexture();
  const runes = new THREE.Mesh(
    buildRuneStrip(0.06, 0.4, 0.27),
    new THREE.MeshStandardMaterial({
      map: runeTex,
      emissiveMap: runeTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.6,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      roughness: 0.6,
      metalness: 0.0,
    }),
  );
  runes.userData.noShadow = true;
  parts.add(runes);

  // --- Crossguard ----------------------------------------------------------------
  const block = new THREE.Mesh(guardBlockGeometry(), darkSteel);
  parts.add(block);
  for (const side of [1, -1] as const) {
    parts.add(new THREE.Mesh(quillonGeometry(side), darkSteel));
  }

  // --- Grip: swelled leather wrap between brass ferrules -------------------------
  const GRIP_FROM = -0.013;
  const GRIP_LEN = 0.178;
  const gripPts: THREE.Vector2[] = [];
  const ROWS = 18;
  for (let i = 0; i <= ROWS; i++) {
    const t = i / ROWS;
    const r = 0.0124 + 0.0019 * Math.sin(Math.PI * t) ** 0.8 - 0.0006 * t;
    gripPts.push(new THREE.Vector2(r, t * GRIP_LEN));
  }
  const gripGeo = new THREE.LatheGeometry(gripPts, 24).rotateZ(Math.PI / 2);
  const grip = new THREE.Mesh(gripGeo, leather);
  grip.position.x = GRIP_FROM;
  parts.add(grip);

  const ferrulePts = [
    [0.0128, -0.006],
    [0.0142, -0.0052],
    [0.0146, 0],
    [0.0142, 0.0052],
    [0.0128, 0.006],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const ferruleGeo = new THREE.LatheGeometry(ferrulePts, 20).rotateZ(Math.PI / 2);
  for (const fx of [GRIP_FROM - 0.004, GRIP_FROM - GRIP_LEN + 0.002]) {
    const ferrule = new THREE.Mesh(ferruleGeo, brass);
    ferrule.position.x = fx;
    parts.add(ferrule);
  }

  // --- Wheel pommel + peened tang button -------------------------------------------
  const POMMEL_X = GRIP_FROM - GRIP_LEN - 0.022;
  const pommel = new THREE.Mesh(wheelPommelGeometry(), darkSteel);
  pommel.position.x = POMMEL_X;
  parts.add(pommel);
  const buttonPts = [
    [0.0075, 0],
    [0.0072, 0.004],
    [0.0058, 0.0068],
    [0.0001, 0.0078],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const button = new THREE.Mesh(
    new THREE.LatheGeometry(buttonPts, 14).rotateZ(Math.PI / 2),
    darkSteel,
  );
  button.position.x = POMMEL_X - 0.0265;
  parts.add(button);

  // --- Resting pose ---------------------------------------------------------------------
  // Tilt nose-down until the tip meets the table under the guard's
  // support, then lift so the lowest point sits on y = 0 and recenter.
  const guardHalf = 0.0155;
  const tipX = BLADE_X0 + BLADE_LEN;
  parts.rotation.z = -Math.atan2(guardHalf, tipX);
  group.add(parts);
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(parts);
  parts.position.y = -box.min.y;
  parts.position.x = -(box.max.x + box.min.x) / 2;

  group.userData.itemId = "sword";
  group.userData.label = ITEM_LABELS.sword.name;
  return group;
}
