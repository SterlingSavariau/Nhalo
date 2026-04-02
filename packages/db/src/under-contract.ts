import type {
  ContractTaskRecord,
  ContractTaskState,
  ContractTaskType,
  CoordinationDeadlineRecord,
  CoordinationMilestoneRecord,
  CoordinationMilestoneType,
  CoordinationRiskLevel,
  FinancialReadiness,
  OfferPreparation,
  OfferSubmission,
  OfferSubmissionSellerResponseState,
  UnderContractBlocker,
  UnderContractCoordination,
  UnderContractCoordinationActivityEntry,
  UnderContractCoordinationInputs,
  UnderContractCoordinationState,
  UnderContractCoordinationSummary
} from "@nhalo/types";

type UnderContractEvaluationInput = {
  now: string;
  offerSubmission: OfferSubmission;
  offerPreparation?: OfferPreparation | null;
  financialReadiness?: FinancialReadiness | null;
  current?: UnderContractCoordination | null;
  patch?: Partial<UnderContractCoordinationInputs>;
  sessionId?: string | null;
  partnerId?: string | null;
};

const DEADLINE_RULES = {
  highHours: 24,
  moderateHours: 72
} as const;

const TASK_LABELS: Record<ContractTaskType, string> = {
  HOME_INSPECTION: "Home inspection",
  APPRAISAL: "Appraisal",
  FINANCING_PROGRESS: "Financing progress",
  TITLE_REVIEW: "Title review",
  ESCROW_CLOSING_COORDINATION: "Escrow and closing coordination",
  CONTINGENCY_REVIEW: "Contingency review",
  DOCUMENT_CHECKLIST: "Document checklist"
};

