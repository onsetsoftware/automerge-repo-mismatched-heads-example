<svelte:options immutable />

<script lang="ts">
  import { derived, type Readable } from "svelte/store";
  import { getHeads, getHistory } from "@automerge/automerge";
  import { rootStore } from "./root-store";
  import type { Branches, BranchHeads, Commit } from "./automerge-store";
  import { branchMergePairs as bmp, type BranchPair } from "./branch-utilities";
  import { drawGraph } from "./draw-graph";
  import colors from "tailwindcss/colors";

  const store = rootStore;

  const branches = store.branches;

  const tree = store.tree;

  const head = store.head;

  const locked = store.locked;

  const heads = store.heads;

  const branchOrder = derived(tree, (tree) => {
    return [
      tree.activeBranch,
      ...tree.branches.ids.filter((id) => id !== tree.activeBranch),
    ];
  });

  const colours: Readable<Map<string, keyof typeof colors>> = derived(
    tree,
    (tree) => {
      const baseCols = [
        "sky",
        "red",
        "green",
        "amber",
        "purple",
        "yellow",
        "pink",
        "teal",
        "gray",
        "fuchsia",
        "blue",
        "orange",
        "indigo",
        "lime",
        "violet",
        "emerald",
        "cyan",
      ];

      const colours = new Map();
      tree.branches.ids.forEach((id, i) => {
        colours.set(id, baseCols[i]);
      });
      return colours;
    }
  );

  const getChanges = (
    branch: string,
    branches: Branches<any>,
    heads: BranchHeads
  ) => {
    return (
      getHistory(branches[branch]).length -
      1 -
      (heads[branch].lastCommit.headIndex || 0)
    );
  };

  $: branchChanges = (branch: string) => {
    return getChanges(branch, $branches, $heads);
  };

  const lastCommitHeadPerBranch: Readable<Record<string, string[]>> = derived(
    heads,
    (heads) => {
      return Object.keys(heads).reduce((commits, branchId) => {
        const head = heads[branchId].lastCommit.head;

        if (!commits[head]) {
          commits[head] = [];
        }

        commits[head].push(branchId);

        return commits;
      }, {});
    }
  );

  const mergePoints: Readable<Record<string, string[]>> = derived(
    [tree],
    ([tree]) => {
      return Object.values(tree.commits.entities)
        .filter((commit) => commit.merges.length > 0)
        .reduce((heads, commit) => {
          return {
            ...heads,
            [commit.id]: commit.merges,
          };
        }, {});
    }
  );

  const forkPoints: Readable<Record<string, string[]>> = derived(
    [tree],
    ([tree]) => {
      return Object.values(tree.commits.entities)
        .filter((commit) => commit.forks.length > 0)
        .reduce((heads, commit) => {
          return {
            ...heads,
            [commit.id]: commit.forks,
          };
        }, {});
    }
  );

  const branchMergePairs: Readable<BranchPair[]> = derived(tree, (tree) => {
    return bmp(tree.commits);
  });

  const translatedCommits = derived(
    [tree, forkPoints, mergePoints, branchOrder, branchMergePairs],
    ([tree, forkPoints, mergePoints, branchOrder, branchMergePairs]) => {
      const ids = [...tree.commits.ids].reverse();

      const translatedBranches = new Map<string, string[]>();

      const forkHeads = Object.keys(forkPoints);
      const mergeHeads = Object.keys(mergePoints);

      const belongsToExclusivelyMergedBranch = (commit: Commit): string => {
        for (const pair of branchMergePairs.filter(
          (pair) => pair.fromCommits.length === 0
        )) {
          if (pair.toCommits.map((commit) => commit.head).includes(commit.id)) {
            return pair.from;
          }
        }

        return null;
      };

      const entities = ids.reduce((commits, id, index) => {
        commits[id] = { ...tree.commits.entities[id] };

        if (commits[id].branch !== tree.activeBranch) {
          const newBranches: string[] = [];
          const exclusivelyMergedBranch = belongsToExclusivelyMergedBranch(
            commits[id]
          );

          if (exclusivelyMergedBranch) {
            newBranches.push(exclusivelyMergedBranch);
          }

          if (mergeHeads.includes(commits[id].head)) {
            newBranches.push(...mergePoints[commits[id].head]);
          }

          if (forkHeads.includes(commits[id].head)) {
            newBranches.push(...forkPoints[commits[id].head]);
          }

          // pit the possible new branches against each other and let the earliest in the order win
          let newBranch = newBranches.sort(
            (a, b) => branchOrder.indexOf(a) - branchOrder.indexOf(b)
          )[0];

          // if we are not looking at the initial branch, or the branch is lower in the order than the initial branch, translate it
          while (newBranch && translatedBranches.has(newBranch)) {
            newBranches.unshift(...translatedBranches.get(newBranch));

            newBranch = newBranches.sort(
              (a, b) => branchOrder.indexOf(a) - branchOrder.indexOf(b)
            )[0];
          }

          if (
            newBranch &&
            branchOrder.indexOf(newBranch) <=
              branchOrder.indexOf(commits[id].branch)
          ) {
            translatedBranches.set(commits[id].branch, [
              ...new Set(newBranches),
            ]);
          }
        }

        if (translatedBranches.has(commits[id].branch)) {
          commits[id].translatedBranch = translatedBranches.get(
            commits[id].branch
          );
        }

        return commits;
      }, {} as Record<string, Commit>);

      return {
        ids,
        entities,
      };
    }
  );

  export type GraphLine = {
    branch: string;
    start: string;
    end: string;
    merge?: boolean;
  };

  const graph: Readable<GraphLine[]> = derived(
    [translatedCommits, branchOrder, heads],
    ([commits, branchOrder, heads]) => {
      const allBranchCommits = (branch: string) => {
        return commits.ids.filter(
          (id) =>
            commits.entities[id].merges.includes(branch) ||
            commits.entities[id].forks.includes(branch) ||
            commits.entities[id].translatedBranch?.includes(branch) ||
            commits.entities[id].branch === branch
        );
      };

      const branchLines = [...branchOrder]
        .reverse()
        .map((branch) => {
          const branchCommits = allBranchCommits(branch);

          if (!branchCommits.includes(heads[branch].head)) {
            branchCommits.unshift(heads[branch].head);
          }
          if (!branchCommits.includes(heads[branch].branchPoint.head)) {
            branchCommits.push(heads[branch].branchPoint.head);
          }

          return branchCommits
            .map((id, index) => {
              const start = id;
              const end = branchCommits[index - 1];

              return {
                branch,
                start,
                end,
                merge: commits.entities[end]?.merges.includes(branch),
              };
            })
            .filter((line) => line.end && line.start);
        })
        .flat();

      return [...branchLines];
    }
  );

  let selected: string =
    getChanges($tree.activeBranch, $branches, $heads) > 0
      ? $tree.activeBranch + ".head$$"
      : getHeads($branches[$tree.activeBranch])[0];

  function fork(commit: Commit) {
    const name = prompt("What would you like to call this copy?");
    if (name) {
      store.branch(commit, name);
    }
  }

  function switchBranch(branch: string) {
    selected = branch + ".head$$";
    store.setActiveBranch(branch);
  }

  function newCommit() {
    const message = prompt("Commit message?");
    if (message) {
      store.commit(message);
      selected = getHeads($branches[$tree.activeBranch])[0];
    }
  }
