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

export interface AuthenticatedUser {
  provider: "google";
  subject: string;
  email: string;
  emailVerified: boolean;
  name?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  pictureUrl?: string | null;
}

export interface SessionIdentity {
  sessionId: string | null;
  partnerId?: string | null;
  pilotLinkId?: string | null;
  authProvider?: AuthenticatedUser["provider"] | null;
  user?: AuthenticatedUser | null;
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
  listingStatus?: ListingStatus | null;
  daysOnMarket?: number | null;
  canonicalPropertyId?: string;
  distanceMiles?: number;
  insideRequestedRadius?: boolean;
  pricePerSqft?: number | null;
  medianPricePerSqft?: number | null;
  comparableSampleSize?: number | null;
  comparableStrategyUsed?: string | null;
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
export type FinancialReadinessState = "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "READY";
export type AffordabilityClassification = "READY" | "ALMOST_READY" | "NOT_READY" | "BLOCKED";
export type CreditScoreRange =
  | "excellent_760_plus"
  | "good_720_759"
  | "fair_680_719"
  | "limited_620_679"
  | "below_620";
export type LoanType = "conventional" | "fha" | "va" | "usda" | "other";
export type PreApprovalStatus = "not_started" | "in_progress" | "verified" | "expired";
export type ProofOfFundsStatus = "not_started" | "partial" | "verified";
export type FinancialBlockerCode =
  | "MISSING_FINANCIAL_DATA"
  | "MISSING_PREAPPROVAL"
  | "EXPIRED_PREAPPROVAL"
  | "INSUFFICIENT_FUNDS"
  | "HIGH_DTI"
  | "VERY_HIGH_DTI"
  | "UNAFFORDABLE_TARGET_PRICE"
  | "LOW_CREDIT_READINESS"
  | "MISSING_PROOF_OF_FUNDS"
  | "INVALID_INPUT_RANGE";

export interface FinancialBlocker {
  code: FinancialBlockerCode;
  severity: "warning" | "blocking";
  message: string;
  whyItMatters: string;
  howToFix: string;
}

export interface FinancialReadinessInputs {
  annualHouseholdIncome: number | null;
  monthlyDebtPayments: number | null;
  availableCashSavings: number | null;
  creditScoreRange: CreditScoreRange | null;
  desiredHomePrice: number | null;
  purchaseLocation: string | null;
  downPaymentPreferencePercent?: number | null;
  loanType?: LoanType | null;
  preApprovalStatus: PreApprovalStatus | null;
  preApprovalExpiresAt?: string | null;
  proofOfFundsStatus: ProofOfFundsStatus | null;
}

export interface FinancialReadinessAssumptions {
  interestRate: number | null;
  propertyTaxRate: number | null;
  insuranceMonthly: number | null;
  closingCostPercent: number | null;
  downPaymentPercent: number | null;
  loanType: LoanType | null;
}

export interface FinancialReadinessSummary {
  maxAffordableHomePrice: number | null;
  estimatedMonthlyPayment: number | null;
  estimatedDownPayment: number | null;
  estimatedClosingCosts: number | null;
  totalCashRequiredToClose: number | null;
  debtToIncomeRatio: number | null;
  housingRatio: number | null;
  affordabilityClassification: AffordabilityClassification;
  readinessState: FinancialReadinessState;
  blockers: FinancialBlocker[];
  recommendation: string;
  risk: string;
  alternative: string;
  nextAction: string;
  nextSteps: string[];
  assumptionsUsed: FinancialReadinessAssumptions;
  lastEvaluatedAt: string;
}

export interface FinancialReadiness extends FinancialReadinessInputs, FinancialReadinessSummary {
  id: string;
  sessionId?: string | null;
  partnerId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type OfferPreparationState =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "INCOMPLETE"
  | "READY"
  | "BLOCKED";
export type OfferPreparationRiskLevel = "LOW_RISK" | "MODERATE_RISK" | "HIGH_RISK";
export type OfferPreparationCompletenessState = "not_started" | "partial" | "complete";
export type OfferPreparationContingency = "included" | "waived";
export type OfferPreparationDownPaymentType = "amount" | "percent";
export type OfferPreparationPossessionTiming = "at_closing" | "days_after_closing" | "custom";
export type OfferPreparationBlockerCode =
  | "FINANCIAL_READINESS_NOT_READY"
  | "OFFER_PRICE_ABOVE_AFFORDABILITY"
  | "INSUFFICIENT_CASH_FOR_OFFER"
  | "MISSING_REQUIRED_TERMS"
  | "INVALID_DOWN_PAYMENT"
  | "HIGH_RISK_CONTINGENCY_SETUP"
  | "INVALID_CLOSING_TIMELINE";

export interface OfferPreparationMissingItem {
  field: string;
  message: string;
}

export interface OfferPreparationBlocker {
  code: OfferPreparationBlockerCode;
  severity: "warning" | "blocking";
  message: string;
  whyItMatters: string;
  howToFix: string;
}

export interface OfferPreparationInputs {
  propertyId: string;
  propertyAddressLabel: string;
  shortlistId?: string | null;
  offerReadinessId?: string | null;
  financialReadinessId: string;
  offerPrice: number | null;
  earnestMoneyAmount: number | null;
  downPaymentType: OfferPreparationDownPaymentType | null;
  downPaymentAmount: number | null;
  downPaymentPercent: number | null;
  financingContingency: OfferPreparationContingency | null;
  inspectionContingency: OfferPreparationContingency | null;
  appraisalContingency: OfferPreparationContingency | null;
  closingTimelineDays: number | null;
  possessionTiming?: OfferPreparationPossessionTiming | null;
  possessionDaysAfterClosing?: number | null;
  sellerConcessionsRequestedAmount?: number | null;
  notes?: string | null;
  buyerRationale?: string | null;
}

export interface OfferPreparationFinancialAlignment {
  maxAffordableHomePrice: number | null;
  targetCashToClose: number | null;
  availableCashSavings: number | null;
  affordabilityClassification: AffordabilityClassification;
  readinessState: FinancialReadinessState;
  financiallyAligned: boolean;
  recommendedOfferPrice: number | null;
}

export interface OfferPreparationAssumptions {
  lowEarnestMoneyPercent: number;
  standardEarnestMoneyPercent: {
    min: number;
    max: number;
  };
  aggressiveClosingTimelineDays: number;
  slowClosingTimelineDays: number;
  affordabilityTolerancePercent: number;
}

export interface OfferPreparationSummary {
  offerSummary: {
    propertyId: string;
    propertyAddressLabel: string;
    offerPrice: number | null;
    earnestMoneyAmount: number | null;
    downPaymentAmount: number | null;
    downPaymentPercent: number | null;
    financingContingency: OfferPreparationContingency | null;
    inspectionContingency: OfferPreparationContingency | null;
    appraisalContingency: OfferPreparationContingency | null;
    closingTimelineDays: number | null;
    possessionTiming: OfferPreparationPossessionTiming | null;
  };
  offerState: OfferPreparationState;
  offerRiskLevel: OfferPreparationRiskLevel;
  offerCompletenessState: OfferPreparationCompletenessState;
  readinessToSubmit: boolean;
  cashRequiredAtOffer: number | null;
  missingItems: OfferPreparationMissingItem[];
  blockers: OfferPreparationBlocker[];
  recommendation: string;
  risk: string;
  alternative: string;
  nextAction: string;
  nextSteps: string[];
  financialAlignment: OfferPreparationFinancialAlignment;
  assumptionsUsed: OfferPreparationAssumptions;
  lastEvaluatedAt: string;
}

export type OfferPreparationStrategySuggestedField = "offerPrice" | "closingTimelineDays";

export interface OfferPreparationStrategyDefaultsProvenance {
  appliedAt: string;
  appliedFieldKeys: OfferPreparationStrategySuggestedField[];
  sourceSelectedItemId: string | null;
  sourceShortlistId: string | null;
  sourcePropertyId: string;
  sourceStrategyConfidence: OfferStrategyConfidence;
  sourceOfferPosture: OfferPosture;
  sourceRecommendedNextOfferAction: RecommendedNextOfferAction;
  sourceLastEvaluatedAt: string | null;
}

export interface OfferPreparation extends OfferPreparationInputs, OfferPreparationSummary {
  id: string;
  sessionId?: string | null;
  partnerId?: string | null;
  strategyDefaultsProvenance: OfferPreparationStrategyDefaultsProvenance | null;
  createdAt: string;
  updatedAt: string;
}

export type OfferSubmissionState =
  | "NOT_STARTED"
  | "READY_TO_SUBMIT"
  | "SUBMITTED"
  | "COUNTERED"
  | "ACCEPTED"
  | "REJECTED"
  | "EXPIRED"
  | "WITHDRAWN";

export type OfferSubmissionSellerResponseState =
  | "NO_RESPONSE"
  | "ACCEPTED"
  | "REJECTED"
  | "COUNTERED";

export type OfferSubmissionUrgencyLevel =
  | "LOW_URGENCY"
  | "MODERATE_URGENCY"
  | "HIGH_URGENCY";

export type OfferSubmissionMethod = "recorded_manual" | "simulated_delivery";
export type OfferSubmissionBuyerCounterDecision = "pending" | "accepted" | "rejected" | "revising";
export type OfferSubmissionBlockerCode =
  | "OFFER_PREPARATION_NOT_READY"
  | "MISSING_SUBMISSION_TIMESTAMP"
  | "INVALID_SELLER_RESPONSE"
  | "COUNTEROFFER_INCOMPLETE"
  | "COUNTEROFFER_EXPIRED"
  | "SUBMISSION_ALREADY_TERMINAL"
  | "INVALID_STATE_TRANSITION";

export interface OfferSubmissionMissingItem {
  field: string;
  message: string;
}

export interface OfferSubmissionBlocker {
  code: OfferSubmissionBlockerCode;
  severity: "warning" | "blocking";
  message: string;
  whyItMatters: string;
  howToFix: string;
}

export interface OfferSubmissionActivityEntry {
  type:
    | "record_created"
    | "offer_submitted"
    | "seller_accepted"
    | "seller_rejected"
    | "seller_countered"
    | "buyer_accepted_counter"
    | "buyer_rejected_counter"
    | "buyer_withdrew"
    | "offer_expired"
    | "note_added";
  label: string;
  details?: string | null;
  createdAt: string;
}

export interface OfferSubmissionCounterofferSummary {
  present: boolean;
  counterofferPrice: number | null;
  counterofferClosingTimelineDays: number | null;
  counterofferFinancingContingency: OfferPreparationContingency | null;
  counterofferInspectionContingency: OfferPreparationContingency | null;
  counterofferAppraisalContingency: OfferPreparationContingency | null;
  counterofferExpirationAt: string | null;
  changedFields: string[];
}

export interface OfferSubmissionOriginalOfferSnapshot {
  offerPrice: number | null;
  earnestMoneyAmount: number | null;
  downPaymentAmount: number | null;
  downPaymentPercent: number | null;
  financingContingency: OfferPreparationContingency | null;
  inspectionContingency: OfferPreparationContingency | null;
  appraisalContingency: OfferPreparationContingency | null;
  closingTimelineDays: number | null;
}

export interface OfferSubmissionInputs {
  propertyId: string;
  propertyAddressLabel: string;
  shortlistId?: string | null;
  financialReadinessId?: string | null;
  offerPreparationId: string;
  submissionMethod?: OfferSubmissionMethod | null;
  submittedAt?: string | null;
  offerExpirationAt?: string | null;
  sellerResponseState?: OfferSubmissionSellerResponseState | null;
  sellerRespondedAt?: string | null;
  buyerCounterDecision?: OfferSubmissionBuyerCounterDecision | null;
  withdrawnAt?: string | null;
  withdrawalReason?: string | null;
  counterofferPrice?: number | null;
  counterofferClosingTimelineDays?: number | null;
  counterofferFinancingContingency?: OfferPreparationContingency | null;
  counterofferInspectionContingency?: OfferPreparationContingency | null;
  counterofferAppraisalContingency?: OfferPreparationContingency | null;
  counterofferExpirationAt?: string | null;
  notes?: string | null;
  internalActivityNote?: string | null;
}

export interface OfferSubmissionSummary {
  submissionSummary: {
    propertyId: string;
    propertyAddressLabel: string;
    offerPreparationId: string;
    submittedAt: string | null;
    offerExpirationAt: string | null;
    currentOfferPrice: number | null;
    earnestMoneyAmount: number | null;
    closingTimelineDays: number | null;
  };
  submissionState: OfferSubmissionState;
  sellerResponseState: OfferSubmissionSellerResponseState;
  urgencyLevel: OfferSubmissionUrgencyLevel;
  counterofferSummary: OfferSubmissionCounterofferSummary;
  missingItems: OfferSubmissionMissingItem[];
  blockers: OfferSubmissionBlocker[];
  recommendation: string;
  risk: string;
  alternative: string;
  nextAction: string;
  nextSteps: string[];
  requiresBuyerResponse: boolean;
  isExpired: boolean;
  lastActionAt: string | null;
  lastEvaluatedAt: string;
}

export interface OfferSubmission extends OfferSubmissionInputs, OfferSubmissionSummary {
  id: string;
  sessionId?: string | null;
  partnerId?: string | null;
  originalOfferSnapshot: OfferSubmissionOriginalOfferSnapshot;
  activityLog: OfferSubmissionActivityEntry[];
  createdAt: string;
  updatedAt: string;
}

export type UnderContractCoordinationState =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "AT_RISK"
  | "READY_FOR_CLOSING"
  | "BLOCKED";

export type ContractTaskState =
  | "NOT_STARTED"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "BLOCKED"
  | "WAIVED"
  | "FAILED";

export type CoordinationRiskLevel = "LOW_RISK" | "MODERATE_RISK" | "HIGH_RISK";

export type ContractTaskType =
  | "HOME_INSPECTION"
  | "APPRAISAL"
  | "FINANCING_PROGRESS"
  | "TITLE_REVIEW"
  | "ESCROW_CLOSING_COORDINATION"
  | "CONTINGENCY_REVIEW"
  | "DOCUMENT_CHECKLIST";

export type CoordinationMilestoneType =
  | "OFFER_ACCEPTED"
  | "INSPECTION_SCHEDULED"
  | "INSPECTION_COMPLETED"
  | "APPRAISAL_ORDERED_OR_SCHEDULED"
  | "APPRAISAL_COMPLETED"
  | "FINANCING_PROGRESS_CONFIRMED"
  | "TITLE_ESCROW_IN_PROGRESS"
  | "CONTRACT_CONDITIONS_SATISFIED"
  | "READY_FOR_CLOSING";

export type CoordinationDeadlineKey =
  | "inspection"
  | "appraisal"
  | "financing"
  | "contingency"
  | "closing";

export type UnderContractBlockerCode =
  | "OFFER_NOT_ACCEPTED"
  | "MISSING_REQUIRED_DEADLINE"
  | "FINANCING_BLOCKED"
  | "TITLE_BLOCKED"
  | "ESCROW_BLOCKED"
  | "CONTINGENCY_DEADLINE_MISSED"
  | "CLOSING_DATE_AT_RISK"
  | "REQUIRED_TASK_FAILED"
  | "MISSING_REQUIRED_TASK_DATA";

export interface ContractTaskRecord {
  taskType: ContractTaskType;
  label: string;
  status: ContractTaskState;
  required: boolean;
  waivable: boolean;
  deadline: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  blockedReason: string | null;
  notes: string | null;
}

export interface CoordinationMilestoneRecord {
  milestoneType: CoordinationMilestoneType;
  label: string;
  status: "PENDING" | "REACHED" | "BLOCKED";
  occurredAt: string | null;
  notes: string | null;
}

export interface CoordinationDeadlineRecord {
  key: CoordinationDeadlineKey;
  label: string;
  deadline: string | null;
  status: "NORMAL" | "APPROACHING" | "DUE_SOON" | "MISSED";
  relatedTaskType?: ContractTaskType | null;
}

export interface UnderContractBlocker {
  code: UnderContractBlockerCode;
  severity: "warning" | "blocking";
  message: string;
  whyItMatters: string;
  howToFix: string;
}

export interface UnderContractCoordinationActivityEntry {
  type:
    | "record_created"
    | "task_updated"
    | "milestone_reached"
    | "deadline_updated"
    | "ready_for_closing"
    | "blocked"
    | "note_added";
  label: string;
  details?: string | null;
  createdAt: string;
}

export interface UnderContractCoordinationInputs {
  propertyId: string;
  propertyAddressLabel: string;
  shortlistId?: string | null;
  financialReadinessId?: string | null;
  offerPreparationId?: string | null;
  offerSubmissionId: string;
  acceptedAt: string;
  targetClosingDate: string;
  inspectionDeadline: string | null;
  appraisalDeadline: string | null;
  financingDeadline: string | null;
  contingencyDeadline: string | null;
  closingPreparationDeadline?: string | null;
  notes?: string | null;
  internalActivityNote?: string | null;
}

export interface UnderContractCoordinationSummary {
  coordinationSummary: {
    propertyId: string;
    propertyAddressLabel: string;
    offerSubmissionId: string;
    acceptedAt: string;
    targetClosingDate: string;
  };
  overallCoordinationState: UnderContractCoordinationState;
  overallRiskLevel: CoordinationRiskLevel;
  urgencyLevel: CoordinationRiskLevel;
  readyForClosing: boolean;
  requiresImmediateAttention: boolean;
  taskSummaries: ContractTaskRecord[];
  milestoneSummaries: CoordinationMilestoneRecord[];
  deadlineSummaries: CoordinationDeadlineRecord[];
  missingItems: Array<{
    field: string;
    message: string;
  }>;
  blockers: UnderContractBlocker[];
  recommendation: string;
  risk: string;
  alternative: string;
  nextAction: string;
  nextSteps: string[];
  lastActionAt: string | null;
  lastEvaluatedAt: string;
}

export interface UnderContractCoordination extends UnderContractCoordinationInputs, UnderContractCoordinationSummary {
  id: string;
  sessionId?: string | null;
  partnerId?: string | null;
  activityLog: UnderContractCoordinationActivityEntry[];
  createdAt: string;
  updatedAt: string;
}

export type ClosingReadinessState =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "AT_RISK"
  | "READY_TO_CLOSE"
  | "BLOCKED"
  | "CLOSED";

export type ClosingChecklistItemState =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "READY"
  | "COMPLETED"
  | "BLOCKED"
  | "FAILED"
  | "WAIVED";

export type ClosingRiskLevel = "LOW_RISK" | "MODERATE_RISK" | "HIGH_RISK";

export type ClosingChecklistItemType =
  | "CASH_TO_CLOSE_CONFIRMED"
  | "FINAL_FUNDS_AVAILABLE"
  | "CLOSING_NUMBERS_REVIEWED"
  | "REQUIRED_CLOSING_DOCUMENTS_READY"
  | "TITLE_SETTLEMENT_READY"
  | "CLOSING_APPOINTMENT_SCHEDULED"
  | "IDENTITY_SIGNER_READY"
  | "FINAL_WALKTHROUGH_COMPLETE";

export type ClosingMilestoneType =
  | "READY_FOR_CLOSING_RECEIVED"
  | "FINAL_FUNDS_CONFIRMED"
  | "FINAL_CHECKLIST_SUBSTANTIALLY_COMPLETE"
  | "CLOSING_APPOINTMENT_SCHEDULED"
  | "READY_TO_CLOSE"
  | "CLOSED";

export type ClosingBlockerCode =
  | "UNDER_CONTRACT_NOT_READY"
  | "MISSING_REQUIRED_DATE"
  | "FINAL_FUNDS_NOT_READY"
  | "CLOSING_NUMBERS_NOT_REVIEWED"
  | "DOCUMENTS_NOT_READY"
  | "TITLE_SETTLEMENT_BLOCKED"
  | "APPOINTMENT_NOT_SCHEDULED"
  | "IDENTITY_NOT_READY"
  | "TARGET_CLOSING_DATE_MISSED"
  | "REQUIRED_CHECKLIST_ITEM_FAILED";

export interface ClosingChecklistItemRecord {
  itemType: ClosingChecklistItemType;
  label: string;
  status: ClosingChecklistItemState;
  required: boolean;
  waivable: boolean;
  deadline: string | null;
  completedAt: string | null;
  blockedReason?: string | null;
  notes?: string | null;
}

export interface ClosingMilestoneRecord {
  milestoneType: ClosingMilestoneType;
  label: string;
  status: "PENDING" | "REACHED" | "BLOCKED";
  occurredAt: string | null;
  notes?: string | null;
}

export interface ClosingBlocker {
  code: ClosingBlockerCode;
  severity: "warning" | "blocking";
  message: string;
  whyItMatters: string;
  howToFix: string;
}

export interface ClosingReadinessActivityEntry {
  type:
    | "record_created"
    | "checklist_updated"
    | "milestone_reached"
    | "appointment_updated"
    | "ready_to_close"
    | "closed"
    | "blocked"
    | "note_added";
  label: string;
  details?: string | null;
  createdAt: string;
}

export interface ClosingReadinessInputs {
  propertyId: string;
  propertyAddressLabel: string;
  shortlistId?: string | null;
  financialReadinessId?: string | null;
  offerPreparationId?: string | null;
  offerSubmissionId?: string | null;
  underContractCoordinationId: string;
  targetClosingDate: string;
  closingAppointmentAt?: string | null;
  closingAppointmentLocation?: string | null;
  closingAppointmentNotes?: string | null;
  finalReviewDeadline?: string | null;
  finalFundsConfirmationDeadline?: string | null;
  finalFundsAmountConfirmed?: number | null;
  closedAt?: string | null;
  notes?: string | null;
  internalActivityNote?: string | null;
}

export interface ClosingReadinessSummary {
  closingSummary: {
    propertyId: string;
    propertyAddressLabel: string;
    underContractCoordinationId: string;
    targetClosingDate: string;
    closingAppointmentAt: string | null;
    closedAt?: string | null;
  };
  overallClosingReadinessState: ClosingReadinessState;
  overallRiskLevel: ClosingRiskLevel;
  urgencyLevel: ClosingRiskLevel;
  readyToClose: boolean;
  closed: boolean;
  checklistItemSummaries: ClosingChecklistItemRecord[];
  milestoneSummaries: ClosingMilestoneRecord[];
  missingItems: Array<{
    field: string;
    message: string;
  }>;
  blockers: ClosingBlocker[];
  recommendation: string;
  risk: string;
  alternative: string;
  nextAction: string;
  nextSteps: string[];
  requiresImmediateAttention: boolean;
  lastActionAt: string | null;
  lastEvaluatedAt: string;
}

export interface ClosingReadiness extends ClosingReadinessInputs, ClosingReadinessSummary {
  id: string;
  sessionId?: string | null;
  partnerId?: string | null;
  activityLog: ClosingReadinessActivityEntry[];
  createdAt: string;
  updatedAt: string;
}

export type TransactionStage =
  | "FINANCIAL_READINESS"
  | "OFFER_PREPARATION"
  | "OFFER_SUBMISSION"
  | "UNDER_CONTRACT"
  | "CLOSING_READINESS"
  | "CLOSED";

export type TransactionOverallState =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "AT_RISK"
  | "READY_TO_ADVANCE"
  | "COMPLETE";

export type TransactionRiskLevel = "LOW_RISK" | "MODERATE_RISK" | "HIGH_RISK";

export interface CommandCenterStageSummary {
  stage: TransactionStage;
  label: string;
  status: string;
  completed: boolean;
  available: boolean;
  blockerCount: number;
  riskLevel: TransactionRiskLevel;
  nextAction: string | null;
  lastUpdatedAt: string | null;
}

export interface CommandCenterBlocker {
  code: string;
  sourceStage: TransactionStage;
  severity: "warning" | "blocking";
  message: string;
  whyItMatters: string;
  howToFix: string;
}

export interface CommandCenterRisk {
  code: string;
  sourceStage: TransactionStage;
  level: TransactionRiskLevel;
  message: string;
  dueAt?: string | null;
}

export interface CommandCenterKeyDate {
  key: string;
  label: string;
  date: string;
  sourceStage: TransactionStage;
  status: "UPCOMING" | "DUE_SOON" | "PAST_DUE" | "COMPLETED";
}

export interface CommandCenterActivityItem {
  id: string;
  type: string;
  label: string;
  occurredAt: string;
  sourceStage: TransactionStage;
}

export interface CommandCenterSourceRefs {
  financialReadinessId?: string | null;
  offerPreparationId?: string | null;
  offerSubmissionId?: string | null;
  underContractCoordinationId?: string | null;
  closingReadinessId?: string | null;
}

export interface BuyerTransactionCommandCenterView {
  propertyId: string;
  propertyAddressLabel: string;
  sessionId?: string | null;
  shortlistId?: string | null;
  currentStage: TransactionStage;
  overallState: TransactionOverallState;
  overallRiskLevel: TransactionRiskLevel;
  progressPercent: number;
  completedStageCount: number;
  totalStageCount: number;
  primaryBlocker: CommandCenterBlocker | null;
  activeBlockers: CommandCenterBlocker[];
  primaryRisk: CommandCenterRisk | null;
  topRisks: CommandCenterRisk[];
  nextAction: string;
  nextSteps: string[];
  keyDates: CommandCenterKeyDate[];
  recentActivity: CommandCenterActivityItem[];
  stageSummaries: CommandCenterStageSummary[];
  sourceRefs: CommandCenterSourceRefs;
  isStale: boolean;
  lastUpdatedAt: string | null;
  createdAt: string | null;
}

export type ExplanationCategory =
  | "STATE_EXPLANATION"
  | "BLOCKER_EXPLANATION"
  | "RISK_EXPLANATION"
  | "RECOMMENDATION_EXPLANATION"
  | "ALTERNATIVE_EXPLANATION"
  | "NEXT_ACTION_EXPLANATION"
  | "STAGE_RESOLUTION_EXPLANATION";

export type ExplanationModuleName =
  | "financial_readiness"
  | "offer_preparation"
  | "offer_submission"
  | "under_contract"
  | "closing_readiness"
  | "transaction_command_center";

export interface ExplanationInputAttribution {
  key: string;
  label: string;
  value: string | number | boolean | null;
  sourceType: "raw_input" | "derived_value" | "dependency_state" | "deadline" | "threshold";
}

export interface ExplanationConditionReference {
  key: string;
  label: string;
  value: string | number | boolean | null;
}

export interface ExplanationReasonItem {
  label: string;
  detail: string;
}

export interface ExplanationChangeImpactItem {
  action: string;
  effect: string;
}

export interface DecisionExplanation {
  id: string;
  subjectType: string;
  subjectId: string;
  moduleName: ExplanationModuleName;
  category: ExplanationCategory;
  summary: string;
  decisionRuleLabel: string;
  contributingInputs: ExplanationInputAttribution[];
  conditionReferences: ExplanationConditionReference[];
  reasonItems: ExplanationReasonItem[];
  whatToChange: ExplanationChangeImpactItem[];
  workflowActivityId?: string | null;
  generatedAt: string;
  stale: boolean;
}

export interface DecisionExplanationBundle {
  subjectType: string;
  subjectId: string;
  moduleName: ExplanationModuleName;
  explanations: DecisionExplanation[];
  generatedAt: string;
}

export type NotificationModuleName =
  | "financial_readiness"
  | "offer_preparation"
  | "offer_submission"
  | "under_contract"
  | "closing_readiness"
  | "transaction_command_center";

export type AlertCategory =
  | "REQUIRED_ACTION"
  | "DEADLINE_ALERT"
  | "STATE_CHANGE"
  | "BLOCKER_ALERT"
  | "RISK_ALERT"
  | "MILESTONE_ALERT"
  | "REMINDER";

export type NotificationSeverity = "INFO" | "WARNING" | "CRITICAL";

export type NotificationStatus = "UNREAD" | "READ" | "DISMISSED" | "RESOLVED";

export interface NotificationActionTarget {
  type: "route" | "module" | "subject";
  path?: string | null;
  moduleName?: NotificationModuleName | null;
  subjectType?: string | null;
  subjectId?: string | null;
}

export interface WorkflowNotification {
  id: string;
  workflowId?: string | null;
  sessionId?: string | null;
  propertyId?: string | null;
  propertyAddressLabel?: string | null;
  shortlistId?: string | null;
  moduleName: NotificationModuleName;
  alertCategory: AlertCategory;
  severity: NotificationSeverity;
  status: NotificationStatus;
  triggeringRuleLabel: string;
  relatedSubjectType: string;
  relatedSubjectId: string;
  title: string;
  message: string;
  actionLabel: string | null;
  actionTarget: NotificationActionTarget | null;
  dueAt: string | null;
  readAt: string | null;
  dismissedAt: string | null;
  resolvedAt: string | null;
  explanationSubjectType?: string | null;
  explanationSubjectId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowNotificationHistoryEvent {
  id: string;
  notificationId: string;
  eventType: "CREATED" | "READ" | "DISMISSED" | "RESOLVED" | "SEVERITY_CHANGED";
  previousValue: string | null;
  nextValue: string | null;
  createdAt: string;
}

export type UnifiedActivityModuleName =
  | "financial_readiness"
  | "offer_preparation"
  | "offer_submission"
  | "under_contract"
  | "closing_readiness"
  | "transaction_command_center"
  | "notification_alerting"
  | "decision_explainability";

export type UnifiedActivityEventCategory =
  | "RECORD_CREATED"
  | "RECORD_UPDATED"
  | "STATE_CHANGED"
  | "BLOCKER_CREATED"
  | "BLOCKER_RESOLVED"
  | "RISK_CHANGED"
  | "RECOMMENDATION_CHANGED"
  | "NEXT_ACTION_CHANGED"
  | "DEADLINE_APPROACHING"
  | "DEADLINE_MISSED"
  | "MILESTONE_REACHED"
  | "NOTIFICATION_CREATED"
  | "NOTIFICATION_READ"
  | "NOTIFICATION_DISMISSED"
  | "NOTIFICATION_RESOLVED"
  | "EXPLANATION_GENERATED"
  | "COMMAND_CENTER_STATUS_CHANGED";

export type UnifiedActivityTriggerType =
  | "USER_ACTION"
  | "SYSTEM_RULE"
  | "DERIVED_RECALCULATION"
  | "DEADLINE_RULE"
  | "STATUS_TRANSITION";

export type UnifiedActivityActorType = "USER" | "SYSTEM";

export interface UnifiedActivityRecord {
  id: string;
  workflowId?: string | null;
  sessionId?: string | null;
  propertyId?: string | null;
  propertyAddressLabel?: string | null;
  shortlistId?: string | null;
  moduleName: UnifiedActivityModuleName;
  eventCategory: UnifiedActivityEventCategory;
  subjectType: string;
  subjectId: string;
  title: string;
  summary: string;
  oldValueSnapshot?: Record<string, unknown> | null;
  newValueSnapshot?: Record<string, unknown> | null;
  triggerType: UnifiedActivityTriggerType;
  triggerLabel: string;
  actorType: UnifiedActivityActorType;
  actorId?: string | null;
  relatedNotificationId?: string | null;
  relatedExplanationId?: string | null;
  createdAt: string;
}

export type OfferReadinessStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "READY"
  | "BLOCKED"
  | "OFFER_SUBMITTED";
export type OfferFinancingReadiness = "not_started" | "preapproved" | "cash_ready";
export type OfferPropertyFitConfidence = "not_assessed" | "low" | "medium" | "high";
export type OfferRiskToleranceAlignment = "not_reviewed" | "partial" | "aligned";
export type OfferRiskLevel = "conservative" | "balanced" | "competitive";

export interface OfferReadinessInputs {
  financingReadiness: OfferFinancingReadiness;
  propertyFitConfidence: OfferPropertyFitConfidence;
  riskToleranceAlignment: OfferRiskToleranceAlignment;
  riskLevel: OfferRiskLevel;
  userConfirmed: boolean;
  dataCompletenessScore: number;
}

export interface OfferReadiness {
  id: string;
  propertyId: string;
  shortlistId: string;
  shortlistItemId?: string | null;
  status: OfferReadinessStatus;
  readinessScore: number;
  recommendedOfferPrice: number;
  confidence: SafetyConfidence;
  inputs: OfferReadinessInputs;
  blockingIssues: string[];
  nextSteps: string[];
  lastEvaluatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfferReadinessRecommendation {
  propertyId: string;
  shortlistId: string;
  readinessScore: number;
  recommendedOfferPrice: number;
  confidence: SafetyConfidence;
  blockingIssues: string[];
  nextSteps: string[];
}

export type NegotiationStatus =
  | "NOT_STARTED"
  | "DRAFTING_OFFER"
  | "OFFER_MADE"
  | "COUNTER_RECEIVED"
  | "BUYER_REVIEWING"
  | "COUNTER_SENT"
  | "ACCEPTED"
  | "REJECTED"
  | "WITHDRAWN"
  | "EXPIRED";

export type NegotiationEventType =
  | "NEGOTIATION_STARTED"
  | "INITIAL_OFFER_SET"
  | "OFFER_SUBMITTED"
  | "SELLER_COUNTER_RECEIVED"
  | "BUYER_COUNTER_SENT"
  | "BUYER_ACCEPTED"
  | "BUYER_REJECTED"
  | "SELLER_ACCEPTED"
  | "SELLER_REJECTED"
  | "NEGOTIATION_WITHDRAWN"
  | "NEGOTIATION_EXPIRED"
  | "NOTE_ADDED";

export type NegotiationGuidanceRiskLevel = "low" | "medium" | "high";

export interface NegotiationGuidance {
  headline: string;
  riskLevel: NegotiationGuidanceRiskLevel;
  nextSteps: string[];
  flags: string[];
}

export interface NegotiationRecord {
  id: string;
  propertyId: string;
  shortlistId?: string | null;
  offerReadinessId?: string | null;
  status: NegotiationStatus;
  initialOfferPrice: number;
  currentOfferPrice: number;
  sellerCounterPrice?: number | null;
  buyerWalkAwayPrice?: number | null;
  roundNumber: number;
  guidance: NegotiationGuidance;
  lastActionAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface NegotiationEvent {
  id: string;
  negotiationRecordId: string;
  type: NegotiationEventType;
  label: string;
  details?: string | null;
  createdAt: string;
}

export interface NegotiationSummary {
  propertyId: string;
  shortlistId?: string | null;
  status: NegotiationStatus;
  currentOfferPrice: number;
  sellerCounterPrice?: number | null;
  buyerWalkAwayPrice?: number | null;
  roundNumber: number;
  lastActionAt: string;
  keyRisks: string[];
  nextSteps: string[];
  guidance: NegotiationGuidance;
}

export type ChoiceStatus =
  | "candidate"
  | "backup"
  | "selected"
  | "active_pursuit"
  | "under_contract"
  | "closed"
  | "dropped"
  | "replaced";

export type DecisionStage =
  | "considering"
  | "selected_choice"
  | "offer_pursuit"
  | "contract_to_close"
  | "finished";

export type DecisionConfidence = "low" | "medium" | "high" | "confirmed";

export type DroppedReason =
  | "better_alternative_selected"
  | "financial_mismatch"
  | "property_fit_changed"
  | "market_status_changed"
  | "seller_terms_unfavorable"
  | "inspection_or_disclosure_concern"
  | "buyer_preference_changed"
  | "deal_fell_through"
  | "duplicate_or_invalid"
  | "other";

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
  choiceStatus: ChoiceStatus;
  selectionRank?: number | null;
  decisionConfidence?: DecisionConfidence | null;
  decisionRationale?: string | null;
  decisionRisks: string[];
  lastDecisionReviewedAt?: string | null;
  selectedAt?: string | null;
  statusChangedAt: string;
  replacedByShortlistItemId?: string | null;
  droppedReason?: DroppedReason | null;
  addedAt: string;
  updatedAt: string;
}

export interface SelectedChoiceView {
  shortlistId: string;
  selectedItem: ShortlistItem | null;
  backups: ShortlistItem[];
  candidates: ShortlistItem[];
  terminalItems: ShortlistItem[];
}

export interface SelectedChoiceConciergeSummary {
  shortlistId: string;
  selectedItemId: string | null;
  hasSelectedChoice: boolean;
  choiceStatus: ChoiceStatus | "none";
  decisionStage: DecisionStage | "none";
  property: {
    shortlistItemId: string;
    canonicalPropertyId: string;
    address: string;
    city: string;
    state: string;
    price: number;
    nhaloScore: number;
    overallConfidence: ScoredHome["scores"]["overallConfidence"];
    capturedHome: ScoredHome;
  } | null;
  decision: {
    selectionRank: number | null;
    backupCount: number;
    decisionConfidence: DecisionConfidence | null;
    decisionRationale: string | null;
    decisionRisks: string[];
    lastDecisionReviewedAt: string | null;
    selectedAt: string | null;
    statusChangedAt: string | null;
    droppedReason: DroppedReason | null;
    replacedByShortlistItemId: string | null;
  };
  readiness: {
    financialReadinessId: string | null;
    financialReadinessState: FinancialReadinessState | null;
    affordabilityClassification: AffordabilityClassification | null;
    offerReadinessId: string | null;
    offerReadinessStatus: OfferReadinessStatus | null;
    offerReadinessScore: number | null;
    recommendedOfferPrice: number | null;
    offerRecommendationConfidence: OfferReadiness["confidence"] | null;
  };
  workflow: {
    offerPreparationId: string | null;
    offerPreparationState: OfferPreparationState | null;
    offerSubmissionId: string | null;
    offerSubmissionState: OfferSubmissionState | null;
    negotiationId: string | null;
    negotiationStatus: NegotiationStatus | null;
    underContractCoordinationId: string | null;
    underContractState: UnderContractCoordinationState | null;
    closingReadinessId: string | null;
    closingReadinessState: ClosingReadinessState | null;
    transactionCommandCenter: BuyerTransactionCommandCenterView | null;
  };
  alerts: {
    unreadCount: number;
    criticalCount: number;
    warningCount: number;
    notifications: WorkflowNotification[];
  };
  offerStrategy: SelectedChoiceOfferStrategy | null;
  concierge: {
    headline: string;
    recommendationSummary: string;
    nextAction: string;
    nextSteps: string[];
    topRisks: string[];
    blockers: string[];
    sourceModule:
      | "selected_choice"
      | "financial_readiness"
      | "offer_readiness"
      | "offer_preparation"
      | "offer_submission"
      | "negotiation"
      | "under_contract"
      | "closing_readiness"
      | "transaction_command_center";
    lastUpdatedAt: string | null;
  };
}

export type OfferStrategyConfidence = "high" | "medium" | "low";
export type OfferPosture =
  | "not_ready"
  | "verify_before_offering"
  | "prepare_disciplined_offer"
  | "prepare_competitive_offer"
  | "hold_and_monitor"
  | "do_not_advance";
export type OfferUrgencyLevel = "blocked" | "low" | "medium" | "high";
export type ConcessionStrategy =
  | "keep_terms_clean"
  | "limit_concession_requests"
  | "case_by_case"
  | "defer_until_more_certain";
export type RecommendedNextOfferAction =
  | "complete_financial_readiness"
  | "complete_offer_readiness"
  | "review_market_inputs"
  | "draft_disciplined_offer"
  | "draft_competitive_offer"
  | "hold_and_monitor"
  | "do_not_advance";

export interface SelectedChoiceOfferStrategy {
  strategyConfidence: OfferStrategyConfidence;
  offerPosture: OfferPosture;
  urgencyLevel: OfferUrgencyLevel;
  concessionStrategy: ConcessionStrategy;
  recommendedNextOfferAction: RecommendedNextOfferAction;
  pricePosition: {
    listPrice: number | null;
    recommendedOfferPrice: number | null;
    pricePerSqft: number | null;
    medianPricePerSqft: number | null;
    versusList: "below_list" | "at_list" | "above_list" | "unknown";
    versusMarket: "discount_to_market" | "near_market" | "premium_to_market" | "unknown";
  };
  marketContext: {
    listingStatus: ListingStatus | null;
    daysOnMarket: number | null;
    comparableSampleSize: number | null;
    comparableStrategyUsed: string | null;
    overallConfidence: ScoredHome["scores"]["overallConfidence"] | null;
    listingDataSource: ListingDataSource | null;
    limitedComparables: boolean;
  };
  marketRisks: string[];
  strategyRationale: string[];
  lastEvaluatedAt: string | null;
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
  | "financial_readiness_created"
  | "financial_readiness_updated"
  | "financial_readiness_status_changed"
  | "offer_preparation_created"
  | "offer_preparation_updated"
  | "offer_preparation_status_changed"
  | "offer_submission_created"
  | "offer_submission_submitted"
  | "offer_submission_countered"
  | "offer_submission_accepted"
  | "offer_submission_rejected"
  | "offer_submission_withdrawn"
  | "offer_submission_expired"
  | "under_contract_created"
  | "under_contract_task_updated"
  | "under_contract_milestone_reached"
  | "under_contract_blocked"
  | "under_contract_ready_for_closing"
  | "closing_readiness_created"
  | "closing_checklist_updated"
  | "closing_milestone_reached"
  | "closing_blocked"
  | "closing_ready_to_close"
  | "closing_completed"
  | "shortlist_created"
  | "shortlist_updated"
  | "shortlist_deleted"
  | "shortlist_item_added"
  | "shortlist_item_removed"
  | "selected_choice_marked"
  | "selected_choice_replaced"
  | "selected_choice_dropped"
  | "selected_choice_backup_reordered"
  | "selected_choice_rationale_updated"
  | "selected_choice_reviewed"
  | "offer_readiness_created"
  | "offer_readiness_updated"
  | "offer_status_changed"
  | "negotiation_started"
  | "offer_submitted"
  | "counter_received"
  | "counter_sent"
  | "negotiation_accepted"
  | "negotiation_rejected"
  | "negotiation_withdrawn"
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
  offerPreparationId?: string | null;
  offerSubmissionId?: string | null;
  underContractId?: string | null;
  closingReadinessId?: string | null;
  offerReadinessId?: string | null;
  negotiationRecordId?: string | null;
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
  | "selected_choice_marked"
  | "selected_choice_replaced"
  | "selected_choice_dropped"
  | "selected_choice_backup_reordered"
  | "selected_choice_rationale_updated"
  | "selected_choice_reviewed"
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
  listingStatus?: ListingStatus | null;
  daysOnMarket?: number | null;
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
  createFinancialReadiness(payload: {
    sessionId?: string | null;
    partnerId?: string | null;
    annualHouseholdIncome: number | null;
    monthlyDebtPayments: number | null;
    availableCashSavings: number | null;
    creditScoreRange: CreditScoreRange | null;
    desiredHomePrice: number | null;
    purchaseLocation: string | null;
    downPaymentPreferencePercent?: number | null;
    loanType?: LoanType | null;
    preApprovalStatus: PreApprovalStatus | null;
    preApprovalExpiresAt?: string | null;
    proofOfFundsStatus: ProofOfFundsStatus | null;
  }): Promise<FinancialReadiness>;
  getFinancialReadiness(id: string): Promise<FinancialReadiness | null>;
  getLatestFinancialReadiness(sessionId?: string | null): Promise<FinancialReadiness | null>;
  updateFinancialReadiness(
    id: string,
    patch: {
      annualHouseholdIncome?: number | null;
      monthlyDebtPayments?: number | null;
      availableCashSavings?: number | null;
      creditScoreRange?: CreditScoreRange | null;
      desiredHomePrice?: number | null;
      purchaseLocation?: string | null;
      downPaymentPreferencePercent?: number | null;
      loanType?: LoanType | null;
      preApprovalStatus?: PreApprovalStatus | null;
      preApprovalExpiresAt?: string | null;
      proofOfFundsStatus?: ProofOfFundsStatus | null;
    }
  ): Promise<FinancialReadiness | null>;
  getFinancialReadinessSummary(id: string): Promise<FinancialReadinessSummary | null>;
  createOfferPreparation(
    payload: OfferPreparationInputs & {
      sessionId?: string | null;
      partnerId?: string | null;
    }
  ): Promise<OfferPreparation | null>;
  listOfferPreparations(shortlistId: string): Promise<OfferPreparation[]>;
  getOfferPreparation(id: string): Promise<OfferPreparation | null>;
  getLatestOfferPreparation(payload: {
    propertyId: string;
    shortlistId?: string | null;
    sessionId?: string | null;
  }): Promise<OfferPreparation | null>;
  updateOfferPreparation(
    id: string,
    patch: {
      propertyAddressLabel?: string;
      offerPrice?: number | null;
      earnestMoneyAmount?: number | null;
      downPaymentType?: OfferPreparationDownPaymentType | null;
      downPaymentAmount?: number | null;
      downPaymentPercent?: number | null;
      financingContingency?: OfferPreparationContingency | null;
      inspectionContingency?: OfferPreparationContingency | null;
      appraisalContingency?: OfferPreparationContingency | null;
      closingTimelineDays?: number | null;
      possessionTiming?: OfferPreparationPossessionTiming | null;
      possessionDaysAfterClosing?: number | null;
      sellerConcessionsRequestedAmount?: number | null;
      notes?: string | null;
      buyerRationale?: string | null;
    }
  ): Promise<OfferPreparation | null>;
  getOfferPreparationSummary(id: string): Promise<OfferPreparationSummary | null>;
  createOfferSubmission(
    payload: OfferSubmissionInputs & {
      sessionId?: string | null;
      partnerId?: string | null;
    }
  ): Promise<OfferSubmission | null>;
  listOfferSubmissions(shortlistId: string): Promise<OfferSubmission[]>;
  getOfferSubmission(id: string): Promise<OfferSubmission | null>;
  getLatestOfferSubmission(payload: {
    propertyId: string;
    shortlistId?: string | null;
    sessionId?: string | null;
  }): Promise<OfferSubmission | null>;
  submitOfferSubmission(id: string, submittedAt?: string | null): Promise<OfferSubmission | null>;
  updateOfferSubmission(
    id: string,
    patch: {
      submissionMethod?: OfferSubmissionMethod | null;
      offerExpirationAt?: string | null;
      sellerResponseState?: OfferSubmissionSellerResponseState | null;
      sellerRespondedAt?: string | null;
      buyerCounterDecision?: OfferSubmissionBuyerCounterDecision | null;
      withdrawnAt?: string | null;
      withdrawalReason?: string | null;
      counterofferPrice?: number | null;
      counterofferClosingTimelineDays?: number | null;
      counterofferFinancingContingency?: OfferPreparationContingency | null;
      counterofferInspectionContingency?: OfferPreparationContingency | null;
      counterofferAppraisalContingency?: OfferPreparationContingency | null;
      counterofferExpirationAt?: string | null;
      notes?: string | null;
      internalActivityNote?: string | null;
    }
  ): Promise<OfferSubmission | null>;
  respondToOfferSubmissionCounter(
    id: string,
    decision: OfferSubmissionBuyerCounterDecision
  ): Promise<OfferSubmission | null>;
  getOfferSubmissionSummary(id: string): Promise<OfferSubmissionSummary | null>;
  createUnderContractCoordination(
    payload: UnderContractCoordinationInputs & {
      sessionId?: string | null;
      partnerId?: string | null;
    }
  ): Promise<UnderContractCoordination | null>;
  listUnderContractCoordinations(shortlistId: string): Promise<UnderContractCoordination[]>;
  getUnderContractCoordination(id: string): Promise<UnderContractCoordination | null>;
  getLatestUnderContractCoordination(payload: {
    propertyId: string;
    shortlistId?: string | null;
    sessionId?: string | null;
  }): Promise<UnderContractCoordination | null>;
  updateUnderContractCoordination(
    id: string,
    patch: {
      targetClosingDate?: string | null;
      inspectionDeadline?: string | null;
      appraisalDeadline?: string | null;
      financingDeadline?: string | null;
      contingencyDeadline?: string | null;
      closingPreparationDeadline?: string | null;
      notes?: string | null;
      internalActivityNote?: string | null;
    }
  ): Promise<UnderContractCoordination | null>;
  updateUnderContractTask(
    id: string,
    taskType: ContractTaskType,
    patch: {
      status?: ContractTaskState;
      deadline?: string | null;
      scheduledAt?: string | null;
      completedAt?: string | null;
      blockedReason?: string | null;
      notes?: string | null;
    }
  ): Promise<UnderContractCoordination | null>;
  updateUnderContractMilestone(
    id: string,
    milestoneType: CoordinationMilestoneType,
    patch: {
      status?: "PENDING" | "REACHED" | "BLOCKED";
      occurredAt?: string | null;
      notes?: string | null;
    }
  ): Promise<UnderContractCoordination | null>;
  getUnderContractCoordinationSummary(id: string): Promise<UnderContractCoordinationSummary | null>;
  createClosingReadiness(
    payload: ClosingReadinessInputs & {
      sessionId?: string | null;
      partnerId?: string | null;
    }
  ): Promise<ClosingReadiness | null>;
  listClosingReadiness(shortlistId: string): Promise<ClosingReadiness[]>;
  getClosingReadiness(id: string): Promise<ClosingReadiness | null>;
  getLatestClosingReadiness(payload: {
    propertyId: string;
    shortlistId?: string | null;
    sessionId?: string | null;
  }): Promise<ClosingReadiness | null>;
  updateClosingReadiness(
    id: string,
    patch: {
      targetClosingDate?: string | null;
      closingAppointmentAt?: string | null;
      closingAppointmentLocation?: string | null;
      closingAppointmentNotes?: string | null;
      finalReviewDeadline?: string | null;
      finalFundsConfirmationDeadline?: string | null;
      finalFundsAmountConfirmed?: number | null;
      notes?: string | null;
      internalActivityNote?: string | null;
    }
  ): Promise<ClosingReadiness | null>;
  updateClosingChecklistItem(
    id: string,
    itemType: ClosingChecklistItemType,
    patch: {
      status?: ClosingChecklistItemState;
      deadline?: string | null;
      completedAt?: string | null;
      blockedReason?: string | null;
      notes?: string | null;
    }
  ): Promise<ClosingReadiness | null>;
  updateClosingMilestone(
    id: string,
    milestoneType: ClosingMilestoneType,
    patch: {
      status?: "PENDING" | "REACHED" | "BLOCKED";
      occurredAt?: string | null;
      notes?: string | null;
    }
  ): Promise<ClosingReadiness | null>;
  markClosingReady(id: string): Promise<ClosingReadiness | null>;
  markClosingComplete(id: string, closedAt?: string | null): Promise<ClosingReadiness | null>;
  getClosingReadinessSummary(id: string): Promise<ClosingReadinessSummary | null>;
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
  createOfferReadiness(payload: {
    shortlistId: string;
    propertyId: string;
    status?: OfferReadinessStatus;
    financingReadiness?: OfferFinancingReadiness;
    propertyFitConfidence?: OfferPropertyFitConfidence;
    riskToleranceAlignment?: OfferRiskToleranceAlignment;
    riskLevel?: OfferRiskLevel;
    userConfirmed?: boolean;
  }): Promise<OfferReadiness | null>;
  listOfferReadiness(shortlistId: string): Promise<OfferReadiness[]>;
  getOfferReadiness(propertyId: string, shortlistId?: string): Promise<OfferReadiness | null>;
  updateOfferReadiness(
    id: string,
    patch: {
      status?: OfferReadinessStatus;
      financingReadiness?: OfferFinancingReadiness;
      propertyFitConfidence?: OfferPropertyFitConfidence;
      riskToleranceAlignment?: OfferRiskToleranceAlignment;
      riskLevel?: OfferRiskLevel;
      userConfirmed?: boolean;
    }
  ): Promise<OfferReadiness | null>;
  getOfferReadinessRecommendation(
    propertyId: string,
    shortlistId?: string
  ): Promise<OfferReadinessRecommendation | null>;
  createNegotiation(payload: {
    propertyId: string;
    shortlistId?: string | null;
    offerReadinessId?: string | null;
    status?: NegotiationStatus;
    initialOfferPrice: number;
    currentOfferPrice?: number;
    sellerCounterPrice?: number | null;
    buyerWalkAwayPrice?: number | null;
    roundNumber?: number;
  }): Promise<NegotiationRecord | null>;
  listNegotiations(shortlistId: string): Promise<NegotiationRecord[]>;
  getNegotiation(propertyId: string, shortlistId?: string): Promise<NegotiationRecord | null>;
  updateNegotiation(
    id: string,
    patch: {
      status?: NegotiationStatus;
      currentOfferPrice?: number;
      sellerCounterPrice?: number | null;
      buyerWalkAwayPrice?: number | null;
      roundNumber?: number;
    }
  ): Promise<NegotiationRecord | null>;
  createNegotiationEvent(
    negotiationRecordId: string,
    payload: {
      type: NegotiationEventType;
      label: string;
      details?: string | null;
    }
  ): Promise<NegotiationEvent | null>;
  listNegotiationEvents(negotiationRecordId: string): Promise<NegotiationEvent[]>;
  getNegotiationSummary(
    propertyId: string,
    shortlistId?: string
  ): Promise<NegotiationSummary | null>;
  updateShortlistItem(
    shortlistId: string,
    itemId: string,
    patch: {
      reviewState?: ReviewState;
      decisionConfidence?: DecisionConfidence | null;
      decisionRationale?: string | null;
      decisionRisks?: string[];
      lastDecisionReviewedAt?: string | null;
    }
  ): Promise<ShortlistItem | null>;
  selectShortlistItem(payload: {
    shortlistId: string;
    itemId: string;
    replaceMode?: "backup" | "replaced" | "dropped";
    decisionConfidence?: DecisionConfidence | null;
    decisionRationale?: string | null;
    decisionRisks?: string[];
    lastDecisionReviewedAt?: string | null;
  }): Promise<{
    selectedItem: ShortlistItem;
    previousPrimaryItem: ShortlistItem | null;
  } | null>;
  reorderShortlistItems(payload: {
    shortlistId: string;
    orderedBackupItemIds: string[];
  }): Promise<ShortlistItem[] | null>;
  dropShortlistItem(payload: {
    shortlistId: string;
    itemId: string;
    droppedReason: DroppedReason;
    decisionRationale?: string | null;
  }): Promise<{
    item: ShortlistItem;
    promotedBackupItem: ShortlistItem | null;
  } | null>;
  getSelectedChoice(shortlistId: string): Promise<SelectedChoiceView | null>;
  getSelectedChoiceSummary(shortlistId: string): Promise<SelectedChoiceConciergeSummary | null>;
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
  createWorkflowNotification(payload: {
    workflowId?: string | null;
    sessionId?: string | null;
    propertyId?: string | null;
    propertyAddressLabel?: string | null;
    shortlistId?: string | null;
    moduleName: NotificationModuleName;
    alertCategory: AlertCategory;
    severity: NotificationSeverity;
    status?: NotificationStatus;
    triggeringRuleLabel: string;
    relatedSubjectType: string;
    relatedSubjectId: string;
    title: string;
    message: string;
    actionLabel?: string | null;
    actionTarget?: NotificationActionTarget | null;
    dueAt?: string | null;
    explanationSubjectType?: string | null;
    explanationSubjectId?: string | null;
  }): Promise<WorkflowNotification>;
  getWorkflowNotification(id: string): Promise<WorkflowNotification | null>;
  listWorkflowNotifications(filters?: {
    sessionId?: string | null;
    propertyId?: string | null;
    shortlistId?: string | null;
    statuses?: NotificationStatus[];
    limit?: number;
  }): Promise<WorkflowNotification[]>;
  updateWorkflowNotification(
    id: string,
    patch: {
      severity?: NotificationSeverity;
      status?: NotificationStatus;
      title?: string;
      message?: string;
      actionLabel?: string | null;
      actionTarget?: NotificationActionTarget | null;
      dueAt?: string | null;
      readAt?: string | null;
      dismissedAt?: string | null;
      resolvedAt?: string | null;
      explanationSubjectType?: string | null;
      explanationSubjectId?: string | null;
    }
  ): Promise<WorkflowNotification | null>;
  listWorkflowNotificationHistory(filters?: {
    sessionId?: string | null;
    propertyId?: string | null;
    shortlistId?: string | null;
    notificationId?: string;
    limit?: number;
  }): Promise<WorkflowNotificationHistoryEvent[]>;
  createUnifiedActivity(payload: {
    workflowId?: string | null;
    sessionId?: string | null;
    propertyId?: string | null;
    propertyAddressLabel?: string | null;
    shortlistId?: string | null;
    moduleName: UnifiedActivityModuleName;
    eventCategory: UnifiedActivityEventCategory;
    subjectType: string;
    subjectId: string;
    title: string;
    summary: string;
    oldValueSnapshot?: Record<string, unknown> | null;
    newValueSnapshot?: Record<string, unknown> | null;
    triggerType: UnifiedActivityTriggerType;
    triggerLabel: string;
    actorType?: UnifiedActivityActorType;
    actorId?: string | null;
    relatedNotificationId?: string | null;
    relatedExplanationId?: string | null;
    createdAt?: string;
  }): Promise<UnifiedActivityRecord>;
  listUnifiedActivity(filters?: {
    sessionId?: string | null;
    propertyId?: string | null;
    shortlistId?: string | null;
    moduleName?: UnifiedActivityModuleName;
    eventCategories?: UnifiedActivityEventCategory[];
    subjectType?: string;
    subjectId?: string;
    limit?: number;
  }): Promise<UnifiedActivityRecord[]>;
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
  financialReadinessCreateCount: number;
  financialReadinessUpdateCount: number;
  financialReadinessSummaryViewCount: number;
  offerPreparationCreateCount: number;
  offerPreparationUpdateCount: number;
  offerPreparationSummaryViewCount: number;
  offerSubmissionCreateCount: number;
  offerSubmissionSubmitCount: number;
  offerSubmissionUpdateCount: number;
  offerSubmissionSummaryViewCount: number;
  offerSubmissionAcceptCount: number;
  offerSubmissionRejectCount: number;
  offerSubmissionWithdrawCount: number;
  offerSubmissionExpireCount: number;
  underContractCreateCount: number;
  underContractUpdateCount: number;
  underContractTaskUpdateCount: number;
  underContractMilestoneUpdateCount: number;
  underContractSummaryViewCount: number;
  underContractReadyForClosingCount: number;
  underContractBlockedCount: number;
  closingReadinessCreateCount: number;
  closingReadinessUpdateCount: number;
  closingChecklistUpdateCount: number;
  closingMilestoneUpdateCount: number;
  closingReadinessSummaryViewCount: number;
  closingReadyToCloseCount: number;
  closingCompletedCount: number;
  closingBlockedCount: number;
  noteCreateCount: number;
  noteUpdateCount: number;
  noteDeleteCount: number;
  reviewStateChangeCount: number;
  historicalCompareViewCount: number;
  negotiationCreateCount: number;
  negotiationEventCreateCount: number;
  negotiationStatusChangeCount: number;
  negotiationAcceptCount: number;
  negotiationRejectCount: number;
  negotiationWithdrawCount: number;
  negotiationSummaryViewCount: number;
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
