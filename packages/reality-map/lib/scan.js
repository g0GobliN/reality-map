/* eslint-disable */
"use strict";

const fs = require("fs");
const path = require("path");

const IGNORE_DIRS = new Set([
  "node_modules", ".git", ".next", ".turbo", ".cache", "dist", "build",
  "out", "coverage", ".vercel", ".netlify", ".output", ".nuxt", ".svelte-kit",
  "target", "vendor", ".venv", "venv", "__pycache__", ".idea", ".vscode",
  ".DS_Store", ".pnpm-store",
]);

const CODE_EXT = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts",
  ".vue", ".svelte", ".astro",
]);

function isCode(file) {
  return CODE_EXT.has(path.extname(file).toLowerCase());
}

async function walk(root) {
  const out = [];
  async function rec(dir) {
    let entries;
    try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      if (e.name.startsWith(".") && IGNORE_DIRS.has(e.name)) continue;
      if (IGNORE_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await rec(full);
      else if (e.isFile() && isCode(e.name)) out.push(full);
    }
  }
  await rec(root);
  return out;
}

const IMPORT_RE = /(?:import|export)\s+(?:[^'"`;]*?\sfrom\s+)?["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)|import\(\s*["']([^"']+)["']\s*\)/g;

function extractImports(src) {
  const found = new Set();
  let m;
  while ((m = IMPORT_RE.exec(src))) {
    found.add(m[1] || m[2] || m[3]);
  }
  return Array.from(found);
}

function resolveRel(fromFile, spec, allFiles) {
  if (!spec.startsWith(".") && !spec.startsWith("/")) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [
    base,
    ...[...CODE_EXT].map((e) => base + e),
    ...[...CODE_EXT].map((e) => path.join(base, "index" + e)),
  ];
  for (const c of candidates) if (allFiles.has(c)) return c;
  return null;
}

// Group files into "modules" by folder depth.
// depth=1 => src/<first>, app/<first>, <top-level>
// depth=2 => src/<first>/<second>, app/<first>/<second>, <top-level>/<next>
// depth=3 => src/<first>/<second>/<third>, ...
function moduleOf(rel, depth) {
  const parts = rel.split(path.sep).filter(Boolean);
  // rel is a file path; exclude the filename so modules represent folders, not files.
  const dirs = parts.slice(0, -1);
  const d = Math.max(1, Number(depth || 1));

  if (dirs[0] === "src") {
    const segs = dirs.slice(1, 1 + d);
    return segs.length ? "src/" + segs.join("/") : "src";
  }
  if (dirs[0] === "app") {
    const segs = dirs.slice(1, 1 + d);
    return segs.length ? "app/" + segs.join("/") : "app";
  }

  const segs = dirs.slice(0, d);
  return segs.length ? segs.join("/") : "(root)";
}

const TONE_BY_HINT = [
  [/(api|server|backend|routes?\/api|functions?)/i, "violet"],
  [/(auth|session|oauth|login)/i, "violet"],
  [/(db|prisma|drizzle|schema|migrations?|supabase)/i, "emerald"],
  [/(worker|queue|cron|jobs?)/i, "amber"],
  [/(infra|docker|deploy|terraform)/i, "cyan"],
  [/(ui|component|design|theme|styles?)/i, "cyan"],
  [/(test|__tests__|spec|fixtures?)/i, "rose"],
  [/(legacy|deprecated|old)/i, "rose"],
];
function toneFor(name) {
  for (const [re, tone] of TONE_BY_HINT) if (re.test(name)) return tone;
  return "cyan";
}

function detectCycles(adj) {
  const cycles = [];
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  for (const n of adj.keys()) color.set(n, WHITE);
  const stack = [];
  function dfs(u) {
    color.set(u, GRAY); stack.push(u);
    for (const v of adj.get(u) || []) {
      const c = color.get(v);
      if (c === GRAY) {
        const idx = stack.indexOf(v);
        if (idx !== -1) cycles.push(stack.slice(idx).concat(v));
      } else if (c === WHITE) dfs(v);
    }
    color.set(u, BLACK); stack.pop();
  }
  for (const n of adj.keys()) if (color.get(n) === WHITE) dfs(n);
  return cycles;
}

async function scanProject(root, opts = {}) {
  const maxDepth = Math.max(1, Math.min(5, Number(opts.maxDepth ?? 3))); // keep UI readable
  const files = await walk(root);
  const fileSet = new Set(files);

  const fileEdges = []; // [from, to]
  const fileImports = new Map(); // file -> imports[]
  const externalCounts = new Map();

  let totalLoc = 0;
  const fileLoc = new Map();

  await Promise.all(files.map(async (f) => {
    let src;
    try { src = await fs.promises.readFile(f, "utf8"); } catch { return; }
    const loc = src.split("\n").length;
    fileLoc.set(f, loc); totalLoc += loc;
    const specs = extractImports(src);
    fileImports.set(f, specs);
    for (const s of specs) {
      if (s.startsWith(".") || s.startsWith("/")) {
        const tgt = resolveRel(f, s, fileSet);
        if (tgt && tgt !== f) fileEdges.push([f, tgt]);
      } else if (!s.startsWith("@/") && !s.startsWith("~/")) {
        const pkg = s.startsWith("@") ? s.split("/").slice(0, 2).join("/") : s.split("/")[0];
        externalCounts.set(pkg, (externalCounts.get(pkg) || 0) + 1);
      }
    }
  }));

  const topExternal = [...externalCounts.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 12)
    .map(([name, count]) => ({ name, count }));

  function buildGraphForDepth(depth) {
    // Aggregate to modules
    const modFiles = new Map(); // module -> Set(files)
    for (const f of files) {
      const rel = path.relative(root, f);
      const mod = moduleOf(rel, depth);
      if (!modFiles.has(mod)) modFiles.set(mod, new Set());
      modFiles.get(mod).add(f);
    }

    const fileToMod = new Map();
    for (const [m, set] of modFiles) for (const f of set) fileToMod.set(f, m);

    const edgeWeights = new Map(); // "a|b" -> count
    for (const [a, b] of fileEdges) {
      const ma = fileToMod.get(a), mb = fileToMod.get(b);
      if (!ma || !mb || ma === mb) continue;
      const k = ma + "|" + mb;
      edgeWeights.set(k, (edgeWeights.get(k) || 0) + 1);
    }

    const adj = new Map();
    for (const m of modFiles.keys()) adj.set(m, new Set());
    for (const k of edgeWeights.keys()) {
      const [a, b] = k.split("|");
      if (!adj.has(a)) adj.set(a, new Set());
      adj.get(a).add(b);
    }
    const cycles = detectCycles(new Map([...adj].map(([k, v]) => [k, [...v]])));

    // Layout: simple layered-by-fan-in
    const fanIn = new Map();
    for (const m of modFiles.keys()) fanIn.set(m, 0);
    for (const k of edgeWeights.keys()) {
      const [, b] = k.split("|");
      fanIn.set(b, (fanIn.get(b) || 0) + 1);
    }
    const sortedMods = [...modFiles.keys()].sort((a, b) => (fanIn.get(a) - fanIn.get(b)) || a.localeCompare(b));
    const cols = 4;
    const colW = 280, rowH = 150;
    const inCycle = new Set();
    for (const cy of cycles) for (const n of cy) inCycle.add(n);

    const nodes = sortedMods.map((m, i) => {
      const set = modFiles.get(m) || new Set();
      const filesInMod = set.size;
      const loc = [...set].reduce((a, f) => a + (fileLoc.get(f) || 0), 0);
      const col = i % cols, row = Math.floor(i / cols);
      return {
        id: m,
        label: m,
        sub: `${filesInMod} files · ${loc} loc`,
        tone: inCycle.has(m) ? "rose" : toneFor(m),
        warn: inCycle.has(m),
        x: 60 + col * colW,
        y: 60 + row * rowH,
        files: filesInMod,
        loc,
      };
    });

    const edges = [...edgeWeights.entries()].map(([k, w], i) => {
      const [a, b] = k.split("|");
      return { id: "e" + i, source: a, target: b, weight: w };
    });

    return {
      root,
      generatedAt: new Date().toISOString(),
      stats: {
        files: files.length,
        modules: nodes.length,
        edges: edges.length,
        cycles: cycles.length,
        loc: totalLoc,
      },
      nodes,
      edges,
      cycles,
      topExternal,
    };
  }

  const graphsByDepth = {};
  for (let depth = 1; depth <= maxDepth; depth++) {
    graphsByDepth[depth] = buildGraphForDepth(depth);
  }

  return {
    root,
    generatedAt: new Date().toISOString(),
    stats: {
      files: files.length,
      loc: totalLoc,
    },
    graphsByDepth,
    maxDepth,
  };
}

module.exports = { scanProject };