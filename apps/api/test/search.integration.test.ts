import { InMemorySearchRepository } from "@nhalo/db";
import { createMockProviders } from "@nhalo/providers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";

describe("POST /search", () => {
  const repository = new InMemorySearchRepository();
  const providers = createMockProviders();
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({
      repository,
      providers
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns ranked homes with applied filters and metadata", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/search",
      payload: {
        locationType: "city",
        locationValue: "Southfield, MI",
        radiusMiles: 5,
        budget: {
          max: 425000
        },
        minSqft: 1800,
        minBedrooms: 3
      }
    });

    expect(response.statusCode).toBe(200);

    const payload = response.json();

    expect(payload.homes.length).toBeGreaterThan(0);
    expect(payload.appliedWeights).toEqual({
      price: 40,
      size: 30,
      safety: 30
    });
    expect(payload.metadata.totalCandidatesScanned).toBeGreaterThanOrEqual(payload.metadata.totalMatched);
    expect(payload.homes[0].scores.nhalo).toBeGreaterThanOrEqual(payload.homes.at(-1).scores.nhalo);
  });
});
