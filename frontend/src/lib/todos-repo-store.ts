import type { Todos } from "./todo-store";
import { initialTodos } from "./todo-store";
import { type PeerId, Repo } from "automerge-repo";
import { uuid } from "./deps";
import { AutomergeRepoStore } from "@onsetsoftware/automerge-store";

const repo = new Repo({
  network: [],
  peerId: uuid() as PeerId,
});

const handle = repo.create<Todos>();

handle.change((doc) => {
  Object.assign(doc, initialTodos);
});

export const todoRepoStore = new AutomergeRepoStore<Todos>(handle, {
  withDevTools: true,
});
