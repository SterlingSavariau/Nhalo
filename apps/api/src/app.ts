import cors from "@fastify/cors";
import { getConfig } from "@nhalo/config";
import { createSearchRepository } from "@nhalo/db";
import { createMockProviders } from "@nhalo/providers";
import type { ProviderStatus, SearchRepository } from "@nhalo/types";
import Fastify from "fastify";
import { ZodError } from "zod";
import { isApiError } from "./errors";
import { searchRequestSchema } from "./search-schema";
import { runSearch } from "./search-service";

export interface AppDependencies {
  repository: SearchRepository;
  providers: ReturnType<typeof createMockProviders>;
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
  const repository =
    dependencies?.repository ?? (await createSearchRepository(config.databaseUrl));
  const providers = dependencies?.providers ?? createMockProviders();
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
    const statuses: ProviderStatus[] = await Promise.all([
      providers.geocoder.getStatus(),
      providers.listings.getStatus(),
      providers.safety.getStatus()
    ]);

    return {
      providers: statuses
    };
  });

  app.post("/search", async (request) => {
    const payload = searchRequestSchema.parse(request.body);
    return runSearch(payload, {
      geocoder: providers.geocoder,
      listingProvider: providers.listings,
      repository,
      safetyProvider: providers.safety
    });
  });

  app.get("/", async () => ({
    name: "Nhalo API",
    version: "0.1.0"
  }));

  return app;
}
