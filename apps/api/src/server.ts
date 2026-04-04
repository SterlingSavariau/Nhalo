import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { ConfigError, getConfig } from "@nhalo/config";
import { buildApp } from "./app";
import { createLogger } from "./logger";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnvFile(resolve(__dirname, "../../../.env"));

const config = getConfig();
const logger = createLogger({ level: config.logLevel });
let app: Awaited<ReturnType<typeof buildApp>> | null = null;

try {
  app = await buildApp({
    logger
  });
  await app.listen({
    port: config.port,
    host: "0.0.0.0"
  });
  logger.info({
    message: "API server started",
    endpoint: "startup",
    statusCode: 200,
    durationMs: 0
  });
} catch (error) {
  logger.error({
    message: error instanceof ConfigError ? error.message : "Failed to start API server",
    endpoint: "startup",
    statusCode: 500,
    durationMs: 0,
    errorCode: error instanceof ConfigError ? "CONFIG_ERROR" : "INTERNAL_ERROR",
    details:
      error instanceof ConfigError
        ? error.details
        : error instanceof Error
          ? { message: error.message }
          : "Unknown startup error"
  });
  await logger.flush();
  process.exit(1);
}

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  logger.info({
    message: `Received ${signal}; shutting down gracefully`,
    endpoint: "shutdown",
    statusCode: 200,
    durationMs: 0
  });
  try {
    await app?.close();
    await logger.flush();
    process.exit(0);
  } catch (error) {
    logger.error({
      message: "Graceful shutdown failed",
      endpoint: "shutdown",
      statusCode: 500,
      durationMs: 0,
      errorCode: "INTERNAL_ERROR",
      details: error instanceof Error ? error.message : "Unknown shutdown error"
    });
    await logger.flush();
    process.exit(1);
  }
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
