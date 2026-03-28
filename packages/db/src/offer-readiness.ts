import type {
  OfferFinancingReadiness,
  OfferPropertyFitConfidence,
  OfferReadiness,
  OfferReadinessInputs,
  OfferReadinessRecommendation,
  OfferReadinessStatus,
  OfferRiskLevel,
  OfferRiskToleranceAlignment,
  ScoredHome,
  SafetyConfidence,
  ShortlistItem
} from "@nhalo/types";

type OfferReadinessEvaluationInput = {
  item: ShortlistItem;
  now: string;
  current?: OfferReadiness | null;
  patch?: Partial<{
    status: OfferReadinessStatus;
    financingReadiness: OfferFinancingReadiness;
    propertyFitConfidence: OfferPropertyFitConfidence;
    riskToleranceAlignment: OfferRiskToleranceAlignment;
    riskLevel: OfferRiskLevel;
    userConfirmed: boolean;
  }>;
};

type OfferReadinessConfidence = SafetyConfidence;

export function createDefaultOfferReadinessInputs(home: ScoredHome): OfferReadinessInputs {
  return {
    financingReadiness: "not_started",
    propertyFitConfidence: "not_assessed",
    riskToleranceAlignment: "not_reviewed",
    riskLevel: "balanced",
    userConfirmed: false,
    dataCompletenessScore: deriveDataCompletenessScore(home)
  };
}

