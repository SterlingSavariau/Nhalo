import type {
  BuyerTransactionCommandCenterView,
  ClosingReadiness,
  CommandCenterActivityItem,
  CommandCenterBlocker,
  CommandCenterKeyDate,
  CommandCenterRisk,
  CommandCenterStageSummary,
  FinancialReadiness,
  OfferPreparation,
  OfferSubmission,
  TransactionOverallState,
  TransactionRiskLevel,
  TransactionStage,
  UnderContractCoordination,
  WorkflowActivityRecord
} from "@nhalo/types";

interface BuildBuyerTransactionCommandCenterInput {
  propertyId: string;
  propertyAddressLabel?: string | null;
  sessionId?: string | null;
  shortlistId?: string | null;
  financialReadiness: FinancialReadiness | null;
  offerPreparation: OfferPreparation | null;
  offerSubmission: OfferSubmission | null;
  underContract: UnderContractCoordination | null;
  closingReadiness: ClosingReadiness | null;
  workflowActivity?: WorkflowActivityRecord[];
  now?: string;
}

const STAGE_LABELS: Record<TransactionStage, string> = {
  FINANCIAL_READINESS: "Financial Readiness",
  OFFER_PREPARATION: "Offer Preparation",
  OFFER_SUBMISSION: "Offer Submission",
  UNDER_CONTRACT: "Under Contract",
  CLOSING_READINESS: "Closing Readiness",
  CLOSED: "Closed"
};

const TOTAL_STAGE_COUNT = 6;
const ACTIVE_STAGE_STALE_HOURS = 168;

