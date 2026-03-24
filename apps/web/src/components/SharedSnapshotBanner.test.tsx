import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SharedSnapshotBanner } from "./SharedSnapshotBanner";

describe("SharedSnapshotBanner", () => {
  it("renders a clear read-only shared snapshot warning", () => {
    const markup = renderToStaticMarkup(
      <SharedSnapshotBanner
        appName="Nhalo"
        sharedView={{
          share: {
            id: "share-1",
            shareId: "public-1",
            snapshotId: "snapshot-1",
            status: "active",
            createdAt: "2026-03-23T12:00:00.000Z",
            openCount: 3,
            sessionId: null,
            expiresAt: null,
            revokedAt: null
          },
          snapshot: {
            id: "snapshot-1",
            formulaVersion: "nhalo-v1",
            createdAt: "2026-03-23T12:00:00.000Z",
            request: {
              locationType: "city",
              locationValue: "Southfield, MI",
              radiusMiles: 5,
              budget: { max: 425000 },
              minSqft: 1800,
              minBedrooms: 3,
              propertyTypes: ["single_family", "condo", "townhome"],
              preferences: [],
              weights: { price: 40, size: 30, safety: 30 }
            },
            response: {
              homes: [],
              appliedFilters: {
                locationType: "city",
                locationValue: "Southfield, MI",
                radiusMiles: 5,
                budget: { max: 425000 },
                minSqft: 1800,
                minBedrooms: 3,
                propertyTypes: ["single_family", "condo", "townhome"],
                preferences: []
              },
              appliedWeights: { price: 40, size: 30, safety: 30 },
              metadata: {
                totalCandidatesScanned: 0,
                totalMatched: 0,
                returnedCount: 0,
                durationMs: 10,
                warnings: [],
                suggestions: []
              }
            }
          }
        }}
        tagline="Find homes your family can afford, live in, and feel safe in."
      />
    );

    expect(markup).toContain("Read-only shared result set");
    expect(markup).toContain("does not rerun the search");
  });
});
