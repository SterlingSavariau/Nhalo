import type {
  EnvironmentProfileName,
  GeocoderProviderMode,
  ListingProviderMode,
  OpsFeatureConfig,
  PlanTier,
  PropertyType,
  RuntimeEnvironmentName,
  SafetyProviderMode,
  SearchWeights
} from "@nhalo/types";

export const DEFAULT_RADIUS_MILES = 5;
export const DEFAULT_RESULT_LIMIT = 25;
export const PROVIDER_TIMEOUT_MS = 1500;
export const MARKET_SNAPSHOT_FRESH_HOURS = 24;
export const DEFAULT_SAFETY_PROVIDER_MODE: SafetyProviderMode = "hybrid";
export const DEFAULT_SAFETY_CACHE_TTL_HOURS = 24;
export const DEFAULT_SAFETY_STALE_TTL_HOURS = 168;
export const DEFAULT_LISTING_PROVIDER_MODE: ListingProviderMode = "hybrid";
export const DEFAULT_LISTING_CACHE_TTL_HOURS = 24;
export const DEFAULT_LISTING_STALE_TTL_HOURS = 72;
export const DEFAULT_GEOCODER_PROVIDER_MODE: GeocoderProviderMode = "hybrid";
export const DEFAULT_GEOCODE_CACHE_TTL_HOURS = 168;
export const DEFAULT_GEOCODE_STALE_TTL_HOURS = 720;
export const DEFAULT_ALLOWED_LISTING_STATUSES = ["active", "coming_soon"] as const;
export const DEFAULT_COMPARABLE_SQFT_TOLERANCE_PERCENT = 25;
export const DEFAULT_COMPARABLE_BEDROOM_TOLERANCE = 1;
export const DEFAULT_MIN_COMPARABLE_SAMPLE_SIZE = 5;
export const DEFAULT_DATA_QUALITY_RULES_ENABLED = true;
export const DEFAULT_QUALITY_STALE_LISTING_HOURS = 72;
export const DEFAULT_QUALITY_STALE_SAFETY_HOURS = 168;
export const DEFAULT_QUALITY_STALE_GEOCODE_HOURS = 720;
export const DEFAULT_QUALITY_MAX_PRICE_PER_SQFT = 2000;
export const DEFAULT_QUALITY_LOW_PRECISION_ADDRESS_ALLOWED = false;
export const DEFAULT_PROVIDER_RETRY_COUNT = 1;
export const DEFAULT_PROVIDER_RETRY_BACKOFF_MS = 150;
export const DEFAULT_SEARCH_INTERNAL_TIMING_ENABLED = true;
export const DEFAULT_PROVIDER_BUDGETS_ENABLED = false;
export const DEFAULT_LISTING_PROVIDER_MAX_CALLS_PER_MINUTE = 120;
export const DEFAULT_SAFETY_PROVIDER_MAX_CALLS_PER_MINUTE = 300;
export const DEFAULT_GEOCODER_PROVIDER_MAX_CALLS_PER_MINUTE = 180;
export const DEFAULT_OPS_DEFAULT_PAGE_SIZE = 20;
export const DEFAULT_OPS_MAX_PAGE_SIZE = 100;
export const DEFAULT_ENABLE_INTERNAL_PERF_SUMMARY = true;
export const DEFAULT_ENABLE_RELIABILITY_SUMMARY = true;
export const DEFAULT_BACKGROUND_JOBS_ENABLED = true;
export const DEFAULT_BACKGROUND_JOB_LOCKING_ENABLED = true;
export const DEFAULT_ENABLE_INTERNAL_ROUTE_GUARDS = false;
export const DEFAULT_ENABLE_VERSION_ENDPOINT = true;
export const DEFAULT_RELIABILITY_INCIDENTS_ENABLED = true;
export const DEFAULT_ENABLE_PLAN_CAPABILITIES = true;
export const DEFAULT_DEFAULT_PLAN_TIER: PlanTier = "free_demo";
export const DEFAULT_MAX_SAVED_SEARCHES_PER_SESSION = 10;
export const DEFAULT_MAX_SHORTLISTS_PER_SESSION = 5;
export const DEFAULT_MAX_SHARE_LINKS_PER_SESSION = 10;
export const DEFAULT_MAX_EXPORTS_PER_SESSION = 20;
export const DEFAULT_ENABLE_USAGE_FUNNEL_SUMMARY = true;
export const DEFAULT_ENABLE_USAGE_FRICTION_SUMMARY = true;
export const DEFAULT_ENABLE_EXPORT_LIMITS = false;
export const DEFAULT_SECURITY_REDACT_LOG_FIELDS = true;
export const DEFAULT_SHARE_LINK_MIN_TOKEN_LENGTH = 24;
export const DEFAULT_ENABLE_PUBLIC_SHARED_VIEWS = true;
export const DEFAULT_ENABLE_PUBLIC_SHARED_SHORTLISTS = true;
export const DEFAULT_SECURITY_MAX_NOTE_LENGTH = 2000;
export const DEFAULT_SECURITY_MAX_COMMENT_LENGTH = 2000;
export const DEFAULT_SECURITY_MAX_FEEDBACK_LENGTH = 1000;
export const DEFAULT_SECURITY_MAX_REQUEST_BODY_BYTES = 131_072;
export const DEFAULT_SHARED_OPEN_WINDOW_MS = 60_000;
export const DEFAULT_SHARED_OPEN_MAX = 60;
export const DEFAULT_COLLABORATION_WRITE_WINDOW_MS = 60_000;
export const DEFAULT_COLLABORATION_WRITE_MAX = 40;
export const DEFAULT_FEEDBACK_WINDOW_MS = 60_000;
export const DEFAULT_FEEDBACK_MAX = 20;
export const DEFAULT_PILOT_LINK_OPEN_WINDOW_MS = 60_000;
export const DEFAULT_PILOT_LINK_OPEN_MAX = 40;
export const DEFAULT_SNAPSHOT_RETENTION_DAYS = 30;
export const DEFAULT_SEARCH_HISTORY_RETENTION_DAYS = 30;
export const DEFAULT_RATE_LIMIT_SEARCH_WINDOW_MS = 60_000;
export const DEFAULT_RATE_LIMIT_SNAPSHOT_WINDOW_MS = 60_000;
export const DEFAULT_RATE_LIMIT_SEARCH_MAX_DEVELOPMENT = 120;
export const DEFAULT_RATE_LIMIT_SEARCH_MAX_NON_DEVELOPMENT = 30;
export const DEFAULT_RATE_LIMIT_SNAPSHOT_MAX_DEVELOPMENT = 60;
export const DEFAULT_RATE_LIMIT_SNAPSHOT_MAX_NON_DEVELOPMENT = 20;
export const DEFAULT_CLEANUP_INTERVAL_MS = 3_600_000;
export const DEFAULT_SHARE_SNAPSHOT_EXPIRATION_DAYS = 14;
export const DEFAULT_PILOT_LINK_EXPIRATION_DAYS = 30;
export const DEFAULT_WEIGHTS: SearchWeights = {
  price: 40,
  size: 30,
  safety: 30
};

