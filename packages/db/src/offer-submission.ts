import type {
  FinancialReadiness,
  OfferPreparation,
  OfferSubmission,
  OfferSubmissionBlocker,
  OfferSubmissionCounterofferSummary,
  OfferSubmissionInputs,
  OfferSubmissionMissingItem,
  OfferSubmissionOriginalOfferSnapshot,
  OfferSubmissionState,
  OfferSubmissionSummary,
  OfferSubmissionUrgencyLevel
} from "@nhalo/types";

type OfferSubmissionEvaluationInput = {
  now: string;
  offerPreparation: OfferPreparation;
  financialReadiness?: FinancialReadiness | null;
  current?: OfferSubmission | null;
  patch?: Partial<OfferSubmissionInputs>;
  sessionId?: string | null;
  partnerId?: string | null;
};

const URGENCY_RULES = {
  highHours: 24,
  moderateHours: 72,
  staleSubmittedHours: 72
};

function hasValue(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return value !== null && value !== undefined;
}

function isTerminalState(state: OfferSubmissionState): boolean {
  return state === "ACCEPTED" || state === "REJECTED" || state === "EXPIRED" || state === "WITHDRAWN";
}

function hoursUntil(now: string, timestamp: string | null | undefined): number | null {
  if (!timestamp) {
    return null;
  }

  const current = new Date(now).getTime();
  const target = new Date(timestamp).getTime();
  if (!Number.isFinite(current) || !Number.isFinite(target)) {
    return null;
  }

  return (target - current) / (1000 * 60 * 60);
}

function hoursSince(earlier: string | null | undefined, now: string): number | null {
  if (!earlier) {
    return null;
  }

  const start = new Date(earlier).getTime();
  const end = new Date(now).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }

  return (end - start) / (1000 * 60 * 60);
}

function buildOriginalOfferSnapshot(
  current: OfferSubmission | null | undefined,
  offerPreparation: OfferPreparation
): OfferSubmissionOriginalOfferSnapshot {
  return (
    current?.originalOfferSnapshot ?? {
      offerPrice: offerPreparation.offerPrice,
      earnestMoneyAmount: offerPreparation.earnestMoneyAmount,
      downPaymentAmount: offerPreparation.downPaymentAmount,
      downPaymentPercent: offerPreparation.downPaymentPercent,
      financingContingency: offerPreparation.financingContingency,
      inspectionContingency: offerPreparation.inspectionContingency,
      appraisalContingency: offerPreparation.appraisalContingency,
      closingTimelineDays: offerPreparation.closingTimelineDays
    }
  );
}

function buildCounterofferSummary(
  inputs: OfferSubmissionInputs,
  originalOfferSnapshot: OfferSubmissionOriginalOfferSnapshot
): OfferSubmissionCounterofferSummary {
  const changedFields: string[] = [];
  const present =
    inputs.sellerResponseState === "COUNTERED" ||
    hasValue(inputs.counterofferPrice) ||
    hasValue(inputs.counterofferClosingTimelineDays) ||
    hasValue(inputs.counterofferFinancingContingency) ||
    hasValue(inputs.counterofferInspectionContingency) ||
    hasValue(inputs.counterofferAppraisalContingency) ||
    hasValue(inputs.counterofferExpirationAt);

  if (present && inputs.counterofferPrice !== null && inputs.counterofferPrice !== originalOfferSnapshot.offerPrice) {
    changedFields.push("price");
  }
  if (
    present &&
    inputs.counterofferClosingTimelineDays !== null &&
    inputs.counterofferClosingTimelineDays !== originalOfferSnapshot.closingTimelineDays
  ) {
    changedFields.push("closingTimelineDays");
  }
  if (
    present &&
    inputs.counterofferFinancingContingency !== null &&
    inputs.counterofferFinancingContingency !== originalOfferSnapshot.financingContingency
  ) {
    changedFields.push("financingContingency");
  }
  if (
    present &&
    inputs.counterofferInspectionContingency !== null &&
    inputs.counterofferInspectionContingency !== originalOfferSnapshot.inspectionContingency
  ) {
    changedFields.push("inspectionContingency");
  }
  if (
    present &&
    inputs.counterofferAppraisalContingency !== null &&
    inputs.counterofferAppraisalContingency !== originalOfferSnapshot.appraisalContingency
  ) {
    changedFields.push("appraisalContingency");
  }

  return {
    present,
    counterofferPrice: inputs.counterofferPrice ?? null,
    counterofferClosingTimelineDays: inputs.counterofferClosingTimelineDays ?? null,
    counterofferFinancingContingency: inputs.counterofferFinancingContingency ?? null,
    counterofferInspectionContingency: inputs.counterofferInspectionContingency ?? null,
    counterofferAppraisalContingency: inputs.counterofferAppraisalContingency ?? null,
    counterofferExpirationAt: inputs.counterofferExpirationAt ?? null,
    changedFields
  };
}

