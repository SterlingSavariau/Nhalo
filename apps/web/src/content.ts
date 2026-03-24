import type {
  GeocodePrecision,
  ListingRejectionSummary,
  ScoredHome,
  SearchRequest,
  SearchResponse
} from "@nhalo/types";

export const ONBOARDING_CONTENT = {
  title: "How Nhalo helps a family choose a home",
  sections: [
    {
      heading: "What Nhalo does",
      body:
        "Nhalo ranks homes for a family decision, not for browsing. Every result is scored on price, size, and safety."
    },
    {
      heading: "How radius works",
      body:
        "Radius is measured from the resolved city, ZIP, or address point. More exact addresses usually give more exact distance filtering."
    },
    {
      heading: "How to trust the result",
      body:
        "Confidence and provenance show whether data was fresh, cached, stale, mock, or partial. Lower confidence means you should read the tradeoffs more carefully."
    },
    {
      heading: "Saved work in this phase",
      body:
        "Saved searches, history, and snapshots are tied to this browser session or local device. They are not account-based yet."
    }
  ]
} as const;

export const SEARCH_FORM_COPY = {
  locationType: "Choose the area anchor for the search.",
  locationValue: {
    city: {
      label: "City",
      placeholder: "Southfield, MI",
      helper: "Use a city and state when you want a broad family-home search area."
    },
    zip: {
      label: "ZIP code",
      placeholder: "48075",
      helper: "Use ZIP when you already know the neighborhood area you want to center on."
    },
    address: {
      label: "Address",
      placeholder: "123 Main St, Southfield, MI",
      helper: "Address search uses the exact geocoded point, so a small radius can narrow results quickly."
    }
  },
  radius:
    "Default is 5 miles. Wider radius usually finds more homes and more comparable data.",
  budget: "Set a hard maximum if affordability is non-negotiable.",
  sqft: "Use minimum square footage to reflect the smallest space your family can live with.",
  bedrooms: "Use minimum bedrooms as a hard family constraint.",
  weights: {
    price: "Price affects affordability and value.",
    size: "Size affects usable family space.",
    safety: "Safety affects neighborhood and school context."
  }
} as const;

export const RESULT_COPY = {
  whyThisHome: "Why this home",
  tradeoffs: "Family tradeoffs",
  concerns: "What may concern a family",
  confidence: "Data confidence",
  originPrecision: "Search origin precision",
  detailTitle: "Home detail"
} as const;

export function geocodePrecisionExplanation(precision: GeocodePrecision): string {
  switch (precision) {
    case "rooftop":
      return "Exact address point.";
    case "range_interpolated":
      return "Estimated street position.";
    case "approximate":
      return "Approximate area match.";
    case "centroid":
      return "Center point of the city or ZIP.";
    case "mock":
      return "Mock fallback geocode.";
    default:
      return "No resolved origin precision.";
  }
}

export function buildDecisionLabels(home: ScoredHome, homes: ScoredHome[]): string[] {
  const labels: string[] = [];
  const maxSafety = Math.max(...homes.map((item) => item.scores.safety));
  const maxSize = Math.max(...homes.map((item) => item.scores.size));
  const maxPrice = Math.max(...homes.map((item) => item.scores.price));
  const minDistance = Math.min(...homes.map((item) => item.distanceMiles ?? Number.POSITIVE_INFINITY));
  const confidenceRank = { none: 0, low: 1, medium: 2, high: 3 };
  const minConfidence = Math.min(...homes.map((item) => confidenceRank[item.scores.overallConfidence]));

  if (home.scores.safety === maxSafety && maxSafety >= 70) {
    labels.push("Best for safety");
  }
  if (home.scores.size === maxSize && maxSize >= 70) {
    labels.push("Best for space");
  }
  if (home.scores.price === maxPrice && maxPrice >= 70) {
    labels.push("Best value");
  }
  if ((home.distanceMiles ?? Number.POSITIVE_INFINITY) === minDistance) {
    labels.push("Closest option");
  }
  if (confidenceRank[home.scores.overallConfidence] === minConfidence) {
    labels.push("Lowest confidence");
  }
  if (
    home.scores.overallConfidence === "low" ||
    home.scores.overallConfidence === "none" ||
    (home.qualityFlags ?? []).includes("mockFallbackUsed")
  ) {
    labels.push("Needs caution");
  }

  return [...new Set(labels)];
}

export function buildTradeoffSummary(home: ScoredHome): string {
  const { price, size, safety, overallConfidence } = home.scores;

  if (size - safety >= 15 && size >= price) {
    return "More space, weaker safety";
  }
  if (safety - size >= 15) {
    return "Safer area, smaller home";
  }
  if (price >= 75 && overallConfidence !== "high") {
    return "Strong value, moderate confidence";
  }
  if (price - size >= 15) {
    return "Better value, tighter space";
  }
  if (overallConfidence === "low" || overallConfidence === "none") {
    return "Balanced result, lower confidence";
  }

  return "Balanced space, price, and safety";
}

export function buildEmptyStateSuggestions(response: SearchResponse): Array<{
  code: string;
  label: string;
  detail: string;
  patch?: Partial<SearchRequest>;
}> {
  const suggestions: Array<{
    code: string;
    label: string;
    detail: string;
    patch?: Partial<SearchRequest>;
  }> = [];
  const rejection = response.metadata.rejectionSummary;

  if (!rejection) {
    return suggestions;
  }

  if (rejection.outsideRadius > 0) {
    suggestions.push({
      code: "radius",
      label: "Increase radius",
      detail: "More homes were nearby but just outside the requested radius.",
      patch: {
        radiusMiles: (response.appliedFilters.radiusMiles ?? 5) + 3
      }
    });
  }

  if (rejection.aboveBudget > 0 && typeof response.appliedFilters.budget?.max === "number") {
    suggestions.push({
      code: "budget",
      label: "Raise budget",
      detail: "Several homes were filtered out for being above the current budget cap.",
      patch: {
        budget: {
          ...response.appliedFilters.budget,
          max: response.appliedFilters.budget.max + 50000
        }
      }
    });
  }

  if (rejection.belowSqft > 0 && typeof response.appliedFilters.minSqft === "number") {
    suggestions.push({
      code: "sqft",
      label: "Lower min sqft",
      detail: "Many nearby homes were smaller than the current space requirement.",
      patch: {
        minSqft: Math.max(500, response.appliedFilters.minSqft - 250)
      }
    });
  }

  if (rejection.wrongPropertyType > 0) {
    suggestions.push({
      code: "propertyTypes",
      label: "Allow more property types",
      detail: "More homes exist nearby if you broaden the home type filter.",
      patch: {
        propertyTypes: ["single_family", "condo", "townhome"]
      }
    });
  }

  if (response.appliedFilters.locationType === "address") {
    suggestions.push({
      code: "cityInstead",
      label: "Try city instead of address",
      detail: "Address-based search can narrow the radius too tightly for first-pass exploration.",
      patch: {
        locationType: "city"
      }
    });
  }

  return suggestions;
}
