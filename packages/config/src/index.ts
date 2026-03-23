import type { PropertyType, SearchWeights } from "@nhalo/types";

export const DEFAULT_RADIUS_MILES = 5;
export const DEFAULT_RESULT_LIMIT = 25;
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
}

export function getConfig(): AppConfig {
  return {
    port: Number(process.env.PORT ?? 3000),
    apiUrl: process.env.NHALO_API_URL ?? `http://localhost:${process.env.PORT ?? 3000}`,
    databaseUrl: process.env.DATABASE_URL
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
