import type { SearchMetrics } from "@nhalo/types";

type NumericSeries = {
  count: number;
  total: number;
  last: number | null;
  min: number | null;
  max: number | null;
};

type ProviderSeries = {
  latency: NumericSeries;
  requests: number;
  failures: number;
};

function createSeries(): NumericSeries {
  return {
    count: 0,
    total: 0,
    last: null,
    min: null,
    max: null
  };
}

function recordSeries(series: NumericSeries, value: number): void {
  series.count += 1;
  series.total += value;
  series.last = value;
  series.min = series.min === null ? value : Math.min(series.min, value);
  series.max = series.max === null ? value : Math.max(series.max, value);
}

function average(series: NumericSeries): number {
  if (series.count === 0) {
    return 0;
  }

  return Number((series.total / series.count).toFixed(2));
}

export class MetricsCollector {
  private readonly searchLatency = createSeries();
  private readonly candidatesScanned = createSeries();
  private readonly matchesReturned = createSeries();
  private readonly scores = createSeries();
  private readonly providers = new Map<string, ProviderSeries>();
  private readonly safetyResolution = {
    cacheHits: 0,
    cacheMisses: 0,
    liveFetches: 0,
    total: 0,
    fallbacks: 0
  };
  private readonly listingResolution = {
    cacheHits: 0,
    cacheMisses: 0,
    liveFetches: 0,
    total: 0,
    fallbacks: 0
  };
  private readonly listingNormalization = {
    failures: 0,
    totalProcessed: 0
  };
  private readonly listingResultsReturned = createSeries();

  recordSearch(payload: {
    durationMs: number;
    candidatesScanned: number;
    matchesReturned: number;
    scores: number[];
  }): void {
    recordSeries(this.searchLatency, payload.durationMs);
    recordSeries(this.candidatesScanned, payload.candidatesScanned);
    recordSeries(this.matchesReturned, payload.matchesReturned);

    for (const score of payload.scores) {
      recordSeries(this.scores, score);
    }
  }

  recordProviderRequest(providerName: string, latencyMs: number, failed: boolean): void {
    const entry = this.providers.get(providerName) ?? {
      latency: createSeries(),
      requests: 0,
      failures: 0
    };

    entry.requests += 1;
    if (failed) {
      entry.failures += 1;
    }
    recordSeries(entry.latency, latencyMs);
    this.providers.set(providerName, entry);
  }

  recordListingResolution(payload: {
    source: "live" | "cached_live" | "stale_cached_live" | "mock" | "none";
    cacheHit: boolean;
    liveFetch: boolean;
    fallback: boolean;
  }): void {
    this.listingResolution.total += 1;
    if (payload.cacheHit) {
      this.listingResolution.cacheHits += 1;
    } else {
      this.listingResolution.cacheMisses += 1;
    }
    if (payload.liveFetch) {
      this.listingResolution.liveFetches += 1;
    }
    if (payload.fallback) {
      this.listingResolution.fallbacks += 1;
    }
  }

  recordListingNormalization(payload: {
    totalProcessed: number;
    failures: number;
  }): void {
    this.listingNormalization.totalProcessed += payload.totalProcessed;
    this.listingNormalization.failures += payload.failures;
  }

  recordListingResultsReturned(count: number): void {
    recordSeries(this.listingResultsReturned, count);
  }

  recordSafetyResolution(payload: {
    source: "live" | "cached_live" | "stale_cached_live" | "mock" | "none";
    cacheHit: boolean;
    liveFetch: boolean;
    fallback: boolean;
  }): void {
    this.safetyResolution.total += 1;
    if (payload.cacheHit) {
      this.safetyResolution.cacheHits += 1;
    } else {
      this.safetyResolution.cacheMisses += 1;
    }
    if (payload.liveFetch) {
      this.safetyResolution.liveFetches += 1;
    }
    if (payload.fallback) {
      this.safetyResolution.fallbacks += 1;
    }
  }

  private providerRate(providerName: string) {
    const entry = this.providers.get(providerName);

    if (!entry) {
      return {
        requests: 0,
        failures: 0,
        rate: 0
      };
    }

    return {
      requests: entry.requests,
      failures: entry.failures,
      rate: entry.requests === 0 ? 0 : Number((entry.failures / entry.requests).toFixed(4))
    };
  }

  private providerLatency(providerName: string) {
    const entry = this.providers.get(providerName);

    return {
      count: entry?.latency.count ?? 0,
      average: entry ? average(entry.latency) : 0,
      last: entry?.latency.last ?? null
    };
  }

