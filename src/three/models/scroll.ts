/**
 * Unrolled summoning scroll ~0.40 wide (X) x ~0.28 deep (Z), lying flat.
 * Two wooden rollers with turned finials sit on the sheet's ends, each
 * holding the parchment still wound on it (spiral end grain). Between them
 * the sheet follows a spline: it peels off the underside of each roll,
 * arches, and settles onto the table with a little cockling and curled
 * side edges. Deckled side edges come from an alpha map; rune writing,
 * a ruled diagram and a red wax seal with a ribbon sit on top.
 * Pivot at the table contact plane (y = 0).
 */
import * as THREE from "three";
import { ITEM_LABELS } from "../types";
import { scrollEndMaterial, woodDarkMaterial } from "./materials";
import {
  cachedMaps,
  drawRune,
  fieldToTexture,
  heightToNormalMap,
  makeCanvas,
  mulberry32,
  noiseField,
  toTexture,
} from "./textures";

const ROLL_LEN = 0.3;
const ROD_LEN = 0.36;
const ROLL_Z = 0.095; // rolls sit at z = -ROLL_Z (back) and +ROLL_Z (front)
const R_BACK = 0.028; // back roll is fatter (more parchment left on it)
const R_FRONT = 0.023;
const SHEET_W = 0.296;

// --- Maps -------------------------------------------------------------------------

type SheetMaps = {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  alphaMap: THREE.Texture;
};

/** Written sheet: u across (X), v along the unrolled length (back → front). */
function sheetMaps(): SheetMaps {
  return cachedMaps("scroll:sheet", () => {
    const W = 1024;
    const H = 768;
    const rand = mulberry32(5501);
    const aging = noiseField(W, H, 5502, 5, 4, 5);
    const fibers = noiseField(W, H, 5503, 64, 12, 2);
    const [canvas, ctx] = makeCanvas(W, H);
    const img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const ex = Math.min(x, W - 1 - x) / W;
        const ey = Math.min(y, H - 1 - y) / H;
        const edge = 1 - THREE.MathUtils.smoothstep(Math.min(ex, ey * 1.4), 0, 0.12);
        const a = aging[i]!;
        const f = fibers[i]!;
        const g = 0.94 + (a - 0.5) * 0.2 + (f - 0.5) * 0.06 - edge * 0.2;
        img.data[i * 4] = 234 * g;
        img.data[i * 4 + 1] = 218 * g * (1 - edge * 0.05);
        img.data[i * 4 + 2] = 184 * g * (1 - edge * 0.12);
        img.data[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // Foxing spots
    for (let i = 0; i < 26; i++) {
      const x = rand() * W;
      const y = rand() * H;
      const r = 4 + rand() * 22;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, "rgba(140, 96, 52, 0.16)");
      grad.addColorStop(1, "rgba(140, 96, 52, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // Ink: ruled margin, rune rows, a circled diagram (content-bearing look).
    const ink = (a: number): string => `rgba(58, 36, 20, ${a})`;
    ctx.lineCap = "round";
    ctx.strokeStyle = ink(0.35);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W * 0.08, H * 0.1);
    ctx.lineTo(W * 0.08, H * 0.9);
    ctx.stroke();
    // Title line, bigger glyphs
    ctx.strokeStyle = ink(0.8);
    ctx.lineWidth = 4.5;
    let x = W * 0.16;
    while (x < W * 0.84) {
      drawRune(ctx, x, H * 0.14, 38 + rand() * 8, rand);
      x += 44 + rand() * 12;
    }
    ctx.lineWidth = 3;
    const rows = 9;
    for (let r = 0; r < rows; r++) {
      const y = H * 0.25 + r * (H * 0.62) / (rows - 1) + (rand() - 0.5) * 6;
      x = W * 0.12 + rand() * 20;
      const end = r >= 5 && r <= 7 ? W * 0.55 : W * 0.9;
      while (x < end) {
        ctx.strokeStyle = ink(0.55 + rand() * 0.3);
        drawRune(ctx, x, y, 22 + rand() * 10, rand);
        x += 26 + rand() * 20;
        if (rand() > 0.85) x += 26;
      }
    }
    // Circled diagram beside the shorter rows
    const cx = W * 0.75;
    const cy = H * 0.74;
    ctx.strokeStyle = ink(0.6);
    ctx.lineWidth = 3.5;
    for (const r of [78, 60]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let k = 0; k <= 5; k++) {
      const a = -Math.PI / 2 + (k * 4 * Math.PI) / 5;
      const px = cx + Math.cos(a) * 58;
      const py = cy + Math.sin(a) * 58;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      drawRune(ctx, cx + Math.cos(a) * 69, cy + Math.sin(a) * 69, 12, rand);
    }
    // An ink blot and a quill flick
    ctx.fillStyle = ink(0.7);
    ctx.beginPath();
    ctx.ellipse(W * 0.22, H * 0.83, 9, 6, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Height for normal map: fibres + ink sits slightly proud + cockles
    const lum = ctx.getImageData(0, 0, W, H).data;
    const height = new Float32Array(W * H);
    const rough = new Float32Array(W * H);
    const alpha = new Float32Array(W * H);
    const deckle = noiseField(W, H, 5504, 2, 40, 3);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const dark = 1 - lum[i * 4]! / 234;
        const isInk = THREE.MathUtils.smoothstep(dark, 0.3, 0.55);
        height[i] = fibers[i]! * 0.35 + aging[i]! * 0.5 + isInk * 0.12;
        rough[i] = 0.88 - isInk * 0.28 + (aging[i]! - 0.5) * 0.1;
        // Deckled side edges (u = 0 / 1): torn, fibrous outline.
        const ex = Math.min(x, W - 1 - x) / W;
        const tear = 0.006 + deckle[i]! * 0.022;
        alpha[i] = ex > tear ? 1 : 0;
      }
    }
    const map = toTexture(canvas);
    map.anisotropy = 8;
    const normalMap = heightToNormalMap(height, W, H, 2.5, false);
    const roughnessMap = fieldToTexture(rough, W, H);
    const alphaMap = fieldToTexture(alpha, W, H);
    for (const t of [map, normalMap, roughnessMap, alphaMap]) {
      t.wrapS = THREE.ClampToEdgeWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
    }
    return { map, normalMap, roughnessMap, alphaMap };
  });
}

