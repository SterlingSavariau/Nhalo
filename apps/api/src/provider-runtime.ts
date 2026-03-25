import { getConfig } from "@nhalo/config";
import type {
  GeocoderProvider,
  ListingProvider,
  ListingRecord,
  ListingSearchContext,
  ProviderHealthStatus,
  ProviderStatus,
  ResolvedLocation,
  SafetyProvider,
  SafetyRecord,
  SearchProviderUsage
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

type TimedResult<T> = {
  value: T;
  retriesUsed: number;
};

type InvocationStats = {
  callCount: number;
  cacheHit: boolean;
  liveFetch: boolean;
  retriesUsed: number;
  staleFallbackUsed: boolean;
  budgetExceeded: boolean;
};

type ProviderKind = "geocoder" | "listing" | "safety";

const EMPTY_PROVIDER_USAGE: SearchProviderUsage = {
  geocoderCalls: 0,
  listingProviderCalls: 0,
  safetyProviderCalls: 0,
  geocoderCacheHits: 0,
  listingCacheHits: 0,
  safetyCacheHits: 0,
  geocoderLiveFetches: 0,
  listingLiveFetches: 0,
  safetyLiveFetches: 0,
  geocoderRetriesUsed: 0,
  listingRetriesUsed: 0,
  safetyRetriesUsed: 0,
  geocoderStaleFallbacks: 0,
  listingStaleFallbacks: 0,
  safetyStaleFallbacks: 0,
  geocoderBudgetExceeded: false,
  listingBudgetExceeded: false,
  safetyBudgetExceeded: false
};

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("timed out");
}

