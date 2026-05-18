/* eslint-disable */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { scanProject } = require("./scan.js");

const PUBLIC = path.join(__dirname, "..", "public");
let PKG_VERSION = "0.0.0";
try {
  PKG_VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")).version || PKG_VERSION;
} catch {}
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
    } catch {}
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
