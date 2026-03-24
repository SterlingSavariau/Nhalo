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
  GeocodeCacheRecord,
  GeocodeCacheRepository,
  ListingCacheRecord,
  ListingCacheRepository,
  ListingRecord,
  MarketSnapshot,
  MarketSnapshotRepository,
  SafetySignalCacheRecord,
  SafetySignalCacheRepository,
  SearchDefinition,
  SearchHistoryRecord,
  ScoreAuditRecord,
  SearchSnapshotRecord,
  SearchPersistenceInput,
  SearchRepository
} from "@nhalo/types";

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function ageHours(timestamp: string): number {
  return (Date.now() - new Date(timestamp).getTime()) / 3_600_000;
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
  snapshotId: string | null
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
    createdAt
  };
}

function mapStoredDefinition(definition: SearchDefinition): SearchDefinition {
  return clone(definition);
}

export class InMemorySearchRepository implements SearchRepository {
  public readonly searches: StoredSearch[] = [];
  public readonly scoreSnapshots: StoredSnapshot[] = [];
  public readonly searchSnapshots: SearchSnapshotRecord[] = [];
  public readonly searchDefinitions: SearchDefinition[] = [];

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
      createdAt: new Date().toISOString()
    };

    this.searchSnapshots.push(snapshot);

    return clone(snapshot);
  }

  async getSearchSnapshot(id: string): Promise<SearchSnapshotRecord | null> {
    const snapshot = this.searchSnapshots.find((entry) => entry.id === id) ?? null;

    return snapshot ? clone(snapshot) : null;
  }

  async listSearchSnapshots(sessionId?: string | null, limit = 10): Promise<SearchSnapshotRecord[]> {
    if (!sessionId) {
      return [];
    }

    return this.searchSnapshots
      .filter((snapshot) => snapshot.sessionId === sessionId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit)
      .map((snapshot) => clone(snapshot));
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
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]?.id ?? null
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

    return buildHistoryRecord(entry.id, entry.payload, entry.createdAt, snapshotId);
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
  property: {
    upsert(args: Record<string, unknown>): Promise<unknown>;
  };
  searchRequest: {
    create(args: Record<string, unknown>): Promise<{ id: string }>;
    findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
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
  };
  searchDefinition: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    delete(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  marketSnapshot: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  };
  safetySignalCache: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  };
  listingCache: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  };
  geocodeCache: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
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

function mapPrismaSearchSnapshot(record: Record<string, unknown>): SearchSnapshotRecord {
  return {
    id: record.id as string,
    formulaVersion: (record.formulaVersion as string | null) ?? null,
    request: clone(record.requestPayload as SearchSnapshotRecord["request"]),
    response: clone(record.responsePayload as SearchSnapshotRecord["response"]),
    sessionId: (record.sessionId as string | null) ?? null,
    searchDefinitionId: (record.searchDefinitionId as string | null) ?? null,
    historyRecordId: (record.historyRecordId as string | null) ?? null,
    createdAt: (record.createdAt as Date).toISOString()
  };
}

function mapPrismaSearchHistoryRecord(
  record: Record<string, unknown>,
  snapshotId: string | null
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

    return mapPrismaSearchSnapshot(record);
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

    return records.map((record) => mapPrismaSearchSnapshot(record));
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

    return records.map((record) =>
      mapPrismaSearchHistoryRecord(record, snapshotByHistoryId.get(record.id as string) ?? null)
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

    return mapPrismaSearchHistoryRecord(record, (snapshot?.id as string | undefined) ?? null);
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
  searchRepository: SearchRepository;
  marketSnapshotRepository: MarketSnapshotRepository;
  safetySignalCacheRepository: SafetySignalCacheRepository;
  listingCacheRepository: ListingCacheRepository;
  geocodeCacheRepository: GeocodeCacheRepository;
}

export async function createPersistenceLayer(databaseUrl?: string): Promise<PersistenceLayer> {
  if (!databaseUrl) {
    return {
      searchRepository: new InMemorySearchRepository(),
      marketSnapshotRepository: new InMemoryMarketSnapshotRepository(),
      safetySignalCacheRepository: new InMemorySafetySignalCacheRepository(),
      listingCacheRepository: new InMemoryListingCacheRepository(),
      geocodeCacheRepository: new InMemoryGeocodeCacheRepository()
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

    return {
      searchRepository: new PrismaSearchRepository(client),
      marketSnapshotRepository: new PrismaMarketSnapshotRepository(client),
      safetySignalCacheRepository: new PrismaSafetySignalCacheRepository(client),
      listingCacheRepository: new PrismaListingCacheRepository(client),
      geocodeCacheRepository: new PrismaGeocodeCacheRepository(client)
    };
  } catch {
    return {
      searchRepository: new InMemorySearchRepository(),
      marketSnapshotRepository: new InMemoryMarketSnapshotRepository(),
      safetySignalCacheRepository: new InMemorySafetySignalCacheRepository(),
      listingCacheRepository: new InMemoryListingCacheRepository(),
      geocodeCacheRepository: new InMemoryGeocodeCacheRepository()
    };
  }
}

export async function createSearchRepository(databaseUrl?: string): Promise<SearchRepository> {
  const persistenceLayer = await createPersistenceLayer(databaseUrl);

  return persistenceLayer.searchRepository;
}
