import { describe, expect, it } from "vitest";
import type { ScoredHome, SearchResponse } from "@nhalo/types";
import {
  DEMO_SCENARIO_COPY,
  buildHistoricalComparison,
  buildExecutiveSnapshotSummary,
  buildDecisionLabels,
  buildEmptyStateSuggestions,
  buildShareSnapshotUrl,
  buildSnapshotExportText,
  buildTradeoffSummary,
  geocodePrecisionExplanation
} from "./content";

const homes: ScoredHome[] = [
  {
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
    qualityFlags: ["limitedComparables"],
    strengths: ["Strong neighborhood safety"],
    risks: ["Listing data came from stale cache"],
    confidenceReasons: ["Safety data came from stale cache."],
    explainability: {
      headline: "Strong space with solid value. Neighborhood safety is the main tradeoff.",
      strengths: ["Strong neighborhood safety"],
      risks: ["Listing data came from stale cache"],
      scoreDrivers: {
        primary: "size",
        secondary: "price",
        weakest: "safety"
      }
    },
    provenance: {
      listingDataSource: "cached_live",
      listingProvider: "ListingSourceProvider",
      listingFetchedAt: "2026-03-23T12:00:00.000Z",
      sourceListingId: "source-1",
      safetyDataSource: "stale_cached_live",
      crimeProvider: "CrimeSignalProvider",
      schoolProvider: "SchoolSignalProvider",
      crimeFetchedAt: "2026-03-20T12:00:00.000Z",
      schoolFetchedAt: "2026-03-20T12:00:00.000Z",
      geocodeDataSource: "cached_live",
      geocodeProvider: "GeocodingSourceProvider",
      geocodeFetchedAt: "2026-03-23T12:00:00.000Z",
      geocodePrecision: "centroid"
    },
    neighborhoodSafetyScore: 61,
    explanation: "Strong space with solid value.",
    scores: {
      price: 77,
      size: 88,
      safety: 61,
      nhalo: 76,
      safetyConfidence: "medium",
      overallConfidence: "low",
      formulaVersion: "nhalo-v1"
    }
  },
  {
    id: "home-2",
    address: "456 Oak Ave",
    city: "Southfield",
    state: "MI",
    zipCode: "48075",
    propertyType: "condo",
    price: 310000,
    sqft: 1500,
    bedrooms: 2,
    bathrooms: 2,
    canonicalPropertyId: "canonical-2",
    distanceMiles: 1.2,
    insideRequestedRadius: true,
    qualityFlags: [],
    strengths: ["Closer to the search origin"],
    risks: [],
    confidenceReasons: [],
    explainability: {
      headline: "Closer option with stronger safety than space.",
      strengths: ["Closer to the search origin"],
      risks: [],
      scoreDrivers: {
        primary: "safety",
        secondary: "price",
        weakest: "size"
      }
    },
    provenance: {
      listingDataSource: "live",
      listingProvider: "ListingSourceProvider",
      listingFetchedAt: "2026-03-23T12:00:00.000Z",
      sourceListingId: "source-2",
      safetyDataSource: "live",
      crimeProvider: "CrimeSignalProvider",
      schoolProvider: "SchoolSignalProvider",
      crimeFetchedAt: "2026-03-23T12:00:00.000Z",
      schoolFetchedAt: "2026-03-23T12:00:00.000Z",
      geocodeDataSource: "live",
      geocodeProvider: "GeocodingSourceProvider",
      geocodeFetchedAt: "2026-03-23T12:00:00.000Z",
      geocodePrecision: "rooftop"
    },
    neighborhoodSafetyScore: 83,
    explanation: "Closer option with stronger safety than space.",
    scores: {
      price: 84,
      size: 59,
      safety: 83,
      nhalo: 77,
      safetyConfidence: "high",
      overallConfidence: "high",
      formulaVersion: "nhalo-v1"
    }
  }
];

