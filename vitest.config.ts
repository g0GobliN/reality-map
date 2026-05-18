import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/reality-map/__tests__/**/*.test.ts"],
    environment: "node",
    reporters: ["verbose"],
  },
});