function toTime(value?: string | null): number | null {
  if (!value) {
    return null;
  }
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function maxTime(values: Array<string | null | undefined>): string | null {
  const times = values
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter((value) => Number.isFinite(value)) as number[];
  if (times.length === 0) {
    return null;
  }
  return new Date(Math.max(...times)).toISOString();
}

function minTime(values: Array<string | null | undefined>): string | null {
  const times = values
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter((value) => Number.isFinite(value)) as number[];
  if (times.length === 0) {
    return null;
  }
  return new Date(Math.min(...times)).toISOString();
}

function mapOfferSubmissionUrgency(level: OfferSubmission["urgencyLevel"]): TransactionRiskLevel {
  switch (level) {
    case "HIGH_URGENCY":
      return "HIGH_RISK";
    case "MODERATE_URGENCY":
      return "MODERATE_RISK";
    default:
      return "LOW_RISK";
  }
}

function isFinancialComplete(record: FinancialReadiness | null): boolean {
  return record?.readinessState === "READY";
}

function isOfferPreparationComplete(record: OfferPreparation | null): boolean {
  return Boolean(record?.offerState === "READY" && record.readinessToSubmit);
}

function isOfferSubmissionAccepted(record: OfferSubmission | null): boolean {
  return record?.submissionState === "ACCEPTED";
}

function isUnderContractReady(record: UnderContractCoordination | null): boolean {
  return Boolean(record?.overallCoordinationState === "READY_FOR_CLOSING" && record.readyForClosing);
}

function isClosingReady(record: ClosingReadiness | null): boolean {
  return Boolean(record?.overallClosingReadinessState === "READY_TO_CLOSE" && record.readyToClose);
}

function isClosed(record: ClosingReadiness | null): boolean {
  return Boolean(record?.closed || record?.overallClosingReadinessState === "CLOSED");
}

function deriveCurrentStage(input: BuildBuyerTransactionCommandCenterInput): TransactionStage {
  const validOfferSubmission =
    !input.offerSubmission || input.offerPreparation !== null;
  const validUnderContract =
    !input.underContract || input.offerSubmission?.submissionState === "ACCEPTED";
  const validClosingReadiness =
    !input.closingReadiness ||
    (input.underContract?.overallCoordinationState === "READY_FOR_CLOSING" &&
      input.underContract.readyForClosing);

  if (isClosed(input.closingReadiness) && validClosingReadiness) {
    return "CLOSED";
  }

  if (validClosingReadiness && input.closingReadiness) {
    return "CLOSING_READINESS";
  }

  if (validUnderContract && input.underContract) {
    return "UNDER_CONTRACT";
  }

  if (validOfferSubmission && input.offerSubmission) {
    if (input.offerSubmission.submissionState === "ACCEPTED") {
      return "UNDER_CONTRACT";
    }
    return "OFFER_SUBMISSION";
  }

  if (input.offerPreparation) {
    if (isOfferPreparationComplete(input.offerPreparation)) {
      return "OFFER_SUBMISSION";
    }
    return "OFFER_PREPARATION";
  }

  if (input.financialReadiness) {
    if (isFinancialComplete(input.financialReadiness)) {
      return "OFFER_PREPARATION";
    }
    return "FINANCIAL_READINESS";
  }

  return "FINANCIAL_READINESS";
}

function buildIntegrityWarnings(
  currentStage: TransactionStage,
  input: BuildBuyerTransactionCommandCenterInput
): CommandCenterBlocker[] {
  const warnings: CommandCenterBlocker[] = [];

  if (input.offerSubmission && !input.offerPreparation) {
    warnings.push({
      code: "INVALID_STAGE_DEPENDENCY",
      sourceStage: "OFFER_SUBMISSION",
      severity: currentStage === "OFFER_SUBMISSION" ? "blocking" : "warning",
      message: "Offer submission exists without a valid offer preparation record.",
      whyItMatters: "Submission workflow should start from a prepared offer.",
      howToFix: "Rebuild or relink the offer preparation record before relying on submission state."
    });
  }

  if (input.underContract && input.offerSubmission?.submissionState !== "ACCEPTED") {
    warnings.push({
      code: "INVALID_STAGE_DEPENDENCY",
      sourceStage: "UNDER_CONTRACT",
      severity: currentStage === "UNDER_CONTRACT" ? "blocking" : "warning",
      message: "Under-contract workflow exists without an accepted offer submission.",
      whyItMatters: "Contract coordination should only begin after the offer is accepted.",
      howToFix: "Confirm the accepted submission or recreate the under-contract workflow from the accepted offer."
    });
  }

  if (
    input.closingReadiness &&
    (!input.underContract ||
      input.underContract.overallCoordinationState !== "READY_FOR_CLOSING" ||
      !input.underContract.readyForClosing)
  ) {
    warnings.push({
      code: "INVALID_STAGE_DEPENDENCY",
      sourceStage: "CLOSING_READINESS",
      severity: currentStage === "CLOSING_READINESS" ? "blocking" : "warning",
      message: "Closing readiness exists before the under-contract workflow is ready for closing.",
      whyItMatters: "Closing readiness should only begin after the contract work is complete.",
      howToFix: "Finish the under-contract requirements or recreate the closing workflow from a ready-for-closing record."
    });
  }

  return warnings;
}

function mapFinancialBlockers(record: FinancialReadiness): CommandCenterBlocker[] {
  return record.blockers.map((blocker) => ({
    code: blocker.code,
    sourceStage: "FINANCIAL_READINESS" as const,
    severity: blocker.severity,
    message: blocker.message,
    whyItMatters: blocker.whyItMatters,
    howToFix: blocker.howToFix
  }));
}

function mapOfferPreparationBlockers(record: OfferPreparation): CommandCenterBlocker[] {
  return record.blockers.map((blocker) => ({
    code: blocker.code,
    sourceStage: "OFFER_PREPARATION" as const,
    severity: blocker.severity,
    message: blocker.message,
    whyItMatters: blocker.whyItMatters,
    howToFix: blocker.howToFix
  }));
}

function mapOfferSubmissionBlockers(record: OfferSubmission): CommandCenterBlocker[] {
  return record.blockers.map((blocker) => ({
    code: blocker.code,
    sourceStage: "OFFER_SUBMISSION" as const,
    severity: blocker.severity,
    message: blocker.message,
    whyItMatters: blocker.whyItMatters,
    howToFix: blocker.howToFix
  }));
}

function mapUnderContractBlockers(record: UnderContractCoordination): CommandCenterBlocker[] {
  return record.blockers.map((blocker) => ({
    code: blocker.code,
    sourceStage: "UNDER_CONTRACT" as const,
    severity: blocker.severity,
    message: blocker.message,
    whyItMatters: blocker.whyItMatters,
    howToFix: blocker.howToFix
  }));
}

function mapClosingBlockers(record: ClosingReadiness): CommandCenterBlocker[] {
  return record.blockers.map((blocker) => ({
    code: blocker.code,
    sourceStage: "CLOSING_READINESS" as const,
    severity: blocker.severity,
    message: blocker.message,
    whyItMatters: blocker.whyItMatters,
    howToFix: blocker.howToFix
  }));
}

function activeStageBlockers(
  currentStage: TransactionStage,
  input: BuildBuyerTransactionCommandCenterInput
): CommandCenterBlocker[] {
  switch (currentStage) {
    case "FINANCIAL_READINESS":
      return input.financialReadiness ? mapFinancialBlockers(input.financialReadiness) : [];
    case "OFFER_PREPARATION":
      return input.offerPreparation ? mapOfferPreparationBlockers(input.offerPreparation) : [];
    case "OFFER_SUBMISSION":
      return input.offerSubmission ? mapOfferSubmissionBlockers(input.offerSubmission) : [];
    case "UNDER_CONTRACT":
      return input.underContract ? mapUnderContractBlockers(input.underContract) : [];
    case "CLOSING_READINESS":
      return input.closingReadiness ? mapClosingBlockers(input.closingReadiness) : [];
    default:
      return [];
  }
}

function stageRiskLevel(
  stage: TransactionStage,
  input: BuildBuyerTransactionCommandCenterInput
): TransactionRiskLevel {
  switch (stage) {
    case "FINANCIAL_READINESS":
      if (!input.financialReadiness) {
        return "LOW_RISK";
      }
      if (
        input.financialReadiness.readinessState === "BLOCKED" ||
        input.financialReadiness.blockers.some((blocker) => blocker.severity === "blocking")
      ) {
        return "HIGH_RISK";
      }
      if (
        input.financialReadiness.affordabilityClassification === "ALMOST_READY" ||
        input.financialReadiness.blockers.length > 0
      ) {
        return "MODERATE_RISK";
      }
      return "LOW_RISK";
    case "OFFER_PREPARATION":
      return input.offerPreparation?.offerRiskLevel ?? "LOW_RISK";
    case "OFFER_SUBMISSION":
      return input.offerSubmission
        ? mapOfferSubmissionUrgency(input.offerSubmission.urgencyLevel)
        : "LOW_RISK";
    case "UNDER_CONTRACT":
      return input.underContract?.overallRiskLevel ?? "LOW_RISK";
    case "CLOSING_READINESS":
      return input.closingReadiness?.overallRiskLevel ?? "LOW_RISK";
    case "CLOSED":
      return "LOW_RISK";
  }
}

function stageLastUpdated(
  stage: TransactionStage,
  input: BuildBuyerTransactionCommandCenterInput
): string | null {
  switch (stage) {
    case "FINANCIAL_READINESS":
      return input.financialReadiness?.updatedAt ?? null;
    case "OFFER_PREPARATION":
      return input.offerPreparation?.updatedAt ?? null;
    case "OFFER_SUBMISSION":
      return input.offerSubmission?.updatedAt ?? null;
    case "UNDER_CONTRACT":
      return input.underContract?.updatedAt ?? null;
    case "CLOSING_READINESS":
    case "CLOSED":
      return input.closingReadiness?.updatedAt ?? null;
  }
}

function stageNextAction(
  stage: TransactionStage,
  input: BuildBuyerTransactionCommandCenterInput
): string | null {
  switch (stage) {
    case "FINANCIAL_READINESS":
      return input.financialReadiness?.nextAction ?? "Start financial readiness";
    case "OFFER_PREPARATION":
      return input.offerPreparation?.nextAction ?? "Start offer preparation";
    case "OFFER_SUBMISSION":
      if (input.offerSubmission) {
        return input.offerSubmission.nextAction;
      }
      return isOfferPreparationComplete(input.offerPreparation) ? "Submit offer" : "Complete offer preparation";
    case "UNDER_CONTRACT":
      if (input.underContract) {
        return input.underContract.nextAction;
      }
      return isOfferSubmissionAccepted(input.offerSubmission)
        ? "Start under-contract coordination"
        : "Wait for accepted offer";
    case "CLOSING_READINESS":
      if (input.closingReadiness) {
        return input.closingReadiness.nextAction;
      }
      return isUnderContractReady(input.underContract)
        ? "Start closing readiness"
        : "Resolve remaining contract tasks";
    case "CLOSED":
      return "Review completed transaction summary";
  }
}

function stageStatus(stage: TransactionStage, input: BuildBuyerTransactionCommandCenterInput): string {
  switch (stage) {
    case "FINANCIAL_READINESS":
      return input.financialReadiness?.readinessState ?? "NOT_STARTED";
    case "OFFER_PREPARATION":
      if (!input.offerPreparation) {
        return isFinancialComplete(input.financialReadiness) ? "READY_TO_START" : "NOT_STARTED";
      }
      return input.offerPreparation.offerState;
    case "OFFER_SUBMISSION":
      if (!input.offerSubmission) {
        return isOfferPreparationComplete(input.offerPreparation) ? "READY_TO_START" : "NOT_STARTED";
      }
      return input.offerSubmission.submissionState;
    case "UNDER_CONTRACT":
      if (!input.underContract) {
        return isOfferSubmissionAccepted(input.offerSubmission) ? "READY_TO_START" : "NOT_STARTED";
      }
      return input.underContract.overallCoordinationState;
    case "CLOSING_READINESS":
      if (!input.closingReadiness) {
        return isUnderContractReady(input.underContract) ? "READY_TO_START" : "NOT_STARTED";
      }
      return input.closingReadiness.overallClosingReadinessState;
    case "CLOSED":
      return isClosed(input.closingReadiness) ? "CLOSED" : "NOT_STARTED";
  }
}

function stageCompleted(stage: TransactionStage, input: BuildBuyerTransactionCommandCenterInput): boolean {
  switch (stage) {
    case "FINANCIAL_READINESS":
      return isFinancialComplete(input.financialReadiness);
    case "OFFER_PREPARATION":
      return isOfferPreparationComplete(input.offerPreparation);
    case "OFFER_SUBMISSION":
      return isOfferSubmissionAccepted(input.offerSubmission);
    case "UNDER_CONTRACT":
      return isUnderContractReady(input.underContract);
    case "CLOSING_READINESS":
      return isClosingReady(input.closingReadiness) || isClosed(input.closingReadiness);
    case "CLOSED":
      return isClosed(input.closingReadiness);
  }
}

function stageAvailable(stage: TransactionStage, input: BuildBuyerTransactionCommandCenterInput): boolean {
  switch (stage) {
    case "FINANCIAL_READINESS":
      return true;
    case "OFFER_PREPARATION":
      return isFinancialComplete(input.financialReadiness) || input.offerPreparation !== null;
    case "OFFER_SUBMISSION":
      return isOfferPreparationComplete(input.offerPreparation) || input.offerSubmission !== null;
    case "UNDER_CONTRACT":
      return isOfferSubmissionAccepted(input.offerSubmission) || input.underContract !== null;
    case "CLOSING_READINESS":
      return isUnderContractReady(input.underContract) || input.closingReadiness !== null;
    case "CLOSED":
      return isClosingReady(input.closingReadiness) || isClosed(input.closingReadiness);
  }
}

function stageBlockerCount(stage: TransactionStage, input: BuildBuyerTransactionCommandCenterInput): number {
  switch (stage) {
    case "FINANCIAL_READINESS":
      return input.financialReadiness?.blockers.length ?? 0;
    case "OFFER_PREPARATION":
      return input.offerPreparation?.blockers.length ?? 0;
    case "OFFER_SUBMISSION":
      return input.offerSubmission?.blockers.length ?? 0;
    case "UNDER_CONTRACT":
      return input.underContract?.blockers.length ?? 0;
    case "CLOSING_READINESS":
      return input.closingReadiness?.blockers.length ?? 0;
    case "CLOSED":
      return 0;
  }
}

function buildStageSummaries(input: BuildBuyerTransactionCommandCenterInput): CommandCenterStageSummary[] {
  const stages: TransactionStage[] = [
    "FINANCIAL_READINESS",
    "OFFER_PREPARATION",
    "OFFER_SUBMISSION",
    "UNDER_CONTRACT",
    "CLOSING_READINESS",
    "CLOSED"
  ];

  return stages.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    status: stageStatus(stage, input),
    completed: stageCompleted(stage, input),
    available: stageAvailable(stage, input),
    blockerCount: stageBlockerCount(stage, input),
    riskLevel: stageRiskLevel(stage, input),
    nextAction: stageNextAction(stage, input),
    lastUpdatedAt: stageLastUpdated(stage, input)
  }));
}

