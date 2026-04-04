import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HomeDetailPanel } from "./HomeDetailPanel";

describe("HomeDetailPanel", () => {
  it("renders detail facts, family tradeoffs, provenance, and audit entry points", () => {
    const home = {
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
      qualityFlags: ["staleSafetyData", "limitedComparables"],
      strengths: ["Strong neighborhood safety"],
      risks: ["Listing data came from stale cache"],
      confidenceReasons: ["Safety data came from stale cache."],
      explainability: {
        headline: "Strong space with solid value. Neighborhood safety is the main tradeoff.",
        strengths: ["Strong neighborhood safety"],
        risks: ["Listing data came from stale cache"],
        scoreDrivers: {
          primary: "size" as const,
          secondary: "price" as const,
          weakest: "safety" as const
        }
      },
      provenance: {
        listingDataSource: "cached_live" as const,
        listingProvider: "ListingSourceProvider",
        listingFetchedAt: "2026-03-23T12:00:00.000Z",
        sourceListingId: "source-1",
        safetyDataSource: "stale_cached_live" as const,
        crimeProvider: "CrimeSignalProvider",
        schoolProvider: "SchoolSignalProvider",
        crimeFetchedAt: "2026-03-20T12:00:00.000Z",
        schoolFetchedAt: "2026-03-20T12:00:00.000Z",
        geocodeDataSource: "cached_live" as const,
        geocodeProvider: "GeocodingSourceProvider",
        geocodeFetchedAt: "2026-03-23T12:00:00.000Z",
        geocodePrecision: "centroid" as const
      },
      neighborhoodSafetyScore: 61,
      explanation: "Strong space with solid value.",
      scores: {
        price: 77,
        size: 88,
        safety: 61,
        nhalo: 76,
        safetyConfidence: "medium" as const,
        overallConfidence: "low" as const,
        formulaVersion: "nhalo-v1"
      }
    };

    const markup = renderToStaticMarkup(
      <HomeDetailPanel allHomes={[home]} home={home} onClose={vi.fn()} onViewAudit={vi.fn()} />
    );

    expect(markup).toContain("Home detail");
    expect(markup).toContain("Family tradeoffs");
    expect(markup).toContain("Freshness and provenance");
    expect(markup).toContain("Search origin precision");
    expect(markup).toContain("View audit details");
  });

  it("renders the selected-choice concierge summary ahead of workflow detail when provided", () => {
    const home = {
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
      explainability: null,
      provenance: {
        listingDataSource: "live" as const,
        listingProvider: "ListingSourceProvider",
        listingFetchedAt: "2026-03-23T12:00:00.000Z",
        sourceListingId: "source-1",
        safetyDataSource: "cached_live" as const,
        crimeProvider: "CrimeSignalProvider",
        schoolProvider: "SchoolSignalProvider",
        crimeFetchedAt: "2026-03-20T12:00:00.000Z",
        schoolFetchedAt: "2026-03-20T12:00:00.000Z",
        geocodeDataSource: "cached_live" as const,
        geocodeProvider: "GeocodingSourceProvider",
        geocodeFetchedAt: "2026-03-23T12:00:00.000Z",
        geocodePrecision: "centroid" as const
      },
      neighborhoodSafetyScore: 61,
      explanation: "Strong space with solid value.",
      scores: {
        price: 77,
        size: 88,
        safety: 61,
        nhalo: 76,
        safetyConfidence: "medium" as const,
        overallConfidence: "low" as const,
        formulaVersion: "nhalo-v1"
      }
    };

    const markup = renderToStaticMarkup(
      <HomeDetailPanel
        allHomes={[home]}
        home={home}
        onClose={vi.fn()}
        onViewAudit={vi.fn()}
        selectedChoiceSummary={{
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
            nhaloScore: 76,
            overallConfidence: "low",
            capturedHome: home
          },
          decision: {
            selectionRank: 1,
            backupCount: 1,
            decisionConfidence: "high",
            decisionRationale: "Primary family fit.",
            decisionRisks: [],
            lastDecisionReviewedAt: "2026-04-03T12:00:00.000Z",
            selectedAt: "2026-04-03T12:00:00.000Z",
            statusChangedAt: "2026-04-03T12:00:00.000Z",
            droppedReason: null,
            replacedByShortlistItemId: null
          },
          readiness: {
            financialReadinessId: null,
            financialReadinessState: null,
            affordabilityClassification: null,
            offerReadinessId: null,
            offerReadinessStatus: null,
            offerReadinessScore: null,
            recommendedOfferPrice: null,
            offerRecommendationConfidence: null
          },
          workflow: {
            offerPreparationId: null,
            offerPreparationState: null,
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
            unreadCount: 0,
            criticalCount: 0,
            warningCount: 0,
            notifications: []
          },
          offerStrategy: {
            strategyConfidence: "low",
            offerPosture: "not_ready",
            urgencyLevel: "blocked",
            concessionStrategy: "defer_until_more_certain",
            recommendedNextOfferAction: "complete_financial_readiness",
            pricePosition: {
              listPrice: 385000,
              recommendedOfferPrice: null,
              pricePerSqft: null,
              medianPricePerSqft: null,
              versusList: "unknown",
              versusMarket: "unknown"
            },
            marketContext: {
              listingStatus: "active",
              daysOnMarket: 5,
              comparableSampleSize: 4,
              comparableStrategyUsed: "local_radius_fallback",
              overallConfidence: "low",
              listingDataSource: "live",
              limitedComparables: false
            },
            marketRisks: ["Financial readiness is not yet ready for offer advancement."],
            strategyRationale: ["Buyer readiness must be completed before drafting an offer."],
            lastEvaluatedAt: "2026-04-03T12:00:00.000Z"
          },
          concierge: {
            headline: "Advance this home first.",
            recommendationSummary: "The shortlist and readiness signals align.",
            nextAction: "Review offer terms.",
            nextSteps: ["Review offer terms"],
            topRisks: [],
            blockers: [],
            sourceModule: "selected_choice",
            lastUpdatedAt: "2026-04-03T12:00:00.000Z"
          }
        }}
      />
    );

    expect(markup).toContain("Selected choice concierge");
    expect(markup).toContain("Offer strategy");
    expect(markup).toContain("complete financial readiness");
    expect(markup).toContain("Advance this home first.");
    expect(markup).toContain("Review offer terms.");
  });

  it("shows compact backup decision controls for a shortlisted backup home", () => {
    const home = {
      id: "home-2",
      address: "456 Backup Ave",
      city: "Southfield",
      state: "MI",
      zipCode: "48075",
      propertyType: "single_family",
      price: 372000,
      sqft: 2050,
      bedrooms: 4,
      bathrooms: 2.5,
      canonicalPropertyId: "canonical-2",
      distanceMiles: 2.8,
      insideRequestedRadius: true,
      qualityFlags: [],
      strengths: [],
      risks: [],
      confidenceReasons: [],
      explainability: null,
      provenance: {
        listingDataSource: "live" as const,
        listingProvider: "ListingSourceProvider",
        listingFetchedAt: "2026-03-23T12:00:00.000Z",
        sourceListingId: "source-2",
        safetyDataSource: "cached_live" as const,
        crimeProvider: "CrimeSignalProvider",
        schoolProvider: "SchoolSignalProvider",
        crimeFetchedAt: "2026-03-20T12:00:00.000Z",
        schoolFetchedAt: "2026-03-20T12:00:00.000Z",
        geocodeDataSource: "cached_live" as const,
        geocodeProvider: "GeocodingSourceProvider",
        geocodeFetchedAt: "2026-03-23T12:00:00.000Z",
        geocodePrecision: "centroid" as const
      },
      neighborhoodSafetyScore: 70,
      explanation: "Solid backup option.",
      scores: {
        price: 79,
        size: 80,
        safety: 70,
        nhalo: 76,
        safetyConfidence: "medium" as const,
        overallConfidence: "medium" as const,
        formulaVersion: "nhalo-v1"
      }
    };

    const markup = renderToStaticMarkup(
      <HomeDetailPanel
        allHomes={[home]}
        home={home}
        onClose={vi.fn()}
        onDropChoice={vi.fn()}
        onMoveBackup={vi.fn()}
        onSelectChoice={vi.fn()}
        onUpdateShortlistDecision={vi.fn()}
        onViewAudit={vi.fn()}
        shortlistItem={{
          id: "item-2",
          shortlistId: "shortlist-1",
          canonicalPropertyId: "canonical-2",
          sourceSnapshotId: null,
          sourceHistoryId: null,
          sourceSearchDefinitionId: null,
          capturedHome: home,
          reviewState: "interested",
          choiceStatus: "backup",
          selectionRank: 3,
          decisionConfidence: "medium",
          decisionRationale: "Keep this as the second fallback.",
          decisionRisks: [],
          lastDecisionReviewedAt: "2026-04-03T12:00:00.000Z",
          selectedAt: null,
          statusChangedAt: "2026-04-03T12:00:00.000Z",
          replacedByShortlistItemId: null,
          droppedReason: null,
          addedAt: "2026-04-03T12:00:00.000Z",
          updatedAt: "2026-04-03T12:00:00.000Z"
        }}
        selectedChoiceSummary={{
          shortlistId: "shortlist-1",
          selectedItemId: "item-1",
          hasSelectedChoice: true,
          choiceStatus: "selected",
          decisionStage: "selected_choice",
          property: null,
          decision: {
            selectionRank: 1,
            backupCount: 2,
            decisionConfidence: "high",
            decisionRationale: null,
            decisionRisks: [],
            lastDecisionReviewedAt: "2026-04-03T12:00:00.000Z",
            selectedAt: "2026-04-03T12:00:00.000Z",
            statusChangedAt: "2026-04-03T12:00:00.000Z",
            droppedReason: null,
            replacedByShortlistItemId: null
          },
          readiness: {
            financialReadinessId: null,
            financialReadinessState: null,
            affordabilityClassification: null,
            offerReadinessId: null,
            offerReadinessStatus: null,
            offerReadinessScore: null,
            recommendedOfferPrice: null,
            offerRecommendationConfidence: null
          },
          workflow: {
            offerPreparationId: null,
            offerPreparationState: null,
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
            unreadCount: 0,
            criticalCount: 0,
            warningCount: 0,
            notifications: []
          },
          offerStrategy: {
            strategyConfidence: "medium",
            offerPosture: "verify_before_offering",
            urgencyLevel: "medium",
            concessionStrategy: "case_by_case",
            recommendedNextOfferAction: "review_market_inputs",
            pricePosition: {
              listPrice: 385000,
              recommendedOfferPrice: 382000,
              pricePerSqft: 182,
              medianPricePerSqft: 185,
              versusList: "below_list",
              versusMarket: "near_market"
            },
            marketContext: {
              listingStatus: "active",
              daysOnMarket: null,
              comparableSampleSize: 3,
              comparableStrategyUsed: "local_radius_fallback",
              overallConfidence: "medium",
              listingDataSource: "cached_live",
              limitedComparables: true
            },
            marketRisks: [
              "Days on market are unavailable in the stored result.",
              "Comparable homes nearby were limited."
            ],
            strategyRationale: [
              "Stored market inputs are incomplete or weak, so the strategy should stay provisional."
            ],
            lastEvaluatedAt: "2026-04-03T12:00:00.000Z"
          },
          concierge: {
            headline: "Current selected choice remains elsewhere.",
            recommendationSummary: "This backup stays available if the primary changes.",
            nextAction: "Review the backup stack.",
            nextSteps: [],
            topRisks: [],
            blockers: [],
            sourceModule: "selected_choice",
            lastUpdatedAt: "2026-04-03T12:00:00.000Z"
          }
        }}
      />
    );

    expect(markup).toContain("Current selected choice");
    expect(markup).toContain("Set as selected choice");
    expect(markup).toContain("Move up backup");
    expect(markup).toContain("Edit rationale");
  });
});
