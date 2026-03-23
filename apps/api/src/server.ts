import { getConfig } from "@nhalo/config";
import { buildApp } from "./app";

const config = getConfig();

const app = await buildApp();

try {
  await app.listen({
    port: config.port,
    host: "0.0.0.0"
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
