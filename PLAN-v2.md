# SmoKerIV v2 — fix, update, polish

Source of truth for this round. Three phases, run in order; each segment is one
commit (or a few logical ones) on `main`, verified before the next phase starts.
Difficulty → model: low = haiku, medium = sonnet, high = opus.

---

## Phase 1 — Housekeeping & content

| # | Segment | Diff. | Model |
|---|---|---|---|
| 1.1 | **Cleanup.** Remove unused deps (`react-icons`, `@heroicons/vue`, `@iconify/vue`), template files (`src/assets/vue.svg`, `public/vite.svg`, `public/icon1.png`), pick one package manager (pnpm: drop `bun.lock`, commit `pnpm-lock.yaml`), write a real README. | low | haiku |
| 1.2 | **CV download.** Copy `~/Downloads/cv-2026/Baker Alazzawi CV.pdf` (Oct 5, 21:25 — the rewritten one) to `public/baker-cv.pdf`; the existing HEAD probe then shows the HUD + contact buttons. Add a CV link to the scroll card and the flat page too. | low | haiku |
| 1.3 | **Career update** (`content.ts` quests) to match the CV, keeping Vitex: Enjaz (Qi Card) Jul 2025–now · Freelance 2024–now · Alrabiaa TV Feb–Jun 2025 · PureTik Jun 2024–Jun 2025 · Aon.iq trainer Oct–Dec 2024 · Vitex Jan–Jun 2024 · Makers of Baghdad Jul–Aug 2023 · ZainCash Jan–Feb 2023. Fantasy one-liners rewritten from the CV bullets. | low | sonnet |
| 1.4 | **Spells update.** Add Svelte 5/SvelteKit, Pinia, PrimeVue, Vuetify, Tailwind, SQLite, Electron, Nginx/PM2, Python; regroup schools so sword card stays readable. | low | haiku |
| 1.5 | **Artifacts.** Add Spellscene (spellscene.com, live) · Booking System (Electron + SQLite, offline club table booking — no link, private) · Asset Maintenance Hub (Electron + SQLite — no link) · work projects without links: Oil Coupon / SuperQi mini app (1M+ families), Alrabiaa ticketing with seat maps, Dr.Lab. Add an optional `status`/`kind` badge ("Live", "Desktop", "Work") and make the projects spread paginate if it overflows. | medium | sonnet |
| 1.6 | **Render `credits`** under the colophon (exported but never shown). | low | haiku |

## Phase 2 — Fix everything from the audit

| # | Segment | Diff. | Model |
|---|---|---|---|
| 2.1 | **Routing.** `hashchange`/`popstate` listener (open/turn/close book from the hash); hash updates from the flat page scroll-spy; add `runes` to the flat nav or map it sanely; Settings "return to table" dead branch. | medium | sonnet |
| 2.2 | **Layout bugs.** Define `--ink-faint` in `:root`; fix book clipping at ~1000px widths (fit the reading pose / overlay scale to viewport); mobile tap-hint overlapping "Open the tome". | medium | sonnet |
| 2.3 | **Scene correctness.** Resize: debounce, single source (ResizeObserver only), don't kill in-flight focus tweens; second-candle focus re-anchors; ignore non-primary buttons + handle `pointercancel`; `highlightNext` respects focus filter; `castShadow` only on solid meshes (no flames, rune plane, glass, room shell); contact shadow follows opened book; `flipBookPage` into `ISceneManager`; drop duplicate `setPaused`; fix stale comments; sky lookup by name not hex. | medium | sonnet |
| 2.4 | **Performance.** `shadowMap.autoUpdate=false` + manual `needsUpdate` on change; idle throttle (30 fps after 60 s idle, near-zero while reading with a still camera); no per-frame allocations in `emitPageTransforms`; pre-create fireball/lightning/impact lights (intensity 0) + `renderer.compileAsync` before ready so first cast doesn't hitch; dedupe textures (rune circle, dot, wood); `Particles.setQuality` no-op on same level; restore `lagSmoothing` on dispose; real loader progress. | high | opus |
| 2.5 | **Mobile framing.** Aspect-aware table pose and focus presets so the whole table fits at 390×844; tap shows the nameplate before selecting. | medium | sonnet |
| 2.6 | **Accessibility.** Focus trap + restore + `aria-modal` for Settings and Console; console blocks book arrow keys; live region announcing the keyboard-highlighted item; loader progress text; BookOverlay announces page title, not whole page; arrow-key roving in radio groups; raise tiny/faint text to AA (loader 30% text, 8–11px labels); console honors the in-app reduced-motion setting. | medium | sonnet |
| 2.7 | **SEO.** `og:url`/`og:image` → `https://bakeralazzawi.com` (domain from the CV), canonical, `og:image:alt` + dims, JSON-LD `Person`, `robots.txt` + `sitemap.xml`, `<noscript>` with the full content (skills, career, projects), preload fonts. | low | haiku |

