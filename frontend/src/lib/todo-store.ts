import { AutomergeStore } from "@onsetsoftware/automerge-store";
import { from } from "@automerge/automerge";

export type Todo = {
  id: string;
  text: string;
  done: boolean;
};

export type Todos = {
  todos: {
    ids: string[];
    entities: Record<string, Todo>;
  };
};

export const initialTodos: Todos = {
  todos: {
    ids: [],
    entities: {},
  },
};

export const todoStore = new AutomergeStore<Todos>(
  "todos",
  from<Todos>(initialTodos),
  {
    withDevTools: true,
  }
);
