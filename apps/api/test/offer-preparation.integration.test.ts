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
});
