import { defineConfig } from "vite";
import path from "path";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

const resolvePath = (str: string) => path.resolve(__dirname, str);

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    target: "esnext",
    lib: {
      entry: resolvePath("src/index.ts"),
      name: "AutomergeRepoNetworkSupabase",
      fileName: (format) => `automerge-repo-network-supabase.${format}.js`,
    },
  },
  plugins: [
    topLevelAwait(),
    wasm(),
  ],
});
