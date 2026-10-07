/**
 * Coopered wooden tankard ~0.16 high: 14 individual staves (beveled
 * seams, slight taper, per-stave tint and height jitter), two riveted iron
 * hoops, a strapped wooden handle and a domed foam head spilling one drip
 * over the rim (opposite the handle). Pivot at y = 0.
 */
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ITEM_LABELS } from "../types";
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

const HEIGHT = 0.16;
const R_BOTTOM = 0.058;
const R_TOP = 0.052;
const WALL = 0.0062;
const STAVES = 14;

/** Outer radius of the (tapered) body at height y. */
function outerRadius(y: number): number {
  return THREE.MathUtils.lerp(R_BOTTOM, R_TOP, y / HEIGHT);
}

// --- Maps -----------------------------------------------------------------------------

/** Vertical-grain oak: v runs up the stave. */
function staveMaps(): PbrMaps {
  return cachedMaps("tankard:stave", () => {
    const S = 512;
    const grain = noiseField(S, S, 6601, 12, 2, 3); // many cells across, few along
    const fine = noiseField(S, S, 6602, 90, 4, 2);
    const blot = noiseField(S, S, 6603, 4, 4, 4);
    const [canvas, ctx] = makeCanvas(S, S);
    const img = ctx.createImageData(S, S);
    const h = new Float32Array(S * S);
    const rough = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) {
      const g = grain[i]!;
      const f = fine[i]!;
      const b = blot[i]!;
      // Early/late wood rings as sharpened bands of the grain field.
      const ring = Math.abs(Math.sin(g * 9)) ** 4;
      const tone = 0.8 + (b - 0.5) * 0.25 - ring * 0.16 + (f - 0.5) * 0.06;
      img.data[i * 4] = 150 * tone;
      img.data[i * 4 + 1] = 102 * tone;
      img.data[i * 4 + 2] = 62 * tone;
      img.data[i * 4 + 3] = 255;
      h[i] = -ring * 0.5 + f * 0.15;
      rough[i] = 0.72 + ring * 0.12 - (b - 0.5) * 0.1;
    }
    ctx.putImageData(img, 0, 0);
    return {
      map: toTexture(canvas),
      normalMap: heightToNormalMap(h, S, S, 2),
      roughnessMap: fieldToTexture(rough, S, S),
    };
  });
}

/** Hammered, darkened iron for the hoops, rivets and straps. */
function ironMaps(): PbrMaps {
  return cachedMaps("tankard:iron", () => {
    const S = 256;
    const n = noiseField(S, S, 6701, 8, 8, 4);
    const dents = noiseField(S, S, 6702, 18, 18, 2);
    const rust = noiseField(S, S, 6703, 6, 6, 5);
    const [canvas, ctx] = makeCanvas(S, S);
    const img = ctx.createImageData(S, S);
    const h = new Float32Array(S * S);
    const rough = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) {
      const r = Math.max(0, rust[i]! - 0.6) * 2.2;
      const g = 0.62 + (n[i]! - 0.5) * 0.3;
      img.data[i * 4] = (95 + r * 60) * g;
      img.data[i * 4 + 1] = (92 + r * 18) * g;
      img.data[i * 4 + 2] = (90 - r * 20) * g;
      img.data[i * 4 + 3] = 255;
      h[i] = dents[i]! * 0.7 + n[i]! * 0.3;
      rough[i] = 0.45 + r * 0.4 + (n[i]! - 0.5) * 0.15;
    }
    ctx.putImageData(img, 0, 0);
    return {
      map: toTexture(canvas),
      normalMap: heightToNormalMap(h, S, S, 2),
      roughnessMap: fieldToTexture(rough, S, S),
    };
  });
}