export const DEFAULT_PROPERTY_TYPES: PropertyType[] = [
  "single_family",
  "condo",
  "townhome"
];

export const FORMULA_VERSION = "nhalo-v1";

export type NodeEnvironment = "development" | "test" | "staging" | "production";
export type LogLevel = "debug" | "info" | "warn" | "error";

export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly details: Array<{ field: string; message: string }> = []
  ) {
    super(message);
    this.name = "ConfigError";
  }
}

export interface AppConfig {
  nodeEnv: NodeEnvironment;
  runtimeEnvironment: RuntimeEnvironmentName;
  port: number;
  apiUrl: string;
  databaseUrl?: string;
  providerMode: "mock" | "hybrid" | "live";
  defaultCacheTtlHours: number;
  providerTimeoutMs: number;
  providerRetryCount: number;
  providerRetryBackoffMs: number;
  snapshotRetentionDays: number;
  logLevel: LogLevel;
  retention: RetentionConfig;
  rateLimit: RateLimitConfig;
  validation: ValidationConfig;
  workflow: WorkflowConfig;
  ops: OpsFeatureConfig;
  product: ProductCapabilityConfig;
  safety: SafetyConfig;
  listings: ListingConfig;
  geocoder: GeocoderConfig;
  searchQuality: SearchQualityConfig;
  dataQuality: DataQualityConfig;
  performance: PerformanceConfig;
  security: SecurityConfig;
  deployment: DeploymentConfig;
}

export interface ExternalProviderConfig {
  baseUrl?: string;
  apiKey?: string;
  configured: boolean;
}

export interface SafetyConfig {
  mode: SafetyProviderMode;
  cacheTtlHours: number;
  staleTtlHours: number;
  crime: ExternalProviderConfig;
  school: ExternalProviderConfig;
}

export interface ListingConfig {
  mode: ListingProviderMode;
  cacheTtlHours: number;
  staleTtlHours: number;
  provider: ExternalProviderConfig;
}

export interface GeocoderConfig {
  mode: GeocoderProviderMode;
  cacheTtlHours: number;
  staleTtlHours: number;
  provider: ExternalProviderConfig;
}

export interface SearchQualityConfig {
  allowedListingStatuses: string[];
  comparableSqftTolerancePercent: number;
  comparableBedroomTolerance: number;
  minComparableSampleSize: number;
}

export interface DataQualityConfig {
  enabled: boolean;
  staleListingHours: number;
  staleSafetyHours: number;
  staleGeocodeHours: number;
  maxPricePerSqft: number;
  minComparableSampleSize: number;
  lowPrecisionAddressAllowed: boolean;
}

export interface PerformanceConfig {
  internalTimingEnabled: boolean;
  providerBudgetsEnabled: boolean;
  listingProviderMaxCallsPerMinute: number;
  safetyProviderMaxCallsPerMinute: number;
  geocoderProviderMaxCallsPerMinute: number;
  opsDefaultPageSize: number;
  opsMaxPageSize: number;
  internalPerfSummaryEnabled: boolean;
}

export interface DeploymentConfig {
  profile: EnvironmentProfileName;
  enableReliabilitySummary: boolean;
  backgroundJobsEnabled: boolean;
  backgroundJobLockingEnabled: boolean;
  productionStrictStartup: boolean;
  versionEndpointEnabled: boolean;
  reliabilityIncidentsEnabled: boolean;
  buildMetadata: {
    appVersion: string;
    buildId: string;
    gitSha: string | null;
    buildTimestamp: string;
  };
  environmentBehavior: {
    runtimeEnvironment: RuntimeEnvironmentName;
    profile: EnvironmentProfileName;
    productionLike: boolean;
    publicSharingDefault: boolean;
    demoModeDefault: boolean;
    validationModeDefault: boolean;
    cleanupDefault: boolean;
    strictRateLimitsDefault: boolean;
  };
}

export interface SecurityConfig {
  internalRouteGuardsEnabled: boolean;
  internalRouteAccessToken?: string;
  redactLogFields: boolean;
  shareLinkMinTokenLength: number;
  publicSharedViewsEnabled: boolean;
  publicSharedShortlistsEnabled: boolean;
  maxNoteLength: number;
  maxCommentLength: number;
  maxFeedbackLength: number;
  maxRequestBodyBytes: number;
  sharedOpenWindowMs: number;
  sharedOpenMax: number;
  collaborationWriteWindowMs: number;
  collaborationWriteMax: number;
  feedbackWindowMs: number;
  feedbackMax: number;
  pilotLinkOpenWindowMs: number;
  pilotLinkOpenMax: number;
}

export interface RetentionConfig {
  snapshotRetentionDays: number;
  searchHistoryRetentionDays: number;
  cleanupIntervalMs: number;
}

export interface RateLimitConfig {
  searchWindowMs: number;
  searchMax: number;
  snapshotWindowMs: number;
  snapshotMax: number;
}

export interface ValidationConfig {
  enabled: boolean;
  sharedSnapshotsEnabled: boolean;
  demoScenariosEnabled: boolean;
  feedbackEnabled: boolean;
  shareSnapshotExpirationDays: number;
}

