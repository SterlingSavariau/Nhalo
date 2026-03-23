import {
  getListingConfig,
  type ListingConfig
} from "@nhalo/config";
import type {
  ListingCacheRecord,
  ListingCacheRepository,
  ListingDataSource,
  ListingNormalizationResult,
  ListingNormalizationService,
  ListingProvider,
  ListingProviderMode,
  ListingRecord,
  ListingRejectionSummary,
  ListingSearchContext,
  ListingSourceProvider,
  ListingStatus,
  PropertyType,
  ProviderHealthStatus,
  ProviderStatus
} from "@nhalo/types";
import { MockListingProvider } from "./mock-providers";

type FetchLike = typeof fetch;

interface ListingMetricsRecorder {
  recordProviderRequest(providerName: string, latencyMs: number, failed: boolean): void;
  recordListingResolution(payload: {
    source: ListingDataSource;
    cacheHit: boolean;
    liveFetch: boolean;
    fallback: boolean;
  }): void;
  recordListingNormalization(payload: {
    totalProcessed: number;
    failures: number;
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

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function roundToTwo(value: number): number {
  return Number(value.toFixed(2));
}

function emptyRejectionSummary(): ListingRejectionSummary {
  return {
    outsideRadius: 0,
    aboveBudget: 0,
    belowSqft: 0,
    belowBedrooms: 0,
    wrongPropertyType: 0,
    duplicate: 0,
    invalidPrice: 0,
    duplicateListings: 0,
    invalidCoordinates: 0,
    missingAddress: 0,
    missingPrice: 0,
    missingSquareFootage: 0,
    unsupportedPropertyType: 0,
    malformedListing: 0,
    unsupportedListingStatus: 0,
    normalizationFailures: 0
  };
}

function addRejectionSummary(
  base: ListingRejectionSummary,
  next: ListingRejectionSummary
): ListingRejectionSummary {
  return {
    outsideRadius: base.outsideRadius + next.outsideRadius,
    aboveBudget: base.aboveBudget + next.aboveBudget,
    belowSqft: base.belowSqft + next.belowSqft,
    belowBedrooms: base.belowBedrooms + next.belowBedrooms,
    wrongPropertyType: base.wrongPropertyType + next.wrongPropertyType,
    duplicate: base.duplicate + next.duplicate,
    invalidPrice: base.invalidPrice + next.invalidPrice,
    duplicateListings: base.duplicateListings + next.duplicateListings,
    invalidCoordinates: base.invalidCoordinates + next.invalidCoordinates,
    missingAddress: base.missingAddress + next.missingAddress,
    missingPrice: base.missingPrice + next.missingPrice,
    missingSquareFootage: base.missingSquareFootage + next.missingSquareFootage,
    unsupportedPropertyType: base.unsupportedPropertyType + next.unsupportedPropertyType,
    malformedListing: base.malformedListing + next.malformedListing,
    unsupportedListingStatus: base.unsupportedListingStatus + next.unsupportedListingStatus,
    normalizationFailures: base.normalizationFailures + next.normalizationFailures
  };
}

function parseNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = Number(value.replace(/[$,]/g, "").trim());
    if (Number.isFinite(normalized)) {
      return normalized;
    }
  }

  return null;
}

function extractNumericValue(payload: Record<string, unknown>, candidateKeys: string[]): number | null {
  for (const key of candidateKeys) {
    const value = parseNumeric(payload[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function extractStringValue(payload: Record<string, unknown>, candidateKeys: string[]): string | null {
  for (const key of candidateKeys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function mapPropertyType(value: string | null): PropertyType | null {
  if (!value) {
    return "single_family";
  }

  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized.includes("condo")) {
    return "condo";
  }
  if (normalized.includes("town")) {
    return "townhome";
  }
  if (normalized.includes("multi")) {
    return "multi_family";
  }
  if (normalized.includes("single") || normalized.includes("house") || normalized.includes("residential")) {
    return "single_family";
  }

  return null;
}

function mapListingStatus(value: string | null): ListingStatus {
  if (!value) {
    return "active";
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.includes("coming")) {
    return "coming_soon";
  }
  if (normalized.includes("pending")) {
    return "pending";
  }
  if (normalized.includes("contingent")) {
    return "contingent";
  }
  if (normalized.includes("sold") || normalized.includes("closed")) {
    return "sold";
  }
  if (normalized.includes("off")) {
    return "off_market";
  }
  if (normalized.includes("active") || normalized.includes("new")) {
    return "active";
  }

  return "unknown";
}

function validCoordinates(lat: number | null, lng: number | null): lat is number {
  return (
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    typeof lng === "number" &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180
  );
}

function buildCanonicalId(providerName: string, sourceListingId: string, address: string, zipCode: string): string {
  const identifier = sourceListingId || `${address}:${zipCode}`;
  return `${providerName}:${identifier}`.toLowerCase().replace(/[^a-z0-9:-]+/g, "-");
}

function normalizeListingsForSource(
  listings: ListingRecord[],
  source: ListingDataSource
): ListingRecord[] {
  return listings.map((listing) => ({
    ...listing,
    listingDataSource: source
  }));
}

function locationCacheKey(context: ListingSearchContext): string {
  const propertyTypes = [...(context.propertyTypes ?? [])].sort().join(",");
  return [
    context.location.locationType,
    context.location.locationValue.trim().toLowerCase(),
    roundToTwo(context.radiusMiles),
    propertyTypes
  ].join(":");
}

abstract class HttpListingSourceBase {
  protected readonly state: SourceProviderState;

  constructor(
    protected readonly providerName: string,
    protected readonly mode: ListingProviderMode,
    protected readonly configured: boolean,
    protected readonly detail: string,
    protected readonly metrics?: ListingMetricsRecorder
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

export class HttpListingSourceProvider
  extends HttpListingSourceBase
  implements ListingSourceProvider
{
  readonly name = "listing-live-http";

  constructor(
    private readonly config: ListingConfig["provider"],
    mode: ListingProviderMode,
    private readonly fetcher: FetchLike = fetch,
    metrics?: ListingMetricsRecorder
  ) {
    super(
      "ListingSourceProvider",
      mode,
      config.configured,
      config.configured
        ? "HTTP listing source provider is configured."
        : "Listing source provider is unavailable because LISTING_PROVIDER_BASE_URL or LISTING_PROVIDER_API_KEY is missing.",
      metrics
    );
  }

  async fetchRawListings(context: ListingSearchContext): Promise<Record<string, unknown>[]> {
    if (!this.config.configured || !this.config.baseUrl || !this.config.apiKey) {
      return [];
    }

    const startedAt = Date.now();

    try {
      const url = new URL(this.config.baseUrl);
      url.searchParams.set("lat", String(context.center.lat));
      url.searchParams.set("lng", String(context.center.lng));
      url.searchParams.set("radiusMiles", String(context.radiusMiles));
      url.searchParams.set("locationType", context.location.locationType);
      url.searchParams.set("locationValue", context.location.locationValue);
      if (context.propertyTypes?.length) {
        url.searchParams.set("propertyTypes", context.propertyTypes.join(","));
      }

      const response = await this.fetcher(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "x-api-key": this.config.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Listing provider returned ${response.status}`);
      }

      const payload = (await response.json()) as unknown;
      const rawListings = Array.isArray(payload)
        ? payload
        : Array.isArray((payload as { listings?: unknown[] }).listings)
          ? ((payload as { listings: unknown[] }).listings ?? [])
          : Array.isArray((payload as { results?: unknown[] }).results)
            ? ((payload as { results: unknown[] }).results ?? [])
            : [];
      const fetchedAt = !Array.isArray(payload) && typeof payload === "object" && payload
        ? extractStringValue(payload as Record<string, unknown>, ["fetchedAt", "updatedAt"])
        : null;

      this.completeRequest(Date.now() - startedAt, false, fetchedAt ?? new Date().toISOString());

      return rawListings.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"));
    } catch (error) {
      this.completeRequest(Date.now() - startedAt, true, null, error);
      throw error;
    }
  }
}

export class DefaultListingNormalizationService implements ListingNormalizationService {
  normalize(
    payload: Record<string, unknown>[],
    providerName: string,
    fetchedAt: string,
    source: ListingDataSource
  ): ListingNormalizationResult {
    const rejectionSummary = emptyRejectionSummary();
    const listings: ListingRecord[] = [];
    const seenIds = new Set<string>();

    for (const rawListing of payload) {
      try {
        const address =
          extractStringValue(rawListing, ["address", "streetAddress", "line1", "fullAddress"]) ??
          extractStringValue(rawListing, ["street", "address1"]);
        const city = extractStringValue(rawListing, ["city", "municipality"]);
        const state = extractStringValue(rawListing, ["state", "stateCode"]);
        const zipCode =
          extractStringValue(rawListing, ["zip", "zipCode", "postalCode"]) ?? "";

        if (!address || !city || !state || !zipCode) {
          rejectionSummary.missingAddress += 1;
          continue;
        }

        const price = extractNumericValue(rawListing, ["price", "listPrice", "askingPrice"]);
        if (price === null || price <= 0) {
          rejectionSummary.missingPrice += 1;
          continue;
        }

        const squareFootage = extractNumericValue(rawListing, ["squareFootage", "sqft", "livingArea"]);
        if (squareFootage === null || squareFootage <= 0) {
          rejectionSummary.missingSquareFootage += 1;
          continue;
        }

        const latitude = extractNumericValue(rawListing, ["latitude", "lat"]);
        const longitude = extractNumericValue(rawListing, ["longitude", "lng", "lon"]);
        if (!validCoordinates(latitude, longitude)) {
          rejectionSummary.invalidCoordinates += 1;
          continue;
        }

        const propertyType = mapPropertyType(
          extractStringValue(rawListing, ["propertyType", "homeType", "property_type"])
        );
        if (!propertyType || propertyType === "multi_family") {
          rejectionSummary.unsupportedPropertyType += 1;
          continue;
        }

        const sourceListingId =
          extractStringValue(rawListing, ["sourceListingId", "listingId", "id", "mlsId"]) ??
          `${address}:${zipCode}`;
        const canonicalId = buildCanonicalId(providerName, sourceListingId, address, zipCode);

        if (seenIds.has(canonicalId)) {
          rejectionSummary.duplicateListings += 1;
          continue;
        }

        seenIds.add(canonicalId);

        const bathrooms =
          extractNumericValue(rawListing, ["bathrooms", "bathCount", "baths", "bathroomsTotal"]) ??
          0;
        const lotSize =
          extractNumericValue(rawListing, ["lotSize", "lotSqft", "lotSquareFeet", "lot_size"]) ??
          null;
        const pricePerSqft =
          extractNumericValue(rawListing, ["pricePerSqft", "price_per_sqft"]) ??
          roundToTwo(price / Math.max(squareFootage, 1));
        const listingStatus = mapListingStatus(
          extractStringValue(rawListing, ["listingStatus", "status"])
        );
        const bedrooms =
          extractNumericValue(rawListing, ["bedrooms", "beds", "bedCount", "bedroomsTotal"]) ?? 0;
        const daysOnMarket =
          extractNumericValue(rawListing, ["daysOnMarket", "dom"]) ?? null;
        const createdAt =
          extractStringValue(rawListing, ["createdAt", "listedAt"]) ?? fetchedAt;
        const updatedAt =
          extractStringValue(rawListing, ["updatedAt", "modifiedAt", "fetchedAt"]) ?? fetchedAt;

        listings.push({
          id: canonicalId,
          propertyId: canonicalId,
          provider: providerName,
          sourceProvider: providerName,
          sourceListingId,
          sourceUrl: extractStringValue(rawListing, ["sourceUrl", "url", "listingUrl"]) ?? undefined,
          address,
          city,
          state,
          zipCode,
          latitude,
          longitude,
          coordinates: { lat: latitude, lng: longitude },
          propertyType,
          listingStatus,
          daysOnMarket,
          price,
          pricePerSqft,
          sqft: squareFootage,
          squareFootage,
          bedrooms,
          bathrooms,
          lotSize,
          lotSqft: lotSize,
          listingDataSource: source,
          fetchedAt,
          createdAt,
          updatedAt,
          rawPayload: rawListing,
          rawListingInputs: rawListing,
          canonicalPropertyId: canonicalId,
          normalizedAddress: address.toLowerCase(),
          normalizedListingInputs: {
            address,
            city,
            state,
            zipCode,
            latitude,
            longitude,
            price,
            squareFootage,
            bedrooms,
            bathrooms,
            lotSize,
            propertyType,
            listingStatus,
            daysOnMarket,
            pricePerSqft
          }
        });
      } catch {
        rejectionSummary.normalizationFailures += 1;
      }
    }

    return {
      listings,
      rejectionSummary,
      rawPayload: payload
    };
  }
}

type CompositeListingProviderOptions = {
  config?: ListingConfig;
  sourceProvider?: ListingSourceProvider;
  normalizationService?: ListingNormalizationService;
  mockProvider?: ListingProvider;
  cacheRepository: ListingCacheRepository;
  fetcher?: FetchLike;
  metrics?: ListingMetricsRecorder;
};

function listingSourceStatus(
  mode: ListingProviderMode,
  lastSourceUsed: ListingDataSource | null,
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

export class CompositeListingProvider implements ListingProvider {
  readonly name = "hybrid-listings";
  private readonly config: ListingConfig;
  private readonly sourceProvider: ListingSourceProvider;
  private readonly normalizationService: ListingNormalizationService;
  private readonly mockProvider: ListingProvider;
  private lastSourceUsed: ListingDataSource | null = null;
  private lastUpdatedAt: string | null = null;
  private lastRejectionSummary: ListingRejectionSummary | null = null;

  constructor(private readonly options: CompositeListingProviderOptions) {
    this.config = options.config ?? getListingConfig();
    this.sourceProvider =
      options.sourceProvider ??
      new HttpListingSourceProvider(
        this.config.provider,
        this.config.mode,
        options.fetcher,
        options.metrics
      );
    this.normalizationService =
      options.normalizationService ?? new DefaultListingNormalizationService();
    this.mockProvider = options.mockProvider ?? new MockListingProvider();
  }

  getLastRejectionSummary(): ListingRejectionSummary | null {
    return this.lastRejectionSummary;
  }

  async fetchListings(context: ListingSearchContext): Promise<ListingRecord[]> {
    const cacheKey = locationCacheKey(context);
    const cacheEntry = this.config.mode !== "mock"
      ? await this.options.cacheRepository.getLatest(cacheKey)
      : null;

    if (
      this.config.mode !== "mock" &&
      cacheEntry &&
      this.options.cacheRepository.isFresh(cacheEntry, this.config.cacheTtlHours)
    ) {
      this.lastSourceUsed = "cached_live";
      this.lastUpdatedAt = cacheEntry.fetchedAt;
      this.lastRejectionSummary = cacheEntry.rejectionSummary;
      this.options.metrics?.recordListingResolution({
        source: "cached_live",
        cacheHit: true,
        liveFetch: false,
        fallback: false
      });
      return normalizeListingsForSource(cacheEntry.normalizedListings, "cached_live");
    }

    if (this.config.mode !== "mock") {
      try {
        const fetchedAt = new Date().toISOString();
        const rawPayload = await this.sourceProvider.fetchRawListings(context);
        const normalized = this.normalizationService.normalize(
          rawPayload,
          this.sourceProvider.name,
          fetchedAt,
          "live"
        );
        this.options.metrics?.recordListingNormalization({
          totalProcessed: rawPayload.length,
          failures:
            normalized.rejectionSummary.duplicateListings +
            normalized.rejectionSummary.invalidCoordinates +
            normalized.rejectionSummary.missingAddress +
            normalized.rejectionSummary.missingPrice +
            normalized.rejectionSummary.missingSquareFootage +
            normalized.rejectionSummary.unsupportedPropertyType +
            normalized.rejectionSummary.normalizationFailures
        });

        if (normalized.listings.length > 0) {
          await this.options.cacheRepository.save({
            locationKey: cacheKey,
            locationType: context.location.locationType,
            locationValue: context.location.locationValue,
            radiusMiles: context.radiusMiles,
            provider: this.sourceProvider.name,
            rawPayload: normalized.rawPayload,
            normalizedListings: normalized.listings,
            fetchedAt,
            expiresAt: new Date(Date.now() + this.config.cacheTtlHours * 3_600_000).toISOString(),
            sourceType: "live",
            rejectionSummary: normalized.rejectionSummary
          });
          this.lastSourceUsed = "live";
          this.lastUpdatedAt = fetchedAt;
          this.lastRejectionSummary = normalized.rejectionSummary;
          this.options.metrics?.recordListingResolution({
            source: "live",
            cacheHit: false,
            liveFetch: true,
            fallback: false
          });
          return normalized.listings;
        }
      } catch {
        // Fallback resolution continues below.
      }
    }

    if (
      this.config.mode !== "mock" &&
      cacheEntry &&
      this.options.cacheRepository.isStaleUsable(cacheEntry, this.config.staleTtlHours)
    ) {
      this.lastSourceUsed = "stale_cached_live";
      this.lastUpdatedAt = cacheEntry.fetchedAt;
      this.lastRejectionSummary = cacheEntry.rejectionSummary;
      this.options.metrics?.recordListingResolution({
        source: "stale_cached_live",
        cacheHit: true,
        liveFetch: false,
        fallback: true
      });
      return normalizeListingsForSource(cacheEntry.normalizedListings, "stale_cached_live");
    }

    const mockListings = await this.mockProvider.fetchListings(context);
    if (mockListings.length > 0) {
      this.lastSourceUsed = "mock";
      this.lastUpdatedAt =
        [...mockListings]
          .map((listing) => listing.fetchedAt ?? listing.updatedAt)
          .sort()
          .at(-1) ?? null;
      this.lastRejectionSummary = emptyRejectionSummary();
      this.options.metrics?.recordListingResolution({
        source: "mock",
        cacheHit: false,
        liveFetch: false,
        fallback: true
      });
      return normalizeListingsForSource(mockListings, "mock");
    }

    this.lastSourceUsed = "none";
    this.lastUpdatedAt = null;
    this.lastRejectionSummary = emptyRejectionSummary();
    this.options.metrics?.recordListingResolution({
      source: "none",
      cacheHit: false,
      liveFetch: false,
      fallback: true
    });
    return [];
  }

  async getStatus(): Promise<ProviderStatus> {
    const childStatus = await this.sourceProvider.getStatus();

    return {
      provider: "ListingProvider",
      providerName: "ListingProvider",
      status: listingSourceStatus(this.config.mode, this.lastSourceUsed, [childStatus]),
      lastUpdatedAt: this.lastUpdatedAt,
      dataAgeHours: dataAgeHours(this.lastUpdatedAt),
      latencyMs: childStatus.latencyMs,
      failureCount: childStatus.failureCount,
      mode: this.config.mode === "mock" ? "mock" : "live",
      detail:
        this.config.mode === "mock"
          ? "Listing provider is running in mock mode."
          : "Listing provider resolves fresh cache, live fetch, stale cache, and mock fallback.",
      children: [childStatus],
      lastSourceUsed: this.lastSourceUsed
    };
  }
}

export function createListingProvider(
  cacheRepository: ListingCacheRepository,
  options?: Omit<CompositeListingProviderOptions, "cacheRepository">
): CompositeListingProvider {
  return new CompositeListingProvider({
    cacheRepository,
    ...options
  });
}
