/**
 * The Innkeeper's Music Box (~0.19 x 0.13 x 0.09): a polished walnut case
 * on a moulded plinth and brass bun feet, brass stringing round the body,
 * a brass keyhole escutcheon, a hinged lid with inlaid stringing, a
 * satinwood cartouche with a marquetry lyre and a painted tavern scene on
 * its underside. Inside, under glass in a felt-lined well, sits a
 * simplified cylinder movement: pinned brass cylinder, 18-tine steel comb,
 * spring barrel with its great wheel and a fly governor. A butterfly
 * winding key sticks out of the right-hand side.
 *
 * Pivot at the bottom centre (y = 0), front (keyhole) toward +Z.
 * Animatable parts are exposed via userData.parts (MusicBoxParts); the
 * MusicBoxController below drives them (SceneManager owns one).
 */
import * as THREE from "three";
import gsap from "gsap";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ITEM_LABELS, type MusicBoxParts, type Quality } from "../types";
import {
  cachedMaps,
  cachedTexture,
  fieldToTexture,
  heightToNormalMap,
  makeCanvas,
  mulberry32,
  noiseField,
  toTexture,
  type PbrMaps,
} from "./textures";
import { agedBrass, cornerGuardGeometry, cornerRotation, slabGeometry } from "./spellbookLook";
import { keepBloomMask } from "./materials";

// --- Dimensions (m) --------------------------------------------------------------------

const W = 0.194;
const D = 0.13;
const FOOT_H = 0.006;
const PLINTH_T = 0.008;
const BODY_Y0 = FOOT_H + PLINTH_T;
const BODY_Y1 = 0.068;
const WALL = 0.008;
const IN_X = W / 2 - WALL;
const IN_Z = D / 2 - WALL;
const LID_GAP = 0.0008;
const LID_T = 0.02;
const LID_W = W + 0.002;
const LID_D = D + 0.002;
const GLASS_Y = 0.0595;
/** Keyhole escutcheon centre height on the front face. */
const ESC_Y = 0.048;
/** Lid angle when open (radians, about the back hinge). */
export const MUSIC_BOX_LID_OPEN = THREE.MathUtils.degToRad(105);

/** Top of the brass bedplate the movement stands on. */
const BED_TOP = BODY_Y0 + 0.006;
/** Pinned cylinder: axis along X. */
const CYL = { x: -0.008, y: 0.036, z: -0.02, r: 0.0105, len: 0.1 };
const TINES = 18;
/** Spring barrel (right) and the key's arbor line through the wall. */
const BARREL = { x: 0.068, y: 0.04, z: -0.008, r: 0.0152, len: 0.022 };
/** Fly governor (left): vertical arbor. */
const GOV = { x: -0.078, z: -0.004, y0: BED_TOP, y1: 0.0535 };

// --- Maps ---------------------------------------------------------------------------------

interface WoodField {
  img: ImageData;
  h: Float32Array;
  rough: Float32Array;
}

/**
 * Figured walnut, grain running along u (the box's long X axis): fine
 * latewood bands warped by a slow figure field, sparse open pores as dark
 * streaks, a warm chocolate tone under a polished finish.
 */
function paintWalnut(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  seed: number,
): WoodField {
  // Straight quartered grain along u: many fine bands across v, nudged
  // by a slow field into the odd soft cathedral arc.
  const grain = noiseField(w, h, seed, 1, 6, 3);
  const figure = noiseField(w, h, seed + 1, 2, 3, 3);
  const fine = noiseField(w, h, seed + 2, 6, 200, 1);
  const pores = noiseField(w, h, seed + 3, 28, Math.round(h / 1.6), 1);
  const img = ctx.createImageData(w, h);
  const hf = new Float32Array(w * h);
  const rough = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const fig = figure[i]!;
      const g = (y / h) * 56 + grain[i]! * 8 + (fig - 0.5) * 3;
      const band = Math.sin(g * Math.PI * 2);
      const late = Math.max(0, band) ** 2;
      const pore = Math.max(0, 0.28 - pores[i]!) * 2.2;
      const f = fine[i]!;
      const tone = 0.9 + (fig - 0.5) * 0.24 - late * 0.12 + (f - 0.5) * 0.08 - pore * 0.2;
      img.data[i * 4] = 104 * tone;
      img.data[i * 4 + 1] = 66 * tone;
      img.data[i * 4 + 2] = 44 * tone;
      img.data[i * 4 + 3] = 255;
      hf[i] = -late * 0.1 - pore * 0.3 + f * 0.04;
      rough[i] = 0.42 + pore * 0.3 + late * 0.05;
    }
  }
  return { img, h: hf, rough };
}

/** Tileable walnut for the case, plinth and lid edges. */
function walnutMaps(): PbrMaps {
  return cachedMaps("musicbox:walnut", () => {
    const S = 512;
    const [canvas, ctx] = makeCanvas(S, S);
    const wood = paintWalnut(ctx, S, S, 9101);
    ctx.putImageData(wood.img, 0, 0);
    return {
      map: toTexture(canvas),
      normalMap: heightToNormalMap(wood.h, S, S, 0.6),
      roughnessMap: fieldToTexture(wood.rough, S, S),
    };
  });
}

type LidMaps = PbrMaps & { metalnessMap: THREE.Texture };

const LID_TEX_W = 1024;
const LID_TEX_H = 672;

/** Draw the lid inlay into a mask canvas: R = brass, G = boxwood, B = satinwood. */
function paintLidInlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const pxPerM = w / LID_W;
  // Stringing rectangle with incurved (notched) corners.
  const notchedRect = (inset: number, notch: number): void => {
    const x0 = inset;
    const y0 = inset;
    const x1 = w - inset;
    const y1 = h - inset;
    ctx.beginPath();
    ctx.moveTo(x0 + notch, y0);
    ctx.lineTo(x1 - notch, y0);
    ctx.arc(x1, y0, notch, Math.PI, Math.PI / 2, true);
    ctx.lineTo(x1, y1 - notch);
    ctx.arc(x1, y1, notch, -Math.PI / 2, Math.PI, true);
    ctx.lineTo(x0 + notch, y1);
    ctx.arc(x0, y1, notch, 0, -Math.PI / 2, true);
    ctx.lineTo(x0, y0 + notch);
    ctx.arc(x0, y0, notch, Math.PI / 2, 0, true);
    ctx.closePath();
  };
  const inset = 0.0135 * pxPerM;
  ctx.strokeStyle = "#f00";
  ctx.lineWidth = 5;
  notchedRect(inset, 26);
  ctx.stroke();
  ctx.strokeStyle = "#0f0";
  ctx.lineWidth = 3;
  notchedRect(inset + 11, 20);
  ctx.stroke();

  // Central satinwood cartouche ringed in brass.
  const cx = w / 2;
  const cy = h / 2;
  const rx = 0.045 * pxPerM;
  const ry = 0.03 * pxPerM;
  ctx.fillStyle = "#00f";
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#f00";
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.strokeStyle = "#0f0";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx + 10, ry + 10, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Small brass lozenges at the cartouche's four points.
  ctx.fillStyle = "#f00";
  for (const [dx, dy, s] of [
    [rx + 26, 0, 9],
    [-rx - 26, 0, 9],
    [0, ry + 24, 7],
    [0, -ry - 24, 7],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(cx + dx - s, cy + dy);
    ctx.lineTo(cx + dx, cy + dy - s * 0.6);
    ctx.lineTo(cx + dx + s, cy + dy);
    ctx.lineTo(cx + dx, cy + dy + s * 0.6);
    ctx.closePath();
    ctx.fill();
  }
}

