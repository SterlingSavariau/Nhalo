import type { DataQualityConfig } from "@nhalo/config";
import type {
  DataQualityEvent,
  ListingRecord,
  ListingRejectionSummary,
  ResolvedLocation,
  SafetyRecord,
  ScoredHome,
  SearchOriginMetadata,
  SearchRequest
} from "@nhalo/types";

type PendingQualityEvent = Omit<DataQualityEvent, "id" | "createdAt" | "updatedAt" | "searchRequestId">;

type PropertyQualitySummary = {
  integrityFlags: string[];
  dataWarnings: string[];
  degradedReasons: string[];
};

export interface SearchDataQualityEvaluationResult {
  events: PendingQualityEvent[];
  byPropertyId: Map<string, PropertyQualitySummary>;
  integritySummary: {
    totalEvents: number;
    criticalEvents: number;
    categories: string[];
    staleTopResults: number;
  };
}

type EvaluateArgs = {
  request: SearchRequest;
  sessionId?: string | null;
  partnerId?: string | null;
  resolvedLocation: ResolvedLocation;
  searchOrigin: SearchOriginMetadata;
  candidatesRetrieved: number;
  normalizationRejections: ListingRejectionSummary;
  deduplicatedListings: ListingRecord[];
  radiusCandidates: ListingRecord[];
  matchedListings: ListingRecord[];
  safetyByPropertyId: Map<string, SafetyRecord>;
  homes: ScoredHome[];
  distanceByPropertyId: Map<string, number>;
  dataQualityConfig: DataQualityConfig;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function buildEvent(
  args: Omit<PendingQualityEvent, "triggeredAt" | "status"> & {
    triggeredAt?: string;
    status?: PendingQualityEvent["status"];
  }
): PendingQualityEvent {
  return {
    status: args.status ?? "open",
    triggeredAt: args.triggeredAt ?? new Date().toISOString(),
    ...args
  };
}

function appendPropertyMessage(
  summaries: Map<string, PropertyQualitySummary>,
  propertyId: string,
  field: keyof PropertyQualitySummary,
  value: string
): void {
  const existing = summaries.get(propertyId) ?? {
    integrityFlags: [],
    dataWarnings: [],
    degradedReasons: []
  };

  if (!existing[field].includes(value)) {
    existing[field].push(value);
  }

  summaries.set(propertyId, existing);
}

function groupKey(listing: ListingRecord): string {
  return (
    listing.canonicalPropertyId ??
    `${listing.normalizedAddress ?? listing.address.toLowerCase()}|${listing.zipCode}|${listing.latitude.toFixed(4)}|${listing.longitude.toFixed(4)}`
  );
}

export function evaluateSearchDataQuality(args: EvaluateArgs): SearchDataQualityEvaluationResult {
  const events: PendingQualityEvent[] = [];
  const byPropertyId = new Map<string, PropertyQualitySummary>();
  const nowIso = new Date().toISOString();
  const topHomes = args.homes.slice(0, 3);

  if (!isFiniteNumber(args.resolvedLocation.latitude) || !isFiniteNumber(args.resolvedLocation.longitude)) {
    events.push(
      buildEvent({
        ruleId: "geocode.invalid_coordinates",
        sourceDomain: "geocode",
        severity: "critical",
        category: "invalid_coordinates",
        message: "Resolved geocode returned invalid coordinates.",
        targetType: "geocode",
        targetId: args.request.locationValue,
        partnerId: args.partnerId ?? null,
        sessionId: args.sessionId ?? null,
        provider: args.resolvedLocation.provider ?? null,
        context: {
          latitude: args.resolvedLocation.latitude,
          longitude: args.resolvedLocation.longitude
        },
        triggeredAt: nowIso
      })
    );
  }

  if (
    args.request.locationType === "address" &&
    !args.dataQualityConfig.lowPrecisionAddressAllowed &&
    ["approximate", "centroid", "range_interpolated", "mock", "none"].includes(
      args.searchOrigin.precision
    )
  ) {
    events.push(
      buildEvent({
        ruleId: "geocode.precision_too_low",
        sourceDomain: "geocode",
        severity: "warn",
        category: "geocode_precision_too_low",
        message: "Address search resolved with lower precision than expected.",
        targetType: "geocode",
        targetId: args.request.locationValue,
        partnerId: args.partnerId ?? null,
        sessionId: args.sessionId ?? null,
        provider: args.searchOrigin.geocodeProvider ?? null,
        context: {
          locationType: args.request.locationType,
          precision: args.searchOrigin.precision,
          geocodeDataSource: args.searchOrigin.geocodeDataSource
        },
        triggeredAt: nowIso
      })
    );
  }

  if (args.searchOrigin.geocodeDataSource === "stale_cached_live") {
    events.push(
      buildEvent({
        ruleId: "geocode.stale_cache",
        sourceDomain: "geocode",
        severity: "warn",
        category: "stale_geocode_data",
        message: "Search origin used stale cached geocode data.",
        targetType: "geocode",
        targetId: args.request.locationValue,
        partnerId: args.partnerId ?? null,
        sessionId: args.sessionId ?? null,
        provider: args.searchOrigin.geocodeProvider ?? null,
        context: {
          geocodeFetchedAt: args.searchOrigin.geocodeFetchedAt
        },
        triggeredAt: nowIso
      })
    );
  }

  for (const listing of args.deduplicatedListings) {
    if (!isFiniteNumber(listing.price) || listing.price <= 0) {
      events.push(
        buildEvent({
          ruleId: "listing.invalid_price",
          sourceDomain: "listing",
          severity: "critical",
          category: "invalid_listing_price",
          message: "Listing has a non-positive price.",
          targetType: "listing",
          targetId: listing.id,
          partnerId: args.partnerId ?? null,
          sessionId: args.sessionId ?? null,
          provider: listing.sourceProvider ?? null,
          context: { price: listing.price },
          triggeredAt: nowIso
        })
      );
      appendPropertyMessage(byPropertyId, listing.id, "integrityFlags", "invalidListingPrice");
    }

    if (listing.squareFootage < 200 || listing.squareFootage > 20000) {
      events.push(
        buildEvent({
          ruleId: "listing.unrealistic_square_footage",
          sourceDomain: "listing",
          severity: "warn",
          category: "unrealistic_square_footage",
          message: "Listing square footage falls outside normal home ranges.",
          targetType: "listing",
          targetId: listing.id,
          partnerId: args.partnerId ?? null,
          sessionId: args.sessionId ?? null,
          provider: listing.sourceProvider ?? null,
          context: { squareFootage: listing.squareFootage },
          triggeredAt: nowIso
        })
      );
      appendPropertyMessage(byPropertyId, listing.id, "dataWarnings", "Square footage looks unusual.");
    }

    if (listing.bedrooms > 0 && listing.squareFootage > 0 && listing.bedrooms > Math.ceil(listing.squareFootage / 120)) {
      events.push(
        buildEvent({
          ruleId: "listing.impossible_room_configuration",
          sourceDomain: "listing",
          severity: "warn",
          category: "impossible_bedroom_bathroom_combination",
          message: "Listing bedroom count looks inconsistent with square footage.",
          targetType: "listing",
          targetId: listing.id,
          partnerId: args.partnerId ?? null,
          sessionId: args.sessionId ?? null,
          provider: listing.sourceProvider ?? null,
          context: {
            bedrooms: listing.bedrooms,
            bathrooms: listing.bathrooms,
            squareFootage: listing.squareFootage
          },
          triggeredAt: nowIso
        })
      );
      appendPropertyMessage(byPropertyId, listing.id, "dataWarnings", "Room counts may be inconsistent.");
    }

    if (!listing.address || !listing.city || !listing.state || !listing.zipCode) {
      events.push(
        buildEvent({
          ruleId: "listing.missing_address_components",
          sourceDomain: "listing",
          severity: "error",
          category: "missing_address",
          message: "Listing is missing address components needed for display or identity.",
          targetType: "listing",
          targetId: listing.id,
          partnerId: args.partnerId ?? null,
          sessionId: args.sessionId ?? null,
          provider: listing.sourceProvider ?? null,
          context: {
            address: listing.address,
            city: listing.city,
            state: listing.state,
            zipCode: listing.zipCode
          },
          triggeredAt: nowIso
        })
      );
      appendPropertyMessage(byPropertyId, listing.id, "integrityFlags", "missingAddressComponents");
    }

    if (
      !isFiniteNumber(listing.latitude) ||
      !isFiniteNumber(listing.longitude) ||
      Math.abs(listing.latitude) > 90 ||
      Math.abs(listing.longitude) > 180
    ) {
      events.push(
        buildEvent({
          ruleId: "listing.invalid_coordinates",
          sourceDomain: "listing",
          severity: "critical",
          category: "invalid_coordinates",
          message: "Listing has invalid coordinates.",
          targetType: "listing",
          targetId: listing.id,
          partnerId: args.partnerId ?? null,
          sessionId: args.sessionId ?? null,
          provider: listing.sourceProvider ?? null,
          context: {
            latitude: listing.latitude,
            longitude: listing.longitude
          },
          triggeredAt: nowIso
        })
      );
      appendPropertyMessage(byPropertyId, listing.id, "integrityFlags", "invalidCoordinates");
    }

    if (listing.listingStatus === "unknown" || listing.listingStatus === "off_market") {
      events.push(
        buildEvent({
          ruleId: "listing.unsupported_status",
          sourceDomain: "listing",
          severity: "warn",
          category: "unsupported_listing_status",
          message: "Listing status is not clearly eligible for ranking.",
          targetType: "listing",
          targetId: listing.id,
          partnerId: args.partnerId ?? null,
          sessionId: args.sessionId ?? null,
          provider: listing.sourceProvider ?? null,
          context: {
            listingStatus: listing.listingStatus
          },
          triggeredAt: nowIso
        })
      );
      appendPropertyMessage(byPropertyId, listing.id, "dataWarnings", "Listing status is not fully reliable.");
    }

    if (listing.pricePerSqft > args.dataQualityConfig.maxPricePerSqft) {
      events.push(
        buildEvent({
          ruleId: "listing.price_per_sqft_outlier",
          sourceDomain: "listing",
          severity: "warn",
          category: "score_input_outlier",
          message: "Listing price per square foot is an extreme outlier.",
          targetType: "listing",
          targetId: listing.id,
          partnerId: args.partnerId ?? null,
          sessionId: args.sessionId ?? null,
          provider: listing.sourceProvider ?? null,
          context: {
            pricePerSqft: listing.pricePerSqft,
            maxPricePerSqft: args.dataQualityConfig.maxPricePerSqft
          },
          triggeredAt: nowIso
        })
      );
      appendPropertyMessage(byPropertyId, listing.id, "dataWarnings", "Price per square foot is unusually high.");
    }

    if (listing.listingDataSource === "stale_cached_live") {
      events.push(
        buildEvent({
          ruleId: "listing.stale_data",
          sourceDomain: "listing",
          severity: "warn",
          category: "stale_listing_data",
          message: "Listing is using stale cached listing data.",
          targetType: "listing",
          targetId: listing.id,
          partnerId: args.partnerId ?? null,
          sessionId: args.sessionId ?? null,
          provider: listing.sourceProvider ?? null,
          context: {
            fetchedAt: listing.fetchedAt
          },
          triggeredAt: nowIso
        })
      );
      appendPropertyMessage(byPropertyId, listing.id, "degradedReasons", "Listing data is stale.");
    }
  }

  const duplicateGroups = new Map<string, ListingRecord[]>();
  for (const listing of args.radiusCandidates) {
    const key = groupKey(listing);
    const group = duplicateGroups.get(key) ?? [];
    group.push(listing);
    duplicateGroups.set(key, group);
  }
  for (const [key, group] of duplicateGroups.entries()) {
    if (group.length < 2) {
      continue;
    }
    const prices = new Set(group.map((listing) => listing.price));
    const sqft = new Set(group.map((listing) => listing.squareFootage));
    if (prices.size > 1 || sqft.size > 1) {
      events.push(
        buildEvent({
          ruleId: "listing.duplicate_conflict",
          sourceDomain: "listing",
          severity: "error",
          category: "duplicate_listing_conflict",
          message: "Duplicate provider records disagree on key listing values.",
          targetType: "property",
          targetId: key,
          partnerId: args.partnerId ?? null,
          sessionId: args.sessionId ?? null,
          provider: group[0]?.sourceProvider ?? null,
          context: {
            listingIds: group.map((listing) => listing.id),
            prices: [...prices],
            squareFootage: [...sqft]
          },
          triggeredAt: nowIso
        })
      );
    }
  }

  for (const listing of args.matchedListings) {
    const safety = args.safetyByPropertyId.get(listing.id);

    if (!safety) {
      events.push(
        buildEvent({
          ruleId: "safety.missing_all",
          sourceDomain: "safety",
          severity: "error",
          category: "missing_required_safety_components",
          message: "No safety record was available for a ranked listing.",
          targetType: "property",
          targetId: listing.id,
          partnerId: args.partnerId ?? null,
          sessionId: args.sessionId ?? null,
          provider: null,
          context: null,
          triggeredAt: nowIso
        })
      );
      appendPropertyMessage(byPropertyId, listing.id, "degradedReasons", "Safety data is missing.");
      continue;
    }

    if (safety.crimeIndex == null) {
      events.push(
        buildEvent({
          ruleId: "safety.missing_crime",
          sourceDomain: "safety",
          severity: "warn",
          category: "missing_crime_signal",
          message: "Crime signal is missing for a ranked listing.",
          targetType: "property",
          targetId: listing.id,
          partnerId: args.partnerId ?? null,
          sessionId: args.sessionId ?? null,
          provider: safety.crimeProvider ?? null,
          context: null,
          triggeredAt: nowIso
        })
      );
      appendPropertyMessage(byPropertyId, listing.id, "degradedReasons", "Crime data is missing.");
    }

    if (safety.schoolRating == null) {
      events.push(
        buildEvent({
          ruleId: "safety.missing_school",
          sourceDomain: "safety",
          severity: "warn",
          category: "missing_school_signal",
          message: "School signal is missing for a ranked listing.",
          targetType: "property",
          targetId: listing.id,
          partnerId: args.partnerId ?? null,
          sessionId: args.sessionId ?? null,
          provider: safety.schoolProvider ?? null,
          context: null,
          triggeredAt: nowIso
        })
      );
      appendPropertyMessage(byPropertyId, listing.id, "degradedReasons", "School data is missing.");
    }

    for (const [field, value] of [
      ["crimeIndex", safety.crimeIndex],
      ["schoolRating", safety.schoolRating],
      ["stabilityIndex", safety.stabilityIndex]
    ] as const) {
      if (value != null && (value < 0 || value > 100)) {
        events.push(
          buildEvent({
            ruleId: "safety.out_of_range",
            sourceDomain: "safety",
            severity: "error",
            category: "out_of_range_normalized_value",
            message: "A normalized safety signal is outside the expected 0-100 range.",
            targetType: "property",
            targetId: listing.id,
            partnerId: args.partnerId ?? null,
            sessionId: args.sessionId ?? null,
            provider: safety.source ?? null,
            context: {
              field,
              value
            },
            triggeredAt: nowIso
          })
        );
        appendPropertyMessage(byPropertyId, listing.id, "integrityFlags", "outOfRangeSafetySignal");
      }
    }

    if (safety.safetyDataSource === "stale_cached_live") {
      events.push(
        buildEvent({
          ruleId: "safety.stale_data",
          sourceDomain: "safety",
          severity: "warn",
          category: "stale_safety_data",
          message: "Safety inputs are using stale cached provider data.",
          targetType: "property",
          targetId: listing.id,
          partnerId: args.partnerId ?? null,
          sessionId: args.sessionId ?? null,
          provider: safety.source ?? null,
          context: {
            updatedAt: safety.updatedAt
          },
          triggeredAt: nowIso
        })
      );
      appendPropertyMessage(byPropertyId, listing.id, "degradedReasons", "Safety data is stale.");
    }
  }

  const returnedCanonicalIds = new Set<string>();
  for (const home of args.homes) {
    if ((home.distanceMiles ?? Number.POSITIVE_INFINITY) > (args.request.radiusMiles ?? 0.0001) || home.insideRequestedRadius === false) {
      events.push(
        buildEvent({
          ruleId: "search.radius_filter_anomaly",
          sourceDomain: "search",
          severity: "critical",
          category: "radius_filter_anomaly",
          message: "A ranked home fell outside the requested radius.",
          targetType: "search_result",
          targetId: home.id,
          partnerId: args.partnerId ?? null,
          sessionId: args.sessionId ?? null,
          provider: home.listingProvider ?? null,
          context: {
            distanceMiles: home.distanceMiles,
            radiusMiles: args.request.radiusMiles
          },
          triggeredAt: nowIso
        })
      );
      appendPropertyMessage(byPropertyId, home.id, "integrityFlags", "outsideRequestedRadius");
    }

    if (home.canonicalPropertyId) {
      if (returnedCanonicalIds.has(home.canonicalPropertyId)) {
        events.push(
          buildEvent({
            ruleId: "search.duplicate_ranked_property",
            sourceDomain: "search",
            severity: "critical",
            category: "duplicate_canonical_property",
            message: "The ranked result set contains duplicate canonical properties.",
            targetType: "search_result",
            targetId: home.canonicalPropertyId,
            partnerId: args.partnerId ?? null,
            sessionId: args.sessionId ?? null,
            provider: home.listingProvider ?? null,
            context: {
              propertyId: home.id
            },
            triggeredAt: nowIso
          })
        );
      } else {
        returnedCanonicalIds.add(home.canonicalPropertyId);
      }
    }

    if (!home.provenance || !home.scores.overallConfidence) {
      events.push(
        buildEvent({
          ruleId: "search.missing_provenance",
          sourceDomain: "search",
          severity: "error",
          category: "missing_confidence_or_provenance",
          message: "A ranked home is missing provenance or confidence context.",
          targetType: "search_result",
          targetId: home.id,
          partnerId: args.partnerId ?? null,
          sessionId: args.sessionId ?? null,
          provider: home.listingProvider ?? null,
          context: null,
          triggeredAt: nowIso
        })
      );
    }

    if ((home.qualityFlags ?? []).includes("limitedComparables")) {
      events.push(
        buildEvent({
          ruleId: "search.limited_comparables",
          sourceDomain: "search",
          severity: "warn",
          category: "limited_comparable_sample",
          message: "This result used a limited comparable set.",
          targetType: "search_result",
          targetId: home.id,
          partnerId: args.partnerId ?? null,
          sessionId: args.sessionId ?? null,
          provider: home.listingProvider ?? null,
          context: {
            qualityFlags: home.qualityFlags ?? []
          },
          triggeredAt: nowIso
        })
      );
      appendPropertyMessage(byPropertyId, home.id, "dataWarnings", "Comparable sample is limited.");
    }
  }

  for (const home of topHomes) {
    const stale = (home.qualityFlags ?? []).includes("staleListingData") || (home.qualityFlags ?? []).includes("staleSafetyData");
    if (stale) {
      events.push(
        buildEvent({
          ruleId: "search.stale_top_result",
          sourceDomain: "search",
          severity: "warn",
          category: "stale_data_top_result",
          message: "A top-ranked result depends on stale provider data.",
          targetType: "search_result",
          targetId: home.id,
          partnerId: args.partnerId ?? null,
          sessionId: args.sessionId ?? null,
          provider: home.listingProvider ?? null,
          context: {
            qualityFlags: home.qualityFlags ?? []
          },
          triggeredAt: nowIso
        })
      );
      appendPropertyMessage(byPropertyId, home.id, "degradedReasons", "Top result uses stale provider data.");
    }

    if (home.scores.overallConfidence === "low" || home.scores.overallConfidence === "none") {
      events.push(
        buildEvent({
          ruleId: "search.degraded_top_result",
          sourceDomain: "search",
          severity: "warn",
          category: "top_result_degraded_signals",
          message: "A top-ranked result relies on degraded or missing signals.",
          targetType: "search_result",
          targetId: home.id,
          partnerId: args.partnerId ?? null,
          sessionId: args.sessionId ?? null,
          provider: home.listingProvider ?? null,
          context: {
            overallConfidence: home.scores.overallConfidence
          },
          triggeredAt: nowIso
        })
      );
    }
  }

  const missingFieldRejections =
    args.normalizationRejections.missingAddress +
    args.normalizationRejections.missingPrice +
    args.normalizationRejections.missingSquareFootage;
  if (args.candidatesRetrieved > 0 && missingFieldRejections / args.candidatesRetrieved >= 0.25) {
    events.push(
      buildEvent({
        ruleId: "provider_drift.listing_missing_fields",
        sourceDomain: "listing",
        severity: "warn",
        category: "provider_drift_missing_fields",
        message: "Listing provider is returning an elevated rate of missing critical fields.",
        targetType: "provider",
        targetId: "listing-provider",
        partnerId: args.partnerId ?? null,
        sessionId: args.sessionId ?? null,
        provider: args.radiusCandidates[0]?.sourceProvider ?? null,
        context: {
          candidatesRetrieved: args.candidatesRetrieved,
          missingFieldRejections
        },
        triggeredAt: nowIso
      })
    );
  }

  const missingSafetySignals = args.matchedListings.reduce((count, listing) => {
    const safety = args.safetyByPropertyId.get(listing.id);
    return count + (!safety || safety.crimeIndex == null || safety.schoolRating == null ? 1 : 0);
  }, 0);
  if (args.matchedListings.length > 0 && missingSafetySignals / args.matchedListings.length >= 0.5) {
    events.push(
      buildEvent({
        ruleId: "provider_drift.safety_signal_drop",
        sourceDomain: "safety",
        severity: "warn",
        category: "provider_drift_safety_availability",
        message: "Safety providers are returning unusually sparse signals for ranked homes.",
        targetType: "provider",
        targetId: "safety-provider",
        partnerId: args.partnerId ?? null,
        sessionId: args.sessionId ?? null,
        provider: null,
        context: {
          matchedListings: args.matchedListings.length,
          missingSafetySignals
        },
        triggeredAt: nowIso
      })
    );
  }

  const categories = [...new Set(events.map((event) => event.category))].sort();
  const criticalEvents = events.filter((event) => event.severity === "critical").length;
  const staleTopResults = topHomes.filter(
    (home) =>
      (home.qualityFlags ?? []).includes("staleListingData") ||
      (home.qualityFlags ?? []).includes("staleSafetyData")
  ).length;

  for (const summary of byPropertyId.values()) {
    summary.integrityFlags.sort();
    summary.dataWarnings.sort();
    summary.degradedReasons.sort();
  }

  return {
    events,
    byPropertyId,
    integritySummary: {
      totalEvents: events.length,
      criticalEvents,
      categories,
      staleTopResults
    }
  };
}
