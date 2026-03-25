import type { DataQualityEvent, SearchMetrics, SearchProviderUsage } from "@nhalo/types";

type NumericSeries = {
  count: number;
  total: number;
  last: number | null;
  min: number | null;
  max: number | null;
};

type ProviderSeries = {
  latency: NumericSeries;
  requests: number;
  failures: number;
};

function createSeries(): NumericSeries {
  return {
    count: 0,
    total: 0,
    last: null,
    min: null,
    max: null
  };
}

function recordSeries(series: NumericSeries, value: number): void {
  series.count += 1;
  series.total += value;
  series.last = value;
  series.min = series.min === null ? value : Math.min(series.min, value);
  series.max = series.max === null ? value : Math.max(series.max, value);
}

function average(series: NumericSeries): number {
  if (series.count === 0) {
    return 0;
  }

  return Number((series.total / series.count).toFixed(2));
}

export class MetricsCollector {
  private readonly searchLatency = createSeries();
  private readonly searchLatencySamples: number[] = [];
  private readonly candidatesScanned = createSeries();
  private readonly matchesReturned = createSeries();
  private readonly scores = createSeries();
  private readonly providers = new Map<string, ProviderSeries>();
  private readonly safetyResolution = {
    cacheHits: 0,
    cacheMisses: 0,
    liveFetches: 0,
    total: 0,
    fallbacks: 0
  };
  private readonly listingResolution = {
    cacheHits: 0,
    cacheMisses: 0,
    liveFetches: 0,
    total: 0,
    fallbacks: 0
  };
  private readonly listingNormalization = {
    failures: 0,
    totalProcessed: 0
  };
  private readonly listingResultsReturned = createSeries();
  private readonly geocodeResolution = {
    cacheHits: 0,
    cacheMisses: 0,
    liveFetches: 0,
    total: 0,
    fallbacks: 0,
    ambiguities: 0
  };
  private readonly geocodePrecisionDistribution = {
    rooftop: 0,
    range_interpolated: 0,
    approximate: 0,
    centroid: 0,
    mock: 0,
    none: 0
  };
  private readonly listingQuality = {
    failures: 0,
    totalCandidates: 0
  };
  private readonly deduplication = {
    deduplicated: 0,
    totalCandidates: 0
  };
  private readonly comparableSelection = {
    fallbacks: 0,
    totalSelections: 0
  };
  private readonly rejectedOutsideRadius = { count: 0 };
  private readonly rejectedDuplicate = { count: 0 };
  private readonly rejectedInvalidListing = { count: 0 };
  private readonly rankingTie = { count: 0 };
  private readonly activeListing = {
    active: 0,
    eligible: 0
  };
  private readonly snapshotCreates = { count: 0 };
  private readonly snapshotReads = { count: 0 };
  private readonly snapshotReadLatency = createSeries();
  private readonly snapshotWriteLatency = createSeries();
  private readonly endpointReads = new Map<string, number>();
  private readonly comparisonViews = { count: 0 };
  private readonly auditViews = { count: 0 };
  private readonly explainabilityRenders = { count: 0 };
  private readonly searchDefinitionCreates = { count: 0 };
  private readonly searchDefinitionDeletes = { count: 0 };
  private readonly searchHistoryReads = { count: 0 };
  private readonly searchReruns = { count: 0 };
  private readonly searchRestores = { count: 0 };
  private readonly shortlistCreates = { count: 0 };
  private readonly shortlistDeletes = { count: 0 };
  private readonly shortlistItemAdds = { count: 0 };
  private readonly shortlistItemRemoves = { count: 0 };
  private readonly shortlistViews = { count: 0 };
  private readonly shortlistShareCreates = { count: 0 };
  private readonly shortlistShareOpens = { count: 0 };
  private readonly shortlistShareRevokes = { count: 0 };
  private readonly sharedCommentCreates = { count: 0 };
  private readonly sharedCommentUpdates = { count: 0 };
  private readonly sharedCommentDeletes = { count: 0 };
  private readonly reviewerDecisionCreates = { count: 0 };
  private readonly reviewerDecisionUpdates = { count: 0 };
  private readonly collaborationActivityReads = { count: 0 };
  private readonly expiredShareOpens = { count: 0 };
  private readonly pilotPartnerCreates = { count: 0 };
  private readonly pilotLinkCreates = { count: 0 };
  private readonly pilotLinkOpens = { count: 0 };
  private readonly pilotLinkRevokes = { count: 0 };
  private readonly opsSummaryReads = { count: 0 };
  private readonly opsErrorViews = { count: 0 };
  private readonly partnerFeatureOverrides = { count: 0 };
  private readonly pilotActivityReads = { count: 0 };
  private readonly providerDegradedDuringPilot = { count: 0 };
  private readonly noteCreates = { count: 0 };
  private readonly noteUpdates = { count: 0 };
  private readonly noteDeletes = { count: 0 };
  private readonly reviewStateChanges = { count: 0 };
  private readonly historicalCompareViews = { count: 0 };
  private readonly recentActivityPanelViews = { count: 0 };
  private readonly savedSearchPins = { count: 0 };
  private readonly onboardingViews = { count: 0 };
  private readonly onboardingDismisses = { count: 0 };
  private readonly emptyStateViews = { count: 0 };
  private readonly suggestionClicks = { count: 0 };
  private readonly detailPanelOpens = { count: 0 };
  private readonly resultCompareAdds = { count: 0 };
  private readonly snapshotReopens = { count: 0 };
  private readonly savedSearchRestores = { count: 0 };
  private readonly sharedSnapshotCreates = { count: 0 };
  private readonly sharedSnapshotOpens = { count: 0 };
  private readonly feedbackSubmits = {
    count: 0,
    useful: 0
  };
  private readonly demoScenarioStarts = { count: 0 };
  private readonly walkthroughViews = { count: 0 };
  private readonly walkthroughDismisses = { count: 0 };
  private readonly exportUsage = { count: 0 };
  private readonly ctaClicks = { count: 0 };
  private readonly validationPromptViews = { count: 0 };
  private readonly validationPromptResponses = { count: 0 };
  private readonly sharedSnapshotExpired = { count: 0 };
  private readonly validationSummaryReads = { count: 0 };
  private readonly searchOutcomes = {
    successes: 0,
    failures: 0
  };
  private readonly providerTimeouts = {
    requests: 0,
    timeouts: 0
  };
  private readonly providerCallCounts = {
    geocoder: 0,
    listing: 0,
    safety: 0
  };
  private readonly liveFetchBudgetExhaustion = {
    geocoder: 0,
    listing: 0,
    safety: 0
  };
  private readonly errorCounts = {
    VALIDATION_ERROR: 0,
    PROVIDER_ERROR: 0,
    DATABASE_ERROR: 0,
    CONFIG_ERROR: 0,
    INTERNAL_ERROR: 0
  };
  private readonly dataQuality = {
    totalEvents: 0,
    openCount: 0,
    resolvedCount: 0,
    listingFailures: 0,
    listingCandidates: 0,
    safetyFailures: 0,
    safetyCandidates: 0,
    geocodeFailures: 0,
    geocodeCandidates: 0,
    searchFailures: 0,
    searchCandidates: 0,
    staleResults: 0,
    totalResults: 0,
    providerDriftEvents: 0,
    criticalEvents: 0,
    categoryCounts: new Map<string, number>()
  };

