/* eslint-disable */
"use strict";

/** Escape for double-quoted Graphviz node IDs / labels */
function escapeDot(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * @param {{ nodes?: { id: string; label: string; files: number; loc: number; warn?: boolean }[], edges?: { source: string; target: string; weight?: number }[] }} graph
 * @param {string} [title]
 */
function moduleGraphToDot(graph, title = "reality-map") {
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];
  const lines = [
    `digraph "${escapeDot(title)}" {`,
    "  rankdir=LR;",
    "  node [shape=box, style=\"rounded,filled\", fontname=\"Helvetica\", fontsize=10];",
    "  edge [fontsize=9];",
  ];
  const nid = new Map();
  nodes.forEach((n, i) => nid.set(n.id, "n" + i));
  for (const n of nodes) {
    const id = nid.get(n.id);
    const fill = n.warn ? "#3d1520" : "#121826";
    const color = n.warn ? "#fb7185" : "#67e8f9";
    const lab = `${escapeDot(n.label)}\\n${n.files}f · ${n.loc} loc`;
    lines.push(`  ${id} [label="${lab}", fillcolor="${fill}", color="${color}"];`);
  }
  for (const e of edges) {
    const a = nid.get(e.source),
      b = nid.get(e.target);
    if (!a || !b) continue;
    const w = e.weight && e.weight > 1 ? ` [label="${e.weight}"]` : "";
    lines.push(`  ${a} -> ${b}${w};`);
  }
  lines.push("}");
  return lines.join("\n");
}

function escapeMermaidLabel(s) {
  return String(s).replace(/"/g, "#quot;");
}

/**
 * @param {{ nodes?: { id: string; label: string; warn?: boolean }[], edges?: { source: string; target: string; weight?: number }[] }} graph
 */
function moduleGraphToMermaid(graph) {
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];
  const id = new Map();
  nodes.forEach((n, i) => id.set(n.id, "n" + i));
  const lines = ["flowchart LR"];
  for (const n of nodes) {
    const cid = id.get(n.id);
    const suffix = n.warn ? ":::warn" : "";
    lines.push(`  ${cid}["${escapeMermaidLabel(n.label)}"]${suffix}`);
  }
  if (nodes.some((n) => n.warn)) {
    lines.push("  classDef warn fill:#3d1520,stroke:#fb7185,color:#fecaca;");
  }
  for (const e of edges) {
    const a = id.get(e.source),
      b = id.get(e.target);
    if (!a || !b) continue;
    if (e.weight && e.weight > 1) lines.push(`  ${a} -->|"${e.weight}"| ${b}`);
    else lines.push(`  ${a} --> ${b}`);
  }
  return lines.join("\n");
}

module.exports = { moduleGraphToDot, moduleGraphToMermaid };
