import { DEFAULT_RESULT_LIMIT } from "@nhalo/config";
import { rankListings } from "@nhalo/scoring";
import type {
  GeocoderProvider,
  ListingProvider,
  ListingRecord,
  MarketSnapshot,
  MarketSnapshotRepository,
  RankedListing,
  SearchRepository,
  SearchResponse,
  SearchSuggestion,
  SearchWarning,
  SafetyProvider
} from "@nhalo/types";
import { ApiError } from "./errors";
import { MetricsCollector } from "./metrics";
import type { SearchRequestInput } from "./search-schema";

export interface SearchServiceDependencies {
  geocoder: GeocoderProvider;
  listingProvider: ListingProvider;
  safetyProvider: SafetyProvider;
  repository: SearchRepository;
  marketSnapshotRepository: MarketSnapshotRepository;
  metrics: MetricsCollector;
  getProviderFreshnessHours(): Promise<{
    listings: number | null;
    safety: number | null;
  }>;
}

function applyHardFilters(
  listings: ListingRecord[],
  request: SearchRequestInput
): ListingRecord[] {
  return listings.filter((listing) => {
    const budgetPass =
      typeof request.budget?.max !== "number" || listing.price <= request.budget.max;
    const sqftPass =
      typeof request.minSqft !== "number" || listing.squareFootage >= request.minSqft;
    const bedroomPass =
      typeof request.minBedrooms !== "number" || listing.bedrooms >= request.minBedrooms;
    const propertyTypePass = request.propertyTypes.includes(listing.propertyType);

    return budgetPass && sqftPass && bedroomPass && propertyTypePass;
  });
}

function buildWarnings(totalMatched: number): SearchWarning[] {
  if (totalMatched === 0) {
    return [
      {
        code: "NO_MATCHES",
        message: "No homes matched the current family criteria inside the requested radius."
      }
    ];
  }

  if (totalMatched < 5) {
    return [
      {
        code: "LOW_MATCH_COUNT",
        message: "Only a small number of homes matched the current filters."
      }
    ];
  }

  return [];
}

function buildReliabilityWarnings(homes: SearchResponse["homes"]): SearchWarning[] {
  const overallConfidenceValues = new Set(homes.map((home) => home.scores.overallConfidence));

  if (overallConfidenceValues.has("none")) {
    return [
      {
        code: "MISSING_PROVIDER_DATA",
        message: "Some homes were ranked with missing safety inputs and reduced confidence."
      }
    ];
  }

  if (overallConfidenceValues.has("low")) {
    return [
      {
        code: "STALE_OR_PARTIAL_DATA",
        message: "Some homes were ranked using stale or partial provider data."
      }
    ];
  }

  return [];
}

function buildSuggestions(request: SearchRequestInput, totalMatched: number): SearchSuggestion[] {
  if (totalMatched >= 5) {
    return [];
  }

  const suggestions: SearchSuggestion[] = [];

  suggestions.push({
    code: "INCREASE_RADIUS",
    message: "Increase the radius to pull in more nearby family-sized homes."
  });

  if (typeof request.budget?.max === "number") {
    suggestions.push({
      code: "RAISE_BUDGET_MAX",
      message: "Raise the maximum budget to expand the candidate set."
    });
  }

  if (typeof request.minSqft === "number") {
    suggestions.push({
      code: "LOWER_MIN_SQFT",
      message: "Lower the minimum square footage threshold to unlock more options."
    });
  }

  return suggestions;
}

