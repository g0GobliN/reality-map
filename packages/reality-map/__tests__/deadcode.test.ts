import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { buildDeadCodeReport } = require("../lib/deadcode.js");

function makeScan(
  files: string[],
  imports: Record<string, { specs: string[] }>,
  loc: Record<string, number>,
) {
  return { scannedFilePaths: files, fileDetails: { imports, loc } };
}

describe("buildDeadCodeReport", () => {
  it("returns no candidates for an empty project", () => {
    const result = buildDeadCodeReport({
      scannedFilePaths: [],
      fileDetails: { imports: {}, loc: {} },
    });
    expect(result.candidateCount).toBe(0);
    expect(result.totalFiles).toBe(0);
  });

  it("flags an unreferenced file with no importers", () => {
    const scan = makeScan(
      ["src/unused.ts", "src/main.ts"],
      { "src/main.ts": { specs: [] }, "src/unused.ts": { specs: [] } },
      { "src/unused.ts": 50, "src/main.ts": 100 },
    );
    const result = buildDeadCodeReport(scan);
    expect(result.candidates.some((c: { path: string }) => c.path === "src/unused.ts")).toBe(true);
  });

  it("excludes files that have importers", () => {
    const scan = makeScan(
      ["src/a.ts", "src/b.ts"],
      { "src/b.ts": { specs: ["./a"] }, "src/a.ts": { specs: [] } },
      { "src/a.ts": 50, "src/b.ts": 100 },
    );
    const result = buildDeadCodeReport(scan);
    expect(result.candidates.some((c: { path: string }) => c.path === "src/a.ts")).toBe(false);
  });

  it("excludes entry points matched by pattern", () => {
    for (const entry of ["src/index.ts", "src/main.ts", "src/app.tsx"]) {
      const scan = makeScan([entry], { [entry]: { specs: [] } }, { [entry]: 50 });
      expect(buildDeadCodeReport(scan).candidateCount).toBe(0);
    }
  });

  it("excludes test files", () => {
    for (const f of ["src/foo.test.ts", "src/bar.spec.tsx", "__tests__/baz.ts"]) {
      const scan = makeScan([f], { [f]: { specs: [] } }, { [f]: 50 });
      expect(buildDeadCodeReport(scan).candidateCount).toBe(0);
    }
  });

  it("excludes config files", () => {
    for (const f of ["vite.config.ts", "eslint.config.js", "tailwind.config.ts"]) {
      const scan = makeScan([f], { [f]: { specs: [] } }, { [f]: 50 });
      expect(buildDeadCodeReport(scan).candidateCount).toBe(0);
    }
  });

  it("skips files with 0 lines of code", () => {
    const scan = makeScan(["src/empty.ts"], { "src/empty.ts": { specs: [] } }, { "src/empty.ts": 0 });
    expect(buildDeadCodeReport(scan).candidateCount).toBe(0);
  });

  it("gives higher confidence to legacy-named files", () => {
    const scan = makeScan(
      ["src/old-feature.ts", "src/normal.ts"],
      { "src/old-feature.ts": { specs: [] }, "src/normal.ts": { specs: [] } },
      { "src/old-feature.ts": 50, "src/normal.ts": 50 },
    );
    const result = buildDeadCodeReport(scan);
    const legacy = result.candidates.find((c: { path: string }) => c.path === "src/old-feature.ts");
    const normal = result.candidates.find((c: { path: string }) => c.path === "src/normal.ts");
    expect(legacy.confidence).toBeGreaterThan(normal.confidence);
  });

  it("boosts confidence for truly isolated files (no outgoing imports either)", () => {
    const scan = makeScan(
      ["src/isolated.ts", "src/with-imports.ts", "src/dep.ts"],
      {
        "src/isolated.ts": { specs: [] },
        "src/with-imports.ts": { specs: ["./dep"] },
        "src/dep.ts": { specs: [] },
      },
      { "src/isolated.ts": 50, "src/with-imports.ts": 50, "src/dep.ts": 50 },
    );
    const result = buildDeadCodeReport(scan);
    const isolated = result.candidates.find((c: { path: string }) => c.path === "src/isolated.ts");
    const withImports = result.candidates.find(
      (c: { path: string }) => c.path === "src/with-imports.ts",
    );
    if (isolated && withImports) {
      expect(isolated.confidence).toBeGreaterThan(withImports.confidence);
    }
  });

  it("sorts candidates by confidence descending", () => {
    const scan = makeScan(
      ["src/tiny.ts", "src/big.ts"],
      { "src/tiny.ts": { specs: [] }, "src/big.ts": { specs: [] } },
      { "src/tiny.ts": 10, "src/big.ts": 300 },
    );
    const { candidates } = buildDeadCodeReport(scan);
    for (let i = 1; i < candidates.length; i++) {
      expect(candidates[i - 1].confidence).toBeGreaterThanOrEqual(candidates[i].confidence);
    }
  });

  it("sums potentialLocSavings across top 100 candidates", () => {
    const scan = makeScan(
      ["src/dead.ts"],
      { "src/dead.ts": { specs: [] } },
      { "src/dead.ts": 80 },
    );
    expect(buildDeadCodeReport(scan).potentialLocSavings).toBe(80);
  });

  it("confidence is clamped between 10 and 99", () => {
    const scan = makeScan(
      ["src/whatever.ts"],
      { "src/whatever.ts": { specs: [] } },
      { "src/whatever.ts": 50 },
    );
    const { candidates } = buildDeadCodeReport(scan);
    for (const c of candidates) {
      expect(c.confidence).toBeGreaterThanOrEqual(10);
      expect(c.confidence).toBeLessThanOrEqual(99);
    }
  });

  // Python
  it("excludes Python entry points from dead code candidates", () => {
    for (const entry of ["main.py", "src/main.py", "__main__.py", "app.py", "wsgi.py", "manage.py"]) {
      const scan = makeScan([entry], { [entry]: { specs: [] } }, { [entry]: 50 });
      expect(buildDeadCodeReport(scan).candidateCount).toBe(0);
    }
  });

  it("excludes Python test files from dead code candidates", () => {
    for (const f of ["tests/test_utils.py", "utils/helpers_test.py", "conftest.py"]) {
      const scan = makeScan([f], { [f]: { specs: [] } }, { [f]: 50 });
      expect(buildDeadCodeReport(scan).candidateCount).toBe(0);
    }
  });

  it("flags unreferenced Python file as dead code", () => {
    const scan = makeScan(
      ["src/main.py", "src/utils/old_helper.py"],
      { "src/main.py": { specs: [] }, "src/utils/old_helper.py": { specs: [] } },
      { "src/main.py": 100, "src/utils/old_helper.py": 40 },
    );
    const result = buildDeadCodeReport(scan);
    expect(result.candidates.some((c: { path: string }) => c.path === "src/utils/old_helper.py")).toBe(true);
  });

  it("does not flag Python file that is imported by another", () => {
    const scan = makeScan(
      ["src/main.py", "src/utils.py"],
      { "src/main.py": { specs: ["./utils"] }, "src/utils.py": { specs: [] } },
      { "src/main.py": 100, "src/utils.py": 40 },
    );
    const result = buildDeadCodeReport(scan);
    expect(result.candidates.some((c: { path: string }) => c.path === "src/utils.py")).toBe(false);
  });

  // Go
  it("excludes Go entry point main.go from dead code candidates", () => {
    const scan = makeScan(["cmd/server/main.go"], { "cmd/server/main.go": { specs: [] } }, { "cmd/server/main.go": 50 });
    expect(buildDeadCodeReport(scan).candidateCount).toBe(0);
  });

  it("excludes Go test files from dead code candidates", () => {
    for (const f of ["pkg/util_test.go", "internal/db/store_test.go"]) {
      const scan = makeScan([f], { [f]: { specs: [] } }, { [f]: 50 });
      expect(buildDeadCodeReport(scan).candidateCount).toBe(0);
    }
  });

  // Rust
  it("excludes Rust entry points main.rs and lib.rs from dead code candidates", () => {
    for (const entry of ["src/main.rs", "src/lib.rs"]) {
      const scan = makeScan([entry], { [entry]: { specs: [] } }, { [entry]: 50 });
      expect(buildDeadCodeReport(scan).candidateCount).toBe(0);
    }
  });

  it("excludes Rust build script build.rs from dead code candidates", () => {
    const scan = makeScan(["build.rs"], { "build.rs": { specs: [] } }, { "build.rs": 50 });
    expect(buildDeadCodeReport(scan).candidateCount).toBe(0);
  });

  // resolvedEdges fast path (simulates real scan output with Go module / Python absolute imports already resolved)
  it("uses resolvedEdges to count importers when present", () => {
    const scan = {
      scannedFilePaths: ["src/main.py", "src/models/user.py", "src/utils.py"],
      fileDetails: {
        imports: {
          "src/main.py": { specs: ["myapp/models/user", "myapp/utils"] },
          "src/models/user.py": { specs: [] },
          "src/utils.py": { specs: [] },
        },
        loc: { "src/main.py": 50, "src/models/user.py": 30, "src/utils.py": 20 },
        // resolvedEdges already maps absolute Python imports to real files
        resolvedEdges: {
          "src/main.py": ["src/models/user.py", "src/utils.py"],
        },
      },
    };
    const result = buildDeadCodeReport(scan);
    // Both should have importers via resolvedEdges — not flagged as dead
    expect(result.candidates.some((c: { path: string }) => c.path === "src/models/user.py")).toBe(false);
    expect(result.candidates.some((c: { path: string }) => c.path === "src/utils.py")).toBe(false);
  });

  it("flags file as dead when resolvedEdges does not include it", () => {
    const scan = {
      scannedFilePaths: ["src/main.py", "src/models/user.py", "src/legacy.py"],
      fileDetails: {
        imports: { "src/main.py": { specs: [] }, "src/models/user.py": { specs: [] }, "src/legacy.py": { specs: [] } },
        loc: { "src/main.py": 50, "src/models/user.py": 30, "src/legacy.py": 40 },
        resolvedEdges: {
          "src/main.py": ["src/models/user.py"],
          // legacy.py never appears as a target
        },
      },
    };
    const result = buildDeadCodeReport(scan);
    expect(result.candidates.some((c: { path: string }) => c.path === "src/legacy.py")).toBe(true);
    expect(result.candidates.some((c: { path: string }) => c.path === "src/models/user.py")).toBe(false);
  });

  it("counts importers via @/ path alias (default src/ mapping)", () => {
    // Button is imported via @/ alias — should NOT be flagged as dead
    const scan = makeScan(
      ["src/index.ts", "src/components/Button.ts"],
      {
        "src/index.ts": { specs: ["@/components/Button"] },
        "src/components/Button.ts": { specs: [] },
      },
      { "src/index.ts": 10, "src/components/Button.ts": 30 },
    );
    const result = buildDeadCodeReport(scan);
    expect(result.candidates.some((c: { path: string }) => c.path === "src/components/Button.ts")).toBe(false);
  });

  it("flags file as dead when alias does not resolve to it", () => {
    // OldUtil is not imported by anyone — should be flagged
    const scan = makeScan(
      ["src/index.ts", "src/utils/OldUtil.ts"],
      {
        "src/index.ts": { specs: ["@/utils/NewUtil"] },
        "src/utils/OldUtil.ts": { specs: [] },
      },
      { "src/index.ts": 10, "src/utils/OldUtil.ts": 40 },
    );
    const result = buildDeadCodeReport(scan);
    expect(result.candidates.some((c: { path: string }) => c.path === "src/utils/OldUtil.ts")).toBe(true);
  });
});
