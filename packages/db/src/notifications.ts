import type {
  AlertCategory,
  BuyerTransactionCommandCenterView,
  ClosingReadiness,
  FinancialReadiness,
  NotificationActionTarget,
  NotificationSeverity,
  NotificationStatus,
  NotificationModuleName,
  OfferPreparation,
  OfferSubmission,
  UnderContractCoordination,
  WorkflowNotification
} from "@nhalo/types";

export interface WorkflowNotificationCandidate {
  workflowId?: string | null;
  sessionId?: string | null;
  propertyId?: string | null;
  propertyAddressLabel?: string | null;
  shortlistId?: string | null;
  moduleName: NotificationModuleName;
  alertCategory: AlertCategory;
  severity: NotificationSeverity;
  triggeringRuleLabel: string;
  relatedSubjectType: string;
  relatedSubjectId: string;
  title: string;
  message: string;
  actionLabel?: string | null;
  actionTarget?: NotificationActionTarget | null;
  dueAt?: string | null;
  explanationSubjectType?: string | null;
  explanationSubjectId?: string | null;
}

interface NotificationSyncPlan {
  create: WorkflowNotificationCandidate[];
  update: Array<{
    id: string;
    patch: {
      severity?: NotificationSeverity;
      status?: NotificationStatus;
      title?: string;
      message?: string;
      actionLabel?: string | null;
      actionTarget?: NotificationActionTarget | null;
      dueAt?: string | null;
      resolvedAt?: string | null;
      explanationSubjectType?: string | null;
      explanationSubjectId?: string | null;
    };
  }>;
}

function hoursUntil(timestamp: string, now: string): number {
  return (new Date(timestamp).getTime() - new Date(now).getTime()) / 3_600_000;
}

function lower(value: string): string {
  return value.replaceAll("_", " ").toLowerCase();
}

function actionTarget(
  moduleName: NotificationModuleName,
  subjectType: string,
  subjectId: string
): NotificationActionTarget {
  return {
    type: "module",
    moduleName,
    subjectType,
    subjectId
  };
}

function dedupeKey(candidate: {
  triggeringRuleLabel: string;
  relatedSubjectType: string;
  relatedSubjectId: string;
  dueAt?: string | null;
}): string {
  return [
    candidate.triggeringRuleLabel,
    candidate.relatedSubjectType,
    candidate.relatedSubjectId,
    candidate.dueAt ?? "none"
  ].join(":");
}

function buildFinancialReadinessNotifications(
  record: FinancialReadiness
): WorkflowNotificationCandidate[] {
  const candidates: WorkflowNotificationCandidate[] = [];
  const base = {
    workflowId: record.id,
    sessionId: record.sessionId ?? null,
    moduleName: "financial_readiness" as const,
    relatedSubjectType: "financial_readiness",
    relatedSubjectId: record.id,
    explanationSubjectType: "financial_readiness",
    explanationSubjectId: record.id,
    actionTarget: actionTarget("financial_readiness", "financial_readiness", record.id)
  };

  for (const blocker of record.blockers) {
    candidates.push({
      ...base,
      alertCategory: blocker.severity === "blocking" ? "BLOCKER_ALERT" : "REQUIRED_ACTION",
      severity: blocker.severity === "blocking" ? "CRITICAL" : "WARNING",
      triggeringRuleLabel: `financial_readiness_blocker_${blocker.code.toLowerCase()}`,
      title: "Financial readiness needs attention",
      message: `${blocker.message} ${blocker.howToFix}`,
      actionLabel: record.nextAction
    });
  }

  if (record.readinessState === "READY") {
    candidates.push({
      ...base,
      alertCategory: "MILESTONE_ALERT",
      severity: "INFO",
      triggeringRuleLabel: "financial_readiness_ready",
      title: "Financial readiness is complete",
      message: "Your financial readiness is marked ready and you can move into offer preparation.",
      actionLabel: record.nextAction
    });
  }

  if (record.readinessState === "BLOCKED") {
    candidates.push({
      ...base,
      alertCategory: "STATE_CHANGE",
      severity: "WARNING",
      triggeringRuleLabel: "financial_readiness_blocked_state",
      title: "Financial readiness is blocked",
      message: `Financial readiness is currently blocked because it resolved to ${lower(record.readinessState)}.`,
      actionLabel: record.nextAction
    });
  }

  return candidates;
}

