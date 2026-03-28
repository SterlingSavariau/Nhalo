import cors from "@fastify/cors";
import { ConfigError, getConfig } from "@nhalo/config";
import { createPersistenceLayer, type PersistenceLayer } from "@nhalo/db";
import { DEMO_SEARCH_SCENARIOS, createMockProviders, createProviders } from "@nhalo/providers";
import type {
  CollaborationActivityRecord,
  DependencyReadinessRecord,
  DataQualitySeverity,
  DataQualitySourceDomain,
  DataQualityStatus,
  DemoScenario,
  EnvironmentProfileName,
  EffectiveCapabilities,
  GeocodeCacheRepository,
  GoLiveCheckItem,
  GoLiveCheckSummary,
  LaunchGuardrail,
  ListingCacheRepository,
  MarketSnapshotRepository,
  PilotFeatureOverrides,
  PilotLinkView,
  PlanTier,
  ProviderStatus,
  SearchMetadata,
  SafetySignalCacheRepository,
  SearchRepository,
  SearchResponse,
  SharedComment,
  SharedShortlistView,
  SharedSnapshotView,
  Shortlist,
  ShortlistItem,
  SupportContextSummary,
  ReviewerDecision,
  ReleaseSummary,
  ReliabilityIncidentStatus,
  ReliabilityStateSummary,
  ValidationEventName
} from "@nhalo/types";
import Fastify from "fastify";
import { ZodError, z } from "zod";
import { ApiError, isApiError } from "./errors";
import { createLogger, type AppLogger } from "./logger";
import { MetricsCollector } from "./metrics";
import { resolveEffectiveCapabilities } from "./capabilities";
import { instrumentProviders } from "./provider-runtime";
import { ReliabilityManager, classifyStartupDependencies } from "./reliability";
import { searchRequestSchema } from "./search-schema";
import { runSearch } from "./search-service";

const searchSnapshotPayloadSchema = z.object({
  request: searchRequestSchema,
  sessionId: z.string().trim().min(1).optional(),
  searchDefinitionId: z.string().trim().min(1).optional(),
  historyRecordId: z.string().trim().min(1).optional(),
  response: z.object({
    homes: z.array(z.unknown()),
    appliedFilters: z.record(z.string(), z.unknown()),
    appliedWeights: z.object({
      price: z.number(),
      size: z.number(),
      safety: z.number()
    }),
    metadata: z.record(z.string(), z.unknown())
  })
});

const metricsEventSchema = z.object({
  eventType: z.enum([
    "comparison_view",
    "explainability_render",
    "search_restore",
    "recent_activity_panel_view",
    "onboarding_view",
    "onboarding_dismiss",
    "empty_state_view",
    "suggestion_click",
    "detail_panel_open",
    "result_compare_add",
    "snapshot_reopen",
    "saved_search_restore",
    "validation_prompt_view",
    "validation_prompt_response",
    "demo_scenario_start",
    "walkthrough_view",
    "walkthrough_dismiss",
    "export_use",
    "cta_click",
    "historical_compare_view"
  ])
});

const shareSnapshotSchema = z.object({
  sessionId: z.string().trim().min(1).optional(),
  expiresInDays: z.number().int().positive().max(365).optional()
});

const feedbackSchema = z.object({
  sessionId: z.string().trim().min(1).optional(),
  snapshotId: z.string().trim().min(1).optional(),
  historyRecordId: z.string().trim().min(1).optional(),
  searchDefinitionId: z.string().trim().min(1).optional(),
  category: z.enum([
    "useful",
    "accuracy",
    "explainability",
    "confidence",
    "missing_homes",
    "bad_matches",
    "comparison_helpful",
    "empty_state_helpful",
    "general"
  ]),
  value: z.enum(["positive", "negative", "clear", "unclear", "accurate", "inaccurate"]),
  comment: z.string().trim().max(1000).optional()
});

const validationEventSchema = z.object({
  eventName: z.enum([
    "search_started",
    "search_completed",
    "result_opened",
    "comparison_started",
    "snapshot_created",
    "snapshot_shared",
    "snapshot_opened",
    "rerun_executed",
    "feedback_submitted",
    "empty_state_encountered",
    "suggestion_used",
    "demo_scenario_started",
    "restore_used",
    "capability_limit_hit",
    "export_generated",
    "plan_capability_resolved",
    "share_feature_used",
    "shortlist_feature_used"
  ]),
  sessionId: z.string().trim().min(1).optional(),
  snapshotId: z.string().trim().min(1).optional(),
  historyRecordId: z.string().trim().min(1).optional(),
  searchDefinitionId: z.string().trim().min(1).optional(),
  demoScenarioId: z.string().trim().min(1).optional(),
  payload: z.record(z.string(), z.unknown()).nullable().optional()
});

const searchDefinitionCreateSchema = z.object({
  sessionId: z.string().trim().min(1).optional(),
  label: z.string().trim().min(1, "label is required").max(160),
  request: searchRequestSchema,
  pinned: z.boolean().optional()
});

const searchDefinitionUpdateSchema = z
  .object({
    label: z.string().trim().min(1).max(160).optional(),
    pinned: z.boolean().optional()
  })
  .refine((payload) => payload.label !== undefined || payload.pinned !== undefined, {
    message: "At least one editable field is required"
  });

const rerunRequestSchema = z.object({
  sessionId: z.string().trim().min(1).optional(),
  createSnapshot: z.boolean().optional().default(false)
});

const shortlistCreateSchema = z.object({
  sessionId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1, "title is required").max(160),
  description: z.string().trim().max(500).optional(),
  sourceSnapshotId: z.string().trim().min(1).optional(),
  pinned: z.boolean().optional()
});

const shortlistUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    pinned: z.boolean().optional()
  })
  .refine((payload) => payload.title !== undefined || payload.description !== undefined || payload.pinned !== undefined, {
    message: "At least one editable field is required"
  });

const shortlistItemCreateSchema = z.object({
  canonicalPropertyId: z.string().trim().min(1, "canonicalPropertyId is required"),
  sourceSnapshotId: z.string().trim().min(1).optional(),
  sourceHistoryId: z.string().trim().min(1).optional(),
  sourceSearchDefinitionId: z.string().trim().min(1).optional(),
  capturedHome: z.record(z.string(), z.unknown()),
  reviewState: z.enum(["undecided", "interested", "needs_review", "rejected"]).optional()
});

const shortlistItemUpdateSchema = z.object({
  reviewState: z.enum(["undecided", "interested", "needs_review", "rejected"])
});

const offerReadinessCreateSchema = z.object({
  shortlistId: z.string().trim().min(1, "shortlistId is required"),
  propertyId: z.string().trim().min(1, "propertyId is required"),
  status: z
    .enum(["NOT_STARTED", "IN_PROGRESS", "READY", "BLOCKED", "OFFER_SUBMITTED"])
    .optional(),
  financingReadiness: z.enum(["not_started", "preapproved", "cash_ready"]).optional(),
  propertyFitConfidence: z.enum(["not_assessed", "low", "medium", "high"]).optional(),
  riskToleranceAlignment: z.enum(["not_reviewed", "partial", "aligned"]).optional(),
  riskLevel: z.enum(["conservative", "balanced", "competitive"]).optional(),
  userConfirmed: z.boolean().optional()
});

const offerReadinessUpdateSchema = z
  .object({
    status: z
      .enum(["NOT_STARTED", "IN_PROGRESS", "READY", "BLOCKED", "OFFER_SUBMITTED"])
      .optional(),
    financingReadiness: z.enum(["not_started", "preapproved", "cash_ready"]).optional(),
    propertyFitConfidence: z.enum(["not_assessed", "low", "medium", "high"]).optional(),
    riskToleranceAlignment: z.enum(["not_reviewed", "partial", "aligned"]).optional(),
    riskLevel: z.enum(["conservative", "balanced", "competitive"]).optional(),
    userConfirmed: z.boolean().optional()
  })
  .refine(
    (payload) =>
      payload.status !== undefined ||
      payload.financingReadiness !== undefined ||
      payload.propertyFitConfidence !== undefined ||
      payload.riskToleranceAlignment !== undefined ||
      payload.riskLevel !== undefined ||
      payload.userConfirmed !== undefined,
    {
      message: "At least one offer readiness field is required"
    }
  );

const resultNoteCreateSchema = z.object({
  sessionId: z.string().trim().min(1).optional(),
  entityType: z.enum(["shortlist_item", "snapshot_result", "shared_snapshot_result"]),
  entityId: z.string().trim().min(1, "entityId is required"),
  body: z.string().trim().min(1, "body is required").max(2000)
});

const resultNoteUpdateSchema = z.object({
  body: z.string().trim().min(1, "body is required").max(2000)
});

const shortlistShareSchema = z.object({
  sessionId: z.string().trim().min(1).optional(),
  shareMode: z.enum(["read_only", "comment_only", "review_only"]),
  expiresInDays: z.number().int().positive().max(365).optional()
});

const sharedCommentCreateSchema = z.object({
  shareId: z.string().trim().min(1, "shareId is required"),
  entityType: z.enum(["shared_shortlist_item"]),
  entityId: z.string().trim().min(1, "entityId is required"),
  authorLabel: z.string().trim().max(120).optional(),
  body: z.string().trim().min(1, "body is required").max(2000)
});

const sharedCommentUpdateSchema = z.object({
  authorLabel: z.string().trim().max(120).optional(),
  body: z.string().trim().min(1, "body is required").max(2000)
});

const reviewerDecisionCreateSchema = z.object({
  shareId: z.string().trim().min(1, "shareId is required"),
  shortlistItemId: z.string().trim().min(1, "shortlistItemId is required"),
  decision: z.enum(["agree", "disagree", "discuss", "favorite", "pass"]),
  note: z.string().trim().max(500).optional()
});

const reviewerDecisionUpdateSchema = z
  .object({
    decision: z.enum(["agree", "disagree", "discuss", "favorite", "pass"]).optional(),
    note: z.string().trim().max(500).nullable().optional()
  })
  .refine((payload) => payload.decision !== undefined || payload.note !== undefined, {
    message: "At least one editable field is required"
  });

const pilotPartnerCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: z.string().trim().min(1).max(80),
  planTier: z.enum(["free_demo", "pilot", "partner", "internal"]).optional(),
  status: z.enum(["active", "paused", "inactive"]).optional(),
  contactLabel: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
  featureOverrides: z.record(z.string(), z.boolean()).optional()
});

const pilotPartnerUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    planTier: z.enum(["free_demo", "pilot", "partner", "internal"]).optional(),
    status: z.enum(["active", "paused", "inactive"]).optional(),
    contactLabel: z.string().trim().max(120).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    featureOverrides: z.record(z.string(), z.boolean()).optional()
  })
  .refine(
    (payload) =>
      payload.name !== undefined ||
      payload.planTier !== undefined ||
      payload.status !== undefined ||
      payload.contactLabel !== undefined ||
      payload.notes !== undefined ||
      payload.featureOverrides !== undefined,
    {
      message: "At least one editable field is required"
    }
  );

const pilotLinkCreateSchema = z.object({
  partnerId: z.string().trim().min(1),
  expiresInDays: z.number().int().positive().max(365).optional(),
  allowedFeatures: z.record(z.string(), z.boolean()).optional()
});

const dataQualityStatusUpdateSchema = z.object({
  status: z.enum(["acknowledged", "resolved", "ignored"])
});

const reliabilityIncidentStatusUpdateSchema = z.object({
  status: z.enum(["acknowledged", "resolved", "ignored"])
});

const PILOT_FEATURE_KEYS = [
  "demoModeEnabled",
  "sharedSnapshotsEnabled",
  "sharedShortlistsEnabled",
  "feedbackEnabled",
  "validationPromptsEnabled",
  "shortlistCollaborationEnabled",
  "exportResultsEnabled"
] as const;

function extractSessionId(request: {
  headers?: Record<string, unknown>;
  query?: Record<string, unknown>;
}, bodySessionId?: string | null): string | null {
  const headerValue = request.headers?.["x-nhalo-session-id"];
  const queryValue = request.query?.sessionId;
  const raw =
    (typeof headerValue === "string" ? headerValue : null) ??
    (typeof queryValue === "string" ? queryValue : null) ??
    bodySessionId ??
    null;

  return raw?.trim() ? raw.trim() : null;
}

function extractPilotLinkId(request: {
  headers?: Record<string, unknown>;
  query?: Record<string, unknown>;
}, bodyPilotLinkId?: string | null): string | null {
  const headerValue = request.headers?.["x-nhalo-pilot-link-id"];
  const queryValue = request.query?.pilot;
  const raw =
    (typeof headerValue === "string" ? headerValue : null) ??
    (typeof queryValue === "string" ? queryValue : null) ??
    bodyPilotLinkId ??
    null;

  return raw?.trim() ? raw.trim() : null;
}

function extractInternalAccessToken(request: {
  headers?: Record<string, unknown>;
}): string | null {
  const raw = request.headers?.["x-nhalo-internal-token"];
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

function getRoutePattern(request: RequestWithId): string {
  return (request.routeOptions?.url as string | undefined) ?? request.url.split("?")[0] ?? request.url;
}

function parseLimit(
  query: Record<string, unknown> | undefined,
  fallback = 10,
  max = 50
): number {
  const raw = query?.limit;
  const parsed =
    typeof raw === "string"
      ? Number(raw)
      : typeof raw === "number"
        ? raw
        : fallback;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function addDaysToNowIso(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function featureDisabled(feature: string): ApiError {
  return new ApiError(404, "FEATURE_DISABLED", `${feature} is not enabled in this environment.`);
}

function unavailableLinkPayload() {
  return buildErrorPayload("LINK_UNAVAILABLE", "This link is unavailable.");
}

function requiresInternalRouteAccess(routePattern: string): boolean {
  return (
    routePattern === "/metrics" ||
    routePattern === "/providers/status" ||
    routePattern === "/validation/summary" ||
    routePattern.startsWith("/ops/")
  );
}

function enforceMaxLength(field: string, value: string | null | undefined, maxLength: number): void {
  if (typeof value === "string" && value.length > maxLength) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid request payload", [
      {
        field,
        message: `${field} must be at most ${maxLength} characters`
      }
    ]);
  }
}

function ensureWriteCapable(
  reliability: ReliabilityManager
): void {
  if (!reliability.canWrite()) {
    throw new ApiError(
      503,
      "READ_ONLY_DEGRADED",
      "The service is temporarily in a read-only degraded mode."
    );
  }
}

function sanitizeSearchMetadataForPublicShare(metadata: SearchMetadata): SearchMetadata {
  const { performance, historyRecordId, sessionId, rerunResultMetadata, ...safeMetadata } = metadata;
  return {
    ...safeMetadata
  };
}

function sanitizeSearchResponseForPublicShare(response: SearchResponse): SearchResponse {
  return {
    ...response,
    metadata: sanitizeSearchMetadataForPublicShare(response.metadata)
  };
}

function sanitizeShortlistForPublicShare(shortlist: Shortlist): Omit<Shortlist, "sessionId"> {
  const { sessionId, ...safeShortlist } = shortlist;
  return safeShortlist;
}

function sanitizeShortlistItemForPublicShare(
  item: ShortlistItem
): Omit<ShortlistItem, "sourceSnapshotId" | "sourceHistoryId" | "sourceSearchDefinitionId"> {
  const { sourceSnapshotId, sourceHistoryId, sourceSearchDefinitionId, ...safeItem } = item;
  return safeItem;
}

function sanitizeCommentForPublicShare(comment: SharedComment): SharedComment {
  return {
    ...comment,
    authorLabel: comment.authorLabel ?? null
  };
}

function sanitizeReviewerDecisionForPublicShare(decision: ReviewerDecision): ReviewerDecision {
  return {
    ...decision,
    note: decision.note ?? null
  };
}

function sanitizeCollaborationActivityForPublicShare(
  record: CollaborationActivityRecord
): Omit<CollaborationActivityRecord, "payload"> {
  const { payload, ...safeRecord } = record;
  return safeRecord;
}

function toPublicSharedSnapshotView(sharedView: SharedSnapshotView) {
  // Public snapshot views should render the stored result set, not the private session context around it.
  return {
    readOnly: true,
    shared: true as const,
    share: {
      shareId: sharedView.share.shareId,
      snapshotId: sharedView.share.snapshotId,
      expiresAt: sharedView.share.expiresAt ?? null,
      status: sharedView.share.status,
      createdAt: sharedView.share.createdAt
    },
    snapshot: {
      id: sharedView.snapshot.id,
      formulaVersion: sharedView.snapshot.formulaVersion,
      request: sharedView.snapshot.request,
      response: sanitizeSearchResponseForPublicShare(sharedView.snapshot.response),
      validationMetadata: sharedView.snapshot.validationMetadata,
      createdAt: sharedView.snapshot.createdAt
    }
  };
}

function toPublicSharedShortlistView(sharedView: SharedShortlistView) {
  // Public shortlist views expose captured decision artifacts, not internal session or history metadata.
  return {
    readOnly: sharedView.readOnly,
    shared: true as const,
    share: {
      shareId: sharedView.share.shareId,
      shortlistId: sharedView.share.shortlistId,
      shareMode: sharedView.share.shareMode,
      collaborationRole: sharedView.share.collaborationRole,
      expiresAt: sharedView.share.expiresAt ?? null,
      status: sharedView.share.status,
      createdAt: sharedView.share.createdAt
    },
    shortlist: sanitizeShortlistForPublicShare(sharedView.shortlist),
    items: sharedView.items.map((item) => sanitizeShortlistItemForPublicShare(item)),
    comments: sharedView.comments.map((comment) => sanitizeCommentForPublicShare(comment)),
    reviewerDecisions: sharedView.reviewerDecisions.map((decision) =>
      sanitizeReviewerDecisionForPublicShare(decision)
    ),
    collaborationActivity: sharedView.collaborationActivity.map((record) =>
      sanitizeCollaborationActivityForPublicShare(record)
    )
  };
}

