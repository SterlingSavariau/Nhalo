import cors from "@fastify/cors";
import { ConfigError, getConfig } from "@nhalo/config";
import { createPersistenceLayer, type PersistenceLayer } from "@nhalo/db";
import { DEMO_SEARCH_SCENARIOS, createMockProviders, createProviders } from "@nhalo/providers";
import type {
  DemoScenario,
  GeocodeCacheRepository,
  ListingCacheRepository,
  MarketSnapshotRepository,
  ProviderStatus,
  SafetySignalCacheRepository,
  SearchRepository
} from "@nhalo/types";
import Fastify from "fastify";
import { ZodError, z } from "zod";
import { ApiError, isApiError } from "./errors";
import { createLogger, type AppLogger } from "./logger";
import { MetricsCollector } from "./metrics";
import { instrumentProviders } from "./provider-runtime";
import { searchRequestSchema } from "./search-schema";
import { runSearch } from "./search-service";

const searchSnapshotPayloadSchema = z.object({
  request: searchRequestSchema,
  sessionId: z.string().trim().min(1).optional(),
  searchDefinitionId: z.string().trim().min(1).optional(),
  historyRecordId: z.string().trim().min(1).optional(),
  response: z.object({
    homes: z.array(z.unknown()),
    appliedFilters: z.record(z.string(), z.unknown()),
    appliedWeights: z.object({
      price: z.number(),
      size: z.number(),
      safety: z.number()
    }),
    metadata: z.record(z.string(), z.unknown())
  })
});

const metricsEventSchema = z.object({
  eventType: z.enum([
    "comparison_view",
    "explainability_render",
    "search_restore",
    "recent_activity_panel_view",
    "onboarding_view",
    "onboarding_dismiss",
    "empty_state_view",
    "suggestion_click",
    "detail_panel_open",
    "result_compare_add",
    "snapshot_reopen",
    "saved_search_restore",
    "validation_prompt_view",
    "validation_prompt_response",
    "demo_scenario_start",
    "walkthrough_view",
    "walkthrough_dismiss",
    "export_use",
    "cta_click",
    "historical_compare_view"
  ])
});

const shareSnapshotSchema = z.object({
  sessionId: z.string().trim().min(1).optional(),
  expiresInDays: z.number().int().positive().max(365).optional()
});

const feedbackSchema = z.object({
  sessionId: z.string().trim().min(1).optional(),
  snapshotId: z.string().trim().min(1).optional(),
  historyRecordId: z.string().trim().min(1).optional(),
  searchDefinitionId: z.string().trim().min(1).optional(),
  category: z.enum([
    "useful",
    "accuracy",
    "explainability",
    "confidence",
    "missing_homes",
    "bad_matches",
    "comparison_helpful",
    "empty_state_helpful",
    "general"
  ]),
  value: z.enum(["positive", "negative", "clear", "unclear", "accurate", "inaccurate"]),
  comment: z.string().trim().max(1000).optional()
});

const validationEventSchema = z.object({
  eventName: z.enum([
    "search_completed",
    "result_opened",
    "comparison_started",
    "snapshot_shared",
    "snapshot_opened",
    "rerun_executed",
    "feedback_submitted",
    "empty_state_encountered",
    "suggestion_used",
    "demo_scenario_started",
    "restore_used"
  ]),
  sessionId: z.string().trim().min(1).optional(),
  snapshotId: z.string().trim().min(1).optional(),
  historyRecordId: z.string().trim().min(1).optional(),
  searchDefinitionId: z.string().trim().min(1).optional(),
  demoScenarioId: z.string().trim().min(1).optional(),
  payload: z.record(z.string(), z.unknown()).nullable().optional()
});

const searchDefinitionCreateSchema = z.object({
  sessionId: z.string().trim().min(1).optional(),
  label: z.string().trim().min(1, "label is required"),
  request: searchRequestSchema,
  pinned: z.boolean().optional()
});

const searchDefinitionUpdateSchema = z
  .object({
    label: z.string().trim().min(1).optional(),
    pinned: z.boolean().optional()
  })
  .refine((payload) => payload.label !== undefined || payload.pinned !== undefined, {
    message: "At least one editable field is required"
  });

const rerunRequestSchema = z.object({
  sessionId: z.string().trim().min(1).optional(),
  createSnapshot: z.boolean().optional().default(false)
});

const shortlistCreateSchema = z.object({
  sessionId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1, "title is required"),
  description: z.string().trim().max(500).optional(),
  sourceSnapshotId: z.string().trim().min(1).optional(),
  pinned: z.boolean().optional()
});

const shortlistUpdateSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    pinned: z.boolean().optional()
  })
  .refine((payload) => payload.title !== undefined || payload.description !== undefined || payload.pinned !== undefined, {
    message: "At least one editable field is required"
  });

const shortlistItemCreateSchema = z.object({
  canonicalPropertyId: z.string().trim().min(1, "canonicalPropertyId is required"),
  sourceSnapshotId: z.string().trim().min(1).optional(),
  sourceHistoryId: z.string().trim().min(1).optional(),
  sourceSearchDefinitionId: z.string().trim().min(1).optional(),
  capturedHome: z.record(z.string(), z.unknown()),
  reviewState: z.enum(["undecided", "interested", "needs_review", "rejected"]).optional()
});

const shortlistItemUpdateSchema = z.object({
  reviewState: z.enum(["undecided", "interested", "needs_review", "rejected"])
});

const resultNoteCreateSchema = z.object({
  sessionId: z.string().trim().min(1).optional(),
  entityType: z.enum(["shortlist_item", "snapshot_result", "shared_snapshot_result"]),
  entityId: z.string().trim().min(1, "entityId is required"),
  body: z.string().trim().min(1, "body is required").max(2000)
});

const resultNoteUpdateSchema = z.object({
  body: z.string().trim().min(1, "body is required").max(2000)
});

const shortlistShareSchema = z.object({
  sessionId: z.string().trim().min(1).optional(),
  shareMode: z.enum(["read_only", "comment_only", "review_only"]),
  expiresInDays: z.number().int().positive().max(365).optional()
});

const sharedCommentCreateSchema = z.object({
  shareId: z.string().trim().min(1, "shareId is required"),
  entityType: z.enum(["shared_shortlist_item"]),
  entityId: z.string().trim().min(1, "entityId is required"),
  authorLabel: z.string().trim().max(120).optional(),
  body: z.string().trim().min(1, "body is required").max(2000)
});

const sharedCommentUpdateSchema = z.object({
  authorLabel: z.string().trim().max(120).optional(),
  body: z.string().trim().min(1, "body is required").max(2000)
});

const reviewerDecisionCreateSchema = z.object({
  shareId: z.string().trim().min(1, "shareId is required"),
  shortlistItemId: z.string().trim().min(1, "shortlistItemId is required"),
  decision: z.enum(["agree", "disagree", "discuss", "favorite", "pass"]),
  note: z.string().trim().max(500).optional()
});

const reviewerDecisionUpdateSchema = z
  .object({
    decision: z.enum(["agree", "disagree", "discuss", "favorite", "pass"]).optional(),
    note: z.string().trim().max(500).nullable().optional()
  })
  .refine((payload) => payload.decision !== undefined || payload.note !== undefined, {
    message: "At least one editable field is required"
  });

