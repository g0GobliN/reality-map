/* eslint-disable */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { scanProject } = require("./scan.js");
const { computeHealth } = require("./health.js");
const { buildOrphanReport } = require("./orphans.js");
const { renderHtml } = require("./html-export.js");
const { loadRules, checkRules } = require("./rules.js");
const { computeImpact } = require("./impact.js");
const { buildDeadCodeReport } = require("./deadcode.js");
const { buildUnreachableReport } = require("./unreachable.js");
const { analyzeDeps } = require("./deps.js");

const PUBLIC = path.join(__dirname, "..", "public");
let PKG_VERSION = "0.0.0";
try {
  PKG_VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")).version || PKG_VERSION;
} catch { }
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function readBody(req, limit = 65536) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > limit) {
        reject(new Error("body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

function startServer({ port, graph, root, maxDepth, watch = false }) {
  let currentGraph = graph;
  let currentMaxDepth = Math.max(1, Math.min(5, Number(maxDepth ?? graph.maxDepth ?? 3)));

  async function runRescan(body) {
    try {
      const j = JSON.parse(body || "{}");
      if (Number.isFinite(j.maxDepth)) {
        currentMaxDepth = Math.max(1, Math.min(5, j.maxDepth));
      }
    } catch { }
    currentGraph = await scanProject(root, { maxDepth: currentMaxDepth });
    return currentGraph;
  }

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, "http://localhost");

      if (url.pathname === "/api/graph" && req.method === "GET") {
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(currentGraph));
        return;
      }

      if (url.pathname === "/api/rescan" && req.method === "POST") {
        try {
          const body = await readBody(req);
          const g = await runRescan(body);
          res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify(g));
        } catch (e) {
          res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ error: String(e && e.message ? e.message : e) }));
        }
        return;
      }

      if (url.pathname === "/api/meta" && req.method === "GET") {
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({
          root,
          version: PKG_VERSION,
          watch,
          maxDepth: currentMaxDepth,
          generatedAt: currentGraph.generatedAt || null,
        }));
        return;
      }

      if (url.pathname === "/api/health" && req.method === "GET") {
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(computeHealth(currentGraph)));
        return;
      }

      if (url.pathname === "/api/deadcode" && req.method === "GET") {
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(buildDeadCodeReport(currentGraph, root)));
        return;
      }

      if (url.pathname === "/api/unreachable" && req.method === "GET") {
        const src = url.searchParams.get("src") || "src";
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(buildUnreachableReport(currentGraph, src, root)));
        return;
      }

      if (url.pathname === "/api/deps" && req.method === "GET") {
        try {
          const result = await analyzeDeps(root, currentGraph);
          res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ available: false, error: String(e && e.message ? e.message : e) }));
        }
        return;
      }

      if (url.pathname === "/api/impact" && req.method === "POST") {
        try {
          const body = await readBody(req);
          const j = JSON.parse(body || "{}");
          const paths = Array.isArray(j.paths) ? j.paths : (j.path ? [j.path] : []);
          if (!paths.length) {
            res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: "paths array required" }));
            return;
          }
          res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify(computeImpact(currentGraph, paths)));
        } catch (e) {
          res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ error: String(e && e.message ? e.message : e) }));
        }
        return;
      }

      if (url.pathname === "/api/orphans" && req.method === "GET") {
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(buildOrphanReport(currentGraph)));
        return;
      }

      if (url.pathname === "/api/snapshot.html" && req.method === "GET") {
        const html = renderHtml(currentGraph, computeHealth(currentGraph));
        res.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
          "content-disposition": 'attachment; filename="reality-map-snapshot.html"',
        });
        res.end(html);
        return;
      }

      if (url.pathname === "/api/search" && req.method === "GET") {
        const q = (url.searchParams.get("q") || "").toLowerCase().trim();
        const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 50)));
        const idx = currentGraph.insights?.filesIndex || [];
        const out = !q ? [] : idx.filter((f) => f.path.toLowerCase().includes(q)).slice(0, limit);
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ q, results: out }));
        return;
      }

      if (url.pathname.startsWith("/api/file/") && req.method === "GET") {
        const filePath = decodeURIComponent(url.pathname.slice(10));
        const details = currentGraph.fileDetails || {};
        const imports = details.imports?.[filePath] || { specs: [], details: [] };
        const symbols = details.symbols?.[filePath] || [];
        const loc = details.loc?.[filePath] || 0;
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        const lastModified = details.lastModified?.[filePath] || 0;
        res.end(JSON.stringify({ path: filePath, imports, symbols, loc, lastModified }));
        return;
      }

      if (url.pathname.startsWith("/api/preview/") && req.method === "GET") {
        const filePath = decodeURIComponent(url.pathname.slice(13));
        const absPath = path.join(root || process.cwd(), filePath);
        try {
          const content = fs.readFileSync(absPath, "utf8");
          const lines = content.split("\n").slice(0, 20).join("\n");
          res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ lines }));
        } catch {
          res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ error: "not found" }));
        }
        return;
      }

      if (url.pathname.startsWith("/api/module/") && req.method === "GET") {
        const parts = url.pathname.split("/");
        if (parts.length >= 5 && parts[4] === "files") {
          const moduleId = decodeURIComponent(parts[3]);
          const depth = Number(url.searchParams.get("depth") || 1);
          const graph = currentGraph.graphsByDepth?.[depth] || currentGraph;
          const node = graph.nodes?.find((n) => n.id === moduleId);
          if (!node) {
            res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: "module not found" }));
            return;
          }
          const files = (node.allPaths || node.pathsPreview || []).map((p) => {
            const details = currentGraph.fileDetails || {};
            return {
              path: p,
              symbols: details.symbols?.[p] || [],
              loc: details.loc?.[p] || 0,
              issues: node.fileIssues?.[p] || []
            };
          });
          res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ module: moduleId, files }));
          return;
        }
      }

      if (url.pathname.startsWith("/api/trace/") && req.method === "GET") {
        const parts = url.pathname.split("/").slice(3);
        if (parts.length >= 2) {
          const from = decodeURIComponent(parts[0]);
          const to = decodeURIComponent(parts[1]);
          const details = currentGraph.fileDetails || {};
          const fromImports = details.imports?.[from];
          if (!fromImports) {
            res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: "source file not found" }));
            return;
          }
          const trace = fromImports.details?.filter((imp) => {
            const resolved = imp.spec;
            return resolved.includes(to) || to.includes(resolved);
          }) || [];
          res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ from, to, imports: trace }));
          return;
        }
      }

      let file = url.pathname === "/" ? "/index.html" : url.pathname;
      const safe = path.normalize(path.join(PUBLIC, file));
      if (!safe.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
      fs.readFile(safe, (err, data) => {
        if (err) {
          fs.readFile(path.join(PUBLIC, "index.html"), (e2, d2) => {
            if (e2) { res.writeHead(404); res.end("not found"); return; }
            res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
            res.end(d2);
          });
          return;
        }
        res.writeHead(200, { "content-type": MIME[path.extname(safe)] || "application/octet-stream" });
        res.end(data);
      });
    });

    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => {
      resolve({
        url: `http://localhost:${port}`,
        server,
        getGraph: () => currentGraph,
        rescan: () => runRescan("{}"),
      });
    });
  });
}

module.exports = { startServer };
