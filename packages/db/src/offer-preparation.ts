import type {
  FinancialReadiness,
  OfferPreparation,
  OfferPreparationAssumptions,
  OfferPreparationBlocker,
  OfferPreparationCompletenessState,
  OfferPreparationContingency,
  OfferPreparationDownPaymentType,
  OfferPreparationFinancialAlignment,
  OfferPreparationInputs,
  OfferPreparationMissingItem,
  OfferPreparationRiskLevel,
  OfferPreparationState,
  OfferPreparationSummary
} from "@nhalo/types";

type OfferPreparationEvaluationInput = {
  now: string;
  financialReadiness: FinancialReadiness;
  recommendedOfferPrice?: number | null;
  current?: OfferPreparation | null;
  patch?: Partial<OfferPreparationInputs>;
  sessionId?: string | null;
  partnerId?: string | null;
};

const ASSUMPTIONS: OfferPreparationAssumptions = {
  lowEarnestMoneyPercent: 0.01,
  standardEarnestMoneyPercent: {
    min: 0.01,
    max: 0.03
  },
  aggressiveClosingTimelineDays: 14,
  slowClosingTimelineDays: 45,
  affordabilityTolerancePercent: 0.05
};

const REQUIRED_FIELDS: Array<keyof OfferPreparationInputs> = [
  "offerPrice",
  "earnestMoneyAmount",
  "downPaymentType",
  "financingContingency",
  "inspectionContingency",
  "appraisalContingency",
  "closingTimelineDays"
];

function countPresent(inputs: OfferPreparationInputs): number {
  return REQUIRED_FIELDS.filter((field) => {
    const value = inputs[field];
    if (typeof value === "string") {
      return value.trim().length > 0;
    }
    return value !== null && value !== undefined;
  }).length;
}

function deriveDownPayment(
  inputs: OfferPreparationInputs
): { amount: number | null; percent: number | null } {
  if (inputs.offerPrice === null || inputs.offerPrice <= 0) {
    return {
      amount: inputs.downPaymentAmount ?? null,
      percent: inputs.downPaymentPercent ?? null
    };
  }

  if (inputs.downPaymentType === "percent" && typeof inputs.downPaymentPercent === "number") {
    const percent = Math.max(0, Math.min(100, inputs.downPaymentPercent));
    return {
      percent,
      amount: Math.round(inputs.offerPrice * (percent / 100))
    };
  }

  if (inputs.downPaymentType === "amount" && typeof inputs.downPaymentAmount === "number") {
    const amount = Math.max(0, Math.round(inputs.downPaymentAmount));
    return {
      amount,
      percent: inputs.offerPrice > 0 ? Number(((amount / inputs.offerPrice) * 100).toFixed(2)) : null
    };
  }

  return {
    amount: inputs.downPaymentAmount ?? null,
    percent: inputs.downPaymentPercent ?? null
  };
}

function deriveCashRequiredAtOffer(
  offerPrice: number | null,
  earnestMoneyAmount: number | null,
  downPaymentAmount: number | null,
  financialReadiness: FinancialReadiness
): number | null {
  if (offerPrice === null || offerPrice <= 0) {
    return null;
  }

  const closingCostPercent =
    financialReadiness.assumptionsUsed.closingCostPercent ??
    (financialReadiness.desiredHomePrice && financialReadiness.estimatedClosingCosts
      ? financialReadiness.estimatedClosingCosts / financialReadiness.desiredHomePrice
      : 0.03);
  const closingCosts = Math.round(offerPrice * closingCostPercent);
  const downPayment = downPaymentAmount ?? 0;
  const earnest = earnestMoneyAmount ?? 0;

  return Math.max(downPayment + closingCosts, earnest);
}

