import type { AutomergeSynchronizer } from "@onsetsoftware/automerge-synchronizer";
import type {
  Synchronizer,
  SyncMessage,
} from "@onsetsoftware/automerge-synchronizer";

export class MemorySynchronizer implements Synchronizer {
  constructor(
    private readonly synchronizers: Record<
      string,
      AutomergeSynchronizer<{ count: number }>
    >
  ) {
    this.connectedPeers = Object.fromEntries(
      Object.keys(synchronizers).map((key) => [key, true])
    );

    console.log(this.connectedPeers);
  }

  protected connectedPeers: Record<string, boolean> = {};

  get connected() {
    return this.connectedPeers;
  }

  private syncFunctions: Record<string, (message: SyncMessage) => void> = {};

  public connectPeer(peerId: string) {
    console.log("connecting peer", peerId);
    this.connectedPeers = {
      ...this.connectedPeers,
      [peerId]: true,
    };
  }

  public disconnectPeer(peerId: string) {
    console.log("disconnecting peer", peerId);
    this.connectedPeers = {
      ...this.connectedPeers,
      [peerId]: false,
    };
  }

  public async init(
    docId: string,
    syncFromPeer: (message: SyncMessage) => void
  ) {
    this.syncFunctions[docId] = syncFromPeer;
  }

  async push(toPeerId: string, syncMessage: SyncMessage): Promise<SyncMessage> {
    return this.connectedPeers[toPeerId] && this.synchronizers[toPeerId]
      ? this.synchronizers[toPeerId].syncFromPeer(syncMessage)
      : { docId: syncMessage.docId, fromPeerId: toPeerId, message: null };
  }

  connect(peerId: string): Promise<SyncMessage> {
    return Promise.resolve({
      docId: "",
      fromPeerId: "",
      message: null,
    });
  }

  receive(syncMessage: SyncMessage): Promise<SyncMessage> {
    return Promise.resolve(undefined);
  }
}