/** Plain parchment (outer winding of the rolls), u around, v along. */
function rollMaps(): { map: THREE.Texture; normalMap: THREE.Texture } {
  return cachedMaps("scroll:roll", () => {
    const W = 512;
    const H = 256;
    const n = noiseField(W, H, 5601, 4, 3, 5);
    const fib = noiseField(W, H, 5602, 6, 48, 2);
    const [canvas, ctx] = makeCanvas(W, H);
    const img = ctx.createImageData(W, H);
    const h = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const y = Math.floor(i / W);
      const ey = Math.min(y, H - 1 - y) / H;
      const edge = 1 - THREE.MathUtils.smoothstep(ey, 0, 0.08);
      const g = 0.9 + (n[i]! - 0.5) * 0.16 - edge * 0.1;
      img.data[i * 4] = 230 * g;
      img.data[i * 4 + 1] = 212 * g;
      img.data[i * 4 + 2] = 176 * g;
      img.data[i * 4 + 3] = 255;
      h[i] = fib[i]! * 0.5 + n[i]! * 0.5;
    }
    ctx.putImageData(img, 0, 0);
    return { map: toTexture(canvas), normalMap: heightToNormalMap(h, W, H, 2) };
  });
}

/** Wax seal stamp: raised ring, star and rim irregularity as a height map. */
function sealMaps(): { normalMap: THREE.Texture } {
  return cachedMaps("scroll:seal", () => {
    const S = 256;
    const [, ctx] = makeCanvas(S, S);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, S, S);
    const c = S / 2;
    // Imprint is pressed in: draw the design white, invert below.
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(c, c, S * 0.36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let k = 0; k <= 7; k++) {
      const a = -Math.PI / 2 + (k * 6 * Math.PI) / 7;
      const px = c + Math.cos(a) * S * 0.27;
      const py = c + Math.sin(a) * S * 0.27;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c, c, S * 0.05, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.filter = "blur(2px)";
    ctx.drawImage(ctx.canvas, 0, 0);
    ctx.filter = "none";
    const data = ctx.getImageData(0, 0, S, S).data;
    const h = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) h[i] = -data[i * 4]! / 255;
    return { normalMap: heightToNormalMap(h, S, S, 5, false) };
  });
}