function extractSessionId(request: {
  headers?: Record<string, unknown>;
  query?: Record<string, unknown>;
}, bodySessionId?: string | null): string | null {
  const headerValue = request.headers?.["x-nhalo-session-id"];
  const queryValue = request.query?.sessionId;
  const raw =
    (typeof headerValue === "string" ? headerValue : null) ??
    (typeof queryValue === "string" ? queryValue : null) ??
    bodySessionId ??
    null;

  return raw?.trim() ? raw.trim() : null;
}

function parseLimit(query: Record<string, unknown> | undefined, fallback = 10): number {
  const raw = query?.limit;
  const parsed =
    typeof raw === "string"
      ? Number(raw)
      : typeof raw === "number"
        ? raw
        : fallback;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, 50);
}

function addDaysToNowIso(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function featureDisabled(feature: string): ApiError {
  return new ApiError(404, "FEATURE_DISABLED", `${feature} is not enabled in this environment.`);
}

function shareModeAllowsComments(shareMode: "read_only" | "comment_only" | "review_only"): boolean {
  return shareMode === "comment_only" || shareMode === "review_only";
}

function shareModeAllowsReviewerDecision(shareMode: "read_only" | "comment_only" | "review_only"): boolean {
  return shareMode === "review_only";
}

export interface AppDependencies {
  repository: SearchRepository;
  marketSnapshotRepository: MarketSnapshotRepository;
  safetySignalCacheRepository: SafetySignalCacheRepository;
  listingCacheRepository: ListingCacheRepository;
  geocodeCacheRepository: GeocodeCacheRepository;
  providers: ReturnType<typeof createMockProviders>;
  metrics: MetricsCollector;
  logger: AppLogger;
}

type ErrorCategory =
  | "VALIDATION_ERROR"
  | "PROVIDER_ERROR"
  | "DATABASE_ERROR"
  | "CONFIG_ERROR"
  | "INTERNAL_ERROR";

type RequestWithId = {
  id: string;
  method: string;
  url: string;
  ip: string;
  routeOptions?: {
    url?: string;
  };
  headers?: Record<string, unknown>;
};

type ReplyWithHeader = {
  header(name: string, value: string): void;
  status(code: number): {
    send(payload: unknown): unknown;
  };
  statusCode: number;
};

const REQUEST_STARTED_AT = Symbol("requestStartedAt");

function buildErrorPayload(
  code: string,
  message: string,
  details: Array<{ field?: string; message: string }> = []
) {
  return {
    error: {
      code,
      message,
      details
    }
  };
}

function createRateLimiter(maxRequests: number, windowMs: number) {
  const buckets = new Map<string, number[]>();

  return function take(key: string) {
    const now = Date.now();
    const windowStart = now - windowMs;
    const current = (buckets.get(key) ?? []).filter((timestamp) => timestamp > windowStart);

    if (current.length >= maxRequests) {
      buckets.set(key, current);
      return {
        allowed: false,
        retryAfterMs: Math.max(windowMs - (now - current[0]), 0)
      };
    }

    current.push(now);
    buckets.set(key, current);
    return {
      allowed: true,
      retryAfterMs: 0
    };
  };
}

function classifyError(error: unknown): {
  category: ErrorCategory;
  statusCode: number;
  payload: ReturnType<typeof buildErrorPayload>;
} {
  if (error instanceof ZodError) {
    return {
      category: "VALIDATION_ERROR",
      statusCode: 400,
      payload: formatValidationError(error)
    };
  }

  if (error instanceof ConfigError) {
    return {
      category: "CONFIG_ERROR",
      statusCode: 500,
      payload: buildErrorPayload("CONFIG_ERROR", error.message, error.details)
    };
  }

  if (isApiError(error)) {
    return {
      category:
        error.code.includes("PROVIDER") || error.code.includes("LOCATION")
          ? "PROVIDER_ERROR"
          : "INTERNAL_ERROR",
      statusCode: error.statusCode,
      payload: buildErrorPayload(error.code, error.message, error.details ?? [])
    };
  }

  if (
    error instanceof Error &&
    /prisma|database|connection|datasource/i.test(error.message)
  ) {
    return {
      category: "DATABASE_ERROR",
      statusCode: 503,
      payload: buildErrorPayload(
        "DATABASE_ERROR",
        "A database dependency failed while processing the request."
      )
    };
  }

  return {
    category: "INTERNAL_ERROR",
    statusCode: 500,
    payload: buildErrorPayload("INTERNAL_ERROR", "Unexpected server error")
  };
}

function formatValidationError(error: ZodError) {
  return buildErrorPayload(
    "VALIDATION_ERROR",
    "Invalid search request",
    error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message
    }))
  );
}

