<svelte:options immutable/>

<script lang="ts">
  import { rootStore } from "./root-store";

  const store = rootStore;
</script>


<div class="mb-4">
        <h1 class="text-gray-900 font-semibold text-lg">Count</h1>
        <p>{$store.count}</p>
    </div>

<div>
    <h1 class="text-gray-900 font-semibold text-lg">Text</h1>
    <p>{$store.text}</p>
</div>
