import {
  derived,
  get,
  type Readable,
  writable,
  type Writable,
} from "svelte/store";
import {
  change,
  type ChangeFn,
  clone,
  type Doc,
  emptyChange,
  from,
  generateSyncMessage,
  getHeads,
  getHistory,
  load,
  merge,
  save,
  view,
  type SyncState,
  initSyncState,
} from "@automerge/automerge";
import type { Patch } from "@automerge/automerge-wasm";
import * as localforage from "localforage";
import { nanoid } from "nanoid";
import type { Synchronizer } from "./root-store";

export type Branches<R> = Record<string, Doc<R>>;

type Branch = {
  id: string;
  title: string;
  start: string;
};

export type Commit = {
  id: string;
  branch: string;
  timestamp: number;
  message: string;
  head: string;
  headIndex: number;
  translatedBranch?: string[];
  forks: string[];
  merges: string[];
};

export type EntityState<R> = {
  ids: string[];
  entities: Record<string, R>;
};

export type Tree = {
  activeBranch: string;
  branches: EntityState<Branch>;
  commits: EntityState<Commit>;
};

export type BranchHeads = Record<
  string,
  {
    head: string;
    lastCommit: Commit | null;
    branchPoint: Commit;
  }
>;

const stores: Record<string, AutoMergeStore<any>> = {};

const initialTree: Tree = {
  activeBranch: "main",
  branches: {
    ids: ["main"],
    entities: {
      main: {
        id: "main",
        title: "Main",
        start: null,
      },
    },
  },
  commits: {
    ids: [],
    entities: {},
  },
};

type LockedState<V> = {
  locked: boolean;
  head: string;
  state: V;
};

export type SyncMessage = {
  id: string;
  instanceId: string;
  message: Uint8Array;
};

