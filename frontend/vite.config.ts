import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import wasm from "vite-plugin-wasm";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte(), wasm()],
  optimizeDeps: {
    exclude: [
      "automerge-repo",
    ],
  },
});
