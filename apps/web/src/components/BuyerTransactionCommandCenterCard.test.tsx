import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BuyerTransactionCommandCenterCard } from "./BuyerTransactionCommandCenterCard";

describe("BuyerTransactionCommandCenterCard", () => {
  it("renders the unified stage summary, next action, and key risks", () => {
    const markup = renderToStaticMarkup(
      <BuyerTransactionCommandCenterCard
        summary={{
          propertyId: "canonical-1",
          propertyAddressLabel: "123 Main St, Royal Oak, MI",
          sessionId: "session-1",
          shortlistId: "shortlist-1",
          currentStage: "UNDER_CONTRACT",
          overallState: "AT_RISK",
          overallRiskLevel: "MODERATE_RISK",
          progressPercent: 67,
          completedStageCount: 4,
          totalStageCount: 6,
          primaryBlocker: null,
          activeBlockers: [],
          primaryRisk: {
            code: "APPRAISAL_DEADLINE_APPROACHING",
            sourceStage: "UNDER_CONTRACT",
            level: "MODERATE_RISK",
            message: "Appraisal deadline is approaching and the appraisal is still incomplete.",
            dueAt: "2026-05-01T17:00:00.000Z"
          },
          topRisks: [
            {
              code: "APPRAISAL_DEADLINE_APPROACHING",
              sourceStage: "UNDER_CONTRACT",
              level: "MODERATE_RISK",
              message: "Appraisal deadline is approaching and the appraisal is still incomplete.",
              dueAt: "2026-05-01T17:00:00.000Z"
            }
          ],
          nextAction: "Order or confirm appraisal",
          nextSteps: ["Order or confirm appraisal", "Track financing deadline"],
          keyDates: [
            {
              key: "appraisal",
              label: "Appraisal deadline",
              date: "2026-05-01T17:00:00.000Z",
              sourceStage: "UNDER_CONTRACT",
              status: "DUE_SOON"
            }
          ],
          recentActivity: [
            {
              id: "activity-1",
              type: "under_contract_task_updated",
              label: "Contract task updated",
              occurredAt: "2026-04-30T13:00:00.000Z",
              sourceStage: "UNDER_CONTRACT"
            }
          ],
          stageSummaries: [
            {
              stage: "FINANCIAL_READINESS",
              label: "Financial Readiness",
              status: "READY",
              completed: true,
              available: true,
              blockerCount: 0,
              riskLevel: "LOW_RISK",
              nextAction: "Proceed to offer preparation",
              lastUpdatedAt: "2026-04-01T18:00:00.000Z"
            },
            {
              stage: "UNDER_CONTRACT",
              label: "Under Contract",
              status: "IN_PROGRESS",
              completed: false,
              available: true,
              blockerCount: 0,
              riskLevel: "MODERATE_RISK",
              nextAction: "Order or confirm appraisal",
              lastUpdatedAt: "2026-04-30T13:00:00.000Z"
            }
          ],
          sourceRefs: {
            financialReadinessId: "financial-1",
            offerPreparationId: "offer-prep-1",
            offerSubmissionId: "offer-submission-1",
            underContractCoordinationId: "under-contract-1",
            closingReadinessId: null
          },
          isStale: false,
          lastUpdatedAt: "2026-04-30T13:00:00.000Z",
          createdAt: "2026-04-01T18:00:00.000Z"
        }}
      />
    );

    expect(markup).toContain("Buyer transaction command center");
    expect(markup).toContain("Order or confirm appraisal");
    expect(markup).toContain("Appraisal deadline");
    expect(markup).toContain("Under Contract");
    expect(markup).toContain("Why this stage?");
  });
});
