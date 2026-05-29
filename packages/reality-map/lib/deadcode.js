/* eslint-disable */
"use strict";

const fs = require("fs");
const path = require("path");

/**
 * Dead Code Detector
 * Scores each file on likelihood of being unused/dead code.
 * Uses multiple signals — not just "0 importers".
 */

const ENTRY_PATTERNS = [
  // JS/TS
  /^(src\/)?index\.[jt]sx?$/,
  /^(src\/)?main\.[jt]sx?$/,
  /^(src\/)?app\.[jt]sx?$/,
  /^(src\/)?server\.[jt]sx?$/,
  /^(src\/)?worker\.[jt]sx?$/,
  /pages\//,
  /routes\//,
  /app\//,
  /bin\//,
  /scripts?\//,
  // Python
  /^(src\/)?main\.py$/,
  /^(src\/)?__main__\.py$/,
  /(^|\/)app\.py$/,
  /(^|\/)wsgi\.py$/,
  /(^|\/)asgi\.py$/,
  /(^|\/)manage\.py$/,
  /(^|\/)setup\.py$/,
  // Go
  /main\.go$/,
  // Rust
  /(^|src\/)main\.rs$/,
  /(^|src\/)lib\.rs$/,
];

const TEST_PATTERNS = [
  // JS/TS
  /\.(test|spec)\.[jt]sx?$/,
  /__tests__\//,
  /\.stories\.[jt]sx?$/,
  // Python
  /\/test_[^/]+\.py$/,
  /\/[^/]+_test\.py$/,
  /\/tests?\//,
  /(^|\/)conftest\.py$/,
  // Go
  /_test\.go$/,
  // Rust (tests/ directory convention)
  /\/tests?\//,
];

const CONFIG_PATTERNS = [
  // JS/TS
  /\.(config|rc)\.[jt]sx?$/,
  /vite\.config/,
  /webpack\.config/,
  /tailwind\.config/,
  /next\.config/,
  /eslint/,
  /prettier/,
  // Rust
  /build\.rs$/,
];

function loadAliases(root) {
  const aliases = [{ prefix: "@/", target: "src/" }];
  if (!root) return aliases;
  try {
    let raw = fs.readFileSync(path.join(root, "tsconfig.json"), "utf8");
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
      const prefix = alias.slice(0, -1);
      const normalTarget = target.replace(/\*$/, "").replace(/^\.\//, "");
      if (!aliases.some((a) => a.prefix === prefix)) {
        aliases.push({ prefix, target: normalTarget });
      }
    }
  } catch {}
  return aliases;
}

function buildDeadCodeReport(scan, root) {
  const fileDetails = scan.fileDetails || {};
  const importsMap = fileDetails.imports || {};
  const resolvedEdges = fileDetails.resolvedEdges || null;
  const locMap = fileDetails.loc || {};
  const allFiles = scan.scannedFilePaths || [];
  const fileSet = new Set(allFiles);
  const aliases = loadAliases(root);

  // Count importers for each file
  const importerCount = new Map();
  for (const file of allFiles) importerCount.set(file, 0);

  if (resolvedEdges) {
    // Fast path: use pre-resolved edges from scanProject (handles Go modules, Python absolute imports, Rust mods)
    for (const [, targets] of Object.entries(resolvedEdges)) {
      for (const target of targets) {
        if (importerCount.has(target)) {
          importerCount.set(target, (importerCount.get(target) || 0) + 1);
        }
      }
    }
  } else {
    // Fallback: re-resolve from raw specs (used by tests and older scan results)
    for (const file of allFiles) {
      const data = importsMap[file];
      if (!data) continue;
      for (const spec of (data.specs || [])) {
        const resolved = resolveSpecFull(file, spec, fileSet, aliases);
        if (resolved && resolved !== file) {
          importerCount.set(resolved, (importerCount.get(resolved) || 0) + 1);
        }
      }
    }
  }

  const candidates = [];

  for (const file of allFiles) {
    const importers = importerCount.get(file) || 0;
    if (importers > 0) continue; // has importers, skip

    const loc = locMap[file] || 0;
    if (loc === 0) continue; // empty file

    // Check if it's a known entry point, test, or config
    const isEntry = ENTRY_PATTERNS.some(re => re.test(file));
    const isTest = TEST_PATTERNS.some(re => re.test(file));
    const isConfig = CONFIG_PATTERNS.some(re => re.test(file));

    if (isEntry || isTest || isConfig) continue;

    // Check if it exports anything (has outgoing imports = it imports others, meaning it's active code)
    const outgoing = (importsMap[file]?.specs || []).length;

    // Confidence score: higher = more likely dead
    // Factors: no importers, not entry/test/config, small file, no outgoing imports
    let confidence = 60; // base: no importers
    if (outgoing === 0) confidence += 20; // imports nothing either = truly isolated
    if (loc < 30) confidence += 10; // tiny file
    if (loc > 200) confidence -= 15; // large files are less likely to be dead
    if (file.includes("util") || file.includes("helper")) confidence -= 10; // utils often imported dynamically
    if (file.includes("legacy") || file.includes("old") || file.includes("deprecated")) confidence += 15;
    confidence = Math.max(10, Math.min(99, confidence));

    candidates.push({
      path: file,
      loc,
      outgoing,
      confidence,
      reason: buildReason(outgoing, loc, file),
    });
  }

  candidates.sort((a, b) => b.confidence - a.confidence);

  return {
    totalFiles: allFiles.length,
    candidateCount: candidates.length,
    candidates: candidates.slice(0, 100),
    potentialLocSavings: candidates.slice(0, 100).reduce((s, f) => s + f.loc, 0),
  };
}

function buildReason(outgoing, loc, file) {
  const parts = [];
  parts.push("no internal importers");
  if (outgoing === 0) parts.push("imports nothing");
  if (loc < 30) parts.push("tiny file");
  if (file.includes("legacy") || file.includes("old")) parts.push("name suggests legacy");
  return parts.join(" · ");
}

function resolveSpecFull(fromFile, spec, fileSet, aliases) {
  const exts = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte", ".py", ".go", ".rs"];
  function tryCandidates(base) {
    const candidates = [
      base,
      ...exts.map(e => base + e),
      ...exts.map(e => base + "/index" + e),
      base + "/__init__.py",
      base + "/mod.rs",
    ];
    for (const c of candidates) if (fileSet.has(c)) return c;
    return null;
  }
  if (spec.startsWith(".") || spec.startsWith("/")) {
    const fromDir = fromFile.split("/").slice(0, -1).join("/");
    return tryCandidates(joinPosix(fromDir, spec));
  }
  for (const { prefix, target } of aliases) {
    if (spec.startsWith(prefix)) {
      const found = tryCandidates(target + spec.slice(prefix.length));
      if (found) return found;
    }
  }
  return null;
}

function joinPosix(dir, rel) {
  const parts = (dir + "/" + rel).split("/");
  const out = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p !== ".") out.push(p);
  }
  return out.join("/");
}

module.exports = { buildDeadCodeReport };
