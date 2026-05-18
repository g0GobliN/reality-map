#!/usr/bin/env node
/* eslint-disable */
"use strict";

const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const { version: PKG_VERSION } = require("../package.json");
const { scanProject } = require("../lib/scan.js");
const { startServer } = require("../lib/server.js");
const { moduleGraphToDot, moduleGraphToMermaid } = require("../lib/graph-export.js");
const { computeHealth } = require("../lib/health.js");
const { loadBaseline, diffScans } = require("../lib/diff.js");
const { loadRules, checkRules } = require("../lib/rules.js");
const { buildOrphanReport } = require("../lib/orphans.js");
const { renderHtml } = require("../lib/html-export.js");

function printMachineError(code, message, extra) {
  const payload = { type: "reality-map-error", code, message, ...extra };
  console.error(JSON.stringify(payload));
}

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    port: 4317,
    open: true,
    quiet: false,
    depth: 3,
    portAttempts: 12,
    watch: false,
    jsonOut: false,
    exportPath: null,
    noServe: false,
    includeExt: [],
    failOnCycles: false,
    failIfIsolated: false,
    isolatedBudget: 0,
    summaryJson: false,
    listFiles: false,
    exportDot: null,
    exportMermaid: null,
    graphDepth: 1,
    health: false,
    failBelow: null,
    baseline: null,
    diffOut: null,
    rulesFile: null,
    failOnRules: false,
    orphansOut: null,
    exportHtml: null,
    showTree: null,
    treeDepth: 3,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--port" || a === "-p") {
      args.port = Number(argv[++i]);
      if (!Number.isFinite(args.port) || args.port < 1 || args.port > 65535) {
        printMachineError("EPORT", "invalid --port value");
        console.error("reality-map: invalid port");
        process.exit(1);
      }
    } else if (a === "--depth" || a === "-d") {
      const d = Number(argv[++i]);
      if (!Number.isFinite(d)) {
        printMachineError("EDEPTH", "--depth requires a number (1–5)");
        console.error("reality-map: --depth requires a number (1–5)");
        process.exit(1);
      }
      args.depth = Math.max(1, Math.min(5, d));
    } else if (a === "--no-open") args.open = false;
    else if (a === "--watch" || a === "-w") args.watch = true;
    else if (a === "--quiet" || a === "-q") args.quiet = true;
    else if (a === "--json" || a === "--stdout") args.jsonOut = true;
    else if (a === "--no-serve" || a === "--print-only") args.noServe = true;
    else if (a === "--export") {
      const p = argv[++i];
      if (!p || p.startsWith("-")) {
        printMachineError("EARG", "--export requires a file path");
        console.error("reality-map: --export requires a file path");
        process.exit(1);
      }
      args.exportPath = p;
    } else if (a === "--include-ext") {
      const v = argv[++i];
      if (!v || v.startsWith("-")) {
        printMachineError("EARG", "--include-ext requires a value (e.g. .json or .md,.graphql)");
        console.error("reality-map: --include-ext requires a value");
        process.exit(1);
      }
      args.includeExt.push(...v.split(",").map((s) => s.trim()).filter(Boolean));
    } else if (a === "--fail-on-cycles") args.failOnCycles = true;
    else if (a === "--fail-if-isolated") args.failIfIsolated = true;
    else if (a === "--isolated-budget") {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n < 0) {
        printMachineError("EARG", "--isolated-budget requires a non-negative number");
        console.error("reality-map: --isolated-budget requires a non-negative number");
        process.exit(1);
      }
      args.isolatedBudget = n;
      args.failIfIsolated = true;
    } else if (a === "--summary-json") args.summaryJson = true;
    else if (a === "--list-files") args.listFiles = true;
    else if (a === "--export-dot") {
      const p = argv[++i];
      if (!p || p.startsWith("-")) {
        printMachineError("EARG", "--export-dot requires a file path");
        console.error("reality-map: --export-dot requires a file path");
        process.exit(1);
      }
      args.exportDot = p;
    } else if (a === "--export-mermaid") {
      const p = argv[++i];
      if (!p || p.startsWith("-")) {
        printMachineError("EARG", "--export-mermaid requires a file path");
        console.error("reality-map: --export-mermaid requires a file path");
        process.exit(1);
      }
      args.exportMermaid = p;
    } else if (a === "--graph-depth") {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n)) {
        printMachineError("EARG", "--graph-depth requires a number (1–5)");
        process.exit(1);
      }
      args.graphDepth = Math.max(1, Math.min(5, n));
    } else if (a === "--health") {
      args.health = true;
    } else if (a === "--fail-below") {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        printMachineError("EARG", "--fail-below requires a 0–100 number");
        process.exit(1);
      }
      args.failBelow = n;
      args.health = true;
    } else if (a === "--baseline") {
      const p = argv[++i];
      if (!p || p.startsWith("-")) { printMachineError("EARG", "--baseline requires a file"); process.exit(1); }
      args.baseline = p;
    } else if (a === "--diff-out") {
      const p = argv[++i];
      if (!p || p.startsWith("-")) { printMachineError("EARG", "--diff-out requires a file"); process.exit(1); }
      args.diffOut = p;
    } else if (a === "--rules") {
      const p = argv[++i];
      if (!p || p.startsWith("-")) { printMachineError("EARG", "--rules requires a file"); process.exit(1); }
      args.rulesFile = p;
    } else if (a === "--fail-on-rules") {
      args.failOnRules = true;
    } else if (a === "--report-orphans") {
      const p = argv[++i];
      if (!p || p.startsWith("-")) { printMachineError("EARG", "--report-orphans requires a file"); process.exit(1); }
      args.orphansOut = p;
    } else if (a === "--export-html") {
      const p = argv[++i];
      if (!p || p.startsWith("-")) { printMachineError("EARG", "--export-html requires a file"); process.exit(1); }
      args.exportHtml = p;
    } else if (a === "--tree") {
      const v = argv[++i];
      if (!v || v.startsWith("-")) { printMachineError("EARG", "--tree requires a module id (e.g. src/components)"); process.exit(1); }
      args.showTree = v;
    } else if (a === "--tree-depth") {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n < 1) { printMachineError("EARG", "--tree-depth requires a positive number"); process.exit(1); }
      args.treeDepth = Math.min(8, n);
    } else if (a === "--help" || a === "-h") {
      console.log(`reality-map — visual architecture explorer (v${PKG_VERSION})

Usage:
  npx reality-map [path] [options]

Options:
  -p, --port <n>     Port to serve dashboard on (default 4317)
      --no-open      Do not auto-open the browser
  -d, --depth <n>    Module grouping depth 1–5 (default 3)
  -q, --quiet        Minimal output (URL + errors only; with --json, stderr only)
  -w, --watch        Rescan when source files change (dashboard auto-refreshes)
      --json, --stdout
                     Print full scan JSON to stdout and exit (no HTTP server)
      --export <file>
                     Write full scan JSON to file and exit (no HTTP server)
      --no-serve, --print-only
                     Scan and print summary only; do not start the server
      --include-ext <ext[,ext…]>
                     Extra file extensions to scan (leading dot optional), e.g. .json,.md
      --fail-on-cycles
                     Exit with code 1 if any module graph depth has circular dependencies
      --fail-if-isolated
                     Exit with code 1 if isolated internal-only files exceed budget (default 0)
      --isolated-budget <n>
                     Allow up to <n> isolated files (implies --fail-if-isolated; fail if count > n)
      --summary-json   Print one compact JSON object of key metrics to stdout (no full scan dump)
      --list-files     Print all scanned file paths (relative), one per line, then exit
      --export-dot <file>
                     Write a Graphviz DOT module graph for --graph-depth (default 1)
      --export-mermaid <file>
                     Write a Mermaid flowchart for --graph-depth
      --graph-depth <n>
                     Depth slice for --export-dot / --export-mermaid (1–5, default 1)
      --health         Print a health score (0–100, A–F) and contributing reasons
      --fail-below <n> Exit 1 if computed health score < n (implies --health)
      --baseline <file>
                     Compare against a previous --export scan and print a diff
      --diff-out <file>
                     Write the diff (with --baseline) to a JSON file
      --rules <file>   Load layer rules JSON ({layers, forbid}) and report violations
      --fail-on-rules  Exit 1 when any layer rule violation is found
      --report-orphans <file>
                     Write isolated/sink/source files report to JSON
      --export-html <file>
                     Write a self-contained HTML snapshot (graph + health + tables)
      --tree <module> Print a dependency tree for a module id (depth 1)
      --tree-depth <n> Limit --tree depth (default 3, max 8)
  -h, --help         Show help
  -V, --version      Print version

If the port is busy, the next free port is tried automatically (up to 12 attempts).

Optional \`.realitymapignore\` at the project root: newline-separated patterns
(relative paths, \`/\` as separator). Lines without \`*\`/\`?\` match that path
or anything under it; \`*\` and \`?\` match within a single path segment.
`);
      process.exit(0);
    } else if (a === "--version" || a === "-V") {
      console.log(PKG_VERSION);
      process.exit(0);
    } else if (!a.startsWith("-")) {
      args.root = path.resolve(process.cwd(), a);
    } else {
      printMachineError("EARG", "unknown option: " + a);
      console.error("reality-map: unknown option:", a);
      console.error("Try --help.");
      process.exit(1);
    }
  }
  if (args.jsonOut) args.noServe = true;
  if (args.exportPath) args.noServe = true;
  if (args.summaryJson || args.listFiles || args.exportDot || args.exportMermaid) {
    args.noServe = true;
    args.open = false;
  }
  if (args.exportHtml || args.orphansOut || args.diffOut || args.showTree) {
    args.open = false;
    args.noServe = true;
  }
  return args;
}

