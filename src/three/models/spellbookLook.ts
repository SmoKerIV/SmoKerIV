/**
 * Surface dressing for the spellbook (spellbook.ts keeps all structure,
 * pivots, page meshes and animation targets): leather and tooled-cover map
 * sets, beveled cover slabs with per-face material groups, brass corner
 * guards, the gilded page block, raised spine bands and clasp pieces.
 * Everything here stays inside the closed book's original footprint so the
 * focus anchor, contact shadow and dice colliders don't move.
 */
import * as THREE from "three";
import { mergeGeometries, toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  cachedMaps,
  fieldToTexture,
  heightToNormalMap,
  makeCanvas,
  mulberry32,
  noiseField,
  toTexture,
  type PbrMaps,
} from "./textures";

// --- Maps ----------------------------------------------------------------------------

type LeatherMaps = PbrMaps & { metalnessMap: THREE.Texture };

/** Leather albedo/height/roughness at one texel (shared by both map sets). */
function leatherTexel(
  mott: number,
  pores: number,
  crease: number,
): { r: number; g: number; b: number; h: number; rough: number } {
  const pore = Math.max(0, pores - 0.58) * 2.4;
  const tone = 0.74 + (mott - 0.5) * 0.42 - pore * 0.14 - crease * 0.06;
  return {
    r: 112 * tone,
    g: 52 * tone,
    b: 34 * tone,
    h: mott * 0.25 - pore * 0.35 - crease * 0.15,
    rough: 0.66 + pore * 0.2 - (mott - 0.5) * 0.12,
  };
}

/** Tileable plain leather (back cover, spine, turn-ins, bands). */
export function plainLeatherMaps(): PbrMaps {
  return cachedMaps("book:leather", () => {
    const S = 512;
    const mott = noiseField(S, S, 7101, 4, 4, 5);
    const pores = noiseField(S, S, 7102, 90, 90, 2);
    const crease = noiseField(S, S, 7103, 10, 10, 3);
    const [canvas, ctx] = makeCanvas(S, S);
    const img = ctx.createImageData(S, S);
    const h = new Float32Array(S * S);
    const rough = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) {
      const c = Math.max(0, 1 - Math.abs(crease[i]! - 0.5) * 30);
      const t = leatherTexel(mott[i]!, pores[i]!, c);
      img.data[i * 4] = t.r;
      img.data[i * 4 + 1] = t.g;
      img.data[i * 4 + 2] = t.b;
      img.data[i * 4 + 3] = 255;
      h[i] = t.h;
      rough[i] = t.rough;
    }
    ctx.putImageData(img, 0, 0);
    return {
      map: toTexture(canvas),
      normalMap: heightToNormalMap(h, S, S, 1.6),
      roughnessMap: fieldToTexture(rough, S, S),
    };
  });
}

/**
 * Front cover top: blind-tooled double frame with gilt inner rule, corner
 * fleurons, an embossed sigil ring around the glowing rune and worn,
 * lighter edges. u = 0 at the spine, v across the cover.
 */
