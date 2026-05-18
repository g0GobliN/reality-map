/* RealityMap dashboard — vanilla SVG, zero deps */
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

  const meta = await fetch("/api/meta").then((r) => r.json());
  metaRoot.textContent = meta.root;

  let scan = await fetch("/api/graph").then((r) => r.json());
  let graphsByDepth = scan.graphsByDepth || { 1: scan };
  let maxDepth = scan.maxDepth ?? Math.max(1, ...Object.keys(graphsByDepth).map((k) => Number(k)));

  let selected = null;
  let stack = [];
  let view = { x: 0, y: 0, k: 1, depth: 1, prefix: null };
  let currentViewGraph = null;

  function setBackButton() {
    if (!backBtn) return;
    const canGoBack = stack.length > 0;
    backBtn.disabled = !canGoBack;
    // Keep it readable even though we don't have a :disabled style in CSS.
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
      // Keep sidebar/hud consistent with the filtered view.
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
      selected = moduleId; // will be cleared in render() if not present in the new view
      render();
      return;
    }

    selected = selected === moduleId ? null : moduleId;
    render();
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

    stats.textContent = `${graph.stats.files} files · ${graph.stats.modules} modules · ${graph.stats.edges} edges · ${graph.stats.cycles} cycle(s) · ${graph.stats.loc.toLocaleString()} loc`;
    const rootShort = meta.root.split("/").slice(-2).join("/");
    hud.textContent = `~ ${rootShort}${view.prefix ? " · " + view.prefix : ""} · depth ${view.depth}/${maxDepth}`;

    moduleList.innerHTML = "";
    [...graph.nodes].sort((a, b) => b.loc - a.loc).forEach((n) => {
      const item = document.createElement("div");
      item.className = "row" + (n.warn ? " warn" : "");
      item.innerHTML = `<span class="dot" style="background:${TONE[n.tone]}"></span>
        <span class="name">${n.label}</span>
        <span class="num">${n.files}f · ${n.loc}</span>`;
      item.onclick = () => onModuleClick(n.id);
      moduleList.appendChild(item);
    });

    cycleList.innerHTML = graph.cycles.length === 0
      ? `<div class="dim mono" style="padding:6px 8px">none detected ✓</div>`
      : "";
    graph.cycles.slice(0, 6).forEach((cy) => {
      const item = document.createElement("div");
      item.className = "row warn";
      item.innerHTML = `<span class="dot" style="background:${TONE.rose}"></span>
        <span class="name mono" style="font-size:11px">${cy.join(" → ")}</span>`;
      cycleList.appendChild(item);
    });

    extList.innerHTML = "";
    graph.topExternal.forEach((d) => {
      const item = document.createElement("div");
      item.className = "row";
      item.innerHTML = `<span class="dot" style="background:${TONE.violet}"></span>
        <span class="name mono" style="font-size:12px">${d.name}</span>
        <span class="num">${d.count}</span>`;
      extList.appendChild(item);
    });

    setBackButton();
    fit(graph);
    draw(graph);
  }

  function fit(graph) {
    if (!graph.nodes.length) return;
    const xs = graph.nodes.map((n) => n.x), ys = graph.nodes.map((n) => n.y);
    const minX = Math.min(...xs) - 80, maxX = Math.max(...xs) + 280;
    const minY = Math.min(...ys) - 80, maxY = Math.max(...ys) + 180;
    const w = svg.clientWidth, h = svg.clientHeight;
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

    const NW = 220, NH = 70;
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    const incidentToSelected = new Set();
    if (selected) {
      graph.edges.forEach((e) => {
        if (e.source === selected || e.target === selected) incidentToSelected.add(e.id);
      });
    }

    // edges
    const edgesG = el("g");
    graph.edges.forEach((e) => {
      const a = byId.get(e.source), b = byId.get(e.target);
      if (!a || !b) return;
      const x1 = a.x + NW, y1 = a.y + NH / 2;
      const x2 = b.x, y2 = b.y + NH / 2;
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
      edgesG.appendChild(path);
    });
    root.appendChild(edgesG);

    const barMax = Math.max(...graph.nodes.map((m) => m.loc), 1);

    // nodes
    graph.nodes.forEach((n) => {
      const g = el("g", { class: "node-group", transform: `translate(${n.x} ${n.y})` });
      g.dataset.id = n.id;
      g.dataset.moved = "0";

      const accentColor = TONE[n.tone] || TONE.cyan;
      const dim = selected && selected !== n.id && !graph.edges.some((e) => (
        (e.source === selected && e.target === n.id) || (e.target === selected && e.source === n.id)
      ));
      g.setAttribute("opacity", dim ? "0.35" : "1");

      g.appendChild(el("rect", {
        class: "node-card", x: 0, y: 0, width: NW, height: NH, rx: 12,
        stroke: accentColor, "stroke-opacity": 0.5,
      }));
      g.appendChild(el("rect", {
        class: "accent", x: 0, y: 0, width: 4, height: NH, rx: 2, fill: accentColor,
      }));

      const label = el("text", { class: "node-label", x: 16, y: 28 });
      label.textContent = n.label.length > 24 ? n.label.slice(0, 22) + "…" : n.label;
      g.appendChild(label);

      const sub = el("text", { class: "node-sub", x: 16, y: 46 });
      sub.textContent = n.sub;
      g.appendChild(sub);

      // metric bar
      const w = Math.max(6, Math.round((n.loc / barMax) * (NW - 32)));
      g.appendChild(el("rect", { x: 16, y: 56, width: NW - 32, height: 3, rx: 2, fill: "rgba(255,255,255,0.06)" }));
      g.appendChild(el("rect", { x: 16, y: 56, width: w, height: 3, rx: 2, fill: accentColor, "fill-opacity": 0.7 }));

      if (n.warn) {
        const badge = el("g", { transform: `translate(${NW - 28} 12)` });
        badge.appendChild(el("circle", { r: 9, cx: 9, cy: 9, fill: TONE.rose, "fill-opacity": 0.18, stroke: TONE.rose, "stroke-opacity": 0.6 }));
        const t = el("text", { x: 9, y: 13, "text-anchor": "middle", "font-size": 11, fill: TONE.rose, "font-weight": 700 });
        t.textContent = "!"; badge.appendChild(t);
        g.appendChild(badge);
      }

      makeDraggable(g, n);
      g.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (g.dataset.moved === "1") { g.dataset.moved = "0"; return; }
        onModuleClick(n.id);
      });

      root.appendChild(g);
    });
  }

  function makeDraggable(g, n) {
    let dragging = false, startX, startY, origX, origY, moved = false;
    g.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      dragging = true;
      moved = false;
      g.dataset.moved = "0";
      startX = e.clientX; startY = e.clientY;
      origX = n.x; origY = n.y;
      g.setPointerCapture(e.pointerId);
    });
    g.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = (e.clientX - startX) / view.k;
      const dy = (e.clientY - startY) / view.k;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      g.dataset.moved = moved ? "1" : "0";
      n.x = origX + dx; n.y = origY + dy;
      g.setAttribute("transform", `translate(${n.x} ${n.y})`);
      if (currentViewGraph) draw(currentViewGraph);
    });
    g.addEventListener("pointerup", (e) => {
      dragging = false;
      try { g.releasePointerCapture(e.pointerId); } catch {}
      if (moved) e.stopPropagation();
    });
  }

  // pan + zoom
  let panning = false, px, py;
  svg.addEventListener("pointerdown", (e) => {
    panning = true;
    px = e.clientX; py = e.clientY;
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener("pointermove", (e) => {
    if (!panning) return;
    view.x += e.clientX - px; view.y += e.clientY - py;
    px = e.clientX; py = e.clientY;
    if (currentViewGraph) draw(currentViewGraph);
  });
  svg.addEventListener("pointerup", (e) => {
    panning = false;
    try { svg.releasePointerCapture(e.pointerId); } catch {}
  });
  svg.addEventListener("click", () => {
    if (selected) {
      selected = null;
      if (currentViewGraph) draw(currentViewGraph);
    }
  });
  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const factor = Math.exp(-e.deltaY * 0.0015);
    const nk = Math.min(2.5, Math.max(0.25, view.k * factor));
    view.x = mx - (mx - view.x) * (nk / view.k);
    view.y = my - (my - view.y) * (nk / view.k);
    view.k = nk;
    if (currentViewGraph) draw(currentViewGraph);
  }, { passive: false });

  document.getElementById("fit").onclick = () => {
    if (currentViewGraph) { fit(currentViewGraph); draw(currentViewGraph); }
  };

  if (backBtn) {
    backBtn.onclick = () => {
      if (stack.length === 0) return;
      const prev = stack.pop();
      view.prefix = prev.prefix;
      view.depth = prev.depth;
      selected = null;
      render();
    };
  }

  document.getElementById("reload").onclick = async () => {
    stats.textContent = "rescanning…";
    scan = await fetch("/api/graph").then((r) => r.json());
    graphsByDepth = scan.graphsByDepth || { 1: scan };
    maxDepth = scan.maxDepth ?? Math.max(1, ...Object.keys(graphsByDepth).map((k) => Number(k)));
    view = { x: 0, y: 0, k: 1, depth: 1, prefix: null };
    selected = null;
    stack = [];
    render();
  };

  window.addEventListener("resize", () => {
    if (!currentViewGraph) return;
    fit(currentViewGraph);
    draw(currentViewGraph);
  });

  render();
})();