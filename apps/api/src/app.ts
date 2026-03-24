import cors from "@fastify/cors";
import { getConfig } from "@nhalo/config";
import { createPersistenceLayer } from "@nhalo/db";
import { createMockProviders, createProviders } from "@nhalo/providers";
import type {
  GeocodeCacheRepository,
  ListingCacheRepository,
  MarketSnapshotRepository,
  ProviderStatus,
  SafetySignalCacheRepository,
  SearchRepository
} from "@nhalo/types";
import Fastify from "fastify";
import { ZodError, z } from "zod";
import { isApiError } from "./errors";
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
    "recent_activity_panel_view"
  ])
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

export interface AppDependencies {
  repository: SearchRepository;
  marketSnapshotRepository: MarketSnapshotRepository;
  safetySignalCacheRepository: SafetySignalCacheRepository;
  listingCacheRepository: ListingCacheRepository;
  geocodeCacheRepository: GeocodeCacheRepository;
  providers: ReturnType<typeof createMockProviders>;
  metrics: MetricsCollector;
}

function formatValidationError(error: ZodError) {
  return {
    error: {
      code: "VALIDATION_ERROR",
      message: "Invalid search request",
      details: error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message
      }))
    }
  };
}

export async function buildApp(dependencies?: Partial<AppDependencies>) {
  const config = getConfig();
  const persistence =
    dependencies?.repository &&
    dependencies?.marketSnapshotRepository &&
    dependencies?.safetySignalCacheRepository &&
    dependencies?.listingCacheRepository &&
    dependencies?.geocodeCacheRepository
      ? {
          searchRepository: dependencies.repository,
          marketSnapshotRepository: dependencies.marketSnapshotRepository,
          safetySignalCacheRepository: dependencies.safetySignalCacheRepository,
          listingCacheRepository: dependencies.listingCacheRepository,
          geocodeCacheRepository: dependencies.geocodeCacheRepository
        }
      : await createPersistenceLayer(config.databaseUrl);
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
  const app = Fastify({ logger: false });

  await app.register(cors, {
    origin: true
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send(formatValidationError(error));
    }

    if (isApiError(error)) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? []
        }
      });
    }

    return reply.status(500).send({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Unexpected server error",
        details: []
      }
    });
  });

  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString()
  }));

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

    return reply.status(202).send({ status: "accepted" });
  });

  app.post("/search", async (request) => {
    const payload = searchRequestSchema.parse(request.body);
    const sessionId = extractSessionId(request);
    return runSearch(payload, {
      geocoder: providers.geocoder,
      listingProvider: providers.listings,
      marketSnapshotRepository: persistence.marketSnapshotRepository,
      metrics,
      repository: persistence.searchRepository,
      safetyProvider: providers.safety,
      getProviderFreshnessHours: () => providers.getFreshnessHours()
    }, {
      sessionId
    });
  });

  app.post("/search/snapshots", async (request, reply) => {
    const payload = searchSnapshotPayloadSchema.parse(request.body);
    const snapshot = await persistence.searchRepository.createSearchSnapshot({
      ...payload,
      sessionId: extractSessionId(request, payload.sessionId ?? null)
    });
    metrics.recordSnapshotCreated();

    return reply.status(201).send(snapshot);
  });

  app.get("/search/snapshots", async (request) => {
    const query = request.query as Record<string, unknown> | undefined;
    const sessionId = extractSessionId(request);
    const limit = parseLimit(query);
    const snapshots = await persistence.searchRepository.listSearchSnapshots(sessionId, limit);
    metrics.recordSnapshotRead();

    return {
      snapshots
    };
  });

  app.get("/search/snapshots/:id", async (request, reply) => {
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
    return snapshot;
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
    return reply.status(200).send(response);
  });

  app.get("/", async () => ({
    name: "Nhalo API",
    version: "0.1.0"
  }));

  return app;
}