function buildOfferPreparationNotifications(record: OfferPreparation): WorkflowNotificationCandidate[] {
  const candidates: WorkflowNotificationCandidate[] = [];
  const base = {
    workflowId: record.id,
    sessionId: record.sessionId ?? null,
    propertyId: record.propertyId,
    propertyAddressLabel: record.propertyAddressLabel,
    shortlistId: record.shortlistId ?? null,
    moduleName: "offer_preparation" as const,
    relatedSubjectType: "offer_preparation",
    relatedSubjectId: record.id,
    explanationSubjectType: "offer_preparation",
    explanationSubjectId: record.id,
    actionTarget: actionTarget("offer_preparation", "offer_preparation", record.id)
  };

  for (const blocker of record.blockers) {
    candidates.push({
      ...base,
      alertCategory: blocker.severity === "blocking" ? "BLOCKER_ALERT" : "REQUIRED_ACTION",
      severity: blocker.severity === "blocking" ? "CRITICAL" : "WARNING",
      triggeringRuleLabel: `offer_preparation_blocker_${blocker.code.toLowerCase()}`,
      title: "Offer draft needs changes",
      message: `${blocker.message} ${blocker.howToFix}`,
      actionLabel: record.nextAction
    });
  }

  if (record.readinessToSubmit && record.offerState === "READY") {
    candidates.push({
      ...base,
      alertCategory: "STATE_CHANGE",
      severity: "INFO",
      triggeringRuleLabel: "offer_preparation_ready_to_submit",
      title: "Offer is ready to submit",
      message: "Your offer draft is complete and ready to move into submission tracking.",
      actionLabel: "Proceed to offer submission"
    });
  }

  return candidates;
}

function buildOfferSubmissionNotifications(
  record: OfferSubmission,
  now: string
): WorkflowNotificationCandidate[] {
  const candidates: WorkflowNotificationCandidate[] = [];
  const base = {
    workflowId: record.id,
    sessionId: record.sessionId ?? null,
    propertyId: record.propertyId,
    propertyAddressLabel: record.propertyAddressLabel,
    shortlistId: record.shortlistId ?? null,
    moduleName: "offer_submission" as const,
    relatedSubjectType: "offer_submission",
    relatedSubjectId: record.id,
    explanationSubjectType: "offer_submission",
    explanationSubjectId: record.id,
    actionTarget: actionTarget("offer_submission", "offer_submission", record.id)
  };

  if (record.submissionState === "READY_TO_SUBMIT") {
    candidates.push({
      ...base,
      alertCategory: "REQUIRED_ACTION",
      severity: "INFO",
      triggeringRuleLabel: "offer_submission_ready_to_submit",
      title: "Offer is ready to submit",
      message: "Your offer terms are complete. The next step is to record the submission.",
      actionLabel: "Submit offer"
    });
  }

  if (record.submissionState === "SUBMITTED" && record.sellerResponseState === "NO_RESPONSE") {
    candidates.push({
      ...base,
      alertCategory: "REMINDER",
      severity: "INFO",
      triggeringRuleLabel: "offer_submission_awaiting_response",
      title: "Offer is awaiting seller response",
      message: "Your offer has been submitted and is still waiting for a seller response.",
      actionLabel: "Wait for seller response"
    });
  }

  if (record.offerExpirationAt && !record.isExpired && record.submissionState === "SUBMITTED") {
    const hours = hoursUntil(record.offerExpirationAt, now);
    if (hours <= 24 && hours > 0) {
      candidates.push({
        ...base,
        alertCategory: "DEADLINE_ALERT",
        severity: "CRITICAL",
        triggeringRuleLabel: "offer_submission_expiration_24h",
        title: "Offer expires within 24 hours",
        message: "Your submitted offer will expire soon if the seller does not respond in time.",
        actionLabel: "Review offer expiration",
        dueAt: record.offerExpirationAt
      });
    } else if (hours <= 72 && hours > 0) {
      candidates.push({
        ...base,
        alertCategory: "DEADLINE_ALERT",
        severity: "WARNING",
        triggeringRuleLabel: "offer_submission_expiration_72h",
        title: "Offer expiration is approaching",
        message: "Your submitted offer expires within the next 72 hours.",
        actionLabel: "Review offer expiration",
        dueAt: record.offerExpirationAt
      });
    }
  }

  if (record.submissionState === "COUNTERED") {
    candidates.push({
      ...base,
      alertCategory: "STATE_CHANGE",
      severity: "WARNING",
      triggeringRuleLabel: "offer_submission_countered",
      title: "Counteroffer received",
      message: "The seller responded with changed terms and your review is required.",
      actionLabel: "Review counteroffer",
      dueAt: record.counterofferExpirationAt ?? null
    });
  }

  if (record.submissionState === "ACCEPTED") {
    candidates.push({
      ...base,
      alertCategory: "MILESTONE_ALERT",
      severity: "INFO",
      triggeringRuleLabel: "offer_submission_accepted",
      title: "Offer accepted",
      message: "Your offer was accepted and you can now move into under-contract coordination.",
      actionLabel: "Start under-contract coordination"
    });
  }

  if (record.submissionState === "REJECTED") {
    candidates.push({
      ...base,
      alertCategory: "STATE_CHANGE",
      severity: "WARNING",
      triggeringRuleLabel: "offer_submission_rejected",
      title: "Offer was not accepted",
      message: "The seller rejected this offer. Review your next step before submitting again.",
      actionLabel: record.nextAction
    });
  }

  if (record.submissionState === "EXPIRED") {
    candidates.push({
      ...base,
      alertCategory: "DEADLINE_ALERT",
      severity: "CRITICAL",
      triggeringRuleLabel: "offer_submission_expired",
      title: "Offer expired",
      message: "This offer expired before the seller accepted it or before a pending counter was resolved.",
      actionLabel: record.nextAction,
      dueAt: record.offerExpirationAt ?? record.counterofferExpirationAt ?? null
    });
  }

  return candidates;
}

