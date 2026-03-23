import { getSafetyConfig } from "@nhalo/config";
import type { GeocoderProvider, ListingProvider, SafetyProvider, SafetySignalCacheRepository } from "@nhalo/types";
import {
  createMockProviders,
  MockGeocoderProvider,
  MockListingProvider,
  MockSafetyProvider,
  distanceMiles
} from "./mock-providers";
import { createSafetyProvider, HttpCrimeSignalProvider, HttpSchoolSignalProvider, CompositeSafetyProvider } from "./safety";

export function createProviders(options: {
  safetySignalCacheRepository: SafetySignalCacheRepository;
  metrics?: {
    recordProviderRequest(providerName: string, latencyMs: number, failed: boolean): void;
    recordSafetyResolution(payload: {
      source: "live" | "cached_live" | "stale_cached_live" | "mock" | "none";
      cacheHit: boolean;
      liveFetch: boolean;
      fallback: boolean;
    }): void;
  };
  fetcher?: typeof fetch;
}): {
  geocoder: GeocoderProvider;
  listings: ListingProvider;
  safety: SafetyProvider;
} {
  const safetyConfig = getSafetyConfig();

  return {
    geocoder: new MockGeocoderProvider(),
    listings: new MockListingProvider(),
    safety: createSafetyProvider(options.safetySignalCacheRepository, {
      config: safetyConfig,
      fetcher: options.fetcher,
      metrics: options.metrics
    })
  };
}

export {
  CompositeSafetyProvider,
  createMockProviders,
  createSafetyProvider,
  distanceMiles,
  HttpCrimeSignalProvider,
  HttpSchoolSignalProvider,
  MockGeocoderProvider,
  MockListingProvider,
  MockSafetyProvider
};

export { MOCK_LISTINGS, MOCK_LOCATIONS, MOCK_SAFETY } from "./mock-data";
