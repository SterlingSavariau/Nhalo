import type {
  AffordabilityClassification,
  CreditScoreRange,
  FinancialBlocker,
  FinancialReadiness,
  FinancialReadinessAssumptions,
  FinancialReadinessInputs,
  FinancialReadinessSummary,
  FinancialReadinessState,
  LoanType,
  PreApprovalStatus,
  ProofOfFundsStatus
} from "@nhalo/types";

type FinancialReadinessEvaluationInput = {
  now: string;
  current?: FinancialReadiness | null;
  patch?: Partial<FinancialReadinessInputs>;
  sessionId?: string | null;
  partnerId?: string | null;
};

const REQUIRED_FIELDS: Array<keyof FinancialReadinessInputs> = [
  "annualHouseholdIncome",
  "monthlyDebtPayments",
  "availableCashSavings",
  "creditScoreRange",
  "desiredHomePrice",
  "purchaseLocation",
  "preApprovalStatus",
  "proofOfFundsStatus"
];

function defaultLoanType(value?: LoanType | null): LoanType {
  return value ?? "conventional";
}

function countPresent(inputs: FinancialReadinessInputs): number {
  return REQUIRED_FIELDS.filter((field) => {
    const value = inputs[field];
    if (typeof value === "string") {
      return value.trim().length > 0;
    }
    return value !== null && value !== undefined;
  }).length;
}

function downPaymentPercent(loanType: LoanType, preferred?: number | null): number {
  if (typeof preferred === "number") {
    return Math.max(0, Math.min(100, preferred)) / 100;
  }

  switch (loanType) {
    case "fha":
      return 0.035;
    case "va":
    case "usda":
      return 0;
    case "other":
    case "conventional":
    default:
      return 0.1;
  }
}

function closingCostPercent(loanType: LoanType): number {
  switch (loanType) {
    case "fha":
      return 0.035;
    case "va":
      return 0.025;
    case "usda":
      return 0.03;
    case "other":
    case "conventional":
    default:
      return 0.03;
  }
}

function interestRateFromCredit(score: CreditScoreRange | null): number | null {
  switch (score) {
    case "excellent_760_plus":
      return 0.0625;
    case "good_720_759":
      return 0.066;
    case "fair_680_719":
      return 0.071;
    case "limited_620_679":
      return 0.0785;
    case "below_620":
      return 0.09;
    default:
      return null;
  }
}

function targetDtiCap(score: CreditScoreRange | null): number {
  switch (score) {
    case "excellent_760_plus":
    case "good_720_759":
      return 0.43;
    case "fair_680_719":
    case "limited_620_679":
      return 0.4;
    case "below_620":
      return 0.36;
    default:
      return 0.36;
  }
}

function propertyTaxRate(): number {
  return 0.0125;
}

function monthlyInsurance(price: number): number {
  return (price * 0.0035) / 12;
}

function monthlyPrincipalAndInterest(loanAmount: number, annualRate: number): number {
  if (loanAmount <= 0) {
    return 0;
  }

  const monthlyRate = annualRate / 12;
  const payments = 30 * 12;
  if (monthlyRate === 0) {
    return loanAmount / payments;
  }

  return (
    (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, payments)) /
    (Math.pow(1 + monthlyRate, payments) - 1)
  );
}

function estimateForPrice(
  price: number,
  assumptions: FinancialReadinessAssumptions
): {
  estimatedDownPayment: number;
  estimatedClosingCosts: number;
  totalCashRequiredToClose: number;
  estimatedMonthlyPayment: number;
} {
  const down = Math.round(price * (assumptions.downPaymentPercent ?? 0));
  const closing = Math.round(price * (assumptions.closingCostPercent ?? 0));
  const loanAmount = Math.max(0, price - down);
  const principalAndInterest = monthlyPrincipalAndInterest(loanAmount, assumptions.interestRate ?? 0);
  const taxes = price * (assumptions.propertyTaxRate ?? 0) / 12;
  const insurance = assumptions.insuranceMonthly ?? monthlyInsurance(price);

  return {
    estimatedDownPayment: down,
    estimatedClosingCosts: closing,
    totalCashRequiredToClose: down + closing,
    estimatedMonthlyPayment: Math.round(principalAndInterest + taxes + insurance)
  };
}

