import { InMemoryListingCacheRepository } from "@nhalo/db";
import {
  CompositeListingProvider,
  DefaultListingNormalizationService,
  HttpListingSourceProvider,
  MOCK_LISTINGS,
  MockListingProvider
} from "@nhalo/providers";
import type {
  ListingProvider,
  ListingSearchContext,
  ListingSourceProvider,
  ProviderStatus
} from "@nhalo/types";
import { describe, expect, it } from "vitest";

const listing = MOCK_LISTINGS[0];

function jsonResponse(payload: Record<string, unknown> | unknown[], status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

const searchContext: ListingSearchContext = {
  center: listing.coordinates,
  radiusMiles: 5,
  location: {
    locationType: "city",
    locationValue: "Southfield, MI",
    center: listing.coordinates,
    city: "Southfield",
    state: "MI",
    postalCode: "48075"
  },
  propertyTypes: ["single_family", "condo", "townhome"]
};

class StaticSourceProvider implements ListingSourceProvider {
  readonly name = "test-listing-source";

  constructor(
    private readonly payload: Record<string, unknown>[],
    private readonly status: ProviderStatus = {
      provider: "ListingSourceProvider",
      providerName: "ListingSourceProvider",
      status: "healthy",
      lastUpdatedAt: "2026-03-22T20:15:00Z",
      dataAgeHours: 0,
      latencyMs: 20,
      failureCount: 0,
      mode: "live",
      detail: "Test listing source provider."
    }
  ) {}

  async fetchRawListings(): Promise<Record<string, unknown>[]> {
    return this.payload;
  }

  async getStatus(): Promise<ProviderStatus> {
    return this.status;
  }
}

class EmptyListingProvider implements ListingProvider {
  readonly name = "empty-listings";

  async fetchListings() {
    return [];
  }

  async getStatus(): Promise<ProviderStatus> {
    return {
      provider: "ListingProvider",
      providerName: "ListingProvider",
      status: "healthy",
      lastUpdatedAt: null,
      dataAgeHours: null,
      latencyMs: null,
      failureCount: 0,
      mode: "mock",
      detail: "No listing data available."
    };
  }
}

describe("live listing provider", () => {
  it("does not fail startup when env configuration is missing", async () => {
    const provider = new HttpListingSourceProvider(
      {
        baseUrl: undefined,
        apiKey: undefined,
        configured: false
      },
      "hybrid"
    );

    expect(await provider.fetchRawListings(searchContext)).toEqual([]);
    expect(await provider.getStatus()).toMatchObject({
      status: "unavailable",
      lastUpdatedAt: null
    });
  });

  it("reads provider-ready HTTP payloads safely", async () => {
    const provider = new HttpListingSourceProvider(
      {
        baseUrl: "https://listing.example/api",
        apiKey: "listing-key",
        configured: true
      },
      "hybrid",
      async () =>
        jsonResponse({
          listings: [
            {
              listingId: "abc-123",
              address: "123 Main St",
              city: "Southfield",
              state: "MI",
              zipCode: "48075",
              lat: 42.48,
              lng: -83.22,
              propertyType: "Single Family",
              price: 320000,
              squareFootage: 2000,
              bedrooms: 3,
              bathrooms: 2.5
            }
          ],
          fetchedAt: "2026-03-22T20:15:00Z"
        })
    );

    const payload = await provider.fetchRawListings(searchContext);

    expect(payload).toHaveLength(1);
    expect(payload[0]?.listingId).toBe("abc-123");
  });
});

describe("listing normalization", () => {
  it("normalizes listings deterministically and rejects duplicates or invalid records", () => {
    const service = new DefaultListingNormalizationService();
    const result = service.normalize(
      [
        {
          listingId: "live-001",
          address: "123 Main St",
          city: "Southfield",
          state: "MI",
          zipCode: "48075",
          lat: 42.48,
          lng: -83.22,
          propertyType: "Single Family",
          price: 320000,
          squareFootage: 2000,
          bedrooms: 3,
          bathrooms: 2.5
        },
        {
          listingId: "live-001",
          address: "123 Main St",
          city: "Southfield",
          state: "MI",
          zipCode: "48075",
          lat: 42.48,
          lng: -83.22,
          propertyType: "Single Family",
          price: 320000,
          squareFootage: 2000,
          bedrooms: 3,
          bathrooms: 2.5
        },
        {
          listingId: "invalid-001",
          address: "456 Side St",
          city: "Southfield",
          state: "MI",
          zipCode: "48075",
          lat: 999,
          lng: -83.22,
          propertyType: "Single Family",
          price: 275000,
          squareFootage: 1800
        },
        {
          listingId: "missing-sqft",
          address: "789 Lake Dr",
          city: "Southfield",
          state: "MI",
          zipCode: "48075",
          lat: 42.47,
          lng: -83.21,
          propertyType: "condo",
          price: 210000
        }
      ],
      "ListingSourceProvider",
      "2026-03-22T20:15:00Z",
      "live"
    );

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]).toMatchObject({
      sourceProvider: "ListingSourceProvider",
      sourceListingId: "live-001",
      pricePerSqft: 160,
      propertyType: "single_family",
      listingDataSource: "live"
    });
    expect(result.rejectionSummary.duplicateListings).toBe(1);
    expect(result.rejectionSummary.invalidCoordinates).toBe(1);
    expect(result.rejectionSummary.missingSquareFootage).toBe(1);
  });
});

