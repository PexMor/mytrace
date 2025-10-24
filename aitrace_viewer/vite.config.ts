import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [preact()],
  base: './', // Relative base for flexible hosting
  build: {
    outDir: resolve(__dirname, '../docs/app'),
    emptyOutDir: true,
    assetsDir: 'assets',
  },
  publicDir: 'public',
});