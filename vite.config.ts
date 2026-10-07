import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
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
