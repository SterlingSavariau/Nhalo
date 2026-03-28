import {
  InMemoryGeocodeCacheRepository,
  InMemoryListingCacheRepository,
  InMemoryMarketSnapshotRepository,
  type PersistenceLayer,
  InMemorySafetySignalCacheRepository,
  InMemorySearchRepository
} from "@nhalo/db";
import { createMockProviders } from "@nhalo/providers";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { createLogger, type AppLogger } from "../src/logger";
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

function createDegradedPersistence(options?: {
  database?: boolean;
  cache?: boolean;
  cleanupFails?: boolean;
}): PersistenceLayer {
  const searchRepository = new InMemorySearchRepository();
  const marketSnapshotRepository = new InMemoryMarketSnapshotRepository();
  const safetySignalCacheRepository = new InMemorySafetySignalCacheRepository();
  const listingCacheRepository = new InMemoryListingCacheRepository();
  const geocodeCacheRepository = new InMemoryGeocodeCacheRepository();

  return {
    mode: "database",
    searchRepository,
    marketSnapshotRepository,
    safetySignalCacheRepository,
    listingCacheRepository,
    geocodeCacheRepository,
    async checkReadiness() {
      return {
        database: options?.database ?? false,
        cache: options?.cache ?? true
      };
    },
    async cleanupExpiredData() {
      if (options?.cleanupFails) {
        throw new Error("cleanup failed");
      }
      return {
        snapshotsRemoved: 0,
        historyRemoved: 0,
        cachesRemoved: 0
      };
    },
    async close() {}
  };
}