/** Dark marquetry lyre + laurel inside the cartouche (drawn onto the colour). */
function paintLyre(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2 + 4;
  const s = 2.05;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const ebony = "rgba(38, 22, 12, 0.95)";
  // Lyre arms
  ctx.strokeStyle = ebony;
  ctx.lineWidth = 7;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 14, 46);
    ctx.bezierCurveTo(side * 50, 36, side * 56, -6, side * 34, -30);
    ctx.bezierCurveTo(side * 24, -42, side * 34, -58, side * 46, -54);
    ctx.stroke();
  }
  // Yoke and base
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-38, -36);
  ctx.quadraticCurveTo(0, -46, 38, -36);
  ctx.stroke();
  ctx.fillStyle = ebony;
  ctx.beginPath();
  ctx.ellipse(0, 48, 22, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // Strings (left for the brass mask pass: thin pale lines here)
  ctx.strokeStyle = "rgba(60, 36, 18, 0.9)";
  ctx.lineWidth = 1.6;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 6, -40);
    ctx.lineTo(i * 5, 44);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Lid top: walnut with inlaid brass + boxwood stringing and a satinwood
 * cartouche holding a marquetry lyre. Metalness marks the brass.
 */
function lidTopMaps(): LidMaps {
  return cachedMaps("musicbox:lidTop", () => {
    const w = LID_TEX_W;
    const h = LID_TEX_H;
    const [canvas, ctx] = makeCanvas(w, h);
    const wood = paintWalnut(ctx, w, h, 9201);
    const [, mctx] = makeCanvas(w, h);
    paintLidInlay(mctx, w, h);
    const mask = mctx.getImageData(0, 0, w, h).data;
    const satin = noiseField(w, h, 9205, 2, 60, 3);
    const brassN = noiseField(w, h, 9206, 40, 26, 2);
    const metal = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const brass = mask[i * 4]! / 255;
      const box = mask[i * 4 + 1]! / 255;
      const sat = mask[i * 4 + 2]! / 255;
      let r = wood.img.data[i * 4]!;
      let g = wood.img.data[i * 4 + 1]!;
      let b = wood.img.data[i * 4 + 2]!;
      if (sat > 0) {
        // Satinwood with a soft fiddleback shimmer.
        const f = 0.86 + Math.sin(satin[i]! * 40) * 0.07;
        r = r * (1 - sat) + 196 * f * sat;
        g = g * (1 - sat) + 146 * f * sat;
        b = b * (1 - sat) + 82 * f * sat;
      }
      if (box > 0) {
        r = r * (1 - box) + 214 * box;
        g = g * (1 - box) + 182 * box;
        b = b * (1 - box) + 120 * box;
      }
      if (brass > 0) {
        const n = 0.9 + (brassN[i]! - 0.5) * 0.2;
        r = r * (1 - brass) + 206 * n * brass;
        g = g * (1 - brass) + 164 * n * brass;
        b = b * (1 - brass) + 86 * n * brass;
      }
      wood.img.data[i * 4] = r;
      wood.img.data[i * 4 + 1] = g;
      wood.img.data[i * 4 + 2] = b;
      // Inlays are flush: a hairline groove at their edge is all that shows.
      const edge = Math.max(brass, box, sat) * (1 - Math.max(brass, box, sat));
      wood.h[i] = wood.h[i]! * (1 - sat * 0.7) - edge * 0.8 - brass * 0.05;
      wood.rough[i] = wood.rough[i]! * (1 - brass) + 0.34 * brass;
      metal[i] = brass * 0.85;
    }
    ctx.putImageData(wood.img, 0, 0);
    paintLyre(ctx, w, h);
    return {
      map: toTexture(canvas),
      normalMap: heightToNormalMap(wood.h, w, h, 1.1, false),
      roughnessMap: fieldToTexture(wood.rough, w, h),
      metalnessMap: fieldToTexture(metal, w, h),
    };
  });
}

/** Deep red wool felt: mottled colour + a fibrous normal. */
function feltMaps(): { map: THREE.Texture; normalMap: THREE.Texture } {
  return cachedMaps("musicbox:felt", () => {
    const S = 256;
    const mott = noiseField(S, S, 9301, 6, 6, 4);
    const fib = noiseField(S, S, 9302, 64, 64, 2);
    const [canvas, ctx] = makeCanvas(S, S);
    const img = ctx.createImageData(S, S);
    const h = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) {
      const t = 0.8 + (mott[i]! - 0.5) * 0.3 + (fib[i]! - 0.5) * 0.18;
      img.data[i * 4] = 124 * t;
      img.data[i * 4 + 1] = 20 * t;
      img.data[i * 4 + 2] = 30 * t;
      img.data[i * 4 + 3] = 255;
      h[i] = fib[i]!;
    }
    ctx.putImageData(img, 0, 0);
    return { map: toTexture(canvas), normalMap: heightToNormalMap(h, S, S, 1.5) };
  });
}

/**
 * Oil-on-panel tavern interior for the lid's underside: beams, a moonlit
 * window, a hanging lantern, the hearth ablaze and a bard playing to two
 * patrons, softened with brushwork, warm varnish and fine craquelure.
 * The canvas top is the lid's front edge (up when the lid stands open).
 */