function shareModeAllowsComments(shareMode: "read_only" | "comment_only" | "review_only"): boolean {
  return shareMode === "comment_only" || shareMode === "review_only";
}

function shareModeAllowsReviewerDecision(shareMode: "read_only" | "comment_only" | "review_only"): boolean {
  return shareMode === "review_only";
}

async function resolvePilotContext(
  repository: SearchRepository,
  request: { headers?: Record<string, unknown>; query?: Record<string, unknown> },
  bodyPilotLinkId?: string | null
) {
  const config = getConfig();
  const pilotToken = extractPilotLinkId(request, bodyPilotLinkId);
  if (!pilotToken) {
    return null;
  }

  const links = await repository.listPilotLinks();
  const link = links.find((entry) => entry.token === pilotToken) ?? null;
  if (!link || link.status !== "active") {
    return null;
  }

  const partner = await repository.getPilotPartner(link.partnerId);
  if (!partner) {
    return null;
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
      capabilities: resolveEffectiveCapabilities({
        config,
        planTier: partner.planTier,
        overrides: link.allowedFeatures
      })
    }
  } satisfies PilotLinkView;
}

function normalizePilotFeatureOverrides(
  input?: Record<string, boolean> | null
): Partial<PilotFeatureOverrides> {
  const normalized: Partial<PilotFeatureOverrides> = {};

  for (const key of PILOT_FEATURE_KEYS) {
    if (typeof input?.[key] === "boolean") {
      normalized[key] = input[key];
    }
  }

  return normalized;
}

function hasPilotOverrideValue(input?: Partial<PilotFeatureOverrides> | null): boolean {
  return Boolean(input && Object.keys(input).length > 0);
}

function getDefaultCapabilities(
  config: ReturnType<typeof getConfig>,
  planTier: PlanTier
): EffectiveCapabilities {
  const resolved = resolveEffectiveCapabilities({
    config,
    planTier,
    overrides: {
      demoModeEnabled: true,
      sharedSnapshotsEnabled: true,
      sharedShortlistsEnabled: true,
      feedbackEnabled: true,
      validationPromptsEnabled: true,
      shortlistCollaborationEnabled: true,
      exportResultsEnabled: true
    }
  });
  return {
    ...resolved,
    canShareSnapshots:
      config.validation.enabled &&
      config.validation.sharedSnapshotsEnabled &&
      config.security.publicSharedViewsEnabled,
    canShareShortlists:
      config.workflow.shortlistsEnabled &&
      config.workflow.sharedShortlistsEnabled &&
      config.security.publicSharedShortlistsEnabled,
    canUseDemoMode:
      config.validation.enabled &&
      config.validation.demoScenariosEnabled,
    canExportResults: true,
    canUseCollaboration:
      config.workflow.sharedShortlistsEnabled &&
      (config.workflow.sharedCommentsEnabled || config.workflow.reviewerDecisionsEnabled),
    canUseOpsViews:
      config.ops.pilotOpsEnabled &&
      config.ops.internalOpsUiEnabled,
    canSubmitFeedback:
      config.validation.enabled &&
      config.validation.feedbackEnabled,
    canSeeValidationPrompts: config.validation.enabled
  };
}

function getEffectiveCapabilities(
  config: ReturnType<typeof getConfig>,
  pilotContext: PilotLinkView | null
): EffectiveCapabilities {
  return (
    pilotContext?.context.capabilities ??
    getDefaultCapabilities(config, config.product.defaultPlanTier)
  );
}

function getEffectivePilotFeatures(
  config: ReturnType<typeof getConfig>,
  pilotContext: PilotLinkView | null
): PilotFeatureOverrides & { exportResultsEnabled: boolean } {
  const capabilities = getEffectiveCapabilities(config, pilotContext);
  return {
    demoModeEnabled: capabilities.canUseDemoMode,
    sharedSnapshotsEnabled: capabilities.canShareSnapshots,
    sharedShortlistsEnabled: capabilities.canShareShortlists,
    feedbackEnabled: capabilities.canSubmitFeedback,
    validationPromptsEnabled: capabilities.canSeeValidationPrompts,
    shortlistCollaborationEnabled: capabilities.canUseCollaboration,
    exportResultsEnabled: capabilities.canExportResults
  };
}

function featureDisabledForPilot(feature: string): ApiError {
  return new ApiError(403, "PILOT_FEATURE_DISABLED", `${feature} is disabled for this pilot context.`);
}

function capabilityLimitHitError(feature: string, limit: number): ApiError {
  return new ApiError(
    403,
    "CAPABILITY_LIMIT_HIT",
    `${feature} has reached the current plan limit.`,
    [
      {
        field: "limit",
        message: String(limit)
      }
    ]
  );
}

function withPilotPayload(
  payload: Record<string, unknown> | null | undefined,
  pilotContext: PilotLinkView | null
): Record<string, unknown> | null | undefined {
  if (!pilotContext) {
    return payload;
  }

  return {
    ...(payload ?? {}),
    partnerId: pilotContext.partner.id,
    partnerSlug: pilotContext.partner.slug,
    partnerName: pilotContext.partner.name,
    pilotLinkId: pilotContext.link.id,
    pilotLinkToken: pilotContext.link.token
  };
}

async function recordValidationEventWithPilot(
  repository: SearchRepository,
  event: {
    eventName: ValidationEventName;
    sessionId?: string | null;
    snapshotId?: string | null;
    historyRecordId?: string | null;
    searchDefinitionId?: string | null;
    demoScenarioId?: string | null;
    payload?: Record<string, unknown> | null;
  },
  pilotContext: PilotLinkView | null
): Promise<void> {
  await repository.recordValidationEvent({
    ...event,
    payload: withPilotPayload(event.payload, pilotContext) ?? null
  });
}

async function countSessionShareLinks(
  repository: SearchRepository,
  sessionId: string | null
): Promise<number> {
  if (!sessionId) {
    return 0;
  }

  const snapshots = await repository.listSearchSnapshots(sessionId, 1_000);
  const snapshotShares = snapshots.reduce(
    (total, snapshot) => total + (snapshot.validationMetadata?.shareCount ?? 0),
    0
  );
  const shortlists = await repository.listShortlists(sessionId);
  const shortlistShares = (
    await Promise.all(shortlists.map((shortlist) => repository.listSharedShortlists(shortlist.id)))
  ).reduce((total, shares) => total + shares.length, 0);

  return snapshotShares + shortlistShares;
}

async function enforceSessionCapabilityLimit(options: {
  repository: SearchRepository;
  metrics: MetricsCollector;
  config: ReturnType<typeof getConfig>;
  pilotContext: PilotLinkView | null;
  sessionId: string | null;
  capabilityKey: keyof EffectiveCapabilities["limits"];
  featureLabel: string;
  currentCount: () => Promise<number>;
}): Promise<void> {
  if (!options.config.product.enabled) {
    return;
  }

  const capabilities = getEffectiveCapabilities(options.config, options.pilotContext);
  const limit = capabilities.limits[options.capabilityKey];
  if (limit === null) {
    return;
  }

  const currentCount = await options.currentCount();
  if (currentCount < limit) {
    return;
  }

  options.metrics.recordCapabilityLimitHit(options.featureLabel);
  await recordValidationEventWithPilot(
    options.repository,
    {
      eventName: "capability_limit_hit",
      sessionId: options.sessionId,
      payload: {
        capability: options.featureLabel,
        limit,
        currentCount
      }
    },
    options.pilotContext
  );
  throw capabilityLimitHitError(options.featureLabel, limit);
}

export interface AppDependencies {
  persistence: PersistenceLayer;
  repository: SearchRepository;
  marketSnapshotRepository: MarketSnapshotRepository;
  safetySignalCacheRepository: SafetySignalCacheRepository;
  listingCacheRepository: ListingCacheRepository;
  geocodeCacheRepository: GeocodeCacheRepository;
  providers: ReturnType<typeof createMockProviders>;
  metrics: MetricsCollector;
  logger: AppLogger;
}

type ErrorCategory =
  | "VALIDATION_ERROR"
  | "PROVIDER_ERROR"
  | "DATABASE_ERROR"
  | "CONFIG_ERROR"
  | "INTERNAL_ERROR";

type RequestWithId = {
  id: string;
  method: string;
  url: string;
  ip: string;
  routeOptions?: {
    url?: string;
  };
  headers?: Record<string, unknown>;
};

type ReplyWithHeader = {
  header(name: string, value: string): void;
  status(code: number): {
    send(payload: unknown): unknown;
  };
  statusCode: number;
};

const REQUEST_STARTED_AT = Symbol("requestStartedAt");

function buildErrorPayload(
  code: string,
  message: string,
  details: Array<{ field?: string; message: string }> = []
) {
  return {
    error: {
      code,
      message,
      details
    }
  };
}

function createRateLimiter(maxRequests: number, windowMs: number) {
  const buckets = new Map<string, number[]>();

  return function take(key: string) {
    const now = Date.now();
    const windowStart = now - windowMs;
    const current = (buckets.get(key) ?? []).filter((timestamp) => timestamp > windowStart);

    if (current.length >= maxRequests) {
      buckets.set(key, current);
      return {
        allowed: false,
        retryAfterMs: Math.max(windowMs - (now - current[0]), 0)
      };
    }

    current.push(now);
    buckets.set(key, current);
    return {
      allowed: true,
      retryAfterMs: 0
    };
  };
}

function classifyError(error: unknown): {
  category: ErrorCategory;
  statusCode: number;
  payload: ReturnType<typeof buildErrorPayload>;
} {
  const fastifyError = error as { code?: string; statusCode?: number; message?: string } | undefined;
  if (fastifyError?.code === "FST_ERR_CTP_BODY_TOO_LARGE") {
    return {
      category: "VALIDATION_ERROR",
      statusCode: 413,
      payload: buildErrorPayload(
        "PAYLOAD_TOO_LARGE",
        "The request payload exceeded the allowed size."
      )
    };
  }

  if (fastifyError?.code === "FST_ERR_CTP_INVALID_JSON_BODY") {
    return {
      category: "VALIDATION_ERROR",
      statusCode: 400,
      payload: buildErrorPayload("MALFORMED_JSON", "The request body contained malformed JSON.")
    };
  }

  if (error instanceof ZodError) {
    return {
      category: "VALIDATION_ERROR",
      statusCode: 400,
      payload: formatValidationError(error)
    };
  }

  if (error instanceof ConfigError) {
    return {
      category: "CONFIG_ERROR",
      statusCode: 500,
      payload: buildErrorPayload("CONFIG_ERROR", error.message, error.details)
    };
  }

  if (isApiError(error)) {
    const code = error.code.toUpperCase();
    return {
      category:
        code.includes("VALIDATION") || code.includes("PAYLOAD") || code.includes("MALFORMED")
          ? "VALIDATION_ERROR"
          : code.includes("PROVIDER") || code.includes("LOCATION")
            ? "PROVIDER_ERROR"
            : code.includes("DATABASE")
              ? "DATABASE_ERROR"
              : code.includes("CONFIG")
                ? "CONFIG_ERROR"
                : "INTERNAL_ERROR",
      statusCode: error.statusCode,
      payload: buildErrorPayload(error.code, error.message, error.details ?? [])
    };
  }

  if (
    error instanceof Error &&
    /prisma|database|connection|datasource/i.test(error.message)
  ) {
    return {
      category: "DATABASE_ERROR",
      statusCode: 503,
      payload: buildErrorPayload(
        "DATABASE_ERROR",
        "A database dependency failed while processing the request."
      )
    };
  }

  return {
    category: "INTERNAL_ERROR",
    statusCode: 500,
    payload: buildErrorPayload("INTERNAL_ERROR", "Unexpected server error")
  };
}

function formatValidationError(error: ZodError) {
  return buildErrorPayload(
    "VALIDATION_ERROR",
    "Invalid search request",
    error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message
    }))
  );
}

function buildEnabledFeatureList(config: ReturnType<typeof getConfig>): string[] {
  const features: string[] = [];

  if (config.validation.enabled) {
    features.push("validation");
  }
  if (config.validation.sharedSnapshotsEnabled && config.security.publicSharedViewsEnabled) {
    features.push("shared_snapshots");
  }
  if (config.workflow.shortlistsEnabled) {
    features.push("shortlists");
  }
  if (config.workflow.sharedShortlistsEnabled && config.security.publicSharedShortlistsEnabled) {
    features.push("shared_shortlists");
  }
  if (config.workflow.sharedCommentsEnabled || config.workflow.reviewerDecisionsEnabled) {
    features.push("collaboration");
  }
  if (config.ops.pilotOpsEnabled) {
    features.push("pilot_ops");
  }
  if (config.validation.demoScenariosEnabled) {
    features.push("demo_mode");
  }
  if (config.product.enabled) {
    features.push(`plan:${config.product.defaultPlanTier}`);
  }

  return features;
}

function buildGuardrailDetail(config: ReturnType<typeof getConfig>): string {
  return `profile=${config.deployment.profile}, env=${config.runtimeEnvironment}`;
}

function evaluateLaunchGuardrails(payload: {
  config: ReturnType<typeof getConfig>;
  reliability: ReliabilityStateSummary;
}): LaunchGuardrail[] {
  const { config, reliability } = payload;
  const guardrails: LaunchGuardrail[] = [];
  const productionLike = config.deployment.environmentBehavior.productionLike;

  if (productionLike && !config.security.internalRouteGuardsEnabled) {
    guardrails.push({
      id: "internal_route_guards_required",
      status: "fail",
      message: "Internal route guards are required in staging and production-like profiles.",
      detail: buildGuardrailDetail(config)
    });
  }

  if (
    productionLike &&
    config.security.publicSharedViewsEnabled &&
    !config.security.internalRouteGuardsEnabled
  ) {
    guardrails.push({
      id: "public_sharing_requires_guards",
      status: "fail",
      message: "Public sharing cannot be enabled in staging or production-like profiles without internal route guards.",
      detail: buildGuardrailDetail(config)
    });
  }

  if (productionLike && config.validation.demoScenariosEnabled) {
    guardrails.push({
      id: "demo_mode_enabled_in_production_profile",
      status: "warn",
      message: "Demo scenarios are enabled in a production-like profile.",
      detail: buildGuardrailDetail(config)
    });
  }

  if (
    productionLike &&
    [config.providerMode, config.listings.mode, config.safety.mode, config.geocoder.mode].includes("mock")
  ) {
    guardrails.push({
      id: "mock_provider_mode_enabled",
      status: "warn",
      message: "One or more providers are still running in mock mode.",
      detail: `provider=${config.providerMode}, listing=${config.listings.mode}, safety=${config.safety.mode}, geocoder=${config.geocoder.mode}`
    });
  }

  if (reliability.state !== "healthy") {
    guardrails.push({
      id: "runtime_not_healthy",
      status: reliability.state === "startup_blocked" ? "fail" : "warn",
      message: "Runtime reliability is not fully healthy.",
      detail: reliability.reasons.join(" · ") || reliability.state
    });
  }

  return guardrails;
}

function summariseProviderMode(config: ReturnType<typeof getConfig>): string {
  return `provider=${config.providerMode}, listing=${config.listings.mode}, safety=${config.safety.mode}, geocoder=${config.geocoder.mode}`;
}

