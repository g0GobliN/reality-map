/* eslint-disable */
"use strict";

const fs = require("fs");
const path = require("path");

const RESOLVE_EXTS = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts", ".py", ".go", ".rs"];
const SRC_EXTS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts", ".py", ".go", ".rs"]);

// Config-only entry files that are loaded by CLI tools (ESLint, Vitest, etc.) — auto-seeded.
const CONFIG_ENTRY_RE = [
  /^eslint\.config\./,
  /^vitest\.config\./,
  /^jest\.config\./,
  /^playwright\.config\./,
  /^tailwind\.config\./,
  /^postcss\.config\./,
  /^babel\.config\./,
  /^webpack\.config\./,
  /^rollup\.config\./,
  /^vite\.config\./,
  /^next\.config\./,
  /^nuxt\.config\./,
  /^astro\.config\./,
  /^svelte\.config\./,
  /^remix\.config\./,
];

function isConfigEntry(filePath) {
  const bn = filePath.split("/").pop() || "";
  return CONFIG_ENTRY_RE.some((re) => re.test(bn));
}

// Regex to find file references inside npm script values (e.g. "node setup.js", "node --test __tests__/run.test.js")
const SCRIPT_FILE_RE = /(?:^|\s)((?:\.{0,2}\/)?[\w][\w./\-]*\.(?:js|ts|mjs|cjs|jsx|tsx|mts|cts))/g;

function extractScriptFileRefs(scriptValue) {
  const refs = [];
  let m;
  SCRIPT_FILE_RE.lastIndex = 0;
  while ((m = SCRIPT_FILE_RE.exec(scriptValue))) {
    const ref = m[1].trim();
    if (!ref || ref.startsWith("http")) continue;
    refs.push(ref);
  }
  return refs;
}

/**
 * Find the nearest ancestor directory (relative to scan root) that has a package.json,
 * walking up from relDir toward the scan root. Returns "." if only the scan root has one.
 */
function findPackageRootForDir(root, relDir) {
  const parts = relDir.split("/").filter(Boolean);
  for (let i = parts.length; i >= 0; i--) {
    const rel = i === 0 ? "." : parts.slice(0, i).join("/");
    try {
      fs.readFileSync(path.join(root, rel, "package.json"), "utf8");
      return rel;
    } catch { }
  }
  return ".";
}

/**
 * Parse a package.json for the given package-relative directory and return
 * all file paths (relative to scan root) referenced by main / bin / exports / scripts.
 */
function collectPackageJsonSeeds(root, pkgRelDir, fileSet) {
  const seeds = [];
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(root, pkgRelDir, "package.json"), "utf8"));
  } catch { return seeds; }

  const pkgPrefix = pkgRelDir === "." ? "" : pkgRelDir + "/";

  function addRef(ref) {
    if (!ref || typeof ref !== "string") return;
    const norm = ref.replace(/^\.\//, "").replace(/\\/g, "/");
    const base = (pkgPrefix + norm).split("/").filter((p) => p && p !== ".").join("/");
    const candidates = [
      base,
      ...RESOLVE_EXTS.map((e) => base + e),
      ...RESOLVE_EXTS.map((e) => base + "/index" + e),
    ];
    for (const c of candidates) {
      if (fileSet.has(c)) { seeds.push(c); return; }
    }
  }

  if (typeof pkg.main === "string") addRef(pkg.main);

  if (typeof pkg.bin === "string") {
    addRef(pkg.bin);
  } else if (pkg.bin && typeof pkg.bin === "object") {
    for (const v of Object.values(pkg.bin)) if (typeof v === "string") addRef(v);
  }

  function addExports(exp) {
    if (typeof exp === "string") addRef(exp);
    else if (exp && typeof exp === "object") for (const v of Object.values(exp)) addExports(v);
  }
  if (pkg.exports) addExports(pkg.exports);

  if (pkg.scripts && typeof pkg.scripts === "object") {
    for (const val of Object.values(pkg.scripts)) {
      if (typeof val !== "string") continue;
      for (const ref of extractScriptFileRefs(val)) addRef(ref);
    }
  }

  return [...new Set(seeds)];
}

/**
 * Parse vite.config.* / vitest.config.* at the given package root and return
 * file paths referenced by setupFiles and rollupOptions.input.
 */