export function tooledCoverMaps(): LeatherMaps {
  return cachedMaps("book:cover", () => {
    const W = 1024;
    const H = 736; // 0.50 x 0.36 m
    const mott = noiseField(W, H, 7201, 5, 4, 5);
    const pores = noiseField(W, H, 7202, 170, 120, 2);
    const crease = noiseField(W, H, 7203, 12, 9, 3);

    // Tooling mask: white = pressed groove; gold mask separately.
    const [, tctx] = makeCanvas(W, H);
    tctx.fillStyle = "#000";
    tctx.fillRect(0, 0, W, H);
    tctx.strokeStyle = "#fff";
    tctx.lineCap = "round";
    const frame = (inset: number, width: number): void => {
      tctx.lineWidth = width;
      tctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
    };
    frame(34, 5);
    frame(52, 3);
    frame(96, 4);
    // Diagonal fillets from the outer to the inner frame at the corners
    tctx.lineWidth = 3;
    for (const [x0, y0, x1, y1] of [
      [52, 52, 96, 96],
      [W - 52, 52, W - 96, 96],
      [52, H - 52, 96, H - 96],
      [W - 52, H - 52, W - 96, H - 96],
    ]) {
      tctx.beginPath();
      tctx.moveTo(x0!, y0!);
      tctx.lineTo(x1!, y1!);
      tctx.stroke();
    }
    // Corner fleurons inside the inner frame
    const fleuron = (cx: number, cy: number, sx: number, sy: number): void => {
      tctx.lineWidth = 3;
      for (let k = 0; k < 3; k++) {
        tctx.beginPath();
        tctx.ellipse(cx + sx * (18 + k * 16), cy + sy * (18 + k * 16), 14 - k * 3, 6, sx * sy * Math.PI / 4, 0, Math.PI * 2);
        tctx.stroke();
      }
      tctx.beginPath();
      tctx.arc(cx + sx * 8, cy + sy * 8, 5, 0, Math.PI * 2);
      tctx.stroke();
    };
    fleuron(96, 96, 1, 1);
    fleuron(W - 96, 96, -1, 1);
    fleuron(96, H - 96, 1, -1);
    fleuron(W - 96, H - 96, -1, -1);

    // Embossed (raised) sigil ring around the rune: drawn into a second mask
    const [, rctx] = makeCanvas(W, H);
    rctx.fillStyle = "#000";
    rctx.fillRect(0, 0, W, H);
    rctx.strokeStyle = "#fff";
    const cx = W / 2;
    const cy = H / 2;
    const R = 200; // ~0.098 m
    rctx.lineWidth = 9;
    rctx.beginPath();
    rctx.arc(cx, cy, R, 0, Math.PI * 2);
    rctx.stroke();
    rctx.lineWidth = 4;
    rctx.beginPath();
    rctx.arc(cx, cy, R + 22, 0, Math.PI * 2);
    rctx.stroke();
    // Ticks + small lozenges between the two rings
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      rctx.lineWidth = k % 3 === 0 ? 5 : 3;
      rctx.beginPath();
      rctx.moveTo(cx + Math.cos(a) * (R + 5), cy + Math.sin(a) * (R + 5));
      rctx.lineTo(cx + Math.cos(a) * (R + 19), cy + Math.sin(a) * (R + 19));
      rctx.stroke();
    }
    // Four-point star rays reaching out to the inner frame
    rctx.lineWidth = 4;
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      rctx.beginPath();
      rctx.moveTo(cx + Math.cos(a) * (R + 26), cy + Math.sin(a) * (R + 26));
      rctx.lineTo(cx + Math.cos(a) * (R + 80), cy + Math.sin(a) * (R + 80));
      rctx.stroke();
    }
    rctx.filter = "blur(2px)";
    rctx.drawImage(rctx.canvas, 0, 0);
    tctx.filter = "blur(1.5px)";
    tctx.drawImage(tctx.canvas, 0, 0);
    const tool = tctx.getImageData(0, 0, W, H).data;
    const relief = rctx.getImageData(0, 0, W, H).data;

    const [canvas, ctx] = makeCanvas(W, H);
    const img = ctx.createImageData(W, H);
    const h = new Float32Array(W * H);
    const rough = new Float32Array(W * H);
    const metal = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const c = Math.max(0, 1 - Math.abs(crease[i]! - 0.5) * 30);
        const t = leatherTexel(mott[i]!, pores[i]!, c);
        const groove = tool[i * 4]! / 255;
        const raised = relief[i * 4]! / 255;
        // Wear: lighter, smoother leather toward the edges and corners
        const ex = Math.min(x, W - 1 - x) / W;
        const ey = Math.min(y, H - 1 - y) / H;
        const wear = 1 - THREE.MathUtils.smoothstep(Math.min(ex, ey), 0.0, 0.035);
        // Gilt only in the inner rule (inset 52) and the raised ring
        const giltRule = Math.abs(Math.min(x, W - 1 - x, y, H - 1 - y) - 52) < 2.2 ? groove : 0;
        const gilt = Math.max(giltRule, raised > 0.55 ? (raised - 0.55) * 2.2 : 0) *
          (0.75 + mott[i]! * 0.5);
        let r = t.r * (1 - groove * 0.45) * (1 + wear * 0.35) * (1 + raised * 0.12);
        let g = t.g * (1 - groove * 0.45) * (1 + wear * 0.3) * (1 + raised * 0.12);
        let b = t.b * (1 - groove * 0.45) * (1 + wear * 0.25) * (1 + raised * 0.12);
        const gl = Math.min(1, gilt);
        r = r * (1 - gl) + 196 * gl;
        g = g * (1 - gl) + 152 * gl;
        b = b * (1 - gl) + 74 * gl;
        img.data[i * 4] = r;
        img.data[i * 4 + 1] = g;
        img.data[i * 4 + 2] = b;
        img.data[i * 4 + 3] = 255;
        h[i] = t.h * 0.6 - groove * 1.2 + raised * 1.1;
        rough[i] = t.rough - wear * 0.2 + groove * 0.1 - gl * 0.35;
        metal[i] = gl * 0.85;
      }
    }
    ctx.putImageData(img, 0, 0);
    const map = toTexture(canvas);
    map.anisotropy = 8;
    const out = {
      map,
      normalMap: heightToNormalMap(h, W, H, 2.4, false),
      roughnessMap: fieldToTexture(rough, W, H),
      metalnessMap: fieldToTexture(metal, W, H),
    };
    for (const tex of Object.values(out)) {
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
    }
    return out;
  });
}

