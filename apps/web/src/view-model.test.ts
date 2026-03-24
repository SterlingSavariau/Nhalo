import { describe, expect, it } from "vitest";
import type { ScoredHome } from "@nhalo/types";
import {
  applyResultControls,
  DEFAULT_RESULT_CONTROLS,
  toggleComparisonSelection
} from "./view-model";

const homes: ScoredHome[] = [
  {
    id: "1",
    address: "1 A St",
    city: "A",
    state: "MI",
    zipCode: "48075",
    propertyType: "single_family",
    price: 400000,
    sqft: 2200,
    bedrooms: 4,
    bathrooms: 3,
    canonicalPropertyId: "a",
    distanceMiles: 3,
    insideRequestedRadius: true,
    qualityFlags: [],
    strengths: [],
    risks: [],
    confidenceReasons: [],
    explainability: {
      headline: "A",
      strengths: [],
      risks: [],
      scoreDrivers: { primary: "size", secondary: "price", weakest: "safety" }
    },
    provenance: {
      listingDataSource: "live",
      listingProvider: "Listing",
      listingFetchedAt: null,
      sourceListingId: "1",
      safetyDataSource: "live",
      crimeProvider: "Crime",
      schoolProvider: "School",
      crimeFetchedAt: null,
      schoolFetchedAt: null,
      geocodeDataSource: "live",
      geocodeProvider: "Geocoder",
      geocodeFetchedAt: null,
      geocodePrecision: "rooftop"
    },
    neighborhoodSafetyScore: 60,
    explanation: "A",
    scores: {
      price: 65,
      size: 80,
      safety: 60,
      nhalo: 69,
      safetyConfidence: "high",
      overallConfidence: "high",
      formulaVersion: "nhalo-v1"
    }
  },
  {
    id: "2",
    address: "2 B St",
    city: "A",
    state: "MI",
    zipCode: "48075",
    propertyType: "condo",
    price: 300000,
    sqft: 1500,
    bedrooms: 2,
    bathrooms: 2,
    canonicalPropertyId: "b",
    distanceMiles: 1,
    insideRequestedRadius: true,
    qualityFlags: ["partialSafetyData"],
    strengths: [],
    risks: [],
    confidenceReasons: ["Safety score used partial signal coverage."],
    explainability: {
      headline: "B",
      strengths: [],
      risks: [],
      scoreDrivers: { primary: "price", secondary: "safety", weakest: "size" }
    },
    provenance: {
      listingDataSource: "mock",
      listingProvider: "Listing",
      listingFetchedAt: null,
      sourceListingId: "2",
      safetyDataSource: "mock",
      crimeProvider: null,
      schoolProvider: null,
      crimeFetchedAt: null,
      schoolFetchedAt: null,
      geocodeDataSource: "mock",
      geocodeProvider: "Geocoder",
      geocodeFetchedAt: null,
      geocodePrecision: "mock"
    },
    neighborhoodSafetyScore: 82,
    explanation: "B",
    scores: {
      price: 85,
      size: 45,
      safety: 82,
      nhalo: 72,
      safetyConfidence: "medium",
      overallConfidence: "low",
      formulaVersion: "nhalo-v1"
    }
  }
];

describe("view-model helpers", () => {
  it("applies deterministic local sorting and filtering to returned results", () => {
    const sorted = applyResultControls(homes, {
      ...DEFAULT_RESULT_CONTROLS,
      sortMode: "lowest_price",
      confidence: "low"
    });

    expect(sorted).toHaveLength(1);
    expect(sorted[0].id).toBe("2");
  });

  it("keeps comparison selection capped at three homes", () => {
    const selected = toggleComparisonSelection(["1", "2", "3"], "4");
    expect(selected).toEqual(["2", "3", "4"]);
  });
});