  snapshot(): SearchMetrics {
    const providerLatencyMs = Object.fromEntries(
      [...this.providers.entries()].map(([providerName, entry]) => [
        providerName,
        {
          count: entry.latency.count,
          average: average(entry.latency),
          last: entry.latency.last
        }
      ])
    );

    const providerFailureRate = Object.fromEntries(
      [...this.providers.entries()].map(([providerName, entry]) => [
        providerName,
        {
          requests: entry.requests,
          failures: entry.failures,
          rate: entry.requests === 0 ? 0 : Number((entry.failures / entry.requests).toFixed(4))
        }
      ])
    );

    return {
      searchLatencyMs: {
        count: this.searchLatency.count,
        average: average(this.searchLatency),
        last: this.searchLatency.last
      },
      candidatesScanned: {
        total: this.candidatesScanned.total,
        average: average(this.candidatesScanned),
        last: this.candidatesScanned.last
      },
      matchesReturned: {
        total: this.matchesReturned.total,
        average: average(this.matchesReturned),
        last: this.matchesReturned.last
      },
      providerLatencyMs,
      providerFailureRate,
      crimeProviderLatencyMs: this.providerLatency("CrimeSignalProvider"),
      schoolProviderLatencyMs: this.providerLatency("SchoolSignalProvider"),
      crimeProviderFailureRate: this.providerRate("CrimeSignalProvider"),
      schoolProviderFailureRate: this.providerRate("SchoolSignalProvider"),
      safetyCacheHitRate: {
        hits: this.safetyResolution.cacheHits,
        misses: this.safetyResolution.cacheMisses,
        rate:
          this.safetyResolution.cacheHits + this.safetyResolution.cacheMisses === 0
            ? 0
            : Number(
                (
                  this.safetyResolution.cacheHits /
                  (this.safetyResolution.cacheHits + this.safetyResolution.cacheMisses)
                ).toFixed(4)
              )
      },
      safetyLiveFetchRate: {
        liveFetches: this.safetyResolution.liveFetches,
        totalResolutions: this.safetyResolution.total,
        rate:
          this.safetyResolution.total === 0
            ? 0
            : Number((this.safetyResolution.liveFetches / this.safetyResolution.total).toFixed(4))
      },
      safetyFallbackRate: {
        fallbacks: this.safetyResolution.fallbacks,
        totalResolutions: this.safetyResolution.total,
        rate:
          this.safetyResolution.total === 0
            ? 0
            : Number((this.safetyResolution.fallbacks / this.safetyResolution.total).toFixed(4))
      },
      listingProviderLatencyMs: this.providerLatency("ListingSourceProvider"),
      listingProviderFailureRate: this.providerRate("ListingSourceProvider"),
      listingCacheHitRate: {
        hits: this.listingResolution.cacheHits,
        misses: this.listingResolution.cacheMisses,
        rate:
          this.listingResolution.cacheHits + this.listingResolution.cacheMisses === 0
            ? 0
            : Number(
                (
                  this.listingResolution.cacheHits /
                  (this.listingResolution.cacheHits + this.listingResolution.cacheMisses)
                ).toFixed(4)
              )
      },
      listingLiveFetchRate: {
        liveFetches: this.listingResolution.liveFetches,
        totalResolutions: this.listingResolution.total,
        rate:
          this.listingResolution.total === 0
            ? 0
            : Number((this.listingResolution.liveFetches / this.listingResolution.total).toFixed(4))
      },
      listingFallbackRate: {
        fallbacks: this.listingResolution.fallbacks,
        totalResolutions: this.listingResolution.total,
        rate:
          this.listingResolution.total === 0
            ? 0
            : Number((this.listingResolution.fallbacks / this.listingResolution.total).toFixed(4))
      },
      listingNormalizationFailureRate: {
        failures: this.listingNormalization.failures,
        totalProcessed: this.listingNormalization.totalProcessed,
        rate:
          this.listingNormalization.totalProcessed === 0
            ? 0
            : Number(
                (this.listingNormalization.failures / this.listingNormalization.totalProcessed).toFixed(4)
              )
      },
      listingResultsReturnedCount: {
        total: this.listingResultsReturned.total,
        average: average(this.listingResultsReturned),
        last: this.listingResultsReturned.last
      },
      scoreDistribution: {
        count: this.scores.count,
        average: average(this.scores),
        min: this.scores.min,
        max: this.scores.max
      }
    };
  }
}
