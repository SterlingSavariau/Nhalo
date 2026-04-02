import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { UnderContractCoordinationCard } from "./UnderContractCoordinationCard";

describe("UnderContractCoordinationCard", () => {
  it("renders contract progress, deadlines, tasks, and next action", () => {
    const markup = renderToStaticMarkup(
      <UnderContractCoordinationCard
        offerSubmission={{
          id: "offer-submission-1",
          sessionId: "session-1",
          partnerId: null,
          propertyId: "canonical-1",
          propertyAddressLabel: "123 Main St, Royal Oak, MI",
          shortlistId: "shortlist-1",
          financialReadinessId: "financial-1",
          offerPreparationId: "offer-prep-1",
          submissionMethod: "recorded_manual",
          submittedAt: "2026-04-01T21:00:00.000Z",
          offerExpirationAt: "2026-04-03T21:00:00.000Z",
          sellerResponseState: "ACCEPTED",
          sellerRespondedAt: "2026-04-02T10:00:00.000Z",
          buyerCounterDecision: null,
          withdrawnAt: null,
          withdrawalReason: null,
          counterofferPrice: null,
          counterofferClosingTimelineDays: null,
          counterofferFinancingContingency: null,
          counterofferInspectionContingency: null,
          counterofferAppraisalContingency: null,
          counterofferExpirationAt: null,
          notes: null,
          internalActivityNote: null,
          originalOfferSnapshot: {
            offerPrice: 589000,
            earnestMoneyAmount: 8000,
            downPaymentAmount: 58900,
            downPaymentPercent: 10,
            financingContingency: "included",
            inspectionContingency: "included",
            appraisalContingency: "included",
            closingTimelineDays: 30
          },
          submissionSummary: {
            propertyId: "canonical-1",
            propertyAddressLabel: "123 Main St, Royal Oak, MI",
            offerPreparationId: "offer-prep-1",
            submittedAt: "2026-04-01T21:00:00.000Z",
            offerExpirationAt: "2026-04-03T21:00:00.000Z",
            currentOfferPrice: 589000,
            earnestMoneyAmount: 8000,
            closingTimelineDays: 30
          },
          submissionState: "ACCEPTED",
          urgencyLevel: "LOW_URGENCY",
          counterofferSummary: {
            present: false,
            counterofferPrice: null,
            counterofferClosingTimelineDays: null,
            counterofferFinancingContingency: null,
            counterofferInspectionContingency: null,
            counterofferAppraisalContingency: null,
            counterofferExpirationAt: null,
            changedFields: []
          },
          missingItems: [],
          blockers: [],
          recommendation: "The accepted offer can move into under-contract coordination.",
          risk: "No immediate submission risk remains.",
          alternative: "The next step is to coordinate the post-acceptance tasks.",
          nextAction: "Move to under-contract workflow",
          nextSteps: ["Move to under-contract workflow"],
          requiresBuyerResponse: false,
          isExpired: false,
          lastActionAt: "2026-04-02T10:00:00.000Z",
          lastEvaluatedAt: "2026-04-02T10:00:00.000Z",
          activityLog: [],
          createdAt: "2026-04-01T20:50:00.000Z",
          updatedAt: "2026-04-02T10:00:00.000Z"
        }}
        underContract={{
          id: "under-contract-1",
          sessionId: "session-1",
          partnerId: null,
          propertyId: "canonical-1",
          propertyAddressLabel: "123 Main St, Royal Oak, MI",
          shortlistId: "shortlist-1",
          financialReadinessId: "financial-1",
          offerPreparationId: "offer-prep-1",
          offerSubmissionId: "offer-submission-1",
          acceptedAt: "2026-04-02T10:00:00.000Z",
          targetClosingDate: "2026-05-05T17:00:00.000Z",
          inspectionDeadline: "2026-04-10T17:00:00.000Z",
          appraisalDeadline: "2026-04-18T17:00:00.000Z",
          financingDeadline: "2026-04-22T17:00:00.000Z",
          contingencyDeadline: "2026-04-12T17:00:00.000Z",
          closingPreparationDeadline: "2026-05-01T17:00:00.000Z",
          notes: "Contract is progressing on schedule.",
          internalActivityNote: null,
          overallCoordinationState: "IN_PROGRESS",
          overallRiskLevel: "MODERATE_RISK",
          urgencyLevel: "MODERATE_RISK",
          readyForClosing: false,
          requiresImmediateAttention: true,
          taskSummaries: [
            {
              taskType: "HOME_INSPECTION",
              label: "Home inspection",
              status: "SCHEDULED",
              required: true,
              waivable: true,
              deadline: "2026-04-10T17:00:00.000Z",
              scheduledAt: "2026-04-07T13:00:00.000Z",
              completedAt: null,
              blockedReason: null,
              notes: "Inspection booked."
            }
          ],
          milestoneSummaries: [
            {
              milestoneType: "INSPECTION_SCHEDULED",
              label: "Inspection scheduled",
              status: "REACHED",
              occurredAt: "2026-04-07T13:00:00.000Z",
              notes: null
            }
          ],
          deadlineSummaries: [
            {
              key: "inspection",
              label: "Inspection deadline",
              deadline: "2026-04-10T17:00:00.000Z",
              status: "APPROACHING",
              relatedTaskType: "HOME_INSPECTION"
            }
          ],
          missingItems: [],
          blockers: [],
          recommendation: "The accepted offer is in progress and the next required step is inspection follow-through.",
          risk: "At least one contract deadline is approaching and needs active coordination.",
          alternative: "Advance the remaining contract tasks earlier to reduce timing pressure.",
          nextAction: "Review inspection results",
          nextSteps: ["Review inspection results", "Track contingency deadline"],
          activityLog: [
            {
              type: "task_updated",
              label: "Home inspection scheduled",
              details: "Inspection booked with preferred inspector.",
              createdAt: "2026-04-07T13:00:00.000Z"
            }
          ],
          lastActionAt: "2026-04-07T13:00:00.000Z",
          lastEvaluatedAt: "2026-04-07T13:00:00.000Z",
          createdAt: "2026-04-02T11:00:00.000Z",
          updatedAt: "2026-04-07T13:00:00.000Z"
        }}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateMilestone={vi.fn()}
        onUpdateTask={vi.fn()}
        propertyAddressLabel="123 Main St, Royal Oak, MI"
        propertyId="canonical-1"
        shortlistId="shortlist-1"
      />
    );

    expect(markup).toContain("Under-contract coordination");
    expect(markup).toContain("Contract progress");
    expect(markup).toContain("Inspection deadline");
    expect(markup).toContain("Home inspection");
    expect(markup).toContain("Inspection scheduled");
    expect(markup).toContain("Review inspection results");
  });
});
