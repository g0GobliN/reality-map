/* eslint-disable */
"use strict";

const fs = require("fs");
const path = require("path");

function loadBaseline(file) {
  const abs = path.resolve(process.cwd(), file);
  const txt = fs.readFileSync(abs, "utf8");
  return JSON.parse(txt);
}

function diffScans(prev, curr) {
  const prevFiles = new Set(prev.scannedFilePaths || []);
  const currFiles = new Set(curr.scannedFilePaths || []);
  const added = [...currFiles].filter((f) => !prevFiles.has(f)).sort();
  const removed = [...prevFiles].filter((f) => !currFiles.has(f)).sort();

  const prevCycles = prev.graphsByDepth?.[1]?.stats?.cycles ?? 0;
  const currCycles = curr.graphsByDepth?.[1]?.stats?.cycles ?? 0;

  const prevLoc = prev.stats?.loc ?? 0;
  const currLoc = curr.stats?.loc ?? 0;

  const prevMods = new Set((prev.graphsByDepth?.[1]?.nodes || []).map((n) => n.id));
  const currMods = new Set((curr.graphsByDepth?.[1]?.nodes || []).map((n) => n.id));
  const newModules = [...currMods].filter((m) => !prevMods.has(m)).sort();
  const removedModules = [...prevMods].filter((m) => !currMods.has(m)).sort();

  return {
    files: { added: added.length, removed: removed.length, addedSample: added.slice(0, 20), removedSample: removed.slice(0, 20) },
    loc: { prev: prevLoc, curr: currLoc, delta: currLoc - prevLoc },
    cycles: { prev: prevCycles, curr: currCycles, delta: currCycles - prevCycles },
    modules: { added: newModules, removed: removedModules },
  };
}

module.exports = { loadBaseline, diffScans };
