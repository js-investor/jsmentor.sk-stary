import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import path from "path";
import twConfig from "./tailwind.config";

/**
 * Samostatný build jednej kalkulačky: `CALC=<slug> npx vite build --config standalone/vite.config.ts`.
 * Všetky assety (písma) sa vložia ako data URI; JS je jeden súbor. standalone/inline.py potom
 * vloží JS a CSS priamo do HTML, takže vznikne jeden prenosný súbor. Slugy: standalone/build-all.sh.
 */
const calc = process.env.CALC ?? "rentova-kalkulacka";

export default defineConfig({
  root: __dirname,
  base: "./",
  publicDir: false,
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss(twConfig as never), autoprefixer()] } },
  resolve: { alias: { "@": path.resolve(__dirname, "../src") } },
  build: {
    outDir: path.resolve(__dirname, `../.standalone-dist/${calc}`),
    emptyOutDir: true,
    assetsInlineLimit: 50 * 1024 * 1024,
    cssCodeSplit: false,
    modulePreload: { polyfill: false },
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      input: path.resolve(__dirname, `${calc}.html`),
      output: { inlineDynamicImports: true, entryFileNames: "app.js", assetFileNames: "app.[ext]" },
    },
  },
});