function buildMissingItems(
  inputs: OfferSubmissionInputs,
  offerPreparation: OfferPreparation,
  counterofferSummary: OfferSubmissionCounterofferSummary
): OfferSubmissionMissingItem[] {
  const missing: OfferSubmissionMissingItem[] = [];

  if (!offerPreparation.readinessToSubmit) {
    missing.push({
      field: "offerPreparationId",
      message: "Finish offer preparation before submitting the offer."
    });
  }

  if (inputs.sellerResponseState === "COUNTERED" && !counterofferSummary.present) {
    missing.push({
      field: "counteroffer",
      message: "Record the seller's changed terms before marking the offer as countered."
    });
  }

  if (
    inputs.sellerResponseState === "COUNTERED" &&
    counterofferSummary.present &&
    counterofferSummary.changedFields.length === 0
  ) {
    missing.push({
      field: "counteroffer",
      message: "At least one counteroffer term must differ from the original offer."
    });
  }

  if (inputs.sellerResponseState !== "NO_RESPONSE" && !inputs.submittedAt) {
    missing.push({
      field: "submittedAt",
      message: "Record when the offer was submitted before tracking a seller response."
    });
  }

  return missing;
}

function buildBlockers(args: {
  current: OfferSubmission | null | undefined;
  inputs: OfferSubmissionInputs;
  offerPreparation: OfferPreparation;
  financialReadiness?: FinancialReadiness | null;
  counterofferSummary: OfferSubmissionCounterofferSummary;
  isExpired: boolean;
}): OfferSubmissionBlocker[] {
  const blockers: OfferSubmissionBlocker[] = [];
  const currentState = args.current?.submissionState;

  if (!args.offerPreparation.readinessToSubmit) {
    blockers.push({
      code: "OFFER_PREPARATION_NOT_READY",
      severity: "blocking",
      message: "Offer preparation is not ready for submission.",
      whyItMatters: "The system only tracks submitted offers after the draft terms are complete.",
      howToFix: "Finish offer preparation and clear any upstream blockers first."
    });
  }

  if (
    args.financialReadiness &&
    args.financialReadiness.readinessState !== "READY" &&
    args.inputs.submittedAt
  ) {
    blockers.push({
      code: "OFFER_PREPARATION_NOT_READY",
      severity: "warning",
      message: "Financial readiness is no longer fully ready.",
      whyItMatters: "The buyer's current affordability status may no longer support the submitted offer.",
      howToFix: "Recheck financial readiness before making another decision."
    });
  }

  if (args.inputs.sellerResponseState !== "NO_RESPONSE" && !args.inputs.submittedAt) {
    blockers.push({
      code: "MISSING_SUBMISSION_TIMESTAMP",
      severity: "blocking",
      message: "A seller response cannot be tracked before the offer is submitted.",
      whyItMatters: "The timeline becomes unreliable if submission is not recorded first.",
      howToFix: "Record the offer submission timestamp before adding a seller response."
    });
  }

  if (args.inputs.sellerResponseState === "COUNTERED" && args.counterofferSummary.changedFields.length === 0) {
    blockers.push({
      code: "COUNTEROFFER_INCOMPLETE",
      severity: "blocking",
      message: "Counteroffer terms are incomplete.",
      whyItMatters: "The buyer needs the changed seller terms in order to review the counteroffer.",
      howToFix: "Add at least one changed counteroffer term."
    });
  }

  if (
    args.inputs.buyerCounterDecision &&
    args.inputs.buyerCounterDecision !== "pending" &&
    args.inputs.sellerResponseState !== "COUNTERED"
  ) {
    blockers.push({
      code: "INVALID_STATE_TRANSITION",
      severity: "blocking",
      message: "A counter decision is only valid after the seller has countered.",
      whyItMatters: "The workflow cannot skip directly to a buyer counter decision.",
      howToFix: "Record a seller counteroffer first."
    });
  }

  if (currentState && isTerminalState(currentState)) {
    const attemptedMutation =
      args.inputs.sellerResponseState !== args.current?.sellerResponseState ||
      args.inputs.buyerCounterDecision !== args.current?.buyerCounterDecision ||
      args.inputs.withdrawnAt !== args.current?.withdrawnAt;

    if (attemptedMutation) {
      blockers.push({
        code: "SUBMISSION_ALREADY_TERMINAL",
        severity: "blocking",
        message: "This submission is already in a terminal state.",
        whyItMatters: "Accepted, rejected, expired, and withdrawn submissions should not be reopened silently.",
        howToFix: "Create a new offer workflow if the buyer wants to act again."
      });
    }
  }

  if (
    args.inputs.sellerResponseState === "COUNTERED" &&
    args.inputs.counterofferExpirationAt &&
    args.isExpired &&
    args.inputs.buyerCounterDecision !== "accepted"
  ) {
    blockers.push({
      code: "COUNTEROFFER_EXPIRED",
      severity: "blocking",
      message: "The seller's counteroffer has expired.",
      whyItMatters: "The buyer can no longer rely on the counteroffer as an active option.",
      howToFix: "Revise the offer or create a new submission path."
    });
  }

  return blockers;
}

