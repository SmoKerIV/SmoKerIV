/**
 * Canvas-generated textures for the procedural inn scene.
 * All color textures use SRGBColorSpace + anisotropy 4.
 * Deterministic (seeded) randomness so reloads look identical.
 */
import * as THREE from "three";

/**
 * Module-level texture cache: identical canvases (the rune circle on the
 * table and on the tome cover, the shared dark wood, the particle dot) are
 * painted and uploaded once. Callers that need their own sampler settings
 * (e.g. a different repeat) must .clone() — a clone shares the canvas source,
 * so the GPU upload is still shared. clearTextureCache() runs on scene
 * dispose so an HMR remount repaints everything for the new renderer.
 */
const textureCache = new Map<string, THREE.Texture>();

export function cachedTexture<T extends THREE.Texture>(
  key: string,
  make: () => T,
): T {
  let texture = textureCache.get(key) as T | undefined;
  if (!texture) {
    texture = make();
    textureCache.set(key, texture);
  }
  return texture;
}

/** Dispose every cached texture once and forget them. */
export function clearTextureCache(): void {
  for (const texture of textureCache.values()) texture.dispose();
  textureCache.clear();
}

/** Tiny deterministic PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function createCanvas(
  size: number,
): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not acquire 2d canvas context");
  return [canvas, ctx];
}

function toTexture(canvas: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Draws a small angular rune glyph centered at (x, y), size s. */
function drawRune(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  rand: () => number,
): void {
  const strokes = 2 + Math.floor(rand() * 3);
  ctx.beginPath();
  // Main stave
  ctx.moveTo(x, y - s / 2);
  ctx.lineTo(x, y + s / 2);
  for (let i = 0; i < strokes; i++) {
    const y0 = y - s / 2 + rand() * s;
    const dx = (rand() > 0.5 ? 1 : -1) * (s * (0.3 + rand() * 0.4));
    const dy = (rand() - 0.5) * s * 0.8;
    ctx.moveTo(x, y0);
    ctx.lineTo(x + dx, y0 + dy);
    if (rand() > 0.6) ctx.lineTo(x + dx * 0.4, y0 + dy + s * 0.3);
  }
  ctx.stroke();
}

/**
 * Plank wood grain. tone: "dark" (#4a3524-ish) or "light" (#6b4a2f-ish).
 * vertical=true rotates the grain 90° (tankard staves).
 */