function roundAffordablePrice(value: number): number {
  return Math.max(0, Math.round(value / 1000) * 1000);
}

function maxAffordableHomePrice(
  inputs: FinancialReadinessInputs,
  assumptions: FinancialReadinessAssumptions
): number | null {
  if (
    inputs.annualHouseholdIncome === null ||
    inputs.monthlyDebtPayments === null ||
    inputs.availableCashSavings === null
  ) {
    return null;
  }

  const grossMonthlyIncome = inputs.annualHouseholdIncome / 12;
  const maxHousingBudget = grossMonthlyIncome * targetDtiCap(inputs.creditScoreRange) - inputs.monthlyDebtPayments;

  if (grossMonthlyIncome <= 0 || maxHousingBudget <= 0 || inputs.availableCashSavings <= 0) {
    return 0;
  }

  const desired = Math.max(inputs.desiredHomePrice ?? 0, 250000);
  let low = 50000;
  let high = Math.max(desired * 2, 2500000);
  let best = 0;

  for (let iteration = 0; iteration < 24; iteration += 1) {
    const mid = Math.round((low + high) / 2);
    const estimate = estimateForPrice(mid, assumptions);
    const affordable =
      estimate.estimatedMonthlyPayment <= maxHousingBudget &&
      estimate.totalCashRequiredToClose <= inputs.availableCashSavings;

    if (affordable) {
      best = mid;
      low = mid + 1000;
    } else {
      high = mid - 1000;
    }
  }

  return roundAffordablePrice(best);
}

function invalidInputBlockers(inputs: FinancialReadinessInputs): FinancialBlocker[] {
  const blockers: FinancialBlocker[] = [];

  const numericChecks: Array<[keyof FinancialReadinessInputs, string, boolean]> = [
    ["annualHouseholdIncome", "Annual household income", (inputs.annualHouseholdIncome ?? 0) <= 0],
    ["monthlyDebtPayments", "Monthly debt payments", (inputs.monthlyDebtPayments ?? 0) < 0],
    ["availableCashSavings", "Available cash savings", (inputs.availableCashSavings ?? 0) < 0],
    ["desiredHomePrice", "Desired home price", (inputs.desiredHomePrice ?? 0) <= 0]
  ];

  for (const [field, label, invalid] of numericChecks) {
    if (inputs[field] !== null && inputs[field] !== undefined && invalid) {
      blockers.push({
        code: "INVALID_INPUT_RANGE",
        severity: "blocking",
        message: `${label} is outside the allowed range.`,
        whyItMatters: "Financial readiness cannot be evaluated with impossible or invalid values.",
        howToFix: `Update ${label.toLowerCase()} to a realistic number.`
      });
    }
  }

  if (
    typeof inputs.downPaymentPreferencePercent === "number" &&
    (inputs.downPaymentPreferencePercent < 0 || inputs.downPaymentPreferencePercent > 100)
  ) {
    blockers.push({
      code: "INVALID_INPUT_RANGE",
      severity: "blocking",
      message: "Down payment preference must be between 0% and 100%.",
      whyItMatters: "Cash-to-close estimates depend on a valid down payment assumption.",
      howToFix: "Choose a down payment percent between 0 and 100."
    });
  }

  return blockers;
}

function missingDataBlockers(inputs: FinancialReadinessInputs): FinancialBlocker[] {
  const missing: string[] = [];

  if (inputs.annualHouseholdIncome === null) missing.push("annual income");
  if (inputs.monthlyDebtPayments === null) missing.push("monthly debt");
  if (inputs.availableCashSavings === null) missing.push("cash savings");
  if (!inputs.creditScoreRange) missing.push("credit score range");
  if (inputs.desiredHomePrice === null) missing.push("target home price");
  if (!inputs.purchaseLocation?.trim()) missing.push("purchase location");
  if (!inputs.preApprovalStatus) missing.push("pre-approval status");
  if (!inputs.proofOfFundsStatus) missing.push("proof of funds status");

  if (missing.length === 0) {
    return [];
  }

  return [
    {
      code: "MISSING_FINANCIAL_DATA",
      severity: "blocking",
      message: `Financial profile is missing ${missing.join(", ")}.`,
      whyItMatters: "Nhalo cannot safely validate affordability until the core financial profile is complete.",
      howToFix: "Complete the missing financial fields before relying on affordability output."
    }
  ];
}

