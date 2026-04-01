import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FinancialReadinessPanel } from "./FinancialReadinessPanel";

describe("FinancialReadinessPanel", () => {
  it("renders affordability summary, blockers, and next action", () => {
    const markup = renderToStaticMarkup(
      <FinancialReadinessPanel
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        readiness={{
          id: "financial-1",
          sessionId: "session-1",
          partnerId: null,
          annualHouseholdIncome: 185000,
          monthlyDebtPayments: 900,
          availableCashSavings: 85000,
          creditScoreRange: "good_720_759",
          desiredHomePrice: 615000,
          purchaseLocation: "Royal Oak, MI",
          downPaymentPreferencePercent: 10,
          loanType: "conventional",
          preApprovalStatus: "not_started",
          preApprovalExpiresAt: null,
          proofOfFundsStatus: "verified",
          maxAffordableHomePrice: 598000,
          estimatedMonthlyPayment: 4080,
          estimatedDownPayment: 61500,
          estimatedClosingCosts: 18450,
          totalCashRequiredToClose: 79950,
          debtToIncomeRatio: 0.329,
          housingRatio: 0.265,
          affordabilityClassification: "ALMOST_READY",
          readinessState: "IN_PROGRESS",
          blockers: [
            {
              code: "MISSING_PREAPPROVAL",
              severity: "warning",
              message: "Pre-approval is still missing.",
              whyItMatters: "Buyers are less offer-ready without verified financing.",
              howToFix: "Get pre-approval before preparing an offer."
            }
          ],
          recommendation: "You are close to offer-ready, but one issue still needs to be resolved.",
          risk: "Moving forward too early could weaken affordability discipline or offer credibility.",
          alternative: "Get pre-approval before moving into offer preparation.",
          nextAction: "Get pre-approval",
          nextSteps: ["Get pre-approval", "Review affordability assumptions"],
          assumptionsUsed: {
            interestRate: 0.066,
            propertyTaxRate: 0.0125,
            insuranceMonthly: 179,
            closingCostPercent: 0.03,
            downPaymentPercent: 0.1,
            loanType: "conventional"
          },
          lastEvaluatedAt: "2026-04-01T20:00:00.000Z",
          createdAt: "2026-04-01T20:00:00.000Z",
          updatedAt: "2026-04-01T20:00:00.000Z"
        }}
      />
    );

    expect(markup).toContain("Financial readiness");
    expect(markup).toContain("Maximum home price");
    expect(markup).toContain("Cash required to close");
    expect(markup).toContain("Pre-approval is still missing.");
    expect(markup).toContain("Get pre-approval");
    expect(markup).toContain("Update financial readiness");
  });
});
