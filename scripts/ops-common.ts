import { getConfig } from "@nhalo/config";
import { buildApp } from "../apps/api/src/app";

export async function withOpsApp<T>(
  run: (context: {
    app: Awaited<ReturnType<typeof buildApp>>;
    internalHeaders: Record<string, string>;
  }) => Promise<T>
): Promise<T> {
  const config = getConfig();
  if (config.security.internalRouteGuardsEnabled && !config.security.internalRouteAccessToken) {
    throw new Error("INTERNAL_ROUTE_ACCESS_TOKEN is required when internal route guards are enabled.");
  }
  const app = await buildApp();
  const internalHeaders =
    config.security.internalRouteGuardsEnabled && config.security.internalRouteAccessToken
      ? { "x-nhalo-internal-token": config.security.internalRouteAccessToken }
      : {};

  try {
    return await run({ app, internalHeaders });
  } finally {
    await app.close();
  }
}

export function printSection(title: string): void {
  process.stdout.write(`\n${title}\n`);
}
