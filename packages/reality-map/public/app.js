/* RealityMap dashboard — vanilla SVG + multi-view, zero deps */
(async function () {
  const TONE = {
    cyan: "oklch(0.82 0.16 210)",
    violet: "oklch(0.72 0.19 295)",
    emerald: "oklch(0.78 0.15 160)",
    amber: "oklch(0.82 0.16 75)",
    rose: "oklch(0.72 0.20 18)",
  };

  // ── DOM refs ──────────────────────────────────────────────────
  const svg = document.getElementById("canvas");
  const stats = document.getElementById("stats");
  const metaRoot = document.getElementById("meta-root");
  const moduleList = document.getElementById("module-list");
  const cycleList = document.getElementById("cycle-list");
  const extList = document.getElementById("ext-list");
  const hud = document.getElementById("hud");
  const backBtn = document.getElementById("back");
  const detailPanel = document.getElementById("detail-panel");
  const moduleFilter = document.getElementById("module-filter");
  const moduleSort = document.getElementById("module-sort");
  const depthSelect = document.getElementById("depth-select");
  const viewMap = document.getElementById("view-map");
  const viewInsights = document.getElementById("view-insights");
  const viewFiles = document.getElementById("view-files");
  const fileFilter = document.getElementById("file-filter");
  const globalSearch = document.getElementById("global-search");
  const globalSearchResults = document.getElementById("global-search-results");
  const fileDrawer = document.getElementById("file-drawer");
  const drawerTitle = document.getElementById("drawer-title");
  const drawerMeta = document.getElementById("drawer-meta");
  const drawerClose = document.getElementById("drawer-close");
  const drawerFiles = document.getElementById("drawer-files");
  const drawerSymbols = document.getElementById("drawer-symbols");
  const drawerImports = document.getElementById("drawer-imports");
  const symbolSearch = document.getElementById("symbol-search");
  const drawerWarn = document.getElementById("drawer-warn");
  const edgeTooltip = document.getElementById("edge-tooltip");
  const layout = document.getElementById("view-map");
  const helpModal = document.getElementById("help-modal");
  const helpBtn = document.getElementById("help-btn");
  const helpClose = document.getElementById("help-close");

  // ── State ─────────────────────────────────────────────────────
  let meta = await fetch("/api/meta").then((r) => r.json());
  metaRoot.textContent = meta.root;
  const verEl = document.getElementById("meta-version");
  if (verEl && meta.version) verEl.textContent = "v" + meta.version + " · ";

  let scan = await fetch("/api/graph").then((r) => r.json());
  let graphsByDepth = scan.graphsByDepth || { 1: scan };
  let maxDepth = scan.maxDepth ?? Math.max(1, ...Object.keys(graphsByDepth).map((k) => Number(k)));
  let lastGeneratedAt = scan.generatedAt;

  let selected = null;
  let stack = [];
  let view = {
    x: 0,
    y: 0,
    k: 1,
    depth: Number(localStorage.getItem("rm-depth")) || 1,
    prefix: null,
  };
  let currentViewGraph = null;
  let activeTab = "map";
  let drawerData = null; // { type: 'module'|'file', id }
  let allSymbols = []; // for symbol search filtering
  let mapMode = localStorage.getItem("rm-mode") || "arch"; // arch | activity | blast

  // ── Depth select ──────────────────────────────────────────────
  function fillDepthSelect() {
    depthSelect.innerHTML = "";
    for (let d = 1; d <= maxDepth; d++) {
      const o = document.createElement("option");
      o.value = String(d);
      o.textContent = "Level " + d;
      depthSelect.appendChild(o);
    }
    depthSelect.value = String(view.depth);
  }
  fillDepthSelect();

  depthSelect.addEventListener("change", () => {
    view.depth = Number(depthSelect.value);
    localStorage.setItem("rm-depth", view.depth);
    view.prefix = null;
    stack = [];
    selected = null;
    render();
  });

  moduleSort.addEventListener("change", () => render());
  moduleFilter.addEventListener("input", () => render());
  document.getElementById("map-mode").addEventListener("change", (e) => {
    mapMode = e.target.value;
    localStorage.setItem("rm-mode", mapMode);
    document.getElementById("map-mode").value = mapMode;
    render();
  });
  document.getElementById("map-mode").value = mapMode;

  function getBlastRadius(moduleId, graph) {
    if (!moduleId) return new Set();
    const visited = new Set([moduleId]);
    const queue = [moduleId];
    while (queue.length) {
      const curr = queue.shift();
      graph.edges.forEach((e) => {
        if (e.target === curr && !visited.has(e.source)) {
          visited.add(e.source);
          queue.push(e.source);
        }
      });
    }
    return visited;
  }

  function getModuleColor(n, mode, blastSet) {
    if (mode === "activity") {
      if (!n.lastModified) return "#334155";
      const now = Date.now() / 1000;
      const age = now - n.lastModified;
      if (age < 7 * 24 * 3600) return "#f43f5e"; // rose-500
      if (age < 28 * 24 * 3600) return "#f59e0b"; // amber-500
      return "#10b981"; // emerald-500
    }
    if (mode === "blast") {
      if (selected === n.id) return "#f43f5e";
      if (blastSet && blastSet.has(n.id)) return "#f59e0b";
      return "#334155";
    }
    return TONE[n.tone] || TONE.cyan;
  }

  function updateLegend() {
    const legend = document.getElementById("map-legend");
    if (!legend) return;
    if (mapMode === "arch") {
      legend.innerHTML = "";
    } else if (mapMode === "activity") {
      legend.innerHTML = `
        <div style="display:flex; gap:8px; align-items:center">
          <span style="width:8px; height:8px; border-radius:50%; background:#f43f5e"></span> &lt; 1wk
          <span style="width:8px; height:8px; border-radius:50%; background:#f59e0b"></span> &lt; 4wks
          <span style="width:8px; height:8px; border-radius:50%; background:#10b981"></span> Stable
        </div>`;
    } else if (mapMode === "blast") {
      legend.innerHTML = `
        <div style="display:flex; gap:8px; align-items:center">
          <span style="width:8px; height:8px; border-radius:50%; background:#f43f5e"></span> Target
          <span style="width:8px; height:8px; border-radius:50%; background:#f59e0b"></span> Affected
        </div>`;
    }
  }

  // ── Tabs ──────────────────────────────────────────────────────
  function setTab(tab) {
    activeTab = tab;
    document.querySelectorAll("#main-tabs .tab").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tab);
    });
    viewMap.hidden = tab !== "map";
    viewInsights.hidden = tab !== "insights";
    viewFiles.hidden = tab !== "files";
    document.getElementById("view-health").hidden = tab !== "health";
    document.getElementById("view-impact").hidden = tab !== "impact";
    document.getElementById("view-deadcode").hidden = tab !== "deadcode";
    document.getElementById("view-deps").hidden = tab !== "deps";
    const pkgDrawer = document.getElementById("pkg-drawer");
    if (pkgDrawer) {
      pkgDrawer.hidden = true;
    }
    if (typeof closeDrawer === "function") {
      closeDrawer();
    }
    if (tab === "insights") renderInsights();
    if (tab === "files") renderFilesTable();
    if (tab === "health") renderHealth();
    if (tab === "deadcode") renderDeadCode();
    if (tab === "deps") renderDeps();
  }

  document.getElementById("main-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn || !btn.dataset.tab) return;
    setTab(btn.dataset.tab);
  });

  // ── Back button ───────────────────────────────────────────────
  function setBackButton() {
    if (!backBtn) return;
    const canGoBack = stack.length > 0;
    backBtn.disabled = !canGoBack;
    backBtn.style.opacity = canGoBack ? "1" : "0.55";
    backBtn.style.cursor = canGoBack ? "pointer" : "not-allowed";
  }

  // ── Graph helpers ─────────────────────────────────────────────
  function getDepthGraph(depth) {
    return graphsByDepth[depth] || graphsByDepth[1] || scan;
  }

  function computeViewGraph() {
    const depthGraph = getDepthGraph(view.depth);
    if (!view.prefix) return depthGraph;
    const prefix = view.prefix;
    const nodes = depthGraph.nodes.filter((n) => n.id === prefix || n.id.startsWith(prefix + "/"));
    const nodeSet = new Set(nodes.map((n) => n.id));
    const edges = depthGraph.edges.filter((e) => nodeSet.has(e.source) && nodeSet.has(e.target));
    const cycles = depthGraph.cycles.filter((cy) => cy.every((n) => nodeSet.has(n)));
    const loc = nodes.reduce((a, n) => a + (n.loc || 0), 0);
    return {
      ...depthGraph,
      nodes,
      edges,
      cycles,
      stats: {
        ...(depthGraph.stats || {}),
        modules: nodes.length,
        edges: edges.length,
        cycles: cycles.length,
        loc,
      },
    };
  }

  // ── File Drawer ───────────────────────────────────────────────
  // Breadcrumb stack: [{type, id, label}]
  let drawerStack = [];

  function openDrawer() {
    fileDrawer.hidden = false;
    layout.classList.add("drawer-open");
  }
  function closeDrawer() {
    fileDrawer.hidden = true;
    layout.classList.remove("drawer-open");
    drawerData = null;
    allSymbols = [];
    drawerStack = [];
    renderDrawerBreadcrumb();
  }
  drawerClose.addEventListener("click", closeDrawer);

  function toggleHelp() {
    helpModal.hidden = !helpModal.hidden;
  }
  helpBtn.onclick = toggleHelp;
  helpClose.onclick = toggleHelp;
  helpModal.onclick = (e) => {
    if (e.target === helpModal) toggleHelp();
  };

  function renderDrawerBreadcrumb() {
    const bc = document.getElementById("drawer-breadcrumb");
    if (!bc) return;
    if (drawerStack.length === 0) {
      bc.hidden = true;
      return;
    }
    bc.hidden = false;
    bc.innerHTML = "";
    drawerStack.forEach((entry, i) => {
      const btn = document.createElement("button");
      btn.className = "bc-btn";
      btn.textContent = entry.label;
      btn.addEventListener("click", () => {
        drawerStack = drawerStack.slice(0, i);
        if (entry.type === "module") showModuleDrawer(entry.id, false);
        else showFileDrawer(entry.id, false);
      });
      bc.appendChild(btn);
      const sep = document.createElement("span");
      sep.className = "bc-sep";
      sep.textContent = "›";
      bc.appendChild(sep);
    });
    const cur = document.createElement("span");
    cur.className = "bc-cur";
    cur.textContent = drawerData ? drawerData.id.split("/").pop() : "";
    bc.appendChild(cur);
  }

  async function showModuleDrawer(moduleId, pushToStack = true, atDepth) {
    if (pushToStack && drawerData) {
      drawerStack.push({
        type: drawerData.type,
        id: drawerData.id,
        label: drawerData.id.split("/").pop(),
      });
    }
    drawerData = { type: "module", id: moduleId };
    const depth = atDepth ?? view.depth;
    const graph = getDepthGraph(depth);
    const node = graph.nodes.find((n) => n.id === moduleId);
    if (!node) return;

    drawerTitle.textContent = moduleId;
    drawerMeta.textContent = `${node.files} files · ${node.loc} loc · fan-in ${node.fanIn ?? 0} · fan-out ${node.fanOut ?? 0}`;
    drawerSymbols.innerHTML = "";
    drawerImports.innerHTML = "";
    symbolSearch.value = "";
    renderDrawerBreadcrumb();

    if (node.warn) {
      const isIsolated = node.isOrphan;
      drawerWarn.innerHTML = `<h4>⚠️ Architecture Alert</h4>
        <p><strong>What's the issue?</strong> ${node.warnMsg || "Circular dependency detected"}</p>
        <div class="alert-explanation" style="margin-top:12px; padding:12px; background:rgba(0,0,0,0.25); border-radius:8px; border-left:4px solid ${isIsolated ? "#fbbf24" : "#fb7185"}">
          <p style="font-size:0.95em; margin-bottom:8px; color:var(--foreground)"><strong>Simple Explanation:</strong></p>
          <p style="font-size:0.85em; line-height:1.5; color:var(--muted)">
            ${
              isIsolated
                ? "This folder is like an <strong>'Abandoned Island'</strong>. The code inside might be perfectly fine, but since no other part of your app is using it, it's just 'isolated'. If you aren't using it anymore, it might be safe to delete!"
                : "This is a <strong>'Tangled Knot'</strong>. These parts of your code are stuck in a loop (A needs B, B needs A). This makes it very hard to change things because a small fix in one place might loop back and break something else."
            }
          </p>
        </div>`;
      drawerWarn.hidden = false;
    } else {
      drawerWarn.hidden = true;
    }

    // Fetch file list for this module
    let filesData = { files: [] };
    try {
      filesData = await fetch(
        `/api/module/${encodeURIComponent(moduleId)}/files?depth=${depth}`,
      ).then((r) => r.json());
    } catch {}

    // Build file list
    drawerFiles.innerHTML = `<h4>Files in module</h4>`;

    // Prominent issue summary banner using node.fileIssues (already in graph data)
    const nodeFileIssues = node.fileIssues || {};
    const issueEntries = Object.entries(nodeFileIssues);
    const cycleFiles = issueEntries.filter(([, v]) => v.includes("cycle-bridge"));
    const deadFiles = issueEntries.filter(([, v]) => v.includes("dead-code"));
    if (issueEntries.length > 0) {
      const bannerEl = document.createElement("div");
      bannerEl.style.cssText =
        "margin-bottom:10px;padding:10px 12px;border-radius:8px;background:rgba(0,0,0,0.2);border-left:4px solid var(--rose,#fb7185);font-size:0.85em;line-height:1.6";
      const parts = [];
      if (cycleFiles.length)
        parts.push(
          `<span style="color:${TONE.rose}">⚠ ${cycleFiles.length} cycle bridge${cycleFiles.length > 1 ? "s" : ""}</span>`,
        );
      if (deadFiles.length)
        parts.push(
          `<span style="color:${TONE.amber}">☠ ${deadFiles.length} dead file${deadFiles.length > 1 ? "s" : ""}</span>`,
        );
      bannerEl.innerHTML = `<strong>Problematic files:</strong> ${parts.join(" · ")}`;
      drawerFiles.appendChild(bannerEl);
    }

    const fileListEl = document.createElement("div");
    fileListEl.className = "file-list";

    // Sort: cycle-bridge first, then dead-code, then clean
    const filesToShow = (filesData.files || []).slice().sort((a, b) => {
      const rank = (fd) => {
        const iss = fd.issues || nodeFileIssues[fd.path] || [];
        if (iss.includes("cycle-bridge")) return 0;
        if (iss.includes("dead-code")) return 1;
        return 2;
      };
      return rank(a) - rank(b);
    });
    filesToShow.forEach((fd) => {
      const p = fd.path;
      const item = document.createElement("div");
      item.className = "file-item";
      const locDisplay = fd.loc !== undefined ? fd.loc : "?";
      const symCount = (fd.symbols || []).length;
      const issues = fd.issues || nodeFileIssues[p] || [];

      // Check if it's a config/meta file to show a subtle hint
      const isConfig =
        p.toLowerCase().includes("config.") ||
        p.startsWith(".") ||
        p.toLowerCase() === "package.json";
      const configTag = isConfig
        ? `<span class="fi-meta" style="opacity:0.6;margin-right:4px">[Config]</span>`
        : "";

      let issueTag = "";
      let dotColor = "var(--muted)";
      if (issues.includes("cycle-bridge")) {
        issueTag = `<span class="fi-tag" style="background:${TONE.rose}33; color:${TONE.rose}; border: 1px solid ${TONE.rose}66; padding: 0 4px; border-radius: 4px; font-size: 10px; margin-right: 6px;">[Part of Cycle]</span>`;
        dotColor = TONE.rose;
        item.classList.add("fi-problem-cycle");
      } else if (issues.includes("dead-code")) {
        issueTag = `<span class="fi-tag" style="background:${TONE.amber}33; color:${TONE.amber}; border: 1px solid ${TONE.amber}66; padding: 0 4px; border-radius: 4px; font-size: 10px; margin-right: 6px;">[Dead File]</span>`;
        dotColor = TONE.amber;
        item.classList.add("fi-problem-dead");
      }

      item.innerHTML = `
        <span class="fi-dot" style="background:${dotColor}"></span>
        <span class="fi-path" title="${p}">${p}</span>
        <span class="fi-meta">${issueTag}${configTag}${locDisplay} loc · ${symCount} sym</span>
      `;
      item.addEventListener("click", () => showFileDrawer(p));
      fileListEl.appendChild(item);
    });
    if (node.files > filesToShow.length) {
      const more = document.createElement("div");
      more.className = "fi-meta dim";
      more.style.padding = "4px 8px";
      more.textContent = `+ ${node.files - filesToShow.length} more files`;
      fileListEl.appendChild(more);
    }
    drawerFiles.appendChild(fileListEl);
    openDrawer();
  }

  async function showFileDrawer(filePath, pushToStack = true) {
    if (pushToStack && drawerData) {
      drawerStack.push({
        type: drawerData.type,
        id: drawerData.id,
        label: drawerData.id.split("/").pop(),
      });
    }
    drawerData = { type: "file", id: filePath };
    let data = { path: filePath, imports: { specs: [], details: [] }, symbols: [], loc: 0 };
    try {
      data = await fetch(`/api/file/${encodeURIComponent(filePath)}`).then((r) => r.json());
    } catch {}

    drawerTitle.textContent = filePath;
    drawerMeta.textContent = `${data.loc} lines · ${data.symbols.length} symbols · ${data.imports.specs.length} imports`;

    drawerFiles.innerHTML = `
      <div class="drawer-help-box" style="margin: 0 8px 16px 8px; padding:12px; background:rgba(255,255,255,0.03); border-radius:8px; font-size:0.85em; border:1px solid rgba(255,255,255,0.05)">
        <strong style="color:var(--cyan)">Quick Guide:</strong><br/>
        <div style="margin-top:6px; line-height:1.4">
          • <strong>Symbols:</strong> Things defined <em>inside</em> this file (like functions).<br/>
          • <strong>Imports:</strong> Other files this file <em>needs</em> to work.
        </div>
      </div>
    `;
    drawerWarn.hidden = true;
    symbolSearch.value = "";
    allSymbols = data.symbols || [];
    renderDrawerBreadcrumb();

    renderSymbols(allSymbols);
    renderImports(data.imports.details || []);
    openDrawer();
  }

  function renderSymbols(symbols) {
    drawerSymbols.innerHTML = `<h4>Symbols (${symbols.length})</h4>`;
    if (!symbols.length) {
      drawerSymbols.innerHTML += `<div class="dim" style="font-size:11px;padding:4px 8px">No symbols found</div>`;
      return;
    }
    const list = document.createElement("div");
    list.className = "sym-list";
    symbols.forEach((s) => {
      const item = document.createElement("div");
      item.className = "sym-item";
      const badgeClass =
        s.type === "function"
          ? "fn"
          : s.type === "class"
            ? "cls"
            : s.type === "interface"
              ? "iface"
              : "type";
      const badgeLabel =
        s.type === "function"
          ? "fn"
          : s.type === "class"
            ? "cls"
            : s.type === "interface"
              ? "if"
              : "T";
      item.innerHTML = `<span class="sym-badge ${badgeClass}">${badgeLabel}</span><span class="sym-name">${s.name}</span><span class="sym-line"> (Line ${s.line})</span>`;
      list.appendChild(item);
    });
    drawerSymbols.appendChild(list);
  }

  function renderImports(details) {
    drawerImports.innerHTML = `<h4>Imports (${details.length})</h4>`;
    if (!details.length) {
      drawerImports.innerHTML += `<div class="dim" style="font-size:11px;padding:4px 8px">No imports</div>`;
      return;
    }
    const list = document.createElement("div");
    list.className = "imp-list";
    details.forEach((imp) => {
      const item = document.createElement("div");
      item.className = "imp-item";
      item.innerHTML = `<div class="imp-spec">${imp.spec}</div><div class="imp-line"> (Line ${imp.line}) · <span style="color:var(--muted)">${imp.statement.slice(0, 60)}${imp.statement.length > 60 ? "…" : ""}</span></div>`;
      list.appendChild(item);
    });
    drawerImports.appendChild(list);
  }

  // Symbol search filter
  symbolSearch.addEventListener("input", () => {
    const q = symbolSearch.value.trim().toLowerCase();
    const filtered = q ? allSymbols.filter((s) => s.name.toLowerCase().includes(q)) : allSymbols;
    renderSymbols(filtered);
  });

  // ── Global search (Ctrl+K / /) ────────────────────────────────
  let searchIdx = -1;
  let searchResults = [];

  function showSearchResults(results) {
    searchResults = results;
    searchIdx = -1;
    globalSearchResults.innerHTML = "";
    if (!results.length) {
      globalSearchResults.innerHTML = `<div class="sd-empty">No results</div>`;
      globalSearchResults.hidden = false;
      return;
    }
    results.forEach((r, i) => {
      const item = document.createElement("div");
      item.className = "sd-item";
      item.dataset.idx = String(i);
      item.innerHTML = `<span class="sd-path">${r.path}</span><span class="sd-meta">${r.ext} · ${r.loc} loc · ${r.importers} importers</span>`;
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        selectSearchResult(r);
      });
      globalSearchResults.appendChild(item);
    });
    globalSearchResults.hidden = false;
  }

  function selectSearchResult(r) {
    globalSearch.value = "";
    globalSearchResults.hidden = true;
    globalSearch.blur();
    showFileDrawer(r.path);
  }

  function updateSearchHighlight() {
    globalSearchResults.querySelectorAll(".sd-item").forEach((el, i) => {
      el.classList.toggle("active", i === searchIdx);
    });
  }

  globalSearch.addEventListener("input", async () => {
    const q = globalSearch.value.trim();
    if (!q) {
      globalSearchResults.hidden = true;
      return;
    }
    try {
      const data = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=30`).then((r) =>
        r.json(),
      );
      showSearchResults(data.results || []);
    } catch {}
  });

  globalSearch.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      searchIdx = Math.min(searchIdx + 1, searchResults.length - 1);
      updateSearchHighlight();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      searchIdx = Math.max(searchIdx - 1, 0);
      updateSearchHighlight();
    } else if (e.key === "Enter") {
      if (searchIdx >= 0 && searchResults[searchIdx]) selectSearchResult(searchResults[searchIdx]);
      else if (searchResults[0]) selectSearchResult(searchResults[0]);
    } else if (e.key === "Escape") {
      globalSearchResults.hidden = true;
      globalSearch.blur();
    }
  });

  globalSearch.addEventListener("blur", () => {
    setTimeout(() => {
      globalSearchResults.hidden = true;
    }, 150);
  });

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      globalSearch.focus();
      globalSearch.select();
    }
  });

  // ── Module click: drill-in or open drawer at max depth ────────
  function onModuleClick(moduleId) {
    if (view.depth < maxDepth) {
      const clickedDepth = view.depth;
      stack.push({ prefix: view.prefix, depth: view.depth });
      view.prefix = moduleId;
      view.depth = Math.min(maxDepth, view.depth + 1);
      depthSelect.value = String(view.depth);
      selected = moduleId;
      render();
      showModuleDrawer(moduleId, true, clickedDepth);
      return;
    }
    // At max depth: toggle selection + open drawer
    if (selected === moduleId) {
      selected = null;
      closeDrawer();
      render();
    } else {
      selected = moduleId;
      render();
      showModuleDrawer(moduleId);
    }
  }

  function filterModules(nodes) {
    const q = (moduleFilter.value || "").trim().toLowerCase();
    if (!q) return nodes;
    return nodes.filter((n) => n.label.toLowerCase().includes(q));
  }

  function sortModules(nodes) {
    const key = moduleSort.value;
    const copy = [...nodes];
    if (key === "name") copy.sort((a, b) => a.label.localeCompare(b.label));
    else if (key === "fanIn") copy.sort((a, b) => (b.fanIn || 0) - (a.fanIn || 0));
    else if (key === "fanOut") copy.sort((a, b) => (b.fanOut || 0) - (a.fanOut || 0));
    else copy.sort((a, b) => b.loc - a.loc);
    return copy;
  }

  function updateDetailPanel(graph) {
    if (!detailPanel) return;
    if (!selected) {
      detailPanel.textContent = "Click a module for details. Double-click to drill in.";
      detailPanel.className = "detail mono dim";
      return;
    }
    const n = graph.nodes.find((x) => x.id === selected);
    if (!n) {
      detailPanel.textContent = "—";
      return;
    }
    const lines = [
      n.label,
      "fan-in " + (n.fanIn ?? 0) + " · fan-out " + (n.fanOut ?? 0),
      "files " + n.files + " · loc " + n.loc,
      "",
    ];

    if (mapMode === "blast") {
      const blast = getBlastRadius(selected, graph);
      if (blast.size > 1) {
        lines.push("BLAST RADIUS (" + (blast.size - 1) + " affected):");
        const affected = Array.from(blast).filter((id) => id !== selected);
        affected.forEach((id) => {
          const m = graph.nodes.find((x) => x.id === id);
          if (m) lines.push("↳ " + m.label);
        });
      } else {
        lines.push("BLAST RADIUS: 0 modules affected");
      }
      lines.push("");
    }

    lines.push((n.pathsPreview || []).slice(0, 10).join("\n"));
    detailPanel.textContent = lines.join("\n");
    detailPanel.className = "detail mono";
  }

  // ── SVG helpers ───────────────────────────────────────────────
  const NS = "http://www.w3.org/2000/svg";
  function el(name, attrs = {}, children = []) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    children.forEach((c) => e.appendChild(c));
    return e;
  }

  // ── Render sidebar + canvas ───────────────────────────────────
  let lastFitKey = "";

  function render() {
    currentViewGraph = computeViewGraph();
    const graph = currentViewGraph;

    if (selected && !graph.nodes.some((n) => n.id === selected)) selected = null;

    stats.textContent = `${graph.stats.files} files · ${graph.stats.modules} modules · ${graph.stats.edges} edges · ${graph.stats.cycles} cycle(s) · ${(graph.stats.loc || 0).toLocaleString()} loc`;
    const rootShort = meta.root.split("/").slice(-2).join("/");
    hud.textContent = `~ ${rootShort}${view.prefix ? " · " + view.prefix : ""} · depth ${view.depth}/${maxDepth}`;

    moduleList.innerHTML = "";
    const blastSet = mapMode === "blast" ? getBlastRadius(selected, graph) : null;
    const sorted = sortModules(filterModules(graph.nodes));
    sorted.forEach((n) => {
      const item = document.createElement("div");
      item.className = "row" + (n.warn ? " warn" : "") + (selected === n.id ? " sel" : "");
      const dotColor = getModuleColor(n, mapMode, blastSet);
      item.innerHTML = `<span class="dot" style="background:${dotColor}"></span>
        <span class="name">${n.label}</span>
        <span class="num">${n.files}f · ${n.loc} · ⇣${n.fanIn ?? 0}</span>`;
      item.onclick = () => onModuleClick(n.id);
      moduleList.appendChild(item);
    });

    updateLegend();

    cycleList.innerHTML =
      graph.cycles.length === 0
        ? `<div class="dim mono" style="padding:6px 8px">none detected ✓</div>`
        : "";
    graph.cycles.slice(0, 8).forEach((cy) => {
      const item = document.createElement("div");
      item.className = "row warn";
      item.title = "Circular dependency cycle detected";
      item.innerHTML = `<span class="dot" style="background:${TONE.rose}"></span>
        <span class="name mono" style="font-size:11px">${cy.join(" → ")}</span>`;
      item.onclick = () => onModuleClick(cy[0]);
      cycleList.appendChild(item);
    });

    extList.innerHTML = "";
    (graph.topExternal || []).forEach((d) => {
      const item = document.createElement("div");
      item.className = "row";
      item.innerHTML = `<span class="dot" style="background:${TONE.violet}"></span>
        <span class="name mono" style="font-size:12px">${d.name}</span>
        <span class="num">${d.count}</span>`;
      extList.appendChild(item);
    });

    updateDetailPanel(graph);
    setBackButton();

    // Only re-fit when the graph structure changes (depth or prefix), not on selection clicks
    const fitKey = `${view.depth}:${view.prefix || ""}:${graph.nodes.length}`;
    if (fitKey !== lastFitKey) {
      lastFitKey = fitKey;
      fit(graph);
    }
    draw(graph);
  }

  // ── Insights & Files tabs ─────────────────────────────────────
  function fillTable(tbody, rows, cols) {
    tbody.innerHTML = "";
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      cols.forEach((c) => {
        const td = document.createElement("td");
        td.textContent = r[c] != null ? String(r[c]) : "—";
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  function renderInsights() {
    const ins = scan.insights;
    if (!ins) {
      document.getElementById("ins-summary").textContent = "No insights payload (rescan).";
      return;
    }
    const s = ins.summary;
    document.getElementById("ins-summary").innerHTML = [
      chip(s.files + " files"),
      chip((s.loc || 0).toLocaleString() + " loc"),
      chip(s.internalEdges + " internal edges"),
      chip(s.externalRefs + " ext. refs"),
      chip(s.uniquePackages + " packages"),
      chip(s.isolatedInternalFiles + " isolated files"),
    ].join("");
    fillTable(document.querySelector("#tbl-top-loc tbody"), ins.topFilesByLoc || [], [
      "path",
      "loc",
    ]);
    fillTable(document.querySelector("#tbl-imported tbody"), ins.topImported || [], [
      "path",
      "count",
      "loc",
    ]);
    fillTable(document.querySelector("#tbl-hubs tbody"), ins.hubs || [], [
      "path",
      "in",
      "out",
      "score",
    ]);
    fillTable(document.querySelector("#tbl-zero tbody"), ins.zeroInternalImporters || [], [
      "path",
      "loc",
      "internalExports",
    ]);

    // Make insight table rows clickable → open file drawer
    ["#tbl-top-loc", "#tbl-imported", "#tbl-hubs", "#tbl-zero"].forEach((sel) => {
      const tbody = document.querySelector(sel + " tbody");
      if (!tbody) return;
      tbody.addEventListener("click", (e) => {
        const tr = e.target.closest("tr");
        if (!tr) return;
        const pathCell = tr.querySelector("td");
        if (pathCell) showFileDrawer(pathCell.textContent);
      });
    });
  }

  function chip(t, color) {
    const style = color ? ` style="color:${color};border-color:${color}33"` : "";
    return `<span class="chip"${style}>${t}</span>`;
  }

  function renderFilesTable() {
    const ins = scan.insights;
    const hint = document.getElementById("files-trunc");
    if (!ins || !ins.filesIndex) {
      hint.textContent = "";
      document.querySelector("#tbl-files tbody").innerHTML = "";
      return;
    }
    hint.textContent = ins.filesIndexTruncated
      ? "Showing top " + ins.filesIndexCap + " files by LOC (truncated)."
      : "All scanned files listed.";
    const q = (fileFilter.value || "").trim().toLowerCase();
    const rows = q
      ? ins.filesIndex.filter((r) => r.path.toLowerCase().includes(q))
      : ins.filesIndex;
    fillTable(document.querySelector("#tbl-files tbody"), rows.slice(0, 800), [
      "path",
      "ext",
      "loc",
      "importers",
      "importees",
    ]);

    // Make file rows clickable → open file drawer
    const tbody = document.querySelector("#tbl-files tbody");
    if (tbody) {
      tbody.addEventListener("click", (e) => {
        const tr = e.target.closest("tr");
        if (!tr) return;
        const pathCell = tr.querySelector("td");
        if (pathCell) showFileDrawer(pathCell.textContent);
      });
    }
  }

  fileFilter.addEventListener("input", () => {
    if (activeTab === "files") renderFilesTable();
  });

  // ── Fit & Draw ────────────────────────────────────────────────
  function fit(graph) {
    if (!graph.nodes.length) return;
    const xs = graph.nodes.map((n) => n.x),
      ys = graph.nodes.map((n) => n.y);
    const minX = Math.min(...xs) - 80,
      maxX = Math.max(...xs) + 280;
    const minY = Math.min(...ys) - 80,
      maxY = Math.max(...ys) + 180;
    const w = svg.clientWidth,
      h = svg.clientHeight;
    const k = Math.min(w / (maxX - minX), h / (maxY - minY), 1.2);
    view.k = k;
    view.x = (w - (maxX - minX) * k) / 2 - minX * k;
    view.y = (h - (maxY - minY) * k) / 2 - minY * k;
  }

  function draw(graph) {
    svg.innerHTML = "";
    const defs = el("defs");
    defs.innerHTML = `
      <linearGradient id="node-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="oklch(0.21 0.022 265)" stop-opacity="0.97"/>
        <stop offset="1" stop-color="oklch(0.14 0.017 265)" stop-opacity="0.97"/>
      </linearGradient>
      <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="currentColor" opacity="0.5"/>
      </marker>
    `;
    svg.appendChild(defs);
    const rootG = el("g", { transform: `translate(${view.x} ${view.y}) scale(${view.k})` });
    svg.appendChild(rootG);

    const NW = 220,
      NH = 70;

    // Find max LOC for scaling
    const maxLoc = Math.max(...graph.nodes.map((n) => n.loc), 1);

    // Activity / Blast state
    const now = Date.now() / 1000;
    const oneWeek = 7 * 24 * 3600;

    let blastSet = mapMode === "blast" ? getBlastRadius(selected, graph) : new Set();

    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    const incidentToSelected = new Set();
    if (selected) {
      graph.edges.forEach((e) => {
        if (e.source === selected || e.target === selected) incidentToSelected.add(e.id);
      });
    }

    const edgesG = el("g");
    graph.edges.forEach((e) => {
      const a = byId.get(e.source),
        b = byId.get(e.target);
      if (!a || !b) return;

      // Get source/target node dimensions
      const aW = NW + Math.min(60, (a.loc / maxLoc) * 100);
      const aH = NH + Math.min(40, (a.loc / maxLoc) * 60);
      const bH = NH + Math.min(40, (b.loc / maxLoc) * 60);

      const x1 = a.x + aW,
        y1 = a.y + aH / 2;
      const x2 = b.x,
        y2 = b.y + bH / 2;
      const cx = (x1 + x2) / 2;
      const d = `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`;
      const cls = ["edge"];
      if (a.warn || b.warn) cls.push("warn");
      if (e.weight >= 3) cls.push("hot", "animated");
      else cls.push("animated");
      if (selected && !incidentToSelected.has(e.id)) cls.push("dim");
      const pathEl = el("path", {
        d,
        class: cls.join(" "),
        "marker-end": "url(#arrow)",
        style: `color:${a.warn || b.warn ? TONE.rose : TONE.cyan}; stroke:${a.warn || b.warn ? TONE.rose : TONE.cyan}`,
      });
      // Edge tooltip on hover
      pathEl.addEventListener("mouseenter", (ev) => {
        showEdgeTooltip(ev, e, a, b);
      });
      pathEl.addEventListener("mousemove", (ev) => {
        positionEdgeTooltip(ev);
      });
      pathEl.addEventListener("mouseleave", () => {
        edgeTooltip.hidden = true;
      });
      // Click edge to show import details
      pathEl.addEventListener("click", (ev) => {
        ev.stopPropagation();
        showEdgeDetails(e, a, b);
      });
      const tEl = el("title");
      tEl.textContent = (e.weight || 1) + " import edge(s): " + e.source + " → " + e.target;
      pathEl.appendChild(tEl);
      edgesG.appendChild(pathEl);
    });
    rootG.appendChild(edgesG);

    const barMax = Math.max(...graph.nodes.map((m) => m.loc), 1);

    graph.nodes.forEach((n) => {
      const g = el("g", { class: "node-group", transform: `translate(${n.x} ${n.y})` });
      g.dataset.id = n.id;
      g.dataset.moved = "0";

      const accentColor = getModuleColor(n, mapMode, blastSet);

      // Scaling based on LOC
      const extraW = Math.min(60, (n.loc / maxLoc) * 100);
      const extraH = Math.min(40, (n.loc / maxLoc) * 60);
      const curW = NW + extraW;
      const curH = NH + extraH;

      const dimmed =
        selected &&
        selected !== n.id &&
        !graph.edges.some(
          (e) =>
            (e.source === selected && e.target === n.id) ||
            (e.target === selected && e.source === n.id),
        );
      g.setAttribute("opacity", dimmed ? "0.35" : "1");
      if (dimmed) g.style.filter = "grayscale(0.5) blur(0.5px)";
      else g.style.filter = "none";

      const pct = Math.round((n.loc / barMax) * 100);
      const labelTxt = n.label.length > 26 ? n.label.slice(0, 24) + "…" : n.label;
      const subTxt = (n.sub ?? "") + " · ⇣" + (n.fanIn ?? 0) + " ⇡" + (n.fanOut ?? 0);

      const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
      fo.setAttribute("x", 0);
      fo.setAttribute("y", 0);
      fo.setAttribute("width", curW);
      fo.setAttribute("height", curH);

      const card = document.createElement("div");
      card.className = "node-fo";
      card.style.borderColor = accentColor.slice(0, -1) + " / 0.45)";

      const warnTooltipMsg = n.warnMsg || "Circular dependency detected";
      const warnTip = n.isOrphan
        ? 'This is an "Isolated Island" — it\'s not connected to the rest of your app.'
        : 'This is a "Tangled Knot" — circular connections make the code harder to maintain.';

      card.innerHTML = `
        <div class="node-fo-top" style="background:linear-gradient(90deg,transparent,${accentColor},transparent)"></div>
        <div class="node-fo-inner">
          <div class="node-fo-label">${labelTxt}</div>
          <div class="node-fo-sub">${subTxt}</div>
          <div class="node-fo-bar-bg"><div class="node-fo-bar" style="width:${pct}%;background:${accentColor}"></div></div>
        </div>
        ${n.warn ? `<div class="node-fo-badge node-fo-badge-hover" data-warn="${warnTooltipMsg.replace(/"/g, "&#34;")}" data-tip="${warnTip.replace(/"/g, "&#34;")}">!</div>` : ""}
        ${view.depth === maxDepth ? `<div style="position:absolute;bottom:7px;right:9px;font-size:9px;opacity:0.45;color:${accentColor};pointer-events:none">⊕</div>` : ""}
      `;

      // Wire warn badge tooltip
      if (n.warn) {
        const badgeEl = card.querySelector(".node-fo-badge-hover");
        if (badgeEl) {
          badgeEl.addEventListener("mouseenter", (ev) => {
            ev.stopPropagation();
            edgeTooltip.innerHTML = `
              <div class="et-title">⚠️ Architecture Warning</div>
              <div class="et-line"><strong>Problem:</strong> ${warnTooltipMsg}</div>
              <div class="et-line" style="margin-top:8px; opacity:0.9; font-size:11px; line-height:1.4">
                <em>Tip: ${warnTip}</em>
              </div>
            `;
            edgeTooltip.hidden = false;
            positionEdgeTooltip(ev);
          });
          badgeEl.addEventListener("mousemove", (ev) => positionEdgeTooltip(ev));
          badgeEl.addEventListener("mouseleave", () => {
            edgeTooltip.hidden = true;
          });
        }
      }

      fo.appendChild(card);
      g.appendChild(fo);

      makeDraggable(g, n);
      g.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (g.dataset.moved === "1") {
          g.dataset.moved = "0";
          return;
        }
        onModuleClick(n.id);
      });

      rootG.appendChild(g);
    });

    drawMinimap(graph);
  }

  // ── Edge tooltip ──────────────────────────────────────────────
  function showEdgeTooltip(ev, edge, a, b) {
    edgeTooltip.innerHTML = `
      <div class="et-title">${edge.weight || 1} import(s)</div>
      <div class="et-line">${a.id} → ${b.id}</div>
    `;
    edgeTooltip.hidden = false;
    positionEdgeTooltip(ev);
  }

  function positionEdgeTooltip(ev) {
    const rect = svg.getBoundingClientRect();
    const x = ev.clientX - rect.left + 12;
    const y = ev.clientY - rect.top - 10;
    edgeTooltip.style.left = Math.min(x, rect.width - 300) + "px";
    edgeTooltip.style.top = Math.max(0, y) + "px";
  }

  async function showEdgeDetails(edge, a, b) {
    // Open drawer showing import details between two modules
    if (drawerData) {
      drawerStack.push({
        type: drawerData.type,
        id: drawerData.id,
        label: drawerData.id.split("/").pop(),
      });
    }
    drawerData = { type: "edge", id: `${a.id}→${b.id}` };
    drawerTitle.textContent = `${a.id} → ${b.id}`;
    drawerMeta.textContent = `${edge.weight || 1} import connection(s)`;
    drawerFiles.innerHTML = `<h4>Connection</h4><div class="dim" style="font-size:11px;padding:4px 8px">Click a file to explore its imports</div>`;
    drawerSymbols.innerHTML = "";
    drawerImports.innerHTML = "";
    allSymbols = [];
    renderDrawerBreadcrumb();

    // Show files from source module
    const srcFiles = a.pathsPreview || [];
    if (srcFiles.length) {
      const h = document.createElement("h4");
      h.textContent = `Files in ${a.id}`;
      drawerFiles.appendChild(h);
      const list = document.createElement("div");
      list.className = "file-list";
      srcFiles.forEach((p) => {
        const item = document.createElement("div");
        item.className = "file-item";
        item.innerHTML = `<span class="fi-dot"></span><span class="fi-path" title="${p}">${p}</span>`;
        item.addEventListener("click", () => showFileDrawer(p));
        list.appendChild(item);
      });
      drawerFiles.appendChild(list);
    }
    openDrawer();
  }

  // ── Minimap ───────────────────────────────────────────────────
  function drawMinimap(graph) {
    let mm = document.querySelector(".minimap");
    if (!mm) {
      mm = document.createElement("div");
      mm.className = "minimap";
      document.querySelector(".canvas-wrap").appendChild(mm);
    }
    if (!graph.nodes.length) {
      mm.innerHTML = "";
      return;
    }

    const W = 140,
      H = 90;
    const xs = graph.nodes.map((n) => n.x),
      ys = graph.nodes.map((n) => n.y);
    const minX = Math.min(...xs) - 20,
      maxX = Math.max(...xs) + 240;
    const minY = Math.min(...ys) - 20,
      maxY = Math.max(...ys) + 90;
    const scaleX = W / (maxX - minX || 1),
      scaleY = H / (maxY - minY || 1);
    const sc = Math.min(scaleX, scaleY);

    const svgEl = document.createElementNS(NS, "svg");
    svgEl.setAttribute("viewBox", `0 0 ${W} ${H}`);

    // Draw edges
    graph.edges.slice(0, 80).forEach((e) => {
      const a = graph.nodes.find((n) => n.id === e.source);
      const b = graph.nodes.find((n) => n.id === e.target);
      if (!a || !b) return;
      const line = document.createElementNS(NS, "line");
      line.setAttribute("x1", (a.x - minX) * sc);
      line.setAttribute("y1", (a.y - minY) * sc);
      line.setAttribute("x2", (b.x - minX) * sc);
      line.setAttribute("y2", (b.y - minY) * sc);
      line.setAttribute("stroke", "rgba(103,232,249,0.2)");
      line.setAttribute("stroke-width", "0.5");
      svgEl.appendChild(line);
    });

    // Draw nodes
    graph.nodes.forEach((n) => {
      const rect = document.createElementNS(NS, "rect");
      const extraW = Math.min(
        60,
        (n.loc / Math.max(...graph.nodes.map((node) => node.loc), 1)) * 100,
      );
      const extraH = Math.min(
        40,
        (n.loc / Math.max(...graph.nodes.map((node) => node.loc), 1)) * 60,
      );
      const curW = 220 + extraW;
      const curH = 70 + extraH;

      rect.setAttribute("x", (n.x - minX) * sc);
      rect.setAttribute("y", (n.y - minY) * sc);
      rect.setAttribute("width", Math.max(4, curW * sc));
      rect.setAttribute("height", Math.max(2, curH * sc));
      rect.setAttribute("rx", 2);
      rect.setAttribute("fill", n.id === selected ? "#67e8f9" : "rgba(103,232,249,0.25)");
      svgEl.appendChild(rect);
    });

    mm.innerHTML = "";
    mm.appendChild(svgEl);
  }

  // ── Drag nodes ────────────────────────────────────────────────
  function makeDraggable(g, n) {
    let dragging = false,
      startX,
      startY,
      origX,
      origY,
      moved = false;
    g.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      dragging = true;
      moved = false;
      g.dataset.moved = "0";
      startX = e.clientX;
      startY = e.clientY;
      origX = n.x;
      origY = n.y;
      g.setPointerCapture(e.pointerId);
    });
    g.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = (e.clientX - startX) / view.k;
      const dy = (e.clientY - startY) / view.k;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      g.dataset.moved = moved ? "1" : "0";
      n.x = origX + dx;
      n.y = origY + dy;
      g.setAttribute("transform", `translate(${n.x} ${n.y})`);
      if (currentViewGraph) draw(currentViewGraph);
    });
    g.addEventListener("pointerup", (e) => {
      dragging = false;
      try {
        g.releasePointerCapture(e.pointerId);
      } catch {}
      if (moved) e.stopPropagation();
    });
  }

  // ── Pan & zoom ────────────────────────────────────────────────
  let panning = false,
    px,
    py;
  svg.addEventListener("pointerdown", (e) => {
    panning = true;
    px = e.clientX;
    py = e.clientY;
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener("pointermove", (e) => {
    if (!panning) return;
    view.x += e.clientX - px;
    view.y += e.clientY - py;
    px = e.clientX;
    py = e.clientY;
    if (currentViewGraph) draw(currentViewGraph);
  });
  svg.addEventListener("pointerup", (e) => {
    panning = false;
    try {
      svg.releasePointerCapture(e.pointerId);
    } catch {}
  });
  svg.addEventListener("click", () => {
    if (selected) {
      selected = null;
      closeDrawer();
      render();
    }
  });
  svg.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const mx = e.clientX - rect.left,
        my = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const nk = Math.min(2.5, Math.max(0.25, view.k * factor));
      view.x = mx - (mx - view.x) * (nk / view.k);
      view.y = my - (my - view.y) * (nk / view.k);
      view.k = nk;
      if (currentViewGraph) draw(currentViewGraph);
    },
    { passive: false },
  );

  // ── Toolbar buttons ───────────────────────────────────────────
  document.getElementById("fit").onclick = () => {
    if (currentViewGraph) {
      fit(currentViewGraph);
      draw(currentViewGraph);
    }
  };

  if (backBtn) {
    backBtn.onclick = () => {
      if (stack.length === 0) return;
      const prev = stack.pop();
      view.prefix = prev.prefix;
      view.depth = prev.depth;
      depthSelect.value = String(view.depth);
      selected = null;
      closeDrawer();
      render();
    };
  }

  async function loadGraph(fromButton) {
    if (fromButton) stats.textContent = "rescanning…";
    const r = fromButton
      ? await fetch("/api/rescan", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ maxDepth: Number(depthSelect.value) || maxDepth }),
        }).then((x) => x.json())
      : await fetch("/api/graph").then((x) => x.json());
    if (r.error) {
      stats.textContent = "rescan failed: " + r.error;
      return;
    }
    scan = r;
    graphsByDepth = scan.graphsByDepth || { 1: scan };
    maxDepth = scan.maxDepth ?? Math.max(1, ...Object.keys(graphsByDepth).map((k) => Number(k)));
    lastGeneratedAt = scan.generatedAt;
    view = { x: 0, y: 0, k: 1, depth: Math.min(view.depth, maxDepth), prefix: null };
    depthSelect.value = String(view.depth);
    selected = null;
    stack = [];
    fillDepthSelect();
    depthSelect.value = String(view.depth);
    closeDrawer();
    lastFitKey = "";
    render();
    if (activeTab === "insights") renderInsights();
    if (activeTab === "files") renderFilesTable();
  }

  document.getElementById("reload").onclick = () => loadGraph(true);

  document.getElementById("export").onclick = () => {
    const blob = new Blob([JSON.stringify(scan, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "reality-map-scan.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ── Keyboard shortcuts ────────────────────────────────────────
  document.addEventListener("keydown", (e) => {
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") {
      if (e.key === "Escape") {
        e.target.blur();
        globalSearchResults.hidden = true;
      }
      return;
    }
    if (e.key === "/" && activeTab === "map") {
      e.preventDefault();
      moduleFilter.focus();
    }
    if (e.key === "f" || e.key === "F") {
      if (currentViewGraph) {
        fit(currentViewGraph);
        draw(currentViewGraph);
      }
    }
    if (e.key === "r" || e.key === "R") loadGraph(true);
    if (e.key === "h" || e.key === "H") toggleHelp();
    if (e.key === "Escape") {
      if (!helpModal.hidden) {
        toggleHelp();
        return;
      }
      closeDrawer();
      selected = null;
      render();
    }
  });

  window.addEventListener("resize", () => {
    if (!currentViewGraph) return;
    fit(currentViewGraph);
    draw(currentViewGraph);
  });

  // ── Watch mode auto-refresh ───────────────────────────────────
  if (meta.watch) {
    setInterval(async () => {
      try {
        const m = await fetch("/api/meta").then((r) => r.json());
        if (m.generatedAt && m.generatedAt !== lastGeneratedAt) {
          lastGeneratedAt = m.generatedAt;
          await loadGraph(false);
        }
      } catch {}
    }, 3200);
  }

  // ── Health tab ────────────────────────────────────────────────
  async function renderHealth() {
    const wrap = document.getElementById("health-score-wrap");
    const reasonsEl = document.getElementById("health-reasons");
    wrap.innerHTML = "<span class='dim'>Loading…</span>";
    reasonsEl.innerHTML = "";

    let h;
    try {
      h = await fetch("/api/health").then((r) => r.json());
    } catch {
      wrap.innerHTML = "<span class='dim'>Failed to load health data.</span>";
      return;
    }

    const scoreColor = h.score >= 80 ? "#6ee7b7" : h.score >= 60 ? "#fbbf24" : "#fb7185";
    const circumference = 2 * Math.PI * 50;
    const offset = circumference - (h.score / 100) * circumference;
    const gradeLabel =
      { A: "Excellent", B: "Good", C: "Fair", D: "Poor", F: "Critical" }[h.grade] || "";

    wrap.innerHTML = `
      <div class="health-ring">
        <svg viewBox="0 0 120 120">
          <circle class="health-ring-bg" cx="60" cy="60" r="50"/>
          <circle class="health-ring-fill" cx="60" cy="60" r="50"
            stroke="${scoreColor}"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${offset}"/>
        </svg>
        <div class="health-ring-label">
          <span class="health-score-num" style="color:${scoreColor}">${h.score}</span>
          <span class="health-score-grade">${h.grade}</span>
        </div>
      </div>
      <div class="health-info">
        <h3 style="color:${scoreColor}">Grade ${h.grade} — ${gradeLabel}</h3>
        <p>${h.score}/100 · ${h.reasons.length === 0 ? "No issues detected. Your codebase is clean." : h.reasons.length + " issue(s) found"}</p>
        <p style="margin-top:8px;font-size:12px;color:var(--muted)">Copy this badge for your README:</p>
        <code style="font-size:11px;color:var(--cyan);background:rgba(0,0,0,0.3);padding:4px 8px;border-radius:6px;display:inline-block;margin-top:4px;cursor:pointer" id="badge-copy">
          ![Health ${h.score}/100](https://img.shields.io/badge/health-${h.score}%2F100-${h.score >= 80 ? "brightgreen" : h.score >= 60 ? "yellow" : "red"})
        </code>
      </div>
    `;

    document.getElementById("badge-copy")?.addEventListener("click", () => {
      navigator.clipboard?.writeText(
        `![Health ${h.score}/100](https://img.shields.io/badge/health-${h.score}%2F100-${h.score >= 80 ? "brightgreen" : h.score >= 60 ? "yellow" : "red"})`,
      );
    });

    if (h.reasons.length === 0) {
      reasonsEl.innerHTML = `<div class="health-ok">✓ No issues detected — your architecture is clean!</div>`;
      return;
    }

    const icons = { cycles: "🔄", isolated: "🏝", oversized: "📦", hubs: "🕸" };
    h.reasons.forEach((r) => {
      const div = document.createElement("div");
      div.className = "health-reason";
      div.innerHTML = `
        <span class="health-reason-icon">${icons[r.kind] || "⚠️"}</span>
        <div class="health-reason-body">
          <div class="health-reason-msg">${r.msg}</div>
          ${
            r.samples
              ? `<div class="health-reason-detail">${r.samples
                  .slice(0, 3)
                  .map((s) => s.path || s)
                  .join(" · ")}</div>`
              : ""
          }
        </div>
        <span class="health-penalty">−${r.penalty} pts</span>
      `;
      reasonsEl.appendChild(div);
    });
  }

  // ── Impact tab ────────────────────────────────────────────────
  document.getElementById("impact-run")?.addEventListener("click", runImpactAnalysis);
  document.getElementById("impact-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) runImpactAnalysis();
  });

  async function runImpactAnalysis() {
    const input = document.getElementById("impact-input");
    const result = document.getElementById("impact-result");
    const paths = (input.value || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!paths.length) return;

    result.innerHTML = `<div class="impact-empty">Analyzing…</div>`;
    let data;
    try {
      data = await fetch("/api/impact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paths }),
      }).then((r) => r.json());
    } catch {
      result.innerHTML = `<div class="impact-empty">Analysis failed.</div>`;
      return;
    }

    if (data.error) {
      result.innerHTML = `<div class="impact-empty">Error: ${data.error}</div>`;
      return;
    }

    const riskClass = data.riskLevel;
    result.innerHTML = "";

    // Summary bar
    const bar = document.createElement("div");
    bar.className = "impact-summary-bar";
    bar.innerHTML = `
      <span class="impact-risk-badge ${riskClass}">${riskClass} risk</span>
      <span class="impact-stat"><strong>${data.totalAffected}</strong> files affected</span>
      <span class="impact-stat"><strong>${data.directCount}</strong> direct</span>
      <span class="impact-stat"><strong>${data.transitiveCount}</strong> transitive</span>
    `;
    result.appendChild(bar);

    if (data.totalAffected === 0) {
      const empty = document.createElement("div");
      empty.className = "impact-empty";
      empty.textContent = "No affected files found. These files may not be imported by anything.";
      result.appendChild(empty);
      return;
    }

    // Module impact chips
    if (data.moduleImpact?.length) {
      const modWrap = document.createElement("div");
      modWrap.innerHTML = `<div style="font-size:11px;color:var(--muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.1em">Affected modules</div>`;
      const chips = document.createElement("div");
      chips.className = "impact-modules";
      data.moduleImpact.forEach((m) => {
        const cls = m.maxRisk >= 7 ? "risk-high" : m.maxRisk >= 4 ? "risk-med" : "risk-low";
        const chip = document.createElement("span");
        chip.className = `impact-mod-chip ${cls}`;
        chip.textContent = `${m.module} (${m.files} files)`;
        chips.appendChild(chip);
      });
      modWrap.appendChild(chips);
      result.appendChild(modWrap);
    }

    // Affected files table
    const tableWrap = document.createElement("div");
    tableWrap.className = "table-wrap tall";
    tableWrap.innerHTML = `
      <table class="data-table">
        <thead><tr><th>File</th><th title="Distance from the changed file (Steps away)">Steps Away (Depth)</th><th>LOC</th><th>Risk</th></tr></thead>
        <tbody>${data.affected
          .map(
            (f) => `
          <tr>
            <td style="color:${f.direct ? "var(--cyan)" : "var(--fg)"}">${f.path}${f.direct ? " <span style='color:var(--muted);font-size:10px'>direct</span>" : ""}</td>
            <td>${f.depth}</td>
            <td>${f.loc}</td>
            <td><span style="color:${f.risk >= 7 ? "var(--rose)" : f.risk >= 4 ? "var(--amber)" : "var(--emerald)"};font-weight:600">${f.risk}/10</span></td>
          </tr>`,
          )
          .join("")}
        </tbody>
      </table>
    `;
    result.appendChild(tableWrap);

    // Make rows clickable
    tableWrap.querySelectorAll("tbody tr").forEach((tr, i) => {
      tr.style.cursor = "pointer";
      tr.addEventListener("click", () => {
        setTab("map");
        showFileDrawer(data.affected[i].path);
      });
    });
  }

  // ── Dead code tab ─────────────────────────────────────────────
  document.getElementById("deadcode-refresh")?.addEventListener("click", renderDeadCode);

  async function renderDeadCode() {
    const summary = document.getElementById("deadcode-summary");
    const tbody = document.querySelector("#tbl-deadcode tbody");
    summary.innerHTML = "<span class='dim'>Loading…</span>";
    tbody.innerHTML = "";

    let data;
    try {
      data = await fetch("/api/deadcode").then((r) => r.json());
    } catch {
      summary.innerHTML = "<span class='dim'>Failed to load.</span>";
      return;
    }

    summary.innerHTML = [
      chip(`${data.totalFiles} total files`),
      chip(`${data.candidateCount} candidates`),
      chip(`~${data.potentialLocSavings} LOC potentially removable`),
    ].join("");

    tbody.innerHTML = "";
    (data.candidates || []).forEach((f) => {
      const tr = document.createElement("tr");
      const confClass = f.confidence >= 80 ? "high" : f.confidence < 50 ? "low" : "";
      tr.innerHTML = `
        <td style="cursor:pointer;color:var(--cyan)">${f.path}</td>
        <td>${f.loc}</td>
        <td>${f.outgoing}</td>
        <td>
          <div class="confidence-bar">
            <div class="confidence-fill ${confClass}" style="width:${f.confidence}px;max-width:80px"></div>
            <span style="font-size:10px;color:var(--muted)">${f.confidence}%</span>
          </div>
        </td>
        <td style="color:var(--muted);font-size:11px">${f.reason}</td>
      `;
      tr.querySelector("td").addEventListener("click", () => {
        setTab("map");
        showFileDrawer(f.path);
      });
      tbody.appendChild(tr);
    });
  }

  // ── Dependency intelligence tab ───────────────────────────────
  document.getElementById("deps-refresh")?.addEventListener("click", () => renderDeps(true));

  let _depsCache = null;

  function depsRiskColor(score) {
    if (score >= 7) return "var(--rose)";
    if (score >= 4) return "var(--amber)";
    if (score >= 1) return "oklch(0.82 0.16 75 / 0.7)";
    return "var(--emerald)";
  }

  function depsSeverityBadge(sev) {
    const colors = { critical: "var(--rose)", high: "var(--amber)", moderate: "oklch(0.82 0.16 75 / 0.7)", low: "var(--muted)" };
    const c = colors[sev] || colors.low;
    return `<span style="font-size:10px;color:${c};font-weight:600;text-transform:uppercase">${sev}</span>`;
  }

  function depsStatusBadges(pkg) {
    const badges = [];
    if (pkg.vulnerabilities.length) {
      const o = ["low", "moderate", "high", "critical"];
      const top = pkg.vulnerabilities.reduce((a, b) => o.indexOf(b.severity) > o.indexOf(a.severity) ? b : a, pkg.vulnerabilities[0]);
      badges.push(depsSeverityBadge(top.severity));
    }
    if (pkg.isDeprecated)  badges.push(`<span style="font-size:10px;color:oklch(0.72 0.19 295);font-weight:600">deprecated</span>`);
    if (pkg.isUnused)      badges.push(`<span style="font-size:10px;color:var(--muted);font-weight:600">unused</span>`);
    if (pkg.isConfigOnly)  badges.push(`<span style="font-size:10px;color:var(--muted)">config-only</span>`);
    if (pkg.outdatedSeverity === "major")
      badges.push(`<span style="font-size:10px;color:var(--amber);font-weight:600">outdated (major)</span>`);
    else if (pkg.outdatedSeverity === "minor")
      badges.push(`<span style="font-size:10px;color:var(--muted);font-weight:600">outdated (minor)</span>`);
    else if (pkg.outdatedSeverity === "patch")
      badges.push(`<span style="font-size:10px;color:var(--muted)">outdated (patch)</span>`);
    return badges.join(" ");
  }

  function openPkgDrawer(pkg) {
    const drawer = document.getElementById("pkg-drawer");
    const title  = document.getElementById("pkg-drawer-title");
    const meta   = document.getElementById("pkg-drawer-meta");
    const body   = document.getElementById("pkg-drawer-body");
    if (!drawer) return;

    title.textContent = pkg.name;
    meta.textContent  = `${pkg.type === "devDep" ? "devDependency" : "dependency"} · declared ${pkg.declaredRange}`;

    const rows = [];
    if (pkg.installedVersion) rows.push(`<div class="drawer-kv"><span class="dim">installed</span><span>${pkg.installedVersion}</span></div>`);
    if (pkg.outdatedInfo?.latest) rows.push(`<div class="drawer-kv"><span class="dim">latest</span><span style="color:${pkg.outdatedInfo.current !== pkg.outdatedInfo.latest ? "var(--amber)" : "var(--emerald)"}">${pkg.outdatedInfo.latest}</span></div>`);
    rows.push(`<div class="drawer-kv"><span class="dim">risk score</span><span style="color:${depsRiskColor(pkg.riskScore)};font-weight:700">${pkg.riskScore}/10</span></div>`);
    rows.push(`<div class="drawer-kv"><span class="dim">import count</span><span>${pkg.importCount}</span></div>`);
    if (pkg.description) rows.push(`<div class="drawer-kv"><span class="dim">description</span><span style="color:var(--muted);font-size:11px">${pkg.description}</span></div>`);

    let html = `<div class="drawer-section">${rows.join("")}</div>`;

    if (pkg.isDeprecated) {
      html += `<div class="drawer-section warn-box" style="display:block">
        <strong style="color:oklch(0.72 0.19 295)">⚠ Deprecated</strong>
        <div style="margin-top:4px;font-size:11px;color:var(--muted)">${pkg.deprecationMessage || "This package is deprecated."}</div>
      </div>`;
    }

    if (pkg.vulnerabilities.length) {
      html += `<div class="drawer-section">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">Vulnerabilities (${pkg.vulnerabilities.length})</div>
        ${pkg.vulnerabilities.map(v => `
          <div style="padding:8px 0;border-bottom:1px solid var(--border)">
            ${depsSeverityBadge(v.severity)}
            <div style="margin-top:3px;font-size:12px">${v.title}</div>
            ${v.url ? `<a href="${v.url}" target="_blank" rel="noopener" style="font-size:10px;color:var(--cyan)">${v.url}</a>` : ""}
          </div>`).join("")}
      </div>`;
    }

    if (pkg.importingFiles.length) {
      html += `<div class="drawer-section">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">Importing files (${pkg.importingFiles.length})</div>
        ${pkg.importingFiles.map(f => `<div style="font-size:11px;color:var(--cyan);padding:2px 0;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" class="dep-file-link" data-path="${f}">${f}</div>`).join("")}
      </div>`;
    } else if (pkg.isUnused) {
      html += `<div class="drawer-section"><div class="dim" style="font-size:12px">No source files import this package.</div></div>`;
    }

    body.innerHTML = html;
    drawer.hidden = false;

    body.querySelectorAll(".dep-file-link").forEach(el => {
      el.addEventListener("click", () => {
        drawer.hidden = true;
        setTab("map");
        showFileDrawer(el.dataset.path);
      });
    });
  }

  document.getElementById("pkg-drawer-close")?.addEventListener("click", () => {
    document.getElementById("pkg-drawer").hidden = true;
  });

  async function renderDeps(forceRefresh = false) {
    const summary     = document.getElementById("deps-summary");
    const tbody       = document.querySelector("#tbl-deps tbody");
    const ecosystem   = document.getElementById("deps-ecosystem");
    const auditNotice = document.getElementById("deps-audit-notice");
    if (!summary || !tbody) return;

    if (!_depsCache || forceRefresh) {
      summary.innerHTML = "";
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;padding:56px 0">
            <div style="display:flex;flex-direction:column;align-items:center;gap:14px">
              <div class="deps-spinner"></div>
              <div style="color:var(--muted);font-size:13px">Analyzing dependencies…</div>
              <div style="color:var(--muted);font-size:11px;opacity:0.6">Running npm audit &amp; outdated checks</div>
            </div>
          </td>
        </tr>`;
      try {
        _depsCache = await fetch("/api/deps").then(r => r.json());
      } catch {
        tbody.innerHTML = `<tr><td colspan="6" style="color:var(--muted);text-align:center;padding:24px">Failed to load dependency data.</td></tr>`;
        return;
      }
    }

    const data = _depsCache;

    if (!data.available) {
      summary.innerHTML = `<span class="dim">${data.error || "Not available"}</span>`;
      return;
    }

    const s = data.summary;

    summary.innerHTML = [
      chip(`${s.total} packages`),
      s.safe       ? chip(`${s.safe} safe`,       "var(--emerald)") : "",
      s.mediumRisk ? chip(`${s.mediumRisk} medium`, "var(--amber)")  : "",
      s.highRisk   ? chip(`${s.highRisk} high risk`, "var(--rose)")  : "",
      s.critical   ? chip(`${s.critical} critical`, "var(--rose)")   : "",
      s.unused     ? chip(`${s.unused} unused`,     "var(--muted)")  : "",
      s.deprecated ? chip(`${s.deprecated} deprecated`, "oklch(0.72 0.19 295)") : "",
      s.outdated   ? chip(`${s.outdated} outdated`, "var(--muted)")  : "",
    ].join("");

    // Ecosystem warnings
    if (data.ecosystemWarnings?.length) {
      ecosystem.hidden = false;
      ecosystem.innerHTML = data.ecosystemWarnings.map(w => `
        <div style="padding:10px 14px;margin-bottom:8px;border-radius:10px;border:1px solid var(--amber);background:oklch(0.82 0.16 75 / 0.08);font-size:12px">
          <strong style="color:var(--amber)">⚠ Overlapping ecosystems</strong>
          <div style="margin-top:3px;color:var(--muted)">${w.message}</div>
        </div>`).join("");
    } else {
      ecosystem.hidden = true;
      ecosystem.innerHTML = "";
    }

    if (!data.auditAvailable) {
      auditNotice.hidden = false;
      auditNotice.textContent = "ℹ Vulnerability scan unavailable — run npm audit in your project for the full picture.";
    } else {
      auditNotice.hidden = true;
    }

    // Filter + render table
    function applyFilters() {
      const q        = (document.getElementById("deps-filter")?.value || "").toLowerCase();
      const riskF    = document.getElementById("deps-risk-filter")?.value || "";
      const typeF    = document.getElementById("deps-type-filter")?.value || "";
      const sevOrder = ["low", "moderate", "high", "critical"];

      const filtered = data.packages.filter(p => {
        if (q && !p.name.toLowerCase().includes(q)) return false;
        if (typeF && p.type !== typeF) return false;
        if (riskF === "critical")   return p.vulnerabilities.some(v => v.severity === "critical");
        if (riskF === "high")       return p.vulnerabilities.some(v => sevOrder.indexOf(v.severity) >= 2);
        if (riskF === "risky")      return p.riskScore >= 3;
        if (riskF === "unused")     return p.isUnused;
        if (riskF === "deprecated") return p.isDeprecated;
        if (riskF === "outdated")   return p.outdatedSeverity != null;
        return true;
      });

      tbody.innerHTML = "";
      if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="color:var(--muted);text-align:center;padding:24px">No packages match filters.</td></tr>`;
        return;
      }

      filtered.forEach(pkg => {
        const tr = document.createElement("tr");
        tr.style.cursor = "pointer";
        const versionColor = pkg.outdatedSeverity === "major" ? "var(--amber)" : pkg.outdatedSeverity ? "var(--muted)" : null;
        const versionStr = versionColor
          ? `<span style="color:${versionColor}">${pkg.installedVersion || pkg.declaredRange}</span>`
          : `<span>${pkg.installedVersion || pkg.declaredRange || "—"}</span>`;
        const importStr = pkg.importCount > 0
          ? `<span style="color:var(--cyan)">${pkg.importCount}</span>`
          : `<span style="color:var(--muted)">0</span>`;

        tr.innerHTML = `
          <td style="font-weight:500">${pkg.name}</td>
          <td style="color:var(--muted);font-size:11px">${pkg.type === "devDep" ? "dev" : "dep"}</td>
          <td class="mono">${versionStr}</td>
          <td>${importStr}</td>
          <td><span style="color:${depsRiskColor(pkg.riskScore)};font-weight:700;font-size:12px">${pkg.riskScore > 0 ? pkg.riskScore : "—"}</span></td>
          <td style="white-space:nowrap">${depsStatusBadges(pkg) || '<span style="color:var(--muted);font-size:10px">safe</span>'}</td>
        `;
        tr.addEventListener("click", () => openPkgDrawer(pkg));
        tbody.appendChild(tr);
      });
    }

    applyFilters();

    // Wire filters once
    if (!document.getElementById("deps-filter")?._rmBound) {
      const dF = document.getElementById("deps-filter");
      const rF = document.getElementById("deps-risk-filter");
      const tF = document.getElementById("deps-type-filter");
      if (dF) { dF.addEventListener("input", applyFilters); dF._rmBound = true; }
      if (rF) { rF.addEventListener("change", applyFilters); }
      if (tF) { tF.addEventListener("change", applyFilters); }
    }

    // ── Subpackage breakdown ─────────────────────────────────────
    const subContainer = document.getElementById("deps-subpackages");
    if (!subContainer) return;

    const subPackages = data.subPackages || [];
    if (!subPackages.length) { subContainer.innerHTML = ""; return; }

    function renderSubPkgTable(pkgs, containerId) {
      const rows = pkgs.map(pkg => {
        const versionColor = pkg.outdatedSeverity === "major" ? "var(--amber)" : pkg.outdatedSeverity ? "var(--muted)" : null;
        const versionStr = versionColor
          ? `<span style="color:${versionColor}">${pkg.installedVersion || pkg.declaredRange}</span>`
          : `<span>${pkg.installedVersion || pkg.declaredRange || "—"}</span>`;
        return `<tr style="cursor:pointer" data-pkg-idx="${pkgs.indexOf(pkg)}" data-container="${containerId}">
          <td style="font-weight:500">${pkg.name}</td>
          <td style="color:var(--muted);font-size:11px">${pkg.type === "devDep" ? "dev" : "dep"}</td>
          <td class="mono">${versionStr}</td>
          <td>${pkg.importCount > 0 ? `<span style="color:var(--cyan)">${pkg.importCount}</span>` : `<span style="color:var(--muted)">0</span>`}</td>
          <td><span style="color:${depsRiskColor(pkg.riskScore)};font-weight:700;font-size:12px">${pkg.riskScore > 0 ? pkg.riskScore : "—"}</span></td>
          <td style="white-space:nowrap">${depsStatusBadges(pkg) || '<span style="color:var(--muted);font-size:10px">safe</span>'}</td>
        </tr>`;
      }).join("");
      return `<div class="table-wrap" style="max-height:300px">
        <table class="data-table" id="${containerId}">
          <thead><tr><th>Package</th><th>Type</th><th>Version</th><th>Imports</th><th>Risk</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    }

    subContainer.innerHTML = `
      <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:14px">Subpackages (${subPackages.length})</div>
      ${subPackages.map((sp, i) => {
        const s = sp.summary || {};
        const chips = [
          `<span style="font-size:10px;color:var(--muted)">${s.total || 0} pkgs</span>`,
          s.unused     ? `<span style="font-size:10px;color:var(--muted)">${s.unused} unused</span>` : "",
          s.outdated   ? `<span style="font-size:10px;color:var(--amber)">${s.outdated} outdated</span>` : "",
          s.highRisk   ? `<span style="font-size:10px;color:var(--rose)">${s.highRisk} high risk</span>` : "",
          s.critical   ? `<span style="font-size:10px;color:var(--rose)">${s.critical} critical</span>` : "",
        ].filter(Boolean).join(" · ");

        const tableId = `sub-tbl-${i}`;
        return `<details style="margin-bottom:10px;border:1px solid var(--border);border-radius:10px;overflow:hidden">
          <summary style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:12px;list-style:none;background:var(--surface)">
            <span style="font-weight:600;font-size:13px">${sp.name}</span>
            <span style="color:var(--muted);font-size:11px">${sp.relPath}</span>
            <span style="margin-left:auto;font-size:11px;color:var(--muted)">${chips}</span>
          </summary>
          <div style="padding:0 0 8px">
            ${sp.packages && sp.packages.length
              ? renderSubPkgTable(sp.packages, tableId)
              : `<div style="padding:16px;color:var(--muted);font-size:12px">No dependencies declared.</div>`}
          </div>
        </details>`;
      }).join("")}
    `;

    // Wire click handlers for subpackage rows
    subContainer.querySelectorAll("tr[data-pkg-idx]").forEach(tr => {
      tr.addEventListener("click", () => {
        const spIdx = [...subContainer.querySelectorAll("details")].indexOf(tr.closest("details"));
        const pkgIdx = Number(tr.dataset.pkgIdx);
        if (spIdx >= 0 && subPackages[spIdx]) {
          openPkgDrawer(subPackages[spIdx].packages[pkgIdx]);
        }
      });
    });
  }

  render();
})();