function paintingTexture(): THREE.Texture {
  return cachedTexture("musicbox:painting", () => {
    const w = 512;
    const h = 320;
    const [canvas, ctx] = makeCanvas(w, h);
    const rand = mulberry32(9401);

    // Wall + floor
    const wall = ctx.createLinearGradient(0, 0, 0, h);
    wall.addColorStop(0, "#26170d");
    wall.addColorStop(0.5, "#4b2f19");
    wall.addColorStop(0.72, "#3b2414");
    wall.addColorStop(1, "#1d1209");
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#2a190d";
    ctx.fillRect(0, h * 0.76, w, h * 0.24);
    ctx.strokeStyle = "rgba(10, 5, 2, 0.5)";
    ctx.lineWidth = 1.5;
    for (let y = h * 0.8; y < h; y += 14) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y + 2);
      ctx.stroke();
    }

    // Hearth glow (right)
    const fx = w * 0.78;
    const fy = h * 0.66;
    const glow = ctx.createRadialGradient(fx, fy, 6, fx, fy, w * 0.62);
    glow.addColorStop(0, "rgba(255, 200, 110, 0.95)");
    glow.addColorStop(0.14, "rgba(240, 140, 55, 0.65)");
    glow.addColorStop(0.45, "rgba(150, 72, 26, 0.28)");
    glow.addColorStop(1, "rgba(60, 30, 10, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // Stone hearth surround with an arched opening
    ctx.fillStyle = "#4a3a2e";
    ctx.fillRect(fx - 74, h * 0.3, 148, h * 0.48);
    ctx.fillStyle = "#3a2c22";
    for (let i = 0; i < 26; i++) {
      const sx = fx - 74 + rand() * 140;
      const sy = h * 0.3 + rand() * h * 0.46;
      ctx.fillRect(sx, sy, 10 + rand() * 16, 6 + rand() * 6);
    }
    ctx.fillStyle = "#2b1f17";
    ctx.fillRect(fx - 84, h * 0.27, 168, 10); // mantel
    ctx.fillStyle = "#120a05";
    ctx.beginPath();
    ctx.moveTo(fx - 46, h * 0.78);
    ctx.lineTo(fx - 46, h * 0.52);
    ctx.quadraticCurveTo(fx, h * 0.36, fx + 46, h * 0.52);
    ctx.lineTo(fx + 46, h * 0.78);
    ctx.closePath();
    ctx.fill();
    // Flames
    for (let i = 0; i < 9; i++) {
      const x = fx - 30 + i * 7.5 + (rand() - 0.5) * 4;
      const fh = 26 + rand() * 30;
      const fl = ctx.createLinearGradient(x, h * 0.76, x, h * 0.76 - fh);
      fl.addColorStop(0, "rgba(255, 236, 160, 1)");
      fl.addColorStop(0.5, "rgba(255, 150, 40, 0.9)");
      fl.addColorStop(1, "rgba(200, 60, 10, 0)");
      ctx.fillStyle = fl;
      ctx.beginPath();
      ctx.moveTo(x - 7, h * 0.76);
      ctx.quadraticCurveTo(x - 6, h * 0.76 - fh * 0.6, x + (rand() - 0.5) * 6, h * 0.76 - fh);
      ctx.quadraticCurveTo(x + 6, h * 0.76 - fh * 0.6, x + 7, h * 0.76);
      ctx.fill();
    }
    ctx.fillStyle = "#1a0d06";
    ctx.fillRect(fx - 32, h * 0.745, 64, 6); // logs

    // Moonlit window (left)
    const wx = w * 0.1;
    const wy = h * 0.2;
    const ww = w * 0.15;
    const wh = h * 0.32;
    const sky = ctx.createLinearGradient(0, wy, 0, wy + wh);
    sky.addColorStop(0, "#152240");
    sky.addColorStop(1, "#2b3e60");
    ctx.fillStyle = sky;
    ctx.fillRect(wx, wy, ww, wh);
    ctx.fillStyle = "rgba(232, 228, 200, 0.95)";
    ctx.beginPath();
    ctx.arc(wx + ww * 0.68, wy + wh * 0.3, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1b1009";
    ctx.lineWidth = 4;
    ctx.strokeRect(wx, wy, ww, wh);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(wx + ww / 2, wy);
    ctx.lineTo(wx + ww / 2, wy + wh);
    ctx.moveTo(wx, wy + wh / 2);
    ctx.lineTo(wx + ww, wy + wh / 2);
    ctx.stroke();

    // Beams + posts
    ctx.fillStyle = "#170d06";
    ctx.fillRect(0, 0, w, h * 0.09);
    ctx.fillRect(0, 0, w * 0.035, h);
    ctx.fillRect(w * 0.965, 0, w * 0.035, h);
    ctx.fillStyle = "rgba(120, 70, 30, 0.35)";
    ctx.fillRect(0, h * 0.085, w, 2);

    // Hanging lantern
    const lx = w * 0.43;
    const ly = h * 0.26;
    ctx.strokeStyle = "#140a04";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(lx, h * 0.09);
    ctx.lineTo(lx, ly - 8);
    ctx.stroke();
    const lg = ctx.createRadialGradient(lx, ly, 1, lx, ly, 46);
    lg.addColorStop(0, "rgba(255, 220, 140, 0.9)");
    lg.addColorStop(0.25, "rgba(255, 170, 70, 0.35)");
    lg.addColorStop(1, "rgba(255, 150, 60, 0)");
    ctx.fillStyle = lg;
    ctx.fillRect(lx - 46, ly - 46, 92, 92);
    ctx.fillStyle = "#1a0f07";
    ctx.fillRect(lx - 5, ly - 8, 10, 3);
    ctx.fillRect(lx - 5, ly + 6, 10, 3);
    ctx.fillStyle = "#ffd98a";
    ctx.fillRect(lx - 3.5, ly - 5, 7, 11);

    // Silhouettes: dark warm figures, rim-lit from the hearth side.
    const sil = "#120904";
    const figure = (draw: () => void): void => {
      ctx.fillStyle = sil;
      draw();
      ctx.fill();
      // Firelight catches the hearth-facing (right) edge only.
      ctx.save();
      draw();
      ctx.clip();
      ctx.translate(-2.5, 0);
      ctx.fillStyle = "rgba(230, 120, 45, 0.45)";
      ctx.fillRect(-w, -h, w * 3, h * 3);
      ctx.fillStyle = sil;
      draw();
      ctx.fill();
      ctx.restore();
    };
    // Table with two patrons
    const tx = w * 0.3;
    const ty = h * 0.7;
    figure(() => {
      ctx.beginPath();
      ctx.ellipse(tx, ty, 58, 9, 0, 0, Math.PI * 2);
    });
    ctx.fillStyle = sil;
    ctx.fillRect(tx - 4, ty, 8, h * 0.16);
    for (const [px, lean] of [
      [tx - 52, -0.15],
      [tx + 50, 0.12],
    ] as const) {
      figure(() => {
        ctx.beginPath();
        ctx.ellipse(px, ty - 22, 15, 26, lean, 0, Math.PI * 2);
      });
      figure(() => {
        ctx.beginPath();
        ctx.arc(px + lean * 30, ty - 54, 9, 0, Math.PI * 2);
      });
    }
    // Raised tankards with foam
    for (const [x, y] of [
      [tx - 34, ty - 46],
      [tx + 30, ty - 50],
    ] as const) {
      ctx.fillStyle = "#3a2412";
      ctx.fillRect(x - 5, y, 10, 12);
      ctx.fillStyle = "#e9dcc0";
      ctx.fillRect(x - 6, y - 3, 12, 4);
    }
    // The bard, mid-song, with a lute
    const bx = w * 0.56;
    const by = h * 0.76;
    figure(() => {
      ctx.beginPath();
      ctx.moveTo(bx - 20, by);
      ctx.quadraticCurveTo(bx - 18, by - 60, bx - 4, by - 86);
      ctx.lineTo(bx + 8, by - 86);
      ctx.quadraticCurveTo(bx + 20, by - 56, bx + 22, by);
      ctx.closePath();
    });
    figure(() => {
      ctx.beginPath();
      ctx.arc(bx + 2, by - 96, 10, 0, Math.PI * 2);
    });
    // Feathered hat
    ctx.fillStyle = "#5b1a12";
    ctx.beginPath();
    ctx.ellipse(bx + 2, by - 104, 15, 4, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#d8c690";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx + 10, by - 106);
    ctx.quadraticCurveTo(bx + 22, by - 124, bx + 30, by - 118);
    ctx.stroke();
    // Lute: warm body + neck across the chest
    ctx.save();
    ctx.translate(bx + 4, by - 52);
    ctx.rotate(-0.55);
    ctx.fillStyle = "#8a5a2a";
    ctx.beginPath();
    ctx.ellipse(10, 0, 16, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#24140a";
    ctx.beginPath();
    ctx.arc(8, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5e3a1a";
    ctx.fillRect(-30, -2, 30, 4);
    ctx.fillRect(-36, -3.5, 7, 7);
    ctx.restore();
    // Floating notes over the bard
    ctx.fillStyle = "rgba(240, 210, 140, 0.75)";
    ctx.strokeStyle = "rgba(240, 210, 140, 0.75)";
    ctx.lineWidth = 1.4;
    for (const [nx, ny] of [
      [bx + 34, by - 130],
      [bx + 52, by - 146],
      [bx + 18, by - 152],
    ] as const) {
      ctx.beginPath();
      ctx.ellipse(nx, ny, 3.6, 2.6, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(nx + 3, ny);
      ctx.lineTo(nx + 3, ny - 12);
      ctx.lineTo(nx + 8, ny - 9);
      ctx.stroke();
    }

    // Brushwork: dabs sampled from the underpainting soften every edge.
    const base = ctx.getImageData(0, 0, w, h).data;
    for (let i = 0; i < 2600; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const k = (Math.floor(y) * w + Math.floor(x)) * 4;
      const j = (rand() - 0.5) * 22;
      ctx.fillStyle = `rgba(${base[k]! + j}, ${base[k + 1]! + j * 0.8}, ${base[k + 2]! + j * 0.5}, 0.32)`;
      ctx.beginPath();
      ctx.ellipse(x, y, 2 + rand() * 4, 1 + rand() * 1.6, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    // Warm varnish + vignette
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = "rgb(226, 196, 150)";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
    const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.62);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(14, 7, 2, 0.6)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
    // Craquelure
    ctx.strokeStyle = "rgba(10, 5, 2, 0.16)";
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 70; i++) {
      let x = rand() * w;
      let y = rand() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 6; s++) {
        x += (rand() - 0.5) * 26;
        y += (rand() - 0.5) * 26;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const tex = toTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  });
}

/** Soft warm streaks along the comb's tines for the music-level glow. */
function glintTexture(): THREE.Texture {
  return cachedTexture("musicbox:glint", () => {
    const w = 256;
    const h = 64;
    const [canvas, ctx] = makeCanvas(w, h);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    for (let k = 0; k < TINES; k++) {
      const x = ((k + 0.5) / TINES) * w;
      const g = ctx.createLinearGradient(0, 0, 0, h);
      // v = 1 (canvas top) is the tine tip at the cylinder.
      g.addColorStop(0, "rgba(255, 210, 140, 1)");
      g.addColorStop(0.5, "rgba(255, 170, 90, 0.45)");
      g.addColorStop(1, "rgba(255, 150, 70, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - 3, 0, 6, h);
    }
    const tex = toTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  });
}

/** Start-up warm-up hook: paint every music box map now (cached). */
export function musicBoxMaps(): void {
  walnutMaps();
  lidTopMaps();
  feltMaps();
  paintingTexture();
  glintTexture();
}

// --- Geometry helpers ---------------------------------------------------------------------

/** Merge mixed indexed / non-indexed pieces into one non-indexed geometry. */
function merge(pieces: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const flat = pieces.map((g) => {
    const out = g.index ? g.toNonIndexed() : g;
    out.clearGroups();
    return out;
  });
  const merged = mergeGeometries(flat);
  if (!merged) throw new Error("musicBox: geometry merge failed");
  return merged;
}

/** Rounded rectangle (half extents hx, hz) traced into a shape or path. */
function roundedRect<T extends THREE.Path>(path: T, hx: number, hz: number, r: number): T {
  path.moveTo(-hx + r, -hz);
  path.lineTo(hx - r, -hz);
  path.absarc(hx - r, -hz + r, r, -Math.PI / 2, 0, false);
  path.lineTo(hx, hz - r);
  path.absarc(hx - r, hz - r, r, 0, Math.PI / 2, false);
  path.lineTo(-hx + r, hz);
  path.absarc(-hx + r, hz - r, r, Math.PI / 2, Math.PI, false);
  path.lineTo(-hx, -hz + r);
  path.absarc(-hx + r, -hz + r, r, Math.PI, Math.PI * 1.5, false);
  return path;
}

/**
 * Plan-view ring (outer minus inner rounded rect) extruded upward from
 * y0 by height; UVs in metres x uvScale (grain along X).
 */
function ringGeometry(
  outer: [number, number, number],
  inner: [number, number, number],
  y0: number,
  height: number,
  uvScale = 5,
  curveSegments = 3,
): THREE.BufferGeometry {
  const shape = roundedRect(new THREE.Shape(), ...outer);
  shape.holes.push(roundedRect(new THREE.Path(), ...inner));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    curveSegments,
  });
  geo.rotateX(-Math.PI / 2); // shape y → −z, extrusion → +y
  geo.translate(0, y0, 0);
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvScale, uv.getY(i) * uvScale);
  geo.clearGroups();
  return geo;
}

/** Spur gear outline in the XY plane (radius r, tooth depth), optional spoke windows. */
function gearShape(r: number, teeth: number, depth: number, spokes = 0, hub = 0): THREE.Shape {
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts: [number, number][] = [
      [a, r - depth],
      [a + step * 0.18, r],
      [a + step * 0.48, r],
      [a + step * 0.66, r - depth],
    ];
    pts.forEach(([ang, rad], k) => {
      const x = Math.cos(ang) * rad;
      const y = Math.sin(ang) * rad;
      if (i === 0 && k === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
  }
  shape.closePath();
  if (spokes > 0) {
    const r0 = hub;
    const r1 = r - depth - 0.0022;
    const win = (Math.PI * 2) / spokes;
    for (let s = 0; s < spokes; s++) {
      const a0 = s * win + 0.32;
      const a1 = (s + 1) * win - 0.32;
      const hole = new THREE.Path();
      hole.absarc(0, 0, r1, a0, a1, false);
      hole.absarc(0, 0, r0, a1 - 0.12, a0 + 0.12, true);
      hole.closePath();
      shape.holes.push(hole);
    }
  }
  return shape;
}

/** Extrude a gear shape `thick` along +X, centred on x = 0. */
function gearGeometry(shape: THREE.Shape, thick: number): THREE.BufferGeometry {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thick,
    bevelEnabled: false,
    curveSegments: 4,
  });
  geo.translate(0, 0, -thick / 2);
  geo.rotateY(Math.PI / 2); // extrusion z → +x
  geo.clearGroups();
  return geo;
}

/** Cylinder of radius r and length len along X, centred at x0. */
function xCylinder(r: number, len: number, x0: number, segments = 20): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(r, r, len, segments);
  geo.rotateZ(-Math.PI / 2);
  geo.translate(x0, 0, 0);
  return geo;
}

/**
 * Brass bearing cock: an upright plate (thin in X) from the bedplate to
 * just above an arbor at height ay, rounded over the arbor.
 */
function bracketGeometry(width: number, top: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const hw = width / 2;
  shape.moveTo(-hw, 0);
  shape.lineTo(hw, 0);
  shape.lineTo(hw, top - hw);
  shape.absarc(0, top - hw, hw, 0, Math.PI, false);
  shape.lineTo(-hw, 0);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0026,
    bevelEnabled: false,
    curveSegments: 4,
  });
  geo.translate(0, 0, -0.0013);
  geo.rotateY(Math.PI / 2); // plate lies in the YZ plane (shape x → −z)
  geo.clearGroups();
  return geo;
}

