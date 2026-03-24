import {
  InMemoryGeocodeCacheRepository,
  InMemoryListingCacheRepository,
  InMemoryMarketSnapshotRepository,
  InMemorySafetySignalCacheRepository,
  InMemorySearchRepository
} from "@nhalo/db";
import { createProviders } from "@nhalo/providers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { MetricsCollector } from "../src/metrics";

describe("live safety integration", () => {
  const originalEnv = {
    SAFETY_PROVIDER_MODE: process.env.SAFETY_PROVIDER_MODE,
    CRIME_PROVIDER_BASE_URL: process.env.CRIME_PROVIDER_BASE_URL,
    CRIME_PROVIDER_API_KEY: process.env.CRIME_PROVIDER_API_KEY,
    SCHOOL_PROVIDER_BASE_URL: process.env.SCHOOL_PROVIDER_BASE_URL,
    SCHOOL_PROVIDER_API_KEY: process.env.SCHOOL_PROVIDER_API_KEY
  };

  let app: Awaited<ReturnType<typeof buildApp>>;
  let metrics: MetricsCollector;
  let safetySignalCacheRepository: InMemorySafetySignalCacheRepository;
  let listingCacheRepository: InMemoryListingCacheRepository;
  let geocodeCacheRepository: InMemoryGeocodeCacheRepository;

  beforeAll(async () => {
    process.env.SAFETY_PROVIDER_MODE = "hybrid";
    process.env.CRIME_PROVIDER_BASE_URL = "https://crime.example/api";
    process.env.CRIME_PROVIDER_API_KEY = "crime-key";
    process.env.SCHOOL_PROVIDER_BASE_URL = "https://school.example/api";
    process.env.SCHOOL_PROVIDER_API_KEY = "school-key";

    const recentFetchedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    metrics = new MetricsCollector();
    safetySignalCacheRepository = new InMemorySafetySignalCacheRepository();
    listingCacheRepository = new InMemoryListingCacheRepository();
    geocodeCacheRepository = new InMemoryGeocodeCacheRepository();
    const providers = createProviders({
      geocodeCacheRepository,
      listingCacheRepository,
      safetySignalCacheRepository,
      metrics,
      fetcher: async (input) => {
        const url = String(input);

        if (url.includes("crime.example")) {
          return new Response(
            JSON.stringify({
              riskScore: 22,
              maxRiskScore: 100,
              provider: "crime-live",
              fetchedAt: recentFetchedAt
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }

        return new Response(
            JSON.stringify({
              rating: 8.7,
              maxRating: 10,
              provider: "school-live",
              fetchedAt: recentFetchedAt
            }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
    });

    app = await buildApp({
      marketSnapshotRepository: new InMemoryMarketSnapshotRepository(),
      metrics,
      providers,
      repository: new InMemorySearchRepository(),
      geocodeCacheRepository,
      listingCacheRepository,
      safetySignalCacheRepository
    });
  });

  afterAll(async () => {
    process.env.SAFETY_PROVIDER_MODE = originalEnv.SAFETY_PROVIDER_MODE;
    process.env.CRIME_PROVIDER_BASE_URL = originalEnv.CRIME_PROVIDER_BASE_URL;
    process.env.CRIME_PROVIDER_API_KEY = originalEnv.CRIME_PROVIDER_API_KEY;
    process.env.SCHOOL_PROVIDER_BASE_URL = originalEnv.SCHOOL_PROVIDER_BASE_URL;
    process.env.SCHOOL_PROVIDER_API_KEY = originalEnv.SCHOOL_PROVIDER_API_KEY;
    await app.close();
  });

  it("reports child safety providers in /providers/status", async () => {
    await app.inject({
      method: "POST",
      url: "/search",
      payload: {
        locationType: "city",
        locationValue: "Southfield, MI",
        radiusMiles: 5,
        budget: { max: 425000 },
        minSqft: 1800,
        minBedrooms: 3
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/providers/status"
    });
    const payload = response.json();
    const safetyProvider = payload.providers.find(
      (provider: { providerName: string }) => provider.providerName === "SafetyProvider"
    );

    expect(safetyProvider.children).toHaveLength(2);
    expect(safetyProvider.children[0].providerName).toBe("CrimeSignalProvider");
    expect(safetyProvider.children[1].providerName).toBe("SchoolSignalProvider");
  });

  it("stores safety provenance in audit responses", async () => {
    const searchResponse = await app.inject({
      method: "POST",
      url: "/search",
      payload: {
        locationType: "city",
        locationValue: "Southfield, MI",
        radiusMiles: 5,
        budget: { max: 425000 },
        minSqft: 1800,
        minBedrooms: 3
      }
    });
    const firstHome = searchResponse.json().homes[0];

    const auditResponse = await app.inject({
      method: "GET",
      url: `/scores/audit/${firstHome.id}`
    });
    const auditPayload = auditResponse.json();

    expect(auditPayload.safetyProvenance).toMatchObject({
      safetyDataSource: expect.stringMatching(/live|cached_live/),
      crimeProvider: expect.any(String),
      schoolProvider: expect.any(String),
      rawSafetyInputs: expect.any(Object),
      normalizedSafetyInputs: expect.any(Object)
    });
  });

  it("records safety-specific metrics for live fetches and cache hits", async () => {
    await app.inject({
      method: "POST",
      url: "/search",
      payload: {
        locationType: "city",
        locationValue: "Southfield, MI",
        radiusMiles: 5,
        budget: { max: 425000 },
        minSqft: 1800,
        minBedrooms: 3
      }
    });
    await app.inject({
      method: "POST",
      url: "/search",
      payload: {
        locationType: "city",
        locationValue: "Southfield, MI",
        radiusMiles: 5,
        budget: { max: 425000 },
        minSqft: 1800,
        minBedrooms: 3
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/metrics"
    });
    const payload = response.json();

    expect(payload.crimeProviderLatencyMs.count).toBeGreaterThan(0);
    expect(payload.schoolProviderLatencyMs.count).toBeGreaterThan(0);
    expect(payload.safetyLiveFetchRate.liveFetches).toBeGreaterThan(0);
    expect(payload.safetyCacheHitRate.hits).toBeGreaterThan(0);
  });
});
