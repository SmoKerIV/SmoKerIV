# SmoKerIV

A 3D fantasy tavern portfolio for Baker Alazzawi, built with Vue 3, Three.js, GSAP, and Tailwind CSS. All 3D models and scenes are procedurally generated for a fully dynamic, immersive experience.

## Getting Started

Install dependencies:
```bash
pnpm install
```

Run the development server:
```bash
pnpm dev
```

Build for production:
```bash
pnpm build
```

Preview the production build locally:
```bash
pnpm preview
```

## Content

All portfolio content is managed in a single file: `src/data/content.ts`. Edit this file to update text, images, links, and metadata without touching the component structure.

For a plain text fallback, append `?flat=1` to the URL to load a simplified, non-interactive version.

## Project Layout

- **src/three/** — Three.js scene setup, procedural geometry, and rendering logic
- **src/components/** — Vue 3 components for UI, navigation, and overlays
- **src/composables/** — Reusable Vue composition functions for animations and state
- **src/data/content.ts** — Single content file for all portfolio data
