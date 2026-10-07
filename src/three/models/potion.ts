/**
 * Cluster of 3 potion bottles — a round flask (teal), a tall vial
 * (crimson) and a square shouldered bottle (amber) — with emissive
 * liquids, corks, wax seals / twine and hand-inked paper labels.
 * Single interactable root, itemId "potion"; its three children are the
 * bottles (SceneManager builds one dice collider per child).
 * Pivot at the table contact plane (y = 0).
 *
 * Glass is a MeshPhysicalMaterial. Where the quality allows it
 * (userData.setQuality, driven by SceneManager) it uses real transmission
 * (refraction through an IOR 1.5 shell, opaque pass); otherwise it falls
 * back to a cheap transparent shell that keeps the bloom mask (see
 * keepBloomMask) and draws back faces first.
 */
import * as THREE from "three";
import { ITEM_LABELS, type Quality } from "../types";
import { keepBloomMask, liquidMaterial, sealWaxMaterial } from "./materials";
import {
  cachedMaps,
  cachedTexture,
  fieldToTexture,
  heightToNormalMap,
  makeCanvas,
  mulberry32,
  noiseField,
  toTexture,
} from "./textures";

type Profile = Array<[number, number]>;

/**
 * Surface of revolution with an optional squared cross-section:
 * exponent(y) = 2 is round, larger values approach a rounded square
 * (superellipse). Seam normals are averaged so the lathe has no crease.
 */
function revolve(
  profile: Profile,
  segments: number,
  exponent: (y: number) => number = () => 2,
): THREE.BufferGeometry {
  const rows = profile.length;
  const cols = segments + 1;
  const positions = new Float32Array(rows * cols * 3);
  const uvs = new Float32Array(rows * cols * 2);
  // v by arc length along the profile
  const lengths = [0];
  for (let i = 1; i < rows; i++) {
    const [r0, y0] = profile[i - 1]!;
    const [r1, y1] = profile[i]!;
    lengths.push(lengths[i - 1]! + Math.hypot(r1 - r0, y1 - y0));
  }
  const total = lengths[rows - 1]! || 1;
  for (let i = 0; i < rows; i++) {
    const [r, y] = profile[i]!;
    const p = exponent(y);
    for (let j = 0; j < cols; j++) {
      const a = (j / segments) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const k = (Math.abs(c) ** p + Math.abs(s) ** p) ** (-1 / p);
      const o = (i * cols + j) * 3;
      positions[o] = r * k * c;
      positions[o + 1] = y;
      positions[o + 2] = r * k * s;
      uvs[(i * cols + j) * 2] = j / segments;
      uvs[(i * cols + j) * 2 + 1] = lengths[i]! / total;
    }
  }
  const indices: number[] = [];
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const d = a + cols;
      const c = d + 1;
      indices.push(a, d, c, a, c, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const normal = geo.getAttribute("normal") as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < rows; i++) {
    const first = i * cols;
    const last = first + segments;
    v.set(
      normal.getX(first) + normal.getX(last),
      normal.getY(first) + normal.getY(last),
      normal.getZ(first) + normal.getZ(last),
    ).normalize();
    normal.setXYZ(first, v.x, v.y, v.z);
    normal.setXYZ(last, v.x, v.y, v.z);
  }
  return geo;
}

/** Radius of a profile at height y (first rising run only). */
function radiusAt(profile: Profile, y: number): number {
  for (let i = 1; i < profile.length; i++) {
    const [r0, y0] = profile[i - 1]!;
    const [r1, y1] = profile[i]!;
    if (y >= Math.min(y0, y1) && y <= Math.max(y0, y1) && y1 !== y0) {
      return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
    }
  }
  return profile[profile.length - 1]![0];
}

/**
 * Liquid body following the glass' inner wall up to `fill`, topped with a
 * meniscus that climbs the wall.
 */
function liquidProfile(glass: Profile, floor: number, fill: number, wall = 0.0028): Profile {
  const out: Profile = [[0.0001, floor]];
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const y = floor + ((fill - floor) * i) / steps;
    out.push([Math.max(0.002, radiusAt(glass, y) - wall), y]);
  }
  const rTop = Math.max(0.002, radiusAt(glass, fill) - wall);
  out.push([rTop, fill + 0.0024]);
  out.push([rTop * 0.9, fill + 0.0009]);
  out.push([rTop * 0.6, fill + 0.0002]);
  out.push([0.0001, fill]);
  return out;
}