/** Foam: clustered bubbles as a height field. */
function foamMaps(): { map: THREE.Texture; normalMap: THREE.Texture } {
  return cachedMaps("tankard:foam", () => {
    const S = 256;
    const rand = mulberry32(6801);
    const [, ctx] = makeCanvas(S, S);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 520; i++) {
      const x = rand() * S;
      const y = rand() * S;
      const r = 1.5 + rand() ** 2 * 9;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(255,255,255,0.9)");
      g.addColorStop(0.75, "rgba(255,255,255,0.55)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      // Wrap so the map tiles
      for (const dx of [-S, 0, S]) {
        for (const dy of [-S, 0, S]) {
          ctx.fillRect(x - r + dx, y - r + dy, r * 2, r * 2);
        }
      }
    }
    const data = ctx.getImageData(0, 0, S, S).data;
    const h = new Float32Array(S * S);
    const [colorCanvas, cctx] = makeCanvas(S, S);
    const img = cctx.createImageData(S, S);
    for (let i = 0; i < S * S; i++) {
      const v = data[i * 4]! / 255;
      h[i] = v;
      const tone = 0.86 + v * 0.14;
      img.data[i * 4] = 246 * tone;
      img.data[i * 4 + 1] = 236 * tone;
      img.data[i * 4 + 2] = 212 * tone;
      img.data[i * 4 + 3] = 255;
    }
    cctx.putImageData(img, 0, 0);
    return { map: toTexture(colorCanvas), normalMap: heightToNormalMap(h, S, S, 4) };
  });
}

/** Start-up warm-up hook: paint every tankard map now (cached). */
export function tankardMaps(): void {
  staveMaps();
  ironMaps();
  foamMaps();
}

// --- Geometry ---------------------------------------------------------------------------

/** All staves merged into one geometry; vertex colours carry the per-stave tint. */
function buildStaves(): THREE.BufferGeometry {
  const rand = mulberry32(6901);
  const step = (Math.PI * 2) / STAVES;
  const gap = 0.009; // radians between neighbouring staves
  const bevel = 0.0015;
  const pieces: THREE.BufferGeometry[] = [];
  for (let k = 0; k < STAVES; k++) {
    const a0 = k * step + gap / 2;
    const a1 = (k + 1) * step - gap / 2;
    const ro = R_BOTTOM - bevel;
    const ri = R_BOTTOM - WALL + bevel;
    const shape = new THREE.Shape();
    shape.moveTo(Math.cos(a0) * ri, Math.sin(a0) * ri);
    shape.lineTo(Math.cos(a0) * ro, Math.sin(a0) * ro);
    shape.absarc(0, 0, ro, a0, a1, false);
    shape.lineTo(Math.cos(a1) * ri, Math.sin(a1) * ri);
    shape.absarc(0, 0, ri, a1, a0, true);
    const height = HEIGHT - 2 * bevel + (rand() - 0.5) * 0.003;
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 1,
      curveSegments: 3,
    });
    geo.rotateX(-Math.PI / 2); // extrusion → +Y (shape y → −z)
    geo.translate(0, bevel, 0);
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const count = pos.count;
    const uv = new Float32Array(count * 2);
    const colors = new Float32Array(count * 3);
    const tint = 0.82 + rand() * 0.3;
    const warm = (rand() - 0.5) * 0.08;
    const uOffset = rand();
    for (let i = 0; i < count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const r = Math.hypot(x, z);
      // Taper: scale the ring toward the rim
      const f = outerRadius(y) / R_BOTTOM;
      pos.setXYZ(i, x * f, y, z * f);
      let a = Math.atan2(-z, x) - a0;
      if (a < -Math.PI) a += Math.PI * 2;
      uv[i * 2] = uOffset + (a / step) * 0.3;
      uv[i * 2 + 1] = y / HEIGHT;
      // Inside of the wall reads darker (stained, in shadow).
      const inner = r < R_BOTTOM - WALL * 0.5 ? 0.42 : 1;
      colors[i * 3] = tint * (1 + warm) * inner;
      colors[i * 3 + 1] = tint * inner;
      colors[i * 3 + 2] = tint * (1 - warm) * inner;
    }
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.deleteAttribute("normal");
    // Weld so the curved faces shade smoothly (the bevel keeps the edges).
    const welded = mergeVertices(geo, 1e-6);
    welded.computeVertexNormals();
    pieces.push(welded);
  }
  return mergeGeometries(pieces)!;
}