  recordSearch(payload: {
    durationMs: number;
    candidatesScanned: number;
    matchesReturned: number;
    scores: number[];
    providerUsage?: SearchProviderUsage;
  }): void {
    recordSeries(this.searchLatency, payload.durationMs);
    this.searchLatencySamples.push(payload.durationMs);
    recordSeries(this.candidatesScanned, payload.candidatesScanned);
    recordSeries(this.matchesReturned, payload.matchesReturned);

    for (const score of payload.scores) {
      recordSeries(this.scores, score);
    }

    if (payload.providerUsage) {
      this.providerCallCounts.geocoder += payload.providerUsage.geocoderCalls;
      this.providerCallCounts.listing += payload.providerUsage.listingProviderCalls;
      this.providerCallCounts.safety += payload.providerUsage.safetyProviderCalls;
      if (payload.providerUsage.geocoderBudgetExceeded) {
        this.liveFetchBudgetExhaustion.geocoder += 1;
      }
      if (payload.providerUsage.listingBudgetExceeded) {
        this.liveFetchBudgetExhaustion.listing += 1;
      }
      if (payload.providerUsage.safetyBudgetExceeded) {
        this.liveFetchBudgetExhaustion.safety += 1;
      }
    }
  }

  recordProviderRequest(
    providerName: string,
    latencyMs: number,
    failed: boolean,
    timedOut = false
  ): void {
    const entry = this.providers.get(providerName) ?? {
      latency: createSeries(),
      requests: 0,
      failures: 0
    };

    entry.requests += 1;
    if (failed) {
      entry.failures += 1;
    }
    this.providerTimeouts.requests += 1;
    if (timedOut) {
      this.providerTimeouts.timeouts += 1;
    }
    recordSeries(entry.latency, latencyMs);
    this.providers.set(providerName, entry);
  }

  recordListingResolution(payload: {
    source: "live" | "cached_live" | "stale_cached_live" | "mock" | "none";
    cacheHit: boolean;
    liveFetch: boolean;
    fallback: boolean;
  }): void {
    this.listingResolution.total += 1;
    if (payload.cacheHit) {
      this.listingResolution.cacheHits += 1;
    } else {
      this.listingResolution.cacheMisses += 1;
    }
    if (payload.liveFetch) {
      this.listingResolution.liveFetches += 1;
    }
    if (payload.fallback) {
      this.listingResolution.fallbacks += 1;
    }
  }

  recordListingNormalization(payload: {
    totalProcessed: number;
    failures: number;
  }): void {
    this.listingNormalization.totalProcessed += payload.totalProcessed;
    this.listingNormalization.failures += payload.failures;
  }