// --- Parts ------------------------------------------------------------------------------------

/** The pinned cylinder (spins about its own X axis). */
function buildCylinder(brass: THREE.Material, steel: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = "musicbox:cylinder";
  const { r, len } = CYL;

  const drum = merge([
    xCylinder(r, len, 0, 22),
    xCylinder(r + 0.0013, 0.0018, -len / 2 + 0.0009, 22),
    xCylinder(r + 0.0013, 0.0018, len / 2 - 0.0009, 22),
  ]);
  group.add(new THREE.Mesh(drum, brass));

  // Driving wheel on the right end of the cylinder.
  const wheel = gearGeometry(gearShape(0.0142, 20, 0.0011), 0.0014);
  wheel.translate(len / 2 + 0.0024, 0, 0);
  group.add(new THREE.Mesh(wheel, brass));

  // Steel arbor + pins: a deterministic little melody, a few pins per beat.
  const parts: THREE.BufferGeometry[] = [xCylinder(0.0011, len + 0.014, 0, 8)];
  const rand = mulberry32(9501);
  const pitch = (len - 0.004) / TINES;
  const beats = 30;
  // Arpeggiated chords walking around the drum.
  const chords = [
    [0, 4, 7, 11, 14],
    [2, 5, 9, 12, 16],
    [4, 7, 11, 14, 17],
    [1, 5, 8, 12, 15],
  ];
  const pinLen = 0.0016;
  for (let b = 0; b < beats; b++) {
    const chord = chords[Math.floor(b / 12) % chords.length]!;
    const notes = 2 + Math.floor(rand() * 2);
    for (let n = 0; n < notes; n++) {
      const k = chord[Math.floor(rand() * chord.length)]! + (rand() < 0.2 ? 1 : 0);
      if (k >= TINES) continue;
      const a = (b / beats) * Math.PI * 2 + (rand() - 0.5) * 0.04;
      const x = -len / 2 + 0.002 + (k + 0.5) * pitch;
      const pin = new THREE.CylinderGeometry(0.00034, 0.00034, pinLen, 3, 1, true);
      pin.rotateX(a);
      const rr = r + pinLen / 2 - 0.0002;
      pin.translate(x, Math.cos(a) * rr, Math.sin(a) * rr);
      parts.push(pin);
    }
  }
  group.add(new THREE.Mesh(merge(parts), steel));
  group.position.set(CYL.x, CYL.y, CYL.z);
  return group;
}