/**
 * Page edges (head, tail, fore-edge): a dense stack of aged cream leaves
 * with faint gilt rubbed into them. Lines run along u; v climbs the stack
 * (v = 0 on the back board, 1 under the front board).
 */
export function pageEdgeMaps(): PbrMaps {
  return cachedMaps("book:pageEdge", () => {
    const W = 512;
    const H = 512;
    const rand = mulberry32(7301);
    const stain = noiseField(W, H, 7302, 5, 3, 4);
    const fibre = noiseField(W, H, 7303, 64, 2, 2);
    // ~170 leaves over the stack: each leaf a lighter body and a thin,
    // slightly darker seam, with per-leaf tone jitter.
    const leaf = new Float32Array(H);
    const seam = new Float32Array(H);
    let y = 0;
    while (y < H) {
      const thick = 2 + Math.floor(rand() * 2.2);
      const tone = 0.9 + rand() * 0.1;
      for (let k = 0; k < thick && y < H; k++, y++) {
        leaf[y] = tone;
        seam[y] = k === thick - 1 ? 1 : 0;
      }
    }
    const [canvas, ctx] = makeCanvas(W, H);
    const img = ctx.createImageData(W, H);
    const h = new Float32Array(W * H);
    const rough = new Float32Array(W * H);
    for (let yy = 0; yy < H; yy++) {
      // Darker, more foxed toward the boards (top and bottom of the stack)
      const edge = Math.min(yy, H - 1 - yy) / H;
      const foxEdge = 1 - THREE.MathUtils.smoothstep(edge, 0, 0.12);
      for (let x = 0; x < W; x++) {
        const i = yy * W + x;
        const st = stain[i]!;
        const fx = Math.max(0, st - 0.55) * 1.6 + foxEdge * 0.25;
        const l = leaf[yy]! * (1 - seam[yy]! * 0.16) * (0.97 + fibre[i]! * 0.06);
        // Faint gilt: warm gold where the stain field is low
        const gilt = Math.max(0, 0.5 - st) * 0.5;
        const r = (226 * (1 - gilt) + 214 * gilt) * l * (1 - fx * 0.22);
        const g = (210 * (1 - gilt) + 170 * gilt) * l * (1 - fx * 0.3);
        const b = (172 * (1 - gilt) + 92 * gilt) * l * (1 - fx * 0.42);
        img.data[i * 4] = r;
        img.data[i * 4 + 1] = g;
        img.data[i * 4 + 2] = b;
        img.data[i * 4 + 3] = 255;
        h[i] = -seam[yy]! * 0.6 + leaf[yy]! * 0.2;
        rough[i] = 0.62 - gilt * 0.5 + seam[yy]! * 0.15;
      }
    }
    ctx.putImageData(img, 0, 0);
    const map = toTexture(canvas);
    map.anisotropy = 8;
    return {
      map,
      normalMap: heightToNormalMap(h, W, H, 0.8),
      roughnessMap: fieldToTexture(rough, W, H),
    };
  });
}

