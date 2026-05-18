import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { buildOrphanReport } = require("../lib/orphans.js");

describe("buildOrphanReport", () => {
  it("returns zero counts for empty filesIndex", () => {
    const result = buildOrphanReport({ insights: { filesIndex: [] } });
    expect(result.counts).toEqual({ isolated: 0, sinks: 0, sources: 0 });
  });

  it("handles missing insights gracefully", () => {
    const result = buildOrphanReport({});
    expect(result.counts).toEqual({ isolated: 0, sinks: 0, sources: 0 });
  });

  it("identifies isolated files (0 importers, 0 importees)", () => {
    const scan = {
      insights: {
        filesIndex: [
          { path: "src/unused.ts", importers: 0, importees: 0 },
          { path: "src/main.ts", importers: 1, importees: 2 },
        ],
      },
    };
    const result = buildOrphanReport(scan);
    expect(result.counts.isolated).toBe(1);
    expect(result.isolated[0].path).toBe("src/unused.ts");
  });

  it("identifies sinks (0 importers, has importees)", () => {
    const scan = {
      insights: {
        filesIndex: [{ path: "src/sink.ts", importers: 0, importees: 3 }],
      },
    };
    const result = buildOrphanReport(scan);
    expect(result.counts.sinks).toBe(1);
    expect(result.sinksWithoutImporters[0].path).toBe("src/sink.ts");
  });

  it("identifies sources (has importers, 0 importees)", () => {
    const scan = {
      insights: {
        filesIndex: [{ path: "src/leaf.ts", importers: 5, importees: 0 }],
      },
    };
    const result = buildOrphanReport(scan);
    expect(result.counts.sources).toBe(1);
    expect(result.pureLeafSources[0].path).toBe("src/leaf.ts");
  });

  it("correctly categorizes a mixed set of files", () => {
    const scan = {
      insights: {
        filesIndex: [
          { importers: 0, importees: 0 }, // isolated
          { importers: 0, importees: 2 }, // sink
          { importers: 3, importees: 0 }, // source
          { importers: 1, importees: 1 }, // normal — none of the above
        ],
      },
    };
    const result = buildOrphanReport(scan);
    expect(result.counts).toEqual({ isolated: 1, sinks: 1, sources: 1 });
  });

  it("caps results at 500 entries per category", () => {
    const big = Array.from({ length: 600 }, (_, i) => ({
      path: `src/file${i}.ts`,
      importers: 0,
      importees: 0,
    }));
    const result = buildOrphanReport({ insights: { filesIndex: big } });
    expect(result.isolated.length).toBe(500);
  });
});
