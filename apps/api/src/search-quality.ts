import {
  DEFAULT_ALLOWED_LISTING_STATUSES,
  DEFAULT_COMPARABLE_BEDROOM_TOLERANCE,
  DEFAULT_COMPARABLE_SQFT_TOLERANCE_PERCENT,
  DEFAULT_MIN_COMPARABLE_SAMPLE_SIZE
} from "@nhalo/config";
import type {
  ListingRecord,
  ListingRejectionSummary,
  SearchOriginMetadata
} from "@nhalo/types";
import type { SearchRequestInput } from "./search-schema";

export interface EnrichedListing extends ListingRecord {
  canonicalPropertyId: string;
  normalizedAddress: string;
}

export interface SearchQualityConfig {
  allowedListingStatuses?: string[];
  comparableSqftTolerancePercent?: number;
  comparableBedroomTolerance?: number;
  minComparableSampleSize?: number;
}

export interface ComparableSelection {
  listings: EnrichedListing[];
  strategyUsed: string;
}

export function createEmptyRejectionSummary(): ListingRejectionSummary {
  return {
    outsideRadius: 0,
    aboveBudget: 0,
    belowSqft: 0,
    belowBedrooms: 0,
    wrongPropertyType: 0,
    duplicate: 0,
    invalidPrice: 0,
    duplicateListings: 0,
    invalidCoordinates: 0,
    missingAddress: 0,
    missingPrice: 0,
    missingSquareFootage: 0,
    unsupportedPropertyType: 0,
    malformedListing: 0,
    unsupportedListingStatus: 0,
    normalizationFailures: 0
  };
}

