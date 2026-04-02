import { useEffect, useState } from "react";
import type { OfferSubmission, UnderContractCoordination, WorkflowNotification } from "@nhalo/types";
import { DecisionExplainabilityPanel } from "./DecisionExplainabilityPanel";
import { WorkflowAlertList } from "./WorkflowAlertList";
import { UNDER_CONTRACT_COPY } from "../content";

interface UnderContractCoordinationCardProps {
  propertyId: string;
  propertyAddressLabel: string;
  shortlistId?: string | null;
  notifications?: WorkflowNotification[];
  offerSubmission: OfferSubmission | null;
  underContract?: UnderContractCoordination | null;
  onCreate(payload: {
    propertyId: string;
    propertyAddressLabel: string;
    shortlistId?: string | null;
    financialReadinessId?: string | null;
    offerPreparationId?: string | null;
    offerSubmissionId: string;
    acceptedAt: string;
    targetClosingDate: string;
    inspectionDeadline: string | null;
    appraisalDeadline: string | null;
    financingDeadline: string | null;
    contingencyDeadline: string | null;
    closingPreparationDeadline?: string | null;
    notes?: string | null;
    internalActivityNote?: string | null;
  }): Promise<void> | void;
  onUpdate(
    id: string,
    patch: {
      targetClosingDate?: string | null;
      inspectionDeadline?: string | null;
      appraisalDeadline?: string | null;
      financingDeadline?: string | null;
      contingencyDeadline?: string | null;
      closingPreparationDeadline?: string | null;
      notes?: string | null;
      internalActivityNote?: string | null;
    }
  ): Promise<void> | void;
  onUpdateTask(
    id: string,
    taskType: UnderContractCoordination["taskSummaries"][number]["taskType"],
    patch: {
      status?: UnderContractCoordination["taskSummaries"][number]["status"];
      deadline?: string | null;
      scheduledAt?: string | null;
      completedAt?: string | null;
      blockedReason?: string | null;
      notes?: string | null;
    }
  ): Promise<void> | void;
  onUpdateMilestone(
    id: string,
    milestoneType: UnderContractCoordination["milestoneSummaries"][number]["milestoneType"],
    patch: {
      status?: UnderContractCoordination["milestoneSummaries"][number]["status"];
      occurredAt?: string | null;
      notes?: string | null;
    }
  ): Promise<void> | void;
}

