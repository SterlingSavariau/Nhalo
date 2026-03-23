export type LocationType = "city" | "zip";

export type PropertyType =
  | "single_family"
  | "condo"
  | "townhome"
  | "multi_family";

export type SafetyConfidence = "low" | "medium" | "high" | "none";
export type ProviderHealthStatus = "healthy" | "degraded" | "failing";

export interface SearchWeights {
  price: number;
  size: number;
  safety: number;
}

export interface SearchBudget {
  min?: number;
  max?: number;
}

export interface SearchRequest {
  locationType: LocationType;
  locationValue: string;
  radiusMiles?: number;
  budget?: SearchBudget;
  minSqft?: number;
  minBedrooms?: number;
  propertyTypes?: PropertyType[];
  preferences?: string[];
  weights?: SearchWeights;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ResolvedLocation {
  locationType: LocationType;
  locationValue: string;
  center: Coordinates;
  city?: string;
  state?: string;
  postalCode?: string;
}

export interface ListingRecord {
  id: string;
  provider: string;
  sourceUrl?: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  coordinates: Coordinates;
  propertyType: PropertyType;
  price: number;
  sqft: number;
  bedrooms: number;
  bathrooms: number;
  lotSqft?: number | null;
  createdAt: string;
  updatedAt: string;
  rawPayload?: Record<string, unknown>;
}

export interface SafetyRecord {
  propertyId: string;
  crimeIndex?: number | null;
  schoolRating?: number | null;
  stabilityIndex?: number | null;
  emergencyResponseMinutes?: number | null;
  source: string;
  updatedAt: string;
}

export interface ProviderFetchResult<T> {
  data: T;
  fromCache: boolean;
  degraded: boolean;
  error?: string;
}

export interface ListingSearchContext {
  center: Coordinates;
  radiusMiles: number;
  location: ResolvedLocation;
  propertyTypes?: PropertyType[];
}

export interface ListingProvider {
  readonly name: string;
  fetchListings(context: ListingSearchContext): Promise<ListingRecord[]>;
  getStatus(): Promise<ProviderStatus>;
}

export interface SafetyProvider {
  readonly name: string;
  fetchSafetyData(listings: ListingRecord[]): Promise<Map<string, SafetyRecord>>;
  getStatus(): Promise<ProviderStatus>;
}

export interface GeocoderProvider {
  readonly name: string;
  geocode(locationType: LocationType, locationValue: string): Promise<ResolvedLocation | null>;
  getStatus(): Promise<ProviderStatus>;
}

export interface ProviderStatus {
  provider: string;
  providerName: string;
  status: ProviderHealthStatus;
  lastUpdatedAt: string | null;
  dataAgeHours: number | null;
  latencyMs: number | null;
  failureCount: number;
  mode: "mock" | "live";
  detail: string;
}

export interface AppliedFilters {
  locationType: LocationType;
  locationValue: string;
  radiusMiles: number;
  budget?: SearchBudget;
  minSqft?: number;
  minBedrooms?: number;
  propertyTypes: PropertyType[];
  preferences: string[];
}

export interface ScoreBreakdown {
  price: number;
  size: number;
  safety: number;
  nhalo: number;
  safetyConfidence: SafetyConfidence;
  overallConfidence: SafetyConfidence;
  formulaVersion: string;
}

export interface ScoredHome {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  propertyType: PropertyType;
  price: number;
  sqft: number;
  bedrooms: number;
  bathrooms: number;
  lotSqft?: number | null;
  sourceUrl?: string;
  neighborhoodSafetyScore: number;
  explanation: string;
  scores: ScoreBreakdown;
}

export interface SearchWarning {
  code: string;
  message: string;
}

export interface SearchSuggestion {
  code: string;
  message: string;
}

export interface SearchMetadata {
  totalCandidatesScanned: number;
  totalMatched: number;
  returnedCount: number;
  durationMs: number;
  warnings: SearchWarning[];
  suggestions: SearchSuggestion[];
}

export interface SearchResponse {
  homes: ScoredHome[];
  appliedFilters: AppliedFilters;
  appliedWeights: SearchWeights;
  metadata: SearchMetadata;
}

export interface PersistedSearchResult {
  propertyId: string;
  formulaVersion: string;
  explanation: string;
  scores: ScoreBreakdown;
  scoreInputs: Record<string, unknown>;
  weights: SearchWeights;
  computedAt: string;
  pricePerSqft: number;
  medianPricePerSqft: number;
  crimeIndex: number | null;
  schoolRating: number | null;
  neighborhoodStability: number | null;
  dataCompleteness: number;
  inputs: ScoreAuditInputs;
}

export interface SearchPersistenceInput {
  request: SearchRequest;
  response: SearchResponse;
  resolvedLocation: ResolvedLocation;
  scoredResults: PersistedSearchResult[];
  listings: ListingRecord[];
  marketSnapshot: MarketSnapshot;
}

export interface SearchRepository {
  saveSearch(payload: SearchPersistenceInput): Promise<void>;
  getScoreAudit(propertyId: string): Promise<ScoreAuditRecord | null>;
}

export interface RankingContext {
  weights: SearchWeights;
  minSqft?: number;
  minBedrooms?: number;
  budget?: SearchBudget;
  comparableListings: ListingRecord[];
  safetyByPropertyId: Map<string, SafetyRecord>;
  marketSnapshot: MarketSnapshot;
  providerFreshnessHours: {
    listings: number | null;
    safety: number | null;
  };
}

export interface RankedListing {
  listing: ListingRecord;
  explanation: string;
  scoreInputs: Record<string, unknown>;
  scores: ScoreBreakdown;
}

export interface MarketSnapshot {
  id: string;
  location: string;
  radiusMiles: number;
  medianPricePerSqft: number;
  sampleSize: number;
  createdAt: string;
}

export interface MarketSnapshotRepository {
  createSnapshot(snapshot: Omit<MarketSnapshot, "id">): Promise<MarketSnapshot>;
  getLatestSnapshot(location: string, radiusMiles: number): Promise<MarketSnapshot | null>;
  isSnapshotFresh(snapshot: MarketSnapshot, maxAgeHours?: number): boolean;
}

export interface ScoreAuditInputs {
  price: number;
  squareFootage: number;
  bedrooms: number;
  bathrooms: number;
  lotSize: number | null;
  crimeIndex: number | null;
  schoolRating: number | null;
  neighborhoodStability: number | null;
  pricePerSqft: number;
  medianPricePerSqft: number;
  dataCompleteness: number;
}

export interface ScoreAuditRecord {
  propertyId: string;
  formulaVersion: string;
  inputs: ScoreAuditInputs;
  weights: SearchWeights;
  subScores: {
    price: number;
    size: number;
    safety: number;
  };
  finalScore: number;
  computedAt: string;
  safetyConfidence: SafetyConfidence;
  overallConfidence: SafetyConfidence;
}

export interface SearchMetrics {
  searchLatencyMs: {
    count: number;
    average: number;
    last: number | null;
  };
  candidatesScanned: {
    total: number;
    average: number;
    last: number | null;
  };
  matchesReturned: {
    total: number;
    average: number;
    last: number | null;
  };
  providerLatencyMs: Record<string, {
    count: number;
    average: number;
    last: number | null;
  }>;
  providerFailureRate: Record<string, {
    requests: number;
    failures: number;
    rate: number;
  }>;
  scoreDistribution: {
    count: number;
    average: number;
    min: number | null;
    max: number | null;
  };
}
