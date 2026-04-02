import type {
  BuyerTransactionCommandCenterView,
  ClosingReadiness,
  DecisionExplanation,
  DecisionExplanationBundle,
  ExplanationCategory,
  ExplanationChangeImpactItem,
  ExplanationConditionReference,
  ExplanationInputAttribution,
  ExplanationModuleName,
  ExplanationReasonItem,
  FinancialReadiness,
  OfferPreparation,
  OfferSubmission,
  TransactionStage,
  UnderContractCoordination,
  WorkflowActivityRecord
} from "@nhalo/types";

interface ExplanationBase {
  subjectType: string;
  subjectId: string;
  moduleName: ExplanationModuleName;
  generatedAt: string;
  workflowActivityId?: string | null;
}

function createExplanation(
  base: ExplanationBase,
  category: ExplanationCategory,
  summary: string,
  decisionRuleLabel: string,
  contributingInputs: ExplanationInputAttribution[],
  conditionReferences: ExplanationConditionReference[],
  reasonItems: ExplanationReasonItem[],
  whatToChange: ExplanationChangeImpactItem[],
  stale = false
): DecisionExplanation {
  return {
    id: `${base.moduleName}:${base.subjectId}:${category}:${decisionRuleLabel}`,
    subjectType: base.subjectType,
    subjectId: base.subjectId,
    moduleName: base.moduleName,
    category,
    summary,
    decisionRuleLabel,
    contributingInputs,
    conditionReferences,
    reasonItems,
    whatToChange,
    workflowActivityId: base.workflowActivityId ?? null,
    generatedAt: base.generatedAt,
    stale
  };
}

function bundle(
  subjectType: string,
  subjectId: string,
  moduleName: ExplanationModuleName,
  generatedAt: string,
  explanations: DecisionExplanation[]
): DecisionExplanationBundle {
  return {
    subjectType,
    subjectId,
    moduleName,
    explanations,
    generatedAt
  };
}

function latestActivityId(
  activities: WorkflowActivityRecord[] | undefined,
  matcher: (entry: WorkflowActivityRecord) => boolean
): string | null {
  return (
    activities
      ?.filter(matcher)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]?.id ?? null
  );
}

function mapNextChanges(nextSteps: string[]): ExplanationChangeImpactItem[] {
  return nextSteps.map((step) => ({
    action: step,
    effect: "This moves the workflow toward the next eligible state."
  }));
}

