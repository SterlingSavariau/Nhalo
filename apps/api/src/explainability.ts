import type {
  ExplainabilityPayload,
  GeocodePrecision,
  GeocodeDataSource,
  ListingDataSource,
  ResultProvenance,
  SafetyDataSource,
  ScoredHome,
  ScoreBreakdown
} from "@nhalo/types";

type ScoreKey = "price" | "size" | "safety";

const SCORE_LABELS: Record<ScoreKey, { subject: string; strength: string; risk: string }> = {
  price: {
    subject: "value",
    strength: "Budget-friendly pricing relative to nearby options",
    risk: "Price is less favorable than nearby alternatives"
  },
  size: {
    subject: "space",
    strength: "Above-average space for the budget",
    risk: "Less functional space than nearby alternatives"
  },
  safety: {
    subject: "neighborhood safety",
    strength: "Strong neighborhood safety",
    risk: "Neighborhood safety is weaker than nearby alternatives"
  }
};

function orderedDrivers(scores: ScoreBreakdown): Array<{ key: ScoreKey; score: number }> {
  return [
    { key: "price", score: scores.price },
    { key: "size", score: scores.size },
    { key: "safety", score: scores.safety }
  ].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.key.localeCompare(right.key) as -1 | 0 | 1;
  });
}

function scoreDescriptor(score: number): "Strong" | "Solid" | "Moderate" | "Limited" {
  if (score >= 80) {
    return "Strong";
  }
  if (score >= 65) {
    return "Solid";
  }
  if (score >= 50) {
    return "Moderate";
  }

  return "Limited";
}

function addUnique(target: string[], value: string): void {
  if (!target.includes(value)) {
    target.push(value);
  }
}

export function buildConfidenceReasons(args: {
  qualityFlags?: string[];
  scores: ScoreBreakdown;
  provenance: ResultProvenance;
}): string[] {
  const reasons: string[] = [];
  const flags = new Set(args.qualityFlags ?? []);

  if (args.scores.overallConfidence === "none") {
    addUnique(reasons, "Confidence is unavailable because core supporting data is missing.");
  }
  if (flags.has("staleListingData")) {
    addUnique(reasons, "Listing data came from stale cache.");
  }
  if (flags.has("staleSafetyData")) {
    addUnique(reasons, "Safety data came from stale cache.");
  }
  if (flags.has("approximateSearchOrigin")) {
    addUnique(reasons, "Search origin was resolved with approximate geocoding.");
  }
  if (flags.has("partialSafetyData")) {
    addUnique(reasons, "Safety score used partial signal coverage.");
  }
  if (flags.has("limitedComparables")) {
    addUnique(reasons, "Comparable homes nearby were limited.");
  }
  if (flags.has("mockFallbackUsed")) {
    addUnique(reasons, "At least one provider fell back to mock data.");
  }

  if (
    reasons.length === 0 &&
    (args.provenance.listingDataSource === "mock" ||
      args.provenance.safetyDataSource === "mock" ||
      args.provenance.geocodeDataSource === "mock")
  ) {
    addUnique(reasons, "Some supporting data came from mock fallback sources.");
  }

  if (reasons.length === 0 && args.scores.overallConfidence === "low") {
    addUnique(reasons, "Overall confidence is reduced by stale, fallback, or partial data.");
  }

  return reasons;
}

export function buildExplainability(args: {
  scores: ScoreBreakdown;
  qualityFlags?: string[];
  distanceMiles?: number;
  provenance: ResultProvenance;
}): {
  explainability: ExplainabilityPayload;
  strengths: string[];
  risks: string[];
  confidenceReasons: string[];
} {
  const sortedDrivers = orderedDrivers(args.scores);
  const primary = sortedDrivers[0];
  const secondary = sortedDrivers[1];
  const weakest = sortedDrivers[2];
  const strengths: string[] = [];
  const risks: string[] = [];
  const flags = new Set(args.qualityFlags ?? []);

  for (const driver of sortedDrivers) {
    if (driver.score >= 75) {
      addUnique(strengths, SCORE_LABELS[driver.key].strength);
    }
  }

  if ((args.distanceMiles ?? Number.POSITIVE_INFINITY) <= 2) {
    addUnique(strengths, "Close to the resolved search origin");
  }

  if (args.scores.overallConfidence === "high") {
    addUnique(strengths, "High-confidence supporting data");
  }

  for (const driver of sortedDrivers) {
    if (driver.score < 55) {
      addUnique(risks, SCORE_LABELS[driver.key].risk);
    }
  }

  if (flags.has("limitedComparables")) {
    addUnique(risks, "Limited comparable homes nearby");
  }
  if (flags.has("staleListingData")) {
    addUnique(risks, "Listing data came from stale cache");
  }
  if (flags.has("staleSafetyData")) {
    addUnique(risks, "Safety data came from stale cache");
  }
  if (flags.has("approximateSearchOrigin")) {
    addUnique(risks, "Search origin is approximate");
  }
  if (flags.has("partialSafetyData")) {
    addUnique(risks, "Safety inputs were only partially available");
  }
  if (flags.has("mockFallbackUsed")) {
    addUnique(risks, "Some supporting data came from mock fallback");
  }

  if (strengths.length === 0) {
    addUnique(strengths, "Balanced across price, size, and safety");
  }
  if (risks.length === 0 && args.scores.overallConfidence !== "high") {
    addUnique(risks, "Confidence is reduced relative to ideal fresh-data coverage");
  }

  const headline =
    weakest.score < 55
      ? `${scoreDescriptor(primary.score)} ${SCORE_LABELS[primary.key].subject} with ${scoreDescriptor(secondary.score).toLowerCase()} ${SCORE_LABELS[secondary.key].subject}. ${SCORE_LABELS[weakest.key].subject[0].toUpperCase()}${SCORE_LABELS[weakest.key].subject.slice(1)} is the main tradeoff.`
      : `${scoreDescriptor(primary.score)} ${SCORE_LABELS[primary.key].subject} with ${scoreDescriptor(secondary.score).toLowerCase()} ${SCORE_LABELS[secondary.key].subject}.`;

  const confidenceReasons = buildConfidenceReasons({
    qualityFlags: args.qualityFlags,
    scores: args.scores,
    provenance: args.provenance
  });

  return {
    explainability: {
      headline,
      strengths,
      risks,
      scoreDrivers: {
        primary: primary.key,
        secondary: secondary.key,
        weakest: weakest.key
      }
    },
    strengths,
    risks,
    confidenceReasons
  };
}

export function sourceFreshnessState(
  source: ListingDataSource | SafetyDataSource | GeocodeDataSource
): "fresh" | "stale" | "mock" | "none" {
  if (source === "live" || source === "cached_live") {
    return "fresh";
  }
  if (source === "stale_cached_live") {
    return "stale";
  }
  if (source === "mock") {
    return "mock";
  }

  return "none";
}

export function geocodePrecisionLabel(precision: GeocodePrecision): string {
  return precision.replace(/_/g, " ");
}

export function hasMockFallback(home: Pick<ScoredHome, "qualityFlags">): boolean {
  return (home.qualityFlags ?? []).includes("mockFallbackUsed");
}
