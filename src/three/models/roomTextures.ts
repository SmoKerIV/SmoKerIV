/**
 * Canvas-painted surfaces for the inn room: plaster-over-stone walls, a
 * plank floor, sooty hearth stone (each with a matching normal map built
 * from a painted height field) and the window's night sky, moon and
 * clouds. Deterministic (seeded) and cached like textures.ts; sizes drop
 * on low quality.
 */
import * as THREE from "three";
import { cachedTexture } from "./textures";

export interface SurfaceMaps {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
}

/** Room canvases: 1024 px normally, 512 px on low quality. */
let surfaceSize = 1024;
export function setRoomTextureSize(size: number): void {
  surfaceSize = size;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas2d(w: number, h = w): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not acquire 2d canvas context");
  return [canvas, ctx];
}

function colorTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Tileable value noise on a period x period lattice (smoothstep blend),
 * summed over octaves; returns ~0..1.
 */
function periodicNoise(seed: number, period: number): (x: number, y: number) => number {
  const rand = mulberry32(seed);
  const lattice = new Float32Array(period * period);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rand();
  const at = (ix: number, iy: number): number =>
    lattice[(((iy % period) + period) % period) * period + (((ix % period) + period) % period)]!;
  const single = (x: number, y: number): number => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = at(ix, iy);
    const b = at(ix + 1, iy);
    const c = at(ix, iy + 1);
    const d = at(ix + 1, iy + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  // x, y in 0..1 (one tile); octaves stay periodic (integer multiples).
  return (x, y) => {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    let norm = 0;
    for (let o = 0; o < 4; o++) {
      sum += single(x * period * freq, y * period * freq) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  };
}

/**
 * Tangent-space normal map from a grey height canvas (R channel), with
 * wrap-around Sobel so tiling stays seamless. Linear colour space.
 */
function normalFromHeight(
  height: CanvasRenderingContext2D,
  w: number,
  h: number,
  strength: number,
): THREE.CanvasTexture {
  const src = height.getImageData(0, 0, w, h).data;
  const [canvas, ctx] = canvas2d(w, h);
  const out = ctx.createImageData(w, h);
  const H = (x: number, y: number): number =>
    src[((((y + h) % h) * w + ((x + w) % w)) << 2)]! / 255;
  const d = out.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx =
        H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1) -
        (H(x - 1, y - 1) + 2 * H(x - 1, y) + H(x - 1, y + 1));
      const dy =
        H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1) -
        (H(x - 1, y - 1) + 2 * H(x, y - 1) + H(x + 1, y - 1));
      // Canvas y runs down while texture v runs up: flip dy.
      let nx = -dx * strength;
      let ny = dy * strength;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (y * w + x) << 2;
      d[i] = (nx * 0.5 + 0.5) * 255;
      d[i + 1] = (ny * 0.5 + 0.5) * 255;
      d[i + 2] = (nz * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

/** Draw a shape at x and again one tile left/right so rows wrap seamlessly. */
function wrapX(w: number, x: number, span: number, draw: (x: number) => void): void {
  draw(x);
  if (x + span > w) draw(x - w);
  if (x < 0) draw(x + w);
}

/**
 * Stone courses: irregular rounded blocks on dark mortar, painted into a
 * colour and a height canvas at once.
 */
function paintStoneCourses(
  color: CanvasRenderingContext2D,
  height: CanvasRenderingContext2D,
  w: number,
  h: number,
  rand: () => number,
  opts: { rowPx: number; tones: [number, number, number]; mortar: string; jitter: number },
): void {
  color.fillStyle = opts.mortar;
  color.fillRect(0, 0, w, h);
  height.fillStyle = "rgb(40,40,40)";
  height.fillRect(0, 0, w, h);
  let y = 0;
  while (y < h) {
    let rowH = opts.rowPx * (0.8 + rand() * 0.45);
    // Don't leave a sliver row at the bottom: stretch the last one.
    if (h - y - rowH < opts.rowPx * 0.5) rowH = h - y;
    let x = -rand() * opts.rowPx;
    while (x < w) {
      const bw = opts.rowPx * (1.2 + rand() * 1.3);
      const gap = 3 + rand() * 4;
      const [r, g, b] = opts.tones;
      const shade = 0.78 + rand() * 0.4;
      const fill = `rgb(${r * shade | 0},${g * shade | 0},${b * shade | 0})`;
      const lift = 120 + rand() * 80;
      const rx = x + gap;
      const ry = y + gap + (rand() - 0.5) * opts.jitter;
      const rw = bw - gap * 2;
      const rh = rowH - gap * 2;
      const radius = Math.max(0, Math.min(rw, rh) * (0.18 + rand() * 0.2));
      if (rw < 2 || rh < 2) {
        x += bw;
        continue;
      }
      wrapX(w, rx, rw, (px) => {
        color.fillStyle = fill;
        color.beginPath();
        color.roundRect(px, ry, rw, rh, radius);
        color.fill();
        // Chisel tone: lighter top-left, darker bottom edge.
        const grad = color.createLinearGradient(px, ry, px, ry + rh);
        grad.addColorStop(0, "rgba(255,240,220,0.07)");
        grad.addColorStop(0.7, "rgba(0,0,0,0)");
        grad.addColorStop(1, "rgba(0,0,0,0.22)");
        color.fillStyle = grad;
        color.fill();
        const hg = height.createRadialGradient(
          px + rw / 2, ry + rh / 2, Math.min(rw, rh) * 0.1,
          px + rw / 2, ry + rh / 2, Math.max(rw, rh) * 0.62,
        );
        hg.addColorStop(0, `rgb(${lift + 30 | 0},${lift + 30 | 0},${lift + 30 | 0})`);
        hg.addColorStop(1, `rgb(${lift - 40 | 0},${lift - 40 | 0},${lift - 40 | 0})`);
        height.fillStyle = hg;
        height.beginPath();
        height.roundRect(px, ry, rw, rh, radius);
        height.fill();
      });
      // Pits and speckle (colour + height).
      for (let i = 0; i < rw * rh * 0.004; i++) {
        const sx = rx + rand() * rw;
        const sy = ry + rand() * rh;
        const s = 1 + rand() * 2;
        const dark = rand() < 0.75;
        const tone = dark
          ? `rgba(0,0,0,${0.08 + rand() * 0.12})`
          : `rgba(255,235,210,${0.015 + rand() * 0.025})`;
        wrapX(w, sx, s, (px) => {
          color.fillStyle = tone;
          color.fillRect(px, sy, s, s);
          height.fillStyle = dark ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.06)";
          height.fillRect(px, sy, s, s);
        });
      }
      x += bw;
    }
    y += rowH;
  }
}

/**
 * Inn wall: lime plaster over rubble stone. One tile = 3.5 m x 3.2 m of
 * wall (u repeats twice along a 7 m wall). The plaster has fallen away in
 * patches, mostly low on the wall where boots and damp wear it; smoke has
 * browned its upper reaches.
 */
function paintWall(): SurfaceMaps {
  const size = surfaceSize;
  const w = size;
  const h = size;
  const rand = mulberry32(7171);
  const [, stone] = canvas2d(w, h);
  const [, height] = canvas2d(w, h);
  paintStoneCourses(stone, height, w, h, rand, {
    rowPx: size * 0.062,
    tones: [108, 98, 86],
    mortar: "#2c251f",
    jitter: size * 0.006,
  });

  // Plaster coat (colour only; the composite below decides where it stays).
  const [, plaster] = canvas2d(w, h);
  plaster.fillStyle = "#b8a585";
  plaster.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) {
    plaster.strokeStyle = `rgba(${rand() > 0.5 ? "250,236,206" : "120,100,74"}, ${0.04 + rand() * 0.06})`;
    plaster.lineWidth = size * (0.01 + rand() * 0.03);
    plaster.beginPath();
    const x = rand() * w;
    const y = rand() * h;
    plaster.moveTo(x, y);
    plaster.quadraticCurveTo(
      x + (rand() - 0.5) * w * 0.3, y + (rand() - 0.5) * h * 0.1,
      x + (rand() - 0.5) * w * 0.5, y + (rand() - 0.5) * h * 0.2,
    );
    plaster.stroke();
  }
  // Smoke-browned top, damp-stained foot.
  const smoke = plaster.createLinearGradient(0, 0, 0, h);
  smoke.addColorStop(0, "rgba(40,24,12,0.55)");
  smoke.addColorStop(0.35, "rgba(40,24,12,0.12)");
  smoke.addColorStop(0.75, "rgba(0,0,0,0)");
  smoke.addColorStop(1, "rgba(50,38,24,0.3)");
  plaster.fillStyle = smoke;
  plaster.fillRect(0, 0, w, h);

  // Where the plaster survives: tileable noise, thinned toward the floor.
  const noise = periodicNoise(4242, 6);
  const fine = periodicNoise(911, 24);
  const stoneData = stone.getImageData(0, 0, w, h);
  const plasterData = plaster.getImageData(0, 0, w, h).data;
  const heightData = height.getImageData(0, 0, w, h);
  const sd = stoneData.data;
  const hd = heightData.data;
  for (let y = 0; y < h; y++) {
    const v = y / h; // 0 = top of wall
    // Bottom ~30 % of the wall is mostly bare stone.
    const lowBias = THREE.MathUtils.smoothstep(v, 0.62, 0.92) * 0.5;
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const n = noise(u, v) * 0.8 + fine(u, v) * 0.2 - lowBias;
      const i = (y * w + x) << 2;
      if (n > 0.4) {
        // Plaster, with a darker broken lip right at the edge.
        const edge = THREE.MathUtils.clamp((n - 0.4) / 0.025, 0, 1);
        const shade = 0.72 + 0.28 * edge;
        sd[i] = plasterData[i]! * shade;
        sd[i + 1] = plasterData[i + 1]! * shade;
        sd[i + 2] = plasterData[i + 2]! * shade;
        const ph = 205 + (fine(u * 2, v * 2) - 0.5) * 30;
        hd[i] = hd[i + 1] = hd[i + 2] = ph;
      } else {
        // Exposed stone, sooted a little where plaster fell away.
        sd[i] *= 0.92;
        sd[i + 1] *= 0.9;
        sd[i + 2] *= 0.88;
      }
    }
  }
  stone.putImageData(stoneData, 0, 0);
  height.putImageData(heightData, 0, 0);
  return {
    map: colorTexture(stone.canvas),
    normalMap: normalFromHeight(height, w, h, 2.2),
  };
}

