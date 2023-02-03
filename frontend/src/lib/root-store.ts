import {
  autoMergeStore,
  type SyncMessage,
} from "./automerge-store";
import axios from "axios";
import { uint8ToBase64 } from "./automerge-utilities";
import type { Doc } from "@automerge/automerge";

type InitialState = {
  count: number;
  text: string;
};

export type Synchronizer<T> = {
  push: (syncMessage: SyncMessage, getDoc: () => Doc<T>) => void;
}

const synchronizer: Synchronizer<InitialState> = {
  
  push: async (syncMessage: SyncMessage) => {
    const {data, status} = await axios.post(import.meta.env.SUPABASE_DB_FUNCTION_URL + "changes", {
      ...syncMessage,
      message: uint8ToBase64(syncMessage.message),
    }, {
      headers: {
        Authorization: "Bearer " + import.meta.env.SUPABASE_ANON_KEY,
      }
    });

    if (status !== 200) {
      
    } else {
      if (data.message) {
        
      }
    }
  },
};

export const rootStore = autoMergeStore<InitialState>(
  "root",
  {
    count: 0,
    text: "",
  },
  synchronizer
);
