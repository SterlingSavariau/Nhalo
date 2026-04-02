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

describe("under contract coordination workflow", () => {
  const sessionId = "under-contract-session-1";
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

  it("creates, updates, summarizes, and surfaces under-contract coordination", async () => {
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

    const submissionCreateResponse = await app.inject({
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
        offerExpirationAt: "2026-04-04T17:00:00.000Z"
      }
    });
    const submission = submissionCreateResponse.json();

    await app.inject({
      method: "POST",
      url: `/offer-submission/${submission.id}/submit`,
      payload: {
        submittedAt: "2026-04-02T15:30:00.000Z"
      }
    });

    const acceptedResponse = await app.inject({
      method: "PATCH",
      url: `/offer-submission/${submission.id}`,
      payload: {
        sellerResponseState: "ACCEPTED",
        sellerRespondedAt: "2026-04-03T10:00:00.000Z"
      }
    });
    const acceptedSubmission = acceptedResponse.json();
    expect(acceptedSubmission.submissionState).toBe("ACCEPTED");

    const createResponse = await app.inject({
      method: "POST",
      url: "/under-contract",
      headers: {
        "x-nhalo-session-id": sessionId
      },
      payload: {
        propertyId: "canonical-1",
        propertyAddressLabel: "123 Main St, Royal Oak, MI",
        shortlistId: shortlist.id,
        financialReadinessId: financialReadiness.id,
        offerPreparationId: offerPreparation.id,
        offerSubmissionId: acceptedSubmission.id,
        acceptedAt: "2026-04-03T10:00:00.000Z",
        targetClosingDate: "2026-05-05T17:00:00.000Z",
        inspectionDeadline: "2026-04-10T17:00:00.000Z",
        appraisalDeadline: "2026-04-18T17:00:00.000Z",
        financingDeadline: "2026-04-22T17:00:00.000Z",
        contingencyDeadline: "2026-04-12T17:00:00.000Z"
      }
    });
    expect(createResponse.statusCode).toBe(201);
    const record = createResponse.json();
    expect(record.overallCoordinationState).toBe("NOT_STARTED");
    expect(record.nextAction).toBe("Schedule inspection");

    const taskUpdateResponse = await app.inject({
      method: "POST",
      url: `/under-contract/${record.id}/tasks/HOME_INSPECTION`,
      headers: {
        "content-type": "application/json"
      },
      payload: JSON.stringify({
        status: "SCHEDULED",
        scheduledAt: "2026-04-07T13:00:00.000Z",
        notes: "Inspection booked with preferred inspector."
      })
    });
    expect(taskUpdateResponse.statusCode).toBe(200);
    expect(taskUpdateResponse.json().overallCoordinationState).toBe("AT_RISK");

    const milestoneResponse = await app.inject({
      method: "POST",
      url: `/under-contract/${record.id}/milestones/INSPECTION_SCHEDULED`,
      headers: {
        "content-type": "application/json"
      },
      payload: JSON.stringify({
        status: "REACHED",
        occurredAt: "2026-04-07T13:00:00.000Z"
      })
    });
    expect(milestoneResponse.statusCode).toBe(200);
    expect(
      milestoneResponse.json().milestoneSummaries.some(
        (entry: { milestoneType: string; status: string }) =>
          entry.milestoneType === "INSPECTION_SCHEDULED" && entry.status === "REACHED"
      )
    ).toBe(true);

    const latestResponse = await app.inject({
      method: "GET",
      url: `/under-contract?propertyId=canonical-1&shortlistId=${encodeURIComponent(shortlist.id)}`,
      headers: {
        "x-nhalo-session-id": sessionId
      }
    });
    expect(latestResponse.statusCode).toBe(200);
    expect(latestResponse.json().record.id).toBe(record.id);

    const getResponse = await app.inject({
      method: "GET",
      url: `/under-contract/${record.id}`
    });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json().taskSummaries).toHaveLength(7);

    const summaryResponse = await app.inject({
      method: "GET",
      url: `/under-contract/${record.id}/summary`
    });
    expect(summaryResponse.statusCode).toBe(200);
    expect(summaryResponse.json().nextAction).toBeTruthy();

    const shortlistItemsResponse = await app.inject({
      method: "GET",
      url: `/shortlists/${shortlist.id}/items`
    });
    expect(shortlistItemsResponse.statusCode).toBe(200);
    expect(shortlistItemsResponse.json().underContracts).toHaveLength(1);

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
        entry.eventType === "under_contract_created" || entry.eventType === "under_contract_task_updated"
      )
    ).toBe(true);

    const metricsResponse = await app.inject({
      method: "GET",
      url: "/metrics"
    });
    const metricsPayload = metricsResponse.json();
    expect(metricsPayload.underContractCreateCount).toBe(1);
    expect(metricsPayload.underContractTaskUpdateCount).toBe(1);
    expect(metricsPayload.underContractMilestoneUpdateCount).toBe(1);
    expect(metricsPayload.underContractSummaryViewCount).toBe(1);
  });
});