describe("composite listing provider", () => {
  it("prefers fresh cached live listings before live fetch", async () => {
    const cacheRepository = new InMemoryListingCacheRepository();
    await cacheRepository.save({
      locationKey: "city:southfield, mi:5:single_family",
      locationType: "city",
      locationValue: "Southfield, MI",
      radiusMiles: 5,
      provider: "listing-live-http",
      rawPayload: [{ listingId: "cached-001" }],
      normalizedListings: [
        {
          ...listing,
          id: "listing-live-http:cached-001",
          propertyId: "listing-live-http:cached-001",
          sourceProvider: "listing-live-http",
          sourceListingId: "cached-001",
          listingDataSource: "live",
          fetchedAt: new Date().toISOString()
        }
      ],
      fetchedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      sourceType: "live",
      rejectionSummary: {
        duplicateListings: 0,
        invalidCoordinates: 0,
        missingAddress: 0,
        missingPrice: 0,
        missingSquareFootage: 0,
        unsupportedPropertyType: 0,
        normalizationFailures: 0
      }
    });

    const provider = new CompositeListingProvider({
      cacheRepository,
      config: {
        mode: "hybrid",
        cacheTtlHours: 24,
        staleTtlHours: 72,
        provider: {
          baseUrl: "https://listing.example/api",
          apiKey: "listing-key",
          configured: true
        }
      },
      sourceProvider: new StaticSourceProvider([]),
      mockProvider: new MockListingProvider()
    });

    const data = await provider.fetchListings({
      ...searchContext,
      propertyTypes: ["single_family"]
    });

    expect(data[0]?.listingDataSource).toBe("cached_live");
  });

  it("falls back from stale cache to mock and then none deterministically", async () => {
    const cacheRepository = new InMemoryListingCacheRepository();
    await cacheRepository.save({
      locationKey: "city:southfield, mi:5:condo,single_family,townhome",
      locationType: "city",
      locationValue: "Southfield, MI",
      radiusMiles: 5,
      provider: "listing-live-http",
      rawPayload: [{ listingId: "stale-001" }],
      normalizedListings: [
        {
          ...listing,
          id: "listing-live-http:stale-001",
          propertyId: "listing-live-http:stale-001",
          sourceProvider: "listing-live-http",
          sourceListingId: "stale-001",
          listingDataSource: "live",
          fetchedAt: "2026-03-20T00:00:00.000Z"
        }
      ],
      fetchedAt: "2026-03-20T00:00:00.000Z",
      expiresAt: "2026-03-21T00:00:00.000Z",
      sourceType: "live",
      rejectionSummary: {
        duplicateListings: 0,
        invalidCoordinates: 0,
        missingAddress: 0,
        missingPrice: 0,
        missingSquareFootage: 0,
        unsupportedPropertyType: 0,
        normalizationFailures: 0
      }
    });

    const staleProvider = new CompositeListingProvider({
      cacheRepository,
      config: {
        mode: "hybrid",
        cacheTtlHours: 1,
        staleTtlHours: 500,
        provider: {
          baseUrl: "https://listing.example/api",
          apiKey: "listing-key",
          configured: true
        }
      },
      sourceProvider: new StaticSourceProvider([]),
      mockProvider: new EmptyListingProvider()
    });

    const staleData = await staleProvider.fetchListings(searchContext);
    expect(staleData[0]?.listingDataSource).toBe("stale_cached_live");

    const noneProvider = new CompositeListingProvider({
      cacheRepository: new InMemoryListingCacheRepository(),
      config: {
        mode: "live",
        cacheTtlHours: 1,
        staleTtlHours: 1,
        provider: {
          baseUrl: "https://listing.example/api",
          apiKey: "listing-key",
          configured: true
        }
      },
      sourceProvider: new StaticSourceProvider([]),
      mockProvider: new EmptyListingProvider()
    });

    const noData = await noneProvider.fetchListings(searchContext);
    expect(noData).toEqual([]);
    expect((await noneProvider.getStatus()).lastSourceUsed).toBe("none");
  });
});
