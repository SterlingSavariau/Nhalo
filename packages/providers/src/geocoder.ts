import {
  getGeocoderConfig,
  type GeocoderConfig
} from "@nhalo/config";
import type {
  GeocodeCacheRecord,
  GeocodeCacheRepository,
  GeocodeDataSource,
  GeocodePrecision,
  GeocodeResolutionIssue,
  GeocoderProvider,
  GeocoderProviderMode,
  GeocodingNormalizationResult,
  GeocodingNormalizationService,
  GeocodingSourceProvider,
  LocationType,
  ProviderHealthStatus,
  ProviderStatus,
  ResolvedLocation
} from "@nhalo/types";
import { MockGeocoderProvider } from "./mock-providers";

type FetchLike = typeof fetch;

interface GeocodeMetricsRecorder {
  recordProviderRequest(providerName: string, latencyMs: number, failed: boolean): void;
  recordGeocodeResolution(payload: {
    source: GeocodeDataSource;
    cacheHit: boolean;
    liveFetch: boolean;
    fallback: boolean;
    ambiguous: boolean;
    precision: GeocodePrecision;
  }): void;
}

type SourceProviderState = {
  lastUpdatedAt: string | null;
  latencyMs: number | null;
  failureCount: number;
  status: ProviderHealthStatus;
  detail: string;
};

function createState(detail: string, status: ProviderHealthStatus): SourceProviderState {
  return {
    lastUpdatedAt: null,
    latencyMs: null,
    failureCount: 0,
    status,
    detail
  };
}

function dataAgeHours(timestamp: string | null): number | null {
  if (!timestamp) {
    return null;
  }

  return Number((((Date.now() - new Date(timestamp).getTime()) / 3_600_000)).toFixed(2));
}

function normalizeQueryValue(value: string): string {
  return value.trim().toLowerCase();
}

function parseNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function extractString(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function extractNumeric(payload: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = parseNumeric(payload[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function mapPrecision(value: string | null, locationType: LocationType, sourceType: GeocodeDataSource): GeocodePrecision {
  if (sourceType === "mock") {
    return "mock";
  }

  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized.includes("roof")) {
    return "rooftop";
  }
  if (normalized.includes("interpol")) {
    return "range_interpolated";
  }
  if (normalized.includes("centroid")) {
    return "centroid";
  }
  if (normalized.includes("approx")) {
    return "approximate";
  }

  return locationType === "address" ? "approximate" : "centroid";
}

function geocodeKey(locationType: LocationType, locationValue: string): string {
  return `${locationType}:${normalizeQueryValue(locationValue)}`;
}

function issue(
  code: GeocodeResolutionIssue["code"],
  message: string,
  details?: Array<{ field?: string; message: string }>
): GeocodeResolutionIssue {
  return { code, message, details };
}

abstract class HttpGeocodingSourceBase {
  protected readonly state: SourceProviderState;

  constructor(
    protected readonly providerName: string,
    protected readonly mode: GeocoderProviderMode,
    protected readonly configured: boolean,
    protected readonly detail: string,
    protected readonly metrics?: GeocodeMetricsRecorder
  ) {
    this.state = createState(detail, configured ? "healthy" : "unavailable");
  }

  protected completeRequest(latencyMs: number, failed: boolean, updatedAt: string | null, error?: unknown) {
    this.state.latencyMs = latencyMs;
    if (updatedAt) {
      this.state.lastUpdatedAt = updatedAt;
    }
    if (failed) {
      this.state.failureCount += 1;
      this.state.status = this.state.lastUpdatedAt ? "degraded" : "failing";
      this.state.detail =
        error instanceof Error ? `${this.detail}. Last error: ${error.message}` : `${this.detail}. Last error recorded.`;
    } else if (this.configured) {
      this.state.status = "healthy";
      this.state.detail = this.detail;
    }
    this.metrics?.recordProviderRequest(this.providerName, latencyMs, failed);
  }

  async getStatus(): Promise<ProviderStatus> {
    if (!this.configured) {
      return {
        provider: this.providerName,
        providerName: this.providerName,
        status: "unavailable",
        lastUpdatedAt: null,
        dataAgeHours: null,
        latencyMs: this.state.latencyMs,
        failureCount: this.state.failureCount,
        mode: "live",
        detail: this.detail
      };
    }

    return {
      provider: this.providerName,
      providerName: this.providerName,
      status: this.state.status,
      lastUpdatedAt: this.state.lastUpdatedAt,
      dataAgeHours: dataAgeHours(this.state.lastUpdatedAt),
      latencyMs: this.state.latencyMs,
      failureCount: this.state.failureCount,
      mode: "live",
      detail: this.state.detail
    };
  }
}

export class HttpGeocodingSourceProvider
  extends HttpGeocodingSourceBase
  implements GeocodingSourceProvider
{
  readonly name = "geocoder-live-http";

  constructor(
    private readonly config: GeocoderConfig["provider"],
    mode: GeocoderProviderMode,
    private readonly fetcher: FetchLike = fetch,
    metrics?: GeocodeMetricsRecorder
  ) {
    super(
      "GeocodingSourceProvider",
      mode,
      config.configured,
      config.configured
        ? "HTTP geocoding source provider is configured."
        : "Geocoding source provider is unavailable because GEOCODER_PROVIDER_BASE_URL or GEOCODER_PROVIDER_API_KEY is missing.",
      metrics
    );
  }

  async fetchRawGeocode(locationType: LocationType, locationValue: string): Promise<unknown> {
    if (!this.config.configured || !this.config.baseUrl || !this.config.apiKey) {
      return null;
    }

    const startedAt = Date.now();

    try {
      const url = new URL(this.config.baseUrl);
      url.searchParams.set("locationType", locationType);
      url.searchParams.set("locationValue", locationValue);
      const response = await this.fetcher(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "x-api-key": this.config.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Geocoder provider returned ${response.status}`);
      }

      const payload = (await response.json()) as unknown;
      let fetchedAt: string | null = null;
      if (payload && typeof payload === "object" && !Array.isArray(payload)) {
        fetchedAt = extractString(payload as Record<string, unknown>, ["fetchedAt", "updatedAt"]);
      }
      this.completeRequest(Date.now() - startedAt, false, fetchedAt ?? new Date().toISOString());
      return payload;
    } catch (error) {
      this.completeRequest(Date.now() - startedAt, true, null, error);
      throw error;
    }
  }
}

export class DefaultGeocodingNormalizationService implements GeocodingNormalizationService {
  normalize(
    payload: unknown,
    providerName: string,
    locationType: LocationType,
    locationValue: string,
    fetchedAt: string,
    sourceType: GeocodeDataSource
  ): GeocodingNormalizationResult {
    if (payload === null || payload === undefined) {
      return {
        geocode: null,
        ambiguous: false,
        rawPayload: null,
        normalizedPayload: null,
        issue: issue("LOCATION_NOT_FOUND", "Location could not be resolved by the current geocoder.")
      };
    }

    const candidates = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as { results?: unknown[] })?.results)
        ? ((payload as { results: unknown[] }).results ?? [])
        : Array.isArray((payload as { candidates?: unknown[] })?.candidates)
          ? ((payload as { candidates: unknown[] }).candidates ?? [])
          : [payload];
    const geocodeCandidates = candidates.filter(
      (entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object")
    );

    if (locationType === "address" && geocodeCandidates.length > 1) {
      return {
        geocode: null,
        ambiguous: true,
        rawPayload: geocodeCandidates,
        normalizedPayload: null,
        issue: issue("AMBIGUOUS_ADDRESS", "Address search returned multiple matches.", [
          {
            field: "locationValue",
            message: "Provide a more specific address to avoid ambiguous matches."
          }
        ])
      };
    }

    const primary = geocodeCandidates[0];
    if (!primary) {
      return {
        geocode: null,
        ambiguous: false,
        rawPayload: null,
        normalizedPayload: null,
        issue:
          locationType === "zip" && !/^\d{5}$/.test(locationValue.trim())
            ? issue("INVALID_ZIP", "ZIP code must be a 5-digit value.", [
                { field: "locationValue", message: "ZIP code must be a 5-digit value." }
              ])
            : issue("LOCATION_NOT_FOUND", "Location could not be resolved by the current geocoder.")
      };
    }

    const latitude = extractNumeric(primary, ["latitude", "lat"]);
    const longitude = extractNumeric(primary, ["longitude", "lng", "lon"]);
    if (latitude === null || longitude === null) {
      return {
        geocode: null,
        ambiguous: false,
        rawPayload: primary,
        normalizedPayload: null,
        issue: issue(
          "MALFORMED_GEOCODER_RESPONSE",
          "Geocoder response did not include usable coordinates."
        )
      };
    }

    const formattedAddress =
      extractString(primary, ["formattedAddress", "displayName", "address"]) ?? locationValue;
    const normalizedPayload = {
      formattedAddress,
      latitude,
      longitude,
      precision: mapPrecision(
        extractString(primary, ["precision", "locationType", "matchType"]),
        locationType,
        sourceType
      ),
      city: extractString(primary, ["city", "locality"]),
      state: extractString(primary, ["state", "stateCode", "region"]),
      zip:
        extractString(primary, ["zip", "zipCode", "postalCode"]) ??
        (locationType === "zip" ? locationValue.trim() : null),
      country: extractString(primary, ["country", "countryCode"]) ?? "US"
    };

    return {
      geocode: {
        geocodeId: geocodeKey(locationType, locationValue),
        locationType,
        locationValue,
        formattedAddress,
        latitude,
        longitude,
        precision: normalizedPayload.precision,
        center: {
          lat: latitude,
          lng: longitude
        },
        city: normalizedPayload.city ?? undefined,
        state: normalizedPayload.state ?? undefined,
        postalCode: normalizedPayload.zip ?? undefined,
        country: normalizedPayload.country ?? undefined,
        provider: providerName,
        geocodeDataSource: sourceType,
        fetchedAt,
        rawGeocodeInputs: Array.isArray(payload) ? geocodeCandidates : primary,
        normalizedGeocodeInputs: normalizedPayload
      },
      ambiguous: false,
      rawPayload: Array.isArray(payload) ? geocodeCandidates : primary,
      normalizedPayload
    };
  }
}

function geocodeSourceStatus(
  mode: GeocoderProviderMode,
  lastSourceUsed: GeocodeDataSource | null,
  childStatuses: ProviderStatus[]
): ProviderHealthStatus {
  if (mode === "mock") {
    return "healthy";
  }

  if (lastSourceUsed === "live" || lastSourceUsed === "cached_live") {
    return childStatuses.some((status) => status.status !== "healthy") ? "degraded" : "healthy";
  }

  if (lastSourceUsed === "stale_cached_live" || lastSourceUsed === "mock") {
    return "degraded";
  }

  if (childStatuses.every((status) => status.status === "unavailable")) {
    return "unavailable";
  }

  return "failing";
}

function geocodeFromCache(entry: GeocodeCacheRecord, locationType: LocationType, locationValue: string): ResolvedLocation {
  return {
    geocodeId: geocodeKey(locationType, locationValue),
    locationType,
    locationValue,
    formattedAddress: entry.formattedAddress,
    latitude: entry.latitude,
    longitude: entry.longitude,
    precision: entry.precision,
    center: {
      lat: entry.latitude,
      lng: entry.longitude
    },
    city: entry.city ?? undefined,
    state: entry.state ?? undefined,
    postalCode: entry.zip ?? undefined,
    country: entry.country ?? undefined,
    provider: entry.provider,
    geocodeDataSource: entry.sourceType,
    fetchedAt: entry.fetchedAt,
    rawGeocodeInputs: entry.rawPayload,
    normalizedGeocodeInputs: entry.normalizedPayload ?? null
  };
}

type CompositeGeocoderProviderOptions = {
  config?: GeocoderConfig;
  sourceProvider?: GeocodingSourceProvider;
  normalizationService?: GeocodingNormalizationService;
  mockProvider?: GeocoderProvider;
  cacheRepository: GeocodeCacheRepository;
  fetcher?: FetchLike;
  metrics?: GeocodeMetricsRecorder;
};

export class CompositeGeocoderProvider implements GeocoderProvider {
  readonly name = "hybrid-geocoder";
  private readonly config: GeocoderConfig;
  private readonly sourceProvider: GeocodingSourceProvider;
  private readonly normalizationService: GeocodingNormalizationService;
  private readonly mockProvider: GeocoderProvider;
  private lastSourceUsed: GeocodeDataSource | null = null;
  private lastUpdatedAt: string | null = null;
  private lastResolutionIssue: GeocodeResolutionIssue | null = null;

  constructor(private readonly options: CompositeGeocoderProviderOptions) {
    this.config = options.config ?? getGeocoderConfig();
    this.sourceProvider =
      options.sourceProvider ??
      new HttpGeocodingSourceProvider(
        this.config.provider,
        this.config.mode,
        options.fetcher,
        options.metrics
      );
    this.normalizationService =
      options.normalizationService ?? new DefaultGeocodingNormalizationService();
    this.mockProvider = options.mockProvider ?? new MockGeocoderProvider();
  }

  getLastResolutionIssue(): GeocodeResolutionIssue | null {
    return this.lastResolutionIssue;
  }

  async geocode(locationType: LocationType, locationValue: string): Promise<ResolvedLocation | null> {
    this.lastResolutionIssue = null;
    const cacheEntry =
      this.config.mode !== "mock"
        ? await this.options.cacheRepository.getLatest(locationType, locationValue)
        : null;

    if (
      this.config.mode !== "mock" &&
      cacheEntry &&
      this.options.cacheRepository.isFresh(cacheEntry, this.config.cacheTtlHours)
    ) {
      this.lastSourceUsed = "cached_live";
      this.lastUpdatedAt = cacheEntry.fetchedAt;
      this.options.metrics?.recordGeocodeResolution({
        source: "cached_live",
        cacheHit: true,
        liveFetch: false,
        fallback: false,
        ambiguous: false,
        precision: cacheEntry.precision
      });
      return geocodeFromCache(
        {
          ...cacheEntry,
          sourceType: "cached_live"
        },
        locationType,
        locationValue
      );
    }

    if (this.config.mode !== "mock") {
      try {
        const fetchedAt = new Date().toISOString();
        const payload = await this.sourceProvider.fetchRawGeocode(locationType, locationValue);
        const normalized = this.normalizationService.normalize(
          payload,
          this.sourceProvider.name,
          locationType,
          locationValue,
          fetchedAt,
          "live"
        );

        if (normalized.geocode) {
          await this.options.cacheRepository.save({
            queryType: locationType,
            queryValue: locationValue,
            provider: this.sourceProvider.name,
            formattedAddress: normalized.geocode.formattedAddress ?? null,
            latitude: normalized.geocode.latitude,
            longitude: normalized.geocode.longitude,
            precision: normalized.geocode.precision,
            rawPayload: normalized.rawPayload,
            normalizedPayload: normalized.normalizedPayload,
            fetchedAt,
            expiresAt: new Date(Date.now() + this.config.cacheTtlHours * 3_600_000).toISOString(),
            sourceType: "live",
            city: normalized.geocode.city ?? null,
            state: normalized.geocode.state ?? null,
            zip: normalized.geocode.postalCode ?? null,
            country: normalized.geocode.country ?? null
          });
          this.lastSourceUsed = "live";
          this.lastUpdatedAt = fetchedAt;
          this.options.metrics?.recordGeocodeResolution({
            source: "live",
            cacheHit: false,
            liveFetch: true,
            fallback: false,
            ambiguous: false,
            precision: normalized.geocode.precision
          });
          return normalized.geocode;
        }

        this.lastResolutionIssue = normalized.issue ?? null;
        if (normalized.ambiguous) {
          this.options.metrics?.recordGeocodeResolution({
            source: "none",
            cacheHit: false,
            liveFetch: true,
            fallback: false,
            ambiguous: true,
            precision: "none"
          });
        }
      } catch {
        // continue with stale cache and mock fallback
      }
    }

    if (
      this.config.mode !== "mock" &&
      cacheEntry &&
      this.options.cacheRepository.isStaleUsable(cacheEntry, this.config.staleTtlHours)
    ) {
      this.lastSourceUsed = "stale_cached_live";
      this.lastUpdatedAt = cacheEntry.fetchedAt;
      this.options.metrics?.recordGeocodeResolution({
        source: "stale_cached_live",
        cacheHit: true,
        liveFetch: false,
        fallback: true,
        ambiguous: false,
        precision: cacheEntry.precision
      });
      return geocodeFromCache(
        {
          ...cacheEntry,
          sourceType: "stale_cached_live"
        },
        locationType,
        locationValue
      );
    }

    const mockLocation = await this.mockProvider.geocode(locationType, locationValue);
    if (mockLocation) {
      this.lastSourceUsed = "mock";
      this.lastUpdatedAt = mockLocation.fetchedAt ?? null;
      this.options.metrics?.recordGeocodeResolution({
        source: "mock",
        cacheHit: false,
        liveFetch: false,
        fallback: true,
        ambiguous: false,
        precision: mockLocation.precision
      });
      return {
        ...mockLocation,
        geocodeDataSource: "mock"
      };
    }

    this.lastSourceUsed = "none";
    this.options.metrics?.recordGeocodeResolution({
      source: "none",
      cacheHit: false,
      liveFetch: false,
      fallback: true,
      ambiguous: Boolean(this.lastResolutionIssue?.code === "AMBIGUOUS_ADDRESS"),
      precision: "none"
    });
    if (!this.lastResolutionIssue) {
      this.lastResolutionIssue = issue(
        "LOCATION_NOT_FOUND",
        "Location is not available from the current provider set."
      );
    }
    return null;
  }

  async getStatus(): Promise<ProviderStatus> {
    const childStatus = await this.sourceProvider.getStatus();

    return {
      provider: "GeocoderProvider",
      providerName: "GeocoderProvider",
      status: geocodeSourceStatus(this.config.mode, this.lastSourceUsed, [childStatus]),
      lastUpdatedAt: this.lastUpdatedAt,
      dataAgeHours: dataAgeHours(this.lastUpdatedAt),
      latencyMs: childStatus.latencyMs,
      failureCount: childStatus.failureCount,
      mode: this.config.mode === "mock" ? "mock" : "live",
      detail:
        this.config.mode === "mock"
          ? "Geocoder provider is running in mock mode."
          : "Geocoder resolves fresh cache, live fetch, stale cache, and mock fallback.",
      children: [childStatus],
      lastSourceUsed: this.lastSourceUsed
    };
  }
}

export function createGeocoderProvider(
  cacheRepository: GeocodeCacheRepository,
  options?: Omit<CompositeGeocoderProviderOptions, "cacheRepository">
): CompositeGeocoderProvider {
  return new CompositeGeocoderProvider({
    cacheRepository,
    ...options
  });
}