export function buildFinancialReadinessExplanations(
  record: FinancialReadiness,
  activities?: WorkflowActivityRecord[]
): DecisionExplanationBundle {
  const generatedAt = new Date().toISOString();
  const base: ExplanationBase = {
    subjectType: "financial_readiness",
    subjectId: record.id,
    moduleName: "financial_readiness",
    generatedAt,
    workflowActivityId: latestActivityId(activities, (entry) => entry.eventType.startsWith("financial_"))
  };

  const explanations: DecisionExplanation[] = [
    createExplanation(
      base,
      "STATE_EXPLANATION",
      `Financial readiness is ${record.readinessState.replaceAll("_", " ").toLowerCase()} because the current affordability and verification inputs resolve to that state.`,
      "financial_readiness_state_resolution",
      [
        { key: "annualHouseholdIncome", label: "Annual household income", value: record.annualHouseholdIncome, sourceType: "raw_input" },
        { key: "monthlyDebtPayments", label: "Monthly debt payments", value: record.monthlyDebtPayments, sourceType: "raw_input" },
        { key: "availableCashSavings", label: "Available cash savings", value: record.availableCashSavings, sourceType: "raw_input" },
        { key: "preApprovalStatus", label: "Pre-approval status", value: record.preApprovalStatus, sourceType: "raw_input" }
      ],
      [
        { key: "readinessState", label: "Readiness state", value: record.readinessState },
        { key: "affordabilityClassification", label: "Affordability classification", value: record.affordabilityClassification }
      ],
      [
        {
          label: "Readiness depends on affordability and verification",
          detail: "The system checks affordability, cash required, and verification items such as pre-approval and proof of funds."
        },
        {
          label: "Current affordability result",
          detail: `The current affordability classification is ${record.affordabilityClassification.replaceAll("_", " ").toLowerCase()}.`
        }
      ],
      mapNextChanges(record.nextSteps)
    ),
    createExplanation(
      base,
      "RISK_EXPLANATION",
      record.risk,
      "financial_readiness_risk_resolution",
      [
        { key: "debtToIncomeRatio", label: "Debt-to-income ratio", value: record.debtToIncomeRatio, sourceType: "derived_value" },
        { key: "maxAffordableHomePrice", label: "Maximum affordable home price", value: record.maxAffordableHomePrice, sourceType: "derived_value" },
        { key: "desiredHomePrice", label: "Desired home price", value: record.desiredHomePrice, sourceType: "raw_input" }
      ],
      [
        { key: "dtiCap", label: "Debt-to-income guidance threshold", value: 0.43 },
        { key: "cashRequiredToClose", label: "Total cash required to close", value: record.totalCashRequiredToClose }
      ],
      [
        {
          label: "DTI and cash requirements drive the risk",
          detail: "The risk summary comes from the affordability calculation, DTI thresholds, and whether enough cash is available to close."
        }
      ],
      mapNextChanges(record.nextSteps)
    ),
    createExplanation(
      base,
      "RECOMMENDATION_EXPLANATION",
      record.recommendation,
      "financial_readiness_recommendation",
      [
        { key: "maxAffordableHomePrice", label: "Maximum affordable home price", value: record.maxAffordableHomePrice, sourceType: "derived_value" },
        { key: "totalCashRequiredToClose", label: "Cash required to close", value: record.totalCashRequiredToClose, sourceType: "derived_value" }
      ],
      [],
      [
        {
          label: "Recommendation follows the affordability result",
          detail: "The recommendation is generated from affordability classification, blockers, and whether verification conditions are complete."
        }
      ],
      mapNextChanges(record.nextSteps)
    ),
    createExplanation(
      base,
      "ALTERNATIVE_EXPLANATION",
      record.alternative,
      "financial_readiness_alternative",
      [
        { key: "desiredHomePrice", label: "Desired home price", value: record.desiredHomePrice, sourceType: "raw_input" },
        { key: "availableCashSavings", label: "Available cash savings", value: record.availableCashSavings, sourceType: "raw_input" }
      ],
      [],
      [
        {
          label: "Alternative path",
          detail: "The alternative reflects the simplest input changes that would move the buyer closer to a ready state."
        }
      ],
      mapNextChanges(record.nextSteps)
    ),
    createExplanation(
      base,
      "NEXT_ACTION_EXPLANATION",
      `The next action is ${record.nextAction.toLowerCase()} because it removes the most immediate unresolved requirement.`,
      "financial_readiness_next_action",
      [
        { key: "nextAction", label: "Next action", value: record.nextAction, sourceType: "derived_value" }
      ],
      [],
      [
        {
          label: "Priority rule",
          detail: "Financial readiness prioritizes missing required inputs and blocking verification items before anything else."
        }
      ],
      mapNextChanges(record.nextSteps)
    )
  ];

  for (const blocker of record.blockers) {
    explanations.push(
      createExplanation(
        base,
        "BLOCKER_EXPLANATION",
        blocker.message,
        `financial_readiness_blocker_${blocker.code.toLowerCase()}`,
        [
          { key: "blockerCode", label: "Blocker code", value: blocker.code, sourceType: "derived_value" },
          { key: "preApprovalStatus", label: "Pre-approval status", value: record.preApprovalStatus, sourceType: "raw_input" },
          { key: "proofOfFundsStatus", label: "Proof of funds status", value: record.proofOfFundsStatus, sourceType: "raw_input" }
        ],
        [],
        [
          { label: "Why it matters", detail: blocker.whyItMatters }
        ],
        [{ action: blocker.howToFix, effect: "This can remove the blocker and allow the readiness state to improve." }]
      )
    );
  }

  return bundle("financial_readiness", record.id, "financial_readiness", generatedAt, explanations);
}