function buildMissingItems(inputs: OfferPreparationInputs): OfferPreparationMissingItem[] {
  const missing: OfferPreparationMissingItem[] = [];

  if (inputs.offerPrice === null) {
    missing.push({ field: "offerPrice", message: "Add an offer price." });
  }
  if (inputs.earnestMoneyAmount === null) {
    missing.push({ field: "earnestMoneyAmount", message: "Add an earnest money amount." });
  }
  if (inputs.downPaymentType === null) {
    missing.push({ field: "downPaymentType", message: "Choose how to enter the down payment." });
  }
  if (
    inputs.downPaymentType === "amount" &&
    (inputs.downPaymentAmount === null || inputs.downPaymentAmount === undefined)
  ) {
    missing.push({ field: "downPaymentAmount", message: "Add a down payment amount." });
  }
  if (
    inputs.downPaymentType === "percent" &&
    (inputs.downPaymentPercent === null || inputs.downPaymentPercent === undefined)
  ) {
    missing.push({ field: "downPaymentPercent", message: "Add a down payment percentage." });
  }
  if (inputs.financingContingency === null) {
    missing.push({
      field: "financingContingency",
      message: "Choose whether financing contingency is included."
    });
  }
  if (inputs.inspectionContingency === null) {
    missing.push({
      field: "inspectionContingency",
      message: "Choose whether inspection contingency is included."
    });
  }
  if (inputs.appraisalContingency === null) {
    missing.push({
      field: "appraisalContingency",
      message: "Choose whether appraisal contingency is included."
    });
  }
  if (inputs.closingTimelineDays === null) {
    missing.push({ field: "closingTimelineDays", message: "Add a closing timeline." });
  }

  return missing;
}

function buildBlockers(
  inputs: OfferPreparationInputs,
  financialReadiness: FinancialReadiness,
  cashRequiredAtOffer: number | null,
  downPaymentAmount: number | null
): OfferPreparationBlocker[] {
  const blockers: OfferPreparationBlocker[] = [];
  const affordabilityCap = financialReadiness.maxAffordableHomePrice ?? null;
  const offerPrice = inputs.offerPrice ?? null;

  if (financialReadiness.readinessState !== "READY") {
    blockers.push({
      code: "FINANCIAL_READINESS_NOT_READY",
      severity: "blocking",
      message: "Financial readiness is not ready for offer preparation.",
      whyItMatters: "The offer cannot be treated as ready until household affordability is verified.",
      howToFix: "Resolve financial readiness blockers before finalizing offer terms."
    });
  }

  if (
    offerPrice !== null &&
    affordabilityCap !== null &&
    affordabilityCap > 0 &&
    offerPrice > affordabilityCap * (1 + ASSUMPTIONS.affordabilityTolerancePercent)
  ) {
    blockers.push({
      code: "OFFER_PRICE_ABOVE_AFFORDABILITY",
      severity: "blocking",
      message: "Offer price is above the supported affordability range.",
      whyItMatters: "The buyer would be preparing an offer outside the current affordability guardrail.",
      howToFix: "Lower the offer price or improve financial readiness before proceeding."
    });
  }

  if (
    cashRequiredAtOffer !== null &&
    financialReadiness.availableCashSavings !== null &&
    cashRequiredAtOffer > financialReadiness.availableCashSavings
  ) {
    blockers.push({
      code: "INSUFFICIENT_CASH_FOR_OFFER",
      severity: "blocking",
      message: "Available cash does not cover the current offer structure.",
      whyItMatters: "The buyer may not be able to fund the down payment, deposit, and closing cash needed.",
      howToFix: "Lower the offer price, reduce cash commitments, or increase available funds."
    });
  }

  if (
    inputs.financingContingency === "waived" &&
    financialReadiness.readinessState !== "READY"
  ) {
    blockers.push({
      code: "HIGH_RISK_CONTINGENCY_SETUP",
      severity: "blocking",
      message: "Financing contingency is waived before financial readiness is fully ready.",
      whyItMatters: "Waiving financing protection increases the risk of a failed purchase.",
      howToFix: "Include the financing contingency or fully resolve financial readiness first."
    });
  }

  if (
    inputs.downPaymentType === "percent" &&
    typeof inputs.downPaymentPercent === "number" &&
    (inputs.downPaymentPercent < 0 || inputs.downPaymentPercent > 100)
  ) {
    blockers.push({
      code: "INVALID_DOWN_PAYMENT",
      severity: "blocking",
      message: "Down payment percent must stay between 0% and 100%.",
      whyItMatters: "Offer cash requirements depend on a valid down payment value.",
      howToFix: "Enter a realistic down payment percentage."
    });
  }

  if (downPaymentAmount !== null && offerPrice !== null && downPaymentAmount > offerPrice) {
    blockers.push({
      code: "INVALID_DOWN_PAYMENT",
      severity: "blocking",
      message: "Down payment amount cannot exceed the offer price.",
      whyItMatters: "The offer structure becomes invalid when down payment exceeds the home price.",
      howToFix: "Lower the down payment amount."
    });
  }

  if (
    inputs.closingTimelineDays !== null &&
    (inputs.closingTimelineDays < 1 || inputs.closingTimelineDays > 120)
  ) {
    blockers.push({
      code: "INVALID_CLOSING_TIMELINE",
      severity: "blocking",
      message: "Closing timeline is outside the supported range.",
      whyItMatters: "The timeline should be realistic and understandable to the buyer.",
      howToFix: "Choose a closing timeline between 1 and 120 days."
    });
  }

  if (buildMissingItems(inputs).length > 0) {
    blockers.push({
      code: "MISSING_REQUIRED_TERMS",
      severity: "warning",
      message: "Required offer terms are still missing.",
      whyItMatters: "The system cannot determine offer readiness until core terms are complete.",
      howToFix: "Complete the missing offer terms."
    });
  }

  return blockers;
}

