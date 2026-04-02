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

describe("closing readiness workflow", () => {
  const sessionId = "closing-readiness-session-1";
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

  it("creates, updates, summarizes, and completes closing readiness", async () => {
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
      payload: { title: "Closing shortlist" }
    });
    const shortlist = shortlistResponse.json();

    await app.inject({
      method: "POST",
      url: `/shortlists/${shortlist.id}/items`,
      payload: {
        canonicalPropertyId: "canonical-close-1",
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
          canonicalPropertyId: "canonical-close-1",
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
          propertyId: "canonical-close-1",
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

    const submission = (
      await app.inject({
        method: "POST",
        url: "/offer-submission",
        headers: { "x-nhalo-session-id": sessionId },
        payload: {
          propertyId: "canonical-close-1",
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

    const acceptedSubmission = (
      await app.inject({
        method: "PATCH",
        url: `/offer-submission/${submission.id}`,
        payload: {
          sellerResponseState: "ACCEPTED",
          sellerRespondedAt: "2026-04-03T10:00:00.000Z"
        }
      })
    ).json();

    let underContract = (
      await app.inject({
        method: "POST",
        url: "/under-contract",
        headers: { "x-nhalo-session-id": sessionId },
        payload: {
          propertyId: "canonical-close-1",
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
      })
    ).json();

    for (const task of underContract.taskSummaries) {
      const nextStatus = task.waivable ? "WAIVED" : "COMPLETED";
      const taskResponse = await app.inject({
        method: "POST",
        url: `/under-contract/${underContract.id}/tasks/${task.taskType}`,
        headers: {
          "content-type": "application/json"
        },
        payload: JSON.stringify({
          status: nextStatus,
          completedAt: "2026-04-20T12:00:00.000Z",
          notes: `${task.label} resolved.`
        })
      });
      underContract = taskResponse.json();
    }

    const contractMilestoneResponse = await app.inject({
      method: "POST",
      url: `/under-contract/${underContract.id}/milestones/CONTRACT_CONDITIONS_SATISFIED`,
      headers: {
        "content-type": "application/json"
      },
      payload: JSON.stringify({
        status: "REACHED",
        occurredAt: "2026-04-20T18:00:00.000Z"
      })
    });
    underContract = contractMilestoneResponse.json();
    expect(underContract.readyForClosing).toBe(true);

    const createResponse = await app.inject({
      method: "POST",
      url: "/closing-readiness",
      headers: {
        "x-nhalo-session-id": sessionId
      },
      payload: {
        propertyId: "canonical-close-1",
        propertyAddressLabel: "123 Main St, Royal Oak, MI",
        shortlistId: shortlist.id,
        financialReadinessId: financialReadiness.id,
        offerPreparationId: offerPreparation.id,
        offerSubmissionId: acceptedSubmission.id,
        underContractCoordinationId: underContract.id,
        targetClosingDate: "2026-05-05T17:00:00.000Z",
        finalReviewDeadline: "2026-05-03T17:00:00.000Z",
        finalFundsConfirmationDeadline: "2026-05-04T12:00:00.000Z"
      }
    });
    expect(createResponse.statusCode).toBe(201);
    let closing = createResponse.json();
    expect(closing.overallClosingReadinessState).toBe("NOT_STARTED");

    const checklistUpdateResponse = await app.inject({
      method: "POST",
      url: `/closing-readiness/${closing.id}/checklist/CASH_TO_CLOSE_CONFIRMED`,
      headers: {
        "content-type": "application/json"
      },
      payload: JSON.stringify({
        status: "COMPLETED",
        completedAt: "2026-05-03T15:00:00.000Z",
        notes: "Final numbers confirmed."
      })
    });
    expect(checklistUpdateResponse.statusCode).toBe(200);
    closing = checklistUpdateResponse.json();

    for (const item of closing.checklistItemSummaries) {
      if (item.itemType === "FINAL_WALKTHROUGH_COMPLETE") {
        continue;
      }
      const checklistResponse = await app.inject({
        method: "POST",
        url: `/closing-readiness/${closing.id}/checklist/${item.itemType}`,
        headers: {
          "content-type": "application/json"
        },
        payload: JSON.stringify({
          status: "COMPLETED",
          completedAt: "2026-05-04T18:00:00.000Z",
          notes: `${item.label} complete.`
        })
      });
      closing = checklistResponse.json();
    }

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/closing-readiness/${closing.id}`,
      payload: {
        closingAppointmentAt: "2026-05-05T15:00:00.000Z",
        closingAppointmentLocation: "Settlement office",
        closingAppointmentNotes: "Bring ID and certified funds.",
        finalFundsAmountConfirmed: 76570
      }
    });
    expect(updateResponse.statusCode).toBe(200);
    closing = updateResponse.json();

    const milestoneResponse = await app.inject({
      method: "POST",
      url: `/closing-readiness/${closing.id}/milestones/READY_TO_CLOSE`,
      headers: {
        "content-type": "application/json"
      },
      payload: JSON.stringify({
        status: "REACHED",
        occurredAt: "2026-05-04T19:00:00.000Z"
      })
    });
    expect(milestoneResponse.statusCode).toBe(200);
    closing = milestoneResponse.json();

    const readyResponse = await app.inject({
      method: "POST",
      url: `/closing-readiness/${closing.id}/mark-ready`
    });
    expect(readyResponse.statusCode).toBe(200);
    expect(readyResponse.json().overallClosingReadinessState).toBe("READY_TO_CLOSE");

    const latestResponse = await app.inject({
      method: "GET",
      url: `/closing-readiness?propertyId=canonical-close-1&shortlistId=${encodeURIComponent(shortlist.id)}`,
      headers: {
        "x-nhalo-session-id": sessionId
      }
    });
    expect(latestResponse.statusCode).toBe(200);
    expect(latestResponse.json().record.id).toBe(closing.id);

    const summaryResponse = await app.inject({
      method: "GET",
      url: `/closing-readiness/${closing.id}/summary`
    });
    expect(summaryResponse.statusCode).toBe(200);
    expect(summaryResponse.json().nextAction).toBeTruthy();

    const closedResponse = await app.inject({
      method: "POST",
      url: `/closing-readiness/${closing.id}/mark-closed`
    });
    expect(closedResponse.statusCode).toBe(200);
    expect(closedResponse.json().overallClosingReadinessState).toBe("CLOSED");

    const shortlistItemsResponse = await app.inject({
      method: "GET",
      url: `/shortlists/${shortlist.id}/items`
    });
    expect(shortlistItemsResponse.statusCode).toBe(200);
    expect(shortlistItemsResponse.json().closingReadiness).toHaveLength(1);

    const workflowActivityResponse = await app.inject({
      method: "GET",
      url: "/workflow/activity?limit=30",
      headers: {
        "x-nhalo-session-id": sessionId
      }
    });
    expect(workflowActivityResponse.statusCode).toBe(200);
    expect(
      workflowActivityResponse.json().activity.some((entry: { eventType: string }) =>
        [
          "closing_readiness_created",
          "closing_checklist_updated",
          "closing_milestone_reached",
          "closing_completed"
        ].includes(entry.eventType)
      )
    ).toBe(true);

    const metricsResponse = await app.inject({
      method: "GET",
      url: "/metrics"
    });
    const metricsPayload = metricsResponse.json();
    expect(metricsPayload.closingReadinessCreateCount).toBe(1);
    expect(metricsPayload.closingChecklistUpdateCount).toBeGreaterThanOrEqual(1);
    expect(metricsPayload.closingMilestoneUpdateCount).toBe(1);
    expect(metricsPayload.closingReadinessSummaryViewCount).toBe(1);
    expect(metricsPayload.closingCompletedCount).toBe(1);
  });
});