  recordListingResultsReturned(count: number): void {
    recordSeries(this.listingResultsReturned, count);
  }

  recordGeocodeResolution(payload: {
    source: "live" | "cached_live" | "stale_cached_live" | "mock" | "none";
    cacheHit: boolean;
    liveFetch: boolean;
    fallback: boolean;
    ambiguous: boolean;
    precision: keyof MetricsCollector["geocodePrecisionDistribution"];
  }): void {
    this.geocodeResolution.total += 1;
    if (payload.cacheHit) {
      this.geocodeResolution.cacheHits += 1;
    } else {
      this.geocodeResolution.cacheMisses += 1;
    }
    if (payload.liveFetch) {
      this.geocodeResolution.liveFetches += 1;
    }
    if (payload.fallback) {
      this.geocodeResolution.fallbacks += 1;
    }
    if (payload.ambiguous) {
      this.geocodeResolution.ambiguities += 1;
    }
    this.geocodePrecisionDistribution[payload.precision] += 1;
  }

  recordListingQuality(payload: { failures: number; totalCandidates: number }): void {
    this.listingQuality.failures += payload.failures;
    this.listingQuality.totalCandidates += payload.totalCandidates;
  }

  recordDeduplication(payload: { deduplicated: number; totalCandidates: number }): void {
    this.deduplication.deduplicated += payload.deduplicated;
    this.deduplication.totalCandidates += payload.totalCandidates;
  }

  recordComparableSelection(payload: { fallback: boolean }): void {
    this.comparableSelection.totalSelections += 1;
    if (payload.fallback) {
      this.comparableSelection.fallbacks += 1;
    }
  }

  recordRejectionCounts(payload: {
    outsideRadius: number;
    duplicate: number;
    invalidListing: number;
  }): void {
    this.rejectedOutsideRadius.count += payload.outsideRadius;
    this.rejectedDuplicate.count += payload.duplicate;
    this.rejectedInvalidListing.count += payload.invalidListing;
  }

  recordRankingTies(count: number): void {
    this.rankingTie.count += count;
  }

  recordActiveListingRatio(payload: { active: number; eligible: number }): void {
    this.activeListing.active += payload.active;
    this.activeListing.eligible += payload.eligible;
  }

  recordSnapshotCreated(): void {
    this.snapshotCreates.count += 1;
  }

  recordSnapshotRead(): void {
    this.snapshotReads.count += 1;
  }

  recordSnapshotReadLatency(durationMs: number): void {
    recordSeries(this.snapshotReadLatency, durationMs);
  }

  recordSnapshotWriteLatency(durationMs: number): void {
    recordSeries(this.snapshotWriteLatency, durationMs);
  }

  recordEndpointRead(endpoint: string): void {
    this.endpointReads.set(endpoint, (this.endpointReads.get(endpoint) ?? 0) + 1);
  }

  recordComparisonView(): void {
    this.comparisonViews.count += 1;
  }

  recordAuditView(): void {
    this.auditViews.count += 1;
  }

  recordExplainabilityRender(count = 1): void {
    this.explainabilityRenders.count += count;
  }

  recordSearchDefinitionCreate(): void {
    this.searchDefinitionCreates.count += 1;
  }

  recordSearchDefinitionDelete(): void {
    this.searchDefinitionDeletes.count += 1;
  }

  recordSearchHistoryRead(): void {
    this.searchHistoryReads.count += 1;
  }

  recordSearchRerun(): void {
    this.searchReruns.count += 1;
  }

  recordSearchRestore(): void {
    this.searchRestores.count += 1;
  }

  recordShortlistCreate(): void {
    this.shortlistCreates.count += 1;
  }

  recordShortlistDelete(): void {
    this.shortlistDeletes.count += 1;
  }

  recordShortlistItemAdd(): void {
    this.shortlistItemAdds.count += 1;
  }

  recordShortlistItemRemove(): void {
    this.shortlistItemRemoves.count += 1;
  }

  recordShortlistView(): void {
    this.shortlistViews.count += 1;
  }

  recordShortlistShareCreate(): void {
    this.shortlistShareCreates.count += 1;
  }

  recordShortlistShareOpen(): void {
    this.shortlistShareOpens.count += 1;
  }

  recordShortlistShareRevoke(): void {
    this.shortlistShareRevokes.count += 1;
  }

  recordSharedCommentCreate(): void {
    this.sharedCommentCreates.count += 1;
  }

  recordSharedCommentUpdate(): void {
    this.sharedCommentUpdates.count += 1;
  }

  recordSharedCommentDelete(): void {
    this.sharedCommentDeletes.count += 1;
  }

  recordReviewerDecisionCreate(): void {
    this.reviewerDecisionCreates.count += 1;
  }

  recordReviewerDecisionUpdate(): void {
    this.reviewerDecisionUpdates.count += 1;
  }

  recordCollaborationActivityRead(): void {
    this.collaborationActivityReads.count += 1;
  }

