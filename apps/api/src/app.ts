import cors from "@fastify/cors";
import { getConfig } from "@nhalo/config";
import { createPersistenceLayer } from "@nhalo/db";
import { createMockProviders, createProviders } from "@nhalo/providers";
import type {
  MarketSnapshotRepository,
  ProviderStatus,
  SafetySignalCacheRepository,
  SearchRepository
} from "@nhalo/types";
import Fastify from "fastify";
import { ZodError } from "zod";
import { isApiError } from "./errors";
import { MetricsCollector } from "./metrics";
import { instrumentProviders } from "./provider-runtime";
import { searchRequestSchema } from "./search-schema";
import { runSearch } from "./search-service";

export interface AppDependencies {
  repository: SearchRepository;
  marketSnapshotRepository: MarketSnapshotRepository;
  safetySignalCacheRepository: SafetySignalCacheRepository;
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
    dependencies?.safetySignalCacheRepository
      ? {
          searchRepository: dependencies.repository,
          marketSnapshotRepository: dependencies.marketSnapshotRepository,
          safetySignalCacheRepository: dependencies.safetySignalCacheRepository
        }
      : await createPersistenceLayer(config.databaseUrl);
  const metrics = dependencies?.metrics ?? new MetricsCollector();
  const providers = instrumentProviders(
    dependencies?.providers ??
      createProviders({
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

    return auditRecord;
  });

  app.get("/metrics", async () => metrics.snapshot());

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

  app.get("/", async () => ({
    name: "Nhalo API",
    version: "0.1.0"
  }));

  return app;
}
