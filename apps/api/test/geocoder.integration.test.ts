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

describe("live geocoder integration", () => {
  const originalEnv = {
    GEOCODER_PROVIDER_MODE: process.env.GEOCODER_PROVIDER_MODE,
    GEOCODER_PROVIDER_BASE_URL: process.env.GEOCODER_PROVIDER_BASE_URL,
    GEOCODER_PROVIDER_API_KEY: process.env.GEOCODER_PROVIDER_API_KEY
  };

  let app: Awaited<ReturnType<typeof buildApp>>;
  let metrics: MetricsCollector;
  let geocodeCacheRepository: InMemoryGeocodeCacheRepository;
  let listingCacheRepository: InMemoryListingCacheRepository;
  let safetySignalCacheRepository: InMemorySafetySignalCacheRepository;

  beforeAll(async () => {
    process.env.GEOCODER_PROVIDER_MODE = "hybrid";
    process.env.GEOCODER_PROVIDER_BASE_URL = "https://geocoder.example/api";
    process.env.GEOCODER_PROVIDER_API_KEY = "geo-key";

    metrics = new MetricsCollector();
    geocodeCacheRepository = new InMemoryGeocodeCacheRepository();
    listingCacheRepository = new InMemoryListingCacheRepository();
    safetySignalCacheRepository = new InMemorySafetySignalCacheRepository();

    const providers = createProviders({
      geocodeCacheRepository,
      listingCacheRepository,
      safetySignalCacheRepository,
      metrics,
      fetcher: async (input) => {
        const url = new URL(String(input));

        if (!url.hostname.includes("geocoder.example")) {
          return new Response(JSON.stringify({}), {
            status: 404,
            headers: { "content-type": "application/json" }
          });
        }

        const locationType = url.searchParams.get("locationType");
        const locationValue = url.searchParams.get("locationValue");

        if (locationType === "address" && locationValue === "10 Main St") {
          return new Response(
            JSON.stringify([
              { formattedAddress: "10 Main St, Detroit, MI", latitude: 42.33, longitude: -83.04 },
              { formattedAddress: "10 Main St, Royal Oak, MI", latitude: 42.49, longitude: -83.14 }
            ]),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }

        if (locationType === "address") {
          return new Response(
            JSON.stringify({
              results: [
                {
                  formattedAddress: "28510 Pierce St, Southfield, MI 48076, USA",
                  latitude: 42.5004,
                  longitude: -83.2208,
                  precision: "rooftop",
                  city: "Southfield",
                  state: "MI",
                  postalCode: "48076"
                }
              ],
              fetchedAt: "2026-03-22T20:15:00Z"
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }

        if (locationType === "zip") {
          return new Response(
            JSON.stringify({
              results: [
                {
                  formattedAddress: "48075, Southfield, MI, USA",
                  latitude: 42.4841,
                  longitude: -83.2542,
                  precision: "centroid",
                  city: "Southfield",
                  state: "MI",
                  postalCode: "48075"
                }
              ],
              fetchedAt: "2026-03-22T20:15:00Z"
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            results: [
              {
                formattedAddress: "Southfield, MI, USA",
                latitude: 42.4734,
                longitude: -83.2219,
                precision: "centroid",
                city: "Southfield",
                state: "MI",
                postalCode: "48075"
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
    process.env.GEOCODER_PROVIDER_MODE = originalEnv.GEOCODER_PROVIDER_MODE;
    process.env.GEOCODER_PROVIDER_BASE_URL = originalEnv.GEOCODER_PROVIDER_BASE_URL;
    process.env.GEOCODER_PROVIDER_API_KEY = originalEnv.GEOCODER_PROVIDER_API_KEY;
    await app.close();
  });

  it("resolves city, zip, and address origins and exposes origin metadata, distance, and provider status", async () => {
    const addressSearch = await app.inject({
      method: "POST",
      url: "/search",
      payload: {
        locationType: "address",
        locationValue: "28510 Pierce St, Southfield, MI 48076",
        radiusMiles: 5,
        budget: { max: 425000 },
        minSqft: 1800,
        minBedrooms: 3
      }
    });

    expect(addressSearch.statusCode).toBe(200);
    const payload = addressSearch.json();
    expect(payload.metadata.searchOrigin).toMatchObject({
      locationType: "address",
      precision: "rooftop",
      geocodeDataSource: "live"
    });
    expect(payload.homes[0].distanceMiles).toBeGreaterThanOrEqual(0);
    expect(payload.homes[0].insideRequestedRadius).toBe(true);

    const auditResponse = await app.inject({
      method: "GET",
      url: `/scores/audit/${payload.homes[0].id}`
    });
    const auditPayload = auditResponse.json();
    expect(auditPayload.searchOrigin).toMatchObject({
      locationType: "address",
      precision: "rooftop",
      geocodeProvider: "geocoder-live-http"
    });
    expect(auditPayload.spatialContext).toMatchObject({
      radiusMiles: 5,
      insideRequestedRadius: true
    });

    await app.inject({
      method: "POST",
      url: "/search",
      payload: {
        locationType: "zip",
        locationValue: "48075",
        radiusMiles: 5
      }
    });

    const providerStatusResponse = await app.inject({
      method: "GET",
      url: "/providers/status"
    });
    const providerStatusPayload = providerStatusResponse.json();
    const geocoderProvider = providerStatusPayload.providers.find(
      (provider: { providerName: string }) => provider.providerName === "GeocoderProvider"
    );
    expect(geocoderProvider.children).toHaveLength(1);
    expect(geocoderProvider.children[0].providerName).toBe("GeocodingSourceProvider");
    expect(["live", "cached_live"]).toContain(geocoderProvider.lastSourceUsed);
  });

  it("returns explicit ambiguity errors and geocoder metrics", async () => {
    await app.inject({
      method: "POST",
      url: "/search",
      payload: {
        locationType: "city",
        locationValue: "Southfield, MI",
        radiusMiles: 5
      }
    });

    await app.inject({
      method: "POST",
      url: "/search",
      payload: {
        locationType: "city",
        locationValue: "Southfield, MI",
        radiusMiles: 5
      }
    });

    const ambiguousResponse = await app.inject({
      method: "POST",
      url: "/search",
      payload: {
        locationType: "address",
        locationValue: "10 Main St",
        radiusMiles: 5
      }
    });

    expect(ambiguousResponse.statusCode).toBe(409);
    expect(ambiguousResponse.json().error.code).toBe("AMBIGUOUS_ADDRESS");

    const metricsResponse = await app.inject({
      method: "GET",
      url: "/metrics"
    });
    const metricsPayload = metricsResponse.json();

    expect(metricsPayload.geocoderLatencyMs.count).toBeGreaterThan(0);
    expect(metricsPayload.geocodeLiveFetchRate.liveFetches).toBeGreaterThan(0);
    expect(metricsPayload.geocodeCacheHitRate.hits).toBeGreaterThan(0);
    expect(metricsPayload.geocodeAmbiguityRate.ambiguous).toBeGreaterThan(0);
    expect(metricsPayload.geocodePrecisionDistribution.rooftop).toBeGreaterThan(0);
  });
});
