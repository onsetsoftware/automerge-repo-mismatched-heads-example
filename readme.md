# Mismatched heads example

I encountered this error while experimenting with http based network adapters for `automerge-repo`. I wanted to stress test the adapter to see what happened if a large number of concurrent changes were made to a document from multiple peers.

Included here are 2 methods of reproducing the error. 

## Method 1

This comprises a mocked frontend with two instances of `automerge-repo`, initialised to sync over a websocket. The frontend is a simple Svelte app. The backend is a slightly modified version of [automerge-repo-network-websocket](https://github.com/automerge/automerge-repo/tree/main/packages/automerge-repo-network-websocket) to introduce some latency, imitating a mediocre network connection.  

Start by cloning the repo, and running the backend server.

```bash
cd backend
npm install
npm run dev
```

Then, in a separate terminal, run the frontend server.

```bash
cd frontend
npm install
npm run dev
```

Then, open the frontend in your browser at [http://127.0.0.1:5173/](http://127.0.0.1:5173/). Both the frontend and backend are live-reloading, so you can make changes to the code and see the results immediately.

You can click to increment the counter on one or other of the repo instances and the changes are synced after a short delay.

Clicking the "Make bad things happen" button triggers a series of quick updates to the counter on repo1, which are then synced to repo2. A short while later (while the changes are still being synced to repo2), a change is made to repo2. When it hits the server, you will see that the next document produced (on the server) has the mismatched heads error.

## Method 2

This is a simple test which mocks an `automerge-repo` network adapter to add some latency to the sync process. This is less consistent in producing the error, but it might be more straightforward to extract the document states and relevant sync messages.

```bash
cd test
npm install
npm run test
```

The test will run for a few seconds, and then you will see the error in the console.
