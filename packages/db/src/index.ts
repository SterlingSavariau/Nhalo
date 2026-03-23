import {
  DEFAULT_LISTING_CACHE_TTL_HOURS,
  DEFAULT_LISTING_STALE_TTL_HOURS,
  DEFAULT_SAFETY_CACHE_TTL_HOURS,
  DEFAULT_SAFETY_STALE_TTL_HOURS,
  MARKET_SNAPSHOT_FRESH_HOURS
} from "@nhalo/config";
import type {
  ListingCacheRecord,
  ListingCacheRepository,
  ListingRecord,
  MarketSnapshot,
  MarketSnapshotRepository,
  SafetySignalCacheRecord,
  SafetySignalCacheRepository,
  ScoreAuditRecord,
  SearchPersistenceInput,
  SearchRepository
} from "@nhalo/types";

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function ageHours(timestamp: string): number {
  return (Date.now() - new Date(timestamp).getTime()) / 3_600_000;
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
};

function toAuditRecord(snapshot: StoredSnapshot): ScoreAuditRecord {
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
    listingProvenance: snapshot.listingProvenance
  };
}

export class InMemorySearchRepository implements SearchRepository {
  public readonly searches: SearchPersistenceInput[] = [];
  public readonly scoreSnapshots: StoredSnapshot[] = [];

  async saveSearch(payload: SearchPersistenceInput): Promise<void> {
    this.searches.push(payload);

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
        scoreInputs: result.scoreInputs,
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
        }
      });
    }
  }

  async getScoreAudit(propertyId: string): Promise<ScoreAuditRecord | null> {
    const snapshot = [...this.scoreSnapshots]
      .filter((entry) => entry.propertyId === propertyId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

    return snapshot ? toAuditRecord(snapshot) : null;
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

type PrismaClientLike = {
  property: {
    upsert(args: Record<string, unknown>): Promise<unknown>;
  };
  searchRequest: {
    create(args: Record<string, unknown>): Promise<{ id: string }>;
  };
  scoreSnapshot: {
    createMany(args: Record<string, unknown>): Promise<unknown>;
    findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
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
};

function mapPrismaAuditRecord(record: Record<string, unknown>): ScoreAuditRecord {
  const weights = ((record.searchRequest as { weights?: ScoreAuditRecord["weights"] }).weights ??
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
    }
  };
}

export class PrismaSearchRepository implements SearchRepository {
  constructor(private readonly client: PrismaClientLike) {}

  async saveSearch(payload: SearchPersistenceInput): Promise<void> {
    await Promise.all(payload.listings.map((listing) => this.upsertProperty(listing)));

    const createdSearch = await this.client.searchRequest.create({
      data: {
        locationType: payload.request.locationType,
        locationValue: payload.request.locationValue,
        resolvedCity: payload.resolvedLocation.city,
        resolvedState: payload.resolvedLocation.state,
        resolvedPostalCode: payload.resolvedLocation.postalCode,
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
          scoreInputs: {
            ...result.inputs,
            ...result.scoreInputs
          },
          createdAt: new Date(result.computedAt)
        }))
      });
    }
  }

  async getScoreAudit(propertyId: string): Promise<ScoreAuditRecord | null> {
    const record = await this.client.scoreSnapshot.findFirst({
      where: {
        propertyId
      },
      include: {
        searchRequest: {
          select: {
            weights: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return record ? mapPrismaAuditRecord(record) : null;
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

export interface PersistenceLayer {
  searchRepository: SearchRepository;
  marketSnapshotRepository: MarketSnapshotRepository;
  safetySignalCacheRepository: SafetySignalCacheRepository;
  listingCacheRepository: ListingCacheRepository;
}

export async function createPersistenceLayer(databaseUrl?: string): Promise<PersistenceLayer> {
  if (!databaseUrl) {
    return {
      searchRepository: new InMemorySearchRepository(),
      marketSnapshotRepository: new InMemoryMarketSnapshotRepository(),
      safetySignalCacheRepository: new InMemorySafetySignalCacheRepository(),
      listingCacheRepository: new InMemoryListingCacheRepository()
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
      listingCacheRepository: new PrismaListingCacheRepository(client)
    };
  } catch {
    return {
      searchRepository: new InMemorySearchRepository(),
      marketSnapshotRepository: new InMemoryMarketSnapshotRepository(),
      safetySignalCacheRepository: new InMemorySafetySignalCacheRepository(),
      listingCacheRepository: new InMemoryListingCacheRepository()
    };
  }
}

export async function createSearchRepository(databaseUrl?: string): Promise<SearchRepository> {
  const persistenceLayer = await createPersistenceLayer(databaseUrl);

  return persistenceLayer.searchRepository;
}
