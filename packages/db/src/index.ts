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
  AlertCategory,
  AffordabilityClassification,
  ChoiceStatus,
  ClosingChecklistItemState,
  ClosingChecklistItemType,
  ClosingMilestoneType,
  ClosingReadiness,
  ClosingReadinessInputs,
  ClosingReadinessSummary,
  CollaborationActivityRecord,
  CollaborationRole,
  CreditScoreRange,
  DataQualityEvent,
  DataQualityStatus,
  DataQualitySummary,
  DecisionConfidence,
  DecisionStage,
  DroppedReason,
  EffectiveCapabilities,
  FeedbackRecord,
  FinancialReadiness,
  FinancialReadinessInputs,
  FinancialReadinessState,
  FinancialReadinessSummary,
  ListingDataSource,
  GeocodeCacheRecord,
  GeocodeCacheRepository,
  HistoricalComparisonPayload,
  ListingCacheRecord,
  ListingCacheRepository,
  ListingStatus,
  NegotiationEvent,
  NegotiationEventType,
  NegotiationRecord,
  NegotiationStatus,
  NegotiationSummary,
  OfferFinancingReadiness,
  OfferPropertyFitConfidence,
  OfferReadiness,
  OfferReadinessRecommendation,
  OfferReadinessStatus,
  OfferRiskLevel,
  OfferRiskToleranceAlignment,
  ReviewerDecision,
  ReviewerDecisionValue,
  ShareMode,
  ListingRecord,
  MarketSnapshot,
  MarketSnapshotRepository,
  NotificationActionTarget,
  NotificationModuleName,
  NotificationSeverity,
  NotificationStatus,
  OpsActionRecord,
  OpsSummary,
  LoanType,
  OfferPreparation,
  OfferPreparationContingency,
  OfferPreparationDownPaymentType,
  OfferPreparationInputs,
  OfferPreparationPossessionTiming,
  OfferPreparationState,
  OfferPreparationSummary,
  OfferSubmission,
  OfferSubmissionBuyerCounterDecision,
  OfferSubmissionMethod,
  OfferSubmissionSellerResponseState,
  OfferSubmissionSummary,
  UnderContractCoordination,
  UnderContractCoordinationInputs,
  UnderContractCoordinationSummary,
  UnifiedActivityActorType,
  UnifiedActivityEventCategory,
  UnifiedActivityModuleName,
  UnifiedActivityRecord,
  UnifiedActivityTriggerType,
  ContractTaskState,
  ContractTaskType,
  CoordinationMilestoneType,
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
  SelectedChoiceOfferStrategy,
  SelectedChoiceConciergeSummary,
  SelectedChoiceView,
  OfferPosture,
  OfferStrategyConfidence,
  OfferUrgencyLevel,
  ConcessionStrategy,
  RecommendedNextOfferAction,
  SharedSnapshotRecord,
  SharedSnapshotView,
  PreApprovalStatus,
  ProofOfFundsStatus,
  ValidationEventRecord,
  ValidationSummary,
  UsageFrictionSummary,
  UsageFunnelSummary,
  WorkflowNotification,
  WorkflowNotificationHistoryEvent,
  WorkflowActivityRecord
} from "@nhalo/types";
import {
  evaluateClosingReadiness,
  toClosingReadinessSummary
} from "./closing-readiness";
import {
  evaluateFinancialReadiness,
  toFinancialReadinessSummary
} from "./financial-readiness";
import {
  evaluateOfferReadiness,
  toOfferReadinessRecommendation
} from "./offer-readiness";
import {
  applyOfferPreparationStrategyDefaults,
  evaluateOfferPreparation,
  toOfferPreparationSummary
} from "./offer-preparation";
import {
  evaluateOfferSubmission,
  toOfferSubmissionSummary
} from "./offer-submission";
import {
  evaluateUnderContractCoordination,
  toUnderContractCoordinationSummary
} from "./under-contract";
import { evaluateNegotiation, toNegotiationSummary } from "./negotiation";
import { buildBuyerTransactionCommandCenter } from "./transaction-command-center";

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

const PRIMARY_CHOICE_STATUSES = new Set<ChoiceStatus>([
  "selected",
  "active_pursuit",
  "under_contract",
  "closed"
]);

const TERMINAL_CHOICE_STATUSES = new Set<ChoiceStatus>(["closed", "dropped", "replaced"]);

function normalizeDecisionRisks(value: string[] | null | undefined): string[] {
  return [...new Set((value ?? []).map((entry) => entry.trim()).filter((entry) => entry.length > 0))];
}

function parseDecisionRisksJson(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return normalizeDecisionRisks(value.filter((entry): entry is string => typeof entry === "string"));
}

function normalizeShortlistItemChoice(item: ShortlistItem): ShortlistItem {
  return {
    ...item,
    choiceStatus: item.choiceStatus ?? "candidate",
    selectionRank: item.selectionRank ?? null,
    decisionConfidence: item.decisionConfidence ?? null,
    decisionRationale: item.decisionRationale ?? null,
    decisionRisks: normalizeDecisionRisks(item.decisionRisks),
    lastDecisionReviewedAt: item.lastDecisionReviewedAt ?? null,
    selectedAt: item.selectedAt ?? null,
    statusChangedAt: item.statusChangedAt ?? item.updatedAt,
    replacedByShortlistItemId: item.replacedByShortlistItemId ?? null,
    droppedReason: item.droppedReason ?? null
  };
}

function isTerminalChoiceStatus(value: ChoiceStatus): boolean {
  return TERMINAL_CHOICE_STATUSES.has(value);
}

function isPrimaryLifecycleChoiceStatus(value: ChoiceStatus): boolean {
  return PRIMARY_CHOICE_STATUSES.has(value);
}

function deriveDecisionStage(value: ChoiceStatus): DecisionStage {
  switch (value) {
    case "candidate":
    case "backup":
      return "considering";
    case "selected":
      return "selected_choice";
    case "active_pursuit":
      return "offer_pursuit";
    case "under_contract":
      return "contract_to_close";
    case "closed":
    case "dropped":
    case "replaced":
      return "finished";
  }
}

function choiceStatusPriority(value: ChoiceStatus): number {
  switch (value) {
    case "closed":
      return 0;
    case "under_contract":
      return 1;
    case "active_pursuit":
      return 2;
    case "selected":
      return 3;
    case "backup":
      return 4;
    case "candidate":
      return 5;
    case "dropped":
      return 6;
    case "replaced":
      return 7;
  }
}

function shortlistItemOrder(left: ShortlistItem, right: ShortlistItem): number {
  const leftPriority = choiceStatusPriority(left.choiceStatus);
  const rightPriority = choiceStatusPriority(right.choiceStatus);
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }
  if ((left.selectionRank ?? Number.POSITIVE_INFINITY) !== (right.selectionRank ?? Number.POSITIVE_INFINITY)) {
    return (left.selectionRank ?? Number.POSITIVE_INFINITY) - (right.selectionRank ?? Number.POSITIVE_INFINITY);
  }
  return right.updatedAt.localeCompare(left.updatedAt);
}

function resolvePrimaryChoiceOwner(items: ShortlistItem[]): ShortlistItem | null {
  const candidates = items.filter((item) => isPrimaryLifecycleChoiceStatus(item.choiceStatus));
  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort((left, right) => {
    const priorityDelta = choiceStatusPriority(left.choiceStatus) - choiceStatusPriority(right.choiceStatus);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }
    return right.statusChangedAt.localeCompare(left.statusChangedAt);
  })[0] ?? null;
}

function buildSelectedChoiceView(shortlistId: string, items: ShortlistItem[]): SelectedChoiceView {
  const normalized = items.map((item) => normalizeShortlistItemChoice(item));
  const selectedItem =
    normalized.find((item) => item.choiceStatus === "selected" && item.selectionRank === 1) ?? null;

  return {
    shortlistId,
    selectedItem,
    backups: normalized
      .filter((item) => item.choiceStatus === "backup")
      .sort((left, right) =>
        (left.selectionRank ?? Number.POSITIVE_INFINITY) - (right.selectionRank ?? Number.POSITIVE_INFINITY)
      ),
    candidates: normalized
      .filter((item) => item.choiceStatus === "candidate")
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    terminalItems: normalized
      .filter((item) => isTerminalChoiceStatus(item.choiceStatus))
      .sort((left, right) => right.statusChangedAt.localeCompare(left.statusChangedAt))
  };
}

function normalizeBackupRanks(items: ShortlistItem[]): ShortlistItem[] {
  const orderedBackups = items
    .filter((item) => item.choiceStatus === "backup")
    .sort((left, right) => {
      if ((left.selectionRank ?? Number.POSITIVE_INFINITY) !== (right.selectionRank ?? Number.POSITIVE_INFINITY)) {
        return (left.selectionRank ?? Number.POSITIVE_INFINITY) - (right.selectionRank ?? Number.POSITIVE_INFINITY);
      }
      return right.updatedAt.localeCompare(left.updatedAt);
    });

  orderedBackups.forEach((item, index) => {
    item.selectionRank = index + 2;
  });

  return items;
}

function activeWorkflowNotifications(
  notifications: WorkflowNotification[]
): WorkflowNotification[] {
  return notifications.filter(
    (entry) => entry.status !== "DISMISSED" && entry.status !== "RESOLVED"
  );
}

function pushUnique(target: string[], value: string | null | undefined): void {
  if (!value || value.trim().length === 0 || target.includes(value)) {
    return;
  }

  target.push(value);
}

function classifyVersusList(
  listPrice: number | null,
  recommendedOfferPrice: number | null
): SelectedChoiceOfferStrategy["pricePosition"]["versusList"] {
  if (!listPrice || !recommendedOfferPrice) {
    return "unknown";
  }

  const ratio = recommendedOfferPrice / Math.max(listPrice, 1);
  if (ratio > 1.01) {
    return "above_list";
  }
  if (ratio < 0.99) {
    return "below_list";
  }
  return "at_list";
}

function classifyVersusMarket(
  pricePerSqft: number | null,
  medianPricePerSqft: number | null
): SelectedChoiceOfferStrategy["pricePosition"]["versusMarket"] {
  if (!pricePerSqft || !medianPricePerSqft) {
    return "unknown";
  }

  const ratio = pricePerSqft / Math.max(medianPricePerSqft, 1);
  if (ratio <= 0.95) {
    return "discount_to_market";
  }
  if (ratio >= 1.05) {
    return "premium_to_market";
  }
  return "near_market";
}

function deriveSelectedChoiceOfferStrategy(args: {
  primaryOwner: ShortlistItem | null;
  financialReadiness: FinancialReadiness | null;
  offerReadiness: OfferReadiness | null;
}): SelectedChoiceOfferStrategy | null {
  const primaryOwner = args.primaryOwner;
  if (!primaryOwner || !["selected", "active_pursuit"].includes(primaryOwner.choiceStatus)) {
    return null;
  }

  const home = primaryOwner.capturedHome;
  const listingStatus = home.listingStatus ?? null;
  const daysOnMarket =
    typeof home.daysOnMarket === "number" && Number.isFinite(home.daysOnMarket)
      ? Math.max(0, Math.round(home.daysOnMarket))
      : null;
  const listPrice = typeof home.price === "number" && Number.isFinite(home.price) ? home.price : null;
  const recommendedOfferPrice = args.offerReadiness?.recommendedOfferPrice ?? null;
  const pricePerSqft =
    typeof home.pricePerSqft === "number" && home.pricePerSqft > 0 ? home.pricePerSqft : null;
  const medianPricePerSqft =
    typeof home.medianPricePerSqft === "number" && home.medianPricePerSqft > 0
      ? home.medianPricePerSqft
      : null;
  const comparableSampleSize =
    typeof home.comparableSampleSize === "number" && Number.isFinite(home.comparableSampleSize)
      ? home.comparableSampleSize
      : null;
  const comparableStrategyUsed = home.comparableStrategyUsed ?? null;
  const overallConfidence = home.scores.overallConfidence ?? null;
  const listingDataSource = home.provenance?.listingDataSource ?? home.listingDataSource ?? null;
  const limitedComparables = Boolean(home.qualityFlags?.includes("limitedComparables"));
  const listingKnown = listingStatus !== null;
  const domKnown = daysOnMarket !== null;
  const listingFreshnessWeak =
    listingDataSource === "stale_cached_live" || listingDataSource === "mock";
  const confidenceWeak = overallConfidence === "low" || overallConfidence === "none";
  const financialReady = args.financialReadiness?.readinessState === "READY";
  const offerReadiness = args.offerReadiness;
  const offerReady = offerReadiness?.status === "READY";
  const offerBlocked = offerReadiness?.status === "BLOCKED";

  let strategyConfidence: OfferStrategyConfidence = "medium";
  if (
    financialReady &&
    offerReady &&
    listingKnown &&
    domKnown &&
    !listingFreshnessWeak &&
    !limitedComparables &&
    !confidenceWeak
  ) {
    strategyConfidence = "high";
  } else if (
    !offerReadiness ||
    (!listingKnown && !domKnown) ||
    listingFreshnessWeak ||
    confidenceWeak
  ) {
    strategyConfidence = "low";
  }

  let urgencyLevel: OfferUrgencyLevel = "low";
  if (
    listingStatus === "pending" ||
    listingStatus === "contingent" ||
    listingStatus === "sold" ||
    listingStatus === "off_market" ||
    !financialReady ||
    offerBlocked
  ) {
    urgencyLevel = "blocked";
  } else if (
    listingStatus === "active" &&
    daysOnMarket !== null &&
    daysOnMarket <= 7 &&
    offerReady &&
    strategyConfidence !== "low"
  ) {
    urgencyLevel = "high";
  } else if (
    listingStatus === "active" &&
    ((daysOnMarket !== null && daysOnMarket <= 21) || (daysOnMarket === null && offerReady))
  ) {
    urgencyLevel = "medium";
  }

  let offerPosture: OfferPosture;
  if (
    listingStatus === "pending" ||
    listingStatus === "contingent" ||
    listingStatus === "sold" ||
    listingStatus === "off_market"
  ) {
    offerPosture = "do_not_advance";
  } else if (!financialReady || !offerReadiness || !offerReady) {
    offerPosture = "not_ready";
  } else if (
    strategyConfidence === "low" ||
    !listingKnown ||
    !domKnown ||
    confidenceWeak ||
    listingFreshnessWeak
  ) {
    offerPosture = "verify_before_offering";
  } else if (
    listingStatus === "active" &&
    urgencyLevel === "high" &&
    (strategyConfidence === "high" || strategyConfidence === "medium")
  ) {
    offerPosture = "prepare_competitive_offer";
  } else if (listingStatus === "coming_soon" || (daysOnMarket !== null && daysOnMarket > 30)) {
    offerPosture = "hold_and_monitor";
  } else {
    offerPosture = "prepare_disciplined_offer";
  }

  let concessionStrategy: ConcessionStrategy;
  if (strategyConfidence === "low") {
    concessionStrategy = "defer_until_more_certain";
  } else if (offerPosture === "prepare_competitive_offer") {
    concessionStrategy = "keep_terms_clean";
  } else if (offerPosture === "prepare_disciplined_offer") {
    concessionStrategy = "limit_concession_requests";
  } else {
    concessionStrategy = "case_by_case";
  }

  let recommendedNextOfferAction: RecommendedNextOfferAction;
  if (offerPosture === "do_not_advance") {
    recommendedNextOfferAction = "do_not_advance";
  } else if (!financialReady) {
    recommendedNextOfferAction = "complete_financial_readiness";
  } else if (!offerReadiness || !offerReady) {
    recommendedNextOfferAction = "complete_offer_readiness";
  } else if (offerPosture === "verify_before_offering") {
    recommendedNextOfferAction = "review_market_inputs";
  } else if (offerPosture === "hold_and_monitor") {
    recommendedNextOfferAction = "hold_and_monitor";
  } else if (offerPosture === "prepare_competitive_offer") {
    recommendedNextOfferAction = "draft_competitive_offer";
  } else {
    recommendedNextOfferAction = "draft_disciplined_offer";
  }

  const marketRisks: string[] = [];
  const strategyRationale: string[] = [];

  if (!listingKnown) {
    pushUnique(marketRisks, "Current listing status is unavailable in the stored result.");
  }
  if (!domKnown) {
    pushUnique(marketRisks, "Days on market are unavailable in the stored result.");
  }
  if (limitedComparables) {
    pushUnique(marketRisks, "Comparable homes nearby were limited.");
  }
  if (listingFreshnessWeak) {
    pushUnique(marketRisks, "Listing data freshness is reduced, so market posture is provisional.");
  }
  if (confidenceWeak) {
    pushUnique(marketRisks, "Overall confidence is reduced for this property.");
  }
  if (!financialReady) {
    pushUnique(marketRisks, "Financial readiness is not yet ready for offer advancement.");
  }
  if (offerReadiness?.blockingIssues.length) {
    pushUnique(marketRisks, offerReadiness.blockingIssues[0]);
  }
  if (
    listingStatus === "pending" ||
    listingStatus === "contingent" ||
    listingStatus === "sold" ||
    listingStatus === "off_market"
  ) {
    pushUnique(
      marketRisks,
      `Listing is currently ${listingStatus.replaceAll("_", " ")}, so an offer should not advance.`
    );
  }

  switch (offerPosture) {
    case "do_not_advance":
      pushUnique(strategyRationale, "The listing is no longer in a state that supports offer advancement.");
      break;
    case "not_ready":
      pushUnique(strategyRationale, "Buyer readiness must be completed before drafting an offer.");
      break;
    case "verify_before_offering":
      pushUnique(strategyRationale, "Stored market inputs are incomplete or weak, so the strategy should stay provisional.");
      break;
    case "prepare_competitive_offer":
      pushUnique(strategyRationale, "The home is active, buyer readiness is strong, and the market posture supports moving quickly.");
      break;
    case "hold_and_monitor":
      pushUnique(strategyRationale, "Current listing timing does not justify immediate offer drafting.");
      break;
    default:
      pushUnique(strategyRationale, "Buyer readiness supports moving forward with a disciplined offer posture.");
      break;
  }

  if (recommendedOfferPrice !== null && listPrice !== null) {
    const versusList = classifyVersusList(listPrice, recommendedOfferPrice);
    if (versusList === "above_list") {
      pushUnique(strategyRationale, "The current recommendation sits above list price, which supports a more competitive stance.");
    } else if (versusList === "below_list") {
      pushUnique(strategyRationale, "The current recommendation remains below list price, which supports disciplined drafting.");
    }
  }

  if (daysOnMarket !== null) {
    if (daysOnMarket <= 7) {
      pushUnique(strategyRationale, "The listing is fresh enough that delay may reduce leverage.");
    } else if (daysOnMarket > 30) {
      pushUnique(strategyRationale, "The listing has been on market longer, which weakens urgency.");
    }
  }

  return {
    strategyConfidence,
    offerPosture,
    urgencyLevel,
    concessionStrategy,
    recommendedNextOfferAction,
    pricePosition: {
      listPrice,
      recommendedOfferPrice,
      pricePerSqft,
      medianPricePerSqft,
      versusList: classifyVersusList(listPrice, recommendedOfferPrice),
      versusMarket: classifyVersusMarket(pricePerSqft, medianPricePerSqft)
    },
    marketContext: {
      listingStatus,
      daysOnMarket,
      comparableSampleSize,
      comparableStrategyUsed,
      overallConfidence,
      listingDataSource,
      limitedComparables
    },
    marketRisks: marketRisks.slice(0, 4),
    strategyRationale: strategyRationale.slice(0, 4),
    lastEvaluatedAt:
      offerReadiness?.lastEvaluatedAt ??
      args.financialReadiness?.lastEvaluatedAt ??
      primaryOwner.updatedAt
  };
}

function buildSelectedChoiceConciergeSummary(args: {
  shortlistId: string;
  items: ShortlistItem[];
  financialReadiness: FinancialReadiness | null;
  offerReadiness: OfferReadiness | null;
  offerPreparation: OfferPreparation | null;
  offerSubmission: OfferSubmission | null;
  negotiation: NegotiationRecord | null;
  underContract: UnderContractCoordination | null;
  closingReadiness: ClosingReadiness | null;
  workflowNotifications: WorkflowNotification[];
  workflowActivity?: WorkflowActivityRecord[];
}): SelectedChoiceConciergeSummary {
  const items = args.items.map((item) => normalizeShortlistItemChoice(item));
  const primaryOwner = resolvePrimaryChoiceOwner(items);
  const view = buildSelectedChoiceView(args.shortlistId, items);
  const notifications = activeWorkflowNotifications(args.workflowNotifications);
  const offerStrategy = deriveSelectedChoiceOfferStrategy({
    primaryOwner,
    financialReadiness: args.financialReadiness,
    offerReadiness: args.offerReadiness
  });

  const commandCenter =
    primaryOwner && (args.financialReadiness || args.offerPreparation || args.offerSubmission || args.underContract || args.closingReadiness)
      ? buildBuyerTransactionCommandCenter({
          propertyId: primaryOwner.canonicalPropertyId,
          propertyAddressLabel: primaryOwner.capturedHome.address,
          sessionId: args.financialReadiness?.sessionId ?? null,
          shortlistId: args.shortlistId,
          financialReadiness: args.financialReadiness,
          offerPreparation: args.offerPreparation,
          offerSubmission: args.offerSubmission,
          underContract: args.underContract,
          closingReadiness: args.closingReadiness,
          workflowActivity: args.workflowActivity ?? []
        })
      : null;

  const sourceModule = commandCenter
    ? "transaction_command_center"
    : args.closingReadiness
      ? "closing_readiness"
      : args.underContract
        ? "under_contract"
        : args.offerSubmission
          ? "offer_submission"
          : args.negotiation
            ? "negotiation"
            : args.offerPreparation
              ? "offer_preparation"
              : args.offerReadiness
                ? "offer_readiness"
                : args.financialReadiness
                  ? "financial_readiness"
                  : "selected_choice";

  const blockers = commandCenter
    ? commandCenter.activeBlockers.map((entry) => entry.message)
    : args.closingReadiness
      ? args.closingReadiness.blockers.map((entry) => entry.message)
      : args.underContract
        ? args.underContract.blockers.map((entry) => entry.message)
        : args.offerSubmission
          ? args.offerSubmission.blockers.map((entry) => entry.message)
          : args.offerPreparation
            ? args.offerPreparation.blockers.map((entry) => entry.message)
            : args.financialReadiness
              ? args.financialReadiness.blockers.map((entry) => entry.message)
              : [];

  const topRisks = commandCenter
    ? commandCenter.topRisks.map((entry) => entry.message)
    : args.negotiation
      ? args.negotiation.guidance.flags
      : [
          ...(args.closingReadiness ? [args.closingReadiness.risk] : []),
          ...(args.underContract ? [args.underContract.risk] : []),
          ...(args.offerSubmission ? [args.offerSubmission.risk] : []),
          ...(args.offerPreparation ? [args.offerPreparation.risk] : []),
          ...(args.financialReadiness ? [args.financialReadiness.risk] : []),
          ...(primaryOwner?.decisionRisks ?? [])
        ].filter((entry) => entry.trim().length > 0);

  const nextAction = commandCenter?.nextAction
    ?? args.closingReadiness?.nextAction
    ?? args.underContract?.nextAction
    ?? args.offerSubmission?.nextAction
    ?? args.offerPreparation?.nextAction
    ?? args.offerReadiness?.nextSteps[0]
    ?? args.financialReadiness?.nextAction
    ?? (view.backups[0]
      ? `Select ${view.backups[0].capturedHome.address} as the primary home or choose another shortlist item.`
      : "Select a primary home from the shortlist.");

  const nextSteps = commandCenter?.nextSteps
    ?? args.closingReadiness?.nextSteps
    ?? args.underContract?.nextSteps
    ?? args.offerSubmission?.nextSteps
    ?? args.offerPreparation?.nextSteps
    ?? args.offerReadiness?.nextSteps
    ?? args.financialReadiness?.nextSteps
    ?? (view.backups[0]
      ? [`Review ${view.backups[0].capturedHome.address} as the top backup option.`]
      : ["Pick a shortlisted home to become the selected choice."]);

  const recommendationSummary = commandCenter
    ? `${commandCenter.currentStage.replaceAll("_", " ").toLowerCase()} is the active stage. ${commandCenter.nextAction}`
    : args.closingReadiness?.recommendation
      ?? args.underContract?.recommendation
      ?? args.offerSubmission?.recommendation
      ?? args.offerPreparation?.recommendation
      ?? (args.negotiation ? args.negotiation.guidance.headline : null)
      ?? (args.offerReadiness
        ? `Offer readiness score is ${args.offerReadiness.readinessScore} with a recommended offer of ${args.offerReadiness.recommendedOfferPrice.toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0
          })}.`
        : null)
      ?? args.financialReadiness?.recommendation
      ?? primaryOwner?.decisionRationale
      ?? (primaryOwner
        ? primaryOwner.capturedHome.explainability?.headline ?? primaryOwner.capturedHome.explanation
        : "No selected choice is active yet.");

  const headline = primaryOwner
    ? `${primaryOwner.capturedHome.address} is the current selected-choice track.`
    : view.backups[0]
      ? `No selected choice is active. ${view.backups[0].capturedHome.address} is the top backup.`
      : "No selected choice is active yet.";

  return {
    shortlistId: args.shortlistId,
    selectedItemId: primaryOwner?.id ?? null,
    hasSelectedChoice: Boolean(primaryOwner),
    choiceStatus: primaryOwner?.choiceStatus ?? "none",
    decisionStage: primaryOwner ? deriveDecisionStage(primaryOwner.choiceStatus) : "none",
    property: primaryOwner
      ? {
          shortlistItemId: primaryOwner.id,
          canonicalPropertyId: primaryOwner.canonicalPropertyId,
          address: primaryOwner.capturedHome.address,
          city: primaryOwner.capturedHome.city,
          state: primaryOwner.capturedHome.state,
          price: primaryOwner.capturedHome.price,
          nhaloScore: primaryOwner.capturedHome.scores.nhalo,
          overallConfidence: primaryOwner.capturedHome.scores.overallConfidence,
          capturedHome: clone(primaryOwner.capturedHome)
        }
      : null,
    decision: {
      selectionRank: primaryOwner?.selectionRank ?? null,
      backupCount: view.backups.length,
      decisionConfidence: primaryOwner?.decisionConfidence ?? null,
      decisionRationale: primaryOwner?.decisionRationale ?? null,
      decisionRisks: clone(primaryOwner?.decisionRisks ?? []),
      lastDecisionReviewedAt: primaryOwner?.lastDecisionReviewedAt ?? null,
      selectedAt: primaryOwner?.selectedAt ?? null,
      statusChangedAt: primaryOwner?.statusChangedAt ?? null,
      droppedReason: primaryOwner?.droppedReason ?? null,
      replacedByShortlistItemId: primaryOwner?.replacedByShortlistItemId ?? null
    },
    readiness: {
      financialReadinessId: args.financialReadiness?.id ?? null,
      financialReadinessState: args.financialReadiness?.readinessState ?? null,
      affordabilityClassification: args.financialReadiness?.affordabilityClassification ?? null,
      offerReadinessId: args.offerReadiness?.id ?? null,
      offerReadinessStatus: args.offerReadiness?.status ?? null,
      offerReadinessScore: args.offerReadiness?.readinessScore ?? null,
      recommendedOfferPrice: args.offerReadiness?.recommendedOfferPrice ?? null,
      offerRecommendationConfidence: args.offerReadiness?.confidence ?? null
    },
    workflow: {
      offerPreparationId: args.offerPreparation?.id ?? null,
      offerPreparationState: args.offerPreparation?.offerState ?? null,
      offerSubmissionId: args.offerSubmission?.id ?? null,
      offerSubmissionState: args.offerSubmission?.submissionState ?? null,
      negotiationId: args.negotiation?.id ?? null,
      negotiationStatus: args.negotiation?.status ?? null,
      underContractCoordinationId: args.underContract?.id ?? null,
      underContractState: args.underContract?.overallCoordinationState ?? null,
      closingReadinessId: args.closingReadiness?.id ?? null,
      closingReadinessState: args.closingReadiness?.overallClosingReadinessState ?? null,
      transactionCommandCenter: commandCenter
    },
    alerts: {
      unreadCount: notifications.filter((entry) => entry.status === "UNREAD").length,
      criticalCount: notifications.filter((entry) => entry.severity === "CRITICAL").length,
      warningCount: notifications.filter((entry) => entry.severity === "WARNING").length,
      notifications: clone(notifications)
    },
    offerStrategy,
    concierge: {
      headline,
      recommendationSummary,
      nextAction,
      nextSteps: clone(nextSteps),
      topRisks: [...new Set(topRisks.filter((entry) => entry.trim().length > 0))],
      blockers: [...new Set(blockers.filter((entry) => entry.trim().length > 0))],
      sourceModule,
      lastUpdatedAt:
        commandCenter?.lastUpdatedAt
        ?? args.closingReadiness?.updatedAt
        ?? args.underContract?.updatedAt
        ?? args.offerSubmission?.updatedAt
        ?? args.negotiation?.updatedAt
        ?? args.offerPreparation?.updatedAt
        ?? args.offerReadiness?.updatedAt
        ?? args.financialReadiness?.updatedAt
        ?? primaryOwner?.updatedAt
        ?? null
    }
  };
}

function blockerCodes(value: Array<{ code: string }> | null | undefined): string[] {
  return [...new Set((value ?? []).map((entry) => entry.code))].sort();
}

function stringListDifference(next: string[], previous: string[]): string[] {
  return next.filter((value) => !previous.includes(value));
}

function deadlineEventCategoryFromDueAt(
  dueAt?: string | null,
  now = new Date().toISOString()
): UnifiedActivityEventCategory {
  if (!dueAt) {
    return "DEADLINE_APPROACHING";
  }
  return new Date(dueAt).getTime() <= new Date(now).getTime()
    ? "DEADLINE_MISSED"
    : "DEADLINE_APPROACHING";
}

function buildChangeActivityEntries(input: {
  workflowId?: string | null;
  sessionId?: string | null;
  propertyId?: string | null;
  propertyAddressLabel?: string | null;
  shortlistId?: string | null;
  moduleName: UnifiedActivityModuleName;
  subjectType: string;
  subjectId: string;
  stateLabel: string;
  previousState?: string | null;
  nextState?: string | null;
  previousBlockers?: Array<{ code: string }> | null;
  nextBlockers?: Array<{ code: string }> | null;
  previousRisk?: string | null;
  nextRisk?: string | null;
  previousRecommendation?: string | null;
  nextRecommendation?: string | null;
  previousNextAction?: string | null;
  nextNextAction?: string | null;
  now: string;
  triggerType?: UnifiedActivityTriggerType;
}): Array<Omit<UnifiedActivityRecord, "id">> {
  const entries: Array<Omit<UnifiedActivityRecord, "id">> = [];
  const base = {
    workflowId: input.workflowId ?? null,
    sessionId: input.sessionId ?? null,
    propertyId: input.propertyId ?? null,
    propertyAddressLabel: input.propertyAddressLabel ?? null,
    shortlistId: input.shortlistId ?? null,
    moduleName: input.moduleName,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    actorType: "SYSTEM" as const,
    createdAt: input.now
  };

  if (input.previousState !== undefined && input.previousState !== input.nextState) {
    entries.push({
      ...base,
      eventCategory: "STATE_CHANGED",
      title: `${input.stateLabel} changed`,
      summary: `${input.stateLabel} changed from ${input.previousState ?? "unknown"} to ${input.nextState ?? "unknown"}.`,
      oldValueSnapshot: { state: input.previousState ?? null },
      newValueSnapshot: { state: input.nextState ?? null },
      triggerType: input.triggerType ?? "DERIVED_RECALCULATION",
      triggerLabel: "state_changed"
    });
  }

  const previousBlockerCodes = blockerCodes(input.previousBlockers);
  const nextBlockerCodes = blockerCodes(input.nextBlockers);
  const createdBlockers = stringListDifference(nextBlockerCodes, previousBlockerCodes);
  const resolvedBlockers = stringListDifference(previousBlockerCodes, nextBlockerCodes);

  if (createdBlockers.length > 0) {
    entries.push({
      ...base,
      eventCategory: "BLOCKER_CREATED",
      title: createdBlockers.length === 1 ? "New blocker detected" : "New blockers detected",
      summary: `The system detected ${createdBlockers.length} new blocker${createdBlockers.length === 1 ? "" : "s"}: ${createdBlockers.join(", ")}.`,
      oldValueSnapshot: { blockers: previousBlockerCodes },
      newValueSnapshot: { blockers: nextBlockerCodes },
      triggerType: input.triggerType ?? "SYSTEM_RULE",
      triggerLabel: "blocker_created"
    });
  }

  if (resolvedBlockers.length > 0) {
    entries.push({
      ...base,
      eventCategory: "BLOCKER_RESOLVED",
      title: resolvedBlockers.length === 1 ? "Blocker resolved" : "Blockers resolved",
      summary: `The system cleared ${resolvedBlockers.length} blocker${resolvedBlockers.length === 1 ? "" : "s"}: ${resolvedBlockers.join(", ")}.`,
      oldValueSnapshot: { blockers: previousBlockerCodes },
      newValueSnapshot: { blockers: nextBlockerCodes },
      triggerType: input.triggerType ?? "SYSTEM_RULE",
      triggerLabel: "blocker_resolved"
    });
  }

  if (input.previousRisk !== undefined && input.previousRisk !== input.nextRisk) {
    entries.push({
      ...base,
      eventCategory: "RISK_CHANGED",
      title: "Risk changed",
      summary: `Risk changed from ${input.previousRisk ?? "unknown"} to ${input.nextRisk ?? "unknown"}.`,
      oldValueSnapshot: { risk: input.previousRisk ?? null },
      newValueSnapshot: { risk: input.nextRisk ?? null },
      triggerType: input.triggerType ?? "DERIVED_RECALCULATION",
      triggerLabel: "risk_changed"
    });
  }

  if (
    input.previousRecommendation !== undefined &&
    input.previousRecommendation !== input.nextRecommendation
  ) {
    entries.push({
      ...base,
      eventCategory: "RECOMMENDATION_CHANGED",
      title: "Recommendation changed",
      summary: input.nextRecommendation ?? "The system recommendation changed.",
      oldValueSnapshot: { recommendation: input.previousRecommendation ?? null },
      newValueSnapshot: { recommendation: input.nextRecommendation ?? null },
      triggerType: input.triggerType ?? "DERIVED_RECALCULATION",
      triggerLabel: "recommendation_changed"
    });
  }

  if (input.previousNextAction !== undefined && input.previousNextAction !== input.nextNextAction) {
    entries.push({
      ...base,
      eventCategory: "NEXT_ACTION_CHANGED",
      title: "Next action changed",
      summary: `Your next action is now: ${input.nextNextAction ?? "Review the workflow"}.`,
      oldValueSnapshot: { nextAction: input.previousNextAction ?? null },
      newValueSnapshot: { nextAction: input.nextNextAction ?? null },
      triggerType: input.triggerType ?? "DERIVED_RECALCULATION",
      triggerLabel: "next_action_changed"
    });
  }

  return entries;
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
type StoredFinancialReadiness = FinancialReadiness;
type StoredOfferPreparation = OfferPreparation;
type StoredOfferSubmission = OfferSubmission;
type StoredUnderContractCoordination = UnderContractCoordination;
type StoredClosingReadiness = ClosingReadiness;
type StoredWorkflowNotification = WorkflowNotification;
type StoredWorkflowNotificationHistoryEvent = WorkflowNotificationHistoryEvent;
type StoredUnifiedActivityRecord = UnifiedActivityRecord;
type StoredOfferReadiness = OfferReadiness;
type StoredNegotiationRecord = NegotiationRecord;
type StoredNegotiationEvent = NegotiationEvent;
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
  return clone(normalizeShortlistItemChoice(item));
}

function mapStoredOfferPreparation(record: StoredOfferPreparation): OfferPreparation {
  return clone({
    ...record,
    strategyDefaultsProvenance: record.strategyDefaultsProvenance ?? null
  });
}

function mapStoredOfferSubmission(record: StoredOfferSubmission): OfferSubmission {
  return clone(record);
}

function mapStoredUnderContractCoordination(
  record: StoredUnderContractCoordination
): UnderContractCoordination {
  return clone(record);
}

function mapStoredClosingReadiness(record: StoredClosingReadiness): ClosingReadiness {
  return clone(record);
}

function mapStoredWorkflowNotification(record: StoredWorkflowNotification): WorkflowNotification {
  return clone(record);
}

function mapStoredWorkflowNotificationHistoryEvent(
  record: StoredWorkflowNotificationHistoryEvent
): WorkflowNotificationHistoryEvent {
  return clone(record);
}

function mapStoredOfferReadiness(record: StoredOfferReadiness): OfferReadiness {
  return clone(record);
}

function mapStoredNegotiation(record: StoredNegotiationRecord): NegotiationRecord {
  return clone(record);
}