/** Aged brass for the corner guards and clasp. */
export function agedBrassMaps(): PbrMaps {
  return cachedMaps("book:brass", () => {
    const S = 256;
    const n = noiseField(S, S, 7401, 6, 6, 5);
    const dents = noiseField(S, S, 7402, 24, 24, 2);
    const [canvas, ctx] = makeCanvas(S, S);
    const img = ctx.createImageData(S, S);
    const h = new Float32Array(S * S);
    const rough = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) {
      // Warm yellow brass (kept a little away from green so the teal
      // arcane light doesn't turn it olive), tarnish toward dull brown.
      const tarnish = Math.max(0, n[i]! - 0.5) * 1.2;
      img.data[i * 4] = 200 - tarnish * 62;
      img.data[i * 4 + 1] = 160 - tarnish * 58;
      img.data[i * 4 + 2] = 84 - tarnish * 34;
      img.data[i * 4 + 3] = 255;
      h[i] = dents[i]! * 0.12;
      rough[i] = 0.4 + tarnish * 0.25;
    }
    ctx.putImageData(img, 0, 0);
    return {
      map: toTexture(canvas),
      normalMap: heightToNormalMap(h, S, S, 0.8),
      roughnessMap: fieldToTexture(rough, S, S),
    };
  });
}

/** Start-up warm-up hook: paint every spellbook map now (cached). */
export function spellbookMaps(): void {
  plainLeatherMaps();
  tooledCoverMaps();
  pageEdgeMaps();
  agedBrassMaps();
}

// --- Materials -----------------------------------------------------------------------------

export function plainLeather(repeat = 1): THREE.MeshStandardMaterial {
  const m = plainLeatherMaps();
  const mat = new THREE.MeshStandardMaterial({
    map: m.map,
    normalMap: m.normalMap,
    roughnessMap: m.roughnessMap,
    roughness: 1,
    metalness: 0,
  });
  if (repeat !== 1) {
    for (const key of ["map", "normalMap", "roughnessMap"] as const) {
      const tex = mat[key]!.clone();
      tex.repeat.set(repeat, repeat);
      mat[key] = tex;
    }
  }
  return mat;
}

export function tooledLeather(): THREE.MeshStandardMaterial {
  const m = tooledCoverMaps();
  return new THREE.MeshStandardMaterial({
    map: m.map,
    normalMap: m.normalMap,
    roughnessMap: m.roughnessMap,
    metalnessMap: m.metalnessMap,
    roughness: 1,
    metalness: 1,
  });
}

/** Page edges: mostly paper, a touch of metal for the rubbed-in gilt. */
export function pageEdge(): THREE.MeshStandardMaterial {
  const m = pageEdgeMaps();
  return new THREE.MeshStandardMaterial({
    map: m.map,
    normalMap: m.normalMap,
    roughnessMap: m.roughnessMap,
    roughness: 1,
    metalness: 0.12,
  });
}

export function agedBrass(): THREE.MeshStandardMaterial {
  const m = agedBrassMaps();
  return new THREE.MeshStandardMaterial({
    map: m.map,
    normalMap: m.normalMap,
    roughnessMap: m.roughnessMap,
    // No env map in the scene: a near-pure metal only mirrors the lights,
    // and the teal arcane light over the book tinted it green. Half metal
    // keeps a warm diffuse body under the candles plus a soft sheen.
    roughness: 1,
    metalness: 0.55,
  });
}

// --- Geometry ------------------------------------------------------------------------------

/**
 * Beveled, round-cornered slab exactly w x t x d (centered), with material
 * groups 0 = top, 1 = bottom, 2 = sides. Top/bottom UVs are planar over
 * the slab (u along X from -w/2, v along Z), sides wrap around.
 */