function buildUnderContractNotifications(
  record: UnderContractCoordination,
  now: string
): WorkflowNotificationCandidate[] {
  const candidates: WorkflowNotificationCandidate[] = [];
  const base = {
    workflowId: record.id,
    sessionId: record.sessionId ?? null,
    propertyId: record.propertyId,
    propertyAddressLabel: record.propertyAddressLabel,
    shortlistId: record.shortlistId ?? null,
    moduleName: "under_contract" as const,
    relatedSubjectType: "under_contract",
    relatedSubjectId: record.id,
    explanationSubjectType: "under_contract",
    explanationSubjectId: record.id,
    actionTarget: actionTarget("under_contract", "under_contract", record.id)
  };

  for (const blocker of record.blockers) {
    const severity =
      blocker.code === "FINANCING_BLOCKED" ||
      blocker.code === "TITLE_BLOCKED" ||
      blocker.code === "ESCROW_BLOCKED"
        ? "CRITICAL"
        : blocker.severity === "blocking"
          ? "CRITICAL"
          : "WARNING";
    candidates.push({
      ...base,
      alertCategory: "BLOCKER_ALERT",
      severity,
      triggeringRuleLabel: `under_contract_blocker_${blocker.code.toLowerCase()}`,
      title: "Contract task is blocked",
      message: `${blocker.message} ${blocker.howToFix}`,
      actionLabel: record.nextAction
    });
  }

  for (const deadline of record.deadlineSummaries) {
    if (!deadline.deadline || deadline.status === "COMPLETED") {
      continue;
    }

    if (deadline.status === "MISSED") {
      candidates.push({
        ...base,
        alertCategory: "DEADLINE_ALERT",
        severity: "CRITICAL",
        triggeringRuleLabel: `under_contract_deadline_missed_${deadline.key}`,
        title: `${deadline.label} is overdue`,
        message: `The ${deadline.label.toLowerCase()} passed before the related task was resolved.`,
        actionLabel: record.nextAction,
        dueAt: deadline.deadline
      });
      continue;
    }

    const hours = hoursUntil(deadline.deadline, now);
    if (hours <= 24 && hours > 0) {
      candidates.push({
        ...base,
        alertCategory: "DEADLINE_ALERT",
        severity: "CRITICAL",
        triggeringRuleLabel: `under_contract_deadline_24h_${deadline.key}`,
        title: `${deadline.label} is due within 24 hours`,
        message: `The ${deadline.label.toLowerCase()} is approaching and the related work is still incomplete.`,
        actionLabel: record.nextAction,
        dueAt: deadline.deadline
      });
    } else if (hours <= 72 && hours > 0) {
      candidates.push({
        ...base,
        alertCategory: "DEADLINE_ALERT",
        severity: "WARNING",
        triggeringRuleLabel: `under_contract_deadline_72h_${deadline.key}`,
        title: `${deadline.label} is approaching`,
        message: `The ${deadline.label.toLowerCase()} is due within the next 72 hours.`,
        actionLabel: record.nextAction,
        dueAt: deadline.deadline
      });
    }
  }

  if (record.readyForClosing && record.overallCoordinationState === "READY_FOR_CLOSING") {
    candidates.push({
      ...base,
      alertCategory: "MILESTONE_ALERT",
      severity: "INFO",
      triggeringRuleLabel: "under_contract_ready_for_closing",
      title: "Under-contract work is ready for closing",
      message: "The required contract tasks are complete enough to move into closing readiness.",
      actionLabel: "Proceed to closing readiness"
    });
  }

  return candidates;
}

