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

describe("workflow notifications", () => {
  const sessionId = "notifications-session-1";
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

  it("creates, dedupes, reads, dismisses, and resolves notifications", async () => {
    const financialResponse = await app.inject({
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

    const readiness = financialResponse.json();

    const firstNotificationsResponse = await app.inject({
      method: "GET",
      url: "/notifications",
      headers: {
        "x-nhalo-session-id": sessionId
      }
    });

    expect(firstNotificationsResponse.statusCode).toBe(200);
    const firstNotifications = firstNotificationsResponse.json().notifications;
    expect(firstNotifications.length).toBeGreaterThan(0);
    expect(
      firstNotifications.some((entry: { title: string }) =>
        entry.title.toLowerCase().includes("financial readiness")
      )
    ).toBe(true);

    await app.inject({
      method: "PATCH",
      url: `/financial-readiness/${readiness.id}`,
      headers: {
        "x-nhalo-session-id": sessionId
      },
      payload: {
        preApprovalStatus: "verified"
      }
    });

    const shortlist = (
      await app.inject({
        method: "POST",
        url: "/shortlists",
        headers: {
          "x-nhalo-session-id": sessionId
        },
        payload: { title: "Notification shortlist" }
      })
    ).json();

    await app.inject({
      method: "POST",
      url: `/shortlists/${shortlist.id}/items`,
      payload: {
        canonicalPropertyId: "canonical-notify-1",
        capturedHome: {
          id: "home-notify-1",
          address: "123 Main St",
          city: "Royal Oak",
          state: "MI",
          zipCode: "48067",
          propertyType: "single_family",
          price: 585000,
          sqft: 2100,
          bedrooms: 4,
          bathrooms: 3,
          canonicalPropertyId: "canonical-notify-1",
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
        headers: {
          "x-nhalo-session-id": sessionId
        },
        payload: {
          propertyId: "canonical-notify-1",
          propertyAddressLabel: "123 Main St, Royal Oak, MI",
          shortlistId: shortlist.id,
          financialReadinessId: readiness.id,
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

    const offerSubmission = (
      await app.inject({
        method: "POST",
        url: "/offer-submission",
        headers: {
          "x-nhalo-session-id": sessionId
        },
        payload: {
          propertyId: "canonical-notify-1",
          propertyAddressLabel: "123 Main St, Royal Oak, MI",
          shortlistId: shortlist.id,
          financialReadinessId: readiness.id,
          offerPreparationId: offerPreparation.id,
          submissionMethod: "recorded_manual",
          offerExpirationAt: "2026-04-04T17:00:00.000Z"
        }
      })
    ).json();

    await app.inject({
      method: "POST",
      url: `/offer-submission/${offerSubmission.id}/submit`,
      payload: {
        submittedAt: "2026-04-02T15:30:00.000Z"
      }
    });

    const secondNotificationsResponse = await app.inject({
      method: "GET",
      url: "/notifications",
      headers: {
        "x-nhalo-session-id": sessionId
      }
    });
    expect(secondNotificationsResponse.statusCode).toBe(200);
    const secondNotifications = secondNotificationsResponse.json().notifications;
    expect(
      secondNotifications.some((entry: { title: string }) =>
        entry.title.toLowerCase().includes("offer is awaiting seller response")
      )
    ).toBe(true);
    expect(
      secondNotifications.every((entry: { triggeringRuleLabel: string }) =>
        !entry.triggeringRuleLabel.startsWith("financial_readiness_blocker_missing_preapproval")
      )
    ).toBe(true);

    const readable = secondNotifications.find((entry: { severity: string }) => entry.severity !== "CRITICAL");
    expect(readable).toBeTruthy();

    const markReadResponse = await app.inject({
      method: "PATCH",
      url: `/notifications/${readable.id}/read`
    });
    expect(markReadResponse.statusCode).toBe(200);
    expect(markReadResponse.json().status).toBe("READ");

    const dismissResponse = await app.inject({
      method: "PATCH",
      url: `/notifications/${readable.id}/dismiss`
    });
    expect(dismissResponse.statusCode).toBe(200);
    expect(dismissResponse.json().status).toBe("DISMISSED");

    const postResolveResponse = await app.inject({
      method: "GET",
      url: "/notifications",
      headers: {
        "x-nhalo-session-id": sessionId
      }
    });
    expect(postResolveResponse.statusCode).toBe(200);

    const historyResponse = await app.inject({
      method: "GET",
      url: "/notifications/history",
      headers: {
        "x-nhalo-session-id": sessionId
      }
    });
    expect(historyResponse.statusCode).toBe(200);
    const history = historyResponse.json().history;
    expect(history.some((entry: { eventType: string }) => entry.eventType === "CREATED")).toBe(true);
    expect(history.some((entry: { eventType: string }) => entry.eventType === "READ")).toBe(true);
    expect(history.some((entry: { eventType: string }) => entry.eventType === "DISMISSED")).toBe(true);
    expect(history.some((entry: { eventType: string }) => entry.eventType === "RESOLVED")).toBe(true);
  });
});
