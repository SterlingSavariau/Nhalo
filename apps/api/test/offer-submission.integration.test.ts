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

describe("offer submission workflow", () => {
  const sessionId = "offer-submission-session-1";
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

  it("creates, submits, counters, and summarizes offer submission", async () => {
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
    const financialReadiness = financialResponse.json();

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
    const shortlist = shortlistResponse.json();

    await app.inject({
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

    const offerPreparationResponse = await app.inject({
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
    const offerPreparation = offerPreparationResponse.json();
    expect(offerPreparation.readinessToSubmit).toBe(true);

    const createResponse = await app.inject({
      method: "POST",
      url: "/offer-submission",
      headers: {
        "x-nhalo-session-id": sessionId
      },
      payload: {
        propertyId: "canonical-1",
        propertyAddressLabel: "123 Main St, Royal Oak, MI",
        shortlistId: shortlist.id,
        financialReadinessId: financialReadiness.id,
        offerPreparationId: offerPreparation.id,
        submissionMethod: "recorded_manual",
        offerExpirationAt: "2026-04-04T17:00:00.000Z",
        notes: "Buyer wants a quick answer."
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const record = createResponse.json();
    expect(record.submissionState).toBe("READY_TO_SUBMIT");
    expect(record.nextAction).toBe("Submit offer");

    const submitResponse = await app.inject({
      method: "POST",
      url: `/offer-submission/${record.id}/submit`,
      payload: {
        submittedAt: "2026-04-02T15:30:00.000Z"
      }
    });
    expect(submitResponse.statusCode).toBe(200);
    expect(submitResponse.json().submissionState).toBe("SUBMITTED");

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/offer-submission/${record.id}`,
      payload: {
        sellerResponseState: "COUNTERED",
        sellerRespondedAt: "2026-04-03T10:00:00.000Z",
        counterofferPrice: 595000,
        counterofferClosingTimelineDays: 21,
        counterofferFinancingContingency: "included",
        counterofferInspectionContingency: "included",
        counterofferAppraisalContingency: "waived",
        counterofferExpirationAt: "2026-04-04T10:00:00.000Z",
        internalActivityNote: "Seller wants a faster close and weaker appraisal protection."
      }
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().submissionState).toBe("COUNTERED");
    expect(updateResponse.json().nextAction).toBe("Accept counteroffer");

    const counterResponse = await app.inject({
      method: "POST",
      url: `/offer-submission/${record.id}/counter-response`,
      payload: {
        buyerCounterDecision: "accepted"
      }
    });
    expect(counterResponse.statusCode).toBe(200);
    expect(counterResponse.json().submissionState).toBe("ACCEPTED");

    const latestResponse = await app.inject({
      method: "GET",
      url: `/offer-submission?propertyId=canonical-1&shortlistId=${encodeURIComponent(shortlist.id)}`,
      headers: {
        "x-nhalo-session-id": sessionId
      }
    });
    expect(latestResponse.statusCode).toBe(200);
    expect(latestResponse.json().record.id).toBe(record.id);

    const getResponse = await app.inject({
      method: "GET",
      url: `/offer-submission/${record.id}`
    });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json().sellerResponseState).toBe("COUNTERED");

    const summaryResponse = await app.inject({
      method: "GET",
      url: `/offer-submission/${record.id}/summary`
    });
    expect(summaryResponse.statusCode).toBe(200);
    expect(summaryResponse.json().submissionState).toBe("ACCEPTED");

    const shortlistItemsResponse = await app.inject({
      method: "GET",
      url: `/shortlists/${shortlist.id}/items`
    });
    expect(shortlistItemsResponse.statusCode).toBe(200);
    expect(shortlistItemsResponse.json().offerSubmissions).toHaveLength(1);

    const workflowActivityResponse = await app.inject({
      method: "GET",
      url: "/workflow/activity?limit=20",
      headers: {
        "x-nhalo-session-id": sessionId
      }
    });
    expect(workflowActivityResponse.statusCode).toBe(200);
    expect(
      workflowActivityResponse.json().activity.some((entry: { eventType: string }) =>
        entry.eventType === "offer_submission_submitted"
      )
    ).toBe(true);

    const metricsResponse = await app.inject({
      method: "GET",
      url: "/metrics"
    });
    const metricsPayload = metricsResponse.json();
    expect(metricsPayload.offerSubmissionCreateCount).toBe(1);
    expect(metricsPayload.offerSubmissionSubmitCount).toBe(1);
    expect(metricsPayload.offerSubmissionUpdateCount).toBeGreaterThanOrEqual(2);
    expect(metricsPayload.offerSubmissionSummaryViewCount).toBe(1);
    expect(metricsPayload.offerSubmissionAcceptCount).toBe(1);
  });
});
