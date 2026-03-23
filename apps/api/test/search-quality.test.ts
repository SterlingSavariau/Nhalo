import { DEFAULT_WEIGHTS } from "@nhalo/config";
import { MOCK_LISTINGS, MOCK_SAFETY } from "@nhalo/providers";
import { rankListings } from "@nhalo/scoring";
import { describe, expect, it } from "vitest";
import {
  applyHardFiltersWithSummary,
  applyQualityGate,
  buildQualityFlags,
  countRankingTies,
  deduplicateListings,
  enrichListing,
  selectComparableListings
} from "../src/search-quality";

const baseContext = {
  weights: DEFAULT_WEIGHTS,
  budget: { max: 425000 },
  marketSnapshot: {
    id: "market-1",
    location: "city:southfield, mi",
    radiusMiles: 5,
    medianPricePerSqft: 180,
    sampleSize: 6,
    createdAt: "2026-03-22T00:00:00.000Z"
  },
  providerFreshnessHours: {
    geocoder: 1,
    listings: 1,
    safety: 1
  }
};

describe("search quality helpers", () => {
  it("deduplicates same-property listings deterministically across providers", () => {
    const duplicateA = enrichListing({
      ...MOCK_LISTINGS[0],
      id: "provider-a-1",
      sourceProvider: "provider-a",
      sourceListingId: "a-1",
      listingDataSource: "cached_live"
    });
    const duplicateB = enrichListing({
      ...MOCK_LISTINGS[0],
      id: "provider-b-1",
      sourceProvider: "provider-b",
      sourceListingId: "b-1",
      listingDataSource: "live"
    });

    const result = deduplicateListings([duplicateA, duplicateB]);

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0].sourceProvider).toBe("provider-b");
    expect(result.deduplicatedCount).toBe(1);
    expect(result.duplicateGroupsDetected).toBe(1);
  });

  it("applies quality gates and listing status discipline before scoring", () => {
    const result = applyQualityGate([
      {
        ...MOCK_LISTINGS[0],
        id: "good"
      },
      {
        ...MOCK_LISTINGS[1],
        id: "bad-price",
        price: 0
      },
      {
        ...MOCK_LISTINGS[2],
        id: "pending",
        listingStatus: "pending"
      }
    ]);

    expect(result.listings).toHaveLength(1);
    expect(result.rejectionSummary.invalidPrice).toBe(1);
    expect(result.rejectionSummary.unsupportedListingStatus).toBe(1);
  });

  it("falls back to broader comparables when strict comparable set is too small", () => {
    const comparables = MOCK_LISTINGS.slice(0, 3).map(enrichListing);
    const selected = selectComparableListings(
      comparables[0],
      comparables,
      {
        minComparableSampleSize: 5
      }
    );

    expect(selected.strategyUsed).toBe("local_radius_fallback");
    expect(selected.listings.length).toBe(comparables.length);
  });

  it("reconciles hard-filter rejection counts deterministically", () => {
    const result = applyHardFiltersWithSummary(
      MOCK_LISTINGS.slice(0, 3).map(enrichListing),
      {
        locationType: "city",
        locationValue: "Southfield, MI",
        radiusMiles: 5,
        budget: { max: 300000 },
        minSqft: 1800,
        minBedrooms: 4,
        propertyTypes: ["single_family"],
        preferences: [],
        weights: DEFAULT_WEIGHTS
      }
    );

    expect(result.rejectionSummary.aboveBudget).toBeGreaterThanOrEqual(1);
    expect(result.rejectionSummary.belowBedrooms).toBeGreaterThanOrEqual(1);
    expect(result.rejectionSummary.wrongPropertyType).toBeGreaterThanOrEqual(1);
  });

  it("builds deterministic quality flags and stable tie counts", () => {
    const listing = enrichListing({
      ...MOCK_LISTINGS[0],
      listingDataSource: "stale_cached_live"
    });
    const flags = buildQualityFlags({
      listing,
      safetyDataSource: "mock",
      dataCompleteness: 66.67,
      comparableSampleSize: 2,
      comparableStrategyUsed: "local_radius_fallback",
      minComparableSampleSize: 5,
      searchOrigin: {
        locationType: "city",
        locationValue: "Southfield, MI",
        resolvedFormattedAddress: "Southfield, MI, USA",
        latitude: 42.4734,
        longitude: -83.2219,
        precision: "centroid",
        geocodeDataSource: "cached_live",
        geocodeProvider: "geocoder-live-http",
        geocodeFetchedAt: "2026-03-22T20:15:00Z"
      }
    });

    expect(flags).toEqual([
      "approximateSearchOrigin",
      "limitedComparables",
      "mockFallbackUsed",
      "partialSafetyData",
      "staleListingData"
    ]);

    const comparableListings = [MOCK_LISTINGS[0], MOCK_LISTINGS[1]].map(enrichListing);
    const safetyByPropertyId = new Map(
      MOCK_SAFETY.filter((entry) =>
        comparableListings.some((listingItem) => listingItem.id === entry.propertyId)
      ).map((entry) => [entry.propertyId, entry])
    );

    const ranked = rankListings(comparableListings, {
      ...baseContext,
      comparableListings,
      safetyByPropertyId
    });
    const tieCount = countRankingTies([
      ranked[0],
      { ...ranked[0], listing: { ...ranked[0].listing, id: "duplicate-rank" } }
    ]);

    expect(tieCount).toBe(1);
  });
});
