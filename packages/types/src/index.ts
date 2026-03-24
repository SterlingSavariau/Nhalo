export type LocationType = "city" | "zip" | "address";

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
export type ListingDataSource =
  | "live"
  | "cached_live"
  | "stale_cached_live"
  | "mock"
  | "none";
export type GeocodeDataSource =
  | "live"
  | "cached_live"
  | "stale_cached_live"
  | "mock"
  | "none";
export type SafetyProviderMode = "mock" | "hybrid" | "live";
export type ListingProviderMode = "mock" | "hybrid" | "live";
export type GeocoderProviderMode = "mock" | "hybrid" | "live";
export type ListingStatus =
  | "active"
  | "coming_soon"
  | "pending"
  | "contingent"
  | "sold"
  | "off_market"
  | "unknown";
export type GeocodePrecision =
  | "rooftop"
  | "range_interpolated"
  | "approximate"
  | "centroid"
  | "mock"
  | "none";

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

export interface SessionIdentity {
  sessionId: string | null;
  source: "local_storage" | "header" | "query" | "body" | "none";
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ResolvedLocation {
  geocodeId: string;
  locationType: LocationType;
  locationValue: string;
  formattedAddress?: string | null;
  latitude: number;
  longitude: number;
  precision: GeocodePrecision;
  center: Coordinates;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  provider?: string | null;
  geocodeDataSource?: GeocodeDataSource;
  fetchedAt?: string | null;
  rawGeocodeInputs?: Record<string, unknown> | Record<string, unknown>[] | null;
  normalizedGeocodeInputs?: Record<string, unknown> | null;
}

export interface ListingRecord {
  id: string;
  propertyId: string;
  provider: string;
  sourceProvider: string;
  sourceListingId: string;
  sourceUrl?: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  coordinates: Coordinates;
  propertyType: PropertyType;
  listingStatus: ListingStatus;
  daysOnMarket?: number | null;
  price: number;
  pricePerSqft: number;
  sqft: number;
  squareFootage: number;
  bedrooms: number;
  bathrooms: number;
  lotSize?: number | null;
  lotSqft?: number | null;
  listingDataSource?: ListingDataSource;
  fetchedAt: string;
  createdAt: string;
  updatedAt: string;
  rawPayload?: Record<string, unknown>;
  rawListingInputs?: Record<string, unknown> | null;
  normalizedListingInputs?: Record<string, unknown> | null;
  canonicalPropertyId?: string;
  normalizedAddress?: string;
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
  getLastRejectionSummary?(): ListingRejectionSummary | null;
}

export interface ListingSourceProvider {
  readonly name: string;
  fetchRawListings(context: ListingSearchContext): Promise<Record<string, unknown>[]>;
  getStatus(): Promise<ProviderStatus>;
}

export interface ListingNormalizationResult {
  listings: ListingRecord[];
  rejectionSummary: ListingRejectionSummary;
  rawPayload: Record<string, unknown>[] | null;
}

export interface ListingNormalizationService {
  normalize(
    payload: Record<string, unknown>[],
    providerName: string,
    fetchedAt: string,
    source: ListingDataSource
  ): ListingNormalizationResult;
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
  getLastResolutionIssue?(): GeocodeResolutionIssue | null;
}

export interface GeocodingSourceProvider {
  readonly name: string;
  fetchRawGeocode(locationType: LocationType, locationValue: string): Promise<unknown>;
  getStatus(): Promise<ProviderStatus>;
}

export interface GeocodingNormalizationResult {
  geocode: ResolvedLocation | null;
  ambiguous: boolean;
  rawPayload: Record<string, unknown> | Record<string, unknown>[] | null;
  normalizedPayload: Record<string, unknown> | null;
  issue?: GeocodeResolutionIssue | null;
}

export interface GeocodingNormalizationService {
  normalize(
    payload: unknown,
    providerName: string,
    locationType: LocationType,
    locationValue: string,
    fetchedAt: string,
    sourceType: GeocodeDataSource
  ): GeocodingNormalizationResult;
}

export interface GeocodeResolutionIssue {
  code:
    | "AMBIGUOUS_ADDRESS"
    | "INVALID_LOCATION"
    | "INVALID_ZIP"
    | "MALFORMED_GEOCODER_RESPONSE"
    | "LOCATION_NOT_FOUND";
  message: string;
  details?: Array<{ field?: string; message: string }>;
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
  lastSourceUsed?: SafetyDataSource | ListingDataSource | GeocodeDataSource | null;
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

export interface ExplainabilityScoreDrivers {
  primary: "price" | "size" | "safety";
  secondary: "price" | "size" | "safety";
  weakest: "price" | "size" | "safety";
}

export interface ExplainabilityPayload {
  headline: string;
  strengths: string[];
  risks: string[];
  scoreDrivers: ExplainabilityScoreDrivers;
}

export interface ResultProvenance {
  listingDataSource: ListingDataSource;
  listingProvider: string | null;
  listingFetchedAt: string | null;
  sourceListingId: string | null;
  safetyDataSource: SafetyDataSource;
  crimeProvider: string | null;
  schoolProvider: string | null;
  crimeFetchedAt: string | null;
  schoolFetchedAt: string | null;
  geocodeDataSource: GeocodeDataSource;
  geocodeProvider: string | null;
  geocodeFetchedAt: string | null;
  geocodePrecision: GeocodePrecision;
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
  listingDataSource?: ListingDataSource;
  listingProvider?: string | null;
  sourceListingId?: string | null;
  listingFetchedAt?: string | null;
  canonicalPropertyId?: string;
  distanceMiles?: number;
  insideRequestedRadius?: boolean;
  qualityFlags?: string[];
  strengths?: string[];
  risks?: string[];
  confidenceReasons?: string[];
  explainability?: ExplainabilityPayload;
  provenance?: ResultProvenance;
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
  candidatesRetrieved?: number;
  candidatesAfterNormalization?: number;
  candidatesAfterQualityGate?: number;
  candidatesAfterDeduplication?: number;
  candidatesAfterRadiusFilter?: number;
  candidatesAfterHardFilters?: number;
  comparableSampleSize?: number;
  comparableStrategyUsed?: string;
  deduplicatedCount?: number;
  duplicateGroupsDetected?: number;
  totalCandidatesScanned: number;
  totalMatched: number;
  returnedCount: number;
  durationMs: number;
  warnings: SearchWarning[];
  suggestions: SearchSuggestion[];
  rejectionSummary?: ListingRejectionSummary;
  searchOrigin?: SearchOriginMetadata;
  mockFallbackUsed?: boolean;
  staleDataPresent?: boolean;
  historyRecordId?: string | null;
  sessionId?: string | null;
  rerunResultMetadata?: RerunResultMetadata | null;
}

export interface SearchResponse {
  homes: ScoredHome[];
  appliedFilters: AppliedFilters;
  appliedWeights: SearchWeights;
  metadata: SearchMetadata;
}

export interface SearchSnapshotRecord {
  id: string;
  formulaVersion: string | null;
  request: SearchRequest;
  response: SearchResponse;
  sessionId?: string | null;
  searchDefinitionId?: string | null;
  historyRecordId?: string | null;
  createdAt: string;
}

export interface SearchDefinition {
  id: string;
  sessionId: string | null;
  label: string;
  request: SearchRequest;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
}

export interface SearchHistoryRecord {
  id: string;
  sessionId: string | null;
  request: SearchRequest;
  resolvedOriginSummary: {
    resolvedFormattedAddress: string | null;
    latitude: number | null;
    longitude: number | null;
    precision: GeocodePrecision;
  };
  summaryMetadata: {
    returnedCount: number;
    totalMatched: number;
    durationMs: number;
    warnings: SearchWarning[];
    suggestions: SearchSuggestion[];
  };
  snapshotId: string | null;
  searchDefinitionId: string | null;
  rerunSourceType: "definition" | "history" | null;
  rerunSourceId: string | null;
  createdAt: string;
}

export interface SearchRestorePayload {
  sourceType: "definition" | "history" | "snapshot";
  sourceId: string;
  label: string;
  request: SearchRequest;
}

export interface RerunResultMetadata {
  sourceType: "definition" | "history";
  sourceId: string;
  executedAt: string;
  historyRecordId: string | null;
  snapshotId: string | null;
  freshResult: true;
}

export interface PersistedSearchResult {
  propertyId: string;
  formulaVersion: string;
  explanation: string;
  explainability?: ExplainabilityPayload;
  strengths?: string[];
  risks?: string[];
  confidenceReasons?: string[];
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
  listingDataSource: ListingDataSource;
  listingProvider: string | null;
  sourceListingId: string | null;
  listingFetchedAt: string | null;
  rawListingInputs: Record<string, unknown> | null;
  normalizedListingInputs: Record<string, unknown> | null;
  canonicalPropertyId: string | null;
  distanceMiles: number | null;
  insideRequestedRadius: boolean;
  comparableSampleSize?: number | null;
  comparableStrategyUsed?: string | null;
  deduplicationDecision?: string | null;
  qualityGateDecision?: string | null;
  rankingTieBreakInputs?: Record<string, unknown> | null;
  resultQualityFlags?: string[];
}

export interface SearchPersistenceInput {
  request: SearchRequest;
  response: SearchResponse;
  resolvedLocation: ResolvedLocation;
  scoredResults: PersistedSearchResult[];
  listings: ListingRecord[];
  marketSnapshot: MarketSnapshot;
  sessionId?: string | null;
  searchDefinitionId?: string | null;
  rerunSourceType?: "definition" | "history" | null;
  rerunSourceId?: string | null;
}

export interface SearchRepository {
  saveSearch(payload: SearchPersistenceInput): Promise<{ historyRecordId: string | null }>;
  getScoreAudit(propertyId: string): Promise<ScoreAuditRecord | null>;
  createSearchSnapshot(payload: {
    request: SearchRequest;
    response: SearchResponse;
    sessionId?: string | null;
    searchDefinitionId?: string | null;
    historyRecordId?: string | null;
  }): Promise<SearchSnapshotRecord>;
  getSearchSnapshot(id: string): Promise<SearchSnapshotRecord | null>;
  listSearchSnapshots(sessionId?: string | null, limit?: number): Promise<SearchSnapshotRecord[]>;
  createSearchDefinition(payload: {
    sessionId?: string | null;
    label: string;
    request: SearchRequest;
    pinned?: boolean;
  }): Promise<SearchDefinition>;
  listSearchDefinitions(sessionId?: string | null): Promise<SearchDefinition[]>;
  getSearchDefinition(id: string): Promise<SearchDefinition | null>;
  updateSearchDefinition(
    id: string,
    patch: {
      label?: string;
      pinned?: boolean;
      lastRunAt?: string | null;
    }
  ): Promise<SearchDefinition | null>;
  deleteSearchDefinition(id: string): Promise<boolean>;
  listSearchHistory(sessionId?: string | null, limit?: number): Promise<SearchHistoryRecord[]>;
  getSearchHistory(id: string): Promise<SearchHistoryRecord | null>;
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
    geocoder: number | null;
    listings: number | null;
    safety: number | null;
  };
  searchOrigin?: SearchOriginMetadata;
}

export interface RankedListing {
  listing: ListingRecord;
  explanation: string;
  scoreInputs: Record<string, unknown>;
  scores: ScoreBreakdown;
  qualityFlags?: string[];
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
  listingProvenance?: {
    listingDataSource: ListingDataSource;
    listingProvider: string | null;
    sourceListingId: string | null;
    listingFetchedAt: string | null;
    rawListingInputs: Record<string, unknown> | null;
    normalizedListingInputs: Record<string, unknown> | null;
  };
  searchOrigin?: SearchOriginMetadata;
  spatialContext?: {
    distanceMiles: number | null;
    radiusMiles: number | null;
    insideRequestedRadius: boolean;
  };
  explainability?: ExplainabilityPayload;
  strengths?: string[];
  risks?: string[];
  confidenceReasons?: string[];
  searchQualityContext?: {
    canonicalPropertyId: string | null;
    deduplicationDecision?: string | null;
    comparableSampleSize?: number | null;
    comparableStrategyUsed?: string | null;
    qualityGateDecision?: string | null;
    rejectionContext?: Record<string, number> | null;
    rankingTieBreakInputs?: Record<string, unknown> | null;
    resultQualityFlags?: string[];
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
  listingProviderLatencyMs: {
    count: number;
    average: number;
    last: number | null;
  };
  listingProviderFailureRate: {
    requests: number;
    failures: number;
    rate: number;
  };
  listingCacheHitRate: {
    hits: number;
    misses: number;
    rate: number;
  };
  listingLiveFetchRate: {
    liveFetches: number;
    totalResolutions: number;
    rate: number;
  };
  listingFallbackRate: {
    fallbacks: number;
    totalResolutions: number;
    rate: number;
  };
  listingNormalizationFailureRate: {
    failures: number;
    totalProcessed: number;
    rate: number;
  };
  listingResultsReturnedCount: {
    total: number;
    average: number;
    last: number | null;
  };
  geocoderLatencyMs: {
    count: number;
    average: number;
    last: number | null;
  };
  geocoderFailureRate: {
    requests: number;
    failures: number;
    rate: number;
  };
  geocodeCacheHitRate: {
    hits: number;
    misses: number;
    rate: number;
  };
  geocodeLiveFetchRate: {
    liveFetches: number;
    totalResolutions: number;
    rate: number;
  };
  geocodeFallbackRate: {
    fallbacks: number;
    totalResolutions: number;
    rate: number;
  };
  geocodeAmbiguityRate: {
    ambiguous: number;
    totalResolutions: number;
    rate: number;
  };
  geocodePrecisionDistribution: Record<GeocodePrecision, number>;
  listingDeduplicationRate: {
    deduplicated: number;
    totalCandidates: number;
    rate: number;
  };
  listingQualityFailureRate: {
    failures: number;
    totalCandidates: number;
    rate: number;
  };
  comparableFallbackRate: {
    fallbacks: number;
    totalSelections: number;
    rate: number;
  };
  rejectedOutsideRadiusCount: number;
  rejectedDuplicateCount: number;
  rejectedInvalidListingCount: number;
  rankingTieCount: number;
  activeListingRatio: {
    active: number;
    eligible: number;
    ratio: number;
  };
  snapshotCreateCount: number;
  snapshotReadCount: number;
  comparisonViewCount: number;
  auditViewCount: number;
  explainabilityRenderCount: number;
  searchDefinitionCreateCount: number;
  searchDefinitionDeleteCount: number;
  searchHistoryReadCount: number;
  searchRerunCount: number;
  searchRestoreCount: number;
  recentActivityPanelViewCount: number;
  savedSearchPinCount: number;
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

export interface ListingCacheRecord {
  id: string;
  locationKey: string;
  locationType: LocationType;
  locationValue: string;
  radiusMiles: number;
  provider: string;
  rawPayload: Record<string, unknown>[] | null;
  normalizedListings: ListingRecord[];
  fetchedAt: string;
  expiresAt: string;
  sourceType: ListingDataSource;
  rejectionSummary: ListingRejectionSummary;
}

export interface ListingCacheRepository {
  save(entry: Omit<ListingCacheRecord, "id">): Promise<ListingCacheRecord>;
  getLatest(locationKey: string): Promise<ListingCacheRecord | null>;
  isFresh(entry: ListingCacheRecord, ttlHours?: number): boolean;
  isStaleUsable(entry: ListingCacheRecord, staleTtlHours?: number): boolean;
}

export interface ListingRejectionSummary {
  outsideRadius: number;
  aboveBudget: number;
  belowSqft: number;
  belowBedrooms: number;
  wrongPropertyType: number;
  duplicate: number;
  invalidPrice: number;
  duplicateListings: number;
  invalidCoordinates: number;
  missingAddress: number;
  missingPrice: number;
  missingSquareFootage: number;
  unsupportedPropertyType: number;
  malformedListing: number;
  unsupportedListingStatus: number;
  normalizationFailures: number;
}

export interface GeocodeCacheRecord {
  id: string;
  queryType: LocationType;
  queryValue: string;
  provider: string;
  formattedAddress: string | null;
  latitude: number;
  longitude: number;
  precision: GeocodePrecision;
  rawPayload: Record<string, unknown> | Record<string, unknown>[] | null;
  fetchedAt: string;
  expiresAt: string;
  sourceType: GeocodeDataSource;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  normalizedPayload?: Record<string, unknown> | null;
}

export interface GeocodeCacheRepository {
  save(entry: Omit<GeocodeCacheRecord, "id">): Promise<GeocodeCacheRecord>;
  getLatest(queryType: LocationType, queryValue: string): Promise<GeocodeCacheRecord | null>;
  isFresh(entry: GeocodeCacheRecord, ttlHours?: number): boolean;
  isStaleUsable(entry: GeocodeCacheRecord, staleTtlHours?: number): boolean;
}

export interface SearchOriginMetadata {
  locationType: LocationType;
  locationValue: string;
  resolvedFormattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  precision: GeocodePrecision;
  geocodeDataSource: GeocodeDataSource;
  geocodeProvider: string | null;
  geocodeFetchedAt: string | null;
  rawGeocodeInputs?: Record<string, unknown> | Record<string, unknown>[] | null;
  normalizedGeocodeInputs?: Record<string, unknown> | null;
}
