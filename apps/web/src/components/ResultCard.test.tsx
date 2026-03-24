import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ResultCard } from "./ResultCard";

describe("ResultCard", () => {
  it("renders explainability, confidence reasons, and provenance details from API fields", () => {
    const markup = renderToStaticMarkup(
      <ResultCard
        compared={false}
        compareDisabled={false}
        home={{
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
              primary: "size",
              secondary: "price",
              weakest: "safety"
            }
          },
          provenance: {
            listingDataSource: "cached_live",
            listingProvider: "ListingSourceProvider",
            listingFetchedAt: "2026-03-23T12:00:00.000Z",
            sourceListingId: "source-1",
            safetyDataSource: "stale_cached_live",
            crimeProvider: "CrimeSignalProvider",
            schoolProvider: "SchoolSignalProvider",
            crimeFetchedAt: "2026-03-20T12:00:00.000Z",
            schoolFetchedAt: "2026-03-20T12:00:00.000Z",
            geocodeDataSource: "cached_live",
            geocodeProvider: "GeocodingSourceProvider",
            geocodeFetchedAt: "2026-03-23T12:00:00.000Z",
            geocodePrecision: "centroid"
          },
          neighborhoodSafetyScore: 61,
          explanation: "Strong space with solid value.",
          scores: {
            price: 77,
            size: 88,
            safety: 61,
            nhalo: 76,
            safetyConfidence: "medium",
            overallConfidence: "low",
            formulaVersion: "nhalo-v1"
          }
        }}
        onToggleCompare={vi.fn()}
        onViewAudit={vi.fn()}
        rank={1}
      />
    );

    expect(markup).toContain("Why this home");
    expect(markup).toContain("Strong neighborhood safety");
    expect(markup).toContain("Safety data came from stale cache.");
    expect(markup).toContain("Listing Fresh");
    expect(markup).toContain("Safety Stale");
    expect(markup).toContain("Provenance and freshness");
  });
});