function collectViteConfigSeeds(root, pkgRelDir, fileSet) {
  const seeds = [];
  let configSrc = null;
  for (const name of ["vite.config.js", "vite.config.ts", "vite.config.mjs", "vitest.config.js", "vitest.config.ts"]) {
    try {
      configSrc = fs.readFileSync(path.join(root, pkgRelDir, name), "utf8");
      break;
    } catch { }
  }
  if (!configSrc) return seeds;

  const pkgPrefix = pkgRelDir === "." ? "" : pkgRelDir + "/";

  function addRef(ref) {
    if (!ref) return;
    const norm = ref.replace(/^\.\//, "").replace(/\\/g, "/");
    const base = (pkgPrefix + norm).split("/").filter((p) => p && p !== ".").join("/");
    const candidates = [base, ...RESOLVE_EXTS.map((e) => base + e)];
    for (const c of candidates) {
      if (fileSet.has(c)) { seeds.push(c); return; }
    }
  }

  // setupFiles: ['./src/setupTests.js', ...]
  const setupMatch = /setupFiles\s*:\s*\[([^\]]*)\]/s.exec(configSrc);
  if (setupMatch) {
    const strRe = /["'`]([^"'`]+)["'`]/g;
    let m;
    while ((m = strRe.exec(setupMatch[1]))) addRef(m[1]);
  }

  // build.rollupOptions.input: './src/main.ts' or { main: './src/main.ts' }
  const inputMatch = /input\s*:\s*["'`]([^"'`]+)["'`]/.exec(configSrc);
  if (inputMatch) addRef(inputMatch[1]);

  return [...new Set(seeds)];
}

/**
 * Read firebase.json at the scan root and return the main entry file for each
 * declared cloud functions bundle.
 */
function collectFirebaseSeeds(root, fileSet) {
  const seeds = [];
  let firebaseConfig;
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(path.join(root, "firebase.json"), "utf8"));
  } catch { return seeds; }

  const rawFns = firebaseConfig.functions;
  const fnList = Array.isArray(rawFns) ? rawFns : rawFns ? [rawFns] : [];

  for (const fn of fnList) {
    const source = fn.source;
    if (!source) continue;
    let fnPkg;
    try {
      fnPkg = JSON.parse(fs.readFileSync(path.join(root, source, "package.json"), "utf8"));
    } catch { continue; }
    const main = (fnPkg.main || "index.js").replace(/^\.\//, "");
    const full = (source + "/" + main).split("/").filter((p) => p && p !== ".").join("/");
    const candidates = [full, ...RESOLVE_EXTS.map((e) => full + e)];
    for (const c of candidates) {
      if (fileSet.has(c)) { seeds.push(c); break; }
    }
  }
  return seeds;
}

const ENTRY_BASENAMES = new Set([
  // JS/TS
  "index", "main", "start", "server", "router", "app", "App",
  "entry", "client", "bootstrap", "init",
  // Python
  "__main__", "wsgi", "asgi", "manage",
  // Go / Rust
  "lib",
]);

function joinPosix(dir, rel) {
  const parts = (dir + "/" + rel).split("/");
  const out = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p !== "." && p !== "") out.push(p);
  }
  return out.join("/");
}

/**
 * Read tsconfig.json / jsconfig.json and extract path alias mappings.
 * Searches from the package root of srcDir up to the scan root, so
 * per-package tsconfigs in monorepos are found correctly.
 * Falls back to @/ → srcDir if no tsconfig is found or parseable.
 */
function loadAliases(root, srcDirNorm) {
  const aliases = [{ prefix: "@/", target: srcDirNorm + "/" }];
  if (!root) return aliases;

  // Candidate dirs to search for tsconfig, from most-specific to least:
  // walk up the srcDir path segments to find the package-level tsconfig.
  const searchDirs = [];
  const parts = srcDirNorm.split("/");
  for (let i = parts.length; i >= 1; i--) {
    searchDirs.push(path.join(root, ...parts.slice(0, i)));
  }
  searchDirs.push(root); // always include scan root as final fallback

  for (const dir of searchDirs) {
    let found = false;
    for (const cfg of ["tsconfig.json", "jsconfig.json"]) {
      try {
        let raw = fs.readFileSync(path.join(dir, cfg), "utf8");
        raw = raw
          .replace(/\/\/[^\n]*/g, "")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/,(\s*[}\]])/g, "$1");
        const config = JSON.parse(raw);
        const baseUrl = config?.compilerOptions?.baseUrl
          ? path.resolve(dir, config.compilerOptions.baseUrl)
          : dir;
        const tsPaths = config?.compilerOptions?.paths || {};
        for (const [alias, targets] of Object.entries(tsPaths)) {
          if (!alias.endsWith("/*")) continue;
          const target = Array.isArray(targets) ? targets[0] : null;
          if (!target) continue;
          const prefix = alias.slice(0, -1); // "@/*" → "@/"
          const normalTarget = target.replace(/\*$/, "").replace(/^\.\//, "");
          // Resolve target absolute, then make relative to scan root
          const absTarget = path.resolve(baseUrl, normalTarget);
          const relTarget = path.relative(root, absTarget).split(path.sep).join("/");
          if (!aliases.some((a) => a.prefix === prefix)) {
            aliases.push({ prefix, target: relTarget + "/" });
          }
        }
        found = true;
        break; // use first config file found in this dir
      } catch { }
    }
    if (found) break; // stop at first dir that had a tsconfig
  }
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
    base + "/__init__.py",
    base + "/mod.rs",
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

