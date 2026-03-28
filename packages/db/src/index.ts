import {
  DEFAULT_PILOT_LINK_EXPIRATION_DAYS,
  DEFAULT_GEOCODE_CACHE_TTL_HOURS,
  DEFAULT_GEOCODE_STALE_TTL_HOURS,
  DEFAULT_LISTING_CACHE_TTL_HOURS,
  DEFAULT_LISTING_STALE_TTL_HOURS,
  DEFAULT_SAFETY_CACHE_TTL_HOURS,
  DEFAULT_SAFETY_STALE_TTL_HOURS,
  MARKET_SNAPSHOT_FRESH_HOURS,
  getConfig
} from "@nhalo/config";
import { randomBytes } from "node:crypto";
import type {
  CollaborationActivityRecord,
  CollaborationRole,
  DataQualityEvent,
  DataQualityStatus,
  DataQualitySummary,
  EffectiveCapabilities,
  FeedbackRecord,
  GeocodeCacheRecord,
  GeocodeCacheRepository,
  HistoricalComparisonPayload,
  ListingCacheRecord,
  ListingCacheRepository,
  ReviewerDecision,
  ReviewerDecisionValue,
  ShareMode,
  ListingRecord,
  MarketSnapshot,
  MarketSnapshotRepository,
  OpsActionRecord,
  OpsSummary,
  PlanSummary,
  PlanTier,
  PartnerUsageSummary,
  PilotActivityRecord,
  PilotFeatureOverrides,
  PilotLinkRecord,
  PilotLinkView,
  PilotPartner,
  PilotPartnerStatus,
  ResultNote,
  SafetySignalCacheRecord,
  SafetySignalCacheRepository,
  SharedComment,
  SharedCommentEntityType,
  SharedShortlist,
  SharedShortlistView,
  Shortlist,
  ShortlistItem,
  SearchDefinition,
  SearchHistoryRecord,
  SearchRequest,
  ScoreAuditRecord,
  ReviewState,
  SearchResponse,
  SearchSnapshotRecord,
  SearchPersistenceInput,
  SearchRepository,
  SharedSnapshotRecord,
  SharedSnapshotView,
  ValidationEventRecord,
  ValidationSummary,
  UsageFrictionSummary,
  UsageFunnelSummary,
  WorkflowActivityRecord
} from "@nhalo/types";

function randomToken(length = 32): string {
  let token = "";

  while (token.length < length) {
    token += randomBytes(24).toString("base64url");
  }

  return token.slice(0, length);
}

function createId(prefix: string): string {
  return `${prefix}-${randomToken(24)}`;
}

function createSensitiveToken(prefix: string): string {
  // Shared and pilot links cross trust boundaries, so use longer random tokens than internal ids.
  const minLength = Math.max(getConfig().security.shareLinkMinTokenLength, 24);
  return `${prefix}-${randomToken(minLength)}`;
}

function ageHours(timestamp: string): number {
  return (Date.now() - new Date(timestamp).getTime()) / 3_600_000;
}

