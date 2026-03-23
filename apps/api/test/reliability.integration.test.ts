import {
  InMemoryGeocodeCacheRepository,
  InMemoryListingCacheRepository,
  InMemoryMarketSnapshotRepository,
  InMemorySafetySignalCacheRepository,
  InMemorySearchRepository
} from "@nhalo/db";
import { createMockProviders } from "@nhalo/providers";
import type { ListingRecord, SafetyRecord } from "@nhalo/types";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { MetricsCollector } from "../src/metrics";

describe("reliability infrastructure", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let marketSnapshotRepository: InMemoryMarketSnapshotRepository;

  beforeAll(async () => {
    marketSnapshotRepository = new InMemoryMarketSnapshotRepository();
    const repository = new InMemorySearchRepository();
    const metrics = new MetricsCollector();
    const baseProviders = createMockProviders();
    let failSafety = false;

    app = await buildApp({
      marketSnapshotRepository,
      metrics,
      repository,
      geocodeCacheRepository: new InMemoryGeocodeCacheRepository(),
      listingCacheRepository: new InMemoryListingCacheRepository(),
      safetySignalCacheRepository: new InMemorySafetySignalCacheRepository(),
      providers: {
        ...baseProviders,
        safety: {
          name: "failing-safety",
          async fetchSafetyData(listings: ListingRecord[]): Promise<Map<string, SafetyRecord>> {
            if (failSafety) {
              throw new Error("Safety provider failure");
            }

            return baseProviders.safety.fetchSafetyData(listings);
          },
          async getStatus() {
            return baseProviders.safety.getStatus();
          }
        }
      }
    });

    const firstResponse = await app.inject({
      method: "POST",
      url: "/search",
      payload: {
        locationType: "city",
        locationValue: "Southfield, MI",
        radiusMiles: 5,
        budget: {
          max: 425000
        },
        minSqft: 1800,
        minBedrooms: 3
      }
    });

    expect(firstResponse.statusCode).toBe(200);
    failSafety = true;
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves a stored audit record without recomputing scores", async () => {
    const searchResponse = await app.inject({
      method: "POST",
      url: "/search",
      payload: {
        locationType: "city",
        locationValue: "Southfield, MI",
        radiusMiles: 5,
        budget: {
          max: 425000
        },
        minSqft: 1800,
        minBedrooms: 3
      }
    });

    expect(searchResponse.statusCode).toBe(200);
    const searchPayload = searchResponse.json();
    const firstHome = searchPayload.homes[0];

    const auditResponse = await app.inject({
      method: "GET",
      url: `/scores/audit/${firstHome.id}`
    });

    expect(auditResponse.statusCode).toBe(200);
    expect(auditResponse.json()).toMatchObject({
      propertyId: firstHome.id,
      formulaVersion: "nhalo-v1",
      inputs: {
        price: firstHome.price,
        squareFootage: firstHome.sqft,
        bedrooms: firstHome.bedrooms,
        bathrooms: firstHome.bathrooms,
        lotSize: firstHome.lotSqft ?? null,
        crimeIndex: expect.anything(),
        schoolRating: expect.anything(),
        neighborhoodStability: expect.anything(),
        pricePerSqft: expect.any(Number),
        medianPricePerSqft: expect.any(Number),
        dataCompleteness: expect.any(Number)
      },
      weights: {
        price: 40,
        size: 30,
        safety: 30
      },
      subScores: {
        price: firstHome.scores.price,
        size: firstHome.scores.size,
        safety: firstHome.scores.safety
      },
      finalScore: firstHome.scores.nhalo,
      computedAt: expect.any(String),
      safetyConfidence: firstHome.scores.safetyConfidence,
      overallConfidence: firstHome.scores.overallConfidence
    });
  });

  it("falls back to cached provider data and records degraded provider status", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/search",
      payload: {
        locationType: "city",
        locationValue: "Southfield, MI",
        radiusMiles: 5,
        budget: {
          max: 425000
        },
        minSqft: 1800,
        minBedrooms: 3
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.homes.length).toBeGreaterThan(0);

    const providerStatusResponse = await app.inject({
      method: "GET",
      url: "/providers/status"
    });

    expect(providerStatusResponse.statusCode).toBe(200);
    const statusPayload = providerStatusResponse.json();
    const safetyStatus = statusPayload.providers.find(
      (provider: { providerName: string }) => provider.providerName === "SafetyProvider"
    );

    expect(safetyStatus.failureCount).toBeGreaterThan(0);
    expect(safetyStatus.status).toBe("degraded");
  });

  it("reuses a fresh market snapshot and exposes metrics", async () => {
    expect(marketSnapshotRepository.snapshots).toHaveLength(1);

    const metricsResponse = await app.inject({
      method: "GET",
      url: "/metrics"
    });

    expect(metricsResponse.statusCode).toBe(200);
    const metricsPayload = metricsResponse.json();

    expect(metricsPayload.searchLatencyMs.count).toBeGreaterThanOrEqual(3);
    expect(metricsPayload.providerFailureRate["failing-safety"].failures).toBeGreaterThan(0);
    expect(metricsPayload.scoreDistribution.count).toBeGreaterThan(0);
  });
});
