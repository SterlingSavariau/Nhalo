import {
  DEFAULT_GEOCODE_CACHE_TTL_HOURS,
  DEFAULT_GEOCODE_STALE_TTL_HOURS,
  DEFAULT_LISTING_CACHE_TTL_HOURS,
  DEFAULT_LISTING_STALE_TTL_HOURS,
  DEFAULT_SAFETY_CACHE_TTL_HOURS,
  DEFAULT_SAFETY_STALE_TTL_HOURS,
  MARKET_SNAPSHOT_FRESH_HOURS
} from "@nhalo/config";
import type {
  CollaborationActivityRecord,
  CollaborationRole,
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
  ScoreAuditRecord,
  ReviewState,
  SearchSnapshotRecord,
  SearchPersistenceInput,
  SearchRepository,
  SharedSnapshotRecord,
  SharedSnapshotView,
  ValidationEventRecord,
  ValidationSummary,
  WorkflowActivityRecord
} from "@nhalo/types";

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
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

function toAuditRecord(snapshot: StoredSnapshot): ScoreAuditRecord {
  const explainability =
    (snapshot.scoreInputs.explainability as ScoreAuditRecord["explainability"] | undefined) ??
    undefined;
  const strengths = (snapshot.scoreInputs.strengths as string[] | undefined) ?? [];
  const risks = (snapshot.scoreInputs.risks as string[] | undefined) ?? [];
  const confidenceReasons =
    (snapshot.scoreInputs.confidenceReasons as string[] | undefined) ?? [];

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
  public readonly feedbackRecords: StoredFeedback[] = [];
  public readonly validationEvents: StoredValidationEvent[] = [];

  async saveSearch(payload: SearchPersistenceInput): Promise<{ historyRecordId: string | null }> {
    const historyRecordId = createId("history");
    this.searches.push({
      id: historyRecordId,
      payload: clone(payload),
      createdAt: new Date().toISOString()
    });

    for (const result of payload.scoredResults) {
      this.scoreSnapshots.push({
        searchRequestId: createId("search"),
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
          confidenceReasons: result.confidenceReasons ?? []
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

    return { historyRecordId };
  }

  async getScoreAudit(propertyId: string): Promise<ScoreAuditRecord | null> {
    const snapshot = [...this.scoreSnapshots]
      .filter((entry) => entry.propertyId === propertyId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

    return snapshot ? toAuditRecord(snapshot) : null;
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
      shareId: createId("public"),
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
      shareId: createId("shortlist-share"),
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

function mapPrismaAuditRecord(record: Record<string, unknown>): ScoreAuditRecord {
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
            confidenceReasons: result.confidenceReasons ?? []
          },
          createdAt: new Date(result.computedAt)
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

    return record ? mapPrismaAuditRecord(record) : null;
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
        shareId: createId("public"),
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
        shareId: createId("shortlist-share"),
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
