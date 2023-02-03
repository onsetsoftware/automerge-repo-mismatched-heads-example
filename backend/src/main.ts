import fs from "fs"
import express from "express"
import { WebSocketServer } from "ws"
import { PeerId, Repo } from "automerge-repo"
import { NodeWSServerAdapter } from "./NodeWSServerAdapter"
import { NodeFSStorageAdapter } from "automerge-repo-storage-nodefs"
import os from "os"
import { checkDoc } from "doc-checker";
import waitOn from "wait-on";

console.log('Waiting for webserver port to be read..');

const opts = {
  resources: [
    'tcp:localhost:3030',
  ],
    delay: 1000, // initial delay in ms, default 0
    interval: 100, // poll interval in ms, default 250ms
    simultaneous: 1, // limit to 1 connection per resource at a time
    timeout: 5000, // timeout in ms, default Infinity
    tcpTimeout: 1000, // tcp timeout in ms, default 300ms
    window: 1000, // stabilization time in ms, default 750ms
    reverse: true
};

await waitOn(opts);

const dir = ".amrg"
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir)
}

var hostname = os.hostname()

const wsServer = new WebSocketServer({ noServer: true })
const PORT = process.env.PORT !== undefined ? parseInt(process.env.PORT) : 3030
const app = express()
app.use(express.static("public"))

const config = {
  network: [new NodeWSServerAdapter(wsServer)],
  storage: new NodeFSStorageAdapter(),
  peerId: `sync-server-${hostname}` as PeerId,

  // Since this is a server, we don't share generously — meaning we only sync documents they already
  // know about and can ask for by ID.
  sharePolicy: () => false,
}

const repo = new Repo(config)

repo.on('document', ({handle}) => {
  handle.on('change', async () => {
    try {
      checkDoc(handle.doc)
    } catch (e) {
      console.error(e)
    }
  });
});

app.get("/", (_, res) => {
  res.send(`👍 automerge-repo-sync-server is running`)
})

const server = app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`)
})

server.on("upgrade", (request, socket, head) => {
  wsServer.handleUpgrade(request, socket, head, (socket) => {
    wsServer.emit("connection", socket, request)
  })
})

const reloadTasks = () => {
  if (server.listening) {
    server.close();
  }
}

if (import.meta.hot) {
  import.meta.hot.on("vite:beforeFullReload", reloadTasks);
}