export function buildOfferPreparationExplanations(
  record: OfferPreparation,
  activities?: WorkflowActivityRecord[]
): DecisionExplanationBundle {
  const generatedAt = new Date().toISOString();
  const base: ExplanationBase = {
    subjectType: "offer_preparation",
    subjectId: record.id,
    moduleName: "offer_preparation",
    generatedAt,
    workflowActivityId: latestActivityId(activities, (entry) => entry.offerPreparationId === record.id)
  };

  const explanations: DecisionExplanation[] = [
    createExplanation(
      base,
      "STATE_EXPLANATION",
      `Offer preparation is ${record.offerState.replaceAll("_", " ").toLowerCase()} because the current terms are ${record.offerCompletenessState} and the financial alignment is ${record.financialAlignment.financiallyAligned ? "acceptable" : "not acceptable"}.`,
      "offer_preparation_state_resolution",
      [
        { key: "offerPrice", label: "Offer price", value: record.offerPrice, sourceType: "raw_input" },
        { key: "earnestMoneyAmount", label: "Earnest money", value: record.earnestMoneyAmount, sourceType: "raw_input" },
        { key: "readinessToSubmit", label: "Ready to submit", value: record.readinessToSubmit, sourceType: "derived_value" }
      ],
      [
        { key: "maxAffordableHomePrice", label: "Maximum affordable home price", value: record.financialAlignment.maxAffordableHomePrice },
        { key: "recommendedOfferPrice", label: "Recommended offer price", value: record.financialAlignment.recommendedOfferPrice }
      ],
      [
        {
          label: "Completeness matters",
          detail: "Offer preparation checks that the core offer terms are present before the state can move to ready."
        },
        {
          label: "Financial alignment matters",
          detail: "The draft must stay aligned with financial readiness before it can be ready to submit."
        }
      ],
      mapNextChanges(record.nextSteps)
    ),
    createExplanation(
      base,
      "RISK_EXPLANATION",
      record.risk,
      "offer_preparation_risk_resolution",
      [
        { key: "offerRiskLevel", label: "Offer risk level", value: record.offerRiskLevel, sourceType: "derived_value" },
        { key: "financingContingency", label: "Financing contingency", value: record.financingContingency, sourceType: "raw_input" },
        { key: "inspectionContingency", label: "Inspection contingency", value: record.inspectionContingency, sourceType: "raw_input" },
        { key: "appraisalContingency", label: "Appraisal contingency", value: record.appraisalContingency, sourceType: "raw_input" }
      ],
      [],
      [
        {
          label: "Risk comes from price, cash, and contingencies",
          detail: "The offer risk indicator is driven by affordability alignment, earnest money, and whether protections are waived."
        }
      ],
      mapNextChanges(record.nextSteps)
    ),
    createExplanation(
      base,
      "RECOMMENDATION_EXPLANATION",
      record.recommendation,
      "offer_preparation_recommendation",
      [
        { key: "cashRequiredAtOffer", label: "Cash required at offer", value: record.cashRequiredAtOffer, sourceType: "derived_value" },
        { key: "financiallyAligned", label: "Financially aligned", value: record.financialAlignment.financiallyAligned, sourceType: "dependency_state" }
      ],
      [],
      [
        {
          label: "Recommendation follows the offer draft rules",
          detail: "The recommendation reflects completeness, affordability alignment, and risk checks on the current draft terms."
        }
      ],
      mapNextChanges(record.nextSteps)
    ),
    createExplanation(
      base,
      "ALTERNATIVE_EXPLANATION",
      record.alternative,
      "offer_preparation_alternative",
      [
        { key: "offerPrice", label: "Offer price", value: record.offerPrice, sourceType: "raw_input" },
        { key: "cashRequiredAtOffer", label: "Cash required at offer", value: record.cashRequiredAtOffer, sourceType: "derived_value" }
      ],
      [],
      [
        {
          label: "Alternative path",
          detail: "The alternative shows the safest adjustment the buyer could make if they do not want to follow the recommendation exactly."
        }
      ],
      mapNextChanges(record.nextSteps)
    ),
    createExplanation(
      base,
      "NEXT_ACTION_EXPLANATION",
      `The next action is ${record.nextAction.toLowerCase()} because it resolves the most important missing or risky part of the offer draft.`,
      "offer_preparation_next_action",
      [{ key: "nextAction", label: "Next action", value: record.nextAction, sourceType: "derived_value" }],
      [],
      [
        {
          label: "Priority rule",
          detail: "Offer preparation prioritizes missing required terms, affordability blockers, and risky contingency setups before submission."
        }
      ],
      mapNextChanges(record.nextSteps)
    )
  ];

  for (const blocker of record.blockers) {
    explanations.push(
      createExplanation(
        base,
        "BLOCKER_EXPLANATION",
        blocker.message,
        `offer_preparation_blocker_${blocker.code.toLowerCase()}`,
        [
          { key: "offerPrice", label: "Offer price", value: record.offerPrice, sourceType: "raw_input" },
          { key: "maxAffordableHomePrice", label: "Maximum affordable home price", value: record.financialAlignment.maxAffordableHomePrice, sourceType: "dependency_state" }
        ],
        [],
        [{ label: "Why it matters", detail: blocker.whyItMatters }],
        [{ action: blocker.howToFix, effect: "This can remove the blocker and move the draft closer to ready-to-submit." }]
      )
    );
  }

  return bundle("offer_preparation", record.id, "offer_preparation", generatedAt, explanations);
}