async function withTimeout<T>(operation: () => Promise<T>): Promise<TimedResult<T>> {
  const config = getConfig();
  let attempts = 0;
  let retriesUsed = 0;
  let lastError: unknown;

  while (attempts <= config.providerRetryCount) {
    attempts += 1;

    try {
      const value = await new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Provider timed out after ${config.providerTimeoutMs}ms`));
        }, config.providerTimeoutMs);

        operation()
          .then((result) => {
            clearTimeout(timer);
            resolve(result);
          })
          .catch((error) => {
            clearTimeout(timer);
            reject(error);
          });
      });

      return {
        value,
        retriesUsed
      };
    } catch (error) {
      lastError = error;
      if (attempts > config.providerRetryCount) {
        break;
      }
      retriesUsed += 1;
      await new Promise((resolve) =>
        setTimeout(resolve, config.providerRetryBackoffMs * attempts)
      );
    }
  }

  throw lastError;
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

function statusRank(status: ProviderHealthStatus): number {
  switch (status) {
    case "healthy":
      return 0;
    case "degraded":
      return 1;
    case "unavailable":
      return 2;
    case "failing":
      return 3;
  }
}

function combineStatuses(left: ProviderHealthStatus, right: ProviderHealthStatus): ProviderHealthStatus {
  return statusRank(left) >= statusRank(right) ? left : right;
}

function getBudgetLimit(kind: ProviderKind): number {
  const performance = getConfig().performance;
  switch (kind) {
    case "geocoder":
      return performance.geocoderProviderMaxCallsPerMinute;
    case "listing":
      return performance.listingProviderMaxCallsPerMinute;
    case "safety":
      return performance.safetyProviderMaxCallsPerMinute;
  }
}

function emptyInvocationStats(): InvocationStats {
  return {
    callCount: 0,
    cacheHit: false,
    liveFetch: false,
    retriesUsed: 0,
    staleFallbackUsed: false,
    budgetExceeded: false
  };
}

class ProviderBudgetWindow {
  private readonly callTimestamps: number[] = [];

  constructor(private readonly limit: number) {}

  private prune(now: number): void {
    while (this.callTimestamps.length > 0 && now - (this.callTimestamps[0] ?? 0) >= 60_000) {
      this.callTimestamps.shift();
    }
  }

  canSpend(): boolean {
    const now = Date.now();
    this.prune(now);
    return this.callTimestamps.length < this.limit;
  }

  recordSpend(): void {
    const now = Date.now();
    this.prune(now);
    this.callTimestamps.push(now);
  }
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

  protected lastInvocation: InvocationStats = emptyInvocationStats();
  private readonly budgetWindow: ProviderBudgetWindow;

  constructor(
    protected readonly provider: { name: string; getStatus(): Promise<ProviderStatus> },
    protected readonly metrics: MetricsCollector,
    private readonly providerLabel: string,
    private readonly providerKind: ProviderKind
  ) {
    this.budgetWindow = new ProviderBudgetWindow(getBudgetLimit(providerKind));
  }

  protected resetInvocation(): InvocationStats {
    this.lastInvocation = emptyInvocationStats();
    this.lastInvocation.callCount = 1;
    return this.lastInvocation;
  }

  protected shouldEnforceBudget(): boolean {
    const config = getConfig();
    if (!config.performance.providerBudgetsEnabled) {
      return false;
    }

    switch (this.providerKind) {
      case "geocoder":
        return config.geocoder.mode !== "mock";
      case "listing":
        return config.listings.mode !== "mock";
      case "safety":
        return config.safety.mode !== "mock";
    }
  }

  protected canSpendBudget(): boolean {
    if (!this.shouldEnforceBudget()) {
      return true;
    }

    return this.budgetWindow.canSpend();
  }

  protected recordBudgetSpend(): void {
    if (this.shouldEnforceBudget()) {
      this.budgetWindow.recordSpend();
    }
  }

  protected markBudgetExceeded(invocation: InvocationStats): void {
    invocation.budgetExceeded = true;
  }

  protected async refreshStaticStatus(): Promise<void> {
    try {
      const status = await this.provider.getStatus();
      this.state.mode = status.mode;
      this.state.detail = status.detail;
    } catch {
      this.state.detail = this.state.lastError ?? "Provider status unavailable";
    }
  }

  protected completeRequest(
    latencyMs: number,
    failed: boolean,
    updatedAt: string | null,
    error?: unknown
  ): void {
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
    this.metrics.recordProviderRequest(this.provider.name, latencyMs, failed, isTimeoutError(error));
  }

  getLastInvocation(): InvocationStats {
    return { ...this.lastInvocation };
  }

  async getStatus(): Promise<ProviderStatus> {
    let providerStatus: ProviderStatus | null = null;

    try {
      providerStatus = await this.provider.getStatus();
      this.state.mode = providerStatus.mode;
      this.state.detail = providerStatus.detail;
    } catch {
      await this.refreshStaticStatus();
    }

    const runtimeStatus = providerStatusFromState(this.state);
    return {
      provider: this.providerLabel,
      providerName: this.providerLabel,
      status: providerStatus
        ? combineStatuses(providerStatus.status, runtimeStatus)
        : runtimeStatus,
      lastUpdatedAt: this.state.lastUpdatedAt ?? providerStatus?.lastUpdatedAt ?? null,
      dataAgeHours: dataAgeHours(this.state.lastUpdatedAt ?? providerStatus?.lastUpdatedAt ?? null),
      latencyMs: this.state.latencyMs,
      failureCount: Math.max(this.state.failureCount, providerStatus?.failureCount ?? 0),
      mode: this.state.mode,
      detail: this.state.lastError
        ? `${this.state.detail}. Last error: ${this.state.lastError}`
        : this.state.detail,
      children: providerStatus?.children,
      lastSourceUsed: providerStatus?.lastSourceUsed ?? null
    };
  }
}

class MonitoredGeocoderProvider extends MonitoredProvider implements GeocoderProvider {
  readonly name: string;
  private readonly cache = new Map<string, ResolvedLocation>();

  constructor(provider: GeocoderProvider, metrics: MetricsCollector) {
    super(provider, metrics, "GeocoderProvider", "geocoder");
    this.name = provider.name;
  }

  async geocode(locationType: "city" | "zip" | "address", locationValue: string): Promise<ResolvedLocation | null> {
    const cacheKey = `${locationType}:${locationValue.trim().toLowerCase()}`;
    const startedAt = Date.now();
    const invocation = this.resetInvocation();

    if (!this.canSpendBudget()) {
      this.markBudgetExceeded(invocation);
      const cached = this.cache.get(cacheKey) ?? null;
      invocation.cacheHit = cached !== null;
      invocation.staleFallbackUsed = cached !== null;
      this.completeRequest(Date.now() - startedAt, false, cached?.fetchedAt ?? null);
      return cached;
    }

    try {
      this.recordBudgetSpend();
      const { value: resolvedLocation, retriesUsed } = await withTimeout(
        () => (this.provider as GeocoderProvider).geocode(locationType, locationValue)
      );
      invocation.retriesUsed = retriesUsed;
      invocation.cacheHit =
        resolvedLocation?.geocodeDataSource === "cached_live" ||
        resolvedLocation?.geocodeDataSource === "stale_cached_live";
      invocation.staleFallbackUsed = resolvedLocation?.geocodeDataSource === "stale_cached_live";
      invocation.liveFetch = resolvedLocation?.geocodeDataSource === "live";

      if (resolvedLocation) {
        this.cache.set(cacheKey, resolvedLocation);
      }

      this.completeRequest(
        Date.now() - startedAt,
        false,
        resolvedLocation?.fetchedAt ?? new Date().toISOString()
      );

      return resolvedLocation;
    } catch (error) {
      const cached = this.cache.get(cacheKey) ?? null;
      invocation.cacheHit = cached !== null;
      invocation.staleFallbackUsed = cached !== null;
      this.completeRequest(Date.now() - startedAt, true, cached?.fetchedAt ?? null, error);
      return cached;
    }
  }

  getLastResolutionIssue() {
    return (this.provider as GeocoderProvider).getLastResolutionIssue?.() ?? null;
  }
}

class MonitoredListingProvider extends MonitoredProvider implements ListingProvider {
  readonly name: string;
  private readonly cache = new Map<string, ListingRecord[]>();

  constructor(provider: ListingProvider, metrics: MetricsCollector) {
    super(provider, metrics, "ListingProvider", "listing");
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
    const invocation = this.resetInvocation();

    if (!this.canSpendBudget()) {
      this.markBudgetExceeded(invocation);
      const cached = this.cache.get(cacheKey) ?? [];
      invocation.cacheHit = cached.length > 0;
      invocation.staleFallbackUsed = cached.length > 0;
      this.completeRequest(
        Date.now() - startedAt,
        false,
        cached.map((listing) => listing.updatedAt).sort().at(-1) ?? null
      );
      return cached;
    }

    try {
      this.recordBudgetSpend();
      const { value: listings, retriesUsed } = await withTimeout(() =>
        (this.provider as ListingProvider).fetchListings(context)
      );
      invocation.retriesUsed = retriesUsed;
      const sources = new Set(listings.map((listing) => listing.listingDataSource ?? "none"));
      invocation.cacheHit = sources.has("cached_live") || sources.has("stale_cached_live");
      invocation.staleFallbackUsed = sources.has("stale_cached_live");
      invocation.liveFetch = sources.has("live");
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
      invocation.cacheHit = cached.length > 0;
      invocation.staleFallbackUsed = cached.length > 0;
      const fallbackUpdatedAt =
        cached
          .map((listing) => listing.updatedAt)
          .sort()
          .at(-1) ?? null;

      this.completeRequest(Date.now() - startedAt, true, fallbackUpdatedAt, error);

      return cached;
    }
  }

  getLastRejectionSummary() {
    return (this.provider as ListingProvider).getLastRejectionSummary?.() ?? null;
  }
}

class MonitoredSafetyProvider extends MonitoredProvider implements SafetyProvider {
  readonly name: string;
  private readonly cache = new Map<string, SafetyRecord>();

  constructor(provider: SafetyProvider, metrics: MetricsCollector) {
    super(provider, metrics, "SafetyProvider", "safety");
    this.name = provider.name;
  }

  async fetchSafetyData(listings: ListingRecord[]): Promise<Map<string, SafetyRecord>> {
    const startedAt = Date.now();
    const invocation = this.resetInvocation();

    if (!this.canSpendBudget()) {
      this.markBudgetExceeded(invocation);
      const fallback = new Map<string, SafetyRecord>();
      for (const listing of listings) {
        const cachedRecord = this.cache.get(listing.id);
        if (cachedRecord) {
          fallback.set(listing.id, cachedRecord);
        }
      }
      invocation.cacheHit = fallback.size > 0;
      invocation.staleFallbackUsed = fallback.size > 0;
      this.completeRequest(
        Date.now() - startedAt,
        false,
        [...fallback.values()].map((entry) => entry.updatedAt).sort().at(-1) ?? null
      );
      return fallback;
    }

    try {
      this.recordBudgetSpend();
      const { value: safetyData, retriesUsed } = await withTimeout(() =>
        (this.provider as SafetyProvider).fetchSafetyData(listings)
      );
      invocation.retriesUsed = retriesUsed;
      const sources = new Set(
        [...safetyData.values()].map((entry) => entry.safetyDataSource ?? "none")
      );
      invocation.cacheHit = sources.has("cached_live") || sources.has("stale_cached_live");
      invocation.staleFallbackUsed = sources.has("stale_cached_live");
      invocation.liveFetch = sources.has("live");
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

      invocation.cacheHit = fallback.size > 0;
      invocation.staleFallbackUsed = fallback.size > 0;
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
    geocoder: number | null;
    listings: number | null;
    safety: number | null;
  }>;
  getLastProviderUsage(): SearchProviderUsage;
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
      const [geocoderStatus, listingStatus, safetyStatus] = await Promise.all([
        runtimeProviders.geocoder.getStatus(),
        runtimeProviders.listings.getStatus(),
        runtimeProviders.safety.getStatus()
      ]);

      return {
        geocoder: geocoderStatus.dataAgeHours,
        listings: listingStatus.dataAgeHours,
        safety: safetyStatus.dataAgeHours
      };
    },
    getLastProviderUsage(): SearchProviderUsage {
      const geocoder = runtimeProviders.geocoder.getLastInvocation();
      const listing = runtimeProviders.listings.getLastInvocation();
      const safety = runtimeProviders.safety.getLastInvocation();

      return {
        geocoderCalls: geocoder.callCount,
        listingProviderCalls: listing.callCount,
        safetyProviderCalls: safety.callCount,
        geocoderCacheHits: geocoder.cacheHit ? 1 : 0,
        listingCacheHits: listing.cacheHit ? 1 : 0,
        safetyCacheHits: safety.cacheHit ? 1 : 0,
        geocoderLiveFetches: geocoder.liveFetch ? 1 : 0,
        listingLiveFetches: listing.liveFetch ? 1 : 0,
        safetyLiveFetches: safety.liveFetch ? 1 : 0,
        geocoderRetriesUsed: geocoder.retriesUsed,
        listingRetriesUsed: listing.retriesUsed,
        safetyRetriesUsed: safety.retriesUsed,
        geocoderStaleFallbacks: geocoder.staleFallbackUsed ? 1 : 0,
        listingStaleFallbacks: listing.staleFallbackUsed ? 1 : 0,
        safetyStaleFallbacks: safety.staleFallbackUsed ? 1 : 0,
        geocoderBudgetExceeded: geocoder.budgetExceeded,
        listingBudgetExceeded: listing.budgetExceeded,
        safetyBudgetExceeded: safety.budgetExceeded
      };
    }
  };
}
