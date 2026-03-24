import { describe, expect, it } from "vitest";
import { buildSharedSnapshotMetadata, getBrandingConfig } from "./branding";

describe("branding config", () => {
  it("uses safe defaults when branding env is missing", () => {
    const config = getBrandingConfig({});

    expect(config.appName).toBe("Nhalo");
    expect(config.tagline).toContain("family");
    expect(config.enableDemoMode).toBe(true);
    expect(config.enablePilotCta).toBe(false);
  });

  it("builds metadata for shared snapshots from stored summary data", () => {
    const metadata = buildSharedSnapshotMetadata(
      {
        id: "snapshot-1",
        formulaVersion: "nhalo-v1",
        request: {
          locationType: "city",
          locationValue: "Southfield, MI",
          radiusMiles: 5,
          budget: { max: 425000 },
          minSqft: 1800,
          minBedrooms: 3,
          propertyTypes: ["single_family", "condo", "townhome"],
          preferences: [],
          weights: { price: 40, size: 30, safety: 30 }
        },
        response: {
          homes: [
            {
              id: "home-1",
              address: "123 Main St",
              city: "Southfield",
              state: "MI",
              zipCode: "48075",
              propertyType: "single_family",
              price: 385000,
              sqft: 2100,
              bedrooms: 4,
              bathrooms: 3,
              canonicalPropertyId: "canonical-1",
              distanceMiles: 2.1,
              insideRequestedRadius: true,
              qualityFlags: [],
              strengths: [],
              risks: [],
              confidenceReasons: [],
              explainability: {
                headline: "Strong family fit.",
                strengths: [],
                risks: [],
                scoreDrivers: {
                  primary: "size",
                  secondary: "price",
                  weakest: "safety"
                }
              },
              provenance: {
                listingDataSource: "live",
                listingProvider: "ListingSourceProvider",
                listingFetchedAt: "2026-03-23T12:00:00.000Z",
                sourceListingId: "source-1",
                safetyDataSource: "live",
                crimeProvider: "CrimeSignalProvider",
                schoolProvider: "SchoolSignalProvider",
                crimeFetchedAt: "2026-03-23T12:00:00.000Z",
                schoolFetchedAt: "2026-03-23T12:00:00.000Z",
                geocodeDataSource: "live",
                geocodeProvider: "GeocodingSourceProvider",
                geocodeFetchedAt: "2026-03-23T12:00:00.000Z",
                geocodePrecision: "rooftop"
              },
              neighborhoodSafetyScore: 78,
              explanation: "Strong family fit.",
              scores: {
                price: 77,
                size: 88,
                safety: 78,
                nhalo: 81,
                safetyConfidence: "high",
                overallConfidence: "high",
                formulaVersion: "nhalo-v1"
              }
            }
          ],
          appliedFilters: {
            locationType: "city",
            locationValue: "Southfield, MI",
            radiusMiles: 5,
            budget: { max: 425000 },
            minSqft: 1800,
            minBedrooms: 3,
            propertyTypes: ["single_family", "condo", "townhome"],
            preferences: []
          },
          appliedWeights: { price: 40, size: 30, safety: 30 },
          metadata: {
            totalCandidatesScanned: 12,
            totalMatched: 4,
            returnedCount: 1,
            durationMs: 45,
            warnings: [],
            suggestions: []
          }
        },
        createdAt: "2026-03-23T12:00:00.000Z"
      },
      getBrandingConfig({
        VITE_APP_NAME: "Nhalo Pilot",
        VITE_SHARED_NOINDEX: "true"
      })
    );

    expect(metadata.title).toContain("Nhalo Pilot");
    expect(metadata.description).toContain("123 Main St");
    expect(metadata.noIndex).toBe(true);
  });
});
