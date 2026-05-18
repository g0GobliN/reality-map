/* eslint-disable */
"use strict";

/**
 * Change Impact Analysis
 * Given a set of changed file paths, compute the blast radius:
 * - Direct dependents (files that import the changed files)
 * - Transitive dependents (files that import those, recursively)
 * - Module-level impact summary
 * - Risk score per affected file
 */
function computeImpact(scan, changedPaths) {
  const fileDetails = scan.fileDetails || {};
  const importsMap = fileDetails.imports || {};
  const locMap = fileDetails.loc || {};
  const allFiles = scan.scannedFilePaths || [];

  // Build reverse index: file -> files that import it
  const importedBy = new Map(); // file -> Set<file>
  for (const file of allFiles) {
    const data = importsMap[file];
    if (!data) continue;
    for (const spec of (data.specs || [])) {
      // Try to resolve relative imports to actual paths
      const resolved = resolveSpec(file, spec, allFiles);
      if (!resolved) continue;
      if (!importedBy.has(resolved)) importedBy.set(resolved, new Set());
      importedBy.get(resolved).add(file);
    }
  }

  // BFS from changed files through reverse dependency graph
  const changed = new Set(changedPaths.map(p => p.replace(/\\/g, "/")));
  const visited = new Set(changed);
  const queue = [...changed];
  const directDeps = new Set();
  const transitiveDeps = new Set();
  let depth = 0;
  const depthMap = new Map();
  for (const c of changed) depthMap.set(c, 0);

  while (queue.length > 0) {
    const file = queue.shift();
    const currentDepth = depthMap.get(file) || 0;
    const dependents = importedBy.get(file) || new Set();

    for (const dep of dependents) {
      if (visited.has(dep)) continue;
      visited.add(dep);
      depthMap.set(dep, currentDepth + 1);
      if (currentDepth === 0) directDeps.add(dep);
      else transitiveDeps.add(dep);
      queue.push(dep);
    }
  }

  // Build affected file list with risk scores
  const affected = [];
  for (const file of visited) {
    if (changed.has(file)) continue;
    const d = depthMap.get(file) || 1;
    const loc = locMap[file] || 0;
    const importerCount = (importedBy.get(file) || new Set()).size;
    // Risk: closer to change = higher risk; larger files = higher risk
    const risk = Math.round(Math.max(1, Math.min(10,
      (10 / d) * 0.6 + (Math.min(loc, 500) / 500) * 2 + (importerCount > 5 ? 2 : 0)
    )));
    affected.push({
      path: file,
      depth: d,
      loc,
      risk,
      direct: directDeps.has(file),
    });
  }
  affected.sort((a, b) => b.risk - a.risk || a.depth - b.depth);

  // Module-level summary
  const moduleImpact = new Map();
  for (const f of affected) {
    const mod = moduleOfPath(f.path);
    if (!moduleImpact.has(mod)) moduleImpact.set(mod, { module: mod, files: 0, maxRisk: 0 });
    const m = moduleImpact.get(mod);
    m.files++;
    m.maxRisk = Math.max(m.maxRisk, f.risk);
  }

  return {
    changed: [...changed],
    totalAffected: affected.length,
    directCount: directDeps.size,
    transitiveCount: transitiveDeps.size,
    affected: affected.slice(0, 200),
    moduleImpact: [...moduleImpact.values()].sort((a, b) => b.maxRisk - a.maxRisk),
    riskLevel: affected.length === 0 ? "none"
      : affected.some(f => f.risk >= 8) ? "high"
      : affected.some(f => f.risk >= 5) ? "medium"
      : "low",
  };
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

function moduleOfPath(filePath) {
  const parts = filePath.split("/");
  if (parts[0] === "src" || parts[0] === "app") {
    return parts.slice(0, 2).join("/");
  }
  return parts[0] || "(root)";
}

module.exports = { computeImpact };
