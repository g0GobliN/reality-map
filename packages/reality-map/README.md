<p align="center">
  <img src="https://raw.githubusercontent.com/g0GobliN/reality-map/main/src/img/git_logo.PNG" alt="RealityMap Logo" width="420" />
  <br/><br/>
  <strong>Visual architecture explorer for any JavaScript/TypeScript codebase. Zero config, zero upload, runs entirely local.</strong>
  <br/>
  <code>npx reality-map</code>
  <br/>
  <sub>By <a href="https://github.com/g0GobliN">Vishal Gurung</a> · <a href="https://github.com/g0GobliN">@g0GobliN</a></sub>
</p>

---

## What it does

Most codebases grow faster than anyone can understand them. `reality-map` gives you an instant visual overview — modules, dependencies, cycles, coupling hubs — and lets you drill all the way down to individual files and functions.

<p align="center">
  <img src="https://raw.githubusercontent.com/g0GobliN/reality-map/main/src/img/ss/2D891534-ACC7-4327-B054-8240BE3013E5.PNG" alt="RealityMap Interactive 3D/Radial Dependency Map" width="850" />
</p>

---

## Features

### 🗺 Interactive Architecture Graph

A live, zoomable graph of your entire project — modules, services, databases, and their connections — rendered in the browser with full interaction.

**Phase 1 · Interaction**

- **Edge focus mode** — hover any node to highlight its connected edges; unrelated edges drop to near-invisible
- **Path highlighting** — click a node to lock focus; its neighbours glow, everything else fades to 20% opacity; click again or click the canvas to deselect
- **Edge filtering** — toggle edge groups by colour/type (`web`, `api`, `infra`, `cycle`) to isolate signal from noise; at least one group always stays active

**Phase 2 · Clustering**

- **Domain clusters** — nodes are grouped into logical layers (`web layer`, `api layer`, `infra layer`), each shown with a translucent group background
- **Collapse & expand** — click a cluster toggle pill or the cluster node itself to collapse the entire group into a single summary card; inter-cluster edges auto-reroute and deduplicate
- **Cluster metrics** — each collapsed cluster card shows aggregated file count and warning count; the top HUD shows how many clusters are currently collapsed

**Phase 3 · Layouts & Abstraction**

- **Multiple layouts** — switch between three named arrangements:
  - `layered` — left-to-right tier layout (default, shows group backgrounds)
  - `radial` — nodes arranged evenly around a circle
  - `force` — organic scatter with cluster proximity preserved
- **Smooth transitions** — switching layouts or toggling clusters triggers an animated `fitView` so context is never lost
- **Zoom-based abstraction** — zoom out past ~50% and all clusters auto-collapse into summary nodes; the HUD switches to "abstracted · zoom in to expand"; zooming back in restores the full graph

**Core graph features**

- Module-level graph with configurable depth (1–5)
- Click any module to drill in — see sub-modules, then files, then symbols
- Drag nodes to rearrange, pan and zoom freely
- Animated edges show import direction and weight
- Cycle detection — circular dependencies highlighted in rose

<p align="center">
  <img src="https://raw.githubusercontent.com/g0GobliN/reality-map/main/src/img/ss/Screenshot%20from%202026-05-20%2011-44-26.png" alt="RealityMap Sub-dependency Graph" width="850" />
</p>

### 🔍 Deep File Exploration

- Click any module at max depth → side drawer opens with all files
- See every function, class, interface, and type with line numbers
- Full import list with exact line numbers and import statements
- Search symbols inside any file instantly
- Breadcrumb navigation — go back up the drill-down path

### 💥 Change Impact Analysis _(new)_

Enter any file paths → instantly see:

- Every file that could break (direct + transitive)
- Risk score per affected file (1–10)
- Module-level blast radius summary
- Color-coded: high / medium / low risk

### 🏥 Codebase Health Score _(new)_

A single 0–100 score with letter grade (A–F) based on:

- Circular dependency count
- Isolated file ratio
- Oversized files (>500 LOC)
- Highly-coupled hubs

Includes a **copy-ready README badge**:

```
![Health 87/100](https://img.shields.io/static/v1?label=health&message=87/100&color=brightgreen)
```

<p align="center">
  <img src="https://raw.githubusercontent.com/g0GobliN/reality-map/main/src/img/ss/Screenshot%20from%202026-05-20%2011-45-32.png" alt="RealityMap Codebase Health Dashboard" width="850" />
</p>

### 🧹 Dead Code Detector

Finds files that are probably unused — scored by confidence, not just "0 importers":

- No internal importers
- Not an entry point, test, or config file
- Confidence score based on multiple signals
- Shows potential LOC savings

<p align="center">
  <img src="https://raw.githubusercontent.com/g0GobliN/reality-map/main/src/img/ss/Screenshot%20from%202026-05-20%2011-45-18.png" alt="RealityMap Dead Code Candidates" width="850" />
</p>

### 📦 Dependency Intelligence _(new)_

Full local analysis of your `package.json` — no registry upload, works offline after install.

<p align="center">
  <img src="https://raw.githubusercontent.com/g0GobliN/reality-map/main/src/img/ss/Screenshot%20from%202026-05-20%2011-45-01.png" alt="RealityMap Dependency Intelligence Dashboard" width="850" />
</p>

**Unused detection** — packages declared but never imported in source are flagged as `unused`. Packages only found in config files (`eslint.config.js`, `vite.config.ts`, etc.) are labelled `config-only` instead, which is a distinct and valid usage pattern.

**Vulnerability scan** — runs `npm audit` locally and surfaces results grouped by severity: `critical` / `high` / `moderate` / `low`. Gracefully skips if `npm audit` is unavailable.

