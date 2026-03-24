import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RecentActivityPanel } from "./RecentActivityPanel";

describe("RecentActivityPanel", () => {
  it("renders saved searches, recent searches, and recent snapshots distinctly", () => {
    const markup = renderToStaticMarkup(
      <RecentActivityPanel
        currentRequest={{
          locationType: "city",
          locationValue: "Southfield, MI",
          radiusMiles: 5,
          budget: { max: 425000 },
          minSqft: 1800,
          minBedrooms: 3,
          propertyTypes: ["single_family", "condo", "townhome"],
          preferences: [],
          weights: { price: 40, size: 30, safety: 30 }
        }}
        definitions={[
          {
            id: "definition-1",
            sessionId: "session-1",
            label: "Saved Southfield",
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
            pinned: true,
            createdAt: "2026-03-23T00:00:00.000Z",
            updatedAt: "2026-03-23T00:00:00.000Z",
            lastRunAt: "2026-03-23T00:00:00.000Z"
          }
        ]}
        history={[
          {
            id: "history-1",
            sessionId: "session-1",
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
            resolvedOriginSummary: {
              resolvedFormattedAddress: "Southfield, MI",
              latitude: 0,
              longitude: 0,
              precision: "centroid"
            },
            summaryMetadata: {
              returnedCount: 5,
              totalMatched: 5,
              durationMs: 45,
              warnings: [],
              suggestions: []
            },
            snapshotId: "snapshot-1",
            searchDefinitionId: "definition-1",
            rerunSourceType: null,
            rerunSourceId: null,
            createdAt: "2026-03-23T00:00:00.000Z"
          }
        ]}
        onDeleteDefinition={vi.fn()}
        onOpenSnapshot={vi.fn()}
        onRestore={vi.fn()}
        onRerunDefinition={vi.fn()}
        onRerunHistory={vi.fn()}
        onSaveDefinition={vi.fn()}
        onSaveLabelChange={vi.fn()}
        onTogglePinned={vi.fn()}
        saveLabel="Saved Southfield"
        savingDefinition={false}
        snapshots={[
          {
            id: "snapshot-1",
            formulaVersion: "nhalo-v1",
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
                totalCandidatesScanned: 5,
                totalMatched: 5,
                returnedCount: 5,
                durationMs: 45,
                warnings: [],
                suggestions: []
              }
            },
            sessionId: "session-1",
            searchDefinitionId: "definition-1",
            historyRecordId: "history-1",
            createdAt: "2026-03-23T00:00:00.000Z"
          }
        ]}
      />
    );

    expect(markup).toContain("Saved Searches");
    expect(markup).toContain("Recent Searches");
    expect(markup).toContain("Recent Snapshots");
    expect(markup).toContain("Restore");
    expect(markup).toContain("Rerun");
    expect(markup).toContain("Open snapshot");
  });
});
