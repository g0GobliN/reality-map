/* eslint-disable */
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const IGNORE_DIRS = new Set([
  "node_modules", ".git", ".next", ".turbo", ".cache", "dist", "build",
  "out", "coverage", ".vercel", ".netlify", ".output", ".nuxt", ".svelte-kit",
  "target", "vendor", ".venv", "venv", "__pycache__", ".idea", ".vscode",
  ".DS_Store", ".pnpm-store",
]);

const CODE_EXT = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts",
  ".vue", ".svelte", ".astro", ".py", ".go", ".rs",
]);

const FILES_INDEX_CAP = 6000;

function mergeCodeExtensions(extra) {
  const s = new Set(CODE_EXT);
  for (const raw of extra || []) {
    let e = String(raw).trim().toLowerCase();
    if (!e) continue;
    if (!e.startsWith(".")) e = "." + e;
    s.add(e);
  }
  return s;
}

/** @returns {string[]} */
function parseRealityMapIgnoreFile(contents) {
  const patterns = [];
  for (const line of String(contents).split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    patterns.push(t.replace(/\\/g, "/"));
  }
  return patterns;
}

function globLineToRegex(line) {
  let s = "";
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "*") {
      s += "[^/]*";
      continue;
    }
    if (c === "?") {
      s += "[^/]";
      continue;
    }
    if ("\\.^$+()[]{}|".includes(c)) {
      s += "\\" + c;
      continue;
    }
    s += c;
  }
  return new RegExp("^" + s + "$");
}

/**
 * Minimal ignore rules (not full .gitignore):
 * - Lines are paths relative to project root (forward slashes).
 * - `*` and `?` wildcards match within a single path segment (no `/` in a match span).
 * - If the line has no glob chars, it matches that path or anything under it
 *   (`foo` matches `foo` and `foo/…`; `foo/` is treated the same).
 */
function compileRealityMapIgnorePatterns(lines) {
  const out = [];
  for (const posix of lines) {
    const hasGlob = /[*?]/.test(posix);
    if (hasGlob) {
      out.push({ kind: "glob", re: globLineToRegex(posix), raw: posix });
    } else {
      const trimmed = posix.endsWith("/") ? posix.slice(0, -1) : posix;
      out.push({ kind: "prefix", prefix: trimmed, raw: posix });
    }
  }
  return out;
}

async function loadRealityMapIgnore(root) {
  const fp = path.join(root, ".realitymapignore");
  let txt;
  try {
    txt = await fs.promises.readFile(fp, "utf8");
  } catch (e) {
    if (e && (e.code === "ENOENT" || e.code === "EISDIR")) return [];
    const err = new Error(`cannot read .realitymapignore: ${fp}`);
    err.code = "EIGNORE";
    err.cause = e;
    throw err;
  }
  return compileRealityMapIgnorePatterns(parseRealityMapIgnoreFile(txt));
}

function relPosixFromRoot(root, fullPath) {
  return path.relative(root, fullPath).split(path.sep).join("/");
}

function isIgnoredRel(rel, isDir, matchers) {
  if (!matchers || !matchers.length) return false;
  for (const m of matchers) {
    if (m.kind === "glob") {
      if (m.re.test(rel)) return true;
    } else if (m.kind === "prefix") {
      if (rel === m.prefix || rel.startsWith(m.prefix + "/")) return true;
    }
  }
  return false;
}

async function walk(root, opts = {}) {
  const codeExtSet = opts.codeExtSet instanceof Set ? opts.codeExtSet : CODE_EXT;
  const ignoreMatchers = opts.ignoreMatchers || [];
  function isCodeFile(file) {
    return codeExtSet.has(path.extname(file).toLowerCase());
  }
  const out = [];
  async function rec(dir) {
    const relHere = relPosixFromRoot(root, dir);
    if (relHere && relHere !== "." && isIgnoredRel(relHere, true, ignoreMatchers)) return;
    let entries;
    try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      if (e.name.startsWith(".") && IGNORE_DIRS.has(e.name)) continue;
      if (IGNORE_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      const rel = relPosixFromRoot(root, full);
      if (isIgnoredRel(rel, e.isDirectory(), ignoreMatchers)) continue;
      if (e.isDirectory()) await rec(full);
      else if (e.isFile() && isCodeFile(e.name)) out.push(full);
    }
  }
  await rec(root);
  return out;
}