/** Conical iron hoop hugging the tapered body between y0 and y1. */
function hoopGeometry(y0: number, y1: number): THREE.BufferGeometry {
  const t = 0.0021;
  const pts: Array<[number, number]> = [
    [outerRadius(y0) - 0.0004, y0],
    [outerRadius(y0) + t * 0.8, y0 + 0.0006],
    [outerRadius(y0 + 0.002) + t, y0 + 0.002],
    [outerRadius(y1 - 0.002) + t, y1 - 0.002],
    [outerRadius(y1) + t * 0.8, y1 - 0.0006],
    [outerRadius(y1) - 0.0004, y1],
  ];
  return new THREE.LatheGeometry(
    pts.map(([r, y]) => new THREE.Vector2(r, y)),
    40,
  );
}

/** Rivet heads around a hoop, merged. */
function rivets(yMid: number, count: number, skipAngle: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.2;
    // Leave the handle's strap alone
    const d = Math.atan2(Math.sin(a - skipAngle), Math.cos(a - skipAngle));
    if (Math.abs(d) < 0.35) continue;
    const r = outerRadius(yMid) + 0.0019;
    const head = new THREE.SphereGeometry(0.0021, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    head.scale(1, 0.6, 1);
    head.rotateZ(-Math.PI / 2); // dome faces +X
    head.rotateY(-a);
    head.translate(Math.cos(a) * r, yMid, Math.sin(a) * r);
    parts.push(head);
  }
  return mergeGeometries(parts)!;
}

/** Foam head: domed lathe with soft noise displacement and a rolled lip. */
function foamGeometry(): THREE.BufferGeometry {
  const rimR = R_TOP - WALL * 0.6;
  const top = HEIGHT;
  const profile: Array<[number, number]> = [
    [0.0001, top + 0.0125],
    [0.012, top + 0.0118],
    [0.024, top + 0.0098],
    [0.034, top + 0.0072],
    [0.041, top + 0.0052],
    [rimR, top + 0.0032],
    [R_TOP + 0.0006, top + 0.0012],
    [R_TOP + 0.0016, top - 0.0016],
    [R_TOP + 0.0004, top - 0.004],
  ];
  const geo = new THREE.LatheGeometry(
    profile.reverse().map(([r, y]) => new THREE.Vector2(r, y)),
    40,
  );
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const r = Math.hypot(x, z);
    const bump =
      0.0018 * Math.sin(a * 5 + r * 90) * Math.sin(a * 3 - 1.3 + r * 40) +
      0.0012 * Math.sin(a * 11 + 2.1) * Math.cos(r * 160);
    const onTop = y > top ? 1 : 0.4;
    pos.setY(i, y + bump * onTop);
    const grow = 1 + (y > top - 0.002 ? 0.012 * Math.sin(a * 4 + 0.7) : 0);
    pos.setX(i, x * grow);
    pos.setZ(i, z * grow);
  }
  geo.computeVertexNormals();
  return geo;
}

