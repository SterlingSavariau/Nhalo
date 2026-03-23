import { PROVIDER_TIMEOUT_MS } from "@nhalo/config";
import type {
  GeocoderProvider,
  ListingProvider,
  ListingRecord,
  ListingSearchContext,
  ProviderHealthStatus,
  ProviderStatus,
  ResolvedLocation,
  SafetyProvider,
  SafetyRecord
} from "@nhalo/types";
import { MetricsCollector } from "./metrics";

type ProviderBundle = {
  geocoder: GeocoderProvider;
  listings: ListingProvider;
  safety: SafetyProvider;
};

type ProviderState = {
  lastUpdatedAt: string | null;
  latencyMs: number | null;
  failureCount: number;
  lastError: string | null;
  mode: "mock" | "live";
  detail: string;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs = PROVIDER_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Provider timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function dataAgeHours(lastUpdatedAt: string | null): number | null {
  if (!lastUpdatedAt) {
    return null;
  }

  const ageHours = (Date.now() - new Date(lastUpdatedAt).getTime()) / 3_600_000;

  return Number(ageHours.toFixed(2));
}

function providerStatusFromState(state: ProviderState): ProviderHealthStatus {
  if (state.failureCount === 0) {
    return "healthy";
  }

  if (state.lastUpdatedAt) {
    return "degraded";
  }

  return "failing";
}

abstract class MonitoredProvider {
  protected readonly state: ProviderState = {
    lastUpdatedAt: null,
    latencyMs: null,
    failureCount: 0,
    lastError: null,
    mode: "mock",
    detail: ""
  };

  constructor(
    protected readonly provider: { name: string; getStatus(): Promise<ProviderStatus> },
    protected readonly metrics: MetricsCollector,
    private readonly providerLabel: string
  ) {}

  protected async refreshStaticStatus(): Promise<void> {
    try {
      const status = await this.provider.getStatus();
      this.state.mode = status.mode;
      this.state.detail = status.detail;
    } catch {
      this.state.detail = this.state.lastError ?? "Provider status unavailable";
    }
  }

  protected completeRequest(latencyMs: number, failed: boolean, updatedAt: string | null, error?: unknown): void {
    this.state.latencyMs = latencyMs;
    if (updatedAt) {
      this.state.lastUpdatedAt = updatedAt;
    }
    if (failed) {
      this.state.failureCount += 1;
      this.state.lastError = error instanceof Error ? error.message : "Unknown provider error";
    } else {
      this.state.lastError = null;
    }
    this.metrics.recordProviderRequest(this.provider.name, latencyMs, failed);
  }

  async getStatus(): Promise<ProviderStatus> {
    await this.refreshStaticStatus();

    return {
      provider: this.providerLabel,
      providerName: this.providerLabel,
      status: providerStatusFromState(this.state),
      lastUpdatedAt: this.state.lastUpdatedAt,
      dataAgeHours: dataAgeHours(this.state.lastUpdatedAt),
      latencyMs: this.state.latencyMs,
      failureCount: this.state.failureCount,
      mode: this.state.mode,
      detail: this.state.lastError
        ? `${this.state.detail}. Last error: ${this.state.lastError}`
        : this.state.detail
    };
  }
}

class MonitoredGeocoderProvider extends MonitoredProvider implements GeocoderProvider {
  readonly name: string;
  private readonly cache = new Map<string, ResolvedLocation>();

  constructor(provider: GeocoderProvider, metrics: MetricsCollector) {
    super(provider, metrics, "GeocoderProvider");
    this.name = provider.name;
  }

  async geocode(locationType: "city" | "zip", locationValue: string): Promise<ResolvedLocation | null> {
    const cacheKey = `${locationType}:${locationValue.trim().toLowerCase()}`;
    const startedAt = Date.now();

    try {
      const resolvedLocation = await withTimeout(
        (this.provider as GeocoderProvider).geocode(locationType, locationValue)
      );

      if (resolvedLocation) {
        this.cache.set(cacheKey, resolvedLocation);
      }

      this.completeRequest(Date.now() - startedAt, false, new Date().toISOString());

      return resolvedLocation;
    } catch (error) {
      this.completeRequest(Date.now() - startedAt, true, this.cache.get(cacheKey) ? new Date().toISOString() : null, error);

      return this.cache.get(cacheKey) ?? null;
    }
  }
}

class MonitoredListingProvider extends MonitoredProvider implements ListingProvider {
  readonly name: string;
  private readonly cache = new Map<string, ListingRecord[]>();

  constructor(provider: ListingProvider, metrics: MetricsCollector) {
    super(provider, metrics, "ListingProvider");
    this.name = provider.name;
  }

  async fetchListings(context: ListingSearchContext): Promise<ListingRecord[]> {
    const cacheKey = `${context.location.locationType}:${context.location.locationValue}:${context.radiusMiles}:${(
      context.propertyTypes ?? []
    )
      .slice()
      .sort()
      .join(",")}`;
    const startedAt = Date.now();

    try {
      const listings = await withTimeout((this.provider as ListingProvider).fetchListings(context));
      const updatedAt =
        listings
          .map((listing) => listing.updatedAt)
          .sort()
          .at(-1) ?? new Date().toISOString();

      this.cache.set(cacheKey, listings);
      this.completeRequest(Date.now() - startedAt, false, updatedAt);

      return listings;
    } catch (error) {
      const cached = this.cache.get(cacheKey) ?? [];
      const fallbackUpdatedAt =
        cached
          .map((listing) => listing.updatedAt)
          .sort()
          .at(-1) ?? null;

      this.completeRequest(Date.now() - startedAt, true, fallbackUpdatedAt, error);

      return cached;
    }
  }
}

class MonitoredSafetyProvider extends MonitoredProvider implements SafetyProvider {
  readonly name: string;
  private readonly cache = new Map<string, SafetyRecord>();

  constructor(provider: SafetyProvider, metrics: MetricsCollector) {
    super(provider, metrics, "SafetyProvider");
    this.name = provider.name;
  }

  async fetchSafetyData(listings: ListingRecord[]): Promise<Map<string, SafetyRecord>> {
    const startedAt = Date.now();

    try {
      const safetyData = await withTimeout((this.provider as SafetyProvider).fetchSafetyData(listings));
      const updatedAt =
        [...safetyData.values()]
          .map((entry) => entry.updatedAt)
          .sort()
          .at(-1) ?? null;

      for (const [propertyId, record] of safetyData.entries()) {
        this.cache.set(propertyId, record);
      }

      this.completeRequest(Date.now() - startedAt, false, updatedAt);

      return safetyData;
    } catch (error) {
      const fallback = new Map<string, SafetyRecord>();

      for (const listing of listings) {
        const cachedRecord = this.cache.get(listing.id);
        if (cachedRecord) {
          fallback.set(listing.id, cachedRecord);
        }
      }

      const fallbackUpdatedAt =
        [...fallback.values()]
          .map((entry) => entry.updatedAt)
          .sort()
          .at(-1) ?? null;

      this.completeRequest(Date.now() - startedAt, true, fallbackUpdatedAt, error);

      return fallback;
    }
  }
}

export interface RuntimeProviders extends ProviderBundle {
  getStatuses(): Promise<ProviderStatus[]>;
  getFreshnessHours(): Promise<{
    listings: number | null;
    safety: number | null;
  }>;
}

export function instrumentProviders(
  providers: ProviderBundle,
  metrics: MetricsCollector
): RuntimeProviders {
  const runtimeProviders = {
    geocoder: new MonitoredGeocoderProvider(providers.geocoder, metrics),
    listings: new MonitoredListingProvider(providers.listings, metrics),
    safety: new MonitoredSafetyProvider(providers.safety, metrics)
  };

  return {
    ...runtimeProviders,
    async getStatuses(): Promise<ProviderStatus[]> {
      return Promise.all([
        runtimeProviders.geocoder.getStatus(),
        runtimeProviders.listings.getStatus(),
        runtimeProviders.safety.getStatus()
      ]);
    },
    async getFreshnessHours() {
      const [listingStatus, safetyStatus] = await Promise.all([
        runtimeProviders.listings.getStatus(),
        runtimeProviders.safety.getStatus()
      ]);

      return {
        listings: listingStatus.dataAgeHours,
        safety: safetyStatus.dataAgeHours
      };
    }
  };
}
