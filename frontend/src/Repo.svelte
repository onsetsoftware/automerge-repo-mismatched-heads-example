<script lang="ts">
  import { DocHandle, type DocumentId, Repo, type PeerId } from "automerge-repo";
  import { type Readable, readable, writable } from "svelte/store";
  import { LocalForageStorageAdapter } from "automerge-repo-storage-localforage";
  import localforage from "localforage";
  import { BrowserWebSocketClientAdapter } from "automerge-repo-network-websocket";
  import type { DocStructure } from "./types";

  export let name: string;

  const loaded = writable<boolean>(false);

  const repo = new Repo({
    storage: new LocalForageStorageAdapter(),
    network: [new BrowserWebSocketClientAdapter("ws://localhost:3030")],
    peerId: name as PeerId,
  });

  let main: Readable<DocStructure>, handle: DocHandle<DocStructure>;

  let ready = false;

  const setupRepo = () => {
    if (ready) return;
    ready = true;
    localforage.getItem("rootDocId").then((docId) => {
      handle = repo.find(docId as DocumentId);

      const initialState: DocStructure = {
        counter: { updatedAt: 0, value: 0 },
        text: { updatedAt: 0, value: "" },
      };

      main = readable<DocStructure>(
        docId ? handle.doc : initialState,
        (set) => {
          const listener = async ({ handle }) => {
            const value = await handle.value();
            set(value);
            setTimeout(() => {
              console.log(name, value.counter.value);
            });
            loaded.set(true);
          };
          handle.on("change", listener);

          return () => {
            handle.off("change", listener);
          };
        }
      );
    });
  };

  setupRepo();

  export function incrementCount(n: number) {
    for (let i = 0; i < n; i++) {
      handle.change((doc: DocStructure) => {
        doc.counter.value ? doc.counter.value++ : (doc.counter.value = 1);
        doc.counter.updatedAt = Date.now();
      });
    }
  }
</script>

{#if $loaded}
  <div class="grid grid-cols-2">
    <div>
      Main Count: {$main.counter.value}

      <div>
        <button
          on:click={() => incrementCount(20)}
          class="bg-amber-300 text-amber-800 p-2 rounded px-4"
        >
          Increment Many</button
        >
      </div>
      <div class="mt-1">
        <button
          on:click={() => incrementCount(1)}
          class="bg-blue-300 text-blue-800 p-2 rounded px-4"
        >
          Increment 1</button
        >
      </div>
    </div>
  </div>
{/if}