function toLocalInputValue(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromLocalInputValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function humanize(value: string): string {
  return value.replaceAll("_", " ").toLowerCase();
}

export function UnderContractCoordinationCard({
  propertyId,
  propertyAddressLabel,
  shortlistId,
  notifications = [],
  offerSubmission,
  underContract,
  onCreate,
  onUpdate,
  onUpdateTask,
  onUpdateMilestone
}: UnderContractCoordinationCardProps) {
  const [targetClosingDate, setTargetClosingDate] = useState("");
  const [inspectionDeadline, setInspectionDeadline] = useState("");
  const [appraisalDeadline, setAppraisalDeadline] = useState("");
  const [financingDeadline, setFinancingDeadline] = useState("");
  const [contingencyDeadline, setContingencyDeadline] = useState("");
  const [closingPreparationDeadline, setClosingPreparationDeadline] = useState("");
  const [notes, setNotes] = useState("");
  const [internalActivityNote, setInternalActivityNote] = useState("");

  useEffect(() => {
    setTargetClosingDate(toLocalInputValue(underContract?.targetClosingDate));
    setInspectionDeadline(toLocalInputValue(underContract?.inspectionDeadline));
    setAppraisalDeadline(toLocalInputValue(underContract?.appraisalDeadline));
    setFinancingDeadline(toLocalInputValue(underContract?.financingDeadline));
    setContingencyDeadline(toLocalInputValue(underContract?.contingencyDeadline));
    setClosingPreparationDeadline(toLocalInputValue(underContract?.closingPreparationDeadline));
    setNotes(underContract?.notes ?? "");
    setInternalActivityNote("");
  }, [underContract]);

  const acceptedAt =
    offerSubmission?.sellerRespondedAt ??
    offerSubmission?.lastActionAt ??
    offerSubmission?.submittedAt ??
    new Date().toISOString();
  const canStart = offerSubmission?.submissionState === "ACCEPTED";

  const defaultTargetClosingDate = toLocalInputValue(
    offerSubmission?.submissionSummary.submittedAt && offerSubmission.submissionSummary.closingTimelineDays
      ? new Date(
          new Date(offerSubmission.submissionSummary.submittedAt).getTime() +
            offerSubmission.submissionSummary.closingTimelineDays * 86_400_000
        ).toISOString()
      : null
  );

  return (
    <div className="activity-card negotiation-card">
      <div className="summary-header">
        <div>
          <p className="section-label">{UNDER_CONTRACT_COPY.title}</p>
          <strong>
            {underContract
              ? humanize(underContract.overallCoordinationState)
              : canStart
                ? "not started"
                : "blocked"}
          </strong>
          <p className="muted">{UNDER_CONTRACT_COPY.intro}</p>
        </div>
        <div className="status-chip-row">
          <span className="status-chip">
            {UNDER_CONTRACT_COPY.dependencyLabel}: {offerSubmission ? humanize(offerSubmission.submissionState) : "missing"}
          </span>
          {underContract ? (
            <span className="status-chip">{humanize(underContract.overallRiskLevel)}</span>
          ) : null}
        </div>
      </div>

      {underContract ? (
        <DecisionExplainabilityPanel
          label="Why this contract status?"
          moduleName="under_contract"
          subjectId={underContract.id}
          subjectType="under_contract"
        />
      ) : null}

      <WorkflowAlertList
        notifications={notifications}
        title="Active alerts"
        emptyMessage="No active under-contract alerts."
      />

      <div className="summary-grid">
        <div className="summary-block">
          <h3>{UNDER_CONTRACT_COPY.summaryTitle}</h3>
          <p>{UNDER_CONTRACT_COPY.stateLabel}: {underContract ? humanize(underContract.overallCoordinationState) : "not started"}</p>
          <p>{UNDER_CONTRACT_COPY.acceptedAtLabel}: {offerSubmission?.sellerRespondedAt ? new Date(offerSubmission.sellerRespondedAt).toLocaleString() : "Not recorded"}</p>
          <p>{UNDER_CONTRACT_COPY.targetClosingDateLabel}: {underContract?.targetClosingDate ? new Date(underContract.targetClosingDate).toLocaleString() : "Not set"}</p>
          <p className="muted">
            {UNDER_CONTRACT_COPY.readyLabel}: {underContract?.readyForClosing ? "yes" : "not yet"}
          </p>
        </div>
        <div className="summary-block">
          <h3>{UNDER_CONTRACT_COPY.blockersTitle}</h3>
          {underContract ? (
            <>
              <p>{UNDER_CONTRACT_COPY.riskLabel}: {humanize(underContract.overallRiskLevel)}</p>
              <p>{UNDER_CONTRACT_COPY.urgencyLabel}: {humanize(underContract.urgencyLevel)}</p>
              <p className="muted">
                {UNDER_CONTRACT_COPY.immediateAttentionLabel}: {underContract.requiresImmediateAttention ? "yes" : "no"}
              </p>
            </>
          ) : (
            <p className="muted">No contract workflow is stored yet.</p>
          )}
        </div>
      </div>

      {underContract ? (
        <>
          <div className="summary-grid">
            <div className="summary-block">
              <h3>{UNDER_CONTRACT_COPY.deadlinesTitle}</h3>
              <ul>
                {underContract.deadlineSummaries.map((entry) => (
                  <li key={entry.key}>
                    <strong>{entry.label}</strong>: {entry.deadline ? new Date(entry.deadline).toLocaleString() : "Not set"} ({humanize(entry.status)})
                  </li>
                ))}
              </ul>
            </div>
            <div className="summary-block">
              <h3>{UNDER_CONTRACT_COPY.recommendationTitle}</h3>
              <p>{underContract.recommendation}</p>
              <p className="muted">Risk: {underContract.risk}</p>
              <p className="muted">Alternative: {underContract.alternative}</p>
            </div>
          </div>

          <div className="summary-block">
            <h3>{UNDER_CONTRACT_COPY.tasksTitle}</h3>
            <div className="offer-readiness-grid">
              {underContract.taskSummaries.map((task) => (
                <div className="summary-block" key={task.taskType}>
                  <h4>{task.label}</h4>
                  <p className="muted">Status: {humanize(task.status)}</p>
                  <p className="muted">Deadline: {task.deadline ? new Date(task.deadline).toLocaleString() : "Not set"}</p>
                  <select
                    defaultValue={task.status}
                    onChange={(event) =>
                      onUpdateTask(underContract.id, task.taskType, {
                        status: event.target.value as UnderContractCoordination["taskSummaries"][number]["status"]
                      })
                    }
                  >
                    <option value="NOT_STARTED">Not started</option>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="IN_PROGRESS">In progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="BLOCKED">Blocked</option>
                    <option value="WAIVED">Waived</option>
                    <option value="FAILED">Failed</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="summary-grid">
            <div className="summary-block">
              <h3>{UNDER_CONTRACT_COPY.milestonesTitle}</h3>
              <ul>
                {underContract.milestoneSummaries.map((milestone) => (
                  <li key={milestone.milestoneType}>
                    <strong>{milestone.label}</strong>: {humanize(milestone.status)}
                    {milestone.status !== "REACHED" ? (
                      <>
                        {" "}
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() =>
                            onUpdateMilestone(underContract.id, milestone.milestoneType, {
                              status: "REACHED",
                              occurredAt: new Date().toISOString()
                            })
                          }
                        >
                          Mark reached
                        </button>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
            <div className="summary-block">
              <h3>{UNDER_CONTRACT_COPY.nextStepsTitle}</h3>
              <ul>
                {underContract.nextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
              <p className="muted">{UNDER_CONTRACT_COPY.nextActionLabel}: {underContract.nextAction}</p>
            </div>
          </div>

          <div className="offer-readiness-grid">
            <label>
              <span>{UNDER_CONTRACT_COPY.targetClosingDateLabel}</span>
              <input type="datetime-local" value={targetClosingDate} onChange={(event) => setTargetClosingDate(event.target.value)} />
            </label>
            <label>
              <span>Inspection deadline</span>
              <input type="datetime-local" value={inspectionDeadline} onChange={(event) => setInspectionDeadline(event.target.value)} />
            </label>
            <label>
              <span>Appraisal deadline</span>
              <input type="datetime-local" value={appraisalDeadline} onChange={(event) => setAppraisalDeadline(event.target.value)} />
            </label>
            <label>
              <span>Financing deadline</span>
              <input type="datetime-local" value={financingDeadline} onChange={(event) => setFinancingDeadline(event.target.value)} />
            </label>
            <label>
              <span>Contingency deadline</span>
              <input type="datetime-local" value={contingencyDeadline} onChange={(event) => setContingencyDeadline(event.target.value)} />
            </label>
            <label>
              <span>Closing prep deadline</span>
              <input type="datetime-local" value={closingPreparationDeadline} onChange={(event) => setClosingPreparationDeadline(event.target.value)} />
            </label>
            <label className="span-2">
              <span>{UNDER_CONTRACT_COPY.notesLabel}</span>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
            <label className="span-2">
              <span>{UNDER_CONTRACT_COPY.internalActivityLabel}</span>
              <textarea value={internalActivityNote} onChange={(event) => setInternalActivityNote(event.target.value)} />
            </label>
          </div>

          <div className="shortlist-actions">
            <button
              type="button"
              onClick={() =>
                onUpdate(underContract.id, {
                  targetClosingDate: fromLocalInputValue(targetClosingDate),
                  inspectionDeadline: fromLocalInputValue(inspectionDeadline),
                  appraisalDeadline: fromLocalInputValue(appraisalDeadline),
                  financingDeadline: fromLocalInputValue(financingDeadline),
                  contingencyDeadline: fromLocalInputValue(contingencyDeadline),
                  closingPreparationDeadline: fromLocalInputValue(closingPreparationDeadline),
                  notes: notes.trim() || null,
                  internalActivityNote: internalActivityNote.trim() || null
                })
              }
            >
              {UNDER_CONTRACT_COPY.updateAction}
            </button>
          </div>

          <div className="summary-block">
            <h3>{UNDER_CONTRACT_COPY.activityTitle}</h3>
            <ul>
              {underContract.activityLog.map((entry) => (
                <li key={`${entry.type}-${entry.createdAt}`}>
                  <strong>{entry.label}</strong>
                  {entry.details ? ` ${entry.details}` : ""}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <div className="offer-readiness-grid">
          <label>
            <span>{UNDER_CONTRACT_COPY.targetClosingDateLabel}</span>
            <input
              type="datetime-local"
              value={targetClosingDate || defaultTargetClosingDate}
              onChange={(event) => setTargetClosingDate(event.target.value)}
            />
          </label>
          <label>
            <span>Inspection deadline</span>
            <input type="datetime-local" value={inspectionDeadline} onChange={(event) => setInspectionDeadline(event.target.value)} />
          </label>
          <label>
            <span>Appraisal deadline</span>
            <input type="datetime-local" value={appraisalDeadline} onChange={(event) => setAppraisalDeadline(event.target.value)} />
          </label>
          <label>
            <span>Financing deadline</span>
            <input type="datetime-local" value={financingDeadline} onChange={(event) => setFinancingDeadline(event.target.value)} />
          </label>
          <label>
            <span>Contingency deadline</span>
            <input type="datetime-local" value={contingencyDeadline} onChange={(event) => setContingencyDeadline(event.target.value)} />
          </label>
          <label className="span-2">
            <span>{UNDER_CONTRACT_COPY.notesLabel}</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <label className="span-2">
            <span>{UNDER_CONTRACT_COPY.internalActivityLabel}</span>
            <textarea value={internalActivityNote} onChange={(event) => setInternalActivityNote(event.target.value)} />
          </label>
        </div>
      )}

      <div className="summary-block">
        <h3>{UNDER_CONTRACT_COPY.blockersTitle}</h3>
        {underContract?.blockers.length ? (
          <ul>
            {underContract.blockers.map((entry) => (
              <li key={`${entry.code}-${entry.message}`}>
                <strong>{entry.message}</strong> {entry.howToFix}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">
            {canStart
              ? "No contract blocker is stored right now."
              : "The workflow cannot start until the offer submission is accepted."}
          </p>
        )}
      </div>

      <div className="shortlist-actions">
        {!underContract ? (
          <button
            type="button"
            disabled={!canStart || !offerSubmission}
            onClick={() =>
              offerSubmission &&
              onCreate({
                propertyId,
                propertyAddressLabel,
                shortlistId,
                financialReadinessId: offerSubmission.financialReadinessId ?? null,
                offerPreparationId: offerSubmission.offerPreparationId,
                offerSubmissionId: offerSubmission.id,
                acceptedAt,
                targetClosingDate:
                  fromLocalInputValue(targetClosingDate || defaultTargetClosingDate) ?? new Date().toISOString(),
                inspectionDeadline: fromLocalInputValue(inspectionDeadline),
                appraisalDeadline: fromLocalInputValue(appraisalDeadline),
                financingDeadline: fromLocalInputValue(financingDeadline),
                contingencyDeadline: fromLocalInputValue(contingencyDeadline),
                closingPreparationDeadline: fromLocalInputValue(closingPreparationDeadline),
                notes: notes.trim() || null,
                internalActivityNote: internalActivityNote.trim() || null
              })
            }
          >
            {canStart ? UNDER_CONTRACT_COPY.startAction : UNDER_CONTRACT_COPY.blockedAction}
          </button>
        ) : null}
        {underContract?.readyForClosing ? <span className="status-chip">{UNDER_CONTRACT_COPY.readyAction}</span> : null}
      </div>
    </div>
  );
}