function buildClosingReadinessNotifications(
  record: ClosingReadiness,
  now: string
): WorkflowNotificationCandidate[] {
  const candidates: WorkflowNotificationCandidate[] = [];
  const base = {
    workflowId: record.id,
    sessionId: record.sessionId ?? null,
    propertyId: record.propertyId,
    propertyAddressLabel: record.propertyAddressLabel,
    shortlistId: record.shortlistId ?? null,
    moduleName: "closing_readiness" as const,
    relatedSubjectType: "closing_readiness",
    relatedSubjectId: record.id,
    explanationSubjectType: "closing_readiness",
    explanationSubjectId: record.id,
    actionTarget: actionTarget("closing_readiness", "closing_readiness", record.id)
  };

  for (const blocker of record.blockers) {
    const severity =
      blocker.code === "FINAL_FUNDS_NOT_READY" ||
      blocker.code === "TITLE_SETTLEMENT_BLOCKED" ||
      blocker.code === "TARGET_CLOSING_DATE_MISSED"
        ? "CRITICAL"
        : blocker.severity === "blocking"
          ? "CRITICAL"
          : "WARNING";
    candidates.push({
      ...base,
      alertCategory: "BLOCKER_ALERT",
      severity,
      triggeringRuleLabel: `closing_readiness_blocker_${blocker.code.toLowerCase()}`,
      title: "Closing readiness needs action",
      message: `${blocker.message} ${blocker.howToFix}`,
      actionLabel: record.nextAction
    });
  }

  if (record.closingAppointmentAt && !record.closed) {
    const hours = hoursUntil(record.closingAppointmentAt, now);
    if (hours <= 24 && hours > 0) {
      candidates.push({
        ...base,
        alertCategory: "DEADLINE_ALERT",
        severity: "WARNING",
        triggeringRuleLabel: "closing_appointment_24h",
        title: "Closing appointment is within 24 hours",
        message: "Your closing appointment is approaching soon. Confirm the remaining final items now.",
        actionLabel: record.nextAction,
        dueAt: record.closingAppointmentAt
      });
    } else if (hours <= 72 && hours > 0) {
      candidates.push({
        ...base,
        alertCategory: "DEADLINE_ALERT",
        severity: "INFO",
        triggeringRuleLabel: "closing_appointment_72h",
        title: "Closing appointment is scheduled soon",
        message: "Your closing appointment is coming up within the next 72 hours.",
        actionLabel: record.nextAction,
        dueAt: record.closingAppointmentAt
      });
    }
  }

  const fundsChecklist = record.checklistItemSummaries.find(
    (entry) => entry.itemType === "FINAL_FUNDS_AVAILABLE"
  );
  if (
    fundsChecklist &&
    fundsChecklist.status !== "COMPLETED" &&
    record.finalFundsConfirmationDeadline
  ) {
    const hours = hoursUntil(record.finalFundsConfirmationDeadline, now);
    if (hours <= 24 && hours > 0) {
      candidates.push({
        ...base,
        alertCategory: "REQUIRED_ACTION",
        severity: "CRITICAL",
        triggeringRuleLabel: "closing_final_funds_24h",
        title: "Final funds still need confirmation",
        message: "Your final funds are not confirmed and the funds confirmation deadline is within 24 hours.",
        actionLabel: "Confirm final funds",
        dueAt: record.finalFundsConfirmationDeadline
      });
    } else if (hours <= 72 && hours > 0) {
      candidates.push({
        ...base,
        alertCategory: "REQUIRED_ACTION",
        severity: "WARNING",
        triggeringRuleLabel: "closing_final_funds_72h",
        title: "Final funds still need confirmation",
        message: "Your final funds are not yet confirmed for closing.",
        actionLabel: "Confirm final funds",
        dueAt: record.finalFundsConfirmationDeadline
      });
    }
  }

  if (record.readyToClose && record.overallClosingReadinessState === "READY_TO_CLOSE") {
    candidates.push({
      ...base,
      alertCategory: "MILESTONE_ALERT",
      severity: "INFO",
      triggeringRuleLabel: "closing_ready_to_close",
      title: "Ready to close",
      message: "The final closing checklist is complete enough to proceed to close.",
      actionLabel: "Proceed to close"
    });
  }

  if (record.closed) {
    candidates.push({
      ...base,
      alertCategory: "MILESTONE_ALERT",
      severity: "INFO",
      triggeringRuleLabel: "closing_completed",
      title: "Closing recorded",
      message: "This transaction is marked closed.",
      actionLabel: "Review completed transaction summary"
    });
  }

  return candidates;
}