function validateArgCombo(args) {
  if (args.jsonOut && args.summaryJson) {
    printMachineError("EARG", "--json and --summary-json cannot be used together");
    console.error("reality-map: use either --json or --summary-json");
    process.exit(1);
  }
  if (args.jsonOut && args.listFiles) {
    printMachineError("EARG", "--json and --list-files cannot be used together");
    process.exit(1);
  }
}

async function openBrowser(url) {
  try {
    const cmd =
      process.platform === "darwin" ? "open"
      : process.platform === "win32" ? "start"
      : "xdg-open";
    spawn(cmd, [url], { stdio: "ignore", detached: true, shell: process.platform === "win32" }).unref();
  } catch {}
}

async function startServerWithFallback({ basePort, attempts, ...serverOpts }) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    const port = basePort + i;
    try {
      const out = await startServer({ ...serverOpts, port });
      return { ...out, port, triedFallback: i > 0 };
    } catch (err) {
      lastErr = err;
      if (err && err.code === "EADDRINUSE") continue;
      throw err;
    }
  }
  const e = new Error(`ports ${basePort}–${basePort + attempts - 1} are all in use`);
  e.cause = lastErr;
  throw e;
}

function debounce(fn, ms) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function formatProgress(ev) {
  switch (ev.phase) {
    case "discover":
      return "discovering files…";
    case "discovered":
      return `indexed ${ev.files} source files`;
    case "parse_imports":
      return `parsing imports (${ev.files} files)…`;
    case "parsed":
      return "resolved import graph";
    case "building_graphs":
      return `building module views (depth 1–${ev.maxDepth})…`;
    case "depth_ready":
      return `depth ${ev.depth} ready`;
    default:
      return "";
  }
}

