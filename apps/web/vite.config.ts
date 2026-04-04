import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

const workspaceRoot = resolve(__dirname, "../..");
const proxiedApiPrefixes = [
  "/activity",
  "/auth",
  "/closing-readiness",
  "/collaboration",
  "/comments",
  "/explanations",
  "/feedback",
  "/financial-readiness",
  "/health",
  "/locations",
  "/metrics",
  "/negotiations",
  "/notes",
  "/notifications",
  "/offer-preparation",
  "/offer-readiness",
  "/offer-submission",
  "/ops",
  "/pilot",
  "/providers",
  "/ready",
  "/reviewer-decisions",
  "/scores",
  "/search",
  "/shared",
  "/shortlists",
  "/transaction-command-center",
  "/under-contract",
  "/validation",
  "/version",
  "/workflow"
] as const;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, workspaceRoot, "");
  const apiTarget = env.VITE_API_URL?.trim() || env.NHALO_API_URL?.trim() || "http://localhost:3000";

  return {
    root: resolve(__dirname),
    envDir: workspaceRoot,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
        "@nhalo/config": resolve(__dirname, "../../packages/config/src/index.ts"),
        "@nhalo/db": resolve(__dirname, "../../packages/db/src/index.ts"),
        "@nhalo/providers": resolve(__dirname, "../../packages/providers/src/index.ts"),
        "@nhalo/scoring": resolve(__dirname, "../../packages/scoring/src/index.ts"),
        "@nhalo/types": resolve(__dirname, "../../packages/types/src/index.ts")
      }
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      proxy: Object.fromEntries(
        proxiedApiPrefixes.map((prefix) => [
          prefix,
          {
            target: apiTarget,
            changeOrigin: true
          }
        ])
      )
    },
    build: {
      outDir: "dist",
      emptyOutDir: true
    }
  };
});
