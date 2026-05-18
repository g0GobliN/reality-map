import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { computeHealth } = require("../lib/health.js");

function makeScan(overrides: Record<string, unknown> = {}) {
  return {
    graphsByDepth: { 1: { stats: { cycles: 0 } } },
    insights: { summary: { isolatedInternalFiles: 0 }, hubs: [], topFilesByLoc: [] },
    stats: { files: 20 },
    ...overrides,
  };
}

describe("computeHealth", () => {
  it("returns score 100 and grade A for a clean codebase", () => {
    const result = computeHealth(makeScan());
    expect(result.score).toBe(100);
    expect(result.grade).toBe("A");
    expect(result.reasons).toHaveLength(0);
  });

  it("penalizes cycles at 6 pts each", () => {
    const result = computeHealth(
      makeScan({ graphsByDepth: { 1: { stats: { cycles: 3 } } } }),
    );
    expect(result.score).toBe(82); // 100 - 18
    expect(result.reasons[0].kind).toBe("cycles");
    expect(result.reasons[0].penalty).toBe(18);
  });

  it("caps cycle penalty at 30", () => {
    const result = computeHealth(
      makeScan({ graphsByDepth: { 1: { stats: { cycles: 10 } } } }),
    );
    expect(result.score).toBe(70);
  });

  it("does not penalize isolated files below 5% ratio", () => {
    // 1 isolated out of 100 files = 1% — below threshold
    const result = computeHealth(
      makeScan({
        insights: { summary: { isolatedInternalFiles: 1 }, hubs: [], topFilesByLoc: [] },
        stats: { files: 100 },
      }),
    );
    expect(result.reasons.some((r: { kind: string }) => r.kind === "isolated")).toBe(false);
  });

  it("penalizes isolated files above 5% ratio", () => {
    const result = computeHealth(
      makeScan({
        insights: { summary: { isolatedInternalFiles: 20 }, hubs: [], topFilesByLoc: [] },
        stats: { files: 100 },
      }),
    );
    expect(result.reasons.some((r: { kind: string }) => r.kind === "isolated")).toBe(true);
  });

  it("penalizes oversized files (>500 LOC) at 2 pts each", () => {
    const result = computeHealth(
      makeScan({
        insights: {
          summary: { isolatedInternalFiles: 0 },
          hubs: [],
          topFilesByLoc: [
            { path: "src/fat.ts", loc: 600 },
            { path: "src/huge.ts", loc: 900 },
          ],
        },
      }),
    );
    const reason = result.reasons.find((r: { kind: string }) => r.kind === "oversized");
    expect(reason).toBeDefined();
    expect(reason.penalty).toBe(4); // 2 files × 2
  });

  it("penalizes highly-coupled hubs (in≥8, out≥5) at 3 pts each", () => {
    const result = computeHealth(
      makeScan({
        insights: {
          summary: { isolatedInternalFiles: 0 },
          hubs: [{ id: "src/core.ts", in: 10, out: 6 }],
          topFilesByLoc: [],
        },
      }),
    );
    const reason = result.reasons.find((r: { kind: string }) => r.kind === "hubs");
    expect(reason).toBeDefined();
    expect(reason.penalty).toBe(3);
  });

  it("does not flag hubs below threshold (in<8 or out<5)", () => {
    const result = computeHealth(
      makeScan({
        insights: {
          summary: { isolatedInternalFiles: 0 },
          hubs: [{ id: "src/small.ts", in: 5, out: 3 }],
          topFilesByLoc: [],
        },
      }),
    );
    expect(result.reasons.some((r: { kind: string }) => r.kind === "hubs")).toBe(false);
  });

  it("assigns grades correctly across thresholds", () => {
    expect(computeHealth(makeScan()).grade).toBe("A"); // 100
    // B: 80-89
    const b = computeHealth(makeScan({ graphsByDepth: { 1: { stats: { cycles: 3 } } } }));
    expect(b.score).toBe(82);
    expect(b.grade).toBe("B");
    // C: 70-79 — 5 cycles = 30 penalty → 70
    const c = computeHealth(makeScan({ graphsByDepth: { 1: { stats: { cycles: 5 } } } }));
    expect(c.grade).toBe("C");
  });

  it("never goes below 0", () => {
    const result = computeHealth(
      makeScan({
        graphsByDepth: { 1: { stats: { cycles: 100 } } },
        insights: {
          summary: { isolatedInternalFiles: 999 },
          hubs: Array.from({ length: 10 }, () => ({ in: 10, out: 6 })),
          topFilesByLoc: Array.from({ length: 20 }, () => ({ loc: 1000 })),
        },
        stats: { files: 1000 },
      }),
    );
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.grade).toBe("F");
  });
});
