import {
  InMemorySafetySignalCacheRepository
} from "@nhalo/db";
import {
  CompositeSafetyProvider,
  HttpCrimeSignalProvider,
  HttpSchoolSignalProvider,
  MOCK_LISTINGS,
  MockSafetyProvider
} from "@nhalo/providers";
import type {
  CrimeSignalProvider,
  ProviderStatus,
  SchoolSignalProvider,
  SafetyProvider
} from "@nhalo/types";
import { describe, expect, it } from "vitest";

const listing = MOCK_LISTINGS[0];

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

class NullCrimeProvider implements CrimeSignalProvider {
  readonly name = "null-crime";
  async fetchCrimeSignal() {
    return null;
  }
  async getStatus(): Promise<ProviderStatus> {
    return {
      provider: "CrimeSignalProvider",
      providerName: "CrimeSignalProvider",
      status: "unavailable",
      lastUpdatedAt: null,
      dataAgeHours: null,
      latencyMs: null,
      failureCount: 0,
      mode: "live",
      detail: "No crime provider configured."
    };
  }
}

class NullSchoolProvider implements SchoolSignalProvider {
  readonly name = "null-school";
  async fetchSchoolSignal() {
    return null;
  }
  async getStatus(): Promise<ProviderStatus> {
    return {
      provider: "SchoolSignalProvider",
      providerName: "SchoolSignalProvider",
      status: "unavailable",
      lastUpdatedAt: null,
      dataAgeHours: null,
      latencyMs: null,
      failureCount: 0,
      mode: "live",
      detail: "No school provider configured."
    };
  }
}

class EmptyMockSafetyProvider implements SafetyProvider {
  readonly name = "empty-mock-safety";
  async fetchSafetyData() {
    return new Map();
  }
  async getStatus(): Promise<ProviderStatus> {
    return {
      provider: "SafetyProvider",
      providerName: "SafetyProvider",
      status: "healthy",
      lastUpdatedAt: null,
      dataAgeHours: null,
      latencyMs: null,
      failureCount: 0,
      mode: "mock",
      detail: "No mock safety data available."
    };
  }
}

describe("live safety providers", () => {
  it("normalizes school ratings deterministically to 0-100", async () => {
    const provider = new HttpSchoolSignalProvider(
      {
        baseUrl: "https://school.example/api",
        apiKey: "test-key",
        configured: true
      },
      "hybrid",
      async () =>
        jsonResponse({
          rating: 8.4,
          maxRating: 10,
          provider: "school-http",
          fetchedAt: "2026-03-22T20:15:00Z"
        })
    );

    const signal = await provider.fetchSchoolSignal(listing);

    expect(signal?.normalized).toBe(84);
    expect(signal?.provider).toBe("school-http");
  });

  it("normalizes crime inputs deterministically to a 0-100 risk index", async () => {
    const provider = new HttpCrimeSignalProvider(
      {
        baseUrl: "https://crime.example/api",
        apiKey: "test-key",
        configured: true
      },
      "hybrid",
      async () =>
        jsonResponse({
          riskScore: 18,
          maxRiskScore: 60,
          provider: "crime-http",
          fetchedAt: "2026-03-22T20:15:00Z"
        })
    );

    const signal = await provider.fetchCrimeSignal(listing);

    expect(signal?.normalized).toBe(30);
    expect(signal?.provider).toBe("crime-http");
  });

  it("reports unavailable status and does not fail when env configuration is missing", async () => {
    const provider = new HttpSchoolSignalProvider(
      {
        baseUrl: undefined,
        apiKey: undefined,
        configured: false
      },
      "hybrid"
    );

    expect(await provider.fetchSchoolSignal(listing)).toBeNull();
    expect(await provider.getStatus()).toMatchObject({
      status: "unavailable",
      lastUpdatedAt: null
    });
  });
});

