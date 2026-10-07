/**
 * Closed leather tome ~0.50 (X) x 0.36 (Z) x 0.09 (Y), lying flat,
 * spine on the -X side. Pivot at the bottom of the back cover.
 *
 * Animatable parts exposed via userData.parts (SpellbookParts):
 * - frontCover: group pivoted at the spine; rotate .z from 0 to ~ +PI to open.
 * - flipPages: 3 loose page groups on the same spine line, front-to-back.
 */
import * as THREE from "three";
import { ITEM_LABELS } from "../types";
import type { SpellbookParts } from "../types";
import { pageBlockMaterial, parchmentMaterial } from "./materials";
import { makeRuneCircleTexture } from "./textures";
import {
  agedBrass,
  cornerGuardGeometry,
  cornerRotation,
  giltEdge,
  pageBlockGeometry,
  plainLeather,
  slabGeometry,
  spineBandGeometry,
  spineWrapGeometry,
  tooledLeather,
} from "./spellbookLook";

const W = 0.5; // X
const D = 0.36; // Z
const SPINE_X = -W / 2;
/** Inner edge of the pages (the visible spine line the spread hinges on). */
const SPINE_INNER_X = SPINE_X + 0.012;
/**
 * One reading page of the open spread. The DOM ink panes are projected onto
 * exactly this rectangle (SceneManager.cornerLocal = ±PAGE_W/2, ±PAGE_D/2 and
 * PAGE_CSS_W/H share the aspect), and the parchment surfaces underneath are
 * sized/centered to match so the ink always sits on paper edge-to-edge.
 */
const PAGE_W = 0.46;
const PAGE_D = 0.33;

/** Thin, slightly warped page plane; left edge at local x = 0 (the spine). */
function makeWarpedPage(width: number, depth: number, phase: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(width, depth, 8, 1);
  geo.rotateX(-Math.PI / 2); // lie in XZ, normal +Y
  geo.translate(width / 2, 0, 0);
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const warp =
      0.0016 * Math.sin((x / width) * Math.PI + phase) +
      0.0006 * Math.sin((x / width) * Math.PI * 3 + phase * 2);
    pos.setY(i, pos.getY(i) + Math.max(0, warp));
  }
  geo.computeVertexNormals();
  const page = new THREE.Mesh(geo, parchmentMaterial(true));
  page.castShadow = true;
  return page;
}

