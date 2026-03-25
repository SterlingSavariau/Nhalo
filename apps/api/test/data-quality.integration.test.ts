import { resetConfigCache } from "@nhalo/config";
import {
  InMemoryGeocodeCacheRepository,
  InMemoryListingCacheRepository,
  InMemoryMarketSnapshotRepository,
  InMemorySafetySignalCacheRepository,
  InMemorySearchRepository
} from "@nhalo/db";
import { createMockProviders } from "@nhalo/providers";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { MetricsCollector } from "../src/metrics";

const ORIGINAL_ENV = { ...process.env };

describe("data quality operations", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetConfigCache();
  });

  it("records, summarizes, updates, and audits integrity events", async () => {
    process.env.ENABLE_PILOT_OPS = "true";
    process.env.DATA_QUALITY_RULES_ENABLED = "true";
    resetConfigCache();

    const providers = createMockProviders();
    const originalGeocode = providers.geocoder.geocode.bind(providers.geocoder);
    const originalSafety = providers.safety.fetchSafetyData.bind(providers.safety);

    providers.geocoder.geocode = async (locationType, locationValue) => {
      const resolved = await originalGeocode(locationType, locationValue);
      if (!resolved) {
        return null;
      }

      return {
        ...resolved,
        precision: "approximate",
        geocodeDataSource: "stale_cached_live"
      };
    };

    providers.safety.fetchSafetyData = async (listings) => {
      const map = await originalSafety(listings);
      const first = listings[0];
      if (first) {
        const existing = map.get(first.id);
        if (existing) {
          map.set(first.id, {
            ...existing,
            schoolRating: null,
            safetyDataSource: "stale_cached_live"
          });
        }
      }
      return map;
    };

    const repository = new InMemorySearchRepository();
    const app = await buildApp({
      repository,
      marketSnapshotRepository: new InMemoryMarketSnapshotRepository(),
      safetySignalCacheRepository: new InMemorySafetySignalCacheRepository(),
      listingCacheRepository: new InMemoryListingCacheRepository(),
      geocodeCacheRepository: new InMemoryGeocodeCacheRepository(),
      providers,
      metrics: new MetricsCollector()
    });

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

    expect(searchResponse.statusCode).toBe(200);
    const searchPayload = searchResponse.json();
    expect(searchPayload.metadata.integritySummary.totalEvents).toBeGreaterThan(0);

    const listResponse = await app.inject({
      method: "GET",
      url: "/ops/data-quality"
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().events.length).toBeGreaterThan(0);

    const summaryResponse = await app.inject({
      method: "GET",
      url: "/ops/data-quality/summary"
    });
    expect(summaryResponse.statusCode).toBe(200);
    expect(summaryResponse.json().summary.totalEvents).toBeGreaterThan(0);

    const eventId = listResponse.json().events[0].id as string;
    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/ops/data-quality/${eventId}`,
      payload: {
        status: "acknowledged"
      }
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().status).toBe("acknowledged");

    const auditResponse = await app.inject({
      method: "GET",
      url: `/scores/audit/${searchPayload.homes[0].id}`
    });
    expect(auditResponse.statusCode).toBe(200);
    expect(auditResponse.json().dataQuality.events.length).toBeGreaterThan(0);

    const metricsResponse = await app.inject({
      method: "GET",
      url: "/metrics"
    });
    expect(metricsResponse.statusCode).toBe(200);
    expect(metricsResponse.json().dataQualityEventCount).toBeGreaterThan(0);
    expect(metricsResponse.json().criticalQualityEventCount).toBeGreaterThanOrEqual(0);

    await app.close();
  });
});
