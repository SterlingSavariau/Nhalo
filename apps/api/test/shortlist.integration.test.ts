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

const capturedHome = {
  id: "home-1",
  address: "123 Main St",
  city: "Southfield",
  state: "MI",
  zipCode: "48075",
  propertyType: "single_family",
  price: 385000,
  sqft: 2100,
  bedrooms: 4,
  bathrooms: 3,
  canonicalPropertyId: "canonical-123-main",
  distanceMiles: 2.1,
  insideRequestedRadius: true,
  qualityFlags: [],
  strengths: ["Strong neighborhood safety"],
  risks: ["Moderate price pressure"],
  confidenceReasons: [],
  explainability: {
    headline: "Strong family fit",
    strengths: ["Strong neighborhood safety"],
    risks: ["Moderate price pressure"],
    scoreDrivers: {
      primary: "safety",
      secondary: "size",
      weakest: "price"
    }
  },
  provenance: {
    listingDataSource: "live",
    listingProvider: "ListingProvider",
    listingFetchedAt: null,
    sourceListingId: "src-1",
    safetyDataSource: "cached_live",
    crimeProvider: "CrimeProvider",
    schoolProvider: "SchoolProvider",
    crimeFetchedAt: null,
    schoolFetchedAt: null,
    geocodeDataSource: "live",
    geocodeProvider: "GeocoderProvider",
    geocodeFetchedAt: null,
    geocodePrecision: "rooftop"
  },
  neighborhoodSafetyScore: 84,
  explanation: "Strong family fit",
  scores: {
    price: 71,
    size: 78,
    safety: 84,
    nhalo: 77,
    safetyConfidence: "high",
    overallConfidence: "high",
    formulaVersion: "nhalo-v1"
  }
} as const;