export interface WorkflowConfig {
  shortlistsEnabled: boolean;
  resultNotesEnabled: boolean;
  historicalCompareEnabled: boolean;
  sharedShortlistsEnabled: boolean;
  sharedCommentsEnabled: boolean;
  reviewerDecisionsEnabled: boolean;
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

let cachedConfig: AppConfig | null = null;

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function parseNonNegativeInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function parsePort(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    return fallback;
  }

  return parsed;
}

function parseNodeEnv(value: string | undefined): NodeEnvironment {
  switch (value) {
    case "development":
    case "test":
    case "staging":
    case "production":
      return value;
    default:
      return "development";
  }
}

function parsePlanTier(value: string | undefined, fallback: PlanTier): PlanTier {
  switch (value) {
    case "free_demo":
    case "pilot":
    case "partner":
    case "internal":
      return value;
    default:
      return fallback;
  }
}

function defaultRuntimeEnvironment(nodeEnv: NodeEnvironment): RuntimeEnvironmentName {
  switch (nodeEnv) {
    case "staging":
      return "staging";
    case "production":
      return "production_like_pilot";
    case "test":
      return "development";
    default:
      return "local";
  }
}

function parseRuntimeEnvironment(
  value: string | undefined,
  nodeEnv: NodeEnvironment
): RuntimeEnvironmentName {
  switch (value) {
    case "local":
    case "development":
    case "staging":
    case "production_like_pilot":
      return value;
    default:
      return defaultRuntimeEnvironment(nodeEnv);
  }
}

function defaultEnvironmentProfile(runtimeEnvironment: RuntimeEnvironmentName): EnvironmentProfileName {
  switch (runtimeEnvironment) {
    case "production_like_pilot":
      return "production_pilot";
    case "staging":
      return "staging_pilot";
    case "development":
      return "local_dev";
    default:
      return "local_demo";
  }
}

function parseEnvironmentProfile(
  value: string | undefined,
  runtimeEnvironment: RuntimeEnvironmentName
): EnvironmentProfileName {
  switch (value) {
    case "local_demo":
    case "local_dev":
    case "staging_pilot":
    case "production_pilot":
      return value;
    default:
      return defaultEnvironmentProfile(runtimeEnvironment);
  }
}

function parseLogLevel(value: string | undefined): LogLevel {
  switch (value) {
    case "debug":
    case "info":
    case "warn":
    case "error":
      return value;
    default:
      return "info";
  }
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}

function parseProviderMode(value: string | undefined): "mock" | "hybrid" | "live" {
  switch (value) {
    case "mock":
    case "hybrid":
    case "live":
      return value;
    default:
      return "hybrid";
  }
}

function parseSafetyMode(value: string | undefined): SafetyProviderMode {
  if (value === "mock" || value === "hybrid" || value === "live") {
    return value;
  }

  return DEFAULT_SAFETY_PROVIDER_MODE;
}

function parseListingMode(value: string | undefined): ListingProviderMode {
  if (value === "mock" || value === "hybrid" || value === "live") {
    return value;
  }

  return DEFAULT_LISTING_PROVIDER_MODE;
}

function parseGeocoderMode(value: string | undefined): GeocoderProviderMode {
  if (value === "mock" || value === "hybrid" || value === "live") {
    return value;
  }

  return DEFAULT_GEOCODER_PROVIDER_MODE;
}

export function getSafetyConfig(): SafetyConfig {
  const crimeBaseUrl = process.env.CRIME_PROVIDER_BASE_URL?.trim();
  const crimeApiKey = process.env.CRIME_PROVIDER_API_KEY?.trim();
  const schoolBaseUrl = process.env.SCHOOL_PROVIDER_BASE_URL?.trim();
  const schoolApiKey = process.env.SCHOOL_PROVIDER_API_KEY?.trim();
  const providerMode = parseProviderMode(process.env.PROVIDER_MODE);
  const defaultCacheTtlHours = parsePositiveInteger(process.env.CACHE_TTL, 24);

  return {
    mode: parseSafetyMode(process.env.SAFETY_PROVIDER_MODE ?? providerMode),
    cacheTtlHours: parsePositiveInteger(
      process.env.SAFETY_CACHE_TTL_HOURS,
      defaultCacheTtlHours || DEFAULT_SAFETY_CACHE_TTL_HOURS
    ),
    staleTtlHours: parsePositiveInteger(
      process.env.SAFETY_STALE_TTL_HOURS,
      DEFAULT_SAFETY_STALE_TTL_HOURS
    ),
    crime: {
      baseUrl: crimeBaseUrl,
      apiKey: crimeApiKey,
      configured: Boolean(crimeBaseUrl && crimeApiKey)
    },
    school: {
      baseUrl: schoolBaseUrl,
      apiKey: schoolApiKey,
      configured: Boolean(schoolBaseUrl && schoolApiKey)
    }
  };
}

export function getListingConfig(): ListingConfig {
  const listingBaseUrl = process.env.LISTING_PROVIDER_BASE_URL?.trim();
  const listingApiKey = process.env.LISTING_PROVIDER_API_KEY?.trim();
  const providerMode = parseProviderMode(process.env.PROVIDER_MODE);
  const defaultCacheTtlHours = parsePositiveInteger(process.env.CACHE_TTL, 24);

  return {
    mode: parseListingMode(process.env.LISTING_PROVIDER_MODE ?? providerMode),
    cacheTtlHours: parsePositiveInteger(
      process.env.LISTING_CACHE_TTL_HOURS,
      defaultCacheTtlHours || DEFAULT_LISTING_CACHE_TTL_HOURS
    ),
    staleTtlHours: parsePositiveInteger(
      process.env.LISTING_STALE_TTL_HOURS,
      DEFAULT_LISTING_STALE_TTL_HOURS
    ),
    provider: {
      baseUrl: listingBaseUrl,
      apiKey: listingApiKey,
      configured: Boolean(listingBaseUrl && listingApiKey)
    }
  };
}