export async function buildApp(dependencies?: Partial<AppDependencies>) {
  const config = getConfig();
  const logger = dependencies?.logger ?? createLogger({ level: config.logLevel });
  const persistence: PersistenceLayer =
    dependencies?.repository &&
    dependencies?.marketSnapshotRepository &&
    dependencies?.safetySignalCacheRepository &&
    dependencies?.listingCacheRepository &&
    dependencies?.geocodeCacheRepository
      ? {
          mode: "memory",
          searchRepository: dependencies.repository,
          marketSnapshotRepository: dependencies.marketSnapshotRepository,
          safetySignalCacheRepository: dependencies.safetySignalCacheRepository,
          listingCacheRepository: dependencies.listingCacheRepository,
          geocodeCacheRepository: dependencies.geocodeCacheRepository,
          async checkReadiness() {
            return {
              database: true,
              cache: true
            };
          },
          async cleanupExpiredData() {
            return {
              snapshotsRemoved: 0,
              historyRemoved: 0,
              cachesRemoved: 0
            };
          },
          async close() {}
        }
      : await createPersistenceLayer(config.databaseUrl);

  if (
    config.databaseUrl &&
    persistence.mode === "memory" &&
    (config.nodeEnv === "staging" || config.nodeEnv === "production")
  ) {
    throw new ConfigError("Database initialization failed; refusing to start with in-memory persistence.", [
      {
        field: "DATABASE_URL",
        message: "Check the configured database connection before starting staging or production."
      }
    ]);
  }
  const metrics = dependencies?.metrics ?? new MetricsCollector();
  const providers = instrumentProviders(
    dependencies?.providers ??
      createProviders({
        geocodeCacheRepository: persistence.geocodeCacheRepository,
        listingCacheRepository: persistence.listingCacheRepository,
        safetySignalCacheRepository: persistence.safetySignalCacheRepository,
        metrics
      }),
    metrics
  );
  const app = Fastify({ logger: false, disableRequestLogging: true });
  const demoScenarios: DemoScenario[] = DEMO_SEARCH_SCENARIOS;
  const takeSearchRateLimit = createRateLimiter(
    config.rateLimit.searchMax,
    config.rateLimit.searchWindowMs
  );
  const takeSnapshotRateLimit = createRateLimiter(
    config.rateLimit.snapshotMax,
    config.rateLimit.snapshotWindowMs
  );
  const cleanupTimer =
    config.retention.cleanupIntervalMs > 0
      ? setInterval(() => {
          persistence
            .cleanupExpiredData({
              snapshotRetentionDays: config.retention.snapshotRetentionDays,
              searchHistoryRetentionDays: config.retention.searchHistoryRetentionDays
            })
            .then((summary) => {
              if (
                summary.snapshotsRemoved > 0 ||
                summary.historyRemoved > 0 ||
                summary.cachesRemoved > 0
              ) {
                logger.info({
                  message: "Retention cleanup completed",
                  details: summary
                });
              }
            })
            .catch((error) => {
              logger.warn({
                message: "Retention cleanup failed",
                errorCode: "DATABASE_ERROR",
                details: error instanceof Error ? error.message : "Unknown cleanup failure"
              });
            });
        }, config.retention.cleanupIntervalMs)
      : null;
  cleanupTimer?.unref?.();

  await app.register(cors, {
    origin: true
  });

  app.addHook("onRequest", async (request, reply) => {
    (request as RequestWithId & Record<PropertyKey, unknown>)[REQUEST_STARTED_AT] = Date.now();
    reply.header("x-request-id", request.id);
    logger.debug({
      message: "Request started",
      requestId: request.id,
      endpoint: (request.routeOptions?.url as string | undefined) ?? request.url
    });
  });

  app.addHook("onResponse", async (request, reply) => {
    const startedAt =
      ((request as RequestWithId & Record<PropertyKey, unknown>)[REQUEST_STARTED_AT] as number | undefined) ??
      Date.now();
    logger.info({
      message: "Request completed",
      requestId: request.id,
      endpoint: (request.routeOptions?.url as string | undefined) ?? request.url,
      durationMs: Date.now() - startedAt,
      statusCode: reply.statusCode
    });
  });

  app.addHook("onClose", async () => {
    if (cleanupTimer) {
      clearInterval(cleanupTimer);
    }
    await persistence.close();
    await logger.flush();
  });

  app.setErrorHandler((error, request, reply) => {
    const classified = classifyError(error);
    metrics.recordError(classified.category);
    if (
      request.method === "POST" &&
      request.url.startsWith("/search") &&
      !request.url.startsWith("/search/snapshots")
    ) {
      metrics.recordSearchOutcome(false);
    }
    logger.error({
      message: "Request failed",
      requestId: request.id,
      endpoint: (request.routeOptions?.url as string | undefined) ?? request.url,
      durationMs:
        Date.now() -
        ((((request as RequestWithId & Record<PropertyKey, unknown>)[REQUEST_STARTED_AT] as number | undefined) ??
          Date.now())),
      statusCode: classified.statusCode,
      errorCode: classified.payload.error.code,
      details:
        error instanceof Error
          ? {
              message: error.message
            }
          : "Unknown error"
    });

    return reply.status(classified.statusCode).send(classified.payload);
  });

  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Number(process.uptime().toFixed(2)),
    memoryUsage: process.memoryUsage()
  }));

  app.get("/ready", async (request, reply) => {
    const [dependencyReadiness, statuses] = await Promise.all([
      persistence.checkReadiness(),
      providers.getStatuses()
    ]);

    const providersReady = statuses.every(
      (status) => status.status !== "failing" && status.status !== "unavailable"
    );
    const ready = dependencyReadiness.database && dependencyReadiness.cache && providersReady;

    return reply.status(ready ? 200 : 503).send({
      status: ready ? "ready" : "not_ready",
      requestId: request.id,
      checks: {
        database: dependencyReadiness.database,
        cache: dependencyReadiness.cache,
        providers: providersReady
      }
    });
  });

  app.get("/providers/status", async () => {
    const statuses: ProviderStatus[] = await providers.getStatuses();

    return {
      providers: statuses
    };
  });

  app.get("/scores/audit/:propertyId", async (request, reply) => {
    const params = request.params as { propertyId?: string };
    const propertyId = params.propertyId?.trim();

    if (!propertyId) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid propertyId",
          details: [
            {
              field: "propertyId",
              message: "propertyId is required"
            }
          ]
        }
      });
    }

    const auditRecord = await persistence.searchRepository.getScoreAudit(propertyId);

    if (!auditRecord) {
      return reply.status(404).send({
        error: {
          code: "SCORE_AUDIT_NOT_FOUND",
          message: "No stored score snapshot was found for this property.",
          details: []
        }
      });
    }

    metrics.recordAuditView();
    return auditRecord;
  });

  app.get("/metrics", async () => metrics.snapshot());

  app.get("/validation/demo-scenarios", async () => {
    if (!config.validation.enabled || !config.validation.demoScenariosEnabled) {
      throw featureDisabled("Demo scenarios");
    }

    return {
      scenarios: demoScenarios
    };
  });

  app.get("/validation/summary", async () => {
    if (!config.validation.enabled) {
      throw featureDisabled("Validation summary");
    }

    const summary = await persistence.searchRepository.getValidationSummary();
    metrics.recordValidationSummaryRead();
    return summary;
  });

  app.post("/metrics/events", async (request, reply) => {
    const payload = metricsEventSchema.parse(request.body);

    if (payload.eventType === "comparison_view") {
      metrics.recordComparisonView();
    }

    if (payload.eventType === "explainability_render") {
      metrics.recordExplainabilityRender();
    }

    if (payload.eventType === "search_restore") {
      metrics.recordSearchRestore();
    }

    if (payload.eventType === "recent_activity_panel_view") {
      metrics.recordRecentActivityPanelView();
    }

    if (payload.eventType === "onboarding_view") {
      metrics.recordOnboardingView();
    }

    if (payload.eventType === "onboarding_dismiss") {
      metrics.recordOnboardingDismiss();
    }

    if (payload.eventType === "empty_state_view") {
      metrics.recordEmptyStateView();
    }

    if (payload.eventType === "suggestion_click") {
      metrics.recordSuggestionClick();
    }

    if (payload.eventType === "detail_panel_open") {
      metrics.recordDetailPanelOpen();
    }

    if (payload.eventType === "result_compare_add") {
      metrics.recordResultCompareAdd();
    }

    if (payload.eventType === "snapshot_reopen") {
      metrics.recordSnapshotReopen();
    }

    if (payload.eventType === "saved_search_restore") {
      metrics.recordSavedSearchRestore();
    }

    if (payload.eventType === "validation_prompt_view") {
      metrics.recordValidationPromptView();
    }

    if (payload.eventType === "validation_prompt_response") {
      metrics.recordValidationPromptResponse();
    }

    if (payload.eventType === "demo_scenario_start") {
      metrics.recordDemoScenarioStart();
    }

    if (payload.eventType === "walkthrough_view") {
      metrics.recordWalkthroughView();
    }

    if (payload.eventType === "walkthrough_dismiss") {
      metrics.recordWalkthroughDismiss();
    }

    if (payload.eventType === "export_use") {
      metrics.recordExportUse();
    }

    if (payload.eventType === "cta_click") {
      metrics.recordCtaClick();
    }

    if (payload.eventType === "historical_compare_view") {
      metrics.recordHistoricalCompareView();
    }

    return reply.status(202).send({ status: "accepted" });
  });

  app.post("/validation/events", async (request, reply) => {
    if (!config.validation.enabled) {
      throw featureDisabled("Validation events");
    }

    const payload = validationEventSchema.parse(request.body);
    const event = await persistence.searchRepository.recordValidationEvent({
      ...payload,
      sessionId: extractSessionId(request, payload.sessionId ?? null)
    });

    return reply.status(202).send(event);
  });

  app.post("/feedback", async (request, reply) => {
    if (!config.validation.enabled || !config.validation.feedbackEnabled) {
      throw featureDisabled("Feedback capture");
    }

    const payload = feedbackSchema.parse(request.body);
    const sessionId = extractSessionId(request, payload.sessionId ?? null);
    const record = await persistence.searchRepository.createFeedback({
      ...payload,
      sessionId
    });
    await persistence.searchRepository.recordValidationEvent({
      eventName: "feedback_submitted",
      sessionId,
      snapshotId: payload.snapshotId ?? null,
      historyRecordId: payload.historyRecordId ?? null,
      searchDefinitionId: payload.searchDefinitionId ?? null,
      payload: {
        category: payload.category,
        value: payload.value
      }
    });
    metrics.recordFeedbackSubmit(payload.value === "positive");

    return reply.status(201).send(record);
  });

  app.post("/search", async (request) => {
    const rateLimitKey = extractSessionId(request) ?? request.ip;
    const rateLimit = takeSearchRateLimit(rateLimitKey);
    if (!rateLimit.allowed) {
      throw new ApiError(429, "RATE_LIMITED", "Search rate limit exceeded.", [
        {
          field: "retryAfterMs",
          message: String(rateLimit.retryAfterMs)
        }
      ]);
    }

    const payload = searchRequestSchema.parse(request.body);
    const sessionId = extractSessionId(request);
    try {
      const response = await runSearch(
        payload,
        {
          geocoder: providers.geocoder,
          listingProvider: providers.listings,
          marketSnapshotRepository: persistence.marketSnapshotRepository,
          metrics,
          repository: persistence.searchRepository,
          safetyProvider: providers.safety,
          getProviderFreshnessHours: () => providers.getFreshnessHours()
        },
        {
          sessionId
        }
      );
      if (config.validation.enabled) {
        await persistence.searchRepository.recordValidationEvent({
          eventName: "search_completed",
          sessionId,
          historyRecordId: response.metadata.historyRecordId ?? null,
          payload: {
            returnedCount: response.metadata.returnedCount,
            totalMatched: response.metadata.totalMatched
          }
        });
      }
      metrics.recordSearchOutcome(true);
      return response;
    } catch (error) {
      throw error;
    }
  });

  app.post("/search/snapshots", async (request, reply) => {
    const rateLimitKey = extractSessionId(request) ?? request.ip;
    const rateLimit = takeSnapshotRateLimit(rateLimitKey);
    if (!rateLimit.allowed) {
      throw new ApiError(429, "RATE_LIMITED", "Snapshot creation rate limit exceeded.", [
        {
          field: "retryAfterMs",
          message: String(rateLimit.retryAfterMs)
        }
      ]);
    }

    const payload = searchSnapshotPayloadSchema.parse(request.body);
    const snapshot = await persistence.searchRepository.createSearchSnapshot({
      ...payload,
      sessionId: extractSessionId(request, payload.sessionId ?? null)
    });
    metrics.recordSnapshotCreated();

    return reply.status(201).send(snapshot);
  });

  app.get("/search/snapshots", async (request) => {
    const startedAt = Date.now();
    const query = request.query as Record<string, unknown> | undefined;
    const sessionId = extractSessionId(request);
    const limit = parseLimit(query);
    const snapshots = await persistence.searchRepository.listSearchSnapshots(sessionId, limit);
    metrics.recordSnapshotRead();
    metrics.recordSnapshotReadLatency(Date.now() - startedAt);

    return {
      snapshots
    };
  });

  app.get("/search/snapshots/:id", async (request, reply) => {
    const startedAt = Date.now();
    const params = request.params as { id?: string };
    const snapshotId = params.id?.trim();

    if (!snapshotId) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid snapshot id",
          details: [
            {
              field: "id",
              message: "id is required"
            }
          ]
        }
      });
    }

    const snapshot = await persistence.searchRepository.getSearchSnapshot(snapshotId);

    if (!snapshot) {
      return reply.status(404).send({
        error: {
          code: "SEARCH_SNAPSHOT_NOT_FOUND",
          message: "No stored search snapshot was found for this id.",
          details: []
        }
      });
    }

    metrics.recordSnapshotRead();
    metrics.recordSnapshotReadLatency(Date.now() - startedAt);
    return snapshot;
  });

  app.post("/search/snapshots/:id/share", async (request, reply) => {
    if (!config.validation.enabled || !config.validation.sharedSnapshotsEnabled) {
      throw featureDisabled("Shared snapshots");
    }

    const params = request.params as { id?: string };
    const snapshotId = params.id?.trim();
    const payload = shareSnapshotSchema.parse(request.body ?? {});

    if (!snapshotId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid snapshot id", [
          {
            field: "id",
            message: "id is required"
          }
        ])
      );
    }

    const snapshot = await persistence.searchRepository.getSearchSnapshot(snapshotId);
    if (!snapshot) {
      return reply.status(404).send(
        buildErrorPayload(
          "SEARCH_SNAPSHOT_NOT_FOUND",
          "No stored search snapshot was found for this id."
        )
      );
    }

    const sessionId = extractSessionId(request, payload.sessionId ?? snapshot.sessionId ?? null);
    const expiresInDays =
      payload.expiresInDays ?? config.validation.shareSnapshotExpirationDays;
    const share = await persistence.searchRepository.createSharedSnapshot({
      snapshotId,
      sessionId,
      expiresAt: expiresInDays > 0 ? addDaysToNowIso(expiresInDays) : null
    });
    await persistence.searchRepository.recordValidationEvent({
      eventName: "snapshot_shared",
      sessionId,
      snapshotId,
      payload: {
        shareId: share.shareId
      }
    });
    metrics.recordSharedSnapshotCreate();

    return reply.status(201).send({
      share,
      shareUrl: `${config.apiUrl.replace(/\/$/, "")}/shared/snapshots/${share.shareId}`,
      readOnly: true
    });
  });

  app.get("/shared/snapshots/:shareId", async (request, reply) => {
    if (!config.validation.enabled || !config.validation.sharedSnapshotsEnabled) {
      throw featureDisabled("Shared snapshots");
    }

    const params = request.params as { shareId?: string };
    const shareId = params.shareId?.trim();

    if (!shareId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid share id", [
          {
            field: "shareId",
            message: "shareId is required"
          }
        ])
      );
    }

    const sharedView = await persistence.searchRepository.getSharedSnapshot(shareId);
    if (!sharedView) {
      return reply.status(404).send(
        buildErrorPayload(
          "SHARED_SNAPSHOT_NOT_FOUND",
          "No shared snapshot was found for this share id."
        )
      );
    }

    if (sharedView.share.status === "expired") {
      metrics.recordSharedSnapshotExpired();
      return reply.status(410).send(
        buildErrorPayload(
          "SHARED_SNAPSHOT_EXPIRED",
          "This shared snapshot link has expired and can no longer be opened."
        )
      );
    }

    if (sharedView.share.status === "revoked") {
      return reply.status(410).send(
        buildErrorPayload(
          "SHARED_SNAPSHOT_REVOKED",
          "This shared snapshot link has been revoked and can no longer be opened."
        )
      );
    }

    await persistence.searchRepository.recordValidationEvent({
      eventName: "snapshot_opened",
      sessionId: sharedView.share.sessionId ?? null,
      snapshotId: sharedView.snapshot.id,
      payload: {
        shareId: sharedView.share.shareId
      }
    });
    metrics.recordSharedSnapshotOpen();

    return {
      readOnly: true,
      shared: true,
      ...sharedView
    };
  });

  app.post("/search/definitions", async (request, reply) => {
    const payload = searchDefinitionCreateSchema.parse(request.body);
    const definition = await persistence.searchRepository.createSearchDefinition({
      ...payload,
      sessionId: extractSessionId(request, payload.sessionId ?? null)
    });
    metrics.recordSearchDefinitionCreate();
    if (definition.pinned) {
      metrics.recordSavedSearchPin();
    }

    return reply.status(201).send(definition);
  });

  app.get("/search/definitions", async (request) => {
    const sessionId = extractSessionId(request);
    const definitions = await persistence.searchRepository.listSearchDefinitions(sessionId);

    return {
      definitions
    };
  });

  app.get("/search/definitions/:id", async (request, reply) => {
    const params = request.params as { id?: string };
    const definitionId = params.id?.trim();

    if (!definitionId) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid definition id",
          details: [{ field: "id", message: "id is required" }]
        }
      });
    }

    const definition = await persistence.searchRepository.getSearchDefinition(definitionId);
    if (!definition) {
      return reply.status(404).send({
        error: {
          code: "SEARCH_DEFINITION_NOT_FOUND",
          message: "No saved search definition was found for this id.",
          details: []
        }
      });
    }

    return definition;
  });

  app.patch("/search/definitions/:id", async (request, reply) => {
    const params = request.params as { id?: string };
    const definitionId = params.id?.trim();
    const patch = searchDefinitionUpdateSchema.parse(request.body);

    if (!definitionId) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid definition id",
          details: [{ field: "id", message: "id is required" }]
        }
      });
    }

    const existing = await persistence.searchRepository.getSearchDefinition(definitionId);
    const updated = await persistence.searchRepository.updateSearchDefinition(definitionId, patch);

    if (!updated || !existing) {
      return reply.status(404).send({
        error: {
          code: "SEARCH_DEFINITION_NOT_FOUND",
          message: "No saved search definition was found for this id.",
          details: []
        }
      });
    }

    if (!existing.pinned && updated.pinned) {
      metrics.recordSavedSearchPin();
    }

    return updated;
  });

  app.delete("/search/definitions/:id", async (request, reply) => {
    const params = request.params as { id?: string };
    const definitionId = params.id?.trim();

    if (!definitionId) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid definition id",
          details: [{ field: "id", message: "id is required" }]
        }
      });
    }

    const deleted = await persistence.searchRepository.deleteSearchDefinition(definitionId);
    if (!deleted) {
      return reply.status(404).send({
        error: {
          code: "SEARCH_DEFINITION_NOT_FOUND",
          message: "No saved search definition was found for this id.",
          details: []
        }
      });
    }

    metrics.recordSearchDefinitionDelete();
    return reply.status(204).send();
  });

  app.get("/search/history", async (request) => {
    const query = request.query as Record<string, unknown> | undefined;
    const sessionId = extractSessionId(request);
    const limit = parseLimit(query);
    const history = await persistence.searchRepository.listSearchHistory(sessionId, limit);
    metrics.recordSearchHistoryRead();

    return {
      history
    };
  });

  app.get("/search/history/:id", async (request, reply) => {
    const params = request.params as { id?: string };
    const historyId = params.id?.trim();

    if (!historyId) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid history id",
          details: [{ field: "id", message: "id is required" }]
        }
      });
    }

    const historyRecord = await persistence.searchRepository.getSearchHistory(historyId);
    if (!historyRecord) {
      return reply.status(404).send({
        error: {
          code: "SEARCH_HISTORY_NOT_FOUND",
          message: "No stored search history record was found for this id.",
          details: []
        }
      });
    }

    metrics.recordSearchHistoryRead();
    return historyRecord;
  });

  app.post("/shortlists", async (request, reply) => {
    if (!config.workflow.shortlistsEnabled) {
      throw featureDisabled("Shortlists");
    }

    const payload = shortlistCreateSchema.parse(request.body);
    const shortlist = await persistence.searchRepository.createShortlist({
      ...payload,
      sessionId: extractSessionId(request, payload.sessionId ?? null)
    });
    metrics.recordShortlistCreate();
    if (shortlist.pinned) {
      metrics.recordSavedSearchPin();
    }

    return reply.status(201).send(shortlist);
  });

  app.get("/shortlists", async (request) => {
    if (!config.workflow.shortlistsEnabled) {
      throw featureDisabled("Shortlists");
    }

    const sessionId = extractSessionId(request);
    const shortlists = await persistence.searchRepository.listShortlists(sessionId);
    metrics.recordShortlistView();

    return {
      shortlists
    };
  });

  app.get("/shortlists/:id", async (request, reply) => {
    if (!config.workflow.shortlistsEnabled) {
      throw featureDisabled("Shortlists");
    }

    const params = request.params as { id?: string };
    const shortlistId = params.id?.trim();

    if (!shortlistId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid shortlist id", [
          { field: "id", message: "id is required" }
        ])
      );
    }

    const shortlist = await persistence.searchRepository.getShortlist(shortlistId);
    if (!shortlist) {
      return reply.status(404).send(
        buildErrorPayload("SHORTLIST_NOT_FOUND", "No shortlist was found for this id.")
      );
    }

    metrics.recordShortlistView();
    return shortlist;
  });

  app.patch("/shortlists/:id", async (request, reply) => {
    if (!config.workflow.shortlistsEnabled) {
      throw featureDisabled("Shortlists");
    }

    const params = request.params as { id?: string };
    const shortlistId = params.id?.trim();
    const patch = shortlistUpdateSchema.parse(request.body);

    if (!shortlistId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid shortlist id", [
          { field: "id", message: "id is required" }
        ])
      );
    }

    const shortlist = await persistence.searchRepository.updateShortlist(shortlistId, patch);
    if (!shortlist) {
      return reply.status(404).send(
        buildErrorPayload("SHORTLIST_NOT_FOUND", "No shortlist was found for this id.")
      );
    }

    return shortlist;
  });

  app.delete("/shortlists/:id", async (request, reply) => {
    if (!config.workflow.shortlistsEnabled) {
      throw featureDisabled("Shortlists");
    }

    const params = request.params as { id?: string };
    const shortlistId = params.id?.trim();

    if (!shortlistId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid shortlist id", [
          { field: "id", message: "id is required" }
        ])
      );
    }

    const deleted = await persistence.searchRepository.deleteShortlist(shortlistId);
    if (!deleted) {
      return reply.status(404).send(
        buildErrorPayload("SHORTLIST_NOT_FOUND", "No shortlist was found for this id.")
      );
    }

    metrics.recordShortlistDelete();
    return reply.status(204).send();
  });

  app.post("/shortlists/:id/share", async (request, reply) => {
    if (!config.workflow.shortlistsEnabled || !config.workflow.sharedShortlistsEnabled) {
      throw featureDisabled("Shared shortlists");
    }

    const params = request.params as { id?: string };
    const shortlistId = params.id?.trim();
    const payload = shortlistShareSchema.parse(request.body ?? {});

    if (!shortlistId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid shortlist id", [
          { field: "id", message: "id is required" }
        ])
      );
    }

    const shortlist = await persistence.searchRepository.getShortlist(shortlistId);
    if (!shortlist) {
      return reply.status(404).send(
        buildErrorPayload("SHORTLIST_NOT_FOUND", "No shortlist was found for this id.")
      );
    }

    const sessionId = extractSessionId(request, payload.sessionId ?? shortlist.sessionId ?? null);
    const share = await persistence.searchRepository.createSharedShortlist({
      shortlistId,
      sessionId,
      shareMode: payload.shareMode,
      expiresAt:
        payload.expiresInDays && payload.expiresInDays > 0
          ? addDaysToNowIso(payload.expiresInDays)
          : null
    });

    metrics.recordShortlistShareCreate();
    return reply.status(201).send({
      share,
      shareUrl: `${config.apiUrl.replace(/\/$/, "")}/shared/shortlists/${share.shareId}`,
      readOnly: share.shareMode === "read_only"
    });
  });

  app.get("/shortlists/:id/shares", async (request, reply) => {
    if (!config.workflow.shortlistsEnabled || !config.workflow.sharedShortlistsEnabled) {
      throw featureDisabled("Shared shortlists");
    }

    const params = request.params as { id?: string };
    const shortlistId = params.id?.trim();

    if (!shortlistId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid shortlist id", [
          { field: "id", message: "id is required" }
        ])
      );
    }

    const shares = await persistence.searchRepository.listSharedShortlists(shortlistId);
    return {
      shares
    };
  });

  app.post("/shortlists/shares/:shareId/revoke", async (request, reply) => {
    if (!config.workflow.shortlistsEnabled || !config.workflow.sharedShortlistsEnabled) {
      throw featureDisabled("Shared shortlists");
    }

    const params = request.params as { shareId?: string };
    const shareId = params.shareId?.trim();

    if (!shareId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid share id", [
          { field: "shareId", message: "shareId is required" }
        ])
      );
    }

    const share = await persistence.searchRepository.revokeSharedShortlist(shareId);
    if (!share) {
      return reply.status(404).send(
        buildErrorPayload("SHARED_SHORTLIST_NOT_FOUND", "No shared shortlist was found for this share id.")
      );
    }

    metrics.recordShortlistShareRevoke();
    return {
      share
    };
  });

  app.get("/shared/shortlists/:shareId", async (request, reply) => {
    if (!config.workflow.shortlistsEnabled || !config.workflow.sharedShortlistsEnabled) {
      throw featureDisabled("Shared shortlists");
    }

    const params = request.params as { shareId?: string };
    const shareId = params.shareId?.trim();

    if (!shareId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid share id", [
          { field: "shareId", message: "shareId is required" }
        ])
      );
    }

    const sharedView = await persistence.searchRepository.getSharedShortlist(shareId);
    if (!sharedView) {
      return reply.status(404).send(
        buildErrorPayload(
          "SHARED_SHORTLIST_NOT_FOUND",
          "No shared shortlist was found for this share id."
        )
      );
    }

    if (sharedView.share.status === "expired") {
      metrics.recordExpiredShareOpen();
      return reply.status(410).send(
        buildErrorPayload(
          "SHARED_SHORTLIST_EXPIRED",
          "This shared shortlist link has expired and can no longer be opened."
        )
      );
    }

    if (sharedView.share.status === "revoked") {
      return reply.status(410).send(
        buildErrorPayload(
          "SHARED_SHORTLIST_REVOKED",
          "This shared shortlist link has been revoked and can no longer be opened."
        )
      );
    }

    metrics.recordShortlistShareOpen();
    return sharedView;
  });

  app.get("/shortlists/:id/items", async (request, reply) => {
    if (!config.workflow.shortlistsEnabled) {
      throw featureDisabled("Shortlists");
    }

    const params = request.params as { id?: string };
    const shortlistId = params.id?.trim();

    if (!shortlistId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid shortlist id", [
          { field: "id", message: "id is required" }
        ])
      );
    }

    const shortlist = await persistence.searchRepository.getShortlist(shortlistId);
    if (!shortlist) {
      return reply.status(404).send(
        buildErrorPayload("SHORTLIST_NOT_FOUND", "No shortlist was found for this id.")
      );
    }

    const items = await persistence.searchRepository.listShortlistItems(shortlistId);
    metrics.recordShortlistView();
    return {
      shortlist,
      items
    };
  });

  app.post("/shortlists/:id/items", async (request, reply) => {
    if (!config.workflow.shortlistsEnabled) {
      throw featureDisabled("Shortlists");
    }

    const params = request.params as { id?: string };
    const shortlistId = params.id?.trim();
    const payload = shortlistItemCreateSchema.parse(request.body);

    if (!shortlistId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid shortlist id", [
          { field: "id", message: "id is required" }
        ])
      );
    }

    const item = await persistence.searchRepository.createShortlistItem(shortlistId, payload);
    if (!item) {
      return reply.status(404).send(
        buildErrorPayload("SHORTLIST_NOT_FOUND", "No shortlist was found for this id.")
      );
    }

    metrics.recordShortlistItemAdd();
    return reply.status(201).send(item);
  });

  app.patch("/shortlists/:id/items/:itemId", async (request, reply) => {
    if (!config.workflow.shortlistsEnabled) {
      throw featureDisabled("Shortlists");
    }

    const params = request.params as { id?: string; itemId?: string };
    const shortlistId = params.id?.trim();
    const itemId = params.itemId?.trim();
    const patch = shortlistItemUpdateSchema.parse(request.body);

    if (!shortlistId || !itemId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid shortlist item id", [
          { field: "id", message: "shortlist id and item id are required" }
        ])
      );
    }

    const item = await persistence.searchRepository.updateShortlistItem(shortlistId, itemId, patch);
    if (!item) {
      return reply.status(404).send(
        buildErrorPayload("SHORTLIST_ITEM_NOT_FOUND", "No shortlist item was found for this id.")
      );
    }

    metrics.recordReviewStateChange();
    return item;
  });

  app.delete("/shortlists/:id/items/:itemId", async (request, reply) => {
    if (!config.workflow.shortlistsEnabled) {
      throw featureDisabled("Shortlists");
    }

    const params = request.params as { id?: string; itemId?: string };
    const shortlistId = params.id?.trim();
    const itemId = params.itemId?.trim();

    if (!shortlistId || !itemId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid shortlist item id", [
          { field: "id", message: "shortlist id and item id are required" }
        ])
      );
    }

    const deleted = await persistence.searchRepository.deleteShortlistItem(shortlistId, itemId);
    if (!deleted) {
      return reply.status(404).send(
        buildErrorPayload("SHORTLIST_ITEM_NOT_FOUND", "No shortlist item was found for this id.")
      );
    }

    metrics.recordShortlistItemRemove();
    return reply.status(204).send();
  });

  app.post("/comments", async (request, reply) => {
    if (!config.workflow.sharedShortlistsEnabled || !config.workflow.sharedCommentsEnabled) {
      throw featureDisabled("Shared comments");
    }

    const payload = sharedCommentCreateSchema.parse(request.body);
    const shared = await persistence.searchRepository.getSharedShortlist(payload.shareId);
    if (!shared) {
      return reply.status(404).send(
        buildErrorPayload("SHARED_SHORTLIST_NOT_FOUND", "No shared shortlist was found for this share id.")
      );
    }
    if (shared.share.status !== "active") {
      return reply.status(410).send(
        buildErrorPayload(
          "SHARED_SHORTLIST_UNAVAILABLE",
          "This shared shortlist link is no longer available for collaboration."
        )
      );
    }
    if (!shareModeAllowsComments(shared.share.shareMode)) {
      return reply.status(403).send(
        buildErrorPayload(
          "COLLABORATION_FORBIDDEN",
          "This shared shortlist is read-only and does not accept comments."
        )
      );
    }

    const comment = await persistence.searchRepository.createSharedComment(payload);
    metrics.recordSharedCommentCreate();
    return reply.status(201).send(comment);
  });

  app.get("/comments", async (request, reply) => {
    if (!config.workflow.sharedShortlistsEnabled || !config.workflow.sharedCommentsEnabled) {
      throw featureDisabled("Shared comments");
    }

    const query = request.query as Record<string, unknown> | undefined;
    const shareId = typeof query?.shareId === "string" ? query.shareId.trim() : "";
    if (!shareId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "shareId is required", [
          { field: "shareId", message: "shareId is required" }
        ])
      );
    }

    const comments = await persistence.searchRepository.listSharedComments({
      shareId,
      entityType:
        query?.entityType === "shared_shortlist_item" ? "shared_shortlist_item" : undefined,
      entityId: typeof query?.entityId === "string" ? query.entityId : undefined
    });

    return { comments };
  });

  app.patch("/comments/:id", async (request, reply) => {
    if (!config.workflow.sharedShortlistsEnabled || !config.workflow.sharedCommentsEnabled) {
      throw featureDisabled("Shared comments");
    }

    const params = request.params as { id?: string };
    const commentId = params.id?.trim();
    const payload = sharedCommentUpdateSchema.parse(request.body);

    if (!commentId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid comment id", [
          { field: "id", message: "id is required" }
        ])
      );
    }

    const comment = await persistence.searchRepository.updateSharedComment(
      commentId,
      payload.body,
      payload.authorLabel
    );
    if (!comment) {
      return reply.status(404).send(
        buildErrorPayload("COMMENT_NOT_FOUND", "No shared comment was found for this id.")
      );
    }

    metrics.recordSharedCommentUpdate();
    return comment;
  });

  app.delete("/comments/:id", async (request, reply) => {
    if (!config.workflow.sharedShortlistsEnabled || !config.workflow.sharedCommentsEnabled) {
      throw featureDisabled("Shared comments");
    }

    const params = request.params as { id?: string };
    const commentId = params.id?.trim();
    if (!commentId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid comment id", [
          { field: "id", message: "id is required" }
        ])
      );
    }

    const deleted = await persistence.searchRepository.deleteSharedComment(commentId);
    if (!deleted) {
      return reply.status(404).send(
        buildErrorPayload("COMMENT_NOT_FOUND", "No shared comment was found for this id.")
      );
    }

    metrics.recordSharedCommentDelete();
    return reply.status(204).send();
  });

  app.post("/reviewer-decisions", async (request, reply) => {
    if (!config.workflow.sharedShortlistsEnabled || !config.workflow.reviewerDecisionsEnabled) {
      throw featureDisabled("Reviewer decisions");
    }

    const payload = reviewerDecisionCreateSchema.parse(request.body);
    const shared = await persistence.searchRepository.getSharedShortlist(payload.shareId);
    if (!shared) {
      return reply.status(404).send(
        buildErrorPayload("SHARED_SHORTLIST_NOT_FOUND", "No shared shortlist was found for this share id.")
      );
    }
    if (shared.share.status !== "active") {
      return reply.status(410).send(
        buildErrorPayload(
          "SHARED_SHORTLIST_UNAVAILABLE",
          "This shared shortlist link is no longer available for review."
        )
      );
    }
    if (!shareModeAllowsReviewerDecision(shared.share.shareMode)) {
      return reply.status(403).send(
        buildErrorPayload(
          "COLLABORATION_FORBIDDEN",
          "This shared shortlist does not allow reviewer decisions."
        )
      );
    }

    const existing = await persistence.searchRepository.listReviewerDecisions({
      shareId: payload.shareId,
      shortlistItemId: payload.shortlistItemId
    });
    const decision = await persistence.searchRepository.createReviewerDecision(payload);
    if (existing.length > 0) {
      metrics.recordReviewerDecisionUpdate();
    } else {
      metrics.recordReviewerDecisionCreate();
    }
    return reply.status(existing.length > 0 ? 200 : 201).send(decision);
  });

  app.get("/reviewer-decisions", async (request, reply) => {
    if (!config.workflow.sharedShortlistsEnabled || !config.workflow.reviewerDecisionsEnabled) {
      throw featureDisabled("Reviewer decisions");
    }

    const query = request.query as Record<string, unknown> | undefined;
    const shareId = typeof query?.shareId === "string" ? query.shareId.trim() : "";
    if (!shareId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "shareId is required", [
          { field: "shareId", message: "shareId is required" }
        ])
      );
    }

    const decisions = await persistence.searchRepository.listReviewerDecisions({
      shareId,
      shortlistItemId:
        typeof query?.shortlistItemId === "string" ? query.shortlistItemId : undefined
    });
    return { decisions };
  });

  app.patch("/reviewer-decisions/:id", async (request, reply) => {
    if (!config.workflow.sharedShortlistsEnabled || !config.workflow.reviewerDecisionsEnabled) {
      throw featureDisabled("Reviewer decisions");
    }

    const params = request.params as { id?: string };
    const decisionId = params.id?.trim();
    const patch = reviewerDecisionUpdateSchema.parse(request.body);

    if (!decisionId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid reviewer decision id", [
          { field: "id", message: "id is required" }
        ])
      );
    }

    const decision = await persistence.searchRepository.updateReviewerDecision(decisionId, patch);
    if (!decision) {
      return reply.status(404).send(
        buildErrorPayload("REVIEWER_DECISION_NOT_FOUND", "No reviewer decision was found for this id.")
      );
    }

    metrics.recordReviewerDecisionUpdate();
    return decision;
  });

  app.delete("/reviewer-decisions/:id", async (request, reply) => {
    if (!config.workflow.sharedShortlistsEnabled || !config.workflow.reviewerDecisionsEnabled) {
      throw featureDisabled("Reviewer decisions");
    }

    const params = request.params as { id?: string };
    const decisionId = params.id?.trim();
    if (!decisionId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid reviewer decision id", [
          { field: "id", message: "id is required" }
        ])
      );
    }

    const deleted = await persistence.searchRepository.deleteReviewerDecision(decisionId);
    if (!deleted) {
      return reply.status(404).send(
        buildErrorPayload("REVIEWER_DECISION_NOT_FOUND", "No reviewer decision was found for this id.")
      );
    }

    return reply.status(204).send();
  });

  app.post("/notes", async (request, reply) => {
    if (!config.workflow.resultNotesEnabled) {
      throw featureDisabled("Result notes");
    }

    const payload = resultNoteCreateSchema.parse(request.body);
    const note = await persistence.searchRepository.createResultNote({
      ...payload,
      sessionId: extractSessionId(request, payload.sessionId ?? null)
    });
    metrics.recordNoteCreate();
    return reply.status(201).send(note);
  });

  app.get("/notes", async (request) => {
    if (!config.workflow.resultNotesEnabled) {
      throw featureDisabled("Result notes");
    }

    const query = request.query as Record<string, unknown> | undefined;
    const notes = await persistence.searchRepository.listResultNotes({
      sessionId: extractSessionId(request),
      entityType:
        query?.entityType &&
        ["shortlist_item", "snapshot_result", "shared_snapshot_result"].includes(String(query.entityType))
          ? (String(query.entityType) as "shortlist_item" | "snapshot_result" | "shared_snapshot_result")
          : undefined,
      entityId: typeof query?.entityId === "string" ? query.entityId : undefined
    });

    return { notes };
  });

  app.patch("/notes/:id", async (request, reply) => {
    if (!config.workflow.resultNotesEnabled) {
      throw featureDisabled("Result notes");
    }

    const params = request.params as { id?: string };
    const noteId = params.id?.trim();
    const payload = resultNoteUpdateSchema.parse(request.body);

    if (!noteId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid note id", [
          { field: "id", message: "id is required" }
        ])
      );
    }

    const note = await persistence.searchRepository.updateResultNote(noteId, payload.body);
    if (!note) {
      return reply.status(404).send(
        buildErrorPayload("NOTE_NOT_FOUND", "No note was found for this id.")
      );
    }

    metrics.recordNoteUpdate();
    return note;
  });

  app.delete("/notes/:id", async (request, reply) => {
    if (!config.workflow.resultNotesEnabled) {
      throw featureDisabled("Result notes");
    }

    const params = request.params as { id?: string };
    const noteId = params.id?.trim();

    if (!noteId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid note id", [
          { field: "id", message: "id is required" }
        ])
      );
    }

    const deleted = await persistence.searchRepository.deleteResultNote(noteId);
    if (!deleted) {
      return reply.status(404).send(
        buildErrorPayload("NOTE_NOT_FOUND", "No note was found for this id.")
      );
    }

    metrics.recordNoteDelete();
    return reply.status(204).send();
  });

  app.get("/workflow/activity", async (request) => {
    if (!config.workflow.shortlistsEnabled && !config.workflow.resultNotesEnabled) {
      throw featureDisabled("Workflow activity");
    }

    const query = request.query as Record<string, unknown> | undefined;
    const sessionId = extractSessionId(request);
    const limit = parseLimit(query, 12);
    const activity = await persistence.searchRepository.listWorkflowActivity(sessionId, limit);

    return {
      activity
    };
  });

  app.get("/collaboration/activity", async (request, reply) => {
    if (!config.workflow.sharedShortlistsEnabled) {
      throw featureDisabled("Collaboration activity");
    }

    const query = request.query as Record<string, unknown> | undefined;
    const shareId = typeof query?.shareId === "string" ? query.shareId : undefined;
    const shortlistId = typeof query?.shortlistId === "string" ? query.shortlistId : undefined;
    if (!shareId && !shortlistId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "shareId or shortlistId is required", [
          { field: "shareId", message: "Provide shareId or shortlistId" }
        ])
      );
    }

    const activity = await persistence.searchRepository.listCollaborationActivity({
      shareId,
      shortlistId,
      limit: parseLimit(query, 20)
    });
    metrics.recordCollaborationActivityRead();

    return {
      activity
    };
  });

  app.post("/search/definitions/:id/rerun", async (request, reply) => {
    const params = request.params as { id?: string };
    const definitionId = params.id?.trim();
    const payload = rerunRequestSchema.parse(request.body ?? {});

    if (!definitionId) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid definition id",
          details: [{ field: "id", message: "id is required" }]
        }
      });
    }

    const definition = await persistence.searchRepository.getSearchDefinition(definitionId);
    if (!definition) {
      return reply.status(404).send({
        error: {
          code: "SEARCH_DEFINITION_NOT_FOUND",
          message: "No saved search definition was found for this id.",
          details: []
        }
      });
    }

    const sessionId = extractSessionId(request, payload.sessionId ?? definition.sessionId);
    const response = await runSearch(definition.request, {
      geocoder: providers.geocoder,
      listingProvider: providers.listings,
      marketSnapshotRepository: persistence.marketSnapshotRepository,
      metrics,
      repository: persistence.searchRepository,
      safetyProvider: providers.safety,
      getProviderFreshnessHours: () => providers.getFreshnessHours()
    }, {
      sessionId,
      searchDefinitionId: definition.id,
      rerunSourceType: "definition",
      rerunSourceId: definition.id
    });

    await persistence.searchRepository.updateSearchDefinition(definition.id, {
      lastRunAt: new Date().toISOString()
    });

    if (payload.createSnapshot) {
      const snapshot = await persistence.searchRepository.createSearchSnapshot({
        request: definition.request,
        response,
        sessionId,
        searchDefinitionId: definition.id,
        historyRecordId: response.metadata.historyRecordId ?? null
      });
      response.metadata.rerunResultMetadata = {
        ...(response.metadata.rerunResultMetadata ?? {
          sourceType: "definition",
          sourceId: definition.id,
          executedAt: new Date().toISOString(),
          historyRecordId: response.metadata.historyRecordId ?? null,
          snapshotId: null,
          freshResult: true as const
        }),
        snapshotId: snapshot.id
      };
      metrics.recordSnapshotCreated();
    }

    metrics.recordSearchRerun();
    if (config.validation.enabled) {
      await persistence.searchRepository.recordValidationEvent({
        eventName: "rerun_executed",
        sessionId,
        historyRecordId: response.metadata.historyRecordId ?? null,
        searchDefinitionId: definition.id,
        payload: {
          sourceType: "definition",
          sourceId: definition.id
        }
      });
    }
    return reply.status(200).send(response);
  });

  app.post("/search/history/:id/rerun", async (request, reply) => {
    const params = request.params as { id?: string };
    const historyId = params.id?.trim();
    const payload = rerunRequestSchema.parse(request.body ?? {});

    if (!historyId) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid history id",
          details: [{ field: "id", message: "id is required" }]
        }
      });
    }

    const historyRecord = await persistence.searchRepository.getSearchHistory(historyId);
    if (!historyRecord) {
      return reply.status(404).send({
        error: {
          code: "SEARCH_HISTORY_NOT_FOUND",
          message: "No stored search history record was found for this id.",
          details: []
        }
      });
    }

    const sessionId = extractSessionId(request, payload.sessionId ?? historyRecord.sessionId);
    const response = await runSearch(historyRecord.request, {
      geocoder: providers.geocoder,
      listingProvider: providers.listings,
      marketSnapshotRepository: persistence.marketSnapshotRepository,
      metrics,
      repository: persistence.searchRepository,
      safetyProvider: providers.safety,
      getProviderFreshnessHours: () => providers.getFreshnessHours()
    }, {
      sessionId,
      searchDefinitionId: historyRecord.searchDefinitionId ?? null,
      rerunSourceType: "history",
      rerunSourceId: historyRecord.id
    });

    if (payload.createSnapshot) {
      const snapshot = await persistence.searchRepository.createSearchSnapshot({
        request: historyRecord.request,
        response,
        sessionId,
        searchDefinitionId: historyRecord.searchDefinitionId ?? null,
        historyRecordId: response.metadata.historyRecordId ?? null
      });
      response.metadata.rerunResultMetadata = {
        ...(response.metadata.rerunResultMetadata ?? {
          sourceType: "history",
          sourceId: historyRecord.id,
          executedAt: new Date().toISOString(),
          historyRecordId: response.metadata.historyRecordId ?? null,
          snapshotId: null,
          freshResult: true as const
        }),
        snapshotId: snapshot.id
      };
      metrics.recordSnapshotCreated();
    }

    metrics.recordSearchRerun();
    if (config.validation.enabled) {
      await persistence.searchRepository.recordValidationEvent({
        eventName: "rerun_executed",
        sessionId,
        historyRecordId: response.metadata.historyRecordId ?? null,
        searchDefinitionId: historyRecord.searchDefinitionId ?? null,
        payload: {
          sourceType: "history",
          sourceId: historyRecord.id
        }
      });
    }
    return reply.status(200).send(response);
  });

  app.get("/", async () => ({
    name: "Nhalo API",
    version: "0.1.0"
  }));

  return app;
}