export function slabGeometry(
  w: number,
  t: number,
  d: number,
  radius = 0.006,
  bevel = 0.0022,
): THREE.BufferGeometry {
  const iw = w / 2 - bevel;
  const id = d / 2 - bevel;
  const r = Math.min(radius, iw, id);
  const shape = new THREE.Shape();
  shape.moveTo(-iw + r, -id);
  shape.lineTo(iw - r, -id);
  shape.quadraticCurveTo(iw, -id, iw, -id + r);
  shape.lineTo(iw, id - r);
  shape.quadraticCurveTo(iw, id, iw - r, id);
  shape.lineTo(-iw + r, id);
  shape.quadraticCurveTo(-iw, id, -iw, id - r);
  shape.lineTo(-iw, -id + r);
  shape.quadraticCurveTo(-iw, -id, -iw + r, -id);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.0001, t - 2 * bevel),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 3,
  });
  geo.rotateX(Math.PI / 2); // shape y → +z, extrusion → −y
  geo.translate(0, t / 2 - bevel, 0);

  // Regroup triangles by facing: top, bottom, sides.
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const nor = geo.getAttribute("normal") as THREE.BufferAttribute;
  const buckets: number[][] = [[], [], []];
  for (let tri = 0; tri < pos.count / 3; tri++) {
    let ny = 0;
    for (let k = 0; k < 3; k++) ny += nor.getY(tri * 3 + k);
    ny /= 3;
    buckets[ny > 0.9 ? 0 : ny < -0.9 ? 1 : 2]!.push(tri);
  }
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const out = new THREE.BufferGeometry();
  let start = 0;
  buckets.forEach((tris, group) => {
    for (const tri of tris) {
      for (let k = 0; k < 3; k++) {
        const i = tri * 3 + k;
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        positions.push(x, y, z);
        normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
        if (group < 2) uvs.push(x / w + 0.5, 0.5 - z / d);
        else uvs.push((x + z) / w + 0.5, y / t + 0.5);
      }
    }
    out.addGroup(start, tris.length * 3, group);
    start += tris.length * 3;
  });
  out.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.dispose();
  return out;
}

/**
 * Brass corner guard bent from ~1 mm sheet around a board corner: a top
 * plate with a concave inner edge, a band down the board's two edges (and
 * around its rounded corner) and a narrower lip folded under the board.
 * Local frame: corner at the origin, board inside +X/+Z, board faces at
 * y = 0 and y = boardT (rotate about Y to fit other corners).
 */
export function cornerGuardGeometry(leg: number, boardT: number): THREE.BufferGeometry {
  const R = 0.0082; // the slab's rounded corner (radius + bevel)
  const e = 0.001; // sheet thickness
  const plate = (L: number): THREE.Shape => {
    const shape = new THREE.Shape();
    shape.moveTo(R, 0);
    shape.lineTo(L, 0);
    shape.lineTo(L, L * 0.18);
    shape.quadraticCurveTo(L * 0.3, L * 0.3, L * 0.18, L);
    shape.lineTo(0, L);
    shape.lineTo(0, R);
    shape.absarc(R, R, R, Math.PI, Math.PI * 1.5, false);
    return shape;
  };
  const band = new THREE.Shape();
  band.moveTo(leg, -e);
  band.lineTo(R, -e);
  band.absarc(R, R, R + e, Math.PI * 1.5, Math.PI, true);
  band.lineTo(-e, leg);
  band.lineTo(0, leg);
  band.lineTo(0, R);
  band.absarc(R, R, R, Math.PI, Math.PI * 1.5, false);
  band.lineTo(leg, 0);
  band.closePath();

  const extrude = (shape: THREE.Shape, depth: number, top: number): THREE.BufferGeometry => {
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: false,
      curveSegments: 6,
    });
    geo.rotateX(Math.PI / 2); // shape y → +z, extrusion → −y
    geo.translate(0, top, 0);
    return geo;
  };
  const parts = [
    extrude(plate(leg), e, boardT + e), // top plate
    extrude(band, boardT + 2 * e, boardT + e), // edge band
    extrude(plate(leg * 0.42), e, 0), // lip under the board
  ];
  const merged = mergeGeometries(parts)!;
  for (const part of parts) part.dispose();
  // Smooth the band around the rounded corner (flat facets read as a
  // dark stripe on the metal), keep the sheet's folded edges crisp.
  const geo = toCreasedNormals(merged, Math.PI / 4);
  merged.dispose();
  geo.clearGroups();
  return brassUVs(geo);
}

/**
 * Box-projected UVs (by face normal, 10 per metre) so the brass noise keeps
 * the same scale on every face of a small part instead of stretching into
 * streaks. Returns the same geometry.
 */
export function brassUVs(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const nor = geo.getAttribute("normal") as THREE.BufferAttribute;
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    if (ay >= ax && ay >= az) uv.setXY(i, x * 10, z * 10);
    else if (ax >= az) uv.setXY(i, z * 10, y * 10);
    else uv.setXY(i, x * 10, y * 10);
  }
  uv.needsUpdate = true;
  return geo;
}

/** Rotation about Y that turns a +X/+Z corner piece toward inward (ix, iz). */
export function cornerRotation(ix: 1 | -1, iz: 1 | -1): number {
  if (ix === 1 && iz === 1) return 0;
  if (ix === 1 && iz === -1) return Math.PI / 2;
  if (ix === -1 && iz === -1) return Math.PI;
  return -Math.PI / 2;
}

