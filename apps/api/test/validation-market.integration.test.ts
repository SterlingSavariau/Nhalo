import { resetConfigCache } from "@nhalo/config";
import {
  InMemoryGeocodeCacheRepository,
  InMemoryListingCacheRepository,
  InMemoryMarketSnapshotRepository,
  InMemorySafetySignalCacheRepository,
  InMemorySearchRepository
} from "@nhalo/db";
import { createMockProviders } from "@nhalo/providers";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { MetricsCollector } from "../src/metrics";

const ORIGINAL_ENV = { ...process.env };

describe("market validation flows", () => {
  const repository = new InMemorySearchRepository();
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.VALIDATION_MODE = "true";
    process.env.ENABLE_SHARED_SNAPSHOTS = "true";
    process.env.ENABLE_DEMO_SCENARIOS = "true";
    process.env.ENABLE_FEEDBACK_CAPTURE = "true";
    resetConfigCache();

    app = await buildApp({
      repository,
      marketSnapshotRepository: new InMemoryMarketSnapshotRepository(),
      safetySignalCacheRepository: new InMemorySafetySignalCacheRepository(),
      listingCacheRepository: new InMemoryListingCacheRepository(),
      geocodeCacheRepository: new InMemoryGeocodeCacheRepository(),
      providers: createMockProviders(),
      metrics: new MetricsCollector()
    });
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(async () => {
    await app.close();
    process.env = { ...ORIGINAL_ENV };
    resetConfigCache();
  });

  it("creates read-only shared snapshot links and aggregates validation feedback", async () => {
    const searchResponse = await app.inject({
      method: "POST",
      url: "/search",
      headers: {
        "x-nhalo-session-id": "session-validation"
      },
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

    const snapshotResponse = await app.inject({
      method: "POST",
      url: "/search/snapshots",
      headers: {
        "x-nhalo-session-id": "session-validation"
      },
      payload: {
        request: {
          locationType: "city",
          locationValue: "Southfield, MI",
          radiusMiles: 5,
          budget: { max: 425000 },
          minSqft: 1800,
          minBedrooms: 3,
          propertyTypes: ["single_family", "condo", "townhome"],
          preferences: [],
          weights: { price: 40, size: 30, safety: 30 }
        },
        response: searchResponse.json()
      }
    });
    expect(snapshotResponse.statusCode).toBe(201);
    const snapshot = snapshotResponse.json();

    const shareCreate = await app.inject({
      method: "POST",
      url: `/search/snapshots/${snapshot.id}/share`,
      headers: {
        "x-nhalo-session-id": "session-validation"
      },
      payload: {
        expiresInDays: 7
      }
    });
    expect(shareCreate.statusCode).toBe(201);
    const sharePayload = shareCreate.json();
    expect(sharePayload.readOnly).toBe(true);
    expect(sharePayload.share.shareId).toBeTruthy();

    const sharedRead = await app.inject({
      method: "GET",
      url: `/shared/snapshots/${sharePayload.share.shareId}`
    });
    expect(sharedRead.statusCode).toBe(200);
    const sharedView = sharedRead.json();
    expect(sharedView.readOnly).toBe(true);
    expect(sharedView.snapshot.id).toBe(snapshot.id);
    expect(sharedView.snapshot.response.homes[0].address).toBe(snapshot.response.homes[0].address);

    const feedback = await app.inject({
      method: "POST",
      url: "/feedback",
      headers: {
        "x-nhalo-session-id": "session-validation"
      },
      payload: {
        snapshotId: snapshot.id,
        category: "useful",
        value: "positive",
        comment: "This felt clear for a family buyer."
      }
    });
    expect(feedback.statusCode).toBe(201);

    const validationEvent = await app.inject({
      method: "POST",
      url: "/validation/events",
      headers: {
        "x-nhalo-session-id": "session-validation"
      },
      payload: {
        eventName: "demo_scenario_started",
        demoScenarioId: "southfield-family-balance"
      }
    });
    expect(validationEvent.statusCode).toBe(202);

    await app.inject({
      method: "POST",
      url: "/metrics/events",
      payload: {
        eventType: "validation_prompt_view"
      }
    });
    await app.inject({
      method: "POST",
      url: "/metrics/events",
      payload: {
        eventType: "validation_prompt_response"
      }
    });
    await app.inject({
      method: "POST",
      url: "/metrics/events",
      payload: {
        eventType: "demo_scenario_start"
      }
    });

    const summary = await app.inject({
      method: "GET",
      url: "/validation/summary"
    });
    expect(summary.statusCode).toBe(200);
    expect(summary.json().shareableSnapshotsCreated).toBeGreaterThanOrEqual(1);
    expect(summary.json().sharedSnapshotOpens).toBeGreaterThanOrEqual(1);
    expect(summary.json().feedbackSubmissionRate.feedbackCount).toBeGreaterThanOrEqual(1);
    expect(summary.json().topDemoScenariosUsed[0].demoScenarioId).toBe("southfield-family-balance");

    const metrics = await app.inject({
      method: "GET",
      url: "/metrics"
    });
    expect(metrics.statusCode).toBe(200);
    expect(metrics.json().sharedSnapshotCreateCount).toBeGreaterThanOrEqual(1);
    expect(metrics.json().sharedSnapshotOpenCount).toBeGreaterThanOrEqual(1);
    expect(metrics.json().feedbackSubmitCount).toBeGreaterThanOrEqual(1);
    expect(metrics.json().validationPromptViewCount).toBeGreaterThanOrEqual(1);
    expect(metrics.json().validationPromptResponseCount).toBeGreaterThanOrEqual(1);
    expect(metrics.json().demoScenarioStartCount).toBeGreaterThanOrEqual(1);
    expect(metrics.json().validationSummaryReadCount).toBeGreaterThanOrEqual(1);
  });

  it("returns explicit feature-disabled errors when validation features are off", async () => {
    process.env.NODE_ENV = "test";
    process.env.VALIDATION_MODE = "false";
    process.env.ENABLE_SHARED_SNAPSHOTS = "false";
    process.env.ENABLE_DEMO_SCENARIOS = "false";
    process.env.ENABLE_FEEDBACK_CAPTURE = "false";
    resetConfigCache();

    const disabledApp = await buildApp({
      repository: new InMemorySearchRepository(),
      marketSnapshotRepository: new InMemoryMarketSnapshotRepository(),
      safetySignalCacheRepository: new InMemorySafetySignalCacheRepository(),
      listingCacheRepository: new InMemoryListingCacheRepository(),
      geocodeCacheRepository: new InMemoryGeocodeCacheRepository(),
      providers: createMockProviders(),
      metrics: new MetricsCollector()
    });

    const demoResponse = await disabledApp.inject({
      method: "GET",
      url: "/validation/demo-scenarios"
    });
    expect(demoResponse.statusCode).toBe(404);
    expect(demoResponse.json().error.code).toBe("FEATURE_DISABLED");

    const feedbackResponse = await disabledApp.inject({
      method: "POST",
      url: "/feedback",
      payload: {
        category: "general",
        value: "positive"
      }
    });
    expect(feedbackResponse.statusCode).toBe(404);
    expect(feedbackResponse.json().error.code).toBe("FEATURE_DISABLED");

    await disabledApp.close();
  });
});
