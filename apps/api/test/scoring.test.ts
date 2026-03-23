import { DEFAULT_WEIGHTS } from "@nhalo/config";
import { MOCK_LISTINGS, MOCK_SAFETY } from "@nhalo/providers";
import { rankListings } from "@nhalo/scoring";
import { describe, expect, it } from "vitest";

describe("rankListings", () => {
  it("produces explainable 0-100 scores and sorts by composite score", () => {
    const comparableListings = MOCK_LISTINGS.filter((listing) =>
      ["sf-001", "sf-002", "sf-004", "sf-005", "sf-006", "lh-001"].includes(listing.id)
    );
    const safetyByPropertyId = new Map(
      MOCK_SAFETY.filter((entry) => comparableListings.some((listing) => listing.id === entry.propertyId)).map(
        (entry) => [entry.propertyId, entry]
      )
    );

    const ranked = rankListings(comparableListings, {
      comparableListings,
      safetyByPropertyId,
      weights: DEFAULT_WEIGHTS,
      budget: { max: 425000 },
      minBedrooms: 3,
      minSqft: 1800
    });

    expect(ranked).toHaveLength(comparableListings.length);
    expect(ranked[0].scores.nhalo).toBeGreaterThanOrEqual(ranked[1].scores.nhalo);
    expect(ranked[0].scores.price).toBeGreaterThanOrEqual(0);
    expect(ranked[0].scores.price).toBeLessThanOrEqual(100);
    expect(ranked[0].scores.formulaVersion).toBe("nhalo-v1");
    expect(ranked[0].explanation.length).toBeGreaterThan(10);
  });

  it("reduces safety confidence when signals are missing", () => {
    const listing = {
      ...MOCK_LISTINGS[0],
      id: "custom-listing"
    };
    const comparableListings = [listing];
    const safetyByPropertyId = new Map([
      [
        listing.id,
        {
          propertyId: listing.id,
          crimeIndex: 25,
          source: "mock-safety",
          updatedAt: "2026-03-22T00:00:00.000Z"
        }
      ]
    ]);

    const ranked = rankListings(comparableListings, {
      comparableListings,
      safetyByPropertyId,
      weights: DEFAULT_WEIGHTS,
      budget: { max: 425000 }
    });

    expect(ranked[0].scores.safetyConfidence).toBe("low");
  });
});