export function getGeocoderConfig(): GeocoderConfig {
  const geocoderBaseUrl = process.env.GEOCODER_PROVIDER_BASE_URL?.trim();
  const geocoderApiKey = process.env.GEOCODER_PROVIDER_API_KEY?.trim();
  const providerMode = parseProviderMode(process.env.PROVIDER_MODE);
  const defaultCacheTtlHours = parsePositiveInteger(process.env.CACHE_TTL, 24);

  return {
    mode: parseGeocoderMode(process.env.GEOCODER_PROVIDER_MODE ?? providerMode),
    cacheTtlHours: parsePositiveInteger(
      process.env.GEOCODE_CACHE_TTL_HOURS,
      defaultCacheTtlHours || DEFAULT_GEOCODE_CACHE_TTL_HOURS
    ),
    staleTtlHours: parsePositiveInteger(
      process.env.GEOCODE_STALE_TTL_HOURS,
      DEFAULT_GEOCODE_STALE_TTL_HOURS
    ),
    provider: {
      baseUrl: geocoderBaseUrl,
      apiKey: geocoderApiKey,
      configured: Boolean(geocoderBaseUrl && geocoderApiKey)
    }
  };
}

export function getSecurityConfig(runtimeEnvironment?: RuntimeEnvironmentName): SecurityConfig {
  const productionLike =
    runtimeEnvironment === "staging" || runtimeEnvironment === "production_like_pilot";

  return {
    internalRouteGuardsEnabled: parseBoolean(
      process.env.ENABLE_INTERNAL_ROUTE_GUARDS,
      DEFAULT_ENABLE_INTERNAL_ROUTE_GUARDS
    ),
    internalRouteAccessToken: process.env.INTERNAL_ROUTE_ACCESS_TOKEN?.trim() || undefined,
    redactLogFields: parseBoolean(
      process.env.SECURITY_REDACT_LOG_FIELDS,
      DEFAULT_SECURITY_REDACT_LOG_FIELDS
    ),
    shareLinkMinTokenLength: parsePositiveInteger(
      process.env.SHARE_LINK_MIN_TOKEN_LENGTH,
      DEFAULT_SHARE_LINK_MIN_TOKEN_LENGTH
    ),
    publicSharedViewsEnabled: parseBoolean(
      process.env.ENABLE_PUBLIC_SHARED_VIEWS,
      productionLike ? false : DEFAULT_ENABLE_PUBLIC_SHARED_VIEWS
    ),
    publicSharedShortlistsEnabled: parseBoolean(
      process.env.ENABLE_PUBLIC_SHARED_SHORTLISTS,
      productionLike ? false : DEFAULT_ENABLE_PUBLIC_SHARED_SHORTLISTS
    ),
    maxNoteLength: parsePositiveInteger(
      process.env.SECURITY_MAX_NOTE_LENGTH,
      DEFAULT_SECURITY_MAX_NOTE_LENGTH
    ),
    maxCommentLength: parsePositiveInteger(
      process.env.SECURITY_MAX_COMMENT_LENGTH,
      DEFAULT_SECURITY_MAX_COMMENT_LENGTH
    ),
    maxFeedbackLength: parsePositiveInteger(
      process.env.SECURITY_MAX_FEEDBACK_LENGTH,
      DEFAULT_SECURITY_MAX_FEEDBACK_LENGTH
    ),
    maxRequestBodyBytes: parsePositiveInteger(
      process.env.SECURITY_MAX_REQUEST_BODY_BYTES,
      DEFAULT_SECURITY_MAX_REQUEST_BODY_BYTES
    ),
    sharedOpenWindowMs: parsePositiveInteger(
      process.env.SECURITY_SHARED_OPEN_WINDOW_MS,
      DEFAULT_SHARED_OPEN_WINDOW_MS
    ),
    sharedOpenMax: parsePositiveInteger(
      process.env.SECURITY_SHARED_OPEN_MAX,
      DEFAULT_SHARED_OPEN_MAX
    ),
    collaborationWriteWindowMs: parsePositiveInteger(
      process.env.SECURITY_COLLABORATION_WRITE_WINDOW_MS,
      DEFAULT_COLLABORATION_WRITE_WINDOW_MS
    ),
    collaborationWriteMax: parsePositiveInteger(
      process.env.SECURITY_COLLABORATION_WRITE_MAX,
      DEFAULT_COLLABORATION_WRITE_MAX
    ),
    feedbackWindowMs: parsePositiveInteger(
      process.env.SECURITY_FEEDBACK_WINDOW_MS,
      DEFAULT_FEEDBACK_WINDOW_MS
    ),
    feedbackMax: parsePositiveInteger(
      process.env.SECURITY_FEEDBACK_MAX,
      DEFAULT_FEEDBACK_MAX
    ),
    pilotLinkOpenWindowMs: parsePositiveInteger(
      process.env.SECURITY_PILOT_LINK_OPEN_WINDOW_MS,
      DEFAULT_PILOT_LINK_OPEN_WINDOW_MS
    ),
    pilotLinkOpenMax: parsePositiveInteger(
      process.env.SECURITY_PILOT_LINK_OPEN_MAX,
      DEFAULT_PILOT_LINK_OPEN_MAX
    )
  };
}

export function getDeploymentConfig(
  nodeEnv: NodeEnvironment,
  runtimeEnvironment: RuntimeEnvironmentName
): DeploymentConfig {
  const profile = parseEnvironmentProfile(process.env.APP_ENV_PROFILE, runtimeEnvironment);
  const productionLike =
    runtimeEnvironment === "staging" || runtimeEnvironment === "production_like_pilot";
  const buildSha = process.env.BUILD_SHA?.trim() || null;
  const buildTimestamp =
    process.env.BUILD_TIMESTAMP?.trim() || new Date(0).toISOString();
  const appVersion = process.env.APP_VERSION?.trim() || "0.1.0";
  const buildId =
    process.env.BUILD_ID?.trim() || buildSha || `${runtimeEnvironment}-${appVersion}`;

  return {
    profile,
    enableReliabilitySummary: parseBoolean(
      process.env.ENABLE_RELIABILITY_SUMMARY,
      DEFAULT_ENABLE_RELIABILITY_SUMMARY
    ),
    backgroundJobsEnabled: parseBoolean(
      process.env.BACKGROUND_JOBS_ENABLED,
      DEFAULT_BACKGROUND_JOBS_ENABLED
    ),
    backgroundJobLockingEnabled: parseBoolean(
      process.env.BACKGROUND_JOB_LOCKING_ENABLED,
      DEFAULT_BACKGROUND_JOB_LOCKING_ENABLED
    ),
    productionStrictStartup: parseBoolean(
      process.env.PRODUCTION_STRICT_STARTUP,
      productionLike
    ),
    versionEndpointEnabled: parseBoolean(
      process.env.ENABLE_VERSION_ENDPOINT,
      DEFAULT_ENABLE_VERSION_ENDPOINT
    ),
    reliabilityIncidentsEnabled: parseBoolean(
      process.env.RELIABILITY_INCIDENTS_ENABLED,
      DEFAULT_RELIABILITY_INCIDENTS_ENABLED
    ),
    buildMetadata: {
      appVersion,
      buildId,
      gitSha: buildSha,
      buildTimestamp
    },
    environmentBehavior: {
      runtimeEnvironment,
      profile,
      productionLike,
      publicSharingDefault: profile === "local_demo" || profile === "local_dev",
      demoModeDefault: profile === "local_demo",
      validationModeDefault: profile !== "production_pilot",
      cleanupDefault: true,
      strictRateLimitsDefault: productionLike
    }
  };
}