// --- Materials & maps ---------------------------------------------------------

/** Faint smudges/fingerprints so the glass highlights aren't perfectly clean. */
function glassRoughnessMap(): THREE.Texture {
  return cachedTexture("potion:glassRough", () => {
    const S = 256;
    const n = noiseField(S, S, 4401, 5, 5, 4);
    const f = new Float32Array(S * S);
    for (let i = 0; i < f.length; i++) f[i] = Math.max(0, n[i]! - 0.55) * 0.5;
    return fieldToTexture(f, S, S);
  });
}

function makeGlass(tint: number): THREE.MeshPhysicalMaterial {
  // Clear, thin-walled glass: no volume (thickness/attenuation) and next to
  // no blur — any of those pulled the refracted room toward a muddy brown
  // in the dim candle light.
  const glass = new THREE.MeshPhysicalMaterial({
    color: tint,
    metalness: 0,
    roughness: 0.12,
    roughnessMap: glassRoughnessMap(),
    ior: 1.5,
    thickness: 0,
    specularIntensity: 1,
  });
  glass.userData.glass = true;
  glass.userData.tint = tint;
  setGlassMode(glass, true);
  return glass;
}

/** Switch a glass material between real transmission and the cheap shell. */
function setGlassMode(glass: THREE.MeshPhysicalMaterial, transmission: boolean): void {
  const tint = new THREE.Color(glass.userData.tint as number);
  if (transmission) {
    glass.color.copy(tint);
    glass.transmission = 1;
    glass.transparent = false;
    glass.opacity = 1;
    glass.depthWrite = true;
    glass.side = THREE.FrontSide;
    glass.blending = THREE.NormalBlending;
  } else {
    glass.transmission = 0;
    keepBloomMask(glass);
    glass.transparent = true;
    // A dim body colour + low opacity: the shell darkens what's behind it
    // a little (like real glass) instead of washing it milky; the specular
    // highlights carry the "glass" read.
    glass.color.copy(tint).multiplyScalar(0.25);
    glass.opacity = 0.16;
    glass.depthWrite = false;
    // Transparent + double-sided: three draws the back faces first.
    glass.side = THREE.DoubleSide;
  }
  glass.needsUpdate = true;
}

function corkMaps(): { map: THREE.Texture; normalMap: THREE.Texture } {
  return cachedMaps("potion:cork", () => {
    const S = 256;
    const base = noiseField(S, S, 4501, 10, 10, 3);
    const pores = noiseField(S, S, 4502, 48, 48, 2);
    const [canvas, ctx] = makeCanvas(S, S);
    const img = ctx.createImageData(S, S);
    const h = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) {
      const b = base[i]!;
      const pore = Math.max(0, pores[i]! - 0.6) * 3;
      const g = 0.75 + (b - 0.5) * 0.35 - pore * 0.45;
      img.data[i * 4] = 176 * g;
      img.data[i * 4 + 1] = 132 * g;
      img.data[i * 4 + 2] = 88 * g;
      img.data[i * 4 + 3] = 255;
      h[i] = b * 0.3 - pore;
    }
    ctx.putImageData(img, 0, 0);
    return { map: toTexture(canvas), normalMap: heightToNormalMap(h, S, S, 3) };
  });
}

function twineMap(): THREE.Texture {
  return cachedTexture("potion:twine", () => {
    const [canvas, ctx] = makeCanvas(128, 32);
    ctx.fillStyle = "#a88a5c";
    ctx.fillRect(0, 0, 128, 32);
    // Twisted plies: diagonal stripes
    ctx.strokeStyle = "rgba(70, 50, 25, 0.55)";
    ctx.lineWidth = 3;
    for (let x = -32; x < 160; x += 9) {
      ctx.beginPath();
      ctx.moveTo(x, 32);
      ctx.lineTo(x + 20, 0);
      ctx.stroke();
    }
    return toTexture(canvas);
  });
}

