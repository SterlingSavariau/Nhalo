import {
  InMemoryGeocodeCacheRepository,
  InMemoryListingCacheRepository,
  InMemoryMarketSnapshotRepository,
  InMemorySafetySignalCacheRepository,
  InMemorySearchRepository
} from "@nhalo/db";
import { createMockProviders } from "@nhalo/providers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { MetricsCollector } from "../src/metrics";

describe("google auth", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;

  beforeAll(async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    app = await buildApp({
      marketSnapshotRepository: new InMemoryMarketSnapshotRepository(),
      metrics: new MetricsCollector(),
      repository: new InMemorySearchRepository(),
      geocodeCacheRepository: new InMemoryGeocodeCacheRepository(),
      listingCacheRepository: new InMemoryListingCacheRepository(),
      safetySignalCacheRepository: new InMemorySafetySignalCacheRepository(),
      providers: createMockProviders()
    });
  });

  afterAll(async () => {
    if (originalGoogleClientId === undefined) {
      delete process.env.GOOGLE_CLIENT_ID;
    } else {
      process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;
    }
    await app.close();
  });

  it("returns a clear configuration error when google auth is unavailable", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/google",
      payload: {
        credential: "placeholder-google-id-token"
      }
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: {
        code: "AUTH_NOT_CONFIGURED",
        message: "Google sign-in is not configured.",
        details: []
      }
    });
  });
});