describe("shortlist workflow", () => {
  const sessionId = "workflow-session-1";
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

  it("creates shortlists, adds items, manages notes, and records workflow metrics", async () => {
    const createShortlistResponse = await app.inject({
      method: "POST",
      url: "/shortlists",
      headers: {
        "x-nhalo-session-id": sessionId
      },
      payload: {
        title: "Family review shortlist",
        description: "Used for pilot follow-up."
      }
    });

    expect(createShortlistResponse.statusCode).toBe(201);
    const shortlist = createShortlistResponse.json();

    const addItemResponse = await app.inject({
      method: "POST",
      url: `/shortlists/${shortlist.id}/items`,
      payload: {
        canonicalPropertyId: capturedHome.canonicalPropertyId,
        capturedHome
      }
    });

    expect(addItemResponse.statusCode).toBe(201);
    const shortlistItem = addItemResponse.json();

    const updateReviewResponse = await app.inject({
      method: "PATCH",
      url: `/shortlists/${shortlist.id}/items/${shortlistItem.id}`,
      payload: {
        reviewState: "interested"
      }
    });
    expect(updateReviewResponse.statusCode).toBe(200);
    expect(updateReviewResponse.json().reviewState).toBe("interested");

    const createNoteResponse = await app.inject({
      method: "POST",
      url: "/notes",
      headers: {
        "x-nhalo-session-id": sessionId
      },
      payload: {
        entityType: "shortlist_item",
        entityId: shortlistItem.id,
        body: "Good fit for the family safety discussion."
      }
    });
    expect(createNoteResponse.statusCode).toBe(201);
    const note = createNoteResponse.json();

    const listItemsResponse = await app.inject({
      method: "GET",
      url: `/shortlists/${shortlist.id}/items`
    });
    expect(listItemsResponse.statusCode).toBe(200);
    expect(listItemsResponse.json().items).toHaveLength(1);

    const listNotesResponse = await app.inject({
      method: "GET",
      url: `/notes?entityType=shortlist_item&entityId=${shortlistItem.id}`,
      headers: {
        "x-nhalo-session-id": sessionId
      }
    });
    expect(listNotesResponse.statusCode).toBe(200);
    expect(listNotesResponse.json().notes).toHaveLength(1);

    const updateNoteResponse = await app.inject({
      method: "PATCH",
      url: `/notes/${note.id}`,
      payload: {
        body: "Still a strong candidate after review."
      }
    });
    expect(updateNoteResponse.statusCode).toBe(200);
    expect(updateNoteResponse.json().body).toContain("strong candidate");

    const workflowActivityResponse = await app.inject({
      method: "GET",
      url: "/workflow/activity?limit=10",
      headers: {
        "x-nhalo-session-id": sessionId
      }
    });
    expect(workflowActivityResponse.statusCode).toBe(200);
    expect(workflowActivityResponse.json().activity.length).toBeGreaterThanOrEqual(4);

    const deleteNoteResponse = await app.inject({
      method: "DELETE",
      url: `/notes/${note.id}`
    });
    expect(deleteNoteResponse.statusCode).toBe(204);

    const removeItemResponse = await app.inject({
      method: "DELETE",
      url: `/shortlists/${shortlist.id}/items/${shortlistItem.id}`
    });
    expect(removeItemResponse.statusCode).toBe(204);

    const deleteShortlistResponse = await app.inject({
      method: "DELETE",
      url: `/shortlists/${shortlist.id}`
    });
    expect(deleteShortlistResponse.statusCode).toBe(204);

    const metricsResponse = await app.inject({
      method: "GET",
      url: "/metrics"
    });
    const payload = metricsResponse.json();
    expect(payload.shortlistCreateCount).toBe(1);
    expect(payload.shortlistDeleteCount).toBe(1);
    expect(payload.shortlistItemAddCount).toBe(1);
    expect(payload.shortlistItemRemoveCount).toBe(1);
    expect(payload.noteCreateCount).toBe(1);
    expect(payload.noteUpdateCount).toBe(1);
    expect(payload.noteDeleteCount).toBe(1);
    expect(payload.reviewStateChangeCount).toBe(1);
    expect(payload.shortlistViewCount).toBeGreaterThan(0);
  });

  it("creates shared shortlist links, supports collaboration comments and reviewer decisions, and records metrics", async () => {
    const createShortlistResponse = await app.inject({
      method: "POST",
      url: "/shortlists",
      headers: {
        "x-nhalo-session-id": sessionId
      },
      payload: {
        title: "Partner review shortlist"
      }
    });
    const shortlist = createShortlistResponse.json();

    const addItemResponse = await app.inject({
      method: "POST",
      url: `/shortlists/${shortlist.id}/items`,
      payload: {
        canonicalPropertyId: capturedHome.canonicalPropertyId,
        capturedHome
      }
    });
    const shortlistItem = addItemResponse.json();

    const shareResponse = await app.inject({
      method: "POST",
      url: `/shortlists/${shortlist.id}/share`,
      headers: {
        "x-nhalo-session-id": sessionId
      },
      payload: {
        shareMode: "review_only"
      }
    });
    expect(shareResponse.statusCode).toBe(201);
    const sharePayload = shareResponse.json();

    const openSharedResponse = await app.inject({
      method: "GET",
      url: `/shared/shortlists/${sharePayload.share.shareId}`
    });
    expect(openSharedResponse.statusCode).toBe(200);
    expect(openSharedResponse.json().items).toHaveLength(1);

    const createCommentResponse = await app.inject({
      method: "POST",
      url: "/comments",
      payload: {
        shareId: sharePayload.share.shareId,
        entityType: "shared_shortlist_item",
        entityId: shortlistItem.id,
        authorLabel: "Partner",
        body: "This one looks worth discussing."
      }
    });
    expect(createCommentResponse.statusCode).toBe(201);
    const comment = createCommentResponse.json();

    const updateCommentResponse = await app.inject({
      method: "PATCH",
      url: `/comments/${comment.id}`,
      payload: {
        body: "Still worth discussing after review."
      }
    });
    expect(updateCommentResponse.statusCode).toBe(200);

    const decisionResponse = await app.inject({
      method: "POST",
      url: "/reviewer-decisions",
      payload: {
        shareId: sharePayload.share.shareId,
        shortlistItemId: shortlistItem.id,
        decision: "favorite",
        note: "Best balance of safety and space."
      }
    });
    expect(decisionResponse.statusCode).toBe(201);

    const activityResponse = await app.inject({
      method: "GET",
      url: `/collaboration/activity?shareId=${sharePayload.share.shareId}`
    });
    expect(activityResponse.statusCode).toBe(200);
    expect(activityResponse.json().activity.length).toBeGreaterThanOrEqual(3);

    const revokeResponse = await app.inject({
      method: "POST",
      url: `/shortlists/shares/${sharePayload.share.shareId}/revoke`
    });
    expect(revokeResponse.statusCode).toBe(200);

    const revokedOpenResponse = await app.inject({
      method: "GET",
      url: `/shared/shortlists/${sharePayload.share.shareId}`
    });
    expect(revokedOpenResponse.statusCode).toBe(410);

    const metricsResponse = await app.inject({
      method: "GET",
      url: "/metrics"
    });
    const payload = metricsResponse.json();
    expect(payload.shortlistShareCreateCount).toBeGreaterThan(0);
    expect(payload.shortlistShareOpenCount).toBeGreaterThan(0);
    expect(payload.shortlistShareRevokeCount).toBeGreaterThan(0);
    expect(payload.sharedCommentCreateCount).toBeGreaterThan(0);
    expect(payload.sharedCommentUpdateCount).toBeGreaterThan(0);
    expect(payload.reviewerDecisionCreateCount).toBeGreaterThan(0);
    expect(payload.collaborationActivityReadCount).toBeGreaterThan(0);
  });

  it("sanitizes shared shortlist output and blocks writes after revocation", async () => {
    const createShortlistResponse = await app.inject({
      method: "POST",
      url: "/shortlists",
      headers: {
        "x-nhalo-session-id": sessionId
      },
      payload: {
        title: "Security shortlist"
      }
    });
    const shortlist = createShortlistResponse.json();

    const addItemResponse = await app.inject({
      method: "POST",
      url: `/shortlists/${shortlist.id}/items`,
      payload: {
        canonicalPropertyId: capturedHome.canonicalPropertyId,
        sourceSnapshotId: "snapshot-123",
        sourceHistoryId: "history-123",
        sourceSearchDefinitionId: "definition-123",
        capturedHome
      }
    });
    const shortlistItem = addItemResponse.json();

    const shareResponse = await app.inject({
      method: "POST",
      url: `/shortlists/${shortlist.id}/share`,
      headers: {
        "x-nhalo-session-id": sessionId
      },
      payload: {
        shareMode: "comment_only"
      }
    });
    const shareId = shareResponse.json().share.shareId;

    const sharedOpen = await app.inject({
      method: "GET",
      url: `/shared/shortlists/${shareId}`
    });
    expect(sharedOpen.statusCode).toBe(200);
    expect(sharedOpen.json().share.sessionId).toBeUndefined();
    expect(sharedOpen.json().shortlist.sessionId).toBeUndefined();
    expect(sharedOpen.json().items[0].sourceSnapshotId).toBeUndefined();
    expect(sharedOpen.json().items[0].sourceHistoryId).toBeUndefined();
    expect(sharedOpen.json().items[0].sourceSearchDefinitionId).toBeUndefined();

    const commentResponse = await app.inject({
      method: "POST",
      url: "/comments",
      payload: {
        shareId,
        entityType: "shared_shortlist_item",
        entityId: shortlistItem.id,
        body: "Leave this on the list."
      }
    });
    expect(commentResponse.statusCode).toBe(201);

    const revokeResponse = await app.inject({
      method: "POST",
      url: `/shortlists/shares/${shareId}/revoke`
    });
    expect(revokeResponse.statusCode).toBe(200);

    const blockedCommentUpdate = await app.inject({
      method: "PATCH",
      url: `/comments/${commentResponse.json().id}`,
      payload: {
        body: "This should be blocked."
      }
    });
    expect(blockedCommentUpdate.statusCode).toBe(410);

    const metricsResponse = await app.inject({
      method: "GET",
      url: "/metrics"
    });
    expect(metricsResponse.json().shareRevocationEnforcementCount).toBeGreaterThanOrEqual(1);
  });
});