export function buildOfferSubmissionExplanations(
  record: OfferSubmission,
  activities?: WorkflowActivityRecord[]
): DecisionExplanationBundle {
  const generatedAt = new Date().toISOString();
  const base: ExplanationBase = {
    subjectType: "offer_submission",
    subjectId: record.id,
    moduleName: "offer_submission",
    generatedAt,
    workflowActivityId: latestActivityId(activities, (entry) => entry.offerSubmissionId === record.id)
  };

  const explanations: DecisionExplanation[] = [
    createExplanation(
      base,
      "STATE_EXPLANATION",
      `Offer submission is ${record.submissionState.replaceAll("_", " ").toLowerCase()} because the seller response is ${record.sellerResponseState.replaceAll("_", " ").toLowerCase()} and the submission timeline resolved to that state.`,
      "offer_submission_state_resolution",
      [
        { key: "submissionState", label: "Submission state", value: record.submissionState, sourceType: "derived_value" },
        { key: "sellerResponseState", label: "Seller response state", value: record.sellerResponseState, sourceType: "raw_input" },
        { key: "submittedAt", label: "Submitted at", value: record.submittedAt, sourceType: "deadline" }
      ],
      [
        { key: "offerExpirationAt", label: "Offer expiration", value: record.offerExpirationAt },
        { key: "counterofferExpirationAt", label: "Counteroffer expiration", value: record.counterofferSummary.counterofferExpirationAt }
      ],
      [
        {
          label: "Seller response drives the submission state",
          detail: "Accepted, rejected, and countered responses each move the submission into a different state."
        }
      ],
      mapNextChanges(record.nextSteps)
    ),
    createExplanation(
      base,
      "RISK_EXPLANATION",
      record.risk,
      "offer_submission_risk_resolution",
      [
        { key: "urgencyLevel", label: "Urgency level", value: record.urgencyLevel, sourceType: "derived_value" },
        { key: "requiresBuyerResponse", label: "Requires buyer response", value: record.requiresBuyerResponse, sourceType: "derived_value" }
      ],
      [],
      [
        {
          label: "Risk and urgency follow the response window",
          detail: "Submission urgency increases when response deadlines are near, the seller has countered, or the buyer still needs to respond."
        }
      ],
      mapNextChanges(record.nextSteps)
    ),
    createExplanation(
      base,
      "RECOMMENDATION_EXPLANATION",
      record.recommendation,
      "offer_submission_recommendation",
      [
        { key: "sellerResponseState", label: "Seller response", value: record.sellerResponseState, sourceType: "raw_input" },
        { key: "counterofferPrice", label: "Counteroffer price", value: record.counterofferSummary.counterofferPrice, sourceType: "raw_input" }
      ],
      [],
      [
        {
          label: "Recommendation follows the seller response",
          detail: "The system recommends the next submission step from the seller's response state and whether a buyer response is still pending."
        }
      ],
      mapNextChanges(record.nextSteps)
    ),
    createExplanation(
      base,
      "ALTERNATIVE_EXPLANATION",
      record.alternative,
      "offer_submission_alternative",
      [],
      [],
      [
        {
          label: "Alternative path",
          detail: "The alternative shows the buyer-side path that remains valid if they do not follow the recommendation."
        }
      ],
      mapNextChanges(record.nextSteps)
    ),
    createExplanation(
      base,
      "NEXT_ACTION_EXPLANATION",
      `The next action is ${record.nextAction.toLowerCase()} because that is the next required buyer-side decision in the current submission state.`,
      "offer_submission_next_action",
      [
        { key: "nextAction", label: "Next action", value: record.nextAction, sourceType: "derived_value" },
        { key: "submissionState", label: "Submission state", value: record.submissionState, sourceType: "derived_value" }
      ],
      [],
      [
        {
          label: "Priority rule",
          detail: "Offer submission prioritizes seller response handling, expiration windows, and explicit buyer decisions on counters."
        }
      ],
      mapNextChanges(record.nextSteps)
    )
  ];

  for (const blocker of record.blockers) {
    explanations.push(
      createExplanation(
        base,
        "BLOCKER_EXPLANATION",
        blocker.message,
        `offer_submission_blocker_${blocker.code.toLowerCase()}`,
        [
          { key: "sellerResponseState", label: "Seller response", value: record.sellerResponseState, sourceType: "raw_input" },
          { key: "offerExpirationAt", label: "Offer expiration", value: record.offerExpirationAt, sourceType: "deadline" }
        ],
        [],
        [{ label: "Why it matters", detail: blocker.whyItMatters }],
        [{ action: blocker.howToFix, effect: "This can remove the blocker and let the submission lifecycle continue." }]
      )
    );
  }

  return bundle("offer_submission", record.id, "offer_submission", generatedAt, explanations);
}