function buildGoLiveCheckSummary(payload: {
  config: ReturnType<typeof getConfig>;
  persistenceMode: PersistenceLayer["mode"];
  readiness: { database: boolean; cache: boolean };
  reliability: ReliabilityStateSummary;
  providers: ProviderStatus[];
}): GoLiveCheckSummary {
  const { config, persistenceMode, readiness, reliability, providers } = payload;
  const productionLike = config.deployment.environmentBehavior.productionLike;
  const checks: GoLiveCheckItem[] = [
    {
      id: "config_validation",
      label: "Config validation",
      status: "pass",
      detail: "Configuration loaded successfully."
    },
    {
      id: "required_secrets",
      label: "Required secrets",
      status:
        (config.listings.mode === "live" && !config.listings.provider.configured) ||
        (config.geocoder.mode === "live" && !config.geocoder.provider.configured) ||
        (config.safety.mode === "live" &&
          !config.safety.crime.configured &&
          !config.safety.school.configured)
          ? "fail"
          : config.providerMode === "hybrid" &&
              (!config.listings.provider.configured ||
                !config.geocoder.provider.configured ||
                (!config.safety.crime.configured && !config.safety.school.configured))
            ? "warn"
            : "pass",
      detail: `listingLiveConfigured=${config.listings.provider.configured}, geocoderLiveConfigured=${config.geocoder.provider.configured}, safetyLiveConfigured=${config.safety.crime.configured || config.safety.school.configured}`
    },
    {
      id: "database",
      label: "Database reachability",
      status: readiness.database ? "pass" : productionLike ? "fail" : "warn",
      detail: readiness.database
        ? `${persistenceMode} persistence reachable`
        : `${persistenceMode} persistence unavailable`
    },
    {
      id: "schema_compatibility",
      label: "Schema compatibility",
      status:
        persistenceMode === "database" && readiness.database
          ? "pass"
          : productionLike
            ? "fail"
            : "warn",
      detail:
        persistenceMode === "database" && readiness.database
          ? "Database-backed persistence is available for schema-backed artifacts."
          : "Running without database-backed schema verification."
    },
    {
      id: "provider_modes",
      label: "Provider modes",
      status:
        productionLike &&
        [config.providerMode, config.listings.mode, config.safety.mode, config.geocoder.mode].includes("mock")
          ? "warn"
          : "pass",
      detail: summariseProviderMode(config)
    },
    {
      id: "background_jobs",
      label: "Background jobs",
      status:
        !config.deployment.backgroundJobsEnabled
          ? "warn"
          : reliability.backgroundJobs.some((job) => job.status === "failed")
            ? "warn"
            : "pass",
      detail:
        !config.deployment.backgroundJobsEnabled
          ? "Background jobs disabled by config."
          : reliability.backgroundJobs.length === 0
            ? "No background jobs registered."
            : reliability.backgroundJobs
                .map((job) => `${job.name}:${job.status}`)
                .join(", ")
    },
    {
      id: "internal_guards",
      label: "Internal route guards",
      status:
        config.security.internalRouteGuardsEnabled
          ? "pass"
          : productionLike
            ? "fail"
            : "warn",
      detail: config.security.internalRouteGuardsEnabled
        ? "Internal ops routes require an access token."
        : "Internal ops routes are not guard-protected."
    },
    {
      id: "public_sharing",
      label: "Public sharing posture",
      status:
        productionLike && config.security.publicSharedViewsEnabled
          ? "warn"
          : "pass",
      detail: `sharedSnapshots=${config.security.publicSharedViewsEnabled}, sharedShortlists=${config.security.publicSharedShortlistsEnabled}`
    },
    {
      id: "build_metadata",
      label: "Build metadata",
      status:
        config.deployment.buildMetadata.buildId &&
        config.deployment.buildMetadata.buildTimestamp
          ? "pass"
          : "fail",
      detail: `${config.deployment.buildMetadata.buildId} @ ${config.deployment.buildMetadata.buildTimestamp}`
    },
    {
      id: "reliability_state",
      label: "Runtime reliability",
      status:
        reliability.state === "healthy"
          ? "pass"
          : reliability.state === "startup_blocked"
            ? "fail"
            : "warn",
      detail: reliability.reasons.join(" · ") || reliability.state
    },
    {
      id: "demo_mode",
      label: "Demo mode profile fit",
      status:
        (config.deployment.profile === "local_demo" && config.validation.demoScenariosEnabled) ||
        (config.deployment.profile !== "local_demo" && !config.validation.demoScenariosEnabled)
          ? "pass"
          : "warn",
      detail: `profile=${config.deployment.profile}, demoScenariosEnabled=${config.validation.demoScenariosEnabled}`
    },
    {
      id: "plan_defaults",
      label: "Plan defaults and limits",
      status:
        config.product.maxSavedSearchesPerSession > 0 &&
        config.product.maxShortlistsPerSession > 0 &&
        config.product.maxShareLinksPerSession > 0
          ? "pass"
          : "fail",
      detail: `defaultPlan=${config.product.defaultPlanTier}, saved=${config.product.maxSavedSearchesPerSession}, shortlists=${config.product.maxShortlistsPerSession}, shares=${config.product.maxShareLinksPerSession}`
    }
  ];

  if (providers.some((provider) => provider.status !== "healthy")) {
    checks.push({
      id: "provider_health",
      label: "Provider readiness",
      status: providers.some((provider) => provider.status === "failing" || provider.status === "unavailable") ? "warn" : "pass",
      detail: providers
        .map((provider) => `${provider.providerName}:${provider.status}`)
        .join(", ")
    });
  }

  const guardrails = evaluateLaunchGuardrails({ config, reliability });
  const overallStatus = checks.some((check) => check.status === "fail") || guardrails.some((item) => item.status === "fail")
    ? "fail"
    : checks.some((check) => check.status === "warn") || guardrails.some((item) => item.status === "warn")
      ? "warn"
      : "pass";

  return {
    generatedAt: new Date().toISOString(),
    environment: config.runtimeEnvironment,
    profile: config.deployment.profile,
    overallStatus,
    reliabilityState: reliability.state,
    checks,
    guardrails
  };
}

function buildSupportContextSummary(payload: {
  config: ReturnType<typeof getConfig>;
  reliability: ReliabilityStateSummary;
  capabilities: EffectiveCapabilities;
}): SupportContextSummary {
  const { config, reliability, capabilities } = payload;

  return {
    generatedAt: new Date().toISOString(),
    environment: config.runtimeEnvironment,
    profile: config.deployment.profile,
    items: [
      {
        key: "sharing",
        title: "Why is sharing enabled or disabled?",
        status:
          config.security.publicSharedViewsEnabled || config.security.publicSharedShortlistsEnabled
            ? "ok"
            : "attention",
        summary: `Shared snapshots=${config.security.publicSharedViewsEnabled}, shared shortlists=${config.security.publicSharedShortlistsEnabled}.`,
        action: "Check public sharing flags and partner capabilities before a pilot demo."
      },
      {
        key: "mutable_routes",
        title: "Why are mutable routes blocked?",
        status: reliability.readOnlyMode ? "blocked" : "ok",
        summary: reliability.readOnlyMode
          ? "Mutable routes are blocked because the runtime is in read-only degraded mode."
          : "Mutable routes are currently writable.",
        action: reliability.readOnlyMode
          ? "Restore primary persistence or wait for reliability state to return to healthy."
          : "No action needed."
      },
      {
        key: "degraded_state",
        title: "Why is the app degraded?",
        status: reliability.state === "healthy" ? "ok" : "attention",
        summary:
          reliability.state === "healthy"
            ? "The runtime is healthy."
            : reliability.reasons.join(" · ") || reliability.state,
        action:
          reliability.state === "healthy"
            ? "No action needed."
            : "Use /ready, /ops/summary, and provider status to confirm whether degradation is acceptable for the current demo or pilot."
      },
      {
        key: "feature_flags",
        title: "Which feature flags are active?",
        status: "ok",
        summary: buildEnabledFeatureList(config).join(", ") || "No optional feature groups enabled.",
        action: "Use the release summary to verify environment-specific flags before sharing externally."
      },
      {
        key: "provider_modes",
        title: "Which provider modes are active?",
        status: [config.providerMode, config.listings.mode, config.safety.mode, config.geocoder.mode].includes("mock")
          ? "attention"
          : "ok",
        summary: summariseProviderMode(config),
        action: "Switch provider modes explicitly if this environment should avoid mock data."
      },
      {
        key: "limits",
        title: "Why did a limit trigger?",
        status: "ok",
        summary: `plan=${capabilities.planTier}, saved=${capabilities.limits.savedSearches ?? "unlimited"}, shortlists=${capabilities.limits.shortlists ?? "unlimited"}, shares=${capabilities.limits.shareLinks ?? "unlimited"}, exports=${capabilities.limits.exportsPerSession ?? "unlimited"}`,
        action: "Use plan defaults or partner overrides to raise limits when a pilot requires it."
      }
    ]
  };
}

function buildReleaseSummary(payload: {
  config: ReturnType<typeof getConfig>;
  reliability: ReliabilityStateSummary;
  persistenceMode: PersistenceLayer["mode"];
}): ReleaseSummary {
  const { config, reliability, persistenceMode } = payload;

  return {
    generatedAt: new Date().toISOString(),
    environment: config.runtimeEnvironment,
    profile: config.deployment.profile,
    build: reliability.build,
    formulaVersions: reliability.build.formulaVersions,
    persistenceMode,
    schemaVersion: process.env.SCHEMA_VERSION?.trim() || null,
    enabledFeatures: buildEnabledFeatureList(config),
    degradedConstraints: reliability.reasons
  };
}

