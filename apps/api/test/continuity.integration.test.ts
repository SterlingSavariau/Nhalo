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

describe("search continuity", () => {
  const sessionId = "session-test-123";
  const repository = new InMemorySearchRepository();
  const marketSnapshotRepository = new InMemoryMarketSnapshotRepository();
  const safetySignalCacheRepository = new InMemorySafetySignalCacheRepository();
  const listingCacheRepository = new InMemoryListingCacheRepository();
  const geocodeCacheRepository = new InMemoryGeocodeCacheRepository();
  const providers = createMockProviders();
  const metrics = new MetricsCollector();
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
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

  afterAll(async () => {
    await app.close();
  });

  it("handles missing anonymous session id gracefully", async () => {
    const definitionsResponse = await app.inject({
      method: "GET",
      url: "/search/definitions"
    });
    const historyResponse = await app.inject({
      method: "GET",
      url: "/search/history"
    });

    expect(definitionsResponse.statusCode).toBe(200);
    expect(definitionsResponse.json().definitions).toEqual([]);
    expect(historyResponse.statusCode).toBe(200);
    expect(historyResponse.json().history).toEqual([]);
  });

  it("creates, lists, updates, and deletes saved search definitions", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/search/definitions",
      headers: {
        "x-nhalo-session-id": sessionId
      },
      payload: {
        label: "Southfield family search",
        request: {
          locationType: "city",
          locationValue: "Southfield, MI",
          radiusMiles: 5,
          budget: { max: 425000 },
          minSqft: 1800,
          minBedrooms: 3,
          propertyTypes: ["single_family", "condo", "townhome"],
          preferences: [],
          weights: {
            price: 40,
            size: 30,
            safety: 30
          }
        }
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const definition = createResponse.json();

    const listResponse = await app.inject({
      method: "GET",
      url: "/search/definitions",
      headers: {
        "x-nhalo-session-id": sessionId
      }
    });
    expect(listResponse.json().definitions).toHaveLength(1);

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/search/definitions/${definition.id}`,
      payload: {
        pinned: true
      }
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().pinned).toBe(true);

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/search/definitions/${definition.id}`
    });
    expect(deleteResponse.statusCode).toBe(204);
  });

  it("records search history, associates snapshots, and reruns saved definitions as fresh search events", async () => {
    const definitionResponse = await app.inject({
      method: "POST",
      url: "/search/definitions",
      headers: {
        "x-nhalo-session-id": sessionId
      },
      payload: {
        label: "Rerun target",
        request: {
          locationType: "city",
          locationValue: "Southfield, MI",
          radiusMiles: 5,
          budget: { max: 425000 },
          minSqft: 1800,
          minBedrooms: 3,
          propertyTypes: ["single_family", "condo", "townhome"],
          preferences: [],
          weights: {
            price: 40,
            size: 30,
            safety: 30
          }
        }
      }
    });
    const definition = definitionResponse.json();

    const searchResponse = await app.inject({
      method: "POST",
      url: "/search",
      headers: {
        "x-nhalo-session-id": sessionId
      },
      payload: definition.request
    });
    expect(searchResponse.statusCode).toBe(200);
    const searchPayload = searchResponse.json();
    expect(searchPayload.metadata.historyRecordId).toBeTruthy();

    const snapshotResponse = await app.inject({
      method: "POST",
      url: "/search/snapshots",
      headers: {
        "x-nhalo-session-id": sessionId
      },
      payload: {
        request: definition.request,
        response: searchPayload,
        historyRecordId: searchPayload.metadata.historyRecordId,
        searchDefinitionId: definition.id
      }
    });
    expect(snapshotResponse.statusCode).toBe(201);
    const snapshot = snapshotResponse.json();
    expect(snapshot.historyRecordId).toBe(searchPayload.metadata.historyRecordId);

    const historyResponse = await app.inject({
      method: "GET",
      url: "/search/history",
      headers: {
        "x-nhalo-session-id": sessionId
      }
    });
    expect(historyResponse.statusCode).toBe(200);
    const history = historyResponse.json().history;
    expect(history[0].snapshotId).toBe(snapshot.id);

    const rerunResponse = await app.inject({
      method: "POST",
      url: `/search/definitions/${definition.id}/rerun`,
      headers: {
        "x-nhalo-session-id": sessionId
      },
      payload: {
        createSnapshot: true
      }
    });
    expect(rerunResponse.statusCode).toBe(200);
    const rerunPayload = rerunResponse.json();
    expect(rerunPayload.metadata.rerunResultMetadata.sourceType).toBe("definition");
    expect(rerunPayload.metadata.rerunResultMetadata.sourceId).toBe(definition.id);
    expect(rerunPayload.metadata.historyRecordId).not.toBe(searchPayload.metadata.historyRecordId);
    expect(rerunPayload.metadata.rerunResultMetadata.snapshotId).toBeTruthy();

    const metricsResponse = await app.inject({
      method: "GET",
      url: "/metrics"
    });
    const metricsPayload = metricsResponse.json();
    expect(metricsPayload.searchDefinitionCreateCount).toBeGreaterThan(0);
    expect(metricsPayload.searchHistoryReadCount).toBeGreaterThan(0);
    expect(metricsPayload.searchRerunCount).toBeGreaterThan(0);
    expect(metricsPayload.savedSearchPinCount).toBeGreaterThan(0);
  });
});
