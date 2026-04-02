import type {
  ClosingBlocker,
  ClosingChecklistItemRecord,
  ClosingChecklistItemState,
  ClosingChecklistItemType,
  ClosingMilestoneRecord,
  ClosingMilestoneType,
  ClosingReadiness,
  ClosingReadinessActivityEntry,
  ClosingReadinessInputs,
  ClosingReadinessState,
  ClosingReadinessSummary,
  ClosingRiskLevel,
  FinancialReadiness,
  OfferPreparation,
  OfferSubmission,
  UnderContractCoordination
} from "@nhalo/types";

type ClosingReadinessEvaluationInput = {
  now: string;
  underContract: UnderContractCoordination;
  financialReadiness?: FinancialReadiness | null;
  offerPreparation?: OfferPreparation | null;
  offerSubmission?: OfferSubmission | null;
  current?: ClosingReadiness | null;
  patch?: Partial<ClosingReadinessInputs>;
  sessionId?: string | null;
  partnerId?: string | null;
};

const DEADLINE_RULES = {
  highHours: 24,
  moderateHours: 72
} as const;

const CHECKLIST_LABELS: Record<ClosingChecklistItemType, string> = {
  CASH_TO_CLOSE_CONFIRMED: "Cash to close confirmed",
  FINAL_FUNDS_AVAILABLE: "Final funds available",
  CLOSING_NUMBERS_REVIEWED: "Closing numbers reviewed",
  REQUIRED_CLOSING_DOCUMENTS_READY: "Required closing documents ready",
  TITLE_SETTLEMENT_READY: "Title and settlement ready",
  CLOSING_APPOINTMENT_SCHEDULED: "Closing appointment scheduled",
  IDENTITY_SIGNER_READY: "Identity and signer readiness",
  FINAL_WALKTHROUGH_COMPLETE: "Final walkthrough complete"
};