function classifyDateStatus(
  date: string,
  nowMs: number,
  completed = false
): CommandCenterKeyDate["status"] {
  if (completed) {
    return "COMPLETED";
  }
  const delta = new Date(date).getTime() - nowMs;
  if (delta < 0) {
    return "PAST_DUE";
  }
  if (delta <= 86_400_000) {
    return "DUE_SOON";
  }
  return "UPCOMING";
}

function buildKeyDates(
  input: BuildBuyerTransactionCommandCenterInput,
  nowIso: string
): CommandCenterKeyDate[] {
  const nowMs = new Date(nowIso).getTime();
  const keyDates: CommandCenterKeyDate[] = [];

  if (input.offerSubmission?.offerExpirationAt) {
    keyDates.push({
      key: "offer_expiration",
      label: "Offer expiration",
      date: input.offerSubmission.offerExpirationAt,
      sourceStage: "OFFER_SUBMISSION",
      status: classifyDateStatus(
        input.offerSubmission.offerExpirationAt,
        nowMs,
        ["ACCEPTED", "REJECTED", "WITHDRAWN", "EXPIRED"].includes(input.offerSubmission.submissionState)
      )
    });
  }

  if (input.offerSubmission?.counterofferSummary.counterofferExpirationAt) {
    keyDates.push({
      key: "counteroffer_expiration",
      label: "Counteroffer expiration",
      date: input.offerSubmission.counterofferSummary.counterofferExpirationAt,
      sourceStage: "OFFER_SUBMISSION",
      status: classifyDateStatus(
        input.offerSubmission.counterofferSummary.counterofferExpirationAt,
        nowMs,
        input.offerSubmission.submissionState !== "COUNTERED"
      )
    });
  }

  if (input.underContract) {
    for (const deadline of input.underContract.deadlineSummaries) {
      if (!deadline.deadline) {
        continue;
      }
      keyDates.push({
        key: `under_contract_${deadline.key}`,
        label: deadline.label,
        date: deadline.deadline,
        sourceStage: "UNDER_CONTRACT",
        status:
          deadline.status === "MISSED"
            ? "PAST_DUE"
            : deadline.status === "DUE_SOON"
              ? "DUE_SOON"
              : "UPCOMING"
      });
    }
  }

  if (input.closingReadiness) {
    keyDates.push({
      key: "closing_target_date",
      label: "Target closing date",
      date: input.closingReadiness.targetClosingDate,
      sourceStage: "CLOSING_READINESS",
      status: classifyDateStatus(
        input.closingReadiness.targetClosingDate,
        nowMs,
        input.closingReadiness.closed
      )
    });

    if (input.closingReadiness.closingAppointmentAt) {
      keyDates.push({
        key: "closing_appointment",
        label: "Closing appointment",
        date: input.closingReadiness.closingAppointmentAt,
        sourceStage: "CLOSING_READINESS",
        status: classifyDateStatus(
          input.closingReadiness.closingAppointmentAt,
          nowMs,
          input.closingReadiness.closed
        )
      });
    }

    if (input.closingReadiness.finalReviewDeadline) {
      keyDates.push({
        key: "final_review_deadline",
        label: "Final review deadline",
        date: input.closingReadiness.finalReviewDeadline,
        sourceStage: "CLOSING_READINESS",
        status: classifyDateStatus(input.closingReadiness.finalReviewDeadline, nowMs)
      });
    }

    if (input.closingReadiness.finalFundsConfirmationDeadline) {
      keyDates.push({
        key: "final_funds_confirmation_deadline",
        label: "Final funds confirmation deadline",
        date: input.closingReadiness.finalFundsConfirmationDeadline,
        sourceStage: "CLOSING_READINESS",
        status: classifyDateStatus(input.closingReadiness.finalFundsConfirmationDeadline, nowMs)
      });
    }
  }

  return keyDates.sort((left, right) => left.date.localeCompare(right.date));
}

