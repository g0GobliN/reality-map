import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig, type Plugin } from "vite";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync("./package.json", "utf-8")) as { version: string };

// Serve /demo and /demo/ as the static dashboard in dev mode.
// In production this is handled by the Vercel rewrite in vercel.json.
function demoDevPlugin(): Plugin {
  return {
    name: "demo-dev-index",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url === "/demo" || req.url === "/demo/") {
          req.url = "/demo/index.html";
        }
        next();
      });
    },
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __VERCEL__: JSON.stringify(process.env.VERCEL === "1"),
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    demoDevPlugin(),
    tanstackStart({
      server: { entry: "server" },
      spa: { enabled: true },
    }),
    react(),
    tailwindcss(),
  ],
});
