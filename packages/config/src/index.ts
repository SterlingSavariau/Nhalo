import type {
  GeocoderProviderMode,
  ListingProviderMode,
  PropertyType,
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
export const DEFAULT_PROVIDER_RETRY_COUNT = 1;
export const DEFAULT_PROVIDER_RETRY_BACKOFF_MS = 150;
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
  safety: SafetyConfig;
  listings: ListingConfig;
  geocoder: GeocoderConfig;
  searchQuality: SearchQualityConfig;
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

function validateConfig(config: AppConfig): AppConfig {
  const details: Array<{ field: string; message: string }> = [];
  const rawNodeEnv = process.env.NODE_ENV;
  const rawProviderMode = process.env.PROVIDER_MODE;
  const rawGeocoderMode = process.env.GEOCODER_PROVIDER_MODE;
  const rawListingMode = process.env.LISTING_PROVIDER_MODE;
  const rawSafetyMode = process.env.SAFETY_PROVIDER_MODE;

  if (rawNodeEnv && !["development", "test", "staging", "production"].includes(rawNodeEnv)) {
    details.push({
      field: "NODE_ENV",
      message: "NODE_ENV must be development, test, staging, or production."
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
  const providerMode = parseProviderMode(process.env.PROVIDER_MODE);
  const defaultCacheTtlHours = parsePositiveInteger(process.env.CACHE_TTL, 24);
  const port = parsePort(process.env.PORT, 3000);
  const relaxedLimits = nodeEnv === "development" || nodeEnv === "test";
  const config = validateConfig({
    nodeEnv,
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
      enabled: process.env.VALIDATION_MODE === "true",
      sharedSnapshotsEnabled:
        process.env.ENABLE_SHARED_SNAPSHOTS === "true" || process.env.VALIDATION_MODE === "true",
      demoScenariosEnabled:
        process.env.ENABLE_DEMO_SCENARIOS === "true" || process.env.VALIDATION_MODE === "true",
      feedbackEnabled:
        process.env.ENABLE_FEEDBACK_CAPTURE === "true" || process.env.VALIDATION_MODE === "true",
      shareSnapshotExpirationDays: parsePositiveInteger(
        process.env.SHARED_SNAPSHOT_EXPIRATION_DAYS,
        DEFAULT_SHARE_SNAPSHOT_EXPIRATION_DAYS
      )
    },
    workflow: {
      shortlistsEnabled: String(process.env.ENABLE_SHORTLISTS ?? "true") === "true",
      resultNotesEnabled: String(process.env.ENABLE_RESULT_NOTES ?? "true") === "true",
      historicalCompareEnabled:
        String(process.env.ENABLE_HISTORICAL_COMPARE ?? "true") === "true",
      sharedShortlistsEnabled: String(process.env.ENABLE_SHARED_SHORTLISTS ?? "true") === "true",
      sharedCommentsEnabled: String(process.env.ENABLE_SHARED_COMMENTS ?? "true") === "true",
      reviewerDecisionsEnabled: String(process.env.ENABLE_REVIEWER_DECISIONS ?? "true") === "true"
    },
    safety: getSafetyConfig(),
    listings: getListingConfig(),
    geocoder: getGeocoderConfig(),
    searchQuality: getSearchQualityConfig()
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