async function createTestApp(logger?: AppLogger, persistence?: PersistenceLayer) {
  return buildApp(
    persistence
      ? {
          persistence,
          providers: createMockProviders(),
          metrics: new MetricsCollector(),
          logger
        }
      : {
          repository: new InMemorySearchRepository(),
          marketSnapshotRepository: new InMemoryMarketSnapshotRepository(),
          safetySignalCacheRepository: new InMemorySafetySignalCacheRepository(),
          listingCacheRepository: new InMemoryListingCacheRepository(),
          geocodeCacheRepository: new InMemoryGeocodeCacheRepository(),
          providers: createMockProviders(),
          metrics: new MetricsCollector(),
          logger
        }
  );
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
    expect(response.json().reliability.state).toBe("healthy");
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

  it("exposes runtime build metadata from /version", async () => {
    process.env.NODE_ENV = "test";
    process.env.RUNTIME_ENVIRONMENT = "staging";
    process.env.ENABLE_INTERNAL_ROUTE_GUARDS = "true";
    process.env.INTERNAL_ROUTE_ACCESS_TOKEN = "internal-secret";
    process.env.APP_VERSION = "1.2.3";
    process.env.BUILD_ID = "build-123";
    process.env.BUILD_SHA = "abc1234";
    process.env.BUILD_TIMESTAMP = "2026-03-28T12:00:00.000Z";
    resetConfigCache();

    const app = await createTestApp();
    const response = await app.inject({
      method: "GET",
      url: "/version"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      appVersion: "1.2.3",
      buildId: "build-123",
      gitSha: "abc1234",
      buildTimestamp: "2026-03-28T12:00:00.000Z",
      environment: "staging"
    });

    await app.close();
  });

  it("enters read-only degraded mode when persistence is unavailable and blocks mutable routes", async () => {
    process.env.NODE_ENV = "test";
    process.env.ENABLE_RESULT_NOTES = "true";
    resetConfigCache();

    const app = await createTestApp(undefined, createDegradedPersistence({ database: false }));
    const ready = await app.inject({
      method: "GET",
      url: "/ready"
    });
    const createDefinition = await app.inject({
      method: "POST",
      url: "/search/definitions",
      payload: {
        label: "Southfield defaults",
        request: {
          locationType: "city",
          locationValue: "Southfield, MI",
          radiusMiles: 5,
          budget: { max: 425000 },
          minSqft: 1800,
          minBedrooms: 3
        }
      }
    });

    expect(ready.statusCode).toBe(503);
    expect(ready.json().reliability.state).toBe("read_only_degraded");
    expect(createDefinition.statusCode).toBe(503);
    expect(createDefinition.json().error.code).toBe("READ_ONLY_DEGRADED");

    await app.close();
  });

  it("records background job failures without crashing the app", async () => {
    process.env.NODE_ENV = "test";
    process.env.ENABLE_PILOT_OPS = "true";
    process.env.ENABLE_RELIABILITY_SUMMARY = "true";
    process.env.BACKGROUND_JOBS_ENABLED = "true";
    process.env.CLEANUP_INTERVAL_MS = "5";
    resetConfigCache();

    const app = await createTestApp(undefined, createDegradedPersistence({ database: true, cleanupFails: true }));

    await new Promise((resolve) => setTimeout(resolve, 25));

    const summary = await app.inject({
      method: "GET",
      url: "/ops/summary"
    });
    const metrics = await app.inject({
      method: "GET",
      url: "/metrics",
      headers: {
        "x-nhalo-internal-token": "internal-token"
      }
    });

    expect(summary.statusCode).toBe(200);
    expect(summary.json().reliability.state).toBe("degraded");
    expect(summary.json().reliability.backgroundJobs[0].failureCount).toBeGreaterThanOrEqual(1);
    expect(metrics.json().backgroundJobFailureCount).toBeGreaterThanOrEqual(1);

    await app.close();
  });

  it("returns go-live, support, and release summaries for operators", async () => {
    process.env.NODE_ENV = "test";
    process.env.ENABLE_PILOT_OPS = "true";
    process.env.APP_ENV_PROFILE = "local_demo";
    process.env.APP_VERSION = "2.0.0";
    process.env.BUILD_ID = "go-live-build";
    resetConfigCache();

    const app = await createTestApp();

    const [goLive, support, release] = await Promise.all([
      app.inject({
        method: "GET",
        url: "/ops/go-live-check?source=script"
      }),
      app.inject({
        method: "GET",
        url: "/ops/support/context"
      }),
      app.inject({
        method: "GET",
        url: "/ops/release-summary"
      })
    ]);

    expect(goLive.statusCode).toBe(200);
    expect(goLive.json().summary.profile).toBe("local_demo");
    expect(
      goLive.json().summary.checks.some((entry: { id: string }) => entry.id === "config_validation")
    ).toBe(true);
    expect(support.statusCode).toBe(200);
    expect(
      support.json().support.items.some((entry: { key: string }) => entry.key === "provider_modes")
    ).toBe(true);
    expect(release.statusCode).toBe(200);
    expect(release.json().summary.build.appVersion).toBe("2.0.0");
    expect(release.json().summary.enabledFeatures).toContain("demo_mode");

    const metrics = await app.inject({
      method: "GET",
      url: "/metrics",
      headers: {
        "x-nhalo-internal-token": "internal-token"
      }
    });
    expect(metrics.json().goLiveCheckReadCount).toBe(1);
    expect(metrics.json().supportContextReadCount).toBe(1);
    expect(metrics.json().releaseSummaryReadCount).toBe(1);
    expect(metrics.json().opsCheckScriptRunCount).toBe(1);

    await app.close();
  });

  it("warns when production-like launch settings are demo-heavy or mock-backed", async () => {
    process.env.NODE_ENV = "test";
    process.env.RUNTIME_ENVIRONMENT = "production_like_pilot";
    process.env.APP_ENV_PROFILE = "production_pilot";
    process.env.ENABLE_PILOT_OPS = "true";
    process.env.ENABLE_INTERNAL_ROUTE_GUARDS = "true";
    process.env.INTERNAL_ROUTE_ACCESS_TOKEN = "internal-token";
    process.env.ENABLE_DEMO_SCENARIOS = "true";
    process.env.PROVIDER_MODE = "mock";
    resetConfigCache();

    const app = await createTestApp(undefined, createDegradedPersistence({ database: true }));

    const response = await app.inject({
      method: "GET",
      url: "/ops/go-live-check",
      headers: {
        "x-nhalo-internal-token": "internal-token"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().summary.overallStatus).toBe("warn");
    expect(
      response
        .json()
        .summary.guardrails.map((entry: { id: string }) => entry.id)
    ).toEqual(expect.arrayContaining(["demo_mode_enabled_in_production_profile", "mock_provider_mode_enabled"]));

    const metrics = await app.inject({
      method: "GET",
      url: "/metrics",
      headers: {
        "x-nhalo-internal-token": "internal-token"
      }
    });
    expect(metrics.json().readinessWarnCount).toBe(1);

    await app.close();
  });

  it("records demo profile loads when demo scenarios are opened under the demo profile", async () => {
    process.env.NODE_ENV = "test";
    process.env.APP_ENV_PROFILE = "local_demo";
    process.env.VALIDATION_MODE = "true";
    process.env.ENABLE_DEMO_SCENARIOS = "true";
    resetConfigCache();

    const app = await createTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/validation/demo-scenarios"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().scenarios.length).toBeGreaterThan(0);

    const metrics = await app.inject({
      method: "GET",
      url: "/metrics"
    });
    expect(metrics.json().demoProfileLoadCount).toBe(1);

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

  it("redacts secrets in structured logs", async () => {
    process.env.NODE_ENV = "test";
    process.env.SECURITY_REDACT_LOG_FIELDS = "true";
    resetConfigCache();

    let line = "";
    const logger = createLogger({
      level: "info",
      write(value) {
        line = value;
      }
    });

    logger.info({
      message: "Secret test",
      details: {
        apiKey: "secret-key",
        nested: {
          token: "pilot-token"
        }
      }
    });

    expect(line).toContain("[REDACTED]");
    expect(line).not.toContain("secret-key");
    expect(line).not.toContain("pilot-token");
  });

  it("enforces internal route access guards when enabled", async () => {
    process.env.NODE_ENV = "test";
    process.env.ENABLE_INTERNAL_ROUTE_GUARDS = "true";
    process.env.INTERNAL_ROUTE_ACCESS_TOKEN = "internal-secret";
    resetConfigCache();

    const app = await createTestApp();

    const denied = await app.inject({
      method: "GET",
      url: "/metrics"
    });
    const allowed = await app.inject({
      method: "GET",
      url: "/metrics",
      headers: {
        "x-nhalo-internal-token": "internal-secret"
      }
    });

    expect(denied.statusCode).toBe(403);
    expect(denied.json().error.code).toBe("INTERNAL_ROUTE_FORBIDDEN");
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json().internalRouteDeniedCount).toBeGreaterThanOrEqual(1);

    await app.close();
  });

  it("rejects malformed JSON and oversized payloads safely", async () => {
    process.env.NODE_ENV = "test";
    process.env.SECURITY_MAX_REQUEST_BODY_BYTES = "1024";
    resetConfigCache();

    const app = await createTestApp();

    const malformed = await app.inject({
      method: "POST",
      url: "/search",
      headers: {
        "content-type": "application/json"
      },
      payload: "{bad json"
    });
    const oversized = await app.inject({
      method: "POST",
      url: "/feedback",
      headers: {
        "content-type": "application/json"
      },
      payload: JSON.stringify({
        category: "general",
        value: "positive",
        comment: "x".repeat(2_000)
      })
    });
    const metrics = await app.inject({
      method: "GET",
      url: "/metrics"
    });

    expect(malformed.statusCode).toBe(400);
    expect(malformed.json().error.code).toBe("MALFORMED_JSON");
    expect(oversized.statusCode).toBe(413);
    expect(oversized.json().error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(metrics.json().malformedPayloadCount).toBeGreaterThanOrEqual(2);

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
