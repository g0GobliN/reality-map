"use strict";

function buildOrphanReport(scan) {
  const idx = scan.insights?.filesIndex || [];
  const isolated = idx.filter((f) => f.importers === 0 && f.importees === 0);
  const sinks = idx.filter((f) => f.importers === 0 && f.importees > 0);
  const sources = idx.filter((f) => f.importees === 0 && f.importers > 0);
  return {
    counts: { isolated: isolated.length, sinks: sinks.length, sources: sources.length },
    isolated: isolated.slice(0, 500),
    sinksWithoutImporters: sinks.slice(0, 500),
    pureLeafSources: sources.slice(0, 500),
  };
}

module.exports = { buildOrphanReport };