function deriveUrgencyLevel(args: {
  now: string;
  state: OfferSubmissionState;
  inputs: OfferSubmissionInputs;
  current?: OfferSubmission | null;
}): OfferSubmissionUrgencyLevel {
  if (isTerminalState(args.state)) {
    return "LOW_URGENCY";
  }

  const expirationHours =
    args.inputs.sellerResponseState === "COUNTERED"
      ? hoursUntil(args.now, args.inputs.counterofferExpirationAt)
      : hoursUntil(args.now, args.inputs.offerExpirationAt);

  if (expirationHours !== null && expirationHours <= URGENCY_RULES.highHours) {
    return "HIGH_URGENCY";
  }
  if (expirationHours !== null && expirationHours <= URGENCY_RULES.moderateHours) {
    return "MODERATE_URGENCY";
  }

  const submittedHours = hoursSince(args.current?.submittedAt ?? args.inputs.submittedAt, args.now);
  if (args.state === "SUBMITTED" && submittedHours !== null && submittedHours >= URGENCY_RULES.staleSubmittedHours) {
    return "MODERATE_URGENCY";
  }

  if (args.state === "COUNTERED") {
    return "MODERATE_URGENCY";
  }

  return "LOW_URGENCY";
}

function deriveSubmissionState(args: {
  inputs: OfferSubmissionInputs;
  offerPreparation: OfferPreparation;
  blockers: OfferSubmissionBlocker[];
  counterofferSummary: OfferSubmissionCounterofferSummary;
  isExpired: boolean;
}): OfferSubmissionState {
  if (args.inputs.withdrawnAt) {
    return "WITHDRAWN";
  }

  if (args.isExpired) {
    return "EXPIRED";
  }

  if (args.inputs.sellerResponseState === "ACCEPTED") {
    return "ACCEPTED";
  }

  if (
    args.inputs.sellerResponseState === "COUNTERED" ||
    args.inputs.buyerCounterDecision === "pending" ||
    args.counterofferSummary.present
  ) {
    if (args.inputs.buyerCounterDecision === "accepted") {
      return "ACCEPTED";
    }
    if (args.inputs.buyerCounterDecision === "rejected") {
      return "REJECTED";
    }
    return "COUNTERED";
  }

  if (args.inputs.sellerResponseState === "REJECTED") {
    return "REJECTED";
  }

  if (args.inputs.submittedAt) {
    return "SUBMITTED";
  }

  if (args.offerPreparation.readinessToSubmit && !args.blockers.some((entry) => entry.severity === "blocking")) {
    return "READY_TO_SUBMIT";
  }

  return "NOT_STARTED";
}

