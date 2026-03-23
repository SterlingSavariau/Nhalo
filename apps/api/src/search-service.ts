import { DEFAULT_RESULT_LIMIT, getSearchQualityConfig } from "@nhalo/config";
import { distanceMiles } from "@nhalo/providers";
import { rankListings } from "@nhalo/scoring";
import type {
  GeocoderProvider,
  ListingProvider,
  ListingRecord,
  MarketSnapshot,
  MarketSnapshotRepository,
  RankedListing,
  SearchRepository,
  SearchOriginMetadata,
  SearchResponse,
  SearchSuggestion,
  SearchWarning,
  SafetyProvider
} from "@nhalo/types";
import { ApiError } from "./errors";
import { MetricsCollector } from "./metrics";
import {
  addRejectionCounts,
  applyHardFiltersWithSummary,
  applyQualityGate,
  buildQualityFlags,
  countRankingTies,
  createEmptyRejectionSummary,
  deduplicateListings,
  selectComparableListings,
  type EnrichedListing
} from "./search-quality";
import type { SearchRequestInput } from "./search-schema";

export interface SearchServiceDependencies {
  geocoder: GeocoderProvider;
  listingProvider: ListingProvider;
  safetyProvider: SafetyProvider;
  repository: SearchRepository;
  marketSnapshotRepository: MarketSnapshotRepository;
  metrics: MetricsCollector;
  getProviderFreshnessHours(): Promise<{
    geocoder: number | null;
    listings: number | null;
    safety: number | null;
  }>;
}

