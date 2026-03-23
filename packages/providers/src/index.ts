import type {
  GeocoderProvider,
  ListingProvider,
  ListingRecord,
  ListingSearchContext,
  LocationType,
  ProviderStatus,
  ResolvedLocation,
  SafetyProvider,
  SafetyRecord
} from "@nhalo/types";
import { MOCK_LISTINGS, MOCK_LOCATIONS, MOCK_SAFETY } from "./mock-data";

const LISTING_FRESHNESS = "daily";
const SAFETY_FRESHNESS = "weekly";
const SEEDED_UPDATED_AT = "2026-03-22T20:15:00Z";

function toKey(locationType: LocationType, locationValue: string): string {
  return `${locationType}:${locationValue.trim().toLowerCase()}`;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function distanceMiles(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number }
): number {
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(end.lat - start.lat);
  const dLng = toRadians(end.lng - start.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(start.lat)) *
      Math.cos(toRadians(end.lat)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(a));
}

export class MockGeocoderProvider implements GeocoderProvider {
  readonly name = "mock-geocoder";

  async geocode(locationType: LocationType, locationValue: string): Promise<ResolvedLocation | null> {
    return MOCK_LOCATIONS[toKey(locationType, locationValue)] ?? null;
  }

  async getStatus(): Promise<ProviderStatus> {
    return {
      provider: "GeocoderProvider",
      providerName: "GeocoderProvider",
      status: "healthy",
      lastUpdatedAt: SEEDED_UPDATED_AT,
      dataAgeHours: 0,
      latencyMs: 0,
      failureCount: 0,
      mode: "mock",
      detail: "Mock geocoder covers seeded city and ZIP examples."
    };
  }
}

export class MockListingProvider implements ListingProvider {
  readonly name = "mock-listings";

  async fetchListings(context: ListingSearchContext): Promise<ListingRecord[]> {
    return MOCK_LISTINGS.filter((listing) => {
      const withinRadius =
        distanceMiles(context.center, listing.coordinates) <= context.radiusMiles;
      const propertyTypeMatch =
        !context.propertyTypes || context.propertyTypes.includes(listing.propertyType);

      return withinRadius && propertyTypeMatch;
    });
  }

  async getStatus(): Promise<ProviderStatus> {
    return {
      provider: "ListingProvider",
      providerName: "ListingProvider",
      status: "healthy",
      lastUpdatedAt: SEEDED_UPDATED_AT,
      dataAgeHours: 0,
      latencyMs: 0,
      failureCount: 0,
      mode: "mock",
      detail: `Mock listing provider seeded with ${MOCK_LISTINGS.length} listings.`
    };
  }
}

export class MockSafetyProvider implements SafetyProvider {
  readonly name = "mock-safety";

  async fetchSafetyData(listings: ListingRecord[]): Promise<Map<string, SafetyRecord>> {
    const listingIds = new Set(listings.map((listing) => listing.id));
    const safetyRecords = MOCK_SAFETY.filter((entry) => listingIds.has(entry.propertyId));

    return new Map(safetyRecords.map((entry) => [entry.propertyId, entry]));
  }

  async getStatus(): Promise<ProviderStatus> {
    return {
      provider: "SafetyProvider",
      providerName: "SafetyProvider",
      status: "healthy",
      lastUpdatedAt: SEEDED_UPDATED_AT,
      dataAgeHours: 0,
      latencyMs: 0,
      failureCount: 0,
      mode: "mock",
      detail: "Mock safety provider includes crime, school, and stability signals."
    };
  }
}

export function createMockProviders(): {
  geocoder: GeocoderProvider;
  listings: ListingProvider;
  safety: SafetyProvider;
} {
  return {
    geocoder: new MockGeocoderProvider(),
    listings: new MockListingProvider(),
    safety: new MockSafetyProvider()
  };
}

export { MOCK_LISTINGS, MOCK_LOCATIONS, MOCK_SAFETY } from "./mock-data";