/** Start-up warm-up hook: paint every scroll map now (cached). */
export function scrollMaps(): void {
  sheetMaps();
  rollMaps();
  sealMaps();
}

// --- Geometry -----------------------------------------------------------------------

/**
 * Sheet cross-section (z, y) as a spline: peels off the back roll's
 * underside, arches onto the table, lies flat, and climbs into the front
 * roll the same way.
 */
function sheetCurve(): THREE.CatmullRomCurve3 {
  const leave = (z: number, r: number, side: 1 | -1): THREE.Vector3 => {
    // Point on the roll's lower front quadrant (side = toward the middle).
    const a = 0.85; // radians from straight down
    return new THREE.Vector3(0, r - r * Math.cos(a), z + side * r * Math.sin(a));
  };
  // Start/end well inside the roll so the hidden part never coincides with
  // (and z-fights) the roll's surface.
  const inside = (z: number, r: number, side: 1 | -1): THREE.Vector3 =>
    new THREE.Vector3(0, r * 0.55, z + side * r * 0.25);
  const pts = [
    inside(-ROLL_Z, R_BACK, 1),
    leave(-ROLL_Z, R_BACK, 1),
    new THREE.Vector3(0, 0.0105, -ROLL_Z + R_BACK + 0.012),
    new THREE.Vector3(0, 0.0032, -ROLL_Z + R_BACK + 0.04),
    new THREE.Vector3(0, 0.0009, -0.012),
    new THREE.Vector3(0, 0.0016, 0.022),
    new THREE.Vector3(0, 0.0034, ROLL_Z - R_FRONT - 0.034),
    new THREE.Vector3(0, 0.009, ROLL_Z - R_FRONT - 0.01),
    leave(ROLL_Z, R_FRONT, -1),
    inside(ROLL_Z, R_FRONT, -1),
  ];
  return new THREE.CatmullRomCurve3(pts, false, "centripetal");
}

