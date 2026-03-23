import { InMemoryMarketSnapshotRepository, InMemorySearchRepository } from "@nhalo/db";
import { createMockProviders } from "@nhalo/providers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { MetricsCollector } from "../src/metrics";

describe("validation errors", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({
      marketSnapshotRepository: new InMemoryMarketSnapshotRepository(),
      metrics: new MetricsCollector(),
      repository: new InMemorySearchRepository(),
      providers: createMockProviders()
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns a consistent validation payload when weights are invalid", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/search",
      payload: {
        locationType: "city",
        locationValue: "Southfield, MI",
        weights: {
          price: 70,
          size: 20,
          safety: 20
        }
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid search request",
        details: [
          {
            field: "weights",
            message: "weights must be non-negative and sum to 100"
          }
        ]
      }
    });
  });
});
