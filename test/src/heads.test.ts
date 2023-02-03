import { beforeEach, describe, expect, test } from "vitest";
import { ServerMock } from "./server-mock";
import { MockHttpAdapter } from "./mock-http-adapter";
import { DocHandle, PeerId, Repo } from "automerge-repo";

type DocStructure = {
  counter: {
    value: number;
    updatedAt: number;
    name: string;
  };
};

describe("", async () => {
  let server: ServerMock;
  let repo: Repo;
  let repo2: Repo;
  let handle: DocHandle<DocStructure>;
  let handle2: DocHandle<DocStructure>;
  
  beforeEach(() => {
    server = new ServerMock();

    repo = new Repo({
      network: [
        // new BroadcastChannelNetworkAdapter(),
        new MockHttpAdapter(server),
      ],
      peerId: "peer1" as PeerId,
    });

    repo2 = new Repo({
      network: [
        // new BroadcastChannelNetworkAdapter(),
        new MockHttpAdapter(server),
      ],
      peerId: "peer2" as PeerId,
    });

    handle = repo.create<DocStructure>();

    const initialState: DocStructure = {
      counter: { updatedAt: 0, value: 0, name: '' },
    };
    
    handle.change((doc) => {
      Object.assign(doc, initialState);
    });
    
    const listener = (id: string) => async ({ handle }: {handle: DocHandle<DocStructure>}) => {
      console.log(id, await handle.value());
    };
    
    handle2 = repo2.find(handle.documentId);

    
  });

  test("Set state", async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    try {
      function incrementCount(handle: DocHandle<DocStructure>, n: number) {
        for (let i = 0; i < n; i++) {
          handle.change((doc) => {
            doc.counter.value ? doc.counter.value++ : (doc.counter.value = 1);
            doc.counter.updatedAt = Date.now();
          });
        }
      }
      
      let count = 4;
      
      const interval = setInterval(() => {
        if (count <= 0) clearInterval(interval);
        incrementCount(handle, 10);
        count--;
      }, 10);
      
      setTimeout(() => {
        
        incrementCount(handle2, 100);
      }, 200);
    } catch (e) {
      console.error(e);
    }
    
    
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }, 5100);
});
