import { InMemoryMarketSnapshotRepository } from "@nhalo/db";
import { describe, expect, it } from "vitest";

describe("InMemoryMarketSnapshotRepository", () => {
  it("reports snapshot freshness correctly", async () => {
    const repository = new InMemoryMarketSnapshotRepository();
    const freshSnapshot = await repository.createSnapshot({
      location: "city:southfield, mi",
      radiusMiles: 5,
      medianPricePerSqft: 180,
      sampleSize: 8,
      createdAt: new Date().toISOString()
    });
    const staleSnapshot = await repository.createSnapshot({
      location: "city:southfield, mi",
      radiusMiles: 5,
      medianPricePerSqft: 175,
      sampleSize: 7,
      createdAt: "2026-03-20T00:00:00.000Z"
    });

    expect(repository.isSnapshotFresh(freshSnapshot)).toBe(true);
    expect(repository.isSnapshotFresh(staleSnapshot, 24)).toBe(false);
  });

  it("returns the latest snapshot for a location and radius", async () => {
    const repository = new InMemoryMarketSnapshotRepository();

    await repository.createSnapshot({
      location: "city:southfield, mi",
      radiusMiles: 5,
      medianPricePerSqft: 175,
      sampleSize: 6,
      createdAt: "2026-03-21T00:00:00.000Z"
    });
    const latest = await repository.createSnapshot({
      location: "city:southfield, mi",
      radiusMiles: 5,
      medianPricePerSqft: 180,
      sampleSize: 8,
      createdAt: "2026-03-22T00:00:00.000Z"
    });

    expect(await repository.getLatestSnapshot("city:southfield, mi", 5)).toEqual(latest);
  });
});