function buildBlockers(
  inputs: FinancialReadinessInputs,
  summary: {
    maxAffordableHomePrice: number | null;
    estimatedMonthlyPayment: number | null;
    totalCashRequiredToClose: number | null;
    debtToIncomeRatio: number | null;
  }
): FinancialBlocker[] {
  const blockers = [...invalidInputBlockers(inputs), ...missingDataBlockers(inputs)];

  if (inputs.preApprovalStatus === "expired") {
    blockers.push({
      code: "EXPIRED_PREAPPROVAL",
      severity: "blocking",
      message: "Pre-approval has expired.",
      whyItMatters: "An expired pre-approval weakens offer credibility and should not be treated as active readiness.",
      howToFix: "Refresh the pre-approval before moving into offer preparation."
    });
  } else if (inputs.preApprovalStatus && inputs.preApprovalStatus !== "verified") {
    blockers.push({
      code: "MISSING_PREAPPROVAL",
      severity: "warning",
      message: "Pre-approval is still missing.",
      whyItMatters: "Buyers are less offer-ready without verified financing.",
      howToFix: "Get pre-approval before preparing an offer."
    });
  }

  if (inputs.proofOfFundsStatus && inputs.proofOfFundsStatus !== "verified") {
    blockers.push({
      code: "MISSING_PROOF_OF_FUNDS",
      severity: "warning",
      message: "Available cash has not been fully verified.",
      whyItMatters: "Cash-to-close readiness is stronger when funds are verified, not assumed.",
      howToFix: "Confirm available cash before relying on offer readiness."
    });
  }

  if (
    summary.totalCashRequiredToClose !== null &&
    inputs.availableCashSavings !== null &&
    inputs.availableCashSavings < summary.totalCashRequiredToClose
  ) {
    blockers.push({
      code: "INSUFFICIENT_FUNDS",
      severity: "blocking",
      message: "Available cash is below the estimated cash required to close.",
      whyItMatters: "The buyer may not be able to cover down payment and closing costs.",
      howToFix: "Increase available cash or lower the target home price."
    });
  }

  if (summary.debtToIncomeRatio !== null) {
    if (summary.debtToIncomeRatio > 0.5) {
      blockers.push({
        code: "VERY_HIGH_DTI",
        severity: "blocking",
        message: "Debt-to-income ratio is above 50%.",
        whyItMatters: "That level is usually too stretched for safe offer readiness.",
        howToFix: "Reduce debt obligations or lower the target home price."
      });
    } else if (summary.debtToIncomeRatio > 0.43) {
      blockers.push({
        code: "HIGH_DTI",
        severity: "warning",
        message: "Debt-to-income ratio is above 43%.",
        whyItMatters: "The buyer may be financially stretched at this target price.",
        howToFix: "Reduce debt or lower the target price before submitting an offer."
      });
    }
  }

  if (
    inputs.desiredHomePrice !== null &&
    summary.maxAffordableHomePrice !== null &&
    inputs.desiredHomePrice > summary.maxAffordableHomePrice
  ) {
    blockers.push({
      code: "UNAFFORDABLE_TARGET_PRICE",
      severity:
        summary.maxAffordableHomePrice > 0 &&
        inputs.desiredHomePrice <= summary.maxAffordableHomePrice * 1.1
          ? "warning"
          : "blocking",
      message: "Target home price is above the current supported affordability range.",
      whyItMatters: "Offer preparation should start from a price the buyer can actually support.",
      howToFix: "Lower the target home price or strengthen cash and debt position."
    });
  }

  if (inputs.creditScoreRange === "below_620") {
    blockers.push({
      code: "LOW_CREDIT_READINESS",
      severity: "warning",
      message: "Credit readiness is limited for a standard offer path.",
      whyItMatters: "Financing assumptions become less reliable at lower credit ranges.",
      howToFix: "Treat affordability conservatively and confirm lender options before offering."
    });
  }

  return blockers;
}

