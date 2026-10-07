# Envato Elements 3D: background and prop candidates

Research date: 2026-10-07. Base URL for every item below: `https://elements.envato.com` + the path shown.
All item pages were fetched and the specs below are what the page stated. "Polycount" on Envato is polygons (roughly half the triangle count of quads, so tris can be up to 2x). Listed file sizes are whole archives (often with 4K textures or huge OBJs), not web-ready sizes.

## Key finding

There is **no single "medieval tavern interior" pack** on Envato Elements 3D. Searches for `medieval-tavern`, `tavern`, `fireplace`, `medieval-props` return a scattered catalogue (mostly TurboSquid uploads, PixelSquid360 *renders* which are 2D images and unusable, plus small authors). The nearest things:

- BITGEM "Hand Painted Series" (consistent, ultra-light, FBX/BLEND, textured) but only barrels, scrolls/books, gravestones, crypt set. No furniture.
- BITGEM "Tavern Block Set - Cube World" (voxel/blocky style, 1.5K polys, FBX): walls, arches, doors, windows, bed, bar blocks, food, beer, shelves. Style differs from hand-painted.
- Grand Castle Library Interior - Low Poly (45K polys) is a whole room, too heavy and too "set-like" to reuse as clutter.

So the plan is a curated mix, normalised in Blender (one palette/texture style, shared 1K atlas if possible). Many TurboSquid items are OBJ+MTL only. Blender imports OBJ fine.

Skip items marked "Renders": they are PixelSquid360 images, not 3D files.

## Download first (minimal consistent set, 8 items)

Priority: low poly, textured, importable, close to a warm stylized-realistic look.

