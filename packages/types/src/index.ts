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
export type DataQualitySourceDomain = "listing" | "safety" | "geocode" | "search";
export type DataQualitySeverity = "info" | "warn" | "error" | "critical";
export type DataQualityStatus = "open" | "acknowledged" | "resolved" | "ignored";
export type RuntimeEnvironmentName = "local" | "development" | "staging" | "production_like_pilot";
export type EnvironmentProfileName =
  | "local_demo"
  | "local_dev"
  | "staging_pilot"
  | "production_pilot";
export type RuntimeReliabilityState =
  | "healthy"
  | "degraded"
  | "maintenance"
  | "read_only_degraded"
  | "startup_blocked";
export type DependencyClassification =
  | "required"
  | "optional"
  | "internal_only"
  | "background";
export type ReliabilityIncidentStatus = "open" | "acknowledged" | "resolved" | "ignored";
export type DataQualityTargetType =
  | "listing"
  | "property"
  | "provider"
  | "search"
  | "search_result"
  | "geocode"
  | "safety_signal";

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
  partnerId?: string | null;
  pilotLinkId?: string | null;
  source: "local_storage" | "header" | "query" | "body" | "none";
}

export type PilotPartnerStatus = "active" | "paused" | "inactive";
export type PlanTier = "free_demo" | "pilot" | "partner" | "internal";

export interface PilotFeatureOverrides {
  demoModeEnabled: boolean;
  sharedSnapshotsEnabled: boolean;
  sharedShortlistsEnabled: boolean;
  feedbackEnabled: boolean;
  validationPromptsEnabled: boolean;
  shortlistCollaborationEnabled: boolean;
  exportResultsEnabled: boolean;
}

export interface EffectiveCapabilities {
  planTier: PlanTier;
  canShareSnapshots: boolean;
  canShareShortlists: boolean;
  canUseDemoMode: boolean;
  canExportResults: boolean;
  canUseCollaboration: boolean;
  canUseOpsViews: boolean;
  canSubmitFeedback: boolean;
  canSeeValidationPrompts: boolean;
  limits: {
    savedSearches: number | null;
    shortlists: number | null;
    shareLinks: number | null;
    exportsPerSession: number | null;
  };
}

export interface PilotPartner {
  id: string;
  name: string;
  slug: string;
  planTier: PlanTier;
  status: PilotPartnerStatus;
  contactLabel?: string | null;
  notes?: string | null;
  featureOverrides: PilotFeatureOverrides;
  createdAt: string;
  updatedAt: string;
}

export interface PilotContext {
  partnerId: string;
  partnerSlug: string;
  partnerName: string;
  planTier: PlanTier;
  status: PilotPartnerStatus;
  pilotLinkId: string;
  pilotToken: string;
  allowedFeatures: PilotFeatureOverrides;
  capabilities: EffectiveCapabilities;
}

export interface PilotLinkRecord {
  id: string;
  partnerId: string;
  token: string;
  allowedFeatures: PilotFeatureOverrides;
  createdAt: string;
  expiresAt?: string | null;
  revokedAt?: string | null;
  openCount: number;
  status: "active" | "expired" | "revoked";
}

export interface PilotLinkView {
  link: PilotLinkRecord;
  partner: PilotPartner;
  context: PilotContext;
}

export interface OpsActionRecord {
  id: string;
  actionType: string;
  targetType: string;
  targetId: string;
  partnerId?: string | null;
  performedAt: string;
  result: "success" | "not_found" | "rejected";
  details?: Record<string, unknown> | null;
}

export type PilotActivityType =
  | "pilot_link_created"
  | "pilot_link_opened"
  | "pilot_link_revoked"
  | "partner_updated"
  | "shared_snapshot_created"
  | "shared_snapshot_opened"
  | "shortlist_shared"
  | "shared_shortlist_opened"
  | "feedback_submitted"
  | "shared_comment_added"
  | "reviewer_decision_submitted"
  | "empty_state_encountered"
  | "provider_degraded_during_pilot";

export interface PilotActivityRecord {
  id: string;
  partnerId: string;
  pilotLinkId?: string | null;
  eventType: PilotActivityType;
  payload?: Record<string, unknown> | null;
  createdAt: string;
}