function buildSearchOriginMetadata(resolvedLocation: {
  locationType: SearchOriginMetadata["locationType"];
  locationValue: string;
  formattedAddress?: string | null;
  latitude?: number;
  longitude?: number;
  precision?: SearchOriginMetadata["precision"];
  geocodeDataSource?: SearchOriginMetadata["geocodeDataSource"];
  provider?: string | null;
  fetchedAt?: string | null;
  rawGeocodeInputs?: SearchOriginMetadata["rawGeocodeInputs"];
  normalizedGeocodeInputs?: SearchOriginMetadata["normalizedGeocodeInputs"];
}): SearchOriginMetadata {
  return {
    locationType: resolvedLocation.locationType,
    locationValue: resolvedLocation.locationValue,
    resolvedFormattedAddress: resolvedLocation.formattedAddress ?? null,
    latitude: resolvedLocation.latitude ?? null,
    longitude: resolvedLocation.longitude ?? null,
    precision: resolvedLocation.precision ?? "none",
    geocodeDataSource: resolvedLocation.geocodeDataSource ?? "none",
    geocodeProvider: resolvedLocation.provider ?? null,
    geocodeFetchedAt: resolvedLocation.fetchedAt ?? null,
    rawGeocodeInputs: resolvedLocation.rawGeocodeInputs ?? null,
    normalizedGeocodeInputs: resolvedLocation.normalizedGeocodeInputs ?? null
  };
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

function mapRankedHome(ranked: RankedListing, distanceByPropertyId: Map<string, number>) {
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
    canonicalPropertyId: ranked.listing.canonicalPropertyId ?? null,
    distanceMiles: Number((distanceByPropertyId.get(ranked.listing.id) ?? 0).toFixed(2)),
    insideRequestedRadius: true,
    qualityFlags: ranked.qualityFlags ?? [],
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
  const searchQualityConfig = getSearchQualityConfig();
  const startedAt = Date.now();
  const resolvedLocation = await dependencies.geocoder.geocode(
    request.locationType,
    request.locationValue
  );

  if (!resolvedLocation) {
    const issue = dependencies.geocoder.getLastResolutionIssue?.();
    if (issue) {
      const statusCode =
        issue.code === "AMBIGUOUS_ADDRESS"
          ? 409
          : issue.code === "INVALID_ZIP" ||
              issue.code === "INVALID_LOCATION" ||
              issue.code === "MALFORMED_GEOCODER_RESPONSE"
            ? 400
            : 404;
      throw new ApiError(statusCode, issue.code, issue.message, issue.details);
    }
    throw new ApiError(404, "LOCATION_NOT_FOUND", "Location is not available from the current provider set.");
  }
  const searchOrigin = buildSearchOriginMetadata(resolvedLocation);

  const candidates = await dependencies.listingProvider.fetchListings({
    center: resolvedLocation.center,
    radiusMiles: request.radiusMiles,
    location: resolvedLocation,
    propertyTypes: request.propertyTypes
  });
  const normalizationRejections = dependencies.listingProvider.getLastRejectionSummary?.() ?? createEmptyRejectionSummary();
  const candidatesRetrieved =
    candidates.length +
    normalizationRejections.duplicateListings +
    normalizationRejections.invalidCoordinates +
    normalizationRejections.missingAddress +
    normalizationRejections.missingPrice +
    normalizationRejections.missingSquareFootage +
    normalizationRejections.unsupportedPropertyType +
    normalizationRejections.normalizationFailures;

  const qualityGate = applyQualityGate(candidates, searchQualityConfig);
  const deduplicated = deduplicateListings(qualityGate.listings);
  const distanceByPropertyId = new Map(
    deduplicated.listings.map((listing) => [
      listing.id,
      distanceMiles(resolvedLocation.center, listing.coordinates)
    ])
  );
  const radiusCandidates = deduplicated.listings.filter(
    (listing) => (distanceByPropertyId.get(listing.id) ?? Number.POSITIVE_INFINITY) <= request.radiusMiles
  );
  const hardFilterResult = applyHardFiltersWithSummary(radiusCandidates, request);
  const marketSnapshot = await resolveMarketSnapshot(
    request,
    radiusCandidates,
    dependencies.marketSnapshotRepository
  );
  const safetyByPropertyId = await dependencies.safetyProvider.fetchSafetyData(radiusCandidates);
  const providerFreshnessHours = await dependencies.getProviderFreshnessHours();
  const matchedListings = hardFilterResult.listings;
  const rankedListings = matchedListings
    .map((listing): RankedListing => {
      const comparableSelection = selectComparableListings(
        listing as EnrichedListing,
        radiusCandidates as EnrichedListing[],
        searchQualityConfig
      );
      dependencies.metrics.recordComparableSelection({
        fallback: comparableSelection.strategyUsed !== "strict"
      });
      const ranked = rankListings([listing], {
        budget: request.budget,
        comparableListings: comparableSelection.listings,
        marketSnapshot,
        minBedrooms: request.minBedrooms,
        minSqft: request.minSqft,
        providerFreshnessHours,
        safetyByPropertyId,
        weights: request.weights,
        searchOrigin
      })[0];
      const qualityFlags = buildQualityFlags({
        listing: listing as EnrichedListing,
        safetyDataSource: safetyByPropertyId.get(listing.id)?.safetyDataSource ?? null,
        dataCompleteness: Number(ranked.scoreInputs.dataCompleteness ?? 0),
        comparableSampleSize: comparableSelection.listings.length,
        comparableStrategyUsed: comparableSelection.strategyUsed,
        minComparableSampleSize: searchQualityConfig.minComparableSampleSize,
        searchOrigin
      });

      return {
        ...ranked,
        qualityFlags,
        scoreInputs: {
          ...ranked.scoreInputs,
          canonicalPropertyId: (listing as EnrichedListing).canonicalPropertyId,
          comparableSampleSize: comparableSelection.listings.length,
          comparableStrategyUsed: comparableSelection.strategyUsed,
          deduplicationDecision: "selected",
          qualityGateDecision: "passed",
          rejectionContext: null,
          rankingTieBreakInputs: {
            nhalo: ranked.scores.nhalo,
            safety: ranked.scores.safety,
            price: ranked.scores.price,
            size: ranked.scores.size,
            distanceMiles: Number((distanceByPropertyId.get(listing.id) ?? 0).toFixed(2)),
            canonicalPropertyId: (listing as EnrichedListing).canonicalPropertyId
          },
          resultQualityFlags: qualityFlags
        }
      };
    })
    .sort((left, right) => {
      if (right.scores.nhalo !== left.scores.nhalo) {
        return right.scores.nhalo - left.scores.nhalo;
      }
      if (right.scores.safety !== left.scores.safety) {
        return right.scores.safety - left.scores.safety;
      }
      if (right.scores.price !== left.scores.price) {
        return right.scores.price - left.scores.price;
      }
      if (right.scores.size !== left.scores.size) {
        return right.scores.size - left.scores.size;
      }
      const distanceDelta =
        (distanceByPropertyId.get(left.listing.id) ?? 0) -
        (distanceByPropertyId.get(right.listing.id) ?? 0);
      if (distanceDelta !== 0) {
        return distanceDelta;
      }
      return (left.listing.canonicalPropertyId ?? left.listing.id).localeCompare(
        right.listing.canonicalPropertyId ?? right.listing.id
      );
    })
    .slice(0, DEFAULT_RESULT_LIMIT);
  const homes = rankedListings.map((ranked) => mapRankedHome(ranked, distanceByPropertyId));
  const combinedRejectionSummary = addRejectionCounts(
    addRejectionCounts(
      addRejectionCounts(normalizationRejections, qualityGate.rejectionSummary),
      {
        duplicate: deduplicated.deduplicatedCount,
        duplicateListings: deduplicated.deduplicatedCount
      }
    ),
    addRejectionCounts(hardFilterResult.rejectionSummary, {
      outsideRadius: deduplicated.listings.length - radiusCandidates.length
    })
  );
  const comparableSampleSizes = rankedListings.map((listing) =>
    Number(listing.scoreInputs.comparableSampleSize ?? radiusCandidates.length)
  );
  const comparableStrategies = [...new Set(
    rankedListings.map((listing) => String(listing.scoreInputs.comparableStrategyUsed ?? "local_radius_fallback"))
  )];
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
      candidatesRetrieved,
      candidatesAfterNormalization: candidates.length,
      candidatesAfterQualityGate: qualityGate.listings.length,
      candidatesAfterDeduplication: deduplicated.listings.length,
      candidatesAfterRadiusFilter: radiusCandidates.length,
      candidatesAfterHardFilters: matchedListings.length,
      comparableSampleSize:
        comparableSampleSizes.length === 0
          ? 0
          : Number((comparableSampleSizes.reduce((sum, value) => sum + value, 0) / comparableSampleSizes.length).toFixed(2)),
      comparableStrategyUsed:
        comparableStrategies.length === 1 ? comparableStrategies[0] : "mixed",
      deduplicatedCount: deduplicated.deduplicatedCount,
      duplicateGroupsDetected: deduplicated.duplicateGroupsDetected,
      totalCandidatesScanned: radiusCandidates.length,
      totalMatched: matchedListings.length,
      returnedCount: rankedListings.length,
      durationMs: Date.now() - startedAt,
      warnings,
      suggestions: buildSuggestions(request, matchedListings.length),
      rejectionSummary: combinedRejectionSummary,
      searchOrigin
    }
  };

  dependencies.metrics.recordSearch({
    durationMs: response.metadata.durationMs,
    candidatesScanned: response.metadata.totalCandidatesScanned,
    matchesReturned: response.metadata.returnedCount,
    scores: response.homes.map((home) => home.scores.nhalo)
  });
  dependencies.metrics.recordListingResultsReturned(response.metadata.returnedCount);
  dependencies.metrics.recordListingQuality({
    failures: qualityGate.qualityFailures,
    totalCandidates: candidates.length
  });
  dependencies.metrics.recordDeduplication({
    deduplicated: deduplicated.deduplicatedCount,
    totalCandidates: qualityGate.listings.length
  });
  dependencies.metrics.recordRejectionCounts({
    outsideRadius: deduplicated.listings.length - radiusCandidates.length,
    duplicate: deduplicated.deduplicatedCount,
    invalidListing: qualityGate.qualityFailures
  });
  dependencies.metrics.recordRankingTies(countRankingTies(rankedListings));
  dependencies.metrics.recordActiveListingRatio({
    active: qualityGate.activeEligibleCount,
    eligible: qualityGate.listings.length
  });

  await dependencies.repository.saveSearch({
    request,
    response,
    resolvedLocation,
    listings: radiusCandidates,
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
      canonicalPropertyId: ranked.listing.canonicalPropertyId ?? null,
      distanceMiles: distanceByPropertyId.get(ranked.listing.id) ?? null,
      insideRequestedRadius: true,
      comparableSampleSize: Number(ranked.scoreInputs.comparableSampleSize ?? radiusCandidates.length),
      comparableStrategyUsed: String(ranked.scoreInputs.comparableStrategyUsed ?? "local_radius_fallback"),
      deduplicationDecision: String(ranked.scoreInputs.deduplicationDecision ?? "selected"),
      qualityGateDecision: String(ranked.scoreInputs.qualityGateDecision ?? "passed"),
      rankingTieBreakInputs:
        (ranked.scoreInputs.rankingTieBreakInputs as Record<string, unknown> | null) ?? null,
      resultQualityFlags:
        (ranked.scoreInputs.resultQualityFlags as string[] | undefined) ?? ranked.qualityFlags ?? [],
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