export function buildUnderContractExplanations(
  record: UnderContractCoordination,
  activities?: WorkflowActivityRecord[]
): DecisionExplanationBundle {
  const generatedAt = new Date().toISOString();
  const base: ExplanationBase = {
    subjectType: "under_contract",
    subjectId: record.id,
    moduleName: "under_contract",
    generatedAt,
    workflowActivityId: latestActivityId(activities, (entry) => entry.underContractId === record.id)
  };

  const nextDeadline = record.deadlineSummaries.find((entry) => entry.status === "DUE_SOON" || entry.status === "MISSED");
  const explanations: DecisionExplanation[] = [
    createExplanation(
      base,
      "STATE_EXPLANATION",
      `Under-contract coordination is ${record.overallCoordinationState.replaceAll("_", " ").toLowerCase()} because the required tasks, deadlines, and blockers currently resolve to that contract state.`,
      "under_contract_state_resolution",
      [
        { key: "overallCoordinationState", label: "Coordination state", value: record.overallCoordinationState, sourceType: "derived_value" },
        { key: "readyForClosing", label: "Ready for closing", value: record.readyForClosing, sourceType: "derived_value" }
      ],
      [
        { key: "targetClosingDate", label: "Target closing date", value: record.targetClosingDate },
        { key: "requiresImmediateAttention", label: "Requires immediate attention", value: record.requiresImmediateAttention }
      ],
      [
        {
          label: "Tasks and deadlines drive the state",
          detail: "The system evaluates required contract tasks, milestone completion, blockers, and deadline timing to determine the contract state."
        }
      ],
      mapNextChanges(record.nextSteps)
    ),
    createExplanation(
      base,
      "RISK_EXPLANATION",
      record.risk,
      "under_contract_risk_resolution",
      [
        { key: "overallRiskLevel", label: "Risk level", value: record.overallRiskLevel, sourceType: "derived_value" },
        { key: "urgencyLevel", label: "Urgency level", value: record.urgencyLevel, sourceType: "derived_value" }
      ],
      nextDeadline ? [{ key: "deadline", label: nextDeadline.label, value: nextDeadline.deadline }] : [],
      [
        {
          label: "Risk follows task and deadline pressure",
          detail: "The contract workflow becomes riskier when required tasks are incomplete near deadlines or when blockers appear in financing, title, or escrow."
        }
      ],
      mapNextChanges(record.nextSteps)
    ),
    createExplanation(
      base,
      "RECOMMENDATION_EXPLANATION",
      record.recommendation,
      "under_contract_recommendation",
      [],
      [],
      [
        {
          label: "Recommendation follows contract priorities",
          detail: "The recommendation reflects the most urgent open work in the contract workflow."
        }
      ],
      mapNextChanges(record.nextSteps)
    ),
    createExplanation(
      base,
      "ALTERNATIVE_EXPLANATION",
      record.alternative,
      "under_contract_alternative",
      [],
      [],
      [
        {
          label: "Alternative path",
          detail: "The alternative shows a safer or simpler path if the buyer cannot take the recommended step immediately."
        }
      ],
      mapNextChanges(record.nextSteps)
    ),
    createExplanation(
      base,
      "NEXT_ACTION_EXPLANATION",
      `The next action is ${record.nextAction.toLowerCase()} because it unlocks the most important remaining contract task.`,
      "under_contract_next_action",
      [{ key: "nextAction", label: "Next action", value: record.nextAction, sourceType: "derived_value" }],
      nextDeadline ? [{ key: "deadline", label: nextDeadline.label, value: nextDeadline.deadline }] : [],
      [
        {
          label: "Priority rule",
          detail: "Under-contract coordination prioritizes required task completion, missed deadlines, and blockers that could prevent closing readiness."
        }
      ],
      mapNextChanges(record.nextSteps)
    )
  ];

  for (const blocker of record.blockers) {
    explanations.push(
      createExplanation(
        base,
        "BLOCKER_EXPLANATION",
        blocker.message,
        `under_contract_blocker_${blocker.code.toLowerCase()}`,
        [
          { key: "overallCoordinationState", label: "Coordination state", value: record.overallCoordinationState, sourceType: "derived_value" }
        ],
        [],
        [{ label: "Why it matters", detail: blocker.whyItMatters }],
        [{ action: blocker.howToFix, effect: "This can remove the blocker and move the transaction back toward closing readiness." }]
      )
    );
  }

  return bundle("under_contract", record.id, "under_contract", generatedAt, explanations);
}