function validateConfig(config: AppConfig): AppConfig {
  const details: Array<{ field: string; message: string }> = [];
  const rawNodeEnv = process.env.NODE_ENV;
  const rawRuntimeEnvironment = process.env.RUNTIME_ENVIRONMENT;
  const rawProviderMode = process.env.PROVIDER_MODE;
  const rawGeocoderMode = process.env.GEOCODER_PROVIDER_MODE;
  const rawListingMode = process.env.LISTING_PROVIDER_MODE;
  const rawSafetyMode = process.env.SAFETY_PROVIDER_MODE;
  const rawPlanTier = process.env.DEFAULT_PLAN_TIER;

  if (rawNodeEnv && !["development", "test", "staging", "production"].includes(rawNodeEnv)) {
    details.push({
      field: "NODE_ENV",
      message: "NODE_ENV must be development, test, staging, or production."
    });
  }

  if (
    rawRuntimeEnvironment &&
    !["local", "development", "staging", "production_like_pilot"].includes(rawRuntimeEnvironment)
  ) {
    details.push({
      field: "RUNTIME_ENVIRONMENT",
      message: "RUNTIME_ENVIRONMENT must be local, development, staging, or production_like_pilot."
    });
  }

  if (
    process.env.APP_ENV_PROFILE &&
    !["local_demo", "local_dev", "staging_pilot", "production_pilot"].includes(process.env.APP_ENV_PROFILE)
  ) {
    details.push({
      field: "APP_ENV_PROFILE",
      message: "APP_ENV_PROFILE must be local_demo, local_dev, staging_pilot, or production_pilot."
    });
  }

  if (rawProviderMode && !["mock", "hybrid", "live"].includes(rawProviderMode)) {
    details.push({
      field: "PROVIDER_MODE",
      message: "PROVIDER_MODE must be mock, hybrid, or live."
    });
  }

  if (rawGeocoderMode && !["mock", "hybrid", "live"].includes(rawGeocoderMode)) {
    details.push({
      field: "GEOCODER_PROVIDER_MODE",
      message: "GEOCODER_PROVIDER_MODE must be mock, hybrid, or live."
    });
  }

  if (rawListingMode && !["mock", "hybrid", "live"].includes(rawListingMode)) {
    details.push({
      field: "LISTING_PROVIDER_MODE",
      message: "LISTING_PROVIDER_MODE must be mock, hybrid, or live."
    });
  }

  if (rawSafetyMode && !["mock", "hybrid", "live"].includes(rawSafetyMode)) {
    details.push({
      field: "SAFETY_PROVIDER_MODE",
      message: "SAFETY_PROVIDER_MODE must be mock, hybrid, or live."
    });
  }

  if (rawPlanTier && !["free_demo", "pilot", "partner", "internal"].includes(rawPlanTier)) {
    details.push({
      field: "DEFAULT_PLAN_TIER",
      message: "DEFAULT_PLAN_TIER must be free_demo, pilot, partner, or internal."
    });
  }

  if (!Number.isInteger(config.port) || config.port <= 0 || config.port > 65535) {
    details.push({
      field: "PORT",
      message: "PORT must be an integer between 1 and 65535."
    });
  }

  if ((config.nodeEnv === "staging" || config.nodeEnv === "production") && !config.databaseUrl) {
    details.push({
      field: "DATABASE_URL",
      message: "DATABASE_URL is required when NODE_ENV is staging or production."
    });
  }

  if (config.databaseUrl && !config.databaseUrl.startsWith("postgresql://") && !config.databaseUrl.startsWith("postgres://")) {
    details.push({
      field: "DATABASE_URL",
      message: "DATABASE_URL must be a PostgreSQL connection string."
    });
  }

  if (config.providerTimeoutMs <= 0) {
    details.push({
      field: "PROVIDER_TIMEOUT_MS",
      message: "PROVIDER_TIMEOUT_MS must be greater than 0."
    });
  }

  if (config.snapshotRetentionDays <= 0) {
    details.push({
      field: "SNAPSHOT_RETENTION_DAYS",
      message: "SNAPSHOT_RETENTION_DAYS must be greater than 0."
    });
  }

  if (config.defaultCacheTtlHours <= 0) {
    details.push({
      field: "CACHE_TTL",
      message: "CACHE_TTL must be greater than 0."
    });
  }

  if (config.rateLimit.searchMax <= 0 || config.rateLimit.snapshotMax <= 0) {
    details.push({
      field: "RATE_LIMIT",
      message: "Rate limit maximums must be greater than 0."
    });
  }

  if (config.rateLimit.searchWindowMs <= 0 || config.rateLimit.snapshotWindowMs <= 0) {
    details.push({
      field: "RATE_LIMIT",
      message: "Rate limit windows must be greater than 0 milliseconds."
    });
  }

  if (process.env.CACHE_TTL && Number(process.env.CACHE_TTL) <= 0) {
    details.push({
      field: "CACHE_TTL",
      message: "CACHE_TTL must be greater than 0."
    });
  }

  if (process.env.SNAPSHOT_RETENTION_DAYS && Number(process.env.SNAPSHOT_RETENTION_DAYS) <= 0) {
    details.push({
      field: "SNAPSHOT_RETENTION_DAYS",
      message: "SNAPSHOT_RETENTION_DAYS must be greater than 0."
    });
  }

  if (config.dataQuality.staleListingHours <= 0) {
    details.push({
      field: "QUALITY_STALE_LISTING_HOURS",
      message: "QUALITY_STALE_LISTING_HOURS must be greater than 0."
    });
  }

  if (config.dataQuality.staleSafetyHours <= 0) {
    details.push({
      field: "QUALITY_STALE_SAFETY_HOURS",
      message: "QUALITY_STALE_SAFETY_HOURS must be greater than 0."
    });
  }

  if (config.dataQuality.staleGeocodeHours <= 0) {
    details.push({
      field: "QUALITY_STALE_GEOCODE_HOURS",
      message: "QUALITY_STALE_GEOCODE_HOURS must be greater than 0."
    });
  }

  if (config.dataQuality.maxPricePerSqft <= 0) {
    details.push({
      field: "QUALITY_MAX_PRICE_PER_SQFT",
      message: "QUALITY_MAX_PRICE_PER_SQFT must be greater than 0."
    });
  }

  if (config.performance.opsDefaultPageSize <= 0 || config.performance.opsMaxPageSize <= 0) {
    details.push({
      field: "OPS_PAGE_SIZE",
      message: "OPS_DEFAULT_PAGE_SIZE and OPS_MAX_PAGE_SIZE must be greater than 0."
    });
  }

  if (config.performance.opsDefaultPageSize > config.performance.opsMaxPageSize) {
    details.push({
      field: "OPS_PAGE_SIZE",
      message: "OPS_DEFAULT_PAGE_SIZE must be less than or equal to OPS_MAX_PAGE_SIZE."
    });
  }

  if (
    config.product.maxSavedSearchesPerSession <= 0 ||
    config.product.maxShortlistsPerSession <= 0 ||
    config.product.maxShareLinksPerSession <= 0 ||
    config.product.maxExportsPerSession <= 0
  ) {
    details.push({
      field: "PRODUCT_LIMITS",
      message: "Configured product limits must be greater than 0."
    });
  }

  if (
    config.security.internalRouteGuardsEnabled &&
    (config.nodeEnv === "staging" || config.nodeEnv === "production") &&
    !config.security.internalRouteAccessToken
  ) {
    details.push({
      field: "INTERNAL_ROUTE_ACCESS_TOKEN",
      message: "INTERNAL_ROUTE_ACCESS_TOKEN is required when internal route guards are enabled outside development or test."
    });
  }

  if (config.security.shareLinkMinTokenLength < 16) {
    details.push({
      field: "SHARE_LINK_MIN_TOKEN_LENGTH",
      message: "SHARE_LINK_MIN_TOKEN_LENGTH must be at least 16."
    });
  }

  if (
    config.security.maxNoteLength <= 0 ||
    config.security.maxCommentLength <= 0 ||
    config.security.maxFeedbackLength <= 0
  ) {
    details.push({
      field: "SECURITY_LENGTH_LIMITS",
      message: "SECURITY_MAX_NOTE_LENGTH, SECURITY_MAX_COMMENT_LENGTH, and SECURITY_MAX_FEEDBACK_LENGTH must be greater than 0."
    });
  }

  if (config.security.maxRequestBodyBytes < 1024) {
    details.push({
      field: "SECURITY_MAX_REQUEST_BODY_BYTES",
      message: "SECURITY_MAX_REQUEST_BODY_BYTES must be at least 1024."
    });
  }

  if (!config.deployment.buildMetadata.buildTimestamp) {
    details.push({
      field: "BUILD_TIMESTAMP",
      message: "BUILD_TIMESTAMP must be present when deployment metadata is enabled."
    });
  }

  if (config.deployment.productionStrictStartup && !config.deployment.environmentBehavior.productionLike) {
    details.push({
      field: "PRODUCTION_STRICT_STARTUP",
      message: "PRODUCTION_STRICT_STARTUP should only be enabled for staging or production-like pilot environments."
    });
  }

  if (
    config.deployment.environmentBehavior.productionLike &&
    config.security.publicSharedViewsEnabled &&
    !config.security.internalRouteGuardsEnabled
  ) {
    details.push({
      field: "ENABLE_INTERNAL_ROUTE_GUARDS",
      message:
        "ENABLE_INTERNAL_ROUTE_GUARDS must be true when public shared views are enabled in staging or production-like pilot environments."
    });
  }

  if (config.listings.mode === "live" && !config.listings.provider.configured) {
    details.push({
      field: "LISTING_PROVIDER_API_KEY",
      message: "Live listing mode requires LISTING_PROVIDER_BASE_URL and LISTING_PROVIDER_API_KEY."
    });
  }

  if (config.geocoder.mode === "live" && !config.geocoder.provider.configured) {
    details.push({
      field: "GEOCODER_PROVIDER_API_KEY",
      message: "Live geocoder mode requires GEOCODER_PROVIDER_BASE_URL and GEOCODER_PROVIDER_API_KEY."
    });
  }

  if (
    config.safety.mode === "live" &&
    !config.safety.crime.configured &&
    !config.safety.school.configured
  ) {
    details.push({
      field: "SAFETY_PROVIDER_API_KEYS",
      message: "Live safety mode requires at least one configured live safety provider."
    });
  }

  if (details.length > 0) {
    throw new ConfigError("Invalid environment configuration", details);
  }

  return config;
}

