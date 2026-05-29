/* eslint-disable */
"use strict";

const fs = require("fs");
const path = require("path");

const RESOLVE_EXTS = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"];
const SRC_EXTS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]);

const ENTRY_BASENAMES = new Set([
  "index", "main", "start", "server", "router", "app", "App",
  "entry", "client", "bootstrap", "init",
]);

function joinPosix(dir, rel) {
  const parts = (dir + "/" + rel).split("/");
  const out = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p !== ".") out.push(p);
  }
  return out.join("/");
}

/**
 * Read tsconfig.json from root and extract path alias mappings.
 * Falls back to @/ → srcDir if tsconfig is missing or unparseable.
 */
function loadAliases(root, srcDirNorm) {
  const aliases = [{ prefix: "@/", target: srcDirNorm + "/" }];
  if (!root) return aliases;
  try {
    let raw = fs.readFileSync(path.join(root, "tsconfig.json"), "utf8");
    // Strip // comments, /* */ blocks, and trailing commas so JSON.parse works
    raw = raw
      .replace(/\/\/[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/,(\s*[}\]])/g, "$1");
    const config = JSON.parse(raw);
    const tsPaths = config?.compilerOptions?.paths || {};
    for (const [alias, targets] of Object.entries(tsPaths)) {
      if (!alias.endsWith("/*")) continue;
      const target = Array.isArray(targets) ? targets[0] : null;
      if (!target) continue;
      const prefix = alias.slice(0, -1); // "@/*" → "@/"
      const normalTarget = target.replace(/\*$/, "").replace(/^\.\//, "");
      if (!aliases.some((a) => a.prefix === prefix)) {
        aliases.push({ prefix, target: normalTarget });
      }
    }
  } catch {}
  return aliases;
}

function resolveRelativeSpec(fromFile, spec, fileSet) {
  if (!spec.startsWith(".") && !spec.startsWith("/")) return null;
  const fromDir = fromFile.split("/").slice(0, -1).join("/");
  const base = joinPosix(fromDir, spec);
  const candidates = [
    base,
    ...RESOLVE_EXTS.map((e) => base + e),
    ...RESOLVE_EXTS.map((e) => base + "/index" + e),
  ];
  for (const c of candidates) if (fileSet.has(c)) return c;
  return null;
}

/**
 * Resolve an import spec to a file path, handling both relative imports
 * and path aliases (e.g. @/components/Button → src/components/Button.tsx).
 */
function resolveSpec(fromFile, spec, fileSet, aliases) {
  if (spec.startsWith(".") || spec.startsWith("/")) {
    return resolveRelativeSpec(fromFile, spec, fileSet);
  }
  for (const { prefix, target } of aliases) {
    if (spec.startsWith(prefix)) {
      const rest = spec.slice(prefix.length);
      const base = target + rest;
      const candidates = [
        base,
        ...RESOLVE_EXTS.map((e) => base + e),
        ...RESOLVE_EXTS.map((e) => base + "/index" + e),
      ];
      for (const c of candidates) if (fileSet.has(c)) return c;
    }
  }
  return null;
}

function buildImporterCounts(allFiles, importsMap, fileSet, aliases) {
  const counts = new Map();
  for (const f of allFiles) counts.set(f, 0);
  for (const file of allFiles) {
    const data = importsMap[file];
    if (!data) continue;
    for (const spec of data.specs || []) {
      const resolved = resolveSpec(file, spec, fileSet, aliases);
      if (resolved && resolved !== file) {
        counts.set(resolved, (counts.get(resolved) || 0) + 1);
      }
    }
  }
  return counts;
}

/**
 * Walk the import graph starting from all seed files simultaneously.
 * Follows both relative imports and path aliases.
 */
function collectReachableFromSeeds(seeds, importsMap, fileSet, aliases) {
  const reachable = new Set();
  const stack = [...seeds];
  while (stack.length) {
    const file = stack.pop();
    if (reachable.has(file)) continue;
    reachable.add(file);
    const data = importsMap[file];
    if (!data) continue;
    for (const spec of data.specs || []) {
      const resolved = resolveSpec(file, spec, fileSet, aliases);
      if (resolved && !reachable.has(resolved)) stack.push(resolved);
    }
  }
  return reachable;
}