export function buildClosingReadinessExplanations(
  record: ClosingReadiness,
  activities?: WorkflowActivityRecord[]
): DecisionExplanationBundle {
  const generatedAt = new Date().toISOString();
  const base: ExplanationBase = {
    subjectType: "closing_readiness",
    subjectId: record.id,
    moduleName: "closing_readiness",
    generatedAt,
    workflowActivityId: latestActivityId(activities, (entry) => entry.closingReadinessId === record.id)
  };

  const explanations: DecisionExplanation[] = [
    createExplanation(
      base,
      "STATE_EXPLANATION",
      `Closing readiness is ${record.overallClosingReadinessState.replaceAll("_", " ").toLowerCase()} because the final checklist, appointment data, and settlement readiness resolve to that state.`,
      "closing_readiness_state_resolution",
      [
        { key: "readyToClose", label: "Ready to close", value: record.readyToClose, sourceType: "derived_value" },
        { key: "closed", label: "Closed", value: record.closed, sourceType: "derived_value" },
        { key: "closingAppointmentAt", label: "Closing appointment", value: record.closingAppointmentAt, sourceType: "deadline" }
      ],
      [
        { key: "targetClosingDate", label: "Target closing date", value: record.targetClosingDate },
        { key: "finalFundsAmountConfirmed", label: "Final funds amount confirmed", value: record.finalFundsAmountConfirmed }
      ],
      [
        {
          label: "Final checklist completion drives the state",
          detail: "The closing state depends on final funds, reviewed numbers, appointment readiness, document readiness, and title or settlement readiness."
        }
      ],
      mapNextChanges(record.nextSteps)
    ),
    createExplanation(
      base,
      "RISK_EXPLANATION",
      record.risk,
      "closing_readiness_risk_resolution",
      [
        { key: "overallRiskLevel", label: "Risk level", value: record.overallRiskLevel, sourceType: "derived_value" },
        { key: "urgencyLevel", label: "Urgency level", value: record.urgencyLevel, sourceType: "derived_value" }
      ],
      [
        { key: "targetClosingDate", label: "Target closing date", value: record.targetClosingDate },
        { key: "closingAppointmentAt", label: "Closing appointment", value: record.closingAppointmentAt }
      ],
      [
        {
          label: "Risk follows closing timing and checklist completion",
          detail: "The closing workflow becomes riskier when funds, documents, or appointment details remain incomplete near the target close date."
        }
      ],
      mapNextChanges(record.nextSteps)
    ),
    createExplanation(
      base,
      "RECOMMENDATION_EXPLANATION",
      record.recommendation,
      "closing_readiness_recommendation",
      [],
      [],
      [
        {
          label: "Recommendation follows the final checklist",
          detail: "The recommendation prioritizes the final missing closing items that most directly affect readiness to close."
        }
      ],
      mapNextChanges(record.nextSteps)
    ),
    createExplanation(
      base,
      "ALTERNATIVE_EXPLANATION",
      record.alternative,
      "closing_readiness_alternative",
      [],
      [],
      [
        {
          label: "Alternative path",
          detail: "The alternative reflects the fallback path that remains acceptable if the buyer cannot complete the recommended step immediately."
        }
      ],
      mapNextChanges(record.nextSteps)
    ),
    createExplanation(
      base,
      "NEXT_ACTION_EXPLANATION",
      `The next action is ${record.nextAction.toLowerCase()} because it is the most direct step toward becoming ready to close.`,
      "closing_readiness_next_action",
      [{ key: "nextAction", label: "Next action", value: record.nextAction, sourceType: "derived_value" }],
      [],
      [
        {
          label: "Priority rule",
          detail: "Closing readiness prioritizes unresolved required checklist items and near-term closing dates before optional items."
        }
      ],
      mapNextChanges(record.nextSteps)
    )
  ];

  for (const blocker of record.blockers) {
    explanations.push(
      createExplanation(
        base,
        "BLOCKER_EXPLANATION",
        blocker.message,
        `closing_readiness_blocker_${blocker.code.toLowerCase()}`,
        [
          { key: "closingAppointmentAt", label: "Closing appointment", value: record.closingAppointmentAt, sourceType: "deadline" },
          { key: "finalFundsAmountConfirmed", label: "Final funds amount confirmed", value: record.finalFundsAmountConfirmed, sourceType: "raw_input" }
        ],
        [],
        [{ label: "Why it matters", detail: blocker.whyItMatters }],
        [{ action: blocker.howToFix, effect: "This can remove the blocker and allow the closing state to improve." }]
      )
    );
  }

  return bundle("closing_readiness", record.id, "closing_readiness", generatedAt, explanations);
}

