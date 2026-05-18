```
██████╗ ███████╗ █████╗ ██╗     ██╗████████╗██╗   ██╗    ███╗   ███╗ █████╗ ██████╗ 
██╔══██╗██╔════╝██╔══██╗██║     ██║╚══██╔══╝╚██╗ ██╔╝    ████╗ ████║██╔══██╗██╔══██╗
██████╔╝█████╗  ███████║██║     ██║   ██║    ╚████╔╝     ██╔████╔██║███████║██████╔╝
██╔══██╗██╔══╝  ██╔══██║██║     ██║   ██║     ╚██╔╝      ██║╚██╔╝██║██╔══██║██╔═══╝ 
██║  ██║███████╗██║  ██║███████╗██║   ██║      ██║       ██║ ╚═╝ ██║██║  ██║██║     
╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝╚═╝   ╚═╝      ╚═╝       ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝     

Visual Architecture Explorer for Codebases
```

# reality-map

**Visual architecture explorer for any JavaScript/TypeScript codebase. Zero config, zero upload, runs entirely local.**

> By [Vishal Gurung](https://github.com/g0GobliN) · [@g0GobliN](https://github.com/g0GobliN)

```bash
npx reality-map
```

Opens an interactive dependency map in your browser in seconds.

---

## What it does

Most codebases grow faster than anyone can understand them. `reality-map` gives you an instant visual overview — modules, dependencies, cycles, coupling hubs — and lets you drill all the way down to individual files and functions.

---

## Features

### 🗺 Interactive Dependency Map
- Module-level graph with configurable depth (1–5)
- Click any module to drill in — see sub-modules, then files, then symbols
- Drag nodes to rearrange, pan and zoom freely
- Animated edges show import direction and weight
- Cycle detection — circular dependencies highlighted in red

### 🔍 Deep File Exploration
- Click any module at max depth → side drawer opens with all files
- See every function, class, interface, and type with line numbers
- Full import list with exact line numbers and import statements
- Search symbols inside any file instantly
- Breadcrumb navigation — go back up the drill-down path

### 💥 Change Impact Analysis *(new)*
Enter any file paths → instantly see:
- Every file that could break (direct + transitive)
- Risk score per affected file (1–10)
- Module-level blast radius summary
- Color-coded: high / medium / low risk

### 🏥 Codebase Health Score *(new)*
A single 0–100 score with letter grade (A–F) based on:
- Circular dependency count
- Isolated file ratio
- Oversized files (>500 LOC)
- Highly-coupled hubs

Includes a **copy-ready README badge**:
```
![Health 87/100](https://img.shields.io/static/v1?label=health&message=87/100&color=brightgreen)
```

### 🧹 Dead Code Detector *(new)*
Finds files that are probably unused — scored by confidence, not just "0 importers":
- No internal importers
- Not an entry point, test, or config file
- Confidence score based on multiple signals
- Shows potential LOC savings

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
```

---

## Supported languages

| Language | Extensions |
|---|---|
| JavaScript | `.js` `.mjs` `.cjs` |
| TypeScript | `.ts` `.tsx` `.mts` `.cts` |
| JSX | `.jsx` |
| Vue | `.vue` |
| Svelte | `.svelte` |
| Astro | `.astro` |
| Python | `.py` |
| Go | `.go` |
| Rust | `.rs` |

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

| Endpoint | Method | Description |
|---|---|---|
| `/api/graph` | GET | Full scan data |
| `/api/health` | GET | Health score (0–100) |
| `/api/impact` | POST | Change impact — body: `{ "paths": ["src/foo.ts"] }` |
| `/api/deadcode` | GET | Dead code candidates |
| `/api/search?q=` | GET | File search |
| `/api/file/:path` | GET | File symbols + imports |
| `/api/rescan` | POST | Re-scan project |
| `/api/snapshot.html` | GET | Download self-contained HTML snapshot |

---

## How the health score works

| Factor | Max penalty |
|---|---|
| Circular dependencies | −30 pts |
| High isolated file ratio (>5%) | −20 pts |
| Files over 500 LOC | −15 pts |
| Highly-coupled hubs (in≥8, out≥5) | −15 pts |

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

MIT © [Vishal Gurung](https://github.com/g0GobliN)
