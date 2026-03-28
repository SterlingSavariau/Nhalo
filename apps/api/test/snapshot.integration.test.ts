import {
  InMemoryGeocodeCacheRepository,
  InMemoryListingCacheRepository,
  InMemoryMarketSnapshotRepository,
  InMemorySafetySignalCacheRepository,
  InMemorySearchRepository
} from "@nhalo/db";
import { resetConfigCache } from "@nhalo/config";
import { createMockProviders } from "@nhalo/providers";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { MetricsCollector } from "../src/metrics";

const ORIGINAL_ENV = { ...process.env };

describe("search snapshots", () => {
  const repository = new InMemorySearchRepository();
  const marketSnapshotRepository = new InMemoryMarketSnapshotRepository();
  const safetySignalCacheRepository = new InMemorySafetySignalCacheRepository();
  const listingCacheRepository = new InMemoryListingCacheRepository();
  const geocodeCacheRepository = new InMemoryGeocodeCacheRepository();
  const providers = createMockProviders();
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({
      marketSnapshotRepository,
      metrics: new MetricsCollector(),
      repository,
      geocodeCacheRepository,
      listingCacheRepository,
      safetySignalCacheRepository,
      providers
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("stores and reloads immutable search result snapshots without recomputation", async () => {
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

    const searchPayload = searchResponse.json();
    expect(searchPayload.homes[0].strengths.length).toBeGreaterThan(0);
    expect(searchPayload.homes[0].explainability.headline).toBeTruthy();

    const snapshotCreate = await app.inject({
      method: "POST",
      url: "/search/snapshots",
      payload: {
        request: {
          locationType: "city",
          locationValue: "Southfield, MI",
          radiusMiles: 5,
          budget: {
            max: 425000
          },
          minSqft: 1800,
          minBedrooms: 3,
          propertyTypes: ["single_family", "condo", "townhome"],
          preferences: [],
          weights: {
            price: 40,
            size: 30,
            safety: 30
          }
        },
        response: searchPayload
      }
    });

    expect(snapshotCreate.statusCode).toBe(201);
    const snapshot = snapshotCreate.json();
    expect(snapshot.response.homes[0].explainability.headline).toBe(
      searchPayload.homes[0].explainability.headline
    );

    searchPayload.homes[0].address = "mutated locally";

    const snapshotRead = await app.inject({
      method: "GET",
      url: `/search/snapshots/${snapshot.id}`
    });

    expect(snapshotRead.statusCode).toBe(200);
    const storedSnapshot = snapshotRead.json();
    expect(storedSnapshot.response.homes[0].address).not.toBe("mutated locally");
    expect(storedSnapshot.response.homes[0].strengths).toEqual(snapshot.response.homes[0].strengths);
    expect(storedSnapshot.formulaVersion).toBe("nhalo-v1");

    const auditResponse = await app.inject({
      method: "GET",
      url: `/scores/audit/${storedSnapshot.response.homes[0].id}`
    });
    expect(auditResponse.statusCode).toBe(200);
    expect(auditResponse.json().explainability.headline).toBeTruthy();

    for (const eventType of [
      "comparison_view",
      "onboarding_view",
      "onboarding_dismiss",
      "empty_state_view",
      "suggestion_click",
      "detail_panel_open",
      "result_compare_add",
      "snapshot_reopen",
      "saved_search_restore"
    ] as const) {
      await app.inject({
        method: "POST",
        url: "/metrics/events",
        payload: {
          eventType
        }
      });
    }

    const metricsResponse = await app.inject({
      method: "GET",
      url: "/metrics"
    });

    expect(metricsResponse.statusCode).toBe(200);
    const metrics = metricsResponse.json();
    expect(metrics.snapshotCreateCount).toBeGreaterThanOrEqual(1);
    expect(metrics.snapshotReadCount).toBeGreaterThanOrEqual(1);
    expect(metrics.auditViewCount).toBeGreaterThanOrEqual(1);
    expect(metrics.comparisonViewCount).toBeGreaterThanOrEqual(1);
    expect(metrics.onboardingViewCount).toBeGreaterThanOrEqual(1);
    expect(metrics.onboardingDismissCount).toBeGreaterThanOrEqual(1);
    expect(metrics.emptyStateViewCount).toBeGreaterThanOrEqual(1);
    expect(metrics.suggestionClickCount).toBeGreaterThanOrEqual(1);
    expect(metrics.detailPanelOpenCount).toBeGreaterThanOrEqual(1);
    expect(metrics.resultCompareAddCount).toBeGreaterThanOrEqual(1);
    expect(metrics.snapshotReopenCount).toBeGreaterThanOrEqual(1);
    expect(metrics.savedSearchRestoreCount).toBeGreaterThanOrEqual(1);
  });
});

describe("shared snapshot security", () => {
  const repository = new InMemorySearchRepository();
  const marketSnapshotRepository = new InMemoryMarketSnapshotRepository();
  const safetySignalCacheRepository = new InMemorySafetySignalCacheRepository();
  const listingCacheRepository = new InMemoryListingCacheRepository();
  const geocodeCacheRepository = new InMemoryGeocodeCacheRepository();
  const providers = createMockProviders();
  const metrics = new MetricsCollector();
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "test",
      VALIDATION_MODE: "true",
      ENABLE_SHARED_SNAPSHOTS: "true",
      ENABLE_PUBLIC_SHARED_VIEWS: "true"
    };
    resetConfigCache();
  });

  beforeAll(async () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "test",
      VALIDATION_MODE: "true",
      ENABLE_SHARED_SNAPSHOTS: "true",
      ENABLE_PUBLIC_SHARED_VIEWS: "true"
    };
    resetConfigCache();
    app = await buildApp({
      marketSnapshotRepository,
      metrics,
      repository,
      geocodeCacheRepository,
      listingCacheRepository,
      safetySignalCacheRepository,
      providers
    });
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetConfigCache();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns a minimized public shared snapshot view", async () => {
    const searchResponse = await app.inject({
      method: "POST",
      url: "/search",
      payload: {
        locationType: "city",
        locationValue: "Southfield, MI",
        radiusMiles: 5
      }
    });

    const createSnapshot = await app.inject({
      method: "POST",
      url: "/search/snapshots",
      payload: {
        request: {
          locationType: "city",
          locationValue: "Southfield, MI",
          radiusMiles: 5,
          propertyTypes: ["single_family", "condo", "townhome"],
          preferences: [],
          weights: {
            price: 40,
            size: 30,
            safety: 30
          }
        },
        response: {
          ...searchResponse.json(),
          metadata: {
            ...searchResponse.json().metadata,
            sessionId: "private-session",
            historyRecordId: "history-1"
          }
        },
        sessionId: "private-session",
        historyRecordId: "history-1"
      }
    });

    const shareResponse = await app.inject({
      method: "POST",
      url: `/search/snapshots/${createSnapshot.json().id}/share`,
      payload: {}
    });
    const sharedOpen = await app.inject({
      method: "GET",
      url: `/shared/snapshots/${shareResponse.json().share.shareId}`
    });

    expect(sharedOpen.statusCode).toBe(200);
    expect(sharedOpen.json().snapshot.sessionId).toBeUndefined();
    expect(sharedOpen.json().snapshot.historyRecordId).toBeUndefined();
    expect(sharedOpen.json().snapshot.response.metadata.sessionId).toBeUndefined();
    expect(sharedOpen.json().snapshot.response.metadata.historyRecordId).toBeUndefined();
    expect(sharedOpen.json().snapshot.response.metadata.performance).toBeUndefined();
  });

  it("fails shared snapshot access safely for invalid and expired links", async () => {
    const searchResponse = await app.inject({
      method: "POST",
      url: "/search",
      payload: {
        locationType: "city",
        locationValue: "Southfield, MI",
        radiusMiles: 5
      }
    });

    const createSnapshot = await app.inject({
      method: "POST",
      url: "/search/snapshots",
      payload: {
        request: {
          locationType: "city",
          locationValue: "Southfield, MI",
          radiusMiles: 5,
          propertyTypes: ["single_family", "condo", "townhome"],
          preferences: [],
          weights: {
            price: 40,
            size: 30,
            safety: 30
          }
        },
        response: searchResponse.json()
      }
    });

    const expiredShare = await repository.createSharedSnapshot({
      snapshotId: createSnapshot.json().id,
      sessionId: null,
      expiresAt: new Date(Date.now() - 3_600_000).toISOString()
    });

    const invalid = await app.inject({
      method: "GET",
      url: "/shared/snapshots/not-a-real-token"
    });
    const expired = await app.inject({
      method: "GET",
      url: `/shared/snapshots/${expiredShare.shareId}`
    });
    const metricsResponse = await app.inject({
      method: "GET",
      url: "/metrics"
    });

    expect(invalid.statusCode).toBe(404);
    expect(invalid.json().error.code).toBe("LINK_UNAVAILABLE");
    expect(expired.statusCode).toBe(410);
    expect(expired.json().error.code).toBe("LINK_UNAVAILABLE");
    expect(metricsResponse.json().invalidTokenAccessCount).toBeGreaterThanOrEqual(1);
    expect(metricsResponse.json().expiredLinkOpenAttemptCount).toBeGreaterThanOrEqual(1);
  });
});
