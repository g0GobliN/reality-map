/* eslint-disable */
"use strict";

/**
 * Compute a 0-100 health score from a scan.
 * Penalises cycles, isolated files, oversized files, deep coupling hubs.
 */
function computeHealth(scan) {
  const reasons = [];
  let score = 100;

  const d1 = scan.graphsByDepth?.[1];
  const cycles = d1?.stats?.cycles ?? 0;
  if (cycles > 0) {
    const pen = Math.min(30, cycles * 6);
    score -= pen;
    reasons.push({ kind: "cycles", count: cycles, penalty: pen,
      msg: `${cycles} module cycle group(s) at depth 1` });
  }

  const isolated = scan.insights?.summary?.isolatedInternalFiles ?? 0;
  const files = scan.stats?.files ?? 1;
  const isoRatio = isolated / Math.max(1, files);
  if (isoRatio > 0.05) {
    const pen = Math.min(20, Math.round(isoRatio * 100));
    score -= pen;
    reasons.push({ kind: "isolated", count: isolated, ratio: isoRatio, penalty: pen,
      msg: `${isolated} isolated file(s) (${(isoRatio * 100).toFixed(1)}%)` });
  }

  const huge = (scan.insights?.topFilesByLoc || []).filter((f) => f.loc > 500);
  if (huge.length) {
    const pen = Math.min(15, huge.length * 2);
    score -= pen;
    reasons.push({ kind: "oversized", count: huge.length, penalty: pen,
      msg: `${huge.length} file(s) > 500 LOC`, samples: huge.slice(0, 5) });
  }

  const hubs = (scan.insights?.hubs || []).filter((h) => h.in >= 8 && h.out >= 5);
  if (hubs.length) {
    const pen = Math.min(15, hubs.length * 3);
    score -= pen;
    reasons.push({ kind: "hubs", count: hubs.length, penalty: pen,
      msg: `${hubs.length} highly-coupled hub(s) (in≥8, out≥5)`, samples: hubs.slice(0, 5) });
  }

  score = Math.max(0, Math.min(100, score));
  const grade = score >= 90 ? "A"
    : score >= 80 ? "B"
    : score >= 70 ? "C"
    : score >= 60 ? "D"
    : "F";
  return { score, grade, reasons };
}

module.exports = { computeHealth };
