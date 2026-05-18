/* eslint-disable */
"use strict";

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderHtml(scan, health) {
  const d1 = scan.graphsByDepth?.[1] || { nodes: [], edges: [], stats: {} };
  const nodes = d1.nodes;
  const edges = d1.edges;

  const W = 1200, H = Math.max(700, 60 + Math.ceil(nodes.length / 4) * 150);

  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const edgePaths = edges.map((e) => {
    const a = nodesById.get(e.source), b = nodesById.get(e.target);
    if (!a || !b) return "";
    const x1 = a.x + 110, y1 = a.y + 35, x2 = b.x + 110, y2 = b.y + 35;
    const mx = (x1 + x2) / 2;
    return `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" stroke="rgba(120,180,255,${Math.min(0.85, 0.2 + e.weight * 0.08)})" stroke-width="${Math.min(3, 1 + e.weight * 0.3)}" fill="none" />`;
  }).join("");

  const nodeSvg = nodes.map((n) => {
    const fill = n.warn ? "#3b1726" : n.tone === "violet" ? "#1f1939" : n.tone === "emerald" ? "#0f2a23" : n.tone === "amber" ? "#2c2210" : "#0f2230";
    const stroke = n.warn ? "#ff6b8b" : "#3a90ff";
    return `<g transform="translate(${n.x},${n.y})">
      <rect width="220" height="70" rx="14" fill="${fill}" stroke="${stroke}" stroke-opacity="0.55" />
      <text x="14" y="28" fill="#e8f0ff" font-family="ui-sans-serif,system-ui" font-size="14" font-weight="600">${escapeHtml(n.label)}</text>
      <text x="14" y="50" fill="#9bb1d8" font-family="ui-monospace,monospace" font-size="11">${escapeHtml(n.sub)}</text>
    </g>`;
  }).join("");

  const reasons = (health?.reasons || []).map((r) => `<li>${escapeHtml(r.msg)} <span style="opacity:.6">(-${r.penalty})</span></li>`).join("");
  const topLoc = (scan.insights?.topFilesByLoc || []).slice(0, 15)
    .map((f) => `<tr><td>${escapeHtml(f.path)}</td><td>${f.loc}</td></tr>`).join("");
  const topImp = (scan.insights?.topImported || []).slice(0, 15)
    .map((f) => `<tr><td>${escapeHtml(f.path)}</td><td>${f.count}</td></tr>`).join("");
  const cycles = (d1.cycles || []).slice(0, 20)
    .map((cy) => `<li>${cy.map(escapeHtml).join(" → ")}</li>`).join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<title>RealityMap snapshot — ${escapeHtml(scan.root)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
:root{color-scheme:dark}
body{margin:0;background:#070b14;color:#e8f0ff;font:14px/1.45 ui-sans-serif,system-ui}
header{padding:22px 28px;border-bottom:1px solid #1a2540;display:flex;align-items:baseline;gap:18px;flex-wrap:wrap}
h1{margin:0;font-size:20px;letter-spacing:.2px}
.dim{color:#7d92b8} .mono{font-family:ui-monospace,monospace}
main{padding:24px 28px;display:grid;grid-template-columns:1fr 320px;gap:28px}
@media (max-width:1000px){main{grid-template-columns:1fr}}
section{background:#0c1426;border:1px solid #1a2540;border-radius:14px;padding:18px}
section h2{margin:0 0 12px;font-size:14px;letter-spacing:.16em;text-transform:uppercase;color:#8ea7d4}
.score{font-size:64px;font-weight:700;letter-spacing:-1px}
.grade{font-size:22px;color:#7ad9b6;margin-left:10px}
table{width:100%;border-collapse:collapse;font-size:13px}
td,th{padding:6px 8px;border-bottom:1px solid #14203a;text-align:left}
th{color:#8ea7d4;font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:.12em}
ul{margin:0;padding-left:18px} li{margin:4px 0}
svg{width:100%;height:auto;background:radial-gradient(800px 500px at 30% 10%, rgba(60,110,200,0.18), transparent),#070b14;border-radius:12px;border:1px solid #1a2540}
.chip{display:inline-block;background:#0f1a30;border:1px solid #1f2c50;padding:4px 10px;border-radius:999px;font-size:12px;margin:0 6px 6px 0}
</style></head>
<body>
<header>
  <h1>RealityMap snapshot</h1>
  <span class="dim mono">${escapeHtml(scan.root)}</span>
  <span class="dim mono">${escapeHtml(scan.generatedAt || "")}</span>
</header>
<main>
  <div>
    <section>
      <h2>Module map (depth 1)</h2>
      <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
        ${edgePaths}${nodeSvg}
      </svg>
    </section>
    <section style="margin-top:20px">
      <h2>Largest files</h2>
      <table><thead><tr><th>Path</th><th>LOC</th></tr></thead><tbody>${topLoc}</tbody></table>
    </section>
    <section style="margin-top:20px">
      <h2>Most imported internally</h2>
      <table><thead><tr><th>Path</th><th>Importers</th></tr></thead><tbody>${topImp}</tbody></table>
    </section>
  </div>
  <aside>
    <section>
      <h2>Health</h2>
      <div><span class="score">${health?.score ?? "—"}</span><span class="grade">${health?.grade || ""}</span></div>
      <ul>${reasons || '<li class="dim">No issues detected.</li>'}</ul>
    </section>
    <section style="margin-top:20px">
      <h2>Summary</h2>
      <span class="chip">${scan.stats?.files ?? 0} files</span>
      <span class="chip">${scan.stats?.loc ?? 0} loc</span>
      <span class="chip">${d1.stats?.modules ?? 0} modules</span>
      <span class="chip">${d1.stats?.edges ?? 0} edges</span>
      <span class="chip">${d1.stats?.cycles ?? 0} cycles</span>
    </section>
    <section style="margin-top:20px">
      <h2>Cycles</h2>
      <ul class="mono" style="font-size:12px">${cycles || '<li class="dim">None.</li>'}</ul>
    </section>
  </aside>
</main>
</body></html>`;
}

module.exports = { renderHtml };