function olderThanDays(timestamp: string, days: number): boolean {
  return Date.now() - new Date(timestamp).getTime() > days * 86_400_000;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type StoredSnapshot = {
  searchRequestId: string;
  propertyId: string;
  formulaVersion: string;
  explanation: string;
  priceScore: number;
  sizeScore: number;
  safetyScore: number;
  nhaloScore: number;
  safetyConfidence: ScoreAuditRecord["safetyConfidence"];
  overallConfidence: ScoreAuditRecord["overallConfidence"];
  weights: ScoreAuditRecord["weights"];
  inputs: ScoreAuditRecord["inputs"];
  scoreInputs: Record<string, unknown>;
  createdAt: string;
  safetyProvenance: NonNullable<ScoreAuditRecord["safetyProvenance"]>;
  listingProvenance: NonNullable<ScoreAuditRecord["listingProvenance"]>;
  searchOrigin?: ScoreAuditRecord["searchOrigin"];
  spatialContext?: ScoreAuditRecord["spatialContext"];
};

type StoredSearch = {
  id: string;
  payload: SearchPersistenceInput;
  createdAt: string;
};

type StoredSharedSnapshot = SharedSnapshotRecord;
type StoredFeedback = FeedbackRecord;
type StoredValidationEvent = ValidationEventRecord;
type StoredShortlist = Shortlist;
type StoredShortlistItem = ShortlistItem;
type StoredResultNote = ResultNote;
type StoredSharedShortlist = SharedShortlist;
type StoredSharedComment = SharedComment;
type StoredReviewerDecision = ReviewerDecision;
type StoredPilotPartner = PilotPartner;
type StoredPilotLink = PilotLinkRecord;
type StoredOpsAction = OpsActionRecord;
type StoredDataQualityEvent = DataQualityEvent;

const DEFAULT_PILOT_FEATURES: PilotFeatureOverrides = {
  demoModeEnabled: true,
  sharedSnapshotsEnabled: true,
  sharedShortlistsEnabled: true,
  feedbackEnabled: true,
  validationPromptsEnabled: true,
  shortlistCollaborationEnabled: true,
  exportResultsEnabled: true
};

function sharedSnapshotStatus(record: StoredSharedSnapshot): SharedSnapshotRecord["status"] {
  if (record.revokedAt) {
    return "revoked";
  }
  if (record.expiresAt && new Date(record.expiresAt).getTime() <= Date.now()) {
    return "expired";
  }
  return "active";
}

function sharedShortlistStatus(record: StoredSharedShortlist): SharedShortlist["status"] {
  if (record.revokedAt) {
    return "revoked";
  }
  if (record.expiresAt && new Date(record.expiresAt).getTime() <= Date.now()) {
    return "expired";
  }
  return "active";
}

function roleForShareMode(mode: ShareMode): CollaborationRole {
  switch (mode) {
    case "read_only":
      return "viewer";
    case "comment_only":
    case "review_only":
      return "reviewer";
  }
}

function mergePilotFeatures(
  overrides?: Partial<PilotFeatureOverrides> | null
): PilotFeatureOverrides {
  return {
    ...DEFAULT_PILOT_FEATURES,
    ...(overrides ?? {})
  };
}

const PLAN_FEATURE_DEFAULTS: Record<
  PlanTier,
  Omit<
    EffectiveCapabilities,
    "planTier" | "limits"
  >
> = {
  free_demo: {
    canShareSnapshots: true,
    canShareShortlists: false,
    canUseDemoMode: true,
    canExportResults: true,
    canUseCollaboration: false,
    canUseOpsViews: false,
    canSubmitFeedback: true,
    canSeeValidationPrompts: true
  },
  pilot: {
    canShareSnapshots: true,
    canShareShortlists: true,
    canUseDemoMode: true,
    canExportResults: true,
    canUseCollaboration: false,
    canUseOpsViews: false,
    canSubmitFeedback: true,
    canSeeValidationPrompts: true
  },
  partner: {
    canShareSnapshots: true,
    canShareShortlists: true,
    canUseDemoMode: true,
    canExportResults: true,
    canUseCollaboration: true,
    canUseOpsViews: false,
    canSubmitFeedback: true,
    canSeeValidationPrompts: true
  },
  internal: {
    canShareSnapshots: true,
    canShareShortlists: true,
    canUseDemoMode: true,
    canExportResults: true,
    canUseCollaboration: true,
    canUseOpsViews: true,
    canSubmitFeedback: true,
    canSeeValidationPrompts: true
  }
};

function resolveStoredCapabilities(
  planTier: PlanTier,
  overrides?: Partial<PilotFeatureOverrides> | null
): EffectiveCapabilities {
  const config = getConfig();
  const defaults = PLAN_FEATURE_DEFAULTS[planTier];
  const mergedOverrides = mergePilotFeatures(overrides);

  const canShareSnapshots =
    defaults.canShareSnapshots &&
    config.validation.enabled &&
    config.validation.sharedSnapshotsEnabled &&
    config.security.publicSharedViewsEnabled &&
    mergedOverrides.sharedSnapshotsEnabled;
  const canShareShortlists =
    defaults.canShareShortlists &&
    config.workflow.shortlistsEnabled &&
    config.workflow.sharedShortlistsEnabled &&
    config.security.publicSharedShortlistsEnabled &&
    mergedOverrides.sharedShortlistsEnabled;
  const canUseCollaboration =
    defaults.canUseCollaboration &&
    canShareShortlists &&
    (config.workflow.sharedCommentsEnabled || config.workflow.reviewerDecisionsEnabled) &&
    mergedOverrides.shortlistCollaborationEnabled;

  return {
    planTier,
    canShareSnapshots,
    canShareShortlists,
    canUseDemoMode:
      defaults.canUseDemoMode &&
      config.validation.enabled &&
      config.validation.demoScenariosEnabled &&
      mergedOverrides.demoModeEnabled,
    canExportResults:
      defaults.canExportResults &&
      config.validation.enabled &&
      mergedOverrides.exportResultsEnabled,
    canUseCollaboration,
    canUseOpsViews:
      defaults.canUseOpsViews &&
      config.ops.pilotOpsEnabled,
    canSubmitFeedback:
      defaults.canSubmitFeedback &&
      config.validation.enabled &&
      config.validation.feedbackEnabled &&
      mergedOverrides.feedbackEnabled,
    canSeeValidationPrompts:
      defaults.canSeeValidationPrompts &&
      config.validation.enabled &&
      mergedOverrides.validationPromptsEnabled,
    limits: {
      savedSearches: planTier === "internal" ? null : config.product.maxSavedSearchesPerSession,
      shortlists: planTier === "internal" ? null : config.product.maxShortlistsPerSession,
      shareLinks: planTier === "internal" ? null : config.product.maxShareLinksPerSession,
      exportsPerSession:
        planTier === "internal" || !config.product.exportLimitsEnabled
          ? null
          : config.product.maxExportsPerSession
    }
  };
}

function pilotLinkStatus(record: StoredPilotLink): PilotLinkRecord["status"] {
  if (record.revokedAt) {
    return "revoked";
  }
  if (record.expiresAt && new Date(record.expiresAt).getTime() <= Date.now()) {
    return "expired";
  }
  return "active";
}

function buildSnapshotValidationMetadata(options: {
  snapshotId: string;
  searchRequestId?: string | null;
  demoScenarioId?: string | null;
  sharedSnapshots: StoredSharedSnapshot[];
  feedback: StoredFeedback[];
  validationEvents: StoredValidationEvent[];
}): SearchSnapshotRecord["validationMetadata"] {
  const shares = options.sharedSnapshots.filter((entry) => entry.snapshotId === options.snapshotId);
  const feedbackCount = options.feedback.filter((entry) => entry.snapshotId === options.snapshotId).length;
  const rerunCount = options.validationEvents.filter(
    (entry) =>
      entry.eventName === "rerun_executed" &&
      (entry.snapshotId === options.snapshotId || entry.historyRecordId === options.searchRequestId)
  ).length;

  return {
    wasShared: shares.length > 0,
    shareCount: shares.length,
    feedbackCount,
    demoScenarioId: options.demoScenarioId ?? null,
    rerunCount
  };
}

function buildHistoryValidationMetadata(options: {
  historyRecordId: string;
  demoScenarioId?: string | null;
  sharedSnapshots: StoredSharedSnapshot[];
  feedback: StoredFeedback[];
  validationEvents: StoredValidationEvent[];
}): SearchHistoryRecord["validationMetadata"] {
  const shareCount = options.sharedSnapshots.filter((entry) =>
    options.validationEvents.some(
      (event) =>
        event.eventName === "snapshot_shared" &&
        event.historyRecordId === options.historyRecordId &&
        event.snapshotId === entry.snapshotId
    )
  ).length;
  const feedbackCount = options.feedback.filter((entry) => entry.historyRecordId === options.historyRecordId).length;
  const rerunCount = options.validationEvents.filter(
    (entry) => entry.eventName === "rerun_executed" && entry.historyRecordId === options.historyRecordId
  ).length;

  return {
    wasShared: shareCount > 0,
    shareCount,
    feedbackCount,
    demoScenarioId: options.demoScenarioId ?? null,
    rerunCount
  };
}

function summarizePartnerUsage(options: {
  searches: Array<{
    partnerId: string | null;
    performance?: SearchPersistenceInput["response"]["metadata"]["performance"];
  }>;
  partners: PilotPartner[];
  validationEvents: ValidationEventRecord[];
  dataQualityEvents: DataQualityEvent[];
  partnerId?: string;
}): PartnerUsageSummary[] {
  const summaryByPartner = new Map<string, PartnerUsageSummary>();

  const ensurePartner = (id: string): PartnerUsageSummary => {
    const existing = summaryByPartner.get(id);
    if (existing) {
      return existing;
    }

    const partner = options.partners.find((entry) => entry.id === id);
    const created: PartnerUsageSummary = {
      partnerId: id,
      partnerName: partner?.name ?? null,
      planTier: partner?.planTier,
      searches: 0,
      liveProviderCalls: 0,
      cacheHitRate: 0,
      sharedSnapshotCreates: 0,
      sharedSnapshotOpens: 0,
      qualityEventCount: 0,
      pilotLinkOpens: 0,
      shortlistActivityCount: 0,
      collaborationActivityCount: 0,
      exportUsageCount: 0,
      featureLimitHitCount: 0
    };
    summaryByPartner.set(id, created);
    return created;
  };

  const cacheStats = new Map<string, { hits: number; total: number }>();

  for (const search of options.searches) {
    if (!search.partnerId) {
      continue;
    }
    const summary = ensurePartner(search.partnerId);
    summary.searches += 1;
    const usage = search.performance?.providerUsage;
    if (usage) {
      summary.liveProviderCalls +=
        usage.geocoderLiveFetches + usage.listingLiveFetches + usage.safetyLiveFetches;
      const stats = cacheStats.get(search.partnerId) ?? { hits: 0, total: 0 };
      stats.hits += usage.geocoderCacheHits + usage.listingCacheHits + usage.safetyCacheHits;
      stats.total += usage.geocoderCalls + usage.listingProviderCalls + usage.safetyProviderCalls;
      cacheStats.set(search.partnerId, stats);
    }
  }

  for (const event of options.validationEvents) {
    const payloadPartnerId =
      typeof event.payload?.partnerId === "string" ? event.payload.partnerId : null;
    if (!payloadPartnerId) {
      continue;
    }
    const summary = ensurePartner(payloadPartnerId);
    if (event.eventName === "snapshot_shared") {
      summary.sharedSnapshotCreates += 1;
    }
    if (event.eventName === "snapshot_opened") {
      summary.sharedSnapshotOpens += 1;
    }
    if (event.eventName === "pilot_link_opened") {
      summary.pilotLinkOpens += 1;
    }
    if (
      event.eventName === "shortlist_created" ||
      event.eventName === "shortlist_updated" ||
      event.eventName === "shortlist_item_added" ||
      event.eventName === "shortlist_item_removed" ||
      event.eventName === "shortlist_feature_used"
    ) {
      summary.shortlistActivityCount += 1;
    }
    if (
      event.eventName === "shared_comment_added" ||
      event.eventName === "reviewer_decision_submitted" ||
      event.eventName === "shared_shortlist_opened"
    ) {
      summary.collaborationActivityCount += 1;
    }
    if (event.eventName === "export_generated") {
      summary.exportUsageCount += 1;
    }
    if (event.eventName === "capability_limit_hit") {
      summary.featureLimitHitCount += 1;
    }
  }

  for (const event of options.dataQualityEvents) {
    if (!event.partnerId) {
      continue;
    }
    const summary = ensurePartner(event.partnerId);
    summary.qualityEventCount += 1;
  }

  const summaries = [...summaryByPartner.values()].map((summary) => {
    const stats = cacheStats.get(summary.partnerId) ?? { hits: 0, total: 0 };
    return {
      ...summary,
      cacheHitRate:
        stats.total === 0 ? 0 : Number((stats.hits / stats.total).toFixed(4))
    };
  });

  const filtered = options.partnerId
    ? summaries.filter((entry) => entry.partnerId === options.partnerId)
    : summaries;

  return filtered.sort((left, right) => right.searches - left.searches);
}

const USAGE_FUNNEL_DEFINITIONS: UsageFunnelSummary["steps"] = [
  { key: "search_started", label: "Search started", count: 0, conversionFromPrevious: null },
  { key: "search_completed", label: "Search completed", count: 0, conversionFromPrevious: null },
  { key: "result_opened", label: "Result opened", count: 0, conversionFromPrevious: null },
  { key: "comparison_started", label: "Comparison started", count: 0, conversionFromPrevious: null },
  { key: "shortlist_created", label: "Shortlist created", count: 0, conversionFromPrevious: null },
  { key: "snapshot_created", label: "Snapshot created", count: 0, conversionFromPrevious: null },
  { key: "snapshot_shared", label: "Snapshot shared", count: 0, conversionFromPrevious: null },
  { key: "feedback_submitted", label: "Feedback submitted", count: 0, conversionFromPrevious: null },
  { key: "rerun_executed", label: "Rerun executed", count: 0, conversionFromPrevious: null },
  { key: "shared_shortlist_opened", label: "Shared shortlist opened", count: 0, conversionFromPrevious: null }
];

function buildUsageFunnelSummary(events: ValidationEventRecord[], snapshotCount: number): UsageFunnelSummary {
  const counts = new Map<UsageFunnelSummary["steps"][number]["key"], number>();
  for (const step of USAGE_FUNNEL_DEFINITIONS) {
    counts.set(step.key, 0);
  }
  for (const event of events) {
    if (counts.has(event.eventName as UsageFunnelSummary["steps"][number]["key"])) {
      counts.set(
        event.eventName as UsageFunnelSummary["steps"][number]["key"],
        (counts.get(event.eventName as UsageFunnelSummary["steps"][number]["key"]) ?? 0) + 1
      );
    }
  }
  counts.set("snapshot_created", snapshotCount);

  let previousCount: number | null = null;
  return {
    steps: USAGE_FUNNEL_DEFINITIONS.map((step) => {
      const count = counts.get(step.key) ?? 0;
      const conversionFromPrevious =
        previousCount === null || previousCount === 0 ? null : Number((count / previousCount).toFixed(4));
      previousCount = count;
      return {
        ...step,
        count,
        conversionFromPrevious
      };
    })
  };
}

function buildUsageFrictionSummary(args: {
  searches: Array<{
    id: string;
    locationType: SearchRequest["locationType"];
    returnedCount: number;
    topOverallConfidence: SearchResponse["homes"][number]["scores"]["overallConfidence"] | null;
  }>;
  snapshots: SearchSnapshotRecord[];
  shortlists: Shortlist[];
  validationEvents: ValidationEventRecord[];
}): UsageFrictionSummary {
  const emptyResultRateBySearchType: UsageFrictionSummary["emptyResultRateBySearchType"] = {
    city: { searches: 0, emptyResults: 0, rate: 0 },
    zip: { searches: 0, emptyResults: 0, rate: 0 },
    address: { searches: 0, emptyResults: 0, rate: 0 }
  };

  let lowConfidenceTopResults = 0;
  let searchesWithoutShortlistActivity = 0;
  const shortlistActivityHistoryIds = new Set(
    args.validationEvents
      .filter((event) =>
        event.eventName === "shortlist_created" ||
        event.eventName === "shortlist_item_added" ||
        event.eventName === "shortlist_feature_used"
      )
      .map((event) => event.historyRecordId)
      .filter((value): value is string => typeof value === "string" && value.length > 0)
  );
  const rerunCountBySource = new Map<string, number>();
  const savedOutcomeBySource = new Set<string>();

  for (const event of args.validationEvents) {
    if (event.eventName === "rerun_executed") {
      const sourceId =
        typeof event.payload?.sourceId === "string" ? event.payload.sourceId : event.historyRecordId ?? null;
      if (sourceId) {
        rerunCountBySource.set(sourceId, (rerunCountBySource.get(sourceId) ?? 0) + 1);
      }
    }
    if (event.eventName === "snapshot_shared" || event.eventName === "snapshot_created") {
      const sourceId =
        typeof event.payload?.sourceId === "string" ? event.payload.sourceId : event.historyRecordId ?? null;
      if (sourceId) {
        savedOutcomeBySource.add(sourceId);
      }
    }
  }

  for (const search of args.searches) {
    const bucket = emptyResultRateBySearchType[search.locationType];
    bucket.searches += 1;
    if (search.returnedCount === 0) {
      bucket.emptyResults += 1;
    }
    if (search.topOverallConfidence === "low" || search.topOverallConfidence === "none") {
      lowConfidenceTopResults += 1;
    }
    if (!shortlistActivityHistoryIds.has(search.id)) {
      searchesWithoutShortlistActivity += 1;
    }
  }

  for (const key of Object.keys(emptyResultRateBySearchType) as Array<keyof typeof emptyResultRateBySearchType>) {
    const bucket = emptyResultRateBySearchType[key];
    bucket.rate = bucket.searches === 0 ? 0 : Number((bucket.emptyResults / bucket.searches).toFixed(4));
  }

  const neverOpenedSnapshots = args.snapshots.filter(
    (snapshot) => (snapshot.validationMetadata?.shareCount ?? 0) > 0 &&
      !args.validationEvents.some((event) => event.eventName === "snapshot_opened" && event.snapshotId === snapshot.id)
  ).length;

  const repeatedWithoutSavedOutcome = [...rerunCountBySource.entries()].filter(
    ([sourceId, count]) => count > 1 && !savedOutcomeBySource.has(sourceId)
  ).length;

  return {
    emptyResultRateBySearchType,
    lowConfidenceResultRate: {
      searches: args.searches.length,
      lowConfidenceTopResults,
      rate: args.searches.length === 0 ? 0 : Number((lowConfidenceTopResults / args.searches.length).toFixed(4))
    },
    searchesWithoutShortlistActivity: {
      searches: args.searches.length,
      withoutShortlistActivity: searchesWithoutShortlistActivity,
      rate:
        args.searches.length === 0
          ? 0
          : Number((searchesWithoutShortlistActivity / args.searches.length).toFixed(4))
    },
    sharedSnapshotsNeverOpened: {
      total: args.snapshots.filter((snapshot) => (snapshot.validationMetadata?.shareCount ?? 0) > 0).length,
      neverOpened: neverOpenedSnapshots,
      rate:
        args.snapshots.filter((snapshot) => (snapshot.validationMetadata?.shareCount ?? 0) > 0).length === 0
          ? 0
          : Number(
              (
                neverOpenedSnapshots /
                args.snapshots.filter((snapshot) => (snapshot.validationMetadata?.shareCount ?? 0) > 0).length
              ).toFixed(4)
            )
    },
    shortlistsWithoutReviewerActivity: {
      total: args.shortlists.length,
      withoutReviewerActivity: args.shortlists.filter(
        (shortlist) =>
          !args.validationEvents.some(
            (event) =>
              event.eventName === "reviewer_decision_submitted" &&
              event.payload?.shortlistId === shortlist.id
          )
      ).length,
      rate:
        args.shortlists.length === 0
          ? 0
          : Number(
              (
                args.shortlists.filter(
                  (shortlist) =>
                    !args.validationEvents.some(
                      (event) =>
                        event.eventName === "reviewer_decision_submitted" &&
                        event.payload?.shortlistId === shortlist.id
                    )
                ).length / args.shortlists.length
              ).toFixed(4)
            )
    },
    repeatedRerunsWithoutSavedOutcome: {
      rerunSources: rerunCountBySource.size,
      repeatedWithoutSavedOutcome,
      rate:
        rerunCountBySource.size === 0
          ? 0
          : Number((repeatedWithoutSavedOutcome / rerunCountBySource.size).toFixed(4))
    }
  };
}

function buildPlanSummary(partners: PilotPartner[]): PlanSummary {
  const planDistribution: PlanSummary["planDistribution"] = {
    free_demo: 0,
    pilot: 0,
    partner: 0,
    internal: 0
  };
  const capabilityEnabledCounts: Record<string, number> = {};

  for (const partner of partners) {
    planDistribution[partner.planTier] += 1;
    const capabilities = resolveStoredCapabilities(partner.planTier, partner.featureOverrides);
    for (const [key, value] of Object.entries(capabilities)) {
      if (key === "planTier" || key === "limits") {
        continue;
      }
      if (value) {
        capabilityEnabledCounts[key] = (capabilityEnabledCounts[key] ?? 0) + 1;
      }
    }
  }

  return {
    planDistribution,
    capabilityEnabledCounts
  };
}

function toAuditRecord(
  snapshot: StoredSnapshot,
  qualityEvents: StoredDataQualityEvent[] = []
): ScoreAuditRecord {
  const explainability =
    (snapshot.scoreInputs.explainability as ScoreAuditRecord["explainability"] | undefined) ??
    undefined;
  const strengths = (snapshot.scoreInputs.strengths as string[] | undefined) ?? [];
  const risks = (snapshot.scoreInputs.risks as string[] | undefined) ?? [];
  const confidenceReasons =
    (snapshot.scoreInputs.confidenceReasons as string[] | undefined) ?? [];
  const integrityFlags = (snapshot.scoreInputs.integrityFlags as string[] | undefined) ?? [];
  const dataWarnings = (snapshot.scoreInputs.dataWarnings as string[] | undefined) ?? [];
  const degradedReasons = (snapshot.scoreInputs.degradedReasons as string[] | undefined) ?? [];

  return {
    propertyId: snapshot.propertyId,
    formulaVersion: snapshot.formulaVersion,
    inputs: snapshot.inputs,
    weights: snapshot.weights,
    subScores: {
      price: snapshot.priceScore,
      size: snapshot.sizeScore,
      safety: snapshot.safetyScore
    },
    finalScore: snapshot.nhaloScore,
    computedAt: snapshot.createdAt,
    safetyConfidence: snapshot.safetyConfidence,
    overallConfidence: snapshot.overallConfidence,
    safetyProvenance: snapshot.safetyProvenance,
    listingProvenance: snapshot.listingProvenance,
    searchOrigin: snapshot.searchOrigin,
    spatialContext: snapshot.spatialContext,
    explainability,
    strengths,
    risks,
    confidenceReasons,
    searchQualityContext: {
      canonicalPropertyId:
        (snapshot.scoreInputs.canonicalPropertyId as string | null | undefined) ?? null,
      deduplicationDecision:
        (snapshot.scoreInputs.deduplicationDecision as string | null | undefined) ?? null,
      comparableSampleSize:
        (snapshot.scoreInputs.comparableSampleSize as number | null | undefined) ?? null,
      comparableStrategyUsed:
        (snapshot.scoreInputs.comparableStrategyUsed as string | null | undefined) ?? null,
      qualityGateDecision:
        (snapshot.scoreInputs.qualityGateDecision as string | null | undefined) ?? null,
      rejectionContext:
        (snapshot.scoreInputs.rejectionContext as Record<string, number> | null | undefined) ?? null,
      rankingTieBreakInputs:
        (snapshot.scoreInputs.rankingTieBreakInputs as Record<string, unknown> | null | undefined) ?? null,
      resultQualityFlags:
        (snapshot.scoreInputs.resultQualityFlags as string[] | undefined) ?? []
    },
    dataQuality: {
      integrityFlags,
      dataWarnings,
      degradedReasons,
      events: clone(qualityEvents)
    }
  };
}

function buildHistoryRecord(
  id: string,
  payload: SearchPersistenceInput,
  createdAt: string,
  snapshotId: string | null,
  validationMetadata?: SearchHistoryRecord["validationMetadata"]
): SearchHistoryRecord {
  return {
    id,
    sessionId: payload.sessionId ?? null,
    request: clone(payload.request),
    resolvedOriginSummary: {
      resolvedFormattedAddress: payload.response.metadata.searchOrigin?.resolvedFormattedAddress ?? null,
      latitude: payload.response.metadata.searchOrigin?.latitude ?? null,
      longitude: payload.response.metadata.searchOrigin?.longitude ?? null,
      precision: payload.response.metadata.searchOrigin?.precision ?? "none"
    },
    summaryMetadata: {
      returnedCount: payload.response.metadata.returnedCount,
      totalMatched: payload.response.metadata.totalMatched,
      durationMs: payload.response.metadata.durationMs,
      warnings: clone(payload.response.metadata.warnings),
      suggestions: clone(payload.response.metadata.suggestions)
    },
    snapshotId,
    searchDefinitionId: payload.searchDefinitionId ?? null,
    rerunSourceType: payload.rerunSourceType ?? null,
    rerunSourceId: payload.rerunSourceId ?? null,
    validationMetadata,
    createdAt
  };
}

function mapStoredDefinition(definition: SearchDefinition): SearchDefinition {
  return clone(definition);
}

function mapStoredShortlist(
  shortlist: StoredShortlist,
  items: StoredShortlistItem[]
): Shortlist {
  return clone({
    ...shortlist,
    itemCount: items.filter((item) => item.shortlistId === shortlist.id).length
  });
}

function mapStoredShortlistItem(item: StoredShortlistItem): ShortlistItem {
  return clone(item);
}

function mapStoredResultNote(note: StoredResultNote): ResultNote {
  return clone(note);
}

function mapStoredSharedShortlist(record: StoredSharedShortlist): SharedShortlist {
  return clone({
    ...record,
    collaborationRole: roleForShareMode(record.shareMode),
    status: sharedShortlistStatus(record)
  });
}

function mapStoredSharedComment(record: StoredSharedComment): SharedComment {
  return clone(record);
}

function mapStoredReviewerDecision(record: StoredReviewerDecision): ReviewerDecision {
  return clone(record);
}

function workflowEventNames(): WorkflowActivityRecord["eventType"][] {
  return [
    "shortlist_created",
    "shortlist_updated",
    "shortlist_deleted",
    "shortlist_item_added",
    "shortlist_item_removed",
    "note_created",
    "note_updated",
    "note_deleted",
    "review_state_changed"
  ];
}

function collaborationEventNames(): CollaborationActivityRecord["eventType"][] {
  return [
    "shortlist_shared",
    "shared_shortlist_opened",
    "shared_comment_added",
    "shared_comment_updated",
    "shared_comment_deleted",
    "reviewer_decision_submitted",
    "reviewer_decision_updated",
    "share_link_revoked",
    "share_link_expired"
  ];
}

function toWorkflowActivity(event: StoredValidationEvent): WorkflowActivityRecord | null {
  if (!workflowEventNames().includes(event.eventName as WorkflowActivityRecord["eventType"])) {
    return null;
  }

  return {
    id: event.id,
    sessionId: event.sessionId ?? null,
    eventType: event.eventName as WorkflowActivityRecord["eventType"],
    shortlistId: (event.payload?.shortlistId as string | null | undefined) ?? null,
    shortlistItemId: (event.payload?.shortlistItemId as string | null | undefined) ?? null,
    noteId: (event.payload?.noteId as string | null | undefined) ?? null,
    payload: event.payload ?? null,
    createdAt: event.createdAt
  };
}

function toCollaborationActivity(event: StoredValidationEvent): CollaborationActivityRecord | null {
  if (!collaborationEventNames().includes(event.eventName as CollaborationActivityRecord["eventType"])) {
    return null;
  }

  return {
    id: event.id,
    shareId: (event.payload?.shareId as string | null | undefined) ?? null,
    shortlistId: (event.payload?.shortlistId as string | null | undefined) ?? null,
    shortlistItemId: (event.payload?.shortlistItemId as string | null | undefined) ?? null,
    commentId: (event.payload?.commentId as string | null | undefined) ?? null,
    reviewerDecisionId:
      (event.payload?.reviewerDecisionId as string | null | undefined) ?? null,
    eventType: event.eventName as CollaborationActivityRecord["eventType"],
    payload: event.payload ?? null,
    createdAt: event.createdAt
  };
}

function filterDataQualityEvents(
  events: StoredDataQualityEvent[],
  filters?: {
    severity?: DataQualityEvent["severity"];
    sourceDomain?: DataQualityEvent["sourceDomain"];
    provider?: string;
    partnerId?: string;
    status?: DataQualityStatus;
    targetId?: string;
    searchRequestId?: string;
    limit?: number;
  }
): StoredDataQualityEvent[] {
  const filtered = events.filter((event) => {
    if (filters?.severity && event.severity !== filters.severity) {
      return false;
    }
    if (filters?.sourceDomain && event.sourceDomain !== filters.sourceDomain) {
      return false;
    }
    if (filters?.provider && event.provider !== filters.provider) {
      return false;
    }
    if (filters?.partnerId && event.partnerId !== filters.partnerId) {
      return false;
    }
    if (filters?.status && event.status !== filters.status) {
      return false;
    }
    if (filters?.targetId && event.targetId !== filters.targetId) {
      return false;
    }
    if (filters?.searchRequestId && event.searchRequestId !== filters.searchRequestId) {
      return false;
    }
    return true;
  });

  filtered.sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  if (filters?.limit) {
    return filtered.slice(0, filters.limit);
  }

  return filtered;
}

function summarizeDataQualityEvents(events: StoredDataQualityEvent[]): DataQualitySummary {
  const bySeverity: DataQualitySummary["bySeverity"] = {
    info: 0,
    warn: 0,
    error: 0,
    critical: 0
  };
  const byDomain: DataQualitySummary["byDomain"] = {
    listing: 0,
    safety: 0,
    geocode: 0,
    search: 0
  };
  const categoryCounts = new Map<string, number>();
  const providerCounts = new Map<string, number>();

  let openCount = 0;
  let acknowledgedCount = 0;
  let resolvedCount = 0;
  let ignoredCount = 0;
  let criticalCount = 0;

  for (const event of events) {
    bySeverity[event.severity] += 1;
    byDomain[event.sourceDomain] += 1;
    categoryCounts.set(event.category, (categoryCounts.get(event.category) ?? 0) + 1);
    if (event.provider) {
      providerCounts.set(event.provider, (providerCounts.get(event.provider) ?? 0) + 1);
    }

    if (event.status === "open") {
      openCount += 1;
    } else if (event.status === "acknowledged") {
      acknowledgedCount += 1;
    } else if (event.status === "resolved") {
      resolvedCount += 1;
    } else if (event.status === "ignored") {
      ignoredCount += 1;
    }

    if (event.severity === "critical") {
      criticalCount += 1;
    }
  }

  return {
    totalEvents: events.length,
    openCount,
    acknowledgedCount,
    resolvedCount,
    ignoredCount,
    criticalCount,
    bySeverity,
    byDomain,
    byCategory: [...categoryCounts.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((left, right) => right.count - left.count),
    byProvider: [...providerCounts.entries()]
      .map(([provider, count]) => ({ provider, count }))
      .sort((left, right) => right.count - left.count)
  };
}

export class InMemorySearchRepository implements SearchRepository {
  public readonly searches: StoredSearch[] = [];
  public readonly scoreSnapshots: StoredSnapshot[] = [];
  public readonly searchSnapshots: SearchSnapshotRecord[] = [];
  public readonly searchDefinitions: SearchDefinition[] = [];
  public readonly shortlists: StoredShortlist[] = [];
  public readonly shortlistItems: StoredShortlistItem[] = [];
  public readonly resultNotes: StoredResultNote[] = [];
  public readonly sharedSnapshots: StoredSharedSnapshot[] = [];
  public readonly sharedShortlists: StoredSharedShortlist[] = [];
  public readonly sharedComments: StoredSharedComment[] = [];
  public readonly reviewerDecisions: StoredReviewerDecision[] = [];
  public readonly pilotPartners: StoredPilotPartner[] = [];
  public readonly pilotLinks: StoredPilotLink[] = [];
  public readonly opsActions: StoredOpsAction[] = [];
  public readonly feedbackRecords: StoredFeedback[] = [];
  public readonly validationEvents: StoredValidationEvent[] = [];
  public readonly dataQualityEvents: StoredDataQualityEvent[] = [];

  async saveSearch(payload: SearchPersistenceInput): Promise<{ historyRecordId: string | null }> {
    const historyRecordId = createId("history");
    const searchRequestId = createId("search");
    this.searches.push({
      id: historyRecordId,
      payload: clone(payload),
      createdAt: new Date().toISOString()
    });

    for (const result of payload.scoredResults) {
      this.scoreSnapshots.push({
        searchRequestId,
        propertyId: result.propertyId,
        formulaVersion: result.formulaVersion,
        explanation: result.explanation,
        priceScore: result.scores.price,
        sizeScore: result.scores.size,
        safetyScore: result.scores.safety,
        nhaloScore: result.scores.nhalo,
        safetyConfidence: result.scores.safetyConfidence,
        overallConfidence: result.scores.overallConfidence,
        weights: result.weights,
        inputs: result.inputs,
        scoreInputs: {
          ...result.scoreInputs,
          explainability: result.explainability,
          strengths: result.strengths ?? [],
          risks: result.risks ?? [],
          confidenceReasons: result.confidenceReasons ?? [],
          integrityFlags: result.integrityFlags ?? [],
          dataWarnings: result.dataWarnings ?? [],
          degradedReasons: result.degradedReasons ?? []
        },
        createdAt: result.computedAt,
        safetyProvenance: {
          safetyDataSource: result.safetyDataSource,
          crimeProvider: result.crimeProvider,
          schoolProvider: result.schoolProvider,
          crimeFetchedAt: result.crimeFetchedAt,
          schoolFetchedAt: result.schoolFetchedAt,
          rawSafetyInputs: result.rawSafetyInputs,
          normalizedSafetyInputs: result.normalizedSafetyInputs
        },
        listingProvenance: {
          listingDataSource: result.listingDataSource,
          listingProvider: result.listingProvider,
          sourceListingId: result.sourceListingId,
          listingFetchedAt: result.listingFetchedAt,
          rawListingInputs: result.rawListingInputs,
          normalizedListingInputs: result.normalizedListingInputs
        },
        searchOrigin: payload.response.metadata.searchOrigin,
        spatialContext: {
          distanceMiles: result.distanceMiles,
          radiusMiles: payload.response.appliedFilters.radiusMiles,
          insideRequestedRadius: result.insideRequestedRadius
        }
      });
    }

    for (const event of payload.qualityEvents ?? []) {
      const timestamp = event.triggeredAt ?? new Date().toISOString();
      this.dataQualityEvents.push({
        id: createId("dq"),
        ...clone(event),
        searchRequestId,
        triggeredAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }

    return { historyRecordId };
  }

  async getScoreAudit(propertyId: string): Promise<ScoreAuditRecord | null> {
    const snapshot = [...this.scoreSnapshots]
      .filter((entry) => entry.propertyId === propertyId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

    if (!snapshot) {
      return null;
    }

    const qualityEvents = this.dataQualityEvents.filter(
      (event) =>
        event.searchRequestId === snapshot.searchRequestId &&
        (event.targetId === propertyId ||
          event.targetId === snapshot.propertyId ||
          event.targetType === "search" ||
          event.targetType === "search_result")
    );

    return toAuditRecord(snapshot, qualityEvents);
  }

  async listDataQualityEvents(filters?: {
    severity?: DataQualityEvent["severity"];
    sourceDomain?: DataQualityEvent["sourceDomain"];
    provider?: string;
    partnerId?: string;
    status?: DataQualityStatus;
    targetId?: string;
    searchRequestId?: string;
    limit?: number;
  }): Promise<DataQualityEvent[]> {
    return filterDataQualityEvents(this.dataQualityEvents, filters).map((event) => clone(event));
  }

  async getDataQualityEvent(id: string): Promise<DataQualityEvent | null> {
    const event = this.dataQualityEvents.find((entry) => entry.id === id) ?? null;
    return event ? clone(event) : null;
  }

  async updateDataQualityEventStatus(
    id: string,
    status: DataQualityStatus
  ): Promise<DataQualityEvent | null> {
    const event = this.dataQualityEvents.find((entry) => entry.id === id) ?? null;
    if (!event) {
      return null;
    }

    event.status = status;
    event.updatedAt = new Date().toISOString();
    return clone(event);
  }

  async getDataQualitySummary(filters?: {
    severity?: DataQualityEvent["severity"];
    sourceDomain?: DataQualityEvent["sourceDomain"];
    provider?: string;
    partnerId?: string;
    status?: DataQualityStatus;
  }): Promise<DataQualitySummary> {
    return summarizeDataQualityEvents(filterDataQualityEvents(this.dataQualityEvents, filters));
  }

  async createSearchSnapshot(payload: {
    request: SearchPersistenceInput["request"];
    response: SearchPersistenceInput["response"];
    sessionId?: string | null;
    searchDefinitionId?: string | null;
    historyRecordId?: string | null;
  }): Promise<SearchSnapshotRecord> {
    const snapshot: SearchSnapshotRecord = {
      id: createId("snapshot"),
      formulaVersion: payload.response.homes[0]?.scores.formulaVersion ?? null,
      request: clone(payload.request),
      response: clone(payload.response),
      sessionId: payload.sessionId ?? null,
      searchDefinitionId: payload.searchDefinitionId ?? null,
      historyRecordId: payload.historyRecordId ?? null,
      validationMetadata: {
        wasShared: false,
        shareCount: 0,
        feedbackCount: 0,
        demoScenarioId: null,
        rerunCount: 0
      },
      createdAt: new Date().toISOString()
    };

    this.searchSnapshots.push(snapshot);

    return clone(snapshot);
  }

  async getSearchSnapshot(id: string): Promise<SearchSnapshotRecord | null> {
    const snapshot = this.searchSnapshots.find((entry) => entry.id === id) ?? null;

    if (!snapshot) {
      return null;
    }

    return clone({
      ...snapshot,
      validationMetadata: buildSnapshotValidationMetadata({
        snapshotId: snapshot.id,
        searchRequestId: snapshot.historyRecordId ?? null,
        demoScenarioId: snapshot.validationMetadata?.demoScenarioId ?? null,
        sharedSnapshots: this.sharedSnapshots,
        feedback: this.feedbackRecords,
        validationEvents: this.validationEvents
      })
    });
  }

  async listSearchSnapshots(sessionId?: string | null, limit = 10): Promise<SearchSnapshotRecord[]> {
    if (!sessionId) {
      return [];
    }

    return this.searchSnapshots
      .filter((snapshot) => snapshot.sessionId === sessionId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit)
      .map((snapshot) =>
        clone({
          ...snapshot,
          validationMetadata: buildSnapshotValidationMetadata({
            snapshotId: snapshot.id,
            searchRequestId: snapshot.historyRecordId ?? null,
            demoScenarioId: snapshot.validationMetadata?.demoScenarioId ?? null,
            sharedSnapshots: this.sharedSnapshots,
            feedback: this.feedbackRecords,
            validationEvents: this.validationEvents
          })
        })
      );
  }

  async createSearchDefinition(payload: {
    sessionId?: string | null;
    label: string;
    request: SearchPersistenceInput["request"];
    pinned?: boolean;
  }): Promise<SearchDefinition> {
    const now = new Date().toISOString();
    const definition: SearchDefinition = {
      id: createId("definition"),
      sessionId: payload.sessionId ?? null,
      label: payload.label,
      request: clone(payload.request),
      pinned: payload.pinned ?? false,
      createdAt: now,
      updatedAt: now,
      lastRunAt: null
    };

    this.searchDefinitions.push(definition);

    return mapStoredDefinition(definition);
  }

  async listSearchDefinitions(sessionId?: string | null): Promise<SearchDefinition[]> {
    if (!sessionId) {
      return [];
    }

    return this.searchDefinitions
      .filter((definition) => definition.sessionId === sessionId)
      .sort((left, right) => {
        if (left.pinned !== right.pinned) {
          return Number(right.pinned) - Number(left.pinned);
        }
        return right.updatedAt.localeCompare(left.updatedAt);
      })
      .map((definition) => mapStoredDefinition(definition));
  }

  async getSearchDefinition(id: string): Promise<SearchDefinition | null> {
    const definition = this.searchDefinitions.find((entry) => entry.id === id) ?? null;

    return definition ? mapStoredDefinition(definition) : null;
  }

  async updateSearchDefinition(
    id: string,
    patch: {
      label?: string;
      pinned?: boolean;
      lastRunAt?: string | null;
    }
  ): Promise<SearchDefinition | null> {
    const definition = this.searchDefinitions.find((entry) => entry.id === id);

    if (!definition) {
      return null;
    }

    if (typeof patch.label === "string") {
      definition.label = patch.label;
    }
    if (typeof patch.pinned === "boolean") {
      definition.pinned = patch.pinned;
    }
    if (patch.lastRunAt !== undefined) {
      definition.lastRunAt = patch.lastRunAt;
    }
    definition.updatedAt = new Date().toISOString();

    return mapStoredDefinition(definition);
  }

  async deleteSearchDefinition(id: string): Promise<boolean> {
    const index = this.searchDefinitions.findIndex((entry) => entry.id === id);

    if (index === -1) {
      return false;
    }

    this.searchDefinitions.splice(index, 1);
    return true;
  }

  async listSearchHistory(sessionId?: string | null, limit = 10): Promise<SearchHistoryRecord[]> {
    if (!sessionId) {
      return [];
    }

    return this.searches
      .filter((entry) => entry.payload.sessionId === sessionId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit)
      .map((entry) =>
        buildHistoryRecord(
          entry.id,
          entry.payload,
          entry.createdAt,
          this.searchSnapshots
            .filter((snapshot) => snapshot.historyRecordId === entry.id)
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]?.id ?? null,
          buildHistoryValidationMetadata({
            historyRecordId: entry.id,
            demoScenarioId: null,
            sharedSnapshots: this.sharedSnapshots,
            feedback: this.feedbackRecords,
            validationEvents: this.validationEvents
          })
        )
      );
  }

  async getSearchHistory(id: string): Promise<SearchHistoryRecord | null> {
    const entry = this.searches.find((search) => search.id === id);

    if (!entry) {
      return null;
    }

    const snapshotId =
      this.searchSnapshots
        .filter((snapshot) => snapshot.historyRecordId === entry.id)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]?.id ?? null;

    return buildHistoryRecord(
      entry.id,
      entry.payload,
      entry.createdAt,
      snapshotId,
      buildHistoryValidationMetadata({
        historyRecordId: entry.id,
        demoScenarioId: null,
        sharedSnapshots: this.sharedSnapshots,
        feedback: this.feedbackRecords,
        validationEvents: this.validationEvents
      })
    );
  }

  async createShortlist(payload: {
    sessionId?: string | null;
    title: string;
    description?: string | null;
    sourceSnapshotId?: string | null;
    pinned?: boolean;
  }): Promise<Shortlist> {
    const now = new Date().toISOString();
    const shortlist: Shortlist = {
      id: createId("shortlist"),
      sessionId: payload.sessionId ?? null,
      title: payload.title,
      description: payload.description ?? null,
      sourceSnapshotId: payload.sourceSnapshotId ?? null,
      pinned: payload.pinned ?? false,
      itemCount: 0,
      createdAt: now,
      updatedAt: now
    };

    this.shortlists.push(shortlist);
    this.validationEvents.push({
      id: createId("workflow"),
      eventName: "shortlist_created",
      sessionId: shortlist.sessionId,
      payload: {
        shortlistId: shortlist.id,
        title: shortlist.title
      },
      createdAt: now
    });

    return mapStoredShortlist(shortlist, this.shortlistItems);
  }

  async listShortlists(sessionId?: string | null): Promise<Shortlist[]> {
    if (!sessionId) {
      return [];
    }

    return this.shortlists
      .filter((entry) => entry.sessionId === sessionId)
      .sort((left, right) => {
        if (left.pinned !== right.pinned) {
          return Number(right.pinned) - Number(left.pinned);
        }
        return right.updatedAt.localeCompare(left.updatedAt);
      })
      .map((entry) => mapStoredShortlist(entry, this.shortlistItems));
  }

  async getShortlist(id: string): Promise<Shortlist | null> {
    const shortlist = this.shortlists.find((entry) => entry.id === id) ?? null;
    return shortlist ? mapStoredShortlist(shortlist, this.shortlistItems) : null;
  }

  async updateShortlist(
    id: string,
    patch: {
      title?: string;
      description?: string | null;
      pinned?: boolean;
    }
  ): Promise<Shortlist | null> {
    const shortlist = this.shortlists.find((entry) => entry.id === id);
    if (!shortlist) {
      return null;
    }

    if (patch.title !== undefined) {
      shortlist.title = patch.title;
    }
    if (patch.description !== undefined) {
      shortlist.description = patch.description;
    }
    if (patch.pinned !== undefined) {
      shortlist.pinned = patch.pinned;
    }
    shortlist.updatedAt = new Date().toISOString();
    this.validationEvents.push({
      id: createId("workflow"),
      eventName: "shortlist_updated",
      sessionId: shortlist.sessionId,
      payload: {
        shortlistId: shortlist.id
      },
      createdAt: shortlist.updatedAt
    });

    return mapStoredShortlist(shortlist, this.shortlistItems);
  }

  async deleteShortlist(id: string): Promise<boolean> {
    const index = this.shortlists.findIndex((entry) => entry.id === id);
    if (index === -1) {
      return false;
    }

    const shortlist = this.shortlists[index];
    this.shortlists.splice(index, 1);
    const removedItemIds = this.shortlistItems
      .filter((entry) => entry.shortlistId === id)
      .map((entry) => entry.id);
    this.shortlistItems.splice(
      0,
      this.shortlistItems.length,
      ...this.shortlistItems.filter((entry) => entry.shortlistId !== id)
    );
    this.resultNotes.splice(
      0,
      this.resultNotes.length,
      ...this.resultNotes.filter((entry) => !removedItemIds.includes(entry.entityId))
    );
    this.validationEvents.push({
      id: createId("workflow"),
      eventName: "shortlist_deleted",
      sessionId: shortlist.sessionId,
      payload: {
        shortlistId: shortlist.id
      },
      createdAt: new Date().toISOString()
    });
    return true;
  }

  async createShortlistItem(
    shortlistId: string,
    payload: {
      canonicalPropertyId: string;
      sourceSnapshotId?: string | null;
      sourceHistoryId?: string | null;
      sourceSearchDefinitionId?: string | null;
      capturedHome: ShortlistItem["capturedHome"];
      reviewState?: ReviewState;
    }
  ): Promise<ShortlistItem | null> {
    const shortlist = this.shortlists.find((entry) => entry.id === shortlistId);
    if (!shortlist) {
      return null;
    }

    const existing = this.shortlistItems.find(
      (entry) =>
        entry.shortlistId === shortlistId &&
        entry.canonicalPropertyId === payload.canonicalPropertyId
    );
    if (existing) {
      return mapStoredShortlistItem(existing);
    }

    const now = new Date().toISOString();
    const item: ShortlistItem = {
      id: createId("shortlist-item"),
      shortlistId,
      canonicalPropertyId: payload.canonicalPropertyId,
      sourceSnapshotId: payload.sourceSnapshotId ?? null,
      sourceHistoryId: payload.sourceHistoryId ?? null,
      sourceSearchDefinitionId: payload.sourceSearchDefinitionId ?? null,
      capturedHome: clone(payload.capturedHome),
      reviewState: payload.reviewState ?? "undecided",
      addedAt: now,
      updatedAt: now
    };

    this.shortlistItems.push(item);
    shortlist.updatedAt = now;
    this.validationEvents.push({
      id: createId("workflow"),
      eventName: "shortlist_item_added",
      sessionId: shortlist.sessionId,
      payload: {
        shortlistId,
        shortlistItemId: item.id,
        canonicalPropertyId: item.canonicalPropertyId
      },
      createdAt: now
    });

    return mapStoredShortlistItem(item);
  }

  async listShortlistItems(shortlistId: string): Promise<ShortlistItem[]> {
    return this.shortlistItems
      .filter((entry) => entry.shortlistId === shortlistId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((entry) => mapStoredShortlistItem(entry));
  }

  async updateShortlistItem(
    shortlistId: string,
    itemId: string,
    patch: {
      reviewState?: ReviewState;
    }
  ): Promise<ShortlistItem | null> {
    const item = this.shortlistItems.find(
      (entry) => entry.shortlistId === shortlistId && entry.id === itemId
    );
    if (!item) {
      return null;
    }

    if (patch.reviewState !== undefined) {
      item.reviewState = patch.reviewState;
    }
    item.updatedAt = new Date().toISOString();
    this.validationEvents.push({
      id: createId("workflow"),
      eventName: "review_state_changed",
      sessionId: this.shortlists.find((entry) => entry.id === shortlistId)?.sessionId ?? null,
      payload: {
        shortlistId,
        shortlistItemId: item.id,
        reviewState: item.reviewState
      },
      createdAt: item.updatedAt
    });

    return mapStoredShortlistItem(item);
  }

  async deleteShortlistItem(shortlistId: string, itemId: string): Promise<boolean> {
    const index = this.shortlistItems.findIndex(
      (entry) => entry.shortlistId === shortlistId && entry.id === itemId
    );
    if (index === -1) {
      return false;
    }

    const [item] = this.shortlistItems.splice(index, 1);
    this.resultNotes.splice(
      0,
      this.resultNotes.length,
      ...this.resultNotes.filter((entry) => entry.entityId !== item.id)
    );
    this.validationEvents.push({
      id: createId("workflow"),
      eventName: "shortlist_item_removed",
      sessionId: this.shortlists.find((entry) => entry.id === shortlistId)?.sessionId ?? null,
      payload: {
        shortlistId,
        shortlistItemId: item.id,
        canonicalPropertyId: item.canonicalPropertyId
      },
      createdAt: new Date().toISOString()
    });
    return true;
  }

  async createResultNote(payload: {
    sessionId?: string | null;
    entityType: ResultNote["entityType"];
    entityId: string;
    body: string;
  }): Promise<ResultNote> {
    const now = new Date().toISOString();
    const note: ResultNote = {
      id: createId("note"),
      sessionId: payload.sessionId ?? null,
      entityType: payload.entityType,
      entityId: payload.entityId,
      body: payload.body,
      createdAt: now,
      updatedAt: now
    };

    this.resultNotes.push(note);
    this.validationEvents.push({
      id: createId("workflow"),
      eventName: "note_created",
      sessionId: note.sessionId,
      payload: {
        noteId: note.id,
        entityType: note.entityType,
        entityId: note.entityId
      },
      createdAt: now
    });

    return mapStoredResultNote(note);
  }

  async listResultNotes(filters?: {
    sessionId?: string | null;
    entityType?: ResultNote["entityType"];
    entityId?: string;
  }): Promise<ResultNote[]> {
    return this.resultNotes
      .filter((entry) => {
        if (filters?.sessionId !== undefined && entry.sessionId !== (filters.sessionId ?? null)) {
          return false;
        }
        if (filters?.entityType && entry.entityType !== filters.entityType) {
          return false;
        }
        if (filters?.entityId && entry.entityId !== filters.entityId) {
          return false;
        }
        return true;
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((entry) => mapStoredResultNote(entry));
  }

  async updateResultNote(id: string, body: string): Promise<ResultNote | null> {
    const note = this.resultNotes.find((entry) => entry.id === id);
    if (!note) {
      return null;
    }

    note.body = body;
    note.updatedAt = new Date().toISOString();
    this.validationEvents.push({
      id: createId("workflow"),
      eventName: "note_updated",
      sessionId: note.sessionId,
      payload: {
        noteId: note.id,
        entityType: note.entityType,
        entityId: note.entityId
      },
      createdAt: note.updatedAt
    });

    return mapStoredResultNote(note);
  }

  async deleteResultNote(id: string): Promise<boolean> {
    const index = this.resultNotes.findIndex((entry) => entry.id === id);
    if (index === -1) {
      return false;
    }

    const [note] = this.resultNotes.splice(index, 1);
    this.validationEvents.push({
      id: createId("workflow"),
      eventName: "note_deleted",
      sessionId: note.sessionId,
      payload: {
        noteId: note.id,
        entityType: note.entityType,
        entityId: note.entityId
      },
      createdAt: new Date().toISOString()
    });
    return true;
  }

  async listWorkflowActivity(sessionId?: string | null, limit = 20): Promise<WorkflowActivityRecord[]> {
    if (!sessionId) {
      return [];
    }

    return this.validationEvents
      .filter((entry) => entry.sessionId === sessionId)
      .map((entry) => toWorkflowActivity(entry))
      .filter((entry): entry is WorkflowActivityRecord => Boolean(entry))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit)
      .map((entry) => clone(entry));
  }

  async createSharedSnapshot(payload: {
    snapshotId: string;
    sessionId?: string | null;
    expiresAt?: string | null;
  }): Promise<SharedSnapshotRecord> {
    const existingSnapshot = this.searchSnapshots.find((entry) => entry.id === payload.snapshotId);
    if (!existingSnapshot) {
      throw new Error("Snapshot not found");
    }

    const record: SharedSnapshotRecord = {
      id: createId("share"),
      shareId: createSensitiveToken("public"),
      snapshotId: payload.snapshotId,
      sessionId: payload.sessionId ?? null,
      expiresAt: payload.expiresAt ?? null,
      revokedAt: null,
      openCount: 0,
      status: "active",
      createdAt: new Date().toISOString()
    };

    this.sharedSnapshots.push(record);

    return clone(record);
  }

  async getSharedSnapshot(shareId: string): Promise<SharedSnapshotView | null> {
    const shared = this.sharedSnapshots.find((entry) => entry.shareId === shareId) ?? null;
    if (!shared) {
      return null;
    }

    const status = sharedSnapshotStatus(shared);
    shared.status = status;
    const snapshot = await this.getSearchSnapshot(shared.snapshotId);
    if (!snapshot) {
      return null;
    }

    if (status === "active") {
      shared.openCount += 1;
    }

    return {
      share: clone({
        ...shared,
        status: sharedSnapshotStatus(shared)
      }),
      snapshot
    };
  }

  async createSharedShortlist(payload: {
    shortlistId: string;
    sessionId?: string | null;
    shareMode: ShareMode;
    expiresAt?: string | null;
  }): Promise<SharedShortlist> {
    const shortlist = this.shortlists.find((entry) => entry.id === payload.shortlistId);
    if (!shortlist) {
      throw new Error("Shortlist not found");
    }

    const record: SharedShortlist = {
      id: createId("shared-shortlist"),
      shareId: createSensitiveToken("shortlist-share"),
      shortlistId: payload.shortlistId,
      sessionId: payload.sessionId ?? shortlist.sessionId ?? null,
      shareMode: payload.shareMode,
      collaborationRole: roleForShareMode(payload.shareMode),
      expiresAt: payload.expiresAt ?? null,
      revokedAt: null,
      openCount: 0,
      status: "active",
      createdAt: new Date().toISOString()
    };

    this.sharedShortlists.push(record);
    this.validationEvents.push({
      id: createId("collaboration"),
      eventName: "shortlist_shared",
      sessionId: record.sessionId ?? null,
      payload: {
        shareId: record.shareId,
        shortlistId: record.shortlistId,
        shareMode: record.shareMode
      },
      createdAt: record.createdAt
    });

    return mapStoredSharedShortlist(record);
  }

  async listSharedShortlists(shortlistId: string): Promise<SharedShortlist[]> {
    return this.sharedShortlists
      .filter((entry) => entry.shortlistId === shortlistId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((entry) => mapStoredSharedShortlist(entry));
  }

  async getSharedShortlist(shareId: string): Promise<SharedShortlistView | null> {
    const shared = this.sharedShortlists.find((entry) => entry.shareId === shareId) ?? null;
    if (!shared) {
      return null;
    }

    const shortlist = await this.getShortlist(shared.shortlistId);
    if (!shortlist) {
      return null;
    }

    const status = sharedShortlistStatus(shared);
    shared.status = status;
    if (status === "active") {
      shared.openCount += 1;
      this.validationEvents.push({
        id: createId("collaboration"),
        eventName: "shared_shortlist_opened",
        sessionId: shared.sessionId ?? null,
        payload: {
          shareId: shared.shareId,
          shortlistId: shared.shortlistId,
          shareMode: shared.shareMode
        },
        createdAt: new Date().toISOString()
      });
    } else if (status === "expired") {
      this.validationEvents.push({
        id: createId("collaboration"),
        eventName: "share_link_expired",
        sessionId: shared.sessionId ?? null,
        payload: {
          shareId: shared.shareId,
          shortlistId: shared.shortlistId
        },
        createdAt: new Date().toISOString()
      });
    }

    const items = await this.listShortlistItems(shortlist.id);
    const comments = await this.listSharedComments({ shareId });
    const reviewerDecisions = await this.listReviewerDecisions({ shareId });
    const collaborationActivity = await this.listCollaborationActivity({ shareId, limit: 20 });

    return {
      readOnly: shared.shareMode === "read_only" || sharedShortlistStatus(shared) !== "active",
      shared: true,
      share: mapStoredSharedShortlist(shared),
      shortlist,
      items,
      comments,
      reviewerDecisions,
      collaborationActivity
    };
  }

  async revokeSharedShortlist(shareId: string): Promise<SharedShortlist | null> {
    const shared = this.sharedShortlists.find((entry) => entry.shareId === shareId);
    if (!shared) {
      return null;
    }

    shared.revokedAt = new Date().toISOString();
    shared.status = "revoked";
    this.validationEvents.push({
      id: createId("collaboration"),
      eventName: "share_link_revoked",
      sessionId: shared.sessionId ?? null,
      payload: {
        shareId: shared.shareId,
        shortlistId: shared.shortlistId
      },
      createdAt: shared.revokedAt
    });

    return mapStoredSharedShortlist(shared);
  }

  async createPilotPartner(payload: {
    name: string;
    slug: string;
    planTier?: PlanTier;
    status?: PilotPartnerStatus;
    contactLabel?: string | null;
    notes?: string | null;
    featureOverrides?: Partial<PilotFeatureOverrides>;
  }): Promise<PilotPartner> {
    const now = new Date().toISOString();
    const partner: PilotPartner = {
      id: createId("pilot-partner"),
      name: payload.name,
      slug: payload.slug,
      planTier: payload.planTier ?? getConfig().product.defaultPlanTier,
      status: payload.status ?? "active",
      contactLabel: payload.contactLabel ?? null,
      notes: payload.notes ?? null,
      featureOverrides: mergePilotFeatures(payload.featureOverrides),
      createdAt: now,
      updatedAt: now
    };
    this.pilotPartners.push(partner);
    return clone(partner);
  }

  async listPilotPartners(): Promise<PilotPartner[]> {
    return this.pilotPartners
      .slice()
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((entry) => clone(entry));
  }

  async getPilotPartner(id: string): Promise<PilotPartner | null> {
    const partner = this.pilotPartners.find((entry) => entry.id === id) ?? null;
    return partner ? clone(partner) : null;
  }

  async updatePilotPartner(
    id: string,
    patch: {
      name?: string;
      planTier?: PlanTier;
      status?: PilotPartnerStatus;
      contactLabel?: string | null;
      notes?: string | null;
      featureOverrides?: Partial<PilotFeatureOverrides>;
    }
  ): Promise<PilotPartner | null> {
    const partner = this.pilotPartners.find((entry) => entry.id === id);
    if (!partner) {
      return null;
    }
    if (patch.name !== undefined) partner.name = patch.name;
    if (patch.planTier !== undefined) partner.planTier = patch.planTier;
    if (patch.status !== undefined) partner.status = patch.status;
    if (patch.contactLabel !== undefined) partner.contactLabel = patch.contactLabel;
    if (patch.notes !== undefined) partner.notes = patch.notes;
    if (patch.featureOverrides !== undefined) {
      partner.featureOverrides = mergePilotFeatures({
        ...partner.featureOverrides,
        ...patch.featureOverrides
      });
    }
    partner.updatedAt = new Date().toISOString();
    return clone(partner);
  }

  async createPilotLink(payload: {
    partnerId: string;
    expiresAt?: string | null;
    allowedFeatures?: Partial<PilotFeatureOverrides>;
  }): Promise<PilotLinkRecord> {
    const partner = this.pilotPartners.find((entry) => entry.id === payload.partnerId);
    if (!partner) {
      throw new Error("Pilot partner not found");
    }
    const record: PilotLinkRecord = {
      id: createId("pilot-link"),
      partnerId: payload.partnerId,
      token: createSensitiveToken("pilot"),
      allowedFeatures: mergePilotFeatures({
        ...partner.featureOverrides,
        ...payload.allowedFeatures
      }),
      createdAt: new Date().toISOString(),
      expiresAt:
        payload.expiresAt ??
        new Date(Date.now() + DEFAULT_PILOT_LINK_EXPIRATION_DAYS * 86_400_000).toISOString(),
      revokedAt: null,
      openCount: 0,
      status: "active"
    };
    this.pilotLinks.push(record);
    return clone(record);
  }

  async listPilotLinks(partnerId?: string): Promise<PilotLinkRecord[]> {
    return this.pilotLinks
      .filter((entry) => (partnerId ? entry.partnerId === partnerId : true))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((entry) =>
        clone({
          ...entry,
          status: pilotLinkStatus(entry)
        })
      );
  }

  async getPilotLink(token: string): Promise<PilotLinkView | null> {
    const link = this.pilotLinks.find((entry) => entry.token === token) ?? null;
    if (!link) {
      return null;
    }
    link.status = pilotLinkStatus(link);
    const partner = this.pilotPartners.find((entry) => entry.id === link.partnerId) ?? null;
    if (!partner) {
      return null;
    }
    if (link.status === "active") {
      link.openCount += 1;
    }
    return {
      link: clone({
        ...link,
        status: pilotLinkStatus(link)
      }),
      partner: clone(partner),
      context: {
        partnerId: partner.id,
        partnerSlug: partner.slug,
        partnerName: partner.name,
        planTier: partner.planTier,
        status: partner.status,
        pilotLinkId: link.id,
        pilotToken: link.token,
        allowedFeatures: clone(link.allowedFeatures),
        capabilities: resolveStoredCapabilities(partner.planTier, link.allowedFeatures)
      }
    };
  }

  async revokePilotLink(token: string): Promise<PilotLinkRecord | null> {
    const link = this.pilotLinks.find((entry) => entry.token === token);
    if (!link) {
      return null;
    }
    link.revokedAt = new Date().toISOString();
    link.status = "revoked";
    return clone(link);
  }

  async createSharedComment(payload: {
    shareId: string;
    entityType: SharedCommentEntityType;
    entityId: string;
    authorLabel?: string | null;
    body: string;
  }): Promise<SharedComment> {
    const now = new Date().toISOString();
    const record: SharedComment = {
      id: createId("shared-comment"),
      shareId: payload.shareId,
      entityType: payload.entityType,
      entityId: payload.entityId,
      authorLabel: payload.authorLabel ?? null,
      body: payload.body,
      createdAt: now,
      updatedAt: now
    };

    this.sharedComments.push(record);
    const share = this.sharedShortlists.find((entry) => entry.shareId === payload.shareId) ?? null;
    this.validationEvents.push({
      id: createId("collaboration"),
      eventName: "shared_comment_added",
      sessionId: share?.sessionId ?? null,
      payload: {
        shareId: payload.shareId,
        shortlistId: share?.shortlistId ?? null,
        shortlistItemId: payload.entityId,
        commentId: record.id
      },
      createdAt: now
    });

    return mapStoredSharedComment(record);
  }

  async listSharedComments(filters: {
    shareId: string;
    entityType?: SharedCommentEntityType;
    entityId?: string;
  }): Promise<SharedComment[]> {
    return this.sharedComments
      .filter((entry) => {
        if (entry.shareId !== filters.shareId) {
          return false;
        }
        if (filters.entityType && entry.entityType !== filters.entityType) {
          return false;
        }
        if (filters.entityId && entry.entityId !== filters.entityId) {
          return false;
        }
        return true;
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((entry) => mapStoredSharedComment(entry));
  }

  async getSharedComment(id: string): Promise<SharedComment | null> {
    const record = this.sharedComments.find((entry) => entry.id === id) ?? null;
    return record ? mapStoredSharedComment(record) : null;
  }

  async updateSharedComment(
    id: string,
    body: string,
    authorLabel?: string | null
  ): Promise<SharedComment | null> {
    const record = this.sharedComments.find((entry) => entry.id === id);
    if (!record) {
      return null;
    }

    record.body = body;
    if (authorLabel !== undefined) {
      record.authorLabel = authorLabel ?? null;
    }
    record.updatedAt = new Date().toISOString();
    const share = this.sharedShortlists.find((entry) => entry.shareId === record.shareId) ?? null;
    this.validationEvents.push({
      id: createId("collaboration"),
      eventName: "shared_comment_updated",
      sessionId: share?.sessionId ?? null,
      payload: {
        shareId: record.shareId,
        shortlistId: share?.shortlistId ?? null,
        shortlistItemId: record.entityId,
        commentId: record.id
      },
      createdAt: record.updatedAt
    });

    return mapStoredSharedComment(record);
  }

  async deleteSharedComment(id: string): Promise<boolean> {
    const index = this.sharedComments.findIndex((entry) => entry.id === id);
    if (index === -1) {
      return false;
    }

    const [record] = this.sharedComments.splice(index, 1);
    const share = this.sharedShortlists.find((entry) => entry.shareId === record.shareId) ?? null;
    this.validationEvents.push({
      id: createId("collaboration"),
      eventName: "shared_comment_deleted",
      sessionId: share?.sessionId ?? null,
      payload: {
        shareId: record.shareId,
        shortlistId: share?.shortlistId ?? null,
        shortlistItemId: record.entityId,
        commentId: record.id
      },
      createdAt: new Date().toISOString()
    });
    return true;
  }

  async createReviewerDecision(payload: {
    shareId: string;
    shortlistItemId: string;
    decision: ReviewerDecisionValue;
    note?: string | null;
  }): Promise<ReviewerDecision> {
    const existing = this.reviewerDecisions.find(
      (entry) => entry.shareId === payload.shareId && entry.shortlistItemId === payload.shortlistItemId
    );
    if (existing) {
      existing.decision = payload.decision;
      existing.note = payload.note ?? null;
      existing.updatedAt = new Date().toISOString();
      const share = this.sharedShortlists.find((entry) => entry.shareId === payload.shareId) ?? null;
      this.validationEvents.push({
        id: createId("collaboration"),
        eventName: "reviewer_decision_updated",
        sessionId: share?.sessionId ?? null,
        payload: {
          shareId: payload.shareId,
          shortlistId: share?.shortlistId ?? null,
          shortlistItemId: payload.shortlistItemId,
          reviewerDecisionId: existing.id,
          decision: existing.decision
        },
        createdAt: existing.updatedAt
      });
      return mapStoredReviewerDecision(existing);
    }

    const now = new Date().toISOString();
    const record: ReviewerDecision = {
      id: createId("reviewer-decision"),
      shareId: payload.shareId,
      shortlistItemId: payload.shortlistItemId,
      decision: payload.decision,
      note: payload.note ?? null,
      createdAt: now,
      updatedAt: now
    };
    this.reviewerDecisions.push(record);
    const share = this.sharedShortlists.find((entry) => entry.shareId === payload.shareId) ?? null;
    this.validationEvents.push({
      id: createId("collaboration"),
      eventName: "reviewer_decision_submitted",
      sessionId: share?.sessionId ?? null,
      payload: {
        shareId: payload.shareId,
        shortlistId: share?.shortlistId ?? null,
        shortlistItemId: payload.shortlistItemId,
        reviewerDecisionId: record.id,
        decision: payload.decision
      },
      createdAt: now
    });

    return mapStoredReviewerDecision(record);
  }

  async listReviewerDecisions(filters: {
    shareId: string;
    shortlistItemId?: string;
  }): Promise<ReviewerDecision[]> {
    return this.reviewerDecisions
      .filter((entry) => {
        if (entry.shareId !== filters.shareId) {
          return false;
        }
        if (filters.shortlistItemId && entry.shortlistItemId !== filters.shortlistItemId) {
          return false;
        }
        return true;
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((entry) => mapStoredReviewerDecision(entry));
  }

  async getReviewerDecision(id: string): Promise<ReviewerDecision | null> {
    const record = this.reviewerDecisions.find((entry) => entry.id === id) ?? null;
    return record ? mapStoredReviewerDecision(record) : null;
  }

  async updateReviewerDecision(
    id: string,
    patch: {
      decision?: ReviewerDecisionValue;
      note?: string | null;
    }
  ): Promise<ReviewerDecision | null> {
    const record = this.reviewerDecisions.find((entry) => entry.id === id);
    if (!record) {
      return null;
    }

    if (patch.decision !== undefined) {
      record.decision = patch.decision;
    }
    if (patch.note !== undefined) {
      record.note = patch.note ?? null;
    }
    record.updatedAt = new Date().toISOString();
    const share = this.sharedShortlists.find((entry) => entry.shareId === record.shareId) ?? null;
    this.validationEvents.push({
      id: createId("collaboration"),
      eventName: "reviewer_decision_updated",
      sessionId: share?.sessionId ?? null,
      payload: {
        shareId: record.shareId,
        shortlistId: share?.shortlistId ?? null,
        shortlistItemId: record.shortlistItemId,
        reviewerDecisionId: record.id,
        decision: record.decision
      },
      createdAt: record.updatedAt
    });

    return mapStoredReviewerDecision(record);
  }

  async deleteReviewerDecision(id: string): Promise<boolean> {
    const index = this.reviewerDecisions.findIndex((entry) => entry.id === id);
    if (index === -1) {
      return false;
    }

    this.reviewerDecisions.splice(index, 1);
    return true;
  }

  async listCollaborationActivity(filters: {
    shareId?: string;
    shortlistId?: string;
    limit?: number;
  }): Promise<CollaborationActivityRecord[]> {
    return this.validationEvents
      .map((entry) => toCollaborationActivity(entry))
      .filter((entry): entry is CollaborationActivityRecord => Boolean(entry))
      .filter((entry) => {
        if (filters.shareId && entry.shareId !== filters.shareId) {
          return false;
        }
        if (filters.shortlistId && entry.shortlistId !== filters.shortlistId) {
          return false;
        }
        return true;
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, filters.limit ?? 20)
      .map((entry) => clone(entry));
  }

  async recordOpsAction(payload: {
    actionType: string;
    targetType: string;
    targetId: string;
    partnerId?: string | null;
    result: OpsActionRecord["result"];
    details?: Record<string, unknown> | null;
  }): Promise<OpsActionRecord> {
    const record: OpsActionRecord = {
      id: createId("ops-action"),
      actionType: payload.actionType,
      targetType: payload.targetType,
      targetId: payload.targetId,
      partnerId: payload.partnerId ?? null,
      performedAt: new Date().toISOString(),
      result: payload.result,
      details: payload.details ?? null
    };
    this.opsActions.push(record);
    return clone(record);
  }

  async listOpsActions(filters?: {
    partnerId?: string;
    limit?: number;
  }): Promise<OpsActionRecord[]> {
    return this.opsActions
      .filter((entry) => (filters?.partnerId ? entry.partnerId === filters.partnerId : true))
      .sort((left, right) => right.performedAt.localeCompare(left.performedAt))
      .slice(0, filters?.limit ?? 20)
      .map((entry) => clone(entry));
  }

  async listPilotActivity(filters: {
    partnerId: string;
    limit?: number;
  }): Promise<PilotActivityRecord[]> {
    return this.validationEvents
      .filter((entry) => entry.payload?.partnerId === filters.partnerId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, filters.limit ?? 20)
      .map((entry) => ({
        id: entry.id,
        partnerId: filters.partnerId,
        pilotLinkId: (entry.payload?.pilotLinkId as string | null | undefined) ?? null,
        eventType: entry.eventName as PilotActivityRecord["eventType"],
        payload: entry.payload ?? null,
        createdAt: entry.createdAt
      }));
  }

  async getOpsSummary(): Promise<OpsSummary> {
    const now = Date.now();
    const linkCounts = {
      total: this.pilotLinks.length,
      active: this.pilotLinks.filter((entry) => pilotLinkStatus(entry) === "active").length,
      revoked: this.pilotLinks.filter((entry) => pilotLinkStatus(entry) === "revoked").length,
      expired: this.pilotLinks.filter((entry) => pilotLinkStatus(entry) === "expired").length
    };
    const recentWindowMs = 7 * 86_400_000;
    return {
      activePilotPartners: this.pilotPartners.filter((entry) => entry.status === "active").length,
      pilotLinkCounts: linkCounts,
      recentSharedSnapshotCount: this.validationEvents.filter(
        (entry) =>
          entry.eventName === "snapshot_shared" &&
          now - new Date(entry.createdAt).getTime() <= recentWindowMs
      ).length,
      recentShortlistShareCount: this.validationEvents.filter(
        (entry) =>
          entry.eventName === "shortlist_shared" &&
          now - new Date(entry.createdAt).getTime() <= recentWindowMs
      ).length,
      feedbackCount: this.feedbackRecords.length,
      validationEventCount: this.validationEvents.length,
      topErrorCategories: [],
      providerDegradationCount: this.validationEvents.filter(
        (entry) => entry.eventName === "provider_degraded_during_pilot"
      ).length,
      partnerUsage: summarizePartnerUsage({
        searches: this.searches.map((entry) => ({
          partnerId: entry.payload.partnerId ?? null,
          performance: entry.payload.response.metadata.performance
        })),
        partners: this.pilotPartners,
        validationEvents: this.validationEvents,
        dataQualityEvents: this.dataQualityEvents
      })
    };
  }

  async getPartnerUsageSummary(partnerId?: string): Promise<PartnerUsageSummary[]> {
    return summarizePartnerUsage({
      searches: this.searches.map((entry) => ({
        partnerId: entry.payload.partnerId ?? null,
        performance: entry.payload.response.metadata.performance
      })),
      partners: this.pilotPartners,
      validationEvents: this.validationEvents,
      dataQualityEvents: this.dataQualityEvents,
      partnerId
    });
  }

  async getUsageFunnelSummary(): Promise<UsageFunnelSummary> {
    return buildUsageFunnelSummary(this.validationEvents, this.searchSnapshots.length);
  }

  async getUsageFrictionSummary(): Promise<UsageFrictionSummary> {
    return buildUsageFrictionSummary({
      searches: this.searches.map((entry) => ({
        id: entry.id,
        locationType: entry.payload.request.locationType,
        returnedCount: entry.payload.response.metadata.returnedCount,
        topOverallConfidence: entry.payload.response.homes[0]?.scores.overallConfidence ?? null
      })),
      snapshots: await this.listSearchSnapshots(undefined, Math.max(this.searchSnapshots.length, 1_000)),
      shortlists: await this.listShortlists(),
      validationEvents: this.validationEvents
    });
  }

  async getPlanSummary(): Promise<PlanSummary> {
    return buildPlanSummary(this.pilotPartners);
  }

  async createFeedback(payload: {
    sessionId?: string | null;
    snapshotId?: string | null;
    historyRecordId?: string | null;
    searchDefinitionId?: string | null;
    category: FeedbackRecord["category"];
    value: FeedbackRecord["value"];
    comment?: string | null;
  }): Promise<FeedbackRecord> {
    const record: FeedbackRecord = {
      id: createId("feedback"),
      sessionId: payload.sessionId ?? null,
      snapshotId: payload.snapshotId ?? null,
      historyRecordId: payload.historyRecordId ?? null,
      searchDefinitionId: payload.searchDefinitionId ?? null,
      category: payload.category,
      value: payload.value,
      comment: payload.comment ?? null,
      createdAt: new Date().toISOString()
    };

    this.feedbackRecords.push(record);
    this.validationEvents.push({
      id: createId("validation-event"),
      eventName: "feedback_submitted",
      sessionId: payload.sessionId ?? null,
      snapshotId: payload.snapshotId ?? null,
      historyRecordId: payload.historyRecordId ?? null,
      searchDefinitionId: payload.searchDefinitionId ?? null,
      payload: {
        category: payload.category,
        value: payload.value
      },
      createdAt: new Date().toISOString()
    });

    return clone(record);
  }

  async recordValidationEvent(payload: {
    eventName: ValidationEventRecord["eventName"];
    sessionId?: string | null;
    snapshotId?: string | null;
    historyRecordId?: string | null;
    searchDefinitionId?: string | null;
    demoScenarioId?: string | null;
    payload?: Record<string, unknown> | null;
  }): Promise<ValidationEventRecord> {
    const record: ValidationEventRecord = {
      id: createId("validation-event"),
      eventName: payload.eventName,
      sessionId: payload.sessionId ?? null,
      snapshotId: payload.snapshotId ?? null,
      historyRecordId: payload.historyRecordId ?? null,
      searchDefinitionId: payload.searchDefinitionId ?? null,
      demoScenarioId: payload.demoScenarioId ?? null,
      payload: payload.payload ?? null,
      createdAt: new Date().toISOString()
    };

    this.validationEvents.push(record);

    return clone(record);
  }

  async getValidationSummary(): Promise<ValidationSummary> {
    const sessions = new Set(
      this.searches.map((entry) => entry.payload.sessionId).filter(Boolean) as string[]
    );
    const eventCounts = new Map<string, number>();
    for (const event of this.validationEvents) {
      eventCounts.set(event.eventName, (eventCounts.get(event.eventName) ?? 0) + 1);
    }

    const rejectionCounts = new Map<string, number>();
    const confidenceCounts = new Map<string, number>();
    for (const entry of this.searches) {
      const rejectionSummary = entry.payload.response.metadata.rejectionSummary;
      if (rejectionSummary) {
        for (const [key, value] of Object.entries(rejectionSummary)) {
          rejectionCounts.set(key, (rejectionCounts.get(key) ?? 0) + Number(value));
        }
      }
      for (const home of entry.payload.response.homes) {
        confidenceCounts.set(
          home.scores.overallConfidence,
          (confidenceCounts.get(home.scores.overallConfidence) ?? 0) + 1
        );
      }
    }

    const demoScenarioCounts = new Map<string, number>();
    for (const event of this.validationEvents) {
      if (event.demoScenarioId) {
        demoScenarioCounts.set(
          event.demoScenarioId,
          (demoScenarioCounts.get(event.demoScenarioId) ?? 0) + 1
        );
      }
    }

    const usefulCount = this.feedbackRecords.filter((entry) => entry.value === "positive").length;

    return {
      searchesPerSession: {
        sessions: sessions.size,
        searches: this.searches.length,
        average: sessions.size === 0 ? 0 : Number((this.searches.length / sessions.size).toFixed(2))
      },
      shareableSnapshotsCreated: this.sharedSnapshots.length,
      sharedSnapshotOpens: this.validationEvents.filter((entry) => entry.eventName === "snapshot_opened").length,
      sharedSnapshotOpenRate: {
        opens: this.validationEvents.filter((entry) => entry.eventName === "snapshot_opened").length,
        created: this.sharedSnapshots.length,
        rate:
          this.sharedSnapshots.length === 0
            ? 0
            : Number(
                (
                  this.validationEvents.filter((entry) => entry.eventName === "snapshot_opened").length /
                  this.sharedSnapshots.length
                ).toFixed(4)
              )
      },
      feedbackSubmissionRate: {
        feedbackCount: this.feedbackRecords.length,
        sessions: sessions.size,
        rate: sessions.size === 0 ? 0 : Number((this.feedbackRecords.length / sessions.size).toFixed(4))
      },
      emptyStateRate: {
        emptyStates: this.validationEvents.filter((entry) => entry.eventName === "empty_state_encountered").length,
        searches: this.searches.length,
        rate:
          this.searches.length === 0
            ? 0
            : Number(
                (
                  this.validationEvents.filter((entry) => entry.eventName === "empty_state_encountered").length /
                  this.searches.length
                ).toFixed(4)
              )
      },
      rerunRate: {
        reruns: this.validationEvents.filter((entry) => entry.eventName === "rerun_executed").length,
        searches: this.searches.length,
        rate:
          this.searches.length === 0
            ? 0
            : Number(
                (
                  this.validationEvents.filter((entry) => entry.eventName === "rerun_executed").length /
                  this.searches.length
                ).toFixed(4)
              )
      },
      compareUsageRate: {
        comparisons: this.validationEvents.filter((entry) => entry.eventName === "comparison_started").length,
        sessions: sessions.size,
        rate:
          sessions.size === 0
            ? 0
            : Number(
                (
                  this.validationEvents.filter((entry) => entry.eventName === "comparison_started").length /
                  sessions.size
                ).toFixed(4)
              )
      },
      restoreUsageRate: {
        restores: this.validationEvents.filter((entry) => entry.eventName === "restore_used").length,
        sessions: sessions.size,
        rate:
          sessions.size === 0
            ? 0
            : Number(
                (
                  this.validationEvents.filter((entry) => entry.eventName === "restore_used").length /
                  sessions.size
                ).toFixed(4)
              )
      },
      mostCommonRejectionReasons: [...rejectionCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5)
        .map(([reason, count]) => ({ reason, count })),
      mostCommonConfidenceLevels: [...confidenceCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .map(([confidence, count]) => ({
          confidence: confidence as ValidationSummary["mostCommonConfidenceLevels"][number]["confidence"],
          count
        })),
      topDemoScenariosUsed: [...demoScenarioCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5)
        .map(([demoScenarioId, count]) => ({ demoScenarioId, count })),
      mostViewedSharedSnapshots: [...this.sharedSnapshots]
        .sort((left, right) => right.openCount - left.openCount)
        .slice(0, 5)
        .map((entry) => ({
          snapshotId: entry.snapshotId,
          opens: entry.openCount
        }))
    };
  }
}

export class InMemoryMarketSnapshotRepository implements MarketSnapshotRepository {
  public readonly snapshots: MarketSnapshot[] = [];

  async createSnapshot(snapshot: Omit<MarketSnapshot, "id">): Promise<MarketSnapshot> {
    const record: MarketSnapshot = {
      ...snapshot,
      id: createId("market")
    };

    this.snapshots.push(record);

    return record;
  }

  async getLatestSnapshot(location: string, radiusMiles: number): Promise<MarketSnapshot | null> {
    const snapshot = [...this.snapshots]
      .filter((entry) => entry.location === location && entry.radiusMiles === radiusMiles)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

    return snapshot ?? null;
  }

  isSnapshotFresh(snapshot: MarketSnapshot, maxAgeHours = MARKET_SNAPSHOT_FRESH_HOURS): boolean {
    return ageHours(snapshot.createdAt) <= maxAgeHours;
  }
}

export class InMemorySafetySignalCacheRepository implements SafetySignalCacheRepository {
  public readonly entries: SafetySignalCacheRecord[] = [];

  async save(entry: Omit<SafetySignalCacheRecord, "id">): Promise<SafetySignalCacheRecord> {
    const record: SafetySignalCacheRecord = {
      ...entry,
      id: createId("safety")
    };

    this.entries.push(record);

    return record;
  }

  async getLatest(locationKey: string): Promise<SafetySignalCacheRecord | null> {
    const record = [...this.entries]
      .filter((entry) => entry.locationKey === locationKey)
      .sort((left, right) => right.fetchedAt.localeCompare(left.fetchedAt))[0];

    return record ?? null;
  }

  isFresh(
    entry: SafetySignalCacheRecord,
    ttlHours = DEFAULT_SAFETY_CACHE_TTL_HOURS
  ): boolean {
    return ageHours(entry.fetchedAt) <= ttlHours;
  }

  isStaleUsable(
    entry: SafetySignalCacheRecord,
    staleTtlHours = DEFAULT_SAFETY_STALE_TTL_HOURS
  ): boolean {
    return ageHours(entry.fetchedAt) <= staleTtlHours;
  }
}

export class InMemoryListingCacheRepository implements ListingCacheRepository {
  public readonly entries: ListingCacheRecord[] = [];

  async save(entry: Omit<ListingCacheRecord, "id">): Promise<ListingCacheRecord> {
    const record: ListingCacheRecord = {
      ...entry,
      id: createId("listing-cache")
    };

    this.entries.push(record);

    return record;
  }

  async getLatest(locationKey: string): Promise<ListingCacheRecord | null> {
    const record = [...this.entries]
      .filter((entry) => entry.locationKey === locationKey)
      .sort((left, right) => right.fetchedAt.localeCompare(left.fetchedAt))[0];

    return record ?? null;
  }

  isFresh(entry: ListingCacheRecord, ttlHours = DEFAULT_LISTING_CACHE_TTL_HOURS): boolean {
    return ageHours(entry.fetchedAt) <= ttlHours;
  }

  isStaleUsable(
    entry: ListingCacheRecord,
    staleTtlHours = DEFAULT_LISTING_STALE_TTL_HOURS
  ): boolean {
    return ageHours(entry.fetchedAt) <= staleTtlHours;
  }
}

export class InMemoryGeocodeCacheRepository implements GeocodeCacheRepository {
  public readonly entries: GeocodeCacheRecord[] = [];

  async save(entry: Omit<GeocodeCacheRecord, "id">): Promise<GeocodeCacheRecord> {
    const record: GeocodeCacheRecord = {
      ...entry,
      id: createId("geocode-cache")
    };

    this.entries.push(record);

    return record;
  }

  async getLatest(queryType: GeocodeCacheRecord["queryType"], queryValue: string): Promise<GeocodeCacheRecord | null> {
    const normalizedValue = queryValue.trim().toLowerCase();
    const record = [...this.entries]
      .filter(
        (entry) =>
          entry.queryType === queryType && entry.queryValue.trim().toLowerCase() === normalizedValue
      )
      .sort((left, right) => right.fetchedAt.localeCompare(left.fetchedAt))[0];

    return record ?? null;
  }

  isFresh(entry: GeocodeCacheRecord, ttlHours = DEFAULT_GEOCODE_CACHE_TTL_HOURS): boolean {
    return ageHours(entry.fetchedAt) <= ttlHours;
  }

  isStaleUsable(
    entry: GeocodeCacheRecord,
    staleTtlHours = DEFAULT_GEOCODE_STALE_TTL_HOURS
  ): boolean {
    return ageHours(entry.fetchedAt) <= staleTtlHours;
  }
}

type PrismaClientLike = {
  $connect?(): Promise<void>;
  $disconnect?(): Promise<void>;
  $queryRawUnsafe?(query: string): Promise<unknown>;
  property: {
    upsert(args: Record<string, unknown>): Promise<unknown>;
  };
  searchRequest: {
    create(args: Record<string, unknown>): Promise<{ id: string }>;
    findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    deleteMany?(args: Record<string, unknown>): Promise<{ count: number }>;
  };
  scoreSnapshot: {
    createMany(args: Record<string, unknown>): Promise<unknown>;
    findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  };
  searchSnapshot: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
    findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    deleteMany?(args: Record<string, unknown>): Promise<{ count: number }>;
    update?(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  searchDefinition: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    delete(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  shortlist: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    delete(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  shortlistItem: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    delete(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  resultNote: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    delete(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  sharedShortlistLink: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    update?(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    findMany?(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  };
  sharedComment: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    delete(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  reviewerDecision: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    delete(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  pilotPartner: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  pilotLink: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  opsAction: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  };
  sharedSnapshotLink: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    count?(args: Record<string, unknown>): Promise<number>;
    update?(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    findMany?(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  };
  feedback: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    count?(args: Record<string, unknown>): Promise<number>;
    groupBy?(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
    findMany?(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  };
  validationEvent: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    count?(args: Record<string, unknown>): Promise<number>;
    groupBy?(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
    findMany?(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  };
  dataQualityEvent: {
    createMany?(args: Record<string, unknown>): Promise<unknown>;
    findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  marketSnapshot: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  };
  safetySignalCache: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    deleteMany?(args: Record<string, unknown>): Promise<{ count: number }>;
  };
  listingCache: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    deleteMany?(args: Record<string, unknown>): Promise<{ count: number }>;
  };
  geocodeCache: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    deleteMany?(args: Record<string, unknown>): Promise<{ count: number }>;
  };
};

function mapPrismaDataQualityEvent(record: Record<string, unknown>): DataQualityEvent {
  return {
    id: record.id as string,
    ruleId: record.ruleId as string,
    sourceDomain: record.sourceDomain as DataQualityEvent["sourceDomain"],
    severity: record.severity as DataQualityEvent["severity"],
    category: record.category as string,
    message: record.message as string,
    triggeredAt: (record.triggeredAt as Date).toISOString(),
    targetType: record.targetType as DataQualityEvent["targetType"],
    targetId: record.targetId as string,
    partnerId: (record.partnerId as string | null) ?? null,
    sessionId: (record.sessionId as string | null) ?? null,
    provider: (record.provider as string | null) ?? null,
    status: record.status as DataQualityStatus,
    context: (record.contextJson as Record<string, unknown> | null) ?? null,
    searchRequestId: (record.searchRequestId as string | null) ?? null,
    createdAt: (record.createdAt as Date).toISOString(),
    updatedAt: (record.updatedAt as Date).toISOString()
  };
}

function mapPrismaSearchDefinition(record: Record<string, unknown>): SearchDefinition {
  return {
    id: record.id as string,
    sessionId: (record.sessionId as string | null) ?? null,
    label: record.label as string,
    request: clone(record.requestPayload as SearchDefinition["request"]),
    pinned: Boolean(record.pinned),
    createdAt: (record.createdAt as Date).toISOString(),
    updatedAt: (record.updatedAt as Date).toISOString(),
    lastRunAt: record.lastRunAt ? (record.lastRunAt as Date).toISOString() : null
  };
}

function mapPrismaShortlist(
  record: Record<string, unknown>,
  itemCount = 0
): Shortlist {
  return {
    id: record.id as string,
    sessionId: (record.sessionId as string | null) ?? null,
    title: record.title as string,
    description: (record.description as string | null) ?? null,
    sourceSnapshotId: (record.sourceSnapshotId as string | null) ?? null,
    pinned: Boolean(record.pinned),
    itemCount,
    createdAt: (record.createdAt as Date).toISOString(),
    updatedAt: (record.updatedAt as Date).toISOString()
  };
}

function mapPrismaShortlistItem(record: Record<string, unknown>): ShortlistItem {
  return {
    id: record.id as string,
    shortlistId: record.shortlistId as string,
    canonicalPropertyId: record.canonicalPropertyId as string,
    sourceSnapshotId: (record.sourceSnapshotId as string | null) ?? null,
    sourceHistoryId: (record.sourceHistoryId as string | null) ?? null,
    sourceSearchDefinitionId: (record.sourceSearchDefinitionId as string | null) ?? null,
    capturedHome: clone(record.capturedHomePayload as ShortlistItem["capturedHome"]),
    reviewState: record.reviewState as ReviewState,
    addedAt: (record.addedAt as Date).toISOString(),
    updatedAt: (record.updatedAt as Date).toISOString()
  };
}

function mapPrismaResultNote(record: Record<string, unknown>): ResultNote {
  return {
    id: record.id as string,
    sessionId: (record.sessionId as string | null) ?? null,
    entityType: record.entityType as ResultNote["entityType"],
    entityId: record.entityId as string,
    body: record.body as string,
    createdAt: (record.createdAt as Date).toISOString(),
    updatedAt: (record.updatedAt as Date).toISOString()
  };
}

function mapPrismaSharedShortlist(record: Record<string, unknown>): SharedShortlist {
  const base: SharedShortlist = {
    id: record.id as string,
    shareId: record.shareId as string,
    shortlistId: record.shortlistId as string,
    sessionId: (record.sessionId as string | null) ?? null,
    shareMode: record.shareMode as ShareMode,
    collaborationRole: roleForShareMode(record.shareMode as ShareMode),
    expiresAt: record.expiresAt ? (record.expiresAt as Date).toISOString() : null,
    revokedAt: record.revokedAt ? (record.revokedAt as Date).toISOString() : null,
    openCount: Number(record.openCount ?? 0),
    status: "active",
    createdAt: (record.createdAt as Date).toISOString()
  };

  return {
    ...base,
    status: sharedShortlistStatus(base)
  };
}

function mapPrismaSharedComment(record: Record<string, unknown>): SharedComment {
  return {
    id: record.id as string,
    shareId: record.shareId as string,
    entityType: record.entityType as SharedCommentEntityType,
    entityId: record.entityId as string,
    authorLabel: (record.authorLabel as string | null) ?? null,
    body: record.body as string,
    createdAt: (record.createdAt as Date).toISOString(),
    updatedAt: (record.updatedAt as Date).toISOString()
  };
}

function mapPrismaReviewerDecision(record: Record<string, unknown>): ReviewerDecision {
  return {
    id: record.id as string,
    shareId: record.shareId as string,
    shortlistItemId: record.shortlistItemId as string,
    decision: record.decision as ReviewerDecisionValue,
    note: (record.note as string | null) ?? null,
    createdAt: (record.createdAt as Date).toISOString(),
    updatedAt: (record.updatedAt as Date).toISOString()
  };
}

function mapPrismaPilotPartner(record: Record<string, unknown>): PilotPartner {
  return {
    id: record.id as string,
    name: record.name as string,
    slug: record.slug as string,
    planTier: (record.planTier as PlanTier | null) ?? getConfig().product.defaultPlanTier,
    status: record.status as PilotPartnerStatus,
    contactLabel: (record.contactLabel as string | null) ?? null,
    notes: (record.notes as string | null) ?? null,
    featureOverrides: mergePilotFeatures(record.featureOverrides as Partial<PilotFeatureOverrides> | null),
    createdAt: (record.createdAt as Date).toISOString(),
    updatedAt: (record.updatedAt as Date).toISOString()
  };
}

function mapPrismaPilotLink(record: Record<string, unknown>): PilotLinkRecord {
  const base: PilotLinkRecord = {
    id: record.id as string,
    partnerId: record.partnerId as string,
    token: record.token as string,
    allowedFeatures: mergePilotFeatures(record.allowedFeatures as Partial<PilotFeatureOverrides> | null),
    createdAt: (record.createdAt as Date).toISOString(),
    expiresAt: record.expiresAt ? (record.expiresAt as Date).toISOString() : null,
    revokedAt: record.revokedAt ? (record.revokedAt as Date).toISOString() : null,
    openCount: Number(record.openCount ?? 0),
    status: "active"
  };
  return {
    ...base,
    status: pilotLinkStatus(base)
  };
}

function mapPrismaOpsAction(record: Record<string, unknown>): OpsActionRecord {
  return {
    id: record.id as string,
    actionType: record.actionType as string,
    targetType: record.targetType as string,
    targetId: record.targetId as string,
    partnerId: (record.partnerId as string | null) ?? null,
    performedAt: (record.performedAt as Date).toISOString(),
    result: record.result as OpsActionRecord["result"],
    details: (record.details as Record<string, unknown> | null) ?? null
  };
}

function mapPrismaSearchSnapshot(record: Record<string, unknown>): SearchSnapshotRecord {
  return {
    id: record.id as string,
    formulaVersion: (record.formulaVersion as string | null) ?? null,
    request: clone(record.requestPayload as SearchSnapshotRecord["request"]),
    response: clone(record.responsePayload as SearchSnapshotRecord["response"]),
    sessionId: (record.sessionId as string | null) ?? null,
    searchDefinitionId: (record.searchDefinitionId as string | null) ?? null,
    historyRecordId: (record.historyRecordId as string | null) ?? null,
    validationMetadata: undefined,
    createdAt: (record.createdAt as Date).toISOString()
  };
}

function mapPrismaSearchHistoryRecord(
  record: Record<string, unknown>,
  snapshotId: string | null,
  validationMetadata?: SearchHistoryRecord["validationMetadata"]
): SearchHistoryRecord {
  const filters = (record.filters as Record<string, unknown> | undefined) ?? {};
  const weights =
    (record.weights as SearchHistoryRecord["request"]["weights"] | undefined) ?? {
      price: 40,
      size: 30,
      safety: 30
    };

  return {
    id: record.id as string,
    sessionId: (record.sessionId as string | null) ?? null,
    request: {
      locationType: record.locationType as SearchHistoryRecord["request"]["locationType"],
      locationValue: record.locationValue as string,
      radiusMiles: Number(record.radiusMiles ?? 0),
      budget: (record.budget as SearchHistoryRecord["request"]["budget"]) ?? undefined,
      minSqft: (filters.minSqft as number | undefined) ?? undefined,
      minBedrooms: (filters.minBedrooms as number | undefined) ?? undefined,
      propertyTypes:
        (filters.propertyTypes as SearchHistoryRecord["request"]["propertyTypes"]) ?? [],
      preferences: (filters.preferences as string[] | undefined) ?? [],
      weights
    },
    resolvedOriginSummary: {
      resolvedFormattedAddress: (record.resolvedFormattedAddress as string | null) ?? null,
      latitude: (record.originLatitude as number | null) ?? null,
      longitude: (record.originLongitude as number | null) ?? null,
      precision: (record.originPrecision as SearchHistoryRecord["resolvedOriginSummary"]["precision"] | null) ?? "none"
    },
    summaryMetadata: {
      returnedCount: Number(record.returnedCount ?? 0),
      totalMatched: Number(record.totalMatched ?? 0),
      durationMs: Number(record.durationMs ?? 0),
      warnings: clone((record.warnings as SearchHistoryRecord["summaryMetadata"]["warnings"]) ?? []),
      suggestions: clone((record.suggestions as SearchHistoryRecord["summaryMetadata"]["suggestions"]) ?? [])
    },
    snapshotId,
    searchDefinitionId: (record.searchDefinitionId as string | null) ?? null,
    rerunSourceType:
      (record.rerunSourceType as SearchHistoryRecord["rerunSourceType"] | null) ?? null,
    rerunSourceId: (record.rerunSourceId as string | null) ?? null,
    validationMetadata,
    createdAt: (record.createdAt as Date).toISOString()
  };
}

function mapPrismaSharedSnapshot(record: Record<string, unknown>): SharedSnapshotRecord {
  const base: SharedSnapshotRecord = {
    id: record.id as string,
    shareId: record.shareId as string,
    snapshotId: record.snapshotId as string,
    sessionId: (record.sessionId as string | null) ?? null,
    expiresAt: record.expiresAt ? (record.expiresAt as Date).toISOString() : null,
    revokedAt: record.revokedAt ? (record.revokedAt as Date).toISOString() : null,
    openCount: Number(record.openCount ?? 0),
    status: "active",
    createdAt: (record.createdAt as Date).toISOString()
  };

  return {
    ...base,
    status: sharedSnapshotStatus(base)
  };
}

function mapPrismaFeedback(record: Record<string, unknown>): FeedbackRecord {
  return {
    id: record.id as string,
    sessionId: (record.sessionId as string | null) ?? null,
    snapshotId: (record.snapshotId as string | null) ?? null,
    historyRecordId: (record.historyRecordId as string | null) ?? null,
    searchDefinitionId: (record.searchDefinitionId as string | null) ?? null,
    category: record.category as FeedbackRecord["category"],
    value: record.value as FeedbackRecord["value"],
    comment: (record.comment as string | null) ?? null,
    createdAt: (record.createdAt as Date).toISOString()
  };
}

function mapPrismaValidationEvent(record: Record<string, unknown>): ValidationEventRecord {
  return {
    id: record.id as string,
    eventName: record.eventName as ValidationEventRecord["eventName"],
    sessionId: (record.sessionId as string | null) ?? null,
    snapshotId: (record.snapshotId as string | null) ?? null,
    historyRecordId: (record.historyRecordId as string | null) ?? null,
    searchDefinitionId: (record.searchDefinitionId as string | null) ?? null,
    demoScenarioId: (record.demoScenarioId as string | null) ?? null,
    payload: (record.payload as Record<string, unknown> | null) ?? null,
    createdAt: (record.createdAt as Date).toISOString()
  };
}

function mapPrismaAuditRecord(
  record: Record<string, unknown>,
  qualityEvents: DataQualityEvent[] = []
): ScoreAuditRecord {
  const searchRequest = (record.searchRequest as Record<string, unknown> | undefined) ?? {};
  const weights = ((searchRequest as { weights?: ScoreAuditRecord["weights"] }).weights ??
    {
      price: 40,
      size: 30,
      safety: 30
    }) as ScoreAuditRecord["weights"];
  const scoreInputs = (record.scoreInputs as Record<string, unknown> | undefined) ?? {};

  return {
    propertyId: record.propertyId as string,
    formulaVersion: record.formulaVersion as string,
    inputs: {
      price: Number(scoreInputs.price ?? 0),
      squareFootage: Number(scoreInputs.squareFootage ?? 0),
      bedrooms: Number(scoreInputs.bedrooms ?? 0),
      bathrooms: Number(scoreInputs.bathrooms ?? 0),
      lotSize: (scoreInputs.lotSize as number | null | undefined) ?? null,
      crimeIndex: (record.crimeIndex as number | null) ?? null,
      schoolRating: (record.schoolRating as number | null) ?? null,
      neighborhoodStability: (record.neighborhoodStability as number | null) ?? null,
      pricePerSqft: Number(record.pricePerSqft ?? 0),
      medianPricePerSqft: Number(record.medianPricePerSqft ?? 0),
      dataCompleteness: Number(record.dataCompleteness ?? 0),
      schoolRatingRaw: (scoreInputs.schoolRatingRaw as Record<string, unknown> | number | null | undefined) ?? null,
      schoolRatingNormalized: (scoreInputs.schoolRatingNormalized as number | null | undefined) ?? null,
      schoolProvider: (record.schoolProvider as string | null) ?? null,
      schoolFetchedAt: record.schoolFetchedAt ? (record.schoolFetchedAt as Date).toISOString() : null,
      crimeIndexRaw: (scoreInputs.crimeIndexRaw as Record<string, unknown> | number | null | undefined) ?? null,
      crimeIndexNormalized: (scoreInputs.crimeIndexNormalized as number | null | undefined) ?? null,
      crimeProvider: (record.crimeProvider as string | null) ?? null,
      crimeFetchedAt: record.crimeFetchedAt ? (record.crimeFetchedAt as Date).toISOString() : null
    },
    weights,
    subScores: {
      price: Number(record.priceScore ?? 0),
      size: Number(record.sizeScore ?? 0),
      safety: Number(record.safetyScore ?? 0)
    },
    finalScore: Number(record.nhaloScore ?? 0),
    computedAt: (record.createdAt as Date).toISOString(),
    safetyConfidence: record.safetyConfidence as ScoreAuditRecord["safetyConfidence"],
    overallConfidence: record.overallConfidence as ScoreAuditRecord["overallConfidence"],
    safetyProvenance: {
      safetyDataSource:
        (record.safetyDataSource as NonNullable<ScoreAuditRecord["safetyProvenance"]>["safetyDataSource"]) ?? "none",
      crimeProvider: (record.crimeProvider as string | null) ?? null,
      schoolProvider: (record.schoolProvider as string | null) ?? null,
      crimeFetchedAt: record.crimeFetchedAt ? (record.crimeFetchedAt as Date).toISOString() : null,
      schoolFetchedAt: record.schoolFetchedAt ? (record.schoolFetchedAt as Date).toISOString() : null,
      rawSafetyInputs: (record.rawSafetyInputs as Record<string, unknown> | null) ?? null,
      normalizedSafetyInputs: (record.normalizedSafetyInputs as Record<string, unknown> | null) ?? null
    },
    listingProvenance: {
      listingDataSource:
        (record.listingDataSource as NonNullable<ScoreAuditRecord["listingProvenance"]>["listingDataSource"]) ?? "none",
      listingProvider: (record.listingProvider as string | null) ?? null,
      sourceListingId: (record.sourceListingId as string | null) ?? null,
      listingFetchedAt: record.listingFetchedAt
        ? (record.listingFetchedAt as Date).toISOString()
        : null,
      rawListingInputs: (record.rawListingInputs as Record<string, unknown> | null) ?? null,
      normalizedListingInputs:
        (record.normalizedListingInputs as Record<string, unknown> | null) ?? null
    },
    searchOrigin: searchRequest.locationType
      ? {
          locationType: searchRequest.locationType as ScoreAuditRecord["searchOrigin"]["locationType"],
          locationValue: (searchRequest.locationValue as string) ?? "",
          resolvedFormattedAddress: (searchRequest.resolvedFormattedAddress as string | null) ?? null,
          latitude: (searchRequest.originLatitude as number | null) ?? null,
          longitude: (searchRequest.originLongitude as number | null) ?? null,
          precision:
            (searchRequest.originPrecision as ScoreAuditRecord["searchOrigin"]["precision"] | null) ??
            "none",
          geocodeDataSource:
            (searchRequest.geocodeDataSource as ScoreAuditRecord["searchOrigin"]["geocodeDataSource"] | null) ??
            "none",
          geocodeProvider: (searchRequest.geocodeProvider as string | null) ?? null,
          geocodeFetchedAt: searchRequest.geocodeFetchedAt
            ? (searchRequest.geocodeFetchedAt as Date).toISOString()
            : null,
          rawGeocodeInputs:
            (searchRequest.rawGeocodeInputs as Record<string, unknown> | Record<string, unknown>[] | null) ??
            null,
          normalizedGeocodeInputs:
            (searchRequest.normalizedGeocodeInputs as Record<string, unknown> | null) ?? null
        }
      : undefined,
    spatialContext: {
      distanceMiles: (record.distanceMiles as number | null) ?? null,
      radiusMiles: (searchRequest.radiusMiles as number | null | undefined) ?? null,
      insideRequestedRadius: Boolean(record.insideRequestedRadius ?? true)
    },
    explainability: (scoreInputs.explainability as ScoreAuditRecord["explainability"] | undefined) ?? undefined,
    strengths: (scoreInputs.strengths as string[] | undefined) ?? [],
    risks: (scoreInputs.risks as string[] | undefined) ?? [],
    confidenceReasons: (scoreInputs.confidenceReasons as string[] | undefined) ?? [],
    searchQualityContext: {
      canonicalPropertyId: (scoreInputs.canonicalPropertyId as string | null | undefined) ?? null,
      deduplicationDecision:
        (scoreInputs.deduplicationDecision as string | null | undefined) ?? null,
      comparableSampleSize:
        (scoreInputs.comparableSampleSize as number | null | undefined) ?? null,
      comparableStrategyUsed:
        (scoreInputs.comparableStrategyUsed as string | null | undefined) ?? null,
      qualityGateDecision:
        (scoreInputs.qualityGateDecision as string | null | undefined) ?? null,
      rejectionContext:
        (scoreInputs.rejectionContext as Record<string, number> | null | undefined) ?? null,
      rankingTieBreakInputs:
        (scoreInputs.rankingTieBreakInputs as Record<string, unknown> | null | undefined) ?? null,
      resultQualityFlags: (scoreInputs.resultQualityFlags as string[] | undefined) ?? []
    },
    dataQuality: {
      integrityFlags: (scoreInputs.integrityFlags as string[] | undefined) ?? [],
      dataWarnings: (scoreInputs.dataWarnings as string[] | undefined) ?? [],
      degradedReasons: (scoreInputs.degradedReasons as string[] | undefined) ?? [],
      events: clone(qualityEvents)
    }
  };
}

export class PrismaSearchRepository implements SearchRepository {
  constructor(private readonly client: PrismaClientLike) {}

  async saveSearch(payload: SearchPersistenceInput): Promise<{ historyRecordId: string | null }> {
    await Promise.all(payload.listings.map((listing) => this.upsertProperty(listing)));

    const createdSearch = await this.client.searchRequest.create({
      data: {
        sessionId: payload.sessionId ?? null,
        partnerId: payload.partnerId ?? null,
        searchDefinitionId: payload.searchDefinitionId ?? null,
        rerunSourceType: payload.rerunSourceType ?? null,
        rerunSourceId: payload.rerunSourceId ?? null,
        locationType: payload.request.locationType,
        locationValue: payload.request.locationValue,
        resolvedCity: payload.resolvedLocation.city,
        resolvedState: payload.resolvedLocation.state,
        resolvedPostalCode: payload.resolvedLocation.postalCode,
        resolvedFormattedAddress: payload.response.metadata.searchOrigin?.resolvedFormattedAddress,
        originLatitude: payload.response.metadata.searchOrigin?.latitude,
        originLongitude: payload.response.metadata.searchOrigin?.longitude,
        originPrecision: payload.response.metadata.searchOrigin?.precision,
        geocodeProvider: payload.response.metadata.searchOrigin?.geocodeProvider,
        geocodeDataSource: payload.response.metadata.searchOrigin?.geocodeDataSource,
        geocodeFetchedAt: payload.response.metadata.searchOrigin?.geocodeFetchedAt
          ? new Date(payload.response.metadata.searchOrigin.geocodeFetchedAt)
          : null,
        rawGeocodeInputs: payload.response.metadata.searchOrigin?.rawGeocodeInputs ?? null,
        normalizedGeocodeInputs:
          payload.response.metadata.searchOrigin?.normalizedGeocodeInputs ?? null,
        radiusMiles: payload.response.appliedFilters.radiusMiles,
        budget: payload.request.budget,
        filters: payload.response.appliedFilters,
        weights: payload.response.appliedWeights,
        totalCandidatesScanned: payload.response.metadata.totalCandidatesScanned,
        totalMatched: payload.response.metadata.totalMatched,
        returnedCount: payload.response.metadata.returnedCount,
        durationMs: payload.response.metadata.durationMs,
        warnings: payload.response.metadata.warnings,
        suggestions: payload.response.metadata.suggestions
      }
    });

    if (payload.scoredResults.length > 0) {
      await this.client.scoreSnapshot.createMany({
        data: payload.scoredResults.map((result) => ({
          searchRequestId: createdSearch.id,
          propertyId: result.propertyId,
          formulaVersion: result.formulaVersion,
          explanation: result.explanation,
          priceScore: result.scores.price,
          sizeScore: result.scores.size,
          safetyScore: result.scores.safety,
          nhaloScore: result.scores.nhalo,
          safetyConfidence: result.scores.safetyConfidence,
          overallConfidence: result.scores.overallConfidence,
          pricePerSqft: result.pricePerSqft,
          medianPricePerSqft: result.medianPricePerSqft,
          crimeIndex: result.crimeIndex,
          schoolRating: result.schoolRating,
          neighborhoodStability: result.neighborhoodStability,
          dataCompleteness: result.dataCompleteness,
          safetyDataSource: result.safetyDataSource,
          crimeProvider: result.crimeProvider,
          schoolProvider: result.schoolProvider,
          crimeFetchedAt: result.crimeFetchedAt ? new Date(result.crimeFetchedAt) : null,
          schoolFetchedAt: result.schoolFetchedAt ? new Date(result.schoolFetchedAt) : null,
          rawSafetyInputs: result.rawSafetyInputs,
          normalizedSafetyInputs: result.normalizedSafetyInputs,
          listingDataSource: result.listingDataSource,
          listingProvider: result.listingProvider,
          sourceListingId: result.sourceListingId,
          listingFetchedAt: result.listingFetchedAt ? new Date(result.listingFetchedAt) : null,
          rawListingInputs: result.rawListingInputs,
          normalizedListingInputs: result.normalizedListingInputs,
          distanceMiles: result.distanceMiles,
          insideRequestedRadius: result.insideRequestedRadius,
          scoreInputs: {
            ...result.inputs,
            ...result.scoreInputs,
            explainability: result.explainability,
            strengths: result.strengths ?? [],
            risks: result.risks ?? [],
            confidenceReasons: result.confidenceReasons ?? [],
            integrityFlags: result.integrityFlags ?? [],
            dataWarnings: result.dataWarnings ?? [],
            degradedReasons: result.degradedReasons ?? []
          },
          createdAt: new Date(result.computedAt)
        }))
      });
    }

    if (payload.qualityEvents?.length && this.client.dataQualityEvent.createMany) {
      await this.client.dataQualityEvent.createMany({
        data: payload.qualityEvents.map((event) => ({
          ruleId: event.ruleId,
          sourceDomain: event.sourceDomain,
          severity: event.severity,
          category: event.category,
          message: event.message,
          targetType: event.targetType,
          targetId: event.targetId,
          partnerId: event.partnerId ?? null,
          sessionId: event.sessionId ?? null,
          provider: event.provider ?? null,
          status: event.status,
          contextJson: event.context ?? null,
          searchRequestId: createdSearch.id,
          triggeredAt: new Date(event.triggeredAt)
        }))
      });
    }

    return {
      historyRecordId: createdSearch.id
    };
  }

  async getScoreAudit(propertyId: string): Promise<ScoreAuditRecord | null> {
    const record = await this.client.scoreSnapshot.findFirst({
      where: {
        propertyId
      },
      include: {
        searchRequest: {
          select: {
            weights: true,
            locationType: true,
            locationValue: true,
            resolvedFormattedAddress: true,
            originLatitude: true,
            originLongitude: true,
            originPrecision: true,
            geocodeProvider: true,
            geocodeDataSource: true,
            geocodeFetchedAt: true,
            rawGeocodeInputs: true,
            normalizedGeocodeInputs: true,
            radiusMiles: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    if (!record) {
      return null;
    }

    const qualityEvents = await this.client.dataQualityEvent.findMany({
      where: {
        searchRequestId: record.searchRequestId,
        OR: [
          { targetId: propertyId },
          { targetId: record.propertyId },
          { targetType: "search" },
          { targetType: "search_result" }
        ]
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return mapPrismaAuditRecord(record, qualityEvents.map((event) => mapPrismaDataQualityEvent(event)));
  }

  async listDataQualityEvents(filters?: {
    severity?: DataQualityEvent["severity"];
    sourceDomain?: DataQualityEvent["sourceDomain"];
    provider?: string;
    partnerId?: string;
    status?: DataQualityStatus;
    targetId?: string;
    searchRequestId?: string;
    limit?: number;
  }): Promise<DataQualityEvent[]> {
    const records = await this.client.dataQualityEvent.findMany({
      where: {
        ...(filters?.severity ? { severity: filters.severity } : {}),
        ...(filters?.sourceDomain ? { sourceDomain: filters.sourceDomain } : {}),
        ...(filters?.provider ? { provider: filters.provider } : {}),
        ...(filters?.partnerId ? { partnerId: filters.partnerId } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.targetId ? { targetId: filters.targetId } : {}),
        ...(filters?.searchRequestId ? { searchRequestId: filters.searchRequestId } : {})
      },
      orderBy: {
        createdAt: "desc"
      },
      take: filters?.limit
    });

    return records.map((record) => mapPrismaDataQualityEvent(record));
  }

  async getDataQualityEvent(id: string): Promise<DataQualityEvent | null> {
    const record = await this.client.dataQualityEvent.findUnique({
      where: {
        id
      }
    });

    return record ? mapPrismaDataQualityEvent(record) : null;
  }

  async updateDataQualityEventStatus(
    id: string,
    status: DataQualityStatus
  ): Promise<DataQualityEvent | null> {
    const existing = await this.client.dataQualityEvent.findUnique({
      where: {
        id
      }
    });

    if (!existing) {
      return null;
    }

    const updated = await this.client.dataQualityEvent.update({
      where: {
        id
      },
      data: {
        status
      }
    });

    return mapPrismaDataQualityEvent(updated);
  }

  async getDataQualitySummary(filters?: {
    severity?: DataQualityEvent["severity"];
    sourceDomain?: DataQualityEvent["sourceDomain"];
    provider?: string;
    partnerId?: string;
    status?: DataQualityStatus;
  }): Promise<DataQualitySummary> {
    const events = await this.listDataQualityEvents(filters);
    return summarizeDataQualityEvents(events);
  }

  async createSearchSnapshot(payload: {
    request: SearchPersistenceInput["request"];
    response: SearchPersistenceInput["response"];
    sessionId?: string | null;
    searchDefinitionId?: string | null;
    historyRecordId?: string | null;
  }): Promise<SearchSnapshotRecord> {
    const record = await this.client.searchSnapshot.create({
      data: {
        formulaVersion: payload.response.homes[0]?.scores.formulaVersion ?? null,
        sessionId: payload.sessionId ?? null,
        searchDefinitionId: payload.searchDefinitionId ?? null,
        historyRecordId: payload.historyRecordId ?? null,
        demoScenarioId: null,
        requestPayload: payload.request,
        responsePayload: payload.response
      }
    });

    return mapPrismaSearchSnapshot(record);
  }

  async getSearchSnapshot(id: string): Promise<SearchSnapshotRecord | null> {
    const record = await this.client.searchSnapshot.findUnique({
      where: {
        id
      }
    });

    if (!record) {
      return null;
    }

    const [shareCount, feedbackCount, rerunCount] = await Promise.all([
      this.client.sharedSnapshotLink.count?.({
        where: {
          snapshotId: id,
          revokedAt: null
        }
      }) ?? 0,
      this.client.feedback.count?.({
        where: {
          snapshotId: id
        }
      }) ?? 0,
      this.client.validationEvent.count?.({
        where: {
          snapshotId: id,
          eventName: "rerun_executed"
        }
      }) ?? 0
    ]);

    return {
      ...mapPrismaSearchSnapshot(record),
      validationMetadata: {
        wasShared: shareCount > 0,
        shareCount,
        feedbackCount,
        demoScenarioId: (record.demoScenarioId as string | null) ?? null,
        rerunCount
      }
    };
  }

  async listSearchSnapshots(sessionId?: string | null, limit = 10): Promise<SearchSnapshotRecord[]> {
    if (!sessionId) {
      return [];
    }

    const records = await this.client.searchSnapshot.findMany({
      where: {
        sessionId
      },
      orderBy: {
        createdAt: "desc"
      },
      take: limit
    });

    return Promise.all(
      records.map(async (record) => {
        const [shareCount, feedbackCount, rerunCount] = await Promise.all([
          this.client.sharedSnapshotLink.count?.({
            where: {
              snapshotId: record.id,
              revokedAt: null
            }
          }) ?? 0,
          this.client.feedback.count?.({
            where: {
              snapshotId: record.id
            }
          }) ?? 0,
          this.client.validationEvent.count?.({
            where: {
              snapshotId: record.id,
              eventName: "rerun_executed"
            }
          }) ?? 0
        ]);

        return {
          ...mapPrismaSearchSnapshot(record),
          validationMetadata: {
            wasShared: shareCount > 0,
            shareCount,
            feedbackCount,
            demoScenarioId: (record.demoScenarioId as string | null) ?? null,
            rerunCount
          }
        };
      })
    );
  }

  async createSearchDefinition(payload: {
    sessionId?: string | null;
    label: string;
    request: SearchPersistenceInput["request"];
    pinned?: boolean;
  }): Promise<SearchDefinition> {
    const record = await this.client.searchDefinition.create({
      data: {
        sessionId: payload.sessionId ?? null,
        label: payload.label,
        requestPayload: payload.request,
        pinned: payload.pinned ?? false
      }
    });

    return mapPrismaSearchDefinition(record);
  }

  async listSearchDefinitions(sessionId?: string | null): Promise<SearchDefinition[]> {
    if (!sessionId) {
      return [];
    }

    const records = await this.client.searchDefinition.findMany({
      where: {
        sessionId
      },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }]
    });

    return records.map((record) => mapPrismaSearchDefinition(record));
  }

  async getSearchDefinition(id: string): Promise<SearchDefinition | null> {
    const record = await this.client.searchDefinition.findUnique({
      where: {
        id
      }
    });

    return record ? mapPrismaSearchDefinition(record) : null;
  }

  async updateSearchDefinition(
    id: string,
    patch: {
      label?: string;
      pinned?: boolean;
      lastRunAt?: string | null;
    }
  ): Promise<SearchDefinition | null> {
    const existing = await this.getSearchDefinition(id);
    if (!existing) {
      return null;
    }

    const record = await this.client.searchDefinition.update({
      where: {
        id
      },
      data: {
        ...(patch.label !== undefined ? { label: patch.label } : {}),
        ...(patch.pinned !== undefined ? { pinned: patch.pinned } : {}),
        ...(patch.lastRunAt !== undefined
          ? { lastRunAt: patch.lastRunAt ? new Date(patch.lastRunAt) : null }
          : {})
      }
    });

    return mapPrismaSearchDefinition(record);
  }

  async deleteSearchDefinition(id: string): Promise<boolean> {
    const existing = await this.getSearchDefinition(id);
    if (!existing) {
      return false;
    }

    await this.client.searchDefinition.delete({
      where: {
        id
      }
    });

    return true;
  }

  async listSearchHistory(sessionId?: string | null, limit = 10): Promise<SearchHistoryRecord[]> {
    if (!sessionId) {
      return [];
    }

    const records = await this.client.searchRequest.findMany({
      where: {
        sessionId
      },
      orderBy: {
        createdAt: "desc"
      },
      take: limit
    });

    const snapshots = await this.client.searchSnapshot.findMany({
      where: {
        sessionId,
        historyRecordId: {
          in: records.map((record) => record.id)
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });
    const snapshotByHistoryId = new Map<string, string>();
    for (const snapshot of snapshots) {
      const historyRecordId = snapshot.historyRecordId as string | null;
      if (historyRecordId && !snapshotByHistoryId.has(historyRecordId)) {
        snapshotByHistoryId.set(historyRecordId, snapshot.id as string);
      }
    }

    return Promise.all(
      records.map(async (record) => {
        const historyId = record.id as string;
        const [feedbackCount, rerunCount] = await Promise.all([
          this.client.feedback.count?.({
            where: {
              historyRecordId: historyId
            }
          }) ?? 0,
          this.client.validationEvent.count?.({
            where: {
              historyRecordId: historyId,
              eventName: "rerun_executed"
            }
          }) ?? 0
        ]);

        return mapPrismaSearchHistoryRecord(
          record,
          snapshotByHistoryId.get(historyId) ?? null,
          {
            wasShared: false,
            shareCount: 0,
            feedbackCount,
            demoScenarioId: (record.demoScenarioId as string | null) ?? null,
            rerunCount
          }
        );
      })
    );
  }

  async getSearchHistory(id: string): Promise<SearchHistoryRecord | null> {
    const record = await this.client.searchRequest.findUnique({
      where: {
        id
      }
    });

    if (!record) {
      return null;
    }

    const snapshot = await this.client.searchSnapshot.findFirst({
      where: {
        historyRecordId: id
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    const [feedbackCount, rerunCount] = await Promise.all([
      this.client.feedback.count?.({
        where: {
          historyRecordId: id
        }
      }) ?? 0,
      this.client.validationEvent.count?.({
        where: {
          historyRecordId: id,
          eventName: "rerun_executed"
        }
      }) ?? 0
    ]);

    return mapPrismaSearchHistoryRecord(record, (snapshot?.id as string | undefined) ?? null, {
      wasShared: false,
      shareCount: 0,
      feedbackCount,
      demoScenarioId: (record.demoScenarioId as string | null) ?? null,
      rerunCount
    });
  }

  async createShortlist(payload: {
    sessionId?: string | null;
    title: string;
    description?: string | null;
    sourceSnapshotId?: string | null;
    pinned?: boolean;
  }): Promise<Shortlist> {
    const record = await this.client.shortlist.create({
      data: {
        sessionId: payload.sessionId ?? null,
        title: payload.title,
        description: payload.description ?? null,
        sourceSnapshotId: payload.sourceSnapshotId ?? null,
        pinned: payload.pinned ?? false
      }
    });

    await this.recordValidationEvent({
      eventName: "shortlist_created",
      sessionId: payload.sessionId ?? null,
      snapshotId: payload.sourceSnapshotId ?? null,
      payload: {
        shortlistId: record.id as string,
        title: payload.title
      }
    });

    return mapPrismaShortlist(record, 0);
  }

  async listShortlists(sessionId?: string | null): Promise<Shortlist[]> {
    if (!sessionId) {
      return [];
    }

    const records = await this.client.shortlist.findMany({
      where: {
        sessionId
      },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }]
    });

    return Promise.all(
      records.map(async (record) => {
        const items = await this.client.shortlistItem.findMany({
          where: {
            shortlistId: record.id
          },
          select: {
            id: true
          }
        });
        return mapPrismaShortlist(record, items.length);
      })
    );
  }

  async getShortlist(id: string): Promise<Shortlist | null> {
    const record = await this.client.shortlist.findUnique({
      where: {
        id
      }
    });
    if (!record) {
      return null;
    }

    const items = await this.client.shortlistItem.findMany({
      where: {
        shortlistId: id
      },
      select: {
        id: true
      }
    });

    return mapPrismaShortlist(record, items.length);
  }

  async updateShortlist(
    id: string,
    patch: {
      title?: string;
      description?: string | null;
      pinned?: boolean;
    }
  ): Promise<Shortlist | null> {
    const existing = await this.getShortlist(id);
    if (!existing) {
      return null;
    }

    const record = await this.client.shortlist.update({
      where: {
        id
      },
      data: {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.pinned !== undefined ? { pinned: patch.pinned } : {})
      }
    });

    await this.recordValidationEvent({
      eventName: "shortlist_updated",
      sessionId: existing.sessionId,
      payload: {
        shortlistId: id
      }
    });

    return mapPrismaShortlist(record, existing.itemCount);
  }

  async deleteShortlist(id: string): Promise<boolean> {
    const existing = await this.getShortlist(id);
    if (!existing) {
      return false;
    }

    await this.client.shortlist.delete({
      where: {
        id
      }
    });

    await this.recordValidationEvent({
      eventName: "shortlist_deleted",
      sessionId: existing.sessionId,
      payload: {
        shortlistId: id
      }
    });

    return true;
  }

  async createShortlistItem(
    shortlistId: string,
    payload: {
      canonicalPropertyId: string;
      sourceSnapshotId?: string | null;
      sourceHistoryId?: string | null;
      sourceSearchDefinitionId?: string | null;
      capturedHome: ShortlistItem["capturedHome"];
      reviewState?: ReviewState;
    }
  ): Promise<ShortlistItem | null> {
    const shortlist = await this.getShortlist(shortlistId);
    if (!shortlist) {
      return null;
    }

    const existing = await this.client.shortlistItem.findUnique({
      where: {
        shortlistId_canonicalPropertyId: {
          shortlistId,
          canonicalPropertyId: payload.canonicalPropertyId
        }
      }
    });
    if (existing) {
      return mapPrismaShortlistItem(existing);
    }

    const record = await this.client.shortlistItem.create({
      data: {
        shortlistId,
        canonicalPropertyId: payload.canonicalPropertyId,
        sourceSnapshotId: payload.sourceSnapshotId ?? null,
        sourceHistoryId: payload.sourceHistoryId ?? null,
        sourceSearchDefinitionId: payload.sourceSearchDefinitionId ?? null,
        capturedHomePayload: payload.capturedHome,
        reviewState: payload.reviewState ?? "undecided"
      }
    });

    await this.recordValidationEvent({
      eventName: "shortlist_item_added",
      sessionId: shortlist.sessionId,
      snapshotId: payload.sourceSnapshotId ?? null,
      historyRecordId: payload.sourceHistoryId ?? null,
      searchDefinitionId: payload.sourceSearchDefinitionId ?? null,
      payload: {
        shortlistId,
        shortlistItemId: record.id as string,
        canonicalPropertyId: payload.canonicalPropertyId
      }
    });

    return mapPrismaShortlistItem(record);
  }

  async listShortlistItems(shortlistId: string): Promise<ShortlistItem[]> {
    const records = await this.client.shortlistItem.findMany({
      where: {
        shortlistId
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    return records.map((record) => mapPrismaShortlistItem(record));
  }

  async updateShortlistItem(
    shortlistId: string,
    itemId: string,
    patch: {
      reviewState?: ReviewState;
    }
  ): Promise<ShortlistItem | null> {
    const existing = await this.client.shortlistItem.findUnique({
      where: {
        id: itemId
      }
    });
    if (!existing || (existing.shortlistId as string) !== shortlistId) {
      return null;
    }

    const record = await this.client.shortlistItem.update({
      where: {
        id: itemId
      },
      data: {
        ...(patch.reviewState !== undefined ? { reviewState: patch.reviewState } : {})
      }
    });

    const shortlist = await this.getShortlist(shortlistId);
    await this.recordValidationEvent({
      eventName: "review_state_changed",
      sessionId: shortlist?.sessionId ?? null,
      payload: {
        shortlistId,
        shortlistItemId: itemId,
        reviewState: patch.reviewState ?? (record.reviewState as string)
      }
    });

    return mapPrismaShortlistItem(record);
  }

  async deleteShortlistItem(shortlistId: string, itemId: string): Promise<boolean> {
    const existing = await this.client.shortlistItem.findUnique({
      where: {
        id: itemId
      }
    });
    if (!existing || (existing.shortlistId as string) !== shortlistId) {
      return false;
    }

    await this.client.shortlistItem.delete({
      where: {
        id: itemId
      }
    });

    const shortlist = await this.getShortlist(shortlistId);
    await this.recordValidationEvent({
      eventName: "shortlist_item_removed",
      sessionId: shortlist?.sessionId ?? null,
      payload: {
        shortlistId,
        shortlistItemId: itemId,
        canonicalPropertyId: existing.canonicalPropertyId as string
      }
    });

    return true;
  }

  async createResultNote(payload: {
    sessionId?: string | null;
    entityType: ResultNote["entityType"];
    entityId: string;
    body: string;
  }): Promise<ResultNote> {
    const record = await this.client.resultNote.create({
      data: {
        sessionId: payload.sessionId ?? null,
        entityType: payload.entityType,
        entityId: payload.entityId,
        body: payload.body,
        shortlistItemId: payload.entityType === "shortlist_item" ? payload.entityId : null
      }
    });

    await this.recordValidationEvent({
      eventName: "note_created",
      sessionId: payload.sessionId ?? null,
      payload: {
        noteId: record.id as string,
        entityType: payload.entityType,
        entityId: payload.entityId,
        shortlistItemId: payload.entityType === "shortlist_item" ? payload.entityId : null
      }
    });

    return mapPrismaResultNote(record);
  }

  async listResultNotes(filters?: {
    sessionId?: string | null;
    entityType?: ResultNote["entityType"];
    entityId?: string;
  }): Promise<ResultNote[]> {
    const records = await this.client.resultNote.findMany({
      where: {
        ...(filters?.sessionId !== undefined ? { sessionId: filters.sessionId ?? null } : {}),
        ...(filters?.entityType ? { entityType: filters.entityType } : {}),
        ...(filters?.entityId ? { entityId: filters.entityId } : {})
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    return records.map((record) => mapPrismaResultNote(record));
  }

  async updateResultNote(id: string, body: string): Promise<ResultNote | null> {
    const existing = await this.client.resultNote.findUnique({
      where: {
        id
      }
    });
    if (!existing) {
      return null;
    }

    const record = await this.client.resultNote.update({
      where: {
        id
      },
      data: {
        body
      }
    });

    await this.recordValidationEvent({
      eventName: "note_updated",
      sessionId: (existing.sessionId as string | null) ?? null,
      payload: {
        noteId: id,
        entityType: existing.entityType as string,
        entityId: existing.entityId as string
      }
    });

    return mapPrismaResultNote(record);
  }

  async deleteResultNote(id: string): Promise<boolean> {
    const existing = await this.client.resultNote.findUnique({
      where: {
        id
      }
    });
    if (!existing) {
      return false;
    }

    await this.client.resultNote.delete({
      where: {
        id
      }
    });

    await this.recordValidationEvent({
      eventName: "note_deleted",
      sessionId: (existing.sessionId as string | null) ?? null,
      payload: {
        noteId: id,
        entityType: existing.entityType as string,
        entityId: existing.entityId as string
      }
    });

    return true;
  }

  async listWorkflowActivity(sessionId?: string | null, limit = 20): Promise<WorkflowActivityRecord[]> {
    if (!sessionId) {
      return [];
    }

    const records = await this.client.validationEvent.findMany?.({
      where: {
        sessionId,
        eventName: {
          in: workflowEventNames()
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: limit
    });

    return (records ?? [])
      .map((record) => toWorkflowActivity(mapPrismaValidationEvent(record)))
      .filter((record): record is WorkflowActivityRecord => Boolean(record));
  }

  async createSharedSnapshot(payload: {
    snapshotId: string;
    sessionId?: string | null;
    expiresAt?: string | null;
  }): Promise<SharedSnapshotRecord> {
    const record = await this.client.sharedSnapshotLink.create({
      data: {
        shareId: createSensitiveToken("public"),
        snapshotId: payload.snapshotId,
        sessionId: payload.sessionId ?? null,
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null
      }
    });

    return mapPrismaSharedSnapshot(record);
  }

  async getSharedSnapshot(shareId: string): Promise<SharedSnapshotView | null> {
    const record = await this.client.sharedSnapshotLink.findUnique({
      where: {
        shareId
      }
    });

    if (!record) {
      return null;
    }

    const shared = mapPrismaSharedSnapshot(record);
    const snapshot = await this.getSearchSnapshot(shared.snapshotId);
    if (!snapshot) {
      return null;
    }

    if (shared.status !== "active") {
      return {
        share: shared,
        snapshot
      };
    }

    const updated = await this.client.sharedSnapshotLink.update?.({
      where: {
        shareId
      },
      data: {
        openCount: {
          increment: 1
        }
      }
    });

    return {
      share: updated ? mapPrismaSharedSnapshot(updated) : { ...shared, openCount: shared.openCount + 1 },
      snapshot
    };
  }

  async createSharedShortlist(payload: {
    shortlistId: string;
    sessionId?: string | null;
    shareMode: ShareMode;
    expiresAt?: string | null;
  }): Promise<SharedShortlist> {
    const shortlist = await this.getShortlist(payload.shortlistId);
    if (!shortlist) {
      throw new Error("Shortlist not found");
    }

    const record = await this.client.sharedShortlistLink.create({
      data: {
        shareId: createSensitiveToken("shortlist-share"),
        shortlistId: payload.shortlistId,
        sessionId: payload.sessionId ?? shortlist.sessionId ?? null,
        shareMode: payload.shareMode,
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null
      }
    });

    await this.recordValidationEvent({
      eventName: "shortlist_shared",
      sessionId: payload.sessionId ?? shortlist.sessionId ?? null,
      payload: {
        shareId: record.shareId as string,
        shortlistId: payload.shortlistId,
        shareMode: payload.shareMode
      }
    });

    return mapPrismaSharedShortlist(record);
  }

  async listSharedShortlists(shortlistId: string): Promise<SharedShortlist[]> {
    const records = await this.client.sharedShortlistLink.findMany?.({
      where: {
        shortlistId
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return (records ?? []).map((record) => mapPrismaSharedShortlist(record));
  }

  async getSharedShortlist(shareId: string): Promise<SharedShortlistView | null> {
    const record = await this.client.sharedShortlistLink.findUnique({
      where: {
        shareId
      }
    });

    if (!record) {
      return null;
    }

    const shared = mapPrismaSharedShortlist(record);
    const shortlist = await this.getShortlist(shared.shortlistId);
    if (!shortlist) {
      return null;
    }

    if (shared.status === "active") {
      const updated = await this.client.sharedShortlistLink.update?.({
        where: {
          shareId
        },
        data: {
          openCount: {
            increment: 1
          }
        }
      });
      await this.recordValidationEvent({
        eventName: "shared_shortlist_opened",
        sessionId: shared.sessionId ?? null,
        payload: {
          shareId,
          shortlistId: shared.shortlistId,
          shareMode: shared.shareMode
        }
      });

      const items = await this.listShortlistItems(shared.shortlistId);
      const comments = await this.listSharedComments({ shareId });
      const reviewerDecisions = await this.listReviewerDecisions({ shareId });
      const collaborationActivity = await this.listCollaborationActivity({ shareId, limit: 20 });

      return {
        readOnly: shared.shareMode === "read_only",
        shared: true,
        share: updated ? mapPrismaSharedShortlist(updated) : { ...shared, openCount: shared.openCount + 1 },
        shortlist,
        items,
        comments,
        reviewerDecisions,
        collaborationActivity
      };
    }

    if (shared.status === "expired") {
      await this.recordValidationEvent({
        eventName: "share_link_expired",
        sessionId: shared.sessionId ?? null,
        payload: {
          shareId,
          shortlistId: shared.shortlistId
        }
      });
    }

    return {
      readOnly: true,
      shared: true,
      share: shared,
      shortlist,
      items: await this.listShortlistItems(shared.shortlistId),
      comments: await this.listSharedComments({ shareId }),
      reviewerDecisions: await this.listReviewerDecisions({ shareId }),
      collaborationActivity: await this.listCollaborationActivity({ shareId, limit: 20 })
    };
  }

  async revokeSharedShortlist(shareId: string): Promise<SharedShortlist | null> {
    const existing = await this.client.sharedShortlistLink.findUnique({
      where: {
        shareId
      }
    });
    if (!existing) {
      return null;
    }

    const record = await this.client.sharedShortlistLink.update?.({
      where: {
        shareId
      },
      data: {
        revokedAt: new Date()
      }
    });

    const mapped = record ? mapPrismaSharedShortlist(record) : mapPrismaSharedShortlist(existing);
    await this.recordValidationEvent({
      eventName: "share_link_revoked",
      sessionId: mapped.sessionId ?? null,
      payload: {
        shareId,
        shortlistId: mapped.shortlistId
      }
    });

    return {
      ...mapped,
      revokedAt: record ? mapped.revokedAt : new Date().toISOString(),
      status: "revoked"
    };
  }

  async createPilotPartner(payload: {
    name: string;
    slug: string;
    planTier?: PlanTier;
    status?: PilotPartnerStatus;
    contactLabel?: string | null;
    notes?: string | null;
    featureOverrides?: Partial<PilotFeatureOverrides>;
  }): Promise<PilotPartner> {
    const record = await this.client.pilotPartner.create({
      data: {
        name: payload.name,
        slug: payload.slug,
        planTier: payload.planTier ?? getConfig().product.defaultPlanTier,
        status: payload.status ?? "active",
        contactLabel: payload.contactLabel ?? null,
        notes: payload.notes ?? null,
        featureOverrides: mergePilotFeatures(payload.featureOverrides)
      }
    });
    return mapPrismaPilotPartner(record);
  }

  async listPilotPartners(): Promise<PilotPartner[]> {
    const records = await this.client.pilotPartner.findMany({
      orderBy: {
        updatedAt: "desc"
      }
    });
    return records.map((record) => mapPrismaPilotPartner(record));
  }

  async getPilotPartner(id: string): Promise<PilotPartner | null> {
    const record = await this.client.pilotPartner.findUnique({
      where: { id }
    });
    return record ? mapPrismaPilotPartner(record) : null;
  }

  async updatePilotPartner(
    id: string,
    patch: {
      name?: string;
      planTier?: PlanTier;
      status?: PilotPartnerStatus;
      contactLabel?: string | null;
      notes?: string | null;
      featureOverrides?: Partial<PilotFeatureOverrides>;
    }
  ): Promise<PilotPartner | null> {
    const existing = await this.getPilotPartner(id);
    if (!existing) {
      return null;
    }
    const record = await this.client.pilotPartner.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.planTier !== undefined ? { planTier: patch.planTier } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.contactLabel !== undefined ? { contactLabel: patch.contactLabel } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        ...(patch.featureOverrides !== undefined
          ? {
              featureOverrides: mergePilotFeatures({
                ...existing.featureOverrides,
                ...patch.featureOverrides
              })
            }
          : {})
      }
    });
    return mapPrismaPilotPartner(record);
  }

  async createPilotLink(payload: {
    partnerId: string;
    expiresAt?: string | null;
    allowedFeatures?: Partial<PilotFeatureOverrides>;
  }): Promise<PilotLinkRecord> {
    const partner = await this.getPilotPartner(payload.partnerId);
    if (!partner) {
      throw new Error("Pilot partner not found");
    }
    const record = await this.client.pilotLink.create({
      data: {
        partnerId: payload.partnerId,
        token: createSensitiveToken("pilot"),
        allowedFeatures: mergePilotFeatures({
          ...partner.featureOverrides,
          ...payload.allowedFeatures
        }),
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null
      }
    });
    return mapPrismaPilotLink(record);
  }

  async listPilotLinks(partnerId?: string): Promise<PilotLinkRecord[]> {
    const records = await this.client.pilotLink.findMany({
      where: partnerId ? { partnerId } : undefined,
      orderBy: {
        createdAt: "desc"
      }
    });
    return records.map((record) => mapPrismaPilotLink(record));
  }

  async getPilotLink(token: string): Promise<PilotLinkView | null> {
    const record = await this.client.pilotLink.findUnique({
      where: { token }
    });
    if (!record) {
      return null;
    }
    const link = mapPrismaPilotLink(record);
    const partner = await this.getPilotPartner(link.partnerId);
    if (!partner) {
      return null;
    }
    if (link.status === "active") {
      const updated = await this.client.pilotLink.update({
        where: { token },
        data: {
          openCount: {
            increment: 1
          }
        }
      });
      const mapped = mapPrismaPilotLink(updated);
      return {
        link: mapped,
        partner,
        context: {
          partnerId: partner.id,
          partnerSlug: partner.slug,
          partnerName: partner.name,
          planTier: partner.planTier,
          status: partner.status,
          pilotLinkId: mapped.id,
          pilotToken: mapped.token,
          allowedFeatures: mapped.allowedFeatures,
          capabilities: resolveStoredCapabilities(partner.planTier, mapped.allowedFeatures)
        }
      };
    }
    return {
      link,
      partner,
      context: {
        partnerId: partner.id,
        partnerSlug: partner.slug,
        partnerName: partner.name,
        planTier: partner.planTier,
        status: partner.status,
        pilotLinkId: link.id,
        pilotToken: link.token,
        allowedFeatures: link.allowedFeatures,
        capabilities: resolveStoredCapabilities(partner.planTier, link.allowedFeatures)
      }
    };
  }

  async revokePilotLink(token: string): Promise<PilotLinkRecord | null> {
    const existing = await this.client.pilotLink.findUnique({
      where: { token }
    });
    if (!existing) {
      return null;
    }
    const record = await this.client.pilotLink.update({
      where: { token },
      data: {
        revokedAt: new Date()
      }
    });
    return mapPrismaPilotLink(record);
  }

  async createSharedComment(payload: {
    shareId: string;
    entityType: SharedCommentEntityType;
    entityId: string;
    authorLabel?: string | null;
    body: string;
  }): Promise<SharedComment> {
    const record = await this.client.sharedComment.create({
      data: {
        shareId: payload.shareId,
        entityType: payload.entityType,
        entityId: payload.entityId,
        authorLabel: payload.authorLabel ?? null,
        body: payload.body,
        shortlistItemId: payload.entityId
      }
    });

    const share = await this.client.sharedShortlistLink.findUnique({
      where: { shareId: payload.shareId }
    });
    await this.recordValidationEvent({
      eventName: "shared_comment_added",
      sessionId: (share?.sessionId as string | null) ?? null,
      payload: {
        shareId: payload.shareId,
        shortlistId: (share?.shortlistId as string | null) ?? null,
        shortlistItemId: payload.entityId,
        commentId: record.id as string
      }
    });

    return mapPrismaSharedComment(record);
  }

  async listSharedComments(filters: {
    shareId: string;
    entityType?: SharedCommentEntityType;
    entityId?: string;
  }): Promise<SharedComment[]> {
    const records = await this.client.sharedComment.findMany({
      where: {
        shareId: filters.shareId,
        ...(filters.entityType ? { entityType: filters.entityType } : {}),
        ...(filters.entityId ? { entityId: filters.entityId } : {})
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    return records.map((record) => mapPrismaSharedComment(record));
  }

  async getSharedComment(id: string): Promise<SharedComment | null> {
    const record = await this.client.sharedComment.findUnique({
      where: { id }
    });

    return record ? mapPrismaSharedComment(record) : null;
  }

  async updateSharedComment(
    id: string,
    body: string,
    authorLabel?: string | null
  ): Promise<SharedComment | null> {
    const existing = await this.client.sharedComment.findUnique({
      where: { id }
    });
    if (!existing) {
      return null;
    }

    const record = await this.client.sharedComment.update({
      where: { id },
      data: {
        body,
        ...(authorLabel !== undefined ? { authorLabel: authorLabel ?? null } : {})
      }
    });

    const share = await this.client.sharedShortlistLink.findUnique({
      where: { shareId: existing.shareId as string }
    });
    await this.recordValidationEvent({
      eventName: "shared_comment_updated",
      sessionId: (share?.sessionId as string | null) ?? null,
      payload: {
        shareId: existing.shareId as string,
        shortlistId: (share?.shortlistId as string | null) ?? null,
        shortlistItemId: existing.entityId as string,
        commentId: id
      }
    });

    return mapPrismaSharedComment(record);
  }

  async deleteSharedComment(id: string): Promise<boolean> {
    const existing = await this.client.sharedComment.findUnique({
      where: { id }
    });
    if (!existing) {
      return false;
    }

    await this.client.sharedComment.delete({
      where: { id }
    });

    const share = await this.client.sharedShortlistLink.findUnique({
      where: { shareId: existing.shareId as string }
    });
    await this.recordValidationEvent({
      eventName: "shared_comment_deleted",
      sessionId: (share?.sessionId as string | null) ?? null,
      payload: {
        shareId: existing.shareId as string,
        shortlistId: (share?.shortlistId as string | null) ?? null,
        shortlistItemId: existing.entityId as string,
        commentId: id
      }
    });

    return true;
  }

  async createReviewerDecision(payload: {
    shareId: string;
    shortlistItemId: string;
    decision: ReviewerDecisionValue;
    note?: string | null;
  }): Promise<ReviewerDecision> {
    const existing = await this.client.reviewerDecision.findMany({
      where: {
        shareId: payload.shareId,
        shortlistItemId: payload.shortlistItemId
      },
      take: 1
    });
    if (existing[0]) {
      const record = await this.client.reviewerDecision.update({
        where: { id: existing[0].id },
        data: {
          decision: payload.decision,
          note: payload.note ?? null
        }
      });
      const share = await this.client.sharedShortlistLink.findUnique({
        where: { shareId: payload.shareId }
      });
      await this.recordValidationEvent({
        eventName: "reviewer_decision_updated",
        sessionId: (share?.sessionId as string | null) ?? null,
        payload: {
          shareId: payload.shareId,
          shortlistId: (share?.shortlistId as string | null) ?? null,
          shortlistItemId: payload.shortlistItemId,
          reviewerDecisionId: record.id as string,
          decision: payload.decision
        }
      });
      return mapPrismaReviewerDecision(record);
    }

    const record = await this.client.reviewerDecision.create({
      data: {
        shareId: payload.shareId,
        shortlistItemId: payload.shortlistItemId,
        decision: payload.decision,
        note: payload.note ?? null
      }
    });
    const share = await this.client.sharedShortlistLink.findUnique({
      where: { shareId: payload.shareId }
    });
    await this.recordValidationEvent({
      eventName: "reviewer_decision_submitted",
      sessionId: (share?.sessionId as string | null) ?? null,
      payload: {
        shareId: payload.shareId,
        shortlistId: (share?.shortlistId as string | null) ?? null,
        shortlistItemId: payload.shortlistItemId,
        reviewerDecisionId: record.id as string,
        decision: payload.decision
      }
    });

    return mapPrismaReviewerDecision(record);
  }

  async listReviewerDecisions(filters: {
    shareId: string;
    shortlistItemId?: string;
  }): Promise<ReviewerDecision[]> {
    const records = await this.client.reviewerDecision.findMany({
      where: {
        shareId: filters.shareId,
        ...(filters.shortlistItemId ? { shortlistItemId: filters.shortlistItemId } : {})
      },
      orderBy: {
        updatedAt: "desc"
      }
    });
    return records.map((record) => mapPrismaReviewerDecision(record));
  }

  async getReviewerDecision(id: string): Promise<ReviewerDecision | null> {
    const record = await this.client.reviewerDecision.findUnique({
      where: { id }
    });

    return record ? mapPrismaReviewerDecision(record) : null;
  }

  async updateReviewerDecision(
    id: string,
    patch: {
      decision?: ReviewerDecisionValue;
      note?: string | null;
    }
  ): Promise<ReviewerDecision | null> {
    const existing = await this.client.reviewerDecision.findUnique({
      where: { id }
    });
    if (!existing) {
      return null;
    }

    const record = await this.client.reviewerDecision.update({
      where: { id },
      data: {
        ...(patch.decision !== undefined ? { decision: patch.decision } : {}),
        ...(patch.note !== undefined ? { note: patch.note ?? null } : {})
      }
    });
    const share = await this.client.sharedShortlistLink.findUnique({
      where: { shareId: existing.shareId as string }
    });
    await this.recordValidationEvent({
      eventName: "reviewer_decision_updated",
      sessionId: (share?.sessionId as string | null) ?? null,
      payload: {
        shareId: existing.shareId as string,
        shortlistId: (share?.shortlistId as string | null) ?? null,
        shortlistItemId: existing.shortlistItemId as string,
        reviewerDecisionId: id,
        decision: (record.decision as string) ?? patch.decision
      }
    });
    return mapPrismaReviewerDecision(record);
  }

  async deleteReviewerDecision(id: string): Promise<boolean> {
    const existing = await this.client.reviewerDecision.findUnique({
      where: { id }
    });
    if (!existing) {
      return false;
    }

    await this.client.reviewerDecision.delete({
      where: { id }
    });

    return true;
  }

  async listCollaborationActivity(filters: {
    shareId?: string;
    shortlistId?: string;
    limit?: number;
  }): Promise<CollaborationActivityRecord[]> {
    const records = await this.client.validationEvent.findMany?.({
      where: {
        eventName: {
          in: collaborationEventNames()
        },
        ...(filters.shareId ? { payload: { path: ["shareId"], equals: filters.shareId } } : {})
      },
      orderBy: {
        createdAt: "desc"
      },
      take: filters.limit ?? 20
    });

    return (records ?? [])
      .map((record) => toCollaborationActivity(mapPrismaValidationEvent(record)))
      .filter((record): record is CollaborationActivityRecord => Boolean(record))
      .filter((record) => (filters.shortlistId ? record.shortlistId === filters.shortlistId : true));
  }

  async recordOpsAction(payload: {
    actionType: string;
    targetType: string;
    targetId: string;
    partnerId?: string | null;
    result: OpsActionRecord["result"];
    details?: Record<string, unknown> | null;
  }): Promise<OpsActionRecord> {
    const record = await this.client.opsAction.create({
      data: {
        actionType: payload.actionType,
        targetType: payload.targetType,
        targetId: payload.targetId,
        partnerId: payload.partnerId ?? null,
        result: payload.result,
        details: payload.details ?? null
      }
    });
    return mapPrismaOpsAction(record);
  }

  async listOpsActions(filters?: {
    partnerId?: string;
    limit?: number;
  }): Promise<OpsActionRecord[]> {
    const records = await this.client.opsAction.findMany({
      where: filters?.partnerId ? { partnerId: filters.partnerId } : undefined,
      orderBy: {
        performedAt: "desc"
      },
      take: filters?.limit ?? 20
    });
    return records.map((record) => mapPrismaOpsAction(record));
  }

  async listPilotActivity(filters: {
    partnerId: string;
    limit?: number;
  }): Promise<PilotActivityRecord[]> {
    const records = await this.client.validationEvent.findMany?.({
      where: {
        payload: {
          path: ["partnerId"],
          equals: filters.partnerId
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: filters.limit ?? 20
    });

    return (records ?? []).map((record) => {
      const event = mapPrismaValidationEvent(record);
      return {
        id: event.id,
        partnerId: filters.partnerId,
        pilotLinkId: (event.payload?.pilotLinkId as string | null | undefined) ?? null,
        eventType: event.eventName as PilotActivityRecord["eventType"],
        payload: event.payload ?? null,
        createdAt: event.createdAt
      };
    });
  }

  async getOpsSummary(): Promise<OpsSummary> {
    const [partners, links, feedbackCount, events] = await Promise.all([
      this.client.pilotPartner.findMany({}),
      this.client.pilotLink.findMany({}),
      this.client.feedback.count?.({}) ?? 0,
      this.client.validationEvent.findMany?.({
        select: {
          eventName: true
        }
      }) ?? []
    ]);

    return {
      activePilotPartners: partners.filter((entry) => entry.status === "active").length,
      pilotLinkCounts: {
        total: links.length,
        active: links.filter((entry) => pilotLinkStatus(mapPrismaPilotLink(entry)) === "active").length,
        revoked: links.filter((entry) => pilotLinkStatus(mapPrismaPilotLink(entry)) === "revoked").length,
        expired: links.filter((entry) => pilotLinkStatus(mapPrismaPilotLink(entry)) === "expired").length
      },
      recentSharedSnapshotCount: events.filter((entry) => entry.eventName === "snapshot_shared").length,
      recentShortlistShareCount: events.filter((entry) => entry.eventName === "shortlist_shared").length,
      feedbackCount,
      validationEventCount: events.length,
      topErrorCategories: [],
      providerDegradationCount: events.filter((entry) => entry.eventName === "provider_degraded_during_pilot").length,
      partnerUsage: await this.getPartnerUsageSummary()
    };
  }

  async getPartnerUsageSummary(partnerId?: string): Promise<PartnerUsageSummary[]> {
    const [partners, searches, validationEvents, dataQualityEvents] = await Promise.all([
      this.client.pilotPartner.findMany({
        where: partnerId ? { id: partnerId } : undefined
      }),
      this.client.searchRequest.findMany({
        where: partnerId ? { partnerId } : undefined,
        select: {
          partnerId: true,
          warnings: true,
          suggestions: true
        }
      }),
      this.client.validationEvent.findMany({
        select: {
          eventName: true,
          payload: true,
          createdAt: true,
          id: true
        }
      }),
      this.client.dataQualityEvent.findMany({
        where: partnerId ? { partnerId } : undefined,
        select: {
          id: true,
          ruleId: true,
          sourceDomain: true,
          severity: true,
          category: true,
          message: true,
          targetType: true,
          targetId: true,
          partnerId: true,
          sessionId: true,
          provider: true,
          status: true,
          contextJson: true,
          searchRequestId: true,
          triggeredAt: true,
          createdAt: true,
          updatedAt: true
        }
      })
    ]);

    return summarizePartnerUsage({
      searches: searches.map((entry) => ({
        partnerId: (entry.partnerId as string | null) ?? null,
        performance: undefined
      })),
      partners: partners.map((entry) => mapPrismaPilotPartner(entry)),
      validationEvents: validationEvents
        .map((entry) => mapPrismaValidationEvent(entry))
        .filter((entry) =>
          partnerId
            ? (typeof entry.payload?.partnerId === "string" ? entry.payload.partnerId : null) === partnerId
            : true
        ),
      dataQualityEvents: dataQualityEvents.map((entry) => mapPrismaDataQualityEvent(entry)),
      partnerId
    });
  }

  async getUsageFunnelSummary(): Promise<UsageFunnelSummary> {
    const [events, snapshotCount] = await Promise.all([
      this.client.validationEvent.findMany({
        select: {
          eventName: true,
          sessionId: true,
          snapshotId: true,
          historyRecordId: true,
          searchDefinitionId: true,
          demoScenarioId: true,
          payload: true,
          createdAt: true,
          id: true
        }
      }),
      this.client.searchSnapshot.count()
    ]);

    return buildUsageFunnelSummary(events.map((entry) => mapPrismaValidationEvent(entry)), snapshotCount);
  }

  async getUsageFrictionSummary(): Promise<UsageFrictionSummary> {
    const [searches, scoreSnapshots, snapshots, shortlists, validationEvents] = await Promise.all([
      this.client.searchRequest.findMany({
        select: {
          id: true,
          locationType: true,
          returnedCount: true
        }
      }),
      this.client.scoreSnapshot.findMany({
        select: {
          searchRequestId: true,
          nhaloScore: true,
          overallConfidence: true
        }
      }),
      this.listSearchSnapshots(undefined, 1_000),
      this.listShortlists(),
      this.client.validationEvent.findMany({
        select: {
          eventName: true,
          sessionId: true,
          snapshotId: true,
          historyRecordId: true,
          searchDefinitionId: true,
          demoScenarioId: true,
          payload: true,
          createdAt: true,
          id: true
        }
      })
    ]);

    const topConfidenceBySearchId = new Map<string, SearchResponse["homes"][number]["scores"]["overallConfidence"]>();
    for (const snapshot of scoreSnapshots) {
      const existing = topConfidenceBySearchId.get(snapshot.searchRequestId as string);
      if (existing === undefined) {
        topConfidenceBySearchId.set(
          snapshot.searchRequestId as string,
          snapshot.overallConfidence as SearchResponse["homes"][number]["scores"]["overallConfidence"]
        );
        continue;
      }
    }

    const bestScoreBySearchId = new Map<string, number>();
    for (const snapshot of scoreSnapshots) {
      const searchId = snapshot.searchRequestId as string;
      const score = Number(snapshot.nhaloScore);
      const bestScore = bestScoreBySearchId.get(searchId);
      if (bestScore === undefined || score > bestScore) {
        bestScoreBySearchId.set(searchId, score);
        topConfidenceBySearchId.set(
          searchId,
          snapshot.overallConfidence as SearchResponse["homes"][number]["scores"]["overallConfidence"]
        );
      }
    }

    return buildUsageFrictionSummary({
      searches: searches.map((entry) => ({
        id: entry.id as string,
        locationType: entry.locationType as SearchRequest["locationType"],
        returnedCount: Number(entry.returnedCount ?? 0),
        topOverallConfidence: topConfidenceBySearchId.get(entry.id as string) ?? null
      })),
      snapshots,
      shortlists,
      validationEvents: validationEvents.map((entry) => mapPrismaValidationEvent(entry))
    });
  }

  async getPlanSummary(): Promise<PlanSummary> {
    const partners = await this.client.pilotPartner.findMany();
    return buildPlanSummary(partners.map((entry) => mapPrismaPilotPartner(entry)));
  }

  async createFeedback(payload: {
    sessionId?: string | null;
    snapshotId?: string | null;
    historyRecordId?: string | null;
    searchDefinitionId?: string | null;
    category: FeedbackRecord["category"];
    value: FeedbackRecord["value"];
    comment?: string | null;
  }): Promise<FeedbackRecord> {
    const record = await this.client.feedback.create({
      data: {
        sessionId: payload.sessionId ?? null,
        snapshotId: payload.snapshotId ?? null,
        historyRecordId: payload.historyRecordId ?? null,
        searchDefinitionId: payload.searchDefinitionId ?? null,
        category: payload.category,
        value: payload.value,
        comment: payload.comment ?? null
      }
    });

    return mapPrismaFeedback(record);
  }

  async recordValidationEvent(payload: {
    eventName: ValidationEventRecord["eventName"];
    sessionId?: string | null;
    snapshotId?: string | null;
    historyRecordId?: string | null;
    searchDefinitionId?: string | null;
    demoScenarioId?: string | null;
    payload?: Record<string, unknown> | null;
  }): Promise<ValidationEventRecord> {
    const record = await this.client.validationEvent.create({
      data: {
        eventName: payload.eventName,
        sessionId: payload.sessionId ?? null,
        snapshotId: payload.snapshotId ?? null,
        historyRecordId: payload.historyRecordId ?? null,
        searchDefinitionId: payload.searchDefinitionId ?? null,
        demoScenarioId: payload.demoScenarioId ?? null,
        payload: payload.payload ?? null
      }
    });

    return mapPrismaValidationEvent(record);
  }

  async getValidationSummary(): Promise<ValidationSummary> {
    const [searches, feedback, events, shares] = await Promise.all([
      this.client.searchRequest.findMany({
        select: {
          sessionId: true,
          filters: true,
          demoScenarioId: true
        }
      }),
      this.client.feedback.findMany?.({
        select: {
          value: true,
          sessionId: true
        }
      }) ?? [],
      this.client.validationEvent.findMany?.({
        select: {
          eventName: true,
          sessionId: true,
          demoScenarioId: true
        }
      }) ?? [],
      this.client.sharedSnapshotLink.findMany?.({
        select: {
          id: true,
          snapshotId: true,
          openCount: true
        }
      }) ?? []
    ]);

    const sessions = new Set(
      searches.map((entry) => entry.sessionId as string | null).filter(Boolean) as string[]
    );
    const useful = feedback.filter((entry) => entry.value === "positive").length;
    const eventCount = (name: ValidationEventRecord["eventName"]) =>
      events.filter((entry) => entry.eventName === name).length;
    const rejectionCounts = new Map<string, number>();
    for (const search of searches) {
      const filters = (search.filters as Record<string, unknown>) ?? {};
      const rejectionSummary = (filters.rejectionSummary as Record<string, number> | undefined) ?? {};
      for (const [key, value] of Object.entries(rejectionSummary)) {
        rejectionCounts.set(key, (rejectionCounts.get(key) ?? 0) + Number(value));
      }
    }
    const demoScenarioCounts = new Map<string, number>();
    for (const event of events) {
      if (event.demoScenarioId) {
        demoScenarioCounts.set(
          event.demoScenarioId as string,
          (demoScenarioCounts.get(event.demoScenarioId as string) ?? 0) + 1
        );
      }
    }

    return {
      searchesPerSession: {
        sessions: sessions.size,
        searches: searches.length,
        average: sessions.size === 0 ? 0 : Number((searches.length / sessions.size).toFixed(2))
      },
      shareableSnapshotsCreated: shares.length,
      sharedSnapshotOpens: eventCount("snapshot_opened"),
      sharedSnapshotOpenRate: {
        opens: eventCount("snapshot_opened"),
        created: shares.length,
        rate: shares.length === 0 ? 0 : Number((eventCount("snapshot_opened") / shares.length).toFixed(4))
      },
      feedbackSubmissionRate: {
        feedbackCount: feedback.length,
        sessions: sessions.size,
        rate: sessions.size === 0 ? 0 : Number((feedback.length / sessions.size).toFixed(4))
      },
      emptyStateRate: {
        emptyStates: eventCount("empty_state_encountered"),
        searches: searches.length,
        rate: searches.length === 0 ? 0 : Number((eventCount("empty_state_encountered") / searches.length).toFixed(4))
      },
      rerunRate: {
        reruns: eventCount("rerun_executed"),
        searches: searches.length,
        rate: searches.length === 0 ? 0 : Number((eventCount("rerun_executed") / searches.length).toFixed(4))
      },
      compareUsageRate: {
        comparisons: eventCount("comparison_started"),
        sessions: sessions.size,
        rate: sessions.size === 0 ? 0 : Number((eventCount("comparison_started") / sessions.size).toFixed(4))
      },
      restoreUsageRate: {
        restores: eventCount("restore_used"),
        sessions: sessions.size,
        rate: sessions.size === 0 ? 0 : Number((eventCount("restore_used") / sessions.size).toFixed(4))
      },
      mostCommonRejectionReasons: [...rejectionCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5)
        .map(([reason, count]) => ({ reason, count })),
      mostCommonConfidenceLevels: [],
      topDemoScenariosUsed: [...demoScenarioCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5)
        .map(([demoScenarioId, count]) => ({ demoScenarioId, count })),
      mostViewedSharedSnapshots: shares
        .map((entry) => ({
          snapshotId: entry.snapshotId as string,
          opens: Number(entry.openCount ?? 0)
        }))
        .sort((left, right) => right.opens - left.opens)
        .slice(0, 5)
    };
  }

  private async upsertProperty(listing: ListingRecord): Promise<void> {
    await this.client.property.upsert({
      where: { id: listing.id },
      create: {
        id: listing.id,
        provider: listing.sourceProvider,
        sourceUrl: listing.sourceUrl,
        address: listing.address,
        city: listing.city,
        state: listing.state,
        zipCode: listing.zipCode,
        latitude: listing.latitude,
        longitude: listing.longitude,
        propertyType: listing.propertyType,
        price: Math.round(listing.price),
        sqft: Math.round(listing.squareFootage),
        bedrooms: Math.round(listing.bedrooms),
        bathrooms: listing.bathrooms,
        lotSqft: listing.lotSqft ?? null,
        rawPayload: listing.rawPayload,
        createdAt: new Date(listing.createdAt),
        updatedAt: new Date(listing.updatedAt)
      },
      update: {
        provider: listing.sourceProvider,
        sourceUrl: listing.sourceUrl,
        address: listing.address,
        city: listing.city,
        state: listing.state,
        zipCode: listing.zipCode,
        latitude: listing.latitude,
        longitude: listing.longitude,
        propertyType: listing.propertyType,
        price: Math.round(listing.price),
        sqft: Math.round(listing.squareFootage),
        bedrooms: Math.round(listing.bedrooms),
        bathrooms: listing.bathrooms,
        lotSqft: listing.lotSqft ?? null,
        rawPayload: listing.rawPayload,
        updatedAt: new Date(listing.updatedAt)
      }
    });
  }
}

export class PrismaMarketSnapshotRepository implements MarketSnapshotRepository {
  constructor(private readonly client: PrismaClientLike) {}

  async createSnapshot(snapshot: Omit<MarketSnapshot, "id">): Promise<MarketSnapshot> {
    const record = await this.client.marketSnapshot.create({
      data: {
        location: snapshot.location,
        radiusMiles: snapshot.radiusMiles,
        medianPricePerSqft: snapshot.medianPricePerSqft,
        sampleSize: snapshot.sampleSize,
        createdAt: new Date(snapshot.createdAt)
      }
    });

    return {
      id: record.id as string,
      location: record.location as string,
      radiusMiles: Number(record.radiusMiles),
      medianPricePerSqft: Number(record.medianPricePerSqft),
      sampleSize: Number(record.sampleSize),
      createdAt: (record.createdAt as Date).toISOString()
    };
  }

  async getLatestSnapshot(location: string, radiusMiles: number): Promise<MarketSnapshot | null> {
    const record = await this.client.marketSnapshot.findFirst({
      where: {
        location,
        radiusMiles
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    if (!record) {
      return null;
    }

    return {
      id: record.id as string,
      location: record.location as string,
      radiusMiles: Number(record.radiusMiles),
      medianPricePerSqft: Number(record.medianPricePerSqft),
      sampleSize: Number(record.sampleSize),
      createdAt: (record.createdAt as Date).toISOString()
    };
  }

  isSnapshotFresh(snapshot: MarketSnapshot, maxAgeHours = MARKET_SNAPSHOT_FRESH_HOURS): boolean {
    return ageHours(snapshot.createdAt) <= maxAgeHours;
  }
}

export class PrismaSafetySignalCacheRepository implements SafetySignalCacheRepository {
  constructor(private readonly client: PrismaClientLike) {}

  async save(entry: Omit<SafetySignalCacheRecord, "id">): Promise<SafetySignalCacheRecord> {
    const record = await this.client.safetySignalCache.create({
      data: {
        locationKey: entry.locationKey,
        lat: entry.lat,
        lng: entry.lng,
        crimeProvider: entry.crimeProvider,
        schoolProvider: entry.schoolProvider,
        crimeRaw: entry.crimeRaw,
        crimeNormalized: entry.crimeNormalized,
        schoolRaw: entry.schoolRaw,
        schoolNormalized: entry.schoolNormalized,
        stabilityRaw: entry.stabilityRaw,
        stabilityNormalized: entry.stabilityNormalized,
        fetchedAt: new Date(entry.fetchedAt),
        expiresAt: new Date(entry.expiresAt),
        sourceType: entry.sourceType
      }
    });

    return {
      id: record.id as string,
      locationKey: record.locationKey as string,
      lat: Number(record.lat),
      lng: Number(record.lng),
      crimeProvider: (record.crimeProvider as string | null) ?? null,
      schoolProvider: (record.schoolProvider as string | null) ?? null,
      crimeRaw: (record.crimeRaw as Record<string, unknown> | number | null) ?? null,
      crimeNormalized: (record.crimeNormalized as number | null) ?? null,
      schoolRaw: (record.schoolRaw as Record<string, unknown> | number | null) ?? null,
      schoolNormalized: (record.schoolNormalized as number | null) ?? null,
      stabilityRaw: (record.stabilityRaw as Record<string, unknown> | number | null) ?? null,
      stabilityNormalized: (record.stabilityNormalized as number | null) ?? null,
      fetchedAt: (record.fetchedAt as Date).toISOString(),
      expiresAt: (record.expiresAt as Date).toISOString(),
      sourceType: record.sourceType as SafetySignalCacheRecord["sourceType"]
    };
  }

  async getLatest(locationKey: string): Promise<SafetySignalCacheRecord | null> {
    const record = await this.client.safetySignalCache.findFirst({
      where: {
        locationKey
      },
      orderBy: {
        fetchedAt: "desc"
      }
    });

    if (!record) {
      return null;
    }

    return {
      id: record.id as string,
      locationKey: record.locationKey as string,
      lat: Number(record.lat),
      lng: Number(record.lng),
      crimeProvider: (record.crimeProvider as string | null) ?? null,
      schoolProvider: (record.schoolProvider as string | null) ?? null,
      crimeRaw: (record.crimeRaw as Record<string, unknown> | number | null) ?? null,
      crimeNormalized: (record.crimeNormalized as number | null) ?? null,
      schoolRaw: (record.schoolRaw as Record<string, unknown> | number | null) ?? null,
      schoolNormalized: (record.schoolNormalized as number | null) ?? null,
      stabilityRaw: (record.stabilityRaw as Record<string, unknown> | number | null) ?? null,
      stabilityNormalized: (record.stabilityNormalized as number | null) ?? null,
      fetchedAt: (record.fetchedAt as Date).toISOString(),
      expiresAt: (record.expiresAt as Date).toISOString(),
      sourceType: record.sourceType as SafetySignalCacheRecord["sourceType"]
    };
  }

  isFresh(
    entry: SafetySignalCacheRecord,
    ttlHours = DEFAULT_SAFETY_CACHE_TTL_HOURS
  ): boolean {
    return ageHours(entry.fetchedAt) <= ttlHours;
  }

  isStaleUsable(
    entry: SafetySignalCacheRecord,
    staleTtlHours = DEFAULT_SAFETY_STALE_TTL_HOURS
  ): boolean {
    return ageHours(entry.fetchedAt) <= staleTtlHours;
  }
}

export class PrismaListingCacheRepository implements ListingCacheRepository {
  constructor(private readonly client: PrismaClientLike) {}

  async save(entry: Omit<ListingCacheRecord, "id">): Promise<ListingCacheRecord> {
    const record = await this.client.listingCache.create({
      data: {
        locationKey: entry.locationKey,
        locationType: entry.locationType,
        locationValue: entry.locationValue,
        radiusMiles: entry.radiusMiles,
        provider: entry.provider,
        rawPayload: entry.rawPayload,
        normalizedListings: entry.normalizedListings,
        fetchedAt: new Date(entry.fetchedAt),
        expiresAt: new Date(entry.expiresAt),
        sourceType: entry.sourceType,
        rejectionSummary: entry.rejectionSummary
      }
    });

    return {
      id: record.id as string,
      locationKey: record.locationKey as string,
      locationType: record.locationType as ListingCacheRecord["locationType"],
      locationValue: record.locationValue as string,
      radiusMiles: Number(record.radiusMiles),
      provider: record.provider as string,
      rawPayload: (record.rawPayload as Record<string, unknown>[] | null) ?? null,
      normalizedListings: (record.normalizedListings as ListingRecord[]) ?? [],
      fetchedAt: (record.fetchedAt as Date).toISOString(),
      expiresAt: (record.expiresAt as Date).toISOString(),
      sourceType: record.sourceType as ListingCacheRecord["sourceType"],
      rejectionSummary: record.rejectionSummary as ListingCacheRecord["rejectionSummary"]
    };
  }

  async getLatest(locationKey: string): Promise<ListingCacheRecord | null> {
    const record = await this.client.listingCache.findFirst({
      where: {
        locationKey
      },
      orderBy: {
        fetchedAt: "desc"
      }
    });

    if (!record) {
      return null;
    }

    return {
      id: record.id as string,
      locationKey: record.locationKey as string,
      locationType: record.locationType as ListingCacheRecord["locationType"],
      locationValue: record.locationValue as string,
      radiusMiles: Number(record.radiusMiles),
      provider: record.provider as string,
      rawPayload: (record.rawPayload as Record<string, unknown>[] | null) ?? null,
      normalizedListings: (record.normalizedListings as ListingRecord[]) ?? [],
      fetchedAt: (record.fetchedAt as Date).toISOString(),
      expiresAt: (record.expiresAt as Date).toISOString(),
      sourceType: record.sourceType as ListingCacheRecord["sourceType"],
      rejectionSummary: record.rejectionSummary as ListingCacheRecord["rejectionSummary"]
    };
  }

  isFresh(entry: ListingCacheRecord, ttlHours = DEFAULT_LISTING_CACHE_TTL_HOURS): boolean {
    return ageHours(entry.fetchedAt) <= ttlHours;
  }

  isStaleUsable(
    entry: ListingCacheRecord,
    staleTtlHours = DEFAULT_LISTING_STALE_TTL_HOURS
  ): boolean {
    return ageHours(entry.fetchedAt) <= staleTtlHours;
  }
}

export class PrismaGeocodeCacheRepository implements GeocodeCacheRepository {
  constructor(private readonly client: PrismaClientLike) {}

  async save(entry: Omit<GeocodeCacheRecord, "id">): Promise<GeocodeCacheRecord> {
    const record = await this.client.geocodeCache.create({
      data: {
        queryType: entry.queryType,
        queryValue: entry.queryValue,
        provider: entry.provider,
        formattedAddress: entry.formattedAddress,
        latitude: entry.latitude,
        longitude: entry.longitude,
        precision: entry.precision,
        rawPayload: entry.rawPayload,
        normalizedPayload: entry.normalizedPayload,
        fetchedAt: new Date(entry.fetchedAt),
        expiresAt: new Date(entry.expiresAt),
        sourceType: entry.sourceType,
        city: entry.city,
        state: entry.state,
        zip: entry.zip,
        country: entry.country
      }
    });

    return {
      id: record.id as string,
      queryType: record.queryType as GeocodeCacheRecord["queryType"],
      queryValue: record.queryValue as string,
      provider: record.provider as string,
      formattedAddress: (record.formattedAddress as string | null) ?? null,
      latitude: Number(record.latitude),
      longitude: Number(record.longitude),
      precision: record.precision as GeocodeCacheRecord["precision"],
      rawPayload:
        (record.rawPayload as Record<string, unknown> | Record<string, unknown>[] | null) ?? null,
      normalizedPayload: (record.normalizedPayload as Record<string, unknown> | null) ?? null,
      fetchedAt: (record.fetchedAt as Date).toISOString(),
      expiresAt: (record.expiresAt as Date).toISOString(),
      sourceType: record.sourceType as GeocodeCacheRecord["sourceType"],
      city: (record.city as string | null) ?? null,
      state: (record.state as string | null) ?? null,
      zip: (record.zip as string | null) ?? null,
      country: (record.country as string | null) ?? null
    };
  }

  async getLatest(queryType: GeocodeCacheRecord["queryType"], queryValue: string): Promise<GeocodeCacheRecord | null> {
    const record = await this.client.geocodeCache.findFirst({
      where: {
        queryType,
        queryValue
      },
      orderBy: {
        fetchedAt: "desc"
      }
    });

    if (!record) {
      return null;
    }

    return {
      id: record.id as string,
      queryType: record.queryType as GeocodeCacheRecord["queryType"],
      queryValue: record.queryValue as string,
      provider: record.provider as string,
      formattedAddress: (record.formattedAddress as string | null) ?? null,
      latitude: Number(record.latitude),
      longitude: Number(record.longitude),
      precision: record.precision as GeocodeCacheRecord["precision"],
      rawPayload:
        (record.rawPayload as Record<string, unknown> | Record<string, unknown>[] | null) ?? null,
      normalizedPayload: (record.normalizedPayload as Record<string, unknown> | null) ?? null,
      fetchedAt: (record.fetchedAt as Date).toISOString(),
      expiresAt: (record.expiresAt as Date).toISOString(),
      sourceType: record.sourceType as GeocodeCacheRecord["sourceType"],
      city: (record.city as string | null) ?? null,
      state: (record.state as string | null) ?? null,
      zip: (record.zip as string | null) ?? null,
      country: (record.country as string | null) ?? null
    };
  }

  isFresh(entry: GeocodeCacheRecord, ttlHours = DEFAULT_GEOCODE_CACHE_TTL_HOURS): boolean {
    return ageHours(entry.fetchedAt) <= ttlHours;
  }

  isStaleUsable(
    entry: GeocodeCacheRecord,
    staleTtlHours = DEFAULT_GEOCODE_STALE_TTL_HOURS
  ): boolean {
    return ageHours(entry.fetchedAt) <= staleTtlHours;
  }
}

export interface PersistenceLayer {
  mode: "memory" | "database";
  searchRepository: SearchRepository;
  marketSnapshotRepository: MarketSnapshotRepository;
  safetySignalCacheRepository: SafetySignalCacheRepository;
  listingCacheRepository: ListingCacheRepository;
  geocodeCacheRepository: GeocodeCacheRepository;
  checkReadiness(): Promise<{
    database: boolean;
    cache: boolean;
  }>;
  cleanupExpiredData(options: {
    snapshotRetentionDays: number;
    searchHistoryRetentionDays: number;
  }): Promise<{
    snapshotsRemoved: number;
    historyRemoved: number;
    cachesRemoved: number;
  }>;
  close(): Promise<void>;
}

export async function createPersistenceLayer(databaseUrl?: string): Promise<PersistenceLayer> {
  if (!databaseUrl) {
    const searchRepository = new InMemorySearchRepository();
    const marketSnapshotRepository = new InMemoryMarketSnapshotRepository();
    const safetySignalCacheRepository = new InMemorySafetySignalCacheRepository();
    const listingCacheRepository = new InMemoryListingCacheRepository();
    const geocodeCacheRepository = new InMemoryGeocodeCacheRepository();

    return {
      mode: "memory",
      searchRepository,
      marketSnapshotRepository,
      safetySignalCacheRepository,
      listingCacheRepository,
      geocodeCacheRepository,
      async checkReadiness() {
        return {
          database: true,
          cache: true
        };
      },
      async cleanupExpiredData(options) {
        const snapshotsBefore = searchRepository.searchSnapshots.length;
        const searchesBefore = searchRepository.searches.length;
        const safetyBefore = safetySignalCacheRepository.entries.length;
        const listingBefore = listingCacheRepository.entries.length;
        const geocodeBefore = geocodeCacheRepository.entries.length;

        searchRepository.searchSnapshots.splice(
          0,
          searchRepository.searchSnapshots.length,
          ...searchRepository.searchSnapshots.filter(
            (entry) => !olderThanDays(entry.createdAt, options.snapshotRetentionDays)
          )
        );
        searchRepository.searches.splice(
          0,
          searchRepository.searches.length,
          ...searchRepository.searches.filter(
            (entry) => !olderThanDays(entry.createdAt, options.searchHistoryRetentionDays)
          )
        );
        safetySignalCacheRepository.entries.splice(
          0,
          safetySignalCacheRepository.entries.length,
          ...safetySignalCacheRepository.entries.filter(
            (entry) => new Date(entry.expiresAt).getTime() > Date.now()
          )
        );
        listingCacheRepository.entries.splice(
          0,
          listingCacheRepository.entries.length,
          ...listingCacheRepository.entries.filter(
            (entry) => new Date(entry.expiresAt).getTime() > Date.now()
          )
        );
        geocodeCacheRepository.entries.splice(
          0,
          geocodeCacheRepository.entries.length,
          ...geocodeCacheRepository.entries.filter(
            (entry) => new Date(entry.expiresAt).getTime() > Date.now()
          )
        );

        return {
          snapshotsRemoved: snapshotsBefore - searchRepository.searchSnapshots.length,
          historyRemoved: searchesBefore - searchRepository.searches.length,
          cachesRemoved:
            safetyBefore -
            safetySignalCacheRepository.entries.length +
            (listingBefore - listingCacheRepository.entries.length) +
            (geocodeBefore - geocodeCacheRepository.entries.length)
        };
      },
      async close() {}
    };
  }

  try {
    const prismaModule = await import("@prisma/client");
    const client = new prismaModule.PrismaClient({
      datasources: {
        db: {
          url: databaseUrl
        }
      }
    }) as PrismaClientLike;
    await client.$connect?.();

    const searchRepository = new PrismaSearchRepository(client);
    const marketSnapshotRepository = new PrismaMarketSnapshotRepository(client);
    const safetySignalCacheRepository = new PrismaSafetySignalCacheRepository(client);
    const listingCacheRepository = new PrismaListingCacheRepository(client);
    const geocodeCacheRepository = new PrismaGeocodeCacheRepository(client);

    return {
      mode: "database",
      searchRepository,
      marketSnapshotRepository,
      safetySignalCacheRepository,
      listingCacheRepository,
      geocodeCacheRepository,
      async checkReadiness() {
        try {
          await client.$queryRawUnsafe?.("SELECT 1");
          return {
            database: true,
            cache: true
          };
        } catch {
          return {
            database: false,
            cache: true
          };
        }
      },
      async cleanupExpiredData(options) {
        const snapshotResult = await client.searchSnapshot.deleteMany?.({
          where: {
            createdAt: {
              lt: new Date(Date.now() - options.snapshotRetentionDays * 86_400_000)
            }
          }
        });
        const historyResult = await client.searchRequest.deleteMany?.({
          where: {
            createdAt: {
              lt: new Date(Date.now() - options.searchHistoryRetentionDays * 86_400_000)
            }
          }
        });
        const [safetyResult, listingResult, geocodeResult] = await Promise.all([
          client.safetySignalCache.deleteMany?.({
            where: {
              expiresAt: {
                lt: new Date()
              }
            }
          }),
          client.listingCache.deleteMany?.({
            where: {
              expiresAt: {
                lt: new Date()
              }
            }
          }),
          client.geocodeCache.deleteMany?.({
            where: {
              expiresAt: {
                lt: new Date()
              }
            }
          })
        ]);

        return {
          snapshotsRemoved: snapshotResult?.count ?? 0,
          historyRemoved: historyResult?.count ?? 0,
          cachesRemoved:
            (safetyResult?.count ?? 0) + (listingResult?.count ?? 0) + (geocodeResult?.count ?? 0)
        };
      },
      async close() {
        await client.$disconnect?.();
      }
    };
  } catch {
    return createPersistenceLayer(undefined);
  }
}

export async function createSearchRepository(databaseUrl?: string): Promise<SearchRepository> {
  const persistenceLayer = await createPersistenceLayer(databaseUrl);

  return persistenceLayer.searchRepository;
}
