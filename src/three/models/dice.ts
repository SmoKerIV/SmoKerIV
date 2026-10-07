/**
 * d20 — icosahedron of deep red resin, circumradius 0.045, numbered 1–20
 * with inked ivory-gold numerals (opposite faces sum to 21; 6 and 9 are
 * underlined). Fully procedural: per-face UVs into a canvas atlas.
 *
 * The group's pivot sits at the table contact point (y = 0) with the die
 * resting on a face and 20 on top. The mesh is offset by the inradius, so
 * the die CENTER is at group-local (0, inradius, 0).
 *
 * group.userData.d20 (D20Shape) carries everything the physics needs:
 * hull vertices / faces relative to the die center, per-face normals and
 * the face → number table the texture was painted from, so the number the
 * physics reads off the top face is exactly the number drawn on it.
 */
import * as THREE from "three";
import { ITEM_LABELS } from "../types";

/** Geometry + numbering shared with dicePhysics (die-center-relative). */
export interface D20Shape {
  /** Center-to-face distance; the die rests with its center this high. */
  inradius: number;
  /** Unique hull vertices (12), in group orientation, relative to center. */
  vertices: THREE.Vector3[];
  /** 20 triangles (indices into vertices), CCW seen from outside. */
  faces: number[][];
  /** Outward unit normal of each face (group orientation). */
  faceNormals: THREE.Vector3[];
  /** Number painted on each face (1..20), index-aligned with faces. */
  faceValues: number[];
}

const RADIUS = 0.045;
const ATLAS = 1024;
const COLS = 5;
const ROWS = 4;
const CELL_W = ATLAS / COLS;
const CELL_H = ATLAS / ROWS;
/** Triangle side in atlas px (leaves a bleed margin inside each cell). */
const TRI_SIDE = 186;
const TRI_H = (TRI_SIDE * Math.sqrt(3)) / 2;
const NUMERAL_FONT = `700 ${Math.round(TRI_SIDE * 0.36)}px Cinzel, "Book Antiqua", Georgia, serif`;

interface CellTriangle {
  /** Atlas px: top, bottom-left, bottom-right corners and the centroid. */
  top: [number, number];
  left: [number, number];
  right: [number, number];
  center: [number, number];
}

function cellTriangle(cell: number): CellTriangle {
  const cx = (cell % COLS) * CELL_W + CELL_W / 2;
  const cy = Math.floor(cell / COLS) * CELL_H + CELL_H / 2;
  return {
    top: [cx, cy - (TRI_H * 2) / 3],
    left: [cx - TRI_SIDE / 2, cy + TRI_H / 3],
    right: [cx + TRI_SIDE / 2, cy + TRI_H / 3],
    center: [cx, cy],
  };
}

function trianglePath(
  ctx: CanvasRenderingContext2D,
  t: CellTriangle,
  grow = 0,
): void {
  // Grow outward from the centroid (bleed so mip levels never pick up the
  // atlas gutter along the die's edges).
  const g = (p: [number, number]): [number, number] => {
    const dx = p[0] - t.center[0];
    const dy = p[1] - t.center[1];
    const len = Math.hypot(dx, dy);
    return [p[0] + (dx / len) * grow, p[1] + (dy / len) * grow];
  };
  const [a, b, c] = [g(t.top), g(t.left), g(t.right)];
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.lineTo(c[0], c[1]);
  ctx.closePath();
}

function makeCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS;
  canvas.height = ATLAS;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not acquire 2d canvas context");
  return [canvas, ctx];
}

/** Numeral baseline offset so the glyph's ink box is centred on (x, y). */
function numeralMetrics(
  ctx: CanvasRenderingContext2D,
  text: string,
): { width: number; dy: number; descent: number } {
  const m = ctx.measureText(text);
  const ascent = m.actualBoundingBoxAscent || TRI_SIDE * 0.25;
  const descent = m.actualBoundingBoxDescent || 0;
  return { width: m.width, dy: (ascent - descent) / 2, descent };
}

/**
 * Colour atlas: resin face with a soft dome gradient and worn, lighter
 * edges (a cheap bevel), numerals inked in ivory-gold with a dark recess.
 */