export interface OpsSummary {
  activePilotPartners: number;
  pilotLinkCounts: {
    total: number;
    active: number;
    revoked: number;
    expired: number;
  };
  recentSharedSnapshotCount: number;
  recentShortlistShareCount: number;
  feedbackCount: number;
  validationEventCount: number;
  topErrorCategories: Array<{
    category: string;
    count: number;
  }>;
  providerDegradationCount: number;
  partnerUsage: PartnerUsageSummary[];
  security?: {
    revokedLinkOpenAttemptCount: number;
    expiredLinkOpenAttemptCount: number;
    invalidTokenAccessCount: number;
    internalRouteDeniedCount: number;
    rateLimitTriggerCountByEndpoint: Record<string, number>;
    validationRejectCountByCategory: Record<string, number>;
    malformedPayloadCount: number;
    shareRevocationEnforcementCount: number;
  };
}

export interface BuildMetadata {
  appVersion: string;
  buildId: string;
  gitSha: string | null;
  buildTimestamp: string;
  environment: RuntimeEnvironmentName;
  profile?: EnvironmentProfileName;
  formulaVersions: string[];
}

export interface LaunchGuardrail {
  id: string;
  status: "pass" | "warn" | "fail";
  message: string;
  detail: string;
}

export interface GoLiveCheckItem {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

export interface GoLiveCheckSummary {
  generatedAt: string;
  environment: RuntimeEnvironmentName;
  profile: EnvironmentProfileName;
  overallStatus: "pass" | "warn" | "fail";
  reliabilityState: RuntimeReliabilityState;
  checks: GoLiveCheckItem[];
  guardrails: LaunchGuardrail[];
}

export interface SupportSummaryItem {
  key: string;
  title: string;
  status: "ok" | "attention" | "blocked";
  summary: string;
  action: string;
}

export interface SupportContextSummary {
  generatedAt: string;
  environment: RuntimeEnvironmentName;
  profile: EnvironmentProfileName;
  items: SupportSummaryItem[];
}

export interface ReleaseSummary {
  generatedAt: string;
  environment: RuntimeEnvironmentName;
  profile: EnvironmentProfileName;
  build: BuildMetadata;
  formulaVersions: string[];
  persistenceMode: "memory" | "database";
  schemaVersion: string | null;
  enabledFeatures: string[];
  degradedConstraints: string[];
}

export interface DependencyReadinessRecord {
  name: string;
  classification: DependencyClassification;
  status: "healthy" | "degraded" | "unavailable";
  detail: string;
}

export interface BackgroundJobStatus {
  name: string;
  enabled: boolean;
  status: "idle" | "running" | "succeeded" | "failed" | "disabled";
  lastRunAt: string | null;
  lastCompletedAt: string | null;
  lastFailedAt: string | null;
  lastDurationMs: number | null;
  runCount: number;
  failureCount: number;
  lastError: string | null;
}

export interface ReliabilityStateSummary {
  state: RuntimeReliabilityState;
  reasons: string[];
  readOnlyMode: boolean;
  cacheOnlyMode: boolean;
  dependencies: DependencyReadinessRecord[];
  backgroundJobs: BackgroundJobStatus[];
  build: BuildMetadata;
}

export interface ReliabilityIncident {
  id: string;
  category: string;
  severity: "warn" | "error" | "critical";
  state: RuntimeReliabilityState;
  status: ReliabilityIncidentStatus;
  message: string;
  provider?: string | null;
  partnerId?: string | null;
  context?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
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

export interface DataQualityEvent {
  id: string;
  ruleId: string;
  sourceDomain: DataQualitySourceDomain;
  severity: DataQualitySeverity;
  category: string;
  message: string;
  triggeredAt: string;
  targetType: DataQualityTargetType;
  targetId: string;
  partnerId?: string | null;
  sessionId?: string | null;
  provider?: string | null;
  status: DataQualityStatus;
  context: Record<string, unknown> | null;
  searchRequestId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DataQualitySummary {
  totalEvents: number;
  openCount: number;
  acknowledgedCount: number;
  resolvedCount: number;
  ignoredCount: number;
  criticalCount: number;
  bySeverity: Record<DataQualitySeverity, number>;
  byDomain: Record<DataQualitySourceDomain, number>;
  byCategory: Array<{
    category: string;
    count: number;
  }>;
  byProvider: Array<{
    provider: string;
    count: number;
  }>;
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
  integrityFlags?: string[];
  dataWarnings?: string[];
  degradedReasons?: string[];
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
  integritySummary?: {
    totalEvents: number;
    criticalEvents: number;
    categories: string[];
    staleTopResults: number;
  };
  performance?: SearchExecutionProfile;
  historyRecordId?: string | null;
  sessionId?: string | null;
  rerunResultMetadata?: RerunResultMetadata | null;
}

export interface SearchExecutionTimings {
  geocodeResolutionMs: number;
  listingFetchMs: number;
  listingNormalizationMs: number;
  safetyFetchMs: number;
  qualityIntegrityEvaluationMs: number;
  deduplicationMs: number;
  radiusFilteringMs: number;
  comparableSelectionMs: number;
  scoringMs: number;
  persistenceMs: number;
  totalSearchMs: number;
}

export interface SearchProviderUsage {
  geocoderCalls: number;
  listingProviderCalls: number;
  safetyProviderCalls: number;
  geocoderCacheHits: number;
  listingCacheHits: number;
  safetyCacheHits: number;
  geocoderLiveFetches: number;
  listingLiveFetches: number;
  safetyLiveFetches: number;
  geocoderRetriesUsed: number;
  listingRetriesUsed: number;
  safetyRetriesUsed: number;
  geocoderStaleFallbacks: number;
  listingStaleFallbacks: number;
  safetyStaleFallbacks: number;
  geocoderBudgetExceeded: boolean;
  listingBudgetExceeded: boolean;
  safetyBudgetExceeded: boolean;
}

export interface SearchExecutionProfile {
  timingsMs: SearchExecutionTimings;
  providerUsage: SearchProviderUsage;
}

export interface PartnerUsageSummary {
  partnerId: string;
  partnerName?: string | null;
  planTier?: PlanTier;
  searches: number;
  liveProviderCalls: number;
  cacheHitRate: number;
  sharedSnapshotCreates: number;
  sharedSnapshotOpens: number;
  qualityEventCount: number;
  pilotLinkOpens: number;
  shortlistActivityCount: number;
  collaborationActivityCount: number;
  exportUsageCount: number;
  featureLimitHitCount: number;
}

export interface UsageFunnelSummary {
  steps: Array<{
    key:
      | "search_started"
      | "search_completed"
      | "result_opened"
      | "comparison_started"
      | "shortlist_created"
      | "snapshot_created"
      | "snapshot_shared"
      | "feedback_submitted"
      | "rerun_executed"
      | "shared_shortlist_opened";
    label: string;
    count: number;
    conversionFromPrevious: number | null;
  }>;
}

export interface UsageFrictionSummary {
  emptyResultRateBySearchType: Record<
    LocationType,
    {
      searches: number;
      emptyResults: number;
      rate: number;
    }
  >;
  lowConfidenceResultRate: {
    searches: number;
    lowConfidenceTopResults: number;
    rate: number;
  };
  searchesWithoutShortlistActivity: {
    searches: number;
    withoutShortlistActivity: number;
    rate: number;
  };
  sharedSnapshotsNeverOpened: {
    total: number;
    neverOpened: number;
    rate: number;
  };
  shortlistsWithoutReviewerActivity: {
    total: number;
    withoutReviewerActivity: number;
    rate: number;
  };
  repeatedRerunsWithoutSavedOutcome: {
    rerunSources: number;
    repeatedWithoutSavedOutcome: number;
    rate: number;
  };
}

export interface PlanSummary {
  planDistribution: Record<PlanTier, number>;
  capabilityEnabledCounts: Record<string, number>;
}

export interface SearchResponse {
  homes: ScoredHome[];
  appliedFilters: AppliedFilters;
  appliedWeights: SearchWeights;
  metadata: SearchMetadata;
}

export interface ValidationArtifactMetadata {
  wasShared?: boolean;
  shareCount?: number;
  feedbackCount?: number;
  demoScenarioId?: string | null;
  rerunCount?: number;
}

export interface SearchSnapshotRecord {
  id: string;
  formulaVersion: string | null;
  request: SearchRequest;
  response: SearchResponse;
  sessionId?: string | null;
  searchDefinitionId?: string | null;
  historyRecordId?: string | null;
  validationMetadata?: ValidationArtifactMetadata;
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
  validationMetadata?: ValidationArtifactMetadata;
  createdAt: string;
}

export interface SearchRestorePayload {
  sourceType: "definition" | "history" | "snapshot";
  sourceId: string;
  label: string;
  request: SearchRequest;
}

export type ReviewState = "undecided" | "interested" | "needs_review" | "rejected";
export type ShareMode = "read_only" | "comment_only" | "review_only";
export type CollaborationRole = "owner" | "viewer" | "reviewer";
export type SharedShortlistStatus = "active" | "expired" | "revoked";
export type SharedCommentEntityType = "shared_shortlist_item";
export type ReviewerDecisionValue = "agree" | "disagree" | "discuss" | "favorite" | "pass";

export interface Shortlist {
  id: string;
  sessionId: string | null;
  title: string;
  description?: string | null;
  sourceSnapshotId?: string | null;
  pinned: boolean;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShortlistItem {
  id: string;
  shortlistId: string;
  canonicalPropertyId: string;
  sourceSnapshotId?: string | null;
  sourceHistoryId?: string | null;
  sourceSearchDefinitionId?: string | null;
  capturedHome: ScoredHome;
  reviewState: ReviewState;
  addedAt: string;
  updatedAt: string;
}

export type ResultNoteEntityType =
  | "shortlist_item"
  | "snapshot_result"
  | "shared_snapshot_result";

export interface ResultNote {
  id: string;
  sessionId: string | null;
  entityType: ResultNoteEntityType;
  entityId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface SharedShortlist {
  id: string;
  shareId: string;
  shortlistId: string;
  sessionId?: string | null;
  shareMode: ShareMode;
  collaborationRole: CollaborationRole;
  expiresAt?: string | null;
  revokedAt?: string | null;
  openCount: number;
  status: SharedShortlistStatus;
  createdAt: string;
}

export interface SharedComment {
  id: string;
  shareId: string;
  entityType: SharedCommentEntityType;
  entityId: string;
  authorLabel?: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewerDecision {
  id: string;
  shortlistItemId: string;
  shareId: string;
  decision: ReviewerDecisionValue;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CollaborationActivityType =
  | "shortlist_shared"
  | "shared_shortlist_opened"
  | "shared_comment_added"
  | "shared_comment_updated"
  | "shared_comment_deleted"
  | "reviewer_decision_submitted"
  | "reviewer_decision_updated"
  | "share_link_revoked"
  | "share_link_expired";

export interface CollaborationActivityRecord {
  id: string;
  shareId: string | null;
  shortlistId: string | null;
  shortlistItemId: string | null;
  commentId: string | null;
  reviewerDecisionId: string | null;
  eventType: CollaborationActivityType;
  payload?: Record<string, unknown> | null;
  createdAt: string;
}

export interface SharedShortlistView {
  readOnly: boolean;
  shared: true;
  share: SharedShortlist;
  shortlist: Shortlist;
  items: ShortlistItem[];
  comments: SharedComment[];
  reviewerDecisions: ReviewerDecision[];
  collaborationActivity: CollaborationActivityRecord[];
}

export type WorkflowActivityType =
  | "shortlist_created"
  | "shortlist_updated"
  | "shortlist_deleted"
  | "shortlist_item_added"
  | "shortlist_item_removed"
  | "note_created"
  | "note_updated"
  | "note_deleted"
  | "review_state_changed";

export interface WorkflowActivityRecord {
  id: string;
  sessionId: string | null;
  eventType: WorkflowActivityType;
  shortlistId?: string | null;
  shortlistItemId?: string | null;
  noteId?: string | null;
  payload?: Record<string, unknown> | null;
  createdAt: string;
}

export interface HistoricalComparisonChange {
  field:
    | "nhaloScore"
    | "priceScore"
    | "sizeScore"
    | "safetyScore"
    | "overallConfidence"
    | "safetyConfidence"
    | "listingSource"
    | "safetySource"
    | "qualityFlags";
  from: string | number | string[] | null;
  to: string | number | string[] | null;
  status: "improved" | "declined" | "changed";
}

export interface HistoricalComparisonPayload {
  canonicalPropertyId: string;
  historical: {
    label: string;
    home: ScoredHome;
    sourceSnapshotId?: string | null;
    capturedAt: string;
  };
  current: {
    label: string;
    home: ScoredHome;
  } | null;
  changes: HistoricalComparisonChange[];
}

export interface RerunResultMetadata {
  sourceType: "definition" | "history";
  sourceId: string;
  executedAt: string;
  historyRecordId: string | null;
  snapshotId: string | null;
  freshResult: true;
}

export type SharedSnapshotStatus = "active" | "expired" | "revoked";

export interface SharedSnapshotRecord {
  id: string;
  shareId: string;
  snapshotId: string;
  sessionId?: string | null;
  expiresAt?: string | null;
  revokedAt?: string | null;
  openCount: number;
  status: SharedSnapshotStatus;
  createdAt: string;
}

export interface SharedSnapshotView {
  share: SharedSnapshotRecord;
  snapshot: SearchSnapshotRecord;
}

export type FeedbackCategory =
  | "useful"
  | "accuracy"
  | "explainability"
  | "confidence"
  | "missing_homes"
  | "bad_matches"
  | "comparison_helpful"
  | "empty_state_helpful"
  | "general";

export interface FeedbackRecord {
  id: string;
  sessionId?: string | null;
  snapshotId?: string | null;
  historyRecordId?: string | null;
  searchDefinitionId?: string | null;
  category: FeedbackCategory;
  value: "positive" | "negative" | "clear" | "unclear" | "accurate" | "inaccurate";
  comment?: string | null;
  createdAt: string;
}

export type ValidationEventName =
  | "search_started"
  | "search_completed"
  | "result_opened"
  | "comparison_started"
  | "snapshot_shared"
  | "snapshot_created"
  | "snapshot_opened"
  | "rerun_executed"
  | "feedback_submitted"
  | "empty_state_encountered"
  | "suggestion_used"
  | "demo_scenario_started"
  | "restore_used"
  | "capability_limit_hit"
  | "export_generated"
  | "plan_capability_resolved"
  | "share_feature_used"
  | "shortlist_feature_used"
  | PilotActivityType
  | WorkflowActivityType
  | CollaborationActivityType;

export interface ValidationEventRecord {
  id: string;
  eventName: ValidationEventName;
  sessionId?: string | null;
  snapshotId?: string | null;
  historyRecordId?: string | null;
  searchDefinitionId?: string | null;
  demoScenarioId?: string | null;
  payload?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ValidationSummary {
  searchesPerSession: {
    sessions: number;
    searches: number;
    average: number;
  };
  shareableSnapshotsCreated: number;
  sharedSnapshotOpens: number;
  sharedSnapshotOpenRate: {
    opens: number;
    created: number;
    rate: number;
  };
  feedbackSubmissionRate: {
    feedbackCount: number;
    sessions: number;
    rate: number;
  };
  emptyStateRate: {
    emptyStates: number;
    searches: number;
    rate: number;
  };
  rerunRate: {
    reruns: number;
    searches: number;
    rate: number;
  };
  compareUsageRate: {
    comparisons: number;
    sessions: number;
    rate: number;
  };
  restoreUsageRate: {
    restores: number;
    sessions: number;
    rate: number;
  };
  mostCommonRejectionReasons: Array<{
    reason: string;
    count: number;
  }>;
  mostCommonConfidenceLevels: Array<{
    confidence: SafetyConfidence;
    count: number;
  }>;
  topDemoScenariosUsed: Array<{
    demoScenarioId: string;
    count: number;
  }>;
  mostViewedSharedSnapshots: Array<{
    snapshotId: string;
    opens: number;
  }>;
  topSharedShortlists?: Array<{
    shortlistId: string;
    opens: number;
  }>;
  topPilotPartners?: Array<{
    partnerId: string;
    count: number;
  }>;
}

export interface WorkflowFeatureConfig {
  shortlistsEnabled: boolean;
  resultNotesEnabled: boolean;
  historicalCompareEnabled: boolean;
  sharedShortlistsEnabled?: boolean;
  sharedCommentsEnabled?: boolean;
  reviewerDecisionsEnabled?: boolean;
}

export interface OpsFeatureConfig {
  pilotOpsEnabled: boolean;
  internalOpsUiEnabled: boolean;
  pilotLinksEnabled: boolean;
}

export interface ProductCapabilityConfig {
  enabled: boolean;
  defaultPlanTier: PlanTier;
  maxSavedSearchesPerSession: number;
  maxShortlistsPerSession: number;
  maxShareLinksPerSession: number;
  maxExportsPerSession: number;
  usageFunnelSummaryEnabled: boolean;
  usageFrictionSummaryEnabled: boolean;
  exportLimitsEnabled: boolean;
}

export interface DemoScenario {
  id: string;
  label: string;
  description: string;
  whyThisMatters?: string;
  request: SearchRequest;
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
  integrityFlags?: string[];
  dataWarnings?: string[];
  degradedReasons?: string[];
}

export interface SearchPersistenceInput {
  request: SearchRequest;
  response: SearchResponse;
  resolvedLocation: ResolvedLocation;
  scoredResults: PersistedSearchResult[];
  listings: ListingRecord[];
  marketSnapshot: MarketSnapshot;
  sessionId?: string | null;
  partnerId?: string | null;
  searchDefinitionId?: string | null;
  rerunSourceType?: "definition" | "history" | null;
  rerunSourceId?: string | null;
  qualityEvents?: Array<Omit<DataQualityEvent, "id" | "createdAt" | "updatedAt">>;
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
  createSharedSnapshot(payload: {
    snapshotId: string;
    sessionId?: string | null;
    expiresAt?: string | null;
  }): Promise<SharedSnapshotRecord>;
  getSharedSnapshot(shareId: string): Promise<SharedSnapshotView | null>;
  createSharedShortlist(payload: {
    shortlistId: string;
    sessionId?: string | null;
    shareMode: ShareMode;
    expiresAt?: string | null;
  }): Promise<SharedShortlist>;
  listSharedShortlists(shortlistId: string): Promise<SharedShortlist[]>;
  getSharedShortlist(shareId: string): Promise<SharedShortlistView | null>;
  revokeSharedShortlist(shareId: string): Promise<SharedShortlist | null>;
  createPilotPartner(payload: {
    name: string;
    slug: string;
    planTier?: PlanTier;
    status?: PilotPartnerStatus;
    contactLabel?: string | null;
    notes?: string | null;
    featureOverrides?: Partial<PilotFeatureOverrides>;
  }): Promise<PilotPartner>;
  listPilotPartners(): Promise<PilotPartner[]>;
  getPilotPartner(id: string): Promise<PilotPartner | null>;
  updatePilotPartner(
    id: string,
    patch: {
      name?: string;
      planTier?: PlanTier;
      status?: PilotPartnerStatus;
      contactLabel?: string | null;
      notes?: string | null;
      featureOverrides?: Partial<PilotFeatureOverrides>;
    }
  ): Promise<PilotPartner | null>;
  createPilotLink(payload: {
    partnerId: string;
    expiresAt?: string | null;
    allowedFeatures?: Partial<PilotFeatureOverrides>;
  }): Promise<PilotLinkRecord>;
  listPilotLinks(partnerId?: string): Promise<PilotLinkRecord[]>;
  getPilotLink(token: string): Promise<PilotLinkView | null>;
  revokePilotLink(token: string): Promise<PilotLinkRecord | null>;
  createFeedback(payload: {
    sessionId?: string | null;
    snapshotId?: string | null;
    historyRecordId?: string | null;
    searchDefinitionId?: string | null;
    category: FeedbackCategory;
    value: FeedbackRecord["value"];
    comment?: string | null;
  }): Promise<FeedbackRecord>;
  createShortlist(payload: {
    sessionId?: string | null;
    title: string;
    description?: string | null;
    sourceSnapshotId?: string | null;
    pinned?: boolean;
  }): Promise<Shortlist>;
  listShortlists(sessionId?: string | null): Promise<Shortlist[]>;
  getShortlist(id: string): Promise<Shortlist | null>;
  updateShortlist(
    id: string,
    patch: {
      title?: string;
      description?: string | null;
      pinned?: boolean;
    }
  ): Promise<Shortlist | null>;
  deleteShortlist(id: string): Promise<boolean>;
  createShortlistItem(
    shortlistId: string,
    payload: {
      canonicalPropertyId: string;
      sourceSnapshotId?: string | null;
      sourceHistoryId?: string | null;
      sourceSearchDefinitionId?: string | null;
      capturedHome: ScoredHome;
      reviewState?: ReviewState;
    }
  ): Promise<ShortlistItem | null>;
  listShortlistItems(shortlistId: string): Promise<ShortlistItem[]>;
  updateShortlistItem(
    shortlistId: string,
    itemId: string,
    patch: {
      reviewState?: ReviewState;
    }
  ): Promise<ShortlistItem | null>;
  deleteShortlistItem(shortlistId: string, itemId: string): Promise<boolean>;
  createResultNote(payload: {
    sessionId?: string | null;
    entityType: ResultNoteEntityType;
    entityId: string;
    body: string;
  }): Promise<ResultNote>;
  listResultNotes(filters?: {
    sessionId?: string | null;
    entityType?: ResultNoteEntityType;
    entityId?: string;
  }): Promise<ResultNote[]>;
  updateResultNote(id: string, body: string): Promise<ResultNote | null>;
  deleteResultNote(id: string): Promise<boolean>;
  listWorkflowActivity(sessionId?: string | null, limit?: number): Promise<WorkflowActivityRecord[]>;
  createSharedComment(payload: {
    shareId: string;
    entityType: SharedCommentEntityType;
    entityId: string;
    authorLabel?: string | null;
    body: string;
  }): Promise<SharedComment>;
  listSharedComments(filters: {
    shareId: string;
    entityType?: SharedCommentEntityType;
    entityId?: string;
  }): Promise<SharedComment[]>;
  getSharedComment(id: string): Promise<SharedComment | null>;
  updateSharedComment(id: string, body: string, authorLabel?: string | null): Promise<SharedComment | null>;
  deleteSharedComment(id: string): Promise<boolean>;
  createReviewerDecision(payload: {
    shareId: string;
    shortlistItemId: string;
    decision: ReviewerDecisionValue;
    note?: string | null;
  }): Promise<ReviewerDecision>;
  listReviewerDecisions(filters: {
    shareId: string;
    shortlistItemId?: string;
  }): Promise<ReviewerDecision[]>;
  getReviewerDecision(id: string): Promise<ReviewerDecision | null>;
  updateReviewerDecision(
    id: string,
    patch: {
      decision?: ReviewerDecisionValue;
      note?: string | null;
    }
  ): Promise<ReviewerDecision | null>;
  deleteReviewerDecision(id: string): Promise<boolean>;
  listCollaborationActivity(filters: {
    shareId?: string;
    shortlistId?: string;
    limit?: number;
  }): Promise<CollaborationActivityRecord[]>;
  recordOpsAction(payload: {
    actionType: string;
    targetType: string;
    targetId: string;
    partnerId?: string | null;
    result: OpsActionRecord["result"];
    details?: Record<string, unknown> | null;
  }): Promise<OpsActionRecord>;
  listOpsActions(filters?: {
    partnerId?: string;
    limit?: number;
  }): Promise<OpsActionRecord[]>;
  listPilotActivity(filters?: {
    partnerId: string;
    limit?: number;
  }): Promise<PilotActivityRecord[]>;
  getOpsSummary(): Promise<OpsSummary>;
  getUsageFunnelSummary(): Promise<UsageFunnelSummary>;
  getUsageFrictionSummary(): Promise<UsageFrictionSummary>;
  getPlanSummary(): Promise<PlanSummary>;
  listDataQualityEvents(filters?: {
    severity?: DataQualitySeverity;
    sourceDomain?: DataQualitySourceDomain;
    provider?: string;
    partnerId?: string;
    status?: DataQualityStatus;
    targetId?: string;
    searchRequestId?: string;
    limit?: number;
  }): Promise<DataQualityEvent[]>;
  getDataQualityEvent(id: string): Promise<DataQualityEvent | null>;
  updateDataQualityEventStatus(
    id: string,
    status: DataQualityStatus
  ): Promise<DataQualityEvent | null>;
  getDataQualitySummary(filters?: {
    severity?: DataQualitySeverity;
    sourceDomain?: DataQualitySourceDomain;
    provider?: string;
    partnerId?: string;
    status?: DataQualityStatus;
  }): Promise<DataQualitySummary>;
  getPartnerUsageSummary(partnerId?: string): Promise<PartnerUsageSummary[]>;
  recordValidationEvent(payload: {
    eventName: ValidationEventName;
    sessionId?: string | null;
    snapshotId?: string | null;
    historyRecordId?: string | null;
    searchDefinitionId?: string | null;
    demoScenarioId?: string | null;
    payload?: Record<string, unknown> | null;
  }): Promise<ValidationEventRecord>;
  getValidationSummary(): Promise<ValidationSummary>;
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
  dataQuality?: {
    integrityFlags?: string[];
    dataWarnings?: string[];
    degradedReasons?: string[];
    events?: DataQualityEvent[];
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
  shortlistCreateCount: number;
  shortlistDeleteCount: number;
  shortlistItemAddCount: number;
  shortlistItemRemoveCount: number;
  shortlistViewCount: number;
  noteCreateCount: number;
  noteUpdateCount: number;
  noteDeleteCount: number;
  reviewStateChangeCount: number;
  historicalCompareViewCount: number;
  shortlistShareCreateCount: number;
  shortlistShareOpenCount: number;
  shortlistShareRevokeCount: number;
  sharedCommentCreateCount: number;
  sharedCommentUpdateCount: number;
  sharedCommentDeleteCount: number;
  reviewerDecisionCreateCount: number;
  reviewerDecisionUpdateCount: number;
  collaborationActivityReadCount: number;
  expiredShareOpenCount: number;
  pilotPartnerCreateCount: number;
  pilotLinkCreateCount: number;
  pilotLinkOpenCount: number;
  pilotLinkRevokeCount: number;
  opsSummaryReadCount: number;
  opsErrorViewCount: number;
  partnerFeatureOverrideCount: number;
  pilotActivityReadCount: number;
  providerDegradedDuringPilotCount: number;
  recentActivityPanelViewCount: number;
  savedSearchPinCount: number;
  onboardingViewCount: number;
  onboardingDismissCount: number;
  emptyStateViewCount: number;
  suggestionClickCount: number;
  detailPanelOpenCount: number;
  resultCompareAddCount: number;
  snapshotReopenCount: number;
  savedSearchRestoreCount: number;
  sharedSnapshotCreateCount: number;
  sharedSnapshotOpenCount: number;
  feedbackSubmitCount: number;
  feedbackUsefulRate: {
    useful: number;
    total: number;
    rate: number;
  };
  demoScenarioStartCount: number;
  walkthroughViewCount: number;
  walkthroughDismissCount: number;
  exportUsageCount: number;
  usageFunnelReadCount: number;
  usageFrictionReadCount: number;
  capabilityLimitHitCount: number;
  exportGenerateCount: number;
  planCapabilityResolutionCount: number;
  planSummaryReadCount: number;
  partnerUsageSummaryReadCount: number;
  featureUsageCountByCapability: Record<string, number>;
  shareToOpenConversionRate: {
    opens: number;
    shares: number;
    rate: number;
  };
  shortlistToReviewConversionRate: {
    reviewed: number;
    shortlistAdds: number;
    rate: number;
  };
  ctaClickCount: number;
  validationPromptViewCount: number;
  validationPromptResponseCount: number;
  sharedSnapshotExpiredCount: number;
  validationSummaryReadCount: number;
  revokedLinkOpenAttemptCount: number;
  expiredLinkOpenAttemptCount: number;
  invalidTokenAccessCount: number;
  internalRouteDeniedCount: number;
  rateLimitTriggerCountByEndpoint: Record<string, number>;
  validationRejectCountByCategory: Record<string, number>;
  malformedPayloadCount: number;
  shareRevocationEnforcementCount: number;
  securityConfigErrorCount: number;
  dataQualityEventCount: number;
  integrityIncidentOpenCount: number;
  integrityIncidentResolvedCount: number;
  safetyQualityFailureRate: {
    failures: number;
    totalCandidates: number;
    rate: number;
  };
  geocodeQualityFailureRate: {
    failures: number;
    totalCandidates: number;
    rate: number;
  };
  searchIntegrityFailureRate: {
    failures: number;
    totalCandidates: number;
    rate: number;
  };
  staleDataResultRate: {
    staleResults: number;
    totalResults: number;
    rate: number;
  };
  providerDriftEventCount: number;
  qualityRuleTriggerCountByCategory: Record<string, number>;
  criticalQualityEventCount: number;
  searchLatencyP95Ms: number;
  providerCallCountByType: {
    geocoder: number;
    listing: number;
    safety: number;
  };
  liveFetchBudgetExhaustionCount: {
    geocoder: number;
    listing: number;
    safety: number;
  };
  snapshotWriteLatency: {
    count: number;
    average: number;
    last: number | null;
  };
  heavyEndpointReadCounts: Record<string, number>;
  searchSuccessRate: {
    successes: number;
    failures: number;
    rate: number;
  };
  searchFailureRate: {
    successes: number;
    failures: number;
    rate: number;
  };
  providerTimeoutRate: {
    requests: number;
    timeouts: number;
    rate: number;
  };
  cacheHitRate: {
    hits: number;
    misses: number;
    rate: number;
  };
  snapshotCreationRate: {
    created: number;
    windowCount: number;
    rate: number;
  };
  snapshotRetrievalLatency: {
    count: number;
    average: number;
    last: number | null;
  };
  errorRateByCategory: Record<
    "VALIDATION_ERROR" | "PROVIDER_ERROR" | "DATABASE_ERROR" | "CONFIG_ERROR" | "INTERNAL_ERROR",
    {
      count: number;
    }
  >;
  startupSuccessCount: number;
  startupDegradedCount: number;
  startupFailureCount: number;
  runtimeReliabilityStateChanges: number;
  backgroundJobRunCount: number;
  backgroundJobFailureCount: number;
  cacheOnlyModeCount: number;
  providerOutageFallbackCount: number;
  readOnlyDegradedModeCount: number;
  versionEndpointReadCount: number;
  goLiveCheckReadCount: number;
  supportContextReadCount: number;
  releaseSummaryReadCount: number;
  readinessFailCount: number;
  readinessWarnCount: number;
  launchGuardrailBlockCount: number;
  launchGuardrailWarnCount: number;
  opsCheckScriptRunCount: number;
  demoProfileLoadCount: number;
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
