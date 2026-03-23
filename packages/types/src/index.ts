export type LocationType = "city" | "zip";

export type PropertyType =
  | "single_family"
  | "condo"
  | "townhome"
  | "multi_family";

export type SafetyConfidence = "low" | "medium" | "high" | "none";
export type ProviderHealthStatus = "healthy" | "degraded" | "failing" | "unavailable";
export type SafetyDataSource =
  | "live"
  | "cached_live"
  | "stale_cached_live"
  | "mock"
  | "none";
export type SafetyProviderMode = "mock" | "hybrid" | "live";

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
  safetyDataSource?: SafetyDataSource;
  crimeProvider?: string | null;
  schoolProvider?: string | null;
  crimeFetchedAt?: string | null;
  schoolFetchedAt?: string | null;
  crimeIndexRaw?: Record<string, unknown> | number | null;
  crimeIndexNormalized?: number | null;
  schoolRatingRaw?: Record<string, unknown> | number | null;
  schoolRatingNormalized?: number | null;
  rawSafetyInputs?: Record<string, unknown> | null;
  normalizedSafetyInputs?: Record<string, unknown> | null;
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

export interface CrimeSignal {
  propertyId: string;
  provider: string;
  fetchedAt: string;
  raw: Record<string, unknown> | number | null;
  normalized: number | null;
}

export interface SchoolSignal {
  propertyId: string;
  provider: string;
  fetchedAt: string;
  raw: Record<string, unknown> | number | null;
  normalized: number | null;
}

export interface CrimeSignalProvider {
  readonly name: string;
  fetchCrimeSignal(listing: ListingRecord): Promise<CrimeSignal | null>;
  getStatus(): Promise<ProviderStatus>;
}

export interface SchoolSignalProvider {
  readonly name: string;
  fetchSchoolSignal(listing: ListingRecord): Promise<SchoolSignal | null>;
  getStatus(): Promise<ProviderStatus>;
}

export interface SafetyAggregationProvider {
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
  children?: ProviderStatus[];
  lastSourceUsed?: SafetyDataSource | null;
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
  safetyDataSource: SafetyDataSource;
  crimeProvider: string | null;
  schoolProvider: string | null;
  crimeFetchedAt: string | null;
  schoolFetchedAt: string | null;
  rawSafetyInputs: Record<string, unknown> | null;
  normalizedSafetyInputs: Record<string, unknown> | null;
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
  schoolRatingRaw?: Record<string, unknown> | number | null;
  schoolRatingNormalized?: number | null;
  schoolProvider?: string | null;
  schoolFetchedAt?: string | null;
  crimeIndexRaw?: Record<string, unknown> | number | null;
  crimeIndexNormalized?: number | null;
  crimeProvider?: string | null;
  crimeFetchedAt?: string | null;
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
  safetyProvenance?: {
    safetyDataSource: SafetyDataSource;
    crimeProvider: string | null;
    schoolProvider: string | null;
    crimeFetchedAt: string | null;
    schoolFetchedAt: string | null;
    rawSafetyInputs: Record<string, unknown> | null;
    normalizedSafetyInputs: Record<string, unknown> | null;
  };
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
  crimeProviderLatencyMs: {
    count: number;
    average: number;
    last: number | null;
  };
  schoolProviderLatencyMs: {
    count: number;
    average: number;
    last: number | null;
  };
  crimeProviderFailureRate: {
    requests: number;
    failures: number;
    rate: number;
  };
  schoolProviderFailureRate: {
    requests: number;
    failures: number;
    rate: number;
  };
  safetyCacheHitRate: {
    hits: number;
    misses: number;
    rate: number;
  };
  safetyLiveFetchRate: {
    liveFetches: number;
    totalResolutions: number;
    rate: number;
  };
  safetyFallbackRate: {
    fallbacks: number;
    totalResolutions: number;
    rate: number;
  };
  scoreDistribution: {
    count: number;
    average: number;
    min: number | null;
    max: number | null;
  };
}

export interface SafetySignalCacheRecord {
  id: string;
  locationKey: string;
  lat: number;
  lng: number;
  crimeProvider: string | null;
  schoolProvider: string | null;
  crimeRaw: Record<string, unknown> | number | null;
  crimeNormalized: number | null;
  schoolRaw: Record<string, unknown> | number | null;
  schoolNormalized: number | null;
  stabilityRaw: Record<string, unknown> | number | null;
  stabilityNormalized: number | null;
  fetchedAt: string;
  expiresAt: string;
  sourceType: SafetyDataSource;
}

export interface SafetySignalCacheRepository {
  save(entry: Omit<SafetySignalCacheRecord, "id">): Promise<SafetySignalCacheRecord>;
  getLatest(locationKey: string): Promise<SafetySignalCacheRecord | null>;
  isFresh(entry: SafetySignalCacheRecord, ttlHours?: number): boolean;
  isStaleUsable(entry: SafetySignalCacheRecord, staleTtlHours?: number): boolean;
}
