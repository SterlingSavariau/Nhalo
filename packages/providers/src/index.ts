import { getGeocoderConfig, getListingConfig, getSafetyConfig } from "@nhalo/config";
import type {
  GeocodeCacheRepository,
  GeocoderProvider,
  ListingCacheRepository,
  ListingProvider,
  SafetyProvider,
  SafetySignalCacheRepository
} from "@nhalo/types";
import {
  CompositeGeocoderProvider,
  createGeocoderProvider,
  DefaultGeocodingNormalizationService,
  HttpGeocodingSourceProvider
} from "./geocoder";
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
  geocodeCacheRepository: GeocodeCacheRepository;
  safetySignalCacheRepository: SafetySignalCacheRepository;
  listingCacheRepository: ListingCacheRepository;
  metrics?: {
    recordProviderRequest(providerName: string, latencyMs: number, failed: boolean): void;
    recordGeocodeResolution(payload: {
      source: "live" | "cached_live" | "stale_cached_live" | "mock" | "none";
      cacheHit: boolean;
      liveFetch: boolean;
      fallback: boolean;
      ambiguous: boolean;
      precision: "rooftop" | "range_interpolated" | "approximate" | "centroid" | "mock" | "none";
    }): void;
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
  const geocoderConfig = getGeocoderConfig();
  const safetyConfig = getSafetyConfig();
  const listingConfig = getListingConfig();

  return {
    geocoder: createGeocoderProvider(options.geocodeCacheRepository, {
      config: geocoderConfig,
      fetcher: options.fetcher,
      metrics: options.metrics,
      mockProvider: new MockGeocoderProvider()
    }),
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
  CompositeGeocoderProvider,
  CompositeListingProvider,
  CompositeSafetyProvider,
  createGeocoderProvider,
  createListingProvider,
  createMockProviders,
  createSafetyProvider,
  DefaultGeocodingNormalizationService,
  DefaultListingNormalizationService,
  distanceMiles,
  HttpCrimeSignalProvider,
  HttpGeocodingSourceProvider,
  HttpListingSourceProvider,
  HttpSchoolSignalProvider,
  MockGeocoderProvider,
  MockListingProvider,
  MockSafetyProvider
};

export { MOCK_LISTINGS, MOCK_LOCATIONS, MOCK_SAFETY } from "./mock-data";
