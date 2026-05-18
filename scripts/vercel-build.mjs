import { cpSync, mkdirSync, writeFileSync, existsSync } from "node:fs";

const OUT = ".vercel/output";

mkdirSync(`${OUT}/static`, { recursive: true });
mkdirSync(`${OUT}/functions/index.func`, { recursive: true });

if (existsSync("dist/client")) {
  cpSync("dist/client", `${OUT}/static`, { recursive: true });
}

cpSync("dist/server", `${OUT}/functions/index.func`, { recursive: true });

writeFileSync(
  `${OUT}/functions/index.func/.vc-config.json`,
  JSON.stringify({ runtime: "edge", entrypoint: "server.js" }),
);

writeFileSync(
  `${OUT}/config.json`,
  JSON.stringify({
    version: 3,
    routes: [{ handle: "filesystem" }, { src: "/(.*)", dest: "/index" }],
  }),
);

console.log("✓ .vercel/output ready");
