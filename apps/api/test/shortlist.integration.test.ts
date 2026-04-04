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
  listingStatus: "active",
  daysOnMarket: 5,
  pricePerSqft: 183,
  medianPricePerSqft: 190,
  comparableSampleSize: 6,
  comparableStrategyUsed: "local_radius_fallback",
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

  it("marks a selected choice, exposes backups, and clears the summary after dropping the primary item", async () => {
    const createShortlistResponse = await app.inject({
      method: "POST",
      url: "/shortlists",
      headers: {
        "x-nhalo-session-id": sessionId
      },
      payload: {
        title: "Selected choice shortlist"
      }
    });
    expect(createShortlistResponse.statusCode).toBe(201);
    const shortlist = createShortlistResponse.json();

    const primaryHome = {
      ...capturedHome,
      id: "home-primary",
      canonicalPropertyId: "canonical-choice-primary",
      address: "456 Choice Ave"
    };
    const backupHome = {
      ...capturedHome,
      id: "home-backup",
      canonicalPropertyId: "canonical-choice-backup",
      address: "789 Backup Blvd"
    };

    const firstItemResponse = await app.inject({
      method: "POST",
      url: `/shortlists/${shortlist.id}/items`,
      payload: {
        canonicalPropertyId: primaryHome.canonicalPropertyId,
        capturedHome: primaryHome
      }
    });
    expect(firstItemResponse.statusCode).toBe(201);
    const firstItem = firstItemResponse.json();

    const secondItemResponse = await app.inject({
      method: "POST",
      url: `/shortlists/${shortlist.id}/items`,
      payload: {
        canonicalPropertyId: backupHome.canonicalPropertyId,
        capturedHome: backupHome
      }
    });
    expect(secondItemResponse.statusCode).toBe(201);
    const secondItem = secondItemResponse.json();

    const selectPrimaryResponse = await app.inject({
      method: "POST",
      url: `/shortlists/${shortlist.id}/items/${firstItem.id}/select`,
      payload: {
        decisionConfidence: "high",
        decisionRationale: "Best fit after shortlist comparison.",
        lastDecisionReviewedAt: "2026-04-03T13:00:00.000Z"
      }
    });
    expect(selectPrimaryResponse.statusCode).toBe(200);
    expect(selectPrimaryResponse.json().selectedItem.choiceStatus).toBe("selected");

    const reorderResponse = await app.inject({
      method: "POST",
      url: `/shortlists/${shortlist.id}/items/reorder`,
      payload: {
        orderedBackupItemIds: [secondItem.id]
      }
    });
    expect(reorderResponse.statusCode).toBe(200);
    expect(reorderResponse.json().items[1].choiceStatus).toBe("backup");

    const selectedChoiceResponse = await app.inject({
      method: "GET",
      url: `/shortlists/${shortlist.id}/selected-choice`
    });
    expect(selectedChoiceResponse.statusCode).toBe(200);
    expect(selectedChoiceResponse.json().selectedItem.id).toBe(firstItem.id);
    expect(selectedChoiceResponse.json().backups).toHaveLength(1);
    expect(selectedChoiceResponse.json().backups[0].id).toBe(secondItem.id);

    const summaryResponse = await app.inject({
      method: "GET",
      url: `/shortlists/${shortlist.id}/selected-choice/summary`
    });
    expect(summaryResponse.statusCode).toBe(200);
    expect(summaryResponse.json().hasSelectedChoice).toBe(true);
    expect(summaryResponse.json().selectedItemId).toBe(firstItem.id);
    expect(summaryResponse.json().offerStrategy).toMatchObject({
      offerPosture: "not_ready",
      recommendedNextOfferAction: "complete_financial_readiness"
    });
    expect(summaryResponse.json().offerStrategy.marketContext.listingStatus).toBe("active");
    expect(summaryResponse.json().offerStrategy.marketContext.daysOnMarket).toBe(5);

    const dropResponse = await app.inject({
      method: "POST",
      url: `/shortlists/${shortlist.id}/items/${firstItem.id}/drop`,
      payload: {
        droppedReason: "other",
        decisionRationale: "Buyer moved away from this choice."
      }
    });
    expect(dropResponse.statusCode).toBe(200);
    expect(dropResponse.json().item.choiceStatus).toBe("dropped");
    expect(dropResponse.json().summary.hasSelectedChoice).toBe(false);

    const postDropSummaryResponse = await app.inject({
      method: "GET",
      url: `/shortlists/${shortlist.id}/selected-choice/summary`
    });
    expect(postDropSummaryResponse.statusCode).toBe(200);
    expect(postDropSummaryResponse.json().hasSelectedChoice).toBe(false);
    expect(postDropSummaryResponse.json().selectedItemId).toBe(null);
    expect(postDropSummaryResponse.json().offerStrategy).toBe(null);
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

  it("creates offer readiness records, updates them, and returns deterministic recommendations", async () => {
    const createShortlistResponse = await app.inject({
      method: "POST",
      url: "/shortlists",
      headers: {
        "x-nhalo-session-id": sessionId
      },
      payload: {
        title: "Offer readiness shortlist"
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

    const createReadinessResponse = await app.inject({
      method: "POST",
      url: "/offer-readiness",
      payload: {
        shortlistId: shortlist.id,
        propertyId: capturedHome.canonicalPropertyId,
        financingReadiness: "preapproved",
        propertyFitConfidence: "medium",
        riskToleranceAlignment: "partial",
        riskLevel: "balanced",
        userConfirmed: false
      }
    });
    expect(createReadinessResponse.statusCode).toBe(201);
    const createdReadiness = createReadinessResponse.json();
    expect(createdReadiness.propertyId).toBe(capturedHome.canonicalPropertyId);
    expect(createdReadiness.shortlistItemId).toBe(shortlistItem.id);
    expect(createdReadiness.readinessScore).toBeGreaterThan(0);
    expect(createdReadiness.blockingIssues.length).toBeGreaterThan(0);
    expect(createdReadiness.nextSteps).toContain("Finalize offer price");

    const getReadinessResponse = await app.inject({
      method: "GET",
      url: `/offer-readiness/${capturedHome.canonicalPropertyId}?shortlistId=${shortlist.id}`
    });
    expect(getReadinessResponse.statusCode).toBe(200);
    expect(getReadinessResponse.json().id).toBe(createdReadiness.id);

    const patchReadinessResponse = await app.inject({
      method: "PATCH",
      url: `/offer-readiness/${createdReadiness.id}`,
      payload: {
        status: "READY",
        financingReadiness: "cash_ready",
        propertyFitConfidence: "high",
        riskToleranceAlignment: "aligned",
        riskLevel: "competitive",
        userConfirmed: true
      }
    });
    expect(patchReadinessResponse.statusCode).toBe(200);
    const updatedReadiness = patchReadinessResponse.json();
    expect(updatedReadiness.status).toBe("READY");
    expect(updatedReadiness.readinessScore).toBeGreaterThan(createdReadiness.readinessScore);
    expect(updatedReadiness.blockingIssues).toHaveLength(0);

    const recommendationResponse = await app.inject({
      method: "GET",
      url: `/offer-readiness/${capturedHome.canonicalPropertyId}/recommendation?shortlistId=${shortlist.id}`
    });
    expect(recommendationResponse.statusCode).toBe(200);
    const recommendation = recommendationResponse.json();
    expect(recommendation.propertyId).toBe(capturedHome.canonicalPropertyId);
    expect(recommendation.shortlistId).toBe(shortlist.id);
    expect(recommendation.readinessScore).toBe(updatedReadiness.readinessScore);
    expect(recommendation.recommendedOfferPrice).toBe(updatedReadiness.recommendedOfferPrice);
    expect(recommendation.blockingIssues).toEqual([]);
    expect(recommendation.nextSteps).toContain("Finalize offer price");

    const shortlistItemsResponse = await app.inject({
      method: "GET",
      url: `/shortlists/${shortlist.id}/items`
    });
    expect(shortlistItemsResponse.statusCode).toBe(200);
    expect(shortlistItemsResponse.json().offerReadiness).toHaveLength(1);
    expect(shortlistItemsResponse.json().offerReadiness[0].id).toBe(createdReadiness.id);

    const workflowActivityResponse = await app.inject({
      method: "GET",
      url: "/workflow/activity?limit=20",
      headers: {
        "x-nhalo-session-id": sessionId
      }
    });
    expect(workflowActivityResponse.statusCode).toBe(200);
    expect(
      workflowActivityResponse
        .json()
        .activity.some((entry: { eventType: string; offerReadinessId?: string | null }) => {
          return (
            entry.eventType === "offer_readiness_created" &&
            entry.offerReadinessId === createdReadiness.id
          );
        })
    ).toBe(true);
    expect(
      workflowActivityResponse
        .json()
        .activity.some((entry: { eventType: string; offerReadinessId?: string | null }) => {
          return (
            entry.eventType === "offer_status_changed" &&
            entry.offerReadinessId === createdReadiness.id
          );
        })
    ).toBe(true);
  });

  it("creates negotiation tracking records, stores timeline events, and returns deterministic summaries", async () => {
    const createShortlistResponse = await app.inject({
      method: "POST",
      url: "/shortlists",
      headers: {
        "x-nhalo-session-id": sessionId
      },
      payload: {
        title: "Negotiation shortlist"
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

    const readinessResponse = await app.inject({
      method: "POST",
      url: "/offer-readiness",
      payload: {
        shortlistId: shortlist.id,
        propertyId: capturedHome.canonicalPropertyId,
        financingReadiness: "cash_ready",
        propertyFitConfidence: "high",
        riskToleranceAlignment: "aligned",
        riskLevel: "balanced",
        userConfirmed: true
      }
    });
    expect(readinessResponse.statusCode).toBe(201);
    const offerReadiness = readinessResponse.json();

    const createNegotiationResponse = await app.inject({
      method: "POST",
      url: "/negotiations",
      payload: {
        propertyId: capturedHome.canonicalPropertyId,
        shortlistId: shortlist.id,
        offerReadinessId: offerReadiness.id,
        status: "DRAFTING_OFFER",
        initialOfferPrice: 389000,
        currentOfferPrice: 389000,
        buyerWalkAwayPrice: 400000
      }
    });
    expect(createNegotiationResponse.statusCode).toBe(201);
    const negotiation = createNegotiationResponse.json();
    expect(negotiation.status).toBe("DRAFTING_OFFER");
    expect(negotiation.guidance.nextSteps).toContain("Submit the offer when ready");

    const getNegotiationResponse = await app.inject({
      method: "GET",
      url: `/negotiations/${capturedHome.canonicalPropertyId}?shortlistId=${shortlist.id}`
    });
    expect(getNegotiationResponse.statusCode).toBe(200);
    expect(getNegotiationResponse.json().id).toBe(negotiation.id);

    const offerMadeResponse = await app.inject({
      method: "PATCH",
      url: `/negotiations/${negotiation.id}`,
      payload: {
        status: "OFFER_MADE",
        currentOfferPrice: 392000,
        roundNumber: 1
      }
    });
    expect(offerMadeResponse.statusCode).toBe(200);
    expect(offerMadeResponse.json().status).toBe("OFFER_MADE");

    const sellerCounterEventResponse = await app.inject({
      method: "POST",
      url: `/negotiations/${negotiation.id}/events`,
      payload: {
        type: "SELLER_COUNTER_RECEIVED",
        label: "Seller counter received",
        details: "Seller counter recorded at $398,000."
      }
    });
    expect(sellerCounterEventResponse.statusCode).toBe(201);

    const counterReceivedResponse = await app.inject({
      method: "PATCH",
      url: `/negotiations/${negotiation.id}`,
      payload: {
        status: "COUNTER_RECEIVED",
        sellerCounterPrice: 398000,
        roundNumber: 2
      }
    });
    expect(counterReceivedResponse.statusCode).toBe(200);
    const updatedNegotiation = counterReceivedResponse.json();
    expect(updatedNegotiation.status).toBe("COUNTER_RECEIVED");
    expect(updatedNegotiation.roundNumber).toBe(2);
    expect(updatedNegotiation.guidance.flags).toContain(
      "Seller counter is close to the recommended offer range."
    );

    const eventsResponse = await app.inject({
      method: "GET",
      url: `/negotiations/${negotiation.id}/events`
    });
    expect(eventsResponse.statusCode).toBe(200);
    expect(eventsResponse.json().events.length).toBeGreaterThanOrEqual(3);

    const summaryResponse = await app.inject({
      method: "GET",
      url: `/negotiations/${capturedHome.canonicalPropertyId}/summary?shortlistId=${shortlist.id}`
    });
    expect(summaryResponse.statusCode).toBe(200);
    expect(summaryResponse.json().status).toBe("COUNTER_RECEIVED");
    expect(summaryResponse.json().buyerWalkAwayPrice).toBe(400000);
    expect(summaryResponse.json().nextSteps).toContain("Review the seller counter");

    const shortlistItemsResponse = await app.inject({
      method: "GET",
      url: `/shortlists/${shortlist.id}/items`
    });
    expect(shortlistItemsResponse.statusCode).toBe(200);
    expect(shortlistItemsResponse.json().negotiations).toHaveLength(1);
    expect(shortlistItemsResponse.json().negotiations[0].id).toBe(negotiation.id);

    const workflowActivityResponse = await app.inject({
      method: "GET",
      url: "/workflow/activity?limit=30",
      headers: {
        "x-nhalo-session-id": sessionId
      }
    });
    expect(workflowActivityResponse.statusCode).toBe(200);
    expect(
      workflowActivityResponse
        .json()
        .activity.some(
          (entry: { eventType: string; negotiationRecordId?: string | null }) =>
            entry.eventType === "negotiation_started" &&
            entry.negotiationRecordId === negotiation.id
        )
    ).toBe(true);
    expect(
      workflowActivityResponse
        .json()
        .activity.some(
          (entry: { eventType: string; negotiationRecordId?: string | null }) =>
            entry.eventType === "offer_submitted" &&
            entry.negotiationRecordId === negotiation.id
        )
    ).toBe(true);
    expect(
      workflowActivityResponse
        .json()
        .activity.some(
          (entry: { eventType: string; negotiationRecordId?: string | null }) =>
            entry.eventType === "counter_received" &&
            entry.negotiationRecordId === negotiation.id
        )
    ).toBe(true);

    const metricsResponse = await app.inject({
      method: "GET",
      url: "/metrics"
    });
    const metricsPayload = metricsResponse.json();
    expect(metricsPayload.negotiationCreateCount).toBeGreaterThanOrEqual(1);
    expect(metricsPayload.negotiationEventCreateCount).toBeGreaterThanOrEqual(1);
    expect(metricsPayload.negotiationStatusChangeCount).toBeGreaterThanOrEqual(2);
    expect(metricsPayload.negotiationSummaryViewCount).toBeGreaterThanOrEqual(1);
  });
});