export async function buildApp(dependencies?: Partial<AppDependencies>) {
  const config = getConfig();
  const logger = dependencies?.logger ?? createLogger({ level: config.logLevel });
  const persistence: PersistenceLayer =
    dependencies?.persistence ??
    (dependencies?.repository &&
    dependencies?.marketSnapshotRepository &&
    dependencies?.safetySignalCacheRepository &&
    dependencies?.listingCacheRepository &&
    dependencies?.geocodeCacheRepository
      ? {
          mode: "memory",
          searchRepository: dependencies.repository,
          marketSnapshotRepository: dependencies.marketSnapshotRepository,
          safetySignalCacheRepository: dependencies.safetySignalCacheRepository,
          listingCacheRepository: dependencies.listingCacheRepository,
          geocodeCacheRepository: dependencies.geocodeCacheRepository,
          async checkReadiness() {
            return {
              database: true,
              cache: true
            };
          },
          async cleanupExpiredData() {
            return {
              snapshotsRemoved: 0,
              historyRemoved: 0,
              cachesRemoved: 0
            };
          },
          async close() {}
        }
      : await createPersistenceLayer(config.databaseUrl));

  if (
    config.databaseUrl &&
    persistence.mode === "memory" &&
    (config.nodeEnv === "staging" || config.nodeEnv === "production")
  ) {
    throw new ConfigError("Database initialization failed; refusing to start with in-memory persistence.", [
      {
        field: "DATABASE_URL",
        message: "Check the configured database connection before starting staging or production."
      }
    ]);
  }
  const metrics = dependencies?.metrics ?? new MetricsCollector();
  const reliability = new ReliabilityManager(config, metrics);
  const providers = instrumentProviders(
    dependencies?.providers ??
      createProviders({
        geocodeCacheRepository: persistence.geocodeCacheRepository,
        listingCacheRepository: persistence.listingCacheRepository,
        safetySignalCacheRepository: persistence.safetySignalCacheRepository,
        metrics
      }),
    metrics
  );
  const app = Fastify({
    logger: false,
    disableRequestLogging: true,
    bodyLimit: config.security.maxRequestBodyBytes
  });
  const startupReadiness = await persistence.checkReadiness();
  const startupProviderStatuses = await providers.getStatuses();
  const startupDependencies: DependencyReadinessRecord[] = classifyStartupDependencies({
    config,
    persistenceMode: persistence.mode,
    readiness: startupReadiness,
    providers: startupProviderStatuses
  });
  const startupReliability = reliability.initializeDependencies(startupDependencies);
  const startupGuardrails = evaluateLaunchGuardrails({
    config,
    reliability: startupReliability
  });
  for (const guardrail of startupGuardrails) {
    if (guardrail.status === "fail") {
      metrics.recordLaunchGuardrail("block");
      logger.error({
        message: "Launch guardrail blocked startup",
        endpoint: "startup",
        statusCode: 503,
        details: guardrail
      });
    } else if (guardrail.status === "warn") {
      metrics.recordLaunchGuardrail("warn");
      logger.warn({
        message: "Launch guardrail warning",
        endpoint: "startup",
        statusCode: 200,
        details: guardrail
      });
    }
  }
  if (config.deployment.productionStrictStartup && startupReliability.state === "startup_blocked") {
    metrics.recordStartupOutcome("failure");
    throw new ConfigError("Required startup dependencies are unavailable for this environment.", [
      {
        field: "STARTUP_DEPENDENCIES",
        message: startupReliability.reasons.join(" ")
      }
    ]);
  }
  if (
    config.deployment.productionStrictStartup &&
    startupGuardrails.some((guardrail) => guardrail.status === "fail")
  ) {
    metrics.recordStartupOutcome("failure");
    throw new ConfigError("Launch guardrails blocked startup for this environment.", startupGuardrails
      .filter((guardrail) => guardrail.status === "fail")
      .map((guardrail) => ({
        field: guardrail.id,
        message: guardrail.message
      })));
  }
  reliability.recordStartup();
  logger.info({
    message: "Startup dependency classification completed",
    endpoint: "startup",
    statusCode: startupReliability.state === "healthy" ? 200 : 503,
    details: {
      state: startupReliability.state,
      dependencies: startupDependencies,
      build: startupReliability.build
    }
  });
  const demoScenarios: DemoScenario[] = DEMO_SEARCH_SCENARIOS;
  const takeSearchRateLimit = createRateLimiter(
    config.rateLimit.searchMax,
    config.rateLimit.searchWindowMs
  );
  const takeSnapshotRateLimit = createRateLimiter(
    config.rateLimit.snapshotMax,
    config.rateLimit.snapshotWindowMs
  );
  const takeSharedOpenRateLimit = createRateLimiter(
    config.security.sharedOpenMax,
    config.security.sharedOpenWindowMs
  );
  const takeCollaborationWriteRateLimit = createRateLimiter(
    config.security.collaborationWriteMax,
    config.security.collaborationWriteWindowMs
  );
  const takeFeedbackRateLimit = createRateLimiter(
    config.security.feedbackMax,
    config.security.feedbackWindowMs
  );
  const takePilotLinkOpenRateLimit = createRateLimiter(
    config.security.pilotLinkOpenMax,
    config.security.pilotLinkOpenWindowMs
  );
  reliability.updateBackgroundJobDefinition("retention_cleanup", config.deployment.backgroundJobsEnabled);
  let cleanupRunning = false;
  const cleanupTimer =
    config.deployment.backgroundJobsEnabled && config.retention.cleanupIntervalMs > 0
      ? setInterval(() => {
          if (config.deployment.backgroundJobLockingEnabled && cleanupRunning) {
            return;
          }
          cleanupRunning = true;
          const startedAt = Date.now();
          reliability.startBackgroundJob("retention_cleanup");
          logger.info({
            message: "Background job started",
            endpoint: "background",
            statusCode: 200,
            details: {
              job: "retention_cleanup"
            }
          });
          persistence
            .cleanupExpiredData({
              snapshotRetentionDays: config.retention.snapshotRetentionDays,
              searchHistoryRetentionDays: config.retention.searchHistoryRetentionDays
            })
            .then((summary) => {
              reliability.completeBackgroundJob("retention_cleanup", Date.now() - startedAt);
              if (
                summary.snapshotsRemoved > 0 ||
                summary.historyRemoved > 0 ||
                summary.cachesRemoved > 0
              ) {
                logger.info({
                    message: "Retention cleanup completed",
                    details: summary
                  });
              }
            })
            .catch((error) => {
              reliability.failBackgroundJob(
                "retention_cleanup",
                error instanceof Error ? error.message : "Unknown cleanup failure",
                Date.now() - startedAt
              );
              logger.warn({
                message: "Retention cleanup failed",
                errorCode: "DATABASE_ERROR",
                details: error instanceof Error ? error.message : "Unknown cleanup failure"
              });
            })
            .finally(() => {
              cleanupRunning = false;
            });
        }, config.retention.cleanupIntervalMs)
      : null;
  cleanupTimer?.unref?.();

  await app.register(cors, {
    origin: true
  });

  app.addHook("onRequest", async (request, reply) => {
    (request as RequestWithId & Record<PropertyKey, unknown>)[REQUEST_STARTED_AT] = Date.now();
    reply.header("x-request-id", request.id);
    const routePattern = getRoutePattern(request as RequestWithId);
    logger.debug({
      message: "Request started",
      requestId: request.id,
      endpoint: routePattern
    });

    if (config.security.internalRouteGuardsEnabled && requiresInternalRouteAccess(routePattern)) {
      const internalToken = extractInternalAccessToken(request);
      if (!internalToken || internalToken !== config.security.internalRouteAccessToken) {
        metrics.recordInternalRouteDenied();
        logger.warn({
          message: "Internal route access denied",
          requestId: request.id,
          endpoint: routePattern,
          statusCode: 403
        });
        return reply.status(403).send(buildErrorPayload("INTERNAL_ROUTE_FORBIDDEN", "This route is not available."));
      }
    }
  });

  app.addHook("onResponse", async (request, reply) => {
    const startedAt =
      ((request as RequestWithId & Record<PropertyKey, unknown>)[REQUEST_STARTED_AT] as number | undefined) ??
      Date.now();
    if (request.method === "GET") {
      metrics.recordEndpointRead((request.routeOptions?.url as string | undefined) ?? request.url);
    }
    logger.info({
      message: "Request completed",
      requestId: request.id,
      endpoint: (request.routeOptions?.url as string | undefined) ?? request.url,
      durationMs: Date.now() - startedAt,
      statusCode: reply.statusCode
    });
  });

  app.addHook("onClose", async () => {
    if (cleanupTimer) {
      clearInterval(cleanupTimer);
    }
    await persistence.close();
    await logger.flush();
  });

  app.setErrorHandler((error, request, reply) => {
    const classified = classifyError(error);
    metrics.recordError(classified.category);
    if (
      request.method === "POST" &&
      request.url.startsWith("/search") &&
      !request.url.startsWith("/search/snapshots")
    ) {
      metrics.recordSearchOutcome(false);
    }
    logger.error({
      message: "Request failed",
      requestId: request.id,
      endpoint: (request.routeOptions?.url as string | undefined) ?? request.url,
      durationMs:
        Date.now() -
        ((((request as RequestWithId & Record<PropertyKey, unknown>)[REQUEST_STARTED_AT] as number | undefined) ??
          Date.now())),
      statusCode: classified.statusCode,
      errorCode: classified.payload.error.code,
      details:
        error instanceof Error
          ? {
              message: error.message
            }
          : "Unknown error"
    });

    if (classified.category === "VALIDATION_ERROR") {
      metrics.recordValidationReject(classified.payload.error.code);
      if (
        classified.payload.error.code === "MALFORMED_JSON" ||
        classified.payload.error.code === "PAYLOAD_TOO_LARGE"
      ) {
        metrics.recordMalformedPayload();
      }
    }

    return reply.status(classified.statusCode).send(classified.payload);
  });

  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Number(process.uptime().toFixed(2)),
    memoryUsage: process.memoryUsage(),
    environment: config.runtimeEnvironment,
    build: reliability.getBuildMetadata()
  }));

  app.get("/version", async () => {
    if (!config.deployment.versionEndpointEnabled) {
      throw featureDisabled("Version endpoint");
    }

    metrics.recordVersionEndpointRead();
    return reliability.getBuildMetadata();
  });

  app.get("/ready", async (request, reply) => {
    const [dependencyReadiness, statuses] = await Promise.all([
      persistence.checkReadiness(),
      providers.getStatuses()
    ]);

    const dependencySummary = classifyStartupDependencies({
      config,
      persistenceMode: persistence.mode,
      readiness: dependencyReadiness,
      providers: statuses
    });
    const runtimeReliability = reliability.initializeDependencies(dependencySummary);
    const providersReady = statuses.every((status) => status.status === "healthy");
    const ready = runtimeReliability.state === "healthy" && dependencyReadiness.database && dependencyReadiness.cache && providersReady;

    return reply.status(ready ? 200 : 503).send({
      status: ready ? "ready" : "not_ready",
      requestId: request.id,
      reliability: runtimeReliability,
      checks: {
        database: dependencyReadiness.database,
        cache: dependencyReadiness.cache,
        providers: providersReady
      }
    });
  });

  app.get("/ops/go-live-check", async (request) => {
    if (!config.ops.pilotOpsEnabled) {
      throw featureDisabled("Go-live readiness");
    }

    const query = request.query as Record<string, unknown> | undefined;
    const [dependencyReadiness, statuses] = await Promise.all([
      persistence.checkReadiness(),
      providers.getStatuses()
    ]);
    const dependencySummary = classifyStartupDependencies({
      config,
      persistenceMode: persistence.mode,
      readiness: dependencyReadiness,
      providers: statuses
    });
    const runtimeReliability = reliability.initializeDependencies(dependencySummary);
    const summary = buildGoLiveCheckSummary({
      config,
      persistenceMode: persistence.mode,
      readiness: dependencyReadiness,
      reliability: runtimeReliability,
      providers: statuses
    });

    metrics.recordGoLiveCheckRead();
    if (summary.overallStatus === "fail") {
      metrics.recordReadinessOutcome("fail");
    } else if (summary.overallStatus === "warn") {
      metrics.recordReadinessOutcome("warn");
    }
    if (query?.source === "script") {
      metrics.recordOpsCheckScriptRun();
    }

    return { summary };
  });

  app.get("/ops/support", async () => {
    if (!config.ops.pilotOpsEnabled) {
      throw featureDisabled("Support context");
    }

    const support = buildSupportContextSummary({
      config,
      reliability: reliability.snapshot(),
      capabilities: getDefaultCapabilities(config, config.product.defaultPlanTier)
    });
    const release = buildReleaseSummary({
      config,
      reliability: reliability.snapshot(),
      persistenceMode: persistence.mode
    });

    metrics.recordSupportContextRead();
    return { support, release };
  });

  app.get("/ops/support/context", async () => {
    if (!config.ops.pilotOpsEnabled) {
      throw featureDisabled("Support context");
    }

    const support = buildSupportContextSummary({
      config,
      reliability: reliability.snapshot(),
      capabilities: getDefaultCapabilities(config, config.product.defaultPlanTier)
    });

    metrics.recordSupportContextRead();
    return { support };
  });

  app.get("/ops/release-summary", async () => {
    if (!config.ops.pilotOpsEnabled) {
      throw featureDisabled("Release summary");
    }

    const summary = buildReleaseSummary({
      config,
      reliability: reliability.snapshot(),
      persistenceMode: persistence.mode
    });

    metrics.recordReleaseSummaryRead();
    return { summary };
  });

  app.get("/providers/status", async () => {
    const statuses: ProviderStatus[] = await providers.getStatuses();

    return {
      providers: statuses
    };
  });

  app.get("/scores/audit/:propertyId", async (request, reply) => {
    const params = request.params as { propertyId?: string };
    const propertyId = params.propertyId?.trim();

    if (!propertyId) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid propertyId",
          details: [
            {
              field: "propertyId",
              message: "propertyId is required"
            }
          ]
        }
      });
    }

    const auditRecord = await persistence.searchRepository.getScoreAudit(propertyId);

    if (!auditRecord) {
      return reply.status(404).send({
        error: {
          code: "SCORE_AUDIT_NOT_FOUND",
          message: "No stored score snapshot was found for this property.",
          details: []
        }
      });
    }

    metrics.recordAuditView();
    return auditRecord;
  });

  app.get("/metrics", async () => metrics.snapshot());

  app.get("/validation/demo-scenarios", async (request) => {
    if (!config.validation.enabled || !config.validation.demoScenariosEnabled) {
      throw featureDisabled("Demo scenarios");
    }

    const pilotContext = await resolvePilotContext(persistence.searchRepository, request);
    if (!getEffectivePilotFeatures(config, pilotContext).demoModeEnabled) {
      throw featureDisabledForPilot("Demo scenarios");
    }

    if (config.deployment.profile === "local_demo") {
      metrics.recordDemoProfileLoad();
    }

    return {
      scenarios: demoScenarios
    };
  });

  app.get("/validation/summary", async () => {
    if (!config.validation.enabled) {
      throw featureDisabled("Validation summary");
    }

    const summary = await persistence.searchRepository.getValidationSummary();
    metrics.recordValidationSummaryRead();
    return summary;
  });

  app.get("/ops/usage-funnel", async () => {
    if (!config.ops.pilotOpsEnabled || !config.product.usageFunnelSummaryEnabled) {
      throw featureDisabled("Usage funnel summary");
    }

    const funnel = await persistence.searchRepository.getUsageFunnelSummary();
    metrics.recordUsageFunnelRead();
    return { funnel };
  });

  app.get("/ops/usage-friction", async () => {
    if (!config.ops.pilotOpsEnabled || !config.product.usageFrictionSummaryEnabled) {
      throw featureDisabled("Usage friction summary");
    }

    const friction = await persistence.searchRepository.getUsageFrictionSummary();
    metrics.recordUsageFrictionRead();
    return { friction };
  });

  app.get("/ops/plans/summary", async () => {
    if (!config.ops.pilotOpsEnabled || !config.product.enabled) {
      throw featureDisabled("Plan summary");
    }

    const summary = await persistence.searchRepository.getPlanSummary();
    metrics.recordPlanSummaryRead();
    return { summary };
  });

  app.post("/ops/pilots", async (request, reply) => {
    if (!config.ops.pilotOpsEnabled) {
      throw featureDisabled("Pilot operations");
    }

    ensureWriteCapable(reliability);
    const payload = pilotPartnerCreateSchema.parse(request.body);
    const featureOverrides = normalizePilotFeatureOverrides(payload.featureOverrides);
    const partner = await persistence.searchRepository.createPilotPartner({
      name: payload.name,
      slug: payload.slug,
      planTier: payload.planTier,
      status: payload.status,
      contactLabel: payload.contactLabel ?? null,
      notes: payload.notes ?? null,
      featureOverrides
    });

    await persistence.searchRepository.recordOpsAction({
      actionType: "pilot_partner_created",
      targetType: "pilot_partner",
      targetId: partner.id,
      partnerId: partner.id,
      result: "success",
      details: {
        slug: partner.slug,
        status: partner.status
      }
    });

    metrics.recordPilotPartnerCreate();
    if (hasPilotOverrideValue(featureOverrides)) {
      metrics.recordPartnerFeatureOverride();
    }

    return reply.status(201).send(partner);
  });

  app.get("/ops/pilots", async () => {
    if (!config.ops.pilotOpsEnabled) {
      throw featureDisabled("Pilot operations");
    }

    const partners = await persistence.searchRepository.listPilotPartners();
    return { partners };
  });

  app.get("/ops/pilots/:partnerId", async (request, reply) => {
    if (!config.ops.pilotOpsEnabled) {
      throw featureDisabled("Pilot operations");
    }

    const params = request.params as { partnerId?: string };
    const partnerId = params.partnerId?.trim();

    if (!partnerId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid partner id", [
          { field: "partnerId", message: "partnerId is required" }
        ])
      );
    }

    const partner = await persistence.searchRepository.getPilotPartner(partnerId);
    if (!partner) {
      return reply.status(404).send(
        buildErrorPayload("PILOT_PARTNER_NOT_FOUND", "No pilot partner was found for this id.")
      );
    }

    const [links, actions, usage] = await Promise.all([
      persistence.searchRepository.listPilotLinks(partner.id),
      persistence.searchRepository.listOpsActions({
        partnerId: partner.id,
        limit: parseLimit(
          undefined,
          config.performance.opsDefaultPageSize,
          config.performance.opsMaxPageSize
        )
      }),
      persistence.searchRepository.getPartnerUsageSummary(partner.id)
    ]);

    return {
      partner,
      effectiveCapabilities: resolveEffectiveCapabilities({
        config,
        planTier: partner.planTier,
        overrides: partner.featureOverrides
      }),
      links,
      actions,
      usage: usage[0] ?? null
    };
  });

  app.patch("/ops/pilots/:partnerId", async (request, reply) => {
    if (!config.ops.pilotOpsEnabled) {
      throw featureDisabled("Pilot operations");
    }

    ensureWriteCapable(reliability);
    const params = request.params as { partnerId?: string };
    const partnerId = params.partnerId?.trim();
    const payload = pilotPartnerUpdateSchema.parse(request.body);

    if (!partnerId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid partner id", [
          { field: "partnerId", message: "partnerId is required" }
        ])
      );
    }

    const featureOverrides = payload.featureOverrides
      ? normalizePilotFeatureOverrides(payload.featureOverrides)
      : undefined;
    const updated = await persistence.searchRepository.updatePilotPartner(partnerId, {
      name: payload.name,
      planTier: payload.planTier,
      status: payload.status,
      contactLabel: payload.contactLabel,
      notes: payload.notes,
      featureOverrides
    });

    if (!updated) {
      await persistence.searchRepository.recordOpsAction({
        actionType: "pilot_partner_updated",
        targetType: "pilot_partner",
        targetId: partnerId,
        partnerId,
        result: "not_found"
      });
      return reply.status(404).send(
        buildErrorPayload("PILOT_PARTNER_NOT_FOUND", "No pilot partner was found for this id.")
      );
    }

    await persistence.searchRepository.recordOpsAction({
      actionType: "pilot_partner_updated",
      targetType: "pilot_partner",
      targetId: updated.id,
      partnerId: updated.id,
      result: "success",
      details: {
        status: updated.status,
        hasFeatureOverrides: hasPilotOverrideValue(featureOverrides)
      }
    });

    await persistence.searchRepository.recordValidationEvent({
      eventName: "partner_updated",
      payload: {
        partnerId: updated.id,
        partnerSlug: updated.slug,
        status: updated.status
      }
    });

    if (hasPilotOverrideValue(featureOverrides)) {
      metrics.recordPartnerFeatureOverride();
    }

    return updated;
  });

  app.get("/pilot/links", async (request) => {
    if (!config.ops.pilotOpsEnabled || !config.ops.pilotLinksEnabled) {
      throw featureDisabled("Pilot links");
    }

    const query = request.query as Record<string, unknown> | undefined;
    const partnerId = typeof query?.partnerId === "string" ? query.partnerId.trim() : undefined;
    const links = await persistence.searchRepository.listPilotLinks(partnerId);
    return { links };
  });

  app.post("/pilot/links", async (request, reply) => {
    if (!config.ops.pilotOpsEnabled || !config.ops.pilotLinksEnabled) {
      throw featureDisabled("Pilot links");
    }

    ensureWriteCapable(reliability);
    const payload = pilotLinkCreateSchema.parse(request.body);
    const partner = await persistence.searchRepository.getPilotPartner(payload.partnerId);

    if (!partner) {
      await persistence.searchRepository.recordOpsAction({
        actionType: "pilot_link_created",
        targetType: "pilot_link",
        targetId: payload.partnerId,
        partnerId: payload.partnerId,
        result: "not_found"
      });
      return reply.status(404).send(
        buildErrorPayload("PILOT_PARTNER_NOT_FOUND", "No pilot partner was found for this id.")
      );
    }

    const allowedFeatures = normalizePilotFeatureOverrides(payload.allowedFeatures);
    const link = await persistence.searchRepository.createPilotLink({
      partnerId: payload.partnerId,
      expiresAt:
        payload.expiresInDays && payload.expiresInDays > 0
          ? addDaysToNowIso(payload.expiresInDays)
          : addDaysToNowIso(30),
      allowedFeatures
    });

    await persistence.searchRepository.recordOpsAction({
      actionType: "pilot_link_created",
      targetType: "pilot_link",
      targetId: link.id,
      partnerId: partner.id,
      result: "success",
      details: {
        expiresAt: link.expiresAt,
        status: link.status
      }
    });

    await persistence.searchRepository.recordValidationEvent({
      eventName: "pilot_link_created",
      payload: {
        partnerId: partner.id,
        partnerSlug: partner.slug,
        pilotLinkId: link.id
      }
    });

    metrics.recordPilotLinkCreate();
    if (hasPilotOverrideValue(allowedFeatures)) {
      metrics.recordPartnerFeatureOverride();
    }

    return reply.status(201).send({
      link,
      url: `/?pilot=${link.token}`
    });
  });

  app.get("/pilot/links/:token", async (request, reply) => {
    if (!config.ops.pilotOpsEnabled || !config.ops.pilotLinksEnabled) {
      throw featureDisabled("Pilot links");
    }

    const params = request.params as { token?: string };
    const token = params.token?.trim();

    if (!token) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid pilot link token", [
          { field: "token", message: "token is required" }
        ])
      );
    }

    if (token.length < config.security.shareLinkMinTokenLength) {
      metrics.recordInvalidTokenAccess();
      return reply.status(404).send(unavailableLinkPayload());
    }

    const rateLimit = takePilotLinkOpenRateLimit(request.ip);
    if (!rateLimit.allowed) {
      metrics.recordRateLimitTrigger("/pilot/links/:token");
      throw new ApiError(429, "RATE_LIMITED", "Pilot link rate limit exceeded.", [
        {
          field: "retryAfterMs",
          message: String(rateLimit.retryAfterMs)
        }
      ]);
    }

    const view = await persistence.searchRepository.getPilotLink(token);
    if (!view) {
      metrics.recordInvalidTokenAccess();
      return reply.status(404).send(unavailableLinkPayload());
    }

    if (view.link.status === "expired") {
      metrics.recordExpiredLinkOpenAttempt();
      return reply.status(410).send(unavailableLinkPayload());
    }

    if (view.link.status === "revoked") {
      metrics.recordRevokedLinkOpenAttempt();
      return reply.status(410).send(unavailableLinkPayload());
    }

    metrics.recordPilotLinkOpen();
    metrics.recordPlanCapabilityResolution();
    await persistence.searchRepository.recordValidationEvent({
      eventName: "pilot_link_opened",
      payload: {
        partnerId: view.partner.id,
        partnerSlug: view.partner.slug,
        pilotLinkId: view.link.id
      }
    });
    await persistence.searchRepository.recordValidationEvent({
      eventName: "plan_capability_resolved",
      payload: {
        partnerId: view.partner.id,
        partnerSlug: view.partner.slug,
        pilotLinkId: view.link.id,
        planTier: view.context.planTier,
        capabilities: view.context.capabilities
      }
    });

    return view;
  });

  app.post("/pilot/links/:token/revoke", async (request, reply) => {
    if (!config.ops.pilotOpsEnabled || !config.ops.pilotLinksEnabled) {
      throw featureDisabled("Pilot links");
    }

    ensureWriteCapable(reliability);
    const params = request.params as { token?: string };
    const token = params.token?.trim();

    if (!token) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid pilot link token", [
          { field: "token", message: "token is required" }
        ])
      );
    }

    const existing = await persistence.searchRepository.getPilotLink(token);
    const revoked = await persistence.searchRepository.revokePilotLink(token);
    if (!revoked) {
      await persistence.searchRepository.recordOpsAction({
        actionType: "pilot_link_revoked",
        targetType: "pilot_link",
        targetId: token,
        result: "not_found"
      });
      return reply.status(404).send(
        buildErrorPayload("PILOT_LINK_NOT_FOUND", "No pilot link was found for this token.")
      );
    }

    await persistence.searchRepository.recordOpsAction({
      actionType: "pilot_link_revoked",
      targetType: "pilot_link",
      targetId: revoked.id,
      partnerId: revoked.partnerId,
      result: "success",
      details: {
        token,
        revokedAt: revoked.revokedAt
      }
    });

    await persistence.searchRepository.recordValidationEvent({
      eventName: "pilot_link_revoked",
      payload: {
        partnerId: revoked.partnerId,
        pilotLinkId: revoked.id,
        previousStatus: existing?.link.status ?? null
      }
    });

    metrics.recordPilotLinkRevoke();
    return { link: revoked };
  });

  app.get("/ops/pilots/:partnerId/activity", async (request, reply) => {
    if (!config.ops.pilotOpsEnabled) {
      throw featureDisabled("Pilot operations");
    }

    const params = request.params as { partnerId?: string };
    const partnerId = params.partnerId?.trim();
    const query = request.query as Record<string, unknown> | undefined;

    if (!partnerId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid partner id", [
          { field: "partnerId", message: "partnerId is required" }
        ])
      );
    }

    const activity = await persistence.searchRepository.listPilotActivity({
      partnerId,
      limit: parseLimit(query, config.performance.opsDefaultPageSize, config.performance.opsMaxPageSize)
    });
    metrics.recordPilotActivityRead();
    return { activity };
  });

  app.get("/ops/partners/:partnerId/usage", async (request, reply) => {
    if (!config.ops.pilotOpsEnabled || !config.product.enabled) {
      throw featureDisabled("Partner usage summary");
    }

    const params = request.params as { partnerId?: string };
    const partnerId = params.partnerId?.trim();

    if (!partnerId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid partner id", [
          { field: "partnerId", message: "partnerId is required" }
        ])
      );
    }

    const usage = await persistence.searchRepository.getPartnerUsageSummary(partnerId);
    metrics.recordPartnerUsageSummaryRead();
    return { usage: usage[0] ?? null };
  });

  app.get("/ops/actions", async (request) => {
    if (!config.ops.pilotOpsEnabled) {
      throw featureDisabled("Pilot operations");
    }

    const query = request.query as Record<string, unknown> | undefined;
    const partnerId = typeof query?.partnerId === "string" ? query.partnerId.trim() : undefined;
    const actions = await persistence.searchRepository.listOpsActions({
      partnerId,
      limit: parseLimit(query, config.performance.opsDefaultPageSize, config.performance.opsMaxPageSize)
    });

    return { actions };
  });

  app.get("/ops/summary", async () => {
    if (!config.ops.pilotOpsEnabled) {
      throw featureDisabled("Pilot operations");
    }

    const [summary, statuses, dataQualitySummary, usageFunnel, usageFriction, planSummary] = await Promise.all([
      persistence.searchRepository.getOpsSummary(),
      providers.getStatuses(),
      persistence.searchRepository.getDataQualitySummary(),
      config.product.usageFunnelSummaryEnabled
        ? persistence.searchRepository.getUsageFunnelSummary()
        : Promise.resolve(null),
      config.product.usageFrictionSummaryEnabled
        ? persistence.searchRepository.getUsageFrictionSummary()
        : Promise.resolve(null),
      config.product.enabled
        ? persistence.searchRepository.getPlanSummary()
        : Promise.resolve(null)
    ]);
    const metricSnapshot = metrics.snapshot();
    metrics.recordOpsSummaryRead();
    const reliabilitySummary = config.deployment.enableReliabilitySummary ? reliability.snapshot() : null;
    const goLiveCheck = buildGoLiveCheckSummary({
      config,
      persistenceMode: persistence.mode,
      readiness: await persistence.checkReadiness(),
      reliability: reliability.snapshot(),
      providers: statuses
    });
    const support = buildSupportContextSummary({
      config,
      reliability: reliability.snapshot(),
      capabilities: getDefaultCapabilities(config, config.product.defaultPlanTier)
    });
    const releaseSummary = buildReleaseSummary({
      config,
      reliability: reliability.snapshot(),
      persistenceMode: persistence.mode
    });

    return {
      summary: {
        ...summary,
        security: {
          revokedLinkOpenAttemptCount: metricSnapshot.revokedLinkOpenAttemptCount,
          expiredLinkOpenAttemptCount: metricSnapshot.expiredLinkOpenAttemptCount,
          invalidTokenAccessCount: metricSnapshot.invalidTokenAccessCount,
          internalRouteDeniedCount: metricSnapshot.internalRouteDeniedCount,
          rateLimitTriggerCountByEndpoint: metricSnapshot.rateLimitTriggerCountByEndpoint,
          validationRejectCountByCategory: metricSnapshot.validationRejectCountByCategory,
          malformedPayloadCount: metricSnapshot.malformedPayloadCount,
          shareRevocationEnforcementCount: metricSnapshot.shareRevocationEnforcementCount
        },
        topErrorCategories: Object.entries(metricSnapshot.errorRateByCategory)
          .map(([category, value]) => ({
            category,
            count: value.count
          }))
          .filter((entry) => entry.count > 0)
          .sort((left, right) => right.count - left.count)
      },
      performance: config.performance.internalPerfSummaryEnabled
        ? {
            averageSearchLatencyMs: metricSnapshot.searchLatencyMs.average,
            p95SearchLatencyMs: metricSnapshot.searchLatencyP95Ms,
            providerCallCountByType: metricSnapshot.providerCallCountByType,
            cacheHitRate: metricSnapshot.cacheHitRate,
            liveFetchBudgetExhaustionCount: metricSnapshot.liveFetchBudgetExhaustionCount,
            heavyEndpointReadCounts: metricSnapshot.heavyEndpointReadCounts
          }
        : null,
      reliability: reliabilitySummary,
      dataQualitySummary,
      goLiveCheck,
      support,
      releaseSummary,
      usage: {
        funnel: usageFunnel,
        friction: usageFriction,
        planSummary
      },
      errors: metricSnapshot.errorRateByCategory,
      security: {
        revokedLinkOpenAttemptCount: metricSnapshot.revokedLinkOpenAttemptCount,
        expiredLinkOpenAttemptCount: metricSnapshot.expiredLinkOpenAttemptCount,
        invalidTokenAccessCount: metricSnapshot.invalidTokenAccessCount,
        internalRouteDeniedCount: metricSnapshot.internalRouteDeniedCount,
        rateLimitTriggerCountByEndpoint: metricSnapshot.rateLimitTriggerCountByEndpoint,
        validationRejectCountByCategory: metricSnapshot.validationRejectCountByCategory,
        malformedPayloadCount: metricSnapshot.malformedPayloadCount,
        shareRevocationEnforcementCount: metricSnapshot.shareRevocationEnforcementCount
      },
      providers: statuses
    };
  });

  app.get("/ops/reliability/incidents", async (request) => {
    if (!config.ops.pilotOpsEnabled || !config.deployment.reliabilityIncidentsEnabled) {
      throw featureDisabled("Reliability incidents");
    }

    const query = request.query as Record<string, unknown> | undefined;
    return {
      incidents: reliability.listIncidents({
        status:
          typeof query?.status === "string"
            ? (query.status as ReliabilityIncidentStatus)
            : undefined,
        category: typeof query?.category === "string" ? query.category.trim() : undefined,
        provider: typeof query?.provider === "string" ? query.provider.trim() : undefined,
        limit: parseLimit(query, config.performance.opsDefaultPageSize, config.performance.opsMaxPageSize)
      })
    };
  });

  app.patch("/ops/reliability/incidents/:id", async (request, reply) => {
    if (!config.ops.pilotOpsEnabled || !config.deployment.reliabilityIncidentsEnabled) {
      throw featureDisabled("Reliability incidents");
    }

    ensureWriteCapable(reliability);
    const params = request.params as { id?: string };
    const incidentId = params.id?.trim();
    const payload = reliabilityIncidentStatusUpdateSchema.parse(request.body ?? {});
    if (!incidentId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid reliability incident id", [
          { field: "id", message: "id is required" }
        ])
      );
    }

    const incident = reliability.updateIncidentStatus(incidentId, payload.status);
    if (!incident) {
      return reply.status(404).send(
        buildErrorPayload("RELIABILITY_INCIDENT_NOT_FOUND", "No reliability incident was found for this id.")
      );
    }

    await persistence.searchRepository.recordOpsAction({
      actionType: `reliability_incident_${payload.status}`,
      targetType: "reliability_incident",
      targetId: incidentId,
      partnerId: incident.partnerId ?? null,
      result: "success",
      details: {
        status: payload.status,
        category: incident.category
      }
    });

    return incident;
  });

  app.get("/ops/errors", async () => {
    if (!config.ops.pilotOpsEnabled) {
      throw featureDisabled("Pilot operations");
    }

    const snapshot = metrics.snapshot();
    metrics.recordOpsErrorView();
    return {
      errors: snapshot.errorRateByCategory,
      security: {
        revokedLinkOpenAttemptCount: snapshot.revokedLinkOpenAttemptCount,
        expiredLinkOpenAttemptCount: snapshot.expiredLinkOpenAttemptCount,
        invalidTokenAccessCount: snapshot.invalidTokenAccessCount,
        internalRouteDeniedCount: snapshot.internalRouteDeniedCount,
        rateLimitTriggerCountByEndpoint: snapshot.rateLimitTriggerCountByEndpoint,
        validationRejectCountByCategory: snapshot.validationRejectCountByCategory,
        malformedPayloadCount: snapshot.malformedPayloadCount
      }
    };
  });

  app.get("/ops/data-quality", async (request) => {
    if (!config.ops.pilotOpsEnabled) {
      throw featureDisabled("Pilot operations");
    }

    const query = request.query as Record<string, unknown> | undefined;
    const events = await persistence.searchRepository.listDataQualityEvents({
      severity:
        typeof query?.severity === "string"
          ? (query.severity as DataQualitySeverity)
          : undefined,
      sourceDomain:
        typeof query?.sourceDomain === "string"
          ? (query.sourceDomain as DataQualitySourceDomain)
          : undefined,
      provider: typeof query?.provider === "string" ? query.provider.trim() : undefined,
      partnerId: typeof query?.partnerId === "string" ? query.partnerId.trim() : undefined,
      status:
        typeof query?.status === "string"
          ? (query.status as "open" | "acknowledged" | "resolved" | "ignored")
          : undefined,
      limit: parseLimit(query, config.performance.opsDefaultPageSize, config.performance.opsMaxPageSize)
    });

    return {
      events
    };
  });

  app.get("/ops/data-quality/summary", async (request) => {
    if (!config.ops.pilotOpsEnabled) {
      throw featureDisabled("Pilot operations");
    }

    const query = request.query as Record<string, unknown> | undefined;
    const summary = await persistence.searchRepository.getDataQualitySummary({
      sourceDomain:
        typeof query?.sourceDomain === "string"
          ? (query.sourceDomain as DataQualitySourceDomain)
          : undefined,
      provider: typeof query?.provider === "string" ? query.provider.trim() : undefined,
      partnerId: typeof query?.partnerId === "string" ? query.partnerId.trim() : undefined,
      status:
        typeof query?.status === "string"
          ? (query.status as "open" | "acknowledged" | "resolved" | "ignored")
          : undefined
    });

    return {
      summary
    };
  });

  app.get("/ops/data-quality/:eventId", async (request, reply) => {
    if (!config.ops.pilotOpsEnabled) {
      throw featureDisabled("Pilot operations");
    }

    const params = request.params as { eventId?: string };
    const eventId = params.eventId?.trim();
    if (!eventId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid data quality event id", [
          { field: "eventId", message: "eventId is required" }
        ])
      );
    }

    const event = await persistence.searchRepository.getDataQualityEvent(eventId);
    if (!event) {
      return reply.status(404).send(
        buildErrorPayload("VALIDATION_ERROR", "Data quality event not found", [
          { field: "eventId", message: "No data quality event was found for this id." }
        ])
      );
    }

    return event;
  });

  app.patch("/ops/data-quality/:eventId", async (request, reply) => {
    if (!config.ops.pilotOpsEnabled) {
      throw featureDisabled("Pilot operations");
    }

    const params = request.params as { eventId?: string };
    const eventId = params.eventId?.trim();
    const payload = dataQualityStatusUpdateSchema.parse(request.body ?? {});

    if (!eventId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid data quality event id", [
          { field: "eventId", message: "eventId is required" }
        ])
      );
    }

    const event = await persistence.searchRepository.updateDataQualityEventStatus(eventId, payload.status);
    if (!event) {
      return reply.status(404).send(
        buildErrorPayload("VALIDATION_ERROR", "Data quality event not found", [
          { field: "eventId", message: "No data quality event was found for this id." }
        ])
      );
    }

    await persistence.searchRepository.recordOpsAction({
      actionType: `data_quality_${payload.status}`,
      targetType: "data_quality_event",
      targetId: eventId,
      partnerId: event.partnerId ?? null,
      result: "success",
      details: {
        status: payload.status
      }
    });

    return event;
  });

  app.get("/ops/feature-flags", async () => {
    if (!config.ops.pilotOpsEnabled) {
      throw featureDisabled("Pilot operations");
    }

    return {
      validation: config.validation,
      workflow: config.workflow,
      ops: config.ops,
      dataQuality: config.dataQuality,
      performance: config.performance
    };
  });

  app.post("/metrics/events", async (request, reply) => {
    const payload = metricsEventSchema.parse(request.body);

    if (payload.eventType === "comparison_view") {
      metrics.recordComparisonView();
    }

    if (payload.eventType === "explainability_render") {
      metrics.recordExplainabilityRender();
    }

    if (payload.eventType === "search_restore") {
      metrics.recordSearchRestore();
    }

    if (payload.eventType === "recent_activity_panel_view") {
      metrics.recordRecentActivityPanelView();
    }

    if (payload.eventType === "onboarding_view") {
      metrics.recordOnboardingView();
    }

    if (payload.eventType === "onboarding_dismiss") {
      metrics.recordOnboardingDismiss();
    }

    if (payload.eventType === "empty_state_view") {
      metrics.recordEmptyStateView();
    }

    if (payload.eventType === "suggestion_click") {
      metrics.recordSuggestionClick();
    }

    if (payload.eventType === "detail_panel_open") {
      metrics.recordDetailPanelOpen();
    }

    if (payload.eventType === "result_compare_add") {
      metrics.recordResultCompareAdd();
    }

    if (payload.eventType === "snapshot_reopen") {
      metrics.recordSnapshotReopen();
    }

    if (payload.eventType === "saved_search_restore") {
      metrics.recordSavedSearchRestore();
    }

    if (payload.eventType === "validation_prompt_view") {
      metrics.recordValidationPromptView();
    }

    if (payload.eventType === "validation_prompt_response") {
      metrics.recordValidationPromptResponse();
    }

    if (payload.eventType === "demo_scenario_start") {
      metrics.recordDemoScenarioStart();
    }

    if (payload.eventType === "walkthrough_view") {
      metrics.recordWalkthroughView();
    }

    if (payload.eventType === "walkthrough_dismiss") {
      metrics.recordWalkthroughDismiss();
    }

    if (payload.eventType === "export_use") {
      metrics.recordExportUse();
    }

    if (payload.eventType === "cta_click") {
      metrics.recordCtaClick();
    }

    if (payload.eventType === "historical_compare_view") {
      metrics.recordHistoricalCompareView();
    }

    return reply.status(202).send({ status: "accepted" });
  });

  app.post("/validation/events", async (request, reply) => {
    if (!config.validation.enabled) {
      throw featureDisabled("Validation events");
    }

    const payload = validationEventSchema.parse(request.body);
    const event = await persistence.searchRepository.recordValidationEvent({
      ...payload,
      sessionId: extractSessionId(request, payload.sessionId ?? null)
    });
    if (payload.eventName === "export_generated") {
      metrics.recordExportGenerate();
      metrics.recordFeatureUsage("canExportResults");
    }
    if (payload.eventName === "plan_capability_resolved") {
      metrics.recordPlanCapabilityResolution();
    }
    if (payload.eventName === "capability_limit_hit") {
      metrics.recordCapabilityLimitHit(
        typeof payload.payload?.capability === "string" ? payload.payload.capability : "unknown"
      );
    }
    if (payload.eventName === "share_feature_used") {
      metrics.recordFeatureUsage(
        typeof payload.payload?.feature === "string" ? payload.payload.feature : "share_feature"
      );
    }
    if (payload.eventName === "shortlist_feature_used") {
      metrics.recordFeatureUsage(
        typeof payload.payload?.feature === "string" ? payload.payload.feature : "shortlist_feature"
      );
    }

    return reply.status(202).send(event);
  });

  app.post("/feedback", async (request, reply) => {
    if (!config.validation.enabled || !config.validation.feedbackEnabled) {
      throw featureDisabled("Feedback capture");
    }

    ensureWriteCapable(reliability);
    const pilotContext = await resolvePilotContext(persistence.searchRepository, request);
    if (!getEffectivePilotFeatures(config, pilotContext).feedbackEnabled) {
      throw featureDisabledForPilot("Feedback capture");
    }

    const feedbackRateLimit = takeFeedbackRateLimit(extractSessionId(request) ?? request.ip);
    if (!feedbackRateLimit.allowed) {
      metrics.recordRateLimitTrigger("/feedback");
      throw new ApiError(429, "RATE_LIMITED", "Feedback rate limit exceeded.", [
        {
          field: "retryAfterMs",
          message: String(feedbackRateLimit.retryAfterMs)
        }
      ]);
    }

    const payload = feedbackSchema.parse(request.body);
    enforceMaxLength("comment", payload.comment, config.security.maxFeedbackLength);
    const sessionId = extractSessionId(request, payload.sessionId ?? null);
    const record = await persistence.searchRepository.createFeedback({
      ...payload,
      sessionId
    });
    await recordValidationEventWithPilot(persistence.searchRepository, {
      eventName: "feedback_submitted",
      sessionId,
      snapshotId: payload.snapshotId ?? null,
      historyRecordId: payload.historyRecordId ?? null,
      searchDefinitionId: payload.searchDefinitionId ?? null,
      payload: {
        category: payload.category,
        value: payload.value
      }
    }, pilotContext);
    metrics.recordFeedbackSubmit(payload.value === "positive");

    return reply.status(201).send(record);
  });

  app.post("/search", async (request) => {
    const rateLimitKey = extractSessionId(request) ?? request.ip;
    const rateLimit = takeSearchRateLimit(rateLimitKey);
    if (!rateLimit.allowed) {
      throw new ApiError(429, "RATE_LIMITED", "Search rate limit exceeded.", [
        {
          field: "retryAfterMs",
          message: String(rateLimit.retryAfterMs)
        }
      ]);
    }

    const payload = searchRequestSchema.parse(request.body);
    const sessionId = extractSessionId(request);
    const pilotContext = await resolvePilotContext(persistence.searchRepository, request);
    if (config.validation.enabled) {
      await recordValidationEventWithPilot(
        persistence.searchRepository,
        {
          eventName: "search_started",
          sessionId,
          payload: {
            locationType: payload.locationType,
            radiusMiles: payload.radiusMiles
          }
        },
        pilotContext
      );
    }
    try {
      const response = await runSearch(
        payload,
        {
          geocoder: providers.geocoder,
          listingProvider: providers.listings,
          marketSnapshotRepository: persistence.marketSnapshotRepository,
          metrics,
          repository: persistence.searchRepository,
          safetyProvider: providers.safety,
          getProviderFreshnessHours: () => providers.getFreshnessHours(),
          getProviderUsage: () => providers.getLastProviderUsage()
        },
        {
          sessionId,
          partnerId: pilotContext?.partner.id ?? null
        }
      );
      reliability.noteProviderUsage(response.metadata.performance?.providerUsage);
      if (config.validation.enabled) {
        await recordValidationEventWithPilot(persistence.searchRepository, {
          eventName: "search_completed",
          sessionId,
          historyRecordId: response.metadata.historyRecordId ?? null,
          payload: {
            returnedCount: response.metadata.returnedCount,
            totalMatched: response.metadata.totalMatched
          }
        }, pilotContext);
      }
      if (pilotContext) {
        const statuses = await providers.getStatuses();
        const degraded = statuses.some(
          (status) =>
            status.status === "degraded" || status.status === "failing" || status.status === "unavailable"
        );
        if (degraded) {
          metrics.recordProviderDegradedDuringPilot();
          await persistence.searchRepository.recordValidationEvent({
            eventName: "provider_degraded_during_pilot",
            payload: {
              partnerId: pilotContext.partner.id,
              partnerSlug: pilotContext.partner.slug,
              pilotLinkId: pilotContext.link.id,
              degradedProviders: statuses
                .filter(
                  (status) =>
                    status.status === "degraded" || status.status === "failing" || status.status === "unavailable"
                )
                .map((status) => status.provider)
            }
          });
        }
      }
      metrics.recordSearchOutcome(true);
      return response;
    } catch (error) {
      throw error;
    }
  });

  app.post("/search/snapshots", async (request, reply) => {
    const rateLimitKey = extractSessionId(request) ?? request.ip;
    const rateLimit = takeSnapshotRateLimit(rateLimitKey);
    if (!rateLimit.allowed) {
      throw new ApiError(429, "RATE_LIMITED", "Snapshot creation rate limit exceeded.", [
        {
          field: "retryAfterMs",
          message: String(rateLimit.retryAfterMs)
        }
      ]);
    }

    ensureWriteCapable(reliability);
    const payload = searchSnapshotPayloadSchema.parse(request.body);
    const pilotContext = await resolvePilotContext(persistence.searchRepository, request);
    const sessionId = extractSessionId(request, payload.sessionId ?? null);
    const startedAt = Date.now();
    const snapshot = await persistence.searchRepository.createSearchSnapshot({
      ...payload,
      sessionId
    });
    metrics.recordSnapshotCreated();
    metrics.recordSnapshotWriteLatency(Date.now() - startedAt);
    if (config.validation.enabled) {
      await recordValidationEventWithPilot(
        persistence.searchRepository,
        {
          eventName: "snapshot_created",
          sessionId,
          snapshotId: snapshot.id,
          historyRecordId: snapshot.historyRecordId ?? null,
          searchDefinitionId: snapshot.searchDefinitionId ?? null
        },
        pilotContext
      );
    }

    return reply.status(201).send(snapshot);
  });

  app.get("/search/snapshots", async (request) => {
    const startedAt = Date.now();
    const query = request.query as Record<string, unknown> | undefined;
    const sessionId = extractSessionId(request);
    const effectiveLimit = parseLimit(
      query,
      config.performance.opsDefaultPageSize,
      config.performance.opsMaxPageSize
    );
    const snapshots = await persistence.searchRepository.listSearchSnapshots(sessionId, effectiveLimit);
    metrics.recordSnapshotRead();
    metrics.recordSnapshotReadLatency(Date.now() - startedAt);

    return {
      snapshots
    };
  });

  app.get("/search/snapshots/:id", async (request, reply) => {
    const startedAt = Date.now();
    const params = request.params as { id?: string };
    const snapshotId = params.id?.trim();

    if (!snapshotId) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid snapshot id",
          details: [
            {
              field: "id",
              message: "id is required"
            }
          ]
        }
      });
    }

    const snapshot = await persistence.searchRepository.getSearchSnapshot(snapshotId);

    if (!snapshot) {
      return reply.status(404).send({
        error: {
          code: "SEARCH_SNAPSHOT_NOT_FOUND",
          message: "No stored search snapshot was found for this id.",
          details: []
        }
      });
    }

    metrics.recordSnapshotRead();
    metrics.recordSnapshotReadLatency(Date.now() - startedAt);
    return snapshot;
  });

  app.post("/search/snapshots/:id/share", async (request, reply) => {
    if (
      !config.validation.enabled ||
      !config.validation.sharedSnapshotsEnabled ||
      !config.security.publicSharedViewsEnabled
    ) {
      throw featureDisabled("Shared snapshots");
    }

    ensureWriteCapable(reliability);
    const pilotContext = await resolvePilotContext(persistence.searchRepository, request);
    const capabilities = getEffectiveCapabilities(config, pilotContext);
    if (!capabilities.canShareSnapshots) {
      throw featureDisabledForPilot("Shared snapshots");
    }

    const params = request.params as { id?: string };
    const snapshotId = params.id?.trim();
    const payload = shareSnapshotSchema.parse(request.body ?? {});

    if (!snapshotId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid snapshot id", [
          {
            field: "id",
            message: "id is required"
          }
        ])
      );
    }

    const snapshot = await persistence.searchRepository.getSearchSnapshot(snapshotId);
    if (!snapshot) {
      return reply.status(404).send(
        buildErrorPayload(
          "SEARCH_SNAPSHOT_NOT_FOUND",
          "No stored search snapshot was found for this id."
        )
      );
    }

    const sessionId = extractSessionId(request, payload.sessionId ?? snapshot.sessionId ?? null);
    await enforceSessionCapabilityLimit({
      repository: persistence.searchRepository,
      metrics,
      config,
      pilotContext,
      sessionId,
      capabilityKey: "shareLinks",
      featureLabel: "shareLinks",
      currentCount: () => countSessionShareLinks(persistence.searchRepository, sessionId)
    });
    const expiresInDays =
      payload.expiresInDays ?? config.validation.shareSnapshotExpirationDays;
    const share = await persistence.searchRepository.createSharedSnapshot({
      snapshotId,
      sessionId,
      expiresAt: expiresInDays > 0 ? addDaysToNowIso(expiresInDays) : null
    });
    await recordValidationEventWithPilot(persistence.searchRepository, {
      eventName: "snapshot_shared",
      sessionId,
      snapshotId,
      payload: {
        shareId: share.shareId
      }
    }, pilotContext);
    await recordValidationEventWithPilot(
      persistence.searchRepository,
      {
        eventName: "share_feature_used",
        sessionId,
        snapshotId,
        payload: {
          feature: "shared_snapshot",
          shareId: share.shareId
        }
      },
      pilotContext
    );
    metrics.recordSharedSnapshotCreate();
    metrics.recordFeatureUsage("canShareSnapshots");

    return reply.status(201).send({
      share,
      shareUrl: `${config.apiUrl.replace(/\/$/, "")}/shared/snapshots/${share.shareId}`,
      readOnly: true
    });
  });

  app.get("/shared/snapshots/:shareId", async (request, reply) => {
    if (
      !config.validation.enabled ||
      !config.validation.sharedSnapshotsEnabled ||
      !config.security.publicSharedViewsEnabled
    ) {
      throw featureDisabled("Shared snapshots");
    }

    const pilotContext = await resolvePilotContext(persistence.searchRepository, request);
    if (!getEffectivePilotFeatures(config, pilotContext).sharedSnapshotsEnabled) {
      throw featureDisabledForPilot("Shared snapshots");
    }

    const params = request.params as { shareId?: string };
    const shareId = params.shareId?.trim();

    if (!shareId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid share id", [
          {
            field: "shareId",
            message: "shareId is required"
          }
        ])
      );
    }

    if (shareId.length < config.security.shareLinkMinTokenLength) {
      metrics.recordInvalidTokenAccess();
      return reply.status(404).send(unavailableLinkPayload());
    }

    const sharedRateLimit = takeSharedOpenRateLimit(request.ip);
    if (!sharedRateLimit.allowed) {
      metrics.recordRateLimitTrigger("/shared/snapshots/:shareId");
      throw new ApiError(429, "RATE_LIMITED", "Shared snapshot rate limit exceeded.", [
        {
          field: "retryAfterMs",
          message: String(sharedRateLimit.retryAfterMs)
        }
      ]);
    }

    const sharedView = await persistence.searchRepository.getSharedSnapshot(shareId);
    if (!sharedView) {
      metrics.recordInvalidTokenAccess();
      return reply.status(404).send(unavailableLinkPayload());
    }

    if (sharedView.share.status === "expired") {
      metrics.recordSharedSnapshotExpired();
      metrics.recordExpiredLinkOpenAttempt();
      return reply.status(410).send(unavailableLinkPayload());
    }

    if (sharedView.share.status === "revoked") {
      metrics.recordRevokedLinkOpenAttempt();
      metrics.recordShareRevocationEnforcement();
      return reply.status(410).send(unavailableLinkPayload());
    }

    await recordValidationEventWithPilot(persistence.searchRepository, {
      eventName: "snapshot_opened",
      sessionId: sharedView.share.sessionId ?? null,
      snapshotId: sharedView.snapshot.id,
      payload: {
        shareId: sharedView.share.shareId
      }
    }, pilotContext);
    metrics.recordSharedSnapshotOpen();

    return toPublicSharedSnapshotView(sharedView);
  });

  app.post("/search/definitions", async (request, reply) => {
    ensureWriteCapable(reliability);
    const payload = searchDefinitionCreateSchema.parse(request.body);
    const sessionId = extractSessionId(request, payload.sessionId ?? null);
    const pilotContext = await resolvePilotContext(persistence.searchRepository, request);
    await enforceSessionCapabilityLimit({
      repository: persistence.searchRepository,
      metrics,
      config,
      pilotContext,
      sessionId,
      capabilityKey: "savedSearches",
      featureLabel: "savedSearches",
      currentCount: async () => (await persistence.searchRepository.listSearchDefinitions(sessionId)).length
    });
    const definition = await persistence.searchRepository.createSearchDefinition({
      ...payload,
      sessionId
    });
    metrics.recordSearchDefinitionCreate();
    if (definition.pinned) {
      metrics.recordSavedSearchPin();
    }

    return reply.status(201).send(definition);
  });

  app.get("/search/definitions", async (request) => {
    const sessionId = extractSessionId(request);
    const definitions = await persistence.searchRepository.listSearchDefinitions(sessionId);

    return {
      definitions
    };
  });

  app.get("/search/definitions/:id", async (request, reply) => {
    const params = request.params as { id?: string };
    const definitionId = params.id?.trim();

    if (!definitionId) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid definition id",
          details: [{ field: "id", message: "id is required" }]
        }
      });
    }

    const definition = await persistence.searchRepository.getSearchDefinition(definitionId);
    if (!definition) {
      return reply.status(404).send({
        error: {
          code: "SEARCH_DEFINITION_NOT_FOUND",
          message: "No saved search definition was found for this id.",
          details: []
        }
      });
    }

    return definition;
  });

  app.patch("/search/definitions/:id", async (request, reply) => {
    ensureWriteCapable(reliability);
    const params = request.params as { id?: string };
    const definitionId = params.id?.trim();
    const patch = searchDefinitionUpdateSchema.parse(request.body);

    if (!definitionId) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid definition id",
          details: [{ field: "id", message: "id is required" }]
        }
      });
    }

    const existing = await persistence.searchRepository.getSearchDefinition(definitionId);
    const updated = await persistence.searchRepository.updateSearchDefinition(definitionId, patch);

    if (!updated || !existing) {
      return reply.status(404).send({
        error: {
          code: "SEARCH_DEFINITION_NOT_FOUND",
          message: "No saved search definition was found for this id.",
          details: []
        }
      });
    }

    if (!existing.pinned && updated.pinned) {
      metrics.recordSavedSearchPin();
    }

    return updated;
  });

  app.delete("/search/definitions/:id", async (request, reply) => {
    ensureWriteCapable(reliability);
    const params = request.params as { id?: string };
    const definitionId = params.id?.trim();

    if (!definitionId) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid definition id",
          details: [{ field: "id", message: "id is required" }]
        }
      });
    }

    const deleted = await persistence.searchRepository.deleteSearchDefinition(definitionId);
    if (!deleted) {
      return reply.status(404).send({
        error: {
          code: "SEARCH_DEFINITION_NOT_FOUND",
          message: "No saved search definition was found for this id.",
          details: []
        }
      });
    }

    metrics.recordSearchDefinitionDelete();
    return reply.status(204).send();
  });

  app.get("/search/history", async (request) => {
    const query = request.query as Record<string, unknown> | undefined;
    const sessionId = extractSessionId(request);
    const limit = parseLimit(
      query,
      config.performance.opsDefaultPageSize,
      config.performance.opsMaxPageSize
    );
    const history = await persistence.searchRepository.listSearchHistory(sessionId, limit);
    metrics.recordSearchHistoryRead();

    return {
      history
    };
  });

  app.get("/search/history/:id", async (request, reply) => {
    const params = request.params as { id?: string };
    const historyId = params.id?.trim();

    if (!historyId) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid history id",
          details: [{ field: "id", message: "id is required" }]
        }
      });
    }

    const historyRecord = await persistence.searchRepository.getSearchHistory(historyId);
    if (!historyRecord) {
      return reply.status(404).send({
        error: {
          code: "SEARCH_HISTORY_NOT_FOUND",
          message: "No stored search history record was found for this id.",
          details: []
        }
      });
    }

    metrics.recordSearchHistoryRead();
    return historyRecord;
  });

  app.post("/shortlists", async (request, reply) => {
    if (!config.workflow.shortlistsEnabled) {
      throw featureDisabled("Shortlists");
    }

    ensureWriteCapable(reliability);
    const payload = shortlistCreateSchema.parse(request.body);
    const sessionId = extractSessionId(request, payload.sessionId ?? null);
    const pilotContext = await resolvePilotContext(persistence.searchRepository, request);
    await enforceSessionCapabilityLimit({
      repository: persistence.searchRepository,
      metrics,
      config,
      pilotContext,
      sessionId,
      capabilityKey: "shortlists",
      featureLabel: "shortlists",
      currentCount: async () => (await persistence.searchRepository.listShortlists(sessionId)).length
    });
    const shortlist = await persistence.searchRepository.createShortlist({
      ...payload,
      sessionId
    });
    metrics.recordShortlistCreate();
    if (shortlist.pinned) {
      metrics.recordSavedSearchPin();
    }
    await recordValidationEventWithPilot(
      persistence.searchRepository,
      {
        eventName: "shortlist_feature_used",
        sessionId,
        snapshotId: shortlist.sourceSnapshotId ?? null,
        payload: {
          feature: "shortlist_created",
          shortlistId: shortlist.id
        }
      },
      pilotContext
    );
    metrics.recordFeatureUsage("shortlists");

    return reply.status(201).send(shortlist);
  });

  app.get("/shortlists", async (request) => {
    if (!config.workflow.shortlistsEnabled) {
      throw featureDisabled("Shortlists");
    }

    const sessionId = extractSessionId(request);
    const shortlists = await persistence.searchRepository.listShortlists(sessionId);
    metrics.recordShortlistView();

    return {
      shortlists
    };
  });

  app.get("/shortlists/:id", async (request, reply) => {
    if (!config.workflow.shortlistsEnabled) {
      throw featureDisabled("Shortlists");
    }

    const params = request.params as { id?: string };
    const shortlistId = params.id?.trim();

    if (!shortlistId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid shortlist id", [
          { field: "id", message: "id is required" }
        ])
      );
    }

    const shortlist = await persistence.searchRepository.getShortlist(shortlistId);
    if (!shortlist) {
      return reply.status(404).send(
        buildErrorPayload("SHORTLIST_NOT_FOUND", "No shortlist was found for this id.")
      );
    }

    metrics.recordShortlistView();
    return shortlist;
  });

  app.patch("/shortlists/:id", async (request, reply) => {
    if (!config.workflow.shortlistsEnabled) {
      throw featureDisabled("Shortlists");
    }

    ensureWriteCapable(reliability);
    const params = request.params as { id?: string };
    const shortlistId = params.id?.trim();
    const patch = shortlistUpdateSchema.parse(request.body);

    if (!shortlistId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid shortlist id", [
          { field: "id", message: "id is required" }
        ])
      );
    }

    const shortlist = await persistence.searchRepository.updateShortlist(shortlistId, patch);
    if (!shortlist) {
      return reply.status(404).send(
        buildErrorPayload("SHORTLIST_NOT_FOUND", "No shortlist was found for this id.")
      );
    }

    return shortlist;
  });

  app.delete("/shortlists/:id", async (request, reply) => {
    if (!config.workflow.shortlistsEnabled) {
      throw featureDisabled("Shortlists");
    }

    ensureWriteCapable(reliability);
    const params = request.params as { id?: string };
    const shortlistId = params.id?.trim();

    if (!shortlistId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid shortlist id", [
          { field: "id", message: "id is required" }
        ])
      );
    }

    const deleted = await persistence.searchRepository.deleteShortlist(shortlistId);
    if (!deleted) {
      return reply.status(404).send(
        buildErrorPayload("SHORTLIST_NOT_FOUND", "No shortlist was found for this id.")
      );
    }

    metrics.recordShortlistDelete();
    return reply.status(204).send();
  });

  app.post("/shortlists/:id/share", async (request, reply) => {
    if (
      !config.workflow.shortlistsEnabled ||
      !config.workflow.sharedShortlistsEnabled ||
      !config.security.publicSharedShortlistsEnabled
    ) {
      throw featureDisabled("Shared shortlists");
    }

    ensureWriteCapable(reliability);
    const pilotContext = await resolvePilotContext(persistence.searchRepository, request);
    const capabilities = getEffectiveCapabilities(config, pilotContext);
    if (!capabilities.canShareShortlists) {
      throw featureDisabledForPilot("Shared shortlists");
    }

    const params = request.params as { id?: string };
    const shortlistId = params.id?.trim();
    const payload = shortlistShareSchema.parse(request.body ?? {});

    if (!shortlistId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid shortlist id", [
          { field: "id", message: "id is required" }
        ])
      );
    }

    const shortlist = await persistence.searchRepository.getShortlist(shortlistId);
    if (!shortlist) {
      return reply.status(404).send(
        buildErrorPayload("SHORTLIST_NOT_FOUND", "No shortlist was found for this id.")
      );
    }

    const sessionId = extractSessionId(request, payload.sessionId ?? shortlist.sessionId ?? null);
    await enforceSessionCapabilityLimit({
      repository: persistence.searchRepository,
      metrics,
      config,
      pilotContext,
      sessionId,
      capabilityKey: "shareLinks",
      featureLabel: "shareLinks",
      currentCount: () => countSessionShareLinks(persistence.searchRepository, sessionId)
    });
    const share = await persistence.searchRepository.createSharedShortlist({
      shortlistId,
      sessionId,
      shareMode: payload.shareMode,
      expiresAt:
        payload.expiresInDays && payload.expiresInDays > 0
          ? addDaysToNowIso(payload.expiresInDays)
          : null
    });

    await recordValidationEventWithPilot(persistence.searchRepository, {
      eventName: "shortlist_shared",
      sessionId,
      payload: {
        shareId: share.shareId,
        shortlistId: share.shortlistId,
        shareMode: share.shareMode
      }
    }, pilotContext);
    await recordValidationEventWithPilot(
      persistence.searchRepository,
      {
        eventName: "share_feature_used",
        sessionId,
        payload: {
          feature: "shared_shortlist",
          shareId: share.shareId,
          shortlistId: share.shortlistId
        }
      },
      pilotContext
    );
    metrics.recordShortlistShareCreate();
    metrics.recordFeatureUsage("canShareShortlists");
    return reply.status(201).send({
      share,
      shareUrl: `${config.apiUrl.replace(/\/$/, "")}/shared/shortlists/${share.shareId}`,
      readOnly: share.shareMode === "read_only"
    });
  });

  app.get("/shortlists/:id/shares", async (request, reply) => {
    if (!config.workflow.shortlistsEnabled || !config.workflow.sharedShortlistsEnabled) {
      throw featureDisabled("Shared shortlists");
    }

    const params = request.params as { id?: string };
    const shortlistId = params.id?.trim();

    if (!shortlistId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid shortlist id", [
          { field: "id", message: "id is required" }
        ])
      );
    }

    const shares = await persistence.searchRepository.listSharedShortlists(shortlistId);
    return {
      shares
    };
  });

  app.post("/shortlists/shares/:shareId/revoke", async (request, reply) => {
    if (!config.workflow.shortlistsEnabled || !config.workflow.sharedShortlistsEnabled) {
      throw featureDisabled("Shared shortlists");
    }

    ensureWriteCapable(reliability);
    const params = request.params as { shareId?: string };
    const shareId = params.shareId?.trim();

    if (!shareId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid share id", [
          { field: "shareId", message: "shareId is required" }
        ])
      );
    }

    const share = await persistence.searchRepository.revokeSharedShortlist(shareId);
    if (!share) {
      return reply.status(404).send(
        buildErrorPayload("SHARED_SHORTLIST_NOT_FOUND", "No shared shortlist was found for this share id.")
      );
    }

    metrics.recordShortlistShareRevoke();
    return {
      share
    };
  });

  app.get("/shared/shortlists/:shareId", async (request, reply) => {
    if (
      !config.workflow.shortlistsEnabled ||
      !config.workflow.sharedShortlistsEnabled ||
      !config.security.publicSharedShortlistsEnabled
    ) {
      throw featureDisabled("Shared shortlists");
    }

    const pilotContext = await resolvePilotContext(persistence.searchRepository, request);
    if (!getEffectivePilotFeatures(config, pilotContext).sharedShortlistsEnabled) {
      throw featureDisabledForPilot("Shared shortlists");
    }

    const params = request.params as { shareId?: string };
    const shareId = params.shareId?.trim();

    if (!shareId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid share id", [
          { field: "shareId", message: "shareId is required" }
        ])
      );
    }

    if (shareId.length < config.security.shareLinkMinTokenLength) {
      metrics.recordInvalidTokenAccess();
      return reply.status(404).send(unavailableLinkPayload());
    }

    const sharedRateLimit = takeSharedOpenRateLimit(request.ip);
    if (!sharedRateLimit.allowed) {
      metrics.recordRateLimitTrigger("/shared/shortlists/:shareId");
      throw new ApiError(429, "RATE_LIMITED", "Shared shortlist rate limit exceeded.", [
        {
          field: "retryAfterMs",
          message: String(sharedRateLimit.retryAfterMs)
        }
      ]);
    }

    const sharedView = await persistence.searchRepository.getSharedShortlist(shareId);
    if (!sharedView) {
      metrics.recordInvalidTokenAccess();
      return reply.status(404).send(unavailableLinkPayload());
    }

    if (sharedView.share.status === "expired") {
      metrics.recordExpiredShareOpen();
      metrics.recordExpiredLinkOpenAttempt();
      return reply.status(410).send(unavailableLinkPayload());
    }

    if (sharedView.share.status === "revoked") {
      metrics.recordRevokedLinkOpenAttempt();
      metrics.recordShareRevocationEnforcement();
      return reply.status(410).send(unavailableLinkPayload());
    }

    metrics.recordShortlistShareOpen();
    await recordValidationEventWithPilot(persistence.searchRepository, {
      eventName: "shared_shortlist_opened",
      sessionId: sharedView.share.sessionId ?? null,
      payload: {
        shareId: sharedView.share.shareId,
        shortlistId: sharedView.shortlist.id
      }
    }, pilotContext);
    return toPublicSharedShortlistView(sharedView);
  });

  app.get("/shortlists/:id/items", async (request, reply) => {
    if (!config.workflow.shortlistsEnabled) {
      throw featureDisabled("Shortlists");
    }

    const params = request.params as { id?: string };
    const shortlistId = params.id?.trim();

    if (!shortlistId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid shortlist id", [
          { field: "id", message: "id is required" }
        ])
      );
    }

    const shortlist = await persistence.searchRepository.getShortlist(shortlistId);
    if (!shortlist) {
      return reply.status(404).send(
        buildErrorPayload("SHORTLIST_NOT_FOUND", "No shortlist was found for this id.")
      );
    }

    const items = await persistence.searchRepository.listShortlistItems(shortlistId);
    const offerReadiness = await persistence.searchRepository.listOfferReadiness(shortlistId);
    metrics.recordShortlistView();
    return {
      shortlist,
      items,
      offerReadiness
    };
  });

  app.post("/shortlists/:id/items", async (request, reply) => {
    if (!config.workflow.shortlistsEnabled) {
      throw featureDisabled("Shortlists");
    }

    ensureWriteCapable(reliability);
    const params = request.params as { id?: string };
    const shortlistId = params.id?.trim();
    const payload = shortlistItemCreateSchema.parse(request.body);

    if (!shortlistId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid shortlist id", [
          { field: "id", message: "id is required" }
        ])
      );
    }

    const item = await persistence.searchRepository.createShortlistItem(shortlistId, payload);
    if (!item) {
      return reply.status(404).send(
        buildErrorPayload("SHORTLIST_NOT_FOUND", "No shortlist was found for this id.")
      );
    }

    metrics.recordShortlistItemAdd();
    const shortlist = await persistence.searchRepository.getShortlist(shortlistId);
    const pilotContext = await resolvePilotContext(persistence.searchRepository, request);
    await recordValidationEventWithPilot(
      persistence.searchRepository,
      {
        eventName: "shortlist_feature_used",
        sessionId: shortlist?.sessionId ?? extractSessionId(request),
        snapshotId: item.sourceSnapshotId ?? null,
        historyRecordId: item.sourceHistoryId ?? null,
        searchDefinitionId: item.sourceSearchDefinitionId ?? null,
        payload: {
          feature: "shortlist_item_added",
          shortlistId,
          shortlistItemId: item.id
        }
      },
      pilotContext
    );
    metrics.recordFeatureUsage("shortlist_item");
    return reply.status(201).send(item);
  });

  app.patch("/shortlists/:id/items/:itemId", async (request, reply) => {
    if (!config.workflow.shortlistsEnabled) {
      throw featureDisabled("Shortlists");
    }

    ensureWriteCapable(reliability);
    const params = request.params as { id?: string; itemId?: string };
    const shortlistId = params.id?.trim();
    const itemId = params.itemId?.trim();
    const patch = shortlistItemUpdateSchema.parse(request.body);

    if (!shortlistId || !itemId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid shortlist item id", [
          { field: "id", message: "shortlist id and item id are required" }
        ])
      );
    }

    const item = await persistence.searchRepository.updateShortlistItem(shortlistId, itemId, patch);
    if (!item) {
      return reply.status(404).send(
        buildErrorPayload("SHORTLIST_ITEM_NOT_FOUND", "No shortlist item was found for this id.")
      );
    }

    metrics.recordReviewStateChange();
    return item;
  });

  app.delete("/shortlists/:id/items/:itemId", async (request, reply) => {
    if (!config.workflow.shortlistsEnabled) {
      throw featureDisabled("Shortlists");
    }

    ensureWriteCapable(reliability);
    const params = request.params as { id?: string; itemId?: string };
    const shortlistId = params.id?.trim();
    const itemId = params.itemId?.trim();

    if (!shortlistId || !itemId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid shortlist item id", [
          { field: "id", message: "shortlist id and item id are required" }
        ])
      );
    }

    const deleted = await persistence.searchRepository.deleteShortlistItem(shortlistId, itemId);
    if (!deleted) {
      return reply.status(404).send(
        buildErrorPayload("SHORTLIST_ITEM_NOT_FOUND", "No shortlist item was found for this id.")
      );
    }

    metrics.recordShortlistItemRemove();
    return reply.status(204).send();
  });

  app.post("/offer-readiness", async (request, reply) => {
    if (!config.workflow.shortlistsEnabled) {
      throw featureDisabled("Offer readiness");
    }

    ensureWriteCapable(reliability);
    const payload = offerReadinessCreateSchema.parse(request.body);
    const record = await persistence.searchRepository.createOfferReadiness(payload);
    if (!record) {
      return reply.status(404).send(
        buildErrorPayload(
          "SHORTLIST_ITEM_NOT_FOUND",
          "No shortlisted property was found for this property and shortlist."
        )
      );
    }

    const pilotContext = await resolvePilotContext(persistence.searchRepository, request);
    const shortlist = await persistence.searchRepository.getShortlist(payload.shortlistId);
    await recordValidationEventWithPilot(
      persistence.searchRepository,
      {
        eventName: "shortlist_feature_used",
        sessionId: shortlist?.sessionId ?? extractSessionId(request),
        payload: {
          feature: "offer_readiness_created",
          shortlistId: payload.shortlistId,
          propertyId: payload.propertyId,
          offerReadinessId: record.id
        }
      },
      pilotContext
    );
    metrics.recordFeatureUsage("offer_readiness");
    return reply.status(201).send(record);
  });

  app.get("/offer-readiness/:propertyId", async (request, reply) => {
    if (!config.workflow.shortlistsEnabled) {
      throw featureDisabled("Offer readiness");
    }

    const params = request.params as { propertyId?: string };
    const query = request.query as { shortlistId?: string } | undefined;
    const propertyId = params.propertyId?.trim();
    const shortlistId = query?.shortlistId?.trim();

    if (!propertyId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid property id", [
          { field: "propertyId", message: "propertyId is required" }
        ])
      );
    }

    const record = await persistence.searchRepository.getOfferReadiness(propertyId, shortlistId);
    if (!record) {
      return reply.status(404).send(
        buildErrorPayload("OFFER_READINESS_NOT_FOUND", "No offer readiness record was found for this property.")
      );
    }

    return record;
  });

  app.patch("/offer-readiness/:id", async (request, reply) => {
    if (!config.workflow.shortlistsEnabled) {
      throw featureDisabled("Offer readiness");
    }

    ensureWriteCapable(reliability);
    const params = request.params as { id?: string };
    const id = params.id?.trim();
    const patch = offerReadinessUpdateSchema.parse(request.body);

    if (!id) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid offer readiness id", [
          { field: "id", message: "id is required" }
        ])
      );
    }

    const record = await persistence.searchRepository.updateOfferReadiness(id, patch);
    if (!record) {
      return reply.status(404).send(
        buildErrorPayload("OFFER_READINESS_NOT_FOUND", "No offer readiness record was found for this id.")
      );
    }

    metrics.recordFeatureUsage("offer_readiness");
    return record;
  });

  app.get("/offer-readiness/:propertyId/recommendation", async (request, reply) => {
    if (!config.workflow.shortlistsEnabled) {
      throw featureDisabled("Offer readiness");
    }

    const params = request.params as { propertyId?: string };
    const query = request.query as { shortlistId?: string } | undefined;
    const propertyId = params.propertyId?.trim();
    const shortlistId = query?.shortlistId?.trim();

    if (!propertyId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid property id", [
          { field: "propertyId", message: "propertyId is required" }
        ])
      );
    }

    const recommendation = await persistence.searchRepository.getOfferReadinessRecommendation(
      propertyId,
      shortlistId
    );
    if (!recommendation) {
      return reply.status(404).send(
        buildErrorPayload(
          "OFFER_READINESS_NOT_FOUND",
          "No offer readiness recommendation was found for this property."
        )
      );
    }

    return recommendation;
  });

  app.post("/comments", async (request, reply) => {
    if (!config.workflow.sharedShortlistsEnabled || !config.workflow.sharedCommentsEnabled) {
      throw featureDisabled("Shared comments");
    }

    ensureWriteCapable(reliability);
    const pilotContext = await resolvePilotContext(persistence.searchRepository, request);
    if (!getEffectivePilotFeatures(config, pilotContext).shortlistCollaborationEnabled) {
      throw featureDisabledForPilot("Shared comments");
    }

    const rateLimit = takeCollaborationWriteRateLimit(request.ip);
    if (!rateLimit.allowed) {
      metrics.recordRateLimitTrigger("/comments");
      throw new ApiError(429, "RATE_LIMITED", "Comment rate limit exceeded.", [
        {
          field: "retryAfterMs",
          message: String(rateLimit.retryAfterMs)
        }
      ]);
    }

    const payload = sharedCommentCreateSchema.parse(request.body);
    enforceMaxLength("body", payload.body, config.security.maxCommentLength);
    const shared = await persistence.searchRepository.getSharedShortlist(payload.shareId);
    if (!shared) {
      metrics.recordInvalidTokenAccess();
      return reply.status(404).send(
        unavailableLinkPayload()
      );
    }
    if (shared.share.status !== "active") {
      metrics.recordShareRevocationEnforcement();
      return reply.status(410).send(
        buildErrorPayload(
          "SHARED_SHORTLIST_UNAVAILABLE",
          "This shared shortlist link is no longer available for collaboration."
        )
      );
    }
    if (!shareModeAllowsComments(shared.share.shareMode)) {
      return reply.status(403).send(
        buildErrorPayload(
          "COLLABORATION_FORBIDDEN",
          "This shared shortlist is read-only and does not accept comments."
        )
      );
    }

    const comment = await persistence.searchRepository.createSharedComment(payload);
    await recordValidationEventWithPilot(persistence.searchRepository, {
      eventName: "shared_comment_added",
      payload: {
        shareId: payload.shareId,
        entityId: payload.entityId,
        commentId: comment.id
      }
    }, pilotContext);
    metrics.recordSharedCommentCreate();
    return reply.status(201).send(comment);
  });

  app.get("/comments", async (request, reply) => {
    if (!config.workflow.sharedShortlistsEnabled || !config.workflow.sharedCommentsEnabled) {
      throw featureDisabled("Shared comments");
    }

    const query = request.query as Record<string, unknown> | undefined;
    const shareId = typeof query?.shareId === "string" ? query.shareId.trim() : "";
    if (!shareId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "shareId is required", [
          { field: "shareId", message: "shareId is required" }
        ])
      );
    }

    const comments = await persistence.searchRepository.listSharedComments({
      shareId,
      entityType:
        query?.entityType === "shared_shortlist_item" ? "shared_shortlist_item" : undefined,
      entityId: typeof query?.entityId === "string" ? query.entityId : undefined
    });

    return { comments };
  });

  app.patch("/comments/:id", async (request, reply) => {
    if (!config.workflow.sharedShortlistsEnabled || !config.workflow.sharedCommentsEnabled) {
      throw featureDisabled("Shared comments");
    }

    ensureWriteCapable(reliability);
    const params = request.params as { id?: string };
    const commentId = params.id?.trim();
    const payload = sharedCommentUpdateSchema.parse(request.body);

    if (!commentId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid comment id", [
          { field: "id", message: "id is required" }
        ])
      );
    }

    enforceMaxLength("body", payload.body, config.security.maxCommentLength);
    const existing = await persistence.searchRepository.getSharedComment(commentId);
    if (!existing) {
      return reply.status(404).send(
        buildErrorPayload("COMMENT_NOT_FOUND", "No shared comment was found for this id.")
      );
    }

    const shared = await persistence.searchRepository.getSharedShortlist(existing.shareId);
    if (!shared || shared.share.status !== "active") {
      metrics.recordShareRevocationEnforcement();
      return reply.status(410).send(
        buildErrorPayload(
          "SHARED_SHORTLIST_UNAVAILABLE",
          "This shared shortlist link is no longer available for collaboration."
        )
      );
    }
    if (!shareModeAllowsComments(shared.share.shareMode)) {
      return reply.status(403).send(
        buildErrorPayload(
          "COLLABORATION_FORBIDDEN",
          "This shared shortlist is read-only and does not accept comments."
        )
      );
    }

    const comment = await persistence.searchRepository.updateSharedComment(
      commentId,
      payload.body,
      payload.authorLabel
    );
    if (!comment) {
      return reply.status(404).send(
        buildErrorPayload("COMMENT_NOT_FOUND", "No shared comment was found for this id.")
      );
    }

    metrics.recordSharedCommentUpdate();
    return comment;
  });

  app.delete("/comments/:id", async (request, reply) => {
    if (!config.workflow.sharedShortlistsEnabled || !config.workflow.sharedCommentsEnabled) {
      throw featureDisabled("Shared comments");
    }

    ensureWriteCapable(reliability);
    const params = request.params as { id?: string };
    const commentId = params.id?.trim();
    if (!commentId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid comment id", [
          { field: "id", message: "id is required" }
        ])
      );
    }

    const existing = await persistence.searchRepository.getSharedComment(commentId);
    if (!existing) {
      return reply.status(404).send(
        buildErrorPayload("COMMENT_NOT_FOUND", "No shared comment was found for this id.")
      );
    }

    const shared = await persistence.searchRepository.getSharedShortlist(existing.shareId);
    if (!shared || shared.share.status !== "active") {
      metrics.recordShareRevocationEnforcement();
      return reply.status(410).send(
        buildErrorPayload(
          "SHARED_SHORTLIST_UNAVAILABLE",
          "This shared shortlist link is no longer available for collaboration."
        )
      );
    }
    if (!shareModeAllowsComments(shared.share.shareMode)) {
      return reply.status(403).send(
        buildErrorPayload(
          "COLLABORATION_FORBIDDEN",
          "This shared shortlist is read-only and does not accept comments."
        )
      );
    }

    const deleted = await persistence.searchRepository.deleteSharedComment(commentId);
    metrics.recordSharedCommentDelete();
    return reply.status(204).send();
  });

  app.post("/reviewer-decisions", async (request, reply) => {
    if (!config.workflow.sharedShortlistsEnabled || !config.workflow.reviewerDecisionsEnabled) {
      throw featureDisabled("Reviewer decisions");
    }

    ensureWriteCapable(reliability);
    const pilotContext = await resolvePilotContext(persistence.searchRepository, request);
    if (!getEffectivePilotFeatures(config, pilotContext).shortlistCollaborationEnabled) {
      throw featureDisabledForPilot("Reviewer decisions");
    }

    const rateLimit = takeCollaborationWriteRateLimit(request.ip);
    if (!rateLimit.allowed) {
      metrics.recordRateLimitTrigger("/reviewer-decisions");
      throw new ApiError(429, "RATE_LIMITED", "Reviewer decision rate limit exceeded.", [
        {
          field: "retryAfterMs",
          message: String(rateLimit.retryAfterMs)
        }
      ]);
    }

    const payload = reviewerDecisionCreateSchema.parse(request.body);
    const shared = await persistence.searchRepository.getSharedShortlist(payload.shareId);
    if (!shared) {
      metrics.recordInvalidTokenAccess();
      return reply.status(404).send(
        unavailableLinkPayload()
      );
    }
    if (shared.share.status !== "active") {
      metrics.recordShareRevocationEnforcement();
      return reply.status(410).send(
        buildErrorPayload(
          "SHARED_SHORTLIST_UNAVAILABLE",
          "This shared shortlist link is no longer available for review."
        )
      );
    }
    if (!shareModeAllowsReviewerDecision(shared.share.shareMode)) {
      return reply.status(403).send(
        buildErrorPayload(
          "COLLABORATION_FORBIDDEN",
          "This shared shortlist does not allow reviewer decisions."
        )
      );
    }

    const existing = await persistence.searchRepository.listReviewerDecisions({
      shareId: payload.shareId,
      shortlistItemId: payload.shortlistItemId
    });
    const decision = await persistence.searchRepository.createReviewerDecision(payload);
    if (existing.length > 0) {
      metrics.recordReviewerDecisionUpdate();
    } else {
      metrics.recordReviewerDecisionCreate();
    }
    await recordValidationEventWithPilot(persistence.searchRepository, {
      eventName: "reviewer_decision_submitted",
      payload: {
        shareId: payload.shareId,
        shortlistItemId: payload.shortlistItemId,
        decisionId: decision.id,
        decision: decision.decision
      }
    }, pilotContext);
    return reply.status(existing.length > 0 ? 200 : 201).send(decision);
  });

  app.get("/reviewer-decisions", async (request, reply) => {
    if (!config.workflow.sharedShortlistsEnabled || !config.workflow.reviewerDecisionsEnabled) {
      throw featureDisabled("Reviewer decisions");
    }

    const query = request.query as Record<string, unknown> | undefined;
    const shareId = typeof query?.shareId === "string" ? query.shareId.trim() : "";
    if (!shareId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "shareId is required", [
          { field: "shareId", message: "shareId is required" }
        ])
      );
    }

    const decisions = await persistence.searchRepository.listReviewerDecisions({
      shareId,
      shortlistItemId:
        typeof query?.shortlistItemId === "string" ? query.shortlistItemId : undefined
    });
    return { decisions };
  });

  app.patch("/reviewer-decisions/:id", async (request, reply) => {
    if (!config.workflow.sharedShortlistsEnabled || !config.workflow.reviewerDecisionsEnabled) {
      throw featureDisabled("Reviewer decisions");
    }

    ensureWriteCapable(reliability);
    const params = request.params as { id?: string };
    const decisionId = params.id?.trim();
    const patch = reviewerDecisionUpdateSchema.parse(request.body);

    if (!decisionId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid reviewer decision id", [
          { field: "id", message: "id is required" }
        ])
      );
    }

    enforceMaxLength("note", patch.note ?? undefined, 500);
    const existing = await persistence.searchRepository.getReviewerDecision(decisionId);
    if (!existing) {
      return reply.status(404).send(
        buildErrorPayload("REVIEWER_DECISION_NOT_FOUND", "No reviewer decision was found for this id.")
      );
    }

    const shared = await persistence.searchRepository.getSharedShortlist(existing.shareId);
    if (!shared || shared.share.status !== "active") {
      metrics.recordShareRevocationEnforcement();
      return reply.status(410).send(
        buildErrorPayload(
          "SHARED_SHORTLIST_UNAVAILABLE",
          "This shared shortlist link is no longer available for review."
        )
      );
    }
    if (!shareModeAllowsReviewerDecision(shared.share.shareMode)) {
      return reply.status(403).send(
        buildErrorPayload(
          "COLLABORATION_FORBIDDEN",
          "This shared shortlist does not allow reviewer decisions."
        )
      );
    }

    const decision = await persistence.searchRepository.updateReviewerDecision(decisionId, patch);
    metrics.recordReviewerDecisionUpdate();
    return decision;
  });

  app.delete("/reviewer-decisions/:id", async (request, reply) => {
    if (!config.workflow.sharedShortlistsEnabled || !config.workflow.reviewerDecisionsEnabled) {
      throw featureDisabled("Reviewer decisions");
    }

    ensureWriteCapable(reliability);
    const params = request.params as { id?: string };
    const decisionId = params.id?.trim();
    if (!decisionId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid reviewer decision id", [
          { field: "id", message: "id is required" }
        ])
      );
    }

    const existing = await persistence.searchRepository.getReviewerDecision(decisionId);
    if (!existing) {
      return reply.status(404).send(
        buildErrorPayload("REVIEWER_DECISION_NOT_FOUND", "No reviewer decision was found for this id.")
      );
    }

    const shared = await persistence.searchRepository.getSharedShortlist(existing.shareId);
    if (!shared || shared.share.status !== "active") {
      metrics.recordShareRevocationEnforcement();
      return reply.status(410).send(
        buildErrorPayload(
          "SHARED_SHORTLIST_UNAVAILABLE",
          "This shared shortlist link is no longer available for review."
        )
      );
    }
    if (!shareModeAllowsReviewerDecision(shared.share.shareMode)) {
      return reply.status(403).send(
        buildErrorPayload(
          "COLLABORATION_FORBIDDEN",
          "This shared shortlist does not allow reviewer decisions."
        )
      );
    }

    const deleted = await persistence.searchRepository.deleteReviewerDecision(decisionId);
    return reply.status(204).send();
  });

  app.post("/notes", async (request, reply) => {
    if (!config.workflow.resultNotesEnabled) {
      throw featureDisabled("Result notes");
    }

    ensureWriteCapable(reliability);
    const rateLimit = takeCollaborationWriteRateLimit(extractSessionId(request) ?? request.ip);
    if (!rateLimit.allowed) {
      metrics.recordRateLimitTrigger("/notes");
      throw new ApiError(429, "RATE_LIMITED", "Note rate limit exceeded.", [
        {
          field: "retryAfterMs",
          message: String(rateLimit.retryAfterMs)
        }
      ]);
    }

    const payload = resultNoteCreateSchema.parse(request.body);
    enforceMaxLength("body", payload.body, config.security.maxNoteLength);
    const note = await persistence.searchRepository.createResultNote({
      ...payload,
      sessionId: extractSessionId(request, payload.sessionId ?? null)
    });
    metrics.recordNoteCreate();
    return reply.status(201).send(note);
  });

  app.get("/notes", async (request) => {
    if (!config.workflow.resultNotesEnabled) {
      throw featureDisabled("Result notes");
    }

    const query = request.query as Record<string, unknown> | undefined;
    const notes = await persistence.searchRepository.listResultNotes({
      sessionId: extractSessionId(request),
      entityType:
        query?.entityType &&
        ["shortlist_item", "snapshot_result", "shared_snapshot_result"].includes(String(query.entityType))
          ? (String(query.entityType) as "shortlist_item" | "snapshot_result" | "shared_snapshot_result")
          : undefined,
      entityId: typeof query?.entityId === "string" ? query.entityId : undefined
    });

    return { notes };
  });

  app.patch("/notes/:id", async (request, reply) => {
    if (!config.workflow.resultNotesEnabled) {
      throw featureDisabled("Result notes");
    }

    ensureWriteCapable(reliability);
    const rateLimit = takeCollaborationWriteRateLimit(extractSessionId(request) ?? request.ip);
    if (!rateLimit.allowed) {
      metrics.recordRateLimitTrigger("/notes/:id");
      throw new ApiError(429, "RATE_LIMITED", "Note rate limit exceeded.", [
        {
          field: "retryAfterMs",
          message: String(rateLimit.retryAfterMs)
        }
      ]);
    }

    const params = request.params as { id?: string };
    const noteId = params.id?.trim();
    const payload = resultNoteUpdateSchema.parse(request.body);

    if (!noteId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid note id", [
          { field: "id", message: "id is required" }
        ])
      );
    }

    enforceMaxLength("body", payload.body, config.security.maxNoteLength);

    const note = await persistence.searchRepository.updateResultNote(noteId, payload.body);
    if (!note) {
      return reply.status(404).send(
        buildErrorPayload("NOTE_NOT_FOUND", "No note was found for this id.")
      );
    }

    metrics.recordNoteUpdate();
    return note;
  });

  app.delete("/notes/:id", async (request, reply) => {
    if (!config.workflow.resultNotesEnabled) {
      throw featureDisabled("Result notes");
    }

    ensureWriteCapable(reliability);
    const params = request.params as { id?: string };
    const noteId = params.id?.trim();

    if (!noteId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "Invalid note id", [
          { field: "id", message: "id is required" }
        ])
      );
    }

    const deleted = await persistence.searchRepository.deleteResultNote(noteId);
    if (!deleted) {
      return reply.status(404).send(
        buildErrorPayload("NOTE_NOT_FOUND", "No note was found for this id.")
      );
    }

    metrics.recordNoteDelete();
    return reply.status(204).send();
  });

  app.get("/workflow/activity", async (request) => {
    if (!config.workflow.shortlistsEnabled && !config.workflow.resultNotesEnabled) {
      throw featureDisabled("Workflow activity");
    }

    const query = request.query as Record<string, unknown> | undefined;
    const sessionId = extractSessionId(request);
    const effectiveLimit = parseLimit(
      query,
      config.performance.opsDefaultPageSize,
      config.performance.opsMaxPageSize
    );
    const activity = await persistence.searchRepository.listWorkflowActivity(sessionId, effectiveLimit);

    return {
      activity
    };
  });

  app.get("/collaboration/activity", async (request, reply) => {
    if (!config.workflow.sharedShortlistsEnabled) {
      throw featureDisabled("Collaboration activity");
    }

    const query = request.query as Record<string, unknown> | undefined;
    const shareId = typeof query?.shareId === "string" ? query.shareId : undefined;
    const shortlistId = typeof query?.shortlistId === "string" ? query.shortlistId : undefined;
    if (!shareId && !shortlistId) {
      return reply.status(400).send(
        buildErrorPayload("VALIDATION_ERROR", "shareId or shortlistId is required", [
          { field: "shareId", message: "Provide shareId or shortlistId" }
        ])
      );
    }

    const activity = await persistence.searchRepository.listCollaborationActivity({
      shareId,
      shortlistId,
      limit: parseLimit(query, config.performance.opsDefaultPageSize, config.performance.opsMaxPageSize)
    });
    metrics.recordCollaborationActivityRead();

    return {
      activity
    };
  });

  app.post("/search/definitions/:id/rerun", async (request, reply) => {
    ensureWriteCapable(reliability);
    const params = request.params as { id?: string };
    const definitionId = params.id?.trim();
    const payload = rerunRequestSchema.parse(request.body ?? {});

    if (!definitionId) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid definition id",
          details: [{ field: "id", message: "id is required" }]
        }
      });
    }

    const definition = await persistence.searchRepository.getSearchDefinition(definitionId);
    if (!definition) {
      return reply.status(404).send({
        error: {
          code: "SEARCH_DEFINITION_NOT_FOUND",
          message: "No saved search definition was found for this id.",
          details: []
        }
      });
    }

    const sessionId = extractSessionId(request, payload.sessionId ?? definition.sessionId);
    const pilotContext = await resolvePilotContext(persistence.searchRepository, request);
    const response = await runSearch(definition.request, {
      geocoder: providers.geocoder,
      listingProvider: providers.listings,
      marketSnapshotRepository: persistence.marketSnapshotRepository,
      metrics,
      repository: persistence.searchRepository,
      safetyProvider: providers.safety,
      getProviderFreshnessHours: () => providers.getFreshnessHours(),
      getProviderUsage: () => providers.getLastProviderUsage()
    }, {
      sessionId,
      partnerId: pilotContext?.partner.id ?? null,
      searchDefinitionId: definition.id,
      rerunSourceType: "definition",
      rerunSourceId: definition.id
    });
    reliability.noteProviderUsage(response.metadata.performance?.providerUsage);

    await persistence.searchRepository.updateSearchDefinition(definition.id, {
      lastRunAt: new Date().toISOString()
    });

    if (payload.createSnapshot) {
      const startedAt = Date.now();
      const snapshot = await persistence.searchRepository.createSearchSnapshot({
        request: definition.request,
        response,
        sessionId,
        searchDefinitionId: definition.id,
        historyRecordId: response.metadata.historyRecordId ?? null
      });
      response.metadata.rerunResultMetadata = {
        ...(response.metadata.rerunResultMetadata ?? {
          sourceType: "definition",
          sourceId: definition.id,
          executedAt: new Date().toISOString(),
          historyRecordId: response.metadata.historyRecordId ?? null,
          snapshotId: null,
          freshResult: true as const
        }),
        snapshotId: snapshot.id
      };
      metrics.recordSnapshotCreated();
      metrics.recordSnapshotWriteLatency(Date.now() - startedAt);
    }

    metrics.recordSearchRerun();
    if (config.validation.enabled) {
      await persistence.searchRepository.recordValidationEvent({
        eventName: "rerun_executed",
        sessionId,
        historyRecordId: response.metadata.historyRecordId ?? null,
        searchDefinitionId: definition.id,
        payload: {
          sourceType: "definition",
          sourceId: definition.id
        }
      });
    }
    return reply.status(200).send(response);
  });

  app.post("/search/history/:id/rerun", async (request, reply) => {
    ensureWriteCapable(reliability);
    const params = request.params as { id?: string };
    const historyId = params.id?.trim();
    const payload = rerunRequestSchema.parse(request.body ?? {});

    if (!historyId) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid history id",
          details: [{ field: "id", message: "id is required" }]
        }
      });
    }

    const historyRecord = await persistence.searchRepository.getSearchHistory(historyId);
    if (!historyRecord) {
      return reply.status(404).send({
        error: {
          code: "SEARCH_HISTORY_NOT_FOUND",
          message: "No stored search history record was found for this id.",
          details: []
        }
      });
    }

    const sessionId = extractSessionId(request, payload.sessionId ?? historyRecord.sessionId);
    const pilotContext = await resolvePilotContext(persistence.searchRepository, request);
    const response = await runSearch(historyRecord.request, {
      geocoder: providers.geocoder,
      listingProvider: providers.listings,
      marketSnapshotRepository: persistence.marketSnapshotRepository,
      metrics,
      repository: persistence.searchRepository,
      safetyProvider: providers.safety,
      getProviderFreshnessHours: () => providers.getFreshnessHours(),
      getProviderUsage: () => providers.getLastProviderUsage()
    }, {
      sessionId,
      partnerId: pilotContext?.partner.id ?? null,
      searchDefinitionId: historyRecord.searchDefinitionId ?? null,
      rerunSourceType: "history",
      rerunSourceId: historyRecord.id
    });
    reliability.noteProviderUsage(response.metadata.performance?.providerUsage);

    if (payload.createSnapshot) {
      const startedAt = Date.now();
      const snapshot = await persistence.searchRepository.createSearchSnapshot({
        request: historyRecord.request,
        response,
        sessionId,
        searchDefinitionId: historyRecord.searchDefinitionId ?? null,
        historyRecordId: response.metadata.historyRecordId ?? null
      });
      response.metadata.rerunResultMetadata = {
        ...(response.metadata.rerunResultMetadata ?? {
          sourceType: "history",
          sourceId: historyRecord.id,
          executedAt: new Date().toISOString(),
          historyRecordId: response.metadata.historyRecordId ?? null,
          snapshotId: null,
          freshResult: true as const
        }),
        snapshotId: snapshot.id
      };
      metrics.recordSnapshotCreated();
      metrics.recordSnapshotWriteLatency(Date.now() - startedAt);
    }

    metrics.recordSearchRerun();
    if (config.validation.enabled) {
      await persistence.searchRepository.recordValidationEvent({
        eventName: "rerun_executed",
        sessionId,
        historyRecordId: response.metadata.historyRecordId ?? null,
        searchDefinitionId: historyRecord.searchDefinitionId ?? null,
        payload: {
          sourceType: "history",
          sourceId: historyRecord.id
        }
      });
    }
    return reply.status(200).send(response);
  });

  app.get("/", async () => ({
    name: "Nhalo API",
    version: "0.1.0"
  }));

  return app;
}
