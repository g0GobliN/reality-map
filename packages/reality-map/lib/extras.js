/* eslint-disable */
"use strict";
const fs = require("fs");
const path = require("path");

function extStats(scan) {
  const m = new Map();
  for (const f of scan.insights?.filesIndex || []) {
    const e = (f.ext || "—").toLowerCase();
    const cur = m.get(e) || { ext: e, files: 0, loc: 0 };
    cur.files += 1;
    cur.loc += f.loc || 0;
    m.set(e, cur);
  }
  return [...m.values()].sort((a, b) => b.loc - a.loc);
}

function readPkgDeps(root) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    const deps = { ...(j.dependencies || {}), ...(j.devDependencies || {}), ...(j.peerDependencies || {}), ...(j.optionalDependencies || {}) };
    return Object.keys(deps);
  } catch { return null; }
}

function unusedDeps(scan, root) {
  const declared = readPkgDeps(root);
  if (!declared) return null;
  const usedAll = new Set((scan.insights?.externalPackages || []).map((x) => x.name));
  // Heuristic: also consider package names that match scan-summary uniquePackages via graph nodes — but topExternal is what we have.
  const SAFE = new Set([
    "typescript", "vite", "@vitejs/plugin-react", "eslint", "prettier",
    "tailwindcss", "postcss", "autoprefixer", "@types/node", "@types/react",
    "@types/react-dom", "tsx", "concurrently",
  ]);
  const unused = declared.filter((d) => !usedAll.has(d) && !SAFE.has(d) && !d.startsWith("@types/"));
  return { declared: declared.length, used: usedAll.size, unused };
}

function shortestPath(scan, from, to) {
  const d1 = scan.graphsByDepth?.[1];
  if (!d1) return null;
  const adj = new Map();
  for (const e of d1.edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source).push(e.target);
  }
  const ids = new Set(d1.nodes.map((n) => n.id));
  if (!ids.has(from)) return { error: `unknown module: ${from}` };
  if (!ids.has(to)) return { error: `unknown module: ${to}` };
  const prev = new Map([[from, null]]);
  const q = [from];
  while (q.length) {
    const cur = q.shift();
    if (cur === to) break;
    for (const nx of adj.get(cur) || []) {
      if (prev.has(nx)) continue;
      prev.set(nx, cur);
      q.push(nx);
    }
  }
  if (!prev.has(to)) return { path: null };
  const out = [];
  let c = to;
  while (c != null) { out.unshift(c); c = prev.get(c); }
  return { path: out };
}

function inspectModule(scan, id) {
  const d1 = scan.graphsByDepth?.[1];
  if (!d1) return null;
  const node = d1.nodes.find((n) => n.id === id);
  if (!node) return { error: `unknown module: ${id}` };
  const importers = d1.edges.filter((e) => e.target === id).map((e) => ({ from: e.source, weight: e.weight }));
  const importees = d1.edges.filter((e) => e.source === id).map((e) => ({ to: e.target, weight: e.weight }));
  return { node, importers, importees };
}

function toCsv(rows, columns) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.join(",");
  const body = rows.map((r) => columns.map((c) => esc(r[c])).join(",")).join("\n");
  return head + "\n" + body + "\n";
}

function filesCsv(scan) {
  const rows = scan.insights?.filesIndex || [];
  return toCsv(rows, ["path", "ext", "loc", "importers", "importees"]);
}

const RULES_TEMPLATE = {
  layers: {
    ui: ["src/components", "src/routes", "src/pages"],
    server: ["src/server", "src/lib/*.server", "src/routes/api"],
    shared: ["src/lib", "src/utils", "src/hooks"],
  },
  forbid: [
    { from: "ui", to: "server", reason: "UI must not import server-only code directly" },
  ],
};

module.exports = { extStats, unusedDeps, shortestPath, inspectModule, filesCsv, RULES_TEMPLATE };
