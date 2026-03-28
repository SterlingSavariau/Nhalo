import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ShortlistPanel } from "./ShortlistPanel";

describe("ShortlistPanel", () => {
  it("renders shortlist workflow content for saved homes and notes", () => {
    const markup = renderToStaticMarkup(
      <ShortlistPanel
        historicalCompareEnabled
        items={[
          {
            id: "item-1",
            shortlistId: "shortlist-1",
            canonicalPropertyId: "canonical-1",
            sourceSnapshotId: "snapshot-1",
            sourceHistoryId: null,
            sourceSearchDefinitionId: null,
            reviewState: "undecided",
            addedAt: "2026-03-24T12:00:00.000Z",
            updatedAt: "2026-03-24T12:00:00.000Z",
            capturedHome: {
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
              canonicalPropertyId: "canonical-1",
              distanceMiles: 2.1,
              insideRequestedRadius: true,
              qualityFlags: [],
              strengths: [],
              risks: [],
              confidenceReasons: [],
              explainability: {
                headline: "Strong family fit",
                strengths: [],
                risks: [],
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
            }
          }
        ]}
        offerReadiness={[
          {
            id: "offer-1",
            propertyId: "canonical-1",
            shortlistId: "shortlist-1",
            shortlistItemId: "item-1",
            status: "IN_PROGRESS",
            readinessScore: 68,
            recommendedOfferPrice: 389000,
            confidence: "medium",
            inputs: {
              financingReadiness: "preapproved",
              propertyFitConfidence: "medium",
              riskToleranceAlignment: "partial",
              riskLevel: "balanced",
              userConfirmed: false,
              dataCompletenessScore: 82
            },
            blockingIssues: ["Buyer confirmation is still missing."],
            nextSteps: ["Confirm budget ceiling", "Finalize offer price"],
            lastEvaluatedAt: "2026-03-24T12:05:00.000Z",
            createdAt: "2026-03-24T12:00:00.000Z",
            updatedAt: "2026-03-24T12:05:00.000Z"
          }
        ]}
        negotiations={[
          {
            id: "negotiation-1",
            propertyId: "canonical-1",
            shortlistId: "shortlist-1",
            offerReadinessId: "offer-1",
            status: "COUNTER_RECEIVED",
            initialOfferPrice: 389000,
            currentOfferPrice: 392000,
            sellerCounterPrice: 398000,
            buyerWalkAwayPrice: 400000,
            roundNumber: 2,
            guidance: {
              headline: "Seller counter has been received and is ready for buyer review.",
              riskLevel: "medium",
              nextSteps: ["Review the seller counter", "Decide whether to counter, accept, or reject"],
              flags: ["Seller counter is close to the recommended offer range."]
            },
            lastActionAt: "2026-03-24T12:10:00.000Z",
            createdAt: "2026-03-24T12:06:00.000Z",
            updatedAt: "2026-03-24T12:10:00.000Z"
          }
        ]}
        negotiationEventsByRecordId={{
          "negotiation-1": [
            {
              id: "negotiation-event-1",
              negotiationRecordId: "negotiation-1",
              type: "SELLER_COUNTER_RECEIVED",
              label: "Seller counter received",
              details: "Seller counter recorded at $398,000.",
              createdAt: "2026-03-24T12:10:00.000Z"
            }
          ]
        }}
        notes={[
          {
            id: "note-1",
            sessionId: "session-1",
            entityType: "shortlist_item",
            entityId: "item-1",
            body: "Strong candidate.",
            createdAt: "2026-03-24T12:00:00.000Z",
            updatedAt: "2026-03-24T12:00:00.000Z"
          }
        ]}
        onAddNegotiationEvent={vi.fn()}
        onCreate={vi.fn()}
        onCreateNegotiation={vi.fn()}
        onCreateOfferReadiness={vi.fn()}
        onDelete={vi.fn()}
        onDeleteNote={vi.fn()}
        onOpenHistoricalCompare={vi.fn()}
        onRemoveItem={vi.fn()}
        onReviewStateChange={vi.fn()}
        onSaveNote={vi.fn()}
        onSelect={vi.fn()}
        onTogglePinned={vi.fn()}
        onUpdateNegotiation={vi.fn()}
        onUpdateOfferReadiness={vi.fn()}
        selectedShortlistId="shortlist-1"
        shortlists={[
          {
            id: "shortlist-1",
            sessionId: "session-1",
            title: "Family shortlist",
            description: "Pilot set",
            sourceSnapshotId: "snapshot-1",
            pinned: true,
            itemCount: 1,
            createdAt: "2026-03-24T12:00:00.000Z",
            updatedAt: "2026-03-24T12:00:00.000Z"
          }
        ]}
        workflowActivity={[
          {
            id: "activity-1",
            sessionId: "session-1",
            eventType: "shortlist_created",
            shortlistId: "shortlist-1",
            shortlistItemId: null,
            noteId: null,
            payload: null,
            createdAt: "2026-03-24T12:00:00.000Z"
          }
        ]}
      />
    );

    expect(markup).toContain("Family shortlist");
    expect(markup).toContain("123 Main St");
    expect(markup).toContain("Workflow history");
    expect(markup).toContain("Compare to current");
    expect(markup).toContain("Offer readiness");
    expect(markup).toContain("Recommended offer");
    expect(markup).toContain("Negotiation tracking");
    expect(markup).toContain("Seller counter received");
  });
});
