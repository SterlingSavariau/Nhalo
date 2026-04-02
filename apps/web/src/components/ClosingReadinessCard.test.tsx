import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ClosingReadinessCard } from "./ClosingReadinessCard";

describe("ClosingReadinessCard", () => {
  it("renders final checklist, milestones, and next action", () => {
    const markup = renderToStaticMarkup(
      <ClosingReadinessCard
        propertyId="canonical-1"
        propertyAddressLabel="123 Main St, Royal Oak, MI"
        shortlistId="shortlist-1"
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
          notes: "Contract complete.",
          internalActivityNote: null,
          coordinationSummary: {
            propertyId: "canonical-1",
            propertyAddressLabel: "123 Main St, Royal Oak, MI",
            offerSubmissionId: "offer-submission-1",
            acceptedAt: "2026-04-02T10:00:00.000Z",
            targetClosingDate: "2026-05-05T17:00:00.000Z"
          },
          overallCoordinationState: "READY_FOR_CLOSING",
          overallRiskLevel: "LOW_RISK",
          urgencyLevel: "LOW_RISK",
          readyForClosing: true,
          requiresImmediateAttention: false,
          taskSummaries: [],
          milestoneSummaries: [],
          deadlineSummaries: [],
          missingItems: [],
          blockers: [],
          recommendation: "Ready to move into final closing preparation.",
          risk: "No material contract risk remains.",
          alternative: "Proceed to final closing readiness.",
          nextAction: "Proceed to closing readiness",
          nextSteps: ["Proceed to closing readiness"],
          activityLog: [],
          lastActionAt: "2026-05-01T12:00:00.000Z",
          lastEvaluatedAt: "2026-05-01T12:00:00.000Z",
          createdAt: "2026-04-02T11:00:00.000Z",
          updatedAt: "2026-05-01T12:00:00.000Z"
        }}
        closingReadiness={{
          id: "closing-1",
          sessionId: "session-1",
          partnerId: null,
          propertyId: "canonical-1",
          propertyAddressLabel: "123 Main St, Royal Oak, MI",
          shortlistId: "shortlist-1",
          financialReadinessId: "financial-1",
          offerPreparationId: "offer-prep-1",
          offerSubmissionId: "offer-submission-1",
          underContractCoordinationId: "under-contract-1",
          targetClosingDate: "2026-05-05T17:00:00.000Z",
          closingAppointmentAt: "2026-05-05T15:00:00.000Z",
          closingAppointmentLocation: "Settlement office",
          closingAppointmentNotes: "Bring ID and certified funds.",
          finalReviewDeadline: "2026-05-04T17:00:00.000Z",
          finalFundsConfirmationDeadline: "2026-05-05T12:00:00.000Z",
          finalFundsAmountConfirmed: 76570,
          closedAt: null,
          notes: "All buyer items completed.",
          internalActivityNote: null,
          closingSummary: {
            propertyId: "canonical-1",
            propertyAddressLabel: "123 Main St, Royal Oak, MI",
            underContractCoordinationId: "under-contract-1",
            targetClosingDate: "2026-05-05T17:00:00.000Z",
            closingAppointmentAt: "2026-05-05T15:00:00.000Z",
            closedAt: null
          },
          overallClosingReadinessState: "READY_TO_CLOSE",
          overallRiskLevel: "LOW_RISK",
          urgencyLevel: "LOW_RISK",
          readyToClose: true,
          closed: false,
          checklistItemSummaries: [
            {
              itemType: "CASH_TO_CLOSE_CONFIRMED",
              label: "Cash to close confirmed",
              status: "COMPLETED",
              required: true,
              waivable: false,
              deadline: "2026-05-05T12:00:00.000Z",
              completedAt: "2026-05-04T18:00:00.000Z",
              blockedReason: null,
              notes: "Final wire amount confirmed."
            }
          ],
          milestoneSummaries: [
            {
              milestoneType: "READY_TO_CLOSE",
              label: "Ready to close",
              status: "REACHED",
              occurredAt: "2026-05-04T18:00:00.000Z",
              notes: null
            }
          ],
          missingItems: [],
          blockers: [],
          recommendation: "All required final items are satisfied.",
          risk: "No major closing risk is currently stored.",
          alternative: "Keep the appointment details unchanged and proceed.",
          nextAction: "Proceed to close",
          nextSteps: ["Proceed to close"],
          requiresImmediateAttention: false,
          activityLog: [
            {
              type: "ready_to_close",
              label: "Ready to close",
              details: "All required final closing items are complete.",
              createdAt: "2026-05-04T18:00:00.000Z"
            }
          ],
          lastActionAt: "2026-05-04T18:00:00.000Z",
          lastEvaluatedAt: "2026-05-04T18:00:00.000Z",
          createdAt: "2026-05-02T09:00:00.000Z",
          updatedAt: "2026-05-04T18:00:00.000Z"
        }}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateChecklistItem={vi.fn()}
        onUpdateMilestone={vi.fn()}
        onMarkReady={vi.fn()}
        onMarkClosed={vi.fn()}
      />
    );

    expect(markup).toContain("Closing readiness");
    expect(markup).toContain("Final checklist");
    expect(markup).toContain("Cash to close confirmed");
    expect(markup).toContain("Ready to close");
    expect(markup).toContain("Proceed to close");
    expect(markup).toContain("Why this closing status?");
  });
});
