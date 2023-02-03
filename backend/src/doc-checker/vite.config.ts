import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import path from "path";
import dts from "vite-plugin-dts";
import { externalizeDeps } from "vite-plugin-externalize-deps";

const resolvePath = (str: string) => path.resolve(__dirname, str);

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    rollupOptions: { output: { format: "es" } },
    target: "esnext",
    lib: {
      formats: ['es'],
      entry: resolvePath("src/index.ts"),
      name: "DocChecker",
      fileName: 'doc-checker',
    },
  },
  plugins: [
    topLevelAwait(),
    wasm(),
    dts({
      entryRoot: resolvePath("src"),
      outputDir: resolvePath("dist/types"),
    }),
    externalizeDeps(),
  ],
  optimizeDeps: {
    exclude: [
      "@automerge/automerge-wasm",
    ],
  },
});
