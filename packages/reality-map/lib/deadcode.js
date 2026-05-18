/* eslint-disable */
"use strict";

/**
 * Dead Code Detector
 * Scores each file on likelihood of being unused/dead code.
 * Uses multiple signals — not just "0 importers".
 */

const ENTRY_PATTERNS = [
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
];

const TEST_PATTERNS = [
  /\.(test|spec)\.[jt]sx?$/,
  /__tests__\//,
  /\.stories\.[jt]sx?$/,
];

const CONFIG_PATTERNS = [
  /\.(config|rc)\.[jt]sx?$/,
  /vite\.config/,
  /webpack\.config/,
  /tailwind\.config/,
  /next\.config/,
  /eslint/,
  /prettier/,
];

function buildDeadCodeReport(scan) {
  const fileDetails = scan.fileDetails || {};
  const importsMap = fileDetails.imports || {};
  const locMap = fileDetails.loc || {};
  const allFiles = scan.scannedFilePaths || [];

  // Count importers for each file
  const importerCount = new Map();
  for (const file of allFiles) importerCount.set(file, 0);

  for (const file of allFiles) {
    const data = importsMap[file];
    if (!data) continue;
    for (const spec of (data.specs || [])) {
      const resolved = resolveSpec(file, spec, allFiles);
      if (resolved && resolved !== file) {
        importerCount.set(resolved, (importerCount.get(resolved) || 0) + 1);
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

function resolveSpec(fromFile, spec, allFiles) {
  if (!spec.startsWith(".") && !spec.startsWith("/")) return null;
  const fromDir = fromFile.split("/").slice(0, -1).join("/");
  const base = joinPosix(fromDir, spec);
  const exts = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte"];
  const candidates = [
    base,
    ...exts.map(e => base + e),
    ...exts.map(e => base + "/index" + e),
  ];
  const fileSet = new Set(allFiles);
  for (const c of candidates) if (fileSet.has(c)) return c;
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
