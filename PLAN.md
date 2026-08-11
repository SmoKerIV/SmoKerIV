# The Adventurer's Table — Three.js Fantasy Portfolio Overhaul

A full rebuild of smokeriv.com as an immersive 3D fantasy experience: you sit at a
candle-lit table in an inn, a spellbook in front of you holding everything about
Baker Alazzawi — with swords, shields, potions and runes filling out the scene.
Inspiration: D&D, Skyrim, The Witcher 3 (Kaer Morhen library / tavern vibes).

---

## 1. The Concept

**Opening shot:** the camera fades in from black facing a heavy wooden table in a
dim inn. A fire crackles somewhere off-screen, candles flicker, dust motes drift
through warm light. On the table: a large leather spellbook (center), a sword, a
shield, potion bottles, a rolled scroll, a d20, and a tankard. A faint rune circle
glows under the spellbook.

**Core loop:** hover an item → it glows softly and a nameplate appears ("Tome of
the Developer", "Blade of Experience"...). Click → the camera dollies in
cinematically. The spellbook opens with animated page flips and becomes the actual
content of the site. Press Escape / click "return" → camera pulls back to the table.

The whole site *is* the scene. No traditional navbar — the table is the navigation.

## 2. Scene Inventory & Content Mapping

| Object | Placement | Interaction | Content |
|---|---|---|---|
| **Spellbook** (hero object) | Center, on glowing rune circle | Opens; pages flip | ALL main content — see §3 |
| **Sword** | Right side, angled on table | Inspect view (camera orbits it) | "Arsenal" — skills/tech stack as enchantments on the blade |
| **Shield** | Left, leaning/laying | Inspect view | Experience crest — companies as heraldry with years |
| **Potion bottles** (2–3) | Back left cluster | Hover flavor / small inspect | Fun stats: caffeine level, uptime, side-project mana |
| **Scroll** | Front right | Unrolls | Contact — "Send a raven": email, GitHub, LinkedIn, phone, Instagram |
| **d20 die** | Near front edge | Click to roll (physics-lite tumble) | Random flavor: crit = confetti of sparks + fun message |
| **Tankard** | Back right | Hover flavor only | "// coffee, technically" |
| **Candles** (2–3) | Corners of table | Ambient; flames flicker, drive lighting | — |
| **Rune circle** | Under spellbook, table surface | Pulses on hover of book | — |
| **Inn room shell** | Walls, window (night sky), fireplace glow off-frame | Ambient parallax | — |

Keep sword/shield content *thin* (a floating label list) — the spellbook is the real
site; the rest is atmosphere with just enough payoff to reward clicking.

## 3. The Spellbook (main content)

Two-layer approach for readability + fidelity:

1. **3D layer:** the actual book mesh opens on the table (cover swings, a few
   placeholder pages flip) while the camera moves to a top-down reading angle.
2. **DOM layer:** once the camera settles, a full-screen DOM "book" crossfades in,
   pixel-matched to the 3D book's position — parchment texture, ink typography,
   CSS 3D page-flip animations. All real content lives here (selectable text, links,
   accessible, easy to edit).

This is how most polished sites do it (readable text in WebGL is pain). Later, if we
want to go full 3D, the DOM book can be swapped for render-to-texture pages without
touching content.

**Page spreads (each is a two-page spread with a hand-drawn feel):**

1. **Cover page / Title** — "The Tome of Baker Alazzawi" + illuminated capital, crest
2. **Whoami** — character-sheet style: Name, Class (Full-Stack Software Developer),
   Origin (Baghdad, Iraq), Alignment (Chaotic Shipper), Status (available for quests),
   stat bars (STR = backend, INT = TypeScript, WIS = debugging, CHA = UI...)
3. **Skills / Spells known** — tech stack as a spell list with school-of-magic icons:
   TypeScript, React, Vue, Node, Express, NestJS, Next, Nuxt, Supabase, Firebase,
   Linux, PostgreSQL, Docker, Prisma, Drizzle
4. **Career / Quest Log** — chronological quests: Qi Card (Jul 2025—present, ACTIVE),
   Alrabiaa TV, Puretik, Aon, Vitex, Makers of Baghdad — each with a quest-completed
   seal and one-line "quest summary"
5. **Projects / Grimoire of Creations** — project cards as summoned artifacts with
   links (needs real project list — currently placeholder entries)
6. **Rune page** — pure decoration: a full spell circle, runic alphabet, margin
   scribbles ("do not summon in prod")
7. **Contact / Send a Raven** — same as scroll content, plus a wax-seal styled
   mailto button
8. **Back matter** — colophon ("bound in Baghdad, powered by caffeine"), easter egg
   hint page

Navigation: click page corners / arrow keys / edge tabs (leather bookmarks) to jump
to sections. Deep links: `#/book/career` etc. so the site is still shareable/SEO-ok.

## 4. Look & Feel

- **Palette:** near-black brown shadows, warm amber candlelight, parchment cream,
  oxblood leather, tarnished gold, and one magic accent (arcane teal-green for
  runes/glows — Witcher-sign vibes).
- **Lighting:** one warm key (fireplace, off-camera left), candle point lights with
  subtle flicker (sin-noise, not random jitter), cool moonlight rim from a window,
  arcane glow under the book. Fog for depth.
- **Typography (DOM):** Cinzel / Cinzel Decorative for headings, IM Fell English or
  EB Garamond for body, a runic display font for decorations. Keep body text highly
  readable — fantasy is in the headings and ornaments.
- **UI chrome:** everything themed — buttons are wax seals / metal clasps, panels are
  parchment or stretched leather, dividers are sword/knotwork flourishes, cursor can
  be a subtle gauntlet/quill on interactables.
- **Motion:** slow, heavy, cinematic. Camera eases (no snappy UI tweens in 3D).
  Idle camera drift + mouse parallax (a few degrees) so the scene always breathes.

## 5. Audio

- **Ambient loop:** tavern/fireplace ambience + soft fantasy score. Files go in
  `public/audio/` (`ambient.mp3`, optional `tavern-music.mp3`).
  - *Placeholder until you pick real tracks:* WebAudio-synthesized fire crackle +
    low wind so the toggle works day one. Recommended sources for real tracks:
    Kevin MacLeod (CC-BY), Tabletop Audio (CC-BY-NC — check license fit), or a
    purchased loop from AudioJungle/Epidemic.
- **SFX:** page flip, book thump, sword shing on hover, cork pop, dice clatter,
  candle whoosh. Also placeholder-synthesized first; swap for real samples later.
- **Rules:** nothing autoplays — browsers block it anyway. Music starts only after
  the user clicks the toggle (or the "enter the inn" button on the loader, which
  counts as a user gesture). Toggle lives in the settings panel + a small
  lute/note icon in the corner HUD. Volume persisted in localStorage.

## 6. Settings ("The Innkeeper's Ledger")

A parchment panel, opened via a hanging wooden sign / gear-as-compass icon:

- Music on/off + volume, SFX on/off
- Quality: Low / Medium / High (pixel ratio, shadows, particle count, postFX)
- Reduce motion (disables idle drift, parallax, long camera moves — also auto-honors
  `prefers-reduced-motion`)
- Reset camera / return to table
- "Boring mode" link → plain HTML fallback (see §9)

## 7. Loading Screen

Fantasy-first impression: dark screen, a rune circle that draws itself in as progress
(procedural assets load near-instantly today, but this future-proofs for real GLTF
models), flavor lines cycling — "Lighting the candles…", "Sharpening the blade…",
"Bribing the innkeeper…". Ends with **"Enter the Inn"** button (doubles as the audio
user-gesture). Show a skip immediately for return visitors.

## 8. Easter Eggs (retheme the existing ones — they're good)

- `sudo` terminal → **incantation console**: type "speak friend" style commands.
  Keep the existing commands, rethemed (`whoami` → character sheet dump, `hack` →
  "casting fireball…", matrix → falling green runes, `flip` → table flip (the whole
  3D table!), `dance` → tankard wobble).
- Konami code → dragon flies past the window / +30 XP banner stays.
- Typing `light`/`dark` → time-of-day shift (candles vs. dawn through window).
- `hire` → quest-offer parchment toast ("An employer approaches with a quest…").
- New ideas: click the candle 5× to snuff it (screen goes near-dark, relight match
  sound); nat-20 on the d20 unlocks a golden book skin; a mouse hole in the wall.

## 9. Tech Architecture

```
src/
  main.ts
  App.vue                    — canvas + overlay orchestration
  style.css                  — fonts, parchment/ink theme, page-flip CSS
  data/
    content.ts               — ALL portfolio content in one typed file
  three/
    types.ts                 — ItemId, SceneManager API, event + settings contracts
    SceneManager.ts          — renderer, loop, resize, dispose
    CameraRig.ts             — idle drift, parallax, gsap focus transitions
    lights.ts                — key/rim/candles + flicker
    particles.ts             — dust motes, embers, book sparkles
    interaction.ts           — raycaster hover/select, emissive highlight
    models/
      index.ts  table.ts  spellbook.ts  sword.ts  shield.ts  potion.ts
      scroll.ts  dice.ts  tankard.ts  candle.ts  runeCircle.ts  room.ts
      materials.ts textures.ts — shared canvas-generated textures (wood, leather, parchment)
  components/
    LoaderScreen.vue  BookOverlay.vue  BookPage*.vue  ItemTooltip.vue
    SettingsPanel.vue  HudBar.vue  IncantationConsole.vue  FallbackView.vue
  composables/
    useAudio.ts  useSettings.ts  useSceneBridge.ts
```

- **Stack:** keep Vue 3 + Vite + Tailwind + GSAP; add `three` (plain, no TresJS —
  full control over one cinematic scene, no wrapper overhead).
- **Contract-first:** `three/types.ts` defines the SceneManager API + events so the
  3D layer and the Vue overlay develop independently.
- **State:** tiny — `focusedItem`, `settings`, `audioState` via composables;
  scene emits events, Vue commands the scene. No pinia needed.
- **Fallbacks:** WebGL unavailable / `?flat=1` → `FallbackView.vue`, a parchment-
  styled plain HTML version of the book content (also the SEO/noscript story:
  render key content in index.html noscript block).
- **Mobile:** portrait gets a closer camera framing all items vertically-ish, tap =
  hover+select, DOM book goes single-page spreads, particle counts drop. Test at
  390×844.

## 10. 3D Assets — placeholder now, real models later

**Phase A (now):** everything procedural low-poly — built from Three.js primitives +
lathe/extrude geometries, canvas-generated textures (wood grain, leather, parchment,
runes). Stylized flat-shaded look reads as intentional art direction, not
programmer-art, when lighting/fog is right.

**Phase B (upgrade path):** each `models/*.ts` exposes `build*(): Group` — swapping
in a GLTF is a drop-in change inside one file (`GLTFLoader` + same pivot/scale
conventions: item pivot at its resting contact point, Y-up, real-world meters,
table surface at y = 0.95).

Where to get real models later: Sketchfab (CC), Quaternius / Kenney (CC0 fantasy
packs — actually very good for this style), KayKit dungeon pack (CC0), or
commission/Blender your own. Keep total under ~5 MB compressed (draco/meshopt).

## 11. Performance Budget

- 60 fps on mid laptop iGPU, < 200 draw calls, < 150k tris (procedural set is ~20k)
- `renderer.setPixelRatio(min(devicePixelRatio, 2))`, cap 1.25 on Low
- Shadows: single 1024 map from key light only (off on Low)
- Pause render loop on `document.hidden`; damp to 30fps when idle > 60 s
- Dispose everything on HMR (`import.meta.hot`) to avoid dev leaks

## 12. Accessibility

- Full keyboard path: Tab cycles items (visible focus ring in 3D = highlight +
  nameplate), Enter selects, Escape backs out
- DOM book = real text: headings, landmarks, alt text, focus trap while open
- `prefers-reduced-motion` honored automatically
- Contrast: ink-on-parchment must pass AA (dark #2a1f14 on #e8dcc0 passes)
- The flat fallback is always one click away

## 13. Milestones

1. **M1 — Foundation** ✅ deps, contracts, content data, plan
2. **M2 — The Table** — procedural models + lit scene + camera + hover/select
3. **M3 — The Book** — open animation + DOM book overlay with all content
4. **M4 — Sound & Settings** — audio manager, settings panel, loader screen
5. **M5 — Flavor** — sword/shield/scroll/dice interactions, easter eggs, idle life
6. **M6 — Hardening** — mobile, a11y, fallback, perf pass, SEO/meta, deploy
7. **M7 (later) — Real assets** — GLTF models, real music/SFX, maybe postFX bloom

M2–M4 are being built in parallel by agents now; M5–M6 partially included, rest
follows.

## 14. Things you didn't mention that you'll want (suggestions)

- **An "Enter the Inn" gate on the loader** — solves audio autoplay AND gives the
  scene a moment to warm up. Skippable.
- **Deep links / routing** (`#/book/projects`) — otherwise you can't share your
  projects page or link it from a CV.
- **SEO + social cards** — a 3D site is invisible to crawlers; put name/title/links
  in meta + noscript, and make a nice OG image (screenshot of the table).
- **Real project list** — current site has no projects section; the grimoire page
  ships with placeholders you should replace.
- **CV download** — a rolled parchment on the table or a book bookmark →
  `baker-cv.pdf`. Recruiters need the boring artifact.
- **Analytics event hooks** — know how many visitors open the book vs. bounce at
  the loader (Plausible/Umami are cookie-free).
- **Idle "life"** — moth around a candle, ember pops, distant thunder every ~90 s.
  Cheap, and it's what makes a scene feel alive rather than a screenshot.
- **Time-of-day by clock** — visitor's local night = darker inn, more candle;
  day = sun shafts through window. Subtle but memorable.
- **A favicon/brand pass** — a small crest/rune replacing the Vite icon.
- **License hygiene for audio** — credit CC-BY tracks in the colophon page.

## 15. Risks / gotchas

- **Text readability in 3D** is the #1 killer of book-style sites → solved via DOM
  overlay (§3).
- **Autoplay policies** — no audio before user gesture, ever.
- **Mobile GPU heat/battery** — quality autodetect (`navigator.hardwareConcurrency`,
  fail-down on slow first frames).
- **Scope creep on models** — the procedural set is 80% of the vibe; don't block
  launch on "real" assets.
- **GSAP + three both animate** — one clock: GSAP drives camera/one-shot anims,
  the render loop drives continuous ones (flicker, particles). Don't mix per-frame.

---

# ROUND 2 — Feedback pass (the diegetic tome)

Owner feedback after the first build: the tome content must live ON the book
that's on the table — not in a second overlay book. Plus bugs and polish.

## R2.1 The Diegetic Book (the big change)

**Problem:** clicking the spellbook opens a *separate* DOM book over a dimmed
backdrop. It reads as a modal, not as "I leaned over the table to read the book."

**New design:** the camera settles into the top-down reading pose and the text
appears to be inked directly on the 3D book's open pages:

- The 3D layer computes, every frame, where each open page sits on screen
  (project the 4 corners of each page plane) and hands the UI two CSS
  `matrix3d` transforms (`onBookPageTransforms` event, `PAGE_CSS_W/H` logical
  page size in `types.ts`).
- The DOM layer renders each spread as two *transparent* text panes (ink on
  nothing — the parchment is the 3D page itself) transformed by those matrices.
  Text stays selectable, links clickable, crisp at any zoom, and it *sticks to
  the pages* even while the camera sways idly.
- No dimmed backdrop, no leather frame chrome. Bookmarks become small floating
  tabs at the screen edge; "Return to the table" stays as a floating strap.
- Page turns: a 3D page-flip animation + the DOM ink crossfades between
  sections mid-flip.
- The 3D open book gets bigger, flatter open pages (redone open-state geometry:
  two full page planes + a low arch) so there's real estate to read on.
- **Mobile / coarse pointers: the boring version.** Tapping the book opens the
  plain scrollable parchment page (FallbackView content, "the boring CV") —
  aligned 3D text on a 6" screen is unreadable, so don't pretend.

## R2.2 Bugs found by the owner

| Bug | Root cause | Fix |
|---|---|---|
| Hovering the scroll highlights parts of the table | Models share cached materials; the hover effect boosts emissive on the *shared* material, so every mesh using it glows | Clone materials per interactable group at stage build |
| Clicking either candle zooms to the LEFT one | Focus pose anchors to the first-registered group per ItemId | Track the actual picked instance; anchor camera to it |
| 5-click candle snuff doesn't exist | Was listed as an idea, never implemented | Implement (below) |
| Dice roll is floaty, weightless | It's a canned gsap rotation tween | Real mini-physics (below) |

## R2.3 The d20 gets real weight

Small bespoke integrator (no physics lib for one die): gravity, toss with
random angular velocity, bounce off the tabletop with restitution ~0.35 and
angular damping per bounce, friction slide, then settle: snap to the nearest
face-up orientation. The reported roll = the face that's actually up
(icosahedron face-normal → value map), so the toast never lies. Thunk SFX hook
on each bounce, scaled by impact.

## R2.4 Candle snuff easter egg (and instance-correct candles)

- 5 clicks on the *same candle* within a rolling window → the flame hisses out:
  flame hidden, its light fades, a small smoke wisp rises. One click relights it.
- Both candles out → the table goes properly moody + a toast ("The darkness
  is grateful."). New `onCandleSnuff` scene event so the UI can react.
- Picking now works on the focused item too (so you can click the candle you're
  looking at).

## R2.5 Typography — old literature

Body text moves to **EB Garamond** (the classic old-book face, digitized from
16th-century Garamond punches) with real italics for flavor lines; tome
headings/drop caps go to a medieval display face (**Uncial Antiqua** /
**Almendra SC**); Cinzel stays only for small HUD caps. Slightly larger body
size + looser leading (Garamond runs small), ink color unchanged.

## R2.6 Easter egg audit

Working: `sudo`/`magic` (console), `hire`, console `light`/`dark` (now really
change time-of-day), `cast fireball`, `roll`, `rm -rf /`.
Missing vs. the old site / plan — to add:
- **Konami code** → "+30 XP" banner (and a sparkle burst)
- Console `matrix` → falling green *runes* overlay (~6 s)
- Console `flip` → the whole view flips 360° (CSS, cheap, funny)
- Console `coffee`, `42`, `hack` (alias of fireball), `dance` (screen wobble)
- Candle 5-click snuff (R2.4)

## R2.7 Suggestions to push the "reading at the table" feel further

- **Hide ALL chrome while reading** — HUD fades out; only page tabs + return
  strap remain. The screen should be: table, book, hands-off UI.
- **Ink write-on**: first visit to a section, the heading strokes itself in
  (SVG stroke-dashoffset) like a quill finishing the line.
- **Page-corner curl on hover** over the next-page corner.
- **Quill cursor** over the open book.
- **Sound**: dry page-scratch on flip, low wood creak when leaning in
  (camera transition), quill scribbles rarely while idle on a page.
- **Bookmark ribbon** IN the 3D book (red cloth) marking the section you left.
- **Later (M7)**: bake the DOM ink into page textures for screenshots/OG so the
  3D book carries real text even in previews.

## R2.8 Execution

- Wave 1 (parallel): Agent A = diegetic book + mobile fallback (owns
  SceneManager/CameraRig/spellbook model/BookOverlay/App). Agent B = fonts +
  console eggs (owns style.css/index.html/tailwind/IncantationConsole/
  FallbackView).
- Wave 2 (after): Agent C = dice physics + material-clone fix + candle
  instance/snuff + konami (owns interaction/dice/SceneManager edges + small
  App additions).
- Then: integrate, verify in browser, regenerate og.png.