/**
 * Returns true if this file looks like a named entry point sitting
 * directly at the root of the source directory (e.g. src/router.tsx).
 */
function isNamedEntry(file, srcDirNorm) {
  const parts = file.split("/");
  const srcParts = srcDirNorm.split("/");
  if (parts.length !== srcParts.length + 1) return false;
  const basename = parts[parts.length - 1].replace(/\.[^.]+$/, "");
  return ENTRY_BASENAMES.has(basename);
}

/**
 * Build a report of source files in srcDir never reachable from any
 * project root.
 *
 * Seeds are:
 *   1. Every file with zero importers that lives OUTSIDE srcDir
 *      (scripts, configs, test helpers — they may import into srcDir via
 *      path aliases that the relative-import scanner cannot resolve).
 *   2. Every file sitting directly in srcDir whose name matches a common
 *      entry-point basename (start, router, main, index, server, …).
 *
 * Zero-importer files INSIDE srcDir are intentionally NOT seeded — those
 * are exactly the orphans this report is meant to surface.
 *
 * Path aliases (e.g. @/ → src/) are resolved via tsconfig.json paths,
 * falling back to @/ → srcDir when no tsconfig is found.
 *
 * @param {object} scan  - result of scanProject()
 * @param {string} srcDir - relative source directory, e.g. "src"
 * @param {string} [root] - absolute project root (used to stat file sizes and load tsconfig)
 */
function buildUnreachableReport(scan, srcDir, root) {
  const allFiles = scan.scannedFilePaths || [];
  const importsMap = (scan.fileDetails || {}).imports || {};
  const locMap = (scan.fileDetails || {}).loc || {};
  const fileSet = new Set(allFiles);

  const srcDirNorm = srcDir.replace(/\\/g, "/").replace(/\/+$/, "");
  const aliases = loadAliases(root, srcDirNorm);

  const srcFiles = allFiles.filter((f) => {
    const ext = f.slice(f.lastIndexOf(".")).toLowerCase();
    if (!SRC_EXTS.has(ext)) return false;
    return f === srcDirNorm || f.startsWith(srcDirNorm + "/");
  });

  if (!srcFiles.length) {
    return {
      srcDir: srcDirNorm,
      seeds: [],
      totalFiles: 0,
      reachableCount: 0,
      unreachableCount: 0,
      totalUnreachableBytes: 0,
      unreachable: [],
    };
  }

  const importerCounts = buildImporterCounts(allFiles, importsMap, fileSet, aliases);

  // Seed set: named entries in srcDir + zero-importer files outside srcDir.
  const seedSet = new Set();
  for (const f of allFiles) {
    if (f !== srcDirNorm && !f.startsWith(srcDirNorm + "/")) {
      if ((importerCounts.get(f) || 0) === 0) seedSet.add(f);
    }
  }
  for (const f of srcFiles) {
    if (isNamedEntry(f, srcDirNorm)) seedSet.add(f);
  }

  const reachable = collectReachableFromSeeds([...seedSet], importsMap, fileSet, aliases);

  const unreachable = [];
  for (const file of srcFiles) {
    if (reachable.has(file)) continue;
    let bytes = null;
    if (root) {
      try { bytes = fs.statSync(path.join(root, file)).size; } catch {}
    }
    unreachable.push({ path: file, bytes, loc: locMap[file] || 0 });
  }

  unreachable.sort((a, b) => (b.bytes ?? b.loc) - (a.bytes ?? a.loc));

  const namedSeeds = srcFiles.filter((f) => isNamedEntry(f, srcDirNorm));

  return {
    srcDir: srcDirNorm,
    seeds: namedSeeds,
    totalFiles: srcFiles.length,
    reachableCount: srcFiles.filter((f) => reachable.has(f)).length,
    unreachableCount: unreachable.length,
    totalUnreachableBytes: unreachable.reduce((s, f) => s + (f.bytes || 0), 0),
    unreachable,
  };
}

module.exports = { buildUnreachableReport };
