<svelte:options immutable />

<script lang="ts">
  import { AutomergeStore } from "@onsetsoftware/automerge-store";
  import type { Todos } from "./todo-store";
  import { uuid } from "./deps.js";
  import { onMount } from "svelte";

  export let todoStore: AutomergeStore<Todos>;

  let ready = false;

  onMount(() => {
    todoStore.onReady(() => {
      ready = true;
    });
  });

  $: canUndo = $todoStore && ready && todoStore.canUndo();
  $: canRedo = $todoStore && ready && todoStore.canRedo();
</script>

{#if ready}
  <div>
    <pre class="text-sm text-gray-500">{$todoStore.todos.ids.length} todos</pre>
    <div class="flex justify-between">
      <button
        class="bg-blue-500 hover:bg-blue-700 text-white py-1 px-3 rounded my-2"
        on:click={() =>
          todoStore.change((doc) => {
            const id = uuid();
            doc.todos.ids.push(id);
            doc.todos.entities[doc.todos.ids[doc.todos.ids.length - 1]] = {
              id,
              text: "",
              done: false,
            };
          })}>Add todo</button
      >
      <div>
        <button
          class="bg-blue-500 hover:bg-blue-700 text-white py-1 px-3 rounded my-2 mr-1 disabled:opacity-50"
          disabled={!canUndo}
          on:click={() => todoStore.undo()}>Undo</button
        ><button
          class="bg-blue-500 hover:bg-blue-700 text-white py-1 px-3 rounded my-2 disabled:opacity-50"
          disabled={!canRedo}
          on:click={() => todoStore.redo()}>Redo</button
        >
      </div>
    </div>
    <div class="flex w-full">
      <ul class="w-1/2 mt-2">
        {#each $todoStore.todos.ids as id}
          <li class="flex items-center">
            <input
              type="checkbox"
              checked={$todoStore.todos.entities[id].done}
              on:change={(event) => {
                todoStore.change((doc) => {
                  doc.todos.entities[id].done = event.target.checked;
                });
              }}
              class="mr-2"
            />
            <input
              type="text"
              value={$todoStore.todos.entities[id].text}
              on:change={(event) => {
                todoStore.change((doc) => {
                  doc.todos.entities[id].text = event.target.value;
                });
              }}
              class="w-full"
            />
          </li>
        {/each}
      </ul>
      <ul class="w-1/2 mt-2">
        {#each $todoStore.todos.ids as id}
          <li>
            <input
              type="checkbox"
              disabled
              checked={$todoStore.todos.entities[id].done}
              class="mr-2"
            />
            {$todoStore.todos.entities[id].text}
          </li>
        {/each}
      </ul>
    </div>
  </div>
{/if}