  recordExpiredShareOpen(): void {
    this.expiredShareOpens.count += 1;
  }

  recordPilotPartnerCreate(): void {
    this.pilotPartnerCreates.count += 1;
  }

  recordPilotLinkCreate(): void {
    this.pilotLinkCreates.count += 1;
  }

  recordPilotLinkOpen(): void {
    this.pilotLinkOpens.count += 1;
  }

  recordPilotLinkRevoke(): void {
    this.pilotLinkRevokes.count += 1;
  }

  recordOpsSummaryRead(): void {
    this.opsSummaryReads.count += 1;
  }

  recordOpsErrorView(): void {
    this.opsErrorViews.count += 1;
  }

  recordPartnerFeatureOverride(): void {
    this.partnerFeatureOverrides.count += 1;
  }

  recordPilotActivityRead(): void {
    this.pilotActivityReads.count += 1;
  }

  recordProviderDegradedDuringPilot(): void {
    this.providerDegradedDuringPilot.count += 1;
  }

  recordNoteCreate(): void {
    this.noteCreates.count += 1;
  }

  recordNoteUpdate(): void {
    this.noteUpdates.count += 1;
  }

  recordNoteDelete(): void {
    this.noteDeletes.count += 1;
  }

  recordReviewStateChange(): void {
    this.reviewStateChanges.count += 1;
  }

  recordHistoricalCompareView(): void {
    this.historicalCompareViews.count += 1;
  }

  recordRecentActivityPanelView(): void {
    this.recentActivityPanelViews.count += 1;
  }

  recordSavedSearchPin(): void {
    this.savedSearchPins.count += 1;
  }

  recordOnboardingView(): void {
    this.onboardingViews.count += 1;
  }

  recordOnboardingDismiss(): void {
    this.onboardingDismisses.count += 1;
  }

  recordEmptyStateView(): void {
    this.emptyStateViews.count += 1;
  }

  recordSuggestionClick(): void {
    this.suggestionClicks.count += 1;
  }

  recordDetailPanelOpen(): void {
    this.detailPanelOpens.count += 1;
  }

  recordResultCompareAdd(): void {
    this.resultCompareAdds.count += 1;
  }

  recordSnapshotReopen(): void {
    this.snapshotReopens.count += 1;
  }

  recordSavedSearchRestore(): void {
    this.savedSearchRestores.count += 1;
  }

  recordSharedSnapshotCreate(): void {
    this.sharedSnapshotCreates.count += 1;
  }

  recordSharedSnapshotOpen(): void {
    this.sharedSnapshotOpens.count += 1;
  }

  recordFeedbackSubmit(useful = false): void {
    this.feedbackSubmits.count += 1;
    if (useful) {
      this.feedbackSubmits.useful += 1;
    }
  }

  recordDemoScenarioStart(): void {
    this.demoScenarioStarts.count += 1;
  }

  recordWalkthroughView(): void {
    this.walkthroughViews.count += 1;
  }

  recordWalkthroughDismiss(): void {
    this.walkthroughDismisses.count += 1;
  }

  recordExportUse(): void {
    this.exportUsage.count += 1;
  }

  recordCtaClick(): void {
    this.ctaClicks.count += 1;
  }

  recordValidationPromptView(): void {
    this.validationPromptViews.count += 1;
  }

  recordValidationPromptResponse(): void {
    this.validationPromptResponses.count += 1;
  }

  recordSharedSnapshotExpired(): void {
    this.sharedSnapshotExpired.count += 1;
  }

  recordValidationSummaryRead(): void {
    this.validationSummaryReads.count += 1;
  }

  recordSearchOutcome(success: boolean): void {
    if (success) {
      this.searchOutcomes.successes += 1;
    } else {
      this.searchOutcomes.failures += 1;
    }
  }

  recordError(category: keyof MetricsCollector["errorCounts"]): void {
    this.errorCounts[category] += 1;
  }

  recordDataQualityEvents(payload: {
    events: Array<Omit<DataQualityEvent, "id" | "createdAt" | "updatedAt" | "searchRequestId">>;
    totalResults: number;
    staleResults: number;
    listingCandidates: number;
    safetyCandidates: number;
    geocodeCandidates: number;
    searchCandidates: number;
  }): void {
    this.dataQuality.totalEvents += payload.events.length;
    this.dataQuality.totalResults += payload.totalResults;
    this.dataQuality.staleResults += payload.staleResults;
    this.dataQuality.listingCandidates += payload.listingCandidates;
    this.dataQuality.safetyCandidates += payload.safetyCandidates;
    this.dataQuality.geocodeCandidates += payload.geocodeCandidates;
    this.dataQuality.searchCandidates += payload.searchCandidates;

    for (const event of payload.events) {
      if (event.status === "open") {
        this.dataQuality.openCount += 1;
      }
      if (event.status === "resolved") {
        this.dataQuality.resolvedCount += 1;
      }
      if (event.severity === "critical") {
        this.dataQuality.criticalEvents += 1;
      }
      if (event.category.startsWith("provider_drift")) {
        this.dataQuality.providerDriftEvents += 1;
      }
      this.dataQuality.categoryCounts.set(
        event.category,
        (this.dataQuality.categoryCounts.get(event.category) ?? 0) + 1
      );

      if (event.sourceDomain === "listing") {
        this.dataQuality.listingFailures += 1;
      } else if (event.sourceDomain === "safety") {
        this.dataQuality.safetyFailures += 1;
      } else if (event.sourceDomain === "geocode") {
        this.dataQuality.geocodeFailures += 1;
      } else if (event.sourceDomain === "search") {
        this.dataQuality.searchFailures += 1;
      }
    }
  }

