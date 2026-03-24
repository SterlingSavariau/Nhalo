import { describe, expect, it } from "vitest";
import { buildConfidenceReasons, buildExplainability } from "../src/explainability";

const baseScores = {
  price: 72,
  size: 88,
  safety: 54,
  nhalo: 72,
  safetyConfidence: "medium" as const,
  overallConfidence: "low" as const,
  formulaVersion: "nhalo-v1"
};

const baseProvenance = {
  listingDataSource: "stale_cached_live" as const,
  listingProvider: "ListingSourceProvider",
  listingFetchedAt: "2026-03-23T00:00:00.000Z",
  sourceListingId: "abc",
  safetyDataSource: "mock" as const,
  crimeProvider: null,
  schoolProvider: null,
  crimeFetchedAt: null,
  schoolFetchedAt: null,
  geocodeDataSource: "cached_live" as const,
  geocodeProvider: "GeocodingSourceProvider",
  geocodeFetchedAt: "2026-03-23T00:00:00.000Z",
  geocodePrecision: "approximate" as const
};

describe("buildExplainability", () => {
  it("derives stable strengths, risks, and score drivers from stored scores and flags", () => {
    const result = buildExplainability({
      scores: baseScores,
      qualityFlags: ["limitedComparables", "staleListingData", "partialSafetyData"],
      distanceMiles: 1.4,
      propertyType: "single_family",
      provenance: baseProvenance
    });

    expect(result.explainability.scoreDrivers).toEqual({
      primary: "size",
      secondary: "price",
      weakest: "safety"
    });
    expect(result.strengths).toContain("Above-average space for the budget");
    expect(result.risks).toContain("Limited comparable homes nearby");
    expect(result.explainability.headline).toContain("space");
  });

  it("returns deterministic confidence reasons from quality flags and provenance", () => {
    const reasons = buildConfidenceReasons({
      qualityFlags: ["staleListingData", "approximateSearchOrigin", "mockFallbackUsed"],
      scores: baseScores,
      provenance: baseProvenance
    });

    expect(reasons).toEqual([
      "Listing data came from stale cache.",
      "Search origin was resolved with approximate geocoding.",
      "At least one provider fell back to mock data."
    ]);
  });
});
