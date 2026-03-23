import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@nhalo/config": resolve(__dirname, "packages/config/src/index.ts"),
      "@nhalo/db": resolve(__dirname, "packages/db/src/index.ts"),
      "@nhalo/providers": resolve(__dirname, "packages/providers/src/index.ts"),
      "@nhalo/scoring": resolve(__dirname, "packages/scoring/src/index.ts"),
      "@nhalo/types": resolve(__dirname, "packages/types/src/index.ts")
    }
  },
  test: {
    environment: "node",
    include: ["apps/api/test/**/*.test.ts"]
  }
});
