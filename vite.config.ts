import { defineConfig, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";

/**
 * Fonts the loader screen paints (Cinzel 400 for the counter and status
 * line, 600 for the wax button): preload their hashed build URLs so they
 * arrive with the stylesheet instead of after it. Build only — in dev the
 * bundle is empty and nothing is injected.
 */
const PRELOAD_FONTS = [/^assets\/cinzel-latin-400-normal-.+\.woff2$/, /^assets\/cinzel-latin-600-normal-.+\.woff2$/];
function preloadFonts(): Plugin {
  return {
    name: "preload-loader-fonts",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        const files = Object.keys(ctx.bundle ?? {});
        return PRELOAD_FONTS.flatMap((re) => files.filter((f) => re.test(f))).map((file) => ({
          tag: "link",
          attrs: {
            rel: "preload",
            as: "font",
            type: "font/woff2",
            href: `/${file}`,
            crossorigin: "",
          },
          injectTo: "head-prepend" as const,
        }));
      },
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    preloadFonts(),
    vue({
      template: {
        compilerOptions: {
          whitespace: "preserve",
        },
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // three core in its own long-lived chunk: it changes only when the
        // dependency does, so it stays cached across app deploys. The
        // examples addons (loaders, post chain) are lazy chunks of their own.
        manualChunks(id) {
          if (id.includes("/node_modules/three/build/")) return "three";
        },
      },
    },
    // three's minified core alone is ~600 kB and cannot be split further
    // (it is already isolated above and loaded only for the 3D scene), so
    // the default 500 kB warning would always fire for it. Everything else
    // stays well under this.
    chunkSizeWarningLimit: 700,
  },
});