## Phase 3 — Visual upgrade

| # | Segment | Diff. | Model |
|---|---|---|---|
| 3.1 | **The die.** Numbered d20: proper icosahedron UVs + canvas-drawn numbers 1–20 (opposite faces sum to 21), engraved/inked look; result read from the actual top face so the number shown = number reported. **Physics:** replace the hand-rolled integrator with `cannon-es` (pure JS, small) — convex d20 body, static colliders for the table, book, sword, shield, scroll, tankard, potions, candles; real tumbling, friction, restitution, settle detection, throw from the cursor/tap direction; dice clatter SFX on impacts. | high | opus |
| 3.2 | **Table items.** Upgrade each model (sword, shield, potions, scroll, tankard, candles, book): more geometry detail, better canvas textures (normal/roughness maps), wax drips, liquid in potions, shield heraldry. Decide per item: improved procedural vs. CC0 glTF (see open decision). | high | opus + sonnet per item |
| 3.3 | **Background / room.** Visible hearth with animated fire, stone/plaster walls, shelves with books and jars, hanging lantern, window with moon and drifting clouds, floor and chair; depth fog tuned. | high | opus |
| 3.4 | **Post-processing & lighting.** Bloom on flames/runes, vignette, subtle film grain, tone-mapping tune, soft shadows on high; all gated by the quality setting. | medium | sonnet |
| 3.5 | **UI polish.** "Enter the Inn" button on the loader (PLAN §7) with skip for returning visitors; book typography/ornaments; project cards with badges; focus card styling. | medium | sonnet |

## Phase 4 — Sound

Real recorded audio replaces the noise synth (the fire currently sounds like a
train). Sources: **CC0 only** (no attribution, safe to commit to the public
repo) plus sounds we synthesize ourselves; the WebAudio synth stays as fallback
when a file is missing. Ambience only — music comes later.

| # | Segment | Diff. | Model |
|---|---|---|---|
| 4.1 | **Sourcing.** Find CC0 candidates (Freesound CC0 filter, Kenney, OpenGameArt CC0, Sonniss-style CC0 packs) for every slot below; verify each licence on its page; list in `docs/sounds.md`. | low | sonnet |
| 4.2 | **Prep.** Trim, loudness-normalise (ffmpeg loudnorm), seamless loops for ambience, encode to Opus/WebM + AAC fallback, keep total < ~3 MB; into `public/audio/`. | medium | sonnet |
| 4.3 | **Audio engine.** Rework `useAudio.ts`: buffer cache + lazy loading after enter, buses (ambience / SFX / UI) with their own volumes, per-sound variations + random pitch/gain so repeats don't sound robotic, spatial panning for table items and the fireplace, ducking ambience under spell sounds, settings for each bus. | high | opus |
| 4.4 | **Ambience.** Fireplace crackle loop (layered with occasional pops synced to the ember particles), quiet room tone, wind/rain at the window, lantern creak. | medium | sonnet |
| 4.5 | **Spells.** Fireball (whoosh → ignite → impact), Call Lightning (crackle → thunder), Gust of Wind (rushing whoosh + candle gutter), Animate Objects (arcane shimmer + wooden clatter) — layered sample + synth. | medium | sonnet |
| 4.6 | **Interactions.** Book open/close thump, page turns (3+ variants), sword ring on focus, shield wood knock, potion cork pop + slosh, scroll unroll, tankard clink, candle snuff puff + match strike relight, dice on wood (variants), nat-20 chime, Konami fanfare, quest toast parchment rustle, soft UI hover ticks. | medium | sonnet |

## Phase 5 — Verify & ship

- `pnpm build` clean (vue-tsc + vite), no console errors.
- Screenshots at 1440, 1024, 390×844 (light + dark mood), every book spread, every focus card, die rolls showing correct numbers.
- Core Web Vitals + bundle size check (browser-qa harness); budget: main JS < 900 KB gz incl. three, assets < 5 MB.
- Kill dev servers.

---

## Open decision — 3D assets (needed before 3.2/3.3)

- **A. Improved procedural** (current approach, no downloads, full control, small bundle).
- **B. CC0 glTF models** (Poly Haven / Quaternius / KayKit) for room props and some items — much richer look, adds ~2–5 MB, each download confirmed with you first.
- **C. Mix** — procedural hero items (book, die, sword) + CC0 glTF for background clutter. *(Recommended)*