  recordSafetyResolution(payload: {
    source: "live" | "cached_live" | "stale_cached_live" | "mock" | "none";
    cacheHit: boolean;
    liveFetch: boolean;
    fallback: boolean;
  }): void {
    this.safetyResolution.total += 1;
    if (payload.cacheHit) {
      this.safetyResolution.cacheHits += 1;
    } else {
      this.safetyResolution.cacheMisses += 1;
    }
    if (payload.liveFetch) {
      this.safetyResolution.liveFetches += 1;
    }
    if (payload.fallback) {
      this.safetyResolution.fallbacks += 1;
    }
  }

  private providerRate(providerName: string) {
    const entry = this.providers.get(providerName);

    if (!entry) {
      return {
        requests: 0,
        failures: 0,
        rate: 0
      };
    }

    return {
      requests: entry.requests,
      failures: entry.failures,
      rate: entry.requests === 0 ? 0 : Number((entry.failures / entry.requests).toFixed(4))
    };
  }

  private providerLatency(providerName: string) {
    const entry = this.providers.get(providerName);

    return {
      count: entry?.latency.count ?? 0,
      average: entry ? average(entry.latency) : 0,
      last: entry?.latency.last ?? null
    };
  }

  private percentile(values: number[], ratio: number): number {
    if (values.length === 0) {
      return 0;
    }

    const sorted = [...values].sort((left, right) => left - right);
    const index = Math.max(0, Math.ceil(sorted.length * ratio) - 1);
    return sorted[index] ?? 0;
  }