/**
 * Plank floor: one tile = 2.4 m square of boards running along v, with
 * staggered butt joints, wavy grain, knots and dark gaps.
 */
function paintFloor(): SurfaceMaps {
  const size = surfaceSize;
  const rand = mulberry32(2718);
  const [, color] = canvas2d(size);
  const [, height] = canvas2d(size);
  color.fillStyle = "#140d08";
  color.fillRect(0, 0, size, size);
  height.fillStyle = "rgb(20,20,20)";
  height.fillRect(0, 0, size, size);
  const planks = 12;
  const pw = size / planks;
  for (let p = 0; p < planks; p++) {
    const x0 = p * pw + 1.5;
    const width = pw - 3;
    // Two or three boards per column, joints staggered.
    let y = -rand() * size;
    while (y < size) {
      const len = size * (0.45 + rand() * 0.5);
      const tone = 0.75 + rand() * 0.45;
      const base = [92 * tone, 62 * tone, 40 * tone];
      const y0 = y + 2;
      const y1 = y + len - 2;
      // Each copy (wrap) of a board must paint identically: own PRNG.
      const boardSeed = Math.floor(rand() * 2 ** 31);
      const paintBoard = (oy: number): void => {
        const rand = mulberry32(boardSeed);
        color.fillStyle = `rgb(${base[0] | 0},${base[1] | 0},${base[2] | 0})`;
        color.fillRect(x0, y0 + oy, width, y1 - y0);
        height.fillStyle = "rgb(190,190,190)";
        height.fillRect(x0, y0 + oy, width, y1 - y0);
        // Grain: long wavy strokes along the board.
        color.save();
        color.beginPath();
        color.rect(x0, y0 + oy, width, y1 - y0);
        color.clip();
        height.save();
        height.beginPath();
        height.rect(x0, y0 + oy, width, y1 - y0);
        height.clip();
        const lines = 7 + Math.floor(rand() * 5);
        for (let g = 0; g < lines; g++) {
          const gx = x0 + rand() * width;
          const amp = 2 + rand() * 5;
          const freq = 0.004 + rand() * 0.01;
          const ph = rand() * 6;
          const dark = rand() < 0.65;
          color.strokeStyle = dark
            ? `rgba(30,16,8,${0.18 + rand() * 0.22})`
            : `rgba(210,160,110,${0.08 + rand() * 0.1})`;
          color.lineWidth = 0.8 + rand() * 1.8;
          height.strokeStyle = dark ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.1)";
          height.lineWidth = color.lineWidth;
          color.beginPath();
          height.beginPath();
          for (let sy = y0; sy <= y1; sy += 6) {
            const sx = gx + Math.sin(sy * freq + ph) * amp;
            if (sy === y0) {
              color.moveTo(sx, sy + oy);
              height.moveTo(sx, sy + oy);
            } else {
              color.lineTo(sx, sy + oy);
              height.lineTo(sx, sy + oy);
            }
          }
          color.stroke();
          height.stroke();
        }
        // A knot now and then.
        if (rand() < 0.35) {
          const kx = x0 + width * (0.25 + rand() * 0.5);
          const ky = y0 + (y1 - y0) * rand();
          const kr = 3 + rand() * 5;
          const kg = color.createRadialGradient(kx, ky + oy, 0, kx, ky + oy, kr * 2.4);
          kg.addColorStop(0, "rgba(25,12,5,0.85)");
          kg.addColorStop(0.45, "rgba(45,24,12,0.45)");
          kg.addColorStop(1, "rgba(0,0,0,0)");
          color.fillStyle = kg;
          color.fillRect(kx - kr * 3, ky + oy - kr * 3, kr * 6, kr * 6);
        }
        // Worn, slightly lighter middle; darker board ends.
        const wear = color.createLinearGradient(x0, 0, x0 + width, 0);
        wear.addColorStop(0, "rgba(0,0,0,0.18)");
        wear.addColorStop(0.5, "rgba(255,220,180,0.03)");
        wear.addColorStop(1, "rgba(0,0,0,0.18)");
        color.fillStyle = wear;
        color.fillRect(x0, y0 + oy, width, y1 - y0);
        color.restore();
        height.restore();
        // Nail heads at the board ends.
        for (const ny of [y0 + 8, y1 - 8]) {
          for (const nx of [x0 + width * 0.25, x0 + width * 0.75]) {
            color.fillStyle = "rgba(20,14,10,0.8)";
            color.fillRect(nx - 1.5, ny + oy - 1.5, 3, 3);
          }
        }
      };
      paintBoard(0);
      // Wrap vertically so the tile repeats seamlessly.
      if (y + len > size) paintBoard(-size);
      if (y < 0) paintBoard(size);
      y += len;
    }
  }
  return {
    map: colorTexture(color.canvas),
    normalMap: normalFromHeight(height, size, size, 3),
  };
}

