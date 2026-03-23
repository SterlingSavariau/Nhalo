import type { PropertyType, SafetyProviderMode, SearchWeights } from "@nhalo/types";

export const DEFAULT_RADIUS_MILES = 5;
export const DEFAULT_RESULT_LIMIT = 25;
export const PROVIDER_TIMEOUT_MS = 1500;
export const MARKET_SNAPSHOT_FRESH_HOURS = 24;
export const DEFAULT_SAFETY_PROVIDER_MODE: SafetyProviderMode = "hybrid";
export const DEFAULT_SAFETY_CACHE_TTL_HOURS = 24;
export const DEFAULT_SAFETY_STALE_TTL_HOURS = 168;
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

export interface AppConfig {
  port: number;
  apiUrl: string;
  databaseUrl?: string;
  safety: SafetyConfig;
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

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function parseSafetyMode(value: string | undefined): SafetyProviderMode {
  if (value === "mock" || value === "hybrid" || value === "live") {
    return value;
  }

  return DEFAULT_SAFETY_PROVIDER_MODE;
}

export function getSafetyConfig(): SafetyConfig {
  const crimeBaseUrl = process.env.CRIME_PROVIDER_BASE_URL?.trim();
  const crimeApiKey = process.env.CRIME_PROVIDER_API_KEY?.trim();
  const schoolBaseUrl = process.env.SCHOOL_PROVIDER_BASE_URL?.trim();
  const schoolApiKey = process.env.SCHOOL_PROVIDER_API_KEY?.trim();

  return {
    mode: parseSafetyMode(process.env.SAFETY_PROVIDER_MODE),
    cacheTtlHours: parsePositiveInteger(
      process.env.SAFETY_CACHE_TTL_HOURS,
      DEFAULT_SAFETY_CACHE_TTL_HOURS
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

export function getConfig(): AppConfig {
  return {
    port: Number(process.env.PORT ?? 3000),
    apiUrl: process.env.NHALO_API_URL ?? `http://localhost:${process.env.PORT ?? 3000}`,
    databaseUrl: process.env.DATABASE_URL,
    safety: getSafetyConfig()
  };
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