const IMPORT_RE = /(?:import|export)\s+(?:[^'"`;]*?\sfrom\s+)?["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)|import\(\s*["']([^"']+)["']\s*\)|from\s+([^"'\s]+)\s+import\s+[^;]+|import\s+([^"'\s]+)|use\s+([^;]+);|import\s*\(\s*[^)]*\)/g;

function extractImports(src, filePath = "") {
  const ext = path.extname(filePath).toLowerCase();
  const isJsLike = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"].includes(ext);

  const found = new Set();
  const details = [];
  let m;
  IMPORT_RE.lastIndex = 0;

  while ((m = IMPORT_RE.exec(src))) {
    let spec = m[1] || m[2] || m[3] || m[4] || m[5] || m[6];

    // Group 5 is the generic 'import identifier' (e.g. Python 'import math')
    // In JS/TS, this pattern is usually a false positive inside a string or comment
    // unless it's followed by 'from' (handled by group 1) or is a side-effect import (handled by group 1).
    if (m[5] && isJsLike) continue;

    if (m[7]) {
      // Go import block: extract individual imports
      const block = m[7];
      const goImportRe = /"([^"]+)"/g;
      let subM;
      while ((subM = goImportRe.exec(block))) {
        found.add(subM[1]);
        const lineNum = src.substring(0, m.index).split('\n').length;
        details.push({ spec: subM[1], line: lineNum, statement: m[0] });
      }
      continue;
    }

    if (spec) {
      // Basic sanitization: if it looks like it has quotes or weird chars, skip it
      if (spec.includes('"') || spec.includes("'") || spec.includes("`")) continue;

      found.add(spec);
      const lineNum = src.substring(0, m.index).split('\n').length;
      details.push({ spec, line: lineNum, statement: m[0] });
    }
  }
  return { specs: Array.from(found), details };
}

function extractFunctionsAndClasses(src, filePath) {
  const items = [];
  const ext = path.extname(filePath).toLowerCase();

  // Function declarations: function name(...) or async function name(...)
  const funcRe = /(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
  let m;
  while ((m = funcRe.exec(src))) {
    const line = src.substring(0, m.index).split('\n').length;
    items.push({ type: 'function', name: m[1], line });
  }

  // Arrow functions: const/let/var name = (...) =>
  const arrowRe = /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g;
  while ((m = arrowRe.exec(src))) {
    const line = src.substring(0, m.index).split('\n').length;
    items.push({ type: 'function', name: m[1], line });
  }

  // Class declarations: class Name
  const classRe = /class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
  while ((m = classRe.exec(src))) {
    const line = src.substring(0, m.index).split('\n').length;
    items.push({ type: 'class', name: m[1], line });
  }

  // TypeScript interfaces: interface Name
  if (['.ts', '.tsx'].includes(ext)) {
    const interfaceRe = /interface\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    while ((m = interfaceRe.exec(src))) {
      const line = src.substring(0, m.index).split('\n').length;
      items.push({ type: 'interface', name: m[1], line });
    }

    // TypeScript types: type Name =
    const typeRe = /type\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g;
    while ((m = typeRe.exec(src))) {
      const line = src.substring(0, m.index).split('\n').length;
      items.push({ type: 'type', name: m[1], line });
    }
  }

  // Python functions and classes
  if (ext === '.py') {
    const pyFuncRe = /def\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
    while ((m = pyFuncRe.exec(src))) {
      const line = src.substring(0, m.index).split('\n').length;
      items.push({ type: 'function', name: m[1], line });
    }

    const pyClassRe = /class\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
    while ((m = pyClassRe.exec(src))) {
      const line = src.substring(0, m.index).split('\n').length;
      items.push({ type: 'class', name: m[1], line });
    }
  }

  // Go functions and types
  if (ext === '.go') {
    const goFuncRe = /func\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
    while ((m = goFuncRe.exec(src))) {
      const line = src.substring(0, m.index).split('\n').length;
      items.push({ type: 'function', name: m[1], line });
    }

    const goTypeRe = /type\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
    while ((m = goTypeRe.exec(src))) {
      const line = src.substring(0, m.index).split('\n').length;
      items.push({ type: 'type', name: m[1], line });
    }
  }

  // Rust functions, structs, enums
  if (ext === '.rs') {
    const rsFuncRe = /fn\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
    while ((m = rsFuncRe.exec(src))) {
      const line = src.substring(0, m.index).split('\n').length;
      items.push({ type: 'function', name: m[1], line });
    }

    const rsStructRe = /struct\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
    while ((m = rsStructRe.exec(src))) {
      const line = src.substring(0, m.index).split('\n').length;
      items.push({ type: 'struct', name: m[1], line });
    }

    const rsEnumRe = /enum\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
    while ((m = rsEnumRe.exec(src))) {
      const line = src.substring(0, m.index).split('\n').length;
      items.push({ type: 'enum', name: m[1], line });
    }
  }

  return items;
}

function resolveRel(fromFile, spec, allFiles, codeExtSet) {
  const extSet = codeExtSet instanceof Set ? codeExtSet : CODE_EXT;
  if (!spec.startsWith(".") && !spec.startsWith("/")) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [
    base,
    ...[...extSet].map((e) => base + e),
    ...[...extSet].map((e) => path.join(base, "index" + e)),
  ];
  for (const c of candidates) if (allFiles.has(c)) return c;
  return null;
}

function loadAliases(root) {
  // Returns a map of alias prefix → absolute directory, e.g. {"@/" => "/project/src/"}
  const aliases = new Map();
  for (const cfg of ["tsconfig.json", "jsconfig.json"]) {
    try {
      const raw = fs.readFileSync(path.join(root, cfg), "utf8");
      // Strip JS comments before parsing
      const stripped = raw.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
      const json = JSON.parse(stripped);
      const tsPaths = json.compilerOptions?.paths || {};
      const baseUrl = json.compilerOptions?.baseUrl
        ? path.resolve(root, json.compilerOptions.baseUrl)
        : root;
      for (const [alias, targets] of Object.entries(tsPaths)) {
        if (!Array.isArray(targets) || !targets.length) continue;
        // e.g. "@/*" → ["./src/*"] ; strip the trailing /*
        const prefix = alias.endsWith("/*") ? alias.slice(0, -1) : alias;
        const target = targets[0].endsWith("/*") ? targets[0].slice(0, -1) : targets[0];
        aliases.set(prefix, path.resolve(baseUrl, target));
      }
      break; // use first config found
    } catch { }
  }
  // Fallback: if "@" not already mapped, try src/ then root
  if (!aliases.has("@/")) {
    const srcDir = path.join(root, "src");
    try {
      if (fs.statSync(srcDir).isDirectory()) aliases.set("@/", srcDir);
    } catch { }
    if (!aliases.has("@/")) aliases.set("@/", root);
  }
  if (!aliases.has("~/")) aliases.set("~/", root);
  return aliases;
}

function resolveAlias(spec, aliases, allFiles, codeExtSet) {
  const extSet = codeExtSet instanceof Set ? codeExtSet : CODE_EXT;
  for (const [prefix, dir] of aliases) {
    if (!spec.startsWith(prefix)) continue;
    const rest = spec.slice(prefix.length);
    const base = path.join(dir, rest);
    const candidates = [
      base,
      ...[...extSet].map((e) => base + e),
      ...[...extSet].map((e) => path.join(base, "index" + e)),
    ];
    for (const c of candidates) if (allFiles.has(c)) return c;
  }
  return null;
}

function getGitTimestamps(root) {
  const times = new Map();
  try {
    // This command outputs: [timestamp] \n [filename] \n ...
    const out = execSync('git log --format="%at" --name-only', { cwd: root, stdio: ['pipe', 'pipe', 'ignore'], encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 });
    const lines = out.split('\n');
    let curTime = 0;
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      if (/^\d+$/.test(t)) {
        curTime = parseInt(t, 10);
      } else {
        if (!times.has(t)) times.set(t, curTime);
      }
    }
  } catch (e) {
    // Not a git repo or git not found, ignore
  }
  return times;
}

function moduleOf(rel, depth) {
  const parts = rel.split(path.sep).filter(Boolean);
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
  return segs.length ? segs.join("/") : "(Project Root)";
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

function buildInsights(root, files, fileEdges, fileLoc, externalCounts) {
  const rel = (p) => path.relative(root, p).split(path.sep).join("/");

  const incoming = new Map();
  const outgoing = new Map();
  for (const [a, b] of fileEdges) {
    incoming.set(b, (incoming.get(b) || 0) + 1);
    outgoing.set(a, (outgoing.get(a) || 0) + 1);
  }

  let externalRefs = 0;
  for (const c of externalCounts.values()) externalRefs += c;

  const topFilesByLoc = [...files]
    .map((f) => ({ path: rel(f), loc: fileLoc.get(f) || 0 }))
    .sort((a, b) => b.loc - a.loc)
    .slice(0, 35);

  const topImported = [...incoming.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([f, count]) => ({ path: rel(f), count, loc: fileLoc.get(f) || 0 }));

  const hubs = [...files]
    .map((f) => {
      const inn = incoming.get(f) || 0;
      const out = outgoing.get(f) || 0;
      return { path: rel(f), loc: fileLoc.get(f) || 0, in: inn, out, score: (inn + 1) * (out + 1) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 25);

  const zeroInternalImporters = files
    .filter((f) => !(incoming.get(f) > 0))
    .map((f) => ({ path: rel(f), loc: fileLoc.get(f) || 0, internalExports: outgoing.get(f) || 0 }))
    .sort((a, b) => b.loc - a.loc)
    .slice(0, 30);

  const isolatedInternal = files.filter((f) => (incoming.get(f) || 0) === 0 && (outgoing.get(f) || 0) === 0).length;

  const filesIndex = [...files]
    .map((f) => ({
      path: rel(f),
      loc: fileLoc.get(f) || 0,
      ext: path.extname(f) || "—",
      importers: incoming.get(f) || 0,
      importees: outgoing.get(f) || 0,
    }))
    .sort((a, b) => b.loc - a.loc)
    .slice(0, FILES_INDEX_CAP);

  return {
    summary: {
      files: files.length,
      internalEdges: fileEdges.length,
      externalRefs,
      uniquePackages: externalCounts.size,
      loc: [...fileLoc.values()].reduce((a, b) => a + b, 0),
      isolatedInternalFiles: isolatedInternal,
    },
    topFilesByLoc,
    topImported,
    hubs,
    zeroInternalImporters,
    filesIndex,
    filesIndexCap: FILES_INDEX_CAP,
    filesIndexTruncated: files.length > FILES_INDEX_CAP,
    externalPackages: [...externalCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count })),
  };
}

async function scanProject(root, opts = {}) {
  const onProgress = typeof opts.onProgress === "function" ? opts.onProgress : () => { };
  const maxDepth = Math.max(1, Math.min(5, Number(opts.maxDepth ?? 3)));

  let st;
  try {
    st = await fs.promises.stat(root);
  } catch (e) {
    const err = new Error(`cannot access project root: ${root}`);
    err.code = "EROOT";
    err.cause = e;
    throw err;
  }
  if (!st.isDirectory()) {
    const err = new Error(`not a directory: ${root}`);
    err.code = "ENOTDIR";
    throw err;
  }

  const codeExtSet = mergeCodeExtensions(opts.includeExt);
  const aliases = loadAliases(root);
  let ignoreMatchers = opts.ignoreMatchers;
  if (ignoreMatchers === undefined) {
    ignoreMatchers = await loadRealityMapIgnore(root);
  }

  onProgress({ phase: "discover" });
  const files = await walk(root, { ignoreMatchers, codeExtSet });
  onProgress({ phase: "discovered", files: files.length });
  const fileSet = new Set(files);
  const gitTimes = getGitTimestamps(root);

  const fileEdges = [];
  const fileImports = new Map();
  const fileSymbols = new Map();
  const externalCounts = new Map();

  let totalLoc = 0;
  const fileLoc = new Map();
  const fileGit = new Map();

  // Resolve <script src> in HTML files so browser entry points get incoming edges
  const HTML_SCRIPT_RE = /<script[^>]+src=["']([^"']+)["']/gi;
  const WEB_ASSET_DIRS = new Set(["public", "static", "assets"]);
  try {
    const htmlFiles = await walk(root, { ignoreMatchers, codeExtSet: new Set([".html"]) });
    for (const hf of htmlFiles) {
      let hsrc;
      try { hsrc = await fs.promises.readFile(hf, "utf8"); } catch { continue; }
      let m;
      while ((m = HTML_SCRIPT_RE.exec(hsrc)) !== null) {
        const src = m[1];
        if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("//")) continue;
        const tgt = resolveRel(hf, src.startsWith("/") ? path.join(root, src) : src.startsWith(".")
          ? src
          : "./" + src, fileSet, codeExtSet)
          || (() => {
            const abs = path.resolve(path.dirname(hf), src.startsWith("/") ? path.join(root, src) : src);
            return fileSet.has(abs) ? abs : null;
          })();
        if (tgt && tgt !== hf) fileEdges.push([hf, tgt]);
      }
    }
  } catch { }

  onProgress({ phase: "parse_imports", files: files.length });
  await Promise.all(files.map(async (f) => {
    const rel = path.relative(root, f).split(path.sep).join("/");
    let src;
    try { src = await fs.promises.readFile(f, "utf8"); } catch { return; }
    const loc = src.split("\n").length;
    fileLoc.set(f, loc); totalLoc += loc;

    fileGit.set(f, gitTimes.get(rel) || 0);

    const importData = extractImports(src, f);
    fileImports.set(f, importData);

    const symbols = extractFunctionsAndClasses(src, f);
    fileSymbols.set(f, symbols);

    for (const s of importData.specs) {
      if (s.startsWith(".") || s.startsWith("/")) {
        const tgt = resolveRel(f, s, fileSet, codeExtSet);
        if (tgt && tgt !== f) fileEdges.push([f, tgt]);
      } else {
        const tgt = resolveAlias(s, aliases, fileSet, codeExtSet);
        if (tgt && tgt !== f) {
          fileEdges.push([f, tgt]);
        } else {
          const pkg = s.startsWith("@") ? s.split("/").slice(0, 2).join("/") : s.split("/")[0];
          externalCounts.set(pkg, (externalCounts.get(pkg) || 0) + 1);
        }
      }
    }
  }));
  onProgress({ phase: "parsed" });

  const insights = buildInsights(root, files, fileEdges, fileLoc, externalCounts);

  const topExternal = [...externalCounts.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 20)
    .map(([name, count]) => ({ name, count }));

  function buildGraphForDepth(depth) {
    const modFiles = new Map();
    for (const f of files) {
      const rel = path.relative(root, f).split(path.sep).join("/");
      const mod = moduleOf(rel, depth);
      if (!modFiles.has(mod)) modFiles.set(mod, new Set());
      modFiles.get(mod).add(f);
    }

    const fileToMod = new Map();
    for (const [m, set] of modFiles) for (const f of set) fileToMod.set(f, m);

    const edgeWeights = new Map();
    const moduleEdgesFiles = new Map();
    for (const [a, b] of fileEdges) {
      const ma = fileToMod.get(a), mb = fileToMod.get(b);
      if (!ma || !mb || ma === mb) continue;
      const k = ma + "|" + mb;
      edgeWeights.set(k, (edgeWeights.get(k) || 0) + 1);
      if (!moduleEdgesFiles.has(k)) moduleEdgesFiles.set(k, new Set());
      moduleEdgesFiles.get(k).add(a); // File 'a' is the one importing something from 'mb'
    }

    const adj = new Map();
    for (const m of modFiles.keys()) adj.set(m, new Set());
    for (const k of edgeWeights.keys()) {
      const [a, b] = k.split("|");
      if (!adj.has(a)) adj.set(a, new Set());
      adj.get(a).add(b);
    }
    const cycles = detectCycles(new Map([...adj].map(([k, v]) => [k, [...v]])));

    const fanIn = new Map();
    const fanOut = new Map();
    for (const m of modFiles.keys()) {
      fanIn.set(m, 0);
      fanOut.set(m, 0);
    }
    for (const k of edgeWeights.keys()) {
      const [a, b] = k.split("|");
      fanIn.set(b, (fanIn.get(b) || 0) + 1);
      fanOut.set(a, (fanOut.get(a) || 0) + 1);
    }

    const fileIncoming = new Map();
    for (const [a, b] of fileEdges) {
      fileIncoming.set(b, (fileIncoming.get(b) || 0) + 1);
    }

    const sortedMods = [...modFiles.keys()].sort((a, b) => (fanIn.get(a) - fanIn.get(b)) || a.localeCompare(b));
    const cols = 4;
    const colW = 280, rowH = 150;
    const inCycle = new Set();
    const cycleCulprits = new Map(); // mod -> Set of file paths

    for (const cy of cycles) {
      for (let i = 0; i < cy.length - 1; i++) {
        const ma = cy[i], mb = cy[i + 1];
        inCycle.add(ma);
        const k = ma + "|" + mb;
        if (moduleEdgesFiles.has(k)) {
          if (!cycleCulprits.has(ma)) cycleCulprits.set(ma, new Set());
          for (const f of moduleEdgesFiles.get(k)) cycleCulprits.get(ma).add(f);
        }
      }
    }

    const nodes = sortedMods.map((m, i) => {
      const set = modFiles.get(m) || new Set();
      const filesInMod = set.size;
      const loc = [...set].reduce((a, f) => a + (fileLoc.get(f) || 0), 0);
      const lastModified = [...set].reduce((a, f) => Math.max(a, fileGit.get(f) || 0), 0);

      const col = i % cols, row = Math.floor(i / cols);
      const relPaths = [...set].map((f) => path.relative(root, f).split(path.sep).join("/")).sort();

      const isConfigOnly = [...set].every(f => {
        const bn = path.basename(f).toLowerCase();
        return bn.includes('config.') || bn.startsWith('.') || bn === 'package.json' || bn === 'readme.md' || bn === 'license';
      });

      const isOrphan = fanIn.get(m) === 0 && fanOut.get(m) === 0;
      const isEntry = fanIn.get(m) === 0 && fanOut.get(m) > 0;

      let warnMsg = null;
      let infoMsg = null;

      if (inCycle.has(m)) {
        warnMsg = "Circular Dependency (Loop): These modules depend on each other in a circle (A -> B -> A). This 'tangled knot' makes it hard to change one without breaking the other.";
      } else if (isOrphan && m !== "(Project Root)" && !isConfigOnly) {
        warnMsg = "Isolated Module (Island): This folder is not connected to the rest of your app. No other parts of the app are using it, and it doesn't use anything outside itself.";
      }

      if (loc > 2000) {
        infoMsg = "Giant Module: This file is very large. Consider breaking it into smaller, more manageable pieces.";
      } else if (isEntry) {
        infoMsg = "Entry Point: This is one of the starting points of your application.";
      }

      const fileIssues = {};
      for (const f of set) {
        const relF = path.relative(root, f).split(path.sep).join("/");
        const issues = [];
        if (cycleCulprits.has(m) && cycleCulprits.get(m).has(f)) {
          issues.push("cycle-bridge");
        }
        const relParts = path.relative(root, f).split(path.sep);
        const inWebAssetDir = relParts.some((p) => WEB_ASSET_DIRS.has(p));
        const ext = path.extname(f).toLowerCase();
        const canDetectDead = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".vue", ".svelte", ".astro"]).has(ext);
        if (isOrphan && !isConfigOnly && !inWebAssetDir && canDetectDead && !(fileIncoming.get(f) > 0)) {
          issues.push("dead-code");
        }
        if (issues.length) fileIssues[relF] = issues;
      }

      return {
        id: m,
        label: m,
        sub: `${filesInMod} files · ${loc} loc`,
        tone: inCycle.has(m) ? "rose" : isOrphan ? "amber" : toneFor(m),
        warn: inCycle.has(m) || isOrphan,
        warnMsg,
        infoMsg,
        isOrphan,
        isEntry,
        x: 60 + col * colW,
        y: 60 + row * rowH,
        files: filesInMod,
        loc,
        lastModified,
        fanIn: fanIn.get(m) || 0,
        fanOut: fanOut.get(m) || 0,
        pathsPreview: relPaths.slice(0, 100),
        allPaths: relPaths,
        fileIssues
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

  onProgress({ phase: "building_graphs", maxDepth });
  const graphsByDepth = {};
  for (let depth = 1; depth <= maxDepth; depth++) {
    graphsByDepth[depth] = buildGraphForDepth(depth);
    onProgress({ phase: "depth_ready", depth });
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
    insights,
    scannedFilePaths: files.map((f) => path.relative(root, f).split(path.sep).join("/")).sort(),
    fileDetails: {
      imports: Object.fromEntries([...fileImports.entries()].map(([k, v]) => [path.relative(root, k).split(path.sep).join("/"), v])),
      symbols: Object.fromEntries([...fileSymbols.entries()].map(([k, v]) => [path.relative(root, k).split(path.sep).join("/"), v])),
      loc: Object.fromEntries([...fileLoc.entries()].map(([k, v]) => [path.relative(root, k).split(path.sep).join("/"), v])),
      lastModified: Object.fromEntries([...fileGit.entries()].map(([k, v]) => [path.relative(root, k).split(path.sep).join("/"), v])),
    },
  };
}

module.exports = { scanProject };
