import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { OfferSubmissionCard } from "./OfferSubmissionCard";

describe("OfferSubmissionCard", () => {
  it("renders submission summary, counteroffer details, and next action", () => {
    const markup = renderToStaticMarkup(
      <OfferSubmissionCard
        offerPreparation={{
          id: "offer-prep-1",
          sessionId: "session-1",
          partnerId: null,
          propertyId: "canonical-1",
          propertyAddressLabel: "123 Main St, Royal Oak, MI",
          shortlistId: "shortlist-1",
          offerReadinessId: null,
          financialReadinessId: "financial-1",
          offerPrice: 589000,
          earnestMoneyAmount: 8000,
          downPaymentType: "percent",
          downPaymentAmount: 58900,
          downPaymentPercent: 10,
          financingContingency: "included",
          inspectionContingency: "included",
          appraisalContingency: "included",
          closingTimelineDays: 30,
          possessionTiming: "at_closing",
          possessionDaysAfterClosing: null,
          sellerConcessionsRequestedAmount: null,
          notes: null,
          buyerRationale: null,
          offerSummary: {
            propertyId: "canonical-1",
            propertyAddressLabel: "123 Main St, Royal Oak, MI",
            offerPrice: 589000,
            earnestMoneyAmount: 8000,
            downPaymentAmount: 58900,
            downPaymentPercent: 10,
            financingContingency: "included",
            inspectionContingency: "included",
            appraisalContingency: "included",
            closingTimelineDays: 30,
            possessionTiming: "at_closing"
          },
          offerState: "READY",
          offerRiskLevel: "LOW_RISK",
          offerCompletenessState: "complete",
          readinessToSubmit: true,
          cashRequiredAtOffer: 76570,
          missingItems: [],
          blockers: [],
          recommendation: "This draft is complete and financially supported.",
          risk: "The current terms stay inside the normal risk band for this workflow.",
          alternative: "Keep the draft aligned with financial readiness and move to submission when ready.",
          nextAction: "Proceed to offer submission",
          nextSteps: ["Proceed to offer submission"],
          financialAlignment: {
            maxAffordableHomePrice: 598000,
            targetCashToClose: 76570,
            availableCashSavings: 95000,
            affordabilityClassification: "READY",
            readinessState: "READY",
            financiallyAligned: true,
            recommendedOfferPrice: 589000
          },
          assumptionsUsed: {
            lowEarnestMoneyPercent: 0.01,
            standardEarnestMoneyPercent: { min: 0.01, max: 0.03 },
            aggressiveClosingTimelineDays: 14,
            slowClosingTimelineDays: 45,
            affordabilityTolerancePercent: 0.05
          },
          lastEvaluatedAt: "2026-04-01T20:10:00.000Z",
          createdAt: "2026-04-01T20:00:00.000Z",
          updatedAt: "2026-04-01T20:10:00.000Z"
        }}
        offerSubmission={{
          id: "offer-sub-1",
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
          sellerResponseState: "COUNTERED",
          sellerRespondedAt: "2026-04-02T10:00:00.000Z",
          buyerCounterDecision: "pending",
          withdrawnAt: null,
          withdrawalReason: null,
          counterofferPrice: 595000,
          counterofferClosingTimelineDays: 21,
          counterofferFinancingContingency: "included",
          counterofferInspectionContingency: "included",
          counterofferAppraisalContingency: "waived",
          counterofferExpirationAt: "2026-04-03T12:00:00.000Z",
          notes: "Seller wants a faster close.",
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
            currentOfferPrice: 595000,
            earnestMoneyAmount: 8000,
            closingTimelineDays: 21
          },
          submissionState: "COUNTERED",
          urgencyLevel: "MODERATE_URGENCY",
          counterofferSummary: {
            present: true,
            counterofferPrice: 595000,
            counterofferClosingTimelineDays: 21,
            counterofferFinancingContingency: "included",
            counterofferInspectionContingency: "included",
            counterofferAppraisalContingency: "waived",
            counterofferExpirationAt: "2026-04-03T12:00:00.000Z",
            changedFields: ["price", "closingTimelineDays", "appraisalContingency"]
          },
          missingItems: [],
          blockers: [],
          recommendation: "The seller responded with changed terms that need buyer review.",
          risk: "Changed price, timing, or contingencies could shift the buyer's risk profile.",
          alternative: "The buyer can reject the counter or revise the offer instead of accepting.",
          nextAction: "Review counteroffer",
          nextSteps: ["Review counteroffer", "Accept counteroffer", "Reject counteroffer"],
          requiresBuyerResponse: true,
          isExpired: false,
          lastActionAt: "2026-04-02T10:00:00.000Z",
          lastEvaluatedAt: "2026-04-02T10:00:00.000Z",
          activityLog: [
            {
              type: "record_created",
              label: "Submission record created",
              details: null,
              createdAt: "2026-04-01T20:50:00.000Z"
            },
            {
              type: "offer_submitted",
              label: "Offer submitted",
              details: "Offer submission recorded.",
              createdAt: "2026-04-01T21:00:00.000Z"
            }
          ],
          createdAt: "2026-04-01T20:50:00.000Z",
          updatedAt: "2026-04-02T10:00:00.000Z"
        }}
        onCreate={vi.fn()}
        onRespondToCounter={vi.fn()}
        onSubmit={vi.fn()}
        onUpdate={vi.fn()}
        propertyAddressLabel="123 Main St, Royal Oak, MI"
        propertyId="canonical-1"
        shortlistId="shortlist-1"
      />
    );

    expect(markup).toContain("Offer submission");
    expect(markup).toContain("Review counteroffer");
    expect(markup).toContain("Counteroffer");
    expect(markup).toContain("Accept counteroffer");
    expect(markup).toContain("Seller response: countered");
    expect(markup).toContain("Why this submission state?");
  });
});
