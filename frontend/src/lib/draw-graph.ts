import { tick } from "svelte";
import colors from "tailwindcss/colors";
import type { GraphLine } from "./StateManager.svelte";

type Line = { start: { x: number; y: number }; end: { x: number; y: number } };

function createPath(
  l: Line,
  thickness: number,
  colour: string,
  rowHeight: number,
  merge: boolean
) {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  if (l.start.x === l.end.x) {
    path.setAttribute(
      "d",
      `M ${l.start.x},${l.start.y} L ${l.end.x},${l.end.y}`
    );
  } else {
    if (merge) {
      path.setAttribute(
        "d",
        `M ${l.start.x},${l.start.y} L ${l.start.x},${
          l.end.y + rowHeight / 2
        } L ${l.end.x},${l.end.y}`
      );
    } else {
      path.setAttribute(
        "d",
        `M ${l.start.x},${l.start.y} L ${l.end.x},${
          l.start.y - rowHeight / 2
        } L ${l.end.x},${l.end.y}`
      );
    }
  }
  path.setAttribute("stroke", colour);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke-width", String(thickness));

  return path;
}

export function drawGraph(
  node: HTMLElement,
  options: { graph: GraphLine[]; colours: Map<string, keyof typeof colors> }
) {
  const graphContainer = document.createElement("div");
  graphContainer.classList.add(
    "absolute",
    "inset-0",
    "w-full",
    "h-full",
    "pointer-events-none"
  );

  const drawGraph = async ({ graph, colours }: typeof options) => {
    await tick();
    graphContainer.innerHTML = "";
    const lineThickness = 3;
    const rowHeight = 28;

    const nodeRect = node.getBoundingClientRect();

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    svg.setAttribute("width", `100%`);
    svg.setAttribute("height", `100%`);
    svg.classList.add("absolute");

    for (const line of graph) {
      const start = document.getElementById(line.start);
      const end = document.getElementById(line.end);

      if (start && end) {
        // get start position in node

        const startRect = start.getBoundingClientRect();
        const endRect = end.getBoundingClientRect();

        const l: Line = {
          start: {
            x: startRect.left - nodeRect.left + startRect.width / 2,
            y: startRect.top - nodeRect.top + startRect.height / 2,
          },
          end: {
            x: endRect.left - nodeRect.left + endRect.width / 2,
            y: endRect.top - nodeRect.top + endRect.height / 2,
          },
        };
        svg.appendChild(
          createPath(l, lineThickness + 3, "white", rowHeight, line.merge)
        );

        svg.appendChild(
          createPath(
            l,
            lineThickness,
            colors[colours.get(line.branch)][500],
            rowHeight,
            line.merge
          )
        );
      }

      graphContainer.appendChild(svg);

      node.prepend(graphContainer);
    }
  };

  drawGraph(options);

  return {
    update: drawGraph,
  };
}
