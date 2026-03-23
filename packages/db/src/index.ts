import type {
  ListingRecord,
  SearchPersistenceInput,
  SearchRepository
} from "@nhalo/types";

class InMemorySearchRepository implements SearchRepository {
  public readonly searches: SearchPersistenceInput[] = [];

  async saveSearch(payload: SearchPersistenceInput): Promise<void> {
    this.searches.push(payload);
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
  };
};

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
          scoreInputs: result.scoreInputs
        }))
      });
    }
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

export async function createSearchRepository(
  databaseUrl?: string
): Promise<SearchRepository> {
  if (!databaseUrl) {
    return new InMemorySearchRepository();
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

    return new PrismaSearchRepository(client);
  } catch {
    return new InMemorySearchRepository();
  }
}

export { InMemorySearchRepository };