const MILESTONE_LABELS: Record<CoordinationMilestoneType, string> = {
  OFFER_ACCEPTED: "Offer accepted",
  INSPECTION_SCHEDULED: "Inspection scheduled",
  INSPECTION_COMPLETED: "Inspection completed",
  APPRAISAL_ORDERED_OR_SCHEDULED: "Appraisal scheduled",
  APPRAISAL_COMPLETED: "Appraisal completed",
  FINANCING_PROGRESS_CONFIRMED: "Financing progressing",
  TITLE_ESCROW_IN_PROGRESS: "Title and escrow progressing",
  CONTRACT_CONDITIONS_SATISFIED: "Contract conditions satisfied",
  READY_FOR_CLOSING: "Ready for closing"
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function hasValue(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return value !== null && value !== undefined;
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

function deriveAcceptedTerms(offerSubmission: OfferSubmission, offerPreparation?: OfferPreparation | null) {
  const original = offerSubmission.originalOfferSnapshot;
  const acceptedCounter =
    offerSubmission.sellerResponseState === "COUNTERED" &&
    offerSubmission.buyerCounterDecision === "accepted";

  return {
    offerPrice:
      acceptedCounter && offerSubmission.counterofferPrice !== null
        ? offerSubmission.counterofferPrice
        : offerSubmission.submissionSummary.currentOfferPrice ?? original.offerPrice ?? offerPreparation?.offerPrice ?? null,
    earnestMoneyAmount:
      offerSubmission.submissionSummary.earnestMoneyAmount ?? original.earnestMoneyAmount ?? offerPreparation?.earnestMoneyAmount ?? null,
    financingContingency:
      acceptedCounter && offerSubmission.counterofferFinancingContingency !== null
        ? offerSubmission.counterofferFinancingContingency
        : original.financingContingency ?? offerPreparation?.financingContingency ?? null,
    inspectionContingency:
      acceptedCounter && offerSubmission.counterofferInspectionContingency !== null
        ? offerSubmission.counterofferInspectionContingency
        : original.inspectionContingency ?? offerPreparation?.inspectionContingency ?? null,
    appraisalContingency:
      acceptedCounter && offerSubmission.counterofferAppraisalContingency !== null
        ? offerSubmission.counterofferAppraisalContingency
        : original.appraisalContingency ?? offerPreparation?.appraisalContingency ?? null,
    closingTimelineDays:
      acceptedCounter && offerSubmission.counterofferClosingTimelineDays !== null
        ? offerSubmission.counterofferClosingTimelineDays
        : offerSubmission.submissionSummary.closingTimelineDays ?? original.closingTimelineDays ?? offerPreparation?.closingTimelineDays ?? null
  };
}

function buildDefaultTasks(
  inputs: UnderContractCoordinationInputs,
  acceptedTerms: ReturnType<typeof deriveAcceptedTerms>,
  current?: UnderContractCoordination | null
): ContractTaskRecord[] {
  const existing = new Map((current?.taskSummaries ?? []).map((task) => [task.taskType, task]));
  const inspectionRequired = acceptedTerms.inspectionContingency !== "waived";
  const appraisalRequired = acceptedTerms.appraisalContingency !== "waived";
  const contingencyRequired =
    acceptedTerms.financingContingency === "included" ||
    acceptedTerms.inspectionContingency === "included" ||
    acceptedTerms.appraisalContingency === "included";

  const baseTasks: Array<{
    taskType: ContractTaskType;
    required: boolean;
    waivable: boolean;
    deadline: string | null;
    waivedByTerms?: boolean;
  }> = [
    {
      taskType: "HOME_INSPECTION",
      required: inspectionRequired,
      waivable: true,
      deadline: inputs.inspectionDeadline ?? null,
      waivedByTerms: !inspectionRequired
    },
    {
      taskType: "APPRAISAL",
      required: appraisalRequired,
      waivable: true,
      deadline: inputs.appraisalDeadline ?? null,
      waivedByTerms: !appraisalRequired
    },
    {
      taskType: "FINANCING_PROGRESS",
      required: true,
      waivable: false,
      deadline: inputs.financingDeadline ?? null
    },
    {
      taskType: "TITLE_REVIEW",
      required: true,
      waivable: false,
      deadline: inputs.closingPreparationDeadline ?? inputs.targetClosingDate
    },
    {
      taskType: "ESCROW_CLOSING_COORDINATION",
      required: true,
      waivable: false,
      deadline: inputs.targetClosingDate
    },
    {
      taskType: "CONTINGENCY_REVIEW",
      required: contingencyRequired,
      waivable: true,
      deadline: inputs.contingencyDeadline ?? null,
      waivedByTerms: !contingencyRequired
    },
    {
      taskType: "DOCUMENT_CHECKLIST",
      required: true,
      waivable: false,
      deadline: inputs.closingPreparationDeadline ?? inputs.targetClosingDate
    }
  ];

  return baseTasks.map((definition) => {
    const previous = existing.get(definition.taskType);
    const status =
      previous?.status ??
      (definition.waivedByTerms ? "WAIVED" : "NOT_STARTED");

    return {
      taskType: definition.taskType,
      label: TASK_LABELS[definition.taskType],
      status,
      required: definition.required,
      waivable: definition.waivable,
      deadline: definition.deadline ?? previous?.deadline ?? null,
      scheduledAt: previous?.scheduledAt ?? null,
      completedAt: previous?.completedAt ?? null,
      blockedReason: previous?.blockedReason ?? null,
      notes: previous?.notes ?? null
    };
  });
}

function buildDeadlineSummaries(
  now: string,
  tasks: ContractTaskRecord[],
  inputs: UnderContractCoordinationInputs
): CoordinationDeadlineRecord[] {
  const taskLookup = new Map(tasks.map((task) => [task.taskType, task]));
  const definitions: CoordinationDeadlineRecord[] = [
    {
      key: "inspection",
      label: "Inspection deadline",
      deadline: inputs.inspectionDeadline ?? null,
      status: "NORMAL",
      relatedTaskType: "HOME_INSPECTION"
    },
    {
      key: "appraisal",
      label: "Appraisal deadline",
      deadline: inputs.appraisalDeadline ?? null,
      status: "NORMAL",
      relatedTaskType: "APPRAISAL"
    },
    {
      key: "financing",
      label: "Financing deadline",
      deadline: inputs.financingDeadline ?? null,
      status: "NORMAL",
      relatedTaskType: "FINANCING_PROGRESS"
    },
    {
      key: "contingency",
      label: "Contingency deadline",
      deadline: inputs.contingencyDeadline ?? null,
      status: "NORMAL",
      relatedTaskType: "CONTINGENCY_REVIEW"
    },
    {
      key: "closing",
      label: "Target closing date",
      deadline: inputs.targetClosingDate,
      status: "NORMAL",
      relatedTaskType: "ESCROW_CLOSING_COORDINATION"
    }
  ];

  return definitions.map((entry) => {
    const hours = hoursUntil(now, entry.deadline);
    const relatedTask = entry.relatedTaskType ? taskLookup.get(entry.relatedTaskType) : null;
    const resolved = relatedTask
      ? relatedTask.status === "COMPLETED" || relatedTask.status === "WAIVED"
      : false;

    let status: CoordinationDeadlineRecord["status"] = "NORMAL";
    if (!entry.deadline) {
      status = "MISSED";
    } else if (!resolved && hours !== null) {
      if (hours < 0) {
        status = "MISSED";
      } else if (hours <= DEADLINE_RULES.highHours) {
        status = "DUE_SOON";
      } else if (hours <= DEADLINE_RULES.moderateHours) {
        status = "APPROACHING";
      }
    }

    return {
      ...entry,
      status
    };
  });
}

function buildMilestones(
  current: UnderContractCoordination | null | undefined,
  tasks: ContractTaskRecord[],
  offerSubmission: OfferSubmission,
  acceptedAt: string,
  readyForClosing: boolean
): CoordinationMilestoneRecord[] {
  const existing = new Map((current?.milestoneSummaries ?? []).map((milestone) => [milestone.milestoneType, milestone]));
  const taskLookup = new Map(tasks.map((task) => [task.taskType, task]));

  const milestoneStatus = (type: CoordinationMilestoneType): CoordinationMilestoneRecord => {
    const previous = existing.get(type);
    const offerAccepted = offerSubmission.submissionState === "ACCEPTED";
    let status: CoordinationMilestoneRecord["status"] = previous?.status ?? "PENDING";
    let occurredAt = previous?.occurredAt ?? null;

    switch (type) {
      case "OFFER_ACCEPTED":
        status = offerAccepted ? "REACHED" : "BLOCKED";
        occurredAt = offerAccepted ? acceptedAt : occurredAt;
        break;
      case "INSPECTION_SCHEDULED":
        if ((taskLookup.get("HOME_INSPECTION")?.status ?? "WAIVED") === "WAIVED") {
          status = "REACHED";
        } else if (taskLookup.get("HOME_INSPECTION")?.scheduledAt) {
          status = "REACHED";
          occurredAt = taskLookup.get("HOME_INSPECTION")?.scheduledAt ?? occurredAt;
        }
        break;
      case "INSPECTION_COMPLETED":
        if ((taskLookup.get("HOME_INSPECTION")?.status ?? "WAIVED") === "WAIVED") {
          status = "REACHED";
        } else if (taskLookup.get("HOME_INSPECTION")?.completedAt) {
          status = "REACHED";
          occurredAt = taskLookup.get("HOME_INSPECTION")?.completedAt ?? occurredAt;
        }
        break;
      case "APPRAISAL_ORDERED_OR_SCHEDULED":
        if ((taskLookup.get("APPRAISAL")?.status ?? "WAIVED") === "WAIVED") {
          status = "REACHED";
        } else if (
          taskLookup.get("APPRAISAL")?.scheduledAt ||
          taskLookup.get("APPRAISAL")?.status === "IN_PROGRESS"
        ) {
          status = "REACHED";
          occurredAt = taskLookup.get("APPRAISAL")?.scheduledAt ?? occurredAt;
        }
        break;
      case "APPRAISAL_COMPLETED":
        if ((taskLookup.get("APPRAISAL")?.status ?? "WAIVED") === "WAIVED") {
          status = "REACHED";
        } else if (taskLookup.get("APPRAISAL")?.completedAt) {
          status = "REACHED";
          occurredAt = taskLookup.get("APPRAISAL")?.completedAt ?? occurredAt;
        }
        break;
      case "FINANCING_PROGRESS_CONFIRMED":
        if (
          ["IN_PROGRESS", "COMPLETED"].includes(taskLookup.get("FINANCING_PROGRESS")?.status ?? "")
        ) {
          status = "REACHED";
          occurredAt =
            taskLookup.get("FINANCING_PROGRESS")?.completedAt ??
            taskLookup.get("FINANCING_PROGRESS")?.scheduledAt ??
            occurredAt;
        }
        break;
      case "TITLE_ESCROW_IN_PROGRESS":
        if (
          ["IN_PROGRESS", "COMPLETED"].includes(taskLookup.get("TITLE_REVIEW")?.status ?? "") ||
          ["IN_PROGRESS", "COMPLETED"].includes(taskLookup.get("ESCROW_CLOSING_COORDINATION")?.status ?? "")
        ) {
          status = "REACHED";
        }
        break;
      case "CONTRACT_CONDITIONS_SATISFIED":
        if (
          tasks.every((task) =>
            !task.required || task.status === "COMPLETED" || task.status === "WAIVED"
          )
        ) {
          status = "REACHED";
          occurredAt =
            tasks
              .map((task) => task.completedAt)
              .filter((value): value is string => Boolean(value))
              .sort()
              .at(-1) ?? occurredAt;
        }
        break;
      case "READY_FOR_CLOSING":
        if (readyForClosing) {
          status = "REACHED";
          occurredAt = occurredAt ?? new Date().toISOString();
        }
        break;
    }

    if (
      taskLookup.get("FINANCING_PROGRESS")?.status === "BLOCKED" &&
      (type === "FINANCING_PROGRESS_CONFIRMED" || type === "CONTRACT_CONDITIONS_SATISFIED")
    ) {
      status = "BLOCKED";
    }

    return {
      milestoneType: type,
      label: MILESTONE_LABELS[type],
      status,
      occurredAt,
      notes: previous?.notes ?? null
    };
  };

  return (Object.keys(MILESTONE_LABELS) as CoordinationMilestoneType[]).map(milestoneStatus);
}

function buildMissingItems(
  inputs: UnderContractCoordinationInputs,
  tasks: ContractTaskRecord[]
): UnderContractCoordination["missingItems"] {
  const missing: UnderContractCoordination["missingItems"] = [];

  if (!hasValue(inputs.targetClosingDate)) {
    missing.push({ field: "targetClosingDate", message: "Add a target closing date." });
  }

  if (!hasValue(inputs.inspectionDeadline) && tasks.some((task) => task.taskType === "HOME_INSPECTION" && task.required)) {
    missing.push({ field: "inspectionDeadline", message: "Add an inspection deadline." });
  }
  if (!hasValue(inputs.appraisalDeadline) && tasks.some((task) => task.taskType === "APPRAISAL" && task.required)) {
    missing.push({ field: "appraisalDeadline", message: "Add an appraisal deadline." });
  }
  if (!hasValue(inputs.financingDeadline)) {
    missing.push({ field: "financingDeadline", message: "Add a financing deadline." });
  }
  if (
    tasks.some((task) => task.taskType === "CONTINGENCY_REVIEW" && task.required) &&
    !hasValue(inputs.contingencyDeadline)
  ) {
    missing.push({ field: "contingencyDeadline", message: "Add a contingency deadline." });
  }

  return missing;
}

function buildBlockers(args: {
  offerSubmission: OfferSubmission;
  tasks: ContractTaskRecord[];
  deadlines: CoordinationDeadlineRecord[];
  missingItems: UnderContractCoordination["missingItems"];
}): UnderContractBlocker[] {
  const blockers: UnderContractBlocker[] = [];
  const taskLookup = new Map(args.tasks.map((task) => [task.taskType, task]));

  if (args.offerSubmission.submissionState !== "ACCEPTED") {
    blockers.push({
      code: "OFFER_NOT_ACCEPTED",
      severity: "blocking",
      message: "Under-contract coordination starts only after the offer is accepted.",
      whyItMatters: "There is no accepted contract to coordinate yet.",
      howToFix: "Use Offer Submission until the offer is accepted."
    });
  }

  if (args.missingItems.length > 0) {
    blockers.push({
      code: "MISSING_REQUIRED_DEADLINE",
      severity: "blocking",
      message: "One or more required deadlines are missing.",
      whyItMatters: "The buyer cannot safely track contract timing without core dates.",
      howToFix: "Fill in the missing contract deadlines."
    });
  }

  if (taskLookup.get("FINANCING_PROGRESS")?.status === "BLOCKED") {
    blockers.push({
      code: "FINANCING_BLOCKED",
      severity: "blocking",
      message: "Financing progress is blocked.",
      whyItMatters: "A blocked loan process can stop the transaction from closing.",
      howToFix: "Resolve the lender or document blocker before proceeding."
    });
  }

  if (taskLookup.get("TITLE_REVIEW")?.status === "BLOCKED") {
    blockers.push({
      code: "TITLE_BLOCKED",
      severity: "blocking",
      message: "Title review is blocked.",
      whyItMatters: "Title issues can stop closing and need review before the transaction can move forward.",
      howToFix: "Review the title issue and clear it before proceeding."
    });
  }

  if (taskLookup.get("ESCROW_CLOSING_COORDINATION")?.status === "BLOCKED") {
    blockers.push({
      code: "ESCROW_BLOCKED",
      severity: "blocking",
      message: "Escrow and closing coordination is blocked.",
      whyItMatters: "Closing logistics are not progressing as required.",
      howToFix: "Resolve the escrow or coordination issue."
    });
  }

  if (args.tasks.some((task) => task.required && task.status === "FAILED")) {
    blockers.push({
      code: "REQUIRED_TASK_FAILED",
      severity: "blocking",
      message: "A required contract task has failed.",
      whyItMatters: "Required steps must be resolved before the transaction can safely continue.",
      howToFix: "Resolve the failed task or create a new plan for the contract."
    });
  }

  if (
    args.deadlines.some(
      (deadline) => deadline.key === "contingency" && deadline.status === "MISSED"
    )
  ) {
    blockers.push({
      code: "CONTINGENCY_DEADLINE_MISSED",
      severity: "blocking",
      message: "A contingency deadline has passed without resolution.",
      whyItMatters: "Unresolved contingency deadlines create immediate contract risk.",
      howToFix: "Review the contingency status and decide the next contract action now."
    });
  }

  if (
    args.deadlines.some(
      (deadline) => deadline.key === "closing" && deadline.status === "MISSED"
    )
  ) {
    blockers.push({
      code: "CLOSING_DATE_AT_RISK",
      severity: "blocking",
      message: "The target closing date has passed or is no longer supportable.",
      whyItMatters: "The transaction is no longer on track for the planned close.",
      howToFix: "Review incomplete contract tasks and reset the closing plan."
    });
  }

  return blockers;
}

function determineRiskLevel(args: {
  tasks: ContractTaskRecord[];
  deadlines: CoordinationDeadlineRecord[];
  blockers: UnderContractBlocker[];
}): CoordinationRiskLevel {
  if (args.blockers.some((entry) => entry.severity === "blocking")) {
    return "HIGH_RISK";
  }

  if (
    args.deadlines.some((deadline) => deadline.status === "MISSED" || deadline.status === "DUE_SOON") ||
    args.tasks.some(
      (task) =>
        task.required &&
        (task.status === "BLOCKED" || task.status === "FAILED" || task.status === "NOT_STARTED")
    )
  ) {
    return "HIGH_RISK";
  }

  if (
    args.deadlines.some((deadline) => deadline.status === "APPROACHING") ||
    args.tasks.some((task) => task.required && task.status === "IN_PROGRESS")
  ) {
    return "MODERATE_RISK";
  }

  return "LOW_RISK";
}

function determineState(args: {
  tasks: ContractTaskRecord[];
  blockers: UnderContractBlocker[];
  riskLevel: CoordinationRiskLevel;
}): UnderContractCoordinationState {
  if (args.blockers.some((entry) => entry.severity === "blocking")) {
    return "BLOCKED";
  }

  const started = args.tasks.some((task) => task.status !== "NOT_STARTED");
  if (!started) {
    return "NOT_STARTED";
  }

  const ready = args.tasks.every(
    (task) => !task.required || task.status === "COMPLETED" || task.status === "WAIVED"
  );
  if (ready) {
    return "READY_FOR_CLOSING";
  }

  if (args.riskLevel === "HIGH_RISK") {
    return "AT_RISK";
  }

  return "IN_PROGRESS";
}

function buildRecommendationBundle(args: {
  state: UnderContractCoordinationState;
  riskLevel: CoordinationRiskLevel;
  tasks: ContractTaskRecord[];
  deadlines: CoordinationDeadlineRecord[];
  blockers: UnderContractBlocker[];
}): Pick<
  UnderContractCoordination,
  "recommendation" | "risk" | "alternative" | "nextAction" | "nextSteps" | "requiresImmediateAttention"
> {
  const taskLookup = new Map(args.tasks.map((task) => [task.taskType, task]));

  let nextAction = "Complete remaining contract tasks";
  let nextSteps = ["Complete remaining contract tasks"];
  let recommendation = "Keep the accepted-offer workflow moving by resolving the next required contract task.";
  let risk = "No major contract blocker is stored, but incomplete tasks can still delay closing.";
  let alternative =
    "If the current task is not ready to move, review the next nearest deadline and work from that instead.";

  if (args.blockers.some((entry) => entry.code === "OFFER_NOT_ACCEPTED")) {
    nextAction = "Confirm accepted offer";
    nextSteps = ["Confirm accepted offer"];
    recommendation = "The system cannot coordinate the contract until the accepted offer is recorded.";
    risk = "Without an accepted offer, there is no contract workflow to manage.";
    alternative = "Return to Offer Submission and record the accepted outcome first.";
  } else if (taskLookup.get("HOME_INSPECTION")?.required && taskLookup.get("HOME_INSPECTION")?.status === "NOT_STARTED") {
    nextAction = "Schedule inspection";
    nextSteps = ["Schedule inspection", "Track contingency deadline"];
    recommendation = "Inspection is the next buyer-side task and should be scheduled first.";
    risk = "An unscheduled inspection can compress the contingency window.";
    alternative = "If inspection was waived in final terms, keep the task marked waived and move to the next contract task.";
  } else if (
    taskLookup.get("HOME_INSPECTION")?.status === "COMPLETED" &&
    taskLookup.get("CONTINGENCY_REVIEW")?.required &&
    !["COMPLETED", "WAIVED"].includes(taskLookup.get("CONTINGENCY_REVIEW")?.status ?? "")
  ) {
    nextAction = "Review inspection results";
    nextSteps = ["Review inspection results", "Track contingency deadline"];
    recommendation = "Inspection is complete, so the buyer should review the result and decide the contingency path.";
    risk = "Delaying review can leave the contingency unresolved near its deadline.";
    alternative = "If no issues were found, mark contingency review complete and continue.";
  } else if (taskLookup.get("APPRAISAL")?.required && taskLookup.get("APPRAISAL")?.status === "NOT_STARTED") {
    nextAction = "Order or confirm appraisal";
    nextSteps = ["Order or confirm appraisal", "Track appraisal deadline"];
    recommendation = "Appraisal should be confirmed early enough to protect the closing timeline.";
    risk = "An unscheduled appraisal can threaten financing and closing timing.";
    alternative = "If appraisal was waived in accepted terms, keep the task waived and move on.";
  } else if (taskLookup.get("FINANCING_PROGRESS")?.status === "BLOCKED") {
    nextAction = "Resolve financing blocker";
    nextSteps = ["Resolve financing blocker", "Upload lender documents"];
    recommendation = "Financing is the primary blocker and needs immediate attention.";
    risk = "A blocked loan process can stop the transaction from closing on time.";
    alternative = "If the blocker cannot be resolved quickly, review whether the closing plan needs to change.";
  } else if (taskLookup.get("FINANCING_PROGRESS")?.status === "NOT_STARTED") {
    nextAction = "Upload lender documents";
    nextSteps = ["Upload lender documents", "Track financing deadline"];
    recommendation = "Financing should move into progress as soon as the contract is accepted.";
    risk = "Leaving financing untouched can push the transaction into an avoidable deadline crunch.";
    alternative = "If documents are already submitted outside the system, update the task to reflect current progress.";
  } else if (taskLookup.get("TITLE_REVIEW")?.status === "BLOCKED") {
    nextAction = "Review title issue";
    nextSteps = ["Review title issue", "Complete remaining contract tasks"];
    recommendation = "Title issues should be reviewed immediately because they can stop closing.";
    risk = "An unresolved title issue can block the transaction entirely.";
    alternative = "If title is progressing normally, clear the blocker and continue with escrow coordination.";
  } else if (
    args.deadlines.some(
      (deadline) => deadline.key === "contingency" && ["APPROACHING", "DUE_SOON", "MISSED"].includes(deadline.status)
    )
  ) {
    nextAction = "Track contingency deadline";
    nextSteps = ["Track contingency deadline", "Complete remaining contract tasks"];
    recommendation = "The contingency timeline needs attention before the contract risk increases further.";
    risk = "A missed or near-due contingency can change the buyer's protections.";
    alternative = "If the contingency is already resolved, update the task and milestone now.";
  } else if (args.state === "READY_FOR_CLOSING") {
    nextAction = "Proceed to closing readiness";
    nextSteps = ["Proceed to closing readiness"];
    recommendation = "The accepted-offer workflow is complete enough to hand off into closing readiness.";
    risk = "No active buyer-side blocker is stored in the current contract workflow.";
    alternative = "If something changes before closing, reopen the affected task instead of silently assuming readiness.";
  }

  return {
    recommendation,
    risk,
    alternative,
    nextAction,
    nextSteps,
    requiresImmediateAttention:
      args.riskLevel === "HIGH_RISK" || args.deadlines.some((deadline) => deadline.status === "DUE_SOON")
  };
}

export function evaluateUnderContractCoordination(
  input: UnderContractEvaluationInput
): UnderContractCoordination {
  const current = input.current ?? null;
  const now = input.now;
  const acceptedTerms = deriveAcceptedTerms(input.offerSubmission, input.offerPreparation);

  const inputs: UnderContractCoordinationInputs = {
    propertyId: input.patch?.propertyId ?? current?.propertyId ?? input.offerSubmission.propertyId,
    propertyAddressLabel:
      input.patch?.propertyAddressLabel ??
      current?.propertyAddressLabel ??
      input.offerSubmission.propertyAddressLabel,
    shortlistId:
      input.patch?.shortlistId ?? current?.shortlistId ?? input.offerSubmission.shortlistId ?? null,
    financialReadinessId:
      input.patch?.financialReadinessId ??
      current?.financialReadinessId ??
      input.offerSubmission.financialReadinessId ??
      input.offerPreparation?.financialReadinessId ??
      null,
    offerPreparationId:
      input.patch?.offerPreparationId ??
      current?.offerPreparationId ??
      input.offerSubmission.offerPreparationId ??
      null,
    offerSubmissionId:
      input.patch?.offerSubmissionId ?? current?.offerSubmissionId ?? input.offerSubmission.id,
    acceptedAt:
      input.patch?.acceptedAt ??
      current?.acceptedAt ??
      input.offerSubmission.sellerRespondedAt ??
      input.offerSubmission.lastActionAt ??
      now,
    targetClosingDate:
      input.patch?.targetClosingDate ??
      current?.targetClosingDate ??
      (acceptedTerms.closingTimelineDays
        ? new Date(new Date(input.offerSubmission.sellerRespondedAt ?? now).getTime() + acceptedTerms.closingTimelineDays * 86_400_000).toISOString()
        : now),
    inspectionDeadline:
      input.patch?.inspectionDeadline ??
      current?.inspectionDeadline ??
      (acceptedTerms.inspectionContingency === "included"
        ? new Date(new Date(input.offerSubmission.sellerRespondedAt ?? now).getTime() + 7 * 86_400_000).toISOString()
        : null),
    appraisalDeadline:
      input.patch?.appraisalDeadline ??
      current?.appraisalDeadline ??
      (acceptedTerms.appraisalContingency === "included"
        ? new Date(new Date(input.offerSubmission.sellerRespondedAt ?? now).getTime() + 14 * 86_400_000).toISOString()
        : null),
    financingDeadline:
      input.patch?.financingDeadline ??
      current?.financingDeadline ??
      new Date(new Date(input.offerSubmission.sellerRespondedAt ?? now).getTime() + 21 * 86_400_000).toISOString(),
    contingencyDeadline:
      input.patch?.contingencyDeadline ??
      current?.contingencyDeadline ??
      ((acceptedTerms.financingContingency === "included" ||
        acceptedTerms.inspectionContingency === "included" ||
        acceptedTerms.appraisalContingency === "included")
        ? new Date(new Date(input.offerSubmission.sellerRespondedAt ?? now).getTime() + 10 * 86_400_000).toISOString()
        : null),
    closingPreparationDeadline:
      input.patch?.closingPreparationDeadline ?? current?.closingPreparationDeadline ?? null,
    notes: input.patch?.notes ?? current?.notes ?? null,
    internalActivityNote: input.patch?.internalActivityNote ?? current?.internalActivityNote ?? null
  };

  const tasks = buildDefaultTasks(inputs, acceptedTerms, current);
  const deadlines = buildDeadlineSummaries(now, tasks, inputs);
  const missingItems = buildMissingItems(inputs, tasks);
  const blockers = buildBlockers({
    offerSubmission: input.offerSubmission,
    tasks,
    deadlines,
    missingItems
  });
  const overallRiskLevel = determineRiskLevel({
    tasks,
    deadlines,
    blockers
  });
  const provisionalState = determineState({
    tasks,
    blockers,
    riskLevel: overallRiskLevel
  });
  const readyForClosing = provisionalState === "READY_FOR_CLOSING";
  const milestones = buildMilestones(current, tasks, input.offerSubmission, inputs.acceptedAt, readyForClosing);
  const recommendationBundle = buildRecommendationBundle({
    state: provisionalState,
    riskLevel: overallRiskLevel,
    tasks,
    deadlines,
    blockers
  });

  const activityLog: UnderContractCoordinationActivityEntry[] = clone(current?.activityLog ?? []);
  const createdAt = current?.createdAt ?? now;
  const updatedAt = now;
  const id = current?.id ?? "";

  return {
    id,
    sessionId: input.sessionId ?? current?.sessionId ?? input.offerSubmission.sessionId ?? null,
    partnerId: input.partnerId ?? current?.partnerId ?? input.offerSubmission.partnerId ?? null,
    ...inputs,
    coordinationSummary: {
      propertyId: inputs.propertyId,
      propertyAddressLabel: inputs.propertyAddressLabel,
      offerSubmissionId: inputs.offerSubmissionId,
      acceptedAt: inputs.acceptedAt,
      targetClosingDate: inputs.targetClosingDate
    },
    overallCoordinationState: provisionalState,
    overallRiskLevel,
    urgencyLevel: overallRiskLevel,
    readyForClosing,
    requiresImmediateAttention: recommendationBundle.requiresImmediateAttention,
    taskSummaries: tasks,
    milestoneSummaries: milestones,
    deadlineSummaries: deadlines,
    missingItems,
    blockers,
    recommendation: recommendationBundle.recommendation,
    risk: recommendationBundle.risk,
    alternative: recommendationBundle.alternative,
    nextAction: recommendationBundle.nextAction,
    nextSteps: recommendationBundle.nextSteps,
    activityLog,
    lastActionAt: current?.lastActionAt ?? now,
    lastEvaluatedAt: now,
    createdAt,
    updatedAt
  };
}

export function toUnderContractCoordinationSummary(
  record: UnderContractCoordination
): UnderContractCoordinationSummary {
  return {
    coordinationSummary: clone(record.coordinationSummary),
    overallCoordinationState: record.overallCoordinationState,
    overallRiskLevel: record.overallRiskLevel,
    urgencyLevel: record.urgencyLevel,
    readyForClosing: record.readyForClosing,
    requiresImmediateAttention: record.requiresImmediateAttention,
    taskSummaries: clone(record.taskSummaries),
    milestoneSummaries: clone(record.milestoneSummaries),
    deadlineSummaries: clone(record.deadlineSummaries),
    missingItems: clone(record.missingItems),
    blockers: clone(record.blockers),
    recommendation: record.recommendation,
    risk: record.risk,
    alternative: record.alternative,
    nextAction: record.nextAction,
    nextSteps: clone(record.nextSteps),
    lastActionAt: record.lastActionAt,
    lastEvaluatedAt: record.lastEvaluatedAt
  };
}
