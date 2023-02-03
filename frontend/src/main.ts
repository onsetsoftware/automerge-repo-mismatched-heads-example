import "./app.css";
import Container from "./Container.svelte";
import localforage from "localforage";

localStorage.debug = "";

localforage.config({
  name: "AutomergeTests",
});

console.clear();

const app = new Container({
  target: document.getElementById("app"),
});

export default app;