describe("composite safety provider", () => {
  it("prefers fresh cached live data before live fetch", async () => {
    const cacheRepository = new InMemorySafetySignalCacheRepository();
    await cacheRepository.save({
      locationKey: `${listing.coordinates.lat.toFixed(3)}:${listing.coordinates.lng.toFixed(3)}`,
      lat: listing.coordinates.lat,
      lng: listing.coordinates.lng,
      crimeProvider: "cached-crime",
      schoolProvider: "cached-school",
      crimeRaw: { riskScore: 15 },
      crimeNormalized: 15,
      schoolRaw: { rating: 9 },
      schoolNormalized: 90,
      stabilityRaw: 71,
      stabilityNormalized: 71,
      fetchedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      sourceType: "live"
    });

    const provider = new CompositeSafetyProvider({
      cacheRepository,
      config: {
        mode: "hybrid",
        cacheTtlHours: 24,
        staleTtlHours: 168,
        crime: { baseUrl: "https://crime.example/api", apiKey: "key", configured: true },
        school: { baseUrl: "https://school.example/api", apiKey: "key", configured: true }
      },
      crimeProvider: new NullCrimeProvider(),
      schoolProvider: new NullSchoolProvider(),
      mockProvider: new MockSafetyProvider()
    });

    const data = await provider.fetchSafetyData([listing]);

    expect(data.get(listing.id)?.safetyDataSource).toBe("cached_live");
  });

  it("falls back to stale cached live data before mock", async () => {
    const cacheRepository = new InMemorySafetySignalCacheRepository();
    await cacheRepository.save({
      locationKey: `${listing.coordinates.lat.toFixed(3)}:${listing.coordinates.lng.toFixed(3)}`,
      lat: listing.coordinates.lat,
      lng: listing.coordinates.lng,
      crimeProvider: "cached-crime",
      schoolProvider: "cached-school",
      crimeRaw: { riskScore: 15 },
      crimeNormalized: 15,
      schoolRaw: { rating: 9 },
      schoolNormalized: 90,
      stabilityRaw: 71,
      stabilityNormalized: 71,
      fetchedAt: "2026-03-22T00:00:00.000Z",
      expiresAt: "2026-03-23T00:00:00.000Z",
      sourceType: "live"
    });

    const provider = new CompositeSafetyProvider({
      cacheRepository,
      config: {
        mode: "hybrid",
        cacheTtlHours: 1,
        staleTtlHours: 1000,
        crime: { baseUrl: "https://crime.example/api", apiKey: "key", configured: true },
        school: { baseUrl: "https://school.example/api", apiKey: "key", configured: true }
      },
      crimeProvider: new NullCrimeProvider(),
      schoolProvider: new NullSchoolProvider(),
      mockProvider: new MockSafetyProvider()
    });

    const data = await provider.fetchSafetyData([listing]);

    expect(data.get(listing.id)?.safetyDataSource).toBe("stale_cached_live");
  });

  it("falls back to mock safety when no live or cached live data exists", async () => {
    const provider = new CompositeSafetyProvider({
      cacheRepository: new InMemorySafetySignalCacheRepository(),
      config: {
        mode: "hybrid",
        cacheTtlHours: 24,
        staleTtlHours: 168,
        crime: { baseUrl: "https://crime.example/api", apiKey: "key", configured: true },
        school: { baseUrl: "https://school.example/api", apiKey: "key", configured: true }
      },
      crimeProvider: new NullCrimeProvider(),
      schoolProvider: new NullSchoolProvider(),
      mockProvider: new MockSafetyProvider()
    });

    const data = await provider.fetchSafetyData([listing]);

    expect(data.get(listing.id)?.safetyDataSource).toBe("mock");
  });

  it("returns none when live, cache, and mock data are all unavailable", async () => {
    const provider = new CompositeSafetyProvider({
      cacheRepository: new InMemorySafetySignalCacheRepository(),
      config: {
        mode: "live",
        cacheTtlHours: 24,
        staleTtlHours: 168,
        crime: { baseUrl: "https://crime.example/api", apiKey: "key", configured: true },
        school: { baseUrl: "https://school.example/api", apiKey: "key", configured: true }
      },
      crimeProvider: new NullCrimeProvider(),
      schoolProvider: new NullSchoolProvider(),
      mockProvider: new EmptyMockSafetyProvider()
    });

    const data = await provider.fetchSafetyData([listing]);

    expect(data.get(listing.id)?.safetyDataSource).toBe("none");
  });
});