function deriveRiskLevel(
  inputs: OfferPreparationInputs,
  blockers: OfferPreparationBlocker[],
  financialReadiness: FinancialReadiness,
  recommendedOfferPrice?: number | null
): OfferPreparationRiskLevel {
  const blockingCodes = new Set(
    blockers.filter((entry) => entry.severity === "blocking").map((entry) => entry.code)
  );

  if (
    blockingCodes.has("OFFER_PRICE_ABOVE_AFFORDABILITY") ||
    blockingCodes.has("INSUFFICIENT_CASH_FOR_OFFER") ||
    blockingCodes.has("HIGH_RISK_CONTINGENCY_SETUP")
  ) {
    return "HIGH_RISK";
  }

  const offerPrice = inputs.offerPrice ?? 0;
  const earnestRate = offerPrice > 0 && inputs.earnestMoneyAmount !== null
    ? inputs.earnestMoneyAmount / offerPrice
    : 0;
  const waivedCount = [
    inputs.financingContingency,
    inputs.inspectionContingency,
    inputs.appraisalContingency
  ].filter((value) => value === "waived").length;
  const appraisalWaived = inputs.appraisalContingency === "waived";
  const lowDownPayment =
    typeof inputs.downPaymentPercent === "number"
      ? inputs.downPaymentPercent < 10
      : false;

  if (
    earnestRate < ASSUMPTIONS.lowEarnestMoneyPercent ||
    waivedCount > 0 ||
    (inputs.closingTimelineDays !== null &&
      inputs.closingTimelineDays < ASSUMPTIONS.aggressiveClosingTimelineDays) ||
    (recommendedOfferPrice !== null &&
      recommendedOfferPrice !== undefined &&
      offerPrice > 0 &&
      offerPrice > recommendedOfferPrice * 1.03) ||
    (appraisalWaived && lowDownPayment) ||
    financialReadiness.affordabilityClassification === "ALMOST_READY"
  ) {
    return "MODERATE_RISK";
  }

  return "LOW_RISK";
}

function deriveCompletenessState(
  inputs: OfferPreparationInputs,
  missingItems: OfferPreparationMissingItem[]
): OfferPreparationCompletenessState {
  const present = countPresent(inputs);
  if (present === 0) {
    return "not_started";
  }
  if (missingItems.length > 0) {
    return "partial";
  }
  return "complete";
}

function deriveOfferState(
  inputs: OfferPreparationInputs,
  completeness: OfferPreparationCompletenessState,
  blockers: OfferPreparationBlocker[],
  financialReadiness: FinancialReadiness
): OfferPreparationState {
  const present = countPresent(inputs);
  if (present === 0) {
    return "NOT_STARTED";
  }

  if (blockers.some((entry) => entry.severity === "blocking")) {
    return "BLOCKED";
  }

  if (financialReadiness.readinessState !== "READY") {
    return completeness === "complete" ? "INCOMPLETE" : "IN_PROGRESS";
  }

  if (completeness === "complete") {
    return "READY";
  }

  return completeness === "partial" ? "INCOMPLETE" : "IN_PROGRESS";
}

