import {
  InMemoryGeocodeCacheRepository,
  InMemoryListingCacheRepository,
  InMemoryMarketSnapshotRepository,
  InMemorySafetySignalCacheRepository,
  InMemorySearchRepository
} from "@nhalo/db";
import { createMockProviders } from "@nhalo/providers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { MetricsCollector } from "../src/metrics";

describe("offer preparation workflow", () => {
  const sessionId = "offer-preparation-session-1";
  const repository = new InMemorySearchRepository();
  const marketSnapshotRepository = new InMemoryMarketSnapshotRepository();
  const safetySignalCacheRepository = new InMemorySafetySignalCacheRepository();
  const listingCacheRepository = new InMemoryListingCacheRepository();
  const geocodeCacheRepository = new InMemoryGeocodeCacheRepository();
  const providers = createMockProviders();
  const metrics = new MetricsCollector();
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({
      marketSnapshotRepository,
      metrics,
      repository,
      geocodeCacheRepository,
      listingCacheRepository,
      safetySignalCacheRepository,
      providers
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates, restores, updates, and summarizes offer preparation", async () => {
    const financialResponse = await app.inject({
      method: "POST",
      url: "/financial-readiness",
      headers: {
        "x-nhalo-session-id": sessionId
      },
      payload: {
        annualHouseholdIncome: 185000,
        monthlyDebtPayments: 900,
        availableCashSavings: 95000,
        creditScoreRange: "good_720_759",
        desiredHomePrice: 589000,
        purchaseLocation: "Royal Oak, MI",
        downPaymentPreferencePercent: 10,
        loanType: "conventional",
        preApprovalStatus: "verified",
        proofOfFundsStatus: "verified"
      }
    });

    expect(financialResponse.statusCode).toBe(201);
    const financialReadiness = financialResponse.json();
    expect(financialReadiness.readinessState).toBe("READY");

    const shortlistResponse = await app.inject({
      method: "POST",
      url: "/shortlists",
      headers: {
        "x-nhalo-session-id": sessionId
      },
      payload: {
        title: "Family shortlist"
      }
    });
    expect(shortlistResponse.statusCode).toBe(201);
    const shortlist = shortlistResponse.json();

    const shortlistItemResponse = await app.inject({
      method: "POST",
      url: `/shortlists/${shortlist.id}/items`,
      payload: {
        canonicalPropertyId: "canonical-1",
        capturedHome: {
          id: "home-1",
          address: "123 Main St",
          city: "Royal Oak",
          state: "MI",
          zipCode: "48067",
          propertyType: "single_family",
          price: 585000,
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
          neighborhoodSafetyScore: 84,
          explanation: "Strong family fit",
          scores: {
            price: 71,
            size: 78,
            safety: 84,
            nhalo: 77,
            safetyConfidence: "high",
            overallConfidence: "high",
            formulaVersion: "nhalo-v1"
          }
        }
      }
    });
    expect(shortlistItemResponse.statusCode).toBe(201);

    const createResponse = await app.inject({
      method: "POST",
      url: "/offer-preparation",
      headers: {
        "x-nhalo-session-id": sessionId
      },
      payload: {
        propertyId: "canonical-1",
        propertyAddressLabel: "123 Main St, Royal Oak, MI",
        shortlistId: shortlist.id,
        financialReadinessId: financialReadiness.id,
        offerPrice: 589000,
        earnestMoneyAmount: 8000,
        downPaymentType: "percent",
        downPaymentPercent: 10,
        financingContingency: "included",
        inspectionContingency: "included",
        appraisalContingency: "included",
        closingTimelineDays: 30,
        possessionTiming: "at_closing"
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const record = createResponse.json();
    expect(record.offerState).toBe("READY");
    expect(record.readinessToSubmit).toBe(true);
    expect(record.nextAction).toBe("Proceed to offer submission");
    expect(record.strategyDefaultsProvenance).toBe(null);

    const latestResponse = await app.inject({
      method: "GET",
      url: `/offer-preparation?propertyId=canonical-1&shortlistId=${encodeURIComponent(shortlist.id)}`,
      headers: {
        "x-nhalo-session-id": sessionId
      }
    });
    expect(latestResponse.statusCode).toBe(200);
    expect(latestResponse.json().record.id).toBe(record.id);

    const getResponse = await app.inject({
      method: "GET",
      url: `/offer-preparation/${record.id}`
    });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json().offerPrice).toBe(589000);

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/offer-preparation/${record.id}`,
      payload: {
        earnestMoneyAmount: 2500,
        inspectionContingency: "waived"
      }
    });
    expect(updateResponse.statusCode).toBe(200);
    const updated = updateResponse.json();
    expect(updated.offerRiskLevel).toBe("MODERATE_RISK");
    expect(updated.nextAction).toBe("Increase earnest money");

    const summaryResponse = await app.inject({
      method: "GET",
      url: `/offer-preparation/${record.id}/summary`
    });
    expect(summaryResponse.statusCode).toBe(200);
    expect(summaryResponse.json().offerSummary.propertyId).toBe("canonical-1");

    const workflowActivityResponse = await app.inject({
      method: "GET",
      url: "/workflow/activity?limit=10",
      headers: {
        "x-nhalo-session-id": sessionId
      }
    });
    expect(workflowActivityResponse.statusCode).toBe(200);
    expect(
      workflowActivityResponse.json().activity.some((entry: { eventType: string }) =>
        entry.eventType === "offer_preparation_created"
      )
    ).toBe(true);

    const shortlistItemsResponse = await app.inject({
      method: "GET",
      url: `/shortlists/${shortlist.id}/items`
    });
    expect(shortlistItemsResponse.statusCode).toBe(200);
    expect(shortlistItemsResponse.json().offerPreparations).toHaveLength(1);

    const metricsResponse = await app.inject({
      method: "GET",
      url: "/metrics"
    });
    const metricsPayload = metricsResponse.json();
    expect(metricsPayload.offerPreparationCreateCount).toBe(1);
    expect(metricsPayload.offerPreparationUpdateCount).toBe(1);
    expect(metricsPayload.offerPreparationSummaryViewCount).toBe(1);
  });

  it("applies strategy defaults only to a new empty draft, preserves buyer edits, and clears active strategy when the selected choice is dropped", async () => {
    const financialResponse = await app.inject({
      method: "POST",
      url: "/financial-readiness",
      headers: {
        "x-nhalo-session-id": sessionId
      },
      payload: {
        annualHouseholdIncome: 185000,
        monthlyDebtPayments: 900,
        availableCashSavings: 95000,
        creditScoreRange: "good_720_759",
        desiredHomePrice: 585000,
        purchaseLocation: "Royal Oak, MI",
        downPaymentPreferencePercent: 10,
        loanType: "conventional",
        preApprovalStatus: "verified",
        proofOfFundsStatus: "verified"
      }
    });
    const financialReadiness = financialResponse.json();

    const shortlistResponse = await app.inject({
      method: "POST",
      url: "/shortlists",
      headers: {
        "x-nhalo-session-id": sessionId
      },
      payload: {
        title: "Strategy shortlist"
      }
    });
    const shortlist = shortlistResponse.json();

    const shortlistItemResponse = await app.inject({
      method: "POST",
      url: `/shortlists/${shortlist.id}/items`,
      payload: {
        canonicalPropertyId: "canonical-strategy-1",
        capturedHome: {
          id: "home-strategy-1",
          address: "789 Strategy Ln",
          city: "Royal Oak",
          state: "MI",
          zipCode: "48067",
          propertyType: "single_family",
          price: 585000,
          sqft: 2100,
          bedrooms: 4,
          bathrooms: 3,
          canonicalPropertyId: "canonical-strategy-1",
          distanceMiles: 2.1,
          insideRequestedRadius: true,
          listingStatus: "active",
          daysOnMarket: 4,
          pricePerSqft: 279,
          medianPricePerSqft: 290,
          comparableSampleSize: 6,
          comparableStrategyUsed: "local_radius_fallback",
          qualityFlags: [],
          strengths: [],
          risks: [],
          confidenceReasons: [],
          provenance: {
            listingDataSource: "live",
            listingProvider: "ListingProvider",
            listingFetchedAt: null,
            sourceListingId: "src-strategy-1",
            safetyDataSource: "cached_live",
            crimeProvider: "CrimeProvider",
            schoolProvider: "SchoolProvider",
            crimeFetchedAt: null,
            schoolFetchedAt: null,
            geocodeDataSource: "live",
            geocodeProvider: "GeocoderProvider",
            geocodeFetchedAt: null,
            geocodePrecision: "rooftop"
          },
          neighborhoodSafetyScore: 84,
          explanation: "Strong family fit",
          scores: {
            price: 71,
            size: 78,
            safety: 84,
            nhalo: 77,
            safetyConfidence: "high",
            overallConfidence: "high",
            formulaVersion: "nhalo-v1"
          }
        }
      }
    });
    const shortlistItem = shortlistItemResponse.json();

    const selectResponse = await app.inject({
      method: "POST",
      url: `/shortlists/${shortlist.id}/items/${shortlistItem.id}/select`,
      payload: {
        decisionConfidence: "high",
        decisionRationale: "Advance this home first."
      }
    });
    expect(selectResponse.statusCode).toBe(200);

    const offerReadinessResponse = await app.inject({
      method: "POST",
      url: "/offer-readiness",
      headers: {
        "x-nhalo-session-id": sessionId
      },
      payload: {
        shortlistId: shortlist.id,
        propertyId: "canonical-strategy-1",
        status: "READY",
        financingReadiness: "preapproved",
        propertyFitConfidence: "high",
        riskToleranceAlignment: "aligned",
        riskLevel: "competitive",
        userConfirmed: true
      }
    });
    expect(offerReadinessResponse.statusCode).toBe(201);

    const summaryBeforeCreate = await app.inject({
      method: "GET",
      url: `/shortlists/${shortlist.id}/selected-choice/summary`
    });
    expect(summaryBeforeCreate.statusCode).toBe(200);
    expect(summaryBeforeCreate.json().offerStrategy.offerPosture).toBe("prepare_competitive_offer");

    const createResponse = await app.inject({
      method: "POST",
      url: "/offer-preparation",
      headers: {
        "x-nhalo-session-id": sessionId
      },
      payload: {
        propertyId: "canonical-strategy-1",
        propertyAddressLabel: "789 Strategy Ln, Royal Oak, MI",
        shortlistId: shortlist.id,
        offerReadinessId: offerReadinessResponse.json().id,
        financialReadinessId: financialReadiness.id,
        earnestMoneyAmount: 8000,
        downPaymentType: "percent",
        downPaymentPercent: 10,
        financingContingency: "included",
        inspectionContingency: "included",
        appraisalContingency: "included",
        possessionTiming: "at_closing"
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const record = createResponse.json();
    expect(record.offerPrice).toBe(summaryBeforeCreate.json().offerStrategy.pricePosition.recommendedOfferPrice);
    expect(record.closingTimelineDays).toBe(14);
    expect(record.strategyDefaultsProvenance.appliedFieldKeys).toEqual([
      "offerPrice",
      "closingTimelineDays"
    ]);
    expect(record.strategyDefaultsProvenance.sourceOfferPosture).toBe("prepare_competitive_offer");

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/offer-preparation/${record.id}`,
      payload: {
        offerPrice: 579000,
        closingTimelineDays: 28
      }
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().offerPrice).toBe(579000);
    expect(updateResponse.json().closingTimelineDays).toBe(28);
    expect(updateResponse.json().strategyDefaultsProvenance.appliedFieldKeys).toEqual([
      "offerPrice",
      "closingTimelineDays"
    ]);

    const dropResponse = await app.inject({
      method: "POST",
      url: `/shortlists/${shortlist.id}/items/${shortlistItem.id}/drop`,
      payload: {
        droppedReason: "other"
      }
    });
    expect(dropResponse.statusCode).toBe(200);

    const summaryAfterDrop = await app.inject({
      method: "GET",
      url: `/shortlists/${shortlist.id}/selected-choice/summary`
    });
    expect(summaryAfterDrop.statusCode).toBe(200);
    expect(summaryAfterDrop.json().offerStrategy).toBe(null);
  });

  it("degrades to guidance-only behavior when strategy confidence is low", async () => {
    const financialResponse = await app.inject({
      method: "POST",
      url: "/financial-readiness",
      headers: {
        "x-nhalo-session-id": sessionId
      },
      payload: {
        annualHouseholdIncome: 185000,
        monthlyDebtPayments: 900,
        availableCashSavings: 95000,
        creditScoreRange: "good_720_759",
        desiredHomePrice: 535000,
        purchaseLocation: "Royal Oak, MI",
        downPaymentPreferencePercent: 10,
        loanType: "conventional",
        preApprovalStatus: "verified",
        proofOfFundsStatus: "verified"
      }
    });
    const financialReadiness = financialResponse.json();

    const shortlistResponse = await app.inject({
      method: "POST",
      url: "/shortlists",
      headers: {
        "x-nhalo-session-id": sessionId
      },
      payload: {
        title: "Low confidence shortlist"
      }
    });
    const shortlist = shortlistResponse.json();

    const shortlistItemResponse = await app.inject({
      method: "POST",
      url: `/shortlists/${shortlist.id}/items`,
      payload: {
        canonicalPropertyId: "canonical-low-confidence-1",
        capturedHome: {
          id: "home-low-confidence-1",
          address: "321 Verify First Dr",
          city: "Royal Oak",
          state: "MI",
          zipCode: "48067",
          propertyType: "single_family",
          price: 535000,
          sqft: 1980,
          bedrooms: 4,
          bathrooms: 2.5,
          canonicalPropertyId: "canonical-low-confidence-1",
          distanceMiles: 2.4,
          insideRequestedRadius: true,
          qualityFlags: ["limitedComparables"],
          strengths: [],
          risks: [],
          confidenceReasons: [],
          provenance: {
            listingDataSource: "stale_cached_live",
            listingProvider: "ListingProvider",
            listingFetchedAt: null,
            sourceListingId: "src-low-1",
            safetyDataSource: "cached_live",
            crimeProvider: "CrimeProvider",
            schoolProvider: "SchoolProvider",
            crimeFetchedAt: null,
            schoolFetchedAt: null,
            geocodeDataSource: "live",
            geocodeProvider: "GeocoderProvider",
            geocodeFetchedAt: null,
            geocodePrecision: "rooftop"
          },
          neighborhoodSafetyScore: 77,
          explanation: "Needs verification.",
          scores: {
            price: 70,
            size: 76,
            safety: 77,
            nhalo: 74,
            safetyConfidence: "medium",
            overallConfidence: "low",
            formulaVersion: "nhalo-v1"
          }
        }
      }
    });
    const shortlistItem = shortlistItemResponse.json();

    await app.inject({
      method: "POST",
      url: `/shortlists/${shortlist.id}/items/${shortlistItem.id}/select`,
      payload: {
        decisionConfidence: "medium"
      }
    });

    await app.inject({
      method: "POST",
      url: "/offer-readiness",
      headers: {
        "x-nhalo-session-id": sessionId
      },
      payload: {
        shortlistId: shortlist.id,
        propertyId: "canonical-low-confidence-1",
        status: "READY",
        financingReadiness: "preapproved",
        propertyFitConfidence: "medium",
        riskToleranceAlignment: "aligned",
        riskLevel: "balanced",
        userConfirmed: true
      }
    });

    const summaryResponse = await app.inject({
      method: "GET",
      url: `/shortlists/${shortlist.id}/selected-choice/summary`
    });
    expect(summaryResponse.statusCode).toBe(200);
    expect(summaryResponse.json().offerStrategy.strategyConfidence).toBe("low");

    const createResponse = await app.inject({
      method: "POST",
      url: "/offer-preparation",
      headers: {
        "x-nhalo-session-id": sessionId
      },
      payload: {
        propertyId: "canonical-low-confidence-1",
        propertyAddressLabel: "321 Verify First Dr, Royal Oak, MI",
        shortlistId: shortlist.id,
        financialReadinessId: financialReadiness.id,
        earnestMoneyAmount: 5000,
        downPaymentType: "percent",
        downPaymentPercent: 10,
        financingContingency: "included",
        inspectionContingency: "included",
        appraisalContingency: "included",
        possessionTiming: "at_closing"
      }
    });
    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json().offerPrice).toBe(null);
    expect(createResponse.json().closingTimelineDays).toBe(null);
    expect(createResponse.json().strategyDefaultsProvenance).toBe(null);
  });
});
