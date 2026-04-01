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

describe("financial readiness workflow", () => {
  const sessionId = "financial-session-1";
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

  it("creates, restores, updates, and summarizes financial readiness", async () => {
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
    const record = createResponse.json();
    expect(record.affordabilityClassification).toBe("ALMOST_READY");
    expect(record.nextAction).toBe("Get pre-approval");
    expect(record.maxAffordableHomePrice).toBeGreaterThan(0);

    const latestResponse = await app.inject({
      method: "GET",
      url: "/financial-readiness",
      headers: {
        "x-nhalo-session-id": sessionId
      }
    });

    expect(latestResponse.statusCode).toBe(200);
    expect(latestResponse.json().record.id).toBe(record.id);

    const getResponse = await app.inject({
      method: "GET",
      url: `/financial-readiness/${record.id}`
    });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json().desiredHomePrice).toBe(615000);

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/financial-readiness/${record.id}`,
      payload: {
        desiredHomePrice: 589000,
        preApprovalStatus: "verified"
      }
    });
    expect(updateResponse.statusCode).toBe(200);
    const updated = updateResponse.json();
    expect(updated.readinessState).toBe("READY");
    expect(updated.affordabilityClassification).toBe("READY");
    expect(updated.nextAction).toBe("Proceed to offer preparation");

    const summaryResponse = await app.inject({
      method: "GET",
      url: `/financial-readiness/${record.id}/summary`
    });
    expect(summaryResponse.statusCode).toBe(200);
    expect(summaryResponse.json().readinessState).toBe("READY");
    expect(summaryResponse.json().recommendation).toContain("ready");

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
        entry.eventType === "financial_readiness_created"
      )
    ).toBe(true);

    const metricsResponse = await app.inject({
      method: "GET",
      url: "/metrics"
    });
    const metricsPayload = metricsResponse.json();
    expect(metricsPayload.financialReadinessCreateCount).toBe(1);
    expect(metricsPayload.financialReadinessUpdateCount).toBe(1);
    expect(metricsPayload.financialReadinessSummaryViewCount).toBe(1);
  });
});