const MILESTONE_LABELS: Record<ClosingMilestoneType, string> = {
  READY_FOR_CLOSING_RECEIVED: "Ready for closing received",
  FINAL_FUNDS_CONFIRMED: "Final funds confirmed",
  FINAL_CHECKLIST_SUBSTANTIALLY_COMPLETE: "Final checklist substantially complete",
  CLOSING_APPOINTMENT_SCHEDULED: "Closing appointment scheduled",
  READY_TO_CLOSE: "Ready to close",
  CLOSED: "Closed"
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

function isSatisfied(status: ClosingChecklistItemState): boolean {
  return status === "READY" || status === "COMPLETED" || status === "WAIVED";
}

function hasMeaningfulProgress(status: ClosingChecklistItemState): boolean {
  return status !== "NOT_STARTED";
}

function buildChecklistItems(
  inputs: ClosingReadinessInputs,
  current?: ClosingReadiness | null
): ClosingChecklistItemRecord[] {
  const existing = new Map((current?.checklistItemSummaries ?? []).map((item) => [item.itemType, item]));
  const targetDeadline = inputs.targetClosingDate;
  const definitions: Array<{
    itemType: ClosingChecklistItemType;
    required: boolean;
    waivable: boolean;
    deadline: string | null;
  }> = [
    {
      itemType: "CASH_TO_CLOSE_CONFIRMED",
      required: true,
      waivable: false,
      deadline: inputs.finalFundsConfirmationDeadline ?? targetDeadline
    },
    {
      itemType: "FINAL_FUNDS_AVAILABLE",
      required: true,
      waivable: false,
      deadline: inputs.finalFundsConfirmationDeadline ?? targetDeadline
    },
    {
      itemType: "CLOSING_NUMBERS_REVIEWED",
      required: true,
      waivable: false,
      deadline: inputs.finalReviewDeadline ?? targetDeadline
    },
    {
      itemType: "REQUIRED_CLOSING_DOCUMENTS_READY",
      required: true,
      waivable: false,
      deadline: targetDeadline
    },
    {
      itemType: "TITLE_SETTLEMENT_READY",
      required: true,
      waivable: false,
      deadline: targetDeadline
    },
    {
      itemType: "CLOSING_APPOINTMENT_SCHEDULED",
      required: true,
      waivable: false,
      deadline: targetDeadline
    },
    {
      itemType: "IDENTITY_SIGNER_READY",
      required: true,
      waivable: false,
      deadline: targetDeadline
    },
    {
      itemType: "FINAL_WALKTHROUGH_COMPLETE",
      required: false,
      waivable: true,
      deadline: targetDeadline
    }
  ];

  return definitions.map((definition) => {
    const previous = existing.get(definition.itemType);
    return {
      itemType: definition.itemType,
      label: CHECKLIST_LABELS[definition.itemType],
      status: previous?.status ?? "NOT_STARTED",
      required: definition.required,
      waivable: definition.waivable,
      deadline: previous?.deadline ?? definition.deadline,
      completedAt: previous?.completedAt ?? null,
      blockedReason: previous?.blockedReason ?? null,
      notes: previous?.notes ?? null
    };
  });
}

function buildMissingItems(
  inputs: ClosingReadinessInputs,
  checklistItems: ClosingChecklistItemRecord[]
): ClosingReadiness["missingItems"] {
  const missing: ClosingReadiness["missingItems"] = [];
  if (!inputs.targetClosingDate) {
    missing.push({ field: "targetClosingDate", message: "Add the target closing date." });
  }
  if (!inputs.closingAppointmentAt) {
    missing.push({
      field: "closingAppointmentAt",
      message: "Schedule the closing appointment."
    });
  }
  if (
    checklistItems.some(
      (item) => item.itemType === "CASH_TO_CLOSE_CONFIRMED" && item.required
    ) &&
    inputs.finalFundsAmountConfirmed == null
  ) {
    missing.push({
      field: "finalFundsAmountConfirmed",
      message: "Confirm the final funds amount."
    });
  }
  return missing;
}

function buildBlockers(args: {
  underContract: UnderContractCoordination;
  inputs: ClosingReadinessInputs;
  checklistItems: ClosingChecklistItemRecord[];
  missingItems: ClosingReadiness["missingItems"];
  now: string;
}): ClosingBlocker[] {
  const blockers: ClosingBlocker[] = [];
  const itemLookup = new Map(args.checklistItems.map((item) => [item.itemType, item]));

  if (args.underContract.overallCoordinationState !== "READY_FOR_CLOSING") {
    blockers.push({
      code: "UNDER_CONTRACT_NOT_READY",
      severity: "blocking",
      message: "Under-contract coordination is not ready for closing.",
      whyItMatters: "Closing readiness can only start after the accepted-offer workflow is complete.",
      howToFix: "Resolve the remaining contract tasks first."
    });
  }

  if (args.missingItems.some((item) => item.field === "targetClosingDate")) {
    blockers.push({
      code: "MISSING_REQUIRED_DATE",
      severity: "blocking",
      message: "A required closing date is missing.",
      whyItMatters: "The buyer cannot finish close preparation without a target date.",
      howToFix: "Add the target closing date."
    });
  }

  if (itemLookup.get("FINAL_FUNDS_AVAILABLE")?.status === "BLOCKED") {
    blockers.push({
      code: "FINAL_FUNDS_NOT_READY",
      severity: "blocking",
      message: "Final funds are blocked.",
      whyItMatters: "The buyer cannot close until funds are available.",
      howToFix: "Resolve the funds issue and confirm availability."
    });
  }

  if (itemLookup.get("CLOSING_NUMBERS_REVIEWED")?.status === "BLOCKED") {
    blockers.push({
      code: "CLOSING_NUMBERS_NOT_REVIEWED",
      severity: "blocking",
      message: "Final closing numbers are not ready to review.",
      whyItMatters: "The buyer should review the final numbers before closing.",
      howToFix: "Review and confirm the final closing numbers."
    });
  }

  if (itemLookup.get("REQUIRED_CLOSING_DOCUMENTS_READY")?.status === "BLOCKED") {
    blockers.push({
      code: "DOCUMENTS_NOT_READY",
      severity: "blocking",
      message: "Required closing documents are blocked.",
      whyItMatters: "Closing cannot be finalized without the required documents.",
      howToFix: "Prepare the missing documents before closing."
    });
  }

  if (itemLookup.get("TITLE_SETTLEMENT_READY")?.status === "BLOCKED") {
    blockers.push({
      code: "TITLE_SETTLEMENT_BLOCKED",
      severity: "blocking",
      message: "Title or settlement readiness is blocked.",
      whyItMatters: "Settlement issues can stop closing entirely.",
      howToFix: "Resolve the settlement blocker before proceeding."
    });
  }

  if (itemLookup.get("IDENTITY_SIGNER_READY")?.status === "BLOCKED") {
    blockers.push({
      code: "IDENTITY_NOT_READY",
      severity: "blocking",
      message: "Signer identity readiness is blocked.",
      whyItMatters: "Closing requires the buyer to be ready with identification and signer details.",
      howToFix: "Prepare the required identification and signer information."
    });
  }

  if (args.checklistItems.some((item) => item.required && item.status === "FAILED")) {
    blockers.push({
      code: "REQUIRED_CHECKLIST_ITEM_FAILED",
      severity: "blocking",
      message: "A required closing item has failed.",
      whyItMatters: "A failed close-preparation item must be resolved before closing can proceed.",
      howToFix: "Resolve the failed item or update the close plan."
    });
  }

  const closingHours = hoursUntil(args.now, args.inputs.targetClosingDate);
  if (closingHours !== null && closingHours < 0) {
    blockers.push({
      code: "TARGET_CLOSING_DATE_MISSED",
      severity: "blocking",
      message: "The target closing date has passed.",
      whyItMatters: "The current close plan is no longer valid.",
      howToFix: "Review the remaining items and reset the closing plan."
    });
  }

  return blockers;
}

function determineRiskLevel(args: {
  inputs: ClosingReadinessInputs;
  checklistItems: ClosingChecklistItemRecord[];
  blockers: ClosingBlocker[];
  now: string;
}): ClosingRiskLevel {
  if (args.blockers.length > 0) {
    return "HIGH_RISK";
  }

  const targetHours = hoursUntil(args.now, args.inputs.targetClosingDate);
  const appointmentHours = hoursUntil(args.now, args.inputs.closingAppointmentAt);
  const incompleteRequired = args.checklistItems.filter(
    (item) => item.required && !isSatisfied(item.status)
  );

  if (
    (targetHours !== null && targetHours <= DEADLINE_RULES.highHours && incompleteRequired.length > 0) ||
    (appointmentHours !== null && appointmentHours <= DEADLINE_RULES.highHours && incompleteRequired.length > 0)
  ) {
    return "HIGH_RISK";
  }

  if (
    incompleteRequired.length > 1 ||
    (targetHours !== null && targetHours <= DEADLINE_RULES.moderateHours && incompleteRequired.length > 0) ||
    !args.inputs.closingAppointmentAt
  ) {
    return "MODERATE_RISK";
  }

  return "LOW_RISK";
}

function determineState(args: {
  checklistItems: ClosingChecklistItemRecord[];
  blockers: ClosingBlocker[];
  riskLevel: ClosingRiskLevel;
  closedAt: string | null;
}): ClosingReadinessState {
  if (args.closedAt) {
    return "CLOSED";
  }
  if (args.blockers.length > 0) {
    return "BLOCKED";
  }
  const requiredItems = args.checklistItems.filter((item) => item.required);
  const allSatisfied = requiredItems.every((item) => isSatisfied(item.status));
  if (allSatisfied) {
    return "READY_TO_CLOSE";
  }
  if (args.checklistItems.some((item) => hasMeaningfulProgress(item.status))) {
    return args.riskLevel === "LOW_RISK" ? "IN_PROGRESS" : "AT_RISK";
  }
  return "NOT_STARTED";
}

function buildMilestones(
  current: ClosingReadiness | null | undefined,
  underContract: UnderContractCoordination,
  checklistItems: ClosingChecklistItemRecord[],
  appointmentAt: string | null,
  state: ClosingReadinessState,
  closedAt: string | null
): ClosingMilestoneRecord[] {
  const existing = new Map(
    (current?.milestoneSummaries ?? []).map((milestone) => [milestone.milestoneType, milestone])
  );
  const itemLookup = new Map(checklistItems.map((item) => [item.itemType, item]));

  return (Object.keys(MILESTONE_LABELS) as ClosingMilestoneType[]).map((milestoneType) => {
    const previous = existing.get(milestoneType);
    let status: ClosingMilestoneRecord["status"] = previous?.status ?? "PENDING";
    let occurredAt = previous?.occurredAt ?? null;

    switch (milestoneType) {
      case "READY_FOR_CLOSING_RECEIVED":
        status = underContract.readyForClosing ? "REACHED" : "BLOCKED";
        occurredAt = underContract.readyForClosing ? underContract.lastEvaluatedAt : occurredAt;
        break;
      case "FINAL_FUNDS_CONFIRMED":
        if (
          isSatisfied(itemLookup.get("CASH_TO_CLOSE_CONFIRMED")?.status ?? "NOT_STARTED") &&
          isSatisfied(itemLookup.get("FINAL_FUNDS_AVAILABLE")?.status ?? "NOT_STARTED")
        ) {
          status = "REACHED";
          occurredAt =
            itemLookup.get("FINAL_FUNDS_AVAILABLE")?.completedAt ??
            itemLookup.get("CASH_TO_CLOSE_CONFIRMED")?.completedAt ??
            occurredAt;
        }
        break;
      case "FINAL_CHECKLIST_SUBSTANTIALLY_COMPLETE":
        if (
          checklistItems.filter((item) => item.required).every((item) => isSatisfied(item.status))
        ) {
          status = "REACHED";
          occurredAt =
            checklistItems
              .map((item) => item.completedAt)
              .filter((value): value is string => Boolean(value))
              .sort()
              .at(-1) ?? occurredAt;
        }
        break;
      case "CLOSING_APPOINTMENT_SCHEDULED":
        if (appointmentAt && isSatisfied(itemLookup.get("CLOSING_APPOINTMENT_SCHEDULED")?.status ?? "NOT_STARTED")) {
          status = "REACHED";
          occurredAt = appointmentAt;
        }
        break;
      case "READY_TO_CLOSE":
        if (state === "READY_TO_CLOSE" || state === "CLOSED") {
          status = "REACHED";
          occurredAt = previous?.occurredAt ?? new Date().toISOString();
        }
        break;
      case "CLOSED":
        if (closedAt) {
          status = "REACHED";
          occurredAt = closedAt;
        }
        break;
    }

    return {
      milestoneType,
      label: MILESTONE_LABELS[milestoneType],
      status,
      occurredAt,
      notes: previous?.notes ?? null
    };
  });
}

function buildRecommendationBundle(args: {
  state: ClosingReadinessState;
  riskLevel: ClosingRiskLevel;
  checklistItems: ClosingChecklistItemRecord[];
  blockers: ClosingBlocker[];
  inputs: ClosingReadinessInputs;
}): {
  recommendation: string;
  risk: string;
  alternative: string;
  nextAction: string;
  nextSteps: string[];
  requiresImmediateAttention: boolean;
} {
  const lookup = new Map(args.checklistItems.map((item) => [item.itemType, item]));
  let nextAction = "Complete remaining closing checklist items";
  let nextSteps = ["Complete remaining closing checklist items"];
  let recommendation =
    "Finish the remaining close-preparation items so the buyer can move into a ready-to-close state.";
  let risk =
    "Required closing items are still incomplete.";
  let alternative =
    "If a blocker appears, resolve it before assuming the buyer is ready to close.";

  if (args.state === "BLOCKED" && args.blockers.length > 0) {
    const blocker = args.blockers[0];
    nextAction = blocker.code === "UNDER_CONTRACT_NOT_READY" ? "Resolve remaining contract tasks" : blocker.code === "TITLE_SETTLEMENT_BLOCKED" ? "Resolve settlement blocker" : blocker.code === "FINAL_FUNDS_NOT_READY" ? "Confirm final funds" : blocker.code === "APPOINTMENT_NOT_SCHEDULED" ? "Schedule closing appointment" : "Complete remaining closing checklist items";
    nextSteps = [nextAction, "Review the remaining closing blockers"];
    recommendation = blocker.message;
    risk = blocker.whyItMatters;
    alternative = blocker.howToFix;
  } else if (!isSatisfied(lookup.get("CASH_TO_CLOSE_CONFIRMED")?.status ?? "NOT_STARTED")) {
    nextAction = "Confirm final funds";
    nextSteps = ["Confirm final funds", "Review final closing numbers"];
    recommendation = "The buyer should confirm the cash-to-close amount before moving forward.";
    risk = "Closing can stall if the final funds are not confirmed in time.";
    alternative = "If the numbers already match expectations, update the closing checklist now.";
  } else if (!isSatisfied(lookup.get("CLOSING_NUMBERS_REVIEWED")?.status ?? "NOT_STARTED")) {
    nextAction = "Review final closing numbers";
    nextSteps = ["Review final closing numbers", "Confirm final funds"];
    recommendation = "The buyer should review the final closing numbers before close day.";
    risk = "Unreviewed final numbers increase the chance of a last-minute surprise.";
    alternative = "If the numbers are already known, mark them reviewed to unlock the next step.";
  } else if (!args.inputs.closingAppointmentAt || !isSatisfied(lookup.get("CLOSING_APPOINTMENT_SCHEDULED")?.status ?? "NOT_STARTED")) {
    nextAction = "Schedule closing appointment";
    nextSteps = ["Schedule closing appointment", "Prepare required identification/documents"];
    recommendation = "The closing appointment still needs to be confirmed.";
    risk = "Closing readiness is incomplete until the appointment is scheduled.";
    alternative = "If the appointment already exists, add it so the checklist stays accurate.";
  } else if (!isSatisfied(lookup.get("TITLE_SETTLEMENT_READY")?.status ?? "NOT_STARTED")) {
    nextAction = "Resolve settlement blocker";
    nextSteps = ["Resolve settlement blocker", "Complete remaining closing checklist items"];
    recommendation = "Title and settlement readiness should be confirmed before close day.";
    risk = "Settlement gaps can stop closing even if the other items look complete.";
    alternative = "If settlement is already ready, update the checklist now.";
  } else if (
    args.checklistItems
      .filter((item) => item.required)
      .every((item) => isSatisfied(item.status))
  ) {
    if (args.state === "CLOSED") {
      nextAction = "Closing complete";
      nextSteps = ["Closing complete"];
      recommendation = "The closing workflow has been completed and recorded.";
      risk = "No active closing-readiness blocker remains in this workflow.";
      alternative = "No additional workflow is required in MVP after close completion.";
    } else {
      nextAction = "Proceed to close";
      nextSteps = ["Proceed to close"];
      recommendation = "The buyer is ready to close based on the stored final checklist.";
      risk = "No blocking close-preparation issue is currently stored.";
      alternative = "If anything changes before close, reopen the affected checklist item instead of assuming readiness.";
    }
  }

  return {
    recommendation,
    risk,
    alternative,
    nextAction,
    nextSteps,
    requiresImmediateAttention: args.riskLevel === "HIGH_RISK"
  };
}

export function evaluateClosingReadiness(
  input: ClosingReadinessEvaluationInput
): ClosingReadiness {
  const current = input.current ?? null;
  const now = input.now;
  const inputs: ClosingReadinessInputs = {
    propertyId: input.patch?.propertyId ?? current?.propertyId ?? input.underContract.propertyId,
    propertyAddressLabel:
      input.patch?.propertyAddressLabel ??
      current?.propertyAddressLabel ??
      input.underContract.propertyAddressLabel,
    shortlistId:
      input.patch?.shortlistId ?? current?.shortlistId ?? input.underContract.shortlistId ?? null,
    financialReadinessId:
      input.patch?.financialReadinessId ??
      current?.financialReadinessId ??
      input.underContract.financialReadinessId ??
      input.offerSubmission?.financialReadinessId ??
      null,
    offerPreparationId:
      input.patch?.offerPreparationId ??
      current?.offerPreparationId ??
      input.underContract.offerPreparationId ??
      input.offerSubmission?.offerPreparationId ??
      null,
    offerSubmissionId:
      input.patch?.offerSubmissionId ??
      current?.offerSubmissionId ??
      input.underContract.offerSubmissionId,
    underContractCoordinationId:
      input.patch?.underContractCoordinationId ??
      current?.underContractCoordinationId ??
      input.underContract.id,
    targetClosingDate:
      input.patch?.targetClosingDate ??
      current?.targetClosingDate ??
      input.underContract.targetClosingDate,
    closingAppointmentAt:
      input.patch?.closingAppointmentAt ??
      current?.closingAppointmentAt ??
      null,
    closingAppointmentLocation:
      input.patch?.closingAppointmentLocation ??
      current?.closingAppointmentLocation ??
      null,
    closingAppointmentNotes:
      input.patch?.closingAppointmentNotes ??
      current?.closingAppointmentNotes ??
      null,
    finalReviewDeadline:
      input.patch?.finalReviewDeadline ??
      current?.finalReviewDeadline ??
      input.underContract.closingPreparationDeadline ??
      input.underContract.targetClosingDate,
    finalFundsConfirmationDeadline:
      input.patch?.finalFundsConfirmationDeadline ??
      current?.finalFundsConfirmationDeadline ??
      input.underContract.targetClosingDate,
    finalFundsAmountConfirmed:
      input.patch?.finalFundsAmountConfirmed ??
      current?.finalFundsAmountConfirmed ??
      input.financialReadiness?.totalCashRequiredToClose ??
      null,
    closedAt: input.patch?.closedAt ?? current?.closedAt ?? null,
    notes: input.patch?.notes ?? current?.notes ?? null,
    internalActivityNote:
      input.patch?.internalActivityNote ?? current?.internalActivityNote ?? null
  };

  const checklistItems = buildChecklistItems(inputs, current);
  const missingItems = buildMissingItems(inputs, checklistItems);
  const blockers = buildBlockers({
    underContract: input.underContract,
    inputs,
    checklistItems,
    missingItems,
    now
  });
  const overallRiskLevel = determineRiskLevel({
    inputs,
    checklistItems,
    blockers,
    now
  });
  const overallClosingReadinessState = determineState({
    checklistItems,
    blockers,
    riskLevel: overallRiskLevel,
    closedAt: inputs.closedAt ?? null
  });
  const readyToClose =
    overallClosingReadinessState === "READY_TO_CLOSE" || overallClosingReadinessState === "CLOSED";
  const milestones = buildMilestones(
    current,
    input.underContract,
    checklistItems,
    inputs.closingAppointmentAt ?? null,
    overallClosingReadinessState,
    inputs.closedAt ?? null
  );
  const recommendationBundle = buildRecommendationBundle({
    state: overallClosingReadinessState,
    riskLevel: overallRiskLevel,
    checklistItems,
    blockers,
    inputs
  });

  const activityLog: ClosingReadinessActivityEntry[] = clone(current?.activityLog ?? []);
  const id = current?.id ?? "";
  const createdAt = current?.createdAt ?? now;

  return {
    id,
    sessionId: input.sessionId ?? current?.sessionId ?? input.underContract.sessionId ?? null,
    partnerId: input.partnerId ?? current?.partnerId ?? input.underContract.partnerId ?? null,
    ...inputs,
    closingSummary: {
      propertyId: inputs.propertyId,
      propertyAddressLabel: inputs.propertyAddressLabel,
      underContractCoordinationId: inputs.underContractCoordinationId,
      targetClosingDate: inputs.targetClosingDate,
      closingAppointmentAt: inputs.closingAppointmentAt ?? null,
      closedAt: inputs.closedAt ?? null
    },
    overallClosingReadinessState,
    overallRiskLevel,
    urgencyLevel: overallRiskLevel,
    readyToClose,
    closed: overallClosingReadinessState === "CLOSED",
    checklistItemSummaries: checklistItems,
    milestoneSummaries: milestones,
    missingItems,
    blockers,
    recommendation: recommendationBundle.recommendation,
    risk: recommendationBundle.risk,
    alternative: recommendationBundle.alternative,
    nextAction: recommendationBundle.nextAction,
    nextSteps: recommendationBundle.nextSteps,
    requiresImmediateAttention: recommendationBundle.requiresImmediateAttention,
    activityLog,
    lastActionAt: current?.lastActionAt ?? now,
    lastEvaluatedAt: now,
    createdAt,
    updatedAt: now
  };
}

export function toClosingReadinessSummary(
  record: ClosingReadiness
): ClosingReadinessSummary {
  return {
    closingSummary: clone(record.closingSummary),
    overallClosingReadinessState: record.overallClosingReadinessState,
    overallRiskLevel: record.overallRiskLevel,
    urgencyLevel: record.urgencyLevel,
    readyToClose: record.readyToClose,
    closed: record.closed,
    checklistItemSummaries: clone(record.checklistItemSummaries),
    milestoneSummaries: clone(record.milestoneSummaries),
    missingItems: clone(record.missingItems),
    blockers: clone(record.blockers),
    recommendation: record.recommendation,
    risk: record.risk,
    alternative: record.alternative,
    nextAction: record.nextAction,
    nextSteps: clone(record.nextSteps),
    requiresImmediateAttention: record.requiresImmediateAttention,
    lastActionAt: record.lastActionAt,
    lastEvaluatedAt: record.lastEvaluatedAt
  };
}