function deriveDataCompletenessScore(home: ScoredHome): number {
  const confidenceBase: Record<SafetyConfidence, number> = {
    high: 92,
    medium: 76,
    low: 56,
    none: 36
  };

  let score = confidenceBase[home.scores.overallConfidence];
  score -= Math.min((home.dataWarnings ?? []).length * 6, 18);
  score -= Math.min((home.degradedReasons ?? []).length * 7, 21);
  score -= Math.min((home.integrityFlags ?? []).length * 8, 24);

  if ((home.qualityFlags ?? []).includes("partialSafetyData")) {
    score -= 10;
  }
  if (home.provenance?.listingDataSource === "mock") {
    score -= 10;
  }
  if (home.provenance?.safetyDataSource === "mock") {
    score -= 10;
  }
  if (home.provenance?.geocodeDataSource === "mock") {
    score -= 6;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreFinancingReadiness(value: OfferFinancingReadiness): number {
  switch (value) {
    case "cash_ready":
      return 100;
    case "preapproved":
      return 80;
    default:
      return 0;
  }
}

function scorePropertyFitConfidence(value: OfferPropertyFitConfidence): number {
  switch (value) {
    case "high":
      return 100;
    case "medium":
      return 65;
    case "low":
      return 20;
    default:
      return 0;
  }
}

function scoreRiskAlignment(value: OfferRiskToleranceAlignment): number {
  switch (value) {
    case "aligned":
      return 100;
    case "partial":
      return 60;
    default:
      return 0;
  }
}

function buildBlockingIssues(inputs: OfferReadinessInputs): string[] {
  const issues: string[] = [];

  if (inputs.financingReadiness === "not_started") {
    issues.push("Financing readiness is still unverified.");
  }
  if (inputs.propertyFitConfidence === "low") {
    issues.push("Property fit confidence is too weak for a safe offer decision.");
  }
  if (inputs.riskToleranceAlignment === "not_reviewed") {
    issues.push("Risk tolerance alignment has not been reviewed.");
  }
  if (inputs.dataCompletenessScore < 55) {
    issues.push("Property data is incomplete or degraded enough to reduce offer trust.");
  }
  if (!inputs.userConfirmed) {
    issues.push("Buyer confirmation is still missing.");
  }

  return issues;
}

function buildNextSteps(inputs: OfferReadinessInputs): string[] {
  const steps: string[] = [];

  if (inputs.financingReadiness === "not_started") {
    steps.push("Verify financing");
  }
  if (inputs.dataCompletenessScore < 70) {
    steps.push("Review disclosures and flagged data warnings");
  }
  if (inputs.riskToleranceAlignment !== "aligned") {
    steps.push("Confirm budget ceiling");
  }
  if (inputs.propertyFitConfidence !== "high") {
    steps.push("Reconfirm property fit against family priorities");
  }
  if (!inputs.userConfirmed) {
    steps.push("Get final buyer confirmation");
  }

  steps.push("Finalize offer price");

  return [...new Set(steps)];
}

function deriveRecommendationConfidence(
  home: ScoredHome,
  readinessScore: number,
  inputs: OfferReadinessInputs,
  blockingIssues: string[]
): OfferReadinessConfidence {
  if (inputs.dataCompletenessScore < 35) {
    return "none";
  }
  if (
    home.scores.overallConfidence === "high" &&
    readinessScore >= 80 &&
    blockingIssues.length === 0 &&
    inputs.dataCompletenessScore >= 80
  ) {
    return "high";
  }
  if (
    home.scores.overallConfidence === "medium" ||
    (readinessScore >= 60 && inputs.dataCompletenessScore >= 65)
  ) {
    return "medium";
  }
  return "low";
}

function deriveRecommendedOfferPrice(
  home: ScoredHome,
  readinessScore: number,
  confidence: OfferReadinessConfidence,
  riskLevel: OfferRiskLevel,
  dataCompletenessScore: number
): number {
  const confidenceAdjustment: Record<OfferReadinessConfidence, number> = {
    high: 0.01,
    medium: 0,
    low: -0.01,
    none: -0.03
  };
  const riskAdjustment: Record<OfferRiskLevel, number> = {
    conservative: -0.025,
    balanced: 0,
    competitive: 0.02
  };

  let multiplier = 1;

  if (home.scores.nhalo >= 90) {
    multiplier += 0.015;
  } else if (home.scores.nhalo >= 80) {
    multiplier += 0.01;
  } else if (home.scores.nhalo >= 70) {
    multiplier += 0.005;
  } else if (home.scores.nhalo < 60) {
    multiplier -= 0.01;
  }

  multiplier += confidenceAdjustment[confidence];
  multiplier += riskAdjustment[riskLevel];

  if (readinessScore < 60) {
    multiplier -= 0.02;
  }
  if (dataCompletenessScore < 65) {
    multiplier -= 0.015;
  }

  multiplier = Math.max(0.9, Math.min(1.06, multiplier));

  return Math.max(0, Math.round((home.price * multiplier) / 1000) * 1000);
}

function deriveStatus(
  inputs: OfferReadinessInputs,
  readinessScore: number,
  blockingIssues: string[],
  manualStatus?: OfferReadinessStatus
): OfferReadinessStatus {
  if (manualStatus) {
    return manualStatus;
  }

  if (
    inputs.financingReadiness === "not_started" &&
    inputs.propertyFitConfidence === "not_assessed" &&
    inputs.riskToleranceAlignment === "not_reviewed" &&
    !inputs.userConfirmed
  ) {
    return "NOT_STARTED";
  }

  if (blockingIssues.length > 0) {
    return "BLOCKED";
  }

  if (readinessScore >= 80) {
    return "READY";
  }

  return "IN_PROGRESS";
}

export function evaluateOfferReadiness(
  input: OfferReadinessEvaluationInput
): Omit<OfferReadiness, "id" | "createdAt" | "updatedAt"> {
  const home = input.item.capturedHome;
  const existingInputs = input.current?.inputs ?? createDefaultOfferReadinessInputs(home);
  const inputs: OfferReadinessInputs = {
    ...existingInputs,
    financingReadiness:
      input.patch?.financingReadiness ?? existingInputs.financingReadiness,
    propertyFitConfidence:
      input.patch?.propertyFitConfidence ?? existingInputs.propertyFitConfidence,
    riskToleranceAlignment:
      input.patch?.riskToleranceAlignment ?? existingInputs.riskToleranceAlignment,
    riskLevel: input.patch?.riskLevel ?? existingInputs.riskLevel,
    userConfirmed: input.patch?.userConfirmed ?? existingInputs.userConfirmed,
    dataCompletenessScore: deriveDataCompletenessScore(home)
  };

  const readinessScore = Math.round(
    scoreFinancingReadiness(inputs.financingReadiness) * 0.3 +
      scorePropertyFitConfidence(inputs.propertyFitConfidence) * 0.25 +
      scoreRiskAlignment(inputs.riskToleranceAlignment) * 0.15 +
      inputs.dataCompletenessScore * 0.2 +
      (inputs.userConfirmed ? 100 : 0) * 0.1
  );

  const blockingIssues = buildBlockingIssues(inputs);
  const nextSteps = buildNextSteps(inputs);
  const confidence = deriveRecommendationConfidence(home, readinessScore, inputs, blockingIssues);
  const recommendedOfferPrice = deriveRecommendedOfferPrice(
    home,
    readinessScore,
    confidence,
    inputs.riskLevel,
    inputs.dataCompletenessScore
  );

  return {
    propertyId: input.item.canonicalPropertyId,
    shortlistId: input.item.shortlistId,
    shortlistItemId: input.item.id,
    status: deriveStatus(inputs, readinessScore, blockingIssues, input.patch?.status),
    readinessScore,
    recommendedOfferPrice,
    confidence,
    inputs,
    blockingIssues,
    nextSteps,
    lastEvaluatedAt: input.now
  };
}

export function toOfferReadinessRecommendation(
  record: OfferReadiness
): OfferReadinessRecommendation {
  return {
    propertyId: record.propertyId,
    shortlistId: record.shortlistId,
    readinessScore: record.readinessScore,
    recommendedOfferPrice: record.recommendedOfferPrice,
    confidence: record.confidence,
    blockingIssues: [...record.blockingIssues],
    nextSteps: [...record.nextSteps]
  };
}
