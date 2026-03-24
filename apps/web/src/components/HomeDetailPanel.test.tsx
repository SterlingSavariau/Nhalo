import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HomeDetailPanel } from "./HomeDetailPanel";

describe("HomeDetailPanel", () => {
  it("renders detail facts, family tradeoffs, provenance, and audit entry points", () => {
    const home = {
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
      qualityFlags: ["staleSafetyData", "limitedComparables"],
      strengths: ["Strong neighborhood safety"],
      risks: ["Listing data came from stale cache"],
      confidenceReasons: ["Safety data came from stale cache."],
      explainability: {
        headline: "Strong space with solid value. Neighborhood safety is the main tradeoff.",
        strengths: ["Strong neighborhood safety"],
        risks: ["Listing data came from stale cache"],
        scoreDrivers: {
          primary: "size" as const,
          secondary: "price" as const,
          weakest: "safety" as const
        }
      },
      provenance: {
        listingDataSource: "cached_live" as const,
        listingProvider: "ListingSourceProvider",
        listingFetchedAt: "2026-03-23T12:00:00.000Z",
        sourceListingId: "source-1",
        safetyDataSource: "stale_cached_live" as const,
        crimeProvider: "CrimeSignalProvider",
        schoolProvider: "SchoolSignalProvider",
        crimeFetchedAt: "2026-03-20T12:00:00.000Z",
        schoolFetchedAt: "2026-03-20T12:00:00.000Z",
        geocodeDataSource: "cached_live" as const,
        geocodeProvider: "GeocodingSourceProvider",
        geocodeFetchedAt: "2026-03-23T12:00:00.000Z",
        geocodePrecision: "centroid" as const
      },
      neighborhoodSafetyScore: 61,
      explanation: "Strong space with solid value.",
      scores: {
        price: 77,
        size: 88,
        safety: 61,
        nhalo: 76,
        safetyConfidence: "medium" as const,
        overallConfidence: "low" as const,
        formulaVersion: "nhalo-v1"
      }
    };

    const markup = renderToStaticMarkup(
      <HomeDetailPanel allHomes={[home]} home={home} onClose={vi.fn()} onViewAudit={vi.fn()} />
    );

    expect(markup).toContain("Home detail");
    expect(markup).toContain("Family tradeoffs");
    expect(markup).toContain("Freshness and provenance");
    expect(markup).toContain("Search origin precision");
    expect(markup).toContain("View audit details");
  });
});
