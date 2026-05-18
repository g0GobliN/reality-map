/* eslint-disable */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const PUBLIC = path.join(__dirname, "..", "public");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function startServer({ port, graph, root }) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname === "/api/graph") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(graph));
        return;
      }
      if (url.pathname === "/api/meta") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ root, version: "0.1.0" }));
        return;
      }
      let file = url.pathname === "/" ? "/index.html" : url.pathname;
      const safe = path.normalize(path.join(PUBLIC, file));
      if (!safe.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
      fs.readFile(safe, (err, data) => {
        if (err) {
          // SPA fallback
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
      resolve({ url: `http://localhost:${port}`, server });
    });
  });
}

module.exports = { startServer };