function paintWoodTexture(
  tone: "dark" | "light" = "dark",
  vertical = false,
): THREE.CanvasTexture {
  const size = 512;
  const [canvas, ctx] = createCanvas(size);
  const rand = mulberry32(tone === "dark" ? 1337 : 7331);

  const base = tone === "dark" ? "#4a3524" : "#6b4a2f";
  const light = tone === "dark" ? "#5c422c" : "#7d583a";
  const darkLine = tone === "dark" ? "#2e2015" : "#43301e";

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  const planks = 5;
  const ph = size / planks;
  for (let p = 0; p < planks; p++) {
    const y0 = p * ph;
    // Per-plank tint variation
    const v = (rand() - 0.5) * 26;
    ctx.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 220 : 10},${v > 0 ? 160 : 0},${Math.abs(v) / 255})`;
    ctx.fillRect(0, y0, size, ph);
    // Grain streaks
    for (let i = 0; i < 22; i++) {
      const gy = y0 + rand() * ph;
      const alpha = 0.05 + rand() * 0.12;
      ctx.strokeStyle =
        rand() > 0.5
          ? `rgba(20, 12, 6, ${alpha})`
          : `rgba(200, 160, 110, ${alpha * 0.7})`;
      ctx.lineWidth = 1 + rand() * 2;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      const wobble = 2 + rand() * 5;
      for (let x = 0; x <= size; x += 32) {
        ctx.lineTo(x, gy + Math.sin(x * 0.02 + rand() * 6) * wobble);
      }
      ctx.stroke();
    }
    // Occasional knot
    if (rand() > 0.5) {
      const kx = rand() * size;
      const ky = y0 + ph * (0.3 + rand() * 0.4);
      ctx.strokeStyle = "rgba(30, 18, 8, 0.5)";
      for (let r = 3; r < 12; r += 3) {
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(kx, ky, r * 1.6, r, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // Plank seam + highlight
    ctx.fillStyle = darkLine;
    ctx.fillRect(0, y0 + ph - 3, size, 3);
    ctx.fillStyle = light;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(0, y0, size, 2);
    ctx.globalAlpha = 1;
  }

  if (vertical) {
    const [canvas2, ctx2] = createCanvas(size);
    ctx2.translate(size, 0);
    ctx2.rotate(Math.PI / 2);
    ctx2.drawImage(canvas, 0, 0);
    return toTexture(canvas2);
  }
  return toTexture(canvas);
}

/** Worn dark leather for the tome and grips. */
function paintLeatherTexture(): THREE.CanvasTexture {
  const size = 512;
  const [canvas, ctx] = createCanvas(size);
  const rand = mulberry32(4242);

  ctx.fillStyle = "#5a2e1d";
  ctx.fillRect(0, 0, size, size);

  // Mottled patches
  for (let i = 0; i < 40; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 20 + rand() * 70;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const darker = rand() > 0.5;
    g.addColorStop(0, darker ? "rgba(40, 18, 10, 0.20)" : "rgba(140, 84, 52, 0.14)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Fine speckle
  for (let i = 0; i < 2600; i++) {
    const a = 0.03 + rand() * 0.08;
    ctx.fillStyle = rand() > 0.5 ? `rgba(0,0,0,${a})` : `rgba(220,160,110,${a * 0.6})`;
    ctx.fillRect(rand() * size, rand() * size, 1.5, 1.5);
  }
  // Crease lines
  ctx.strokeStyle = "rgba(28, 12, 6, 0.35)";
  for (let i = 0; i < 26; i++) {
    ctx.lineWidth = 0.8 + rand() * 1.4;
    ctx.beginPath();
    let x = rand() * size;
    let y = rand() * size;
    ctx.moveTo(x, y);
    const segs = 2 + Math.floor(rand() * 3);
    for (let sIdx = 0; sIdx < segs; sIdx++) {
      x += (rand() - 0.5) * 90;
      y += (rand() - 0.5) * 90;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return toTexture(canvas);
}

/** Aged parchment; withRunes adds faded handwritten rune rows. */
function paintParchmentTexture(withRunes = false): THREE.CanvasTexture {
  const size = 512;
  const [canvas, ctx] = createCanvas(size);
  const rand = mulberry32(withRunes ? 9001 : 1009);

  ctx.fillStyle = "#e8dcc0";
  ctx.fillRect(0, 0, size, size);

  // Blotches and aging
  for (let i = 0; i < 30; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 25 + rand() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(190, 160, 110, 0.10)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Fibers
  for (let i = 0; i < 500; i++) {
    ctx.strokeStyle = `rgba(150, 120, 80, ${0.04 + rand() * 0.06})`;
    ctx.lineWidth = 0.6;
    const x = rand() * size;
    const y = rand() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 14, y + (rand() - 0.5) * 4);
    ctx.stroke();
  }
  // Darkened edges
  const edge = ctx.createRadialGradient(
    size / 2, size / 2, size * 0.42,
    size / 2, size / 2, size * 0.72,
  );
  edge.addColorStop(0, "rgba(0,0,0,0)");
  edge.addColorStop(1, "rgba(110, 80, 40, 0.30)");
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, size, size);

  if (withRunes) {
    ctx.strokeStyle = "rgba(70, 52, 34, 0.55)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    const rows = 9;
    for (let r = 0; r < rows; r++) {
      const y = 50 + r * ((size - 100) / (rows - 1)) + (rand() - 0.5) * 6;
      let x = 40 + rand() * 30;
      while (x < size - 50) {
        drawRune(ctx, x, y, 14 + rand() * 8, rand);
        x += 18 + rand() * 16;
        if (rand() > 0.85) x += 22; // word gap
      }
    }
    // A small circled diagram
    ctx.strokeStyle = "rgba(70, 52, 34, 0.4)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(size * 0.72, size * 0.74, 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(size * 0.72, size * 0.74, 34, 0, Math.PI * 2);
    ctx.stroke();
    drawRune(ctx, size * 0.72, size * 0.74, 30, rand);
  }
  return toTexture(canvas);
}

/** Warm plaster for inn walls. */
function paintPlasterTexture(): THREE.CanvasTexture {
  const size = 512;
  const [canvas, ctx] = createCanvas(size);
  const rand = mulberry32(5150);

  ctx.fillStyle = "#d6c9ae";
  ctx.fillRect(0, 0, size, size);
  // Trowel strokes
  for (let i = 0; i < 60; i++) {
    ctx.strokeStyle = `rgba(${rand() > 0.5 ? "255,244,220" : "150,130,100"}, ${0.04 + rand() * 0.05})`;
    ctx.lineWidth = 8 + rand() * 22;
    ctx.beginPath();
    const x = rand() * size;
    const y = rand() * size;
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + (rand() - 0.5) * 160, y + (rand() - 0.5) * 60,
      x + (rand() - 0.5) * 260, y + (rand() - 0.5) * 120,
    );
    ctx.stroke();
  }
  // Speckle
  for (let i = 0; i < 1800; i++) {
    const a = 0.03 + rand() * 0.05;
    ctx.fillStyle = rand() > 0.5 ? `rgba(90,75,55,${a})` : `rgba(255,248,230,${a})`;
    ctx.fillRect(rand() * size, rand() * size, 1.5, 1.5);
  }
  // Faint damp stains near bottom
  for (let i = 0; i < 6; i++) {
    const x = rand() * size;
    const y = size * (0.75 + rand() * 0.2);
    const r = 40 + rand() * 60;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(120, 100, 70, 0.10)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return toTexture(canvas);
}

/** Grey stone blocks for the fireplace. */
function paintStoneTexture(): THREE.CanvasTexture {
  const size = 512;
  const [canvas, ctx] = createCanvas(size);
  const rand = mulberry32(8080);

  ctx.fillStyle = "#4c4a46";
  ctx.fillRect(0, 0, size, size);

  const rows = 6;
  const rh = size / rows;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * rh * 0.9;
    let x = -offset;
    while (x < size) {
      const w = rh * (1.3 + rand() * 0.9);
      const g = 90 + rand() * 45;
      ctx.fillStyle = `rgb(${g + 8}, ${g + 4}, ${g - 4})`;
      ctx.fillRect(x + 3, r * rh + 3, w - 6, rh - 6);
      // Bevel highlight
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(x + 3, r * rh + 3, w - 6, 4);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(x + 3, (r + 1) * rh - 7, w - 6, 4);
      // Speckle inside block
      for (let i = 0; i < 24; i++) {
        ctx.fillStyle = `rgba(0,0,0,${0.05 + rand() * 0.1})`;
        ctx.fillRect(x + 4 + rand() * (w - 8), r * rh + 4 + rand() * (rh - 8), 2, 2);
      }
      x += w;
    }
  }
  return toTexture(canvas);
}

/**
 * Painted shield face: quartered field + stylized tower crest.
 * Meant for a top-down planar projection onto the shield dome.
 */
function paintCrestTexture(): THREE.CanvasTexture {
  const size = 512;
  const [canvas, ctx] = createCanvas(size);
  const rand = mulberry32(2323);
  const c = size / 2;

  // Quartered field (alternating painted quarters, aged and muted)
  const colA = "#5e211b"; // deep oxblood
  const colB = "#b5a37e"; // aged parchment-cream
  for (let q = 0; q < 4; q++) {
    ctx.fillStyle = q % 2 === 0 ? colA : colB;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, size, (q * Math.PI) / 2 + Math.PI / 4, ((q + 1) * Math.PI) / 2 + Math.PI / 4);
    ctx.closePath();
    ctx.fill();
  }
  // Weathering scratches
  for (let i = 0; i < 240; i++) {
    ctx.strokeStyle = `rgba(40, 28, 16, ${0.04 + rand() * 0.1})`;
    ctx.lineWidth = 1 + rand() * 2;
    const x = rand() * size;
    const y = rand() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 40, y + (rand() - 0.5) * 40);
    ctx.stroke();
  }
  // Outer painted ring
  ctx.strokeStyle = "#2c2620";
  ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.arc(c, c, size * 0.44, 0, Math.PI * 2);
  ctx.stroke();
  // Central disc behind emblem
  ctx.fillStyle = "#2c2620";
  ctx.beginPath();
  ctx.arc(c, c, size * 0.185, 0, Math.PI * 2);
  ctx.fill();
  // Stylized tower emblem
  ctx.fillStyle = "#d9c9a3";
  const tw = size * 0.11;
  const th = size * 0.20;
  ctx.fillRect(c - tw / 2, c - th / 2 + size * 0.02, tw, th);
  // Crenellations
  const merlon = tw / 4.2;
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(
      c - tw / 2 + i * (merlon * 1.6),
      c - th / 2 + size * 0.02 - merlon,
      merlon,
      merlon,
    );
  }
  // Door
  ctx.fillStyle = "#2c2620";
  ctx.beginPath();
  ctx.arc(c, c + th / 2 - size * 0.008, tw * 0.22, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(c - tw * 0.22, c + th / 2 - size * 0.008, tw * 0.44, size * 0.028);
  return toTexture(canvas);
}

/** Cream/ivory candle wax: vertical melt streaks + soft mottling. */
function paintWaxTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = createCanvas(size);
  const rand = mulberry32(2718);

  ctx.fillStyle = "#f1e7cd";
  ctx.fillRect(0, 0, size, size);

  // Soft warm/cool mottling
  for (let i = 0; i < 26; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 18 + rand() * 60;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(
      0,
      rand() > 0.5 ? "rgba(214, 188, 140, 0.10)" : "rgba(255, 252, 240, 0.12)",
    );
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Vertical melt streaks (map v runs along the candle height)
  for (let i = 0; i < 42; i++) {
    const x = rand() * size;
    const w = 2 + rand() * 7;
    const a = 0.035 + rand() * 0.07;
    ctx.fillStyle =
      rand() > 0.45 ? `rgba(255, 250, 236, ${a})` : `rgba(190, 165, 118, ${a})`;
    const y0 = rand() * size * 0.5;
    ctx.fillRect(x, y0, w, size - y0);
  }
  // Fine speckle
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = `rgba(150, 125, 85, ${0.02 + rand() * 0.05})`;
    ctx.fillRect(rand() * size, rand() * size, 1.2, 1.2);
  }
  return toTexture(canvas);
}

/**
 * Scroll roll end cap: spiral of wound parchment around a wooden rod core.
 * Meant for the flat circular caps of the roll cylinders.
 */
function paintScrollEndTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = createCanvas(size);
  const rand = mulberry32(6174);
  const c = size / 2;

  ctx.fillStyle = "#e4d6b6";
  ctx.fillRect(0, 0, size, size);
  // Subtle radial aging
  const g = ctx.createRadialGradient(c, c, size * 0.1, c, c, size * 0.5);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(120, 90, 50, 0.25)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // Archimedean spiral: the wound layers of parchment
  ctx.strokeStyle = "rgba(122, 96, 58, 0.85)";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  const turns = 6.5;
  const r0 = size * 0.15;
  const r1 = size * 0.485;
  const steps = 340;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2;
    const r = r0 + (r1 - r0) * t + Math.sin(a * 2.3) * 1.2;
    const x = c + Math.cos(a) * r;
    const y = c + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // Highlight edge of each winding (offset lighter spiral)
  ctx.strokeStyle = "rgba(255, 248, 226, 0.5)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2;
    const r = r0 + (r1 - r0) * t - 3;
    const x = c + Math.cos(a) * r;
    const y = c + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // Wooden rod core
  ctx.fillStyle = "#4a3524";
  ctx.beginPath();
  ctx.arc(c, c, size * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(20, 12, 6, 0.6)";
  ctx.lineWidth = 3;
  ctx.stroke();
  // Rod end grain rings
  ctx.strokeStyle = "rgba(30, 20, 10, 0.45)";
  for (let r = 6; r < size * 0.13; r += 8) {
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(c, c, r, r * (0.85 + rand() * 0.2), rand(), 0, Math.PI * 2);
    ctx.stroke();
  }
  // Outermost sheet edge
  ctx.strokeStyle = "rgba(90, 68, 38, 0.8)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(c, c, size * 0.49, 0, Math.PI * 2);
  ctx.stroke();
  return toTexture(canvas);
}

/**
 * Faintly glowing teal rune etchings for the sword fuller.
 * Transparent background; use as map + emissiveMap on a decal plane.
 */
function paintBladeRuneTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not acquire 2d canvas context");
  const rand = mulberry32(777);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#47bdad";
  ctx.shadowColor = "#47bdad";
  ctx.shadowBlur = 6;
  ctx.lineCap = "round";
  ctx.lineWidth = 5;

  let x = 34;
  const y = canvas.height / 2;
  while (x < canvas.width - 34) {
    drawRune(ctx, x, y, 34 + rand() * 14, rand);
    x += 52 + rand() * 26;
  }
  const tex = toTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/**
 * Arcane rune circle: teal glyphs on transparent, for additive planes.
 */
function paintRuneCircleTexture(): THREE.CanvasTexture {
  const size = 512;
  const [canvas, ctx] = createCanvas(size);
  const rand = mulberry32(6060);
  const c = size / 2;
  const teal = "#47bdad";

  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = teal;
  ctx.shadowColor = teal;
  ctx.shadowBlur = 10;
  ctx.lineCap = "round";

  // Concentric rings
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(c, c, 236, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(c, c, 172, 0, Math.PI * 2);
  ctx.stroke();

  // Glyph band between the rings
  ctx.lineWidth = 3;
  const glyphs = 26;
  for (let i = 0; i < glyphs; i++) {
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate((i / glyphs) * Math.PI * 2);
    drawRune(ctx, 0, -204, 20 + rand() * 8, rand);
    ctx.restore();
  }

  // Inner star polygon (every 3rd point of 8)
  const starR = 160;
  const points = 8;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  let idx = 0;
  for (let i = 0; i <= points; i++) {
    const a = (idx / points) * Math.PI * 2 - Math.PI / 2;
    const x = c + Math.cos(a) * starR;
    const y = c + Math.sin(a) * starR;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    idx = (idx + 3) % points;
  }
  ctx.stroke();

  // Small center circle + node dots at star points
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(c, c, 34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = teal;
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(c + Math.cos(a) * starR, c + Math.sin(a) * starR, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = toTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// --- Cached public entry points ---------------------------------------------

/**
 * Plank wood grain. tone: "dark" (#4a3524-ish) or "light" (#6b4a2f-ish).
 * vertical=true rotates the grain 90° (tankard staves). Shared — clone()
 * before changing repeat/offset.
 */
export function makeWoodTexture(
  tone: "dark" | "light" = "dark",
  vertical = false,
): THREE.CanvasTexture {
  return cachedTexture(`wood:${tone}:${vertical}`, () =>
    paintWoodTexture(tone, vertical),
  );
}

export function makeLeatherTexture(): THREE.CanvasTexture {
  return cachedTexture("leather", paintLeatherTexture);
}

export function makeParchmentTexture(withRunes = false): THREE.CanvasTexture {
  return cachedTexture(`parchment:${withRunes}`, () =>
    paintParchmentTexture(withRunes),
  );
}

export function makePlasterTexture(): THREE.CanvasTexture {
  return cachedTexture("plaster", paintPlasterTexture);
}

export function makeStoneTexture(): THREE.CanvasTexture {
  return cachedTexture("stone", paintStoneTexture);
}

export function makeCrestTexture(): THREE.CanvasTexture {
  return cachedTexture("crest", paintCrestTexture);
}

export function makeWaxTexture(): THREE.CanvasTexture {
  return cachedTexture("wax", paintWaxTexture);
}

export function makeScrollEndTexture(): THREE.CanvasTexture {
  return cachedTexture("scrollEnd", paintScrollEndTexture);
}

export function makeBladeRuneTexture(): THREE.CanvasTexture {
  return cachedTexture("bladeRune", paintBladeRuneTexture);
}

/** Shared by the table rune circle and the tome's cover rune. */
export function makeRuneCircleTexture(): THREE.CanvasTexture {
  return cachedTexture("runeCircle", paintRuneCircleTexture);
}

/** Soft radial dot so points/sprites don't render as hard squares. */
export function makeDotTexture(): THREE.Texture {
  return cachedTexture("dot", () => {
    const size = 64;
    const [canvas, ctx] = createCanvas(size);
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.4, "rgba(255,255,255,0.6)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });
}

/**
 * One moth wing (fore + hind lobe) on transparent, hinge at the left edge:
 * dusty brown with darker veins and an eye spot. Used with alphaTest so
 * the wing stays an opaque cut-out (no sorting, no grey quad).
 */
export function makeMothWingTexture(): THREE.CanvasTexture {
  return cachedTexture("mothWing", () => {
    const w = 64;
    const h = 40;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not acquire 2d canvas context");
    const wing = new Path2D();
    // Forewing sweeping up-out, hindwing rounder below; hinge at x = 0.
    wing.moveTo(1, h * 0.5);
    wing.bezierCurveTo(w * 0.35, h * 0.02, w * 0.85, -h * 0.02, w - 2, h * 0.22);
    wing.bezierCurveTo(w * 0.92, h * 0.45, w * 0.7, h * 0.52, w * 0.55, h * 0.55);
    wing.bezierCurveTo(w * 0.62, h * 0.8, w * 0.38, h - 2, w * 0.18, h * 0.86);
    wing.bezierCurveTo(w * 0.08, h * 0.75, w * 0.03, h * 0.62, 1, h * 0.5);
    const fill = ctx.createLinearGradient(0, 0, w, 0);
    fill.addColorStop(0, "#5a4a38");
    fill.addColorStop(0.6, "#8a7656");
    fill.addColorStop(1, "#a08a66");
    ctx.fillStyle = fill;
    ctx.fill(wing);
    ctx.save();
    ctx.clip(wing);
    ctx.strokeStyle = "rgba(40,30,20,0.55)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(2, h * 0.5);
      ctx.quadraticCurveTo(w * 0.4, h * (0.2 + i * 0.12), w, h * (0.05 + i * 0.2));
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(35,25,15,0.7)";
    ctx.beginPath();
    ctx.arc(w * 0.62, h * 0.3, 3, 0, Math.PI * 2);
    ctx.fill();
    // Pale fringe along the outer edge.
    ctx.strokeStyle = "rgba(210,190,150,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke(wing);
    ctx.restore();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });
}