</script>

<div class="w-full flex flex-col">
  <div class="h-16 w-full flex items-center px-4 space-x-4">
    <div>Locked: {$locked}</div>
    <div class="flex space-x-4">
      <button
        class="disabled:text-slate-200"
        on:click={() => {
          newCommit();
        }}
        disabled={branchChanges($tree.activeBranch) === 0}
      >
        Commit
      </button>
      <button
        class="disabled:text-slate-200"
        disabled={selected.includes(".head$$")}
        on:click={() => fork($tree.commits.entities[selected])}
      >
        Branch
      </button>
    </div>
  </div>
  <div class="flex w-full flex-grow">
    <div class="bg-slate-100 w-1/5 p-4">
      <span class="text-xs font-medium text-slate-700">Branches</span>
      <ul class="mt-2">
        {#each $tree.branches.ids as branch, i (branch)}
          <li class="-mx-4">
            <a
              href="#!"
              class="justify-between items-center flex w-full py-1 px-4 {$tree.activeBranch ===
              branch
                ? 'text-white bg-indigo-500'
                : ''} "
              on:dblclick={() => switchBranch(branch)}
            >
              <div>
                {$tree.branches.entities[branch].title}
              </div>
              {#if branch !== $tree.activeBranch}
                <button on:click={() => store.merge(branch)}> M </button>
              {/if}
            </a>
          </li>
        {/each}
      </ul>
    </div>

    <div
      class="flex-grow relative"
      use:drawGraph={{ graph: $graph, colours: $colours }}
    >
      {#if branchChanges($tree.activeBranch) > 0}
        {@const h = getHeads($branches[$tree.activeBranch])[0]}
        {@const colour = colors[$colours.get($tree.activeBranch)]}
        <a
          href="#!"
          class="px-4 text-sm py-1 flex items-center {selected ===
          $tree.activeBranch + '.head$$'
            ? 'bg-indigo-500 text-white'
            : ''}"
          on:click={() => (selected = $tree.activeBranch + ".head$$")}
          on:dblclick={() => {
            switchBranch($tree.activeBranch);
          }}
        >
          <div class="w-1/5">
            <div class="w-3 h-3 block relative" id={h}>
              <svg
                viewBox="0 0 100 100"
                xmlns="http://www.w3.org/2000/svg"
                fill="white"
              >
                <circle cx="50" cy="50" r="50" fill="black" />
                <circle cx="50" cy="50" r="33" />
              </svg>
            </div>
          </div>
          <div class="w-4/5 flex items-center space-x-2">
            <div class="w-12">
              {#if h === $head}
                <div
                  class="text-xs border-red-700 bg-red-600 text-white font-medium px-1 py-0.5 rounded text-center"
                >
                  Active
                </div>
              {/if}
            </div>
            <div
              class="text-xs px-1 py-0.5 rounded"
              style="color: {colour[700]}; background-color: {colour[50]};"
            >
              {$tree.branches.entities[$tree.activeBranch].title}
            </div>

            <span class="font-bold"
              >{branchChanges($tree.activeBranch)} uncommitted {branchChanges(
                $tree.activeBranch
              ) === 1
                ? "change"
                : "changes"}</span
            >
          </div>
        </a>
      {/if}

      {#each $translatedCommits.ids as c (c)}
        {@const commit = $translatedCommits.entities[c]}
        {#if $lastCommitHeadPerBranch[commit.head]}
          {#each $lastCommitHeadPerBranch[commit.head] as branchId}
            {#if branchId !== $tree.activeBranch && branchChanges(branchId) > 0}
              {@const h2 = getHeads($branches[branchId])[0]}
              {@const colour = colors[$colours.get(branchId)]}
              <a
                href="#!"
                class="px-4 text-sm py-1 flex items-center {selected ===
                branchId + '.head$$'
                  ? 'bg-indigo-500 text-white'
                  : ''}"
                on:click={() => (selected = branchId + ".head$$")}
                on:dblclick={() => {
                  switchBranch(branchId);
                }}
              >
                <div class="w-1/5">
                  <div
                    class="w-3 h-3 block relative"
                    id={h2}
                    style="margin-left: {$branchOrder.indexOf(branchId) *
                      13}px;"
                  >
                    <svg
                      viewBox="0 0 100 100"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="white"
                    >
                      <circle cx="50" cy="50" r="50" fill="black" />
                      <circle cx="50" cy="50" r="33" />
                    </svg>
                  </div>
                </div>
                <div class="w-4/5 flex items-center space-x-2">
                  <div class="w-12">
                    {#if h2 === $head}
                      <div
                        class="text-xs border-red-700 bg-red-600 text-white font-medium px-1 py-0.5 rounded text-center"
                      >
                        Active
                      </div>
                    {/if}
                  </div>
                  <div
                    class="text-xs px-1 py-0.5 rounded"
                    style="color: {colour[700]}; background-color: {colour[50]};"
                  >
                    {$tree.branches.entities[branchId].title}
                  </div>

                  <span class="font-bold"
                    >{branchChanges(branchId)} uncommitted {branchChanges(
                      branchId
                    ) === 1
                      ? "change"
                      : "changes"}</span
                  >
                </div>
              </a>
            {/if}
          {/each}
        {/if}
        <a
          href="#!"
          class="px-4 text-sm py-1 flex items-center {selected === commit.head
            ? 'bg-indigo-500 text-white'
            : ''}"
          on:click={() => (selected = commit.head)}
          on:dblclick={() => {
            selected = commit.head;
            store.setState(commit);
          }}
        >
          <div class="w-1/5">
            <div
              class="w-3 h-3 block relative"
              id={commit.head}
              title={commit.head}
              style="margin-left: {$branchOrder.indexOf(
                commit.translatedBranch?.[0] || commit.branch
              ) * 13}px;"
            >
              <svg
                viewBox="0 0 100 100"
                xmlns="http://www.w3.org/2000/svg"
                fill={colors[
                  $colours.get(commit.translatedBranch?.[0] || commit.branch)
                ][500]}
              >
                {#if selected === commit.head}
                  <circle cx="50" cy="50" r="48" fill="white" />
                {/if}
                <circle cx="50" cy="50" r="35" />
              </svg>
            </div>
          </div>
          <div class="w-4/5 flex items-center space-x-2">
            <div class="w-12">
              {#if commit.head === $head}
                <div
                  class="text-xs border-red-700 bg-red-600 text-white font-medium px-1 py-0.5 rounded text-center"
                >
                  Active
                </div>
              {/if}
            </div>
            {#each $tree.branches.ids as branch}
              {@const colour = colors[$colours.get(branch)]}
              {#if commit.head === getHeads($branches[branch])[0]}
                <div
                  class="text-xs px-1 py-0.5 rounded"
                  style="color: {colour[700]}; background-color: {colour[50]};"
                >
                  {$tree.branches.entities[branch].title}
                </div>
              {/if}
            {/each}
            <span class="">{commit.message}</span>
          </div>
        </a>
      {/each}
    </div>
  </div>
</div>
