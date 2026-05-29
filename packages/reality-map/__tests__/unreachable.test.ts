import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { buildUnreachableReport } = require("../lib/unreachable.js");

function makeScan(files: Record<string, string[]>, loc: Record<string, number> = {}) {
  const scannedFilePaths = Object.keys(files);
  const imports: Record<string, { specs: string[] }> = {};
  for (const [file, specs] of Object.entries(files)) {
    imports[file] = { specs };
  }
  return {
    scannedFilePaths,
    fileDetails: { imports, loc },
  };
}

describe("buildUnreachableReport", () => {
  it("returns zero files when srcDir has no matching files", () => {
    const scan = makeScan({ "lib/server.js": [] });
    const result = buildUnreachableReport(scan, "src");
    expect(result.totalFiles).toBe(0);
    expect(result.unreachable).toHaveLength(0);
  });

  it("reports zero unreachable when all src files are reachable from root", () => {
    const scan = makeScan({
      "src/index.jsx": ["./App"],
      "src/App.jsx": ["./utils/helpers"],
      "src/utils/helpers.js": [],
    });
    const result = buildUnreachableReport(scan, "src");
    expect(result.unreachableCount).toBe(0);
  });

  it("detects files not reachable from any root", () => {
    const scan = makeScan({
      "src/index.jsx": ["./App"],
      "src/App.jsx": [],
      "src/AdminPanel.jsx": [],  // never imported by anyone
      "src/OldFeature.js": [],   // never imported by anyone
    });
    const result = buildUnreachableReport(scan, "src");
    // index.jsx is a named entry (seed) → reaches App.
    // AdminPanel and OldFeature have zero importers but live inside srcDir
    // so they are NOT seeded — they are unreachable orphans.
    expect(result.unreachableCount).toBe(2);
    const paths = result.unreachable.map((f: { path: string }) => f.path);
    expect(paths).toContain("src/AdminPanel.jsx");
    expect(paths).toContain("src/OldFeature.js");
  });

  it("marks files unreachable only when they have importers but are not reachable from any root", () => {
    // B and C are imported only by each other (cycle, no outside root reaches them)
    const scan = makeScan({
      "src/index.jsx": ["./A"],
      "src/A.jsx": [],
      "src/B.jsx": ["./C"],  // B imports C
      "src/C.jsx": ["./B"],  // C imports B — cycle, nothing imports B from outside
    });
    const result = buildUnreachableReport(scan, "src");
    // B and C have importers (each other), so they're NOT roots
    // Only src/index.jsx is a root → reaches A only
    // B and C are unreachable
    expect(result.unreachableCount).toBe(2);
    const paths = result.unreachable.map((f: { path: string }) => f.path);
    expect(paths).toContain("src/B.jsx");
    expect(paths).toContain("src/C.jsx");
  });

  it("walks from multiple roots simultaneously (framework pattern)", () => {
    // Simulates TanStack Router: start.ts and router.tsx are separate roots
    const scan = makeScan({
      "src/start.ts": ["./lib/error"],
      "src/lib/error.ts": [],
      "src/router.tsx": ["./routeTree.gen"],   // separate root
      "src/routeTree.gen.ts": ["./routes/index"],
      "src/routes/index.tsx": [],              // reached via router.tsx root
    });
    const result = buildUnreachableReport(scan, "src");
    expect(result.unreachableCount).toBe(0);
  });

  it("skips non-relative imports (node_modules)", () => {
    const scan = makeScan({
      "src/index.jsx": ["react", "lodash", "./App"],
      "src/App.jsx": [],
    });
    const result = buildUnreachableReport(scan, "src");
    expect(result.unreachableCount).toBe(0);
  });

  it("handles index file resolution (import './Foo' resolves to Foo/index.jsx)", () => {
    const scan = makeScan({
      "src/index.jsx": ["./components/Button"],
      "src/components/Button/index.jsx": [],
      "src/components/Dead.jsx": ["./Orphan"],
      "src/components/Orphan.jsx": ["./Dead"],  // cycle, nothing imports Dead from outside
    });
    const result = buildUnreachableReport(scan, "src");
    expect(result.unreachableCount).toBe(2);
  });

  it("handles cyclic imports without infinite loop", () => {
    const scan = makeScan({
      "src/index.jsx": ["./A"],
      "src/A.jsx": ["./B"],
      "src/B.jsx": ["./A"],
    });
    const result = buildUnreachableReport(scan, "src");
    expect(result.unreachableCount).toBe(0);
  });

  it("scopes report to srcDir, excludes files outside it", () => {
    const scan = makeScan({
      "src/index.jsx": [],
      "tests/setup.js": [],
    });
    const result = buildUnreachableReport(scan, "src");
    expect(result.totalFiles).toBe(1);
    const paths = result.unreachable.map((f: { path: string }) => f.path);
    expect(paths).not.toContain("tests/setup.js");
  });

  it("includes loc in unreachable entries when available", () => {
    // Phantom and Ghost import each other (cycle, no named entry, no zero-importer)
    const scan = makeScan(
      { "src/Phantom.jsx": ["./Ghost"], "src/Ghost.jsx": ["./Phantom"] },
      { "src/Ghost.jsx": 42 }
    );
    const result = buildUnreachableReport(scan, "src");
    const ghost = result.unreachable.find((f: { path: string }) => f.path === "src/Ghost.jsx");
    expect(ghost?.loc).toBe(42);
  });

  it("returns correct summary counts", () => {
    const scan = makeScan({
      "src/index.jsx": ["./A"],
      "src/A.jsx": [],
      "src/B.jsx": ["./C"],  // cycle island
      "src/C.jsx": ["./B"],
    });
    const result = buildUnreachableReport(scan, "src");
    expect(result.totalFiles).toBe(4);
    expect(result.reachableCount).toBe(2); // index + A
    expect(result.unreachableCount).toBe(2); // B + C
  });
});