/** Hand-inked paper label (title + a line of small script). */
function labelTexture(title: string, sub: string, seed: number, w = 512, h = 256): THREE.Texture {
  return cachedTexture(`potion:label:${title}`, () => {
    const [canvas, ctx] = makeCanvas(w, h);
    const rand = mulberry32(seed);
    const n = noiseField(w, h, seed, 6, 3, 4);
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const ex = Math.min(x, w - 1 - x) / w;
        const ey = Math.min(y, h - 1 - y) / h;
        const edge = 1 - Math.min(1, Math.min(ex * 9, ey * 7));
        const g = 0.92 + (n[i]! - 0.5) * 0.16 - edge * 0.22;
        img.data[i * 4] = 236 * g;
        img.data[i * 4 + 1] = 220 * g;
        img.data[i * 4 + 2] = 184 * g;
        img.data[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const ink = "rgba(52, 30, 16, 0.88)";
    ctx.strokeStyle = ink;
    ctx.lineWidth = 3;
    ctx.strokeRect(w * 0.05, h * 0.09, w * 0.9, h * 0.82);
    ctx.lineWidth = 1.2;
    ctx.strokeRect(w * 0.07, h * 0.14, w * 0.86, h * 0.72);
    ctx.fillStyle = ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `italic 600 ${Math.round(h * 0.3)}px Georgia, 'Times New Roman', serif`;
    ctx.fillText(title, w / 2, h * 0.43, w * 0.78);
    ctx.font = `italic ${Math.round(h * 0.13)}px Georgia, 'Times New Roman', serif`;
    ctx.fillStyle = "rgba(60, 36, 20, 0.75)";
    ctx.fillText(sub, w / 2, h * 0.7, w * 0.74);
    // A couple of ink blots
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(w * (0.15 + rand() * 0.7), h * (0.2 + rand() * 0.6), 1 + rand() * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = toTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  });
}

/**
 * Vertical shading for the liquids (v = 0 at the floor, 1 at the meniscus):
 * deeper and darker at the bottom, brighter toward the lit surface, with a
 * bright rim where the meniscus climbs the glass.
 */
function liquidGradient(): THREE.Texture {
  return cachedTexture("potion:liquidGradient", () => {
    const [canvas, ctx] = makeCanvas(4, 256);
    const g = ctx.createLinearGradient(0, 256, 0, 0);
    g.addColorStop(0, "#5a5a5a");
    g.addColorStop(0.55, "#b4b4b4");
    g.addColorStop(0.86, "#e6e6e6");
    g.addColorStop(0.9, "#ffffff");
    g.addColorStop(1, "#d0d0d0");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
    const tex = toTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  });
}

function liquidMat(color: number): THREE.MeshStandardMaterial {
  const mat = liquidMaterial(color).clone();
  mat.map = liquidGradient();
  mat.emissiveMap = mat.map;
  mat.roughness = 0.18;
  return mat;
}

/** Start-up warm-up hook: paint every potion map now (cached). */
export function potionMaps(): void {
  glassRoughnessMap();
  liquidGradient();
  corkMaps();
  twineMap();
  labelTexture("Mana", "drink slowly", 4601);
  labelTexture("Caffeine", "one dram before dawn", 4602);
  labelTexture("Focus", "distilled at midnight", 4603);
}

function corkMaterial(): THREE.MeshStandardMaterial {
  const maps = corkMaps();
  return new THREE.MeshStandardMaterial({
    map: maps.map,
    normalMap: maps.normalMap,
    roughness: 0.95,
    metalness: 0,
  });
}

function paperMaterial(texture: THREE.Texture): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide,
  });
}

/** Cork plug: tapered, slightly domed top. Base at y = 0. */
function cork(radius: number, height: number): THREE.Mesh {
  const geo = revolve(
    [
      [0.0001, -0.008],
      [radius * 0.86, -0.008],
      [radius * 0.94, 0],
      [radius, height * 0.85],
      [radius * 0.92, height],
      [radius * 0.5, height + 0.0012],
      [0.0001, height + 0.0014],
    ],
    12,
  );
  return new THREE.Mesh(geo, corkMaterial());
}

/** Ring of twine around a neck (a few turns, slightly uneven). */
function twine(radius: number, y: number, turns = 3): THREE.Mesh[] {
  const mat = new THREE.MeshStandardMaterial({ map: twineMap(), roughness: 1, metalness: 0 });
  const out: THREE.Mesh[] = [];
  for (let i = 0; i < turns; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius + 0.0012, 0.0011, 4, 16).rotateX(Math.PI / 2),
      mat,
    );
    ring.position.y = y + i * 0.0021;
    ring.rotation.z = (i - 1) * 0.04;
    out.push(ring);
  }
  return out;
}

