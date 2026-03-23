import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(__dirname),
  plugins: [react()],
  resolve: {
    alias: {
      "@nhalo/config": resolve(__dirname, "../../packages/config/src/index.ts"),
      "@nhalo/db": resolve(__dirname, "../../packages/db/src/index.ts"),
      "@nhalo/providers": resolve(__dirname, "../../packages/providers/src/index.ts"),
      "@nhalo/scoring": resolve(__dirname, "../../packages/scoring/src/index.ts"),
      "@nhalo/types": resolve(__dirname, "../../packages/types/src/index.ts")
    }
  },
  server: {
    port: 5173
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