export function buildSpellbook(): THREE.Group {
  const group = new THREE.Group();
  group.name = "spellbook";

  // Look only (see spellbookLook.ts): every piece below keeps the original
  // dimensions/positions; all pivots, page meshes and the closed book's
  // footprint (x −0.277…0.261, z ±0.183) are unchanged.
  const leather = plainLeather();
  const tooled = tooledLeather();
  const brass = agedBrass();
  /** Slab materials by group: top, bottom, sides. */
  const coverFaces = [tooled, leather, leather];
  const plainFaces = [leather, leather, leather];

  // --- Back cover (flat on the origin plane) -------------------------------
  const backCover = new THREE.Mesh(slabGeometry(W, 0.012, D), plainFaces);
  backCover.position.set(0, 0.006, 0);
  backCover.castShadow = true;
  backCover.receiveShadow = true;
  group.add(backCover);

  // --- Page block (cream, inset, flush to the spine) -----------------------
  const blockH = 0.054;
  // Gilded edges on the fore-edge, head and tail; concave fore-edge.
  const gilt = giltEdge();
  const pageBlock = new THREE.Mesh(pageBlockGeometry(0.46, blockH, 0.33), [
    gilt,
    pageBlockMaterial(),
    pageBlockMaterial(),
    pageBlockMaterial(),
    gilt,
    gilt,
  ]);
  pageBlock.position.set(SPINE_X + 0.01 + 0.23, 0.012 + blockH / 2, 0);
  pageBlock.castShadow = true;
  group.add(pageBlock);

  // Written parchment on top of the page block (visible when open)
  const blockTop = new THREE.Mesh(
    new THREE.PlaneGeometry(0.455, 0.325).rotateX(-Math.PI / 2),
    parchmentMaterial(true),
  );
  blockTop.position.set(pageBlock.position.x, 0.012 + blockH + 0.0004, 0);
  group.add(blockTop);

  // --- Loose flip pages, pivoted at the spine line --------------------------
  const flipPages: THREE.Group[] = [];
  const pageBaseY = 0.012 + blockH + 0.001;
  for (let i = 0; i < 3; i++) {
    const pageGroup = new THREE.Group();
    pageGroup.position.set(SPINE_X + 0.012, pageBaseY + i * 0.0012, 0);
    pageGroup.rotation.y = (i - 1) * 0.012; // slight fan
    pageGroup.add(makeWarpedPage(0.452, 0.322, i * 1.7));
    group.add(pageGroup);
    flipPages.push(pageGroup);
  }
  // Front-to-back order = topmost page first
  flipPages.reverse();

  // --- Front cover group, pivot at the spine --------------------------------
  // Rotate .z from 0 to ~ +Math.PI to open the book leftward (+z lifts the
  // free edge up and over the spine; -z would swing it through the table).
  const frontCover = new THREE.Group();
  frontCover.name = "spellbookFrontCover";
  frontCover.position.set(SPINE_X, 0.073, 0);

  const coverMesh = new THREE.Mesh(slabGeometry(W, 0.013, D), coverFaces);
  coverMesh.position.set(W / 2, 0.0065, 0);
  coverMesh.castShadow = true;
  frontCover.add(coverMesh);

  // Inside of the front cover: written parchment (faces up when opened).
  // Same footprint as a reading page and positioned so its opened-world
  // center lands exactly under the left reading page (pivot −W/2, rot z=π:
  // world x = −W/2 − local x).
  const innerFace = new THREE.Mesh(
    new THREE.PlaneGeometry(PAGE_W, PAGE_D).rotateX(Math.PI / 2),
    parchmentMaterial(true),
  );
  innerFace.position.set(-(SPINE_INNER_X - PAGE_W / 2) + SPINE_X, -0.0004, 0);
  frontCover.add(innerFace);

  // Tooled border + embossed sigil ring live in the cover's maps. Brass
  // corner guards on the cover top, with lips over the edges at the fore
  // corners (kept inside the original footprint).
  const guardGeo = cornerGuardGeometry(0.046);
  // Lips straddle the cover's side faces and stand only 0.2 mm proud, so
  // the book's bounding box (focus anchor, contact shadow) doesn't grow.
  const LIP = 0.0006;
  const PROUD = 0.0002;
  for (const [x, z, ix, iz] of [
    [0.0015, -(D / 2 - 0.0005), 1, 1],
    [0.0015, D / 2 - 0.0005, 1, -1],
    [W - 0.0005, -(D / 2 - 0.0005), -1, 1],
    [W - 0.0005, D / 2 - 0.0005, -1, -1],
  ] as Array<[number, number, 1 | -1, 1 | -1]>) {
    const guard = new THREE.Mesh(guardGeo, brass);
    guard.position.set(x, 0.013, z);
    guard.rotation.y = cornerRotation(ix, iz);
    frontCover.add(guard);
    // Edge lips: down the cover's side faces at the corner
    const zLip = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.0136, LIP), brass);
    zLip.position.set(x + ix * 0.023, 0.0068, -iz * (D / 2 + PROUD - LIP / 2));
    frontCover.add(zLip);
    if (ix === -1) {
      const xLip = new THREE.Mesh(new THREE.BoxGeometry(LIP, 0.0136, 0.046), brass);
      xLip.position.set(W + PROUD - LIP / 2, 0.0068, z + iz * 0.023);
      frontCover.add(xLip);
    }
  }

  // Emissive arcane rune in the cover center (teal, low intensity)
  const runeTex = makeRuneCircleTexture();
  const runeMat = new THREE.MeshBasicMaterial({
    map: runeTex,
    color: 0x47bdad,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const rune = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17), runeMat);
  rune.userData.noShadow = true;
  rune.rotation.x = -Math.PI / 2;
  rune.rotation.z = -Math.PI / 2;
  rune.position.set(W / 2, 0.0142, 0);
  frontCover.add(rune);

  // Metal clasp wrapping the fore edge (attached to the front cover);
  // same boxes as before, now beveled, with rivets and a catch knob.
  const claspPlate = new THREE.Mesh(slabGeometry(0.055, 0.005, 0.06, 0.008, 0.0012), brass);
  claspPlate.position.set(W - 0.03, 0.014, 0);
  frontCover.add(claspPlate);
  const claspStrap = new THREE.Mesh(
    slabGeometry(0.014, 0.072, 0.06, 0.004, 0.0015),
    brass,
  );
  claspStrap.position.set(W + 0.004, -0.026, 0);
  frontCover.add(claspStrap);
  const rivetGeo = new THREE.SphereGeometry(0.0028, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  for (const z of [-0.019, 0.019]) {
    const rivet = new THREE.Mesh(rivetGeo, brass);
    rivet.scale.set(1, 0.7, 1);
    rivet.position.set(W - 0.045, 0.0165, z);
    frontCover.add(rivet);
  }
  const knob = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0055, 0.0068, 0.003, 16),
    brass,
  );
  knob.position.set(W - 0.022, 0.018, 0);
  frontCover.add(knob);

  group.add(frontCover);

  // --- Reading pages: clean parchment spread, revealed once open ------------
  // The opened front cover lands to the left of the spine; the left reading
  // page sits on the flipped page stack there, the right one on the page
  // block. Both hinge on the spine inner line, so the spread reads as one
  // book. Hidden while closed (they'd poke out of the book), and excluded
  // from raycasting so hover/click always hits the book itself.
  const readingGeo = new THREE.PlaneGeometry(PAGE_W, PAGE_D).rotateX(
    -Math.PI / 2,
  );
  const readingLeft = new THREE.Mesh(readingGeo, parchmentMaterial(false));
  // Above the opened cover's inner face (0.0734) and the flipped page stack.
  readingLeft.position.set(SPINE_INNER_X - PAGE_W / 2, 0.077, 0);
  const readingRight = new THREE.Mesh(readingGeo, parchmentMaterial(false));
  readingRight.position.set(SPINE_INNER_X + PAGE_W / 2, 0.0685, 0);
  for (const page of [readingLeft, readingRight]) {
    page.visible = false;
    page.receiveShadow = true;
    page.raycast = () => undefined;
    group.add(page);
  }

  // --- Spine wrap: rounded leather along -X ----------------------------------
  // The old half-cylinder hump on top (same extents, also the open book's
  // gutter ridge) now continues down the outside to the table, so the
  // spine reads as one wrapped piece. Head/tail caps reach z ±0.183 and
  // x −0.277 like the old band boxes did.
  const spineLeather = plainLeather(2);
  const SPINE_CX = SPINE_X + 0.002;
  const SPINE_CY = 0.044;
  const spine = new THREE.Mesh(
    spineWrapGeometry(SPINE_CX, SPINE_CY, 0.0248, 0.045, D + 0.004),
    spineLeather,
  );
  spine.castShadow = true;
  group.add(spine);
  // Head and tail caps (rolled leather over the headbands)
  for (const z of [-(0.183 - 0.0025), 0.183 - 0.0025]) {
    const cap = new THREE.Mesh(
      spineBandGeometry(SPINE_CX, SPINE_CY, 0.0265, 0.0455, z, 0.0025, -1.12, 1.5),
      spineLeather,
    );
    group.add(cap);
  }
  // Raised bands across the spine's back (cords under the leather)
  for (const z of [-0.128, -0.045, 0.045, 0.128]) {
    const band = new THREE.Mesh(
      spineBandGeometry(SPINE_CX, SPINE_CY, 0.0252, 0.0452, z, 0.0028, -1.15, 1.35),
      spineLeather,
    );
    band.castShadow = true;
    group.add(band);
  }

  group.userData.itemId = "spellbook";
  group.userData.label = ITEM_LABELS.spellbook.name;
  group.userData.parts = {
    frontCover,
    flipPages,
    readingPages: { left: readingLeft, right: readingRight },
  } satisfies SpellbookParts & {
    readingPages: { left: THREE.Mesh; right: THREE.Mesh };
  };
  return group;
}