/** Steel comb: slanted base block + 18 tines reaching back to the cylinder. */
function buildComb(steel: THREE.Material, brass: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = "musicbox:comb";
  const x0 = CYL.x - CYL.len / 2 + 0.002;
  const span = CYL.len - 0.004;
  const pitch = span / TINES;
  const tineW = pitch * 0.76;
  const tineT = 0.0011;
  const tineY = CYL.y + 0.004;
  const tipZ = CYL.z + Math.sqrt(CYL.r ** 2 - 0.004 ** 2) + 0.0008;
  const rootZ = (k: number): number => THREE.MathUtils.lerp(0.027, 0.016, k / (TINES - 1));
  const baseDepth = 0.011;
  const baseY0 = tineY - 0.0055;
  const top = tineY + tineT / 2;

  const parts: THREE.BufferGeometry[] = [];
  // Base block: a quad in plan (slanted root line), extruded down from the tine top.
  const plan = new THREE.Shape();
  plan.moveTo(x0 - 0.001, -(rootZ(0) - 0.0005));
  plan.lineTo(x0 + span + 0.001, -(rootZ(TINES - 1) - 0.0005));
  plan.lineTo(x0 + span + 0.001, -(rootZ(TINES - 1) + baseDepth));
  plan.lineTo(x0 - 0.001, -(rootZ(0) + baseDepth));
  plan.closePath();
  const base = new THREE.ExtrudeGeometry(plan, {
    depth: top - baseY0,
    bevelEnabled: true,
    bevelThickness: 0.0003,
    bevelSize: 0.0003,
    bevelSegments: 1,
  });
  base.rotateX(-Math.PI / 2);
  base.translate(0, baseY0, 0);
  base.clearGroups();
  parts.push(base);
  for (let k = 0; k < TINES; k++) {
    const len = rootZ(k) - tipZ;
    const tine = new THREE.BoxGeometry(tineW, tineT, len);
    tine.translate(x0 + (k + 0.5) * pitch, tineY, tipZ + len / 2);
    parts.push(tine);
    if (k < 4) {
      // Lead tuning weights under the bass tines.
      const lead = new THREE.BoxGeometry(tineW * 0.86, 0.0018, 0.0042);
      lead.translate(x0 + (k + 0.5) * pitch, tineY - tineT / 2 - 0.0009, tipZ + 0.0065);
      parts.push(lead);
    }
  }
  group.add(new THREE.Mesh(merge(parts), steel));

  // Brass riser under the base + three steel screw heads on top.
  const riser = new THREE.BoxGeometry(span + 0.004, baseY0 - BED_TOP, 0.009);
  riser.translate(x0 + span / 2, (baseY0 + BED_TOP) / 2, (rootZ(0) + rootZ(TINES - 1)) / 2 + baseDepth / 2);
  group.add(new THREE.Mesh(riser, brass));
  const screws: THREE.BufferGeometry[] = [];
  for (const t of [0.12, 0.5, 0.88]) {
    const k = t * (TINES - 1);
    const s = new THREE.CylinderGeometry(0.0019, 0.0021, 0.0008, 8);
    const slot = new THREE.BoxGeometry(0.0034, 0.0003, 0.0005);
    slot.translate(0, 0.0005, 0);
    const head = merge([s, slot]);
    head.translate(x0 + t * span, top + 0.0004, rootZ(k) + baseDepth * 0.55);
    screws.push(head);
  }
  group.add(new THREE.Mesh(merge(screws), steel));
  return group;
}