function stageReadyReason(stage: TransactionStage, summary: BuyerTransactionCommandCenterView): string {
  const stageSummary = summary.stageSummaries.find((entry) => entry.stage === stage);
  if (!stageSummary) {
    return `${stage.replaceAll("_", " ").toLowerCase()} has not started yet.`;
  }
  return `${stageSummary.label} is ${stageSummary.status.replaceAll("_", " ").toLowerCase()}${stageSummary.completed ? " and complete" : ""}.`;
}

export function buildTransactionCommandCenterExplanations(
  summary: BuyerTransactionCommandCenterView
): DecisionExplanationBundle {
  const generatedAt = new Date().toISOString();
  const base: ExplanationBase = {
    subjectType: "transaction_command_center",
    subjectId: summary.propertyId,
    moduleName: "transaction_command_center",
    generatedAt
  };

  const activeStageSummary = summary.stageSummaries.find((entry) => entry.stage === summary.currentStage);
  const explanations: DecisionExplanation[] = [
    createExplanation(
      base,
      "STAGE_RESOLUTION_EXPLANATION",
      `The current stage is ${summary.currentStage.replaceAll("_", " ").toLowerCase()} because the earlier required stages are complete enough and later stages are not yet active or finished.`,
      "transaction_command_center_stage_resolution",
      [
        { key: "currentStage", label: "Current stage", value: summary.currentStage, sourceType: "derived_value" },
        { key: "overallState", label: "Overall state", value: summary.overallState, sourceType: "derived_value" }
      ],
      [],
      [
        { label: "Financial readiness", detail: stageReadyReason("FINANCIAL_READINESS", summary) },
        { label: "Offer preparation", detail: stageReadyReason("OFFER_PREPARATION", summary) },
        { label: "Offer submission", detail: stageReadyReason("OFFER_SUBMISSION", summary) },
        { label: "Under contract", detail: stageReadyReason("UNDER_CONTRACT", summary) },
        { label: "Closing readiness", detail: stageReadyReason("CLOSING_READINESS", summary) }
      ],
      summary.nextSteps.map((step) => ({
        action: step,
        effect: "This moves the transaction into the next valid stage."
      }))
    ),
    createExplanation(
      base,
      "STATE_EXPLANATION",
      `The overall transaction status is ${summary.overallState.replaceAll("_", " ").toLowerCase()} because the active stage currently resolves to ${activeStageSummary?.status.replaceAll("_", " ").toLowerCase() ?? "unknown"}.`,
      "transaction_command_center_overall_state",
      [
        { key: "currentStage", label: "Current stage", value: summary.currentStage, sourceType: "derived_value" },
        { key: "overallRiskLevel", label: "Overall risk level", value: summary.overallRiskLevel, sourceType: "derived_value" },
        { key: "progressPercent", label: "Progress percent", value: summary.progressPercent, sourceType: "derived_value" }
      ],
      [],
      [
        {
          label: "Overall state follows the active stage",
          detail: "The command center uses the active stage status, blockers, risk, and readiness-to-advance rules to determine the overall transaction status."
        }
      ],
      mapNextChanges(summary.nextSteps)
    ),
    createExplanation(
      base,
      "NEXT_ACTION_EXPLANATION",
      `The next action is ${summary.nextAction.toLowerCase()} because it unlocks the most progress from the current stage.`,
      "transaction_command_center_next_action",
      [{ key: "nextAction", label: "Next action", value: summary.nextAction, sourceType: "derived_value" }],
      [],
      [
        {
          label: "Priority rule",
          detail: "The command center prioritizes the next unresolved required action in the active stage before suggesting downstream work."
        }
      ],
      summary.nextSteps.map((step) => ({
        action: step,
        effect: "This moves the transaction toward the next valid stage."
      }))
    )
  ];

  if (summary.primaryRisk) {
    explanations.push(
      createExplanation(
        base,
        "RISK_EXPLANATION",
        summary.primaryRisk.message,
        "transaction_command_center_primary_risk",
        [
          { key: "primaryRisk", label: "Primary risk", value: summary.primaryRisk.code, sourceType: "derived_value" }
        ],
        summary.primaryRisk.dueAt
          ? [{ key: "dueAt", label: "Risk due date", value: summary.primaryRisk.dueAt }]
          : [],
        [
          {
            label: "Risk aggregation rule",
            detail: "The command center surfaces the most urgent active-stage risk before downstream warnings."
          }
        ],
        mapNextChanges(summary.nextSteps)
      )
    );
  }

  for (const blocker of summary.activeBlockers) {
    explanations.push(
      createExplanation(
        base,
        "BLOCKER_EXPLANATION",
        blocker.message,
        `transaction_command_center_blocker_${blocker.code.toLowerCase()}`,
        [
          { key: "sourceStage", label: "Source stage", value: blocker.sourceStage, sourceType: "dependency_state" }
        ],
        [],
        [{ label: "Why it matters", detail: blocker.whyItMatters }],
        [{ action: blocker.howToFix, effect: "This can remove the blocker and change the overall transaction status." }]
      )
    );
  }

  return bundle("transaction_command_center", summary.propertyId, "transaction_command_center", generatedAt, explanations);
}