function deriveAffordabilityClassification(
  inputs: FinancialReadinessInputs,
  blockers: FinancialBlocker[],
  outputs: {
    maxAffordableHomePrice: number | null;
    totalCashRequiredToClose: number | null;
    debtToIncomeRatio: number | null;
  }
): AffordabilityClassification {
  const hasInvalidOrMissing = blockers.some((blocker) =>
    ["INVALID_INPUT_RANGE", "MISSING_FINANCIAL_DATA", "EXPIRED_PREAPPROVAL"].includes(blocker.code)
  );
  if (hasInvalidOrMissing) {
    return "BLOCKED";
  }

  if (
    inputs.desiredHomePrice !== null &&
    outputs.maxAffordableHomePrice !== null &&
    inputs.availableCashSavings !== null &&
    outputs.totalCashRequiredToClose !== null &&
    outputs.debtToIncomeRatio !== null &&
    inputs.preApprovalStatus === "verified" &&
    inputs.proofOfFundsStatus === "verified" &&
    inputs.desiredHomePrice <= outputs.maxAffordableHomePrice &&
    inputs.availableCashSavings >= outputs.totalCashRequiredToClose &&
    outputs.debtToIncomeRatio <= 0.43
  ) {
    return "READY";
  }

  const cashShortfall =
    inputs.availableCashSavings !== null && outputs.totalCashRequiredToClose !== null
      ? outputs.totalCashRequiredToClose - inputs.availableCashSavings
      : 0;
  const cashShortfallRate =
    outputs.totalCashRequiredToClose && cashShortfall > 0
      ? cashShortfall / outputs.totalCashRequiredToClose
      : 0;
  const priceAboveAffordable =
    inputs.desiredHomePrice !== null && outputs.maxAffordableHomePrice !== null
      ? inputs.desiredHomePrice - outputs.maxAffordableHomePrice
      : 0;
  const priceAboveAffordableRate =
    outputs.maxAffordableHomePrice && priceAboveAffordable > 0
      ? priceAboveAffordable / outputs.maxAffordableHomePrice
      : 0;

  if (
    (outputs.debtToIncomeRatio !== null && outputs.debtToIncomeRatio > 0.5) ||
    cashShortfallRate > 0.15 ||
    priceAboveAffordableRate > 0.1
  ) {
    return "NOT_READY";
  }

  return "ALMOST_READY";
}

function deriveReadinessState(
  inputs: FinancialReadinessInputs,
  blockers: FinancialBlocker[],
  affordabilityClassification: AffordabilityClassification
): FinancialReadinessState {
  const presentCount = countPresent(inputs);
  if (presentCount < 4) {
    return "NOT_STARTED";
  }

  const hasCriticalBlocker = blockers.some((blocker) => blocker.severity === "blocking");
  if (hasCriticalBlocker) {
    return "BLOCKED";
  }

  if (affordabilityClassification === "READY") {
    return "READY";
  }

  return "IN_PROGRESS";
}

function deriveNextSteps(blockers: FinancialBlocker[], state: FinancialReadinessState): string[] {
  const steps: string[] = [];
  const has = (code: FinancialBlocker["code"]) => blockers.some((blocker) => blocker.code === code);

  if (has("MISSING_FINANCIAL_DATA")) {
    steps.push("Complete your financial profile");
  }
  if (has("EXPIRED_PREAPPROVAL") || has("MISSING_PREAPPROVAL")) {
    steps.push("Get pre-approval");
  }
  if (has("MISSING_PROOF_OF_FUNDS")) {
    steps.push("Verify available cash");
  }
  if (has("INSUFFICIENT_FUNDS")) {
    steps.push("Increase available cash");
  }
  if (has("VERY_HIGH_DTI") || has("HIGH_DTI")) {
    steps.push("Reduce monthly debt");
  }
  if (has("UNAFFORDABLE_TARGET_PRICE")) {
    steps.push("Lower target price");
  }
  if (has("LOW_CREDIT_READINESS")) {
    steps.push("Review affordability assumptions");
  }
  if (state === "READY") {
    steps.push("Proceed to offer preparation");
  }

  return [...new Set(steps)];
}