| # | Slot | Item | URL | Why |
|---|------|------|-----|-----|
| 1 | Fireplace | Stone fireplace with arched openings and ornate grate | `/stone-fireplace-with-arched-openings-and-ornate-gr-NY488CR` | 6.4K polys, 1.47 MB, textured, OBJ. Only fireplace that fits the budget. |
| 2 | Barrels | Wooden Barrel Set - Hand Painted Series (BITGEM) | `/wooden-barrel-set-hand-painted-series-Q6A6LY4` | 5 barrels, ~500 polys total, FBX+BLEND, textured. |
| 3 | Books, scrolls, ink | Scrolls & Books Set - Hand Painted Series (BITGEM) | `/scrolls-books-set-hand-painted-series-TAM2THH` | 2 books, 3 scrolls, ink bottle, ~500 polys, FBX+BLEND, textured. Same style as #2. |
| 4 | Chair | Dark Brown Slatted Wooden Chair | `/dark-brown-slatted-wooden-chair-28EHX3D` | 1.6K polys, FBX, textured. Plain, easy to match to the rest. |
| 5 | Crates | Wooden Crate v2 (Desertsages) | `/wooden-crate-v2-RQDK3Y6` | 1.1K polys, FBX/OBJ/BLEND, 4K PBR (downscale to 1K). |
| 6 | Chest / clutter | Treasure Chest (Desertsages) | `/treasure-chest-8WGB594` | 2.7K polys, FBX/OBJ/BLEND, 4K PBR. Same author as #5, so same texture workflow. |
| 7 | Candle | Lit candle on brass candlestick with ring | `/lit-candle-on-brass-candlestick-with-ring-DGV8WL3` | 4K polys, OBJ, textured. Flame is geometry, replace with your own flicker light/sprite. |
| 8 | Shield | Medieval Buckler Shield: Wood and Steel Protection | `/medieval-buckler-shield-wood-and-steel-protection-KN4H525` | 4.5K polys, FBX/OBJ/**glTF**, textured. |

Optional extras if the look holds up: tankard (Luckyash GLB, 6.7K), map (11.7K, heavy for a flat sheet; better to make a plane with a texture), BITGEM Tavern Block Set only for its shelf/bottle blocks if you accept a blocky style.

Estimated budget: ~35K polys total for the 8, well inside 2-5 MB after Draco and 1K textures. Expect the texture atlas to dominate size.

## Caveats before downloading

- Style will be mixed (hand-painted BITGEM vs realistic-ish TurboSquid/Desertsages). Fix in Blender by unifying roughness, tinting albedo warm, and baking firelight-friendly values. Hand-painted pieces (#2, #3) will read slightly cartoonier; keep them in the background.
- Lanterns on Envato are weak: the lantern candidates are 227K polys or ornate. Recommendation is to build the lantern/sconce procedurally (cylinder + cage) like the hero props, or use the candle (#7) on a shelf.
- No usable low-poly tavern window found; use a procedural wooden frame plane with an emissive/dim cold-blue light.
- No wall/floor PBR found with PBR stated; the `graphics/stone-wall-texture` results are photo textures with no PBR maps mentioned. Prefer free CC0 sets (Poly Haven / ambientCG) for walls and floor, per 1K.
- No weapon rack with 3D files exists (only PixelSquid360 renders). The buckler and a sword on the wall cover the slot.
- Envato's per-item spec is auto-generated from the listing; verify polycount in Blender after import.

## Slot tables

Star marks the top pick per slot. Polycount is as stated on the item page. "-" = not stated.

### 1. Fireplace / hearth (stone)

| | Name | URL | Formats | Poly / textures | Style note |
|---|---|---|---|---|---|
| ★ | Stone fireplace with arched openings and ornate grate | `/stone-fireplace-with-arched-openings-and-ornate-gr-NY488CR` | OBJ, MTL, JPG | 6.4K, textured, 1.47 MB | Gray stone, tiled grate, chimney. Cheap and clean. |
| | Stone Medieval Fireplace with Burning Fire | `/stone-medieval-fireplace-with-burning-fire-QGLGAE4` | OBJ, MTL, PNG | 44.3K, textured, 228 MB | Rough-hewn stones with timber beam, best looks but 7x heavier. Decimate or use as reference. |
| | Stone Hearth Fireplace with Wood Beam | `/stone-hearth-fireplace-with-wood-beam-HT5B6VR` | OBJ, MTL, PNG | **5.7M** polys | Do not use, far too heavy. |

### 2. Wall shelves / bookshelf (books, jars, bottles)

| | Name | URL | Formats | Poly / textures | Style note |
|---|---|---|---|---|---|
| ★ | Scrolls & Books Set - Hand Painted Series (BITGEM) | `/scrolls-books-set-hand-painted-series-TAM2THH` | FBX, BLEND, USDZ, PNG | ~500, textured | Books, scrolls, ink bottle to place on your own plank shelf. |
| | Tavern Block Set - Cube World (BITGEM) | `/tavern-block-set-cube-world-EPUPCHM` | FBX, BLEND, USDZ, PNG | 1.5K, textured, 3 LODs | Blocky: shelves, beer, food, bar, bed. Style clash. |
| | Rustic Jugs and Wine Bottles Collection | `/rustic-jugs-and-wine-bottles-collection-YF6CUCF` | OBJ, MTL, PNG | 36.3K, textured | Jugs/bottles in baskets, split and decimate. |

Full bookcases found are heavy (Tall slender bookcase `/tall-slender-wooden-bookcase-with-arched-detail-an-YFDCV73` is 143.6K polys). Build shelves from planks and populate with the items above.

### 3. Lantern / sconce / candle holder

| | Name | URL | Formats | Poly / textures | Style note |
|---|---|---|---|---|---|
| ★ | Lit candle on brass candlestick with ring | `/lit-candle-on-brass-candlestick-with-ring-DGV8WL3` | OBJ, MTL, PNG | 4K, textured, 30.8 MB | Simple brass. |
| | 3D Wooden Torch With Burning Flame (nyalastd) | `/3d-wooden-torch-with-burning-flame-EE45ELB` | FBX, OBJ, BLEND, PNG | **2.2M**, no textures | Wall torch idea but needs full retopo. |
| | Domed metal lantern with handles and surface wear | `/domed-metal-lantern-with-handles-and-surface-wear-3F5KJ3E` | OBJ, MTL, PNG | 226.9K, textured | Too heavy. Build your own. |

### 4. Tavern window (optional)

Nothing suitable as a 3D model. Closest: `/stone-wall-alcove-with-arch-VVGPLT2` (TurboSquid, specs not fetched) and `/carved-wooden-panel-with-symmetrical-design-3KN5VKY`. Recommendation: procedural.

### 5. Chairs / benches / stools

| | Name | URL | Formats | Poly / textures | Style note |
|---|---|---|---|---|---|
| ★ | Dark Brown Slatted Wooden Chair | `/dark-brown-slatted-wooden-chair-28EHX3D` | FBX, OBJ, MTL, PNG, TGA | 1.6K, textured | Plain tavern chair. |
| | Distressed Wooden Dining Chair | `/distressed-wooden-dining-chair-XHRL4RB` | not checked | - | Weathered look, check page before download. |
| | Bench with slatted wood seat and curved metal frame | `/bench-with-slatted-wood-seat-and-curved-metal-fram-VTRSJM9` | not checked | - | Modern metal frame, probably does not fit. |

### 6. Barrels, crates, sacks

| | Name | URL | Formats | Poly / textures | Style note |
|---|---|---|---|---|---|
| ★ | Wooden Barrel Set - Hand Painted Series (BITGEM) | `/wooden-barrel-set-hand-painted-series-Q6A6LY4` | FBX, BLEND, USDZ, PNG | ~500, textured, 14.1 MB | 5 barrels, tagged tavern/medieval. |
| ★ | Wooden Crate v2 (Desertsages) | `/wooden-crate-v2-RQDK3Y6` | FBX, OBJ, BLEND, MTL, PNG | 1.1K, 4K PBR set | UV unwrapped, albedo/rough/normal/metal/height. |
| | Treasure Chest (Desertsages) | `/treasure-chest-8WGB594` | FBX, OBJ, BLEND, PNG | 2.7K, 4K PBR set | Mossy, water damaged. |
| | Cartoon wood barrel prop (Luckyash) | `/cartoon-wood-barrel-prop-CWDNKNQ` | BLEND | 160.8K, no textures | Too heavy. |

No sack model verified. Sacks are trivial to fake (deformed sphere with a cloth texture).

### 7. Table props (potions, scroll, tankard, candles, coins, quill/inkwell, map)

| | Name | URL | Formats | Poly / textures | Style note |
|---|---|---|---|---|---|
| ★ | Scrolls & Books Set - Hand Painted Series (BITGEM) | `/scrolls-books-set-hand-painted-series-TAM2THH` | FBX, BLEND | ~500, textured | Includes ink bottle and scrolls. |
| ★ | Cartoon wooden tankard cup asset (Luckyash) | `/cartoon-wooden-tankard-cup-asset-F59MF3H` | **GLB**, OBJ, MTL | 6.7K, no textures (flat colour) | Part of a medieval 3D illustration pack, cartoon look. |
| | 3D Fantasy Wooden Tankard Game Asset (nyalastd) | `/3d-fantasy-wooden-tankard-game-asset-5GKD87F` | FBX, OBJ, BLEND, PNG | 15.6K, no textures | Rivets and purple gem. |
| | Fantasy health potion bottle (slabdsgn) | `/fantasy-health-potion-bottle-45L7J9E` | BLEND | 26K, no textures | Heavy for a bottle, decimate. |
| | Antique Geographic Map with Illustration | `/antique-geographic-map-with-illustration-M49EPJ6` | OBJ, MTL, PNG | 11.7K, textured | Stack of paper. Better as textured plane. |
| | Ancient Gold Coin with Cross and Lion Motif | `/ancient-gold-coin-with-cross-and-lion-motif-TBLDYYU` | not checked | - | Instance one coin many times. |

Coins, quill, candles: make procedural or instance (very cheap). Many Envato potion models are 25K+ polys.

### 8. Shield / weapon rack (optional)

| | Name | URL | Formats | Poly / textures | Style note |
|---|---|---|---|---|---|
| ★ | Medieval Buckler Shield: Wood and Steel | `/medieval-buckler-shield-wood-and-steel-protection-KN4H525` | FBX, OBJ, MTL, **GLTF**, PNG/JPG/TGA | 4.5K, textured, 55.7 MB | Round wooden buckler. |
| | Medieval Kite Shield with Dragon & Arrow Crest | `/medieval-kite-shield-with-dragon-arrow-crest-UBE833B` | FBX, OBJ, MTL, PNG, TGA | 6.2K, textured | Painted heraldic, strong wall decoration. |

Weapon racks exist only as 2D renders. Skip.

### 9. Stone/plaster wall and wooden floor materials

Envato offers texture packs (`/graphics/stone-wall-texture`, e.g. `/stone-wall-textures-vol-2-x10-NUT37C2`, `/set-of-5-different-stone-wall-textures-7YKZR7D`) but none states PBR maps. Recommendation: use CC0 PBR from Poly Haven or ambientCG at 1K (no license friction), keeping Envato for models only.

### 10. All-in-one tavern interior pack

Not found. Closest options: BITGEM Tavern Block Set (blocky, `/tavern-block-set-cube-world-EPUPCHM`, 1.5K polys) and TurboSquid "Grand Castle Library Interior - Low Poly" (`/grand-castle-library-interior-low-poly-UB4T242`, 45K polys, FBX/OBJ, textured, castle not tavern). Neither fits the target look.

## License notes

Source: Envato Elements License and Terms (the `/license-terms` page redirects to help.elements.envato.com and returned 403 to the fetcher, so the points below come from Envato's help-center license article via search).

- One short quote: "You can use an Item to create an End Product for yourself or for a client of yours."
- Each download gives a commercial license for one specified project. Register the item per project/End Product when downloading.
- The license is valid only if the End Product is completed while the subscription is active; once completed, it continues for the life of that End Product.
- Websites are valid End Products. Items must not be extracted or redistributed standalone: shipping the raw model files in a public repo or downloadable assets is risky. Converted `.glb` files embedded in the deployed site are a grey area (they are publicly fetchable). Check Envato's FAQ, or keep the GLBs obfuscated/minimal. Do not publish them in a public GitHub repo.
- Since the subscription belongs to the user's friend: the project is registered under the friend's account; confirm with Envato license text that the friend is the one making/transferring the End Product, or have the friend download and register for "the user's portfolio", or get your own subscription.
- Each item's own author terms/stated restrictions still apply (read on the item page). I did not sign in or download anything.

## Conversion notes

1. Download archives to a folder outside the repo (e.g. `~/Downloads/envato/`), never commit archives or OBJ/FBX originals. Add `docs/` to the repo but keep `public/models/` source-controlled only for the final `.glb`.
2. Import in Blender (FBX/OBJ/glTF). Apply transforms, set one scale unit across all pieces, set origin to base-center, delete hidden faces, and decimate anything over 20K tris.
3. Unify materials: downscale textures to 1K (2K for fireplace only), keep albedo + (normal) + packed ORM, tint albedos warm, merge many props onto a shared atlas where possible.
4. Export `.glb` and compress: `gltf-transform optimize in.glb out.glb --compress draco --texture-compress webp` (or `--compress meshopt` if you prefer faster decode on phones). Document versions per official gltf-transform docs when setting up.
5. Place under `public/models/<slot>/` (`fireplace/`, `barrels/`, `books/`, `chairs/`, `crates/`, `candles/`, `shields/`), load with Three.js `GLTFLoader` + `DRACOLoader`/`MeshoptDecoder`.
6. Budget check: sum `.glb` sizes against 2-5 MB, and test on a mid phone.
