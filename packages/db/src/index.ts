import { MARKET_SNAPSHOT_FRESH_HOURS } from "@nhalo/config";
import type {
  ListingRecord,
  MarketSnapshot,
  MarketSnapshotRepository,
  ScoreAuditRecord,
  SearchPersistenceInput,
  SearchRepository
} from "@nhalo/types";

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
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
    overallConfidence: snapshot.overallConfidence
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
        createdAt: result.computedAt
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
    const ageHours = (Date.now() - new Date(snapshot.createdAt).getTime()) / 3_600_000;

    return ageHours <= maxAgeHours;
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
};

function mapPrismaAuditRecord(record: Record<string, unknown>): ScoreAuditRecord {
  const weights = ((record.searchRequest as { weights?: ScoreAuditRecord["weights"] }).weights ??
    {
      price: 40,
      size: 30,
      safety: 30
    }) as ScoreAuditRecord["weights"];

  return {
    propertyId: record.propertyId as string,
    formulaVersion: record.formulaVersion as string,
    inputs: {
      price: Number(record.scoreInputs ? ((record.scoreInputs as { price?: number }).price ?? 0) : 0),
      squareFootage: Number(
        record.scoreInputs ? ((record.scoreInputs as { squareFootage?: number }).squareFootage ?? 0) : 0
      ),
      bedrooms: Number(record.scoreInputs ? ((record.scoreInputs as { bedrooms?: number }).bedrooms ?? 0) : 0),
      bathrooms: Number(record.scoreInputs ? ((record.scoreInputs as { bathrooms?: number }).bathrooms ?? 0) : 0),
      lotSize: (record.scoreInputs as { lotSize?: number | null } | undefined)?.lotSize ?? null,
      crimeIndex: (record.crimeIndex as number | null) ?? null,
      schoolRating: (record.schoolRating as number | null) ?? null,
      neighborhoodStability: (record.neighborhoodStability as number | null) ?? null,
      pricePerSqft: Number(record.pricePerSqft ?? 0),
      medianPricePerSqft: Number(record.medianPricePerSqft ?? 0),
      dataCompleteness: Number(record.dataCompleteness ?? 0)
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
    overallConfidence: record.overallConfidence as ScoreAuditRecord["overallConfidence"]
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
        provider: listing.provider,
        sourceUrl: listing.sourceUrl,
        address: listing.address,
        city: listing.city,
        state: listing.state,
        zipCode: listing.zipCode,
        latitude: listing.coordinates.lat,
        longitude: listing.coordinates.lng,
        propertyType: listing.propertyType,
        price: Math.round(listing.price),
        sqft: Math.round(listing.sqft),
        bedrooms: Math.round(listing.bedrooms),
        bathrooms: listing.bathrooms,
        lotSqft: listing.lotSqft ?? null,
        rawPayload: listing.rawPayload,
        createdAt: new Date(listing.createdAt),
        updatedAt: new Date(listing.updatedAt)
      },
      update: {
        provider: listing.provider,
        sourceUrl: listing.sourceUrl,
        address: listing.address,
        city: listing.city,
        state: listing.state,
        zipCode: listing.zipCode,
        latitude: listing.coordinates.lat,
        longitude: listing.coordinates.lng,
        propertyType: listing.propertyType,
        price: Math.round(listing.price),
        sqft: Math.round(listing.sqft),
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
    const ageHours = (Date.now() - new Date(snapshot.createdAt).getTime()) / 3_600_000;

    return ageHours <= maxAgeHours;
  }
}

export interface PersistenceLayer {
  searchRepository: SearchRepository;
  marketSnapshotRepository: MarketSnapshotRepository;
}

export async function createPersistenceLayer(databaseUrl?: string): Promise<PersistenceLayer> {
  if (!databaseUrl) {
    return {
      searchRepository: new InMemorySearchRepository(),
      marketSnapshotRepository: new InMemoryMarketSnapshotRepository()
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
      marketSnapshotRepository: new PrismaMarketSnapshotRepository(client)
    };
  } catch {
    return {
      searchRepository: new InMemorySearchRepository(),
      marketSnapshotRepository: new InMemoryMarketSnapshotRepository()
    };
  }
}

export async function createSearchRepository(databaseUrl?: string): Promise<SearchRepository> {
  const persistenceLayer = await createPersistenceLayer(databaseUrl);

  return persistenceLayer.searchRepository;
}