describe("content helpers", () => {
  it("builds deterministic family-first labels and tradeoff summaries", () => {
    expect(buildDecisionLabels(homes[0], homes)).toContain("Best for space");
    expect(buildDecisionLabels(homes[0], homes)).toContain("Needs caution");
    expect(buildTradeoffSummary(homes[0])).toBe("More space, weaker safety");
  });

  it("builds deterministic empty-state suggestions from rejection data", () => {
    const response: SearchResponse = {
      homes: [],
      appliedFilters: {
        locationType: "address",
        locationValue: "123 Main St, Southfield, MI",
        radiusMiles: 5,
        budget: { max: 425000 },
        minSqft: 1800,
        minBedrooms: 3,
        propertyTypes: ["single_family"],
        preferences: []
      },
      appliedWeights: { price: 40, size: 30, safety: 30 },
      metadata: {
        totalCandidatesScanned: 10,
        totalMatched: 0,
        returnedCount: 0,
        durationMs: 45,
        warnings: [],
        suggestions: [],
        rejectionSummary: {
          outsideRadius: 4,
          aboveBudget: 3,
          belowSqft: 2,
          belowBedrooms: 0,
          wrongPropertyType: 1,
          duplicate: 0,
          invalidPrice: 0,
          duplicateListings: 0,
          invalidCoordinates: 0,
          missingAddress: 0,
          missingPrice: 0,
          missingSquareFootage: 0,
          unsupportedPropertyType: 0,
          malformedListing: 0,
          unsupportedListingStatus: 0,
          normalizationFailures: 0
        }
      }
    };

    const suggestions = buildEmptyStateSuggestions(response);

    expect(suggestions.map((item) => item.code)).toEqual([
      "radius",
      "budget",
      "sqft",
      "propertyTypes",
      "cityInstead"
    ]);
  });

  it("explains geocode precision in plain language", () => {
    expect(geocodePrecisionExplanation("centroid")).toBe("Center point of the city or ZIP.");
  });

  it("provides deterministic demo scenarios and shared snapshot links", () => {
    expect(DEMO_SCENARIO_COPY.length).toBeGreaterThanOrEqual(3);
    expect(DEMO_SCENARIO_COPY[0].request.locationValue).toBeTruthy();
    expect(buildShareSnapshotUrl("public_123")).toBe("/?sharedSnapshot=public_123");
  });

  it("builds executive summaries and export text from stored snapshot data only", () => {
    const response: SearchResponse = {
      homes,
      appliedFilters: {
        locationType: "city",
        locationValue: "Southfield, MI",
        radiusMiles: 5,
        budget: { max: 425000 },
        minSqft: 1800,
        minBedrooms: 3,
        propertyTypes: ["single_family", "condo", "townhome"],
        preferences: []
      },
      appliedWeights: { price: 40, size: 30, safety: 30 },
      metadata: {
        totalCandidatesScanned: 25,
        totalMatched: 7,
        returnedCount: 2,
        durationMs: 51,
        warnings: [],
        suggestions: [],
        staleDataPresent: true
      }
    };

    const summary = buildExecutiveSnapshotSummary(response);
    const exportText = buildSnapshotExportText(
      {
        id: "snapshot-1",
        formulaVersion: "nhalo-v1",
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
        response,
        createdAt: "2026-03-23T12:00:00.000Z"
      },
      "Nhalo"
    );

    expect(summary.headline).toContain("2 homes ranked");
    expect(summary.topHomeSummary).toContain("123 Main St");
    expect(summary.notableCaveats.join(" ")).toContain("stale");
    expect(exportText).toContain("Nhalo snapshot summary");
    expect(exportText).toContain("Formula: nhalo-v1");
    expect(exportText).toContain("123 Main St");
  });

  it("builds deterministic historical comparison payloads", () => {
    const comparison = buildHistoricalComparison(
      {
        id: "item-1",
        shortlistId: "shortlist-1",
        canonicalPropertyId: homes[0].canonicalPropertyId!,
        sourceSnapshotId: "snapshot-1",
        sourceHistoryId: null,
        sourceSearchDefinitionId: null,
        capturedHome: homes[0],
        reviewState: "undecided",
        choiceStatus: "candidate",
        selectionRank: null,
        decisionConfidence: null,
        decisionRationale: null,
        decisionRisks: [],
        lastDecisionReviewedAt: null,
        selectedAt: null,
        statusChangedAt: "2026-03-24T12:00:00.000Z",
        replacedByShortlistItemId: null,
        droppedReason: null,
        addedAt: "2026-03-24T12:00:00.000Z",
        updatedAt: "2026-03-24T12:00:00.000Z"
      },
      homes[1]
    );

    expect(comparison.current?.label).toBe("Current result");
    expect(comparison.changes.some((entry) => entry.field === "nhaloScore")).toBe(true);
    expect(comparison.changes.some((entry) => entry.field === "listingSource")).toBe(true);
  });
});
