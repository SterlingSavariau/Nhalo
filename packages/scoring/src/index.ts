import { FORMULA_VERSION } from "@nhalo/config";
import type {
  ListingRecord,
  RankedListing,
  RankingContext,
  ScoreAuditInputs,
  SafetyConfidence,
  SafetyRecord
} from "@nhalo/types";

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function roundScore(value: number): number {
  return Math.round(clamp(value));
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundToTwo(value: number): number {
  return Number(value.toFixed(2));
}

function normalizeDirect(value: number, values: number[]): number {
  if (values.length === 0) {
    return 50;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (max === min) {
    return 100;
  }

  return ((value - min) / (max - min)) * 100;
}

function normalizeInverse(value: number, values: number[]): number {
  if (values.length === 0) {
    return 50;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (max === min) {
    return 100;
  }

  return ((max - value) / (max - min)) * 100;
}

function calculateBudgetAlignmentScore(price: number, budgetMax?: number): number {
  if (!budgetMax) {
    return 65;
  }

  const remainingShare = clamp(((budgetMax - price) / budgetMax) * 100, 0, 100);

  return clamp(40 + remainingShare * 0.6, 0, 100);
}

function calculateRelativeValueScore(listing: ListingRecord, comparableListings: ListingRecord[]): number {
  const comparablePricePerSqft = comparableListings
    .filter((item) => item.sqft > 0)
    .map((item) => item.price / item.sqft);
  const listingPricePerSqft = listing.price / Math.max(listing.sqft, 1);

  return normalizeInverse(listingPricePerSqft, comparablePricePerSqft);
}

function calculatePriceScore(listing: ListingRecord, context: RankingContext): {
  score: number;
  details: Record<string, number>;
} {
  const budgetAlignment = calculateBudgetAlignmentScore(listing.price, context.budget?.max);
  const relativeValue = calculateRelativeValueScore(listing, context.comparableListings);
  const priceScore = budgetAlignment * 0.5 + relativeValue * 0.5;

  return {
    score: roundScore(priceScore),
    details: {
      budgetAlignment: roundScore(budgetAlignment),
      relativeValue: roundScore(relativeValue),
      pricePerSqft: roundScore(listing.price / Math.max(listing.sqft, 1))
    }
  };
}

function getSizeWeights(propertyType: ListingRecord["propertyType"]): Record<string, number> {
  switch (propertyType) {
    case "condo":
      return { sqft: 50, bedrooms: 25, bathrooms: 25 };
    case "townhome":
      return { sqft: 45, bedrooms: 25, bathrooms: 20, lotSqft: 10 };
    default:
      return { sqft: 45, bedrooms: 25, bathrooms: 20, lotSqft: 10 };
  }
}

function calculateSizeScore(listing: ListingRecord, context: RankingContext): {
  score: number;
  details: Record<string, number>;
} {
  const weights = getSizeWeights(listing.propertyType);
  const entries: Array<{ key: string; score: number; weight: number }> = [];

  entries.push({
    key: "sqft",
    score: normalizeDirect(
      listing.sqft,
      context.comparableListings.map((item) => item.sqft)
    ),
    weight: weights.sqft ?? 0
  });
  entries.push({
    key: "bedrooms",
    score: normalizeDirect(
      listing.bedrooms,
      context.comparableListings.map((item) => item.bedrooms)
    ),
    weight: weights.bedrooms ?? 0
  });
  entries.push({
    key: "bathrooms",
    score: normalizeDirect(
      listing.bathrooms,
      context.comparableListings.map((item) => item.bathrooms)
    ),
    weight: weights.bathrooms ?? 0
  });

  if ((weights.lotSqft ?? 0) > 0 && listing.lotSqft) {
    entries.push({
      key: "lotSqft",
      score: normalizeDirect(
        listing.lotSqft,
        context.comparableListings
          .map((item) => item.lotSqft)
          .filter((value): value is number => typeof value === "number")
      ),
      weight: weights.lotSqft ?? 0
    });
  }

  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  const weightedScore =
    totalWeight === 0
      ? 50
      : entries.reduce((sum, entry) => sum + entry.score * (entry.weight / totalWeight), 0);

  const details = Object.fromEntries(
    entries.map((entry) => [entry.key, roundScore(entry.score)])
  );

  return {
    score: roundScore(weightedScore),
    details
  };
}

function safetyConfidenceFromSignals(signalCount: number): SafetyConfidence {
  if (signalCount === 0) {
    return "none";
  }

  if (signalCount >= 3) {
    return "high";
  }

  if (signalCount === 2) {
    return "medium";
  }

  return "low";
}

function calculateSafetyScore(
  listing: ListingRecord,
  safetyRecord: SafetyRecord | undefined,
  context: RankingContext
): {
  score: number;
  confidence: SafetyConfidence;
  details: Record<string, number | string>;
} {
  const safetyWeights = {
    crime: 50,
    schools: 35,
    stability: 15
  };

  if (!safetyRecord) {
    return {
      score: 0,
      confidence: "none",
      details: {
        availableSignals: 0
      }
    };
  }

  const entries: Array<{ key: string; score: number; weight: number }> = [];
  const comparableSafety = context.comparableListings
    .map((candidate) => context.safetyByPropertyId.get(candidate.id))
    .filter((candidate): candidate is SafetyRecord => Boolean(candidate));

  if (typeof safetyRecord.crimeIndex === "number") {
    entries.push({
      key: "crime",
      score: normalizeInverse(
        safetyRecord.crimeIndex,
        comparableSafety
          .map((entry) => entry.crimeIndex)
          .filter((value): value is number => typeof value === "number")
      ),
      weight: safetyWeights.crime
    });
  }

  if (typeof safetyRecord.schoolRating === "number") {
    entries.push({
      key: "schools",
      score: normalizeDirect(
        safetyRecord.schoolRating,
        comparableSafety
          .map((entry) => entry.schoolRating)
          .filter((value): value is number => typeof value === "number")
      ),
      weight: safetyWeights.schools
    });
  }

  if (typeof safetyRecord.stabilityIndex === "number") {
    entries.push({
      key: "stability",
      score: normalizeDirect(
        safetyRecord.stabilityIndex,
        comparableSafety
          .map((entry) => entry.stabilityIndex)
          .filter((value): value is number => typeof value === "number")
      ),
      weight: safetyWeights.stability
    });
  }

  const totalAvailableWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  const score =
    totalAvailableWeight === 0
      ? 0
      : entries.reduce((sum, entry) => sum + entry.score * (entry.weight / totalAvailableWeight), 0);
  const confidence = safetyConfidenceFromSignals(entries.length);
  const details: Record<string, number | string> = Object.fromEntries(
    entries.map((entry) => [entry.key, roundScore(entry.score)])
  );

  details.availableSignals = entries.length;
  details.confidence = confidence;

  return {
    score: roundScore(score),
    confidence,
    details
  };
}

function calculateDataCompleteness(safetyRecord: SafetyRecord | undefined): number {
  const safetySignals = [
    typeof safetyRecord?.crimeIndex === "number",
    typeof safetyRecord?.schoolRating === "number",
    typeof safetyRecord?.stabilityIndex === "number"
  ].filter(Boolean).length;

  return roundToTwo((safetySignals / 3) * 100);
}

function calculateOverallConfidence(
  safetyConfidence: SafetyConfidence,
  dataCompleteness: number,
  freshnessHours: number | null
): SafetyConfidence {
  if (safetyConfidence === "none" || dataCompleteness === 0) {
    return "none";
  }

  const providerFresh = freshnessHours === null || freshnessHours <= 24;

  if (safetyConfidence === "high" && providerFresh) {
    return "high";
  }

  if (safetyConfidence === "medium" && providerFresh) {
    return "medium";
  }

  return "low";
}

function createAuditInputs(
  listing: ListingRecord,
  safetyRecord: SafetyRecord | undefined,
  medianPricePerSqft: number,
  dataCompleteness: number
): ScoreAuditInputs {
  return {
    price: listing.price,
    squareFootage: listing.sqft,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    lotSize: listing.lotSqft ?? null,
    crimeIndex: safetyRecord?.crimeIndex ?? null,
    schoolRating: safetyRecord?.schoolRating ?? null,
    neighborhoodStability: safetyRecord?.stabilityIndex ?? null,
    pricePerSqft: roundToTwo(listing.price / Math.max(listing.sqft, 1)),
    medianPricePerSqft: roundToTwo(medianPricePerSqft),
    dataCompleteness
  };
}

function buildExplanation(priceScore: number, sizeScore: number, safetyScore: number): string {
  if (safetyScore >= 85 && sizeScore >= 70 && priceScore >= 70) {
    return "Excellent safety profile and strong space for the price.";
  }

  if (priceScore >= 80 && safetyScore >= 70) {
    return "Affordable option with moderate size and strong neighborhood safety.";
  }

  if (sizeScore >= 85 && safetyScore >= 70) {
    return "Large home with a reassuring safety profile for family living.";
  }

  if (sizeScore >= 80 && priceScore < 55) {
    return "Large home, but priced less favorably than nearby alternatives.";
  }

  if (priceScore >= 75 && sizeScore >= 65) {
    return "Solid value with enough space to meet family needs.";
  }

  if (safetyScore >= 80) {
    return "Safety stands out, though price and size are more middle of the market.";
  }

  return "Balanced option across affordability, space, and neighborhood fundamentals.";
}

export function rankListings(listings: ListingRecord[], context: RankingContext): RankedListing[] {
  return listings
    .map((listing) => {
      const safetyRecord = context.safetyByPropertyId.get(listing.id);
      const price = calculatePriceScore(listing, context);
      const size = calculateSizeScore(listing, context);
      const safety = calculateSafetyScore(
        listing,
        safetyRecord,
        context
      );
      const dataCompleteness = calculateDataCompleteness(safetyRecord);
      const overallConfidence = calculateOverallConfidence(
        safety.confidence,
        dataCompleteness,
        context.providerFreshnessHours.safety
      );
      const auditInputs = createAuditInputs(
        listing,
        safetyRecord,
        context.marketSnapshot.medianPricePerSqft,
        dataCompleteness
      );
      const nhalo =
        price.score * (context.weights.price / 100) +
        size.score * (context.weights.size / 100) +
        safety.score * (context.weights.safety / 100);
      const explanation = buildExplanation(price.score, size.score, safety.score);

      return {
        listing,
        explanation,
        scoreInputs: {
          ...auditInputs,
          comparableListingCount: context.comparableListings.length,
          priceBreakdown: price.details,
          sizeBreakdown: size.details,
          safetyBreakdown: safety.details,
          providerFreshnessHours: context.providerFreshnessHours,
          marketSnapshotId: context.marketSnapshot.id
        },
        scores: {
          price: price.score,
          size: size.score,
          safety: safety.score,
          nhalo: roundScore(nhalo),
          safetyConfidence: safety.confidence,
          overallConfidence,
          formulaVersion: FORMULA_VERSION
        }
      };
    })
    .sort((left, right) => {
      if (right.scores.nhalo !== left.scores.nhalo) {
        return right.scores.nhalo - left.scores.nhalo;
      }

      return average([right.scores.safety, right.scores.size]) - average([left.scores.safety, left.scores.size]);
    });
}