export class AutoMergeStore<T extends Record<string, unknown>>
  implements Readable<T>
{
  private _instanceId: string;
  private _tree: Writable<Tree>;
  private store: Readable<T>;
  private readonly _hydrated: Writable<boolean>;
  private saveDebounce: ReturnType<typeof setTimeout>;
  private _branches: Writable<Branches<T>>;
  private lockedState: Writable<LockedState<T>> = writable({
    locked: false,
    head: "",
    state: null,
  });

  private syncStates: Record<string, SyncState> = {};

  private options = {
    patchCallback: (patch: Patch, before: Doc<T>, after: Doc<T>) => {},
  };

  constructor(
    protected key: string,
    initialState: T,
    protected synchronizer: Synchronizer<T>
  ) {
    this._hydrated = writable(false);
    this.loadActiveState(initialState).then(() => {
      this.store = derived(
        [this._branches, this._tree, this.lockedState],
        ([$branches, $tree, $locked]) => {
          if ($locked.locked && $locked.state) {
            return $locked.state;
          }

          return { ...$branches[$tree.activeBranch] };
        }
      );

      this._hydrated.set(true);
    });
  }

  get hydrated() {
    return derived(this._hydrated, ($hydrated) => $hydrated);
  }

  get branches(): Readable<Branches<T>> {
    return derived(this._branches, ($branches) => $branches);
  }

  get tree() {
    return derived(this._tree, ($tree) => ({
      ...$tree,
    }));
  }

  get heads(): Readable<BranchHeads> {
    return derived([this._branches, this._tree], ([$branches, $tree]) => {
      return $tree.branches.ids.reduce((heads: BranchHeads, branchId) => {
        return {
          ...heads,
          [branchId]: {
            head: getHeads($branches[branchId])[0],
            lastCommit:
              Object.values($tree.commits.entities)
                .filter(
                  (commit: Commit) =>
                    commit.branch === branchId ||
                    commit.merges.includes(branchId) ||
                    commit.forks.includes(branchId)
                )
                .at(-1) ||
              $tree.commits.entities[$tree.branches.entities[branchId].start],
            branchPoint:
              $tree.commits.entities[$tree.branches.entities[branchId].start],
          },
        };
      }, {});
    });
  }

  get locked() {
    return derived(this.lockedState, ($locked) => $locked.locked);
  }

  get head(): Readable<string> {
    return derived(
      [this.lockedState, this._branches, this._tree],
      ([$locked, $branches, $tree]) => {
        if ($locked.locked) {
          return $locked.head;
        }

        const activeBranch = $tree.activeBranch;
        return getHeads($branches[activeBranch])[0];
      }
    );
  }

  protected async loadActiveState(initialState: T) {
    const tree = (await this.getData("tree")) || initialTree;

    this._instanceId =
      (await localforage.getItem("instanceId")) ||
      (await localforage.setItem("instanceId", nanoid()));

    const activeBranch = tree.activeBranch;

    const data = await this.getData(activeBranch);

    const branch = data ? load<T>(data) : from(initialState);

    const head = getHeads(branch)[0];

    // if this is the initial run, then initialize the tree
    if (tree.commits.ids.length === 0 && activeBranch === "main") {
      tree.branches.entities["main"].start = head;

      tree.commits = {
        ids: [head],
        entities: {
          [head]: {
            id: head,
            branch: "main",
            timestamp: new Date().getTime(),
            message: "Initial state",
            head: head,
            headIndex: 0,
            forks: [],
            merges: [],
          },
        },
      };

      await this.setData(tree, "tree");
      this.save(branch, activeBranch);
    }

    this._tree = writable(tree);

    const branches = { [activeBranch]: branch } as Branches<T>;

    for (const branchId of tree.branches.ids) {
      if (branchId === activeBranch) {
        continue;
      }

      const branchData = await this.getData(branchId);
      branches[branchId] = load<T>(branchData);
    }

    this._branches = await writable(branches);
  }

  public change(callback: ChangeFn<T>, message: string) {
    if (get(this.locked)) {
      return;
    }

    const activeBranch = get(this._tree).activeBranch;
    const doc = change(
      get(this.branches)[activeBranch],
      { ...this.options, message, time: new Date().getTime() },
      callback
    );
    this._branches.update((branches) => {
      return { ...branches, [activeBranch]: doc };
    });

    this.save(doc, activeBranch);
  }

  public setLocal(key: keyof T, value: T[keyof T]) {
    if (get(this.locked)) {
      return;
    }

    this._branches.update((branches) => {
      const activeBranch = get(this._tree).activeBranch;

      (branches[activeBranch] as T)[key] = value;

      return branches;
    });
  }

  public merge(fromId: string, toId?: string) {
    if (get(this.locked)) {
      return;
    }

    const tree = get(this._tree);

    toId = toId || tree.activeBranch;
    const branches = get(this._branches);

    let merged = merge(branches[toId], branches[fromId]);

    const message = `Merged ${tree.branches.entities[fromId].title} into ${tree.branches.entities[toId].title}`;

    if (
      getHeads(merged).length > 1 ||
      getHeads(branches[fromId])[0] !== getHeads(merged)[0]
    ) {
      merged = emptyChange(merged, { ...this.options, message });
    }

    this._branches.update((branches) => {
      return { ...branches, [toId]: merged };
    });

    this.commit(message, toId, fromId);

    this.save(merged, toId);
  }

  // public download() {
  //   const blob = new Blob(save(this._branches[this.activeBranch]), {
  //     type: "application/octet-stream",
  //   });
  //   const url = URL.createObjectURL(blob);
  //   const a = document.createElement("a");
  //   a.href = url;
  //   a.download = "archive.bn";
  //   a.click();
  // }

  public setActiveBranch(branch: string) {
    this.lockedState.set({
      locked: false,
      head: "",
      state: null,
    });

    this._tree.update((tree) => {
      tree.activeBranch = branch;

      this.setData(tree, "tree");
      return tree;
    });
  }

  public setState(commit: Commit) {
    const branches = get(this._branches);
    const currentBranch = branches[get(this._tree).activeBranch];

    const branchId =
      getHistory(currentBranch)[commit.headIndex]?.change.hash === commit.head
        ? get(this._tree).activeBranch
        : commit.branch;

    if (commit.head === getHeads(get(this._branches)[branchId])[0]) {
      this.setActiveBranch(branchId);
      return;
    }

    const branch = get(this._branches)[branchId];

    const history = getHistory(branch);
    this.lockedState.set({
      locked: true,
      head: commit.head,
      state: history[commit.headIndex].snapshot,
    });
  }

  public commit(message: string, branchId?: string, mergeBranch?: string) {
    if (get(this.locked)) {
      return;
    }

    const tree = get(this._tree);

    branchId = branchId || tree.activeBranch;
    const branch = get(this._branches)[branchId];

    const history = getHistory(branch);
    const head = getHeads(branch)[0];

    if (tree.commits.ids.includes(head)) {
      this._tree.update((tree) => {
        const t = {
          ...tree,
          commits: {
            ...tree.commits,
            entities: {
              ...tree.commits.entities,
              [head]: {
                ...tree.commits.entities[head],
                branch: branchId,
                merges: [
                  ...tree.commits.entities[head].merges,
                  ...(mergeBranch ? [mergeBranch] : []),
                ],
              },
            },
          },
        };

        this.setData(t, "tree");
        return t;
      });

      return;
    }

    const commit: Commit = {
      id: head,
      branch: branchId,
      timestamp: new Date().getTime(),
      message,
      head,
      headIndex: history.length - 1,
      forks: [],
      merges: mergeBranch ? [mergeBranch] : [],
    };

    this._tree.update((tree) => {
      const t = {
        ...tree,
        commits: {
          ids: [...tree.commits.ids, commit.id],
          entities: {
            ...tree.commits.entities,
            [commit.id]: commit,
          },
        },
      };

      this.setData(t, "tree");
      return t;
    });
  }

  public async branch(commit: Commit, title: string) {
    const branch = get(this._branches)[commit.branch];

    const newBranch = clone(view(branch, [commit.head]));

    const branchId = nanoid();

    this._branches.update((branches) => {
      return { ...branches, [branchId]: newBranch };
    });

    this.save(newBranch, branchId);

    this._tree.update((tree) => {
      const t: Tree = {
        ...tree,
        commits: {
          ...tree.commits,
          entities: {
            ...tree.commits.entities,
            [commit.id]: {
              ...commit,
              forks: [...commit.forks, branchId],
            },
          },
        },
        branches: {
          ids: [...tree.branches.ids, branchId],
          entities: {
            ...tree.branches.entities,
            [branchId]: {
              id: branchId,
              title,
              start: commit.head,
            },
          },
        },
      };

      this.setData(t, "tree");
      return t;
    });

    this.setActiveBranch(branchId);
  }

  public set(key: keyof T, value: T[keyof T], message?: string) {
    const callback: ChangeFn<T> = (doc: T) => {
      doc[key] = value;
    };

    this.change(callback, message);
  }

  public subscribe(run: (value: T) => void) {
    return this.store.subscribe(run);
  }

  private getData<S extends string>(
    branch: S
  ): Promise<S extends "tree" ? Tree : Uint8Array> {
    return localforage.getItem(this.key + "/" + branch);
  }

  private setData<S extends string>(
    data: S extends "tree" ? Tree : Uint8Array,
    branch: S
  ) {
    return localforage.setItem(this.key + "/" + branch, data);
  }

  private save(doc: Doc<T>, branch: string) {
    clearTimeout(this.saveDebounce);

    this.saveDebounce = setTimeout(() => {
      const data = save(doc);
      this.setData(data, branch)
        .then(() => {
          this.push(doc, branch);
          console.log(doc);
        })
        .catch((err) => {
          console.log(err);
        });
    }, 100);
  }

  private push(doc: Doc<T>, branch: string) {
    const [nextSyncState, syncMessage] = generateSyncMessage(
      doc,
      this.syncStates[branch] || initSyncState()
    );

    if (syncMessage) {
      this.synchronizer.push(
        {
          id: this.key + "/" + branch,
          instanceId: this._instanceId,
          message: syncMessage,
        },
        () => get(this.branches)[branch]
      );
    }

    this.syncStates = { ...this.syncStates, branch: nextSyncState };
  }

  private pull(branch: string) {}
}

export function autoMergeStore<T extends Record<string, unknown>>(
  key: string,
  initialState: T,
  synchronizer: Synchronizer<T>
): AutoMergeStore<T> {
  if (!stores[key]) {
    stores[key] = new AutoMergeStore<T>(key, initialState, synchronizer);
  }
  return stores[key];
}
