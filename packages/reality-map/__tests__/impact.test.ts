import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { computeImpact } = require("../lib/impact.js");

function makeScan(
  files: string[],
  imports: Record<string, { specs: string[] }>,
  loc: Record<string, number> = {},
) {
  return { scannedFilePaths: files, fileDetails: { imports, loc } };
}

describe("computeImpact", () => {
  it("returns no affected files when nothing imports the changed file", () => {
    const scan = makeScan(["src/a.ts", "src/b.ts"], {
      "src/a.ts": { specs: [] },
      "src/b.ts": { specs: [] },
    });
    const result = computeImpact(scan, ["src/a.ts"]);
    expect(result.totalAffected).toBe(0);
    expect(result.riskLevel).toBe("none");
  });

  it("handles empty changed paths list", () => {
    const scan = makeScan(["src/a.ts"], { "src/a.ts": { specs: [] } });
    const result = computeImpact(scan, []);
    expect(result.totalAffected).toBe(0);
    expect(result.changed).toHaveLength(0);
  });

  it("finds a direct dependent", () => {
    const scan = makeScan(["src/a.ts", "src/b.ts"], {
      "src/b.ts": { specs: ["./a"] },
    });
    const result = computeImpact(scan, ["src/a.ts"]);
    expect(result.directCount).toBe(1);
    expect(result.affected[0].path).toBe("src/b.ts");
    expect(result.affected[0].direct).toBe(true);
    expect(result.affected[0].depth).toBe(1);
  });

  it("finds transitive dependents via BFS", () => {
    const scan = makeScan(["src/a.ts", "src/b.ts", "src/c.ts"], {
      "src/b.ts": { specs: ["./a"] },
      "src/c.ts": { specs: ["./b"] },
    });
    const result = computeImpact(scan, ["src/a.ts"]);
    expect(result.totalAffected).toBe(2);
    expect(result.directCount).toBe(1);
    expect(result.transitiveCount).toBe(1);
    const c = result.affected.find((f: { path: string }) => f.path === "src/c.ts");
    expect(c.depth).toBe(2);
    expect(c.direct).toBe(false);
  });

  it("excludes the changed file itself from the affected list", () => {
    const scan = makeScan(["src/a.ts", "src/b.ts"], {
      "src/b.ts": { specs: ["./a"] },
    });
    const result = computeImpact(scan, ["src/a.ts"]);
    const paths = result.affected.map((f: { path: string }) => f.path);
    expect(paths).not.toContain("src/a.ts");
  });

  it("does not double-visit the same file in a diamond dependency", () => {
    // a -> b, a -> c, b -> d, c -> d   (diamond)
    const scan = makeScan(["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts"], {
      "src/b.ts": { specs: ["./a"] },
      "src/c.ts": { specs: ["./a"] },
      "src/d.ts": { specs: ["./b", "./c"] },
    });
    const result = computeImpact(scan, ["src/a.ts"]);
    const paths = result.affected.map((f: { path: string }) => f.path);
    const unique = new Set(paths);
    expect(paths.length).toBe(unique.size);
  });

  it("builds module-level impact summary", () => {
    const scan = makeScan(["src/a.ts", "src/components/Button.tsx"], {
      "src/components/Button.tsx": { specs: ["../a"] },
    });
    const result = computeImpact(scan, ["src/a.ts"]);
    expect(result.moduleImpact.length).toBeGreaterThan(0);
    expect(result.moduleImpact[0]).toHaveProperty("module");
    expect(result.moduleImpact[0]).toHaveProperty("files");
    expect(result.moduleImpact[0]).toHaveProperty("maxRisk");
  });

  it("classifies riskLevel correctly", () => {
    // No dependents → none
    const none = computeImpact(
      makeScan(["src/a.ts"], { "src/a.ts": { specs: [] } }),
      ["src/a.ts"],
    );
    expect(none.riskLevel).toBe("none");

    // Direct dependent with depth=1 → risk = round(max(1,min(10, 10/1*0.6+...))) ≥ 5 → medium/high
    const scan = makeScan(["src/a.ts", "src/b.ts"], {
      "src/b.ts": { specs: ["./a"] },
    });
    const result = computeImpact(scan, ["src/a.ts"]);
    expect(["low", "medium", "high"]).toContain(result.riskLevel);
  });
});
