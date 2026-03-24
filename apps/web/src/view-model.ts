import type { PropertyType, ScoredHome } from "@nhalo/types";

export type ResultSortMode =
  | "server"
  | "highest_nhalo"
  | "lowest_price"
  | "highest_safety"
  | "largest_size"
  | "closest_distance";

export interface ResultControlsState {
  sortMode: ResultSortMode;
  confidence: "all" | "high" | "medium" | "low" | "none";
  propertyType: "all" | PropertyType;
}

export const DEFAULT_RESULT_CONTROLS: ResultControlsState = {
  sortMode: "server",
  confidence: "all",
  propertyType: "all"
};

export function applyResultControls(
  homes: ScoredHome[],
  controls: ResultControlsState
): ScoredHome[] {
  const filtered = homes.filter((home) => {
    if (
      controls.confidence !== "all" &&
      home.scores.overallConfidence !== controls.confidence
    ) {
      return false;
    }

    if (controls.propertyType !== "all" && home.propertyType !== controls.propertyType) {
      return false;
    }

    return true;
  });

  const sorted = [...filtered];

  sorted.sort((left, right) => {
    if (controls.sortMode === "lowest_price" && left.price !== right.price) {
      return left.price - right.price;
    }
    if (controls.sortMode === "highest_safety" && left.scores.safety !== right.scores.safety) {
      return right.scores.safety - left.scores.safety;
    }
    if (controls.sortMode === "largest_size" && left.sqft !== right.sqft) {
      return right.sqft - left.sqft;
    }
    if (
      controls.sortMode === "highest_nhalo" &&
      left.scores.nhalo !== right.scores.nhalo
    ) {
      return right.scores.nhalo - left.scores.nhalo;
    }
    if (
      controls.sortMode === "closest_distance" &&
      (left.distanceMiles ?? Number.POSITIVE_INFINITY) !==
        (right.distanceMiles ?? Number.POSITIVE_INFINITY)
    ) {
      return (left.distanceMiles ?? Number.POSITIVE_INFINITY) - (right.distanceMiles ?? Number.POSITIVE_INFINITY);
    }
    if (controls.sortMode !== "server" && left.scores.nhalo !== right.scores.nhalo) {
      return right.scores.nhalo - left.scores.nhalo;
    }

    return (left.canonicalPropertyId ?? left.id).localeCompare(
      right.canonicalPropertyId ?? right.id
    );
  });

  return sorted;
}

export function toggleComparisonSelection(selected: string[], homeId: string): string[] {
  if (selected.includes(homeId)) {
    return selected.filter((id) => id !== homeId);
  }

  if (selected.length >= 3) {
    return [...selected.slice(1), homeId];
  }

  return [...selected, homeId];
}

export function sourceFreshnessLabel(source?: string | null): "Fresh" | "Stale" | "Mock" | "Unavailable" {
  if (source === "live" || source === "cached_live") {
    return "Fresh";
  }
  if (source === "stale_cached_live") {
    return "Stale";
  }
  if (source === "mock") {
    return "Mock";
  }

  return "Unavailable";
}