/** Additive glow strip over the tines (driven by the music level). */
function buildGlint(): THREE.Mesh {
  const x0 = CYL.x - CYL.len / 2 + 0.002;
  const span = CYL.len - 0.004;
  const tipZ = CYL.z + Math.sqrt(CYL.r ** 2 - 0.004 ** 2);
  const depth = 0.03 - tipZ;
  const geo = new THREE.PlaneGeometry(span, depth);
  geo.rotateX(-Math.PI / 2); // v = 1 toward −z (the tips)
  geo.translate(x0 + span / 2, CYL.y + 0.0048, tipZ + depth / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: glintTexture(),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "musicbox:glint";
  mesh.visible = false;
  mesh.renderOrder = 2;
  mesh.userData.noShadow = true;
  return mesh;
}

/** Spring barrel + great wheel + ratchet, with its two bearing cocks. */
function buildBarrel(brass: THREE.Material, steel: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = "musicbox:barrel";
  const { r, len } = BARREL;
  const drum = merge([
    xCylinder(r, len, 0, 32),
    xCylinder(r - 0.004, 0.0012, len / 2 + 0.0004, 24),
  ]);
  group.add(new THREE.Mesh(drum, brass));
  const great = gearGeometry(gearShape(r + 0.0026, 24, 0.0012, 4, 0.0042), 0.0016);
  great.translate(-len / 2 - 0.0012, 0, 0);
  group.add(new THREE.Mesh(great, brass));
  const ratchet = gearGeometry(gearShape(0.0074, 12, 0.0016), 0.0014);
  ratchet.translate(len / 2 + 0.0022, 0, 0);
  const arbor = xCylinder(0.0014, len + 0.016, 0.002, 10);
  group.add(new THREE.Mesh(merge([ratchet, arbor]), steel));
  group.position.set(BARREL.x, BARREL.y, BARREL.z);
  return group;
}

/** Fly governor: worm on a vertical arbor topped by a two-vane air brake. */
function buildFly(brass: THREE.Material, steel: THREE.Material): THREE.Group {
  const fly = new THREE.Group();
  fly.name = "musicbox:fly";
  const h = GOV.y1 - GOV.y0;
  const arbor = new THREE.CylinderGeometry(0.0008, 0.0008, h, 8);
  arbor.translate(0, h / 2, 0);
  // Endless screw: a helix tube around the arbor.
  const turns = 6;
  const helix = new THREE.CatmullRomCurve3(
    Array.from({ length: turns * 8 + 1 }, (_, i) => {
      const t = i / (turns * 8);
      const a = t * turns * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * 0.0018, 0.008 + t * 0.012, Math.sin(a) * 0.0018);
    }),
  );
  const worm = new THREE.TubeGeometry(helix, turns * 6, 0.00062, 3, false);
  const core = new THREE.CylinderGeometry(0.0014, 0.0014, 0.013, 10);
  core.translate(0, 0.014, 0);
  fly.add(new THREE.Mesh(merge([arbor, worm, core]), steel));
  // Vanes: two thin brass plates either side of a hub, standing upright.
  const hub = new THREE.CylinderGeometry(0.0016, 0.0016, 0.0032, 10);
  hub.translate(0, h - 0.0062, 0);
  const vanes: THREE.BufferGeometry[] = [hub];
  for (const side of [-1, 1]) {
    const vane = new THREE.BoxGeometry(0.0078, 0.0058, 0.0004);
    vane.translate(side * 0.0055, h - 0.0062, 0);
    vanes.push(vane);
  }
  const vaneMesh = new THREE.Mesh(merge(vanes), brass);
  vaneMesh.userData.noShadow = true;
  fly.add(vaneMesh);
  fly.position.set(GOV.x, GOV.y0, GOV.z);
  fly.children.forEach((c) => (c.userData.noShadow = true));
  return fly;
}

/** Butterfly winding key (rotates about X); built at the origin, shaft along +X. */
function buildKey(brass: THREE.Material): THREE.Group {
  const key = new THREE.Group();
  key.name = "musicbox:key";
  const shaft = xCylinder(0.0017, 0.008, 0.004, 12);
  const collar = xCylinder(0.0028, 0.0018, 0.0012, 16);
  const neck = xCylinder(0.0024, 0.003, 0.0076, 12);
  // Bow: two round wings joined at a waist, lying in the YZ plane.
  const lobeR = 0.0074;
  const lobeY = 0.0092;
  const waist = 0.0024;
  const halfWidth = (y: number): number => {
    const d = (Math.abs(y) - lobeY) / lobeR;
    return Math.max(waist, d * d < 1 ? lobeR * Math.sqrt(1 - d * d) : 0);
  };
  const bow = new THREE.Shape();
  const top = lobeY + lobeR;
  const samples = 16;
  for (let i = 0; i <= samples; i++) {
    const y = -top + (2 * top * i) / samples;
    const x = halfWidth(y);
    if (i === 0) bow.moveTo(x, y);
    else bow.lineTo(x, y);
  }
  for (let i = samples - 1; i > 0; i--) {
    const y = -top + (2 * top * i) / samples;
    bow.lineTo(-halfWidth(y), y);
  }
  bow.closePath();
  for (const sy of [-1, 1]) {
    const hole = new THREE.Path();
    hole.absarc(0, sy * (lobeY + 0.0008), 0.0026, 0, Math.PI * 2, true);
    hole.autoClose = true;
    bow.holes.push(hole);
  }
  const bowGeo = new THREE.ExtrudeGeometry(bow, {
    depth: 0.0018,
    bevelEnabled: false,
    curveSegments: 7,
  });
  bowGeo.translate(0, 0, -0.0009);
  bowGeo.rotateY(Math.PI / 2); // extrusion → +x, wings along y
  bowGeo.translate(0.0105, 0, 0);
  bowGeo.clearGroups();
  const mesh = new THREE.Mesh(merge([shaft, collar, neck, bowGeo]), brass);
  mesh.userData.noShadow = true; // it turns; a stale shadow would show
  key.add(mesh);
  return key;
}

/** Lid (hinged at its back-bottom edge; group origin on the hinge line). */
function buildLid(
  lidTop: THREE.Material,
  walnut: THREE.Material,
  brass: THREE.Material,
): THREE.Group {
  const lid = new THREE.Group();
  lid.name = "musicbox:lid";
  const slab = new THREE.Mesh(slabGeometry(LID_W, LID_T, LID_D), [lidTop, walnut, walnut]);
  slab.position.set(0, LID_T / 2, LID_D / 2);
  lid.add(slab);

  // Brass corner guards on the four top corners.
  const guards: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      const g = cornerGuardGeometry(0.015, LID_T, 2);
      g.rotateY(cornerRotation((-sx) as 1 | -1, (-sz) as 1 | -1));
      g.translate(sx * (LID_W / 2), 0, LID_D / 2 + sz * (LID_D / 2));
      guards.push(g);
    }
  }
  // Thumb lift at the front edge.
  const lift = new THREE.CylinderGeometry(0.0034, 0.0034, 0.0016, 16, 1, false, 0, Math.PI);
  lift.rotateX(Math.PI / 2);
  lift.rotateZ(Math.PI);
  lift.translate(0, LID_T * 0.42, LID_D + 0.0006);
  guards.push(lift);
  lid.add(new THREE.Mesh(merge(guards), brass));

  // Painted panel inside the lid, in a slim gilt frame.
  const pw = 0.158;
  const pd = 0.096;
  const panel = new THREE.PlaneGeometry(pw, pd);
  panel.rotateX(Math.PI / 2); // faces −y; v grows toward the lid's front edge
  panel.translate(0, -0.0005, LID_D / 2);
  const paint = new THREE.MeshStandardMaterial({
    map: paintingTexture(),
    roughness: 0.5,
    metalness: 0,
  });
  lid.add(new THREE.Mesh(panel, paint));
  const frame = roundedRect(new THREE.Shape(), pw / 2 + 0.004, pd / 2 + 0.004, 0.0015);
  frame.holes.push(roundedRect(new THREE.Path(), pw / 2 - 0.0004, pd / 2 - 0.0004, 0.0004));
  const frameGeo = new THREE.ExtrudeGeometry(frame, {
    depth: 0.0014,
    bevelEnabled: false,
    curveSegments: 2,
  });
  frameGeo.rotateX(Math.PI / 2); // shape y → +z, extrusion → −y
  frameGeo.translate(0, -0.0001, LID_D / 2);
  frameGeo.clearGroups();
  lid.add(new THREE.Mesh(frameGeo, brass));

  lid.position.set(0, BODY_Y1 + LID_GAP, -LID_D / 2);
  return lid;
}

// --- Builder ------------------------------------------------------------------------------------

/** Walnut under a clear polish; clearcoat off on low quality. */
function walnutMaterial(maps: PbrMaps & { metalnessMap?: THREE.Texture }): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    map: maps.map,
    normalMap: maps.normalMap,
    roughnessMap: maps.roughnessMap,
    metalnessMap: maps.metalnessMap ?? null,
    roughness: 1,
    metalness: maps.metalnessMap ? 1 : 0,
    clearcoat: 0.4,
    clearcoatRoughness: 0.32,
  });
  mat.userData.polish = true;
  return mat;
}