/** Wax cap poured over cork and lip, with a few drips down the neck. */
function waxCap(color: number, lipR: number, lipY: number, corkTop: number): THREE.Mesh[] {
  const mat = sealWaxMaterial().clone();
  mat.color.set(color);
  const cap = new THREE.Mesh(
    revolve(
      [
        [lipR + 0.0009, lipY - 0.0062],
        [lipR + 0.0016, lipY - 0.004],
        [lipR + 0.0017, lipY],
        [lipR + 0.0012, corkTop - 0.0015],
        [lipR * 0.86, corkTop + 0.0012],
        [lipR * 0.45, corkTop + 0.0022],
        [0.0001, corkTop + 0.0024],
      ],
      18,
    ),
    mat,
  );
  const out = [cap];
  // Drips: thin runs hanging from the cap's skirt, fattening at the tip.
  const dripGeo = revolve(
    [
      [0.0001, -1],
      [0.75, -0.9],
      [1, -0.7],
      [0.7, -0.2],
      [0.55, 0.6],
      [0.0001, 1],
    ],
    8,
  );
  for (const [a, len] of [
    [0.3, 0.011],
    [2.2, 0.006],
    [4.1, 0.015],
  ] as Array<[number, number]>) {
    const drip = new THREE.Mesh(dripGeo, mat);
    drip.scale.set(0.0017, len / 2, 0.0017);
    const r = lipR + 0.0008 - (lipY - 0.006 - len / 2 < lipY - 0.009 ? 0.0006 : 0);
    drip.position.set(Math.cos(a) * r, lipY - 0.0045 - len / 2, Math.sin(a) * r);
    out.push(drip);
  }
  return out;
}

function glassMesh(geo: THREE.BufferGeometry, tint: number): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, makeGlass(tint));
  mesh.userData.noShadow = true; // glass: no opaque shadow
  mesh.renderOrder = 1;
  return mesh;
}

// --- Bottles ---------------------------------------------------------------------

/** Round-bottomed flask on a foot ring, long neck, rolled lip. ~0.17 high. */
function buildFlask(): THREE.Group {
  const flask = new THREE.Group();
  flask.name = "potionFlask";
  const glass: Profile = [
    [0.0001, 0.0035],
    [0.02, 0.0028],
    [0.03, 0.0],
    [0.036, 0.003],
    [0.046, 0.013],
    [0.053, 0.03],
    [0.0555, 0.05],
    [0.0535, 0.07],
    [0.046, 0.088],
    [0.033, 0.103],
    [0.018, 0.113],
    [0.0128, 0.122],
    [0.0122, 0.145],
    [0.0135, 0.152],
    [0.0172, 0.155],
    [0.0176, 0.1595],
    [0.0148, 0.1615],
  ];
  flask.add(glassMesh(revolve(glass, 22), 0xd9efe9));
  const liquid = new THREE.Mesh(
    revolve(liquidProfile(glass, 0.0055, 0.071), 18),
    liquidMat(0x47bdad),
  );
  flask.add(liquid);
  const c = cork(0.0118, 0.02);
  c.position.y = 0.146;
  flask.add(c);
  flask.add(...waxCap(0x8e1f17, 0.0176, 0.1595, 0.166));
  flask.add(...twine(0.0123, 0.128, 2));

  // Paper tag hanging from the twine, resting against the belly.
  const tag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.044, 0.024),
    paperMaterial(labelTexture("Mana", "drink slowly", 4601)),
  );
  const dir = -0.2; // face the reader (cluster yaw 0.2)
  tag.position.set(Math.sin(dir) * 0.059, 0.062, Math.cos(dir) * 0.059);
  tag.rotation.set(-0.32, dir, 0.08);
  flask.add(tag);
  // String from the neck down to the tag
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(Math.sin(dir) * 0.013, 0.128, Math.cos(dir) * 0.013),
    new THREE.Vector3(Math.sin(dir) * 0.04, 0.1, Math.cos(dir) * 0.045),
    new THREE.Vector3(Math.sin(dir) * 0.056, 0.076, Math.cos(dir) * 0.061),
  ]);
  flask.add(
    new THREE.Mesh(
      new THREE.TubeGeometry(curve, 12, 0.00035, 3),
      new THREE.MeshStandardMaterial({ color: 0x8a6d45, roughness: 1 }),
    ),
  );
  flask.position.set(0.005, 0, 0.03);
  return flask;
}