function buildFinancialAlignment(
  financialReadiness: FinancialReadiness,
  offerPrice: number | null,
  cashRequiredAtOffer: number | null,
  recommendedOfferPrice?: number | null
): OfferPreparationFinancialAlignment {
  const affordabilityCap = financialReadiness.maxAffordableHomePrice ?? null;
  const availableCashSavings = financialReadiness.availableCashSavings ?? null;
  const financiallyAligned =
    financialReadiness.readinessState === "READY" &&
    offerPrice !== null &&
    (affordabilityCap === null || offerPrice <= affordabilityCap) &&
    (cashRequiredAtOffer === null ||
      availableCashSavings === null ||
      cashRequiredAtOffer <= availableCashSavings);

  return {
    maxAffordableHomePrice: affordabilityCap,
    targetCashToClose: financialReadiness.totalCashRequiredToClose ?? null,
    availableCashSavings,
    affordabilityClassification: financialReadiness.affordabilityClassification,
    readinessState: financialReadiness.readinessState,
    financiallyAligned,
    recommendedOfferPrice: recommendedOfferPrice ?? null
  };
}

function buildGuidance(
  inputs: OfferPreparationInputs,
  financialReadiness: FinancialReadiness,
  blockers: OfferPreparationBlocker[],
  missingItems: OfferPreparationMissingItem[],
  riskLevel: OfferPreparationRiskLevel,
  readinessToSubmit: boolean,
  recommendedOfferPrice?: number | null
): Pick<
  OfferPreparation,
  "recommendation" | "risk" | "alternative" | "nextAction" | "nextSteps"
> {
  let nextAction = "Complete offer draft";

  if (financialReadiness.readinessState !== "READY") {
    nextAction = "Revisit financial readiness";
  } else if (missingItems.length > 0) {
    nextAction = "Complete offer draft";
  } else if (blockers.some((entry) => entry.code === "OFFER_PRICE_ABOVE_AFFORDABILITY")) {
    nextAction = "Adjust offer price";
  } else if (blockers.some((entry) => entry.code === "INSUFFICIENT_CASH_FOR_OFFER")) {
    nextAction = "Adjust down payment or offer price";
  } else if (
    inputs.offerPrice !== null &&
    inputs.earnestMoneyAmount !== null &&
    inputs.offerPrice > 0 &&
    inputs.earnestMoneyAmount / inputs.offerPrice < ASSUMPTIONS.lowEarnestMoneyPercent
  ) {
    nextAction = "Increase earnest money";
  } else if (
    inputs.inspectionContingency === "waived" ||
    inputs.appraisalContingency === "waived"
  ) {
    nextAction = "Add missing contingency terms";
  } else if (readinessToSubmit) {
    nextAction = "Proceed to offer submission";
  }

  const nextSteps = new Set<string>();
  if (financialReadiness.readinessState !== "READY") {
    nextSteps.add("Revisit financial readiness");
  }
  if (missingItems.length > 0) {
    nextSteps.add("Complete offer draft");
  }
  if (blockers.some((entry) => entry.code === "OFFER_PRICE_ABOVE_AFFORDABILITY")) {
    nextSteps.add("Adjust offer price");
  }
  if (blockers.some((entry) => entry.code === "INSUFFICIENT_CASH_FOR_OFFER")) {
    nextSteps.add("Adjust down payment or offer price");
  }
  if (
    inputs.offerPrice !== null &&
    inputs.earnestMoneyAmount !== null &&
    inputs.offerPrice > 0 &&
    inputs.earnestMoneyAmount / inputs.offerPrice < ASSUMPTIONS.lowEarnestMoneyPercent
  ) {
    nextSteps.add("Increase earnest money");
  }
  if (
    inputs.inspectionContingency === "waived" ||
    inputs.appraisalContingency === "waived" ||
    inputs.financingContingency === "waived"
  ) {
    nextSteps.add("Add missing contingency terms");
  }
  if (readinessToSubmit) {
    nextSteps.add("Proceed to offer submission");
  }

  const recommendation = readinessToSubmit
    ? "This offer draft is complete and financially supported."
    : financialReadiness.readinessState !== "READY"
      ? "Resolve financial readiness before treating this offer as ready to submit."
      : blockers.some((entry) => entry.code === "OFFER_PRICE_ABOVE_AFFORDABILITY")
        ? "Bring the offer price back inside the supported affordability range."
        : missingItems.length > 0
          ? "Complete the missing offer terms so the draft can be reviewed safely."
          : recommendedOfferPrice !== null && recommendedOfferPrice !== undefined && inputs.offerPrice !== null
            ? `This draft is being compared against a stored recommended offer near $${recommendedOfferPrice.toLocaleString()}.`
            : "This draft is ready for final buyer review once the remaining items are resolved.";

  const risk =
    riskLevel === "HIGH_RISK"
      ? "One or more terms create a high-risk draft that should not move forward unchanged."
      : riskLevel === "MODERATE_RISK"
        ? "The offer can move forward, but one or more terms deserve closer buyer review."
        : "The current terms stay inside the normal risk band for this workflow.";

  const alternative =
    blockers.some((entry) => entry.code === "OFFER_PRICE_ABOVE_AFFORDABILITY")
      ? "Lower the offer price or improve affordability before continuing."
      : blockers.some((entry) => entry.code === "INSUFFICIENT_CASH_FOR_OFFER")
        ? "Reduce up-front cash commitments or increase available cash."
        : inputs.inspectionContingency === "waived" || inputs.appraisalContingency === "waived"
          ? "Keep standard protections if the buyer wants a lower-risk offer."
          : "Keep the draft aligned with financial readiness and move to submission when the buyer is ready.";

  return {
    recommendation,
    risk,
    alternative,
    nextAction,
    nextSteps: [...nextSteps]
  };
}