function buildImporterCounts(allFiles, importsMap, fileSet, aliases, resolvedEdgesMap) {
  const counts = new Map();
  for (const f of allFiles) counts.set(f, 0);
  if (resolvedEdgesMap) {
    for (const [, targets] of Object.entries(resolvedEdgesMap)) {
      for (const tgt of targets) {
        if (counts.has(tgt)) counts.set(tgt, (counts.get(tgt) || 0) + 1);
      }
    }
  } else {
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
  }
  return counts;
}

/**
 * Walk the import graph starting from all seed files simultaneously.
 * Follows both relative imports and path aliases.
 */
function collectReachableFromSeeds(seeds, importsMap, fileSet, aliases, resolvedEdgesMap) {
  const reachable = new Set();
  const stack = [...seeds];
  while (stack.length) {
    const file = stack.pop();
    if (reachable.has(file)) continue;
    reachable.add(file);
    if (resolvedEdgesMap) {
      for (const tgt of (resolvedEdgesMap[file] || [])) {
        if (!reachable.has(tgt)) stack.push(tgt);
      }
    } else {
      const data = importsMap[file];
      if (!data) continue;
      for (const spec of data.specs || []) {
        const resolved = resolveSpec(file, spec, fileSet, aliases);
        if (resolved && !reachable.has(resolved)) stack.push(resolved);
      }
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

  const resolvedEdgesMap = (scan.fileDetails || {}).resolvedEdges || null;

  const importerCounts = buildImporterCounts(allFiles, importsMap, fileSet, aliases, resolvedEdgesMap);

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

  // Also seed direct targets of HTML entry points — the HTML files themselves
  // are not in allFiles (they're not code), but their edges are in resolvedEdgesMap.
  // This seeds index.jsx / main.tsx that are pointed to by index.html <script src>.
  if (resolvedEdgesMap) {
    for (const [from, targets] of Object.entries(resolvedEdgesMap)) {
      if (from.endsWith(".html")) {
        for (const tgt of targets) {
          if (fileSet.has(tgt)) seedSet.add(tgt);
        }
      }
    }
  }

  // Seed targets declared in workspace entries config (e.g. from .realitymap.json)
  const workspaces = scan.workspaces || [];
  for (const ws of workspaces) {
    const wsRoot = (ws.root || ".").replace(/\/+$/, "");
    const wsSrc  = (ws.src  || ws.root || ".").replace(/\/+$/, "");
    // Only relevant to this srcDir
    if (wsSrc !== srcDirNorm && !srcDirNorm.startsWith(wsSrc + "/")) continue;
    for (const entry of (ws.entries || [])) {
      // entry is an HTML file path — its JS targets are already handled above via resolvedEdgesMap
      // But also seed any code entry that matches package.json "main"
      if (fileSet.has(entry)) seedSet.add(entry);
    }
  }

  // --- Extended seeds: package.json scripts/main/bin, vite setupFiles, firebase, config files ---
  if (root) {
    const pkgRelDir = findPackageRootForDir(root, srcDirNorm);

    // package.json main / bin / exports / scripts
    for (const s of collectPackageJsonSeeds(root, pkgRelDir, fileSet)) seedSet.add(s);

    // vite.config / vitest.config setupFiles + rollupOptions.input
    for (const s of collectViteConfigSeeds(root, pkgRelDir, fileSet)) seedSet.add(s);

    // firebase.json functions entries (only the scan root has firebase.json)
    for (const s of collectFirebaseSeeds(root, fileSet)) seedSet.add(s);

    // Auto-seed all known config-entry files (eslint.config.*, tailwind.config.*, etc.)
    // These are loaded by CLI tools and never imported — they must not appear as dead code.
    for (const f of allFiles) {
      if (isConfigEntry(f)) seedSet.add(f);
    }
  }

  const reachable = collectReachableFromSeeds([...seedSet], importsMap, fileSet, aliases, resolvedEdgesMap);

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