export function getConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const nodeEnv = parseNodeEnv(process.env.NODE_ENV);
  const runtimeEnvironment = parseRuntimeEnvironment(process.env.RUNTIME_ENVIRONMENT, nodeEnv);
  const providerMode = parseProviderMode(process.env.PROVIDER_MODE);
  const defaultCacheTtlHours = parsePositiveInteger(process.env.CACHE_TTL, 24);
  const port = parsePort(process.env.PORT, 3000);
  const deployment = getDeploymentConfig(nodeEnv, runtimeEnvironment);
  const relaxedLimits = !deployment.environmentBehavior.strictRateLimitsDefault;
  const config = validateConfig({
    nodeEnv,
    runtimeEnvironment,
    port,
    apiUrl: process.env.NHALO_API_URL ?? `http://localhost:${port}`,
    databaseUrl: process.env.DATABASE_URL?.trim() || undefined,
    providerMode,
    defaultCacheTtlHours,
    providerTimeoutMs: parsePositiveInteger(process.env.PROVIDER_TIMEOUT_MS, PROVIDER_TIMEOUT_MS),
    providerRetryCount: parseNonNegativeInteger(
      process.env.PROVIDER_RETRY_COUNT,
      DEFAULT_PROVIDER_RETRY_COUNT
    ),
    providerRetryBackoffMs: parsePositiveInteger(
      process.env.PROVIDER_RETRY_BACKOFF_MS,
      DEFAULT_PROVIDER_RETRY_BACKOFF_MS
    ),
    snapshotRetentionDays: parsePositiveInteger(
      process.env.SNAPSHOT_RETENTION_DAYS,
      DEFAULT_SNAPSHOT_RETENTION_DAYS
    ),
    logLevel: parseLogLevel(process.env.LOG_LEVEL),
    retention: {
      snapshotRetentionDays: parsePositiveInteger(
        process.env.SNAPSHOT_RETENTION_DAYS,
        DEFAULT_SNAPSHOT_RETENTION_DAYS
      ),
      searchHistoryRetentionDays: parsePositiveInteger(
        process.env.SEARCH_HISTORY_RETENTION_DAYS,
        DEFAULT_SEARCH_HISTORY_RETENTION_DAYS
      ),
      cleanupIntervalMs: parsePositiveInteger(
        process.env.CLEANUP_INTERVAL_MS,
        DEFAULT_CLEANUP_INTERVAL_MS
      )
    },
    rateLimit: {
      searchWindowMs: parsePositiveInteger(
        process.env.RATE_LIMIT_SEARCH_WINDOW_MS,
        DEFAULT_RATE_LIMIT_SEARCH_WINDOW_MS
      ),
      searchMax: parsePositiveInteger(
        process.env.RATE_LIMIT_SEARCH_MAX,
        relaxedLimits
          ? DEFAULT_RATE_LIMIT_SEARCH_MAX_DEVELOPMENT
          : DEFAULT_RATE_LIMIT_SEARCH_MAX_NON_DEVELOPMENT
      ),
      snapshotWindowMs: parsePositiveInteger(
        process.env.RATE_LIMIT_SNAPSHOT_WINDOW_MS,
        DEFAULT_RATE_LIMIT_SNAPSHOT_WINDOW_MS
      ),
      snapshotMax: parsePositiveInteger(
        process.env.RATE_LIMIT_SNAPSHOT_MAX,
        relaxedLimits
          ? DEFAULT_RATE_LIMIT_SNAPSHOT_MAX_DEVELOPMENT
          : DEFAULT_RATE_LIMIT_SNAPSHOT_MAX_NON_DEVELOPMENT
      )
    },
    validation: {
      enabled: parseBoolean(
        process.env.VALIDATION_MODE,
        deployment.environmentBehavior.validationModeDefault
      ),
      sharedSnapshotsEnabled:
        parseBoolean(
          process.env.ENABLE_SHARED_SNAPSHOTS,
          deployment.environmentBehavior.publicSharingDefault
            && parseBoolean(process.env.VALIDATION_MODE, deployment.environmentBehavior.validationModeDefault)
        ),
      demoScenariosEnabled:
        parseBoolean(
          process.env.ENABLE_DEMO_SCENARIOS,
          deployment.environmentBehavior.demoModeDefault
        ),
      feedbackEnabled:
        parseBoolean(
          process.env.ENABLE_FEEDBACK_CAPTURE,
          parseBoolean(process.env.VALIDATION_MODE, deployment.environmentBehavior.validationModeDefault)
        ),
      shareSnapshotExpirationDays: parsePositiveInteger(
        process.env.SHARED_SNAPSHOT_EXPIRATION_DAYS,
        DEFAULT_SHARE_SNAPSHOT_EXPIRATION_DAYS
      )
    },
    workflow: {
      shortlistsEnabled: parseBoolean(process.env.ENABLE_SHORTLISTS, true),
      resultNotesEnabled: parseBoolean(process.env.ENABLE_RESULT_NOTES, true),
      historicalCompareEnabled: parseBoolean(process.env.ENABLE_HISTORICAL_COMPARE, true),
      sharedShortlistsEnabled: parseBoolean(process.env.ENABLE_SHARED_SHORTLISTS, true),
      sharedCommentsEnabled: parseBoolean(process.env.ENABLE_SHARED_COMMENTS, true),
      reviewerDecisionsEnabled: parseBoolean(process.env.ENABLE_REVIEWER_DECISIONS, true)
    },
    ops: {
      pilotOpsEnabled: parseBoolean(process.env.ENABLE_PILOT_OPS, false),
      internalOpsUiEnabled: parseBoolean(process.env.ENABLE_INTERNAL_OPS_UI, false),
      pilotLinksEnabled: parseBoolean(process.env.ENABLE_PILOT_LINKS, false)
    },
    product: {
      enabled: parseBoolean(process.env.ENABLE_PLAN_CAPABILITIES, DEFAULT_ENABLE_PLAN_CAPABILITIES),
      defaultPlanTier: parsePlanTier(process.env.DEFAULT_PLAN_TIER, DEFAULT_DEFAULT_PLAN_TIER),
      maxSavedSearchesPerSession: parsePositiveInteger(
        process.env.MAX_SAVED_SEARCHES_PER_SESSION,
        DEFAULT_MAX_SAVED_SEARCHES_PER_SESSION
      ),
      maxShortlistsPerSession: parsePositiveInteger(
        process.env.MAX_SHORTLISTS_PER_SESSION,
        DEFAULT_MAX_SHORTLISTS_PER_SESSION
      ),
      maxShareLinksPerSession: parsePositiveInteger(
        process.env.MAX_SHARE_LINKS_PER_SESSION,
        DEFAULT_MAX_SHARE_LINKS_PER_SESSION
      ),
      maxExportsPerSession: parsePositiveInteger(
        process.env.MAX_EXPORTS_PER_SESSION,
        DEFAULT_MAX_EXPORTS_PER_SESSION
      ),
      usageFunnelSummaryEnabled: parseBoolean(
        process.env.ENABLE_USAGE_FUNNEL_SUMMARY,
        DEFAULT_ENABLE_USAGE_FUNNEL_SUMMARY
      ),
      usageFrictionSummaryEnabled: parseBoolean(
        process.env.ENABLE_USAGE_FRICTION_SUMMARY,
        DEFAULT_ENABLE_USAGE_FRICTION_SUMMARY
      ),
      exportLimitsEnabled: parseBoolean(
        process.env.ENABLE_EXPORT_LIMITS,
        DEFAULT_ENABLE_EXPORT_LIMITS
      )
    },
    safety: getSafetyConfig(),
    listings: getListingConfig(),
    geocoder: getGeocoderConfig(),
    searchQuality: getSearchQualityConfig(),
    dataQuality: getDataQualityConfig(),
    performance: getPerformanceConfig(),
    security: getSecurityConfig(runtimeEnvironment),
    deployment
  });

  cachedConfig = config;
  return config;
}

