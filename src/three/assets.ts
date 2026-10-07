/**
 * Licensed glTF props (public/models/, gitignored — Envato licence).
 *
 * Fresh clones and CI have no models, so every model is optional: a file
 * that 404s, comes back as the SPA's index.html, or fails to decode simply
 * resolves to null and the scene keeps its procedural stand-in (or skips
 * the background prop). The first model doubles as a probe — if it fails,
 * the rest are never requested, so a missing folder costs one request and
 * one console.info instead of a wall of network errors.
 *
 * Every file was normalised by scripts/convert-models.py: metres, Y-up,
 * pivot at the bottom centre, Draco-compressed geometry, JPEG textures.
 */
import * as THREE from "three";

const BASE = `${import.meta.env.BASE_URL}models/`;

/** Model key → path under public/models/. */
export const MODEL_FILES = {
  candle: "candle/candle.glb",
  buckler: "buckler/buckler.glb",
  fireplace: "fireplace/fireplace.glb",
  chest: "chest/chest.glb",
  crate: "crate/crate.glb",
  chair: "chair/chair.glb",
  barrel1: "barrels/barrel-1.glb",
  barrel2: "barrels/barrel-2.glb",
  barrel3: "barrels/barrel-3.glb",
  barrel4: "barrels/barrel-4.glb",
  barrel5: "barrels/barrel-5.glb",
  bookClosed1: "scrolls-books/book-closed-1.glb",
  bookClosed2: "scrolls-books/book-closed-2.glb",
  bookStack: "scrolls-books/book-stack.glb",
  scroll1: "scrolls-books/scroll-1.glb",
  scroll3: "scrolls-books/scroll-3.glb",
  ink: "scrolls-books/ink.glb",
} as const;

export type ModelKey = keyof typeof MODEL_FILES;

/** Loaded scene roots (null = unavailable, use the fallback). */
export type ModelSet = Partial<Record<ModelKey, THREE.Group | null>>;

/** Loaded once, cloned per use: model() hands out independent copies. */
export class ModelLibrary {
  private readonly roots: ModelSet;

  constructor(roots: ModelSet) {
    this.roots = roots;
  }

  has(key: ModelKey): boolean {
    return !!this.roots[key];
  }

  /**
   * A fresh clone (geometry, materials and textures shared with the
   * source — callers that tint or hover-highlight clone materials first).
   */
  model(key: ModelKey): THREE.Group | null {
    const root = this.roots[key];
    return root ? (root.clone(true) as THREE.Group) : null;
  }

  /** Every texture/geometry/material the source roots own (for dispose). */
  disposeSources(): void {
    const textures = new Set<THREE.Texture>();
    for (const root of Object.values(this.roots)) {
      root?.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
          for (const value of Object.values(material)) {
            if (value instanceof THREE.Texture) textures.add(value);
          }
          material.dispose();
        }
      });
    }
    for (const texture of textures) texture.dispose();
  }
}

export interface LoadModelsOptions {
  keys: ModelKey[];
  /** Max texture anisotropy to apply (renderer capability, quality-capped). */
  anisotropy: number;
  /** 0..1 download progress across all requested models. */
  onProgress?: (fraction: number) => void;
  /** Bail out early (scene disposed mid-load). */
  isCancelled?: () => boolean;
}

/**
 * Fetch + decode the requested models. Never rejects: unavailable models
 * come back as null. The first key is the probe (see file comment).
 */
