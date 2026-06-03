import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" makes the built site path-relative, so the static bundle can be
// dropped at any URL (root or sub-path, e.g. GitHub Pages /repo/) and still
// resolve its assets + bundled game content. Routing is hash-based (see App.jsx)
// so deep links work with no server rewrites.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 800,
  },
});