function eventStage(eventType: string): TransactionStage {
  if (eventType.startsWith("financial_")) {
    return "FINANCIAL_READINESS";
  }
  if (eventType.startsWith("offer_preparation")) {
    return "OFFER_PREPARATION";
  }
  if (eventType.startsWith("offer_submission")) {
    return "OFFER_SUBMISSION";
  }
  if (eventType.startsWith("under_contract")) {
    return "UNDER_CONTRACT";
  }
  if (eventType.startsWith("closing_")) {
    return eventType === "closing_completed" ? "CLOSED" : "CLOSING_READINESS";
  }
  return "OFFER_PREPARATION";
}

function eventLabel(eventType: string): string {
  switch (eventType) {
    case "financial_readiness_created":
      return "Financial readiness started";
    case "financial_readiness_updated":
      return "Financial readiness updated";
    case "financial_readiness_status_changed":
      return "Financial readiness changed";
    case "offer_preparation_created":
      return "Offer preparation started";
    case "offer_preparation_updated":
      return "Offer preparation updated";
    case "offer_preparation_status_changed":
      return "Offer preparation changed";
    case "offer_submission_created":
      return "Offer submission started";
    case "offer_submission_submitted":
      return "Offer submitted";
    case "offer_submission_countered":
      return "Seller countered";
    case "offer_submission_accepted":
      return "Offer accepted";
    case "offer_submission_rejected":
      return "Offer rejected";
    case "offer_submission_withdrawn":
      return "Offer withdrawn";
    case "offer_submission_expired":
      return "Offer expired";
    case "under_contract_created":
      return "Under-contract workflow started";
    case "under_contract_task_updated":
      return "Contract task updated";
    case "under_contract_milestone_reached":
      return "Contract milestone updated";
    case "under_contract_ready_for_closing":
      return "Ready for closing";
    case "closing_readiness_created":
      return "Closing readiness started";
    case "closing_checklist_updated":
      return "Closing checklist updated";
    case "closing_milestone_reached":
      return "Closing milestone updated";
    case "closing_ready_to_close":
      return "Ready to close";
    case "closing_completed":
      return "Closing complete";
    case "shortlist_item_added":
      return "Home saved to shortlist";
    default:
      return "Workflow activity";
  }
}