export async function loadModels(options: LoadModelsOptions): Promise<ModelLibrary> {
  const { keys, anisotropy, onProgress, isCancelled } = options;
  const roots: ModelSet = {};
  if (keys.length === 0) {
    onProgress?.(1);
    return new ModelLibrary(roots);
  }

  // The loaders (GLTF + Draco, ~100 kB) stream in only when models are
  // actually fetched, in parallel with the first texture stage.
  let loaders;
  try {
    loaders = await Promise.all([
      import("three/examples/jsm/loaders/GLTFLoader.js"),
      import("three/examples/jsm/loaders/DRACOLoader.js"),
    ]);
  } catch {
    onProgress?.(1);
    return new ModelLibrary(roots);
  }
  const [{ GLTFLoader }, { DRACOLoader }] = loaders;
  const draco = new DRACOLoader();
  draco.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  const fractions = new Array<number>(keys.length).fill(0);
  const report = (): void => {
    let sum = 0;
    for (const f of fractions) sum += f;
    onProgress?.(sum / keys.length);
  };

  const loadOne = async (index: number): Promise<boolean> => {
    const key = keys[index]!;
    try {
      const gltf = await loader.loadAsync(BASE + MODEL_FILES[key], (event) => {
        if (event.lengthComputable && event.total > 0) {
          fractions[index] = Math.min(event.loaded / event.total, 0.99);
          report();
        }
      });
      const root = gltf.scene as THREE.Group;
      prepareTextures(root, anisotropy);
      roots[key] = root;
      return true;
    } catch {
      roots[key] = null;
      return false;
    } finally {
      fractions[index] = 1;
      report();
    }
  };

  try {
    const probeOk = await loadOne(0);
    if (!probeOk) {
      // Expected in fresh clones / CI: the licensed models are not in git.
      console.info(
        "[scene] Licensed 3D models not available — using procedural props.",
      );
      fractions.fill(1);
      report();
      return new ModelLibrary(roots);
    }
    if (isCancelled?.()) return new ModelLibrary(roots);
    const results = await Promise.all(keys.slice(1).map((_, i) => loadOne(i + 1)));
    const failed = results.filter((ok) => !ok).length;
    if (failed > 0) {
      console.info(`[scene] ${failed} 3D model(s) unavailable — using fallbacks.`);
    }
  } finally {
    // Decoding is done for good: release the Draco worker pool.
    draco.dispose();
  }
  return new ModelLibrary(roots);
}

/**
 * GLTFLoader already tags baseColor maps sRGB and data maps linear; make
 * that explicit (some exporters leave colorSpace unset) and turn on
 * anisotropic filtering so the grazing-angle props stay crisp.
 */
function prepareTextures(root: THREE.Object3D, anisotropy: number): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      const m = material as THREE.MeshStandardMaterial;
      if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
      if (m.emissiveMap) m.emissiveMap.colorSpace = THREE.SRGBColorSpace;
      for (const tex of [m.map, m.normalMap, m.roughnessMap, m.metalnessMap, m.aoMap, m.emissiveMap]) {
        if (tex) tex.anisotropy = anisotropy;
      }
      // Converted models are closed solids authored double-sided; single
      // sided halves the fragment work and avoids shadow acne on backfaces.
      m.side = THREE.FrontSide;
    }
  });
}

export interface PropLook {
  /** Multiply the base colour (darker / desaturated background props). */
  tint?: THREE.ColorRepresentation;
  /** Scale metalness (no env map in this scene: full metal reads black). */
  metalness?: number;
  /** Override / clamp roughness. */
  roughnessMin?: number;
  castShadow?: boolean;
}

/**
 * Give a cloned model its own materials with the requested look, and set
 * the shadow flags via the scene's userData.noShadow convention (the
 * stage traverse turns that into castShadow = false).
 */
export function styleModel(root: THREE.Object3D, look: PropLook = {}): void {
  const clones = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  const tint = look.tint !== undefined ? new THREE.Color(look.tint) : null;
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const restyle = (material: THREE.Material): THREE.Material => {
      let clone = clones.get(material);
      if (!clone) {
        clone = (material as THREE.MeshStandardMaterial).clone();
        if (tint) clone.color.multiply(tint);
        if (look.metalness !== undefined) clone.metalness *= look.metalness;
        if (look.roughnessMin !== undefined) {
          clone.roughness = Math.max(clone.roughness, look.roughnessMin);
        }
        clones.set(material, clone);
      }
      return clone;
    };
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(restyle)
      : restyle(mesh.material);
    if (look.castShadow === false) mesh.userData.noShadow = true;
  });
}
