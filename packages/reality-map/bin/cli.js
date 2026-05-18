#!/usr/bin/env node
/* eslint-disable */
"use strict";

const path = require("path");
const { scanProject } = require("../lib/scan.js");
const { startServer } = require("../lib/server.js");

function parseArgs(argv) {
  const args = { root: process.cwd(), port: 4317, open: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--port" || a === "-p") args.port = Number(argv[++i]);
    else if (a === "--no-open") args.open = false;
    else if (a === "--help" || a === "-h") {
      console.log(`reality-map — visual architecture explorer

Usage:
  npx reality-map [path] [options]

Options:
  -p, --port <n>   Port to serve dashboard on (default 4317)
      --no-open    Do not auto-open the browser
  -h, --help       Show help
`);
      process.exit(0);
    } else if (!a.startsWith("-")) {
      args.root = path.resolve(process.cwd(), a);
    }
  }
  return args;
}

async function openBrowser(url) {
  try {
    const { spawn } = require("child_process");
    const cmd =
      process.platform === "darwin" ? "open"
      : process.platform === "win32" ? "start"
      : "xdg-open";
    spawn(cmd, [url], { stdio: "ignore", detached: true, shell: process.platform === "win32" }).unref();
  } catch {}
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
  const dim = (s) => `\x1b[2m${s}\x1b[0m`;
  const bold = (s) => `\x1b[1m${s}\x1b[0m`;

  console.log("");
  console.log(`  ${bold(cyan("◢ RealityMap"))}  ${dim("v0.1.0")}`);
  console.log(`  ${dim("scanning")}  ${args.root}`);

  const t0 = Date.now();
  const scan = await scanProject(args.root);
  const ms = Date.now() - t0;
  const depth1 = scan.graphsByDepth?.[1] ?? { stats: { modules: 0, edges: 0, cycles: 0 } };

  console.log(
    `  ${dim("indexed ")} ${bold(scan.stats.files)} files · ${bold(depth1.stats.modules)} modules · ${bold(depth1.stats.edges)} edges · ${depth1.stats.cycles} cycle(s) ${dim(`(${ms}ms)`)}`
  );

  const { url } = await startServer({ port: args.port, graph: scan, root: args.root });
  console.log("");
  console.log(`  ${bold("➜")}  Dashboard:  ${cyan(url)}`);
  console.log(`  ${dim("Ctrl+C to stop")}`);
  console.log("");

  if (args.open) openBrowser(url);
})().catch((err) => {
  console.error("reality-map failed:", err);
  process.exit(1);
});