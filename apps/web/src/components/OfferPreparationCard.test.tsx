import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { OfferPreparationCard } from "./OfferPreparationCard";

describe("OfferPreparationCard", () => {
  it("renders offer summary, blockers, and next action", () => {
    const markup = renderToStaticMarkup(
      <OfferPreparationCard
        anchorPrice={585000}
        financialReadiness={{
          id: "financial-1",
          sessionId: "session-1",
          partnerId: null,
          annualHouseholdIncome: 185000,
          monthlyDebtPayments: 900,
          availableCashSavings: 95000,
          creditScoreRange: "good_720_759",
          desiredHomePrice: 589000,
          purchaseLocation: "Royal Oak, MI",
          downPaymentPreferencePercent: 10,
          loanType: "conventional",
          preApprovalStatus: "verified",
          preApprovalExpiresAt: null,
          proofOfFundsStatus: "verified",
          maxAffordableHomePrice: 598000,
          estimatedMonthlyPayment: 3920,
          estimatedDownPayment: 58900,
          estimatedClosingCosts: 17670,
          totalCashRequiredToClose: 76570,
          debtToIncomeRatio: 0.33,
          housingRatio: 0.26,
          affordabilityClassification: "READY",
          readinessState: "READY",
          blockers: [],
          recommendation: "You are ready to proceed.",
          risk: "Normal affordability risk.",
          alternative: "Lower the target price for a wider buffer.",
          nextAction: "Proceed to offer preparation",
          nextSteps: ["Proceed to offer preparation"],
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
          earnestMoneyAmount: 2500,
          downPaymentType: "percent",
          downPaymentAmount: 58900,
          downPaymentPercent: 10,
          financingContingency: "included",
          inspectionContingency: "waived",
          appraisalContingency: "included",
          closingTimelineDays: 30,
          possessionTiming: "at_closing",
          possessionDaysAfterClosing: null,
          sellerConcessionsRequestedAmount: null,
          notes: "Buyer prefers standard financing protection.",
          buyerRationale: "Strong family fit with manageable payment.",
          offerSummary: {
            propertyId: "canonical-1",
            propertyAddressLabel: "123 Main St, Royal Oak, MI",
            offerPrice: 589000,
            earnestMoneyAmount: 2500,
            downPaymentAmount: 58900,
            downPaymentPercent: 10,
            financingContingency: "included",
            inspectionContingency: "waived",
            appraisalContingency: "included",
            closingTimelineDays: 30,
            possessionTiming: "at_closing"
          },
          offerState: "READY",
          offerRiskLevel: "MODERATE_RISK",
          offerCompletenessState: "complete",
          readinessToSubmit: true,
          cashRequiredAtOffer: 76570,
          missingItems: [],
          blockers: [
            {
              code: "HIGH_RISK_CONTINGENCY_SETUP",
              severity: "warning",
              message: "Inspection contingency is waived.",
              whyItMatters: "Waiving inspection increases buyer risk.",
              howToFix: "Keep the inspection contingency if the buyer wants more protection."
            }
          ],
          recommendation: "This draft is complete and financially supported.",
          risk: "The offer can move forward, but one or more terms deserve closer buyer review.",
          alternative: "Keep standard protections if the buyer wants a lower-risk offer.",
          nextAction: "Increase earnest money",
          nextSteps: ["Increase earnest money", "Proceed to offer submission"],
          financialAlignment: {
            maxAffordableHomePrice: 598000,
            targetCashToClose: 76570,
            availableCashSavings: 95000,
            affordabilityClassification: "READY",
            readinessState: "READY",
            financiallyAligned: true,
            recommendedOfferPrice: null
          },
          assumptionsUsed: {
            lowEarnestMoneyPercent: 0.01,
            standardEarnestMoneyPercent: { min: 0.01, max: 0.03 },
            aggressiveClosingTimelineDays: 14,
            slowClosingTimelineDays: 45,
            affordabilityTolerancePercent: 0.05
          },
          strategyDefaultsProvenance: {
            appliedAt: "2026-04-01T20:00:00.000Z",
            appliedFieldKeys: ["offerPrice", "closingTimelineDays"],
            sourceSelectedItemId: "item-1",
            sourceShortlistId: "shortlist-1",
            sourcePropertyId: "canonical-1",
            sourceStrategyConfidence: "medium",
            sourceOfferPosture: "prepare_disciplined_offer",
            sourceRecommendedNextOfferAction: "draft_disciplined_offer",
            sourceLastEvaluatedAt: "2026-04-01T19:58:00.000Z"
          },
          lastEvaluatedAt: "2026-04-01T20:10:00.000Z",
          createdAt: "2026-04-01T20:00:00.000Z",
          updatedAt: "2026-04-01T20:10:00.000Z"
        }}
        offerStrategy={{
          strategyConfidence: "medium",
          offerPosture: "prepare_disciplined_offer",
          urgencyLevel: "medium",
          concessionStrategy: "limit_concession_requests",
          recommendedNextOfferAction: "draft_disciplined_offer",
          pricePosition: {
            listPrice: 585000,
            recommendedOfferPrice: 589000,
            pricePerSqft: 279,
            medianPricePerSqft: 286,
            versusList: "above_list",
            versusMarket: "discount_to_market"
          },
          marketContext: {
            listingStatus: "active",
            daysOnMarket: 12,
            comparableSampleSize: 6,
            comparableStrategyUsed: "local_radius_fallback",
            overallConfidence: "high",
            listingDataSource: "live",
            limitedComparables: false
          },
          marketRisks: [],
          strategyRationale: ["Buyer readiness supports moving forward with a disciplined offer posture."],
          lastEvaluatedAt: "2026-04-01T19:58:00.000Z"
        }}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        propertyAddressLabel="123 Main St, Royal Oak, MI"
        propertyId="canonical-1"
        shortlistId="shortlist-1"
      />
    );

    expect(markup).toContain("Offer preparation");
    expect(markup).toContain("Offer summary");
    expect(markup).toContain("Increase earnest money");
    expect(markup).toContain("Inspection contingency is waived.");
    expect(markup).toContain("Ready to submit");
    expect(markup).toContain("Why this draft?");
    expect(markup).toContain("Selected-choice strategy guidance");
    expect(markup).toContain("Strategy defaults applied");
  });

  it("shows verify-first strategy guidance without silently seeding a new draft", () => {
    const markup = renderToStaticMarkup(
      <OfferPreparationCard
        anchorPrice={585000}
        financialReadiness={{
          id: "financial-1",
          sessionId: "session-1",
          partnerId: null,
          annualHouseholdIncome: 185000,
          monthlyDebtPayments: 900,
          availableCashSavings: 95000,
          creditScoreRange: "good_720_759",
          desiredHomePrice: 589000,
          purchaseLocation: "Royal Oak, MI",
          downPaymentPreferencePercent: 10,
          loanType: "conventional",
          preApprovalStatus: "verified",
          preApprovalExpiresAt: null,
          proofOfFundsStatus: "verified",
          maxAffordableHomePrice: 598000,
          estimatedMonthlyPayment: 3920,
          estimatedDownPayment: 58900,
          estimatedClosingCosts: 17670,
          totalCashRequiredToClose: 76570,
          debtToIncomeRatio: 0.33,
          housingRatio: 0.26,
          affordabilityClassification: "READY",
          readinessState: "READY",
          blockers: [],
          recommendation: "You are ready to proceed.",
          risk: "Normal affordability risk.",
          alternative: "Lower the target price for a wider buffer.",
          nextAction: "Proceed to offer preparation",
          nextSteps: ["Proceed to offer preparation"],
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
        offerStrategy={{
          strategyConfidence: "low",
          offerPosture: "verify_before_offering",
          urgencyLevel: "low",
          concessionStrategy: "defer_until_more_certain",
          recommendedNextOfferAction: "review_market_inputs",
          pricePosition: {
            listPrice: 585000,
            recommendedOfferPrice: null,
            pricePerSqft: null,
            medianPricePerSqft: null,
            versusList: "unknown",
            versusMarket: "unknown"
          },
          marketContext: {
            listingStatus: null,
            daysOnMarket: null,
            comparableSampleSize: null,
            comparableStrategyUsed: null,
            overallConfidence: "low",
            listingDataSource: "stale_cached_live",
            limitedComparables: true
          },
          marketRisks: ["Current listing status is unavailable in the stored result."],
          strategyRationale: ["Stored market inputs are incomplete or weak, so the strategy should stay provisional."],
          lastEvaluatedAt: "2026-04-01T19:58:00.000Z"
        }}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        propertyAddressLabel="123 Main St, Royal Oak, MI"
        propertyId="canonical-1"
        shortlistId="shortlist-1"
      />
    );

    expect(markup).toContain("Selected-choice strategy guidance");
    expect(markup).toContain("Current selected-choice strategy is not strong enough to prefill terms.");
    expect(markup).toContain("review market inputs");
  });
});
