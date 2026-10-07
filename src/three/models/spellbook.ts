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
  brassUVs,
  cornerGuardGeometry,
  cornerRotation,
  pageBlockGeometry,
  pageEdge,
  pageRimGeometry,
  plainLeather,
  slabGeometry,
  spineCordGeometry,
  spineFillGeometry,
  spineShellGeometry,
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

  // --- Page block: fills the boards' inner height ---------------------------
  // Real books: the boards overhang the text block by a small "square"
  // (~3-4 mm here) and the leaves fill the space between them. The block's
  // top face stays at y = 0.066 under the loose pages; a U-shaped top
  // course (open at the spine) carries the head, tail and fore-edge on up
  // to just under the front board and squashes flat as the cover opens,
  // so nothing rises around the reading spread.
  const blockH = 0.054;
  const BLOCK_Y0 = 0.012;
  const BLOCK_TOP = BLOCK_Y0 + blockH; // 0.066, under the loose pages
  const STACK_TOP = 0.0715; // front board underside is 0.073
  const STACK_H = STACK_TOP - BLOCK_Y0;
  const BLOCK_X0 = SPINE_X + 0.01; // −0.24, against the spine
  const BLOCK_X1 = W / 2 - 0.0045; // fore-edge square 4.5 mm (clasp clearance)
  const BLOCK_Z = D / 2 - 0.003; // head/tail square 3 mm
  const edge = pageEdge();
  const pageSide = pageBlockMaterial();
  const blockGeo = pageBlockGeometry(BLOCK_X1 - BLOCK_X0, blockH, BLOCK_Z * 2);
  {
    // Edge-map v measured over the whole stack so the leaves continue
    // into the top course at the same spacing.
    const pos = blockGeo.getAttribute("position") as THREE.BufferAttribute;
    const nor = blockGeo.getAttribute("normal") as THREE.BufferAttribute;
    const uv = blockGeo.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(nor.getY(i)) > 0.5) continue;
      uv.setY(i, (pos.getY(i) + blockH / 2) / STACK_H);
    }
  }
  // Groups follow BoxGeometry: +x, −x, +y, −y, +z, −z
  const pageBlock = new THREE.Mesh(blockGeo, [edge, pageSide, pageSide, pageSide, edge, edge]);
  pageBlock.position.set((BLOCK_X0 + BLOCK_X1) / 2, BLOCK_Y0 + blockH / 2, 0);
  pageBlock.castShadow = true;
  pageBlock.receiveShadow = true;
  group.add(pageBlock);

  const RIM_H = STACK_TOP - BLOCK_TOP;
  const pageRim = new THREE.Mesh(
    pageRimGeometry(
      BLOCK_X0,
      BLOCK_X1,
      SPINE_INNER_X + PAGE_W + 0.0015, // clear of the right reading page
      BLOCK_Z,
      PAGE_D / 2 + 0.0015,
      RIM_H,
      blockH / STACK_H,
    ),
    [pageSide, edge],
  );
  pageRim.position.set(0, BLOCK_TOP, 0);
  pageRim.castShadow = true;
  pageRim.receiveShadow = true;
  group.add(pageRim);

  // Old block centre: the parchment top keeps its exact place and size.
  const BLOCK_TOP_X = SPINE_X + 0.01 + 0.23;

  // Written parchment on top of the page block (visible when open)
  const blockTop = new THREE.Mesh(
    new THREE.PlaneGeometry(0.455, 0.325).rotateX(-Math.PI / 2),
    parchmentMaterial(true),
  );
  blockTop.position.set(BLOCK_TOP_X, 0.012 + blockH + 0.0004, 0);
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
  // corner guards bent around the two fore corners of the front board
  // (top plate, edge band, lip under the board; 1 mm sheet).
  const COVER_T = 0.013;
  const guardGeo = cornerGuardGeometry(0.046, COVER_T);
  for (const [z, iz] of [
    [-D / 2, 1],
    [D / 2, -1],
  ] as Array<[number, 1 | -1]>) {
    const guard = new THREE.Mesh(guardGeo, brass);
    guard.position.set(W, 0, z);
    guard.rotation.y = cornerRotation(-1, iz);
    guard.castShadow = true;
    frontCover.add(guard);
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
  const claspPlate = new THREE.Mesh(
    brassUVs(slabGeometry(0.055, 0.005, 0.06, 0.008, 0.0012)),
    brass,
  );
  claspPlate.position.set(W - 0.03, 0.014, 0);
  frontCover.add(claspPlate);
  const claspStrap = new THREE.Mesh(
    brassUVs(slabGeometry(0.014, 0.072, 0.06, 0.004, 0.0015)),
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

  // --- Spine: rounded leather along -X --------------------------------------
  // A solid leather wall (same outer curve as before, so the open book's
  // gutter ridge is unchanged) from under the front board, over the ridge
  // and down the outside to the table. Behind it at the head and tail: the
  // rounded back of the text block (paper) and the joints (leather), so the
  // ends read solid instead of a hollow sheet.
  const spineLeather = plainLeather(2);
  const SPINE_CX = SPINE_X + 0.002;
  const SPINE_CY = 0.044;
  const SPINE_A = 0.0248;
  const SPINE_B = 0.045;
  const SPINE_WALL = 0.0028;
  // Where the wall dives under the front board (t < 1.25) it would stand
  // proud of the text block's head/tail, so that inner stretch (only seen
  // as the open book's gutter ridge) stops flush with the block instead.
  const SPINE_SPLIT = 1.25;
  const spine = new THREE.Mesh(
    spineShellGeometry(SPINE_CX, SPINE_CY, SPINE_A, SPINE_B, SPINE_WALL, D + 0.004, SPINE_SPLIT),
    spineLeather,
  );
  const spineInner = new THREE.Mesh(
    spineShellGeometry(
      SPINE_CX, SPINE_CY, SPINE_A, SPINE_B, SPINE_WALL, (D / 2 - 0.0035) * 2, 0.45,
      SPINE_SPLIT + 0.05,
    ),
    spineLeather,
  );
  for (const piece of [spine, spineInner]) {
    piece.castShadow = true;
    piece.receiveShadow = true;
    group.add(piece);
  }
  const innerA = SPINE_A - SPINE_WALL + 0.0004;
  const innerB = SPINE_B - SPINE_WALL + 0.0004;
  const spineBack = new THREE.Mesh(
    spineFillGeometry(
      SPINE_CX, SPINE_CY, innerA, innerB,
      BLOCK_X0 - 0.0002, BLOCK_Y0, STACK_TOP, BLOCK_Z,
      BLOCK_Y0, STACK_H, BLOCK_X1 - BLOCK_X0,
    ),
    edge,
  );
  group.add(spineBack);
  const joint = new THREE.Mesh(
    spineFillGeometry(
      SPINE_CX, SPINE_CY, innerA, innerB,
      BLOCK_X0 - 0.0002, SPINE_CY - innerB + 0.0004, SPINE_CY + innerB - 0.0004,
      D / 2 - 0.005, 0, 0.5,
    ),
    leather,
  );
  group.add(joint);

  // Head and tail caps: leather rolled over the headbands, just past the
  // spine's ends. They set the closed book's outer extents (x −0.277,
  // z ±0.183) exactly as before.
  for (const z of [-(0.183 - 0.0025), 0.183 - 0.0025]) {
    const cap = new THREE.Mesh(
      spineCordGeometry(
        SPINE_CX, SPINE_CY, SPINE_A, SPINE_B, z,
        1.72, 4.32, 0.0034, 0.0025, 0.0008, 0.3,
      ),
      spineLeather,
    );
    cap.castShadow = true;
    group.add(cap);
  }
  // Raised bands: shallow cords on the spine's back between the two
  // boards' joints, ~2.5 mm proud, half sunk into the leather wall.
  for (const z of [-0.128, -0.045, 0.045, 0.128]) {
    const band = new THREE.Mesh(
      spineCordGeometry(
        SPINE_CX, SPINE_CY, SPINE_A, SPINE_B, z,
        1.85, 4.2, 0.0025, 0.0042, 0, 0.25,
      ),
      spineLeather,
    );
    band.castShadow = true;
    group.add(band);
  }

  // The top course of the page block squashes flat over the first ~35° of
  // the cover's swing (and rises again as it closes).
  const syncRim = (): void => {
    const k = 1 - THREE.MathUtils.smoothstep(frontCover.rotation.z, 0.04, 0.6);
    const visible = k > 0.002;
    if (pageRim.visible !== visible) pageRim.visible = visible;
    const sy = Math.max(k, 0.002);
    if (pageRim.scale.y !== sy) {
      pageRim.scale.y = sy;
      pageRim.updateMatrix();
      pageRim.matrixWorld.multiplyMatrices(group.matrixWorld, pageRim.matrix);
    }
  };
  pageBlock.onBeforeRender = syncRim;

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
