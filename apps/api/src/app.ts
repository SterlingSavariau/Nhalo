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
  eventType: z.enum(["comparison_view", "explainability_render"])
});

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

    return reply.status(202).send({ status: "accepted" });
  });

  app.post("/search", async (request) => {
    const payload = searchRequestSchema.parse(request.body);
    return runSearch(payload, {
      geocoder: providers.geocoder,
      listingProvider: providers.listings,
      marketSnapshotRepository: persistence.marketSnapshotRepository,
      metrics,
      repository: persistence.searchRepository,
      safetyProvider: providers.safety,
      getProviderFreshnessHours: () => providers.getFreshnessHours()
    });
  });

  app.post("/search/snapshots", async (request, reply) => {
    const payload = searchSnapshotPayloadSchema.parse(request.body);
    const snapshot = await persistence.searchRepository.createSearchSnapshot(payload);
    metrics.recordSnapshotCreated();

    return reply.status(201).send(snapshot);
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

  app.get("/", async () => ({
    name: "Nhalo API",
    version: "0.1.0"
  }));

  return app;
}
