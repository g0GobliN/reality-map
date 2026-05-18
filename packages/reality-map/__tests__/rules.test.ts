import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { checkRules } = require("../lib/rules.js");

function makeRules(
  layers: Record<string, RegExp[]>,
  forbid: Array<{ from: string; to: string; reason?: string }>,
) {
  return { compiled: layers, forbid };
}

function makeScan(
  nodes: Array<{ id: string; pathsPreview?: string[] }>,
  edges: Array<{ source: string; target: string; weight: number }>,
) {
  return { graphsByDepth: { 1: { nodes, edges } } };
}

describe("checkRules / checkRules", () => {
  it("returns no violations for an empty graph", () => {
    expect(checkRules(makeScan([], []), makeRules({}, [])).violations).toHaveLength(0);
  });

  it("returns no violations when graphsByDepth[1] is absent", () => {
    expect(checkRules({}, makeRules({}, [{ from: "ui", to: "server" }])).violations).toHaveLength(
      0,
    );
  });

  it("returns no violations when edges don't cross forbidden layers", () => {
    const rules = makeRules(
      { ui: [/^src\/components(?:\/.*)?$/] },
      [{ from: "ui", to: "server" }],
    );
    const scan = makeScan(
      [{ id: "src/components", pathsPreview: ["src/components/Button.tsx"] }],
      [],
    );
    expect(checkRules(scan, rules).violations).toHaveLength(0);
  });

  it("detects a forbidden layer import", () => {
    const rules = makeRules(
      {
        ui: [/^src\/components(?:\/.*)?$/],
        server: [/^src\/server(?:\/.*)?$/],
      },
      [{ from: "ui", to: "server", reason: "UI must not import server code" }],
    );
    const scan = makeScan(
      [
        { id: "src/components", pathsPreview: ["src/components/index.ts"] },
        { id: "src/server", pathsPreview: ["src/server/index.ts"] },
      ],
      [{ source: "src/components", target: "src/server", weight: 3 }],
    );
    const { violations } = checkRules(scan, rules);
    expect(violations).toHaveLength(1);
    expect(violations[0].reason).toBe("UI must not import server code");
    expect(violations[0].weight).toBe(3);
    expect(violations[0].fromLayer).toBe("ui");
    expect(violations[0].toLayer).toBe("server");
  });

  it("does not report an edge that is allowed (same layer or not forbidden)", () => {
    const rules = makeRules(
      {
        ui: [/^src\/components(?:\/.*)?$/],
        lib: [/^src\/lib(?:\/.*)?$/],
      },
      // ui -> server is forbidden, but there is no server layer here
      [{ from: "ui", to: "server" }],
    );
    const scan = makeScan(
      [
        { id: "src/components", pathsPreview: ["src/components/index.ts"] },
        { id: "src/lib", pathsPreview: ["src/lib/utils.ts"] },
      ],
      [{ source: "src/components", target: "src/lib", weight: 1 }],
    );
    expect(checkRules(scan, rules).violations).toHaveLength(0);
  });

  it("skips edges where either node has no matching layer", () => {
    const rules = makeRules(
      { ui: [/^src\/components(?:\/.*)?$/] },
      [{ from: "ui", to: "unknown" }],
    );
    const scan = makeScan(
      [
        { id: "src/components", pathsPreview: ["src/components/index.ts"] },
        { id: "src/random", pathsPreview: ["src/random/file.ts"] },
      ],
      [{ source: "src/components", target: "src/random", weight: 1 }],
    );
    expect(checkRules(scan, rules).violations).toHaveLength(0);
  });
});