export function getSearchQualityConfig(): SearchQualityConfig {
  const allowedListingStatuses = (process.env.ALLOWED_LISTING_STATUSES ?? DEFAULT_ALLOWED_LISTING_STATUSES.join(","))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    allowedListingStatuses:
      allowedListingStatuses.length > 0 ? allowedListingStatuses : [...DEFAULT_ALLOWED_LISTING_STATUSES],
    comparableSqftTolerancePercent: parsePositiveInteger(
      process.env.COMPARABLE_SQFT_TOLERANCE_PERCENT,
      DEFAULT_COMPARABLE_SQFT_TOLERANCE_PERCENT
    ),
    comparableBedroomTolerance: parsePositiveInteger(
      process.env.COMPARABLE_BEDROOM_TOLERANCE,
      DEFAULT_COMPARABLE_BEDROOM_TOLERANCE
    ),
    minComparableSampleSize: parsePositiveInteger(
      process.env.MIN_COMPARABLE_SAMPLE_SIZE,
      DEFAULT_MIN_COMPARABLE_SAMPLE_SIZE
    )
  };
}

export function getDataQualityConfig(): DataQualityConfig {
  return {
    enabled: String(process.env.DATA_QUALITY_RULES_ENABLED ?? String(DEFAULT_DATA_QUALITY_RULES_ENABLED)) === "true",
    staleListingHours: parsePositiveInteger(
      process.env.QUALITY_STALE_LISTING_HOURS,
      DEFAULT_QUALITY_STALE_LISTING_HOURS
    ),
    staleSafetyHours: parsePositiveInteger(
      process.env.QUALITY_STALE_SAFETY_HOURS,
      DEFAULT_QUALITY_STALE_SAFETY_HOURS
    ),
    staleGeocodeHours: parsePositiveInteger(
      process.env.QUALITY_STALE_GEOCODE_HOURS,
      DEFAULT_QUALITY_STALE_GEOCODE_HOURS
    ),
    maxPricePerSqft: parsePositiveInteger(
      process.env.QUALITY_MAX_PRICE_PER_SQFT,
      DEFAULT_QUALITY_MAX_PRICE_PER_SQFT
    ),
    minComparableSampleSize: parsePositiveInteger(
      process.env.QUALITY_MIN_COMPARABLE_SAMPLE_SIZE,
      DEFAULT_MIN_COMPARABLE_SAMPLE_SIZE
    ),
    lowPrecisionAddressAllowed:
      String(
        process.env.QUALITY_LOW_PRECISION_ADDRESS_ALLOWED ??
          String(DEFAULT_QUALITY_LOW_PRECISION_ADDRESS_ALLOWED)
      ) === "true"
  };
}

