import { describe, expect, it } from "vitest";
import type { ShortlistItem } from "@nhalo/types";
import {
  getOrderedBackupItemIds,
  moveBackupItemId
} from "./useShortlistDecisionActions";

const baseItem = {
  sourceSnapshotId: null,
  sourceHistoryId: null,
  sourceSearchDefinitionId: null,
  reviewState: "interested" as const,
  decisionConfidence: null,
  decisionRationale: null,
  decisionRisks: [],
  lastDecisionReviewedAt: null,
  selectedAt: null,
  statusChangedAt: "2026-04-03T12:00:00.000Z",
  replacedByShortlistItemId: null,
  droppedReason: null,
  addedAt: "2026-04-03T12:00:00.000Z",
  updatedAt: "2026-04-03T12:00:00.000Z",
  capturedHome: {
    id: "home",
    canonicalPropertyId: "canonical",
    address: "123 Test St",
    city: "Southfield",
    state: "MI",
    zipCode: "48075",
    propertyType: "single_family" as const,
    price: 385000,
    sqft: 2100,
    bedrooms: 4,
    bathrooms: 3,
    distanceMiles: 2.1,
    insideRequestedRadius: true,
    qualityFlags: [],
    strengths: [],
    risks: [],
    confidenceReasons: [],
    explainability: null,
    provenance: {
      listingDataSource: "live" as const,
      listingProvider: "ListingProvider",
      listingFetchedAt: null,
      sourceListingId: "src-1",
      safetyDataSource: "cached_live" as const,
      crimeProvider: "CrimeProvider",
      schoolProvider: "SchoolProvider",
      crimeFetchedAt: null,
      schoolFetchedAt: null,
      geocodeDataSource: "live" as const,
      geocodeProvider: "GeocoderProvider",
      geocodeFetchedAt: null,
      geocodePrecision: "rooftop" as const
    },
    neighborhoodSafetyScore: 84,
    explanation: "Strong fit",
    scores: {
      price: 71,
      size: 78,
      safety: 84,
      nhalo: 77,
      safetyConfidence: "high" as const,
      overallConfidence: "high" as const,
      formulaVersion: "nhalo-v1"
    }
  }
};

function makeItem(
  id: string,
  shortlistId: string,
  choiceStatus: ShortlistItem["choiceStatus"],
  selectionRank: number | null
): ShortlistItem {
  return {
    ...baseItem,
    id,
    shortlistId,
    canonicalPropertyId: `canonical-${id}`,
    choiceStatus,
    selectionRank,
    capturedHome: {
      ...baseItem.capturedHome,
      id: `home-${id}`,
      canonicalPropertyId: `canonical-${id}`,
      address: `${id} Main St`
    }
  };
}

describe("useShortlistDecisionActions helpers", () => {
  it("orders backups by selection rank for one shortlist", () => {
    const items: ShortlistItem[] = [
      makeItem("selected-1", "shortlist-1", "selected", 1),
      makeItem("backup-2", "shortlist-1", "backup", 3),
      makeItem("backup-1", "shortlist-1", "backup", 2),
      makeItem("backup-other", "shortlist-2", "backup", 2),
      makeItem("candidate-1", "shortlist-1", "candidate", null)
    ];

    expect(getOrderedBackupItemIds(items, "shortlist-1")).toEqual(["backup-1", "backup-2"]);
  });

  it("swaps backup ids predictably and blocks impossible moves", () => {
    expect(moveBackupItemId(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveBackupItemId(["a", "b", "c"], "b", "down")).toEqual(["a", "c", "b"]);
    expect(moveBackupItemId(["a", "b", "c"], "a", "up")).toBeNull();
    expect(moveBackupItemId(["a", "b", "c"], "c", "down")).toBeNull();
    expect(moveBackupItemId(["a", "b", "c"], "missing", "down")).toBeNull();
  });
});