function buildDecisionSupport(args: {
  state: OfferSubmissionState;
  inputs: OfferSubmissionInputs;
  urgencyLevel: OfferSubmissionUrgencyLevel;
  counterofferSummary: OfferSubmissionCounterofferSummary;
  offerPreparation: OfferPreparation;
  financialReadiness?: FinancialReadiness | null;
}): Pick<OfferSubmissionSummary, "recommendation" | "risk" | "alternative" | "nextAction" | "nextSteps" | "requiresBuyerResponse"> {
  const nextSteps = new Set<string>();

  if (!args.offerPreparation.readinessToSubmit) {
    nextSteps.add("Complete offer preparation");
    return {
      recommendation: "The offer draft still needs upstream preparation work before submission can be tracked.",
      risk: "Submitting without a completed offer draft would create confusion about the terms actually being offered.",
      alternative: "Finish the draft terms first, then return to submission tracking.",
      nextAction: "Complete offer preparation",
      nextSteps: [...nextSteps],
      requiresBuyerResponse: false
    };
  }

  if (args.state === "READY_TO_SUBMIT") {
    nextSteps.add("Submit offer");
    return {
      recommendation: "The offer is ready to be recorded as submitted.",
      risk: "The workflow will not advance until the submission timestamp is captured.",
      alternative: "Review the prepared terms one more time before submitting if the buyer wants a final check.",
      nextAction: "Submit offer",
      nextSteps: [...nextSteps],
      requiresBuyerResponse: false
    };
  }

  if (args.state === "SUBMITTED") {
    nextSteps.add("Wait for seller response");
    if (args.inputs.offerExpirationAt) {
      nextSteps.add("Respond before expiration");
    }
    return {
      recommendation: "The offer has been submitted and is waiting on the seller.",
      risk:
        args.urgencyLevel === "HIGH_URGENCY"
          ? "The response window is tight and may expire soon."
          : "The buyer should monitor for a seller response and keep the timeline current.",
      alternative: "If the seller stalls past the buyer's comfort window, the buyer can revise or replace the offer later.",
      nextAction: args.urgencyLevel === "HIGH_URGENCY" ? "Respond before expiration" : "Wait for seller response",
      nextSteps: [...nextSteps],
      requiresBuyerResponse: false
    };
  }

  if (args.state === "COUNTERED") {
    nextSteps.add("Review counteroffer");
    if (
      args.counterofferSummary.counterofferPrice !== null &&
      args.offerPreparation.offerPrice !== null &&
      args.counterofferSummary.counterofferPrice <= args.offerPreparation.offerPrice * 1.03
    ) {
      nextSteps.add("Accept counteroffer");
    } else {
      nextSteps.add("Revise offer terms");
    }
    nextSteps.add("Reject counteroffer");
    if (args.counterofferSummary.counterofferExpirationAt) {
      nextSteps.add("Respond before expiration");
    }

    return {
      recommendation: "The seller responded with changed terms that need buyer review.",
      risk:
        args.urgencyLevel === "HIGH_URGENCY"
          ? "This counteroffer is time-sensitive."
          : "Changed price, timing, or contingencies could shift the buyer's risk profile.",
      alternative: "The buyer can reject the counter or revise the offer instead of accepting.",
      nextAction:
        args.counterofferSummary.counterofferPrice !== null &&
        args.offerPreparation.offerPrice !== null &&
        args.counterofferSummary.counterofferPrice <= args.offerPreparation.offerPrice * 1.03
          ? "Accept counteroffer"
          : "Review counteroffer",
      nextSteps: [...nextSteps],
      requiresBuyerResponse: true
    };
  }

  if (args.state === "ACCEPTED") {
    nextSteps.add("Move to under-contract workflow");
    return {
      recommendation: "The offer lifecycle is complete and the buyer can move into the under-contract stage.",
      risk: "The next phase now shifts to deadlines and coordination rather than submission risk.",
      alternative: "Keep the accepted terms visible for downstream contract work.",
      nextAction: "Move to under-contract workflow",
      nextSteps: [...nextSteps],
      requiresBuyerResponse: false
    };
  }

  if (args.state === "REJECTED") {
    nextSteps.add("Revise offer terms");
    return {
      recommendation: "This offer path is finished without acceptance.",
      risk: "The buyer will need a new or revised offer if they still want the property.",
      alternative: "Prepare a new offer draft or move on to another home.",
      nextAction: "Revise offer terms",
      nextSteps: [...nextSteps],
      requiresBuyerResponse: false
    };
  }

  if (args.state === "EXPIRED") {
    nextSteps.add("Revise offer terms");
    return {
      recommendation: "The submission is no longer active because its response window expired.",
      risk: "The buyer cannot rely on the expired terms remaining available.",
      alternative: "Prepare a refreshed offer if the property is still active.",
      nextAction: "Revise offer terms",
      nextSteps: [...nextSteps],
      requiresBuyerResponse: false
    };
  }

  if (args.state === "WITHDRAWN") {
    nextSteps.add("Revise offer terms");
    return {
      recommendation: "The buyer has withdrawn this offer path.",
      risk: "No further seller response should be expected on this submission.",
      alternative: "Prepare a new offer only if the buyer wants to re-engage.",
      nextAction: "Revise offer terms",
      nextSteps: [...nextSteps],
      requiresBuyerResponse: false
    };
  }

  nextSteps.add("Complete offer preparation");
  return {
    recommendation: "Start from the prepared offer before moving into submission tracking.",
    risk: "The submission workflow depends on a fully prepared offer.",
    alternative: "Return to the offer draft and complete any missing terms.",
    nextAction: "Complete offer preparation",
    nextSteps: [...nextSteps],
    requiresBuyerResponse: false
  };
}

