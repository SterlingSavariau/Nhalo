import { InMemoryGeocodeCacheRepository } from "@nhalo/db";
import {
  CompositeGeocoderProvider,
  DefaultGeocodingNormalizationService,
  HttpGeocodingSourceProvider,
  MockGeocoderProvider
} from "@nhalo/providers";
import type {
  GeocoderProvider,
  GeocodingSourceProvider,
  ProviderStatus
} from "@nhalo/types";
import { describe, expect, it } from "vitest";

function jsonResponse(payload: Record<string, unknown> | unknown[], status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

class StaticGeocodingSourceProvider implements GeocodingSourceProvider {
  readonly name = "test-geocoder";

  constructor(
    private readonly payload: unknown,
    private readonly status: ProviderStatus = {
      provider: "GeocodingSourceProvider",
      providerName: "GeocodingSourceProvider",
      status: "healthy",
      lastUpdatedAt: "2026-03-22T20:15:00Z",
      dataAgeHours: 0,
      latencyMs: 15,
      failureCount: 0,
      mode: "live",
      detail: "Test geocoding provider."
    }
  ) {}

  async fetchRawGeocode(): Promise<unknown> {
    return this.payload;
  }

  async getStatus(): Promise<ProviderStatus> {
    return this.status;
  }
}

class EmptyGeocoderProvider implements GeocoderProvider {
  readonly name = "empty-geocoder";
  async geocode() {
    return null;
  }
  async getStatus(): Promise<ProviderStatus> {
    return {
      provider: "GeocoderProvider",
      providerName: "GeocoderProvider",
      status: "healthy",
      lastUpdatedAt: null,
      dataAgeHours: null,
      latencyMs: null,
      failureCount: 0,
      mode: "mock",
      detail: "No mock geocode available."
    };
  }
}

describe("live geocoder adapter", () => {
  it("does not fail startup when env configuration is missing", async () => {
    const provider = new HttpGeocodingSourceProvider(
      {
        baseUrl: undefined,
        apiKey: undefined,
        configured: false
      },
      "hybrid"
    );

    expect(await provider.fetchRawGeocode("city", "Southfield, MI")).toBeNull();
    expect(await provider.getStatus()).toMatchObject({
      status: "unavailable",
      lastUpdatedAt: null
    });
  });

  it("fetches provider-ready payloads safely", async () => {
    const provider = new HttpGeocodingSourceProvider(
      {
        baseUrl: "https://geocoder.example/api",
        apiKey: "geo-key",
        configured: true
      },
      "hybrid",
      async () =>
        jsonResponse({
          results: [
            {
              formattedAddress: "28510 Pierce St, Southfield, MI 48076, USA",
              latitude: 42.5004,
              longitude: -83.2208,
              precision: "rooftop"
            }
          ],
          fetchedAt: "2026-03-22T20:15:00Z"
        })
    );

    const payload = await provider.fetchRawGeocode("address", "28510 Pierce St, Southfield, MI 48076");

    expect((payload as { results: unknown[] }).results).toHaveLength(1);
  });
});

describe("geocode normalization", () => {
  it("normalizes city, zip, and address origins deterministically", () => {
    const service = new DefaultGeocodingNormalizationService();

    const cityResult = service.normalize(
      {
        results: [
          {
            formattedAddress: "Southfield, MI, USA",
            latitude: 42.4734,
            longitude: -83.2219,
            precision: "centroid",
            city: "Southfield",
            state: "MI",
            postalCode: "48075"
          }
        ]
      },
      "geocoder-live-http",
      "city",
      "Southfield, MI",
      "2026-03-22T20:15:00Z",
      "live"
    );

    const addressResult = service.normalize(
      [
        {
          formattedAddress: "28510 Pierce St, Southfield, MI 48076, USA",
          latitude: 42.5004,
          longitude: -83.2208,
          precision: "rooftop",
          city: "Southfield",
          state: "MI",
          postalCode: "48076"
        }
      ],
      "geocoder-live-http",
      "address",
      "28510 Pierce St, Southfield, MI 48076",
      "2026-03-22T20:15:00Z",
      "live"
    );

    expect(cityResult.geocode?.precision).toBe("centroid");
    expect(cityResult.geocode?.locationType).toBe("city");
    expect(addressResult.geocode?.precision).toBe("rooftop");
    expect(addressResult.geocode?.formattedAddress).toContain("Pierce");
  });

  it("returns explicit ambiguity for address searches with multiple matches", () => {
    const service = new DefaultGeocodingNormalizationService();
    const result = service.normalize(
      [
        { formattedAddress: "10 Main St, Detroit, MI", latitude: 42.33, longitude: -83.04 },
        { formattedAddress: "10 Main St, Royal Oak, MI", latitude: 42.49, longitude: -83.14 }
      ],
      "geocoder-live-http",
      "address",
      "10 Main St",
      "2026-03-22T20:15:00Z",
      "live"
    );

    expect(result.geocode).toBeNull();
    expect(result.ambiguous).toBe(true);
    expect(result.issue?.code).toBe("AMBIGUOUS_ADDRESS");
  });
});

describe("composite geocoder provider", () => {
  it("prefers fresh cached live geocodes before live fetch", async () => {
    const cacheRepository = new InMemoryGeocodeCacheRepository();
    await cacheRepository.save({
      queryType: "city",
      queryValue: "Southfield, MI",
      provider: "geocoder-live-http",
      formattedAddress: "Southfield, MI, USA",
      latitude: 42.4734,
      longitude: -83.2219,
      precision: "centroid",
      rawPayload: { provider: "cache" },
      normalizedPayload: { precision: "centroid" },
      fetchedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      sourceType: "live",
      city: "Southfield",
      state: "MI",
      zip: "48075",
      country: "US"
    });

    const provider = new CompositeGeocoderProvider({
      cacheRepository,
      config: {
        mode: "hybrid",
        cacheTtlHours: 168,
        staleTtlHours: 720,
        provider: {
          baseUrl: "https://geocoder.example/api",
          apiKey: "geo-key",
          configured: true
        }
      },
      sourceProvider: new StaticGeocodingSourceProvider(null),
      mockProvider: new MockGeocoderProvider()
    });

    const result = await provider.geocode("city", "Southfield, MI");

    expect(result?.geocodeDataSource).toBe("cached_live");
  });

  it("falls back to stale cache, then mock, then none deterministically", async () => {
    const cacheRepository = new InMemoryGeocodeCacheRepository();
    await cacheRepository.save({
      queryType: "city",
      queryValue: "Southfield, MI",
      provider: "geocoder-live-http",
      formattedAddress: "Southfield, MI, USA",
      latitude: 42.4734,
      longitude: -83.2219,
      precision: "centroid",
      rawPayload: { provider: "cache" },
      normalizedPayload: { precision: "centroid" },
      fetchedAt: "2026-03-20T00:00:00.000Z",
      expiresAt: "2026-03-21T00:00:00.000Z",
      sourceType: "live",
      city: "Southfield",
      state: "MI",
      zip: "48075",
      country: "US"
    });

    const staleProvider = new CompositeGeocoderProvider({
      cacheRepository,
      config: {
        mode: "hybrid",
        cacheTtlHours: 1,
        staleTtlHours: 1000,
        provider: {
          baseUrl: "https://geocoder.example/api",
          apiKey: "geo-key",
          configured: true
        }
      },
      sourceProvider: new StaticGeocodingSourceProvider(null),
      mockProvider: new EmptyGeocoderProvider()
    });

    expect((await staleProvider.geocode("city", "Southfield, MI"))?.geocodeDataSource).toBe(
      "stale_cached_live"
    );

    const mockProvider = new CompositeGeocoderProvider({
      cacheRepository: new InMemoryGeocodeCacheRepository(),
      config: {
        mode: "hybrid",
        cacheTtlHours: 1,
        staleTtlHours: 1,
        provider: {
          baseUrl: "https://geocoder.example/api",
          apiKey: "geo-key",
          configured: true
        }
      },
      sourceProvider: new StaticGeocodingSourceProvider(null),
      mockProvider: new MockGeocoderProvider()
    });
    expect((await mockProvider.geocode("city", "Southfield, MI"))?.geocodeDataSource).toBe("mock");

    const noneProvider = new CompositeGeocoderProvider({
      cacheRepository: new InMemoryGeocodeCacheRepository(),
      config: {
        mode: "live",
        cacheTtlHours: 1,
        staleTtlHours: 1,
        provider: {
          baseUrl: "https://geocoder.example/api",
          apiKey: "geo-key",
          configured: true
        }
      },
      sourceProvider: new StaticGeocodingSourceProvider(null),
      mockProvider: new EmptyGeocoderProvider()
    });
    expect(await noneProvider.geocode("city", "Nowhere, ZZ")).toBeNull();
    expect(noneProvider.getLastResolutionIssue()?.code).toBe("LOCATION_NOT_FOUND");
  });
});