function paintColor(ctx: CanvasRenderingContext2D, values: number[]): void {
  ctx.fillStyle = "#5e120e";
  ctx.fillRect(0, 0, ATLAS, ATLAS);

  for (let cell = 0; cell < values.length; cell++) {
    const t = cellTriangle(cell);
    const [cx, cy] = t.center;

    // Resin body: brighter towards the face centre (rounded look).
    const body = ctx.createRadialGradient(cx, cy, 0, cx, cy, TRI_H * 0.75);
    body.addColorStop(0, "#a3291f");
    body.addColorStop(0.6, "#8c1f18");
    body.addColorStop(1, "#6d1510");
    ctx.fillStyle = body;
    trianglePath(ctx, t, 10);
    ctx.fill();

    // Faint swirl in the resin.
    ctx.save();
    trianglePath(ctx, t);
    ctx.clip();
    for (let i = 0; i < 5; i++) {
      const sx = cx + Math.sin(cell * 7.3 + i * 2.1) * TRI_SIDE * 0.25;
      const sy = cy + Math.cos(cell * 3.7 + i * 1.7) * TRI_SIDE * 0.18;
      const swirl = ctx.createRadialGradient(sx, sy, 0, sx, sy, TRI_SIDE * 0.22);
      swirl.addColorStop(0, i % 2 ? "rgba(190,60,45,0.16)" : "rgba(40,4,4,0.16)");
      swirl.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = swirl;
      ctx.fillRect(cx - TRI_SIDE, cy - TRI_SIDE, TRI_SIDE * 2, TRI_SIDE * 2);
    }

    // Bevel: a lighter worn band just inside each edge, then a crisp dark
    // seam right on the edge.
    ctx.lineJoin = "round";
    trianglePath(ctx, t);
    ctx.lineWidth = 16;
    ctx.strokeStyle = "rgba(225,120,95,0.20)";
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(255,170,140,0.18)";
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "rgba(30,4,3,0.55)";
    ctx.stroke();
    ctx.restore();

    // Numeral.
    const text = String(values[cell]);
    ctx.font = NUMERAL_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const { width, dy, descent } = numeralMetrics(ctx, text);
    const x = cx;
    const y = cy + dy + TRI_SIDE * 0.02;
    const underline = values[cell] === 6 || values[cell] === 9;
    const ulY = y + descent + TRI_SIDE * 0.035;
    const ulW = width * 0.62;
    const ulH = TRI_SIDE * 0.028;

    // Recess shadow (engraved edge), then the ink.
    ctx.fillStyle = "rgba(25,3,2,0.85)";
    ctx.fillText(text, x + 1.5, y + 2.5);
    if (underline) ctx.fillRect(x - ulW / 2 + 1.5, ulY + 2.5, ulW, ulH);

    const ink = ctx.createLinearGradient(0, y - TRI_SIDE * 0.3, 0, y + 4);
    ink.addColorStop(0, "#fbf0cf");
    ink.addColorStop(0.55, "#efd79a");
    ink.addColorStop(1, "#c79a45");
    ctx.fillStyle = ink;
    ctx.fillText(text, x, y);
    if (underline) ctx.fillRect(x - ulW / 2, ulY, ulW, ulH);
  }
}

/**
 * Data atlas (linear): R = bump height (domed face, rounded edges, sunken
 * numerals), G = roughness (glossy resin, satin ink), B = metalness.
 */
function paintData(ctx: CanvasRenderingContext2D, values: number[]): void {
  ctx.fillStyle = "rgb(60,105,10)";
  ctx.fillRect(0, 0, ATLAS, ATLAS);

  for (let cell = 0; cell < values.length; cell++) {
    const t = cellTriangle(cell);
    const [cx, cy] = t.center;

    const dome = ctx.createRadialGradient(cx, cy, 0, cx, cy, TRI_H * 0.72);
    dome.addColorStop(0, "rgb(200,100,10)");
    dome.addColorStop(0.7, "rgb(185,100,10)");
    dome.addColorStop(1, "rgb(110,115,10)");
    ctx.fillStyle = dome;
    trianglePath(ctx, t, 10);
    ctx.fill();

    const text = String(values[cell]);
    ctx.font = NUMERAL_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const { width, dy, descent } = numeralMetrics(ctx, text);
    const y = cy + dy + TRI_SIDE * 0.02;
    // Engraved: low height, satin, a touch metallic (gold leaf ink).
    ctx.fillStyle = "rgb(70,150,90)";
    ctx.fillText(text, cx, y);
    if (values[cell] === 6 || values[cell] === 9) {
      const ulW = width * 0.62;
      ctx.fillRect(cx - ulW / 2, y + descent + TRI_SIDE * 0.035, ulW, TRI_SIDE * 0.028);
    }
  }
}

