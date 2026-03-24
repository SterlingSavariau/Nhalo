import { describe, expect, it } from "vitest";
import {
  InMemoryGeocodeCacheRepository,
  InMemoryListingCacheRepository,
  InMemorySearchRepository,
  InMemorySafetySignalCacheRepository,
  createPersistenceLayer
} from "./index";

describe("retention cleanup", () => {
  it("removes expired caches and stale history artifacts safely in memory mode", async () => {
    const persistence = await createPersistenceLayer(undefined);
    const searchRepository = persistence.searchRepository as InMemorySearchRepository;
    const safetyCache = persistence.safetySignalCacheRepository as InMemorySafetySignalCacheRepository;
    const listingCache = persistence.listingCacheRepository as InMemoryListingCacheRepository;
    const geocodeCache = persistence.geocodeCacheRepository as InMemoryGeocodeCacheRepository;
    const oldTimestamp = "2020-01-01T00:00:00.000Z";

    searchRepository.searchSnapshots.push({
      id: "snapshot-old",
      formulaVersion: "nhalo-v1",
      request: {
        locationType: "city",
        locationValue: "Southfield, MI",
        radiusMiles: 5,
        budget: { max: 425000 },
        minSqft: 1800,
        minBedrooms: 3,
        propertyTypes: ["single_family"],
        preferences: [],
        weights: { price: 40, size: 30, safety: 30 }
      },
      response: {
        homes: [],
        appliedFilters: {
          locationType: "city",
          locationValue: "Southfield, MI",
          radiusMiles: 5,
          budget: { max: 425000 },
          minSqft: 1800,
          minBedrooms: 3,
          propertyTypes: ["single_family"],
          preferences: []
        },
        appliedWeights: { price: 40, size: 30, safety: 30 },
        metadata: {
          totalCandidatesScanned: 0,
          totalMatched: 0,
          returnedCount: 0,
          durationMs: 10,
          warnings: [],
          suggestions: []
        }
      },
      createdAt: oldTimestamp
    });
    searchRepository.searches.push({
      id: "history-old",
      payload: {
        request: {
          locationType: "city",
          locationValue: "Southfield, MI",
          radiusMiles: 5,
          budget: { max: 425000 },
          minSqft: 1800,
          minBedrooms: 3,
          propertyTypes: ["single_family"],
          preferences: [],
          weights: { price: 40, size: 30, safety: 30 }
        },
        response: {
          homes: [],
          appliedFilters: {
            locationType: "city",
            locationValue: "Southfield, MI",
            radiusMiles: 5,
            budget: { max: 425000 },
            minSqft: 1800,
            minBedrooms: 3,
            propertyTypes: ["single_family"],
            preferences: []
          },
          appliedWeights: { price: 40, size: 30, safety: 30 },
          metadata: {
            totalCandidatesScanned: 0,
            totalMatched: 0,
            returnedCount: 0,
            durationMs: 10,
            warnings: [],
            suggestions: []
          }
        },
        resolvedLocation: {
          geocodeId: "city:southfield, mi",
          locationType: "city",
          locationValue: "Southfield, MI",
          latitude: 42.47,
          longitude: -83.22,
          precision: "centroid",
          center: { lat: 42.47, lng: -83.22 }
        },
        scoredResults: [],
        listings: [],
        marketSnapshot: {
          id: "market-1",
          location: "city:southfield, mi",
          radiusMiles: 5,
          medianPricePerSqft: 200,
          sampleSize: 1,
          createdAt: oldTimestamp
        }
      },
      createdAt: oldTimestamp
    });
    safetyCache.entries.push({
      id: "safety-old",
      locationKey: "city:southfield, mi",
      lat: 42.47,
      lng: -83.22,
      crimeProvider: "mock",
      schoolProvider: "mock",
      crimeRaw: null,
      crimeNormalized: 60,
      schoolRaw: null,
      schoolNormalized: 70,
      stabilityRaw: null,
      stabilityNormalized: 65,
      fetchedAt: oldTimestamp,
      expiresAt: oldTimestamp,
      sourceType: "mock"
    });
    listingCache.entries.push({
      id: "listing-old",
      locationKey: "city:southfield, mi",
      locationType: "city",
      locationValue: "Southfield, MI",
      radiusMiles: 5,
      provider: "mock",
      rawPayload: null,
      normalizedListings: [],
      fetchedAt: oldTimestamp,
      expiresAt: oldTimestamp,
      sourceType: "mock",
      rejectionSummary: {
        outsideRadius: 0,
        aboveBudget: 0,
        belowSqft: 0,
        belowBedrooms: 0,
        wrongPropertyType: 0,
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
    });
    geocodeCache.entries.push({
      id: "geocode-old",
      queryType: "city",
      queryValue: "Southfield, MI",
      provider: "mock",
      formattedAddress: "Southfield, MI",
      latitude: 42.47,
      longitude: -83.22,
      precision: "centroid",
      rawPayload: null,
      normalizedPayload: null,
      fetchedAt: oldTimestamp,
      expiresAt: oldTimestamp,
      sourceType: "mock"
    });

    const summary = await persistence.cleanupExpiredData({
      snapshotRetentionDays: 30,
      searchHistoryRetentionDays: 30
    });

    expect(summary.snapshotsRemoved).toBe(1);
    expect(summary.historyRemoved).toBe(1);
    expect(summary.cachesRemoved).toBe(3);
  });
});
