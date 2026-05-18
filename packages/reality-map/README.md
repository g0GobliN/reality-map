# reality-map

Visual architecture explorer for AI-generated and fast-growing codebases.
Run locally — your code never leaves your machine.

```bash
npx reality-map
```

Then open the dashboard that appears at `http://localhost:4317`.

## What it does

- Walks your repo and parses `import` / `require` / dynamic `import()` statements
- Groups files into modules by top-level folder (e.g. `src/api`, `src/components`)
- Renders an interactive, draggable graph of the dependencies between modules
- Detects circular dependencies and highlights cycle members
- Lists hotspots by lines of code and your most-used external packages

No upload, no telemetry, no account.

## Usage

```bash
npx reality-map [path] [options]

  -p, --port <n>   Port (default 4317)
      --no-open    Don't open the browser
  -h, --help       Show help
```

## Supported files

`.js .jsx .ts .tsx .mjs .cjs .mts .cts .vue .svelte .astro`

Skips: `node_modules`, `dist`, `build`, `.git`, `.next`, `.cache`, etc.

## License

MIT