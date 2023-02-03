<svelte:options immutable />

<script lang="ts">

  import { rootStore } from "./root-store";

  const store = rootStore;

  $: textValue = $store.text;
  
  const increment = () => {
    store.set('count', ($store.count || 0) + 1, 'increment count');
  }
</script>


<div class="mb-4 flex flex-col">
    <span>Count</span>
    <button on:click={increment} class="bg-red-600 text-white px-3 py-1 rounded w-fit">
        Increment Count
    </button>
</div>

<div class="flex flex-col">
    <label for="text-input">Text</label>
    <input type="text" id="text-input" bind:value={textValue} on:change={() => store.set('text', textValue, 'set text to "'+ textValue + '"')} class="border border-gray-300 rounded px-2 py-1"
           on:input={() => store.setLocal('text', textValue)} />
</div>
