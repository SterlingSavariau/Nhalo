import {
  InMemoryGeocodeCacheRepository,
  InMemoryListingCacheRepository,
  InMemoryMarketSnapshotRepository,
  InMemorySafetySignalCacheRepository,
  InMemorySearchRepository
} from "@nhalo/db";
import { createMockProviders } from "@nhalo/providers";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import type { AppLogger } from "../src/logger";
import { MetricsCollector } from "../src/metrics";
import { resetConfigCache } from "@nhalo/config";

const ORIGINAL_ENV = { ...process.env };

function createMemoryLogger(entries: Array<Record<string, unknown>>): AppLogger {
  return {
    debug(entry) {
      entries.push({ level: "debug", ...entry });
    },
    info(entry) {
      entries.push({ level: "info", ...entry });
    },
    warn(entry) {
      entries.push({ level: "warn", ...entry });
    },
    error(entry) {
      entries.push({ level: "error", ...entry });
    },
    async flush() {}
  };
}

async function createTestApp(logger?: AppLogger) {
  return buildApp({
    repository: new InMemorySearchRepository(),
    marketSnapshotRepository: new InMemoryMarketSnapshotRepository(),
    safetySignalCacheRepository: new InMemorySafetySignalCacheRepository(),
    listingCacheRepository: new InMemoryListingCacheRepository(),
    geocodeCacheRepository: new InMemoryGeocodeCacheRepository(),
    providers: createMockProviders(),
    metrics: new MetricsCollector(),
    logger
  });
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  resetConfigCache();
});

describe("platform readiness and operational guards", () => {
  it("reports health without external dependency checks", async () => {
    const app = await createTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().uptimeSeconds).toBeTypeOf("number");
    expect(response.json().memoryUsage.rss).toBeTypeOf("number");
    await app.close();
  });

  it("reports readiness and structured request logging", async () => {
    const entries: Array<Record<string, unknown>> = [];
    const app = await createTestApp(createMemoryLogger(entries));

    const response = await app.inject({
      method: "GET",
      url: "/ready"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().checks.database).toBe(true);
    expect(entries.some((entry) => entry.message === "Request completed")).toBe(true);
    const completed = entries.find((entry) => entry.message === "Request completed");
    expect(completed?.requestId).toBeTruthy();
    expect(completed?.endpoint).toBe("/ready");
    expect(typeof completed?.durationMs).toBe("number");
    expect(completed?.statusCode).toBe(200);

    await app.close();
  });

  it("fails readiness when a critical provider is unavailable", async () => {
    const providers = createMockProviders();
    providers.geocoder.getStatus = async () => ({
      provider: "GeocoderProvider",
      providerName: "GeocoderProvider",
      status: "failing",
      lastUpdatedAt: null,
      dataAgeHours: null,
      latencyMs: null,
      failureCount: 1,
      mode: "mock",
      detail: "not available"
    });
    const app = await buildApp({
      repository: new InMemorySearchRepository(),
      marketSnapshotRepository: new InMemoryMarketSnapshotRepository(),
      safetySignalCacheRepository: new InMemorySafetySignalCacheRepository(),
      listingCacheRepository: new InMemoryListingCacheRepository(),
      geocodeCacheRepository: new InMemoryGeocodeCacheRepository(),
      providers,
      metrics: new MetricsCollector()
    });

    const response = await app.inject({
      method: "GET",
      url: "/ready"
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().checks.providers).toBe(false);

    await app.close();
  });

  it("enforces configurable search rate limiting and tracks validation failures", async () => {
    process.env.NODE_ENV = "test";
    process.env.RATE_LIMIT_SEARCH_MAX = "1";
    process.env.RATE_LIMIT_SEARCH_WINDOW_MS = "60000";
    resetConfigCache();

    const app = await createTestApp();
    const payload = {
      locationType: "city",
      locationValue: "Southfield, MI",
      radiusMiles: 5,
      budget: { max: 425000 },
      minSqft: 1800,
      minBedrooms: 3
    };

    const first = await app.inject({
      method: "POST",
      url: "/search",
      payload
    });
    const second = await app.inject({
      method: "POST",
      url: "/search",
      payload
    });
    const metrics = await app.inject({
      method: "GET",
      url: "/metrics"
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(429);
    expect(second.json().error.code).toBe("RATE_LIMITED");
    expect(metrics.json().searchSuccessRate.successes).toBeGreaterThanOrEqual(1);

    await app.close();
  });

  it("tracks validation errors in metrics with standardized error responses", async () => {
    const app = await createTestApp();

    const invalid = await app.inject({
      method: "POST",
      url: "/search",
      payload: {
        locationType: "city"
      }
    });
    const metrics = await app.inject({
      method: "GET",
      url: "/metrics"
    });

    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error.code).toBe("VALIDATION_ERROR");
    expect(metrics.json().errorRateByCategory.VALIDATION_ERROR.count).toBeGreaterThanOrEqual(1);

    await app.close();
  });

  it("flushes the logger during graceful shutdown", async () => {
    let flushed = 0;
    const logger: AppLogger = {
      debug() {},
      info() {},
      warn() {},
      error() {},
      async flush() {
        flushed += 1;
      }
    };
    const app = await createTestApp(logger);

    await app.close();

    expect(flushed).toBeGreaterThanOrEqual(1);
  });
});