export function buildMusicBox(): THREE.Group {
  const group = new THREE.Group();
  group.name = "musicbox";

  const walnut = walnutMaterial(walnutMaps());
  const lidTop = walnutMaterial(lidTopMaps());
  const brass = agedBrass();
  const gilt = agedBrass();
  // Richer, freshly polished brass for the movement under the glass.
  gilt.color.set(0xf4c27a);
  gilt.metalness = 0.72;
  const steel = new THREE.MeshStandardMaterial({
    color: 0xcfd3d8,
    metalness: 0.75,
    roughness: 0.3,
  });
  const felt = feltMaps();
  const feltMat = new THREE.MeshStandardMaterial({
    map: felt.map,
    normalMap: felt.normalMap,
    roughness: 1,
    metalness: 0,
  });

  // --- Case ---------------------------------------------------------------------------
  const feet: THREE.BufferGeometry[] = [];
  const footProfile = [
    [0.0001, 0],
    [0.0046, 0.0008],
    [0.0057, 0.0032],
    [0.0036, FOOT_H],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const foot = new THREE.LatheGeometry(footProfile, 7);
      foot.translate(sx * (W / 2 - 0.011), 0, sz * (D / 2 - 0.011));
      feet.push(foot);
    }
  }
  const plinth = new THREE.Mesh(slabGeometry(W + 0.008, PLINTH_T, D + 0.008), walnut);
  plinth.position.y = FOOT_H + PLINTH_T / 2;
  group.add(plinth);

  const body = ringGeometry([W / 2, D / 2, 0.004], [IN_X, IN_Z, 0.0015], BODY_Y0, BODY_Y1 - BODY_Y0);
  group.add(new THREE.Mesh(body, walnut));

  // Brass: feet, plinth corners, stringing bands, hinges, escutcheon.
  const brassParts: THREE.BufferGeometry[] = [...feet];
  for (const y of [BODY_Y0 + 0.006, BODY_Y1 - 0.006]) {
    brassParts.push(
      ringGeometry([W / 2 + 0.0003, D / 2 + 0.0003, 0.0043], [W / 2 - 0.001, D / 2 - 0.001, 0.003], y, 0.0011, 10, 2),
    );
  }
  for (const sx of [-1, 1]) {
    const hinge = xCylinder(0.0017, 0.022, sx * 0.062, 12);
    hinge.translate(0, BODY_Y1 + LID_GAP / 2, -D / 2 - 0.0012);
    brassParts.push(hinge);
  }
  // Escutcheon: a pointed-oval plate with a keyhole, on the front face.
  const esc = new THREE.Shape();
  esc.moveTo(0, 0.0105);
  esc.quadraticCurveTo(0.0085, 0.006, 0.0078, 0);
  esc.quadraticCurveTo(0.0085, -0.006, 0, -0.0105);
  esc.quadraticCurveTo(-0.0085, -0.006, -0.0078, 0);
  esc.quadraticCurveTo(-0.0085, 0.006, 0, 0.0105);
  const kr = 0.0016;
  const a0 = -Math.PI / 2 + 0.62;
  const a1 = -Math.PI / 2 - 0.62 + Math.PI * 2;
  const keyhole = new THREE.Path();
  keyhole.moveTo(0.0009, -0.0042);
  keyhole.lineTo(Math.cos(a0) * kr, 0.0016 + Math.sin(a0) * kr);
  keyhole.absarc(0, 0.0016, kr, a0, a1, false);
  keyhole.lineTo(-0.0009, -0.0042);
  keyhole.closePath();
  esc.holes.push(keyhole);
  const escGeo = new THREE.ExtrudeGeometry(esc, {
    depth: 0.0006,
    bevelEnabled: true,
    bevelThickness: 0.0003,
    bevelSize: 0.0004,
    bevelSegments: 1,
    curveSegments: 4,
  });
  escGeo.translate(0, ESC_Y, D / 2 + 0.0003);
  escGeo.clearGroups();
  brassParts.push(escGeo);
  // Key bushing on the right-hand side, where the winding key enters.
  const bushing = xCylinder(0.0046, 0.0012, W / 2 + 0.0006, 14);
  bushing.translate(0, BARREL.y, BARREL.z);
  brassParts.push(bushing);
  group.add(
    new THREE.Mesh(merge(brassParts), brass),
  );
  const holeDark = new THREE.Mesh(
    new THREE.PlaneGeometry(0.0042, 0.0074),
    new THREE.MeshStandardMaterial({ color: 0x080503, roughness: 1 }),
  );
  holeDark.position.set(0, ESC_Y - 0.0005, D / 2 + 0.00025);
  group.add(holeDark);

  // --- Felt-lined well ------------------------------------------------------------------
  const lining: THREE.BufferGeometry[] = [];
  const floor = new THREE.PlaneGeometry(IN_X * 2, IN_Z * 2);
  floor.rotateX(-Math.PI / 2);
  floor.translate(0, BODY_Y0 + 0.0004, 0);
  lining.push(floor);
  const wallH = BODY_Y1 - BODY_Y0 - 0.0006;
  const wallY = BODY_Y0 + wallH / 2;
  for (const [len, rotY, x, z] of [
    [IN_X * 2, 0, 0, -IN_Z + 0.0004],
    [IN_X * 2, Math.PI, 0, IN_Z - 0.0004],
    [IN_Z * 2, Math.PI / 2, -IN_X + 0.0004, 0],
    [IN_Z * 2, -Math.PI / 2, IN_X - 0.0004, 0],
  ] as const) {
    const p = new THREE.PlaneGeometry(len, wallH);
    p.rotateY(rotY);
    p.translate(x, wallY, z);
    lining.push(p);
  }
  // Felt UVs: ~4 cm per tile.
  const feltGeo = merge(lining);
  const fuv = feltGeo.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fuv.getX(i) * 4, fuv.getY(i) * 2);
  group.add(new THREE.Mesh(feltGeo, feltMat));

  // Walnut bead the glass rests on, the glass itself and its little knob.
  group.add(
    new THREE.Mesh(
      ringGeometry([IN_X - 0.0004, IN_Z - 0.0004, 0.001], [IN_X - 0.005, IN_Z - 0.005, 0.0008], GLASS_Y - 0.0035, 0.0035, 5, 1),
      walnut,
    ),
  );
  const glassMat = keepBloomMask(
    new THREE.MeshStandardMaterial({
      // Dark tint: a pale one hazes the movement milky; the highlights
      // from the polished surface are what read as glass.
      color: 0x1c2328,
      transparent: true,
      opacity: 0.14,
      roughness: 0.04,
      metalness: 0,
      depthWrite: false,
    }),
  );
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(IN_X * 2 - 0.0016, IN_Z * 2 - 0.0016), glassMat);
  glass.rotation.x = -Math.PI / 2;
  glass.position.y = GLASS_Y + 0.0004;
  glass.renderOrder = 3;
  glass.userData.noShadow = true;
  glass.name = "musicbox:glass";
  group.add(glass);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.0026, 0.003, 0.0026, 16), brass);
  knob.position.set(0, GLASS_Y + 0.0017, IN_Z - 0.008);
  knob.userData.noShadow = true;
  group.add(knob);

  // --- Movement -------------------------------------------------------------------------------
  const bed = new THREE.Mesh(slabGeometry(0.172, 0.004, 0.098, 0.003, 0.0008), gilt);
  bed.position.set(0, BED_TOP - 0.002, -0.002);
  group.add(bed);
  const cocks: THREE.BufferGeometry[] = [];
  for (const x of [CYL.x - CYL.len / 2 - 0.0062, CYL.x + CYL.len / 2 + 0.0058]) {
    const c = bracketGeometry(0.009, CYL.y + 0.0045 - BED_TOP);
    c.translate(x, BED_TOP, CYL.z);
    cocks.push(c);
  }
  for (const x of [BARREL.x - BARREL.len / 2 - 0.0045, BARREL.x + BARREL.len / 2 + 0.0058]) {
    const c = bracketGeometry(0.01, BARREL.y + 0.005 - BED_TOP);
    c.translate(x, BED_TOP, BARREL.z);
    cocks.push(c);
  }
  // Governor cock: upright post behind the fly with a bridge over its arbor.
  const post = new THREE.BoxGeometry(0.006, GOV.y1 - GOV.y0, 0.0026);
  post.translate(GOV.x, (GOV.y0 + GOV.y1) / 2, GOV.z - 0.012);
  const bridge = new THREE.BoxGeometry(0.0055, 0.0024, 0.0158);
  bridge.translate(GOV.x, GOV.y1 + 0.0004, GOV.z - 0.0068);
  cocks.push(post, bridge);
  // Intermediate wheel between the cylinder and the governor's worm.
  const idler = gearGeometry(gearShape(0.0078, 14, 0.0009), 0.0012);
  idler.translate(GOV.x + 0.0052, GOV.y0 + 0.014, GOV.z - 0.001);
  cocks.push(idler);
  group.add(new THREE.Mesh(merge(cocks), gilt));

  const cylinder = buildCylinder(gilt, steel);
  group.add(cylinder);
  group.add(buildComb(steel, gilt));
  const glint = buildGlint();
  group.add(glint);
  group.add(buildBarrel(gilt, steel));
  const fly = buildFly(gilt, steel);
  group.add(fly);

  const key = buildKey(brass);
  key.position.set(W / 2 + 0.0012, BARREL.y, BARREL.z);
  group.add(key);

  const lid = buildLid(lidTop, walnut, brass);
  group.add(lid);

  group.userData.setQuality = (quality: Quality): void => {
    const coat = quality === "low" ? 0 : 0.4;
    group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const mat = m as THREE.MeshPhysicalMaterial;
        if (!mat.userData?.polish) continue;
        // Crossing zero toggles a shader define (one recompile).
        if ((mat.clearcoat > 0) !== (coat > 0)) mat.needsUpdate = true;
        mat.clearcoat = coat;
      }
    });
  };

  const parts: MusicBoxParts = { lid, cylinder, key, fly, glint };
  group.userData.parts = parts;
  group.userData.itemId = "musicbox";
  group.userData.label = ITEM_LABELS.musicbox.name;
  return group;
}

