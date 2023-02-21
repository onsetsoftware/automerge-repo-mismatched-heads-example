<script lang="ts">
	import { data } from './Data';
	import { load, loadIncremental, save, init } from '@automerge/automerge';
  import Repo from "./Repo.svelte";
  import localforage from "localforage";
  import type {  DocHandle, DocumentId } from "automerge-repo";
  import { LocalForageStorageAdapter } from "automerge-repo-storage-localforage";
  import { BrowserWebSocketClientAdapter } from "automerge-repo-network-websocket";
  import { Repo as AutomergeRepo } from "automerge-repo";
  import type {  DocStructure } from "./types";

  let repo1, repo2;
  let ready = false;

  const repo = new AutomergeRepo({
    storage: new LocalForageStorageAdapter(),
    network: [new BrowserWebSocketClientAdapter("ws://localhost:3030")],
  });

  let documentId: DocumentId;

  const initialState: DocStructure = {
    counter: { updatedAt: 0, value: 0 },
    text: { updatedAt: 0, value: "" },
  };

  // const doc = loadIncremental(init(), data);

  const setupRepo = () => {
    if (ready) return;
    let handle: DocHandle<DocStructure>;

    localforage.getItem("rootDocId").then(async (docId) => {
      if (!docId) {
        handle = repo.create<DocStructure>();
        localforage.setItem("rootDocId", handle.documentId);

        documentId = handle.documentId;

        setTimeout(() => {
          console.log("setting initial state");
          handle.change((doc) => {
            Object.assign(doc, initialState);
          });
        });

        const doc = await handle.value();
        ready = true;

        console.log(save(doc));
      } else {
        handle = repo.find(docId as DocumentId);

        const doc = await handle.value();
        load(save(doc));
        console.log(save(doc));
        documentId = docId as DocumentId;
        ready = true;
      }
    });
  };

  setupRepo();

  /**
   * this triggers a series of changes to the first repo, spaced out slightly so that the
   * syncMessages are spread out a little. As they hit the server, they are relayed to the
   * second repo, which updates gradually. The second repo is then updated with a **single
   * change**, which causes the document on the server to throw a "mismatching heads" error.
   */
  async function theBadThing() {
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      repo1.incrementCount(20);
    }
    setTimeout(() => {
      repo2.incrementCount(20);
    }, 150);
  }

  async function resetDocument() {
    await localforage.clear();

    window.location.reload();
  }
</script>

<div class="flex border-b p-4">
  <div>
    <button
      on:click={() => theBadThing()}
      class="bg-red-300 text-red-800 p-2 rounded px-4"
    >
      Make bad things happen</button
    >
  </div>
  <div class="ml-2">
    <button
      on:click={() => resetDocument()}
      class="bg-white text-gray-800 p-2 rounded px-4 border border-gray-700"
    >
      Reset Document</button
    >
  </div>
</div>

{#if ready}
  <div class="container flex divide-x divide-grey-100 h-screen">
    <div class="w-1/2 p-4">
      <h2 class="text-lg font-bold">Repo 1</h2>
      <Repo bind:this={repo1} name='repo1'/>
    </div>
    <div class="w-1/2 p-4">
      <h2 class="text-lg font-bold">Repo 2</h2>
      <Repo bind:this={repo2} name='repo2' />
    </div>
  </div>
{/if}