function buildCommandCenterNotifications(
  summary: BuyerTransactionCommandCenterView
): WorkflowNotificationCandidate[] {
  const candidates: WorkflowNotificationCandidate[] = [];
  const base = {
    workflowId: summary.sourceRefs.closingReadinessId ??
      summary.sourceRefs.underContractCoordinationId ??
      summary.sourceRefs.offerSubmissionId ??
      summary.sourceRefs.offerPreparationId ??
      summary.sourceRefs.financialReadinessId ??
      summary.propertyId,
    sessionId: summary.sessionId ?? null,
    propertyId: summary.propertyId,
    propertyAddressLabel: summary.propertyAddressLabel,
    shortlistId: summary.shortlistId ?? null,
    moduleName: "transaction_command_center" as const,
    relatedSubjectType: "transaction_command_center",
    relatedSubjectId: summary.propertyId,
    explanationSubjectType: "transaction_command_center",
    explanationSubjectId: summary.propertyId,
    actionTarget: actionTarget("transaction_command_center", "transaction_command_center", summary.propertyId)
  };

  if (summary.overallState === "BLOCKED") {
    candidates.push({
      ...base,
      alertCategory: "STATE_CHANGE",
      severity: "CRITICAL",
      triggeringRuleLabel: "transaction_command_center_blocked",
      title: "Transaction is blocked",
      message: summary.primaryBlocker?.message ?? "The current stage is blocked and needs attention.",
      actionLabel: summary.nextAction
    });
  } else if (summary.overallState === "AT_RISK") {
    candidates.push({
      ...base,
      alertCategory: "RISK_ALERT",
      severity: summary.overallRiskLevel === "HIGH_RISK" ? "CRITICAL" : "WARNING",
      triggeringRuleLabel: "transaction_command_center_at_risk",
      title: "Transaction is at risk",
      message: summary.primaryRisk?.message ?? "The current transaction stage has time-sensitive risk.",
      actionLabel: summary.nextAction,
      dueAt: summary.primaryRisk?.dueAt ?? null
    });
  } else if (summary.overallState === "READY_TO_ADVANCE") {
    candidates.push({
      ...base,
      alertCategory: "MILESTONE_ALERT",
      severity: "INFO",
      triggeringRuleLabel: "transaction_command_center_ready_to_advance",
      title: "Ready to advance",
      message: `The current stage is complete enough to move into ${lower(summary.currentStage)} follow-through.`,
      actionLabel: summary.nextAction
    });
  } else if (summary.overallState === "COMPLETE") {
    candidates.push({
      ...base,
      alertCategory: "MILESTONE_ALERT",
      severity: "INFO",
      triggeringRuleLabel: "transaction_command_center_complete",
      title: "Transaction complete",
      message: "This homebuying workflow is marked complete.",
      actionLabel: summary.nextAction
    });
  }

  return candidates;
}

