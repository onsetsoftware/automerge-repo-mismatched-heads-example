import { type Doc, load, save } from "@automerge/automerge";

/**
 * node-vite seems to have issues with the wasm plugin,
 * so I have extracted this function to a separate package.
 */
export function checkDoc(doc: Doc<unknown>) {
  load(save(doc));
}