/**
 * Raised cord on the spine's outer surface: a tube of elliptical section
 * (radial x across semi-axes) whose centre runs `lift` outside the spine
 * ellipse (semi-axes a in X, b in Y, centred at (cx, cy)) at z, for the
 * ellipse angle t in [tFrom, tTo] (x = cx + a cos t, y = cy + b sin t).
 * The section shrinks to nothing over `taper` radians at both ends, so
 * the cord rises out of the leather instead of ending in a cut.
 */
export function spineCordGeometry(
  cx: number,
  cy: number,
  a: number,
  b: number,
  z: number,
  tFrom: number,
  tTo: number,
  radial: number,
  across: number,
  lift = 0,
  taper = 0.22,
): THREE.BufferGeometry {
  const NT = 48;
  const NS = 12;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= NT; i++) {
    const t = tFrom + ((tTo - tFrom) * i) / NT;
    const px = cx + a * Math.cos(t);
    const py = cy + b * Math.sin(t);
    let nx = Math.cos(t) / a;
    let ny = Math.sin(t) / b;
    const nl = Math.hypot(nx, ny);
    nx /= nl;
    ny /= nl;
    const edge = Math.min(t - tFrom, tTo - t) / taper;
    const f = edge >= 1 ? 1 : Math.sin(Math.max(0, edge) * Math.PI * 0.5);
    for (let j = 0; j <= NS; j++) {
      // Seam on the buried inner side (phi = pi).
      const phi = Math.PI + (2 * Math.PI * j) / NS;
      const r = lift + radial * f * Math.cos(phi);
      positions.push(px + nx * r, py + ny * r, z + across * f * Math.sin(phi));
      uvs.push(t * 0.06, j / NS);
    }
  }
  for (let i = 0; i < NT; i++) {
    for (let j = 0; j < NS; j++) {
      const p = i * (NS + 1) + j;
      const q = p + NS + 1;
      indices.push(p, q, p + 1, p + 1, q, q + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Page block with a gently concave fore-edge (x = +w/2) and head/tail
 * (z = ±d/2); the top stays flat. Groups follow BoxGeometry:
 * +x, −x, +y, −y, +z, −z.
 */
export function pageBlockGeometry(w: number, h: number, d: number): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(w, h, d, 1, 6, 8);
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const yn = (y + h / 2) / h; // 0 bottom … 1 top
    const belly = Math.sin(Math.PI * yn);
    let nx = x;
    let nz = z;
    if (x > w / 2 - 1e-6) nx = x - 0.0028 * belly * (1 - (2 * Math.abs(z) / d) ** 4);
    if (Math.abs(z) > d / 2 - 1e-6) nz = z - Math.sign(z) * 0.0016 * belly;
    pos.setXYZ(i, nx, y, nz);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Point on an ellipse at angle t (x = cx + a cos t, y = cy + b sin t). */
function ellipsePoint(cx: number, cy: number, a: number, b: number, t: number): THREE.Vector2 {
  return new THREE.Vector2(cx + a * Math.cos(t), cy + b * Math.sin(t));
}

/**
 * Spine leather as a solid wall `wall` thick: the outer elliptical face
 * (semi-axes a in X, b in Y, centred at (cx, cy)) runs from angle tFrom
 * (inside the book, under the front board) over the ridge and down the
 * outside to the table; the wall closes at both ends with slightly rounded
 * edges. Spans z ±length/2. UVs: u around the spine, v along it (end
 * faces planar), at one leather tile per 0.5 m.
 */
export function spineShellGeometry(
  cx: number,
  cy: number,
  a: number,
  b: number,
  wall: number,
  length: number,
  tFrom: number,
  tTo = Math.PI + Math.asin(Math.min(1, cy / b)), // default: outer meets y = 0
): THREE.BufferGeometry {
  const N = 64;
  const tEnd = tTo;
  const shape = new THREE.Shape();
  const p0 = ellipsePoint(cx, cy, a, b, tFrom);
  shape.moveTo(p0.x, p0.y);
  for (let i = 1; i <= N; i++) {
    const p = ellipsePoint(cx, cy, a, b, tFrom + ((tEnd - tFrom) * i) / N);
    shape.lineTo(p.x, Math.max(0, p.y));
  }
  const ia = a - wall;
  const ib = b - wall;
  const tInEnd = Math.min(Math.PI * 1.5, tEnd);
  for (let i = N; i >= 0; i--) {
    const p = ellipsePoint(cx, cy, ia, ib, tFrom + ((tInEnd - tFrom) * i) / N);
    shape.lineTo(p.x, p.y);
  }
  shape.closePath();
  const bevel = 0.0007;
  const extruded = new THREE.ExtrudeGeometry(shape, {
    depth: length - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel, // keep the outline's extents
    bevelSegments: 2,
    curveSegments: 4,
  });
  extruded.translate(0, 0, -length / 2 + bevel);
  const geo = toCreasedNormals(extruded, Math.PI / 5);
  extruded.dispose();
  geo.clearGroups();
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const nor = geo.getAttribute("normal") as THREE.BufferAttribute;
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (Math.abs(nor.getZ(i)) > 0.6) {
      uv.setXY(i, x * 2, y * 2);
    } else {
      let t = Math.atan2((y - cy) / b, (x - cx) / a);
      if (t < tFrom - 0.3) t += Math.PI * 2;
      uv.setXY(i, t * 0.035 * 2, z * 2);
    }
  }
  return geo;
}

/**
 * Solid filler under the spine wall seen from the head/tail: the region
 * between the inner spine ellipse (semi-axes a, b) and the vertical line
 * x = xIn, for yLo <= y <= yHi, extruded over z ±zHalf. Used for the
 * rounded back of the text block (paper) and the joint behind it.
 * UVs on the end faces: u along X over `uSpan`, v = (y - vFrom) / vSpan.
 */
export function spineFillGeometry(
  cx: number,
  cy: number,
  a: number,
  b: number,
  xIn: number,
  yLo: number,
  yHi: number,
  zHalf: number,
  vFrom: number,
  vSpan: number,
  uSpan = 0.5,
): THREE.BufferGeometry {
  const N = 32;
  const tAt = (y: number): number =>
    Math.PI - Math.asin(THREE.MathUtils.clamp((y - cy) / b, -1, 1));
  const t0 = tAt(yHi);
  const t1 = tAt(yLo);
  const shape = new THREE.Shape();
  for (let i = 0; i <= N; i++) {
    const p = ellipsePoint(cx, cy, a, b, t0 + ((t1 - t0) * i) / N);
    if (i === 0) shape.moveTo(p.x, p.y);
    else shape.lineTo(p.x, p.y);
  }
  shape.lineTo(xIn, yLo);
  shape.lineTo(xIn, yHi);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: zHalf * 2,
    bevelEnabled: false,
    curveSegments: 4,
  });
  geo.translate(0, 0, -zHalf);
  geo.clearGroups();
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + pos.getZ(i)) / uSpan, (pos.getY(i) - vFrom) / vSpan);
  }
  return geo;
}