export function buildWorkflowNotificationCandidates(args: {
  now: string;
  financialReadiness?: FinancialReadiness | null;
  offerPreparation?: OfferPreparation | null;
  offerSubmission?: OfferSubmission | null;
  underContract?: UnderContractCoordination | null;
  closingReadiness?: ClosingReadiness | null;
  commandCenter?: BuyerTransactionCommandCenterView | null;
}): WorkflowNotificationCandidate[] {
  const candidates: WorkflowNotificationCandidate[] = [];

  if (args.financialReadiness) {
    candidates.push(...buildFinancialReadinessNotifications(args.financialReadiness));
  }
  if (args.offerPreparation) {
    candidates.push(...buildOfferPreparationNotifications(args.offerPreparation));
  }
  if (args.offerSubmission) {
    candidates.push(...buildOfferSubmissionNotifications(args.offerSubmission, args.now));
  }
  if (args.underContract) {
    candidates.push(...buildUnderContractNotifications(args.underContract, args.now));
  }
  if (args.closingReadiness) {
    candidates.push(...buildClosingReadinessNotifications(args.closingReadiness, args.now));
  }
  if (args.commandCenter) {
    candidates.push(...buildCommandCenterNotifications(args.commandCenter));
  }

  return candidates;
}

export function planWorkflowNotificationSync(args: {
  now: string;
  candidates: WorkflowNotificationCandidate[];
  existing: WorkflowNotification[];
}): NotificationSyncPlan {
  const existingByKey = new Map<string, WorkflowNotification>();
  for (const notification of args.existing) {
    const key = dedupeKey(notification);
    const current = existingByKey.get(key);
    if (!current || current.updatedAt.localeCompare(notification.updatedAt) < 0) {
      existingByKey.set(key, notification);
    }
  }

  const create: WorkflowNotificationCandidate[] = [];
  const update: NotificationSyncPlan["update"] = [];
  const seenKeys = new Set<string>();

  for (const candidate of args.candidates) {
    const key = dedupeKey(candidate);
    seenKeys.add(key);
    const existing = existingByKey.get(key);

    if (!existing || existing.status === "RESOLVED") {
      create.push(candidate);
      continue;
    }

    const patch: NotificationSyncPlan["update"][number]["patch"] = {};
    if (existing.severity !== candidate.severity) {
      patch.severity = candidate.severity;
    }
    if (existing.title !== candidate.title) {
      patch.title = candidate.title;
    }
    if (existing.message !== candidate.message) {
      patch.message = candidate.message;
    }
    if (existing.actionLabel !== (candidate.actionLabel ?? null)) {
      patch.actionLabel = candidate.actionLabel ?? null;
    }
    if (JSON.stringify(existing.actionTarget) !== JSON.stringify(candidate.actionTarget ?? null)) {
      patch.actionTarget = candidate.actionTarget ?? null;
    }
    if ((existing.dueAt ?? null) !== (candidate.dueAt ?? null)) {
      patch.dueAt = candidate.dueAt ?? null;
    }
    if ((existing.explanationSubjectType ?? null) !== (candidate.explanationSubjectType ?? null)) {
      patch.explanationSubjectType = candidate.explanationSubjectType ?? null;
    }
    if ((existing.explanationSubjectId ?? null) !== (candidate.explanationSubjectId ?? null)) {
      patch.explanationSubjectId = candidate.explanationSubjectId ?? null;
    }

    if (Object.keys(patch).length > 0) {
      update.push({
        id: existing.id,
        patch
      });
    }
  }

  for (const notification of args.existing) {
    if (notification.status === "RESOLVED") {
      continue;
    }
    const key = dedupeKey(notification);
    if (seenKeys.has(key)) {
      continue;
    }
    update.push({
      id: notification.id,
      patch: {
        status: "RESOLVED",
        resolvedAt: args.now
      }
    });
  }

  return { create, update };
}