export function addRejectionCounts(
  left: ListingRejectionSummary,
  right: Partial<ListingRejectionSummary>
): ListingRejectionSummary {
  return {
    ...left,
    outsideRadius: left.outsideRadius + (right.outsideRadius ?? 0),
    aboveBudget: left.aboveBudget + (right.aboveBudget ?? 0),
    belowSqft: left.belowSqft + (right.belowSqft ?? 0),
    belowBedrooms: left.belowBedrooms + (right.belowBedrooms ?? 0),
    wrongPropertyType: left.wrongPropertyType + (right.wrongPropertyType ?? 0),
    duplicate: left.duplicate + (right.duplicate ?? 0),
    invalidPrice: left.invalidPrice + (right.invalidPrice ?? 0),
    duplicateListings: left.duplicateListings + (right.duplicateListings ?? 0),
    invalidCoordinates: left.invalidCoordinates + (right.invalidCoordinates ?? 0),
    missingAddress: left.missingAddress + (right.missingAddress ?? 0),
    missingPrice: left.missingPrice + (right.missingPrice ?? 0),
    missingSquareFootage: left.missingSquareFootage + (right.missingSquareFootage ?? 0),
    unsupportedPropertyType: left.unsupportedPropertyType + (right.unsupportedPropertyType ?? 0),
    malformedListing: left.malformedListing + (right.malformedListing ?? 0),
    unsupportedListingStatus: left.unsupportedListingStatus + (right.unsupportedListingStatus ?? 0),
    normalizationFailures: left.normalizationFailures + (right.normalizationFailures ?? 0)
  };
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeAddress(value: string): string {
  return normalizeText(value)
    .replace(/\bstreet\b/g, "st")
    .replace(/\broad\b/g, "rd")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\bdrive\b/g, "dr")
    .replace(/\bcourt\b/g, "ct")
    .replace(/\bunit\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function roundedCoordinate(value: number): string {
  return value.toFixed(4);
}

function dataSourceRank(source: ListingRecord["listingDataSource"]): number {
  switch (source) {
    case "live":
      return 0;
    case "cached_live":
      return 1;
    case "stale_cached_live":
      return 2;
    case "mock":
      return 3;
    default:
      return 4;
  }
}

export function buildCanonicalPropertyId(listing: ListingRecord): string {
  const normalizedAddress = normalizeAddress(listing.address ?? "");
  return [
    normalizedAddress,
    normalizeText(listing.city),
    normalizeText(listing.state),
    listing.zipCode.trim(),
    roundedCoordinate(listing.latitude),
    roundedCoordinate(listing.longitude)
  ].join("|");
}

export function enrichListing(listing: ListingRecord): EnrichedListing {
  const normalizedAddress = normalizeAddress(listing.address ?? "");
  return {
    ...listing,
    canonicalPropertyId: listing.canonicalPropertyId ?? buildCanonicalPropertyId(listing),
    normalizedAddress: listing.normalizedAddress ?? normalizedAddress
  };
}

export function applyQualityGate(
  listings: ListingRecord[],
  config?: SearchQualityConfig
): {
  listings: EnrichedListing[];
  rejectionSummary: ListingRejectionSummary;
  qualityFailures: number;
  activeEligibleCount: number;
} {
  const rejectionSummary = createEmptyRejectionSummary();
  const allowedStatuses = new Set(
    (config?.allowedListingStatuses ?? [...DEFAULT_ALLOWED_LISTING_STATUSES]).map((value) =>
      value.trim().toLowerCase()
    )
  );
  const passed: EnrichedListing[] = [];

  for (const rawListing of listings) {
    const listing = enrichListing(rawListing);
    let rejected = false;

    if (!Number.isFinite(listing.price) || listing.price <= 0) {
      rejectionSummary.invalidPrice += 1;
      rejected = true;
    }

    if (
      !Number.isFinite(listing.latitude) ||
      !Number.isFinite(listing.longitude) ||
      listing.latitude < -90 ||
      listing.latitude > 90 ||
      listing.longitude < -180 ||
      listing.longitude > 180
    ) {
      rejectionSummary.invalidCoordinates += 1;
      rejected = true;
    }

    if (!listing.address || !listing.city || !listing.state || !listing.zipCode || !listing.normalizedAddress) {
      rejectionSummary.missingAddress += 1;
      rejected = true;
    }

    if (!listing.propertyType || listing.propertyType === "multi_family") {
      rejectionSummary.unsupportedPropertyType += 1;
      rejected = true;
    }

    if (!allowedStatuses.has(listing.listingStatus)) {
      rejectionSummary.unsupportedListingStatus += 1;
      rejected = true;
    }

    if (listing.squareFootage <= 0 || listing.bedrooms < 0 || listing.bathrooms < 0) {
      rejectionSummary.malformedListing += 1;
      rejected = true;
    }

    if (!rejected) {
      passed.push(listing);
    }
  }

  return {
    listings: passed,
    rejectionSummary,
    qualityFailures:
      rejectionSummary.invalidPrice +
      rejectionSummary.invalidCoordinates +
      rejectionSummary.missingAddress +
      rejectionSummary.unsupportedPropertyType +
      rejectionSummary.unsupportedListingStatus +
      rejectionSummary.malformedListing,
    activeEligibleCount: passed.filter((listing) => listing.listingStatus === "active").length
  };
}

function pickPreferredListing(group: EnrichedListing[]): EnrichedListing {
  return [...group].sort((left, right) => {
    const sourceDelta = dataSourceRank(left.listingDataSource) - dataSourceRank(right.listingDataSource);
    if (sourceDelta !== 0) {
      return sourceDelta;
    }

    const freshnessDelta = right.fetchedAt.localeCompare(left.fetchedAt);
    if (freshnessDelta !== 0) {
      return freshnessDelta;
    }

    const completenessDelta =
      Number(Boolean(right.lotSqft)) +
      right.bedrooms +
      right.bathrooms -
      (Number(Boolean(left.lotSqft)) + left.bedrooms + left.bathrooms);
    if (completenessDelta !== 0) {
      return completenessDelta > 0 ? 1 : -1;
    }

    const providerDelta = left.sourceProvider.localeCompare(right.sourceProvider);
    if (providerDelta !== 0) {
      return providerDelta;
    }

    const sourceListingDelta = left.sourceListingId.localeCompare(right.sourceListingId);
    if (sourceListingDelta !== 0) {
      return sourceListingDelta;
    }

    return left.id.localeCompare(right.id);
  })[0];
}

export function deduplicateListings(listings: EnrichedListing[]): {
  listings: EnrichedListing[];
  deduplicatedCount: number;
  duplicateGroupsDetected: number;
  duplicateIds: Set<string>;
} {
  const grouped = new Map<string, EnrichedListing[]>();

  for (const listing of listings) {
    const group = grouped.get(listing.canonicalPropertyId) ?? [];
    group.push(listing);
    grouped.set(listing.canonicalPropertyId, group);
  }

  const deduped: EnrichedListing[] = [];
  const duplicateIds = new Set<string>();
  let duplicateGroupsDetected = 0;

  for (const group of [...grouped.values()].sort((left, right) =>
    left[0].canonicalPropertyId.localeCompare(right[0].canonicalPropertyId)
  )) {
    const selected = pickPreferredListing(group);
    deduped.push(selected);
    if (group.length > 1) {
      duplicateGroupsDetected += 1;
      for (const listing of group) {
        if (listing.id !== selected.id) {
          duplicateIds.add(listing.id);
        }
      }
    }
  }

  return {
    listings: deduped,
    deduplicatedCount: duplicateIds.size,
    duplicateGroupsDetected,
    duplicateIds
  };
}

export function applyHardFiltersWithSummary(
  listings: EnrichedListing[],
  request: SearchRequestInput
): {
  listings: EnrichedListing[];
  rejectionSummary: ListingRejectionSummary;
} {
  const rejectionSummary = createEmptyRejectionSummary();
  const matched = listings.filter((listing) => {
    let passes = true;

    if (typeof request.budget?.max === "number" && listing.price > request.budget.max) {
      rejectionSummary.aboveBudget += 1;
      passes = false;
    }
    if (typeof request.minSqft === "number" && listing.squareFootage < request.minSqft) {
      rejectionSummary.belowSqft += 1;
      passes = false;
    }
    if (typeof request.minBedrooms === "number" && listing.bedrooms < request.minBedrooms) {
      rejectionSummary.belowBedrooms += 1;
      passes = false;
    }
    if (!request.propertyTypes.includes(listing.propertyType)) {
      rejectionSummary.wrongPropertyType += 1;
      passes = false;
    }

    return passes;
  });

  return {
    listings: matched,
    rejectionSummary
  };
}

function compatiblePropertyType(left: ListingRecord["propertyType"], right: ListingRecord["propertyType"]): boolean {
  if (left === right) {
    return true;
  }

  return (
    (left === "townhome" && right === "condo") ||
    (left === "condo" && right === "townhome")
  );
}

export function selectComparableListings(
  listing: EnrichedListing,
  candidates: EnrichedListing[],
  config?: SearchQualityConfig
): ComparableSelection {
  const sqftTolerancePercent =
    config?.comparableSqftTolerancePercent ?? DEFAULT_COMPARABLE_SQFT_TOLERANCE_PERCENT;
  const bedroomTolerance = config?.comparableBedroomTolerance ?? DEFAULT_COMPARABLE_BEDROOM_TOLERANCE;
  const minComparableSampleSize = config?.minComparableSampleSize ?? DEFAULT_MIN_COMPARABLE_SAMPLE_SIZE;

  const strict = candidates.filter(
    (candidate) =>
      compatiblePropertyType(candidate.propertyType, listing.propertyType) &&
      Math.abs(candidate.squareFootage - listing.squareFootage) <=
        Math.max(listing.squareFootage, 1) * (sqftTolerancePercent / 100) &&
      Math.abs(candidate.bedrooms - listing.bedrooms) <= bedroomTolerance
  );

  if (strict.length >= minComparableSampleSize) {
    return {
      listings: strict,
      strategyUsed: "strict"
    };
  }

  const typeOnly = candidates.filter((candidate) =>
    compatiblePropertyType(candidate.propertyType, listing.propertyType)
  );
  if (typeOnly.length >= minComparableSampleSize) {
    return {
      listings: typeOnly,
      strategyUsed: "property_type_fallback"
    };
  }

  return {
    listings: candidates,
    strategyUsed: "local_radius_fallback"
  };
}

export function buildQualityFlags(args: {
  listing: EnrichedListing;
  safetyDataSource?: string | null;
  dataCompleteness: number;
  comparableSampleSize: number;
  comparableStrategyUsed: string;
  minComparableSampleSize?: number;
  searchOrigin?: SearchOriginMetadata;
}): string[] {
  const flags = new Set<string>();

  if (args.comparableSampleSize < (args.minComparableSampleSize ?? DEFAULT_MIN_COMPARABLE_SAMPLE_SIZE)) {
    flags.add("limitedComparables");
  }
  if (args.listing.listingDataSource === "stale_cached_live") {
    flags.add("staleListingData");
  }
  if (args.safetyDataSource === "stale_cached_live") {
    flags.add("staleSafetyData");
  }
  if (
    args.searchOrigin &&
    (args.searchOrigin.precision === "approximate" ||
      args.searchOrigin.precision === "centroid" ||
      args.searchOrigin.precision === "range_interpolated")
  ) {
    flags.add("approximateSearchOrigin");
  }
  if (args.dataCompleteness < 100) {
    flags.add("partialSafetyData");
  }
  if (
    args.listing.listingDataSource === "mock" ||
    args.safetyDataSource === "mock" ||
    args.searchOrigin?.geocodeDataSource === "mock"
  ) {
    flags.add("mockFallbackUsed");
  }
  if (args.comparableStrategyUsed !== "strict") {
    flags.add("limitedComparables");
  }

  return [...flags].sort();
}

export function countRankingTies(listings: Array<{
  scores: { nhalo: number; safety: number; price: number; size: number };
}>): number {
  let ties = 0;

  for (let index = 1; index < listings.length; index += 1) {
    const current = listings[index];
    const previous = listings[index - 1];
    if (
      current.scores.nhalo === previous.scores.nhalo &&
      current.scores.safety === previous.scores.safety &&
      current.scores.price === previous.scores.price &&
      current.scores.size === previous.scores.size
    ) {
      ties += 1;
    }
  }

  return ties;
}
