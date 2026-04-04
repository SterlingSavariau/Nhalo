// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { DecisionRationaleEditor } from "./DecisionRationaleEditor";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("DecisionRationaleEditor", () => {
  it("saves updated rationale and confidence through the shared callback", async () => {
    const onSave = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(
          <DecisionRationaleEditor
            item={{
              id: "item-1",
              shortlistId: "shortlist-1",
              canonicalPropertyId: "canonical-1",
              sourceSnapshotId: null,
              sourceHistoryId: null,
              sourceSearchDefinitionId: null,
              reviewState: "interested",
              choiceStatus: "backup",
              selectionRank: 2,
              decisionConfidence: "medium",
              decisionRationale: "Keep this in reserve.",
              decisionRisks: [],
              lastDecisionReviewedAt: "2026-04-03T12:00:00.000Z",
              selectedAt: null,
              statusChangedAt: "2026-04-03T12:00:00.000Z",
              replacedByShortlistItemId: null,
              droppedReason: null,
              addedAt: "2026-04-03T12:00:00.000Z",
              updatedAt: "2026-04-03T12:00:00.000Z",
              capturedHome: {
                id: "home-1",
                canonicalPropertyId: "canonical-1",
                address: "456 Backup Ave",
                city: "Southfield",
                state: "MI",
                zipCode: "48075",
                propertyType: "single_family",
                price: 372000,
                sqft: 2050,
                bedrooms: 4,
                bathrooms: 2.5,
                distanceMiles: 2.8,
                insideRequestedRadius: true,
                qualityFlags: [],
                strengths: [],
                risks: [],
                confidenceReasons: [],
                explainability: null,
                provenance: {
                  listingDataSource: "live",
                  listingProvider: "ListingProvider",
                  listingFetchedAt: null,
                  sourceListingId: "source-2",
                  safetyDataSource: "cached_live",
                  crimeProvider: "CrimeProvider",
                  schoolProvider: "SchoolProvider",
                  crimeFetchedAt: null,
                  schoolFetchedAt: null,
                  geocodeDataSource: "live",
                  geocodeProvider: "GeocoderProvider",
                  geocodeFetchedAt: null,
                  geocodePrecision: "rooftop"
                },
                neighborhoodSafetyScore: 80,
                explanation: "Fallback home",
                scores: {
                  price: 75,
                  size: 76,
                  safety: 80,
                  nhalo: 75,
                  safetyConfidence: "high",
                  overallConfidence: "high",
                  formulaVersion: "nhalo-v1"
                }
              }
            }}
            onSave={onSave}
          />
        );
      });

      const editButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "Edit rationale"
      );
      expect(editButton).toBeTruthy();

      await act(async () => {
        editButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      const textarea = container.querySelector("textarea");
      expect(textarea).toBeTruthy();

      await act(async () => {
        if (textarea instanceof HTMLTextAreaElement) {
          const valueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            "value"
          )?.set;
          valueSetter?.call(textarea, "Use this as the first backup if the primary deal stalls.");
          textarea.dispatchEvent(new Event("input", { bubbles: true }));
          textarea.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });

      const select = container.querySelector("select");
      expect(select).toBeTruthy();

      await act(async () => {
        if (select instanceof HTMLSelectElement) {
          select.value = "high";
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });

      const saveButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "Save rationale"
      );
      expect(saveButton).toBeTruthy();

      await act(async () => {
        saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          decisionRationale: "Use this as the first backup if the primary deal stalls.",
          decisionConfidence: "high",
          lastDecisionReviewedAt: expect.any(String)
        })
      );
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });
});