/**
 * U-shaped top course of the page block (open on the spine side, -X):
 * outer edge at x in [xS, xF], z ±zO; the pocket inside it (x < xP,
 * |z| < zP) holds the loose pages. Occupies y in [0, h] so it can be
 * squashed toward its base. Groups: 0 = top/bottom, 1 = walls. Wall UVs:
 * v runs vFrom..1 bottom to top (continuing the page block's edge map).
 */
export function pageRimGeometry(
  xS: number,
  xF: number,
  xP: number,
  zO: number,
  zP: number,
  h: number,
  vFrom: number,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  // Shape y becomes −z after rotateX(−π/2); the outline is symmetric.
  shape.moveTo(xS, -zO);
  shape.lineTo(xF, -zO);
  shape.lineTo(xF, zO);
  shape.lineTo(xS, zO);
  shape.lineTo(xS, zP);
  shape.lineTo(xP, zP);
  shape.lineTo(xP, -zP);
  shape.lineTo(xS, -zP);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2); // extrusion → +y
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const nor = geo.getAttribute("normal") as THREE.BufferAttribute;
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (Math.abs(nor.getY(i)) > 0.5) uv.setXY(i, x * 2, z * 2);
    else uv.setXY(i, (x + xS) / (xF - xS) + z * 2, vFrom + (y / h) * (1 - vFrom));
  }
  return geo;
}
