import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SelectedChoiceSummaryCard } from "./SelectedChoiceSummaryCard";

describe("SelectedChoiceSummaryCard", () => {
  it("renders the selected-choice narrative from the concierge summary contract", () => {
    const markup = renderToStaticMarkup(
      <SelectedChoiceSummaryCard
        summary={{
          shortlistId: "shortlist-1",
          selectedItemId: "item-1",
          hasSelectedChoice: true,
          choiceStatus: "selected",
          decisionStage: "selected_choice",
          property: {
            shortlistItemId: "item-1",
            canonicalPropertyId: "canonical-1",
            address: "123 Main St",
            city: "Southfield",
            state: "MI",
            price: 385000,
            nhaloScore: 77,
            overallConfidence: "high",
            capturedHome: {
              id: "home-1",
              canonicalPropertyId: "canonical-1",
              address: "123 Main St",
              city: "Southfield",
              state: "MI",
              zipCode: "48075",
              propertyType: "single_family",
              price: 385000,
              sqft: 2100,
              bedrooms: 4,
              bathrooms: 3,
              distanceMiles: 2.1,
              insideRequestedRadius: true,
              qualityFlags: [],
              strengths: [],
              risks: [],
              confidenceReasons: [],
              explainability: null,
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
          },
          decision: {
            selectionRank: 1,
            backupCount: 2,
            decisionConfidence: "high",
            decisionRationale: "Best fit for the family.",
            decisionRisks: ["Near budget ceiling"],
            lastDecisionReviewedAt: "2026-04-03T12:00:00.000Z",
            selectedAt: "2026-04-03T12:00:00.000Z",
            statusChangedAt: "2026-04-03T12:00:00.000Z",
            droppedReason: null,
            replacedByShortlistItemId: null
          },
          readiness: {
            financialReadinessId: "financial-1",
            financialReadinessState: "READY",
            affordabilityClassification: "READY",
            offerReadinessId: "offer-1",
            offerReadinessStatus: "ready",
            offerReadinessScore: 84,
            recommendedOfferPrice: 389000,
            offerRecommendationConfidence: "high"
          },
          workflow: {
            offerPreparationId: "prep-1",
            offerPreparationState: "READY",
            offerSubmissionId: null,
            offerSubmissionState: null,
            negotiationId: null,
            negotiationStatus: null,
            underContractCoordinationId: null,
            underContractState: null,
            closingReadinessId: null,
            closingReadinessState: null,
            transactionCommandCenter: null
          },
          alerts: {
            unreadCount: 2,
            criticalCount: 1,
            warningCount: 1,
            notifications: []
          },
          offerStrategy: {
            strategyConfidence: "medium",
            offerPosture: "prepare_disciplined_offer",
            urgencyLevel: "medium",
            concessionStrategy: "limit_concession_requests",
            recommendedNextOfferAction: "draft_disciplined_offer",
            pricePosition: {
              listPrice: 385000,
              recommendedOfferPrice: 389000,
              pricePerSqft: 183,
              medianPricePerSqft: 190,
              versusList: "above_list",
              versusMarket: "discount_to_market"
            },
            marketContext: {
              listingStatus: "active",
              daysOnMarket: 12,
              comparableSampleSize: 6,
              comparableStrategyUsed: "local_radius_fallback",
              overallConfidence: "high",
              listingDataSource: "live",
              limitedComparables: false
            },
            marketRisks: ["Moderate price pressure"],
            strategyRationale: [
              "Buyer readiness supports moving forward with a disciplined offer posture."
            ],
            lastEvaluatedAt: "2026-04-03T12:00:00.000Z"
          },
          concierge: {
            headline: "This is the home to advance right now.",
            recommendationSummary: "It leads the shortlist and is ready for offer preparation.",
            nextAction: "Move into offer preparation.",
            nextSteps: ["Confirm terms", "Prepare submission packet"],
            topRisks: ["Tight budget range"],
            blockers: ["Need final document review"],
            sourceModule: "offer_readiness",
            lastUpdatedAt: "2026-04-03T12:00:00.000Z"
          }
        }}
      />
    );

    expect(markup).toContain("Selected choice concierge");
    expect(markup).toContain("This is the home to advance right now.");
    expect(markup).toContain("Move into offer preparation.");
    expect(markup).toContain("Need final document review");
    expect(markup).toContain("Tight budget range");
  });
});