function applyPatch(
  current: OfferSubmission | null | undefined,
  patch: Partial<OfferSubmissionInputs> | undefined,
  offerPreparation: OfferPreparation
): OfferSubmissionInputs {
  return {
    propertyId: patch?.propertyId ?? current?.propertyId ?? offerPreparation.propertyId,
    propertyAddressLabel:
      patch?.propertyAddressLabel ?? current?.propertyAddressLabel ?? offerPreparation.propertyAddressLabel,
    shortlistId: patch?.shortlistId ?? current?.shortlistId ?? offerPreparation.shortlistId ?? null,
    financialReadinessId:
      patch?.financialReadinessId ??
      current?.financialReadinessId ??
      offerPreparation.financialReadinessId ??
      null,
    offerPreparationId: patch?.offerPreparationId ?? current?.offerPreparationId ?? offerPreparation.id,
    submissionMethod: patch?.submissionMethod ?? current?.submissionMethod ?? null,
    submittedAt: patch?.submittedAt ?? current?.submittedAt ?? null,
    offerExpirationAt: patch?.offerExpirationAt ?? current?.offerExpirationAt ?? null,
    sellerResponseState:
      patch?.sellerResponseState ??
      current?.sellerResponseState ??
      "NO_RESPONSE",
    sellerRespondedAt: patch?.sellerRespondedAt ?? current?.sellerRespondedAt ?? null,
    buyerCounterDecision: patch?.buyerCounterDecision ?? current?.buyerCounterDecision ?? null,
    withdrawnAt: patch?.withdrawnAt ?? current?.withdrawnAt ?? null,
    withdrawalReason: patch?.withdrawalReason ?? current?.withdrawalReason ?? null,
    counterofferPrice: patch?.counterofferPrice ?? current?.counterofferPrice ?? null,
    counterofferClosingTimelineDays:
      patch?.counterofferClosingTimelineDays ?? current?.counterofferClosingTimelineDays ?? null,
    counterofferFinancingContingency:
      patch?.counterofferFinancingContingency ?? current?.counterofferFinancingContingency ?? null,
    counterofferInspectionContingency:
      patch?.counterofferInspectionContingency ?? current?.counterofferInspectionContingency ?? null,
    counterofferAppraisalContingency:
      patch?.counterofferAppraisalContingency ?? current?.counterofferAppraisalContingency ?? null,
    counterofferExpirationAt:
      patch?.counterofferExpirationAt ?? current?.counterofferExpirationAt ?? null,
    notes: patch?.notes ?? current?.notes ?? null,
    internalActivityNote: patch?.internalActivityNote ?? current?.internalActivityNote ?? null
  };
}

