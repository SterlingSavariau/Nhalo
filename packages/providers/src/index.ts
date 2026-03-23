import { getListingConfig, getSafetyConfig } from "@nhalo/config";
import type {
  GeocoderProvider,
  ListingCacheRepository,
  ListingProvider,
  SafetyProvider,
  SafetySignalCacheRepository
} from "@nhalo/types";
import {
  CompositeListingProvider,
  createListingProvider,
  DefaultListingNormalizationService,
  HttpListingSourceProvider
} from "./listing";
import {
  createMockProviders,
  MockGeocoderProvider,
  MockListingProvider,
  MockSafetyProvider,
  distanceMiles
} from "./mock-providers";
import {
  CompositeSafetyProvider,
  createSafetyProvider,
  HttpCrimeSignalProvider,
  HttpSchoolSignalProvider
} from "./safety";

export function createProviders(options: {
  safetySignalCacheRepository: SafetySignalCacheRepository;
  listingCacheRepository: ListingCacheRepository;
  metrics?: {
    recordProviderRequest(providerName: string, latencyMs: number, failed: boolean): void;
    recordSafetyResolution(payload: {
      source: "live" | "cached_live" | "stale_cached_live" | "mock" | "none";
      cacheHit: boolean;
      liveFetch: boolean;
      fallback: boolean;
    }): void;
    recordListingResolution(payload: {
      source: "live" | "cached_live" | "stale_cached_live" | "mock" | "none";
      cacheHit: boolean;
      liveFetch: boolean;
      fallback: boolean;
    }): void;
    recordListingNormalization(payload: {
      totalProcessed: number;
      failures: number;
    }): void;
  };
  fetcher?: typeof fetch;
}): {
  geocoder: GeocoderProvider;
  listings: ListingProvider;
  safety: SafetyProvider;
} {
  const safetyConfig = getSafetyConfig();
  const listingConfig = getListingConfig();

  return {
    geocoder: new MockGeocoderProvider(),
    listings: createListingProvider(options.listingCacheRepository, {
      config: listingConfig,
      fetcher: options.fetcher,
      metrics: options.metrics,
      mockProvider: new MockListingProvider()
    }),
    safety: createSafetyProvider(options.safetySignalCacheRepository, {
      config: safetyConfig,
      fetcher: options.fetcher,
      metrics: options.metrics
    })
  };
}

export {
  CompositeListingProvider,
  CompositeSafetyProvider,
  createListingProvider,
  createMockProviders,
  createSafetyProvider,
  DefaultListingNormalizationService,
  distanceMiles,
  HttpCrimeSignalProvider,
  HttpListingSourceProvider,
  HttpSchoolSignalProvider,
  MockGeocoderProvider,
  MockListingProvider,
  MockSafetyProvider
};

export { MOCK_LISTINGS, MOCK_LOCATIONS, MOCK_SAFETY } from "./mock-data";
