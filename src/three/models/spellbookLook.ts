/**
 * Surface dressing for the spellbook (spellbook.ts keeps all structure,
 * pivots, page meshes and animation targets): leather and tooled-cover map
 * sets, beveled cover slabs with per-face material groups, brass corner
 * guards, the gilded page block, raised spine bands and clasp pieces.
 * Everything here stays inside the closed book's original footprint so the
 * focus anchor, contact shadow and dice colliders don't move.
 */
import * as THREE from "three";
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

/** Gilded page edges: stacked leaf lines, worn gold. u along the edge, v up. */
export function giltEdgeMaps(): PbrMaps {
  return cachedMaps("book:gilt", () => {
    const W = 512;
    const H = 128;
    const rand = mulberry32(7301);
    const wear = noiseField(W, H, 7302, 6, 2, 4);
    const lines = new Float32Array(H);
    for (let y = 0; y < H; y++) lines[y] = 0.7 + rand() * 0.3;
    const [canvas, ctx] = makeCanvas(W, H);
    const img = ctx.createImageData(W, H);
    const h = new Float32Array(W * H);
    const rough = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      // Thin dark gaps between leaves every couple of texels
      const gap = y % 2 === 0 ? 0.55 : 1;
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const wv = wear[i]!;
        const worn = Math.max(0, wv - 0.62) * 2.5; // gold rubbed off → paper
        const gold = 1 - Math.min(1, worn);
        const l = lines[y]! * gap;
        img.data[i * 4] = (210 * gold + 222 * (1 - gold)) * l;
        img.data[i * 4 + 1] = (162 * gold + 206 * (1 - gold)) * l;
        img.data[i * 4 + 2] = (78 * gold + 168 * (1 - gold)) * l;
        img.data[i * 4 + 3] = 255;
        h[i] = gap * 0.6 + wv * 0.2;
        rough[i] = 0.32 + (1 - gold) * 0.55 + (1 - gap) * 0.2;
      }
    }
    ctx.putImageData(img, 0, 0);
    return {
      map: toTexture(canvas),
      normalMap: heightToNormalMap(h, W, H, 1.5),
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
      const tarnish = Math.max(0, n[i]! - 0.55) * 2;
      img.data[i * 4] = 200 - tarnish * 90;
      img.data[i * 4 + 1] = 160 - tarnish * 75;
      img.data[i * 4 + 2] = 86 - tarnish * 40;
      img.data[i * 4 + 3] = 255;
      h[i] = dents[i]! * 0.5;
      rough[i] = 0.32 + tarnish * 0.4;
    }
    ctx.putImageData(img, 0, 0);
    return {
      map: toTexture(canvas),
      normalMap: heightToNormalMap(h, S, S, 1.5),
      roughnessMap: fieldToTexture(rough, S, S),
    };
  });
}

/** Start-up warm-up hook: paint every spellbook map now (cached). */
export function spellbookMaps(): void {
  plainLeatherMaps();
  tooledCoverMaps();
  giltEdgeMaps();
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

export function giltEdge(): THREE.MeshStandardMaterial {
  const m = giltEdgeMaps();
  return new THREE.MeshStandardMaterial({
    map: m.map,
    normalMap: m.normalMap,
    roughnessMap: m.roughnessMap,
    roughness: 1,
    metalness: 0.55,
  });
}

export function agedBrass(): THREE.MeshStandardMaterial {
  const m = agedBrassMaps();
  return new THREE.MeshStandardMaterial({
    map: m.map,
    normalMap: m.normalMap,
    roughnessMap: m.roughnessMap,
    roughness: 1,
    metalness: 0.8,
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
 * Brass corner guard: a flat plate whose inner edge is a concave arc, legs
 * along +X and +Z from the corner (rotate about Y to fit other corners).
 * Sits on y = 0, ~1.6 mm thick.
 */
export function cornerGuardGeometry(leg: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(leg, 0);
  shape.lineTo(leg, leg * 0.18);
  shape.quadraticCurveTo(leg * 0.3, leg * 0.3, leg * 0.18, leg);
  shape.lineTo(0, leg);
  shape.closePath();
  const depth = 0.0008;
  const bevel = 0.0004;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 5,
  });
  geo.rotateX(Math.PI / 2); // shape y → +z, extrusion → −y
  geo.translate(0, depth + bevel, 0);
  // Planar UVs for the brass noise
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) * 8, pos.getZ(i) * 8);
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
 * Raised spine band: a rounded cord following the spine's half-ellipse
 * (semi-axes a in X, b in Y, centred at (cx, cy)) on the −X side, at z.
 */
export function spineBandGeometry(
  cx: number,
  cy: number,
  a: number,
  b: number,
  z: number,
  tube: number,
  tFrom: number,
  tTo: number,
): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  const N = 16;
  for (let i = 0; i <= N; i++) {
    const t = tFrom + ((tTo - tFrom) * i) / N;
    pts.push(new THREE.Vector3(cx - a * Math.cos(t), cy + b * Math.sin(t), z));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.TubeGeometry(curve, 20, tube, 6, false);
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

/**
 * Spine leather: an elliptical shell (semi-axes a in X, b in Y, centred at
 * (cx, cy)) along Z, covering the top half (the ridge over the boards) and
 * the outer-lower quarter down to the table.
 */
export function spineWrapGeometry(
  cx: number,
  cy: number,
  a: number,
  b: number,
  length: number,
): THREE.BufferGeometry {
  // Angle t: x = cx + a cos t, y = cy + b sin t; 0 → inner top, π → outer.
  const t0 = 0;
  const t1 = Math.PI * 1.5;
  const N = 30;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= N; i++) {
    const t = t0 + ((t1 - t0) * i) / N;
    const x = cx + a * Math.cos(t);
    const y = Math.max(0, cy + b * Math.sin(t));
    for (const [k, z] of [-length / 2, length / 2].entries()) {
      positions.push(x, y, z);
      uvs.push(i / N, k);
    }
  }
  for (let i = 0; i < N; i++) {
    const p = i * 2;
    // Outward normals: t increases counter-clockwise seen from +Z.
    indices.push(p, p + 2, p + 1, p + 1, p + 2, p + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
