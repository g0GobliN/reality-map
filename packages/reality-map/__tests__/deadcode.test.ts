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
});
