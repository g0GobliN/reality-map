# reality-map

Visual architecture explorer for AI-generated and fast-growing codebases.
Run locally — your code never leaves your machine.

```bash
npx reality-map
```

Then open the dashboard that appears at `http://localhost:4317` (or the URL printed in your terminal).

## What it does

- Walks your repo and parses `import` / `require` / dynamic `import()` statements
- Groups files into modules by folder depth (`src/…`, `app/…`, or top-level)
- **Map** — interactive, draggable graph of module dependencies, pan/zoom, edge tooltips (import counts)
- **Insights** — largest files, most-imported files, coupling hubs, files with no internal importers (possible entry/unused), summary chips (edges, external refs, isolated files)
- **Files** — searchable table of every scanned file with LOC and internal in/out degree (top 6000 by LOC in huge repos)
- **Module sidebar** — filter, sort (LOC / name / fan-in / fan-out), depth selector, selected-module detail with sample paths
- **Cycles** — lists circular dependency chains; cycle nodes highlighted on the graph
- **Top packages** — most referenced `node_modules` specifiers
- **Export** — download the full scan JSON from the dashboard
- **Rescan** — `POST /api/rescan` from the UI (or **R** shortcut) re-runs the scanner without restarting the CLI
- **`--watch`** — filesystem watcher rescans on save; the dashboard auto-syncs when the graph changes

No upload, no telemetry, no account.

## Usage

```bash
npx reality-map [path] [options]

  -p, --port <n>   Port (default 4317; tries the next ports if busy)
  -d, --depth <n>  Module grouping depth, 1–5 (default 3)
  -w, --watch      Rescan when files under the project change (auto-refresh UI)
      --no-open    Don't open the browser
  -q, --quiet      Print only the dashboard URL (good for scripts)
      --json, --stdout
                   Print the full scan JSON to stdout and exit (no HTTP server; stdout is only JSON)
      --export <file>
                   Write the full scan JSON to a file and exit (no HTTP server)
      --no-serve, --print-only
                   Scan and print the usual summary, then exit (no server; combine with --export to write JSON)
      --include-ext <ext[,ext…]>
                   Extra extensions to include (leading dot optional), e.g. `.json,.md`
      --fail-on-cycles
                   Exit with code 1 if any depth view reports module dependency cycles
      --fail-if-isolated
                   Exit with code 1 if “isolated” internal-only files exceed budget (default 0)
      --isolated-budget <n>
                   Allow up to `<n>` isolated files (implies `--fail-if-isolated`; fail if count > `n`)
      --summary-json
                   One compact JSON line of key metrics (stdout; no full scan dump)
      --list-files   All scanned relative paths, one per line on stdout (no banner or progress lines)
      --export-dot <file>
                   Graphviz DOT for the module graph at `--graph-depth` (default 1)
      --export-mermaid <file>
                   Mermaid `flowchart` for the same graph slice
      --graph-depth <n>
                   Slice depth for DOT/Mermaid exports (1–5; clamped to scan `--depth`)
  -h, --help       Show help
  -V, --version    Print package version
```

While it runs you get short progress lines (discover files → parse imports → build depth views), then **Ctrl+C** stops the server cleanly.

### CI / scripting

```bash
# Machine-readable graph on stdout (pipe to jq, files, etc.)
npx reality-map --json .

# Write scan JSON for another tool; no server
npx reality-map --export scan.json .

# Fail CI if any depth view reports module cycles (stderr JSON on failure)
npx reality-map --fail-on-cycles --print-only .

# One-line metrics for dashboards / jq (no full graph JSON)
npx reality-map --summary-json .

# Paths only (pipe to xargs, ripgrep --files-from, etc.)
npx reality-map --list-files .

# Graphviz + Mermaid for docs / CI artifacts
npx reality-map --export-dot graph.dot --export-mermaid graph.mmd --graph-depth 1 .

# Fail if more than 3 fully-isolated internal files
npx reality-map --isolated-budget 3 --print-only .
```

When **`--fail-on-cycles`** triggers, the process exits **1** and **does not** write `--export` output or print `--json` (only the stderr error payload). The same applies to **`--fail-if-isolated`** / **`EISOLATED`**.

On failure, the CLI prints a **single JSON object** to stderr with `"type":"reality-map-error"`, a `code` string (for example `EROOT`, `ENOTDIR`, `SCAN_FAILED`, **`ECYCLES`**, **`EISOLATED`**), and a `message`, then exits non-zero. A human-readable line is printed after it for local debugging.

### `.realitymapignore`

Optional file at the project root. One pattern per line; `#` starts a comment; blank lines ignored. Paths are **relative to the project root** with `/` as the separator.

- **Prefix / subtree:** a line without `*` or `?` matches that path or anything under it (`legacy` matches `legacy/foo.ts`; a trailing `/` is optional).
- **Glob (one segment):** `*` matches characters within one path segment (not `/`); `?` matches a single character in that segment.

This is **not** a full `.gitignore` engine (no negation, `**`, or anchored-root rules).

Full scan JSON (from `--json` / `--export`) includes a **`scannedFilePaths`** array (every included source file, relative paths, sorted).

## Supported files

`.js .jsx .ts .tsx .mjs .cjs .mts .cts .vue .svelte .astro`

Use `--include-ext` to scan additional extensions (comma-separated).

Skips: `node_modules`, `dist`, `build`, `.git`, `.next`, `.cache`, etc. Additional paths can be excluded with `.realitymapignore` (see above).

## License

MIT
