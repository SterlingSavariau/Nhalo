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
      name: this.name,
      healthy: true,
      mode: "mock",
      freshness: "static snapshot",
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
      name: this.name,
      healthy: true,
      mode: "mock",
      freshness: LISTING_FRESHNESS,
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
      name: this.name,
      healthy: true,
      mode: "mock",
      freshness: SAFETY_FRESHNESS,
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