/** Tall straight vial with a narrow shoulder and flared lip. ~0.22 high. */
function buildVial(): THREE.Group {
  const vial = new THREE.Group();
  vial.name = "potionVial";
  const glass: Profile = [
    [0.0001, 0.003],
    [0.017, 0.0022],
    [0.0215, 0.0],
    [0.0238, 0.004],
    [0.0242, 0.015],
    [0.0238, 0.145],
    [0.022, 0.158],
    [0.0145, 0.17],
    [0.0108, 0.178],
    [0.0104, 0.199],
    [0.0124, 0.204],
    [0.0148, 0.206],
    [0.015, 0.2105],
    [0.0125, 0.212],
  ];
  vial.add(glassMesh(revolve(glass, 20), 0xf3e2e2));
  vial.add(
    new THREE.Mesh(revolve(liquidProfile(glass, 0.005, 0.118), 16), liquidMat(0xc0392b)),
  );
  const c = cork(0.0099, 0.022);
  c.position.y = 0.198;
  vial.add(c);
  vial.add(...twine(0.0105, 0.187, 3));

  // Wrapped paper label, centred toward the reader (cluster 0.2 + vial 0.6).
  const theta = -0.8;
  const span = 1.9;
  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0247, 0.0247, 0.05, 16, 1, true, theta - span / 2, span),
    paperMaterial(labelTexture("Caffeine", "one dram before dawn", 4602)),
  );
  label.position.y = 0.075;
  vial.add(label);

  vial.position.set(-0.085, 0, -0.045);
  vial.rotation.y = 0.6;
  return vial;
}

/** Square-shouldered bottle (superellipse section) with a black wax seal. ~0.14 high. */
function buildSquareBottle(): THREE.Group {
  const bottle = new THREE.Group();
  bottle.name = "potionSquare";
  const glass: Profile = [
    [0.0001, 0.003],
    [0.03, 0.0024],
    [0.0355, 0.0],
    [0.0385, 0.004],
    [0.0392, 0.012],
    [0.039, 0.088],
    [0.036, 0.1],
    [0.026, 0.11],
    [0.0165, 0.116],
    [0.0138, 0.121],
    [0.0136, 0.13],
    [0.0164, 0.1325],
    [0.0168, 0.1372],
    [0.0142, 0.1388],
  ];
  // Square body, rounding into a round neck above the shoulder.
  const exponent = (y: number): number =>
    THREE.MathUtils.lerp(7, 2, THREE.MathUtils.smoothstep(y, 0.088, 0.113));
  bottle.add(glassMesh(revolve(glass, 28, exponent), 0xf2ead6));
  bottle.add(
    new THREE.Mesh(
      revolve(liquidProfile(glass, 0.005, 0.064, 0.003), 24, exponent),
      liquidMat(0xe67e22),
    ),
  );
  const c = cork(0.0129, 0.016);
  c.position.y = 0.129;
  bottle.add(c);
  bottle.add(...waxCap(0x1d1a1c, 0.0168, 0.1372, 0.142));

  // Flat label on the +Z face (just proud of the glass).
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.052, 0.04),
    paperMaterial(labelTexture("Focus", "distilled at midnight", 4603)),
  );
  label.position.set(0, 0.048, 0.0396);
  bottle.add(label);

  bottle.position.set(0.09, 0, -0.055);
  bottle.rotation.y = -0.4;
  return bottle;
}

export function buildPotions(): THREE.Group {
  const group = new THREE.Group();
  group.name = "potions";
  group.add(buildFlask(), buildVial(), buildSquareBottle());

  /**
   * Transmission on high only: it renders the opaque scene a second time
   * into the transmission target (see renderer.transmissionResolutionScale
   * in SceneManager); medium and low use the transparent shell.
   */
  group.userData.setQuality = (quality: Quality): void => {
    const on = quality === "high";
    group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshPhysicalMaterial;
      if (!mat.userData?.glass) return;
      if ((mat.transmission > 0) !== on) setGlassMode(mat, on);
    });
  };

  group.userData.itemId = "potion";
  group.userData.label = ITEM_LABELS.potion.name;
  return group;
}
