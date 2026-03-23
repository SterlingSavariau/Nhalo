import {
  getSafetyConfig,
  type SafetyConfig
} from "@nhalo/config";
import type {
  CrimeSignal,
  CrimeSignalProvider,
  ListingRecord,
  ProviderHealthStatus,
  ProviderStatus,
  SafetyAggregationProvider,
  SafetyDataSource,
  SafetyProvider,
  SafetyProviderMode,
  SafetyRecord,
  SafetySignalCacheRecord,
  SafetySignalCacheRepository,
  SchoolSignal,
  SchoolSignalProvider
} from "@nhalo/types";
import { MockSafetyProvider } from "./mock-providers";

type FetchLike = typeof fetch;

interface SafetyMetricsRecorder {
  recordProviderRequest(providerName: string, latencyMs: number, failed: boolean): void;
  recordSafetyResolution(payload: {
    source: SafetyDataSource;
    cacheHit: boolean;
    liveFetch: boolean;
    fallback: boolean;
  }): void;
}

type SignalProviderState = {
  lastUpdatedAt: string | null;
  latencyMs: number | null;
  failureCount: number;
  status: ProviderHealthStatus;
  detail: string;
};

function createState(detail: string, status: ProviderHealthStatus): SignalProviderState {
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

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function roundToTwo(value: number): number {
  return Number(value.toFixed(2));
}

function extractNumericValue(
  payload: Record<string, unknown>,
  candidateKeys: string[]
): number | null {
  for (const key of candidateKeys) {
    const value = payload[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function buildLocationKey(listing: ListingRecord): string {
  return `${listing.coordinates.lat.toFixed(3)}:${listing.coordinates.lng.toFixed(3)}`;
}

abstract class HttpSignalProviderBase {
  protected readonly state: SignalProviderState;

  constructor(
    protected readonly providerName: string,
    protected readonly mode: SafetyProviderMode,
    protected readonly configured: boolean,
    protected readonly detail: string,
    protected readonly metrics?: SafetyMetricsRecorder
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
    if (this.metrics) {
      this.metrics.recordProviderRequest(this.providerName, latencyMs, failed);
    }
  }

  protected unavailableStatus(): ProviderStatus {
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

  async getStatus(): Promise<ProviderStatus> {
    if (!this.configured) {
      return this.unavailableStatus();
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

export class HttpSchoolSignalProvider
  extends HttpSignalProviderBase
  implements SchoolSignalProvider
{
  readonly name = "school-live-http";

  constructor(
    private readonly config: SafetyConfig["school"],
    mode: SafetyProviderMode,
    private readonly fetcher: FetchLike = fetch,
    metrics?: SafetyMetricsRecorder
  ) {
    super(
      "SchoolSignalProvider",
      mode,
      config.configured,
      config.configured
        ? "HTTP school signal provider is configured."
        : "School signal provider is unavailable because SCHOOL_PROVIDER_BASE_URL or SCHOOL_PROVIDER_API_KEY is missing.",
      metrics
    );
  }

  async fetchSchoolSignal(listing: ListingRecord): Promise<SchoolSignal | null> {
    if (!this.config.configured || !this.config.baseUrl || !this.config.apiKey) {
      return null;
    }

    const startedAt = Date.now();

    try {
      const url = new URL(this.config.baseUrl);
      url.searchParams.set("lat", String(listing.coordinates.lat));
      url.searchParams.set("lng", String(listing.coordinates.lng));
      url.searchParams.set("zipCode", listing.zipCode);
      const response = await this.fetcher(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "x-api-key": this.config.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`School provider returned ${response.status}`);
      }

      const payload = (await response.json()) as Record<string, unknown>;
      const rawRating = extractNumericValue(payload, ["schoolRating", "rating", "score"]);
      const maxRating =
        extractNumericValue(payload, ["maxRating", "scaleMax", "maxScore"]) ?? 10;

      if (rawRating === null) {
        this.completeRequest(Date.now() - startedAt, true, null, new Error("School rating missing from provider response"));
        return null;
      }

      const normalized = roundToTwo(clamp((rawRating / Math.max(maxRating, 1)) * 100));
      const fetchedAt =
        typeof payload.fetchedAt === "string" ? payload.fetchedAt : new Date().toISOString();

      this.completeRequest(Date.now() - startedAt, false, fetchedAt);

      return {
        propertyId: listing.id,
        provider: typeof payload.provider === "string" ? payload.provider : this.name,
        fetchedAt,
        raw: payload,
        normalized
      };
    } catch (error) {
      this.completeRequest(Date.now() - startedAt, true, null, error);
      return null;
    }
  }
}

export class HttpCrimeSignalProvider
  extends HttpSignalProviderBase
  implements CrimeSignalProvider
{
  readonly name = "crime-live-http";

  constructor(
    private readonly config: SafetyConfig["crime"],
    mode: SafetyProviderMode,
    private readonly fetcher: FetchLike = fetch,
    metrics?: SafetyMetricsRecorder
  ) {
    super(
      "CrimeSignalProvider",
      mode,
      config.configured,
      config.configured
        ? "HTTP crime signal provider is configured."
        : "Crime signal provider is unavailable because CRIME_PROVIDER_BASE_URL or CRIME_PROVIDER_API_KEY is missing.",
      metrics
    );
  }

  async fetchCrimeSignal(listing: ListingRecord): Promise<CrimeSignal | null> {
    if (!this.config.configured || !this.config.baseUrl || !this.config.apiKey) {
      return null;
    }

    const startedAt = Date.now();

    try {
      const url = new URL(this.config.baseUrl);
      url.searchParams.set("lat", String(listing.coordinates.lat));
      url.searchParams.set("lng", String(listing.coordinates.lng));
      url.searchParams.set("zipCode", listing.zipCode);
      const response = await this.fetcher(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "x-api-key": this.config.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Crime provider returned ${response.status}`);
      }

      const payload = (await response.json()) as Record<string, unknown>;
      const rawRisk = extractNumericValue(payload, ["crimeIndex", "riskScore", "incidentsPer1000"]);
      const maxRisk =
        extractNumericValue(payload, ["maxRiskScore", "maxCrimeIndex", "scaleMax"]) ?? 100;

      if (rawRisk === null) {
        this.completeRequest(Date.now() - startedAt, true, null, new Error("Crime score missing from provider response"));
        return null;
      }

      const normalized = roundToTwo(clamp((rawRisk / Math.max(maxRisk, 1)) * 100));
      const fetchedAt =
        typeof payload.fetchedAt === "string" ? payload.fetchedAt : new Date().toISOString();

      this.completeRequest(Date.now() - startedAt, false, fetchedAt);

      return {
        propertyId: listing.id,
        provider: typeof payload.provider === "string" ? payload.provider : this.name,
        fetchedAt,
        raw: payload,
        normalized
      };
    } catch (error) {
      this.completeRequest(Date.now() - startedAt, true, null, error);
      return null;
    }
  }
}

type CompositeSafetyProviderOptions = {
  config?: SafetyConfig;
  schoolProvider?: SchoolSignalProvider;
  crimeProvider?: CrimeSignalProvider;
  mockProvider?: SafetyProvider;
  cacheRepository: SafetySignalCacheRepository;
  fetcher?: FetchLike;
  metrics?: SafetyMetricsRecorder;
};

function safetySourceStatus(
  mode: SafetyProviderMode,
  lastSourceUsed: SafetyDataSource | null,
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

function recordFromCache(
  listing: ListingRecord,
  cacheEntry: SafetySignalCacheRecord,
  source: SafetyDataSource
): SafetyRecord {
  const fetchedAt = cacheEntry.fetchedAt;

  return {
    propertyId: listing.id,
    crimeIndex: cacheEntry.crimeNormalized,
    schoolRating: cacheEntry.schoolNormalized,
    stabilityIndex: cacheEntry.stabilityNormalized,
    source: "live-safety-cache",
    updatedAt: fetchedAt,
    safetyDataSource: source,
    crimeProvider: cacheEntry.crimeProvider,
    schoolProvider: cacheEntry.schoolProvider,
    crimeFetchedAt: fetchedAt,
    schoolFetchedAt: fetchedAt,
    crimeIndexRaw: cacheEntry.crimeRaw,
    crimeIndexNormalized: cacheEntry.crimeNormalized,
    schoolRatingRaw: cacheEntry.schoolRaw,
    schoolRatingNormalized: cacheEntry.schoolNormalized,
    rawSafetyInputs: {
      crime: cacheEntry.crimeRaw,
      schools: cacheEntry.schoolRaw,
      stability: cacheEntry.stabilityRaw
    },
    normalizedSafetyInputs: {
      crimeIndex: cacheEntry.crimeNormalized,
      schoolRating: cacheEntry.schoolNormalized,
      neighborhoodStability: cacheEntry.stabilityNormalized
    }
  };
}

function mergeSignals(
  listing: ListingRecord,
  source: SafetyDataSource,
  crimeSignal: CrimeSignal | null,
  schoolSignal: SchoolSignal | null,
  mockRecord: SafetyRecord | undefined
): SafetyRecord {
  const updatedAtCandidates = [
    crimeSignal?.fetchedAt,
    schoolSignal?.fetchedAt,
    mockRecord?.updatedAt
  ].filter((value): value is string => Boolean(value));
  const updatedAt = updatedAtCandidates.sort().at(-1) ?? new Date().toISOString();

  return {
    propertyId: listing.id,
    crimeIndex:
      source === "mock"
        ? mockRecord?.crimeIndex ?? null
        : crimeSignal?.normalized ?? null,
    schoolRating:
      source === "mock"
        ? mockRecord?.schoolRating ?? null
        : schoolSignal?.normalized ?? null,
    stabilityIndex: mockRecord?.stabilityIndex ?? null,
    source: source === "mock" ? "mock-safety" : "live-safety",
    updatedAt,
    safetyDataSource: source,
    crimeProvider:
      source === "mock"
        ? mockRecord?.crimeProvider ?? "mock-safety"
        : crimeSignal?.provider ?? null,
    schoolProvider:
      source === "mock"
        ? mockRecord?.schoolProvider ?? "mock-safety"
        : schoolSignal?.provider ?? null,
    crimeFetchedAt: source === "mock" ? mockRecord?.updatedAt ?? null : crimeSignal?.fetchedAt ?? null,
    schoolFetchedAt: source === "mock" ? mockRecord?.updatedAt ?? null : schoolSignal?.fetchedAt ?? null,
    crimeIndexRaw: source === "mock" ? mockRecord?.crimeIndexRaw ?? null : crimeSignal?.raw ?? null,
    crimeIndexNormalized:
      source === "mock"
        ? mockRecord?.crimeIndex ?? null
        : crimeSignal?.normalized ?? null,
    schoolRatingRaw: source === "mock" ? mockRecord?.schoolRatingRaw ?? null : schoolSignal?.raw ?? null,
    schoolRatingNormalized:
      source === "mock"
        ? mockRecord?.schoolRating ?? null
        : schoolSignal?.normalized ?? null,
    rawSafetyInputs: {
      crime: source === "mock" ? mockRecord?.crimeIndexRaw ?? null : crimeSignal?.raw ?? null,
      schools: source === "mock" ? mockRecord?.schoolRatingRaw ?? null : schoolSignal?.raw ?? null,
      stability: mockRecord?.rawSafetyInputs?.stability ?? mockRecord?.stabilityIndex ?? null
    },
    normalizedSafetyInputs: {
      crimeIndex:
        source === "mock"
          ? mockRecord?.crimeIndex ?? null
          : crimeSignal?.normalized ?? null,
      schoolRating:
        source === "mock"
          ? mockRecord?.schoolRating ?? null
          : schoolSignal?.normalized ?? null,
      neighborhoodStability: mockRecord?.stabilityIndex ?? null
    }
  };
}

export class CompositeSafetyProvider
  implements SafetyProvider, SafetyAggregationProvider
{
  readonly name = "hybrid-safety";
  private readonly config: SafetyConfig;
  private readonly crimeProvider: CrimeSignalProvider;
  private readonly schoolProvider: SchoolSignalProvider;
  private readonly mockProvider: SafetyProvider;
  private lastSourceUsed: SafetyDataSource | null = null;
  private lastUpdatedAt: string | null = null;

  constructor(private readonly options: CompositeSafetyProviderOptions) {
    this.config = options.config ?? getSafetyConfig();
    this.crimeProvider =
      options.crimeProvider ??
      new HttpCrimeSignalProvider(
        this.config.crime,
        this.config.mode,
        options.fetcher,
        options.metrics
      );
    this.schoolProvider =
      options.schoolProvider ??
      new HttpSchoolSignalProvider(
        this.config.school,
        this.config.mode,
        options.fetcher,
        options.metrics
      );
    this.mockProvider = options.mockProvider ?? new MockSafetyProvider();
  }

  async fetchSafetyData(listings: ListingRecord[]): Promise<Map<string, SafetyRecord>> {
    const results = new Map<string, SafetyRecord>();
    const mockMap = await this.mockProvider.fetchSafetyData(listings);

    for (const listing of listings) {
      const locationKey = buildLocationKey(listing);
      const cacheEntry = await this.options.cacheRepository.getLatest(locationKey);
      const mockRecord = mockMap.get(listing.id);

      if (this.config.mode !== "mock" && cacheEntry && this.options.cacheRepository.isFresh(cacheEntry, this.config.cacheTtlHours)) {
        const record = recordFromCache(listing, cacheEntry, "cached_live");
        results.set(listing.id, record);
        this.lastSourceUsed = "cached_live";
        this.lastUpdatedAt = record.updatedAt;
        this.options.metrics?.recordSafetyResolution({
          source: "cached_live",
          cacheHit: true,
          liveFetch: false,
          fallback: false
        });
        continue;
      }

      if (this.config.mode !== "mock") {
        const [crimeSignal, schoolSignal] = await Promise.all([
          this.crimeProvider.fetchCrimeSignal(listing),
          this.schoolProvider.fetchSchoolSignal(listing)
        ]);

        if (crimeSignal || schoolSignal) {
          const liveRecord = mergeSignals(listing, "live", crimeSignal, schoolSignal, mockRecord);
          results.set(listing.id, liveRecord);
          this.lastSourceUsed = "live";
          this.lastUpdatedAt = liveRecord.updatedAt;
          await this.options.cacheRepository.save({
            locationKey,
            lat: listing.coordinates.lat,
            lng: listing.coordinates.lng,
            crimeProvider: crimeSignal?.provider ?? null,
            schoolProvider: schoolSignal?.provider ?? null,
            crimeRaw: crimeSignal?.raw ?? null,
            crimeNormalized: crimeSignal?.normalized ?? null,
            schoolRaw: schoolSignal?.raw ?? null,
            schoolNormalized: schoolSignal?.normalized ?? null,
            stabilityRaw:
              (mockRecord?.rawSafetyInputs?.stability as Record<string, unknown> | number | null | undefined) ??
              mockRecord?.stabilityIndex ??
              null,
            stabilityNormalized: mockRecord?.stabilityIndex ?? null,
            fetchedAt: liveRecord.updatedAt,
            expiresAt: new Date(Date.now() + this.config.cacheTtlHours * 3_600_000).toISOString(),
            sourceType: "live"
          });
          this.options.metrics?.recordSafetyResolution({
            source: "live",
            cacheHit: false,
            liveFetch: true,
            fallback: false
          });
          continue;
        }
      }

      if (
        this.config.mode !== "mock" &&
        cacheEntry &&
        this.options.cacheRepository.isStaleUsable(cacheEntry, this.config.staleTtlHours)
      ) {
        const record = recordFromCache(listing, cacheEntry, "stale_cached_live");
        results.set(listing.id, record);
        this.lastSourceUsed = "stale_cached_live";
        this.lastUpdatedAt = record.updatedAt;
        this.options.metrics?.recordSafetyResolution({
          source: "stale_cached_live",
          cacheHit: true,
          liveFetch: false,
          fallback: true
        });
        continue;
      }

      if (mockRecord) {
        const record = mergeSignals(listing, "mock", null, null, mockRecord);
        results.set(listing.id, record);
        this.lastSourceUsed = "mock";
        this.lastUpdatedAt = record.updatedAt;
        this.options.metrics?.recordSafetyResolution({
          source: "mock",
          cacheHit: false,
          liveFetch: false,
          fallback: true
        });
        continue;
      }

      results.set(listing.id, {
        propertyId: listing.id,
        crimeIndex: null,
        schoolRating: null,
        stabilityIndex: null,
        source: "none",
        updatedAt: new Date().toISOString(),
        safetyDataSource: "none",
        crimeProvider: null,
        schoolProvider: null,
        crimeFetchedAt: null,
        schoolFetchedAt: null,
        crimeIndexRaw: null,
        crimeIndexNormalized: null,
        schoolRatingRaw: null,
        schoolRatingNormalized: null,
        rawSafetyInputs: null,
        normalizedSafetyInputs: null
      });
      this.lastSourceUsed = "none";
      this.options.metrics?.recordSafetyResolution({
        source: "none",
        cacheHit: false,
        liveFetch: false,
        fallback: true
      });
    }

    return results;
  }

  async getStatus(): Promise<ProviderStatus> {
    const children = await Promise.all([
      this.crimeProvider.getStatus(),
      this.schoolProvider.getStatus()
    ]);

    return {
      provider: "SafetyProvider",
      providerName: "SafetyProvider",
      status: safetySourceStatus(this.config.mode, this.lastSourceUsed, children),
      lastUpdatedAt: this.lastUpdatedAt,
      dataAgeHours: dataAgeHours(this.lastUpdatedAt),
      latencyMs: null,
      failureCount: children.reduce((sum, child) => sum + child.failureCount, 0),
      mode: this.config.mode === "mock" ? "mock" : "live",
      detail:
        this.config.mode === "mock"
          ? "Safety provider is running in mock mode."
          : "Safety provider is running in hybrid live/mock mode.",
      children,
      lastSourceUsed: this.lastSourceUsed
    };
  }
}

export function createSafetyProvider(
  cacheRepository: SafetySignalCacheRepository,
  options: Omit<CompositeSafetyProviderOptions, "cacheRepository"> = {}
): SafetyProvider {
  return new CompositeSafetyProvider({
    cacheRepository,
    ...options
  });
}
