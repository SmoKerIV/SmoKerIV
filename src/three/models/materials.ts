/**
 * Shared, cached materials for the procedural inn scene.
 * Palette: browns #4a3524/#6b4a2f, leather #5a2e1d, parchment #e8dcc0,
 * iron #8a8f98, brass #b08d3c, arcane teal #35d0ba.
 */
import * as THREE from "three";
import {
  makeLeatherTexture,
  makeParchmentTexture,
  makePlasterTexture,
  makeStoneTexture,
  makeWoodTexture,
} from "./textures";

const cache = new Map<string, THREE.MeshStandardMaterial>();

function cached(
  key: string,
  make: () => THREE.MeshStandardMaterial,
): THREE.MeshStandardMaterial {
  let mat = cache.get(key);
  if (!mat) {
    mat = make();
    cache.set(key, mat);
  }
  return mat;
}

export function woodDarkMaterial(): THREE.MeshStandardMaterial {
  return cached("woodDark", () =>
    new THREE.MeshStandardMaterial({
      map: makeWoodTexture("dark"),
      roughness: 0.85,
      metalness: 0.0,
    }),
  );
}

export function woodLightMaterial(): THREE.MeshStandardMaterial {
  return cached("woodLight", () =>
    new THREE.MeshStandardMaterial({
      map: makeWoodTexture("light"),
      roughness: 0.8,
      metalness: 0.0,
    }),
  );
}

/** Vertical-grain wood (tankard staves, posts seen from the side). */
export function woodStaveMaterial(): THREE.MeshStandardMaterial {
  return cached("woodStave", () =>
    new THREE.MeshStandardMaterial({
      map: makeWoodTexture("dark", true),
      roughness: 0.85,
      metalness: 0.0,
    }),
  );
}

export function leatherMaterial(): THREE.MeshStandardMaterial {
  return cached("leather", () =>
    new THREE.MeshStandardMaterial({
      map: makeLeatherTexture(),
      roughness: 0.9,
      metalness: 0.0,
    }),
  );
}

/** Slightly darker plain leather (embossed borders, grips). */
export function leatherDarkMaterial(): THREE.MeshStandardMaterial {
  return cached("leatherDark", () =>
    new THREE.MeshStandardMaterial({
      color: 0x3f1f13,
      roughness: 0.95,
      metalness: 0.0,
    }),
  );
}

export function parchmentMaterial(withRunes = false): THREE.MeshStandardMaterial {
  return cached(`parchment:${withRunes}`, () =>
    new THREE.MeshStandardMaterial({
      map: makeParchmentTexture(withRunes),
      roughness: 0.9,
      metalness: 0.0,
      side: THREE.DoubleSide,
    }),
  );
}

/** Plain cream page-block sides. */
export function pageBlockMaterial(): THREE.MeshStandardMaterial {
  return cached("pageBlock", () =>
    new THREE.MeshStandardMaterial({
      color: 0xe8dcc0,
      roughness: 0.95,
      metalness: 0.0,
    }),
  );
}

export function ironMaterial(): THREE.MeshStandardMaterial {
  return cached("iron", () =>
    new THREE.MeshStandardMaterial({
      // Hand-forged steel, not chrome: without an env map, high metalness
      // just reflects the dark room and reads as black mirror bars.
      color: 0x9aa0a8,
      metalness: 0.55,
      roughness: 0.48,
    }),
  );
}

/** Darker rough iron (fuller, fittings). */
export function ironDarkMaterial(): THREE.MeshStandardMaterial {
  return cached("ironDark", () =>
    new THREE.MeshStandardMaterial({
      color: 0x5b5f66,
      metalness: 0.8,
      roughness: 0.5,
    }),
  );
}

export function brassMaterial(): THREE.MeshStandardMaterial {
  return cached("brass", () =>
    new THREE.MeshStandardMaterial({
      color: 0xb08d3c,
      metalness: 0.9,
      roughness: 0.4,
    }),
  );
}

/** Tinted glass for potion bottles. Cached per tint. */
export function glassMaterial(tint = 0xcfe8e4): THREE.MeshStandardMaterial {
  return cached(`glass:${tint}`, () =>
    new THREE.MeshStandardMaterial({
      color: tint,
      transparent: true,
      opacity: 0.55,
      roughness: 0.1,
      metalness: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
}

/** Emissive potion liquid. Cached per color. */
export function liquidMaterial(color: number): THREE.MeshStandardMaterial {
  return cached(`liquid:${color}`, () =>
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.55,
      roughness: 0.4,
      metalness: 0.0,
    }),
  );
}

export function waxMaterial(): THREE.MeshStandardMaterial {
  return cached("wax", () =>
    new THREE.MeshStandardMaterial({
      color: 0xf3ead2,
      roughness: 0.6,
      metalness: 0.0,
    }),
  );
}

export function plasterMaterial(): THREE.MeshStandardMaterial {
  return cached("plaster", () =>
    new THREE.MeshStandardMaterial({
      map: makePlasterTexture(),
      roughness: 0.95,
      metalness: 0.0,
    }),
  );
}

export function stoneMaterial(): THREE.MeshStandardMaterial {
  return cached("stone", () =>
    new THREE.MeshStandardMaterial({
      map: makeStoneTexture(),
      roughness: 0.95,
      metalness: 0.0,
    }),
  );
}

export function corkMaterial(): THREE.MeshStandardMaterial {
  return cached("cork", () =>
    new THREE.MeshStandardMaterial({
      color: 0xa9805a,
      roughness: 0.95,
      metalness: 0.0,
    }),
  );
}

/**
 * Convenience: set shadow flags on every mesh under root.
 */
export function setShadows(
  root: THREE.Object3D,
  cast: boolean,
  receive: boolean,
): void {
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = cast;
      obj.receiveShadow = receive;
    }
  });
}
