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

describe("decision explainability", () => {
  const sessionId = "explanations-session-1";
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

  it("returns deterministic explanations for a blocked financial readiness record", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/financial-readiness",
      headers: {
        "x-nhalo-session-id": sessionId
      },
      payload: {
        annualHouseholdIncome: 185000,
        monthlyDebtPayments: 900,
        availableCashSavings: 85000,
        creditScoreRange: "good_720_759",
        desiredHomePrice: 615000,
        purchaseLocation: "Royal Oak, MI",
        downPaymentPreferencePercent: 10,
        loanType: "conventional",
        preApprovalStatus: "not_started",
        proofOfFundsStatus: "verified"
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const readiness = createResponse.json();

    const explanationResponse = await app.inject({
      method: "GET",
      url: `/explanations?moduleName=financial_readiness&subjectType=financial_readiness&subjectId=${readiness.id}`,
      headers: {
        "x-nhalo-session-id": sessionId
      }
    });

    expect(explanationResponse.statusCode).toBe(200);
    const explanationBundle = explanationResponse.json();

    expect(explanationBundle.moduleName).toBe("financial_readiness");
    expect(explanationBundle.explanations.some((entry: { category: string }) => entry.category === "STATE_EXPLANATION")).toBe(true);
    expect(explanationBundle.explanations.some((entry: { category: string }) => entry.category === "BLOCKER_EXPLANATION")).toBe(true);
    expect(
      explanationBundle.explanations.some((entry: { summary: string }) =>
        entry.summary.toLowerCase().includes("pre-approval")
      )
    ).toBe(true);
  });

  it("returns command-center explanations for the active transaction stage", async () => {
    const financialReadiness = (
      await app.inject({
        method: "POST",
        url: "/financial-readiness",
        headers: {
          "x-nhalo-session-id": `${sessionId}-command`
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
          "x-nhalo-session-id": `${sessionId}-command`
        },
        payload: {
          title: "Explainability shortlist"
        }
      })
    ).json();

    await app.inject({
      method: "POST",
      url: `/shortlists/${shortlist.id}/items`,
      payload: {
        canonicalPropertyId: "canonical-explain-1",
        capturedHome: {
          id: "home-explain-1",
          address: "123 Main St",
          city: "Royal Oak",
          state: "MI",
          zipCode: "48067",
          propertyType: "single_family",
          price: 585000,
          sqft: 2100,
          bedrooms: 4,
          bathrooms: 3,
          canonicalPropertyId: "canonical-explain-1",
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

    await app.inject({
      method: "POST",
      url: "/offer-preparation",
      headers: {
        "x-nhalo-session-id": `${sessionId}-command`
      },
      payload: {
        propertyId: "canonical-explain-1",
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

    const explanationResponse = await app.inject({
      method: "GET",
      url: `/transaction-command-center/explanations?propertyId=canonical-explain-1&shortlistId=${shortlist.id}`,
      headers: {
        "x-nhalo-session-id": `${sessionId}-command`
      }
    });

    expect(explanationResponse.statusCode).toBe(200);
    const bundle = explanationResponse.json();

    expect(bundle.moduleName).toBe("transaction_command_center");
    expect(
      bundle.explanations.some((entry: { category: string }) => entry.category === "STAGE_RESOLUTION_EXPLANATION")
    ).toBe(true);
    expect(
      bundle.explanations.some((entry: { summary: string }) =>
        entry.summary.toLowerCase().includes("current stage is offer submission")
      )
    ).toBe(true);
  });
});