function writeScanJsonFile(dest, scan) {
  const abs = path.resolve(process.cwd(), dest);
  return fs.promises.mkdir(path.dirname(abs), { recursive: true }).then(() =>
    fs.promises.writeFile(abs, JSON.stringify(scan, null, 2), "utf8")
  ).then(() => abs);
}

function maxCycleCountAcrossDepths(scan) {
  let n = 0;
  const bd = scan.graphsByDepth;
  if (!bd) return 0;
  const maxD = scan.maxDepth || 1;
  for (let d = 1; d <= maxD; d++) {
    const g = bd[d];
    if (g && g.stats && Number.isFinite(g.stats.cycles)) n = Math.max(n, g.stats.cycles);
  }
  return n;
}

/** @returns {boolean} true if the process should exit 1 */
function failIfCyclesRequested(args, scan) {
  if (!args.failOnCycles) return false;
  const c = maxCycleCountAcrossDepths(scan);
  if (c === 0) return false;
  printMachineError("ECYCLES", `dependency cycles detected (${c} cycle group(s) at the busiest depth view)`);
  console.error(
    "reality-map: failing due to --fail-on-cycles (run without this flag or inspect graphsByDepth[*].cycles)",
  );
  return true;
}

/** @returns {boolean} true if the process should exit 1 */
function failIfIsolatedGate(args, scan) {
  if (!args.failIfIsolated) return false;
  const n = scan.insights?.summary?.isolatedInternalFiles ?? 0;
  const budget = Number.isFinite(args.isolatedBudget) ? args.isolatedBudget : 0;
  if (n <= budget) return false;
  printMachineError(
    "EISOLATED",
    `isolated internal-only files (${n}) exceed budget (${budget})`,
    { count: n, budget },
  );
  console.error(
    "reality-map: failing due to --fail-if-isolated (tune with --isolated-budget)",
  );
  return true;
}

