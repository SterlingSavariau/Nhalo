import { resetConfigCache } from "@nhalo/config";
import type {
  GeocoderProvider,
  ListingProvider,
  ListingSearchContext,
  ProviderStatus,
  ResolvedLocation,
  SafetyProvider
} from "@nhalo/types";
import { afterEach, describe, expect, it } from "vitest";
import { MetricsCollector } from "../src/metrics";
import { instrumentProviders } from "../src/provider-runtime";

const ORIGINAL_ENV = { ...process.env };

function healthyStatus(provider: string): ProviderStatus {
  return {
    provider,
    providerName: provider,
    status: "healthy",
    lastUpdatedAt: new Date().toISOString(),
    dataAgeHours: 0,
    latencyMs: 0,
    failureCount: 0,
    mode: "mock",
    detail: "ok"
  };
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  resetConfigCache();
});

describe("provider runtime controls", () => {
  it("retries a transient provider failure and succeeds deterministically", async () => {
    process.env.NODE_ENV = "test";
    process.env.PROVIDER_RETRY_COUNT = "1";
    process.env.PROVIDER_TIMEOUT_MS = "100";
    resetConfigCache();

    let attempts = 0;
    const geocoder: GeocoderProvider = {
      name: "TransientGeocoder",
      async geocode() {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("temporary outage");
        }
        return {
          geocodeId: "city:southfield, mi",
          locationType: "city",
          locationValue: "Southfield, MI",
          formattedAddress: "Southfield, MI",
          latitude: 42.47,
          longitude: -83.22,
          precision: "centroid",
          center: { lat: 42.47, lng: -83.22 },
          provider: "TransientGeocoder"
        } as ResolvedLocation;
      },
      async getStatus() {
        return healthyStatus("GeocoderProvider");
      }
    };
    const listings: ListingProvider = {
      name: "ListingProvider",
      async fetchListings(_context: ListingSearchContext) {
        return [];
      },
      async getStatus() {
        return healthyStatus("ListingProvider");
      }
    };
    const safety: SafetyProvider = {
      name: "SafetyProvider",
      async fetchSafetyData() {
        return new Map();
      },
      async getStatus() {
        return healthyStatus("SafetyProvider");
      }
    };

    const runtime = instrumentProviders(
      { geocoder, listings, safety },
      new MetricsCollector()
    );

    const resolved = await runtime.geocoder.geocode("city", "Southfield, MI");

    expect(resolved?.formattedAddress).toBe("Southfield, MI");
    expect(attempts).toBe(2);
  });

  it("uses cached fallback when provider budgets are exhausted", async () => {
    process.env.NODE_ENV = "test";
    process.env.PROVIDER_BUDGETS_ENABLED = "true";
    process.env.GEOCODER_PROVIDER_MODE = "live";
    process.env.GEOCODER_PROVIDER_MAX_CALLS_PER_MINUTE = "1";
    resetConfigCache();

    let attempts = 0;
    const geocoder: GeocoderProvider = {
      name: "BudgetedGeocoder",
      async geocode() {
        attempts += 1;
        return {
          geocodeId: "city:southfield, mi",
          locationType: "city",
          locationValue: "Southfield, MI",
          formattedAddress: "Southfield, MI",
          latitude: 42.47,
          longitude: -83.22,
          precision: "centroid",
          center: { lat: 42.47, lng: -83.22 },
          provider: "BudgetedGeocoder",
          geocodeDataSource: "live",
          fetchedAt: new Date().toISOString()
        } as ResolvedLocation;
      },
      async getStatus() {
        return {
          ...healthyStatus("GeocoderProvider"),
          mode: "live"
        };
      }
    };
    const listings: ListingProvider = {
      name: "ListingProvider",
      async fetchListings(_context: ListingSearchContext) {
        return [];
      },
      async getStatus() {
        return healthyStatus("ListingProvider");
      }
    };
    const safety: SafetyProvider = {
      name: "SafetyProvider",
      async fetchSafetyData() {
        return new Map();
      },
      async getStatus() {
        return healthyStatus("SafetyProvider");
      }
    };

    const runtime = instrumentProviders({ geocoder, listings, safety }, new MetricsCollector());

    const first = await runtime.geocoder.geocode("city", "Southfield, MI");
    const second = await runtime.geocoder.geocode("city", "Southfield, MI");
    const usage = runtime.getLastProviderUsage();

    expect(first?.formattedAddress).toBe("Southfield, MI");
    expect(second?.formattedAddress).toBe("Southfield, MI");
    expect(attempts).toBe(1);
    expect(usage.geocoderBudgetExceeded).toBe(true);
    expect(usage.geocoderCacheHits).toBe(1);
    expect(usage.geocoderLiveFetches).toBe(0);
  });
});