function buildRecentActivity(
  input: BuildBuyerTransactionCommandCenterInput
): CommandCenterActivityItem[] {
  const sourceRefs = {
    offerPreparationId: input.offerPreparation?.id ?? null,
    offerSubmissionId: input.offerSubmission?.id ?? null,
    underContractId: input.underContract?.id ?? null,
    closingReadinessId: input.closingReadiness?.id ?? null
  };

  return (input.workflowActivity ?? [])
    .filter((entry) => {
      if (entry.offerPreparationId && entry.offerPreparationId === sourceRefs.offerPreparationId) {
        return true;
      }
      if (entry.offerSubmissionId && entry.offerSubmissionId === sourceRefs.offerSubmissionId) {
        return true;
      }
      if (entry.underContractId && entry.underContractId === sourceRefs.underContractId) {
        return true;
      }
      if (entry.closingReadinessId && entry.closingReadinessId === sourceRefs.closingReadinessId) {
        return true;
      }
      const canonicalPropertyId = typeof entry.payload?.canonicalPropertyId === "string"
        ? entry.payload.canonicalPropertyId
        : null;
      if (canonicalPropertyId && canonicalPropertyId === input.propertyId) {
        return true;
      }
      return Boolean(
        input.financialReadiness && entry.eventType.startsWith("financial_")
      );
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 8)
    .map((entry) => ({
      id: entry.id,
      type: entry.eventType,
      label: eventLabel(entry.eventType),
      occurredAt: entry.createdAt,
      sourceStage: eventStage(entry.eventType)
    }));
}

function primaryRiskForStage(
  currentStage: TransactionStage,
  input: BuildBuyerTransactionCommandCenterInput,
  keyDates: CommandCenterKeyDate[],
  isStale: boolean
): CommandCenterRisk | null {
  if (isStale) {
    return {
      code: "STALE_WORKFLOW_DATA",
      sourceStage: currentStage,
      level: "MODERATE_RISK",
      message: "This stage has not been updated recently, so the workflow may be stale."
    };
  }

  switch (currentStage) {
    case "FINANCIAL_READINESS":
      if (!input.financialReadiness) {
        return null;
      }
      return {
        code: input.financialReadiness.affordabilityClassification,
        sourceStage: currentStage,
        level: stageRiskLevel(currentStage, input),
        message: input.financialReadiness.risk
      };
    case "OFFER_PREPARATION":
      if (!input.offerPreparation) {
        return null;
      }
      return {
        code: input.offerPreparation.offerRiskLevel,
        sourceStage: currentStage,
        level: stageRiskLevel(currentStage, input),
        message: input.offerPreparation.risk
      };
    case "OFFER_SUBMISSION":
      if (!input.offerSubmission) {
        return null;
      }
      return {
        code: input.offerSubmission.urgencyLevel,
        sourceStage: currentStage,
        level: stageRiskLevel(currentStage, input),
        message: input.offerSubmission.risk,
        dueAt:
          input.offerSubmission.counterofferSummary.counterofferExpirationAt ??
          input.offerSubmission.offerExpirationAt ??
          null
      };
    case "UNDER_CONTRACT":
      if (!input.underContract) {
        return null;
      }
      return {
        code: input.underContract.overallRiskLevel,
        sourceStage: currentStage,
        level: stageRiskLevel(currentStage, input),
        message: input.underContract.risk,
        dueAt:
          keyDates.find((entry) => entry.sourceStage === "UNDER_CONTRACT" && entry.status !== "COMPLETED")
            ?.date ?? null
      };
    case "CLOSING_READINESS":
      if (!input.closingReadiness) {
        return null;
      }
      return {
        code: input.closingReadiness.overallRiskLevel,
        sourceStage: currentStage,
        level: stageRiskLevel(currentStage, input),
        message: input.closingReadiness.risk,
        dueAt:
          keyDates.find((entry) => entry.sourceStage === "CLOSING_READINESS" && entry.status !== "COMPLETED")
            ?.date ?? null
      };
    default:
      return null;
  }
}

function buildTopRisks(
  primaryRisk: CommandCenterRisk | null,
  keyDates: CommandCenterKeyDate[]
): CommandCenterRisk[] {
  const risks: CommandCenterRisk[] = primaryRisk ? [primaryRisk] : [];

  for (const keyDate of keyDates) {
    if (keyDate.status === "DUE_SOON") {
      risks.push({
        code: `${keyDate.key}_due_soon`,
        sourceStage: keyDate.sourceStage,
        level: "MODERATE_RISK",
        message: `${keyDate.label} is due soon.`,
        dueAt: keyDate.date
      });
    }
    if (keyDate.status === "PAST_DUE") {
      risks.push({
        code: `${keyDate.key}_past_due`,
        sourceStage: keyDate.sourceStage,
        level: "HIGH_RISK",
        message: `${keyDate.label} is past due.`,
        dueAt: keyDate.date
      });
    }
  }

  const deduped = new Map<string, CommandCenterRisk>();
  for (const risk of risks) {
    deduped.set(`${risk.code}:${risk.sourceStage}`, risk);
  }
  return Array.from(deduped.values()).slice(0, 5);
}

function isActiveStageStale(
  currentStage: TransactionStage,
  input: BuildBuyerTransactionCommandCenterInput,
  nowIso: string
): boolean {
  const updatedAt = stageLastUpdated(currentStage, input);
  const updatedMs = toTime(updatedAt);
  if (!updatedMs) {
    return false;
  }
  return new Date(nowIso).getTime() - updatedMs > ACTIVE_STAGE_STALE_HOURS * 3_600_000;
}

function stageSpecificNextAction(
  currentStage: TransactionStage,
  input: BuildBuyerTransactionCommandCenterInput
): { nextAction: string; nextSteps: string[] } {
  switch (currentStage) {
    case "FINANCIAL_READINESS":
      if (!input.financialReadiness) {
        return {
          nextAction: "Start financial readiness",
          nextSteps: ["Start financial readiness", "Enter household budget details"]
        };
      }
      return {
        nextAction: input.financialReadiness.nextAction,
        nextSteps: input.financialReadiness.nextSteps
      };
    case "OFFER_PREPARATION":
      if (!input.offerPreparation) {
        return {
          nextAction: "Start offer preparation",
          nextSteps: ["Start offer preparation", "Set offer terms for this home"]
        };
      }
      return {
        nextAction: input.offerPreparation.nextAction,
        nextSteps: input.offerPreparation.nextSteps
      };
    case "OFFER_SUBMISSION":
      if (!input.offerSubmission) {
        return {
          nextAction: "Submit offer",
          nextSteps: ["Create the submission record", "Submit offer"]
        };
      }
      return {
        nextAction: input.offerSubmission.nextAction,
        nextSteps: input.offerSubmission.nextSteps
      };
    case "UNDER_CONTRACT":
      if (!input.underContract) {
        return {
          nextAction: "Start under-contract coordination",
          nextSteps: ["Start under-contract coordination", "Set contract deadlines"]
        };
      }
      return {
        nextAction: input.underContract.nextAction,
        nextSteps: input.underContract.nextSteps
      };
    case "CLOSING_READINESS":
      if (!input.closingReadiness) {
        return {
          nextAction: "Start closing readiness",
          nextSteps: ["Start closing readiness", "Begin the final closing checklist"]
        };
      }
      return {
        nextAction: input.closingReadiness.nextAction,
        nextSteps: input.closingReadiness.nextSteps
      };
    case "CLOSED":
      return {
        nextAction: "Review completed transaction summary",
        nextSteps: ["Review completed transaction summary"]
      };
  }
}

function currentStageReadyToAdvance(
  currentStage: TransactionStage,
  input: BuildBuyerTransactionCommandCenterInput
): boolean {
  switch (currentStage) {
    case "FINANCIAL_READINESS":
      return isFinancialComplete(input.financialReadiness);
    case "OFFER_PREPARATION":
      return isOfferPreparationComplete(input.offerPreparation);
    case "OFFER_SUBMISSION":
      return isOfferSubmissionAccepted(input.offerSubmission);
    case "UNDER_CONTRACT":
      return isUnderContractReady(input.underContract);
    case "CLOSING_READINESS":
      return isClosingReady(input.closingReadiness);
    case "CLOSED":
      return false;
  }
}

export function buildBuyerTransactionCommandCenter(
  input: BuildBuyerTransactionCommandCenterInput
): BuyerTransactionCommandCenterView {
  const nowIso = input.now ?? new Date().toISOString();
  const currentStage = deriveCurrentStage(input);
  const integrityWarnings = buildIntegrityWarnings(currentStage, input);
  const currentStageBlockers = activeStageBlockers(currentStage, input);
  const activeBlockers = [
    ...currentStageBlockers,
    ...integrityWarnings.filter((warning) => warning.sourceStage === currentStage),
    ...integrityWarnings.filter((warning) => warning.sourceStage !== currentStage)
  ];
  const stageSummaries = buildStageSummaries(input);
  const keyDates = buildKeyDates(input, nowIso);
  const isStale = isActiveStageStale(currentStage, input, nowIso);
  const primaryRisk = primaryRiskForStage(currentStage, input, keyDates, isStale);
  const topRisks = buildTopRisks(primaryRisk, keyDates);
  const { nextAction, nextSteps } = stageSpecificNextAction(currentStage, input);

  const hasBlockingBlocker = activeBlockers.some((blocker) => blocker.severity === "blocking");
  const hasDueSoonRisk = topRisks.some((risk) => risk.level === "HIGH_RISK");

  let overallState: TransactionOverallState;
  if (currentStage === "CLOSED") {
    overallState = "COMPLETE";
  } else if (
    !input.financialReadiness &&
    !input.offerPreparation &&
    !input.offerSubmission &&
    !input.underContract &&
    !input.closingReadiness
  ) {
    overallState = "NOT_STARTED";
  } else if (hasBlockingBlocker) {
    overallState = "BLOCKED";
  } else if (hasDueSoonRisk || keyDates.some((entry) => entry.status === "PAST_DUE")) {
    overallState = "AT_RISK";
  } else if (
    currentStageReadyToAdvance(currentStage, input) ||
    (currentStage === "OFFER_PREPARATION" && !input.offerPreparation && isFinancialComplete(input.financialReadiness)) ||
    (currentStage === "OFFER_SUBMISSION" && !input.offerSubmission && isOfferPreparationComplete(input.offerPreparation)) ||
    (currentStage === "UNDER_CONTRACT" && !input.underContract && isOfferSubmissionAccepted(input.offerSubmission)) ||
    (currentStage === "CLOSING_READINESS" && !input.closingReadiness && isUnderContractReady(input.underContract))
  ) {
    overallState = "READY_TO_ADVANCE";
  } else {
    overallState = "IN_PROGRESS";
  }

  const createdAt = minTime([
    input.financialReadiness?.createdAt,
    input.offerPreparation?.createdAt,
    input.offerSubmission?.createdAt,
    input.underContract?.createdAt,
    input.closingReadiness?.createdAt
  ]);
  const lastUpdatedAt = maxTime([
    input.financialReadiness?.updatedAt,
    input.offerPreparation?.updatedAt,
    input.offerSubmission?.updatedAt,
    input.underContract?.updatedAt,
    input.closingReadiness?.updatedAt
  ]);
  const completedStageCount = stageSummaries.filter((summary) => summary.completed).length;

  return {
    propertyId: input.propertyId,
    propertyAddressLabel:
      input.closingReadiness?.closingSummary.propertyAddressLabel ??
      input.underContract?.coordinationSummary.propertyAddressLabel ??
      input.offerSubmission?.submissionSummary.propertyAddressLabel ??
      input.offerPreparation?.offerSummary.propertyAddressLabel ??
      input.propertyAddressLabel?.trim() ??
      input.propertyId,
    sessionId: input.sessionId ?? input.financialReadiness?.sessionId ?? null,
    shortlistId:
      input.shortlistId ??
      input.closingReadiness?.shortlistId ??
      input.underContract?.shortlistId ??
      input.offerSubmission?.shortlistId ??
      input.offerPreparation?.shortlistId ??
      null,
    currentStage,
    overallState,
    overallRiskLevel:
      primaryRisk?.level ??
      (keyDates.some((entry) => entry.status === "PAST_DUE")
        ? "HIGH_RISK"
        : keyDates.some((entry) => entry.status === "DUE_SOON")
          ? "MODERATE_RISK"
          : "LOW_RISK"),
    progressPercent: Math.round((completedStageCount / TOTAL_STAGE_COUNT) * 100),
    completedStageCount,
    totalStageCount: TOTAL_STAGE_COUNT,
    primaryBlocker: activeBlockers[0] ?? null,
    activeBlockers,
    primaryRisk,
    topRisks,
    nextAction,
    nextSteps,
    keyDates,
    recentActivity: buildRecentActivity(input),
    stageSummaries,
    sourceRefs: {
      financialReadinessId: input.financialReadiness?.id ?? null,
      offerPreparationId: input.offerPreparation?.id ?? null,
      offerSubmissionId: input.offerSubmission?.id ?? null,
      underContractCoordinationId: input.underContract?.id ?? null,
      closingReadinessId: input.closingReadiness?.id ?? null
    },
    isStale,
    lastUpdatedAt,
    createdAt
  };
}