function makeTexture(canvas: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  // The renderer clamps to the GPU's max; grazing faces stay legible.
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

/**
 * Face → number table: 20 on the top face, 1 underneath, the top's three
 * neighbours 2 / 8 / 14 and the upper equatorial ring the remaining evens;
 * every opposite face gets 21 − n.
 */
function assignFaceValues(normals: THREE.Vector3[]): number[] {
  const values = new Array<number>(normals.length).fill(0);
  const opposite = (i: number): number => {
    let best = -1;
    let bestDot = Infinity;
    normals.forEach((n, j) => {
      const d = n.dot(normals[i]);
      if (d < bestDot) {
        bestDot = d;
        best = j;
      }
    });
    return best;
  };
  const angle = (n: THREE.Vector3): number => Math.atan2(n.z, n.x);
  const upper = normals
    .map((n, i) => ({ n, i }))
    .filter(({ n }) => n.y > 1e-6)
    .sort((a, b) =>
      Math.abs(a.n.y - b.n.y) > 0.05 ? b.n.y - a.n.y : angle(a.n) - angle(b.n),
    );
  const order = [20, 2, 8, 14, 4, 16, 10, 18, 6, 12];
  upper.forEach(({ i }, k) => {
    const value = order[k] ?? 0;
    values[i] = value;
    values[opposite(i)] = 21 - value;
  });
  return values;
}

export function buildDice(): THREE.Group {
  const group = new THREE.Group();
  group.name = "dice";

  // Non-indexed: 20 faces x 3 vertices, flat normals.
  const geo = new THREE.IcosahedronGeometry(RADIUS, 0);
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const faceCount = pos.count / 3;

  // Rest pose: first face flat on the table.
  const a = new THREE.Vector3().fromBufferAttribute(pos, 0);
  const b = new THREE.Vector3().fromBufferAttribute(pos, 1);
  const c = new THREE.Vector3().fromBufferAttribute(pos, 2);
  const firstNormal = new THREE.Vector3()
    .subVectors(b, a)
    .cross(new THREE.Vector3().subVectors(c, a))
    .normalize();
  const restQuat = new THREE.Quaternion().setFromUnitVectors(
    firstNormal,
    new THREE.Vector3(0, -1, 0),
  );
  const inradius = Math.abs(a.dot(firstNormal));

  // Hull + per-face normals in group orientation (rest rotation applied).
  const vertices: THREE.Vector3[] = [];
  const faces: number[][] = [];
  const faceNormals: THREE.Vector3[] = [];
  const vertexIndex = (v: THREE.Vector3): number => {
    const found = vertices.findIndex((u) => u.distanceToSquared(v) < 1e-10);
    if (found >= 0) return found;
    vertices.push(v.clone());
    return vertices.length - 1;
  };
  const p = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (let f = 0; f < faceCount; f++) {
    for (let k = 0; k < 3; k++) {
      p[k].fromBufferAttribute(pos, f * 3 + k).applyQuaternion(restQuat);
    }
    faces.push(p.map(vertexIndex));
    faceNormals.push(
      new THREE.Vector3()
        .subVectors(p[1], p[0])
        .cross(new THREE.Vector3().subVectors(p[2], p[0]))
        .normalize(),
    );
  }
  const faceValues = assignFaceValues(faceNormals);

  // Per-face UVs: face f's (a, b, c) → atlas cell f's (top, left, right).
  // Both windings are CCW, so the numerals are never mirrored.
  const uv = new Float32Array(faceCount * 6);
  for (let f = 0; f < faceCount; f++) {
    const t = cellTriangle(f);
    [t.top, t.left, t.right].forEach(([x, y], k) => {
      uv[f * 6 + k * 2] = x / ATLAS;
      uv[f * 6 + k * 2 + 1] = 1 - y / ATLAS;
    });
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));

  const [colorCanvas, colorCtx] = makeCanvas();
  const [dataCanvas, dataCtx] = makeCanvas();
  paintColor(colorCtx, faceValues);
  paintData(dataCtx, faceValues);
  const map = makeTexture(colorCanvas, true);
  const data = makeTexture(dataCanvas, false);

  // Webfont may still be loading: repaint once Cinzel is ready.
  if (typeof document !== "undefined" && document.fonts?.load) {
    void document.fonts
      .load(NUMERAL_FONT, "0123456789")
      .then((loaded) => {
        if (loaded.length === 0) return;
        paintColor(colorCtx, faceValues);
        paintData(dataCtx, faceValues);
        map.needsUpdate = true;
        data.needsUpdate = true;
      })
      .catch(() => undefined);
  }

  const mat = new THREE.MeshStandardMaterial({
    map,
    bumpMap: data,
    bumpScale: 1.2,
    roughnessMap: data,
    metalnessMap: data,
    roughness: 1,
    metalness: 1,
  });
  const die = new THREE.Mesh(geo, mat);
  die.name = "d20";
  die.castShadow = true;
  die.quaternion.copy(restQuat);
  die.position.y = inradius;
  group.add(die);

  const shape: D20Shape = { inradius, vertices, faces, faceNormals, faceValues };
  group.userData.d20 = shape;
  group.userData.itemId = "dice";
  group.userData.label = ITEM_LABELS.dice.name;
  return group;
}
