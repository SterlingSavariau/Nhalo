import { DEFAULT_RESULT_LIMIT } from "@nhalo/config";
import { rankListings } from "@nhalo/scoring";
import type {
  GeocoderProvider,
  ListingProvider,
  ListingRecord,
  RankedListing,
  SearchRepository,
  SearchResponse,
  SearchSuggestion,
  SearchWarning,
  SafetyProvider
} from "@nhalo/types";
import { ApiError } from "./errors";
import type { SearchRequestInput } from "./search-schema";

export interface SearchServiceDependencies {
  geocoder: GeocoderProvider;
  listingProvider: ListingProvider;
  safetyProvider: SafetyProvider;
  repository: SearchRepository;
}

function applyHardFilters(
  listings: ListingRecord[],
  request: SearchRequestInput
): ListingRecord[] {
  return listings.filter((listing) => {
    const budgetPass =
      typeof request.budget?.max !== "number" || listing.price <= request.budget.max;
    const sqftPass =
      typeof request.minSqft !== "number" || listing.sqft >= request.minSqft;
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
    sqft: ranked.listing.sqft,
    bedrooms: ranked.listing.bedrooms,
    bathrooms: ranked.listing.bathrooms,
    lotSqft: ranked.listing.lotSqft,
    sourceUrl: ranked.listing.sourceUrl,
    neighborhoodSafetyScore: ranked.scores.safety,
    explanation: ranked.explanation,
    scores: ranked.scores
  };
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
  const safetyByPropertyId = await dependencies.safetyProvider.fetchSafetyData(candidates);
  const matchedListings = applyHardFilters(candidates, request);
  const rankedListings = rankListings(matchedListings, {
    budget: request.budget,
    comparableListings: candidates,
    minBedrooms: request.minBedrooms,
    minSqft: request.minSqft,
    safetyByPropertyId,
    weights: request.weights
  }).slice(0, DEFAULT_RESULT_LIMIT);
  const response: SearchResponse = {
    homes: rankedListings.map(mapRankedHome),
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
      warnings: buildWarnings(matchedListings.length),
      suggestions: buildSuggestions(request, matchedListings.length)
    }
  };

  await dependencies.repository.saveSearch({
    request,
    response,
    resolvedLocation,
    listings: candidates,
    scoredResults: rankedListings.map((ranked) => ({
      propertyId: ranked.listing.id,
      formulaVersion: ranked.scores.formulaVersion,
      explanation: ranked.explanation,
      scores: ranked.scores,
      scoreInputs: ranked.scoreInputs
    }))
  });

  return response;
}