**Outdated packages** — uses `npm outdated` to detect stale versions, then classifies the gap:

- `outdated (major)` — breaking version behind, shown in amber
- `outdated (minor)` — non-breaking feature behind, shown dim
- `outdated (patch)` — safe bug-fix behind, low noise

**Deprecated packages** — reads the `deprecated` field directly from `node_modules/[pkg]/package.json` — fully offline, no registry call needed.

**Risk score (0–10)** — per-package score combining all signals:

| Signal                 | Points |
| ---------------------- | ------ |
| Critical vulnerability | +4     |
| High vulnerability     | +3     |
| Moderate vulnerability | +2     |
| Low vulnerability      | +0.5   |
| Deprecated             | +2     |
| Unused (runtime dep)   | +1     |
| Major version behind   | +1.5   |
| Minor version behind   | +0.5   |

**Overlapping ecosystem detection** — warns when multiple libraries serve the same purpose (e.g. `moment` + `date-fns` + `dayjs`), covering 10 ecosystem groups: date, HTTP client, state management, forms, CSS-in-JS, animation, validation, ORM, routing, and data-fetching.

**Package detail drawer** — click any package to see: importing files, vulnerability details with links, installed vs latest version, risk score breakdown, and deprecation message.

**CLI usage:**

```bash
# Print dep intelligence report to terminal
npx reality-map --deps

# Output as JSON (for CI / scripting)
npx reality-map --deps-json

# Exit 1 if any critical vulnerabilities found
npx reality-map --deps --fail-on-vuln critical

# Exit 1 if any high-or-above vulnerabilities found
npx reality-map --deps --fail-on-vuln high
```

### 📊 Insights Dashboard

- Largest files by LOC
- Most imported files (your critical shared code)
- Coupling hubs (high fan-in AND fan-out)
- Files with no internal importers (potential entry points or dead code)

### 🔎 Global Search

`Ctrl+K` — fuzzy search across all files, jump directly to any file's detail view.

### 📦 Minimap

Always-visible overview of the full graph while you're zoomed in.

---

## Usage

```bash
# Scan current directory
npx reality-map

# Scan a specific project
npx reality-map /path/to/project

# Custom port
npx reality-map --port 4000

# Custom depth (1-5, default 3)
npx reality-map --depth 4

# Watch mode (auto-refresh on file changes)
npx reality-map --watch

# Export snapshot as self-contained HTML
npx reality-map --export snapshot.html

# Dependency intelligence (terminal report)
npx reality-map --deps

# Dependency intelligence as JSON
npx reality-map --deps-json

# Fail CI if critical vulnerabilities found
npx reality-map --deps --fail-on-vuln critical
```

---

## Supported languages

| Language   | Extensions                 |
| ---------- | -------------------------- |
| JavaScript | `.js` `.mjs` `.cjs`        |
| TypeScript | `.ts` `.tsx` `.mts` `.cts` |
| JSX        | `.jsx`                     |
| Vue        | `.vue`                     |
| Svelte     | `.svelte`                  |
| Astro      | `.astro`                   |
| Python     | `.py`                      |
| Go         | `.go`                      |
| Rust       | `.rs`                      |

---

## Ignore files

Create a `.realitymapignore` file in your project root (same syntax as `.gitignore`):

```
# Ignore generated files
src/generated/
*.generated.ts

# Ignore specific directories
legacy/
```

---

## API endpoints

The local server exposes a REST API you can use in scripts:

| Endpoint             | Method | Description                                                    |
| -------------------- | ------ | -------------------------------------------------------------- |
| `/api/graph`         | GET    | Full scan data                                                 |
| `/api/health`        | GET    | Health score (0–100)                                           |
| `/api/impact`        | POST   | Change impact — body: `{ "paths": ["src/foo.ts"] }`            |
| `/api/deadcode`      | GET    | Dead code candidates                                           |
| `/api/deps`          | GET    | Dependency intelligence — unused, vulns, outdated, risk scores |
| `/api/search?q=`     | GET    | File search                                                    |
| `/api/file/:path`    | GET    | File symbols + imports                                         |
| `/api/rescan`        | POST   | Re-scan project                                                |
| `/api/snapshot.html` | GET    | Download self-contained HTML snapshot                          |

---

## How the health score works

| Factor                            | Max penalty |
| --------------------------------- | ----------- |
| Circular dependencies             | −30 pts     |
| High isolated file ratio (>5%)    | −20 pts     |
| Files over 500 LOC                | −15 pts     |
| Highly-coupled hubs (in≥8, out≥5) | −15 pts     |

Grade scale: A (90–100) · B (80–89) · C (70–79) · D (60–69) · F (<60)

---

## How change impact works

Given a list of changed files, `reality-map` does a reverse BFS through the import graph:

1. Finds all files that directly import the changed files (depth 1)
2. Finds all files that import those (depth 2, 3, …)
3. Scores each affected file by proximity to the change + file size + importer count
4. Groups results by module for a high-level blast radius view

---

## Requirements

- Node.js 18+
- No other dependencies — zero npm install needed in your project

---

## Privacy

Everything runs locally. No files, paths, or code are ever uploaded anywhere.

---

## Contributing

- Maintained by [Vishal Gurung](https://github.com/g0GobliN).
- If you use or share `reality-map`, please credit the author and link back to `https://github.com/g0GobliN/reality-map`.
- Contributions are welcome via pull requests. Please open an issue first to discuss larger changes or feature requests.
- All changes are reviewed and merged by the maintainer.

---

## License

AGPL-3.0 © [Vishal Gurung](https://github.com/g0GobliN)