export function buildTankard(): THREE.Group {
  const group = new THREE.Group();
  group.name = "tankard";

  const stave = staveMaps();
  const wood = new THREE.MeshStandardMaterial({
    map: stave.map,
    normalMap: stave.normalMap,
    roughnessMap: stave.roughnessMap,
    roughness: 1,
    metalness: 0,
    vertexColors: true,
  });
  const ironTex = ironMaps();
  const iron = new THREE.MeshStandardMaterial({
    map: ironTex.map,
    normalMap: ironTex.normalMap,
    roughnessMap: ironTex.roughnessMap,
    roughness: 1,
    metalness: 0.65,
    color: 0xb8b4ac,
  });

  // --- Staves + bottom ---------------------------------------------------------
  group.add(new THREE.Mesh(buildStaves(), wood));
  const bottom = new THREE.Mesh(
    new THREE.CylinderGeometry(R_BOTTOM - WALL + 0.0005, R_BOTTOM - WALL + 0.0005, 0.012, 24),
    new THREE.MeshStandardMaterial({ color: 0x3b2618, roughness: 0.95 }),
  );
  bottom.position.y = 0.008;
  group.add(bottom);

  // --- Iron hoops with rivets ---------------------------------------------------
  const HANDLE_ANGLE = 0; // handle on +X
  for (const [y0, y1, n] of [
    [0.014, 0.03, 10],
    [0.128, 0.143, 10],
  ] as Array<[number, number, number]>) {
    group.add(new THREE.Mesh(hoopGeometry(y0, y1), iron));
    group.add(new THREE.Mesh(rivets((y0 + y1) / 2, n, HANDLE_ANGLE), iron));
  }

  // --- Handle: a bent wooden strap, iron-strapped to both hoops -------------------
  const handlePath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(outerRadius(0.135) - 0.002, 0.135, 0),
    new THREE.Vector3(outerRadius(0.13) + 0.024, 0.136, 0),
    new THREE.Vector3(outerRadius(0.11) + 0.04, 0.115, 0),
    new THREE.Vector3(outerRadius(0.07) + 0.043, 0.075, 0),
    new THREE.Vector3(outerRadius(0.045) + 0.032, 0.04, 0),
    new THREE.Vector3(outerRadius(0.03) + 0.008, 0.024, 0),
    new THREE.Vector3(outerRadius(0.024) - 0.002, 0.022, 0),
  ]);
  const handleShape = new THREE.Shape();
  const hw = 0.0085; // half width (Z)
  const ht = 0.0048; // half thickness
  const rr = 0.0028;
  handleShape.moveTo(-ht + rr, -hw);
  handleShape.lineTo(ht - rr, -hw);
  handleShape.quadraticCurveTo(ht, -hw, ht, -hw + rr);
  handleShape.lineTo(ht, hw - rr);
  handleShape.quadraticCurveTo(ht, hw, ht - rr, hw);
  handleShape.lineTo(-ht + rr, hw);
  handleShape.quadraticCurveTo(-ht, hw, -ht, hw - rr);
  handleShape.lineTo(-ht, -hw + rr);
  handleShape.quadraticCurveTo(-ht, -hw, -ht + rr, -hw);
  const handleGeo = new THREE.ExtrudeGeometry(handleShape, {
    steps: 28,
    bevelEnabled: false,
    extrudePath: handlePath,
    curveSegments: 2,
  });
  // Grain along the handle
  const hpos = handleGeo.getAttribute("position") as THREE.BufferAttribute;
  const huv = handleGeo.getAttribute("uv") as THREE.BufferAttribute;
  const hcol = new Float32Array(hpos.count * 3).fill(0.9);
  for (let i = 0; i < hpos.count; i++) {
    huv.setXY(i, hpos.getZ(i) * 30 + 0.3, (hpos.getY(i) + hpos.getX(i)) * 6);
  }
  handleGeo.setAttribute("color", new THREE.BufferAttribute(hcol, 3));
  group.add(new THREE.Mesh(handleGeo, wood));
  // Iron straps where the handle meets the body
  for (const y of [0.1355, 0.022]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.006, 0.021), iron);
    strap.position.set(outerRadius(y) + 0.007, y, 0);
    group.add(strap);
  }

  // --- Foam head + one drip over the rim (opposite the handle) ---------------------
  const foamTex = foamMaps();
  const foam = new THREE.MeshStandardMaterial({
    map: foamTex.map,
    normalMap: foamTex.normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughness: 0.92,
    metalness: 0,
  });
  foamTex.map.repeat.set(3, 1);
  foamTex.normalMap.repeat.set(3, 1);
  group.add(new THREE.Mesh(foamGeometry(), foam));
  const dripA = Math.PI + 0.45;
  const dripCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(Math.cos(dripA) * (R_TOP + 0.001), HEIGHT, Math.sin(dripA) * (R_TOP + 0.001)),
    new THREE.Vector3(Math.cos(dripA) * (R_TOP + 0.0022), HEIGHT - 0.01, Math.sin(dripA) * (R_TOP + 0.0022)),
    new THREE.Vector3(Math.cos(dripA) * (outerRadius(HEIGHT - 0.026) + 0.0024), HEIGHT - 0.026, Math.sin(dripA) * (outerRadius(HEIGHT - 0.026) + 0.0024)),
  ]);
  const drip = new THREE.Mesh(new THREE.TubeGeometry(dripCurve, 10, 0.0032, 7), foam);
  group.add(drip);
  const droplet = new THREE.Mesh(new THREE.SphereGeometry(0.0042, 9, 7), foam);
  droplet.scale.set(1, 1.25, 1);
  droplet.position.copy(dripCurve.getPoint(1));
  droplet.position.y -= 0.002;
  group.add(droplet);

  group.userData.itemId = "tankard";
  group.userData.label = ITEM_LABELS.tankard.name;
  return group;
}