export function getPerformanceConfig(): PerformanceConfig {
  return {
    internalTimingEnabled:
      String(
        process.env.SEARCH_INTERNAL_TIMING_ENABLED ??
          String(DEFAULT_SEARCH_INTERNAL_TIMING_ENABLED)
      ) === "true",
    providerBudgetsEnabled:
      String(
        process.env.PROVIDER_BUDGETS_ENABLED ?? String(DEFAULT_PROVIDER_BUDGETS_ENABLED)
      ) === "true",
    listingProviderMaxCallsPerMinute: parsePositiveInteger(
      process.env.LISTING_PROVIDER_MAX_CALLS_PER_MINUTE,
      DEFAULT_LISTING_PROVIDER_MAX_CALLS_PER_MINUTE
    ),
    safetyProviderMaxCallsPerMinute: parsePositiveInteger(
      process.env.SAFETY_PROVIDER_MAX_CALLS_PER_MINUTE,
      DEFAULT_SAFETY_PROVIDER_MAX_CALLS_PER_MINUTE
    ),
    geocoderProviderMaxCallsPerMinute: parsePositiveInteger(
      process.env.GEOCODER_PROVIDER_MAX_CALLS_PER_MINUTE,
      DEFAULT_GEOCODER_PROVIDER_MAX_CALLS_PER_MINUTE
    ),
    opsDefaultPageSize: parsePositiveInteger(
      process.env.OPS_DEFAULT_PAGE_SIZE,
      DEFAULT_OPS_DEFAULT_PAGE_SIZE
    ),
    opsMaxPageSize: parsePositiveInteger(
      process.env.OPS_MAX_PAGE_SIZE,
      DEFAULT_OPS_MAX_PAGE_SIZE
    ),
    internalPerfSummaryEnabled:
      String(
        process.env.ENABLE_INTERNAL_PERF_SUMMARY ??
          String(DEFAULT_ENABLE_INTERNAL_PERF_SUMMARY)
      ) === "true"
  };
}

export function resetConfigCache(): void {
  cachedConfig = null;
}

export function weightsAreValid(weights: SearchWeights): boolean {
  const total = weights.price + weights.size + weights.safety;

  return (
    total === 100 &&
    weights.price >= 0 &&
    weights.size >= 0 &&
    weights.safety >= 0
  );
}
