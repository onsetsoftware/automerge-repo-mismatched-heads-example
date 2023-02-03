import * as Automerge from "@automerge/automerge"
import EventEmitter from "eventemitter3";
import type { Doc } from "@automerge/automerge";
import type { ChannelId, DecodedMessage, PeerId } from "automerge-repo";
import * as CBOR from "cbor-x";
import { NetworkAdapterEvents } from "automerge-repo";

export class ServerMock extends EventEmitter<NetworkAdapterEvents> {
  private docs: {[documentId: ChannelId] : Uint8Array} = {};
  
  private syncStates: {[peerId: PeerId] : { [documentId: ChannelId] : Automerge.SyncState}} = {};
  
  private previousMessages: {[documentId: PeerId] : Uint8Array} = {};
  
  locks: {[documentId: ChannelId] : boolean} = {};
  
  async fetch(action: string, body: any) {
    if (this.locks[body.channelId]) {
      await new Promise((resolve) => setTimeout(resolve, 90));
      return this.fetch(action, body);
    }
    
    if (body.channelId) {
      this.locks[body.channelId] = true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    
    const response = this.handleRequest(action, body);
    
    this.locks[body.channelId] = false;
    
    return response;
    
  }

  private async handleRequest(action: string, body: any) {
    switch (action.split("/").at(-1)) {
      case "connect": {
        this.setupPeer(body.senderId as PeerId);

        console.log("peer " + body.senderId + " connected");
        return {status: 'connected'};
      }
      case "pull": {
        const {targetId, channelId, senderId}: {targetId: PeerId, channelId: ChannelId, senderId: PeerId} = body;

        const syncMessage = await this.generateSyncMessage(channelId, senderId);

        const response: DecodedMessage = {
          broadcast: false,
          channelId: channelId,
          data: syncMessage || new Uint8Array([]),
          targetId: senderId,
          senderId: targetId,
          type: ""
        }

        return CBOR.encode(response);
      }
      case "sync-message": {
        const message: DecodedMessage = CBOR.decode(new Uint8Array(body));
        try {

          const syncMessage = await this.updateDoc(message);

          const response: DecodedMessage = {
            broadcast: false,
            channelId: message.channelId,
            data: syncMessage || new Uint8Array([]),
            targetId: message.senderId,
            senderId: message.targetId,
            type: ""
          }

          return CBOR.encode(response);
        } catch (e) {
          this.resetDocState(message.senderId, message.channelId);
          throw e;
        }
      }
      default: {
        return "Invalid Action - " + String(action);
      }
    }
  }
  
  resetDocState(senderId: PeerId, channelId: ChannelId) {
    this.syncStates[senderId] = this.syncStates[senderId] || {};

    this.syncStates[senderId][channelId] = this.syncStates[senderId][channelId] ? Automerge.decodeSyncState(Automerge.encodeSyncState(this.syncStates[senderId][channelId])) : Automerge.initSyncState();
  }

  setupPeer(peerId: PeerId) {
    this.syncStates[peerId] = {};
  }

  async updateDoc({ senderId, channelId, data }: DecodedMessage) {
    this.syncStates[senderId] = this.syncStates[senderId] || {};

    this.previousMessages[senderId] = data;
    
    let doc: Doc<any> = {};

    try {
      if (this.syncStates[senderId] === undefined) {
        this.syncStates[senderId] = {};
      }
      doc = await this.getDoc(channelId);
      
      const copy = Automerge.clone(doc);
  
      const syncState = this.syncStates[senderId]?.[channelId] || Automerge.initSyncState();
  
      let newDoc, newSyncState;
  
      try {
        [newDoc, newSyncState] = Automerge.receiveSyncMessage(doc, syncState, data);
      } catch (e) {
        console.log("Automerge sync state error caught", e);
        [newDoc, newSyncState] = Automerge.receiveSyncMessage(doc, Automerge.decodeSyncState(Automerge.encodeSyncState(syncState)), data);
      }
  
      const equalArrays = (a: unknown[], b: unknown[]) => {
          return a.length === b.length && a.every((element, index) => element === b[index]);
      }
  
      try  {
        await this.saveDoc(channelId, newDoc);
        
        if (!equalArrays(Automerge.getHeads(newDoc), Automerge.getHeads(doc))) {
          this.triggerPull(channelId, senderId);
        }
      } catch (e) {
        const originalHeadsList = Automerge.getHistory(copy).map(entry => entry.change.hash);
        const newHeadsList = Automerge.getHistory(newDoc).map(entry => entry.change.hash);
        
        console.log(
            {
              oldHeads: Automerge.getHeads(copy),
              newHeads: Automerge.getHeads(newDoc),
              originalHeadsList,
              newHeadsList,
              latestSyncMessages: this.previousMessages,
              oldDoc: copy,
              newDoc
              
            }
        );
        
        this.resetDocState(senderId, channelId);
        throw e;
      }
  
      this.syncStates[senderId][channelId] = newSyncState;
  
      return await this.generateSyncMessage(channelId, senderId, newDoc);


    } catch (e) {
      console.log("Error caught while syncing from " + senderId, e);
      throw e;
    }
  }

  async generateSyncMessage(channelId: ChannelId, senderId: PeerId, doc?: Automerge.Doc<any>) {
    this.syncStates[senderId] = this.syncStates[senderId] || {};

    doc = doc || await this.getDoc(channelId);
    
    const syncState = this.syncStates[senderId]?.[channelId] || Automerge.initSyncState();

    const [newSyncState, message] = Automerge.generateSyncMessage(doc!, syncState);

    this.syncStates[senderId][channelId] = newSyncState;

    return message;
  }

  async saveDoc(channelId: ChannelId, doc: Automerge.Doc<any>) {
    const newDoc = Automerge.save(doc);
    
    Automerge.load(newDoc);
    
    this.docs[channelId] = newDoc;
  }

  async getDoc(channelId: ChannelId) {
    return this.docs[channelId] ? Automerge.load(this.docs[channelId]) : Automerge.init();
  }

  private triggerPull(channelId: ChannelId, senderId: PeerId) {
    Object.keys(this.syncStates).filter((peer) => {
      return peer !== senderId;
    }).forEach((peer) => {
      this.emit("message", { channelId, senderId: "server" as PeerId, targetId: peer as PeerId, message: new Uint8Array, broadcast: false });
    });
  }
}