/**
 * Dark, soot-stained dressed stone for the hearth (one tile ≈ 1 m, box-
 * projected onto the fireplace model).
 */
function paintHearthStone(): SurfaceMaps {
  const size = Math.min(surfaceSize, 512);
  const rand = mulberry32(6061);
  const [, color] = canvas2d(size);
  const [, height] = canvas2d(size);
  paintStoneCourses(color, height, size, size, rand, {
    rowPx: size * 0.16,
    tones: [96, 88, 80],
    mortar: "#1b1714",
    jitter: size * 0.008,
  });
  // Blotchy soot.
  for (let i = 0; i < 40; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = size * (0.05 + rand() * 0.15);
    const alpha = 0.2 + rand() * 0.25;
    wrapX(size, x - r, r * 2, (px) => {
      const g = color.createRadialGradient(px + r, y, 0, px + r, y, r);
      g.addColorStop(0, `rgba(10,7,5,${alpha})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      color.fillStyle = g;
      color.fillRect(px, y - r, r * 2, r * 2);
    });
  }
  return {
    map: colorTexture(color.canvas),
    normalMap: normalFromHeight(height, size, size, 2.6),
  };
}

/** Night sky gradient with faint stars (window emissive map). */
function paintSky(): THREE.CanvasTexture {
  const [canvas, ctx] = canvas2d(256);
  const rand = mulberry32(1234);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#5d6f99");
  g.addColorStop(0.65, "#8fa2c4");
  g.addColorStop(1, "#c4b49a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) {
    const a = 0.35 + rand() * 0.65;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    const s = rand() < 0.1 ? 2 : 1;
    ctx.fillRect(rand() * 256, rand() * 180, s, s);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Moon disc with maria and a soft halo (transparent). */
function paintMoon(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = canvas2d(size);
  const rand = mulberry32(99);
  const c = size / 2;
  const halo = ctx.createRadialGradient(c, c, size * 0.18, c, c, size * 0.5);
  halo.addColorStop(0, "rgba(220,230,255,0.35)");
  halo.addColorStop(1, "rgba(220,230,255,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);
  const r = size * 0.2;
  const disc = ctx.createRadialGradient(c - r * 0.3, c - r * 0.3, r * 0.1, c, c, r);
  disc.addColorStop(0, "#fffbee");
  disc.addColorStop(1, "#d9d6c8");
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2;
    const d = rand() * r * 0.7;
    const mr = r * (0.12 + rand() * 0.22);
    ctx.fillStyle = `rgba(120,125,140,${0.2 + rand() * 0.2})`;
    ctx.beginPath();
    ctx.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, mr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Wispy cloud bank, tileable along u (alpha in the texture). */
function paintClouds(): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const [canvas, ctx] = canvas2d(w, h);
  const rand = mulberry32(3141);
  for (let i = 0; i < 70; i++) {
    const x = rand() * w;
    const y = h * (0.15 + rand() * 0.6);
    const rx = 30 + rand() * 70;
    const ry = rx * (0.25 + rand() * 0.2);
    const alpha = 0.16 + rand() * 0.18;
    wrapX(w, x - rx, rx * 2, (px) => {
      const g = ctx.createRadialGradient(px + rx, y, 0, px + rx, y, rx);
      g.addColorStop(0, `rgba(255,255,255,${alpha})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(px + rx, y);
      ctx.scale(1, ry / rx);
      ctx.translate(-(px + rx), -y);
      ctx.fillRect(px, y - rx, rx * 2, rx * 2);
      ctx.restore();
    });
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

// --- Cached entry points (painted once, shared) -----------------------------

const surfaceCache = new Map<string, SurfaceMaps>();
function cachedSurface(key: string, paint: () => SurfaceMaps): SurfaceMaps {
  let maps = surfaceCache.get(key);
  if (!maps) {
    maps = paint();
    // Register both in the shared cache so clearTextureCache() frees them.
    cachedTexture(`${key}:map`, () => maps!.map);
    cachedTexture(`${key}:normal`, () => maps!.normalMap);
    surfaceCache.set(key, maps);
  }
  return maps;
}

export const wallMaps = (): SurfaceMaps => cachedSurface("roomWall", paintWall);
export const floorMaps = (): SurfaceMaps => cachedSurface("roomFloor", paintFloor);
export const hearthStoneMaps = (): SurfaceMaps =>
  cachedSurface("hearthStone", paintHearthStone);
export const skyTexture = (): THREE.CanvasTexture => cachedTexture("roomSky", paintSky);
export const moonTexture = (): THREE.CanvasTexture => cachedTexture("roomMoon", paintMoon);
export const cloudTexture = (): THREE.CanvasTexture =>
  cachedTexture("roomClouds", paintClouds);

/** Forget painted surfaces (the textures themselves die with the cache). */
export function clearRoomTextures(): void {
  surfaceCache.clear();
}