export function evaluateOfferSubmission(
  input: OfferSubmissionEvaluationInput
): Omit<OfferSubmission, "id" | "createdAt" | "updatedAt" | "activityLog"> & {
  originalOfferSnapshot: OfferSubmissionOriginalOfferSnapshot;
} {
  const inputs = applyPatch(input.current, input.patch, input.offerPreparation);
  const originalOfferSnapshot = buildOriginalOfferSnapshot(input.current, input.offerPreparation);
  const counterofferSummary = buildCounterofferSummary(inputs, originalOfferSnapshot);
  const isExpired =
    (inputs.sellerResponseState === "COUNTERED" &&
      inputs.buyerCounterDecision !== "accepted" &&
      hoursUntil(input.now, inputs.counterofferExpirationAt) !== null &&
      (hoursUntil(input.now, inputs.counterofferExpirationAt) ?? 1) <= 0) ||
    (inputs.sellerResponseState === "NO_RESPONSE" &&
      inputs.submittedAt !== null &&
      hoursUntil(input.now, inputs.offerExpirationAt) !== null &&
      (hoursUntil(input.now, inputs.offerExpirationAt) ?? 1) <= 0);
  const blockers = buildBlockers({
    current: input.current,
    inputs,
    offerPreparation: input.offerPreparation,
    financialReadiness: input.financialReadiness,
    counterofferSummary,
    isExpired
  });
  const state = deriveSubmissionState({
    inputs,
    offerPreparation: input.offerPreparation,
    blockers,
    counterofferSummary,
    isExpired
  });
  const urgencyLevel = deriveUrgencyLevel({
    now: input.now,
    state,
    inputs,
    current: input.current
  });
  const missingItems = buildMissingItems(inputs, input.offerPreparation, counterofferSummary);
  const decisionSupport = buildDecisionSupport({
    state,
    inputs,
    urgencyLevel,
    counterofferSummary,
    offerPreparation: input.offerPreparation,
    financialReadiness: input.financialReadiness
  });
  const lastActionAt =
    inputs.withdrawnAt ??
    inputs.sellerRespondedAt ??
    inputs.submittedAt ??
    input.current?.lastActionAt ??
    null;

  return {
    sessionId: input.current?.sessionId ?? input.sessionId ?? null,
    partnerId: input.current?.partnerId ?? input.partnerId ?? null,
    ...inputs,
    originalOfferSnapshot,
    submissionSummary: {
      propertyId: inputs.propertyId,
      propertyAddressLabel: inputs.propertyAddressLabel,
      offerPreparationId: inputs.offerPreparationId,
      submittedAt: inputs.submittedAt ?? null,
      offerExpirationAt: inputs.offerExpirationAt ?? null,
      currentOfferPrice:
        inputs.sellerResponseState === "COUNTERED" && inputs.counterofferPrice !== null
          ? inputs.counterofferPrice
          : originalOfferSnapshot.offerPrice,
      earnestMoneyAmount: originalOfferSnapshot.earnestMoneyAmount,
      closingTimelineDays:
        inputs.sellerResponseState === "COUNTERED" && inputs.counterofferClosingTimelineDays !== null
          ? inputs.counterofferClosingTimelineDays
          : originalOfferSnapshot.closingTimelineDays
    },
    submissionState: state,
    sellerResponseState: inputs.sellerResponseState ?? "NO_RESPONSE",
    urgencyLevel,
    counterofferSummary,
    missingItems,
    blockers,
    recommendation: decisionSupport.recommendation,
    risk: decisionSupport.risk,
    alternative: decisionSupport.alternative,
    nextAction: decisionSupport.nextAction,
    nextSteps: decisionSupport.nextSteps,
    requiresBuyerResponse: decisionSupport.requiresBuyerResponse,
    isExpired,
    lastActionAt,
    lastEvaluatedAt: input.now
  };
}

export function toOfferSubmissionSummary(record: OfferSubmission): OfferSubmissionSummary {
  return {
    submissionSummary: record.submissionSummary,
    submissionState: record.submissionState,
    sellerResponseState: record.sellerResponseState,
    urgencyLevel: record.urgencyLevel,
    counterofferSummary: record.counterofferSummary,
    missingItems: record.missingItems,
    blockers: record.blockers,
    recommendation: record.recommendation,
    risk: record.risk,
    alternative: record.alternative,
    nextAction: record.nextAction,
    nextSteps: record.nextSteps,
    requiresBuyerResponse: record.requiresBuyerResponse,
    isExpired: record.isExpired,
    lastActionAt: record.lastActionAt,
    lastEvaluatedAt: record.lastEvaluatedAt
  };
}