  snapshot(): SearchMetrics {
    const providerLatencyMs = Object.fromEntries(
      [...this.providers.entries()].map(([providerName, entry]) => [
        providerName,
        {
          count: entry.latency.count,
          average: average(entry.latency),
          last: entry.latency.last
        }
      ])
    );

    const providerFailureRate = Object.fromEntries(
      [...this.providers.entries()].map(([providerName, entry]) => [
        providerName,
        {
          requests: entry.requests,
          failures: entry.failures,
          rate: entry.requests === 0 ? 0 : Number((entry.failures / entry.requests).toFixed(4))
        }
      ])
    );

    return {
      searchLatencyMs: {
        count: this.searchLatency.count,
        average: average(this.searchLatency),
        last: this.searchLatency.last
      },
      candidatesScanned: {
        total: this.candidatesScanned.total,
        average: average(this.candidatesScanned),
        last: this.candidatesScanned.last
      },
      matchesReturned: {
        total: this.matchesReturned.total,
        average: average(this.matchesReturned),
        last: this.matchesReturned.last
      },
      providerLatencyMs,
      providerFailureRate,
      crimeProviderLatencyMs: this.providerLatency("CrimeSignalProvider"),
      schoolProviderLatencyMs: this.providerLatency("SchoolSignalProvider"),
      crimeProviderFailureRate: this.providerRate("CrimeSignalProvider"),
      schoolProviderFailureRate: this.providerRate("SchoolSignalProvider"),
      safetyCacheHitRate: {
        hits: this.safetyResolution.cacheHits,
        misses: this.safetyResolution.cacheMisses,
        rate:
          this.safetyResolution.cacheHits + this.safetyResolution.cacheMisses === 0
            ? 0
            : Number(
                (
                  this.safetyResolution.cacheHits /
                  (this.safetyResolution.cacheHits + this.safetyResolution.cacheMisses)
                ).toFixed(4)
              )
      },
      safetyLiveFetchRate: {
        liveFetches: this.safetyResolution.liveFetches,
        totalResolutions: this.safetyResolution.total,
        rate:
          this.safetyResolution.total === 0
            ? 0
            : Number((this.safetyResolution.liveFetches / this.safetyResolution.total).toFixed(4))
      },
      safetyFallbackRate: {
        fallbacks: this.safetyResolution.fallbacks,
        totalResolutions: this.safetyResolution.total,
        rate:
          this.safetyResolution.total === 0
            ? 0
            : Number((this.safetyResolution.fallbacks / this.safetyResolution.total).toFixed(4))
      },
      listingProviderLatencyMs: this.providerLatency("ListingSourceProvider"),
      listingProviderFailureRate: this.providerRate("ListingSourceProvider"),
      listingCacheHitRate: {
        hits: this.listingResolution.cacheHits,
        misses: this.listingResolution.cacheMisses,
        rate:
          this.listingResolution.cacheHits + this.listingResolution.cacheMisses === 0
            ? 0
            : Number(
                (
                  this.listingResolution.cacheHits /
                  (this.listingResolution.cacheHits + this.listingResolution.cacheMisses)
                ).toFixed(4)
              )
      },
      listingLiveFetchRate: {
        liveFetches: this.listingResolution.liveFetches,
        totalResolutions: this.listingResolution.total,
        rate:
          this.listingResolution.total === 0
            ? 0
            : Number((this.listingResolution.liveFetches / this.listingResolution.total).toFixed(4))
      },
      listingFallbackRate: {
        fallbacks: this.listingResolution.fallbacks,
        totalResolutions: this.listingResolution.total,
        rate:
          this.listingResolution.total === 0
            ? 0
            : Number((this.listingResolution.fallbacks / this.listingResolution.total).toFixed(4))
      },
      listingNormalizationFailureRate: {
        failures: this.listingNormalization.failures,
        totalProcessed: this.listingNormalization.totalProcessed,
        rate:
          this.listingNormalization.totalProcessed === 0
            ? 0
            : Number(
                (this.listingNormalization.failures / this.listingNormalization.totalProcessed).toFixed(4)
              )
      },
      listingResultsReturnedCount: {
        total: this.listingResultsReturned.total,
        average: average(this.listingResultsReturned),
        last: this.listingResultsReturned.last
      },
      geocoderLatencyMs: this.providerLatency("GeocodingSourceProvider"),
      geocoderFailureRate: this.providerRate("GeocodingSourceProvider"),
      geocodeCacheHitRate: {
        hits: this.geocodeResolution.cacheHits,
        misses: this.geocodeResolution.cacheMisses,
        rate:
          this.geocodeResolution.cacheHits + this.geocodeResolution.cacheMisses === 0
            ? 0
            : Number(
                (
                  this.geocodeResolution.cacheHits /
                  (this.geocodeResolution.cacheHits + this.geocodeResolution.cacheMisses)
                ).toFixed(4)
              )
      },
      geocodeLiveFetchRate: {
        liveFetches: this.geocodeResolution.liveFetches,
        totalResolutions: this.geocodeResolution.total,
        rate:
          this.geocodeResolution.total === 0
            ? 0
            : Number((this.geocodeResolution.liveFetches / this.geocodeResolution.total).toFixed(4))
      },
      geocodeFallbackRate: {
        fallbacks: this.geocodeResolution.fallbacks,
        totalResolutions: this.geocodeResolution.total,
        rate:
          this.geocodeResolution.total === 0
            ? 0
            : Number((this.geocodeResolution.fallbacks / this.geocodeResolution.total).toFixed(4))
      },
      geocodeAmbiguityRate: {
        ambiguous: this.geocodeResolution.ambiguities,
        totalResolutions: this.geocodeResolution.total,
        rate:
          this.geocodeResolution.total === 0
            ? 0
            : Number((this.geocodeResolution.ambiguities / this.geocodeResolution.total).toFixed(4))
      },
      geocodePrecisionDistribution: {
        ...this.geocodePrecisionDistribution
      },
      listingDeduplicationRate: {
        deduplicated: this.deduplication.deduplicated,
        totalCandidates: this.deduplication.totalCandidates,
        rate:
          this.deduplication.totalCandidates === 0
            ? 0
            : Number((this.deduplication.deduplicated / this.deduplication.totalCandidates).toFixed(4))
      },
      listingQualityFailureRate: {
        failures: this.listingQuality.failures,
        totalCandidates: this.listingQuality.totalCandidates,
        rate:
          this.listingQuality.totalCandidates === 0
            ? 0
            : Number((this.listingQuality.failures / this.listingQuality.totalCandidates).toFixed(4))
      },
      comparableFallbackRate: {
        fallbacks: this.comparableSelection.fallbacks,
        totalSelections: this.comparableSelection.totalSelections,
        rate:
          this.comparableSelection.totalSelections === 0
            ? 0
            : Number((this.comparableSelection.fallbacks / this.comparableSelection.totalSelections).toFixed(4))
      },
      rejectedOutsideRadiusCount: this.rejectedOutsideRadius.count,
      rejectedDuplicateCount: this.rejectedDuplicate.count,
      rejectedInvalidListingCount: this.rejectedInvalidListing.count,
      rankingTieCount: this.rankingTie.count,
      activeListingRatio: {
        active: this.activeListing.active,
        eligible: this.activeListing.eligible,
        ratio:
          this.activeListing.eligible === 0
            ? 0
            : Number((this.activeListing.active / this.activeListing.eligible).toFixed(4))
      },
      snapshotCreateCount: this.snapshotCreates.count,
      snapshotReadCount: this.snapshotReads.count,
      searchSuccessRate: {
        successes: this.searchOutcomes.successes,
        failures: this.searchOutcomes.failures,
        rate:
          this.searchOutcomes.successes + this.searchOutcomes.failures === 0
            ? 0
            : Number(
                (
                  this.searchOutcomes.successes /
                  (this.searchOutcomes.successes + this.searchOutcomes.failures)
                ).toFixed(4)
              )
      },
      searchFailureRate: {
        successes: this.searchOutcomes.successes,
        failures: this.searchOutcomes.failures,
        rate:
          this.searchOutcomes.successes + this.searchOutcomes.failures === 0
            ? 0
            : Number(
                (
                  this.searchOutcomes.failures /
                  (this.searchOutcomes.successes + this.searchOutcomes.failures)
                ).toFixed(4)
              )
      },
      providerTimeoutRate: {
        requests: this.providerTimeouts.requests,
        timeouts: this.providerTimeouts.timeouts,
        rate:
          this.providerTimeouts.requests === 0
            ? 0
            : Number((this.providerTimeouts.timeouts / this.providerTimeouts.requests).toFixed(4))
      },
      cacheHitRate: {
        hits:
          this.safetyResolution.cacheHits +
          this.listingResolution.cacheHits +
          this.geocodeResolution.cacheHits,
        misses:
          this.safetyResolution.cacheMisses +
          this.listingResolution.cacheMisses +
          this.geocodeResolution.cacheMisses,
        rate:
          this.safetyResolution.cacheHits +
            this.listingResolution.cacheHits +
            this.geocodeResolution.cacheHits +
            this.safetyResolution.cacheMisses +
            this.listingResolution.cacheMisses +
            this.geocodeResolution.cacheMisses ===
          0
            ? 0
            : Number(
                (
                  (this.safetyResolution.cacheHits +
                    this.listingResolution.cacheHits +
                    this.geocodeResolution.cacheHits) /
                  (this.safetyResolution.cacheHits +
                    this.listingResolution.cacheHits +
                    this.geocodeResolution.cacheHits +
                    this.safetyResolution.cacheMisses +
                    this.listingResolution.cacheMisses +
                    this.geocodeResolution.cacheMisses)
                ).toFixed(4)
              )
      },
      snapshotCreationRate: {
        created: this.snapshotCreates.count,
        windowCount: this.snapshotCreates.count + this.snapshotReads.count,
        rate:
          this.snapshotCreates.count + this.snapshotReads.count === 0
            ? 0
            : Number(
                (this.snapshotCreates.count / (this.snapshotCreates.count + this.snapshotReads.count)).toFixed(4)
              )
      },
      snapshotRetrievalLatency: {
        count: this.snapshotReadLatency.count,
        average: average(this.snapshotReadLatency),
        last: this.snapshotReadLatency.last
      },
      errorRateByCategory: {
        VALIDATION_ERROR: { count: this.errorCounts.VALIDATION_ERROR },
        PROVIDER_ERROR: { count: this.errorCounts.PROVIDER_ERROR },
        DATABASE_ERROR: { count: this.errorCounts.DATABASE_ERROR },
        CONFIG_ERROR: { count: this.errorCounts.CONFIG_ERROR },
        INTERNAL_ERROR: { count: this.errorCounts.INTERNAL_ERROR }
      },
      comparisonViewCount: this.comparisonViews.count,
      auditViewCount: this.auditViews.count,
      explainabilityRenderCount: this.explainabilityRenders.count,
      searchDefinitionCreateCount: this.searchDefinitionCreates.count,
      searchDefinitionDeleteCount: this.searchDefinitionDeletes.count,
      searchHistoryReadCount: this.searchHistoryReads.count,
      searchRerunCount: this.searchReruns.count,
      searchRestoreCount: this.searchRestores.count,
      shortlistCreateCount: this.shortlistCreates.count,
      shortlistDeleteCount: this.shortlistDeletes.count,
      shortlistItemAddCount: this.shortlistItemAdds.count,
      shortlistItemRemoveCount: this.shortlistItemRemoves.count,
      shortlistViewCount: this.shortlistViews.count,
      shortlistShareCreateCount: this.shortlistShareCreates.count,
      shortlistShareOpenCount: this.shortlistShareOpens.count,
      shortlistShareRevokeCount: this.shortlistShareRevokes.count,
      sharedCommentCreateCount: this.sharedCommentCreates.count,
      sharedCommentUpdateCount: this.sharedCommentUpdates.count,
      sharedCommentDeleteCount: this.sharedCommentDeletes.count,
      reviewerDecisionCreateCount: this.reviewerDecisionCreates.count,
      reviewerDecisionUpdateCount: this.reviewerDecisionUpdates.count,
      collaborationActivityReadCount: this.collaborationActivityReads.count,
      expiredShareOpenCount: this.expiredShareOpens.count,
      pilotPartnerCreateCount: this.pilotPartnerCreates.count,
      pilotLinkCreateCount: this.pilotLinkCreates.count,
      pilotLinkOpenCount: this.pilotLinkOpens.count,
      pilotLinkRevokeCount: this.pilotLinkRevokes.count,
      opsSummaryReadCount: this.opsSummaryReads.count,
      opsErrorViewCount: this.opsErrorViews.count,
      partnerFeatureOverrideCount: this.partnerFeatureOverrides.count,
      pilotActivityReadCount: this.pilotActivityReads.count,
      providerDegradedDuringPilotCount: this.providerDegradedDuringPilot.count,
      noteCreateCount: this.noteCreates.count,
      noteUpdateCount: this.noteUpdates.count,
      noteDeleteCount: this.noteDeletes.count,
      reviewStateChangeCount: this.reviewStateChanges.count,
      historicalCompareViewCount: this.historicalCompareViews.count,
      recentActivityPanelViewCount: this.recentActivityPanelViews.count,
      savedSearchPinCount: this.savedSearchPins.count,
      onboardingViewCount: this.onboardingViews.count,
      onboardingDismissCount: this.onboardingDismisses.count,
      emptyStateViewCount: this.emptyStateViews.count,
      suggestionClickCount: this.suggestionClicks.count,
      detailPanelOpenCount: this.detailPanelOpens.count,
      resultCompareAddCount: this.resultCompareAdds.count,
      snapshotReopenCount: this.snapshotReopens.count,
      savedSearchRestoreCount: this.savedSearchRestores.count,
      sharedSnapshotCreateCount: this.sharedSnapshotCreates.count,
      sharedSnapshotOpenCount: this.sharedSnapshotOpens.count,
      feedbackSubmitCount: this.feedbackSubmits.count,
      feedbackUsefulRate: {
        useful: this.feedbackSubmits.useful,
        total: this.feedbackSubmits.count,
        rate:
          this.feedbackSubmits.count === 0
            ? 0
            : Number((this.feedbackSubmits.useful / this.feedbackSubmits.count).toFixed(4))
      },
      demoScenarioStartCount: this.demoScenarioStarts.count,
      walkthroughViewCount: this.walkthroughViews.count,
      walkthroughDismissCount: this.walkthroughDismisses.count,
      exportUsageCount: this.exportUsage.count,
      ctaClickCount: this.ctaClicks.count,
      validationPromptViewCount: this.validationPromptViews.count,
      validationPromptResponseCount: this.validationPromptResponses.count,
      sharedSnapshotExpiredCount: this.sharedSnapshotExpired.count,
      validationSummaryReadCount: this.validationSummaryReads.count,
      dataQualityEventCount: this.dataQuality.totalEvents,
      integrityIncidentOpenCount: this.dataQuality.openCount,
      integrityIncidentResolvedCount: this.dataQuality.resolvedCount,
      safetyQualityFailureRate: {
        failures: this.dataQuality.safetyFailures,
        totalCandidates: this.dataQuality.safetyCandidates,
        rate:
          this.dataQuality.safetyCandidates === 0
            ? 0
            : Number((this.dataQuality.safetyFailures / this.dataQuality.safetyCandidates).toFixed(4))
      },
      geocodeQualityFailureRate: {
        failures: this.dataQuality.geocodeFailures,
        totalCandidates: this.dataQuality.geocodeCandidates,
        rate:
          this.dataQuality.geocodeCandidates === 0
            ? 0
            : Number((this.dataQuality.geocodeFailures / this.dataQuality.geocodeCandidates).toFixed(4))
      },
      searchIntegrityFailureRate: {
        failures: this.dataQuality.searchFailures,
        totalCandidates: this.dataQuality.searchCandidates,
        rate:
          this.dataQuality.searchCandidates === 0
            ? 0
            : Number((this.dataQuality.searchFailures / this.dataQuality.searchCandidates).toFixed(4))
      },
      staleDataResultRate: {
        staleResults: this.dataQuality.staleResults,
        totalResults: this.dataQuality.totalResults,
        rate:
          this.dataQuality.totalResults === 0
            ? 0
            : Number((this.dataQuality.staleResults / this.dataQuality.totalResults).toFixed(4))
      },
      providerDriftEventCount: this.dataQuality.providerDriftEvents,
      qualityRuleTriggerCountByCategory: Object.fromEntries(this.dataQuality.categoryCounts.entries()),
      criticalQualityEventCount: this.dataQuality.criticalEvents,
      searchLatencyP95Ms: this.percentile(this.searchLatencySamples, 0.95),
      providerCallCountByType: {
        geocoder: this.providerCallCounts.geocoder,
        listing: this.providerCallCounts.listing,
        safety: this.providerCallCounts.safety
      },
      liveFetchBudgetExhaustionCount: {
        geocoder: this.liveFetchBudgetExhaustion.geocoder,
        listing: this.liveFetchBudgetExhaustion.listing,
        safety: this.liveFetchBudgetExhaustion.safety
      },
      snapshotWriteLatency: {
        count: this.snapshotWriteLatency.count,
        average: average(this.snapshotWriteLatency),
        last: this.snapshotWriteLatency.last
      },
      heavyEndpointReadCounts: Object.fromEntries(this.endpointReads.entries()),
      scoreDistribution: {
        count: this.scores.count,
        average: average(this.scores),
        min: this.scores.min,
        max: this.scores.max
      }
    };
  }
}