export function evaluateOfferPreparation(
  input: OfferPreparationEvaluationInput
): Omit<OfferPreparation, "id" | "createdAt" | "updatedAt"> {
  const current = input.current;
  const patch = input.patch ?? {};
  const financialReadiness = input.financialReadiness;
  const currentInputs = current ?? {
    propertyId: patch.propertyId ?? "",
    propertyAddressLabel: patch.propertyAddressLabel ?? "",
    shortlistId: patch.shortlistId ?? null,
    offerReadinessId: patch.offerReadinessId ?? null,
    financialReadinessId: patch.financialReadinessId ?? financialReadiness.id,
    offerPrice: null,
    earnestMoneyAmount: null,
    downPaymentType: null,
    downPaymentAmount: null,
    downPaymentPercent: null,
    financingContingency: null,
    inspectionContingency: null,
    appraisalContingency: null,
    closingTimelineDays: null,
    possessionTiming: null,
    possessionDaysAfterClosing: null,
    sellerConcessionsRequestedAmount: null,
    notes: null,
    buyerRationale: null
  };

  const inputs: OfferPreparationInputs = {
    propertyId: patch.propertyId ?? currentInputs.propertyId,
    propertyAddressLabel: patch.propertyAddressLabel ?? currentInputs.propertyAddressLabel,
    shortlistId: patch.shortlistId ?? currentInputs.shortlistId ?? null,
    offerReadinessId: patch.offerReadinessId ?? currentInputs.offerReadinessId ?? null,
    financialReadinessId: currentInputs.financialReadinessId,
    offerPrice: patch.offerPrice ?? currentInputs.offerPrice ?? null,
    earnestMoneyAmount: patch.earnestMoneyAmount ?? currentInputs.earnestMoneyAmount ?? null,
    downPaymentType: patch.downPaymentType ?? currentInputs.downPaymentType ?? null,
    downPaymentAmount: patch.downPaymentAmount ?? currentInputs.downPaymentAmount ?? null,
    downPaymentPercent: patch.downPaymentPercent ?? currentInputs.downPaymentPercent ?? null,
    financingContingency:
      patch.financingContingency ?? currentInputs.financingContingency ?? null,
    inspectionContingency:
      patch.inspectionContingency ?? currentInputs.inspectionContingency ?? null,
    appraisalContingency:
      patch.appraisalContingency ?? currentInputs.appraisalContingency ?? null,
    closingTimelineDays:
      patch.closingTimelineDays ?? currentInputs.closingTimelineDays ?? null,
    possessionTiming: patch.possessionTiming ?? currentInputs.possessionTiming ?? null,
    possessionDaysAfterClosing:
      patch.possessionDaysAfterClosing ?? currentInputs.possessionDaysAfterClosing ?? null,
    sellerConcessionsRequestedAmount:
      patch.sellerConcessionsRequestedAmount ??
      currentInputs.sellerConcessionsRequestedAmount ??
      null,
    notes: patch.notes ?? currentInputs.notes ?? null,
    buyerRationale: patch.buyerRationale ?? currentInputs.buyerRationale ?? null
  };

  const { amount: downPaymentAmount, percent: downPaymentPercent } = deriveDownPayment(inputs);
  const normalizedInputs: OfferPreparationInputs = {
    ...inputs,
    downPaymentAmount,
    downPaymentPercent
  };

  const cashRequiredAtOffer = deriveCashRequiredAtOffer(
    normalizedInputs.offerPrice,
    normalizedInputs.earnestMoneyAmount,
    normalizedInputs.downPaymentAmount,
    financialReadiness
  );
  const missingItems = buildMissingItems(normalizedInputs);
  const blockers = buildBlockers(
    normalizedInputs,
    financialReadiness,
    cashRequiredAtOffer,
    normalizedInputs.downPaymentAmount
  );
  const completeness = deriveCompletenessState(normalizedInputs, missingItems);
  const riskLevel = deriveRiskLevel(
    normalizedInputs,
    blockers,
    financialReadiness,
    input.recommendedOfferPrice
  );
  const offerState = deriveOfferState(normalizedInputs, completeness, blockers, financialReadiness);
  const readinessToSubmit =
    offerState === "READY" &&
    completeness === "complete" &&
    blockers.every((entry) => entry.severity !== "blocking") &&
    financialReadiness.readinessState === "READY";
  const guidance = buildGuidance(
    normalizedInputs,
    financialReadiness,
    blockers,
    missingItems,
    riskLevel,
    readinessToSubmit,
    input.recommendedOfferPrice
  );

  return {
    sessionId: input.sessionId ?? current?.sessionId ?? null,
    partnerId: input.partnerId ?? current?.partnerId ?? null,
    ...normalizedInputs,
    offerSummary: {
      propertyId: normalizedInputs.propertyId,
      propertyAddressLabel: normalizedInputs.propertyAddressLabel,
      offerPrice: normalizedInputs.offerPrice,
      earnestMoneyAmount: normalizedInputs.earnestMoneyAmount,
      downPaymentAmount: normalizedInputs.downPaymentAmount,
      downPaymentPercent: normalizedInputs.downPaymentPercent,
      financingContingency: normalizedInputs.financingContingency,
      inspectionContingency: normalizedInputs.inspectionContingency,
      appraisalContingency: normalizedInputs.appraisalContingency,
      closingTimelineDays: normalizedInputs.closingTimelineDays,
      possessionTiming: normalizedInputs.possessionTiming ?? null
    },
    offerState,
    offerRiskLevel: riskLevel,
    offerCompletenessState: completeness,
    readinessToSubmit,
    cashRequiredAtOffer,
    missingItems,
    blockers,
    recommendation: guidance.recommendation,
    risk: guidance.risk,
    alternative: guidance.alternative,
    nextAction: guidance.nextAction,
    nextSteps: guidance.nextSteps,
    financialAlignment: buildFinancialAlignment(
      financialReadiness,
      normalizedInputs.offerPrice,
      cashRequiredAtOffer,
      input.recommendedOfferPrice
    ),
    assumptionsUsed: { ...ASSUMPTIONS },
    lastEvaluatedAt: input.now
  };
}

export function toOfferPreparationSummary(record: OfferPreparation): OfferPreparationSummary {
  return {
    offerSummary: { ...record.offerSummary },
    offerState: record.offerState,
    offerRiskLevel: record.offerRiskLevel,
    offerCompletenessState: record.offerCompletenessState,
    readinessToSubmit: record.readinessToSubmit,
    cashRequiredAtOffer: record.cashRequiredAtOffer,
    missingItems: [...record.missingItems],
    blockers: [...record.blockers],
    recommendation: record.recommendation,
    risk: record.risk,
    alternative: record.alternative,
    nextAction: record.nextAction,
    nextSteps: [...record.nextSteps],
    financialAlignment: { ...record.financialAlignment },
    assumptionsUsed: {
      ...record.assumptionsUsed,
      standardEarnestMoneyPercent: {
        ...record.assumptionsUsed.standardEarnestMoneyPercent
      }
    },
    lastEvaluatedAt: record.lastEvaluatedAt
  };
}
