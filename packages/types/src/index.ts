export type LocationType = "city" | "zip";

export type PropertyType =
  | "single_family"
  | "condo"
  | "townhome"
  | "multi_family";

export type SafetyConfidence = "low" | "medium" | "high" | "none";

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
  name: string;
  healthy: boolean;
  mode: "mock" | "live";
  freshness: string;
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
}

export interface SearchPersistenceInput {
  request: SearchRequest;
  response: SearchResponse;
  resolvedLocation: ResolvedLocation;
  scoredResults: PersistedSearchResult[];
  listings: ListingRecord[];
}

export interface SearchRepository {
  saveSearch(payload: SearchPersistenceInput): Promise<void>;
}

export interface RankingContext {
  weights: SearchWeights;
  minSqft?: number;
  minBedrooms?: number;
  budget?: SearchBudget;
  comparableListings: ListingRecord[];
  safetyByPropertyId: Map<string, SafetyRecord>;
}

export interface RankedListing {
  listing: ListingRecord;
  explanation: string;
  scoreInputs: Record<string, unknown>;
  scores: ScoreBreakdown;
}