function mapStoredNegotiationEvent(record: StoredNegotiationEvent): NegotiationEvent {
  return clone(record);
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

function mapStoredFinancialReadiness(record: StoredFinancialReadiness): FinancialReadiness {
  return clone(record);
}

function workflowEventNames(): WorkflowActivityRecord["eventType"][] {
  return [
    "financial_readiness_created",
    "financial_readiness_updated",
    "financial_readiness_status_changed",
    "offer_preparation_created",
    "offer_preparation_updated",
    "offer_preparation_status_changed",
    "offer_submission_created",
    "offer_submission_submitted",
    "offer_submission_countered",
    "offer_submission_accepted",
    "offer_submission_rejected",
    "offer_submission_withdrawn",
    "offer_submission_expired",
    "under_contract_created",
    "under_contract_task_updated",
    "under_contract_milestone_reached",
    "under_contract_blocked",
    "under_contract_ready_for_closing",
    "closing_readiness_created",
    "closing_checklist_updated",
    "closing_milestone_reached",
    "closing_blocked",
    "closing_ready_to_close",
    "closing_completed",
    "shortlist_created",
    "shortlist_updated",
    "shortlist_deleted",
    "shortlist_item_added",
    "shortlist_item_removed",
    "selected_choice_marked",
    "selected_choice_replaced",
    "selected_choice_dropped",
    "selected_choice_backup_reordered",
    "selected_choice_rationale_updated",
    "selected_choice_reviewed",
    "offer_readiness_created",
    "offer_readiness_updated",
    "offer_status_changed",
    "negotiation_started",
    "offer_submitted",
    "counter_received",
    "counter_sent",
    "negotiation_accepted",
    "negotiation_rejected",
    "negotiation_withdrawn",
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
    offerPreparationId:
      (event.payload?.offerPreparationId as string | null | undefined) ?? null,
    offerSubmissionId:
      (event.payload?.offerSubmissionId as string | null | undefined) ?? null,
    underContractId:
      (event.payload?.underContractId as string | null | undefined) ?? null,
    closingReadinessId:
      (event.payload?.closingReadinessId as string | null | undefined) ?? null,
    offerReadinessId: (event.payload?.offerReadinessId as string | null | undefined) ?? null,
    negotiationRecordId:
      (event.payload?.negotiationRecordId as string | null | undefined) ?? null,
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
  public readonly financialReadinessRecords: StoredFinancialReadiness[] = [];
  public readonly offerPreparationRecords: StoredOfferPreparation[] = [];
  public readonly offerSubmissionRecords: StoredOfferSubmission[] = [];
  public readonly underContractRecords: StoredUnderContractCoordination[] = [];
  public readonly closingReadinessRecords: StoredClosingReadiness[] = [];
  public readonly offerReadinessRecords: StoredOfferReadiness[] = [];
  public readonly negotiations: StoredNegotiationRecord[] = [];
  public readonly negotiationEvents: StoredNegotiationEvent[] = [];
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
  public readonly workflowNotifications: StoredWorkflowNotification[] = [];
  public readonly workflowNotificationHistory: StoredWorkflowNotificationHistoryEvent[] = [];
  public readonly unifiedActivityRecords: StoredUnifiedActivityRecord[] = [];

  private pushWorkflowNotificationHistory(
    notificationId: string,
    eventType: WorkflowNotificationHistoryEvent["eventType"],
    previousValue: string | null,
    nextValue: string | null,
    createdAt: string
  ): void {
    this.workflowNotificationHistory.push({
      id: createId("notification-history"),
      notificationId,
      eventType,
      previousValue,
      nextValue,
      createdAt
    });
  }

  private pushUnifiedActivity(
    payload: Omit<UnifiedActivityRecord, "id"> & { id?: string }
  ): StoredUnifiedActivityRecord {
    const record: StoredUnifiedActivityRecord = {
      id: payload.id ?? createId("activity"),
      workflowId: payload.workflowId ?? null,
      sessionId: payload.sessionId ?? null,
      propertyId: payload.propertyId ?? null,
      propertyAddressLabel: payload.propertyAddressLabel ?? null,
      shortlistId: payload.shortlistId ?? null,
      moduleName: payload.moduleName,
      eventCategory: payload.eventCategory,
      subjectType: payload.subjectType,
      subjectId: payload.subjectId,
      title: payload.title,
      summary: payload.summary,
      oldValueSnapshot: payload.oldValueSnapshot ?? null,
      newValueSnapshot: payload.newValueSnapshot ?? null,
      triggerType: payload.triggerType,
      triggerLabel: payload.triggerLabel,
      actorType: payload.actorType,
      actorId: payload.actorId ?? null,
      relatedNotificationId: payload.relatedNotificationId ?? null,
      relatedExplanationId: payload.relatedExplanationId ?? null,
      createdAt: payload.createdAt
    };
    this.unifiedActivityRecords.push(record);
    return record;
  }

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
    this.offerReadinessRecords.splice(
      0,
      this.offerReadinessRecords.length,
      ...this.offerReadinessRecords.filter((entry) => entry.shortlistId !== id)
    );
    this.offerPreparationRecords.splice(
      0,
      this.offerPreparationRecords.length,
      ...this.offerPreparationRecords.filter((entry) => entry.shortlistId !== id)
    );
    this.offerSubmissionRecords.splice(
      0,
      this.offerSubmissionRecords.length,
      ...this.offerSubmissionRecords.filter((entry) => entry.shortlistId !== id)
    );
    this.underContractRecords.splice(
      0,
      this.underContractRecords.length,
      ...this.underContractRecords.filter((entry) => entry.shortlistId !== id)
    );
    this.closingReadinessRecords.splice(
      0,
      this.closingReadinessRecords.length,
      ...this.closingReadinessRecords.filter((entry) => entry.shortlistId !== id)
    );
    const removedNegotiationIds = this.negotiations
      .filter((entry) => entry.shortlistId === id)
      .map((entry) => entry.id);
    this.negotiations.splice(
      0,
      this.negotiations.length,
      ...this.negotiations.filter((entry) => entry.shortlistId !== id)
    );
    this.negotiationEvents.splice(
      0,
      this.negotiationEvents.length,
      ...this.negotiationEvents.filter(
        (entry) => !removedNegotiationIds.includes(entry.negotiationRecordId)
      )
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
      choiceStatus: "candidate",
      selectionRank: null,
      decisionConfidence: null,
      decisionRationale: null,
      decisionRisks: [],
      lastDecisionReviewedAt: null,
      selectedAt: null,
      statusChangedAt: now,
      replacedByShortlistItemId: null,
      droppedReason: null,
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
      .sort(shortlistItemOrder)
      .map((entry) => mapStoredShortlistItem(entry));
  }

  async createFinancialReadiness(payload: {
    sessionId?: string | null;
    partnerId?: string | null;
    annualHouseholdIncome: number | null;
    monthlyDebtPayments: number | null;
    availableCashSavings: number | null;
    creditScoreRange: CreditScoreRange | null;
    desiredHomePrice: number | null;
    purchaseLocation: string | null;
    downPaymentPreferencePercent?: number | null;
    loanType?: LoanType | null;
    preApprovalStatus: PreApprovalStatus | null;
    preApprovalExpiresAt?: string | null;
    proofOfFundsStatus: ProofOfFundsStatus | null;
  }): Promise<FinancialReadiness> {
    const now = new Date().toISOString();
    const evaluation = evaluateFinancialReadiness({
      now,
      sessionId: payload.sessionId ?? null,
      partnerId: payload.partnerId ?? null,
      patch: payload
    });

    const record: FinancialReadiness = {
      id: createId("financial-readiness"),
      ...evaluation,
      createdAt: now,
      updatedAt: now
    };

    this.financialReadinessRecords.push(record);
    this.validationEvents.push({
      id: createId("workflow"),
      eventName: "financial_readiness_created",
      sessionId: record.sessionId ?? null,
      payload: {
        financialReadinessId: record.id,
        readinessState: record.readinessState,
        affordabilityClassification: record.affordabilityClassification
      },
      createdAt: now
    });
    this.pushUnifiedActivity({
      sessionId: record.sessionId ?? null,
      moduleName: "financial_readiness",
      eventCategory: "RECORD_CREATED",
      subjectType: "financial_readiness",
      subjectId: record.id,
      title: "Financial readiness record created",
      summary: `Financial readiness started with state ${record.readinessState.toLowerCase()}.`,
      newValueSnapshot: {
        readinessState: record.readinessState,
        affordabilityClassification: record.affordabilityClassification,
        nextAction: record.nextAction
      },
      triggerType: "USER_ACTION",
      triggerLabel: "financial_readiness_created",
      actorType: "USER",
      createdAt: now
    });
    for (const entry of buildChangeActivityEntries({
      sessionId: record.sessionId ?? null,
      moduleName: "financial_readiness",
      subjectType: "financial_readiness",
      subjectId: record.id,
      stateLabel: "Financial readiness state",
      previousState: null,
      nextState: record.readinessState,
      previousBlockers: [],
      nextBlockers: record.blockers,
      previousRisk: null,
      nextRisk: record.risk,
      previousRecommendation: null,
      nextRecommendation: record.recommendation,
      previousNextAction: null,
      nextNextAction: record.nextAction,
      now,
      triggerType: "DERIVED_RECALCULATION"
    })) {
      this.pushUnifiedActivity(entry);
    }

    return mapStoredFinancialReadiness(record);
  }

  async getFinancialReadiness(id: string): Promise<FinancialReadiness | null> {
    const record = this.financialReadinessRecords.find((entry) => entry.id === id) ?? null;
    return record ? mapStoredFinancialReadiness(record) : null;
  }

  async getLatestFinancialReadiness(sessionId?: string | null): Promise<FinancialReadiness | null> {
    if (!sessionId) {
      return null;
    }

    const record =
      this.financialReadinessRecords
        .filter((entry) => entry.sessionId === sessionId)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;

    return record ? mapStoredFinancialReadiness(record) : null;
  }

  async updateFinancialReadiness(
    id: string,
    patch: {
      annualHouseholdIncome?: number | null;
      monthlyDebtPayments?: number | null;
      availableCashSavings?: number | null;
      creditScoreRange?: CreditScoreRange | null;
      desiredHomePrice?: number | null;
      purchaseLocation?: string | null;
      downPaymentPreferencePercent?: number | null;
      loanType?: LoanType | null;
      preApprovalStatus?: PreApprovalStatus | null;
      preApprovalExpiresAt?: string | null;
      proofOfFundsStatus?: ProofOfFundsStatus | null;
    }
  ): Promise<FinancialReadiness | null> {
    const record = this.financialReadinessRecords.find((entry) => entry.id === id);
    if (!record) {
      return null;
    }

    const now = new Date().toISOString();
    const previousRecord = clone(record);
    const previousState = record.readinessState;
    const evaluation = evaluateFinancialReadiness({
      now,
      current: record,
      patch
    });

    Object.assign(record, evaluation, {
      updatedAt: now
    });

    this.validationEvents.push({
      id: createId("workflow"),
      eventName: "financial_readiness_updated",
      sessionId: record.sessionId ?? null,
      payload: {
        financialReadinessId: record.id,
        readinessState: record.readinessState,
        affordabilityClassification: record.affordabilityClassification
      },
      createdAt: now
    });

    if (previousState !== record.readinessState) {
      this.validationEvents.push({
        id: createId("workflow"),
        eventName: "financial_readiness_status_changed",
        sessionId: record.sessionId ?? null,
        payload: {
          financialReadinessId: record.id,
          fromState: previousState,
          toState: record.readinessState
        },
        createdAt: now
      });
    }
    this.pushUnifiedActivity({
      sessionId: record.sessionId ?? null,
      moduleName: "financial_readiness",
      eventCategory: "RECORD_UPDATED",
      subjectType: "financial_readiness",
      subjectId: record.id,
      title: "Financial readiness updated",
      summary: "Financial readiness details were updated.",
      oldValueSnapshot: {
        readinessState: previousRecord.readinessState,
        affordabilityClassification: previousRecord.affordabilityClassification,
        nextAction: previousRecord.nextAction
      },
      newValueSnapshot: {
        readinessState: record.readinessState,
        affordabilityClassification: record.affordabilityClassification,
        nextAction: record.nextAction
      },
      triggerType: "USER_ACTION",
      triggerLabel: "financial_readiness_updated",
      actorType: "USER",
      createdAt: now
    });
    for (const entry of buildChangeActivityEntries({
      sessionId: record.sessionId ?? null,
      moduleName: "financial_readiness",
      subjectType: "financial_readiness",
      subjectId: record.id,
      stateLabel: "Financial readiness state",
      previousState: previousRecord.readinessState,
      nextState: record.readinessState,
      previousBlockers: previousRecord.blockers,
      nextBlockers: record.blockers,
      previousRisk: previousRecord.risk,
      nextRisk: record.risk,
      previousRecommendation: previousRecord.recommendation,
      nextRecommendation: record.recommendation,
      previousNextAction: previousRecord.nextAction,
      nextNextAction: record.nextAction,
      now,
      triggerType: "DERIVED_RECALCULATION"
    })) {
      this.pushUnifiedActivity(entry);
    }

    return mapStoredFinancialReadiness(record);
  }

  async getFinancialReadinessSummary(id: string): Promise<FinancialReadinessSummary | null> {
    const record = await this.getFinancialReadiness(id);
    return record ? toFinancialReadinessSummary(record) : null;
  }

  async createOfferPreparation(
    payload: OfferPreparationInputs & {
      sessionId?: string | null;
      partnerId?: string | null;
    }
  ): Promise<OfferPreparation | null> {
    const financialReadiness = this.financialReadinessRecords.find(
      (entry) => entry.id === payload.financialReadinessId
    );
    if (!financialReadiness) {
      return null;
    }

    const existing = this.offerPreparationRecords.find(
      (entry) =>
        entry.propertyId === payload.propertyId &&
        (payload.shortlistId ? entry.shortlistId === payload.shortlistId : true)
    );
    if (existing) {
      return mapStoredOfferPreparation(existing);
    }

    const selectedChoiceSummary = payload.shortlistId
      ? await this.getSelectedChoiceSummary(payload.shortlistId)
      : null;
    const activeOfferStrategy =
      selectedChoiceSummary?.property?.canonicalPropertyId === payload.propertyId
        ? selectedChoiceSummary.offerStrategy
        : null;
    const recommendedOfferPrice =
      payload.offerReadinessId
        ? this.offerReadinessRecords.find((entry) => entry.id === payload.offerReadinessId)
            ?.recommendedOfferPrice ?? null
        : this.offerReadinessRecords.find(
            (entry) =>
              entry.propertyId === payload.propertyId &&
              (payload.shortlistId ? entry.shortlistId === payload.shortlistId : true)
          )?.recommendedOfferPrice ?? null;
    const now = new Date().toISOString();
    const strategyApplication = applyOfferPreparationStrategyDefaults({
      payload,
      strategy: activeOfferStrategy,
      selectedItemId: selectedChoiceSummary?.selectedItemId ?? null,
      shortlistId: payload.shortlistId ?? null,
      propertyId: payload.propertyId,
      now
    });
    const evaluation = evaluateOfferPreparation({
      now,
      financialReadiness,
      recommendedOfferPrice,
      sessionId: payload.sessionId ?? financialReadiness.sessionId ?? null,
      partnerId: payload.partnerId ?? financialReadiness.partnerId ?? null,
      patch: strategyApplication.patch
    });

    const record: OfferPreparation = {
      id: createId("offer-preparation"),
      ...evaluation,
      strategyDefaultsProvenance: strategyApplication.provenance,
      createdAt: now,
      updatedAt: now
    };

    this.offerPreparationRecords.push(record);
    this.validationEvents.push({
      id: createId("workflow"),
      eventName: "offer_preparation_created",
      sessionId: record.sessionId ?? null,
      payload: {
        offerPreparationId: record.id,
        propertyId: record.propertyId,
        shortlistId: record.shortlistId ?? null,
        offerState: record.offerState,
        strategyDefaultsAppliedFields: record.strategyDefaultsProvenance?.appliedFieldKeys ?? []
      },
      createdAt: now
    });
    this.pushUnifiedActivity({
      sessionId: record.sessionId ?? null,
      propertyId: record.propertyId,
      propertyAddressLabel: record.propertyAddressLabel,
      shortlistId: record.shortlistId ?? null,
      moduleName: "offer_preparation",
      eventCategory: "RECORD_CREATED",
      subjectType: "offer_preparation",
      subjectId: record.id,
      title: "Offer preparation started",
      summary: `Offer preparation started for ${record.propertyAddressLabel}.`,
      newValueSnapshot: {
        offerState: record.offerState,
        readinessToSubmit: record.readinessToSubmit,
        nextAction: record.nextAction
      },
      triggerType: "USER_ACTION",
      triggerLabel: "offer_preparation_created",
      actorType: "USER",
      createdAt: now
    });
    for (const entry of buildChangeActivityEntries({
      sessionId: record.sessionId ?? null,
      propertyId: record.propertyId,
      propertyAddressLabel: record.propertyAddressLabel,
      shortlistId: record.shortlistId ?? null,
      moduleName: "offer_preparation",
      subjectType: "offer_preparation",
      subjectId: record.id,
      stateLabel: "Offer preparation state",
      previousState: null,
      nextState: record.offerState,
      previousBlockers: [],
      nextBlockers: record.blockers,
      previousRisk: null,
      nextRisk: record.risk,
      previousRecommendation: null,
      nextRecommendation: record.recommendation,
      previousNextAction: null,
      nextNextAction: record.nextAction,
      now,
      triggerType: "DERIVED_RECALCULATION"
    })) {
      this.pushUnifiedActivity(entry);
    }

    return mapStoredOfferPreparation(record);
  }

  async listOfferPreparations(shortlistId: string): Promise<OfferPreparation[]> {
    return this.offerPreparationRecords
      .filter((entry) => entry.shortlistId === shortlistId)
      .map((entry) => mapStoredOfferPreparation(entry));
  }

  async getOfferPreparation(id: string): Promise<OfferPreparation | null> {
    const record = this.offerPreparationRecords.find((entry) => entry.id === id) ?? null;
    return record ? mapStoredOfferPreparation(record) : null;
  }

  async getLatestOfferPreparation(payload: {
    propertyId: string;
    shortlistId?: string | null;
    sessionId?: string | null;
  }): Promise<OfferPreparation | null> {
    const record =
      this.offerPreparationRecords
        .filter(
          (entry) =>
            entry.propertyId === payload.propertyId &&
            (payload.shortlistId ? entry.shortlistId === payload.shortlistId : true) &&
            (payload.sessionId ? entry.sessionId === payload.sessionId : true)
        )
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;

    return record ? mapStoredOfferPreparation(record) : null;
  }

  async updateOfferPreparation(
    id: string,
    patch: {
      propertyAddressLabel?: string;
      offerPrice?: number | null;
      earnestMoneyAmount?: number | null;
      downPaymentType?: OfferPreparationDownPaymentType | null;
      downPaymentAmount?: number | null;
      downPaymentPercent?: number | null;
      financingContingency?: OfferPreparationContingency | null;
      inspectionContingency?: OfferPreparationContingency | null;
      appraisalContingency?: OfferPreparationContingency | null;
      closingTimelineDays?: number | null;
      possessionTiming?: OfferPreparationPossessionTiming | null;
      possessionDaysAfterClosing?: number | null;
      sellerConcessionsRequestedAmount?: number | null;
      notes?: string | null;
      buyerRationale?: string | null;
    }
  ): Promise<OfferPreparation | null> {
    const record = this.offerPreparationRecords.find((entry) => entry.id === id);
    if (!record) {
      return null;
    }

    const financialReadiness =
      this.financialReadinessRecords.find((entry) => entry.id === record.financialReadinessId) ?? null;
    if (!financialReadiness) {
      return null;
    }

    const recommendedOfferPrice =
      record.offerReadinessId
        ? this.offerReadinessRecords.find((entry) => entry.id === record.offerReadinessId)
            ?.recommendedOfferPrice ?? null
        : this.offerReadinessRecords.find(
            (entry) =>
              entry.propertyId === record.propertyId &&
              (record.shortlistId ? entry.shortlistId === record.shortlistId : true)
          )?.recommendedOfferPrice ?? null;
    const now = new Date().toISOString();
    const previousRecord = clone(record);
    const previousState = record.offerState;
    const evaluation = evaluateOfferPreparation({
      now,
      current: record,
      patch,
      financialReadiness,
      recommendedOfferPrice
    });

    Object.assign(record, evaluation, {
      updatedAt: now
    });

    this.validationEvents.push({
      id: createId("workflow"),
      eventName: "offer_preparation_updated",
      sessionId: record.sessionId ?? null,
      payload: {
        offerPreparationId: record.id,
        propertyId: record.propertyId,
        offerState: record.offerState
      },
      createdAt: now
    });

    if (previousState !== record.offerState) {
      this.validationEvents.push({
        id: createId("workflow"),
        eventName: "offer_preparation_status_changed",
        sessionId: record.sessionId ?? null,
        payload: {
          offerPreparationId: record.id,
          propertyId: record.propertyId,
          fromState: previousState,
          toState: record.offerState
        },
        createdAt: now
      });
    }
    this.pushUnifiedActivity({
      sessionId: record.sessionId ?? null,
      propertyId: record.propertyId,
      propertyAddressLabel: record.propertyAddressLabel,
      shortlistId: record.shortlistId ?? null,
      moduleName: "offer_preparation",
      eventCategory: "RECORD_UPDATED",
      subjectType: "offer_preparation",
      subjectId: record.id,
      title: "Offer preparation updated",
      summary: "Offer terms were updated.",
      oldValueSnapshot: {
        offerState: previousRecord.offerState,
        offerPrice: previousRecord.offerPrice,
        nextAction: previousRecord.nextAction
      },
      newValueSnapshot: {
        offerState: record.offerState,
        offerPrice: record.offerPrice,
        nextAction: record.nextAction
      },
      triggerType: "USER_ACTION",
      triggerLabel: "offer_preparation_updated",
      actorType: "USER",
      createdAt: now
    });
    for (const entry of buildChangeActivityEntries({
      sessionId: record.sessionId ?? null,
      propertyId: record.propertyId,
      propertyAddressLabel: record.propertyAddressLabel,
      shortlistId: record.shortlistId ?? null,
      moduleName: "offer_preparation",
      subjectType: "offer_preparation",
      subjectId: record.id,
      stateLabel: "Offer preparation state",
      previousState: previousRecord.offerState,
      nextState: record.offerState,
      previousBlockers: previousRecord.blockers,
      nextBlockers: record.blockers,
      previousRisk: previousRecord.risk,
      nextRisk: record.risk,
      previousRecommendation: previousRecord.recommendation,
      nextRecommendation: record.recommendation,
      previousNextAction: previousRecord.nextAction,
      nextNextAction: record.nextAction,
      now,
      triggerType: "DERIVED_RECALCULATION"
    })) {
      this.pushUnifiedActivity(entry);
    }

    return mapStoredOfferPreparation(record);
  }

  async getOfferPreparationSummary(id: string): Promise<OfferPreparationSummary | null> {
    const record = await this.getOfferPreparation(id);
    return record ? toOfferPreparationSummary(record) : null;
  }

  private syncOfferSubmissionRecord(record: OfferSubmission): OfferSubmission {
    const offerPreparation =
      this.offerPreparationRecords.find((entry) => entry.id === record.offerPreparationId) ?? null;
    if (!offerPreparation) {
      return record;
    }

    const financialReadiness =
      (record.financialReadinessId
        ? this.financialReadinessRecords.find((entry) => entry.id === record.financialReadinessId)
        : null) ?? null;
    const now = new Date().toISOString();
    const previousState = record.submissionState;
    const evaluation = evaluateOfferSubmission({
      now,
      current: record,
      offerPreparation,
      financialReadiness
    });

    Object.assign(record, evaluation, {
      updatedAt: previousState === evaluation.submissionState ? record.updatedAt : now
    });

    if (previousState !== record.submissionState && record.submissionState === "EXPIRED") {
      record.activityLog.push({
        type: "offer_expired",
        label: "Offer expired",
        details: "The response window elapsed without a completed response.",
        createdAt: now
      });
      this.validationEvents.push({
        id: createId("workflow"),
        eventName: "offer_submission_expired",
        sessionId: record.sessionId ?? null,
        payload: {
          shortlistId: record.shortlistId ?? null,
          offerPreparationId: record.offerPreparationId,
          offerSubmissionId: record.id,
          propertyId: record.propertyId,
          fromState: previousState,
          toState: record.submissionState
        },
        createdAt: now
      });
    }

    return record;
  }

  async createOfferSubmission(
    payload: OfferSubmissionInputs & {
      sessionId?: string | null;
      partnerId?: string | null;
    }
  ): Promise<OfferSubmission | null> {
    const offerPreparation =
      this.offerPreparationRecords.find((entry) => entry.id === payload.offerPreparationId) ?? null;
    if (!offerPreparation) {
      return null;
    }

    const existing = this.offerSubmissionRecords.find(
      (entry) =>
        entry.propertyId === payload.propertyId &&
        (payload.shortlistId ? entry.shortlistId === payload.shortlistId : true)
    );
    if (existing) {
      return mapStoredOfferSubmission(this.syncOfferSubmissionRecord(existing));
    }

    const financialReadiness =
      this.financialReadinessRecords.find(
        (entry) => entry.id === (payload.financialReadinessId ?? offerPreparation.financialReadinessId)
      ) ?? null;
    const now = new Date().toISOString();
    const evaluation = evaluateOfferSubmission({
      now,
      offerPreparation,
      financialReadiness,
      sessionId: payload.sessionId ?? offerPreparation.sessionId ?? null,
      partnerId: payload.partnerId ?? offerPreparation.partnerId ?? null,
      patch: payload
    });

    const record: OfferSubmission = {
      id: createId("offer-submission"),
      ...evaluation,
      activityLog: [
        {
          type: "record_created",
          label: "Submission record created",
          details: null,
          createdAt: now
        }
      ],
      createdAt: now,
      updatedAt: now
    };

    this.offerSubmissionRecords.push(record);
    this.validationEvents.push({
      id: createId("workflow"),
      eventName: "offer_submission_created",
      sessionId: record.sessionId ?? null,
      payload: {
        shortlistId: record.shortlistId ?? null,
        offerPreparationId: record.offerPreparationId,
        offerSubmissionId: record.id,
        propertyId: record.propertyId,
        submissionState: record.submissionState
      },
      createdAt: now
    });
    this.pushUnifiedActivity({
      sessionId: record.sessionId ?? null,
      propertyId: record.propertyId,
      propertyAddressLabel: record.propertyAddressLabel,
      shortlistId: record.shortlistId ?? null,
      moduleName: "offer_submission",
      eventCategory: "RECORD_CREATED",
      subjectType: "offer_submission",
      subjectId: record.id,
      title: "Offer submission record created",
      summary: `Offer submission tracking started for ${record.propertyAddressLabel}.`,
      newValueSnapshot: {
        submissionState: record.submissionState,
        sellerResponseState: record.sellerResponseState,
        nextAction: record.nextAction
      },
      triggerType: "USER_ACTION",
      triggerLabel: "offer_submission_created",
      actorType: "USER",
      createdAt: now
    });

    return mapStoredOfferSubmission(record);
  }

  async listOfferSubmissions(shortlistId: string): Promise<OfferSubmission[]> {
    const records = this.offerSubmissionRecords
      .filter((entry) => entry.shortlistId === shortlistId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    for (const record of records) {
      this.syncOfferSubmissionRecord(record);
    }
    return records.map((entry) => mapStoredOfferSubmission(entry));
  }

  async getOfferSubmission(id: string): Promise<OfferSubmission | null> {
    const record = this.offerSubmissionRecords.find((entry) => entry.id === id) ?? null;
    return record ? mapStoredOfferSubmission(this.syncOfferSubmissionRecord(record)) : null;
  }

  async getLatestOfferSubmission(payload: {
    propertyId: string;
    shortlistId?: string | null;
    sessionId?: string | null;
  }): Promise<OfferSubmission | null> {
    const record =
      this.offerSubmissionRecords
        .filter(
          (entry) =>
            entry.propertyId === payload.propertyId &&
            (payload.shortlistId ? entry.shortlistId === payload.shortlistId : true) &&
            (payload.sessionId ? entry.sessionId === payload.sessionId : true)
        )
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;

    return record ? mapStoredOfferSubmission(this.syncOfferSubmissionRecord(record)) : null;
  }

  async submitOfferSubmission(id: string, submittedAt?: string | null): Promise<OfferSubmission | null> {
    const record = this.offerSubmissionRecords.find((entry) => entry.id === id);
    if (!record) {
      return null;
    }

    const offerPreparation =
      this.offerPreparationRecords.find((entry) => entry.id === record.offerPreparationId) ?? null;
    if (!offerPreparation || !offerPreparation.readinessToSubmit) {
      return null;
    }

    const financialReadiness =
      this.financialReadinessRecords.find((entry) => entry.id === record.financialReadinessId) ?? null;
    const now = new Date().toISOString();
    const actualSubmittedAt = submittedAt ?? now;
    const previousState = this.syncOfferSubmissionRecord(record).submissionState;
    const evaluation = evaluateOfferSubmission({
      now,
      current: record,
      offerPreparation,
      financialReadiness,
      patch: {
        submittedAt: actualSubmittedAt,
        sellerResponseState: "NO_RESPONSE"
      }
    });

    Object.assign(record, evaluation, {
      updatedAt: now
    });
    record.activityLog.push({
      type: "offer_submitted",
      label: "Offer submitted",
      details: `Offer submission recorded for ${new Date(actualSubmittedAt).toLocaleString("en-US")}.`,
      createdAt: now
    });
    this.validationEvents.push({
      id: createId("workflow"),
      eventName: "offer_submission_submitted",
      sessionId: record.sessionId ?? null,
      payload: {
        shortlistId: record.shortlistId ?? null,
        offerPreparationId: record.offerPreparationId,
        offerSubmissionId: record.id,
        propertyId: record.propertyId,
        fromState: previousState,
        toState: record.submissionState
      },
      createdAt: now
    });
    this.pushUnifiedActivity({
      sessionId: record.sessionId ?? null,
      propertyId: record.propertyId,
      propertyAddressLabel: record.propertyAddressLabel,
      shortlistId: record.shortlistId ?? null,
      moduleName: "offer_submission",
      eventCategory: "STATE_CHANGED",
      subjectType: "offer_submission",
      subjectId: record.id,
      title: "Offer submitted",
      summary: `The offer was recorded as submitted on ${new Date(actualSubmittedAt).toLocaleString("en-US")}.`,
      oldValueSnapshot: { submissionState: previousState },
      newValueSnapshot: { submissionState: record.submissionState, submittedAt: actualSubmittedAt },
      triggerType: "STATUS_TRANSITION",
      triggerLabel: "offer_submission_submitted",
      actorType: "USER",
      createdAt: now
    });

    return mapStoredOfferSubmission(record);
  }

  async updateOfferSubmission(
    id: string,
    patch: {
      submissionMethod?: OfferSubmissionMethod | null;
      offerExpirationAt?: string | null;
      sellerResponseState?: OfferSubmissionSellerResponseState | null;
      sellerRespondedAt?: string | null;
      buyerCounterDecision?: OfferSubmissionBuyerCounterDecision | null;
      withdrawnAt?: string | null;
      withdrawalReason?: string | null;
      counterofferPrice?: number | null;
      counterofferClosingTimelineDays?: number | null;
      counterofferFinancingContingency?: OfferPreparationContingency | null;
      counterofferInspectionContingency?: OfferPreparationContingency | null;
      counterofferAppraisalContingency?: OfferPreparationContingency | null;
      counterofferExpirationAt?: string | null;
      notes?: string | null;
      internalActivityNote?: string | null;
    }
  ): Promise<OfferSubmission | null> {
    const record = this.offerSubmissionRecords.find((entry) => entry.id === id);
    if (!record) {
      return null;
    }

    const offerPreparation =
      this.offerPreparationRecords.find((entry) => entry.id === record.offerPreparationId) ?? null;
    if (!offerPreparation) {
      return null;
    }

    const financialReadiness =
      this.financialReadinessRecords.find((entry) => entry.id === record.financialReadinessId) ?? null;
    const now = new Date().toISOString();
    const previousRecord = clone(this.syncOfferSubmissionRecord(record));
    const previousState = this.syncOfferSubmissionRecord(record).submissionState;
    const evaluation = evaluateOfferSubmission({
      now,
      current: record,
      offerPreparation,
      financialReadiness,
      patch
    });

    Object.assign(record, evaluation, {
      updatedAt: now
    });

    const eventMap: Partial<Record<OfferSubmission["submissionState"], WorkflowActivityRecord["eventType"]>> = {
      COUNTERED: "offer_submission_countered",
      ACCEPTED: "offer_submission_accepted",
      REJECTED: "offer_submission_rejected",
      WITHDRAWN: "offer_submission_withdrawn",
      EXPIRED: "offer_submission_expired"
    };
    const activityMap: Partial<Record<OfferSubmission["submissionState"], OfferSubmission["activityLog"][number]["type"]>> = {
      COUNTERED: "seller_countered",
      ACCEPTED: "seller_accepted",
      REJECTED: "seller_rejected",
      WITHDRAWN: "buyer_withdrew",
      EXPIRED: "offer_expired"
    };
    const labelMap: Partial<Record<OfferSubmission["submissionState"], string>> = {
      COUNTERED: "Seller countered",
      ACCEPTED: "Seller accepted",
      REJECTED: "Seller rejected",
      WITHDRAWN: "Buyer withdrew offer",
      EXPIRED: "Offer expired"
    };

    if (previousState !== record.submissionState && eventMap[record.submissionState]) {
      record.activityLog.push({
        type: activityMap[record.submissionState]!,
        label: labelMap[record.submissionState]!,
        details: patch.internalActivityNote ?? null,
        createdAt: now
      });
      this.validationEvents.push({
        id: createId("workflow"),
        eventName: eventMap[record.submissionState]!,
        sessionId: record.sessionId ?? null,
        payload: {
          shortlistId: record.shortlistId ?? null,
          offerPreparationId: record.offerPreparationId,
          offerSubmissionId: record.id,
          propertyId: record.propertyId,
          fromState: previousState,
          toState: record.submissionState
        },
        createdAt: now
      });
    } else if (patch.internalActivityNote?.trim()) {
      record.activityLog.push({
        type: "note_added",
        label: "Submission note added",
        details: patch.internalActivityNote.trim(),
        createdAt: now
      });
    }
    this.pushUnifiedActivity({
      sessionId: record.sessionId ?? null,
      propertyId: record.propertyId,
      propertyAddressLabel: record.propertyAddressLabel,
      shortlistId: record.shortlistId ?? null,
      moduleName: "offer_submission",
      eventCategory: "RECORD_UPDATED",
      subjectType: "offer_submission",
      subjectId: record.id,
      title: "Offer submission updated",
      summary: "Offer submission details were updated.",
      oldValueSnapshot: {
        submissionState: previousRecord.submissionState,
        sellerResponseState: previousRecord.sellerResponseState,
        nextAction: previousRecord.nextAction
      },
      newValueSnapshot: {
        submissionState: record.submissionState,
        sellerResponseState: record.sellerResponseState,
        nextAction: record.nextAction
      },
      triggerType: "USER_ACTION",
      triggerLabel: "offer_submission_updated",
      actorType: "USER",
      createdAt: now
    });
    for (const entry of buildChangeActivityEntries({
      sessionId: record.sessionId ?? null,
      propertyId: record.propertyId,
      propertyAddressLabel: record.propertyAddressLabel,
      shortlistId: record.shortlistId ?? null,
      moduleName: "offer_submission",
      subjectType: "offer_submission",
      subjectId: record.id,
      stateLabel: "Offer submission state",
      previousState: previousRecord.submissionState,
      nextState: record.submissionState,
      previousBlockers: previousRecord.blockers,
      nextBlockers: record.blockers,
      previousRisk: previousRecord.risk,
      nextRisk: record.risk,
      previousRecommendation: previousRecord.recommendation,
      nextRecommendation: record.recommendation,
      previousNextAction: previousRecord.nextAction,
      nextNextAction: record.nextAction,
      now,
      triggerType: "DERIVED_RECALCULATION"
    })) {
      this.pushUnifiedActivity(entry);
    }

    return mapStoredOfferSubmission(record);
  }

  async respondToOfferSubmissionCounter(
    id: string,
    decision: OfferSubmissionBuyerCounterDecision
  ): Promise<OfferSubmission | null> {
    const record = this.offerSubmissionRecords.find((entry) => entry.id === id);
    if (!record) {
      return null;
    }

    const offerPreparation =
      this.offerPreparationRecords.find((entry) => entry.id === record.offerPreparationId) ?? null;
    if (!offerPreparation || record.sellerResponseState !== "COUNTERED") {
      return null;
    }

    const financialReadiness =
      this.financialReadinessRecords.find((entry) => entry.id === record.financialReadinessId) ?? null;
    const now = new Date().toISOString();
    const previousState = this.syncOfferSubmissionRecord(record).submissionState;
    const evaluation = evaluateOfferSubmission({
      now,
      current: record,
      offerPreparation,
      financialReadiness,
      patch: {
        buyerCounterDecision: decision
      }
    });

    Object.assign(record, evaluation, {
      updatedAt: now
    });
    record.activityLog.push({
      type: decision === "accepted" ? "buyer_accepted_counter" : "buyer_rejected_counter",
      label: decision === "accepted" ? "Buyer accepted counteroffer" : "Buyer rejected counteroffer",
      details: null,
      createdAt: now
    });

    const eventName =
      record.submissionState === "ACCEPTED"
        ? "offer_submission_accepted"
        : record.submissionState === "REJECTED"
          ? "offer_submission_rejected"
          : null;
    if (eventName) {
      this.validationEvents.push({
        id: createId("workflow"),
        eventName,
        sessionId: record.sessionId ?? null,
        payload: {
          shortlistId: record.shortlistId ?? null,
          offerPreparationId: record.offerPreparationId,
          offerSubmissionId: record.id,
          propertyId: record.propertyId,
          fromState: previousState,
          toState: record.submissionState
        },
        createdAt: now
      });
    }

    return mapStoredOfferSubmission(record);
  }

  async getOfferSubmissionSummary(id: string): Promise<OfferSubmissionSummary | null> {
    const record = await this.getOfferSubmission(id);
    return record ? toOfferSubmissionSummary(record) : null;
  }

  private syncUnderContractRecord(record: UnderContractCoordination): UnderContractCoordination {
    const offerSubmission =
      this.offerSubmissionRecords.find((entry) => entry.id === record.offerSubmissionId) ?? null;
    if (!offerSubmission) {
      return record;
    }

    const offerPreparation =
      (record.offerPreparationId
        ? this.offerPreparationRecords.find((entry) => entry.id === record.offerPreparationId)
        : this.offerPreparationRecords.find((entry) => entry.id === offerSubmission.offerPreparationId)) ?? null;
    const financialReadiness =
      (record.financialReadinessId
        ? this.financialReadinessRecords.find((entry) => entry.id === record.financialReadinessId)
        : offerSubmission.financialReadinessId
          ? this.financialReadinessRecords.find((entry) => entry.id === offerSubmission.financialReadinessId)
          : null) ?? null;
    const now = new Date().toISOString();
    const previousState = record.overallCoordinationState;
    const evaluation = evaluateUnderContractCoordination({
      now,
      current: record,
      offerSubmission,
      offerPreparation,
      financialReadiness
    });

    Object.assign(record, evaluation, {
      id: record.id,
      updatedAt: previousState === evaluation.overallCoordinationState ? record.updatedAt : now
    });

    if (previousState !== record.overallCoordinationState) {
      const eventName =
        record.overallCoordinationState === "READY_FOR_CLOSING"
          ? "under_contract_ready_for_closing"
          : record.overallCoordinationState === "BLOCKED"
            ? "under_contract_blocked"
            : null;
      if (eventName) {
        this.validationEvents.push({
          id: createId("workflow"),
          eventName,
          sessionId: record.sessionId ?? null,
          payload: {
            shortlistId: record.shortlistId ?? null,
            offerPreparationId: record.offerPreparationId ?? null,
            offerSubmissionId: record.offerSubmissionId,
            underContractId: record.id,
            propertyId: record.propertyId,
            fromState: previousState,
            toState: record.overallCoordinationState
          },
          createdAt: now
        });
      }
    }

    return record;
  }

  async createUnderContractCoordination(
    payload: UnderContractCoordinationInputs & {
      sessionId?: string | null;
      partnerId?: string | null;
    }
  ): Promise<UnderContractCoordination | null> {
    const offerSubmission =
      this.offerSubmissionRecords.find((entry) => entry.id === payload.offerSubmissionId) ?? null;
    if (!offerSubmission || offerSubmission.submissionState !== "ACCEPTED") {
      return null;
    }

    const existing = this.underContractRecords.find(
      (entry) =>
        entry.propertyId === payload.propertyId &&
        (payload.shortlistId ? entry.shortlistId === payload.shortlistId : true)
    );
    if (existing) {
      return mapStoredUnderContractCoordination(this.syncUnderContractRecord(existing));
    }

    const offerPreparation =
      this.offerPreparationRecords.find((entry) => entry.id === offerSubmission.offerPreparationId) ?? null;
    const financialReadiness =
      (payload.financialReadinessId
        ? this.financialReadinessRecords.find((entry) => entry.id === payload.financialReadinessId)
        : offerSubmission.financialReadinessId
          ? this.financialReadinessRecords.find((entry) => entry.id === offerSubmission.financialReadinessId)
          : null) ?? null;

    const now = new Date().toISOString();
    const evaluation = evaluateUnderContractCoordination({
      now,
      offerSubmission,
      offerPreparation,
      financialReadiness,
      sessionId: payload.sessionId ?? offerSubmission.sessionId ?? null,
      partnerId: payload.partnerId ?? offerSubmission.partnerId ?? null,
      patch: payload
    });

    const record: UnderContractCoordination = {
      ...evaluation,
      id: createId("under-contract"),
      activityLog: [
        {
          type: "record_created",
          label: "Under-contract workflow created",
          details: null,
          createdAt: now
        }
      ],
      createdAt: now,
      updatedAt: now
    };

    this.underContractRecords.push(record);
    this.validationEvents.push({
      id: createId("workflow"),
      eventName: "under_contract_created",
      sessionId: record.sessionId ?? null,
      payload: {
        shortlistId: record.shortlistId ?? null,
        offerPreparationId: record.offerPreparationId ?? null,
        offerSubmissionId: record.offerSubmissionId,
        underContractId: record.id,
        propertyId: record.propertyId,
        coordinationState: record.overallCoordinationState
      },
      createdAt: now
    });
    this.pushUnifiedActivity({
      sessionId: record.sessionId ?? null,
      propertyId: record.propertyId,
      propertyAddressLabel: record.propertyAddressLabel,
      shortlistId: record.shortlistId ?? null,
      moduleName: "under_contract",
      eventCategory: "RECORD_CREATED",
      subjectType: "under_contract",
      subjectId: record.id,
      title: "Under-contract coordination started",
      summary: `Under-contract coordination started for ${record.propertyAddressLabel}.`,
      newValueSnapshot: {
        overallCoordinationState: record.overallCoordinationState,
        nextAction: record.nextAction
      },
      triggerType: "USER_ACTION",
      triggerLabel: "under_contract_created",
      actorType: "USER",
      createdAt: now
    });

    return mapStoredUnderContractCoordination(record);
  }

  async listUnderContractCoordinations(shortlistId: string): Promise<UnderContractCoordination[]> {
    const records = this.underContractRecords
      .filter((entry) => entry.shortlistId === shortlistId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    for (const record of records) {
      this.syncUnderContractRecord(record);
    }
    return records.map((entry) => mapStoredUnderContractCoordination(entry));
  }

  async getUnderContractCoordination(id: string): Promise<UnderContractCoordination | null> {
    const record = this.underContractRecords.find((entry) => entry.id === id) ?? null;
    return record ? mapStoredUnderContractCoordination(this.syncUnderContractRecord(record)) : null;
  }

  async getLatestUnderContractCoordination(payload: {
    propertyId: string;
    shortlistId?: string | null;
    sessionId?: string | null;
  }): Promise<UnderContractCoordination | null> {
    const record =
      this.underContractRecords
        .filter(
          (entry) =>
            entry.propertyId === payload.propertyId &&
            (payload.shortlistId ? entry.shortlistId === payload.shortlistId : true) &&
            (payload.sessionId ? entry.sessionId === payload.sessionId : true)
        )
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
    return record ? mapStoredUnderContractCoordination(this.syncUnderContractRecord(record)) : null;
  }

  async updateUnderContractCoordination(
    id: string,
    patch: {
      targetClosingDate?: string | null;
      inspectionDeadline?: string | null;
      appraisalDeadline?: string | null;
      financingDeadline?: string | null;
      contingencyDeadline?: string | null;
      closingPreparationDeadline?: string | null;
      notes?: string | null;
      internalActivityNote?: string | null;
    }
  ): Promise<UnderContractCoordination | null> {
    const record = this.underContractRecords.find((entry) => entry.id === id);
    if (!record) {
      return null;
    }

    const offerSubmission =
      this.offerSubmissionRecords.find((entry) => entry.id === record.offerSubmissionId) ?? null;
    if (!offerSubmission) {
      return null;
    }

    const offerPreparation =
      (record.offerPreparationId
        ? this.offerPreparationRecords.find((entry) => entry.id === record.offerPreparationId)
        : this.offerPreparationRecords.find((entry) => entry.id === offerSubmission.offerPreparationId)) ?? null;
    const financialReadiness =
      (record.financialReadinessId
        ? this.financialReadinessRecords.find((entry) => entry.id === record.financialReadinessId)
        : null) ?? null;

    const now = new Date().toISOString();
    const previousRecord = clone(this.syncUnderContractRecord(record));
    const previousState = previousRecord.overallCoordinationState;
    const evaluation = evaluateUnderContractCoordination({
      now,
      current: record,
      offerSubmission,
      offerPreparation,
      financialReadiness,
      patch
    });

    Object.assign(record, evaluation, {
      id: record.id,
      updatedAt: now
    });

    if (patch.internalActivityNote?.trim()) {
      record.activityLog.push({
        type: "note_added",
        label: "Contract note added",
        details: patch.internalActivityNote.trim(),
        createdAt: now
      });
    }

    if (previousState !== record.overallCoordinationState) {
      const eventName =
        record.overallCoordinationState === "READY_FOR_CLOSING"
          ? "under_contract_ready_for_closing"
          : record.overallCoordinationState === "BLOCKED"
            ? "under_contract_blocked"
            : null;
      if (eventName) {
        this.validationEvents.push({
          id: createId("workflow"),
          eventName,
          sessionId: record.sessionId ?? null,
          payload: {
            shortlistId: record.shortlistId ?? null,
            offerPreparationId: record.offerPreparationId ?? null,
            offerSubmissionId: record.offerSubmissionId,
            underContractId: record.id,
            propertyId: record.propertyId,
            fromState: previousState,
            toState: record.overallCoordinationState
          },
          createdAt: now
        });
      }
    }
    this.pushUnifiedActivity({
      sessionId: record.sessionId ?? null,
      propertyId: record.propertyId,
      propertyAddressLabel: record.propertyAddressLabel,
      shortlistId: record.shortlistId ?? null,
      moduleName: "under_contract",
      eventCategory: "RECORD_UPDATED",
      subjectType: "under_contract",
      subjectId: record.id,
      title: "Under-contract coordination updated",
      summary: "Contract coordination details were updated.",
      oldValueSnapshot: {
        overallCoordinationState: previousRecord.overallCoordinationState,
        nextAction: previousRecord.nextAction
      },
      newValueSnapshot: {
        overallCoordinationState: record.overallCoordinationState,
        nextAction: record.nextAction
      },
      triggerType: "USER_ACTION",
      triggerLabel: "under_contract_updated",
      actorType: "USER",
      createdAt: now
    });
    for (const entry of buildChangeActivityEntries({
      sessionId: record.sessionId ?? null,
      propertyId: record.propertyId,
      propertyAddressLabel: record.propertyAddressLabel,
      shortlistId: record.shortlistId ?? null,
      moduleName: "under_contract",
      subjectType: "under_contract",
      subjectId: record.id,
      stateLabel: "Under-contract state",
      previousState: previousRecord.overallCoordinationState,
      nextState: record.overallCoordinationState,
      previousBlockers: previousRecord.blockers,
      nextBlockers: record.blockers,
      previousRisk: previousRecord.risk,
      nextRisk: record.risk,
      previousRecommendation: previousRecord.recommendation,
      nextRecommendation: record.recommendation,
      previousNextAction: previousRecord.nextAction,
      nextNextAction: record.nextAction,
      now,
      triggerType: "DERIVED_RECALCULATION"
    })) {
      this.pushUnifiedActivity(entry);
    }

    return mapStoredUnderContractCoordination(record);
  }

  async updateUnderContractTask(
    id: string,
    taskType: ContractTaskType,
    patch: {
      status?: ContractTaskState;
      deadline?: string | null;
      scheduledAt?: string | null;
      completedAt?: string | null;
      blockedReason?: string | null;
      notes?: string | null;
    }
  ): Promise<UnderContractCoordination | null> {
    const record = this.underContractRecords.find((entry) => entry.id === id);
    if (!record) {
      return null;
    }

    const task = record.taskSummaries.find((entry) => entry.taskType === taskType);
    if (!task) {
      return null;
    }

    if (patch.status) {
      task.status = patch.status;
    }
    if (patch.deadline !== undefined) {
      task.deadline = patch.deadline;
    }
    if (patch.scheduledAt !== undefined) {
      task.scheduledAt = patch.scheduledAt;
    }
    if (patch.completedAt !== undefined) {
      task.completedAt = patch.completedAt;
    }
    if (patch.blockedReason !== undefined) {
      task.blockedReason = patch.blockedReason;
    }
    if (patch.notes !== undefined) {
      task.notes = patch.notes;
    }

    const offerSubmission =
      this.offerSubmissionRecords.find((entry) => entry.id === record.offerSubmissionId) ?? null;
    if (!offerSubmission) {
      return null;
    }

    const offerPreparation =
      (record.offerPreparationId
        ? this.offerPreparationRecords.find((entry) => entry.id === record.offerPreparationId)
        : this.offerPreparationRecords.find((entry) => entry.id === offerSubmission.offerPreparationId)) ?? null;
    const financialReadiness =
      (record.financialReadinessId
        ? this.financialReadinessRecords.find((entry) => entry.id === record.financialReadinessId)
        : null) ?? null;
    const now = new Date().toISOString();
    const previousState = this.syncUnderContractRecord(record).overallCoordinationState;
    const evaluation = evaluateUnderContractCoordination({
      now,
      current: record,
      offerSubmission,
      offerPreparation,
      financialReadiness
    });
    Object.assign(record, evaluation, {
      id: record.id,
      updatedAt: now,
      lastActionAt: now
    });
    record.activityLog.push({
      type: "task_updated",
      label: `${task.label} updated`,
      details: patch.notes ?? patch.blockedReason ?? null,
      createdAt: now
    });
    this.validationEvents.push({
      id: createId("workflow"),
      eventName: "under_contract_task_updated",
      sessionId: record.sessionId ?? null,
      payload: {
        shortlistId: record.shortlistId ?? null,
        offerPreparationId: record.offerPreparationId ?? null,
        offerSubmissionId: record.offerSubmissionId,
        underContractId: record.id,
        propertyId: record.propertyId,
        taskType,
        status: task.status,
        fromState: previousState,
        toState: record.overallCoordinationState
      },
      createdAt: now
    });
    this.pushUnifiedActivity({
      sessionId: record.sessionId ?? null,
      propertyId: record.propertyId,
      propertyAddressLabel: record.propertyAddressLabel,
      shortlistId: record.shortlistId ?? null,
      moduleName: "under_contract",
      eventCategory: "RECORD_UPDATED",
      subjectType: "under_contract",
      subjectId: record.id,
      title: `${task.label} updated`,
      summary: patch.notes ?? patch.blockedReason ?? `Task status is now ${task.status.toLowerCase()}.`,
      newValueSnapshot: {
        taskType,
        status: task.status
      },
      triggerType: "USER_ACTION",
      triggerLabel: "under_contract_task_updated",
      actorType: "USER",
      createdAt: now
    });
    return mapStoredUnderContractCoordination(record);
  }

  async updateUnderContractMilestone(
    id: string,
    milestoneType: CoordinationMilestoneType,
    patch: {
      status?: "PENDING" | "REACHED" | "BLOCKED";
      occurredAt?: string | null;
      notes?: string | null;
    }
  ): Promise<UnderContractCoordination | null> {
    const record = this.underContractRecords.find((entry) => entry.id === id);
    if (!record) {
      return null;
    }

    const milestone = record.milestoneSummaries.find((entry) => entry.milestoneType === milestoneType);
    if (!milestone) {
      return null;
    }

    if (patch.status) {
      milestone.status = patch.status;
    }
    if (patch.occurredAt !== undefined) {
      milestone.occurredAt = patch.occurredAt;
    }
    if (patch.notes !== undefined) {
      milestone.notes = patch.notes;
    }

    const offerSubmission =
      this.offerSubmissionRecords.find((entry) => entry.id === record.offerSubmissionId) ?? null;
    if (!offerSubmission) {
      return null;
    }

    const offerPreparation =
      (record.offerPreparationId
        ? this.offerPreparationRecords.find((entry) => entry.id === record.offerPreparationId)
        : this.offerPreparationRecords.find((entry) => entry.id === offerSubmission.offerPreparationId)) ?? null;
    const financialReadiness =
      (record.financialReadinessId
        ? this.financialReadinessRecords.find((entry) => entry.id === record.financialReadinessId)
        : null) ?? null;
    const now = new Date().toISOString();
    const previousState = this.syncUnderContractRecord(record).overallCoordinationState;
    const evaluation = evaluateUnderContractCoordination({
      now,
      current: record,
      offerSubmission,
      offerPreparation,
      financialReadiness
    });
    Object.assign(record, evaluation, {
      id: record.id,
      updatedAt: now,
      lastActionAt: now
    });
    record.activityLog.push({
      type: "milestone_reached",
      label: `${milestone.label} updated`,
      details: patch.notes ?? null,
      createdAt: now
    });
    this.validationEvents.push({
      id: createId("workflow"),
      eventName: "under_contract_milestone_reached",
      sessionId: record.sessionId ?? null,
      payload: {
        shortlistId: record.shortlistId ?? null,
        offerPreparationId: record.offerPreparationId ?? null,
        offerSubmissionId: record.offerSubmissionId,
        underContractId: record.id,
        propertyId: record.propertyId,
        milestoneType,
        status: milestone.status,
        fromState: previousState,
        toState: record.overallCoordinationState
      },
      createdAt: now
    });
    this.pushUnifiedActivity({
      sessionId: record.sessionId ?? null,
      propertyId: record.propertyId,
      propertyAddressLabel: record.propertyAddressLabel,
      shortlistId: record.shortlistId ?? null,
      moduleName: "under_contract",
      eventCategory: "MILESTONE_REACHED",
      subjectType: "under_contract",
      subjectId: record.id,
      title: `${milestone.label} updated`,
      summary: patch.notes ?? `Milestone status is now ${milestone.status.toLowerCase()}.`,
      newValueSnapshot: {
        milestoneType,
        status: milestone.status
      },
      triggerType: "STATUS_TRANSITION",
      triggerLabel: "under_contract_milestone_reached",
      actorType: "USER",
      createdAt: now
    });
    return mapStoredUnderContractCoordination(record);
  }

  async getUnderContractCoordinationSummary(id: string): Promise<UnderContractCoordinationSummary | null> {
    const record = await this.getUnderContractCoordination(id);
    return record ? toUnderContractCoordinationSummary(record) : null;
  }

  private syncClosingReadinessRecord(record: ClosingReadiness): ClosingReadiness {
    const underContract =
      this.underContractRecords.find((entry) => entry.id === record.underContractCoordinationId) ?? null;
    if (!underContract) {
      return record;
    }

    const syncedUnderContract = this.syncUnderContractRecord(underContract);
    const offerSubmission =
      (record.offerSubmissionId
        ? this.offerSubmissionRecords.find((entry) => entry.id === record.offerSubmissionId)
        : this.offerSubmissionRecords.find((entry) => entry.id === syncedUnderContract.offerSubmissionId)) ?? null;
    const offerPreparation =
      (record.offerPreparationId
        ? this.offerPreparationRecords.find((entry) => entry.id === record.offerPreparationId)
        : syncedUnderContract.offerPreparationId
          ? this.offerPreparationRecords.find((entry) => entry.id === syncedUnderContract.offerPreparationId)
          : null) ?? null;
    const financialReadiness =
      (record.financialReadinessId
        ? this.financialReadinessRecords.find((entry) => entry.id === record.financialReadinessId)
        : syncedUnderContract.financialReadinessId
          ? this.financialReadinessRecords.find((entry) => entry.id === syncedUnderContract.financialReadinessId)
          : null) ?? null;
    const now = new Date().toISOString();
    const previousState = record.overallClosingReadinessState;
    const evaluation = evaluateClosingReadiness({
      now,
      current: record,
      underContract: syncedUnderContract,
      offerSubmission,
      offerPreparation,
      financialReadiness
    });

    Object.assign(record, evaluation, {
      id: record.id,
      updatedAt: previousState === evaluation.overallClosingReadinessState ? record.updatedAt : now
    });

    if (previousState !== record.overallClosingReadinessState) {
      let eventName: WorkflowActivityRecord["eventType"] | null = null;
      if (record.overallClosingReadinessState === "READY_TO_CLOSE") {
        eventName = "closing_ready_to_close";
      } else if (record.overallClosingReadinessState === "BLOCKED") {
        eventName = "closing_blocked";
      } else if (record.overallClosingReadinessState === "CLOSED") {
        eventName = "closing_completed";
      }
      if (eventName) {
        this.validationEvents.push({
          id: createId("workflow"),
          eventName,
          sessionId: record.sessionId ?? null,
          payload: {
            shortlistId: record.shortlistId ?? null,
            offerPreparationId: record.offerPreparationId ?? null,
            offerSubmissionId: record.offerSubmissionId ?? null,
            underContractId: record.underContractCoordinationId,
            closingReadinessId: record.id,
            propertyId: record.propertyId,
            fromState: previousState,
            toState: record.overallClosingReadinessState
          },
          createdAt: now
        });
      }
    }

    return record;
  }

  async createClosingReadiness(
    payload: ClosingReadinessInputs & {
      sessionId?: string | null;
      partnerId?: string | null;
    }
  ): Promise<ClosingReadiness | null> {
    const underContract =
      this.underContractRecords.find((entry) => entry.id === payload.underContractCoordinationId) ?? null;
    if (!underContract) {
      return null;
    }

    const syncedUnderContract = this.syncUnderContractRecord(underContract);
    if (syncedUnderContract.overallCoordinationState !== "READY_FOR_CLOSING" || !syncedUnderContract.readyForClosing) {
      return null;
    }

    const existing = this.closingReadinessRecords.find(
      (entry) =>
        entry.propertyId === payload.propertyId &&
        (payload.shortlistId ? entry.shortlistId === payload.shortlistId : true)
    );
    if (existing) {
      return mapStoredClosingReadiness(this.syncClosingReadinessRecord(existing));
    }

    const offerSubmission =
      (payload.offerSubmissionId
        ? this.offerSubmissionRecords.find((entry) => entry.id === payload.offerSubmissionId)
        : this.offerSubmissionRecords.find((entry) => entry.id === syncedUnderContract.offerSubmissionId)) ?? null;
    const offerPreparation =
      (payload.offerPreparationId
        ? this.offerPreparationRecords.find((entry) => entry.id === payload.offerPreparationId)
        : syncedUnderContract.offerPreparationId
          ? this.offerPreparationRecords.find((entry) => entry.id === syncedUnderContract.offerPreparationId)
          : null) ?? null;
    const financialReadiness =
      (payload.financialReadinessId
        ? this.financialReadinessRecords.find((entry) => entry.id === payload.financialReadinessId)
        : syncedUnderContract.financialReadinessId
          ? this.financialReadinessRecords.find((entry) => entry.id === syncedUnderContract.financialReadinessId)
          : null) ?? null;

    const now = new Date().toISOString();
    const evaluation = evaluateClosingReadiness({
      now,
      underContract: syncedUnderContract,
      offerSubmission,
      offerPreparation,
      financialReadiness,
      sessionId: payload.sessionId ?? syncedUnderContract.sessionId ?? null,
      partnerId: payload.partnerId ?? syncedUnderContract.partnerId ?? null,
      patch: payload
    });

    const record: ClosingReadiness = {
      ...evaluation,
      id: createId("closing-readiness"),
      activityLog: [
        {
          type: "record_created",
          label: "Closing readiness started",
          details: null,
          createdAt: now
        }
      ],
      createdAt: now,
      updatedAt: now
    };

    this.closingReadinessRecords.push(record);
    this.validationEvents.push({
      id: createId("workflow"),
      eventName: "closing_readiness_created",
      sessionId: record.sessionId ?? null,
      payload: {
        shortlistId: record.shortlistId ?? null,
        offerPreparationId: record.offerPreparationId ?? null,
        offerSubmissionId: record.offerSubmissionId ?? null,
        underContractId: record.underContractCoordinationId,
        closingReadinessId: record.id,
        propertyId: record.propertyId,
        closingState: record.overallClosingReadinessState
      },
      createdAt: now
    });
    this.pushUnifiedActivity({
      sessionId: record.sessionId ?? null,
      propertyId: record.propertyId,
      propertyAddressLabel: record.propertyAddressLabel,
      shortlistId: record.shortlistId ?? null,
      moduleName: "closing_readiness",
      eventCategory: "RECORD_CREATED",
      subjectType: "closing_readiness",
      subjectId: record.id,
      title: "Closing readiness started",
      summary: `Closing readiness started for ${record.propertyAddressLabel}.`,
      newValueSnapshot: {
        overallClosingReadinessState: record.overallClosingReadinessState,
        nextAction: record.nextAction
      },
      triggerType: "USER_ACTION",
      triggerLabel: "closing_readiness_created",
      actorType: "USER",
      createdAt: now
    });

    return mapStoredClosingReadiness(record);
  }

  async listClosingReadiness(shortlistId: string): Promise<ClosingReadiness[]> {
    const records = this.closingReadinessRecords
      .filter((entry) => entry.shortlistId === shortlistId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    for (const record of records) {
      this.syncClosingReadinessRecord(record);
    }
    return records.map((entry) => mapStoredClosingReadiness(entry));
  }

  async getClosingReadiness(id: string): Promise<ClosingReadiness | null> {
    const record = this.closingReadinessRecords.find((entry) => entry.id === id) ?? null;
    return record ? mapStoredClosingReadiness(this.syncClosingReadinessRecord(record)) : null;
  }

  async getLatestClosingReadiness(payload: {
    propertyId: string;
    shortlistId?: string | null;
    sessionId?: string | null;
  }): Promise<ClosingReadiness | null> {
    const record =
      this.closingReadinessRecords
        .filter(
          (entry) =>
            entry.propertyId === payload.propertyId &&
            (payload.shortlistId ? entry.shortlistId === payload.shortlistId : true) &&
            (payload.sessionId ? entry.sessionId === payload.sessionId : true)
        )
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
    return record ? mapStoredClosingReadiness(this.syncClosingReadinessRecord(record)) : null;
  }

  async updateClosingReadiness(
    id: string,
    patch: {
      targetClosingDate?: string | null;
      closingAppointmentAt?: string | null;
      closingAppointmentLocation?: string | null;
      closingAppointmentNotes?: string | null;
      finalReviewDeadline?: string | null;
      finalFundsConfirmationDeadline?: string | null;
      finalFundsAmountConfirmed?: number | null;
      notes?: string | null;
      internalActivityNote?: string | null;
    }
  ): Promise<ClosingReadiness | null> {
    const record = this.closingReadinessRecords.find((entry) => entry.id === id);
    if (!record) {
      return null;
    }

    const underContract =
      this.underContractRecords.find((entry) => entry.id === record.underContractCoordinationId) ?? null;
    if (!underContract) {
      return null;
    }
    const syncedUnderContract = this.syncUnderContractRecord(underContract);
    const offerSubmission =
      (record.offerSubmissionId
        ? this.offerSubmissionRecords.find((entry) => entry.id === record.offerSubmissionId)
        : null) ?? null;
    const offerPreparation =
      (record.offerPreparationId
        ? this.offerPreparationRecords.find((entry) => entry.id === record.offerPreparationId)
        : null) ?? null;
    const financialReadiness =
      (record.financialReadinessId
        ? this.financialReadinessRecords.find((entry) => entry.id === record.financialReadinessId)
        : null) ?? null;

    const now = new Date().toISOString();
    const previousRecord = clone(record);
    const evaluation = evaluateClosingReadiness({
      now,
      current: record,
      underContract: syncedUnderContract,
      offerSubmission,
      offerPreparation,
      financialReadiness,
      patch
    });

    Object.assign(record, evaluation, {
      id: record.id,
      updatedAt: now
    });

    if (patch.internalActivityNote?.trim()) {
      record.activityLog.push({
        type: "note_added",
        label: "Closing note added",
        details: patch.internalActivityNote.trim(),
        createdAt: now
      });
    }
    this.pushUnifiedActivity({
      sessionId: record.sessionId ?? null,
      propertyId: record.propertyId,
      propertyAddressLabel: record.propertyAddressLabel,
      shortlistId: record.shortlistId ?? null,
      moduleName: "closing_readiness",
      eventCategory: "RECORD_UPDATED",
      subjectType: "closing_readiness",
      subjectId: record.id,
      title: "Closing readiness updated",
      summary: "Closing readiness details were updated.",
      oldValueSnapshot: {
        overallClosingReadinessState: previousRecord.overallClosingReadinessState,
        nextAction: previousRecord.nextAction
      },
      newValueSnapshot: {
        overallClosingReadinessState: record.overallClosingReadinessState,
        nextAction: record.nextAction
      },
      triggerType: "USER_ACTION",
      triggerLabel: "closing_readiness_updated",
      actorType: "USER",
      createdAt: now
    });
    for (const entry of buildChangeActivityEntries({
      sessionId: record.sessionId ?? null,
      propertyId: record.propertyId,
      propertyAddressLabel: record.propertyAddressLabel,
      shortlistId: record.shortlistId ?? null,
      moduleName: "closing_readiness",
      subjectType: "closing_readiness",
      subjectId: record.id,
      stateLabel: "Closing readiness state",
      previousState: previousRecord.overallClosingReadinessState,
      nextState: record.overallClosingReadinessState,
      previousBlockers: previousRecord.blockers,
      nextBlockers: record.blockers,
      previousRisk: previousRecord.risk,
      nextRisk: record.risk,
      previousRecommendation: previousRecord.recommendation,
      nextRecommendation: record.recommendation,
      previousNextAction: previousRecord.nextAction,
      nextNextAction: record.nextAction,
      now,
      triggerType: "DERIVED_RECALCULATION"
    })) {
      this.pushUnifiedActivity(entry);
    }

    return mapStoredClosingReadiness(record);
  }

  async updateClosingChecklistItem(
    id: string,
    itemType: ClosingChecklistItemType,
    patch: {
      status?: ClosingChecklistItemState;
      deadline?: string | null;
      completedAt?: string | null;
      blockedReason?: string | null;
      notes?: string | null;
    }
  ): Promise<ClosingReadiness | null> {
    const record = this.closingReadinessRecords.find((entry) => entry.id === id);
    if (!record) {
      return null;
    }

    const checklistItem = record.checklistItemSummaries.find((entry) => entry.itemType === itemType);
    if (!checklistItem) {
      return null;
    }
    if (patch.status !== undefined) checklistItem.status = patch.status;
    if (patch.deadline !== undefined) checklistItem.deadline = patch.deadline;
    if (patch.completedAt !== undefined) checklistItem.completedAt = patch.completedAt;
    if (patch.blockedReason !== undefined) checklistItem.blockedReason = patch.blockedReason;
    if (patch.notes !== undefined) checklistItem.notes = patch.notes;

    const underContract =
      this.underContractRecords.find((entry) => entry.id === record.underContractCoordinationId) ?? null;
    if (!underContract) {
      return null;
    }
    const syncedUnderContract = this.syncUnderContractRecord(underContract);
    const offerSubmission =
      (record.offerSubmissionId
        ? this.offerSubmissionRecords.find((entry) => entry.id === record.offerSubmissionId)
        : null) ?? null;
    const offerPreparation =
      (record.offerPreparationId
        ? this.offerPreparationRecords.find((entry) => entry.id === record.offerPreparationId)
        : null) ?? null;
    const financialReadiness =
      (record.financialReadinessId
        ? this.financialReadinessRecords.find((entry) => entry.id === record.financialReadinessId)
        : null) ?? null;

    const now = new Date().toISOString();
    const evaluation = evaluateClosingReadiness({
      now,
      current: record,
      underContract: syncedUnderContract,
      offerSubmission,
      offerPreparation,
      financialReadiness
    });
    Object.assign(record, evaluation, {
      id: record.id,
      updatedAt: now,
      lastActionAt: now
    });
    record.activityLog.push({
      type: "checklist_updated",
      label: `${checklistItem.label} updated`,
      details: patch.notes ?? patch.blockedReason ?? null,
      createdAt: now
    });
    this.validationEvents.push({
      id: createId("workflow"),
      eventName: "closing_checklist_updated",
      sessionId: record.sessionId ?? null,
      payload: {
        shortlistId: record.shortlistId ?? null,
        offerPreparationId: record.offerPreparationId ?? null,
        offerSubmissionId: record.offerSubmissionId ?? null,
        underContractId: record.underContractCoordinationId,
        closingReadinessId: record.id,
        propertyId: record.propertyId,
        itemType,
        status: checklistItem.status
      },
      createdAt: now
    });
    this.pushUnifiedActivity({
      sessionId: record.sessionId ?? null,
      propertyId: record.propertyId,
      propertyAddressLabel: record.propertyAddressLabel,
      shortlistId: record.shortlistId ?? null,
      moduleName: "closing_readiness",
      eventCategory: "RECORD_UPDATED",
      subjectType: "closing_readiness",
      subjectId: record.id,
      title: `${checklistItem.label} updated`,
      summary: patch.notes ?? patch.blockedReason ?? `Checklist item status is now ${checklistItem.status.toLowerCase()}.`,
      newValueSnapshot: {
        itemType,
        status: checklistItem.status
      },
      triggerType: "USER_ACTION",
      triggerLabel: "closing_checklist_updated",
      actorType: "USER",
      createdAt: now
    });
    return mapStoredClosingReadiness(record);
  }

  async updateClosingMilestone(
    id: string,
    milestoneType: ClosingMilestoneType,
    patch: {
      status?: "PENDING" | "REACHED" | "BLOCKED";
      occurredAt?: string | null;
      notes?: string | null;
    }
  ): Promise<ClosingReadiness | null> {
    const record = this.closingReadinessRecords.find((entry) => entry.id === id);
    if (!record) {
      return null;
    }

    const milestone = record.milestoneSummaries.find((entry) => entry.milestoneType === milestoneType);
    if (!milestone) {
      return null;
    }
    if (patch.status !== undefined) milestone.status = patch.status;
    if (patch.occurredAt !== undefined) milestone.occurredAt = patch.occurredAt;
    if (patch.notes !== undefined) milestone.notes = patch.notes;

    const underContract =
      this.underContractRecords.find((entry) => entry.id === record.underContractCoordinationId) ?? null;
    if (!underContract) {
      return null;
    }
    const syncedUnderContract = this.syncUnderContractRecord(underContract);
    const offerSubmission =
      (record.offerSubmissionId
        ? this.offerSubmissionRecords.find((entry) => entry.id === record.offerSubmissionId)
        : null) ?? null;
    const offerPreparation =
      (record.offerPreparationId
        ? this.offerPreparationRecords.find((entry) => entry.id === record.offerPreparationId)
        : null) ?? null;
    const financialReadiness =
      (record.financialReadinessId
        ? this.financialReadinessRecords.find((entry) => entry.id === record.financialReadinessId)
        : null) ?? null;

    const now = new Date().toISOString();
    const evaluation = evaluateClosingReadiness({
      now,
      current: record,
      underContract: syncedUnderContract,
      offerSubmission,
      offerPreparation,
      financialReadiness
    });
    Object.assign(record, evaluation, {
      id: record.id,
      updatedAt: now,
      lastActionAt: now
    });
    record.activityLog.push({
      type: "milestone_reached",
      label: `${milestone.label} updated`,
      details: patch.notes ?? null,
      createdAt: now
    });
    this.validationEvents.push({
      id: createId("workflow"),
      eventName: "closing_milestone_reached",
      sessionId: record.sessionId ?? null,
      payload: {
        shortlistId: record.shortlistId ?? null,
        offerPreparationId: record.offerPreparationId ?? null,
        offerSubmissionId: record.offerSubmissionId ?? null,
        underContractId: record.underContractCoordinationId,
        closingReadinessId: record.id,
        propertyId: record.propertyId,
        milestoneType,
        status: milestone.status
      },
      createdAt: now
    });
    this.pushUnifiedActivity({
      sessionId: record.sessionId ?? null,
      propertyId: record.propertyId,
      propertyAddressLabel: record.propertyAddressLabel,
      shortlistId: record.shortlistId ?? null,
      moduleName: "closing_readiness",
      eventCategory: "MILESTONE_REACHED",
      subjectType: "closing_readiness",
      subjectId: record.id,
      title: `${milestone.label} updated`,
      summary: patch.notes ?? `Milestone status is now ${milestone.status.toLowerCase()}.`,
      newValueSnapshot: {
        milestoneType,
        status: milestone.status
      },
      triggerType: "STATUS_TRANSITION",
      triggerLabel: "closing_milestone_reached",
      actorType: "USER",
      createdAt: now
    });
    return mapStoredClosingReadiness(record);
  }

  async markClosingReady(id: string): Promise<ClosingReadiness | null> {
    const record = this.closingReadinessRecords.find((entry) => entry.id === id);
    if (!record) {
      return null;
    }
    const updated = await this.updateClosingReadiness(id, {});
    if (!updated || updated.overallClosingReadinessState !== "READY_TO_CLOSE") {
      return updated;
    }
    return updated;
  }

  async markClosingComplete(id: string, closedAt?: string | null): Promise<ClosingReadiness | null> {
    const record = this.closingReadinessRecords.find((entry) => entry.id === id);
    if (!record) {
      return null;
    }

    const underContract =
      this.underContractRecords.find((entry) => entry.id === record.underContractCoordinationId) ?? null;
    if (!underContract) {
      return null;
    }
    const syncedUnderContract = this.syncUnderContractRecord(underContract);
    const offerSubmission =
      (record.offerSubmissionId
        ? this.offerSubmissionRecords.find((entry) => entry.id === record.offerSubmissionId)
        : null) ?? null;
    const offerPreparation =
      (record.offerPreparationId
        ? this.offerPreparationRecords.find((entry) => entry.id === record.offerPreparationId)
        : null) ?? null;
    const financialReadiness =
      (record.financialReadinessId
        ? this.financialReadinessRecords.find((entry) => entry.id === record.financialReadinessId)
        : null) ?? null;

    const now = new Date().toISOString();
    const evaluation = evaluateClosingReadiness({
      now,
      current: record,
      underContract: syncedUnderContract,
      offerSubmission,
      offerPreparation,
      financialReadiness,
      patch: {
        closedAt: closedAt ?? now
      }
    });
    Object.assign(record, evaluation, {
      id: record.id,
      updatedAt: now,
      lastActionAt: now
    });
    record.activityLog.push({
      type: "closed",
      label: "Closing marked complete",
      details: null,
      createdAt: now
    });
    this.validationEvents.push({
      id: createId("workflow"),
      eventName: "closing_completed",
      sessionId: record.sessionId ?? null,
      payload: {
        shortlistId: record.shortlistId ?? null,
        offerPreparationId: record.offerPreparationId ?? null,
        offerSubmissionId: record.offerSubmissionId ?? null,
        underContractId: record.underContractCoordinationId,
        closingReadinessId: record.id,
        propertyId: record.propertyId,
        toState: record.overallClosingReadinessState
      },
      createdAt: now
    });
    this.pushUnifiedActivity({
      sessionId: record.sessionId ?? null,
      propertyId: record.propertyId,
      propertyAddressLabel: record.propertyAddressLabel,
      shortlistId: record.shortlistId ?? null,
      moduleName: "closing_readiness",
      eventCategory: "MILESTONE_REACHED",
      subjectType: "closing_readiness",
      subjectId: record.id,
      title: "Closing completed",
      summary: "The closing was marked complete.",
      oldValueSnapshot: { overallClosingReadinessState: "READY_TO_CLOSE" },
      newValueSnapshot: { overallClosingReadinessState: record.overallClosingReadinessState },
      triggerType: "STATUS_TRANSITION",
      triggerLabel: "closing_completed",
      actorType: "USER",
      createdAt: now
    });
    return mapStoredClosingReadiness(record);
  }

  async getClosingReadinessSummary(id: string): Promise<ClosingReadinessSummary | null> {
    const record = await this.getClosingReadiness(id);
    return record ? toClosingReadinessSummary(record) : null;
  }

  async createOfferReadiness(payload: {
    shortlistId: string;
    propertyId: string;
    status?: OfferReadinessStatus;
    financingReadiness?: OfferFinancingReadiness;
    propertyFitConfidence?: OfferPropertyFitConfidence;
    riskToleranceAlignment?: OfferRiskToleranceAlignment;
    riskLevel?: OfferRiskLevel;
    userConfirmed?: boolean;
  }): Promise<OfferReadiness | null> {
    const item = this.shortlistItems.find(
      (entry) =>
        entry.shortlistId === payload.shortlistId && entry.canonicalPropertyId === payload.propertyId
    );
    if (!item) {
      return null;
    }

    const existing = this.offerReadinessRecords.find(
      (entry) => entry.shortlistId === payload.shortlistId && entry.propertyId === payload.propertyId
    );
    if (existing) {
      return mapStoredOfferReadiness(existing);
    }

    const now = new Date().toISOString();
    const evaluation = evaluateOfferReadiness({
      item,
      now,
      patch: {
        status: payload.status,
        financingReadiness: payload.financingReadiness,
        propertyFitConfidence: payload.propertyFitConfidence,
        riskToleranceAlignment: payload.riskToleranceAlignment,
        riskLevel: payload.riskLevel,
        userConfirmed: payload.userConfirmed
      }
    });

    const record: OfferReadiness = {
      id: createId("offer-readiness"),
      ...evaluation,
      createdAt: now,
      updatedAt: now
    };

    this.offerReadinessRecords.push(record);
    this.validationEvents.push({
      id: createId("workflow"),
      eventName: "offer_readiness_created",
      sessionId: this.shortlists.find((entry) => entry.id === payload.shortlistId)?.sessionId ?? null,
      payload: {
        shortlistId: payload.shortlistId,
        shortlistItemId: item.id,
        offerReadinessId: record.id,
        propertyId: payload.propertyId,
        status: record.status
      },
      createdAt: now
    });

    return mapStoredOfferReadiness(record);
  }

  async listOfferReadiness(shortlistId: string): Promise<OfferReadiness[]> {
    return this.offerReadinessRecords
      .filter((entry) => entry.shortlistId === shortlistId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((entry) => mapStoredOfferReadiness(entry));
  }

  async getOfferReadiness(propertyId: string, shortlistId?: string): Promise<OfferReadiness | null> {
    const record = this.offerReadinessRecords
      .filter((entry) => entry.propertyId === propertyId && (!shortlistId || entry.shortlistId === shortlistId))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;

    return record ? mapStoredOfferReadiness(record) : null;
  }

  async updateOfferReadiness(
    id: string,
    patch: {
      status?: OfferReadinessStatus;
      financingReadiness?: OfferFinancingReadiness;
      propertyFitConfidence?: OfferPropertyFitConfidence;
      riskToleranceAlignment?: OfferRiskToleranceAlignment;
      riskLevel?: OfferRiskLevel;
      userConfirmed?: boolean;
    }
  ): Promise<OfferReadiness | null> {
    const record = this.offerReadinessRecords.find((entry) => entry.id === id);
    if (!record) {
      return null;
    }

    const item = this.shortlistItems.find((entry) => entry.id === record.shortlistItemId);
    if (!item) {
      return null;
    }

    const now = new Date().toISOString();
    const previousStatus = record.status;
    const evaluation = evaluateOfferReadiness({
      item,
      now,
      current: record,
      patch
    });

    Object.assign(record, evaluation, {
      updatedAt: now
    });

    const sessionId = this.shortlists.find((entry) => entry.id === record.shortlistId)?.sessionId ?? null;
    this.validationEvents.push({
      id: createId("workflow"),
      eventName: "offer_readiness_updated",
      sessionId,
      payload: {
        shortlistId: record.shortlistId,
        shortlistItemId: record.shortlistItemId,
        offerReadinessId: record.id,
        propertyId: record.propertyId,
        status: record.status
      },
      createdAt: now
    });

    if (previousStatus !== record.status) {
      this.validationEvents.push({
        id: createId("workflow"),
        eventName: "offer_status_changed",
        sessionId,
        payload: {
          shortlistId: record.shortlistId,
          shortlistItemId: record.shortlistItemId,
          offerReadinessId: record.id,
          propertyId: record.propertyId,
          fromStatus: previousStatus,
          toStatus: record.status
        },
        createdAt: now
      });
    }

    return mapStoredOfferReadiness(record);
  }

  async getOfferReadinessRecommendation(
    propertyId: string,
    shortlistId?: string
  ): Promise<OfferReadinessRecommendation | null> {
    const record = await this.getOfferReadiness(propertyId, shortlistId);
    return record ? toOfferReadinessRecommendation(record) : null;
  }

  async createNegotiation(payload: {
    propertyId: string;
    shortlistId?: string | null;
    offerReadinessId?: string | null;
    status?: NegotiationStatus;
    initialOfferPrice: number;
    currentOfferPrice?: number;
    sellerCounterPrice?: number | null;
    buyerWalkAwayPrice?: number | null;
    roundNumber?: number;
  }): Promise<NegotiationRecord | null> {
    const offerReadiness = payload.offerReadinessId
      ? this.offerReadinessRecords.find((entry) => entry.id === payload.offerReadinessId) ?? null
      : this.offerReadinessRecords.find(
          (entry) =>
            entry.propertyId === payload.propertyId &&
            (!payload.shortlistId || entry.shortlistId === payload.shortlistId)
        ) ?? null;
    const shortlistId = payload.shortlistId ?? offerReadiness?.shortlistId ?? null;
    const shortlist = shortlistId
      ? this.shortlists.find((entry) => entry.id === shortlistId) ?? null
      : null;

    const existing = this.negotiations.find(
      (entry) =>
        entry.propertyId === payload.propertyId &&
        (entry.shortlistId ?? null) === shortlistId
    );
    if (existing) {
      return mapStoredNegotiation(existing);
    }

    const now = new Date().toISOString();
    const evaluation = evaluateNegotiation({
      propertyId: payload.propertyId,
      shortlistId,
      offerReadinessId: payload.offerReadinessId ?? offerReadiness?.id ?? null,
      initialOfferPrice: payload.initialOfferPrice,
      offerReadiness,
      now,
      patch: {
        status: payload.status,
        currentOfferPrice: payload.currentOfferPrice,
        sellerCounterPrice: payload.sellerCounterPrice,
        buyerWalkAwayPrice: payload.buyerWalkAwayPrice,
        roundNumber: payload.roundNumber
      }
    });

    const record: NegotiationRecord = {
      id: createId("negotiation"),
      ...evaluation,
      createdAt: now,
      updatedAt: now
    };
    this.negotiations.push(record);

    const startedEvent: NegotiationEvent = {
      id: createId("negotiation-event"),
      negotiationRecordId: record.id,
      type: "NEGOTIATION_STARTED",
      label: "Negotiation started",
      details: null,
      createdAt: now
    };
    const initialOfferEvent: NegotiationEvent = {
      id: createId("negotiation-event"),
      negotiationRecordId: record.id,
      type: "INITIAL_OFFER_SET",
      label: "Initial offer set",
      details: `Initial offer recorded at ${record.initialOfferPrice.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
      })}.`,
      createdAt: now
    };
    this.negotiationEvents.push(startedEvent, initialOfferEvent);

    this.validationEvents.push({
      id: createId("workflow"),
      eventName: "negotiation_started",
      sessionId: shortlist?.sessionId ?? null,
      payload: {
        shortlistId,
        offerReadinessId: record.offerReadinessId,
        negotiationRecordId: record.id,
        propertyId: record.propertyId,
        status: record.status
      },
      createdAt: now
    });

    return mapStoredNegotiation(record);
  }

  async listNegotiations(shortlistId: string): Promise<NegotiationRecord[]> {
    return this.negotiations
      .filter((entry) => entry.shortlistId === shortlistId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((entry) => mapStoredNegotiation(entry));
  }

  async getNegotiation(propertyId: string, shortlistId?: string): Promise<NegotiationRecord | null> {
    const record =
      this.negotiations
        .filter(
          (entry) => entry.propertyId === propertyId && (!shortlistId || entry.shortlistId === shortlistId)
        )
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;

    return record ? mapStoredNegotiation(record) : null;
  }

  async updateNegotiation(
    id: string,
    patch: {
      status?: NegotiationStatus;
      currentOfferPrice?: number;
      sellerCounterPrice?: number | null;
      buyerWalkAwayPrice?: number | null;
      roundNumber?: number;
    }
  ): Promise<NegotiationRecord | null> {
    const record = this.negotiations.find((entry) => entry.id === id);
    if (!record) {
      return null;
    }

    const offerReadiness =
      (record.offerReadinessId
        ? this.offerReadinessRecords.find((entry) => entry.id === record.offerReadinessId)
        : null) ?? null;
    const now = new Date().toISOString();
    const previousStatus = record.status;
    const evaluation = evaluateNegotiation({
      propertyId: record.propertyId,
      shortlistId: record.shortlistId ?? null,
      offerReadinessId: record.offerReadinessId ?? null,
      initialOfferPrice: record.initialOfferPrice,
      current: record,
      offerReadiness,
      now,
      patch
    });

    Object.assign(record, evaluation, {
      updatedAt: now
    });

    const sessionId =
      (record.shortlistId
        ? this.shortlists.find((entry) => entry.id === record.shortlistId)?.sessionId
        : null) ?? null;

    const statusEventMap: Partial<Record<NegotiationStatus, WorkflowActivityRecord["eventType"]>> = {
      OFFER_MADE: "offer_submitted",
      COUNTER_RECEIVED: "counter_received",
      COUNTER_SENT: "counter_sent",
      ACCEPTED: "negotiation_accepted",
      REJECTED: "negotiation_rejected",
      WITHDRAWN: "negotiation_withdrawn"
    };

    if (previousStatus !== record.status && statusEventMap[record.status]) {
      this.validationEvents.push({
        id: createId("workflow"),
        eventName: statusEventMap[record.status]!,
        sessionId,
        payload: {
          shortlistId: record.shortlistId,
          offerReadinessId: record.offerReadinessId,
          negotiationRecordId: record.id,
          propertyId: record.propertyId,
          fromStatus: previousStatus,
          toStatus: record.status
        },
        createdAt: now
      });
    }

    return mapStoredNegotiation(record);
  }

  async createNegotiationEvent(
    negotiationRecordId: string,
    payload: {
      type: NegotiationEventType;
      label: string;
      details?: string | null;
    }
  ): Promise<NegotiationEvent | null> {
    const record = this.negotiations.find((entry) => entry.id === negotiationRecordId);
    if (!record) {
      return null;
    }

    const now = new Date().toISOString();
    record.lastActionAt = now;
    record.updatedAt = now;

    const event: NegotiationEvent = {
      id: createId("negotiation-event"),
      negotiationRecordId,
      type: payload.type,
      label: payload.label,
      details: payload.details ?? null,
      createdAt: now
    };
    this.negotiationEvents.push(event);

    return mapStoredNegotiationEvent(event);
  }

  async listNegotiationEvents(negotiationRecordId: string): Promise<NegotiationEvent[]> {
    return this.negotiationEvents
      .filter((entry) => entry.negotiationRecordId === negotiationRecordId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map((entry) => mapStoredNegotiationEvent(entry));
  }

  async getNegotiationSummary(
    propertyId: string,
    shortlistId?: string
  ): Promise<NegotiationSummary | null> {
    const record = await this.getNegotiation(propertyId, shortlistId);
    return record ? toNegotiationSummary(record) : null;
  }

  async updateShortlistItem(
    shortlistId: string,
    itemId: string,
    patch: {
      reviewState?: ReviewState;
      decisionConfidence?: DecisionConfidence | null;
      decisionRationale?: string | null;
      decisionRisks?: string[];
      lastDecisionReviewedAt?: string | null;
    }
  ): Promise<ShortlistItem | null> {
    const item = this.shortlistItems.find(
      (entry) => entry.shortlistId === shortlistId && entry.id === itemId
    );
    if (!item) {
      return null;
    }

    const previousReviewState = item.reviewState;
    const previousDecisionSnapshot = JSON.stringify({
      decisionConfidence: item.decisionConfidence ?? null,
      decisionRationale: item.decisionRationale ?? null,
      decisionRisks: normalizeDecisionRisks(item.decisionRisks),
      lastDecisionReviewedAt: item.lastDecisionReviewedAt ?? null
    });

    if (patch.reviewState !== undefined) {
      item.reviewState = patch.reviewState;
    }

    if (patch.decisionConfidence !== undefined) {
      item.decisionConfidence = patch.decisionConfidence;
    }
    if (patch.decisionRationale !== undefined) {
      item.decisionRationale = patch.decisionRationale;
    }
    if (patch.decisionRisks !== undefined) {
      item.decisionRisks = normalizeDecisionRisks(patch.decisionRisks);
    }
    if (patch.lastDecisionReviewedAt !== undefined) {
      item.lastDecisionReviewedAt = patch.lastDecisionReviewedAt;
    }

    item.updatedAt = new Date().toISOString();
    const sessionId = this.shortlists.find((entry) => entry.id === shortlistId)?.sessionId ?? null;

    if (previousReviewState !== item.reviewState) {
      this.validationEvents.push({
        id: createId("workflow"),
        eventName: "review_state_changed",
        sessionId,
        payload: {
          shortlistId,
          shortlistItemId: item.id,
          reviewState: item.reviewState
        },
        createdAt: item.updatedAt
      });
    }

    const nextDecisionSnapshot = JSON.stringify({
      decisionConfidence: item.decisionConfidence ?? null,
      decisionRationale: item.decisionRationale ?? null,
      decisionRisks: normalizeDecisionRisks(item.decisionRisks),
      lastDecisionReviewedAt: item.lastDecisionReviewedAt ?? null
    });

    if (previousDecisionSnapshot !== nextDecisionSnapshot) {
      this.validationEvents.push({
        id: createId("workflow"),
        eventName: "selected_choice_rationale_updated",
        sessionId,
        payload: {
          shortlistId,
          shortlistItemId: item.id,
          choiceStatus: item.choiceStatus,
          decisionConfidence: item.decisionConfidence ?? null
        },
        createdAt: item.updatedAt
      });
    }

    if (patch.lastDecisionReviewedAt !== undefined) {
      this.validationEvents.push({
        id: createId("workflow"),
        eventName: "selected_choice_reviewed",
        sessionId,
        payload: {
          shortlistId,
          shortlistItemId: item.id,
          reviewedAt: item.lastDecisionReviewedAt
        },
        createdAt: item.updatedAt
      });
    }

    return mapStoredShortlistItem(item);
  }

  async selectShortlistItem(payload: {
    shortlistId: string;
    itemId: string;
    replaceMode?: "backup" | "replaced" | "dropped";
    decisionConfidence?: DecisionConfidence | null;
    decisionRationale?: string | null;
    decisionRisks?: string[];
    lastDecisionReviewedAt?: string | null;
  }): Promise<{
    selectedItem: ShortlistItem;
    previousPrimaryItem: ShortlistItem | null;
  } | null> {
    const shortlist = this.shortlists.find((entry) => entry.id === payload.shortlistId) ?? null;
    if (!shortlist) {
      return null;
    }

    const items = this.shortlistItems.filter((entry) => entry.shortlistId === payload.shortlistId);
    const target = items.find((entry) => entry.id === payload.itemId);
    if (!target || isTerminalChoiceStatus(target.choiceStatus) || target.choiceStatus === "under_contract" || target.choiceStatus === "active_pursuit") {
      return null;
    }

    const now = new Date().toISOString();
    const previousPrimary =
      resolvePrimaryChoiceOwner(items.filter((entry) => entry.id !== target.id)) ?? null;
    if (previousPrimary?.choiceStatus === "closed") {
      return null;
    }

    const replaceMode = payload.replaceMode ?? "backup";
    if (previousPrimary && previousPrimary.id !== target.id) {
      previousPrimary.updatedAt = now;
      previousPrimary.statusChangedAt = now;
      previousPrimary.selectionRank = null;
      if (replaceMode === "backup") {
        previousPrimary.choiceStatus = "backup";
        previousPrimary.replacedByShortlistItemId = null;
        previousPrimary.droppedReason = null;
      } else if (replaceMode === "replaced") {
        previousPrimary.choiceStatus = "replaced";
        previousPrimary.replacedByShortlistItemId = target.id;
        previousPrimary.droppedReason = "better_alternative_selected";
      } else {
        previousPrimary.choiceStatus = "dropped";
        previousPrimary.replacedByShortlistItemId = null;
        previousPrimary.droppedReason = "better_alternative_selected";
      }
    }

    for (const item of items) {
      if (item.id === target.id) {
        continue;
      }
      if (item.choiceStatus === "selected") {
        item.choiceStatus = "backup";
        item.selectionRank = null;
        item.statusChangedAt = now;
        item.updatedAt = now;
      }
    }

    if (target.choiceStatus !== "selected") {
      target.statusChangedAt = now;
    }
    target.choiceStatus = "selected";
    target.selectionRank = 1;
    target.selectedAt = target.selectedAt ?? now;
    target.replacedByShortlistItemId = null;
    target.droppedReason = null;
    if (payload.decisionConfidence !== undefined) {
      target.decisionConfidence = payload.decisionConfidence;
    }
    if (payload.decisionRationale !== undefined) {
      target.decisionRationale = payload.decisionRationale;
    }
    if (payload.decisionRisks !== undefined) {
      target.decisionRisks = normalizeDecisionRisks(payload.decisionRisks);
    }
    if (payload.lastDecisionReviewedAt !== undefined) {
      target.lastDecisionReviewedAt = payload.lastDecisionReviewedAt;
    }
    target.updatedAt = now;

    normalizeBackupRanks(items);
    shortlist.updatedAt = now;

    this.validationEvents.push({
      id: createId("workflow"),
      eventName:
        previousPrimary && previousPrimary.id !== target.id
          ? "selected_choice_replaced"
          : "selected_choice_marked",
      sessionId: shortlist.sessionId,
      payload: {
        shortlistId: shortlist.id,
        shortlistItemId: target.id,
        previousPrimaryItemId: previousPrimary?.id ?? null,
        replaceMode,
        choiceStatus: target.choiceStatus
      },
      createdAt: now
    });

    return {
      selectedItem: mapStoredShortlistItem(target),
      previousPrimaryItem: previousPrimary ? mapStoredShortlistItem(previousPrimary) : null
    };
  }

  async reorderShortlistItems(payload: {
    shortlistId: string;
    orderedBackupItemIds: string[];
  }): Promise<ShortlistItem[] | null> {
    const shortlist = this.shortlists.find((entry) => entry.id === payload.shortlistId) ?? null;
    if (!shortlist) {
      return null;
    }

    const items = this.shortlistItems.filter((entry) => entry.shortlistId === payload.shortlistId);
    const selected = items.find((entry) => entry.choiceStatus === "selected" && entry.selectionRank === 1) ?? null;
    if (!selected) {
      return null;
    }

    const seen = new Set<string>();
    const orderedBackups = payload.orderedBackupItemIds.map((id) => items.find((entry) => entry.id === id) ?? null);
    if (
      orderedBackups.some((entry) => !entry) ||
      payload.orderedBackupItemIds.some((id) => {
        if (seen.has(id)) {
          return true;
        }
        seen.add(id);
        return false;
      }) ||
      orderedBackups.some(
        (entry) => !entry || isTerminalChoiceStatus(entry.choiceStatus) || entry.choiceStatus === "selected"
      )
    ) {
      return null;
    }

    const now = new Date().toISOString();
    const orderedIds = new Set(payload.orderedBackupItemIds);
    for (const item of items) {
      if (item.id === selected.id) {
        item.selectionRank = 1;
        continue;
      }

      if (orderedIds.has(item.id)) {
        if (item.choiceStatus !== "backup") {
          item.choiceStatus = "backup";
          item.statusChangedAt = now;
        }
      } else if (item.choiceStatus === "backup") {
        item.choiceStatus = "candidate";
        item.selectionRank = null;
        item.statusChangedAt = now;
      }
      item.updatedAt = now;
    }

    orderedBackups.forEach((item, index) => {
      if (!item) {
        return;
      }
      item.choiceStatus = "backup";
      item.selectionRank = index + 2;
      item.updatedAt = now;
    });
    shortlist.updatedAt = now;

    this.validationEvents.push({
      id: createId("workflow"),
      eventName: "selected_choice_backup_reordered",
      sessionId: shortlist.sessionId,
      payload: {
        shortlistId: shortlist.id,
        shortlistItemId: selected.id,
        orderedBackupItemIds: payload.orderedBackupItemIds
      },
      createdAt: now
    });

    return items.sort(shortlistItemOrder).map((item) => mapStoredShortlistItem(item));
  }

  async dropShortlistItem(payload: {
    shortlistId: string;
    itemId: string;
    droppedReason: DroppedReason;
    decisionRationale?: string | null;
  }): Promise<{
    item: ShortlistItem;
    promotedBackupItem: ShortlistItem | null;
  } | null> {
    const shortlist = this.shortlists.find((entry) => entry.id === payload.shortlistId) ?? null;
    if (!shortlist) {
      return null;
    }

    const items = this.shortlistItems.filter((entry) => entry.shortlistId === payload.shortlistId);
    const item = items.find((entry) => entry.id === payload.itemId);
    if (!item || isTerminalChoiceStatus(item.choiceStatus)) {
      return null;
    }

    const now = new Date().toISOString();
    item.choiceStatus = "dropped";
    item.selectionRank = null;
    item.droppedReason = payload.droppedReason;
    item.replacedByShortlistItemId = null;
    item.statusChangedAt = now;
    if (payload.decisionRationale !== undefined) {
      item.decisionRationale = payload.decisionRationale;
    }
    item.updatedAt = now;

    normalizeBackupRanks(items.filter((entry) => entry.id !== item.id));
    shortlist.updatedAt = now;

    this.validationEvents.push({
      id: createId("workflow"),
      eventName: "selected_choice_dropped",
      sessionId: shortlist.sessionId,
      payload: {
        shortlistId: shortlist.id,
        shortlistItemId: item.id,
        droppedReason: payload.droppedReason
      },
      createdAt: now
    });

    return {
      item: mapStoredShortlistItem(item),
      promotedBackupItem: null
    };
  }

  async getSelectedChoice(shortlistId: string): Promise<SelectedChoiceView | null> {
    const shortlist = this.shortlists.find((entry) => entry.id === shortlistId) ?? null;
    if (!shortlist) {
      return null;
    }

    return buildSelectedChoiceView(
      shortlistId,
      this.shortlistItems.filter((entry) => entry.shortlistId === shortlistId).map((entry) => mapStoredShortlistItem(entry))
    );
  }

  async getSelectedChoiceSummary(shortlistId: string): Promise<SelectedChoiceConciergeSummary | null> {
    const shortlist = this.shortlists.find((entry) => entry.id === shortlistId) ?? null;
    if (!shortlist) {
      return null;
    }

    const items = await this.listShortlistItems(shortlistId);
    const primaryOwner = resolvePrimaryChoiceOwner(items);
    const financialReadiness = await this.getLatestFinancialReadiness(shortlist.sessionId ?? null);
    const workflowNotifications = primaryOwner
      ? await this.listWorkflowNotifications({
          shortlistId,
          propertyId: primaryOwner.canonicalPropertyId
        })
      : [];
    const workflowActivity = shortlist.sessionId
      ? (await this.listWorkflowActivity(shortlist.sessionId, 50)).filter(
          (entry) =>
            entry.shortlistId === shortlistId &&
            (!primaryOwner ||
              typeof entry.payload?.canonicalPropertyId !== "string" ||
              entry.payload.canonicalPropertyId === primaryOwner.canonicalPropertyId)
        )
      : [];

    return buildSelectedChoiceConciergeSummary({
      shortlistId,
      items,
      financialReadiness,
      offerReadiness: primaryOwner
        ? await this.getOfferReadiness(primaryOwner.canonicalPropertyId, shortlistId)
        : null,
      offerPreparation: primaryOwner
        ? await this.getLatestOfferPreparation({
            propertyId: primaryOwner.canonicalPropertyId,
            shortlistId
          })
        : null,
      offerSubmission: primaryOwner
        ? await this.getLatestOfferSubmission({
            propertyId: primaryOwner.canonicalPropertyId,
            shortlistId
          })
        : null,
      negotiation: primaryOwner
        ? await this.getNegotiation(primaryOwner.canonicalPropertyId, shortlistId)
        : null,
      underContract: primaryOwner
        ? await this.getLatestUnderContractCoordination({
            propertyId: primaryOwner.canonicalPropertyId,
            shortlistId
          })
        : null,
      closingReadiness: primaryOwner
        ? await this.getLatestClosingReadiness({
            propertyId: primaryOwner.canonicalPropertyId,
            shortlistId
          })
        : null,
      workflowNotifications,
      workflowActivity
    });
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
    this.offerReadinessRecords.splice(
      0,
      this.offerReadinessRecords.length,
      ...this.offerReadinessRecords.filter((entry) => entry.shortlistItemId !== item.id)
    );
    this.offerPreparationRecords.splice(
      0,
      this.offerPreparationRecords.length,
      ...this.offerPreparationRecords.filter(
        (entry) => !(entry.shortlistId === shortlistId && entry.propertyId === item.canonicalPropertyId)
      )
    );
    this.offerSubmissionRecords.splice(
      0,
      this.offerSubmissionRecords.length,
      ...this.offerSubmissionRecords.filter(
        (entry) => !(entry.shortlistId === shortlistId && entry.propertyId === item.canonicalPropertyId)
      )
    );
    this.underContractRecords.splice(
      0,
      this.underContractRecords.length,
      ...this.underContractRecords.filter(
        (entry) => !(entry.shortlistId === shortlistId && entry.propertyId === item.canonicalPropertyId)
      )
    );
    this.closingReadinessRecords.splice(
      0,
      this.closingReadinessRecords.length,
      ...this.closingReadinessRecords.filter(
        (entry) => !(entry.shortlistId === shortlistId && entry.propertyId === item.canonicalPropertyId)
      )
    );
    const removedNegotiationIds = this.negotiations
      .filter((entry) => entry.shortlistId === shortlistId && entry.propertyId === item.canonicalPropertyId)
      .map((entry) => entry.id);
    this.negotiations.splice(
      0,
      this.negotiations.length,
      ...this.negotiations.filter(
        (entry) =>
          !(entry.shortlistId === shortlistId && entry.propertyId === item.canonicalPropertyId)
      )
    );
    this.negotiationEvents.splice(
      0,
      this.negotiationEvents.length,
      ...this.negotiationEvents.filter(
        (entry) => !removedNegotiationIds.includes(entry.negotiationRecordId)
      )
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

  async createUnifiedActivity(payload: {
    workflowId?: string | null;
    sessionId?: string | null;
    propertyId?: string | null;
    propertyAddressLabel?: string | null;
    shortlistId?: string | null;
    moduleName: UnifiedActivityModuleName;
    eventCategory: UnifiedActivityEventCategory;
    subjectType: string;
    subjectId: string;
    title: string;
    summary: string;
    oldValueSnapshot?: Record<string, unknown> | null;
    newValueSnapshot?: Record<string, unknown> | null;
    triggerType: UnifiedActivityTriggerType;
    triggerLabel: string;
    actorType?: UnifiedActivityActorType;
    actorId?: string | null;
    relatedNotificationId?: string | null;
    relatedExplanationId?: string | null;
    createdAt?: string;
  }): Promise<UnifiedActivityRecord> {
    return clone(
      this.pushUnifiedActivity({
        ...payload,
        actorType: payload.actorType ?? "SYSTEM",
        createdAt: payload.createdAt ?? new Date().toISOString()
      })
    );
  }

  async listUnifiedActivity(filters?: {
    sessionId?: string | null;
    propertyId?: string | null;
    shortlistId?: string | null;
    moduleName?: UnifiedActivityModuleName;
    eventCategories?: UnifiedActivityEventCategory[];
    subjectType?: string;
    subjectId?: string;
    limit?: number;
  }): Promise<UnifiedActivityRecord[]> {
    const records = this.unifiedActivityRecords
      .filter((entry) => {
        if (filters?.sessionId !== undefined && entry.sessionId !== (filters.sessionId ?? null)) {
          return false;
        }
        if (filters?.propertyId && entry.propertyId !== filters.propertyId) {
          return false;
        }
        if (filters?.shortlistId && entry.shortlistId !== filters.shortlistId) {
          return false;
        }
        if (filters?.moduleName && entry.moduleName !== filters.moduleName) {
          return false;
        }
        if (filters?.subjectType && entry.subjectType !== filters.subjectType) {
          return false;
        }
        if (filters?.subjectId && entry.subjectId !== filters.subjectId) {
          return false;
        }
        if (filters?.eventCategories?.length && !filters.eventCategories.includes(entry.eventCategory)) {
          return false;
        }
        return true;
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return records.slice(0, filters?.limit ?? records.length).map((entry) => clone(entry));
  }

  async createWorkflowNotification(payload: {
    workflowId?: string | null;
    sessionId?: string | null;
    propertyId?: string | null;
    propertyAddressLabel?: string | null;
    shortlistId?: string | null;
    moduleName: NotificationModuleName;
    alertCategory: AlertCategory;
    severity: NotificationSeverity;
    status?: NotificationStatus;
    triggeringRuleLabel: string;
    relatedSubjectType: string;
    relatedSubjectId: string;
    title: string;
    message: string;
    actionLabel?: string | null;
    actionTarget?: NotificationActionTarget | null;
    dueAt?: string | null;
    explanationSubjectType?: string | null;
    explanationSubjectId?: string | null;
  }): Promise<WorkflowNotification> {
    const now = new Date().toISOString();
    const record: WorkflowNotification = {
      id: createId("notification"),
      workflowId: payload.workflowId ?? null,
      sessionId: payload.sessionId ?? null,
      propertyId: payload.propertyId ?? null,
      propertyAddressLabel: payload.propertyAddressLabel ?? null,
      shortlistId: payload.shortlistId ?? null,
      moduleName: payload.moduleName,
      alertCategory: payload.alertCategory,
      severity: payload.severity,
      status: payload.status ?? "UNREAD",
      triggeringRuleLabel: payload.triggeringRuleLabel,
      relatedSubjectType: payload.relatedSubjectType,
      relatedSubjectId: payload.relatedSubjectId,
      title: payload.title,
      message: payload.message,
      actionLabel: payload.actionLabel ?? null,
      actionTarget: payload.actionTarget ?? null,
      dueAt: payload.dueAt ?? null,
      readAt: null,
      dismissedAt: null,
      resolvedAt: null,
      explanationSubjectType: payload.explanationSubjectType ?? null,
      explanationSubjectId: payload.explanationSubjectId ?? null,
      createdAt: now,
      updatedAt: now
    };
    this.workflowNotifications.push(record);
    this.pushWorkflowNotificationHistory(record.id, "CREATED", null, record.status, now);
    this.pushUnifiedActivity({
      workflowId: record.workflowId ?? null,
      sessionId: record.sessionId ?? null,
      propertyId: record.propertyId ?? null,
      propertyAddressLabel: record.propertyAddressLabel ?? null,
      shortlistId: record.shortlistId ?? null,
      moduleName: "notification_alerting",
      eventCategory: "NOTIFICATION_CREATED",
      subjectType: "workflow_notification",
      subjectId: record.id,
      title: record.title,
      summary: record.message,
      newValueSnapshot: {
        moduleName: record.moduleName,
        alertCategory: record.alertCategory,
        severity: record.severity,
        status: record.status,
        dueAt: record.dueAt
      },
      triggerType: record.alertCategory === "DEADLINE_ALERT" ? "DEADLINE_RULE" : "SYSTEM_RULE",
      triggerLabel: record.triggeringRuleLabel,
      actorType: "SYSTEM",
      relatedNotificationId: record.id,
      createdAt: now
    });
    if (record.alertCategory === "DEADLINE_ALERT") {
      this.pushUnifiedActivity({
        workflowId: record.workflowId ?? null,
        sessionId: record.sessionId ?? null,
        propertyId: record.propertyId ?? null,
        propertyAddressLabel: record.propertyAddressLabel ?? null,
        shortlistId: record.shortlistId ?? null,
        moduleName: record.moduleName === "transaction_command_center" ? "transaction_command_center" : record.moduleName,
        eventCategory: deadlineEventCategoryFromDueAt(record.dueAt, now),
        subjectType: record.relatedSubjectType,
        subjectId: record.relatedSubjectId,
        title: record.title,
        summary: record.message,
        newValueSnapshot: {
          dueAt: record.dueAt,
          severity: record.severity
        },
        triggerType: "DEADLINE_RULE",
        triggerLabel: record.triggeringRuleLabel,
        actorType: "SYSTEM",
        relatedNotificationId: record.id,
        createdAt: now
      });
    }
    if (record.alertCategory === "MILESTONE_ALERT") {
      this.pushUnifiedActivity({
        workflowId: record.workflowId ?? null,
        sessionId: record.sessionId ?? null,
        propertyId: record.propertyId ?? null,
        propertyAddressLabel: record.propertyAddressLabel ?? null,
        shortlistId: record.shortlistId ?? null,
        moduleName: record.moduleName === "transaction_command_center" ? "transaction_command_center" : record.moduleName,
        eventCategory: "MILESTONE_REACHED",
        subjectType: record.relatedSubjectType,
        subjectId: record.relatedSubjectId,
        title: record.title,
        summary: record.message,
        newValueSnapshot: {
          alertCategory: record.alertCategory,
          severity: record.severity
        },
        triggerType: "STATUS_TRANSITION",
        triggerLabel: record.triggeringRuleLabel,
        actorType: "SYSTEM",
        relatedNotificationId: record.id,
        createdAt: now
      });
    }
    return mapStoredWorkflowNotification(record);
  }

  async getWorkflowNotification(id: string): Promise<WorkflowNotification | null> {
    const record = this.workflowNotifications.find((entry) => entry.id === id) ?? null;
    return record ? mapStoredWorkflowNotification(record) : null;
  }

  async listWorkflowNotifications(filters?: {
    sessionId?: string | null;
    propertyId?: string | null;
    shortlistId?: string | null;
    statuses?: NotificationStatus[];
    limit?: number;
  }): Promise<WorkflowNotification[]> {
    const records = this.workflowNotifications
      .filter((entry) => {
        if (filters?.sessionId !== undefined && entry.sessionId !== (filters.sessionId ?? null)) {
          return false;
        }
        if (filters?.propertyId !== undefined && entry.propertyId !== (filters.propertyId ?? null)) {
          return false;
        }
        if (filters?.shortlistId !== undefined && entry.shortlistId !== (filters.shortlistId ?? null)) {
          return false;
        }
        if (filters?.statuses && !filters.statuses.includes(entry.status)) {
          return false;
        }
        return true;
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

    return records.slice(0, filters?.limit ?? records.length).map((entry) => mapStoredWorkflowNotification(entry));
  }

  async updateWorkflowNotification(
    id: string,
    patch: {
      severity?: NotificationSeverity;
      status?: NotificationStatus;
      title?: string;
      message?: string;
      actionLabel?: string | null;
      actionTarget?: NotificationActionTarget | null;
      dueAt?: string | null;
      readAt?: string | null;
      dismissedAt?: string | null;
      resolvedAt?: string | null;
      explanationSubjectType?: string | null;
      explanationSubjectId?: string | null;
    }
  ): Promise<WorkflowNotification | null> {
    const record = this.workflowNotifications.find((entry) => entry.id === id);
    if (!record) {
      return null;
    }

    const now = new Date().toISOString();
    const previousStatus = record.status;
    const previousSeverity = record.severity;

    Object.assign(record, {
      ...patch,
      updatedAt: now
    });

    if (patch.status && patch.status !== previousStatus) {
      const eventType: WorkflowNotificationHistoryEvent["eventType"] =
        patch.status === "READ"
          ? "READ"
          : patch.status === "DISMISSED"
            ? "DISMISSED"
            : patch.status === "RESOLVED"
              ? "RESOLVED"
              : "READ";
      this.pushWorkflowNotificationHistory(id, eventType, previousStatus, patch.status, now);
      const activityCategory: UnifiedActivityEventCategory =
        patch.status === "READ"
          ? "NOTIFICATION_READ"
          : patch.status === "DISMISSED"
            ? "NOTIFICATION_DISMISSED"
            : "NOTIFICATION_RESOLVED";
      this.pushUnifiedActivity({
        workflowId: record.workflowId ?? null,
        sessionId: record.sessionId ?? null,
        propertyId: record.propertyId ?? null,
        propertyAddressLabel: record.propertyAddressLabel ?? null,
        shortlistId: record.shortlistId ?? null,
        moduleName: "notification_alerting",
        eventCategory: activityCategory,
        subjectType: "workflow_notification",
        subjectId: id,
        title: record.title,
        summary:
          activityCategory === "NOTIFICATION_READ"
            ? "Notification marked read."
            : activityCategory === "NOTIFICATION_DISMISSED"
              ? "Notification dismissed."
              : "Notification resolved.",
        oldValueSnapshot: {
          status: previousStatus
        },
        newValueSnapshot: {
          status: patch.status
        },
        triggerType: "USER_ACTION",
        triggerLabel: eventType.toLowerCase(),
        actorType: patch.status === "RESOLVED" ? "SYSTEM" : "USER",
        relatedNotificationId: id,
        createdAt: now
      });
    }

    if (patch.severity && patch.severity !== previousSeverity) {
      this.pushWorkflowNotificationHistory(id, "SEVERITY_CHANGED", previousSeverity, patch.severity, now);
    }

    return mapStoredWorkflowNotification(record);
  }

  async listWorkflowNotificationHistory(filters?: {
    sessionId?: string | null;
    propertyId?: string | null;
    shortlistId?: string | null;
    notificationId?: string;
    limit?: number;
  }): Promise<WorkflowNotificationHistoryEvent[]> {
    const allowedIds = new Set(
      this.workflowNotifications
        .filter((entry) => {
          if (filters?.notificationId && entry.id !== filters.notificationId) {
            return false;
          }
          if (filters?.sessionId !== undefined && entry.sessionId !== (filters.sessionId ?? null)) {
            return false;
          }
          if (filters?.propertyId !== undefined && entry.propertyId !== (filters.propertyId ?? null)) {
            return false;
          }
          if (filters?.shortlistId !== undefined && entry.shortlistId !== (filters.shortlistId ?? null)) {
            return false;
          }
          return true;
        })
        .map((entry) => entry.id)
    );

    return this.workflowNotificationHistory
      .filter((entry) => allowedIds.has(entry.notificationId))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, filters?.limit ?? this.workflowNotificationHistory.length)
      .map((entry) => mapStoredWorkflowNotificationHistoryEvent(entry));
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
  $transaction<T>(fn: (tx: PrismaClientLike) => Promise<T>): Promise<T>;
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
  financialReadiness: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
    findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  offerPreparation: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
    findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    delete?(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  offerSubmission: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
    findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    delete?(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  underContractCoordination: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
    findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    delete?(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  closingReadiness: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
    findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    delete?(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  offerReadiness: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
    findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  negotiationRecord: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
    findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    delete(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  negotiationEvent: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
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
  return normalizeShortlistItemChoice({
    id: record.id as string,
    shortlistId: record.shortlistId as string,
    canonicalPropertyId: record.canonicalPropertyId as string,
    sourceSnapshotId: (record.sourceSnapshotId as string | null) ?? null,
    sourceHistoryId: (record.sourceHistoryId as string | null) ?? null,
    sourceSearchDefinitionId: (record.sourceSearchDefinitionId as string | null) ?? null,
    capturedHome: clone(record.capturedHomePayload as ShortlistItem["capturedHome"]),
    reviewState: record.reviewState as ReviewState,
    choiceStatus: ((record.choiceStatus as ChoiceStatus | null) ?? "candidate") as ChoiceStatus,
    selectionRank: (record.selectionRank as number | null) ?? null,
    decisionConfidence: (record.decisionConfidence as DecisionConfidence | null) ?? null,
    decisionRationale: (record.decisionRationale as string | null) ?? null,
    decisionRisks: parseDecisionRisksJson(record.decisionRisksJson),
    lastDecisionReviewedAt:
      record.lastDecisionReviewedAt instanceof Date
        ? record.lastDecisionReviewedAt.toISOString()
        : ((record.lastDecisionReviewedAt as string | null) ?? null),
    selectedAt:
      record.selectedAt instanceof Date
        ? record.selectedAt.toISOString()
        : ((record.selectedAt as string | null) ?? null),
    statusChangedAt:
      record.statusChangedAt instanceof Date
        ? record.statusChangedAt.toISOString()
        : (record.updatedAt as Date).toISOString(),
    replacedByShortlistItemId: (record.replacedByShortlistItemId as string | null) ?? null,
    droppedReason: (record.droppedReason as DroppedReason | null) ?? null,
    addedAt: (record.addedAt as Date).toISOString(),
    updatedAt: (record.updatedAt as Date).toISOString()
  });
}

function mapPrismaFinancialReadiness(record: Record<string, unknown>): FinancialReadiness {
  return {
    id: record.id as string,
    sessionId: (record.sessionId as string | null) ?? null,
    partnerId: (record.partnerId as string | null) ?? null,
    annualHouseholdIncome: (record.annualHouseholdIncome as number | null) ?? null,
    monthlyDebtPayments: (record.monthlyDebtPayments as number | null) ?? null,
    availableCashSavings: (record.availableCashSavings as number | null) ?? null,
    creditScoreRange: (record.creditScoreRange as CreditScoreRange | null) ?? null,
    desiredHomePrice: (record.desiredHomePrice as number | null) ?? null,
    purchaseLocation: (record.purchaseLocation as string | null) ?? null,
    downPaymentPreferencePercent:
      (record.downPaymentPreferencePercent as number | null) ?? null,
    loanType: (record.loanType as LoanType | null) ?? null,
    preApprovalStatus: (record.preApprovalStatus as PreApprovalStatus | null) ?? null,
    preApprovalExpiresAt:
      record.preApprovalExpiresAt instanceof Date
        ? record.preApprovalExpiresAt.toISOString()
        : ((record.preApprovalExpiresAt as string | null) ?? null),
    proofOfFundsStatus: (record.proofOfFundsStatus as ProofOfFundsStatus | null) ?? null,
    maxAffordableHomePrice: (record.maxAffordableHomePrice as number | null) ?? null,
    estimatedMonthlyPayment: (record.estimatedMonthlyPayment as number | null) ?? null,
    estimatedDownPayment: (record.estimatedDownPayment as number | null) ?? null,
    estimatedClosingCosts: (record.estimatedClosingCosts as number | null) ?? null,
    totalCashRequiredToClose: (record.totalCashRequiredToClose as number | null) ?? null,
    debtToIncomeRatio: (record.debtToIncomeRatio as number | null) ?? null,
    housingRatio: (record.housingRatio as number | null) ?? null,
    affordabilityClassification: record.affordabilityClassification as AffordabilityClassification,
    readinessState: record.readinessState as FinancialReadinessState,
    blockers: clone((record.blockersJson as FinancialReadiness["blockers"] | null) ?? []),
    recommendation: (record.recommendation as string | null) ?? "",
    risk: (record.risk as string | null) ?? "",
    alternative: (record.alternative as string | null) ?? "",
    nextAction: (record.nextAction as string | null) ?? "",
    nextSteps: clone((record.nextStepsJson as string[] | null) ?? []),
    assumptionsUsed: clone(
      (record.assumptionsJson as FinancialReadiness["assumptionsUsed"] | null) ?? {
        interestRate: null,
        propertyTaxRate: null,
        insuranceMonthly: null,
        closingCostPercent: null,
        downPaymentPercent: null,
        loanType: null
      }
    ),
    lastEvaluatedAt: (record.lastEvaluatedAt as Date).toISOString(),
    createdAt: (record.createdAt as Date).toISOString(),
    updatedAt: (record.updatedAt as Date).toISOString()
  };
}

function mapPrismaOfferPreparation(record: Record<string, unknown>): OfferPreparation {
  return {
    id: record.id as string,
    sessionId: (record.sessionId as string | null) ?? null,
    partnerId: (record.partnerId as string | null) ?? null,
    propertyId: record.propertyId as string,
    propertyAddressLabel: record.propertyAddressLabel as string,
    shortlistId: (record.shortlistId as string | null) ?? null,
    offerReadinessId: (record.offerReadinessId as string | null) ?? null,
    financialReadinessId: record.financialReadinessId as string,
    offerPrice: (record.offerPrice as number | null) ?? null,
    earnestMoneyAmount: (record.earnestMoneyAmount as number | null) ?? null,
    downPaymentType:
      (record.downPaymentType as OfferPreparationDownPaymentType | null) ?? null,
    downPaymentAmount: (record.downPaymentAmount as number | null) ?? null,
    downPaymentPercent: (record.downPaymentPercent as number | null) ?? null,
    financingContingency:
      (record.financingContingency as OfferPreparationContingency | null) ?? null,
    inspectionContingency:
      (record.inspectionContingency as OfferPreparationContingency | null) ?? null,
    appraisalContingency:
      (record.appraisalContingency as OfferPreparationContingency | null) ?? null,
    closingTimelineDays: (record.closingTimelineDays as number | null) ?? null,
    possessionTiming:
      (record.possessionTiming as OfferPreparationPossessionTiming | null) ?? null,
    possessionDaysAfterClosing: (record.possessionDaysAfterClosing as number | null) ?? null,
    sellerConcessionsRequestedAmount:
      (record.sellerConcessionsRequestedAmount as number | null) ?? null,
    notes: (record.notes as string | null) ?? null,
    buyerRationale: (record.buyerRationale as string | null) ?? null,
    offerSummary: clone(
      (record.offerSummaryJson as OfferPreparation["offerSummary"] | null) ?? {
        propertyId: record.propertyId as string,
        propertyAddressLabel: record.propertyAddressLabel as string,
        offerPrice: (record.offerPrice as number | null) ?? null,
        earnestMoneyAmount: (record.earnestMoneyAmount as number | null) ?? null,
        downPaymentAmount: (record.downPaymentAmount as number | null) ?? null,
        downPaymentPercent: (record.downPaymentPercent as number | null) ?? null,
        financingContingency:
          (record.financingContingency as OfferPreparationContingency | null) ?? null,
        inspectionContingency:
          (record.inspectionContingency as OfferPreparationContingency | null) ?? null,
        appraisalContingency:
          (record.appraisalContingency as OfferPreparationContingency | null) ?? null,
        closingTimelineDays: (record.closingTimelineDays as number | null) ?? null,
        possessionTiming:
          (record.possessionTiming as OfferPreparationPossessionTiming | null) ?? null
      }
    ),
    offerState: record.offerState as OfferPreparationState,
    offerRiskLevel: record.offerRiskLevel as OfferPreparation["offerRiskLevel"],
    offerCompletenessState:
      record.offerCompletenessState as OfferPreparation["offerCompletenessState"],
    readinessToSubmit: Boolean(record.readinessToSubmit),
    cashRequiredAtOffer: (record.cashRequiredAtOffer as number | null) ?? null,
    missingItems: clone(
      (record.missingItemsJson as OfferPreparation["missingItems"] | null) ?? []
    ),
    blockers: clone((record.blockersJson as OfferPreparation["blockers"] | null) ?? []),
    recommendation: (record.recommendation as string | null) ?? "",
    risk: (record.risk as string | null) ?? "",
    alternative: (record.alternative as string | null) ?? "",
    nextAction: (record.nextAction as string | null) ?? "",
    nextSteps: clone((record.nextStepsJson as string[] | null) ?? []),
    financialAlignment: clone(
      (record.financialAlignmentJson as OfferPreparation["financialAlignment"] | null) ?? {
        maxAffordableHomePrice: null,
        targetCashToClose: null,
        availableCashSavings: null,
        affordabilityClassification: "BLOCKED",
        readinessState: "BLOCKED",
        financiallyAligned: false,
        recommendedOfferPrice: null
      }
    ),
    assumptionsUsed: clone(
      (record.assumptionsJson as OfferPreparation["assumptionsUsed"] | null) ?? {
        lowEarnestMoneyPercent: 0.01,
        standardEarnestMoneyPercent: { min: 0.01, max: 0.03 },
        aggressiveClosingTimelineDays: 14,
        slowClosingTimelineDays: 45,
        affordabilityTolerancePercent: 0.05
      }
    ),
    strategyDefaultsProvenance: clone(
      (record.strategyDefaultsProvenanceJson as OfferPreparation["strategyDefaultsProvenance"] | null) ??
        null
    ),
    lastEvaluatedAt: (record.lastEvaluatedAt as Date).toISOString(),
    createdAt: (record.createdAt as Date).toISOString(),
    updatedAt: (record.updatedAt as Date).toISOString()
  };
}

function mapPrismaOfferSubmission(record: Record<string, unknown>): OfferSubmission {
  return {
    id: record.id as string,
    sessionId: (record.sessionId as string | null) ?? null,
    partnerId: (record.partnerId as string | null) ?? null,
    propertyId: record.propertyId as string,
    propertyAddressLabel: record.propertyAddressLabel as string,
    shortlistId: (record.shortlistId as string | null) ?? null,
    financialReadinessId: (record.financialReadinessId as string | null) ?? null,
    offerPreparationId: record.offerPreparationId as string,
    submissionMethod: (record.submissionMethod as OfferSubmissionMethod | null) ?? null,
    submittedAt: record.submittedAt ? (record.submittedAt as Date).toISOString() : null,
    offerExpirationAt: record.offerExpirationAt ? (record.offerExpirationAt as Date).toISOString() : null,
    sellerResponseState:
      (record.sellerResponseState as OfferSubmissionSellerResponseState | null) ?? "NO_RESPONSE",
    sellerRespondedAt: record.sellerRespondedAt ? (record.sellerRespondedAt as Date).toISOString() : null,
    buyerCounterDecision:
      (record.buyerCounterDecision as OfferSubmissionBuyerCounterDecision | null) ?? null,
    withdrawnAt: record.withdrawnAt ? (record.withdrawnAt as Date).toISOString() : null,
    withdrawalReason: (record.withdrawalReason as string | null) ?? null,
    counterofferPrice: (record.counterofferPrice as number | null) ?? null,
    counterofferClosingTimelineDays: (record.counterofferClosingTimelineDays as number | null) ?? null,
    counterofferFinancingContingency:
      (record.counterofferFinancingContingency as OfferPreparationContingency | null) ?? null,
    counterofferInspectionContingency:
      (record.counterofferInspectionContingency as OfferPreparationContingency | null) ?? null,
    counterofferAppraisalContingency:
      (record.counterofferAppraisalContingency as OfferPreparationContingency | null) ?? null,
    counterofferExpirationAt:
      record.counterofferExpirationAt ? (record.counterofferExpirationAt as Date).toISOString() : null,
    notes: (record.notes as string | null) ?? null,
    internalActivityNote: (record.internalActivityNote as string | null) ?? null,
    originalOfferSnapshot: clone(
      (record.originalOfferSnapshotJson as OfferSubmission["originalOfferSnapshot"] | null) ?? {
        offerPrice: null,
        earnestMoneyAmount: null,
        downPaymentAmount: null,
        downPaymentPercent: null,
        financingContingency: null,
        inspectionContingency: null,
        appraisalContingency: null,
        closingTimelineDays: null
      }
    ),
    submissionSummary: clone(
      (record.submissionSummaryJson as OfferSubmission["submissionSummary"] | null) ?? {
        propertyId: record.propertyId as string,
        propertyAddressLabel: record.propertyAddressLabel as string,
        offerPreparationId: record.offerPreparationId as string,
        submittedAt: record.submittedAt ? (record.submittedAt as Date).toISOString() : null,
        offerExpirationAt: record.offerExpirationAt ? (record.offerExpirationAt as Date).toISOString() : null,
        currentOfferPrice: (record.counterofferPrice as number | null) ?? null,
        earnestMoneyAmount: null,
        closingTimelineDays: (record.counterofferClosingTimelineDays as number | null) ?? null
      }
    ),
    submissionState: record.submissionState as OfferSubmission["submissionState"],
    urgencyLevel: record.urgencyLevel as OfferSubmission["urgencyLevel"],
    counterofferSummary: clone(
      (record.counterofferSummaryJson as OfferSubmission["counterofferSummary"] | null) ?? {
        present: false,
        counterofferPrice: null,
        counterofferClosingTimelineDays: null,
        counterofferFinancingContingency: null,
        counterofferInspectionContingency: null,
        counterofferAppraisalContingency: null,
        counterofferExpirationAt: null,
        changedFields: []
      }
    ),
    missingItems: clone(
      (record.missingItemsJson as OfferSubmission["missingItems"] | null) ?? []
    ),
    blockers: clone((record.blockersJson as OfferSubmission["blockers"] | null) ?? []),
    recommendation: (record.recommendation as string | null) ?? "",
    risk: (record.risk as string | null) ?? "",
    alternative: (record.alternative as string | null) ?? "",
    nextAction: (record.nextAction as string | null) ?? "",
    nextSteps: clone((record.nextStepsJson as string[] | null) ?? []),
    requiresBuyerResponse: Boolean(record.requiresBuyerResponse),
    isExpired: Boolean(record.isExpired),
    activityLog: clone((record.activityLogJson as OfferSubmission["activityLog"] | null) ?? []),
    lastActionAt: record.lastActionAt ? (record.lastActionAt as Date).toISOString() : null,
    lastEvaluatedAt: (record.lastEvaluatedAt as Date).toISOString(),
    createdAt: (record.createdAt as Date).toISOString(),
    updatedAt: (record.updatedAt as Date).toISOString()
  };
}

function mapPrismaUnderContractCoordination(record: Record<string, unknown>): UnderContractCoordination {
  return {
    id: record.id as string,
    sessionId: (record.sessionId as string | null) ?? null,
    partnerId: (record.partnerId as string | null) ?? null,
    propertyId: record.propertyId as string,
    propertyAddressLabel: record.propertyAddressLabel as string,
    shortlistId: (record.shortlistId as string | null) ?? null,
    financialReadinessId: (record.financialReadinessId as string | null) ?? null,
    offerPreparationId: (record.offerPreparationId as string | null) ?? null,
    offerSubmissionId: record.offerSubmissionId as string,
    acceptedAt: (record.acceptedAt as Date).toISOString(),
    targetClosingDate: (record.targetClosingDate as Date).toISOString(),
    inspectionDeadline: record.inspectionDeadline ? (record.inspectionDeadline as Date).toISOString() : null,
    appraisalDeadline: record.appraisalDeadline ? (record.appraisalDeadline as Date).toISOString() : null,
    financingDeadline: record.financingDeadline ? (record.financingDeadline as Date).toISOString() : null,
    contingencyDeadline: record.contingencyDeadline ? (record.contingencyDeadline as Date).toISOString() : null,
    closingPreparationDeadline:
      record.closingPreparationDeadline ? (record.closingPreparationDeadline as Date).toISOString() : null,
    notes: (record.notes as string | null) ?? null,
    internalActivityNote: (record.internalActivityNote as string | null) ?? null,
    coordinationSummary: clone(
      (record.coordinationSummaryJson as UnderContractCoordination["coordinationSummary"] | null) ?? {
        propertyId: record.propertyId as string,
        propertyAddressLabel: record.propertyAddressLabel as string,
        offerSubmissionId: record.offerSubmissionId as string,
        acceptedAt: (record.acceptedAt as Date).toISOString(),
        targetClosingDate: (record.targetClosingDate as Date).toISOString()
      }
    ),
    overallCoordinationState:
      record.overallCoordinationState as UnderContractCoordination["overallCoordinationState"],
    overallRiskLevel: record.overallRiskLevel as UnderContractCoordination["overallRiskLevel"],
    urgencyLevel: record.urgencyLevel as UnderContractCoordination["urgencyLevel"],
    readyForClosing: Boolean(record.readyForClosing),
    requiresImmediateAttention: Boolean(record.requiresImmediateAttention),
    taskSummaries: clone(
      (record.taskRecordsJson as UnderContractCoordination["taskSummaries"] | null) ?? []
    ),
    milestoneSummaries: clone(
      (record.milestoneRecordsJson as UnderContractCoordination["milestoneSummaries"] | null) ?? []
    ),
    deadlineSummaries: clone(
      (record.deadlineRecordsJson as UnderContractCoordination["deadlineSummaries"] | null) ?? []
    ),
    missingItems: clone(
      (record.missingItemsJson as UnderContractCoordination["missingItems"] | null) ?? []
    ),
    blockers: clone((record.blockersJson as UnderContractCoordination["blockers"] | null) ?? []),
    recommendation: (record.recommendation as string | null) ?? "",
    risk: (record.risk as string | null) ?? "",
    alternative: (record.alternative as string | null) ?? "",
    nextAction: (record.nextAction as string | null) ?? "",
    nextSteps: clone((record.nextStepsJson as string[] | null) ?? []),
    activityLog: clone((record.activityLogJson as UnderContractCoordination["activityLog"] | null) ?? []),
    lastActionAt: record.lastActionAt ? (record.lastActionAt as Date).toISOString() : null,
    lastEvaluatedAt: (record.lastEvaluatedAt as Date).toISOString(),
    createdAt: (record.createdAt as Date).toISOString(),
    updatedAt: (record.updatedAt as Date).toISOString()
  };
}

function mapPrismaClosingReadiness(record: Record<string, unknown>): ClosingReadiness {
  return {
    id: record.id as string,
    sessionId: (record.sessionId as string | null) ?? null,
    partnerId: (record.partnerId as string | null) ?? null,
    propertyId: record.propertyId as string,
    propertyAddressLabel: record.propertyAddressLabel as string,
    shortlistId: (record.shortlistId as string | null) ?? null,
    financialReadinessId: (record.financialReadinessId as string | null) ?? null,
    offerPreparationId: (record.offerPreparationId as string | null) ?? null,
    offerSubmissionId: (record.offerSubmissionId as string | null) ?? null,
    underContractCoordinationId: record.underContractCoordinationId as string,
    targetClosingDate: (record.targetClosingDate as Date).toISOString(),
    closingAppointmentAt:
      record.closingAppointmentAt ? (record.closingAppointmentAt as Date).toISOString() : null,
    closingAppointmentLocation: (record.closingAppointmentLocation as string | null) ?? null,
    closingAppointmentNotes: (record.closingAppointmentNotes as string | null) ?? null,
    finalReviewDeadline:
      record.finalReviewDeadline ? (record.finalReviewDeadline as Date).toISOString() : null,
    finalFundsConfirmationDeadline:
      record.finalFundsConfirmationDeadline
        ? (record.finalFundsConfirmationDeadline as Date).toISOString()
        : null,
    finalFundsAmountConfirmed: (record.finalFundsAmountConfirmed as number | null) ?? null,
    closedAt: record.closedAt ? (record.closedAt as Date).toISOString() : null,
    notes: (record.notes as string | null) ?? null,
    internalActivityNote: (record.internalActivityNote as string | null) ?? null,
    closingSummary: clone(
      (record.closingSummaryJson as ClosingReadiness["closingSummary"] | null) ?? {
        propertyId: record.propertyId as string,
        propertyAddressLabel: record.propertyAddressLabel as string,
        underContractCoordinationId: record.underContractCoordinationId as string,
        targetClosingDate: (record.targetClosingDate as Date).toISOString(),
        closingAppointmentAt:
          record.closingAppointmentAt ? (record.closingAppointmentAt as Date).toISOString() : null,
        closedAt: record.closedAt ? (record.closedAt as Date).toISOString() : null
      }
    ),
    overallClosingReadinessState:
      record.overallClosingReadinessState as ClosingReadiness["overallClosingReadinessState"],
    overallRiskLevel: record.overallRiskLevel as ClosingReadiness["overallRiskLevel"],
    urgencyLevel: record.urgencyLevel as ClosingReadiness["urgencyLevel"],
    readyToClose: Boolean(record.readyToClose),
    closed: Boolean(record.closed),
    checklistItemSummaries: clone(
      (record.checklistItemsJson as ClosingReadiness["checklistItemSummaries"] | null) ?? []
    ),
    milestoneSummaries: clone(
      (record.milestoneRecordsJson as ClosingReadiness["milestoneSummaries"] | null) ?? []
    ),
    missingItems: clone(
      (record.missingItemsJson as ClosingReadiness["missingItems"] | null) ?? []
    ),
    blockers: clone((record.blockersJson as ClosingReadiness["blockers"] | null) ?? []),
    recommendation: (record.recommendation as string | null) ?? "",
    risk: (record.risk as string | null) ?? "",
    alternative: (record.alternative as string | null) ?? "",
    nextAction: (record.nextAction as string | null) ?? "",
    nextSteps: clone((record.nextStepsJson as string[] | null) ?? []),
    activityLog: clone((record.activityLogJson as ClosingReadiness["activityLog"] | null) ?? []),
    requiresImmediateAttention: Boolean(record.requiresImmediateAttention),
    lastActionAt: record.lastActionAt ? (record.lastActionAt as Date).toISOString() : null,
    lastEvaluatedAt: (record.lastEvaluatedAt as Date).toISOString(),
    createdAt: (record.createdAt as Date).toISOString(),
    updatedAt: (record.updatedAt as Date).toISOString()
  };
}

function mapPrismaWorkflowNotification(record: Record<string, unknown>): WorkflowNotification {
  return {
    id: record.id as string,
    workflowId: (record.workflowId as string | null) ?? null,
    sessionId: (record.sessionId as string | null) ?? null,
    propertyId: (record.propertyId as string | null) ?? null,
    propertyAddressLabel: (record.propertyAddressLabel as string | null) ?? null,
    shortlistId: (record.shortlistId as string | null) ?? null,
    moduleName: record.moduleName as NotificationModuleName,
    alertCategory: record.alertCategory as AlertCategory,
    severity: record.severity as NotificationSeverity,
    status: record.status as NotificationStatus,
    triggeringRuleLabel: record.triggeringRuleLabel as string,
    relatedSubjectType: record.relatedSubjectType as string,
    relatedSubjectId: record.relatedSubjectId as string,
    title: record.title as string,
    message: record.message as string,
    actionLabel: (record.actionLabel as string | null) ?? null,
    actionTarget: clone((record.actionTargetJson as NotificationActionTarget | null) ?? null),
    dueAt: record.dueAt ? (record.dueAt as Date).toISOString() : null,
    readAt: record.readAt ? (record.readAt as Date).toISOString() : null,
    dismissedAt: record.dismissedAt ? (record.dismissedAt as Date).toISOString() : null,
    resolvedAt: record.resolvedAt ? (record.resolvedAt as Date).toISOString() : null,
    explanationSubjectType: (record.explanationSubjectType as string | null) ?? null,
    explanationSubjectId: (record.explanationSubjectId as string | null) ?? null,
    createdAt: (record.createdAt as Date).toISOString(),
    updatedAt: (record.updatedAt as Date).toISOString()
  };
}

function mapPrismaWorkflowNotificationHistoryEvent(
  record: Record<string, unknown>
): WorkflowNotificationHistoryEvent {
  return {
    id: record.id as string,
    notificationId: record.notificationId as string,
    eventType: record.eventType as WorkflowNotificationHistoryEvent["eventType"],
    previousValue: (record.previousValue as string | null) ?? null,
    nextValue: (record.nextValue as string | null) ?? null,
    createdAt: (record.createdAt as Date).toISOString()
  };
}

function mapPrismaUnifiedActivityRecord(record: Record<string, unknown>): UnifiedActivityRecord {
  return {
    id: record.id as string,
    workflowId: (record.workflowId as string | null) ?? null,
    sessionId: (record.sessionId as string | null) ?? null,
    propertyId: (record.propertyId as string | null) ?? null,
    propertyAddressLabel: (record.propertyAddressLabel as string | null) ?? null,
    shortlistId: (record.shortlistId as string | null) ?? null,
    moduleName: record.moduleName as UnifiedActivityModuleName,
    eventCategory: record.eventCategory as UnifiedActivityEventCategory,
    subjectType: record.subjectType as string,
    subjectId: record.subjectId as string,
    title: record.title as string,
    summary: record.summary as string,
    oldValueSnapshot: clone((record.oldValueSnapshotJson as Record<string, unknown> | null) ?? null),
    newValueSnapshot: clone((record.newValueSnapshotJson as Record<string, unknown> | null) ?? null),
    triggerType: record.triggerType as UnifiedActivityTriggerType,
    triggerLabel: record.triggerLabel as string,
    actorType: record.actorType as UnifiedActivityActorType,
    actorId: (record.actorId as string | null) ?? null,
    relatedNotificationId: (record.relatedNotificationId as string | null) ?? null,
    relatedExplanationId: (record.relatedExplanationId as string | null) ?? null,
    createdAt: (record.createdAt as Date).toISOString()
  };
}

function mapPrismaOfferReadiness(record: Record<string, unknown>): OfferReadiness {
  return {
    id: record.id as string,
    propertyId: record.propertyId as string,
    shortlistId: record.shortlistId as string,
    shortlistItemId: (record.shortlistItemId as string | null) ?? null,
    status: record.status as OfferReadinessStatus,
    readinessScore: Number(record.readinessScore ?? 0),
    recommendedOfferPrice: Number(record.recommendedOfferPrice ?? 0),
    confidence: record.confidence as OfferReadiness["confidence"],
    inputs: {
      financingReadiness: record.financingReadiness as OfferFinancingReadiness,
      propertyFitConfidence: record.propertyFitConfidence as OfferPropertyFitConfidence,
      riskToleranceAlignment: record.riskToleranceAlignment as OfferRiskToleranceAlignment,
      riskLevel: record.riskLevel as OfferRiskLevel,
      userConfirmed: Boolean(record.userConfirmed),
      dataCompletenessScore: Number(record.dataCompletenessScore ?? 0)
    },
    blockingIssues: clone((record.blockingIssuesJson as string[] | null) ?? []),
    nextSteps: clone((record.nextStepsJson as string[] | null) ?? []),
    lastEvaluatedAt: (record.lastEvaluatedAt as Date).toISOString(),
    createdAt: (record.createdAt as Date).toISOString(),
    updatedAt: (record.updatedAt as Date).toISOString()
  };
}

function mapPrismaNegotiation(record: Record<string, unknown>): NegotiationRecord {
  return {
    id: record.id as string,
    propertyId: record.propertyId as string,
    shortlistId: (record.shortlistId as string | null) ?? null,
    offerReadinessId: (record.offerReadinessId as string | null) ?? null,
    status: record.status as NegotiationStatus,
    initialOfferPrice: Number(record.initialOfferPrice ?? 0),
    currentOfferPrice: Number(record.currentOfferPrice ?? 0),
    sellerCounterPrice: (record.sellerCounterPrice as number | null) ?? null,
    buyerWalkAwayPrice: (record.buyerWalkAwayPrice as number | null) ?? null,
    roundNumber: Number(record.roundNumber ?? 1),
    guidance: {
      headline: record.guidanceHeadline as string,
      riskLevel: record.guidanceRiskLevel as NegotiationRecord["guidance"]["riskLevel"],
      flags: clone((record.guidanceFlagsJson as string[] | null) ?? []),
      nextSteps: clone((record.guidanceNextStepsJson as string[] | null) ?? [])
    },
    lastActionAt: (record.lastActionAt as Date).toISOString(),
    createdAt: (record.createdAt as Date).toISOString(),
    updatedAt: (record.updatedAt as Date).toISOString()
  };
}

function mapPrismaNegotiationEvent(record: Record<string, unknown>): NegotiationEvent {
  return {
    id: record.id as string,
    negotiationRecordId: record.negotiationRecordId as string,
    type: record.type as NegotiationEventType,
    label: record.label as string,
    details: (record.details as string | null) ?? null,
    createdAt: (record.createdAt as Date).toISOString()
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

  private async syncOfferSubmissionRecord(
    record: Record<string, unknown>
  ): Promise<OfferSubmission> {
    const mapped = mapPrismaOfferSubmission(record);
    const offerPreparationRecord = await this.client.offerPreparation.findUnique({
      where: {
        id: mapped.offerPreparationId
      }
    });
    if (!offerPreparationRecord) {
      return mapped;
    }

    const offerPreparation = mapPrismaOfferPreparation(offerPreparationRecord);
    const financialReadinessRecord = mapped.financialReadinessId
      ? await this.client.financialReadiness.findUnique({
          where: {
            id: mapped.financialReadinessId
          }
        })
      : null;
    const financialReadiness = financialReadinessRecord
      ? mapPrismaFinancialReadiness(financialReadinessRecord)
      : null;
    const now = new Date().toISOString();
    const evaluation = evaluateOfferSubmission({
      now,
      current: mapped,
      offerPreparation,
      financialReadiness
    });

    if (
      mapped.submissionState !== evaluation.submissionState ||
      mapped.isExpired !== evaluation.isExpired ||
      mapped.lastEvaluatedAt !== evaluation.lastEvaluatedAt
    ) {
      const nextActivityLog = clone(mapped.activityLog);
      if (mapped.submissionState !== evaluation.submissionState && evaluation.submissionState === "EXPIRED") {
        nextActivityLog.push({
          type: "offer_expired",
          label: "Offer expired",
          details: "The response window elapsed without a completed response.",
          createdAt: now
        });

        await this.recordValidationEvent({
          eventName: "offer_submission_expired",
          sessionId: mapped.sessionId ?? null,
          payload: {
            shortlistId: mapped.shortlistId ?? null,
            offerPreparationId: mapped.offerPreparationId,
            offerSubmissionId: mapped.id,
            propertyId: mapped.propertyId,
            fromState: mapped.submissionState,
            toState: evaluation.submissionState
          }
        });
      }

      const updated = await this.client.offerSubmission.update({
        where: {
          id: mapped.id
        },
        data: {
          propertyAddressLabel: evaluation.propertyAddressLabel,
          submissionMethod: evaluation.submissionMethod,
          submittedAt: evaluation.submittedAt ? new Date(evaluation.submittedAt) : null,
          offerExpirationAt: evaluation.offerExpirationAt ? new Date(evaluation.offerExpirationAt) : null,
          sellerResponseState: evaluation.sellerResponseState,
          sellerRespondedAt: evaluation.sellerRespondedAt ? new Date(evaluation.sellerRespondedAt) : null,
          buyerCounterDecision: evaluation.buyerCounterDecision,
          withdrawnAt: evaluation.withdrawnAt ? new Date(evaluation.withdrawnAt) : null,
          withdrawalReason: evaluation.withdrawalReason,
          notes: evaluation.notes ?? null,
          internalActivityNote: evaluation.internalActivityNote ?? null,
          counterofferPrice: evaluation.counterofferPrice,
          counterofferClosingTimelineDays: evaluation.counterofferClosingTimelineDays,
          counterofferFinancingContingency: evaluation.counterofferFinancingContingency,
          counterofferInspectionContingency: evaluation.counterofferInspectionContingency,
          counterofferAppraisalContingency: evaluation.counterofferAppraisalContingency,
          counterofferExpirationAt: evaluation.counterofferExpirationAt
            ? new Date(evaluation.counterofferExpirationAt)
            : null,
          submissionSummaryJson: evaluation.submissionSummary,
          submissionState: evaluation.submissionState,
          urgencyLevel: evaluation.urgencyLevel,
          counterofferSummaryJson: evaluation.counterofferSummary,
          missingItemsJson: evaluation.missingItems,
          blockersJson: evaluation.blockers,
          recommendation: evaluation.recommendation,
          risk: evaluation.risk,
          alternative: evaluation.alternative,
          nextAction: evaluation.nextAction,
          nextStepsJson: evaluation.nextSteps,
          requiresBuyerResponse: evaluation.requiresBuyerResponse,
          isExpired: evaluation.isExpired,
          activityLogJson: nextActivityLog,
          lastActionAt: evaluation.lastActionAt ? new Date(evaluation.lastActionAt) : null,
          lastEvaluatedAt: new Date(now)
        }
      });

      return mapPrismaOfferSubmission(updated);
    }

    return mapped;
  }

  private async syncUnderContractRecord(
    record: Record<string, unknown>
  ): Promise<UnderContractCoordination> {
    const mapped = mapPrismaUnderContractCoordination(record);
    const offerSubmissionRecord = await this.client.offerSubmission.findUnique({
      where: {
        id: mapped.offerSubmissionId
      }
    });
    if (!offerSubmissionRecord) {
      return mapped;
    }

    const offerSubmission = await this.syncOfferSubmissionRecord(offerSubmissionRecord);
    const offerPreparationRecord = mapped.offerPreparationId
      ? await this.client.offerPreparation.findUnique({
          where: {
            id: mapped.offerPreparationId
          }
        })
      : await this.client.offerPreparation.findUnique({
          where: {
            id: offerSubmission.offerPreparationId
          }
        });
    const offerPreparation = offerPreparationRecord
      ? mapPrismaOfferPreparation(offerPreparationRecord)
      : null;
    const financialReadinessRecord = mapped.financialReadinessId
      ? await this.client.financialReadiness.findUnique({
          where: {
            id: mapped.financialReadinessId
          }
        })
      : null;
    const financialReadiness = financialReadinessRecord
      ? mapPrismaFinancialReadiness(financialReadinessRecord)
      : null;
    const now = new Date().toISOString();
    const evaluation = evaluateUnderContractCoordination({
      now,
      current: mapped,
      offerSubmission,
      offerPreparation,
      financialReadiness
    });

    if (
      mapped.overallCoordinationState !== evaluation.overallCoordinationState ||
      mapped.readyForClosing !== evaluation.readyForClosing ||
      mapped.lastEvaluatedAt !== evaluation.lastEvaluatedAt
    ) {
      const nextActivityLog = clone(mapped.activityLog);
      if (
        mapped.overallCoordinationState !== evaluation.overallCoordinationState &&
        evaluation.overallCoordinationState === "READY_FOR_CLOSING"
      ) {
        nextActivityLog.push({
          type: "ready_for_closing",
          label: "Ready for closing",
          details: "All required pre-closing contract tasks are complete or validly waived.",
          createdAt: now
        });

        await this.recordValidationEvent({
          eventName: "under_contract_ready_for_closing",
          sessionId: mapped.sessionId ?? null,
          payload: {
            shortlistId: mapped.shortlistId ?? null,
            offerPreparationId: mapped.offerPreparationId ?? null,
            offerSubmissionId: mapped.offerSubmissionId,
            underContractId: mapped.id,
            propertyId: mapped.propertyId,
            fromState: mapped.overallCoordinationState,
            toState: evaluation.overallCoordinationState
          }
        });
      } else if (
        mapped.overallCoordinationState !== evaluation.overallCoordinationState &&
        evaluation.overallCoordinationState === "BLOCKED"
      ) {
        nextActivityLog.push({
          type: "blocked",
          label: "Contract workflow blocked",
          details: evaluation.nextAction,
          createdAt: now
        });

        await this.recordValidationEvent({
          eventName: "under_contract_blocked",
          sessionId: mapped.sessionId ?? null,
          payload: {
            shortlistId: mapped.shortlistId ?? null,
            offerPreparationId: mapped.offerPreparationId ?? null,
            offerSubmissionId: mapped.offerSubmissionId,
            underContractId: mapped.id,
            propertyId: mapped.propertyId,
            fromState: mapped.overallCoordinationState,
            toState: evaluation.overallCoordinationState
          }
        });
      }

      const updated = await this.client.underContractCoordination.update({
        where: {
          id: mapped.id
        },
        data: {
          propertyAddressLabel: evaluation.propertyAddressLabel,
          acceptedAt: new Date(evaluation.acceptedAt),
          targetClosingDate: new Date(evaluation.targetClosingDate),
          inspectionDeadline: evaluation.inspectionDeadline ? new Date(evaluation.inspectionDeadline) : null,
          appraisalDeadline: evaluation.appraisalDeadline ? new Date(evaluation.appraisalDeadline) : null,
          financingDeadline: evaluation.financingDeadline ? new Date(evaluation.financingDeadline) : null,
          contingencyDeadline: evaluation.contingencyDeadline ? new Date(evaluation.contingencyDeadline) : null,
          closingPreparationDeadline: evaluation.closingPreparationDeadline
            ? new Date(evaluation.closingPreparationDeadline)
            : null,
          notes: evaluation.notes ?? null,
          internalActivityNote: evaluation.internalActivityNote ?? null,
          coordinationSummaryJson: evaluation.coordinationSummary,
          overallCoordinationState: evaluation.overallCoordinationState,
          overallRiskLevel: evaluation.overallRiskLevel,
          urgencyLevel: evaluation.urgencyLevel,
          readyForClosing: evaluation.readyForClosing,
          requiresImmediateAttention: evaluation.requiresImmediateAttention,
          taskRecordsJson: evaluation.taskSummaries,
          milestoneRecordsJson: evaluation.milestoneSummaries,
          deadlineRecordsJson: evaluation.deadlineSummaries,
          missingItemsJson: evaluation.missingItems,
          blockersJson: evaluation.blockers,
          recommendation: evaluation.recommendation,
          risk: evaluation.risk,
          alternative: evaluation.alternative,
          nextAction: evaluation.nextAction,
          nextStepsJson: evaluation.nextSteps,
          activityLogJson: nextActivityLog,
          lastActionAt: evaluation.lastActionAt ? new Date(evaluation.lastActionAt) : null,
          lastEvaluatedAt: new Date(now)
        }
      });

      return mapPrismaUnderContractCoordination(updated);
    }

    return mapped;
  }

  private async syncClosingReadinessRecord(
    record: Record<string, unknown>
  ): Promise<ClosingReadiness> {
    const mapped = mapPrismaClosingReadiness(record);
    const underContractRecord = await this.client.underContractCoordination.findUnique({
      where: {
        id: mapped.underContractCoordinationId
      }
    });
    if (!underContractRecord) {
      return mapped;
    }

    const underContract = await this.syncUnderContractRecord(underContractRecord);
    const offerSubmissionRecord = mapped.offerSubmissionId
      ? await this.client.offerSubmission.findUnique({
          where: {
            id: mapped.offerSubmissionId
          }
        })
      : null;
    const offerSubmission = offerSubmissionRecord
      ? await this.syncOfferSubmissionRecord(offerSubmissionRecord)
      : null;
    const offerPreparationRecord = mapped.offerPreparationId
      ? await this.client.offerPreparation.findUnique({
          where: {
            id: mapped.offerPreparationId
          }
        })
      : null;
    const offerPreparation = offerPreparationRecord ? mapPrismaOfferPreparation(offerPreparationRecord) : null;
    const financialReadinessRecord = mapped.financialReadinessId
      ? await this.client.financialReadiness.findUnique({
          where: {
            id: mapped.financialReadinessId
          }
        })
      : null;
    const financialReadiness = financialReadinessRecord
      ? mapPrismaFinancialReadiness(financialReadinessRecord)
      : null;
    const now = new Date().toISOString();
    const evaluation = evaluateClosingReadiness({
      now,
      current: mapped,
      underContract,
      offerSubmission,
      offerPreparation,
      financialReadiness
    });

    if (
      mapped.overallClosingReadinessState !== evaluation.overallClosingReadinessState ||
      mapped.readyToClose !== evaluation.readyToClose ||
      mapped.closed !== evaluation.closed ||
      mapped.lastEvaluatedAt !== evaluation.lastEvaluatedAt
    ) {
      const nextActivityLog = clone(mapped.activityLog);
      if (
        mapped.overallClosingReadinessState !== evaluation.overallClosingReadinessState &&
        evaluation.overallClosingReadinessState === "READY_TO_CLOSE"
      ) {
        nextActivityLog.push({
          type: "ready_to_close",
          label: "Ready to close",
          details: "All required final closing items are complete or validly waived.",
          createdAt: now
        });
        await this.recordValidationEvent({
          eventName: "closing_ready_to_close",
          sessionId: mapped.sessionId ?? null,
          payload: {
            shortlistId: mapped.shortlistId ?? null,
            offerPreparationId: mapped.offerPreparationId ?? null,
            offerSubmissionId: mapped.offerSubmissionId ?? null,
            underContractId: mapped.underContractCoordinationId,
            closingReadinessId: mapped.id,
            propertyId: mapped.propertyId,
            fromState: mapped.overallClosingReadinessState,
            toState: evaluation.overallClosingReadinessState
          }
        });
      } else if (
        mapped.overallClosingReadinessState !== evaluation.overallClosingReadinessState &&
        evaluation.overallClosingReadinessState === "BLOCKED"
      ) {
        nextActivityLog.push({
          type: "blocked",
          label: "Closing readiness blocked",
          details: evaluation.nextAction,
          createdAt: now
        });
        await this.recordValidationEvent({
          eventName: "closing_blocked",
          sessionId: mapped.sessionId ?? null,
          payload: {
            shortlistId: mapped.shortlistId ?? null,
            offerPreparationId: mapped.offerPreparationId ?? null,
            offerSubmissionId: mapped.offerSubmissionId ?? null,
            underContractId: mapped.underContractCoordinationId,
            closingReadinessId: mapped.id,
            propertyId: mapped.propertyId,
            fromState: mapped.overallClosingReadinessState,
            toState: evaluation.overallClosingReadinessState
          }
        });
      } else if (
        mapped.overallClosingReadinessState !== evaluation.overallClosingReadinessState &&
        evaluation.overallClosingReadinessState === "CLOSED"
      ) {
        nextActivityLog.push({
          type: "closed",
          label: "Closing marked complete",
          details: null,
          createdAt: now
        });
        await this.recordValidationEvent({
          eventName: "closing_completed",
          sessionId: mapped.sessionId ?? null,
          payload: {
            shortlistId: mapped.shortlistId ?? null,
            offerPreparationId: mapped.offerPreparationId ?? null,
            offerSubmissionId: mapped.offerSubmissionId ?? null,
            underContractId: mapped.underContractCoordinationId,
            closingReadinessId: mapped.id,
            propertyId: mapped.propertyId,
            fromState: mapped.overallClosingReadinessState,
            toState: evaluation.overallClosingReadinessState
          }
        });
      }

      const updated = await this.client.closingReadiness.update({
        where: {
          id: mapped.id
        },
        data: {
          propertyAddressLabel: evaluation.propertyAddressLabel,
          targetClosingDate: new Date(evaluation.targetClosingDate),
          closingAppointmentAt: evaluation.closingAppointmentAt
            ? new Date(evaluation.closingAppointmentAt)
            : null,
          closingAppointmentLocation: evaluation.closingAppointmentLocation ?? null,
          closingAppointmentNotes: evaluation.closingAppointmentNotes ?? null,
          finalReviewDeadline: evaluation.finalReviewDeadline ? new Date(evaluation.finalReviewDeadline) : null,
          finalFundsConfirmationDeadline: evaluation.finalFundsConfirmationDeadline
            ? new Date(evaluation.finalFundsConfirmationDeadline)
            : null,
          finalFundsAmountConfirmed: evaluation.finalFundsAmountConfirmed ?? null,
          closedAt: evaluation.closedAt ? new Date(evaluation.closedAt) : null,
          notes: evaluation.notes ?? null,
          internalActivityNote: evaluation.internalActivityNote ?? null,
          closingSummaryJson: evaluation.closingSummary,
          overallClosingReadinessState: evaluation.overallClosingReadinessState,
          overallRiskLevel: evaluation.overallRiskLevel,
          urgencyLevel: evaluation.urgencyLevel,
          readyToClose: evaluation.readyToClose,
          closed: evaluation.closed,
          checklistItemsJson: evaluation.checklistItemSummaries,
          milestoneRecordsJson: evaluation.milestoneSummaries,
          missingItemsJson: evaluation.missingItems,
          blockersJson: evaluation.blockers,
          recommendation: evaluation.recommendation,
          risk: evaluation.risk,
          alternative: evaluation.alternative,
          nextAction: evaluation.nextAction,
          nextStepsJson: evaluation.nextSteps,
          activityLogJson: nextActivityLog,
          requiresImmediateAttention: evaluation.requiresImmediateAttention,
          lastActionAt: evaluation.lastActionAt ? new Date(evaluation.lastActionAt) : null,
          lastEvaluatedAt: new Date(now)
        }
      });

      return mapPrismaClosingReadiness(updated);
    }

    return mapped;
  }

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

  async createFinancialReadiness(payload: {
    sessionId?: string | null;
    partnerId?: string | null;
    annualHouseholdIncome: number | null;
    monthlyDebtPayments: number | null;
    availableCashSavings: number | null;
    creditScoreRange: CreditScoreRange | null;
    desiredHomePrice: number | null;
    purchaseLocation: string | null;
    downPaymentPreferencePercent?: number | null;
    loanType?: LoanType | null;
    preApprovalStatus: PreApprovalStatus | null;
    preApprovalExpiresAt?: string | null;
    proofOfFundsStatus: ProofOfFundsStatus | null;
  }): Promise<FinancialReadiness> {
    const now = new Date().toISOString();
    const evaluation = evaluateFinancialReadiness({
      now,
      sessionId: payload.sessionId ?? null,
      partnerId: payload.partnerId ?? null,
      patch: payload
    });

    const record = await this.client.financialReadiness.create({
      data: {
        sessionId: evaluation.sessionId ?? null,
        partnerId: evaluation.partnerId ?? null,
        annualHouseholdIncome: evaluation.annualHouseholdIncome,
        monthlyDebtPayments: evaluation.monthlyDebtPayments,
        availableCashSavings: evaluation.availableCashSavings,
        creditScoreRange: evaluation.creditScoreRange,
        desiredHomePrice: evaluation.desiredHomePrice,
        purchaseLocation: evaluation.purchaseLocation,
        downPaymentPreferencePercent: evaluation.downPaymentPreferencePercent,
        loanType: evaluation.loanType,
        preApprovalStatus: evaluation.preApprovalStatus,
        preApprovalExpiresAt: evaluation.preApprovalExpiresAt ? new Date(evaluation.preApprovalExpiresAt) : null,
        proofOfFundsStatus: evaluation.proofOfFundsStatus,
        maxAffordableHomePrice: evaluation.maxAffordableHomePrice,
        estimatedMonthlyPayment: evaluation.estimatedMonthlyPayment,
        estimatedDownPayment: evaluation.estimatedDownPayment,
        estimatedClosingCosts: evaluation.estimatedClosingCosts,
        totalCashRequiredToClose: evaluation.totalCashRequiredToClose,
        debtToIncomeRatio: evaluation.debtToIncomeRatio,
        housingRatio: evaluation.housingRatio,
        affordabilityClassification: evaluation.affordabilityClassification,
        readinessState: evaluation.readinessState,
        blockersJson: evaluation.blockers,
        recommendation: evaluation.recommendation,
        risk: evaluation.risk,
        alternative: evaluation.alternative,
        nextAction: evaluation.nextAction,
        nextStepsJson: evaluation.nextSteps,
        assumptionsJson: evaluation.assumptionsUsed,
        lastEvaluatedAt: new Date(now)
      }
    });

    await this.recordValidationEvent({
      eventName: "financial_readiness_created",
      sessionId: evaluation.sessionId ?? null,
      payload: {
        financialReadinessId: record.id as string,
        readinessState: evaluation.readinessState,
        affordabilityClassification: evaluation.affordabilityClassification
      }
    });

    return mapPrismaFinancialReadiness(record);
  }

  async getFinancialReadiness(id: string): Promise<FinancialReadiness | null> {
    const record = await this.client.financialReadiness.findUnique({
      where: {
        id
      }
    });

    return record ? mapPrismaFinancialReadiness(record) : null;
  }

  async getLatestFinancialReadiness(sessionId?: string | null): Promise<FinancialReadiness | null> {
    if (!sessionId) {
      return null;
    }

    const record = await this.client.financialReadiness.findFirst({
      where: {
        sessionId
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    return record ? mapPrismaFinancialReadiness(record) : null;
  }

  async updateFinancialReadiness(
    id: string,
    patch: {
      annualHouseholdIncome?: number | null;
      monthlyDebtPayments?: number | null;
      availableCashSavings?: number | null;
      creditScoreRange?: CreditScoreRange | null;
      desiredHomePrice?: number | null;
      purchaseLocation?: string | null;
      downPaymentPreferencePercent?: number | null;
      loanType?: LoanType | null;
      preApprovalStatus?: PreApprovalStatus | null;
      preApprovalExpiresAt?: string | null;
      proofOfFundsStatus?: ProofOfFundsStatus | null;
    }
  ): Promise<FinancialReadiness | null> {
    const existing = await this.client.financialReadiness.findUnique({
      where: {
        id
      }
    });
    if (!existing) {
      return null;
    }

    const current = mapPrismaFinancialReadiness(existing);
    const now = new Date().toISOString();
    const previousState = current.readinessState;
    const evaluation = evaluateFinancialReadiness({
      now,
      current,
      patch
    });

    const record = await this.client.financialReadiness.update({
      where: {
        id
      },
      data: {
        sessionId: evaluation.sessionId ?? null,
        partnerId: evaluation.partnerId ?? null,
        annualHouseholdIncome: evaluation.annualHouseholdIncome,
        monthlyDebtPayments: evaluation.monthlyDebtPayments,
        availableCashSavings: evaluation.availableCashSavings,
        creditScoreRange: evaluation.creditScoreRange,
        desiredHomePrice: evaluation.desiredHomePrice,
        purchaseLocation: evaluation.purchaseLocation,
        downPaymentPreferencePercent: evaluation.downPaymentPreferencePercent,
        loanType: evaluation.loanType,
        preApprovalStatus: evaluation.preApprovalStatus,
        preApprovalExpiresAt: evaluation.preApprovalExpiresAt ? new Date(evaluation.preApprovalExpiresAt) : null,
        proofOfFundsStatus: evaluation.proofOfFundsStatus,
        maxAffordableHomePrice: evaluation.maxAffordableHomePrice,
        estimatedMonthlyPayment: evaluation.estimatedMonthlyPayment,
        estimatedDownPayment: evaluation.estimatedDownPayment,
        estimatedClosingCosts: evaluation.estimatedClosingCosts,
        totalCashRequiredToClose: evaluation.totalCashRequiredToClose,
        debtToIncomeRatio: evaluation.debtToIncomeRatio,
        housingRatio: evaluation.housingRatio,
        affordabilityClassification: evaluation.affordabilityClassification,
        readinessState: evaluation.readinessState,
        blockersJson: evaluation.blockers,
        recommendation: evaluation.recommendation,
        risk: evaluation.risk,
        alternative: evaluation.alternative,
        nextAction: evaluation.nextAction,
        nextStepsJson: evaluation.nextSteps,
        assumptionsJson: evaluation.assumptionsUsed,
        lastEvaluatedAt: new Date(now)
      }
    });

    await this.recordValidationEvent({
      eventName: "financial_readiness_updated",
      sessionId: evaluation.sessionId ?? null,
      payload: {
        financialReadinessId: id,
        readinessState: evaluation.readinessState,
        affordabilityClassification: evaluation.affordabilityClassification
      }
    });

    if (previousState !== evaluation.readinessState) {
      await this.recordValidationEvent({
        eventName: "financial_readiness_status_changed",
        sessionId: evaluation.sessionId ?? null,
        payload: {
          financialReadinessId: id,
          fromState: previousState,
          toState: evaluation.readinessState
        }
      });
    }

    return mapPrismaFinancialReadiness(record);
  }

  async getFinancialReadinessSummary(id: string): Promise<FinancialReadinessSummary | null> {
    const record = await this.getFinancialReadiness(id);
    return record ? toFinancialReadinessSummary(record) : null;
  }

  async createOfferPreparation(
    payload: OfferPreparationInputs & {
      sessionId?: string | null;
      partnerId?: string | null;
    }
  ): Promise<OfferPreparation | null> {
    const financialReadinessRecord = await this.client.financialReadiness.findUnique({
      where: {
        id: payload.financialReadinessId
      }
    });
    if (!financialReadinessRecord) {
      return null;
    }

    const existing = await this.client.offerPreparation.findFirst({
      where: {
        propertyId: payload.propertyId,
        ...(payload.shortlistId ? { shortlistId: payload.shortlistId } : {})
      }
    });
    if (existing) {
      return mapPrismaOfferPreparation(existing);
    }

    const financialReadiness = mapPrismaFinancialReadiness(financialReadinessRecord);
    const selectedChoiceSummary = payload.shortlistId
      ? await this.getSelectedChoiceSummary(payload.shortlistId)
      : null;
    const activeOfferStrategy =
      selectedChoiceSummary?.property?.canonicalPropertyId === payload.propertyId
        ? selectedChoiceSummary.offerStrategy
        : null;
    const offerReadiness = payload.offerReadinessId
      ? await this.client.offerReadiness.findUnique({
          where: {
            id: payload.offerReadinessId
          }
        })
      : await this.client.offerReadiness.findFirst({
          where: {
            propertyId: payload.propertyId,
            ...(payload.shortlistId ? { shortlistId: payload.shortlistId } : {})
          }
        });
    const recommendedOfferPrice = offerReadiness
      ? mapPrismaOfferReadiness(offerReadiness).recommendedOfferPrice
      : null;

    const now = new Date().toISOString();
    const strategyApplication = applyOfferPreparationStrategyDefaults({
      payload,
      strategy: activeOfferStrategy,
      selectedItemId: selectedChoiceSummary?.selectedItemId ?? null,
      shortlistId: payload.shortlistId ?? null,
      propertyId: payload.propertyId,
      now
    });
    const evaluation = evaluateOfferPreparation({
      now,
      financialReadiness,
      recommendedOfferPrice,
      sessionId: payload.sessionId ?? financialReadiness.sessionId ?? null,
      partnerId: payload.partnerId ?? financialReadiness.partnerId ?? null,
      patch: strategyApplication.patch
    });

    const record = await this.client.offerPreparation.create({
      data: {
        sessionId: evaluation.sessionId ?? null,
        partnerId: evaluation.partnerId ?? null,
        propertyId: evaluation.propertyId,
        propertyAddressLabel: evaluation.propertyAddressLabel,
        shortlistId: evaluation.shortlistId ?? null,
        offerReadinessId: evaluation.offerReadinessId ?? null,
        financialReadinessId: evaluation.financialReadinessId,
        offerPrice: evaluation.offerPrice,
        earnestMoneyAmount: evaluation.earnestMoneyAmount,
        downPaymentType: evaluation.downPaymentType,
        downPaymentAmount: evaluation.downPaymentAmount,
        downPaymentPercent: evaluation.downPaymentPercent,
        financingContingency: evaluation.financingContingency,
        inspectionContingency: evaluation.inspectionContingency,
        appraisalContingency: evaluation.appraisalContingency,
        closingTimelineDays: evaluation.closingTimelineDays,
        possessionTiming: evaluation.possessionTiming ?? null,
        possessionDaysAfterClosing: evaluation.possessionDaysAfterClosing ?? null,
        sellerConcessionsRequestedAmount: evaluation.sellerConcessionsRequestedAmount ?? null,
        notes: evaluation.notes ?? null,
        buyerRationale: evaluation.buyerRationale ?? null,
        offerSummaryJson: evaluation.offerSummary,
        offerState: evaluation.offerState,
        offerRiskLevel: evaluation.offerRiskLevel,
        offerCompletenessState: evaluation.offerCompletenessState,
        readinessToSubmit: evaluation.readinessToSubmit,
        cashRequiredAtOffer: evaluation.cashRequiredAtOffer,
        missingItemsJson: evaluation.missingItems,
        blockersJson: evaluation.blockers,
        recommendation: evaluation.recommendation,
        risk: evaluation.risk,
        alternative: evaluation.alternative,
        nextAction: evaluation.nextAction,
        nextStepsJson: evaluation.nextSteps,
        financialAlignmentJson: evaluation.financialAlignment,
        assumptionsJson: evaluation.assumptionsUsed,
        strategyDefaultsProvenanceJson: strategyApplication.provenance,
        lastEvaluatedAt: new Date(now)
      }
    });

    await this.recordValidationEvent({
      eventName: "offer_preparation_created",
      sessionId: evaluation.sessionId ?? null,
      payload: {
        offerPreparationId: record.id as string,
        propertyId: evaluation.propertyId,
        shortlistId: evaluation.shortlistId ?? null,
        offerState: evaluation.offerState,
        strategyDefaultsAppliedFields: strategyApplication.provenance?.appliedFieldKeys ?? []
      }
    });

    return mapPrismaOfferPreparation(record);
  }

  async listOfferPreparations(shortlistId: string): Promise<OfferPreparation[]> {
    const records = await this.client.offerPreparation.findMany({
      where: {
        shortlistId
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    return records.map((record) => mapPrismaOfferPreparation(record));
  }

  async getOfferPreparation(id: string): Promise<OfferPreparation | null> {
    const record = await this.client.offerPreparation.findUnique({
      where: {
        id
      }
    });

    return record ? mapPrismaOfferPreparation(record) : null;
  }

  async getLatestOfferPreparation(payload: {
    propertyId: string;
    shortlistId?: string | null;
    sessionId?: string | null;
  }): Promise<OfferPreparation | null> {
    const record = await this.client.offerPreparation.findFirst({
      where: {
        propertyId: payload.propertyId,
        ...(payload.shortlistId ? { shortlistId: payload.shortlistId } : {}),
        ...(payload.sessionId ? { sessionId: payload.sessionId } : {})
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    return record ? mapPrismaOfferPreparation(record) : null;
  }

  async updateOfferPreparation(
    id: string,
    patch: {
      propertyAddressLabel?: string;
      offerPrice?: number | null;
      earnestMoneyAmount?: number | null;
      downPaymentType?: OfferPreparationDownPaymentType | null;
      downPaymentAmount?: number | null;
      downPaymentPercent?: number | null;
      financingContingency?: OfferPreparationContingency | null;
      inspectionContingency?: OfferPreparationContingency | null;
      appraisalContingency?: OfferPreparationContingency | null;
      closingTimelineDays?: number | null;
      possessionTiming?: OfferPreparationPossessionTiming | null;
      possessionDaysAfterClosing?: number | null;
      sellerConcessionsRequestedAmount?: number | null;
      notes?: string | null;
      buyerRationale?: string | null;
    }
  ): Promise<OfferPreparation | null> {
    const existing = await this.client.offerPreparation.findUnique({
      where: {
        id
      }
    });
    if (!existing) {
      return null;
    }

    const current = mapPrismaOfferPreparation(existing);
    const financialReadinessRecord = await this.client.financialReadiness.findUnique({
      where: {
        id: current.financialReadinessId
      }
    });
    if (!financialReadinessRecord) {
      return null;
    }

    const financialReadiness = mapPrismaFinancialReadiness(financialReadinessRecord);
    const offerReadinessRecord = current.offerReadinessId
      ? await this.client.offerReadiness.findUnique({
          where: {
            id: current.offerReadinessId
          }
        })
      : await this.client.offerReadiness.findFirst({
          where: {
            propertyId: current.propertyId,
            ...(current.shortlistId ? { shortlistId: current.shortlistId } : {})
          }
        });
    const recommendedOfferPrice = offerReadinessRecord
      ? mapPrismaOfferReadiness(offerReadinessRecord).recommendedOfferPrice
      : null;

    const now = new Date().toISOString();
    const previousState = current.offerState;
    const evaluation = evaluateOfferPreparation({
      now,
      current,
      patch,
      financialReadiness,
      recommendedOfferPrice
    });

    const record = await this.client.offerPreparation.update({
      where: {
        id
      },
      data: {
        sessionId: evaluation.sessionId ?? null,
        partnerId: evaluation.partnerId ?? null,
        propertyId: evaluation.propertyId,
        propertyAddressLabel: evaluation.propertyAddressLabel,
        shortlistId: evaluation.shortlistId ?? null,
        offerReadinessId: evaluation.offerReadinessId ?? null,
        financialReadinessId: evaluation.financialReadinessId,
        offerPrice: evaluation.offerPrice,
        earnestMoneyAmount: evaluation.earnestMoneyAmount,
        downPaymentType: evaluation.downPaymentType,
        downPaymentAmount: evaluation.downPaymentAmount,
        downPaymentPercent: evaluation.downPaymentPercent,
        financingContingency: evaluation.financingContingency,
        inspectionContingency: evaluation.inspectionContingency,
        appraisalContingency: evaluation.appraisalContingency,
        closingTimelineDays: evaluation.closingTimelineDays,
        possessionTiming: evaluation.possessionTiming ?? null,
        possessionDaysAfterClosing: evaluation.possessionDaysAfterClosing ?? null,
        sellerConcessionsRequestedAmount: evaluation.sellerConcessionsRequestedAmount ?? null,
        notes: evaluation.notes ?? null,
        buyerRationale: evaluation.buyerRationale ?? null,
        offerSummaryJson: evaluation.offerSummary,
        offerState: evaluation.offerState,
        offerRiskLevel: evaluation.offerRiskLevel,
        offerCompletenessState: evaluation.offerCompletenessState,
        readinessToSubmit: evaluation.readinessToSubmit,
        cashRequiredAtOffer: evaluation.cashRequiredAtOffer,
        missingItemsJson: evaluation.missingItems,
        blockersJson: evaluation.blockers,
        recommendation: evaluation.recommendation,
        risk: evaluation.risk,
        alternative: evaluation.alternative,
        nextAction: evaluation.nextAction,
        nextStepsJson: evaluation.nextSteps,
        financialAlignmentJson: evaluation.financialAlignment,
        assumptionsJson: evaluation.assumptionsUsed,
        strategyDefaultsProvenanceJson: evaluation.strategyDefaultsProvenance,
        lastEvaluatedAt: new Date(now)
      }
    });

    await this.recordValidationEvent({
      eventName: "offer_preparation_updated",
      sessionId: evaluation.sessionId ?? null,
      payload: {
        offerPreparationId: id,
        propertyId: evaluation.propertyId,
        offerState: evaluation.offerState
      }
    });

    if (previousState !== evaluation.offerState) {
      await this.recordValidationEvent({
        eventName: "offer_preparation_status_changed",
        sessionId: evaluation.sessionId ?? null,
        payload: {
          offerPreparationId: id,
          propertyId: evaluation.propertyId,
          fromState: previousState,
          toState: evaluation.offerState
        }
      });
    }

    return mapPrismaOfferPreparation(record);
  }

  async getOfferPreparationSummary(id: string): Promise<OfferPreparationSummary | null> {
    const record = await this.getOfferPreparation(id);
    return record ? toOfferPreparationSummary(record) : null;
  }

  async createOfferSubmission(
    payload: OfferSubmissionInputs & {
      sessionId?: string | null;
      partnerId?: string | null;
    }
  ): Promise<OfferSubmission | null> {
    const offerPreparationRecord = await this.client.offerPreparation.findUnique({
      where: {
        id: payload.offerPreparationId
      }
    });
    if (!offerPreparationRecord) {
      return null;
    }

    const existing = await this.client.offerSubmission.findFirst({
      where: {
        propertyId: payload.propertyId,
        ...(payload.shortlistId ? { shortlistId: payload.shortlistId } : {})
      }
    });
    if (existing) {
      return this.syncOfferSubmissionRecord(existing);
    }

    const offerPreparation = mapPrismaOfferPreparation(offerPreparationRecord);
    const financialReadinessRecord = await this.client.financialReadiness.findUnique({
      where: {
        id: payload.financialReadinessId ?? offerPreparation.financialReadinessId
      }
    });
    const financialReadiness = financialReadinessRecord
      ? mapPrismaFinancialReadiness(financialReadinessRecord)
      : null;
    const now = new Date().toISOString();
    const evaluation = evaluateOfferSubmission({
      now,
      offerPreparation,
      financialReadiness,
      sessionId: payload.sessionId ?? offerPreparation.sessionId ?? null,
      partnerId: payload.partnerId ?? offerPreparation.partnerId ?? null,
      patch: payload
    });

    const activityLog: OfferSubmission["activityLog"] = [
      {
        type: "record_created",
        label: "Submission record created",
        details: null,
        createdAt: now
      }
    ];

    const record = await this.client.offerSubmission.create({
      data: {
        sessionId: evaluation.sessionId ?? null,
        partnerId: evaluation.partnerId ?? null,
        propertyId: evaluation.propertyId,
        propertyAddressLabel: evaluation.propertyAddressLabel,
        shortlistId: evaluation.shortlistId ?? null,
        financialReadinessId: evaluation.financialReadinessId ?? null,
        offerPreparationId: evaluation.offerPreparationId,
        submissionMethod: evaluation.submissionMethod ?? null,
        submittedAt: evaluation.submittedAt ? new Date(evaluation.submittedAt) : null,
        offerExpirationAt: evaluation.offerExpirationAt ? new Date(evaluation.offerExpirationAt) : null,
        sellerResponseState: evaluation.sellerResponseState,
        sellerRespondedAt: evaluation.sellerRespondedAt ? new Date(evaluation.sellerRespondedAt) : null,
        buyerCounterDecision: evaluation.buyerCounterDecision ?? null,
        withdrawnAt: evaluation.withdrawnAt ? new Date(evaluation.withdrawnAt) : null,
        withdrawalReason: evaluation.withdrawalReason ?? null,
        notes: evaluation.notes ?? null,
        internalActivityNote: evaluation.internalActivityNote ?? null,
        originalOfferSnapshotJson: evaluation.originalOfferSnapshot,
        submissionSummaryJson: evaluation.submissionSummary,
        submissionState: evaluation.submissionState,
        urgencyLevel: evaluation.urgencyLevel,
        counterofferPrice: evaluation.counterofferPrice ?? null,
        counterofferClosingTimelineDays: evaluation.counterofferClosingTimelineDays ?? null,
        counterofferFinancingContingency: evaluation.counterofferFinancingContingency ?? null,
        counterofferInspectionContingency: evaluation.counterofferInspectionContingency ?? null,
        counterofferAppraisalContingency: evaluation.counterofferAppraisalContingency ?? null,
        counterofferExpirationAt: evaluation.counterofferExpirationAt
          ? new Date(evaluation.counterofferExpirationAt)
          : null,
        counterofferSummaryJson: evaluation.counterofferSummary,
        missingItemsJson: evaluation.missingItems,
        blockersJson: evaluation.blockers,
        recommendation: evaluation.recommendation,
        risk: evaluation.risk,
        alternative: evaluation.alternative,
        nextAction: evaluation.nextAction,
        nextStepsJson: evaluation.nextSteps,
        requiresBuyerResponse: evaluation.requiresBuyerResponse,
        isExpired: evaluation.isExpired,
        activityLogJson: activityLog,
        lastActionAt: evaluation.lastActionAt ? new Date(evaluation.lastActionAt) : null,
        lastEvaluatedAt: new Date(now)
      }
    });

    await this.recordValidationEvent({
      eventName: "offer_submission_created",
      sessionId: evaluation.sessionId ?? null,
      payload: {
        shortlistId: evaluation.shortlistId ?? null,
        offerPreparationId: evaluation.offerPreparationId,
        offerSubmissionId: record.id as string,
        propertyId: evaluation.propertyId,
        submissionState: evaluation.submissionState
      }
    });

    return mapPrismaOfferSubmission(record);
  }

  async listOfferSubmissions(shortlistId: string): Promise<OfferSubmission[]> {
    const records = await this.client.offerSubmission.findMany({
      where: {
        shortlistId
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    return Promise.all(records.map((record) => this.syncOfferSubmissionRecord(record)));
  }

  async getOfferSubmission(id: string): Promise<OfferSubmission | null> {
    const record = await this.client.offerSubmission.findUnique({
      where: {
        id
      }
    });

    return record ? this.syncOfferSubmissionRecord(record) : null;
  }

  async getLatestOfferSubmission(payload: {
    propertyId: string;
    shortlistId?: string | null;
    sessionId?: string | null;
  }): Promise<OfferSubmission | null> {
    const record = await this.client.offerSubmission.findFirst({
      where: {
        propertyId: payload.propertyId,
        ...(payload.shortlistId ? { shortlistId: payload.shortlistId } : {}),
        ...(payload.sessionId ? { sessionId: payload.sessionId } : {})
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    return record ? this.syncOfferSubmissionRecord(record) : null;
  }

  async submitOfferSubmission(id: string, submittedAt?: string | null): Promise<OfferSubmission | null> {
    const existing = await this.client.offerSubmission.findUnique({
      where: {
        id
      }
    });
    if (!existing) {
      return null;
    }

    const current = await this.syncOfferSubmissionRecord(existing);
    const offerPreparationRecord = await this.client.offerPreparation.findUnique({
      where: {
        id: current.offerPreparationId
      }
    });
    if (!offerPreparationRecord) {
      return null;
    }

    const offerPreparation = mapPrismaOfferPreparation(offerPreparationRecord);
    if (!offerPreparation.readinessToSubmit) {
      return null;
    }

    const financialReadinessRecord = current.financialReadinessId
      ? await this.client.financialReadiness.findUnique({
          where: {
            id: current.financialReadinessId
          }
        })
      : null;
    const financialReadiness = financialReadinessRecord
      ? mapPrismaFinancialReadiness(financialReadinessRecord)
      : null;
    const now = new Date().toISOString();
    const actualSubmittedAt = submittedAt ?? now;
    const evaluation = evaluateOfferSubmission({
      now,
      current,
      offerPreparation,
      financialReadiness,
      patch: {
        submittedAt: actualSubmittedAt,
        sellerResponseState: "NO_RESPONSE"
      }
    });
    const nextActivityLog = clone(current.activityLog);
    nextActivityLog.push({
      type: "offer_submitted",
      label: "Offer submitted",
      details: `Offer submission recorded for ${new Date(actualSubmittedAt).toLocaleString("en-US")}.`,
      createdAt: now
    });

    const record = await this.client.offerSubmission.update({
      where: {
        id
      },
      data: {
        submittedAt: new Date(actualSubmittedAt),
        sellerResponseState: evaluation.sellerResponseState,
        submissionSummaryJson: evaluation.submissionSummary,
        submissionState: evaluation.submissionState,
        urgencyLevel: evaluation.urgencyLevel,
        counterofferSummaryJson: evaluation.counterofferSummary,
        missingItemsJson: evaluation.missingItems,
        blockersJson: evaluation.blockers,
        recommendation: evaluation.recommendation,
        risk: evaluation.risk,
        alternative: evaluation.alternative,
        nextAction: evaluation.nextAction,
        nextStepsJson: evaluation.nextSteps,
        requiresBuyerResponse: evaluation.requiresBuyerResponse,
        isExpired: evaluation.isExpired,
        activityLogJson: nextActivityLog,
        lastActionAt: evaluation.lastActionAt ? new Date(evaluation.lastActionAt) : null,
        lastEvaluatedAt: new Date(now)
      }
    });

    await this.recordValidationEvent({
      eventName: "offer_submission_submitted",
      sessionId: current.sessionId ?? null,
      payload: {
        shortlistId: current.shortlistId ?? null,
        offerPreparationId: current.offerPreparationId,
        offerSubmissionId: id,
        propertyId: current.propertyId,
        fromState: current.submissionState,
        toState: evaluation.submissionState
      }
    });

    return mapPrismaOfferSubmission(record);
  }

  async updateOfferSubmission(
    id: string,
    patch: {
      submissionMethod?: OfferSubmissionMethod | null;
      offerExpirationAt?: string | null;
      sellerResponseState?: OfferSubmissionSellerResponseState | null;
      sellerRespondedAt?: string | null;
      buyerCounterDecision?: OfferSubmissionBuyerCounterDecision | null;
      withdrawnAt?: string | null;
      withdrawalReason?: string | null;
      counterofferPrice?: number | null;
      counterofferClosingTimelineDays?: number | null;
      counterofferFinancingContingency?: OfferPreparationContingency | null;
      counterofferInspectionContingency?: OfferPreparationContingency | null;
      counterofferAppraisalContingency?: OfferPreparationContingency | null;
      counterofferExpirationAt?: string | null;
      notes?: string | null;
      internalActivityNote?: string | null;
    }
  ): Promise<OfferSubmission | null> {
    const existing = await this.client.offerSubmission.findUnique({
      where: {
        id
      }
    });
    if (!existing) {
      return null;
    }

    const current = await this.syncOfferSubmissionRecord(existing);
    const offerPreparationRecord = await this.client.offerPreparation.findUnique({
      where: {
        id: current.offerPreparationId
      }
    });
    if (!offerPreparationRecord) {
      return null;
    }

    const offerPreparation = mapPrismaOfferPreparation(offerPreparationRecord);
    const financialReadinessRecord = current.financialReadinessId
      ? await this.client.financialReadiness.findUnique({
          where: {
            id: current.financialReadinessId
          }
        })
      : null;
    const financialReadiness = financialReadinessRecord
      ? mapPrismaFinancialReadiness(financialReadinessRecord)
      : null;
    const now = new Date().toISOString();
    const evaluation = evaluateOfferSubmission({
      now,
      current,
      offerPreparation,
      financialReadiness,
      patch
    });
    const nextActivityLog = clone(current.activityLog);

    const stateToEvent: Partial<Record<OfferSubmission["submissionState"], WorkflowActivityRecord["eventType"]>> = {
      COUNTERED: "offer_submission_countered",
      ACCEPTED: "offer_submission_accepted",
      REJECTED: "offer_submission_rejected",
      WITHDRAWN: "offer_submission_withdrawn",
      EXPIRED: "offer_submission_expired"
    };
    const stateToLog: Partial<Record<OfferSubmission["submissionState"], OfferSubmission["activityLog"][number]>> = {
      COUNTERED: {
        type: "seller_countered",
        label: "Seller countered",
        details: patch.internalActivityNote ?? null,
        createdAt: now
      },
      ACCEPTED: {
        type: "seller_accepted",
        label: "Seller accepted",
        details: patch.internalActivityNote ?? null,
        createdAt: now
      },
      REJECTED: {
        type: "seller_rejected",
        label: "Seller rejected",
        details: patch.internalActivityNote ?? null,
        createdAt: now
      },
      WITHDRAWN: {
        type: "buyer_withdrew",
        label: "Buyer withdrew offer",
        details: patch.withdrawalReason ?? patch.internalActivityNote ?? null,
        createdAt: now
      },
      EXPIRED: {
        type: "offer_expired",
        label: "Offer expired",
        details: patch.internalActivityNote ?? null,
        createdAt: now
      }
    };
    if (current.submissionState !== evaluation.submissionState && stateToLog[evaluation.submissionState]) {
      nextActivityLog.push(stateToLog[evaluation.submissionState]!);
    } else if (patch.internalActivityNote?.trim()) {
      nextActivityLog.push({
        type: "note_added",
        label: "Submission note added",
        details: patch.internalActivityNote.trim(),
        createdAt: now
      });
    }

    const record = await this.client.offerSubmission.update({
      where: {
        id
      },
      data: {
        submissionMethod: evaluation.submissionMethod ?? null,
        offerExpirationAt: evaluation.offerExpirationAt ? new Date(evaluation.offerExpirationAt) : null,
        sellerResponseState: evaluation.sellerResponseState,
        sellerRespondedAt: evaluation.sellerRespondedAt ? new Date(evaluation.sellerRespondedAt) : null,
        buyerCounterDecision: evaluation.buyerCounterDecision ?? null,
        withdrawnAt: evaluation.withdrawnAt ? new Date(evaluation.withdrawnAt) : null,
        withdrawalReason: evaluation.withdrawalReason ?? null,
        notes: evaluation.notes ?? null,
        internalActivityNote: evaluation.internalActivityNote ?? null,
        counterofferPrice: evaluation.counterofferPrice ?? null,
        counterofferClosingTimelineDays: evaluation.counterofferClosingTimelineDays ?? null,
        counterofferFinancingContingency: evaluation.counterofferFinancingContingency ?? null,
        counterofferInspectionContingency: evaluation.counterofferInspectionContingency ?? null,
        counterofferAppraisalContingency: evaluation.counterofferAppraisalContingency ?? null,
        counterofferExpirationAt: evaluation.counterofferExpirationAt
          ? new Date(evaluation.counterofferExpirationAt)
          : null,
        submissionSummaryJson: evaluation.submissionSummary,
        submissionState: evaluation.submissionState,
        urgencyLevel: evaluation.urgencyLevel,
        counterofferSummaryJson: evaluation.counterofferSummary,
        missingItemsJson: evaluation.missingItems,
        blockersJson: evaluation.blockers,
        recommendation: evaluation.recommendation,
        risk: evaluation.risk,
        alternative: evaluation.alternative,
        nextAction: evaluation.nextAction,
        nextStepsJson: evaluation.nextSteps,
        requiresBuyerResponse: evaluation.requiresBuyerResponse,
        isExpired: evaluation.isExpired,
        activityLogJson: nextActivityLog,
        lastActionAt: evaluation.lastActionAt ? new Date(evaluation.lastActionAt) : null,
        lastEvaluatedAt: new Date(now)
      }
    });

    if (current.submissionState !== evaluation.submissionState && stateToEvent[evaluation.submissionState]) {
      await this.recordValidationEvent({
        eventName: stateToEvent[evaluation.submissionState]!,
        sessionId: current.sessionId ?? null,
        payload: {
          shortlistId: current.shortlistId ?? null,
          offerPreparationId: current.offerPreparationId,
          offerSubmissionId: id,
          propertyId: current.propertyId,
          fromState: current.submissionState,
          toState: evaluation.submissionState
        }
      });
    }

    return mapPrismaOfferSubmission(record);
  }

  async respondToOfferSubmissionCounter(
    id: string,
    decision: OfferSubmissionBuyerCounterDecision
  ): Promise<OfferSubmission | null> {
    const existing = await this.client.offerSubmission.findUnique({
      where: {
        id
      }
    });
    if (!existing) {
      return null;
    }

    const current = await this.syncOfferSubmissionRecord(existing);
    if (current.sellerResponseState !== "COUNTERED") {
      return null;
    }

    const record = await this.updateOfferSubmission(id, {
      buyerCounterDecision: decision
    });
    return record;
  }

  async getOfferSubmissionSummary(id: string): Promise<OfferSubmissionSummary | null> {
    const record = await this.getOfferSubmission(id);
    return record ? toOfferSubmissionSummary(record) : null;
  }

  async createUnderContractCoordination(
    payload: UnderContractCoordinationInputs & {
      sessionId?: string | null;
      partnerId?: string | null;
    }
  ): Promise<UnderContractCoordination | null> {
    const offerSubmissionRecord = await this.client.offerSubmission.findUnique({
      where: {
        id: payload.offerSubmissionId
      }
    });
    if (!offerSubmissionRecord) {
      return null;
    }

    const offerSubmission = await this.syncOfferSubmissionRecord(offerSubmissionRecord);
    if (offerSubmission.submissionState !== "ACCEPTED") {
      return null;
    }

    const existing = await this.client.underContractCoordination.findFirst({
      where: {
        propertyId: payload.propertyId,
        ...(payload.shortlistId ? { shortlistId: payload.shortlistId } : {})
      }
    });
    if (existing) {
      return this.syncUnderContractRecord(existing);
    }

    const offerPreparationRecord = await this.client.offerPreparation.findUnique({
      where: {
        id: offerSubmission.offerPreparationId
      }
    });
    const offerPreparation = offerPreparationRecord
      ? mapPrismaOfferPreparation(offerPreparationRecord)
      : null;
    const financialReadinessRecord = payload.financialReadinessId
      ? await this.client.financialReadiness.findUnique({
          where: {
            id: payload.financialReadinessId
          }
        })
      : offerSubmission.financialReadinessId
        ? await this.client.financialReadiness.findUnique({
            where: {
              id: offerSubmission.financialReadinessId
            }
          })
        : null;
    const financialReadiness = financialReadinessRecord
      ? mapPrismaFinancialReadiness(financialReadinessRecord)
      : null;

    const now = new Date().toISOString();
    const evaluation = evaluateUnderContractCoordination({
      now,
      offerSubmission,
      offerPreparation,
      financialReadiness,
      sessionId: payload.sessionId ?? offerSubmission.sessionId ?? null,
      partnerId: payload.partnerId ?? offerSubmission.partnerId ?? null,
      patch: payload
    });

    const activityLog: UnderContractCoordination["activityLog"] = [
      {
        type: "record_created",
        label: "Under-contract workflow created",
        details: null,
        createdAt: now
      }
    ];

    const record = await this.client.underContractCoordination.create({
      data: {
        sessionId: evaluation.sessionId ?? null,
        partnerId: evaluation.partnerId ?? null,
        propertyId: evaluation.propertyId,
        propertyAddressLabel: evaluation.propertyAddressLabel,
        shortlistId: evaluation.shortlistId ?? null,
        financialReadinessId: evaluation.financialReadinessId ?? null,
        offerPreparationId: evaluation.offerPreparationId ?? null,
        offerSubmissionId: evaluation.offerSubmissionId,
        acceptedAt: new Date(evaluation.acceptedAt),
        targetClosingDate: new Date(evaluation.targetClosingDate),
        inspectionDeadline: evaluation.inspectionDeadline ? new Date(evaluation.inspectionDeadline) : null,
        appraisalDeadline: evaluation.appraisalDeadline ? new Date(evaluation.appraisalDeadline) : null,
        financingDeadline: evaluation.financingDeadline ? new Date(evaluation.financingDeadline) : null,
        contingencyDeadline: evaluation.contingencyDeadline ? new Date(evaluation.contingencyDeadline) : null,
        closingPreparationDeadline: evaluation.closingPreparationDeadline
          ? new Date(evaluation.closingPreparationDeadline)
          : null,
        notes: evaluation.notes ?? null,
        internalActivityNote: evaluation.internalActivityNote ?? null,
        coordinationSummaryJson: evaluation.coordinationSummary,
        overallCoordinationState: evaluation.overallCoordinationState,
        overallRiskLevel: evaluation.overallRiskLevel,
        urgencyLevel: evaluation.urgencyLevel,
        readyForClosing: evaluation.readyForClosing,
        requiresImmediateAttention: evaluation.requiresImmediateAttention,
        taskRecordsJson: evaluation.taskSummaries,
        milestoneRecordsJson: evaluation.milestoneSummaries,
        deadlineRecordsJson: evaluation.deadlineSummaries,
        missingItemsJson: evaluation.missingItems,
        blockersJson: evaluation.blockers,
        recommendation: evaluation.recommendation,
        risk: evaluation.risk,
        alternative: evaluation.alternative,
        nextAction: evaluation.nextAction,
        nextStepsJson: evaluation.nextSteps,
        activityLogJson: activityLog,
        lastActionAt: evaluation.lastActionAt ? new Date(evaluation.lastActionAt) : null,
        lastEvaluatedAt: new Date(evaluation.lastEvaluatedAt)
      }
    });

    await this.recordValidationEvent({
      eventName: "under_contract_created",
      sessionId: evaluation.sessionId ?? null,
      payload: {
        shortlistId: evaluation.shortlistId ?? null,
        offerPreparationId: evaluation.offerPreparationId ?? null,
        offerSubmissionId: evaluation.offerSubmissionId,
        underContractId: record.id as string,
        propertyId: evaluation.propertyId,
        coordinationState: evaluation.overallCoordinationState
      }
    });

    return mapPrismaUnderContractCoordination(record);
  }

  async listUnderContractCoordinations(shortlistId: string): Promise<UnderContractCoordination[]> {
    const records = await this.client.underContractCoordination.findMany({
      where: {
        shortlistId
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    return Promise.all(records.map((record) => this.syncUnderContractRecord(record)));
  }

  async getUnderContractCoordination(id: string): Promise<UnderContractCoordination | null> {
    const record = await this.client.underContractCoordination.findUnique({
      where: {
        id
      }
    });
    return record ? this.syncUnderContractRecord(record) : null;
  }

  async getLatestUnderContractCoordination(payload: {
    propertyId: string;
    shortlistId?: string | null;
    sessionId?: string | null;
  }): Promise<UnderContractCoordination | null> {
    const record = await this.client.underContractCoordination.findFirst({
      where: {
        propertyId: payload.propertyId,
        ...(payload.shortlistId ? { shortlistId: payload.shortlistId } : {}),
        ...(payload.sessionId ? { sessionId: payload.sessionId } : {})
      },
      orderBy: {
        updatedAt: "desc"
      }
    });
    return record ? this.syncUnderContractRecord(record) : null;
  }

  async updateUnderContractCoordination(
    id: string,
    patch: {
      targetClosingDate?: string | null;
      inspectionDeadline?: string | null;
      appraisalDeadline?: string | null;
      financingDeadline?: string | null;
      contingencyDeadline?: string | null;
      closingPreparationDeadline?: string | null;
      notes?: string | null;
      internalActivityNote?: string | null;
    }
  ): Promise<UnderContractCoordination | null> {
    const existing = await this.client.underContractCoordination.findUnique({
      where: {
        id
      }
    });
    if (!existing) {
      return null;
    }

    const current = await this.syncUnderContractRecord(existing);
    const offerSubmissionRecord = await this.client.offerSubmission.findUnique({
      where: {
        id: current.offerSubmissionId
      }
    });
    if (!offerSubmissionRecord) {
      return null;
    }

    const offerSubmission = await this.syncOfferSubmissionRecord(offerSubmissionRecord);
    const offerPreparationRecord = current.offerPreparationId
      ? await this.client.offerPreparation.findUnique({
          where: {
            id: current.offerPreparationId
          }
        })
      : null;
    const offerPreparation = offerPreparationRecord ? mapPrismaOfferPreparation(offerPreparationRecord) : null;
    const financialReadinessRecord = current.financialReadinessId
      ? await this.client.financialReadiness.findUnique({
          where: {
            id: current.financialReadinessId
          }
        })
      : null;
    const financialReadiness = financialReadinessRecord ? mapPrismaFinancialReadiness(financialReadinessRecord) : null;
    const now = new Date().toISOString();
    const evaluation = evaluateUnderContractCoordination({
      now,
      current,
      offerSubmission,
      offerPreparation,
      financialReadiness,
      patch
    });
    const nextActivityLog = clone(current.activityLog);
    if (patch.internalActivityNote?.trim()) {
      nextActivityLog.push({
        type: "note_added",
        label: "Contract note added",
        details: patch.internalActivityNote.trim(),
        createdAt: now
      });
    }

    const record = await this.client.underContractCoordination.update({
      where: {
        id
      },
      data: {
        propertyAddressLabel: evaluation.propertyAddressLabel,
        acceptedAt: new Date(evaluation.acceptedAt),
        targetClosingDate: new Date(evaluation.targetClosingDate),
        inspectionDeadline: evaluation.inspectionDeadline ? new Date(evaluation.inspectionDeadline) : null,
        appraisalDeadline: evaluation.appraisalDeadline ? new Date(evaluation.appraisalDeadline) : null,
        financingDeadline: evaluation.financingDeadline ? new Date(evaluation.financingDeadline) : null,
        contingencyDeadline: evaluation.contingencyDeadline ? new Date(evaluation.contingencyDeadline) : null,
        closingPreparationDeadline: evaluation.closingPreparationDeadline
          ? new Date(evaluation.closingPreparationDeadline)
          : null,
        notes: evaluation.notes ?? null,
        internalActivityNote: evaluation.internalActivityNote ?? null,
        coordinationSummaryJson: evaluation.coordinationSummary,
        overallCoordinationState: evaluation.overallCoordinationState,
        overallRiskLevel: evaluation.overallRiskLevel,
        urgencyLevel: evaluation.urgencyLevel,
        readyForClosing: evaluation.readyForClosing,
        requiresImmediateAttention: evaluation.requiresImmediateAttention,
        taskRecordsJson: evaluation.taskSummaries,
        milestoneRecordsJson: evaluation.milestoneSummaries,
        deadlineRecordsJson: evaluation.deadlineSummaries,
        missingItemsJson: evaluation.missingItems,
        blockersJson: evaluation.blockers,
        recommendation: evaluation.recommendation,
        risk: evaluation.risk,
        alternative: evaluation.alternative,
        nextAction: evaluation.nextAction,
        nextStepsJson: evaluation.nextSteps,
        activityLogJson: nextActivityLog,
        lastActionAt: evaluation.lastActionAt ? new Date(evaluation.lastActionAt) : null,
        lastEvaluatedAt: new Date(now)
      }
    });

    if (
      current.overallCoordinationState !== evaluation.overallCoordinationState &&
      evaluation.overallCoordinationState === "READY_FOR_CLOSING"
    ) {
      await this.recordValidationEvent({
        eventName: "under_contract_ready_for_closing",
        sessionId: current.sessionId ?? null,
        payload: {
          shortlistId: current.shortlistId ?? null,
          offerPreparationId: current.offerPreparationId ?? null,
          offerSubmissionId: current.offerSubmissionId,
          underContractId: id,
          propertyId: current.propertyId,
          fromState: current.overallCoordinationState,
          toState: evaluation.overallCoordinationState
        }
      });
    } else if (
      current.overallCoordinationState !== evaluation.overallCoordinationState &&
      evaluation.overallCoordinationState === "BLOCKED"
    ) {
      await this.recordValidationEvent({
        eventName: "under_contract_blocked",
        sessionId: current.sessionId ?? null,
        payload: {
          shortlistId: current.shortlistId ?? null,
          offerPreparationId: current.offerPreparationId ?? null,
          offerSubmissionId: current.offerSubmissionId,
          underContractId: id,
          propertyId: current.propertyId,
          fromState: current.overallCoordinationState,
          toState: evaluation.overallCoordinationState
        }
      });
    }

    return mapPrismaUnderContractCoordination(record);
  }

  async updateUnderContractTask(
    id: string,
    taskType: ContractTaskType,
    patch: {
      status?: ContractTaskState;
      deadline?: string | null;
      scheduledAt?: string | null;
      completedAt?: string | null;
      blockedReason?: string | null;
      notes?: string | null;
    }
  ): Promise<UnderContractCoordination | null> {
    const existing = await this.client.underContractCoordination.findUnique({
      where: {
        id
      }
    });
    if (!existing) {
      return null;
    }

    const current = await this.syncUnderContractRecord(existing);
    const task = current.taskSummaries.find((entry) => entry.taskType === taskType);
    if (!task) {
      return null;
    }
    if (patch.status !== undefined) {
      task.status = patch.status;
    }
    if (patch.deadline !== undefined) {
      task.deadline = patch.deadline;
    }
    if (patch.scheduledAt !== undefined) {
      task.scheduledAt = patch.scheduledAt;
    }
    if (patch.completedAt !== undefined) {
      task.completedAt = patch.completedAt;
    }
    if (patch.blockedReason !== undefined) {
      task.blockedReason = patch.blockedReason;
    }
    if (patch.notes !== undefined) {
      task.notes = patch.notes;
    }

    const now = new Date().toISOString();
    const nextActivityLog = clone(current.activityLog);
    nextActivityLog.push({
      type: "task_updated",
      label: `${task.label} updated`,
      details: patch.notes ?? patch.blockedReason ?? null,
      createdAt: now
    });

    const record = await this.client.underContractCoordination.update({
      where: {
        id
      },
      data: {
        taskRecordsJson: current.taskSummaries,
        activityLogJson: nextActivityLog,
        lastActionAt: new Date(now)
      }
    });

    await this.recordValidationEvent({
      eventName: "under_contract_task_updated",
      sessionId: current.sessionId ?? null,
      payload: {
        shortlistId: current.shortlistId ?? null,
        offerPreparationId: current.offerPreparationId ?? null,
        offerSubmissionId: current.offerSubmissionId,
        underContractId: id,
        propertyId: current.propertyId,
        taskType,
        status: task.status
      }
    });

    return this.syncUnderContractRecord(record);
  }

  async updateUnderContractMilestone(
    id: string,
    milestoneType: CoordinationMilestoneType,
    patch: {
      status?: "PENDING" | "REACHED" | "BLOCKED";
      occurredAt?: string | null;
      notes?: string | null;
    }
  ): Promise<UnderContractCoordination | null> {
    const existing = await this.client.underContractCoordination.findUnique({
      where: {
        id
      }
    });
    if (!existing) {
      return null;
    }

    const current = await this.syncUnderContractRecord(existing);
    const milestone = current.milestoneSummaries.find((entry) => entry.milestoneType === milestoneType);
    if (!milestone) {
      return null;
    }
    if (patch.status !== undefined) {
      milestone.status = patch.status;
    }
    if (patch.occurredAt !== undefined) {
      milestone.occurredAt = patch.occurredAt;
    }
    if (patch.notes !== undefined) {
      milestone.notes = patch.notes;
    }

    const now = new Date().toISOString();
    const nextActivityLog = clone(current.activityLog);
    nextActivityLog.push({
      type: "milestone_reached",
      label: `${milestone.label} updated`,
      details: patch.notes ?? null,
      createdAt: now
    });

    const record = await this.client.underContractCoordination.update({
      where: {
        id
      },
      data: {
        milestoneRecordsJson: current.milestoneSummaries,
        activityLogJson: nextActivityLog,
        lastActionAt: new Date(now)
      }
    });

    await this.recordValidationEvent({
      eventName: "under_contract_milestone_reached",
      sessionId: current.sessionId ?? null,
      payload: {
        shortlistId: current.shortlistId ?? null,
        offerPreparationId: current.offerPreparationId ?? null,
        offerSubmissionId: current.offerSubmissionId,
        underContractId: id,
        propertyId: current.propertyId,
        milestoneType,
        status: milestone.status
      }
    });

    return this.syncUnderContractRecord(record);
  }

  async getUnderContractCoordinationSummary(id: string): Promise<UnderContractCoordinationSummary | null> {
    const record = await this.getUnderContractCoordination(id);
    return record ? toUnderContractCoordinationSummary(record) : null;
  }

  async createClosingReadiness(
    payload: ClosingReadinessInputs & {
      sessionId?: string | null;
      partnerId?: string | null;
    }
  ): Promise<ClosingReadiness | null> {
    const underContractRecord = await this.client.underContractCoordination.findUnique({
      where: {
        id: payload.underContractCoordinationId
      }
    });
    if (!underContractRecord) {
      return null;
    }

    const underContract = await this.syncUnderContractRecord(underContractRecord);
    if (underContract.overallCoordinationState !== "READY_FOR_CLOSING" || !underContract.readyForClosing) {
      return null;
    }

    const existing = await this.client.closingReadiness.findFirst({
      where: {
        propertyId: payload.propertyId,
        ...(payload.shortlistId ? { shortlistId: payload.shortlistId } : {})
      }
    });
    if (existing) {
      return this.syncClosingReadinessRecord(existing);
    }

    const offerSubmissionRecord = payload.offerSubmissionId
      ? await this.client.offerSubmission.findUnique({
          where: {
            id: payload.offerSubmissionId
          }
        })
      : underContract.offerSubmissionId
        ? await this.client.offerSubmission.findUnique({
            where: {
              id: underContract.offerSubmissionId
            }
          })
        : null;
    const offerSubmission = offerSubmissionRecord
      ? await this.syncOfferSubmissionRecord(offerSubmissionRecord)
      : null;
    const offerPreparationRecord = payload.offerPreparationId
      ? await this.client.offerPreparation.findUnique({
          where: {
            id: payload.offerPreparationId
          }
        })
      : underContract.offerPreparationId
        ? await this.client.offerPreparation.findUnique({
            where: {
              id: underContract.offerPreparationId
            }
          })
        : null;
    const offerPreparation = offerPreparationRecord ? mapPrismaOfferPreparation(offerPreparationRecord) : null;
    const financialReadinessRecord = payload.financialReadinessId
      ? await this.client.financialReadiness.findUnique({
          where: {
            id: payload.financialReadinessId
          }
        })
      : underContract.financialReadinessId
        ? await this.client.financialReadiness.findUnique({
            where: {
              id: underContract.financialReadinessId
            }
          })
        : null;
    const financialReadiness = financialReadinessRecord
      ? mapPrismaFinancialReadiness(financialReadinessRecord)
      : null;

    const now = new Date().toISOString();
    const evaluation = evaluateClosingReadiness({
      now,
      underContract,
      offerSubmission,
      offerPreparation,
      financialReadiness,
      sessionId: payload.sessionId ?? underContract.sessionId ?? null,
      partnerId: payload.partnerId ?? underContract.partnerId ?? null,
      patch: payload
    });
    const activityLog: ClosingReadiness["activityLog"] = [
      {
        type: "record_created",
        label: "Closing readiness started",
        details: null,
        createdAt: now
      }
    ];

    const record = await this.client.closingReadiness.create({
      data: {
        sessionId: evaluation.sessionId ?? null,
        partnerId: evaluation.partnerId ?? null,
        propertyId: evaluation.propertyId,
        propertyAddressLabel: evaluation.propertyAddressLabel,
        shortlistId: evaluation.shortlistId ?? null,
        financialReadinessId: evaluation.financialReadinessId ?? null,
        offerPreparationId: evaluation.offerPreparationId ?? null,
        offerSubmissionId: evaluation.offerSubmissionId ?? null,
        underContractCoordinationId: evaluation.underContractCoordinationId,
        targetClosingDate: new Date(evaluation.targetClosingDate),
        closingAppointmentAt: evaluation.closingAppointmentAt ? new Date(evaluation.closingAppointmentAt) : null,
        closingAppointmentLocation: evaluation.closingAppointmentLocation ?? null,
        closingAppointmentNotes: evaluation.closingAppointmentNotes ?? null,
        finalReviewDeadline: evaluation.finalReviewDeadline ? new Date(evaluation.finalReviewDeadline) : null,
        finalFundsConfirmationDeadline: evaluation.finalFundsConfirmationDeadline
          ? new Date(evaluation.finalFundsConfirmationDeadline)
          : null,
        finalFundsAmountConfirmed: evaluation.finalFundsAmountConfirmed ?? null,
        closedAt: evaluation.closedAt ? new Date(evaluation.closedAt) : null,
        notes: evaluation.notes ?? null,
        internalActivityNote: evaluation.internalActivityNote ?? null,
        closingSummaryJson: evaluation.closingSummary,
        overallClosingReadinessState: evaluation.overallClosingReadinessState,
        overallRiskLevel: evaluation.overallRiskLevel,
        urgencyLevel: evaluation.urgencyLevel,
        readyToClose: evaluation.readyToClose,
        closed: evaluation.closed,
        checklistItemsJson: evaluation.checklistItemSummaries,
        milestoneRecordsJson: evaluation.milestoneSummaries,
        missingItemsJson: evaluation.missingItems,
        blockersJson: evaluation.blockers,
        recommendation: evaluation.recommendation,
        risk: evaluation.risk,
        alternative: evaluation.alternative,
        nextAction: evaluation.nextAction,
        nextStepsJson: evaluation.nextSteps,
        activityLogJson: activityLog,
        requiresImmediateAttention: evaluation.requiresImmediateAttention,
        lastActionAt: evaluation.lastActionAt ? new Date(evaluation.lastActionAt) : null,
        lastEvaluatedAt: new Date(evaluation.lastEvaluatedAt)
      }
    });

    await this.recordValidationEvent({
      eventName: "closing_readiness_created",
      sessionId: evaluation.sessionId ?? null,
      payload: {
        shortlistId: evaluation.shortlistId ?? null,
        offerPreparationId: evaluation.offerPreparationId ?? null,
        offerSubmissionId: evaluation.offerSubmissionId ?? null,
        underContractId: evaluation.underContractCoordinationId,
        closingReadinessId: record.id as string,
        propertyId: evaluation.propertyId,
        closingState: evaluation.overallClosingReadinessState
      }
    });

    return mapPrismaClosingReadiness(record);
  }

  async listClosingReadiness(shortlistId: string): Promise<ClosingReadiness[]> {
    const records = await this.client.closingReadiness.findMany({
      where: {
        shortlistId
      },
      orderBy: {
        updatedAt: "desc"
      }
    });
    return Promise.all(records.map((record) => this.syncClosingReadinessRecord(record)));
  }

  async getClosingReadiness(id: string): Promise<ClosingReadiness | null> {
    const record = await this.client.closingReadiness.findUnique({
      where: {
        id
      }
    });
    return record ? this.syncClosingReadinessRecord(record) : null;
  }

  async getLatestClosingReadiness(payload: {
    propertyId: string;
    shortlistId?: string | null;
    sessionId?: string | null;
  }): Promise<ClosingReadiness | null> {
    const record = await this.client.closingReadiness.findFirst({
      where: {
        propertyId: payload.propertyId,
        ...(payload.shortlistId ? { shortlistId: payload.shortlistId } : {}),
        ...(payload.sessionId ? { sessionId: payload.sessionId } : {})
      },
      orderBy: {
        updatedAt: "desc"
      }
    });
    return record ? this.syncClosingReadinessRecord(record) : null;
  }

  async updateClosingReadiness(
    id: string,
    patch: {
      targetClosingDate?: string | null;
      closingAppointmentAt?: string | null;
      closingAppointmentLocation?: string | null;
      closingAppointmentNotes?: string | null;
      finalReviewDeadline?: string | null;
      finalFundsConfirmationDeadline?: string | null;
      finalFundsAmountConfirmed?: number | null;
      notes?: string | null;
      internalActivityNote?: string | null;
    }
  ): Promise<ClosingReadiness | null> {
    const existing = await this.client.closingReadiness.findUnique({
      where: { id }
    });
    if (!existing) {
      return null;
    }

    const current = await this.syncClosingReadinessRecord(existing);
    const underContractRecord = await this.client.underContractCoordination.findUnique({
      where: {
        id: current.underContractCoordinationId
      }
    });
    if (!underContractRecord) {
      return null;
    }

    const underContract = await this.syncUnderContractRecord(underContractRecord);
    const offerSubmissionRecord = current.offerSubmissionId
      ? await this.client.offerSubmission.findUnique({
          where: {
            id: current.offerSubmissionId
          }
        })
      : null;
    const offerSubmission = offerSubmissionRecord
      ? await this.syncOfferSubmissionRecord(offerSubmissionRecord)
      : null;
    const offerPreparationRecord = current.offerPreparationId
      ? await this.client.offerPreparation.findUnique({
          where: {
            id: current.offerPreparationId
          }
        })
      : null;
    const offerPreparation = offerPreparationRecord ? mapPrismaOfferPreparation(offerPreparationRecord) : null;
    const financialReadinessRecord = current.financialReadinessId
      ? await this.client.financialReadiness.findUnique({
          where: {
            id: current.financialReadinessId
          }
        })
      : null;
    const financialReadiness = financialReadinessRecord
      ? mapPrismaFinancialReadiness(financialReadinessRecord)
      : null;
    const now = new Date().toISOString();
    const evaluation = evaluateClosingReadiness({
      now,
      current,
      underContract,
      offerSubmission,
      offerPreparation,
      financialReadiness,
      patch
    });
    const nextActivityLog = clone(current.activityLog);
    if (patch.internalActivityNote?.trim()) {
      nextActivityLog.push({
        type: "note_added",
        label: "Closing note added",
        details: patch.internalActivityNote.trim(),
        createdAt: now
      });
    }

    const record = await this.client.closingReadiness.update({
      where: { id },
      data: {
        propertyAddressLabel: evaluation.propertyAddressLabel,
        targetClosingDate: new Date(evaluation.targetClosingDate),
        closingAppointmentAt: evaluation.closingAppointmentAt ? new Date(evaluation.closingAppointmentAt) : null,
        closingAppointmentLocation: evaluation.closingAppointmentLocation ?? null,
        closingAppointmentNotes: evaluation.closingAppointmentNotes ?? null,
        finalReviewDeadline: evaluation.finalReviewDeadline ? new Date(evaluation.finalReviewDeadline) : null,
        finalFundsConfirmationDeadline: evaluation.finalFundsConfirmationDeadline
          ? new Date(evaluation.finalFundsConfirmationDeadline)
          : null,
        finalFundsAmountConfirmed: evaluation.finalFundsAmountConfirmed ?? null,
        closedAt: evaluation.closedAt ? new Date(evaluation.closedAt) : null,
        notes: evaluation.notes ?? null,
        internalActivityNote: evaluation.internalActivityNote ?? null,
        closingSummaryJson: evaluation.closingSummary,
        overallClosingReadinessState: evaluation.overallClosingReadinessState,
        overallRiskLevel: evaluation.overallRiskLevel,
        urgencyLevel: evaluation.urgencyLevel,
        readyToClose: evaluation.readyToClose,
        closed: evaluation.closed,
        checklistItemsJson: evaluation.checklistItemSummaries,
        milestoneRecordsJson: evaluation.milestoneSummaries,
        missingItemsJson: evaluation.missingItems,
        blockersJson: evaluation.blockers,
        recommendation: evaluation.recommendation,
        risk: evaluation.risk,
        alternative: evaluation.alternative,
        nextAction: evaluation.nextAction,
        nextStepsJson: evaluation.nextSteps,
        activityLogJson: nextActivityLog,
        requiresImmediateAttention: evaluation.requiresImmediateAttention,
        lastActionAt: evaluation.lastActionAt ? new Date(evaluation.lastActionAt) : null,
        lastEvaluatedAt: new Date(now)
      }
    });

    return this.syncClosingReadinessRecord(record);
  }

  async updateClosingChecklistItem(
    id: string,
    itemType: ClosingChecklistItemType,
    patch: {
      status?: ClosingChecklistItemState;
      deadline?: string | null;
      completedAt?: string | null;
      blockedReason?: string | null;
      notes?: string | null;
    }
  ): Promise<ClosingReadiness | null> {
    const existing = await this.client.closingReadiness.findUnique({ where: { id } });
    if (!existing) {
      return null;
    }

    const current = await this.syncClosingReadinessRecord(existing);
    const item = current.checklistItemSummaries.find((entry) => entry.itemType === itemType);
    if (!item) {
      return null;
    }
    if (patch.status !== undefined) item.status = patch.status;
    if (patch.deadline !== undefined) item.deadline = patch.deadline;
    if (patch.completedAt !== undefined) item.completedAt = patch.completedAt;
    if (patch.blockedReason !== undefined) item.blockedReason = patch.blockedReason;
    if (patch.notes !== undefined) item.notes = patch.notes;

    const now = new Date().toISOString();
    const nextActivityLog = clone(current.activityLog);
    nextActivityLog.push({
      type: "checklist_updated",
      label: `${item.label} updated`,
      details: patch.notes ?? patch.blockedReason ?? null,
      createdAt: now
    });

    const record = await this.client.closingReadiness.update({
      where: { id },
      data: {
        checklistItemsJson: current.checklistItemSummaries,
        activityLogJson: nextActivityLog,
        lastActionAt: new Date(now)
      }
    });

    await this.recordValidationEvent({
      eventName: "closing_checklist_updated",
      sessionId: current.sessionId ?? null,
      payload: {
        shortlistId: current.shortlistId ?? null,
        offerPreparationId: current.offerPreparationId ?? null,
        offerSubmissionId: current.offerSubmissionId ?? null,
        underContractId: current.underContractCoordinationId,
        closingReadinessId: id,
        propertyId: current.propertyId,
        itemType,
        status: item.status
      }
    });

    return this.syncClosingReadinessRecord(record);
  }

  async updateClosingMilestone(
    id: string,
    milestoneType: ClosingMilestoneType,
    patch: {
      status?: "PENDING" | "REACHED" | "BLOCKED";
      occurredAt?: string | null;
      notes?: string | null;
    }
  ): Promise<ClosingReadiness | null> {
    const existing = await this.client.closingReadiness.findUnique({ where: { id } });
    if (!existing) {
      return null;
    }

    const current = await this.syncClosingReadinessRecord(existing);
    const milestone = current.milestoneSummaries.find((entry) => entry.milestoneType === milestoneType);
    if (!milestone) {
      return null;
    }
    if (patch.status !== undefined) milestone.status = patch.status;
    if (patch.occurredAt !== undefined) milestone.occurredAt = patch.occurredAt;
    if (patch.notes !== undefined) milestone.notes = patch.notes;

    const now = new Date().toISOString();
    const nextActivityLog = clone(current.activityLog);
    nextActivityLog.push({
      type: "milestone_reached",
      label: `${milestone.label} updated`,
      details: patch.notes ?? null,
      createdAt: now
    });

    const record = await this.client.closingReadiness.update({
      where: { id },
      data: {
        milestoneRecordsJson: current.milestoneSummaries,
        activityLogJson: nextActivityLog,
        lastActionAt: new Date(now)
      }
    });

    await this.recordValidationEvent({
      eventName: "closing_milestone_reached",
      sessionId: current.sessionId ?? null,
      payload: {
        shortlistId: current.shortlistId ?? null,
        offerPreparationId: current.offerPreparationId ?? null,
        offerSubmissionId: current.offerSubmissionId ?? null,
        underContractId: current.underContractCoordinationId,
        closingReadinessId: id,
        propertyId: current.propertyId,
        milestoneType,
        status: milestone.status
      }
    });

    return this.syncClosingReadinessRecord(record);
  }

  async markClosingReady(id: string): Promise<ClosingReadiness | null> {
    const record = await this.getClosingReadiness(id);
    if (!record) {
      return null;
    }
    if (record.overallClosingReadinessState !== "READY_TO_CLOSE") {
      return this.updateClosingReadiness(id, {});
    }
    return record;
  }

  async markClosingComplete(id: string, closedAt?: string | null): Promise<ClosingReadiness | null> {
    const existing = await this.client.closingReadiness.findUnique({ where: { id } });
    if (!existing) {
      return null;
    }
    const current = await this.syncClosingReadinessRecord(existing);
    const underContractRecord = await this.client.underContractCoordination.findUnique({
      where: { id: current.underContractCoordinationId }
    });
    if (!underContractRecord) {
      return null;
    }
    const underContract = await this.syncUnderContractRecord(underContractRecord);
    const offerSubmissionRecord = current.offerSubmissionId
      ? await this.client.offerSubmission.findUnique({ where: { id: current.offerSubmissionId } })
      : null;
    const offerSubmission = offerSubmissionRecord
      ? await this.syncOfferSubmissionRecord(offerSubmissionRecord)
      : null;
    const offerPreparationRecord = current.offerPreparationId
      ? await this.client.offerPreparation.findUnique({ where: { id: current.offerPreparationId } })
      : null;
    const offerPreparation = offerPreparationRecord ? mapPrismaOfferPreparation(offerPreparationRecord) : null;
    const financialReadinessRecord = current.financialReadinessId
      ? await this.client.financialReadiness.findUnique({ where: { id: current.financialReadinessId } })
      : null;
    const financialReadiness = financialReadinessRecord
      ? mapPrismaFinancialReadiness(financialReadinessRecord)
      : null;

    const now = new Date().toISOString();
    const evaluation = evaluateClosingReadiness({
      now,
      current,
      underContract,
      offerSubmission,
      offerPreparation,
      financialReadiness,
      patch: {
        closedAt: closedAt ?? now
      }
    });

    const nextActivityLog = clone(current.activityLog);
    nextActivityLog.push({
      type: "closed",
      label: "Closing marked complete",
      details: null,
      createdAt: now
    });

    const record = await this.client.closingReadiness.update({
      where: { id },
      data: {
        closedAt: evaluation.closedAt ? new Date(evaluation.closedAt) : new Date(now),
        closingSummaryJson: evaluation.closingSummary,
        overallClosingReadinessState: evaluation.overallClosingReadinessState,
        overallRiskLevel: evaluation.overallRiskLevel,
        urgencyLevel: evaluation.urgencyLevel,
        readyToClose: evaluation.readyToClose,
        closed: evaluation.closed,
        checklistItemsJson: evaluation.checklistItemSummaries,
        milestoneRecordsJson: evaluation.milestoneSummaries,
        missingItemsJson: evaluation.missingItems,
        blockersJson: evaluation.blockers,
        recommendation: evaluation.recommendation,
        risk: evaluation.risk,
        alternative: evaluation.alternative,
        nextAction: evaluation.nextAction,
        nextStepsJson: evaluation.nextSteps,
        activityLogJson: nextActivityLog,
        requiresImmediateAttention: evaluation.requiresImmediateAttention,
        lastActionAt: new Date(now),
        lastEvaluatedAt: new Date(now)
      }
    });

    await this.recordValidationEvent({
      eventName: "closing_completed",
      sessionId: current.sessionId ?? null,
      payload: {
        shortlistId: current.shortlistId ?? null,
        offerPreparationId: current.offerPreparationId ?? null,
        offerSubmissionId: current.offerSubmissionId ?? null,
        underContractId: current.underContractCoordinationId,
        closingReadinessId: id,
        propertyId: current.propertyId,
        toState: evaluation.overallClosingReadinessState
      }
    });

    return this.syncClosingReadinessRecord(record);
  }

  async getClosingReadinessSummary(id: string): Promise<ClosingReadinessSummary | null> {
    const record = await this.getClosingReadiness(id);
    return record ? toClosingReadinessSummary(record) : null;
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
        reviewState: payload.reviewState ?? "undecided",
        choiceStatus: "candidate",
        selectionRank: null,
        decisionConfidence: null,
        decisionRationale: null,
        decisionRisksJson: [],
        lastDecisionReviewedAt: null,
        selectedAt: null,
        statusChangedAt: new Date(),
        replacedByShortlistItemId: null,
        droppedReason: null
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
      }
    });

    return records.map((record) => mapPrismaShortlistItem(record)).sort(shortlistItemOrder);
  }

  async createOfferReadiness(payload: {
    shortlistId: string;
    propertyId: string;
    status?: OfferReadinessStatus;
    financingReadiness?: OfferFinancingReadiness;
    propertyFitConfidence?: OfferPropertyFitConfidence;
    riskToleranceAlignment?: OfferRiskToleranceAlignment;
    riskLevel?: OfferRiskLevel;
    userConfirmed?: boolean;
  }): Promise<OfferReadiness | null> {
    const itemRecord = await this.client.shortlistItem.findUnique({
      where: {
        shortlistId_canonicalPropertyId: {
          shortlistId: payload.shortlistId,
          canonicalPropertyId: payload.propertyId
        }
      }
    });
    if (!itemRecord) {
      return null;
    }

    const existing = await this.client.offerReadiness.findFirst({
      where: {
        shortlistId: payload.shortlistId,
        propertyId: payload.propertyId
      }
    });
    if (existing) {
      return mapPrismaOfferReadiness(existing);
    }

    const item = mapPrismaShortlistItem(itemRecord);
    const now = new Date().toISOString();
    const evaluation = evaluateOfferReadiness({
      item,
      now,
      patch: {
        status: payload.status,
        financingReadiness: payload.financingReadiness,
        propertyFitConfidence: payload.propertyFitConfidence,
        riskToleranceAlignment: payload.riskToleranceAlignment,
        riskLevel: payload.riskLevel,
        userConfirmed: payload.userConfirmed
      }
    });

    const record = await this.client.offerReadiness.create({
      data: {
        propertyId: payload.propertyId,
        shortlistId: payload.shortlistId,
        shortlistItemId: item.id,
        status: evaluation.status,
        readinessScore: evaluation.readinessScore,
        recommendedOfferPrice: evaluation.recommendedOfferPrice,
        confidence: evaluation.confidence,
        financingReadiness: evaluation.inputs.financingReadiness,
        propertyFitConfidence: evaluation.inputs.propertyFitConfidence,
        riskToleranceAlignment: evaluation.inputs.riskToleranceAlignment,
        riskLevel: evaluation.inputs.riskLevel,
        userConfirmed: evaluation.inputs.userConfirmed,
        dataCompletenessScore: evaluation.inputs.dataCompletenessScore,
        blockingIssuesJson: evaluation.blockingIssues,
        nextStepsJson: evaluation.nextSteps,
        lastEvaluatedAt: new Date(now)
      }
    });

    const shortlist = await this.getShortlist(payload.shortlistId);
    await this.recordValidationEvent({
      eventName: "offer_readiness_created",
      sessionId: shortlist?.sessionId ?? null,
      payload: {
        shortlistId: payload.shortlistId,
        shortlistItemId: item.id,
        offerReadinessId: record.id as string,
        propertyId: payload.propertyId,
        status: evaluation.status
      }
    });

    return mapPrismaOfferReadiness(record);
  }

  async listOfferReadiness(shortlistId: string): Promise<OfferReadiness[]> {
    const records = await this.client.offerReadiness.findMany({
      where: {
        shortlistId
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    return records.map((record) => mapPrismaOfferReadiness(record));
  }

  async getOfferReadiness(propertyId: string, shortlistId?: string): Promise<OfferReadiness | null> {
    const record = await this.client.offerReadiness.findFirst({
      where: {
        propertyId,
        ...(shortlistId ? { shortlistId } : {})
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    return record ? mapPrismaOfferReadiness(record) : null;
  }

  async updateOfferReadiness(
    id: string,
    patch: {
      status?: OfferReadinessStatus;
      financingReadiness?: OfferFinancingReadiness;
      propertyFitConfidence?: OfferPropertyFitConfidence;
      riskToleranceAlignment?: OfferRiskToleranceAlignment;
      riskLevel?: OfferRiskLevel;
      userConfirmed?: boolean;
    }
  ): Promise<OfferReadiness | null> {
    const existing = await this.client.offerReadiness.findUnique({
      where: {
        id
      }
    });
    if (!existing) {
      return null;
    }

    const itemRecord = await this.client.shortlistItem.findUnique({
      where: {
        id: existing.shortlistItemId as string
      }
    });
    if (!itemRecord) {
      return null;
    }

    const current = mapPrismaOfferReadiness(existing);
    const item = mapPrismaShortlistItem(itemRecord);
    const now = new Date().toISOString();
    const evaluation = evaluateOfferReadiness({
      item,
      now,
      current,
      patch
    });

    const record = await this.client.offerReadiness.update({
      where: {
        id
      },
      data: {
        status: evaluation.status,
        readinessScore: evaluation.readinessScore,
        recommendedOfferPrice: evaluation.recommendedOfferPrice,
        confidence: evaluation.confidence,
        financingReadiness: evaluation.inputs.financingReadiness,
        propertyFitConfidence: evaluation.inputs.propertyFitConfidence,
        riskToleranceAlignment: evaluation.inputs.riskToleranceAlignment,
        riskLevel: evaluation.inputs.riskLevel,
        userConfirmed: evaluation.inputs.userConfirmed,
        dataCompletenessScore: evaluation.inputs.dataCompletenessScore,
        blockingIssuesJson: evaluation.blockingIssues,
        nextStepsJson: evaluation.nextSteps,
        lastEvaluatedAt: new Date(now)
      }
    });

    const shortlist = await this.getShortlist(current.shortlistId);
    await this.recordValidationEvent({
      eventName: "offer_readiness_updated",
      sessionId: shortlist?.sessionId ?? null,
      payload: {
        shortlistId: current.shortlistId,
        shortlistItemId: current.shortlistItemId,
        offerReadinessId: id,
        propertyId: current.propertyId,
        status: evaluation.status
      }
    });

    if (current.status !== evaluation.status) {
      await this.recordValidationEvent({
        eventName: "offer_status_changed",
        sessionId: shortlist?.sessionId ?? null,
        payload: {
          shortlistId: current.shortlistId,
          shortlistItemId: current.shortlistItemId,
          offerReadinessId: id,
          propertyId: current.propertyId,
          fromStatus: current.status,
          toStatus: evaluation.status
        }
      });
    }

    return mapPrismaOfferReadiness(record);
  }

  async getOfferReadinessRecommendation(
    propertyId: string,
    shortlistId?: string
  ): Promise<OfferReadinessRecommendation | null> {
    const record = await this.getOfferReadiness(propertyId, shortlistId);
    return record ? toOfferReadinessRecommendation(record) : null;
  }

  async createNegotiation(payload: {
    propertyId: string;
    shortlistId?: string | null;
    offerReadinessId?: string | null;
    status?: NegotiationStatus;
    initialOfferPrice: number;
    currentOfferPrice?: number;
    sellerCounterPrice?: number | null;
    buyerWalkAwayPrice?: number | null;
    roundNumber?: number;
  }): Promise<NegotiationRecord | null> {
    const offerReadinessRecord = payload.offerReadinessId
      ? await this.client.offerReadiness.findUnique({
          where: {
            id: payload.offerReadinessId
          }
        })
      : await this.client.offerReadiness.findFirst({
          where: {
            propertyId: payload.propertyId,
            ...(payload.shortlistId ? { shortlistId: payload.shortlistId } : {})
          }
        });
    const offerReadiness = offerReadinessRecord ? mapPrismaOfferReadiness(offerReadinessRecord) : null;
    const shortlistId = payload.shortlistId ?? offerReadiness?.shortlistId ?? null;

    const existing = await this.client.negotiationRecord.findFirst({
      where: {
        propertyId: payload.propertyId,
        ...(shortlistId ? { shortlistId } : { shortlistId: null })
      }
    });
    if (existing) {
      return mapPrismaNegotiation(existing);
    }

    const now = new Date().toISOString();
    const evaluation = evaluateNegotiation({
      propertyId: payload.propertyId,
      shortlistId,
      offerReadinessId: payload.offerReadinessId ?? offerReadiness?.id ?? null,
      initialOfferPrice: payload.initialOfferPrice,
      offerReadiness,
      now,
      patch: {
        status: payload.status,
        currentOfferPrice: payload.currentOfferPrice,
        sellerCounterPrice: payload.sellerCounterPrice,
        buyerWalkAwayPrice: payload.buyerWalkAwayPrice,
        roundNumber: payload.roundNumber
      }
    });

    const record = await this.client.negotiationRecord.create({
      data: {
        propertyId: evaluation.propertyId,
        shortlistId: evaluation.shortlistId,
        offerReadinessId: evaluation.offerReadinessId,
        status: evaluation.status,
        initialOfferPrice: evaluation.initialOfferPrice,
        currentOfferPrice: evaluation.currentOfferPrice,
        sellerCounterPrice: evaluation.sellerCounterPrice,
        buyerWalkAwayPrice: evaluation.buyerWalkAwayPrice,
        roundNumber: evaluation.roundNumber,
        guidanceHeadline: evaluation.guidance.headline,
        guidanceRiskLevel: evaluation.guidance.riskLevel,
        guidanceFlagsJson: evaluation.guidance.flags,
        guidanceNextStepsJson: evaluation.guidance.nextSteps,
        lastActionAt: new Date(now)
      }
    });

    await this.client.negotiationEvent.create({
      data: {
        negotiationRecordId: record.id as string,
        type: "NEGOTIATION_STARTED",
        label: "Negotiation started",
        details: null
      }
    });
    await this.client.negotiationEvent.create({
      data: {
        negotiationRecordId: record.id as string,
        type: "INITIAL_OFFER_SET",
        label: "Initial offer set",
        details: `Initial offer recorded at ${evaluation.initialOfferPrice.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0
        })}.`
      }
    });

    const shortlist = shortlistId ? await this.getShortlist(shortlistId) : null;
    await this.recordValidationEvent({
      eventName: "negotiation_started",
      sessionId: shortlist?.sessionId ?? null,
      payload: {
        shortlistId,
        offerReadinessId: evaluation.offerReadinessId,
        negotiationRecordId: record.id as string,
        propertyId: evaluation.propertyId,
        status: evaluation.status
      }
    });

    return mapPrismaNegotiation(record);
  }

  async listNegotiations(shortlistId: string): Promise<NegotiationRecord[]> {
    const records = await this.client.negotiationRecord.findMany({
      where: {
        shortlistId
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    return records.map((record) => mapPrismaNegotiation(record));
  }

  async getNegotiation(propertyId: string, shortlistId?: string): Promise<NegotiationRecord | null> {
    const record = await this.client.negotiationRecord.findFirst({
      where: {
        propertyId,
        ...(shortlistId ? { shortlistId } : {})
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    return record ? mapPrismaNegotiation(record) : null;
  }

  async updateNegotiation(
    id: string,
    patch: {
      status?: NegotiationStatus;
      currentOfferPrice?: number;
      sellerCounterPrice?: number | null;
      buyerWalkAwayPrice?: number | null;
      roundNumber?: number;
    }
  ): Promise<NegotiationRecord | null> {
    const existing = await this.client.negotiationRecord.findUnique({
      where: {
        id
      }
    });
    if (!existing) {
      return null;
    }

    const current = mapPrismaNegotiation(existing);
    const offerReadinessRecord = current.offerReadinessId
      ? await this.client.offerReadiness.findUnique({
          where: {
            id: current.offerReadinessId
          }
        })
      : null;
    const offerReadiness = offerReadinessRecord ? mapPrismaOfferReadiness(offerReadinessRecord) : null;
    const now = new Date().toISOString();
    const evaluation = evaluateNegotiation({
      propertyId: current.propertyId,
      shortlistId: current.shortlistId ?? null,
      offerReadinessId: current.offerReadinessId ?? null,
      initialOfferPrice: current.initialOfferPrice,
      current,
      offerReadiness,
      now,
      patch
    });

    const record = await this.client.negotiationRecord.update({
      where: {
        id
      },
      data: {
        status: evaluation.status,
        currentOfferPrice: evaluation.currentOfferPrice,
        sellerCounterPrice: evaluation.sellerCounterPrice,
        buyerWalkAwayPrice: evaluation.buyerWalkAwayPrice,
        roundNumber: evaluation.roundNumber,
        guidanceHeadline: evaluation.guidance.headline,
        guidanceRiskLevel: evaluation.guidance.riskLevel,
        guidanceFlagsJson: evaluation.guidance.flags,
        guidanceNextStepsJson: evaluation.guidance.nextSteps,
        lastActionAt: new Date(now)
      }
    });

    const shortlist = current.shortlistId ? await this.getShortlist(current.shortlistId) : null;
    const statusEventMap: Partial<Record<NegotiationStatus, WorkflowActivityRecord["eventType"]>> = {
      OFFER_MADE: "offer_submitted",
      COUNTER_RECEIVED: "counter_received",
      COUNTER_SENT: "counter_sent",
      ACCEPTED: "negotiation_accepted",
      REJECTED: "negotiation_rejected",
      WITHDRAWN: "negotiation_withdrawn"
    };
    if (current.status !== evaluation.status && statusEventMap[evaluation.status]) {
      await this.recordValidationEvent({
        eventName: statusEventMap[evaluation.status]!,
        sessionId: shortlist?.sessionId ?? null,
        payload: {
          shortlistId: current.shortlistId,
          offerReadinessId: current.offerReadinessId,
          negotiationRecordId: id,
          propertyId: current.propertyId,
          fromStatus: current.status,
          toStatus: evaluation.status
        }
      });
    }

    return mapPrismaNegotiation(record);
  }

  async createNegotiationEvent(
    negotiationRecordId: string,
    payload: {
      type: NegotiationEventType;
      label: string;
      details?: string | null;
    }
  ): Promise<NegotiationEvent | null> {
    const existing = await this.client.negotiationRecord.findUnique({
      where: {
        id: negotiationRecordId
      }
    });
    if (!existing) {
      return null;
    }

    const now = new Date();
    await this.client.negotiationRecord.update({
      where: {
        id: negotiationRecordId
      },
      data: {
        lastActionAt: now
      }
    });

    const event = await this.client.negotiationEvent.create({
      data: {
        negotiationRecordId,
        type: payload.type,
        label: payload.label,
        details: payload.details ?? null,
        createdAt: now
      }
    });

    return mapPrismaNegotiationEvent(event);
  }

  async listNegotiationEvents(negotiationRecordId: string): Promise<NegotiationEvent[]> {
    const records = await this.client.negotiationEvent.findMany({
      where: {
        negotiationRecordId
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    return records.map((record) => mapPrismaNegotiationEvent(record));
  }

  async getNegotiationSummary(
    propertyId: string,
    shortlistId?: string
  ): Promise<NegotiationSummary | null> {
    const record = await this.getNegotiation(propertyId, shortlistId);
    return record ? toNegotiationSummary(record) : null;
  }

  async updateShortlistItem(
    shortlistId: string,
    itemId: string,
    patch: {
      reviewState?: ReviewState;
      decisionConfidence?: DecisionConfidence | null;
      decisionRationale?: string | null;
      decisionRisks?: string[];
      lastDecisionReviewedAt?: string | null;
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

    const now = new Date().toISOString();
    const previousReviewState = existing.reviewState as ReviewState;
    const previousDecisionSnapshot = JSON.stringify({
      decisionConfidence: (existing.decisionConfidence as DecisionConfidence | null) ?? null,
      decisionRationale: (existing.decisionRationale as string | null) ?? null,
      decisionRisks: parseDecisionRisksJson(existing.decisionRisksJson),
      lastDecisionReviewedAt:
        existing.lastDecisionReviewedAt instanceof Date
          ? existing.lastDecisionReviewedAt.toISOString()
          : ((existing.lastDecisionReviewedAt as string | null) ?? null)
    });

    const record = await this.client.shortlistItem.update({
      where: {
        id: itemId
      },
      data: {
        ...(patch.reviewState !== undefined ? { reviewState: patch.reviewState } : {}),
        ...(patch.decisionConfidence !== undefined ? { decisionConfidence: patch.decisionConfidence } : {}),
        ...(patch.decisionRationale !== undefined ? { decisionRationale: patch.decisionRationale } : {}),
        ...(patch.decisionRisks !== undefined
          ? { decisionRisksJson: normalizeDecisionRisks(patch.decisionRisks) }
          : {}),
        ...(patch.lastDecisionReviewedAt !== undefined
          ? {
              lastDecisionReviewedAt: patch.lastDecisionReviewedAt
                ? new Date(patch.lastDecisionReviewedAt)
                : null
            }
          : {})
      }
    });

    const shortlist = await this.getShortlist(shortlistId);
    if (patch.reviewState !== undefined && patch.reviewState !== previousReviewState) {
      await this.recordValidationEvent({
        eventName: "review_state_changed",
        sessionId: shortlist?.sessionId ?? null,
        payload: {
          shortlistId,
          shortlistItemId: itemId,
          reviewState: patch.reviewState ?? (record.reviewState as string)
        }
      });
    }

    const nextDecisionSnapshot = JSON.stringify({
      decisionConfidence: (record.decisionConfidence as DecisionConfidence | null) ?? null,
      decisionRationale: (record.decisionRationale as string | null) ?? null,
      decisionRisks: parseDecisionRisksJson(record.decisionRisksJson),
      lastDecisionReviewedAt:
        record.lastDecisionReviewedAt instanceof Date
          ? record.lastDecisionReviewedAt.toISOString()
          : ((record.lastDecisionReviewedAt as string | null) ?? null)
    });

    if (previousDecisionSnapshot !== nextDecisionSnapshot) {
      await this.recordValidationEvent({
        eventName: "selected_choice_rationale_updated",
        sessionId: shortlist?.sessionId ?? null,
        payload: {
          shortlistId,
          shortlistItemId: itemId,
          choiceStatus: (record.choiceStatus as ChoiceStatus | null) ?? "candidate",
          decisionConfidence: (record.decisionConfidence as DecisionConfidence | null) ?? null
        }
      });
    }

    if (patch.lastDecisionReviewedAt !== undefined) {
      await this.recordValidationEvent({
        eventName: "selected_choice_reviewed",
        sessionId: shortlist?.sessionId ?? null,
        payload: {
          shortlistId,
          shortlistItemId: itemId,
          reviewedAt: patch.lastDecisionReviewedAt ?? null
        }
      });
    }

    return mapPrismaShortlistItem(record);
  }

  async selectShortlistItem(payload: {
    shortlistId: string;
    itemId: string;
    replaceMode?: "backup" | "replaced" | "dropped";
    decisionConfidence?: DecisionConfidence | null;
    decisionRationale?: string | null;
    decisionRisks?: string[];
    lastDecisionReviewedAt?: string | null;
  }): Promise<{
    selectedItem: ShortlistItem;
    previousPrimaryItem: ShortlistItem | null;
  } | null> {
    const shortlist = await this.getShortlist(payload.shortlistId);
    if (!shortlist) {
      return null;
    }

    const now = new Date().toISOString();
    const replaceMode = payload.replaceMode ?? "backup";
    const result = await this.client.$transaction(async (tx) => {
      const records = await tx.shortlistItem.findMany({
        where: {
          shortlistId: payload.shortlistId
        }
      });
      const items = records.map((record) => mapPrismaShortlistItem(record));
      const target = items.find((entry) => entry.id === payload.itemId) ?? null;
      if (
        !target ||
        isTerminalChoiceStatus(target.choiceStatus) ||
        target.choiceStatus === "under_contract" ||
        target.choiceStatus === "active_pursuit"
      ) {
        return null;
      }

      const previousPrimary =
        resolvePrimaryChoiceOwner(items.filter((entry) => entry.id !== target.id)) ?? null;
      if (previousPrimary?.choiceStatus === "closed") {
        return null;
      }

      const updates: Promise<unknown>[] = [];
      if (previousPrimary && previousPrimary.id !== target.id) {
        const previousData: Record<string, unknown> = {
          selectionRank: null,
          statusChangedAt: new Date(now)
        };
        if (replaceMode === "backup") {
          previousData.choiceStatus = "backup";
          previousData.replacedByShortlistItemId = null;
          previousData.droppedReason = null;
        } else if (replaceMode === "replaced") {
          previousData.choiceStatus = "replaced";
          previousData.replacedByShortlistItemId = target.id;
          previousData.droppedReason = "better_alternative_selected";
        } else {
          previousData.choiceStatus = "dropped";
          previousData.replacedByShortlistItemId = null;
          previousData.droppedReason = "better_alternative_selected";
        }
        updates.push(
          tx.shortlistItem.update({
            where: { id: previousPrimary.id },
            data: previousData
          })
        );
      }

      const existingSelected = items.filter(
        (entry) => entry.id !== target.id && entry.choiceStatus === "selected"
      );
      for (const item of existingSelected) {
        updates.push(
          tx.shortlistItem.update({
            where: { id: item.id },
            data: {
              choiceStatus: "backup",
              selectionRank: null,
              statusChangedAt: new Date(now)
            }
          })
        );
      }

      const normalizedDecisionRisks =
        payload.decisionRisks !== undefined
          ? normalizeDecisionRisks(payload.decisionRisks)
          : target.decisionRisks;
      updates.push(
        tx.shortlistItem.update({
          where: { id: target.id },
          data: {
            choiceStatus: "selected",
            selectionRank: 1,
            decisionConfidence:
              payload.decisionConfidence !== undefined ? payload.decisionConfidence : target.decisionConfidence,
            decisionRationale:
              payload.decisionRationale !== undefined ? payload.decisionRationale : target.decisionRationale,
            decisionRisksJson: normalizedDecisionRisks,
            ...(payload.lastDecisionReviewedAt !== undefined
              ? {
                  lastDecisionReviewedAt: payload.lastDecisionReviewedAt
                    ? new Date(payload.lastDecisionReviewedAt)
                    : null
                }
              : {}),
            selectedAt: target.selectedAt ? new Date(target.selectedAt) : new Date(now),
            statusChangedAt: target.choiceStatus === "selected" ? new Date(target.statusChangedAt) : new Date(now),
            replacedByShortlistItemId: null,
            droppedReason: null
          }
        })
      );

      await Promise.all(updates);

      const nextRecords = await tx.shortlistItem.findMany({
        where: {
          shortlistId: payload.shortlistId
        }
      });
      const nextItems = nextRecords.map((record) => mapPrismaShortlistItem(record));
      const orderedBackups = nextItems
        .filter((entry) => entry.choiceStatus === "backup")
        .sort((left, right) => {
          if ((left.selectionRank ?? Number.POSITIVE_INFINITY) !== (right.selectionRank ?? Number.POSITIVE_INFINITY)) {
            return (left.selectionRank ?? Number.POSITIVE_INFINITY) - (right.selectionRank ?? Number.POSITIVE_INFINITY);
          }
          return right.updatedAt.localeCompare(left.updatedAt);
        });
      for (const [index, item] of orderedBackups.entries()) {
        await tx.shortlistItem.update({
          where: { id: item.id },
          data: {
            selectionRank: index + 2
          }
        });
      }

      const selectedRecord = await tx.shortlistItem.findUnique({
        where: {
          id: target.id
        }
      });
      const previousRecord = previousPrimary
        ? await tx.shortlistItem.findUnique({
            where: {
              id: previousPrimary.id
            }
          })
        : null;

      return {
        selectedItem: selectedRecord ? mapPrismaShortlistItem(selectedRecord) : null,
        previousPrimaryItem: previousRecord ? mapPrismaShortlistItem(previousRecord) : null
      };
    });

    if (!result?.selectedItem) {
      return null;
    }

    await this.recordValidationEvent({
      eventName:
        result.previousPrimaryItem && result.previousPrimaryItem.id !== result.selectedItem.id
          ? "selected_choice_replaced"
          : "selected_choice_marked",
      sessionId: shortlist.sessionId,
      payload: {
        shortlistId: payload.shortlistId,
        shortlistItemId: result.selectedItem.id,
        previousPrimaryItemId: result.previousPrimaryItem?.id ?? null,
        replaceMode,
        choiceStatus: result.selectedItem.choiceStatus
      }
    });

    return result;
  }

  async reorderShortlistItems(payload: {
    shortlistId: string;
    orderedBackupItemIds: string[];
  }): Promise<ShortlistItem[] | null> {
    const shortlist = await this.getShortlist(payload.shortlistId);
    if (!shortlist) {
      return null;
    }

    const seen = new Set<string>();
    if (payload.orderedBackupItemIds.some((id) => (seen.has(id) ? true : (seen.add(id), false)))) {
      return null;
    }

    const now = new Date().toISOString();
    const success = await this.client.$transaction(async (tx) => {
      const records = await tx.shortlistItem.findMany({
        where: {
          shortlistId: payload.shortlistId
        }
      });
      const items = records.map((record) => mapPrismaShortlistItem(record));
      const selected = items.find((entry) => entry.choiceStatus === "selected" && entry.selectionRank === 1) ?? null;
      if (!selected) {
        return false;
      }

      const orderedBackups = payload.orderedBackupItemIds.map(
        (id) => items.find((entry) => entry.id === id) ?? null
      );
      if (
        orderedBackups.some((entry) => !entry) ||
        orderedBackups.some(
          (entry) => !entry || isTerminalChoiceStatus(entry.choiceStatus) || entry.choiceStatus === "selected"
        )
      ) {
        return false;
      }

      const orderedIds = new Set(payload.orderedBackupItemIds);
      for (const item of items) {
        if (item.id === selected.id) {
          await tx.shortlistItem.update({
            where: { id: item.id },
            data: {
              selectionRank: 1
            }
          });
          continue;
        }

        if (orderedIds.has(item.id)) {
          const statusChanged = item.choiceStatus !== "backup";
          await tx.shortlistItem.update({
            where: { id: item.id },
            data: {
              choiceStatus: "backup",
              selectionRank: payload.orderedBackupItemIds.indexOf(item.id) + 2,
              ...(statusChanged ? { statusChangedAt: new Date(now) } : {})
            }
          });
        } else if (item.choiceStatus === "backup") {
          await tx.shortlistItem.update({
            where: { id: item.id },
            data: {
              choiceStatus: "candidate",
              selectionRank: null,
              statusChangedAt: new Date(now)
            }
          });
        }
      }

      return true;
    });

    if (!success) {
      return null;
    }

    await this.recordValidationEvent({
      eventName: "selected_choice_backup_reordered",
      sessionId: shortlist.sessionId,
      payload: {
        shortlistId: payload.shortlistId,
        orderedBackupItemIds: payload.orderedBackupItemIds
      }
    });

    return this.listShortlistItems(payload.shortlistId);
  }

  async dropShortlistItem(payload: {
    shortlistId: string;
    itemId: string;
    droppedReason: DroppedReason;
    decisionRationale?: string | null;
  }): Promise<{
    item: ShortlistItem;
    promotedBackupItem: ShortlistItem | null;
  } | null> {
    const shortlist = await this.getShortlist(payload.shortlistId);
    if (!shortlist) {
      return null;
    }

    const now = new Date().toISOString();
    const droppedItem = await this.client.$transaction(async (tx) => {
      const existing = await tx.shortlistItem.findUnique({
        where: {
          id: payload.itemId
        }
      });
      if (!existing || (existing.shortlistId as string) !== payload.shortlistId) {
        return null;
      }

      const current = mapPrismaShortlistItem(existing);
      if (isTerminalChoiceStatus(current.choiceStatus)) {
        return null;
      }

      await tx.shortlistItem.update({
        where: {
          id: payload.itemId
        },
        data: {
          choiceStatus: "dropped",
          selectionRank: null,
          droppedReason: payload.droppedReason,
          ...(payload.decisionRationale !== undefined ? { decisionRationale: payload.decisionRationale } : {}),
          replacedByShortlistItemId: null,
          statusChangedAt: new Date(now)
        }
      });

      const siblingRecords = await tx.shortlistItem.findMany({
        where: {
          shortlistId: payload.shortlistId
        }
      });
      const siblingItems = siblingRecords.map((record) => mapPrismaShortlistItem(record)).filter((item) => item.id !== payload.itemId);
      const orderedBackups = siblingItems
        .filter((item) => item.choiceStatus === "backup")
        .sort((left, right) => {
          if ((left.selectionRank ?? Number.POSITIVE_INFINITY) !== (right.selectionRank ?? Number.POSITIVE_INFINITY)) {
            return (left.selectionRank ?? Number.POSITIVE_INFINITY) - (right.selectionRank ?? Number.POSITIVE_INFINITY);
          }
          return right.updatedAt.localeCompare(left.updatedAt);
        });
      for (const [index, item] of orderedBackups.entries()) {
        await tx.shortlistItem.update({
          where: { id: item.id },
          data: {
            selectionRank: index + 2
          }
        });
      }

      const record = await tx.shortlistItem.findUnique({
        where: {
          id: payload.itemId
        }
      });
      return record ? mapPrismaShortlistItem(record) : null;
    });

    if (!droppedItem) {
      return null;
    }

    await this.recordValidationEvent({
      eventName: "selected_choice_dropped",
      sessionId: shortlist.sessionId,
      payload: {
        shortlistId: payload.shortlistId,
        shortlistItemId: payload.itemId,
        droppedReason: payload.droppedReason
      }
    });

    return {
      item: droppedItem,
      promotedBackupItem: null
    };
  }

  async getSelectedChoice(shortlistId: string): Promise<SelectedChoiceView | null> {
    const shortlist = await this.getShortlist(shortlistId);
    if (!shortlist) {
      return null;
    }

    const items = await this.listShortlistItems(shortlistId);
    return buildSelectedChoiceView(shortlistId, items);
  }

  async getSelectedChoiceSummary(shortlistId: string): Promise<SelectedChoiceConciergeSummary | null> {
    const shortlist = await this.getShortlist(shortlistId);
    if (!shortlist) {
      return null;
    }

    const items = await this.listShortlistItems(shortlistId);
    const primaryOwner = resolvePrimaryChoiceOwner(items);
    const financialReadiness = await this.getLatestFinancialReadiness(shortlist.sessionId ?? null);
    const workflowNotifications = primaryOwner
      ? await this.listWorkflowNotifications({
          shortlistId,
          propertyId: primaryOwner.canonicalPropertyId
        })
      : [];
    const workflowActivity = shortlist.sessionId
      ? (await this.listWorkflowActivity(shortlist.sessionId, 50)).filter(
          (entry) =>
            entry.shortlistId === shortlistId &&
            (!primaryOwner ||
              typeof entry.payload?.canonicalPropertyId !== "string" ||
              entry.payload.canonicalPropertyId === primaryOwner.canonicalPropertyId)
        )
      : [];

    return buildSelectedChoiceConciergeSummary({
      shortlistId,
      items,
      financialReadiness,
      offerReadiness: primaryOwner
        ? await this.getOfferReadiness(primaryOwner.canonicalPropertyId, shortlistId)
        : null,
      offerPreparation: primaryOwner
        ? await this.getLatestOfferPreparation({
            propertyId: primaryOwner.canonicalPropertyId,
            shortlistId
          })
        : null,
      offerSubmission: primaryOwner
        ? await this.getLatestOfferSubmission({
            propertyId: primaryOwner.canonicalPropertyId,
            shortlistId
          })
        : null,
      negotiation: primaryOwner
        ? await this.getNegotiation(primaryOwner.canonicalPropertyId, shortlistId)
        : null,
      underContract: primaryOwner
        ? await this.getLatestUnderContractCoordination({
            propertyId: primaryOwner.canonicalPropertyId,
            shortlistId
          })
        : null,
      closingReadiness: primaryOwner
        ? await this.getLatestClosingReadiness({
            propertyId: primaryOwner.canonicalPropertyId,
            shortlistId
          })
        : null,
      workflowNotifications,
      workflowActivity
    });
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

    const negotiation = await this.client.negotiationRecord.findFirst({
      where: {
        shortlistId,
        propertyId: existing.canonicalPropertyId as string
      }
    });
    if (negotiation) {
      await this.client.negotiationRecord.delete({
        where: {
          id: negotiation.id as string
        }
      });
    }

    const offerPreparation = await this.client.offerPreparation.findFirst({
      where: {
        shortlistId,
        propertyId: existing.canonicalPropertyId as string
      }
    });
    if (offerPreparation) {
      await this.client.offerPreparation.delete?.({
        where: {
          id: offerPreparation.id as string
        }
      });
    }

    const offerSubmission = await this.client.offerSubmission.findFirst({
      where: {
        shortlistId,
        propertyId: existing.canonicalPropertyId as string
      }
    });
    if (offerSubmission) {
      await this.client.offerSubmission.delete?.({
        where: {
          id: offerSubmission.id as string
        }
      });
    }

    const underContract = await this.client.underContractCoordination.findFirst({
      where: {
        shortlistId,
        propertyId: existing.canonicalPropertyId as string
      }
    });
    if (underContract) {
      await this.client.underContractCoordination.delete?.({
        where: {
          id: underContract.id as string
        }
      });
    }

    const closingReadiness = await this.client.closingReadiness.findFirst({
      where: {
        shortlistId,
        propertyId: existing.canonicalPropertyId as string
      }
    });
    if (closingReadiness) {
      await this.client.closingReadiness.delete?.({
        where: {
          id: closingReadiness.id as string
        }
      });
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

  async createUnifiedActivity(payload: {
    workflowId?: string | null;
    sessionId?: string | null;
    propertyId?: string | null;
    propertyAddressLabel?: string | null;
    shortlistId?: string | null;
    moduleName: UnifiedActivityModuleName;
    eventCategory: UnifiedActivityEventCategory;
    subjectType: string;
    subjectId: string;
    title: string;
    summary: string;
    oldValueSnapshot?: Record<string, unknown> | null;
    newValueSnapshot?: Record<string, unknown> | null;
    triggerType: UnifiedActivityTriggerType;
    triggerLabel: string;
    actorType?: UnifiedActivityActorType;
    actorId?: string | null;
    relatedNotificationId?: string | null;
    relatedExplanationId?: string | null;
    createdAt?: string;
  }): Promise<UnifiedActivityRecord> {
    const record = await this.client.unifiedActivityLog.create({
      data: {
        workflowId: payload.workflowId ?? null,
        sessionId: payload.sessionId ?? null,
        propertyId: payload.propertyId ?? null,
        propertyAddressLabel: payload.propertyAddressLabel ?? null,
        shortlistId: payload.shortlistId ?? null,
        moduleName: payload.moduleName,
        eventCategory: payload.eventCategory,
        subjectType: payload.subjectType,
        subjectId: payload.subjectId,
        title: payload.title,
        summary: payload.summary,
        oldValueSnapshotJson: payload.oldValueSnapshot ?? null,
        newValueSnapshotJson: payload.newValueSnapshot ?? null,
        triggerType: payload.triggerType,
        triggerLabel: payload.triggerLabel,
        actorType: payload.actorType ?? "SYSTEM",
        actorId: payload.actorId ?? null,
        relatedNotificationId: payload.relatedNotificationId ?? null,
        relatedExplanationId: payload.relatedExplanationId ?? null,
        ...(payload.createdAt ? { createdAt: new Date(payload.createdAt) } : {})
      }
    });
    return mapPrismaUnifiedActivityRecord(record);
  }

  async listUnifiedActivity(filters?: {
    sessionId?: string | null;
    propertyId?: string | null;
    shortlistId?: string | null;
    moduleName?: UnifiedActivityModuleName;
    eventCategories?: UnifiedActivityEventCategory[];
    subjectType?: string;
    subjectId?: string;
    limit?: number;
  }): Promise<UnifiedActivityRecord[]> {
    const records = await this.client.unifiedActivityLog.findMany({
      where: {
        ...(filters?.sessionId !== undefined ? { sessionId: filters.sessionId ?? null } : {}),
        ...(filters?.propertyId !== undefined ? { propertyId: filters.propertyId ?? null } : {}),
        ...(filters?.shortlistId !== undefined ? { shortlistId: filters.shortlistId ?? null } : {}),
        ...(filters?.moduleName ? { moduleName: filters.moduleName } : {}),
        ...(filters?.subjectType ? { subjectType: filters.subjectType } : {}),
        ...(filters?.subjectId ? { subjectId: filters.subjectId } : {}),
        ...(filters?.eventCategories?.length ? { eventCategory: { in: filters.eventCategories } } : {})
      },
      orderBy: {
        createdAt: "desc"
      },
      take: filters?.limit
    });

    return records.map((record) => mapPrismaUnifiedActivityRecord(record));
  }

  async createWorkflowNotification(payload: {
    workflowId?: string | null;
    sessionId?: string | null;
    propertyId?: string | null;
    propertyAddressLabel?: string | null;
    shortlistId?: string | null;
    moduleName: NotificationModuleName;
    alertCategory: AlertCategory;
    severity: NotificationSeverity;
    status?: NotificationStatus;
    triggeringRuleLabel: string;
    relatedSubjectType: string;
    relatedSubjectId: string;
    title: string;
    message: string;
    actionLabel?: string | null;
    actionTarget?: NotificationActionTarget | null;
    dueAt?: string | null;
    explanationSubjectType?: string | null;
    explanationSubjectId?: string | null;
  }): Promise<WorkflowNotification> {
    const record = await this.client.workflowNotification.create({
      data: {
        workflowId: payload.workflowId ?? null,
        sessionId: payload.sessionId ?? null,
        propertyId: payload.propertyId ?? null,
        propertyAddressLabel: payload.propertyAddressLabel ?? null,
        shortlistId: payload.shortlistId ?? null,
        moduleName: payload.moduleName,
        alertCategory: payload.alertCategory,
        severity: payload.severity,
        status: payload.status ?? "UNREAD",
        triggeringRuleLabel: payload.triggeringRuleLabel,
        relatedSubjectType: payload.relatedSubjectType,
        relatedSubjectId: payload.relatedSubjectId,
        title: payload.title,
        message: payload.message,
        actionLabel: payload.actionLabel ?? null,
        actionTargetJson: payload.actionTarget ?? null,
        dueAt: payload.dueAt ? new Date(payload.dueAt) : null,
        explanationSubjectType: payload.explanationSubjectType ?? null,
        explanationSubjectId: payload.explanationSubjectId ?? null
      }
    });

    await this.client.workflowNotificationHistoryEvent.create({
      data: {
        notificationId: record.id as string,
        eventType: "CREATED",
        previousValue: null,
        nextValue: (record.status as string) ?? "UNREAD"
      }
    });
    await this.createUnifiedActivity({
      workflowId: (record.workflowId as string | null) ?? null,
      sessionId: (record.sessionId as string | null) ?? null,
      propertyId: (record.propertyId as string | null) ?? null,
      propertyAddressLabel: (record.propertyAddressLabel as string | null) ?? null,
      shortlistId: (record.shortlistId as string | null) ?? null,
      moduleName: "notification_alerting",
      eventCategory: "NOTIFICATION_CREATED",
      subjectType: "workflow_notification",
      subjectId: record.id as string,
      title: record.title as string,
      summary: record.message as string,
      newValueSnapshot: {
        moduleName: record.moduleName as string,
        alertCategory: record.alertCategory as string,
        severity: record.severity as string,
        status: record.status as string,
        dueAt: record.dueAt ? (record.dueAt as Date).toISOString() : null
      },
      triggerType: payload.alertCategory === "DEADLINE_ALERT" ? "DEADLINE_RULE" : "SYSTEM_RULE",
      triggerLabel: payload.triggeringRuleLabel,
      actorType: "SYSTEM",
      relatedNotificationId: record.id as string
    });
    if (payload.alertCategory === "DEADLINE_ALERT") {
      await this.createUnifiedActivity({
        workflowId: (record.workflowId as string | null) ?? null,
        sessionId: (record.sessionId as string | null) ?? null,
        propertyId: (record.propertyId as string | null) ?? null,
        propertyAddressLabel: (record.propertyAddressLabel as string | null) ?? null,
        shortlistId: (record.shortlistId as string | null) ?? null,
        moduleName:
          payload.moduleName === "transaction_command_center" ? "transaction_command_center" : payload.moduleName,
        eventCategory: deadlineEventCategoryFromDueAt(payload.dueAt ?? null),
        subjectType: payload.relatedSubjectType,
        subjectId: payload.relatedSubjectId,
        title: payload.title,
        summary: payload.message,
        newValueSnapshot: {
          dueAt: payload.dueAt ?? null,
          severity: payload.severity
        },
        triggerType: "DEADLINE_RULE",
        triggerLabel: payload.triggeringRuleLabel,
        actorType: "SYSTEM",
        relatedNotificationId: record.id as string
      });
    }
    if (payload.alertCategory === "MILESTONE_ALERT") {
      await this.createUnifiedActivity({
        workflowId: (record.workflowId as string | null) ?? null,
        sessionId: (record.sessionId as string | null) ?? null,
        propertyId: (record.propertyId as string | null) ?? null,
        propertyAddressLabel: (record.propertyAddressLabel as string | null) ?? null,
        shortlistId: (record.shortlistId as string | null) ?? null,
        moduleName:
          payload.moduleName === "transaction_command_center" ? "transaction_command_center" : payload.moduleName,
        eventCategory: "MILESTONE_REACHED",
        subjectType: payload.relatedSubjectType,
        subjectId: payload.relatedSubjectId,
        title: payload.title,
        summary: payload.message,
        newValueSnapshot: {
          severity: payload.severity
        },
        triggerType: "STATUS_TRANSITION",
        triggerLabel: payload.triggeringRuleLabel,
        actorType: "SYSTEM",
        relatedNotificationId: record.id as string
      });
    }

    return mapPrismaWorkflowNotification(record);
  }

  async getWorkflowNotification(id: string): Promise<WorkflowNotification | null> {
    const record = await this.client.workflowNotification.findUnique({
      where: {
        id
      }
    });

    return record ? mapPrismaWorkflowNotification(record) : null;
  }

  async listWorkflowNotifications(filters?: {
    sessionId?: string | null;
    propertyId?: string | null;
    shortlistId?: string | null;
    statuses?: NotificationStatus[];
    limit?: number;
  }): Promise<WorkflowNotification[]> {
    const records = await this.client.workflowNotification.findMany({
      where: {
        ...(filters?.sessionId !== undefined ? { sessionId: filters.sessionId ?? null } : {}),
        ...(filters?.propertyId !== undefined ? { propertyId: filters.propertyId ?? null } : {}),
        ...(filters?.shortlistId !== undefined ? { shortlistId: filters.shortlistId ?? null } : {}),
        ...(filters?.statuses ? { status: { in: filters.statuses } } : {})
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: filters?.limit
    });

    return records.map((record) => mapPrismaWorkflowNotification(record));
  }

  async updateWorkflowNotification(
    id: string,
    patch: {
      severity?: NotificationSeverity;
      status?: NotificationStatus;
      title?: string;
      message?: string;
      actionLabel?: string | null;
      actionTarget?: NotificationActionTarget | null;
      dueAt?: string | null;
      readAt?: string | null;
      dismissedAt?: string | null;
      resolvedAt?: string | null;
      explanationSubjectType?: string | null;
      explanationSubjectId?: string | null;
    }
  ): Promise<WorkflowNotification | null> {
    const existing = await this.client.workflowNotification.findUnique({
      where: {
        id
      }
    });

    if (!existing) {
      return null;
    }

    const updated = await this.client.workflowNotification.update({
      where: {
        id
      },
      data: {
        ...(patch.severity ? { severity: patch.severity } : {}),
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.message !== undefined ? { message: patch.message } : {}),
        ...(patch.actionLabel !== undefined ? { actionLabel: patch.actionLabel } : {}),
        ...(patch.actionTarget !== undefined ? { actionTargetJson: patch.actionTarget } : {}),
        ...(patch.dueAt !== undefined ? { dueAt: patch.dueAt ? new Date(patch.dueAt) : null } : {}),
        ...(patch.readAt !== undefined ? { readAt: patch.readAt ? new Date(patch.readAt) : null } : {}),
        ...(patch.dismissedAt !== undefined
          ? { dismissedAt: patch.dismissedAt ? new Date(patch.dismissedAt) : null }
          : {}),
        ...(patch.resolvedAt !== undefined
          ? { resolvedAt: patch.resolvedAt ? new Date(patch.resolvedAt) : null }
          : {}),
        ...(patch.explanationSubjectType !== undefined
          ? { explanationSubjectType: patch.explanationSubjectType }
          : {}),
        ...(patch.explanationSubjectId !== undefined
          ? { explanationSubjectId: patch.explanationSubjectId }
          : {})
      }
    });

    if (patch.status && patch.status !== (existing.status as NotificationStatus)) {
      const eventType: WorkflowNotificationHistoryEvent["eventType"] =
        patch.status === "READ"
          ? "READ"
          : patch.status === "DISMISSED"
            ? "DISMISSED"
            : patch.status === "RESOLVED"
              ? "RESOLVED"
              : "READ";
      await this.client.workflowNotificationHistoryEvent.create({
        data: {
          notificationId: id,
          eventType,
          previousValue: (existing.status as string) ?? null,
          nextValue: patch.status
        }
      });
      const activityCategory: UnifiedActivityEventCategory =
        patch.status === "READ"
          ? "NOTIFICATION_READ"
          : patch.status === "DISMISSED"
            ? "NOTIFICATION_DISMISSED"
            : "NOTIFICATION_RESOLVED";
      await this.createUnifiedActivity({
        workflowId: (existing.workflowId as string | null) ?? null,
        sessionId: (existing.sessionId as string | null) ?? null,
        propertyId: (existing.propertyId as string | null) ?? null,
        propertyAddressLabel: (existing.propertyAddressLabel as string | null) ?? null,
        shortlistId: (existing.shortlistId as string | null) ?? null,
        moduleName: "notification_alerting",
        eventCategory: activityCategory,
        subjectType: "workflow_notification",
        subjectId: id,
        title: (existing.title as string) ?? "Notification updated",
        summary:
          activityCategory === "NOTIFICATION_READ"
            ? "Notification marked read."
            : activityCategory === "NOTIFICATION_DISMISSED"
              ? "Notification dismissed."
              : "Notification resolved.",
        oldValueSnapshot: { status: (existing.status as string | null) ?? null },
        newValueSnapshot: { status: patch.status },
        triggerType: "USER_ACTION",
        triggerLabel: eventType.toLowerCase(),
        actorType: patch.status === "RESOLVED" ? "SYSTEM" : "USER",
        relatedNotificationId: id
      });
    }

    if (patch.severity && patch.severity !== (existing.severity as NotificationSeverity)) {
      await this.client.workflowNotificationHistoryEvent.create({
        data: {
          notificationId: id,
          eventType: "SEVERITY_CHANGED",
          previousValue: (existing.severity as string) ?? null,
          nextValue: patch.severity
        }
      });
    }

    return mapPrismaWorkflowNotification(updated);
  }

  async listWorkflowNotificationHistory(filters?: {
    sessionId?: string | null;
    propertyId?: string | null;
    shortlistId?: string | null;
    notificationId?: string;
    limit?: number;
  }): Promise<WorkflowNotificationHistoryEvent[]> {
    const records = await this.client.workflowNotificationHistoryEvent.findMany({
      where: {
        ...(filters?.notificationId
          ? { notificationId: filters.notificationId }
          : {
              notification: {
                ...(filters?.sessionId !== undefined ? { sessionId: filters.sessionId ?? null } : {}),
                ...(filters?.propertyId !== undefined ? { propertyId: filters.propertyId ?? null } : {}),
                ...(filters?.shortlistId !== undefined ? { shortlistId: filters.shortlistId ?? null } : {})
              }
            })
      },
      orderBy: {
        createdAt: "desc"
      },
      take: filters?.limit
    });

    return records.map((record) => mapPrismaWorkflowNotificationHistoryEvent(record));
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

export { buildBuyerTransactionCommandCenter } from "./transaction-command-center";
export {
  buildClosingReadinessExplanations,
  buildFinancialReadinessExplanations,
  buildOfferPreparationExplanations,
  buildOfferSubmissionExplanations,
  buildTransactionCommandCenterExplanations,
  buildUnderContractExplanations
} from "./explanations";
export { buildWorkflowNotificationCandidates, planWorkflowNotificationSync } from "./notifications";
