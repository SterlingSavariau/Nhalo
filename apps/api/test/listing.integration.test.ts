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

describe("live listing integration", () => {
  const originalEnv = {
    LISTING_PROVIDER_MODE: process.env.LISTING_PROVIDER_MODE,
    LISTING_PROVIDER_BASE_URL: process.env.LISTING_PROVIDER_BASE_URL,
    LISTING_PROVIDER_API_KEY: process.env.LISTING_PROVIDER_API_KEY
  };

  let app: Awaited<ReturnType<typeof buildApp>>;
  let metrics: MetricsCollector;
  let listingCacheRepository: InMemoryListingCacheRepository;
  let safetySignalCacheRepository: InMemorySafetySignalCacheRepository;
  let geocodeCacheRepository: InMemoryGeocodeCacheRepository;

  beforeAll(async () => {
    process.env.LISTING_PROVIDER_MODE = "hybrid";
    process.env.LISTING_PROVIDER_BASE_URL = "https://listing.example/api";
    process.env.LISTING_PROVIDER_API_KEY = "listing-key";

    metrics = new MetricsCollector();
    listingCacheRepository = new InMemoryListingCacheRepository();
    safetySignalCacheRepository = new InMemorySafetySignalCacheRepository();
    geocodeCacheRepository = new InMemoryGeocodeCacheRepository();

    const providers = createProviders({
      geocodeCacheRepository,
      listingCacheRepository,
      safetySignalCacheRepository,
      metrics,
      fetcher: async (input) => {
        const url = String(input);

        if (!url.includes("listing.example")) {
          return new Response(JSON.stringify({}), {
            status: 404,
            headers: { "content-type": "application/json" }
          });
        }

        return new Response(
          JSON.stringify({
            listings: [
              {
                listingId: "live-001",
                address: "123 Main St",
                city: "Southfield",
                state: "MI",
                zipCode: "48075",
                lat: 42.4801,
                lng: -83.2212,
                propertyType: "Single Family",
                price: 318000,
                squareFootage: 2040,
                bedrooms: 3,
                bathrooms: 2.5,
                lotSize: 7200,
                daysOnMarket: 12,
                sourceUrl: "https://listing.example/live-001"
              },
              {
                listingId: "live-002",
                address: "456 Family Ct",
                city: "Southfield",
                state: "MI",
                zipCode: "48075",
                lat: 42.4798,
                lng: -83.2231,
                propertyType: "Townhome",
                price: 289000,
                squareFootage: 1860,
                bedrooms: 3,
                bathrooms: 2.5,
                lotSize: 2600,
                sourceUrl: "https://listing.example/live-002"
              },
              {
                listingId: "invalid-001",
                address: "789 Broken Ave",
                city: "Southfield",
                state: "MI",
                zipCode: "48075",
                lat: 0,
                lng: 999,
                propertyType: "Single Family",
                price: 250000
              }
            ],
            fetchedAt: "2026-03-22T20:15:00Z"
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
    });

    app = await buildApp({
      geocodeCacheRepository,
      listingCacheRepository,
      marketSnapshotRepository: new InMemoryMarketSnapshotRepository(),
      metrics,
      providers,
      repository: new InMemorySearchRepository(),
      safetySignalCacheRepository
    });
  });

  afterAll(async () => {
    process.env.LISTING_PROVIDER_MODE = originalEnv.LISTING_PROVIDER_MODE;
    process.env.LISTING_PROVIDER_BASE_URL = originalEnv.LISTING_PROVIDER_BASE_URL;
    process.env.LISTING_PROVIDER_API_KEY = originalEnv.LISTING_PROVIDER_API_KEY;
    await app.close();
  });

  it("reports listing child providers and exposes listing provenance in results and audit", async () => {
    const searchResponse = await app.inject({
      method: "POST",
      url: "/search",
      payload: {
        locationType: "city",
        locationValue: "Southfield, MI",
        radiusMiles: 5,
        budget: { max: 400000 },
        minSqft: 1800,
        minBedrooms: 3
      }
    });

    expect(searchResponse.statusCode).toBe(200);
    const searchPayload = searchResponse.json();
    expect(searchPayload.homes[0]).toMatchObject({
      listingDataSource: "live",
      listingProvider: "listing-live-http",
      sourceListingId: expect.any(String),
      listingFetchedAt: expect.any(String)
    });
    expect(
      searchPayload.metadata.rejectionSummary.invalidCoordinates +
        searchPayload.metadata.rejectionSummary.missingSquareFootage
    ).toBe(1);

    const providerStatusResponse = await app.inject({
      method: "GET",
      url: "/providers/status"
    });
    const providerStatusPayload = providerStatusResponse.json();
    const listingProvider = providerStatusPayload.providers.find(
      (provider: { providerName: string }) => provider.providerName === "ListingProvider"
    );

    expect(listingProvider.lastSourceUsed).toBe("live");
    expect(listingProvider.children).toHaveLength(1);
    expect(listingProvider.children[0].providerName).toBe("ListingSourceProvider");

    const auditResponse = await app.inject({
      method: "GET",
      url: `/scores/audit/${searchPayload.homes[0].id}`
    });
    const auditPayload = auditResponse.json();

    expect(auditPayload.listingProvenance).toMatchObject({
      listingDataSource: "live",
      listingProvider: "listing-live-http",
      sourceListingId: expect.any(String),
      listingFetchedAt: expect.any(String),
      rawListingInputs: expect.any(Object),
      normalizedListingInputs: expect.any(Object)
    });
  });

  it("records cache hits and listing-specific metrics on repeated searches", async () => {
    await app.inject({
      method: "POST",
      url: "/search",
      payload: {
        locationType: "city",
        locationValue: "Southfield, MI",
        radiusMiles: 5,
        budget: { max: 400000 },
        minSqft: 1800,
        minBedrooms: 3
      }
    });

    const metricsResponse = await app.inject({
      method: "GET",
      url: "/metrics"
    });
    const metricsPayload = metricsResponse.json();

    expect(metricsPayload.listingProviderLatencyMs.count).toBeGreaterThan(0);
    expect(metricsPayload.listingLiveFetchRate.liveFetches).toBeGreaterThan(0);
    expect(metricsPayload.listingCacheHitRate.hits).toBeGreaterThan(0);
    expect(metricsPayload.listingNormalizationFailureRate.failures).toBeGreaterThan(0);
    expect(metricsPayload.listingResultsReturnedCount.total).toBeGreaterThan(0);
  });
});