function buildSheetGeometry(): { geo: THREE.BufferGeometry; heightAt: (x: number, z: number) => number } {
  const curve = sheetCurve();
  const ALONG = 44;
  const ACROSS = 14;
  const samples = curve.getSpacedPoints(ALONG);
  // The centripetal spline can dip a hair under the flat stretch: never
  // let the sheet sink into the tabletop (or under the contact-shadow
  // quad SceneManager lays 1.2 mm above it).
  for (const p of samples) p.y = Math.max(p.y, 0.0019);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const lift = (x: number, t: number, p: THREE.Vector3): number => {
    const xn = Math.abs(x) / (SHEET_W / 2);
    // Edge curl fades out where the sheet meets the rolls.
    const middle = Math.sin(Math.PI * t) ** 1.5;
    const curl = 0.0055 * xn ** 4 * middle;
    const cockle = 0.0011 * Math.sin(x * 31 + p.z * 23) * Math.sin(x * 11 - p.z * 17 + 0.6) * middle;
    return curl + cockle;
  };
  for (let i = 0; i <= ALONG; i++) {
    const t = i / ALONG;
    const p = samples[i]!;
    for (let j = 0; j <= ACROSS; j++) {
      const u = j / ACROSS;
      const x = (u - 0.5) * SHEET_W;
      positions.push(x, p.y + lift(x, t, p), p.z);
      uvs.push(u, 1 - t);
    }
  }
  const cols = ACROSS + 1;
  for (let i = 0; i < ALONG; i++) {
    for (let j = 0; j < ACROSS; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const d = a + cols;
      const c = d + 1;
      // Top face up (+Y): t increases toward +Z, u toward +X.
      indices.push(a, d, b, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  // Surface height lookup for placing the seal on the flat stretch.
  const heightAt = (x: number, z: number): number => {
    let best = samples[0]!;
    let bi = 0;
    for (let i = 0; i < samples.length; i++) {
      if (Math.abs(samples[i]!.z - z) < Math.abs(best.z - z)) {
        best = samples[i]!;
        bi = i;
      }
    }
    return best.y + lift(x, bi / ALONG, best);
  };
  return { geo, heightAt };
}

/** One roller: rod + turned finials + the parchment still wound on it. */
function makeRoll(radius: number, z: number): THREE.Group {
  const roll = new THREE.Group();
  const wood = woodDarkMaterial().clone();
  wood.roughness = 0.55; // turned and handled: a soft sheen

  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0068, 0.0068, ROD_LEN, 10).rotateZ(-Math.PI / 2),
    wood,
  );
  roll.add(rod);

  // Turned finial: collar, cove, bead, bulb, pointed knop
  const finialProfile = [
    [0.0001, 0.0],
    [0.0092, 0.0],
    [0.0098, 0.0022],
    [0.0082, 0.0042],
    [0.0062, 0.0058],
    [0.0068, 0.0078],
    [0.0094, 0.0102],
    [0.0104, 0.0128],
    [0.0094, 0.0158],
    [0.0066, 0.0182],
    [0.0052, 0.0198],
    [0.0058, 0.0212],
    [0.0038, 0.0232],
    [0.0012, 0.0252],
    [0.0001, 0.0258],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  for (const sx of [-1, 1] as const) {
    const finial = new THREE.Mesh(
      new THREE.LatheGeometry(finialProfile, 14).rotateZ((-sx * Math.PI) / 2),
      wood,
    );
    finial.position.x = sx * (ROD_LEN / 2);
    roll.add(finial);
  }

  // Parchment wound around the rod; flat ends show the spiral cross-section
  const maps = rollMaps();
  const paper = new THREE.MeshStandardMaterial({
    map: maps.map,
    normalMap: maps.normalMap,
    normalScale: new THREE.Vector2(0.15, 0.15),
    roughness: 0.88,
    metalness: 0,
  });
  const rollGeo = new THREE.CylinderGeometry(radius, radius, ROLL_LEN, 28, 1).rotateZ(
    -Math.PI / 2,
  );
  roll.add(new THREE.Mesh(rollGeo, [paper, scrollEndMaterial(), scrollEndMaterial()]));

  roll.position.set(0, radius, z); // rest the roll on the table
  return roll;
}

/** Irregular wax blob with the stamped design on top, plus ribbon tails. */
function makeSeal(): THREE.Group {
  const seal = new THREE.Group();
  const rand = mulberry32(5701);
  const shape = new THREE.Shape();
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = 0.0155 * (1 + (rand() - 0.5) * 0.14 + 0.05 * Math.sin(a * 3 + 1));
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0012,
    bevelEnabled: true,
    bevelThickness: 0.0022,
    bevelSize: 0.0028,
    bevelSegments: 3,
    curveSegments: 1,
  });
  geo.rotateX(-Math.PI / 2); // extrusion → +Y
  geo.translate(0, 0.0022, 0);
  // Planar UVs over the stamp face
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, 0.5 + pos.getX(i) / 0.034, 0.5 - pos.getZ(i) / 0.034);
  }
  const wax = new THREE.MeshStandardMaterial({
    color: 0x9c2418,
    roughness: 0.34,
    metalness: 0,
    normalMap: sealMaps().normalMap,
  });
  seal.add(new THREE.Mesh(geo, wax));

  // Two ribbon tails escaping from under the wax
  const ribbon = new THREE.MeshStandardMaterial({
    color: 0x5e1a1e,
    roughness: 0.7,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  for (const [a, len] of [
    [2.3, 0.045],
    [2.75, 0.038],
  ] as Array<[number, number]>) {
    const tail = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.007).rotateX(-Math.PI / 2), ribbon);
    tail.geometry.translate(len / 2, 0, 0);
    tail.rotation.y = a;
    tail.position.y = 0.0006;
    seal.add(tail);
  }
  return seal;
}

export function buildScroll(): THREE.Group {
  const group = new THREE.Group();
  group.name = "scroll";

  group.add(makeRoll(R_BACK, -ROLL_Z));
  group.add(makeRoll(R_FRONT, ROLL_Z));

  const { geo, heightAt } = buildSheetGeometry();
  const maps = sheetMaps();
  const sheet = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      map: maps.map,
      normalMap: maps.normalMap,
      normalScale: new THREE.Vector2(0.5, 0.5),
      roughnessMap: maps.roughnessMap,
      roughness: 1,
      metalness: 0,
      alphaMap: maps.alphaMap,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    }),
  );
  group.add(sheet);

  const seal = makeSeal();
  const sealX = 0.075;
  const sealZ = 0.045;
  seal.position.set(sealX, heightAt(sealX, sealZ), sealZ);
  seal.rotation.y = 0.3;
  group.add(seal);

  group.userData.itemId = "scroll";
  group.userData.label = ITEM_LABELS.scroll.name;
  return group;
}
