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

describe("unified activity log", () => {
  const sessionId = "activity-session-1";
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

  it("records normalized workflow, notification, command-center, and explanation events", async () => {
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
          availableCashSavings: 85000,
          creditScoreRange: "good_720_759",
          desiredHomePrice: 615000,
          purchaseLocation: "Royal Oak, MI",
          downPaymentPreferencePercent: 10,
          loanType: "conventional",
          preApprovalStatus: "not_started",
          proofOfFundsStatus: "verified"
        }
      })
    ).json();

    const initialNotifications = (
      await app.inject({
        method: "GET",
        url: "/notifications",
        headers: {
          "x-nhalo-session-id": sessionId
        }
      })
    ).json().notifications;

    const readableNotification = initialNotifications.find(
      (entry: { severity: string }) => entry.severity !== "CRITICAL"
    );
    expect(readableNotification).toBeTruthy();

    await app.inject({
      method: "PATCH",
      url: `/notifications/${readableNotification.id}/read`
    });

    await app.inject({
      method: "PATCH",
      url: `/notifications/${readableNotification.id}/dismiss`
    });

    await app.inject({
      method: "PATCH",
      url: `/financial-readiness/${financialReadiness.id}`,
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
        payload: { title: "Activity shortlist" }
      })
    ).json();

    await app.inject({
      method: "POST",
      url: `/shortlists/${shortlist.id}/items`,
      payload: {
        canonicalPropertyId: "canonical-activity-1",
        capturedHome: {
          id: "home-activity-1",
          address: "456 Activity Ave",
          city: "Royal Oak",
          state: "MI",
          zipCode: "48067",
          propertyType: "single_family",
          price: 585000,
          sqft: 2100,
          bedrooms: 4,
          bathrooms: 3,
          canonicalPropertyId: "canonical-activity-1",
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
          propertyId: "canonical-activity-1",
          propertyAddressLabel: "456 Activity Ave, Royal Oak, MI",
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

    await app.inject({
      method: "GET",
      url: "/transaction-command-center?propertyId=canonical-activity-1&propertyAddressLabel=456%20Activity%20Ave&shortlistId=" +
        shortlist.id,
      headers: {
        "x-nhalo-session-id": sessionId
      }
    });

    await app.inject({
      method: "GET",
      url: `/explanations?moduleName=offer_preparation&subjectType=offer_preparation&subjectId=${offerPreparation.id}`,
      headers: {
        "x-nhalo-session-id": sessionId
      }
    });

    await app.inject({
      method: "GET",
      url: "/notifications",
      headers: {
        "x-nhalo-session-id": sessionId
      }
    });

    const activityResponse = await app.inject({
      method: "GET",
      url: "/activity?limit=100",
      headers: {
        "x-nhalo-session-id": sessionId
      }
    });

    expect(activityResponse.statusCode).toBe(200);
    const activity = activityResponse.json().activity;
    expect(activity.some((entry: { eventCategory: string }) => entry.eventCategory === "RECORD_CREATED")).toBe(true);
    expect(activity.some((entry: { eventCategory: string }) => entry.eventCategory === "STATE_CHANGED")).toBe(true);
    expect(activity.some((entry: { eventCategory: string }) => entry.eventCategory === "BLOCKER_CREATED")).toBe(true);
    expect(activity.some((entry: { eventCategory: string }) => entry.eventCategory === "BLOCKER_RESOLVED")).toBe(true);
    expect(activity.some((entry: { eventCategory: string }) => entry.eventCategory === "NOTIFICATION_CREATED")).toBe(true);
    expect(activity.some((entry: { eventCategory: string }) => entry.eventCategory === "NOTIFICATION_READ")).toBe(true);
    expect(activity.some((entry: { eventCategory: string }) => entry.eventCategory === "NOTIFICATION_DISMISSED")).toBe(true);
    expect(activity.some((entry: { eventCategory: string }) => entry.eventCategory === "NOTIFICATION_RESOLVED")).toBe(true);
    expect(
      activity.some(
        (entry: { eventCategory: string; moduleName: string }) =>
          entry.eventCategory === "COMMAND_CENTER_STATUS_CHANGED" &&
          entry.moduleName === "transaction_command_center"
      )
    ).toBe(true);
    expect(
      activity.some(
        (entry: { eventCategory: string; moduleName: string }) =>
          entry.eventCategory === "EXPLANATION_GENERATED" &&
          entry.moduleName === "decision_explainability"
      )
    ).toBe(true);
  });
});
