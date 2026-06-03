/* eslint-disable */
"use strict";

const fs = require("fs");
const path = require("path");

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "out", "coverage",
  ".next", ".turbo", ".cache", ".vercel", ".netlify", ".output",
  "target", "vendor", ".venv", "venv", "__pycache__",
]);

/**
 * Load and parse .realitymap.json from root.
 * Returns null if absent or invalid.
 */
function loadRealityMapConfig(root) {
  try {
    const raw = fs.readFileSync(path.join(root, ".realitymap.json"), "utf8");
    return JSON.parse(raw);
  } catch { return null; }
}

/**
 * Recursively find all directories that contain a package.json,
 * skipping node_modules and other non-source dirs.
 * Returns absolute paths (excluding the scan root itself).
 */
function findPackageRoots(root) {
  const roots = [];
  function rec(dir, depth) {
    if (depth > 5) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    if (dir !== root && entries.some(e => e.isFile() && e.name === "package.json")) {
      roots.push(dir);
      // Don't recurse into nested packages (workspaces don't nest deeper than needed)
      return;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (SKIP_DIRS.has(e.name) || e.name.startsWith(".")) continue;
      rec(path.join(dir, e.name), depth + 1);
    }
  }
  rec(root, 0);
  return roots;
}

/**
 * Given a package root directory (absolute), find the best src dir.
 * Prefers src/ > app/ > lib/ > the package root itself.
 * Returns a path relative to the scan root, using forward slashes.
 */
function guessSrcDir(pkgRoot, scanRoot) {
  const relPkg = path.relative(scanRoot, pkgRoot).split(path.sep).join("/") || ".";
  for (const candidate of ["src", "app", "lib"]) {
    try {
      if (fs.statSync(path.join(pkgRoot, candidate)).isDirectory()) {
        return relPkg === "." ? candidate : relPkg + "/" + candidate;
      }
    } catch { }
  }
  return relPkg;
}

/**
 * Find HTML entry files (index.html) in a package root.
 * Returns paths relative to scan root.
 */
function findHtmlEntries(pkgRoot, scanRoot) {
  const entries = [];
  const relPkg = path.relative(scanRoot, pkgRoot).split(path.sep).join("/");
  for (const name of ["index.html", "public/index.html"]) {
    try {
      fs.statSync(path.join(pkgRoot, name));
      entries.push(relPkg ? relPkg + "/" + name : name);
    } catch { }
  }
  return entries;
}

/**
 * Discover workspaces (packages) for the project.
 *
 * Priority:
 *   1. .realitymap.json "packages" array — explicit config wins
 *   2. Sub-directories with package.json — monorepo auto-discovery
 *   3. Single-package fallback — use src/ (or app/ or lib/) at root
 *
 * Each workspace entry: { root, src, entries }
 *   root    — relative path to package root (forward slashes, "." for scan root)
 *   src     — relative path to primary source dir  (e.g. "admin-ui/src")
 *   entries — array of known HTML entry file paths relative to scan root
 */
function discoverWorkspaces(scanRoot) {
  const config = loadRealityMapConfig(scanRoot);

  // Explicit config takes full precedence
  if (config && Array.isArray(config.packages) && config.packages.length) {
    return config.packages.map(pkg => ({
      root:    (pkg.root    || ".").replace(/\\/g, "/"),
      src:     (pkg.src     || pkg.root || ".").replace(/\\/g, "/"),
      entries: Array.isArray(pkg.entries) ? pkg.entries : [],
    }));
  }

  // Auto-discover sub-packages
  const pkgRoots = findPackageRoots(scanRoot);

  if (pkgRoots.length) {
    return pkgRoots.map(pkgRoot => ({
      root:    path.relative(scanRoot, pkgRoot).split(path.sep).join("/"),
      src:     guessSrcDir(pkgRoot, scanRoot),
      entries: findHtmlEntries(pkgRoot, scanRoot),
    }));
  }

  // Single-package project
  const src = guessSrcDir(scanRoot, scanRoot);
  return [{ root: ".", src, entries: findHtmlEntries(scanRoot, scanRoot) }];
}

module.exports = { discoverWorkspaces, loadRealityMapConfig };
