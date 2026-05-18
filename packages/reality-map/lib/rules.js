/* eslint-disable */
"use strict";

const fs = require("fs");
const path = require("path");

/**
 * Rules file format (JSON):
 * { "layers": { "ui": ["src/components", "src/routes"], "server": ["src/server", "src/lib/*.server"] },
 *   "forbid": [ { "from": "ui", "to": "server", "reason": "UI must not import server code" } ] }
 *
 * Patterns match a file's relative posix path with `*` per-segment wildcard.
 */
function loadRules(file) {
  const abs = path.resolve(process.cwd(), file);
  const j = JSON.parse(fs.readFileSync(abs, "utf8"));
  const layers = j.layers || {};
  const forbid = j.forbid || [];
  const compiled = {};
  for (const [name, pats] of Object.entries(layers)) {
    compiled[name] = pats.map((p) => globToRe(p));
  }
  return { compiled, forbid };
}

function globToRe(line) {
  let s = "";
  for (const c of line) {
    if (c === "*") s += "[^/]*";
    else if (c === "?") s += "[^/]";
    else if ("\\.^$+()[]{}|".includes(c)) s += "\\" + c;
    else s += c;
  }
  return new RegExp("^" + s + "(?:/.*)?$");
}

function layerOf(rel, compiled) {
  for (const [name, regs] of Object.entries(compiled)) {
    for (const re of regs) if (re.test(rel)) return name;
  }
  return null;
}

/**
 * Walk each module->module edge from depth-1 graph and use file edges via insights.
 * We look at scan.insights.filesIndex and per-file imports stored on scan if available.
 * Since file-level edges aren't currently exported, we approximate with module names that look like layers.
 * For accuracy, accept scannedFilePaths plus module nodes containing module path matches.
 */
function checkRules(scan, rules) {
  const violations = [];
  const compiled = rules.compiled;
  const forbid = rules.forbid;

  const d1 = scan.graphsByDepth?.[1];
  if (!d1) return { violations };

  const moduleLayer = new Map();
  for (const n of d1.nodes) {
    const sample = (n.pathsPreview && n.pathsPreview[0]) || n.id;
    moduleLayer.set(n.id, layerOf(sample, compiled));
  }

  for (const e of d1.edges) {
    const from = moduleLayer.get(e.source);
    const to = moduleLayer.get(e.target);
    if (!from || !to) continue;
    for (const rule of forbid) {
      if (rule.from === from && rule.to === to) {
        violations.push({
          from: e.source, to: e.target,
          fromLayer: from, toLayer: to,
          reason: rule.reason || `${from} -> ${to} is forbidden`,
          weight: e.weight,
        });
      }
    }
  }
  return { violations };
}

module.exports = { loadRules, checkRules };
