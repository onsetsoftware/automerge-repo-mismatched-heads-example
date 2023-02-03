import { type Doc } from "@automerge/automerge";
/**
 * node-vite seems to have issues with the wasm plugin,
 * so I have extracted this function to a separate package.
 */
export declare function checkDoc(doc: Doc<unknown>): void;