function mapRankedHome(ranked: RankedListing) {
  return {
    id: ranked.listing.id,
    address: ranked.listing.address,
    city: ranked.listing.city,
    state: ranked.listing.state,
    zipCode: ranked.listing.zipCode,
    propertyType: ranked.listing.propertyType,
    price: ranked.listing.price,
    sqft: ranked.listing.squareFootage,
    bedrooms: ranked.listing.bedrooms,
    bathrooms: ranked.listing.bathrooms,
    lotSqft: ranked.listing.lotSqft,
    sourceUrl: ranked.listing.sourceUrl,
    listingDataSource: ranked.listing.listingDataSource ?? "none",
    listingProvider: ranked.listing.sourceProvider,
    sourceListingId: ranked.listing.sourceListingId,
    listingFetchedAt: ranked.listing.fetchedAt,
    neighborhoodSafetyScore: ranked.scores.safety,
    explanation: ranked.explanation,
    scores: ranked.scores
  };
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return Number((((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2).toFixed(2));
  }

  return Number((sorted[middle] ?? 0).toFixed(2));
}

function getLocationSnapshotKey(request: SearchRequestInput): string {
  return `${request.locationType}:${request.locationValue.trim().toLowerCase()}`;
}

async function resolveMarketSnapshot(
  request: SearchRequestInput,
  candidates: ListingRecord[],
  repository: MarketSnapshotRepository
): Promise<MarketSnapshot> {
  const location = getLocationSnapshotKey(request);
  const latestSnapshot = await repository.getLatestSnapshot(location, request.radiusMiles);

  if (latestSnapshot && repository.isSnapshotFresh(latestSnapshot)) {
    return latestSnapshot;
  }

  const candidatePricePerSqft = candidates
    .filter((listing) => listing.sqft > 0)
    .map((listing) => listing.price / listing.sqft);

  return repository.createSnapshot({
    location,
    radiusMiles: request.radiusMiles,
    medianPricePerSqft: median(candidatePricePerSqft),
    sampleSize: candidates.length,
    createdAt: new Date().toISOString()
  });
}

export async function runSearch(
  request: SearchRequestInput,
  dependencies: SearchServiceDependencies
): Promise<SearchResponse> {
  const startedAt = Date.now();
  const resolvedLocation = await dependencies.geocoder.geocode(
    request.locationType,
    request.locationValue
  );

  if (!resolvedLocation) {
    throw new ApiError(404, "LOCATION_NOT_FOUND", "Location is not available from the current provider set.");
  }

  const candidates = await dependencies.listingProvider.fetchListings({
    center: resolvedLocation.center,
    radiusMiles: request.radiusMiles,
    location: resolvedLocation,
    propertyTypes: request.propertyTypes
  });
  const marketSnapshot = await resolveMarketSnapshot(
    request,
    candidates,
    dependencies.marketSnapshotRepository
  );
  const safetyByPropertyId = await dependencies.safetyProvider.fetchSafetyData(candidates);
  const providerFreshnessHours = await dependencies.getProviderFreshnessHours();
  const matchedListings = applyHardFilters(candidates, request);
  const rankedListings = rankListings(matchedListings, {
    budget: request.budget,
    comparableListings: candidates,
    marketSnapshot,
    minBedrooms: request.minBedrooms,
    minSqft: request.minSqft,
    providerFreshnessHours,
    safetyByPropertyId,
    weights: request.weights
  }).slice(0, DEFAULT_RESULT_LIMIT);
  const homes = rankedListings.map(mapRankedHome);
  const warnings = [
    ...buildWarnings(matchedListings.length),
    ...buildReliabilityWarnings(homes)
  ];
  const response: SearchResponse = {
    homes,
    appliedFilters: {
      locationType: request.locationType,
      locationValue: request.locationValue,
      radiusMiles: request.radiusMiles,
      budget: request.budget,
      minSqft: request.minSqft,
      minBedrooms: request.minBedrooms,
      propertyTypes: request.propertyTypes,
      preferences: request.preferences
    },
    appliedWeights: request.weights,
    metadata: {
      totalCandidatesScanned: candidates.length,
      totalMatched: matchedListings.length,
      returnedCount: rankedListings.length,
      durationMs: Date.now() - startedAt,
      warnings,
      suggestions: buildSuggestions(request, matchedListings.length),
      rejectionSummary: dependencies.listingProvider.getLastRejectionSummary?.() ?? undefined
    }
  };

  dependencies.metrics.recordSearch({
    durationMs: response.metadata.durationMs,
    candidatesScanned: response.metadata.totalCandidatesScanned,
    matchesReturned: response.metadata.returnedCount,
    scores: response.homes.map((home) => home.scores.nhalo)
  });
  dependencies.metrics.recordListingResultsReturned(response.metadata.returnedCount);

  await dependencies.repository.saveSearch({
    request,
    response,
    resolvedLocation,
    listings: candidates,
    marketSnapshot,
    scoredResults: rankedListings.map((ranked) => ({
      propertyId: ranked.listing.id,
      formulaVersion: ranked.scores.formulaVersion,
      explanation: ranked.explanation,
      scores: ranked.scores,
      scoreInputs: ranked.scoreInputs,
      weights: request.weights,
      computedAt: new Date().toISOString(),
      pricePerSqft: Number(ranked.scoreInputs.pricePerSqft ?? 0),
      medianPricePerSqft: Number(ranked.scoreInputs.medianPricePerSqft ?? 0),
      crimeIndex: (ranked.scoreInputs.crimeIndex as number | null) ?? null,
      schoolRating: (ranked.scoreInputs.schoolRating as number | null) ?? null,
      neighborhoodStability: (ranked.scoreInputs.neighborhoodStability as number | null) ?? null,
      dataCompleteness: Number(ranked.scoreInputs.dataCompleteness ?? 0),
      safetyDataSource:
        (ranked.scoreInputs.safetyDataSource as "live" | "cached_live" | "stale_cached_live" | "mock" | "none") ??
        "none",
      crimeProvider: (ranked.scoreInputs.crimeProvider as string | null) ?? null,
      schoolProvider: (ranked.scoreInputs.schoolProvider as string | null) ?? null,
      crimeFetchedAt: (ranked.scoreInputs.crimeFetchedAt as string | null) ?? null,
      schoolFetchedAt: (ranked.scoreInputs.schoolFetchedAt as string | null) ?? null,
      rawSafetyInputs:
        (ranked.scoreInputs.rawSafetyInputs as Record<string, unknown> | null) ?? null,
      normalizedSafetyInputs:
        (ranked.scoreInputs.normalizedSafetyInputs as Record<string, unknown> | null) ?? null,
      listingDataSource:
        (ranked.listing.listingDataSource as "live" | "cached_live" | "stale_cached_live" | "mock" | "none") ??
        "none",
      listingProvider: ranked.listing.sourceProvider ?? null,
      sourceListingId: ranked.listing.sourceListingId ?? null,
      listingFetchedAt: ranked.listing.fetchedAt ?? null,
      rawListingInputs: ranked.listing.rawListingInputs ?? null,
      normalizedListingInputs: ranked.listing.normalizedListingInputs ?? null,
      inputs: {
        price: Number(ranked.scoreInputs.price ?? ranked.listing.price),
        squareFootage: Number(ranked.scoreInputs.squareFootage ?? ranked.listing.squareFootage),
        bedrooms: Number(ranked.scoreInputs.bedrooms ?? ranked.listing.bedrooms),
        bathrooms: Number(ranked.scoreInputs.bathrooms ?? ranked.listing.bathrooms),
        lotSize: (ranked.scoreInputs.lotSize as number | null) ?? ranked.listing.lotSqft ?? null,
        crimeIndex: (ranked.scoreInputs.crimeIndex as number | null) ?? null,
        schoolRating: (ranked.scoreInputs.schoolRating as number | null) ?? null,
        neighborhoodStability: (ranked.scoreInputs.neighborhoodStability as number | null) ?? null,
        pricePerSqft: Number(ranked.scoreInputs.pricePerSqft ?? 0),
        medianPricePerSqft: Number(ranked.scoreInputs.medianPricePerSqft ?? 0),
        dataCompleteness: Number(ranked.scoreInputs.dataCompleteness ?? 0),
        schoolRatingRaw:
          (ranked.scoreInputs.schoolRatingRaw as Record<string, unknown> | number | null) ?? null,
        schoolRatingNormalized: (ranked.scoreInputs.schoolRatingNormalized as number | null) ?? null,
        schoolProvider: (ranked.scoreInputs.schoolProvider as string | null) ?? null,
        schoolFetchedAt: (ranked.scoreInputs.schoolFetchedAt as string | null) ?? null,
        crimeIndexRaw:
          (ranked.scoreInputs.crimeIndexRaw as Record<string, unknown> | number | null) ?? null,
        crimeIndexNormalized: (ranked.scoreInputs.crimeIndexNormalized as number | null) ?? null,
        crimeProvider: (ranked.scoreInputs.crimeProvider as string | null) ?? null,
        crimeFetchedAt: (ranked.scoreInputs.crimeFetchedAt as string | null) ?? null
      }
    }))
  });

  return response;
}
