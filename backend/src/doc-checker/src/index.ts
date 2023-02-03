import { type Doc, load, save } from "@automerge/automerge";

export function checkDoc(doc: Doc<unknown>) {
  try {
    load(save(doc));

    console.log("Doc is valid");
  } catch (e) {
    console.log("Document Error", e);
  }
}