function deriveNextAction(blockers: FinancialBlocker[], state: FinancialReadinessState): string {
  const steps = deriveNextSteps(blockers, state);
  return steps[0] ?? "Complete your financial profile";
}

function deriveRecommendationBundle(
  classification: AffordabilityClassification,
  state: FinancialReadinessState,
  nextAction: string
): { recommendation: string; risk: string; alternative: string } {
  switch (classification) {
    case "READY":
      return {
        recommendation: "You are financially ready to begin offer preparation.",
        risk: "Your affordability assumptions are still estimates and should stay aligned with the target purchase price.",
        alternative: "If the target home price changes materially, rerun this readiness check before offering."
      };
    case "ALMOST_READY":
      return {
        recommendation: "You are close to offer-ready, but one issue still needs to be resolved.",
        risk: "Moving forward too early could weaken affordability discipline or offer credibility.",
        alternative: `${nextAction} before moving into offer preparation.`
      };
    case "NOT_READY":
      return {
        recommendation: "Your current target home price is not strongly supported by your finances yet.",
        risk: "Proceeding now could create payment strain or cash-to-close shortfalls.",
        alternative: "Lower the target price or improve cash and debt position before drafting an offer."
      };
    case "BLOCKED":
    default:
      return {
        recommendation: state === "NOT_STARTED"
          ? "Complete your financial profile to generate a real affordability picture."
          : "Financial readiness is blocked until the missing or invalid inputs are resolved.",
        risk: "Affordability output cannot be trusted until the financial profile is complete and valid.",
        alternative: "Resolve the blocked items first, then rerun the readiness check."
      };
  }
}

