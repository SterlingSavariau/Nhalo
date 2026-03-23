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
      scoreDistribution: {
        count: this.scores.count,
        average: average(this.scores),
        min: this.scores.min,
        max: this.scores.max
      }
    };
  }
}
