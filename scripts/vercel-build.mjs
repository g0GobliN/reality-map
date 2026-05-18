import { mkdirSync, writeFileSync, existsSync, cpSync } from "node:fs";
import { build } from "esbuild";

const OUT = ".vercel/output";

mkdirSync(`${OUT}/static`, { recursive: true });
mkdirSync(`${OUT}/functions/index.func`, { recursive: true });

if (existsSync("dist/client")) {
  cpSync("dist/client", `${OUT}/static`, { recursive: true });
}

// Re-bundle the SSR server into a single self-contained ESM file.
// Vite externalises react/h3/etc. for Node.js deployments, but Vercel
// Edge Functions have no node_modules — everything must be inlined.
await build({
  entryPoints: ["dist/server/server.js"],
  bundle: true,
  outfile: `${OUT}/functions/index.func/index.js`,
  format: "esm",
  platform: "neutral",
  conditions: ["edge-light", "worker", "browser", "import", "module"],
  minify: true,
  logLevel: "info",
});

writeFileSync(
  `${OUT}/functions/index.func/.vc-config.json`,
  JSON.stringify({ runtime: "edge", entrypoint: "index.js" }),
);

writeFileSync(
  `${OUT}/config.json`,
  JSON.stringify({
    version: 3,
    routes: [{ handle: "filesystem" }, { src: "/(.*)", dest: "/index" }],
  }),
);

console.log("✓ .vercel/output ready");