// --- Runtime --------------------------------------------------------------------------------

/** Cylinder, governor and key turn rates (rad/s) at full speed. */
const CYLINDER_RATE = 0.55;
const FLY_RATE = 26;
const KEY_RATE = 0.4;
/** Seconds to spin up / wind down (smoothstep-eased). */
const SPIN_UP = 1.2;
const SPIN_DOWN = 2.2;
const LID_OPEN_DURATION = 1.1;
const LID_CLOSE_DURATION = 0.7;
/** Peak opacity of the tine glow at level 1. */
const GLINT_MAX = 0.5;

/**
 * Drives a built music box: lid open/close tweens, eased spin-up/down of
 * the cylinder, governor and key, and the music-level glow. update() runs
 * once per rendered frame.
 */
export class MusicBoxController {
  reducedMotion = false;
  private readonly parts: MusicBoxParts;
  /** Spin progress 0..1 (linear); the turn speed is its smoothstep. */
  private spin = 0;
  private playing = false;
  private level = 0;
  private lidTarget = false;
  private lidTween: gsap.core.Tween | null = null;
  private lidPromise: Promise<void> | null = null;
  private lidResolve: (() => void) | null = null;

  constructor(parts: MusicBoxParts) {
    this.parts = parts;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  /** Anything turning (or about to)? */
  get spinning(): boolean {
    return this.playing || this.spin > 0;
  }

  /** The lid is mid-swing (its shadow is changing). */
  get lidMoving(): boolean {
    return this.lidTween !== null;
  }

  /** Lid open or opening. */
  get lidOpen(): boolean {
    return this.lidTarget;
  }

  setPlaying(playing: boolean): void {
    this.playing = playing;
    if (this.reducedMotion) this.spin = playing ? 1 : 0;
  }

  setLevel(level: number): void {
    this.level = Number.isFinite(level) ? THREE.MathUtils.clamp(level, 0, 1) : 0;
  }

  /** Swing the lid open/closed; resolves when it lands (instant under reduced motion). */
  setLidOpen(open: boolean, delay = 0): Promise<void> {
    if (open === this.lidTarget && this.lidPromise) return this.lidPromise;
    if (open === this.lidTarget && !this.lidTween) return Promise.resolve();
    this.lidTarget = open;
    this.lidTween?.kill();
    this.lidTween = null;
    this.finishLid();
    const lid = this.parts.lid;
    const angle = open ? -MUSIC_BOX_LID_OPEN : 0;
    if (this.reducedMotion) {
      lid.rotation.x = angle;
      return Promise.resolve();
    }
    this.lidPromise = new Promise<void>((resolve) => {
      this.lidResolve = resolve;
    });
    const promise = this.lidPromise;
    this.lidTween = gsap.to(lid.rotation, {
      x: angle,
      delay,
      duration: open ? LID_OPEN_DURATION : LID_CLOSE_DURATION,
      ease: open ? "power2.inOut" : "power2.in",
      onComplete: () => {
        this.lidTween = null;
        this.finishLid();
      },
    });
    return promise;
  }

  update(delta: number): void {
    const target = this.playing ? 1 : 0;
    if (this.spin !== target) {
      if (this.reducedMotion) {
        this.spin = target;
      } else {
        const step = delta / (target > this.spin ? SPIN_UP : SPIN_DOWN);
        this.spin = target > this.spin
          ? Math.min(target, this.spin + step)
          : Math.max(target, this.spin - step);
      }
    }
    const s = this.spin * this.spin * (3 - 2 * this.spin);
    const { cylinder, fly, key, glint } = this.parts;
    if (s > 0) {
      cylinder.rotation.x = (cylinder.rotation.x - CYLINDER_RATE * s * delta) % (Math.PI * 2);
      fly.rotation.y = (fly.rotation.y + FLY_RATE * s * delta) % (Math.PI * 2);
      key.rotation.x = (key.rotation.x + KEY_RATE * s * delta) % (Math.PI * 2);
    }
    const opacity = this.level * s * GLINT_MAX;
    glint.visible = opacity > 0.004;
    (glint.material as THREE.MeshBasicMaterial).opacity = opacity;
  }

  dispose(): void {
    this.lidTween?.kill();
    this.lidTween = null;
    this.finishLid();
  }

  private finishLid(): void {
    const resolve = this.lidResolve;
    this.lidResolve = null;
    this.lidPromise = null;
    resolve?.();
  }
}