export function evaluateFinancialReadiness(
  input: FinancialReadinessEvaluationInput
): Omit<FinancialReadiness, "id" | "createdAt" | "updatedAt"> {
  const existingInputs: FinancialReadinessInputs = input.current
    ? {
        annualHouseholdIncome: input.current.annualHouseholdIncome,
        monthlyDebtPayments: input.current.monthlyDebtPayments,
        availableCashSavings: input.current.availableCashSavings,
        creditScoreRange: input.current.creditScoreRange,
        desiredHomePrice: input.current.desiredHomePrice,
        purchaseLocation: input.current.purchaseLocation,
        downPaymentPreferencePercent: input.current.downPaymentPreferencePercent,
        loanType: input.current.loanType,
        preApprovalStatus: input.current.preApprovalStatus,
        preApprovalExpiresAt: input.current.preApprovalExpiresAt,
        proofOfFundsStatus: input.current.proofOfFundsStatus
      }
    : {
        annualHouseholdIncome: null,
        monthlyDebtPayments: null,
        availableCashSavings: null,
        creditScoreRange: null,
        desiredHomePrice: null,
        purchaseLocation: null,
        downPaymentPreferencePercent: null,
        loanType: "conventional",
        preApprovalStatus: "not_started",
        preApprovalExpiresAt: null,
        proofOfFundsStatus: "not_started"
      };

  const inputs: FinancialReadinessInputs = {
    ...existingInputs,
    ...input.patch
  };

  const resolvedLoanType = defaultLoanType(inputs.loanType);
  const assumptionsUsed: FinancialReadinessAssumptions = {
    interestRate: interestRateFromCredit(inputs.creditScoreRange),
    propertyTaxRate: propertyTaxRate(),
    insuranceMonthly:
      inputs.desiredHomePrice !== null ? Math.round(monthlyInsurance(inputs.desiredHomePrice)) : null,
    closingCostPercent: closingCostPercent(resolvedLoanType),
    downPaymentPercent: downPaymentPercent(resolvedLoanType, inputs.downPaymentPreferencePercent),
    loanType: resolvedLoanType
  };

  const estimate =
    inputs.desiredHomePrice !== null
      ? estimateForPrice(inputs.desiredHomePrice, assumptionsUsed)
      : {
          estimatedDownPayment: null,
          estimatedClosingCosts: null,
          totalCashRequiredToClose: null,
          estimatedMonthlyPayment: null
        };
  const grossMonthlyIncome =
    inputs.annualHouseholdIncome !== null ? inputs.annualHouseholdIncome / 12 : null;
  const housingRatio =
    estimate.estimatedMonthlyPayment !== null && grossMonthlyIncome && grossMonthlyIncome > 0
      ? Number((estimate.estimatedMonthlyPayment / grossMonthlyIncome).toFixed(3))
      : null;
  const debtToIncomeRatio =
    estimate.estimatedMonthlyPayment !== null &&
    grossMonthlyIncome &&
    grossMonthlyIncome > 0 &&
    inputs.monthlyDebtPayments !== null
      ? Number((((estimate.estimatedMonthlyPayment + inputs.monthlyDebtPayments) / grossMonthlyIncome)).toFixed(3))
      : null;
  const maxPrice = maxAffordableHomePrice(inputs, assumptionsUsed);

  const blockers = buildBlockers(inputs, {
    maxAffordableHomePrice: maxPrice,
    estimatedMonthlyPayment: estimate.estimatedMonthlyPayment,
    totalCashRequiredToClose: estimate.totalCashRequiredToClose,
    debtToIncomeRatio
  });

  const affordabilityClassification = deriveAffordabilityClassification(inputs, blockers, {
    maxAffordableHomePrice: maxPrice,
    totalCashRequiredToClose: estimate.totalCashRequiredToClose,
    debtToIncomeRatio
  });
  const readinessState = deriveReadinessState(inputs, blockers, affordabilityClassification);
  const nextAction = deriveNextAction(blockers, readinessState);
  const nextSteps = deriveNextSteps(blockers, readinessState);
  const recommendationBundle = deriveRecommendationBundle(
    affordabilityClassification,
    readinessState,
    nextAction
  );

  return {
    sessionId: input.sessionId ?? input.current?.sessionId ?? null,
    partnerId: input.partnerId ?? input.current?.partnerId ?? null,
    ...inputs,
    maxAffordableHomePrice: maxPrice,
    estimatedMonthlyPayment: estimate.estimatedMonthlyPayment,
    estimatedDownPayment: estimate.estimatedDownPayment,
    estimatedClosingCosts: estimate.estimatedClosingCosts,
    totalCashRequiredToClose: estimate.totalCashRequiredToClose,
    debtToIncomeRatio,
    housingRatio,
    affordabilityClassification,
    readinessState,
    blockers,
    recommendation: recommendationBundle.recommendation,
    risk: recommendationBundle.risk,
    alternative: recommendationBundle.alternative,
    nextAction,
    nextSteps,
    assumptionsUsed,
    lastEvaluatedAt: input.now
  };
}

export function toFinancialReadinessSummary(
  record: FinancialReadiness
): FinancialReadinessSummary {
  return {
    maxAffordableHomePrice: record.maxAffordableHomePrice,
    estimatedMonthlyPayment: record.estimatedMonthlyPayment,
    estimatedDownPayment: record.estimatedDownPayment,
    estimatedClosingCosts: record.estimatedClosingCosts,
    totalCashRequiredToClose: record.totalCashRequiredToClose,
    debtToIncomeRatio: record.debtToIncomeRatio,
    housingRatio: record.housingRatio,
    affordabilityClassification: record.affordabilityClassification,
    readinessState: record.readinessState,
    blockers: record.blockers,
    recommendation: record.recommendation,
    risk: record.risk,
    alternative: record.alternative,
    nextAction: record.nextAction,
    nextSteps: record.nextSteps,
    assumptionsUsed: record.assumptionsUsed,
    lastEvaluatedAt: record.lastEvaluatedAt
  };
}
