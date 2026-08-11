/**
 * Closed leather tome ~0.50 (X) x 0.36 (Z) x 0.09 (Y), lying flat,
 * spine on the -X side. Pivot at the bottom of the back cover.
 *
 * Animatable parts exposed via userData.parts (SpellbookParts):
 * - frontCover: group pivoted at the spine; rotate .z from 0 to ~ -PI to open.
 * - flipPages: 3 loose page groups on the same spine line, front-to-back.
 */
import * as THREE from "three";
import { ITEM_LABELS } from "../types";
import type { SpellbookParts } from "../types";
import {
  brassMaterial,
  leatherDarkMaterial,
  leatherMaterial,
  pageBlockMaterial,
  parchmentMaterial,
} from "./materials";
import { makeRuneCircleTexture } from "./textures";

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

  const leather = leatherMaterial();
  const trim = leatherDarkMaterial();
  const brass = brassMaterial();

  // --- Back cover (flat on the origin plane) -------------------------------
  const backCover = new THREE.Mesh(new THREE.BoxGeometry(W, 0.012, D), leather);
  backCover.position.set(0, 0.006, 0);
  backCover.castShadow = true;
  backCover.receiveShadow = true;
  group.add(backCover);

  // --- Page block (cream, inset, flush to the spine) -----------------------
  const blockH = 0.054;
  const pageBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, blockH, 0.33),
    pageBlockMaterial(),
  );
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
  // Rotate .z from 0 to ~ -Math.PI to open the book leftward.
  const frontCover = new THREE.Group();
  frontCover.name = "spellbookFrontCover";
  frontCover.position.set(SPINE_X, 0.073, 0);

  const coverMesh = new THREE.Mesh(new THREE.BoxGeometry(W, 0.013, D), leather);
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

  // Embossed border: four raised strips on the cover top
  const borderY = 0.0145;
  const bt = 0.004; // thickness
  const bw = 0.018; // width
  const borderParts: Array<[number, number, number, number]> = [
    // [sizeX, sizeZ, x, z]
    [W - 0.05, bw, W / 2, D / 2 - 0.028],
    [W - 0.05, bw, W / 2, -(D / 2 - 0.028)],
    [bw, D - 0.056, 0.038, 0],
    [bw, D - 0.056, W - 0.038, 0],
  ];
  for (const [sx, sz, x, z] of borderParts) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(sx, bt, sz), trim);
    strip.position.set(x, borderY, z);
    frontCover.add(strip);
  }
  // Brass corner studs
  for (const [x, z] of [
    [0.038, D / 2 - 0.028],
    [0.038, -(D / 2 - 0.028)],
    [W - 0.038, D / 2 - 0.028],
    [W - 0.038, -(D / 2 - 0.028)],
  ] as Array<[number, number]>) {
    const stud = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), brass);
    stud.position.set(x, borderY + 0.002, z);
    frontCover.add(stud);
  }

  // Emissive arcane rune in the cover center (teal, low intensity)
  const runeTex = makeRuneCircleTexture();
  const runeMat = new THREE.MeshBasicMaterial({
    map: runeTex,
    color: 0x35d0ba,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const rune = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17), runeMat);
  rune.rotation.x = -Math.PI / 2;
  rune.rotation.z = -Math.PI / 2;
  rune.position.set(W / 2, 0.0142, 0);
  frontCover.add(rune);

  // Metal clasp wrapping the fore edge (attached to the front cover)
  const claspPlate = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.005, 0.06), brass);
  claspPlate.position.set(W - 0.03, 0.014, 0);
  frontCover.add(claspPlate);
  const claspStrap = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.072, 0.06), brass);
  claspStrap.position.set(W + 0.004, -0.026, 0);
  frontCover.add(claspStrap);

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

  // --- Spine wrap: rounded leather ridge along -X ---------------------------
  const spine = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, D, 10, 1, false, 0, Math.PI)
      .rotateZ(Math.PI / 2)
      .rotateY(Math.PI / 2),
    leather,
  );
  spine.scale.set(0.55, 1, 1);
  spine.position.set(SPINE_X + 0.002, 0.044, 0);
  spine.castShadow = true;
  group.add(spine);
  // Raised spine bands
  for (const y of [0.022, 0.044, 0.066]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.008, D + 0.006), trim);
    band.position.set(SPINE_X - 0.012, y, 0);
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