function buildSummary(scan, scanMs) {
  const d1 = scan.graphsByDepth?.[1]?.stats || {};
  return {
    tool: "reality-map",
    version: PKG_VERSION,
    root: scan.root,
    generatedAt: scan.generatedAt,
    scanMs,
    maxDepth: scan.maxDepth,
    files: scan.stats.files,
    loc: scan.stats.loc,
    modulesDepth1: d1.modules ?? 0,
    edgesDepth1: d1.edges ?? 0,
    cyclesMaxAcrossDepths: maxCycleCountAcrossDepths(scan),
    externalRefs: scan.insights?.summary?.externalRefs ?? 0,
    internalEdges: scan.insights?.summary?.internalEdges ?? 0,
    isolatedInternalFiles: scan.insights?.summary?.isolatedInternalFiles ?? 0,
    uniquePackages: scan.insights?.summary?.uniquePackages ?? 0,
  };
}

async function writeTextFile(dest, text) {
  const abs = path.resolve(process.cwd(), dest);
  await fs.promises.mkdir(path.dirname(abs), { recursive: true });
  await fs.promises.writeFile(abs, text, "utf8");
  return abs;
}

function buildDependencyTree(scan, modId, maxDepth) {
  const d1 = scan.graphsByDepth?.[1];
  if (!d1) return null;
  const adj = new Map();
  for (const e of d1.edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source).push(e.target);
  }
  if (!d1.nodes.find((n) => n.id === modId)) return { error: `module not found: ${modId}` };
  const lines = [];
  const visited = new Set();
  function rec(id, depth, prefix, isLast) {
    const branch = depth === 0 ? "" : (isLast ? "└─ " : "├─ ");
    const cycle = visited.has(id) ? "  ⟲ (cycle)" : "";
    lines.push(prefix + branch + id + cycle);
    if (visited.has(id) || depth >= maxDepth) return;
    visited.add(id);
    const kids = adj.get(id) || [];
    kids.forEach((k, i) => {
      const last = i === kids.length - 1;
      const np = prefix + (depth === 0 ? "" : (isLast ? "   " : "│  "));
      rec(k, depth + 1, np, last);
    });
    visited.delete(id);
  }
  rec(modId, 0, "", true);
  return { tree: lines.join("\n") };
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  validateArgCombo(args);
  const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
  const dim = (s) => `\x1b[2m${s}\x1b[0m`;
  const bold = (s) => `\x1b[1m${s}\x1b[0m`;
  const green = (s) => `\x1b[32m${s}\x1b[0m`;

  const log = (...x) => {
    if (!args.quiet && !args.jsonOut && !args.summaryJson && !args.listFiles) console.log(...x);
  };
  const logErr = (...x) => {
    if (!args.quiet) console.error(...x);
  };

  const scanOpts = {
    maxDepth: args.depth,
    includeExt: args.includeExt.length ? args.includeExt : undefined,
    onProgress:
      args.quiet || args.jsonOut || args.summaryJson || args.listFiles
        ? undefined
        : (ev) => {
            const line = formatProgress(ev);
            if (line) log(`  ${dim("·")}  ${line}`);
          },
  };

  if (!args.jsonOut && !args.quiet && !args.summaryJson && !args.listFiles) {
    log("");
    log(`  ${bold(cyan("◢ RealityMap"))}  ${dim("v" + PKG_VERSION)}`);
    log(`  ${dim("project")}  ${args.root}`);
  }

  const t0 = Date.now();
  let scan;
  try {
    scan = await scanProject(args.root, scanOpts);
  } catch (err) {
    const code = err.code && typeof err.code === "string" ? err.code : "SCAN_FAILED";
    printMachineError(code, err.message || String(err), err.cause ? { cause: err.cause.message || String(err.cause) } : undefined);
    console.error("reality-map failed:", err.message || err);
    if (err && err.cause) console.error("  cause:", err.cause.message || err.cause);
    process.exit(1);
  }
  const scanMs = Date.now() - t0;

  if (failIfCyclesRequested(args, scan)) process.exit(1);
  if (failIfIsolatedGate(args, scan)) process.exit(1);

  // ---- Health -------------------------------------------------------------
  let health = null;
  if (args.health) {
    health = computeHealth(scan);
    if (!args.quiet && !args.jsonOut && !args.summaryJson && !args.listFiles) {
      log(`  ${dim("health")}   ${bold(health.score + "/100")} (${health.grade})`);
      for (const r of health.reasons) log(`    ${dim("·")} ${r.msg} ${dim(`(-${r.penalty})`)}`);
      if (!health.reasons.length) log(`    ${dim("·")} ${dim("no notable issues detected")}`);
    }
    if (args.failBelow != null && health.score < args.failBelow) {
      printMachineError("EHEALTH", `health ${health.score} < threshold ${args.failBelow}`,
        { score: health.score, threshold: args.failBelow, grade: health.grade });
      console.error(`reality-map: health ${health.score}/100 below --fail-below ${args.failBelow}`);
      process.exit(1);
    }
  }

  // ---- Baseline diff ------------------------------------------------------
  let diff = null;
  if (args.baseline) {
    try {
      const prev = loadBaseline(args.baseline);
      diff = diffScans(prev, scan);
      if (!args.quiet && !args.jsonOut && !args.summaryJson && !args.listFiles) {
        const sign = (n) => (n > 0 ? `+${n}` : `${n}`);
        log(`  ${dim("diff")}     files ${sign(diff.files.added)}/${sign(-diff.files.removed)} · loc ${sign(diff.loc.delta)} · cycles ${sign(diff.cycles.delta)}`);
        if (diff.modules.added.length) log(`    ${dim("· new modules")}    ${diff.modules.added.slice(0, 6).join(", ")}${diff.modules.added.length > 6 ? "…" : ""}`);
        if (diff.modules.removed.length) log(`    ${dim("· removed modules")}${diff.modules.removed.slice(0, 6).join(", ")}${diff.modules.removed.length > 6 ? "…" : ""}`);
      }
      if (args.diffOut) {
        const abs = await writeTextFile(args.diffOut, JSON.stringify(diff, null, 2));
        if (!args.quiet) log(`  ${dim("diff-out")} wrote ${cyan(abs)}`);
      }
    } catch (e) {
      printMachineError("EBASELINE", `cannot load baseline: ${e.message || e}`);
      console.error("reality-map: --baseline failed:", e.message || e);
      process.exit(1);
    }
  }

  // ---- Layer rules --------------------------------------------------------
  let ruleResult = null;
  if (args.rulesFile) {
    try {
      const rules = loadRules(args.rulesFile);
      ruleResult = checkRules(scan, rules);
      if (!args.quiet && !args.jsonOut && !args.summaryJson && !args.listFiles) {
        if (!ruleResult.violations.length) {
          log(`  ${dim("rules")}    ${green("✓")} no layer violations`);
        } else {
          log(`  ${dim("rules")}    ${bold(ruleResult.violations.length)} violation(s):`);
          for (const v of ruleResult.violations.slice(0, 12)) {
            log(`    ${dim("·")} ${v.from} ${dim("→")} ${v.to} ${dim(`(${v.fromLayer}→${v.toLayer}, w=${v.weight})`)}`);
          }
        }
      }
      if (args.failOnRules && ruleResult.violations.length) {
        printMachineError("ERULES", `${ruleResult.violations.length} layer rule violation(s)`, {
          violations: ruleResult.violations.slice(0, 50),
        });
        process.exit(1);
      }
    } catch (e) {
      printMachineError("ERULESLOAD", `cannot load rules: ${e.message || e}`);
      console.error("reality-map: --rules failed:", e.message || e);
      process.exit(1);
    }
  }

  // ---- Orphans ------------------------------------------------------------
  if (args.orphansOut) {
    const rep = require("../lib/orphans.js").buildOrphanReport(scan);
    const abs = await writeTextFile(args.orphansOut, JSON.stringify(rep, null, 2));
    if (!args.quiet) log(`  ${dim("orphans")}  wrote ${cyan(abs)} (isolated=${rep.counts.isolated}, sinks=${rep.counts.sinks}, sources=${rep.counts.sources})`);
  }

  // ---- HTML snapshot ------------------------------------------------------
  if (args.exportHtml) {
    const h = health || computeHealth(scan);
    const html = renderHtml(scan, h);
    const abs = await writeTextFile(args.exportHtml, html);
    if (!args.quiet) log(`  ${dim("html")}     wrote ${cyan(abs)}`);
  }

  // ---- Dependency tree ----------------------------------------------------
  if (args.showTree) {
    const t = buildDependencyTree(scan, args.showTree, args.treeDepth);
    if (!t) log(`  ${dim("tree")}     no graph available`);
    else if (t.error) {
      console.error(`reality-map: ${t.error}`);
      const ids = (scan.graphsByDepth?.[1]?.nodes || []).map((n) => n.id).slice(0, 12).join(", ");
      console.error(`available modules (sample): ${ids}`);
      process.exit(1);
    } else {
      log("");
      log(`  ${bold("dependency tree")} ${dim(`(depth ${args.treeDepth})`)}`);
      log(t.tree.split("\n").map((l) => "    " + l).join("\n"));
      log("");
    }
  }

  const graphDepth = Math.min(args.graphDepth, scan.maxDepth || 1);
  const graphForExport = scan.graphsByDepth?.[graphDepth] || scan.graphsByDepth?.[1];

  if (args.summaryJson) console.log(JSON.stringify(buildSummary(scan, scanMs)));

  if (args.listFiles) {
    for (const p of scan.scannedFilePaths || []) console.log(p);
  }

  if (args.jsonOut) {
    console.log(JSON.stringify(scan));
    if (args.exportPath) {
      const abs = await writeScanJsonFile(args.exportPath, scan);
      if (!args.quiet) logErr(`reality-map: also wrote ${abs}`);
    }
    process.exit(0);
  }

  if (!args.quiet && !args.summaryJson && !args.listFiles) {
    const depth1 = scan.graphsByDepth?.[1] ?? { stats: { modules: 0, edges: 0, cycles: 0 } };
    const extRefs = scan.insights?.summary?.externalRefs ?? 0;
    log(
      `  ${dim("summary")}  ${bold(scan.stats.files)} files · ${bold(depth1.stats.modules)} modules · ${bold(depth1.stats.edges)} edges · ${depth1.stats.cycles} cycle(s) · ${extRefs} ext. refs · depth ${args.depth} ${dim(`(${scanMs}ms)`)}`
    );
  }

  if (args.exportDot && graphForExport) {
    const dot = moduleGraphToDot(graphForExport, `depth-${graphDepth}`);
    const abs = await writeTextFile(args.exportDot, dot);
    if (!args.quiet) log(`  ${dim("export-dot")}  wrote ${cyan(abs)} (depth ${graphDepth})`);
  }
  if (args.exportMermaid && graphForExport) {
    const mm = moduleGraphToMermaid(graphForExport);
    const abs = await writeTextFile(args.exportMermaid, mm);
    if (!args.quiet) log(`  ${dim("export-mermaid")}  wrote ${cyan(abs)} (depth ${graphDepth})`);
  }

  if (args.noServe) {
    if (args.exportPath) {
      const abs = await writeScanJsonFile(args.exportPath, scan);
      log(`  ${dim("export")}  wrote ${cyan(abs)}`);
    }

    if (args.watch) {
      logErr(`  ${dim("watch")}  ignored without a server (omit --no-serve / use default run)`);
    }

    if (!args.quiet) log("");
    process.exit(0);
  }

  const { url, server, port, triedFallback, rescan } = await startServerWithFallback({
    basePort: args.port,
    attempts: args.portAttempts,
    graph: scan,
    root: args.root,
    maxDepth: args.depth,
    watch: args.watch,
  });

  if (triedFallback && !args.quiet) {
    log(`  ${dim("note")}  port ${args.port} was busy — using ${port}`);
  }

  if (args.quiet) {
    console.log(url);
  } else {
    log("");
    log(`  ${bold(green("➜"))}  Dashboard  ${cyan(url)}`);
    log(`  ${dim("Ctrl+C to stop · local only · no upload")}`);
    log("");
  }

  const shutdown = (signal) => {
    const msg = `\n  ${dim(signal === "SIGINT" ? "shutting down…" : "stopping…")}`;
    if (args.quiet) console.error(msg.trim());
    else console.log(msg);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2500).unref();
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  if (args.watch && typeof rescan === "function") {
    const onFs = debounce(async () => {
      try {
        if (!args.quiet) log(`  ${dim("·")}  ${dim("change detected — rescanning…")}`);
        await rescan();
        if (!args.quiet) log(`  ${dim("·")}  ${dim("graph updated (dashboard will sync)")}`);
      } catch (e) {
        printMachineError("WATCH_RESCAN", e.message || String(e));
        console.error("reality-map watch rescan failed:", e.message || e);
      }
    }, 1100);
    try {
      fs.watch(args.root, { recursive: true }, onFs);
      if (!args.quiet) log(`  ${dim("watch")}  filesystem events → auto-rescan`);
    } catch {
      if (!args.quiet) {
        log(`  ${dim("watch")}  ${dim("not available — use “Rescan” in the dashboard")}`);
      }
    }
  }

  if (args.open) openBrowser(url);
})().catch((err) => {
  const code = err.code && typeof err.code === "string" ? err.code : "ERR";
  printMachineError(code, err.message || String(err), err.cause ? { cause: err.cause.message || String(err.cause) } : undefined);
  console.error("reality-map failed:", err.message || err);
  if (err && err.cause) console.error("  cause:", err.cause.message || err.cause);
  process.exit(1);
});
