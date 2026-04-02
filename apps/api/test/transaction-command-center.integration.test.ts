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

describe("buyer transaction command center", () => {
  const sessionId = "command-center-session-1";
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

  it("resolves the current stage and next action across transaction modules", async () => {
    const financialReadiness = (
      await app.inject({
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
      })
    ).json();

    const shortlist = (
      await app.inject({
        method: "POST",
        url: "/shortlists",
        headers: {
          "x-nhalo-session-id": sessionId
        },
        payload: { title: "Command center shortlist" }
      })
    ).json();

    await app.inject({
      method: "POST",
      url: `/shortlists/${shortlist.id}/items`,
      payload: {
        canonicalPropertyId: "canonical-command-1",
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
          canonicalPropertyId: "canonical-command-1",
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

    const offerPreparation = (
      await app.inject({
        method: "POST",
        url: "/offer-preparation",
        headers: { "x-nhalo-session-id": sessionId },
        payload: {
          propertyId: "canonical-command-1",
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
      })
    ).json();

    const offerPreparationSummary = (
      await app.inject({
        method: "GET",
        url: `/transaction-command-center?propertyId=canonical-command-1&shortlistId=${shortlist.id}`,
        headers: {
          "x-nhalo-session-id": sessionId
        }
      })
    ).json();

    expect(offerPreparationSummary.currentStage).toBe("OFFER_SUBMISSION");
    expect(offerPreparationSummary.overallState).toBe("READY_TO_ADVANCE");
    expect(offerPreparationSummary.nextAction).toBe("Submit offer");
    expect(offerPreparationSummary.sourceRefs.offerPreparationId).toBe(offerPreparation.id);

    const submission = (
      await app.inject({
        method: "POST",
        url: "/offer-submission",
        headers: { "x-nhalo-session-id": sessionId },
        payload: {
          propertyId: "canonical-command-1",
          propertyAddressLabel: "123 Main St, Royal Oak, MI",
          shortlistId: shortlist.id,
          financialReadinessId: financialReadiness.id,
          offerPreparationId: offerPreparation.id,
          submissionMethod: "recorded_manual",
          offerExpirationAt: "2026-04-04T17:00:00.000Z"
        }
      })
    ).json();

    await app.inject({
      method: "POST",
      url: `/offer-submission/${submission.id}/submit`,
      payload: {
        submittedAt: "2026-04-02T15:30:00.000Z"
      }
    });

    const submittedSummary = (
      await app.inject({
        method: "GET",
        url: `/transaction-command-center?propertyId=canonical-command-1&shortlistId=${shortlist.id}`,
        headers: {
          "x-nhalo-session-id": sessionId
        }
      })
    ).json();

    expect(submittedSummary.currentStage).toBe("OFFER_SUBMISSION");
    expect(submittedSummary.overallState).toBe("IN_PROGRESS");
    expect(submittedSummary.nextAction).toBe("Wait for seller response");

    await app.inject({
      method: "PATCH",
      url: `/offer-submission/${submission.id}`,
      payload: {
        sellerResponseState: "ACCEPTED",
        sellerRespondedAt: "2026-04-03T10:00:00.000Z"
      }
    });

    const acceptedSummary = (
      await app.inject({
        method: "GET",
        url: `/transaction-command-center?propertyId=canonical-command-1&shortlistId=${shortlist.id}`,
        headers: {
          "x-nhalo-session-id": sessionId
        }
      })
    ).json();

    expect(acceptedSummary.currentStage).toBe("UNDER_CONTRACT");
    expect(acceptedSummary.overallState).toBe("READY_TO_ADVANCE");
    expect(acceptedSummary.nextAction).toBe("Start under-contract coordination");
    expect(acceptedSummary.recentActivity.length).toBeGreaterThan(0);
  });
});
