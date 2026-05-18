/* RealityMap dashboard — vanilla SVG + multi-view, zero deps */
(async function () {
  const TONE = { cyan: "#67e8f9", violet: "#a78bfa", emerald: "#6ee7b7", amber: "#fbbf24", rose: "#fb7185" };

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
  let view = { x: 0, y: 0, k: 1, depth: 1, prefix: null };
  let currentViewGraph = null;
  let activeTab = "map";

  function fillDepthSelect() {
    depthSelect.innerHTML = "";
    for (let d = 1; d <= maxDepth; d++) {
      const o = document.createElement("option");
      o.value = String(d);
      o.textContent = "Depth " + d;
      depthSelect.appendChild(o);
    }
    depthSelect.value = String(view.depth);
  }
  fillDepthSelect();

  depthSelect.addEventListener("change", () => {
    view.depth = Number(depthSelect.value);
    view.prefix = null;
    stack = [];
    selected = null;
    render();
  });

  moduleSort.addEventListener("change", () => render());
  moduleFilter.addEventListener("input", () => render());

  function setTab(tab) {
    activeTab = tab;
    document.querySelectorAll("#main-tabs .tab").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tab);
    });
    viewMap.hidden = tab !== "map";
    viewInsights.hidden = tab !== "insights";
    viewFiles.hidden = tab !== "files";
    if (tab === "insights") renderInsights();
    if (tab === "files") renderFilesTable();
  }

  document.getElementById("main-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn || !btn.dataset.tab) return;
    setTab(btn.dataset.tab);
  });

  function setBackButton() {
    if (!backBtn) return;
    const canGoBack = stack.length > 0;
    backBtn.disabled = !canGoBack;
    backBtn.style.opacity = canGoBack ? "1" : "0.55";
    backBtn.style.cursor = canGoBack ? "pointer" : "not-allowed";
  }

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

  function onModuleClick(moduleId) {
    if (view.depth < maxDepth) {
      stack.push({ prefix: view.prefix, depth: view.depth });
      view.prefix = moduleId;
      view.depth = Math.min(maxDepth, view.depth + 1);
      depthSelect.value = String(view.depth);
      selected = moduleId;
      render();
      return;
    }

    selected = selected === moduleId ? null : moduleId;
    render();
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
      detailPanel.textContent = "Click a module for fan-in/out and sample paths.";
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
      (n.pathsPreview || []).slice(0, 10).join("\n"),
    ];
    detailPanel.textContent = lines.join("\n");
    detailPanel.className = "detail mono";
  }

  const NS = "http://www.w3.org/2000/svg";
  function el(name, attrs = {}, children = []) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    children.forEach((c) => e.appendChild(c));
    return e;
  }

  function render() {
    currentViewGraph = computeViewGraph();
    const graph = currentViewGraph;

    if (selected && !graph.nodes.some((n) => n.id === selected)) selected = null;

    stats.textContent =
      `${graph.stats.files} files · ${graph.stats.modules} modules · ${graph.stats.edges} edges · ${graph.stats.cycles} cycle(s) · ${(graph.stats.loc || 0).toLocaleString()} loc`;
    const rootShort = meta.root.split("/").slice(-2).join("/");
    hud.textContent = `~ ${rootShort}${view.prefix ? " · " + view.prefix : ""} · depth ${view.depth}/${maxDepth}`;

    moduleList.innerHTML = "";
    const sorted = sortModules(filterModules(graph.nodes));
    sorted.forEach((n) => {
      const item = document.createElement("div");
      item.className = "row" + (n.warn ? " warn" : "") + (selected === n.id ? " sel" : "");
      item.innerHTML = `<span class="dot" style="background:${TONE[n.tone]}"></span>
        <span class="name">${n.label}</span>
        <span class="num">${n.files}f · ${n.loc} · ⇣${n.fanIn ?? 0}</span>`;
      item.onclick = () => onModuleClick(n.id);
      moduleList.appendChild(item);
    });

    cycleList.innerHTML =
      graph.cycles.length === 0 ? `<div class="dim mono" style="padding:6px 8px">none detected ✓</div>` : "";
    graph.cycles.slice(0, 8).forEach((cy) => {
      const item = document.createElement("div");
      item.className = "row warn";
      item.innerHTML = `<span class="dot" style="background:${TONE.rose}"></span>
        <span class="name mono" style="font-size:11px">${cy.join(" → ")}</span>`;
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
    fit(graph);
    draw(graph);
  }

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

    fillTable(
      document.querySelector("#tbl-top-loc tbody"),
      ins.topFilesByLoc || [],
      ["path", "loc"],
    );
    fillTable(
      document.querySelector("#tbl-imported tbody"),
      ins.topImported || [],
      ["path", "count", "loc"],
    );
    fillTable(
      document.querySelector("#tbl-hubs tbody"),
      ins.hubs || [],
      ["path", "in", "out", "score"],
    );
    fillTable(
      document.querySelector("#tbl-zero tbody"),
      ins.zeroInternalImporters || [],
      ["path", "loc", "internalExports"],
    );
  }

  function chip(t) {
    return `<span class="chip">${t}</span>`;
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
    const rows = q ? ins.filesIndex.filter((r) => r.path.toLowerCase().includes(q)) : ins.filesIndex;
    fillTable(
      document.querySelector("#tbl-files tbody"),
      rows.slice(0, 800),
      ["path", "ext", "loc", "importers", "importees"],
    );
  }

  fileFilter.addEventListener("input", () => {
    if (activeTab === "files") renderFilesTable();
  });

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
        <stop offset="0" stop-color="#1a2030" stop-opacity="0.95"/>
        <stop offset="1" stop-color="#0e131c" stop-opacity="0.95"/>
      </linearGradient>
      <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="currentColor" opacity="0.6"/>
      </marker>
    `;
    svg.appendChild(defs);

    const root = el("g", { transform: `translate(${view.x} ${view.y}) scale(${view.k})` });
    svg.appendChild(root);

    const NW = 220,
      NH = 70;
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
      const x1 = a.x + NW,
        y1 = a.y + NH / 2;
      const x2 = b.x,
        y2 = b.y + NH / 2;
      const cx = (x1 + x2) / 2;
      const d = `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`;
      const cls = ["edge"];
      if (a.warn || b.warn) cls.push("warn");
      if (e.weight >= 3) cls.push("hot", "animated");
      else cls.push("animated");
      if (selected && !incidentToSelected.has(e.id)) cls.push("dim");
      const path = el("path", {
        d,
        class: cls.join(" "),
        "marker-end": "url(#arrow)",
        style: `color:${(a.warn || b.warn) ? TONE.rose : TONE.cyan}; stroke:${(a.warn || b.warn) ? TONE.rose : TONE.cyan}`,
      });
      const tEl = el("title");
      tEl.textContent = (e.weight || 1) + " import edge(s)";
      path.appendChild(tEl);
      edgesG.appendChild(path);
    });
    root.appendChild(edgesG);

    const barMax = Math.max(...graph.nodes.map((m) => m.loc), 1);

    graph.nodes.forEach((n) => {
      const g = el("g", { class: "node-group", transform: `translate(${n.x} ${n.y})` });
      g.dataset.id = n.id;
      g.dataset.moved = "0";

      const accentColor = TONE[n.tone] || TONE.cyan;
      const dimmed =
        selected &&
        selected !== n.id &&
        !graph.edges.some(
          (e) =>
            (e.source === selected && e.target === n.id) || (e.target === selected && e.source === n.id),
        );
      g.setAttribute("opacity", dimmed ? "0.35" : "1");

      g.appendChild(
        el("rect", {
          class: "node-card",
          x: 0,
          y: 0,
          width: NW,
          height: NH,
          rx: 12,
          stroke: accentColor,
          "stroke-opacity": 0.5,
        }),
      );
      g.appendChild(
        el("rect", {
          class: "accent",
          x: 0,
          y: 0,
          width: 4,
          height: NH,
          rx: 2,
          fill: accentColor,
        }),
      );

      const label = el("text", { class: "node-label", x: 16, y: 28 });
      label.textContent = n.label.length > 24 ? n.label.slice(0, 22) + "…" : n.label;
      g.appendChild(label);

      const sub = el("text", { class: "node-sub", x: 16, y: 46 });
      sub.textContent = n.sub + " · ⇣" + (n.fanIn ?? 0) + " ⇢" + (n.fanOut ?? 0);
      g.appendChild(sub);

      const wbar = Math.max(6, Math.round((n.loc / barMax) * (NW - 32)));
      g.appendChild(el("rect", { x: 16, y: 56, width: NW - 32, height: 3, rx: 2, fill: "rgba(255,255,255,0.06)" }));
      g.appendChild(
        el("rect", { x: 16, y: 56, width: wbar, height: 3, rx: 2, fill: accentColor, "fill-opacity": 0.7 }),
      );

      if (n.warn) {
        const badge = el("g", { transform: `translate(${NW - 28} 12)` });
        badge.appendChild(
          el("circle", {
            r: 9,
            cx: 9,
            cy: 9,
            fill: TONE.rose,
            "fill-opacity": 0.18,
            stroke: TONE.rose,
            "stroke-opacity": 0.6,
          }),
        );
        const t = el("text", {
          x: 9,
          y: 13,
          "text-anchor": "middle",
          "font-size": 11,
          fill: TONE.rose,
          "font-weight": 700,
        });
        t.textContent = "!";
        badge.appendChild(t);
        g.appendChild(badge);
      }

      makeDraggable(g, n);
      g.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (g.dataset.moved === "1") {
          g.dataset.moved = "0";
          return;
        }
        onModuleClick(n.id);
      });

      root.appendChild(g);
    });
  }

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
      render();
    };
  }

  async function loadGraph(fromButton) {
    if (fromButton) stats.textContent = "rescanning…";
    const r = fromButton
      ? await fetch("/api/rescan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ maxDepth: Number(depthSelect.value) || maxDepth }) }).then((x) => x.json())
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

  document.addEventListener("keydown", (e) => {
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") {
      if (e.key === "Escape") e.target.blur();
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
  });

  window.addEventListener("resize", () => {
    if (!currentViewGraph) return;
    fit(currentViewGraph);
    draw(currentViewGraph);
  });

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

  render();
})();
