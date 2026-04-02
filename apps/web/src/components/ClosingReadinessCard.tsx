import { useEffect, useState } from "react";
import type { ClosingReadiness, UnderContractCoordination, WorkflowNotification } from "@nhalo/types";
import { DecisionExplainabilityPanel } from "./DecisionExplainabilityPanel";
import { WorkflowAlertList } from "./WorkflowAlertList";
import { CLOSING_READINESS_COPY } from "../content";

interface ClosingReadinessCardProps {
  propertyId: string;
  propertyAddressLabel: string;
  shortlistId?: string | null;
  notifications?: WorkflowNotification[];
  underContract: UnderContractCoordination | null;
  closingReadiness?: ClosingReadiness | null;
  onCreate(payload: {
    propertyId: string;
    propertyAddressLabel: string;
    shortlistId?: string | null;
    financialReadinessId?: string | null;
    offerPreparationId?: string | null;
    offerSubmissionId?: string | null;
    underContractCoordinationId: string;
    targetClosingDate: string;
    closingAppointmentAt?: string | null;
    closingAppointmentLocation?: string | null;
    closingAppointmentNotes?: string | null;
    finalReviewDeadline?: string | null;
    finalFundsConfirmationDeadline?: string | null;
    finalFundsAmountConfirmed?: number | null;
    notes?: string | null;
    internalActivityNote?: string | null;
  }): Promise<void> | void;
  onUpdate(
    id: string,
    patch: {
      targetClosingDate?: string | null;
      closingAppointmentAt?: string | null;
      closingAppointmentLocation?: string | null;
      closingAppointmentNotes?: string | null;
      finalReviewDeadline?: string | null;
      finalFundsConfirmationDeadline?: string | null;
      finalFundsAmountConfirmed?: number | null;
      notes?: string | null;
      internalActivityNote?: string | null;
    }
  ): Promise<void> | void;
  onUpdateChecklistItem(
    id: string,
    itemType: ClosingReadiness["checklistItemSummaries"][number]["itemType"],
    patch: {
      status?: ClosingReadiness["checklistItemSummaries"][number]["status"];
      deadline?: string | null;
      completedAt?: string | null;
      blockedReason?: string | null;
      notes?: string | null;
    }
  ): Promise<void> | void;
  onUpdateMilestone(
    id: string,
    milestoneType: ClosingReadiness["milestoneSummaries"][number]["milestoneType"],
    patch: {
      status?: ClosingReadiness["milestoneSummaries"][number]["status"];
      occurredAt?: string | null;
      notes?: string | null;
    }
  ): Promise<void> | void;
  onMarkReady(id: string): Promise<void> | void;
  onMarkClosed(id: string): Promise<void> | void;
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

export function ClosingReadinessCard({
  propertyId,
  propertyAddressLabel,
  shortlistId,
  notifications = [],
  underContract,
  closingReadiness,
  onCreate,
  onUpdate,
  onUpdateChecklistItem,
  onUpdateMilestone,
  onMarkReady,
  onMarkClosed
}: ClosingReadinessCardProps) {
  const [targetClosingDate, setTargetClosingDate] = useState("");
  const [closingAppointmentAt, setClosingAppointmentAt] = useState("");
  const [closingAppointmentLocation, setClosingAppointmentLocation] = useState("");
  const [closingAppointmentNotes, setClosingAppointmentNotes] = useState("");
  const [finalReviewDeadline, setFinalReviewDeadline] = useState("");
  const [finalFundsConfirmationDeadline, setFinalFundsConfirmationDeadline] = useState("");
  const [finalFundsAmountConfirmed, setFinalFundsAmountConfirmed] = useState("");
  const [notes, setNotes] = useState("");
  const [internalActivityNote, setInternalActivityNote] = useState("");

  useEffect(() => {
    setTargetClosingDate(toLocalInputValue(closingReadiness?.targetClosingDate ?? underContract?.targetClosingDate));
    setClosingAppointmentAt(toLocalInputValue(closingReadiness?.closingAppointmentAt));
    setClosingAppointmentLocation(closingReadiness?.closingAppointmentLocation ?? "");
    setClosingAppointmentNotes(closingReadiness?.closingAppointmentNotes ?? "");
    setFinalReviewDeadline(toLocalInputValue(closingReadiness?.finalReviewDeadline));
    setFinalFundsConfirmationDeadline(toLocalInputValue(closingReadiness?.finalFundsConfirmationDeadline));
    setFinalFundsAmountConfirmed(
      closingReadiness?.finalFundsAmountConfirmed != null
        ? String(closingReadiness.finalFundsAmountConfirmed)
        : ""
    );
    setNotes(closingReadiness?.notes ?? "");
    setInternalActivityNote("");
  }, [closingReadiness, underContract]);

  const canStart =
    underContract?.overallCoordinationState === "READY_FOR_CLOSING" && underContract.readyForClosing;

  return (
    <div className="activity-card negotiation-card">
      <div className="summary-header">
        <div>
          <p className="section-label">{CLOSING_READINESS_COPY.title}</p>
          <strong>
            {closingReadiness
              ? humanize(closingReadiness.overallClosingReadinessState)
              : canStart
                ? "not started"
                : "blocked"}
          </strong>
          <p className="muted">{CLOSING_READINESS_COPY.intro}</p>
        </div>
        <div className="status-chip-row">
          <span className="status-chip">
            {CLOSING_READINESS_COPY.dependencyLabel}:{" "}
            {underContract ? humanize(underContract.overallCoordinationState) : "missing"}
          </span>
          {closingReadiness ? (
            <span className="status-chip">{humanize(closingReadiness.overallRiskLevel)}</span>
          ) : null}
        </div>
      </div>

      {closingReadiness ? (
        <DecisionExplainabilityPanel
          label="Why this closing status?"
          moduleName="closing_readiness"
          subjectId={closingReadiness.id}
          subjectType="closing_readiness"
        />
      ) : null}

      <WorkflowAlertList
        notifications={notifications}
        title="Active alerts"
        emptyMessage="No active closing alerts."
      />

      <div className="summary-grid">
        <div className="summary-block">
          <h3>{CLOSING_READINESS_COPY.summaryTitle}</h3>
          <p>
            {CLOSING_READINESS_COPY.stateLabel}:{" "}
            {closingReadiness ? humanize(closingReadiness.overallClosingReadinessState) : "not started"}
          </p>
          <p>
            {CLOSING_READINESS_COPY.targetClosingDateLabel}:{" "}
            {closingReadiness?.targetClosingDate
              ? new Date(closingReadiness.targetClosingDate).toLocaleString()
              : underContract?.targetClosingDate
                ? new Date(underContract.targetClosingDate).toLocaleString()
                : "Not set"}
          </p>
          <p>
            {CLOSING_READINESS_COPY.appointmentLabel}:{" "}
            {closingReadiness?.closingAppointmentAt
              ? new Date(closingReadiness.closingAppointmentAt).toLocaleString()
              : "Not scheduled"}
          </p>
          <p className="muted">
            {CLOSING_READINESS_COPY.readyLabel}: {closingReadiness?.readyToClose ? "yes" : "not yet"}
          </p>
        </div>
        <div className="summary-block">
          <h3>{CLOSING_READINESS_COPY.blockersTitle}</h3>
          {closingReadiness ? (
            <>
              <p>{CLOSING_READINESS_COPY.riskLabel}: {humanize(closingReadiness.overallRiskLevel)}</p>
              <p>{CLOSING_READINESS_COPY.urgencyLabel}: {humanize(closingReadiness.urgencyLevel)}</p>
              <p className="muted">
                {CLOSING_READINESS_COPY.immediateAttentionLabel}:{" "}
                {closingReadiness.requiresImmediateAttention ? "yes" : "no"}
              </p>
            </>
          ) : (
            <p className="muted">No closing readiness record is stored yet.</p>
          )}
        </div>
      </div>

      {closingReadiness ? (
        <>
          <div className="summary-grid">
            <div className="summary-block">
              <h3>{CLOSING_READINESS_COPY.recommendationTitle}</h3>
              <p>{closingReadiness.recommendation}</p>
              <p className="muted">Risk: {closingReadiness.risk}</p>
              <p className="muted">Alternative: {closingReadiness.alternative}</p>
            </div>
            <div className="summary-block">
              <h3>{CLOSING_READINESS_COPY.nextStepsTitle}</h3>
              <ul>
                {closingReadiness.nextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
              <p className="muted">
                {CLOSING_READINESS_COPY.nextActionLabel}: {closingReadiness.nextAction}
              </p>
            </div>
          </div>

          <div className="summary-block">
            <h3>{CLOSING_READINESS_COPY.checklistTitle}</h3>
            <div className="offer-readiness-grid">
              {closingReadiness.checklistItemSummaries.map((item) => (
                <div className="summary-block" key={item.itemType}>
                  <h4>{item.label}</h4>
                  <p className="muted">Status: {humanize(item.status)}</p>
                  <p className="muted">
                    Deadline: {item.deadline ? new Date(item.deadline).toLocaleString() : "Not set"}
                  </p>
                  <select
                    defaultValue={item.status}
                    onChange={(event) =>
                      onUpdateChecklistItem(closingReadiness.id, item.itemType, {
                        status: event.target.value as ClosingReadiness["checklistItemSummaries"][number]["status"]
                      })
                    }
                  >
                    <option value="NOT_STARTED">Not started</option>
                    <option value="IN_PROGRESS">In progress</option>
                    <option value="READY">Ready</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="BLOCKED">Blocked</option>
                    <option value="FAILED">Failed</option>
                    <option value="WAIVED">Waived</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="summary-grid">
            <div className="summary-block">
              <h3>{CLOSING_READINESS_COPY.milestonesTitle}</h3>
              <ul>
                {closingReadiness.milestoneSummaries.map((milestone) => (
                  <li key={milestone.milestoneType}>
                    <strong>{milestone.label}</strong>: {humanize(milestone.status)}
                    {milestone.status !== "REACHED" ? (
                      <>
                        {" "}
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() =>
                            onUpdateMilestone(closingReadiness.id, milestone.milestoneType, {
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
              <h3>{CLOSING_READINESS_COPY.activityTitle}</h3>
              <ul>
                {closingReadiness.activityLog.map((entry) => (
                  <li key={`${entry.type}-${entry.createdAt}`}>
                    <strong>{entry.label}</strong>
                    {entry.details ? ` ${entry.details}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      ) : null}

      <div className="offer-readiness-grid">
        <label>
          <span>{CLOSING_READINESS_COPY.targetClosingDateLabel}</span>
          <input type="datetime-local" value={targetClosingDate} onChange={(event) => setTargetClosingDate(event.target.value)} />
        </label>
        <label>
          <span>{CLOSING_READINESS_COPY.appointmentLabel}</span>
          <input type="datetime-local" value={closingAppointmentAt} onChange={(event) => setClosingAppointmentAt(event.target.value)} />
        </label>
        <label>
          <span>{CLOSING_READINESS_COPY.appointmentLocationLabel}</span>
          <input value={closingAppointmentLocation} onChange={(event) => setClosingAppointmentLocation(event.target.value)} />
        </label>
        <label>
          <span>{CLOSING_READINESS_COPY.finalReviewDeadlineLabel}</span>
          <input type="datetime-local" value={finalReviewDeadline} onChange={(event) => setFinalReviewDeadline(event.target.value)} />
        </label>
        <label>
          <span>{CLOSING_READINESS_COPY.finalFundsDeadlineLabel}</span>
          <input
            type="datetime-local"
            value={finalFundsConfirmationDeadline}
            onChange={(event) => setFinalFundsConfirmationDeadline(event.target.value)}
          />
        </label>
        <label>
          <span>{CLOSING_READINESS_COPY.finalFundsAmountLabel}</span>
          <input
            type="number"
            min={0}
            step={100}
            value={finalFundsAmountConfirmed}
            onChange={(event) => setFinalFundsAmountConfirmed(event.target.value)}
          />
        </label>
        <label className="span-2">
          <span>{CLOSING_READINESS_COPY.notesLabel}</span>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <label className="span-2">
          <span>{CLOSING_READINESS_COPY.internalActivityLabel}</span>
          <textarea value={internalActivityNote} onChange={(event) => setInternalActivityNote(event.target.value)} />
        </label>
        <label className="span-2">
          <span>Appointment notes</span>
          <textarea value={closingAppointmentNotes} onChange={(event) => setClosingAppointmentNotes(event.target.value)} />
        </label>
      </div>

      <div className="summary-block">
        <h3>{CLOSING_READINESS_COPY.blockersTitle}</h3>
        {closingReadiness?.blockers.length ? (
          <ul>
            {closingReadiness.blockers.map((entry) => (
              <li key={`${entry.code}-${entry.message}`}>
                <strong>{entry.message}</strong> {entry.howToFix}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">
            {canStart
              ? "No closing blocker is stored right now."
              : "This stage cannot start until under-contract coordination is ready for closing."}
          </p>
        )}
      </div>

      <div className="shortlist-actions">
        {!closingReadiness ? (
          <button
            type="button"
            disabled={!canStart || !underContract}
            onClick={() =>
              underContract &&
              onCreate({
                propertyId,
                propertyAddressLabel,
                shortlistId,
                financialReadinessId: underContract.financialReadinessId ?? null,
                offerPreparationId: underContract.offerPreparationId ?? null,
                offerSubmissionId: underContract.offerSubmissionId,
                underContractCoordinationId: underContract.id,
                targetClosingDate:
                  fromLocalInputValue(targetClosingDate) ??
                  underContract.targetClosingDate,
                closingAppointmentAt: fromLocalInputValue(closingAppointmentAt),
                closingAppointmentLocation: closingAppointmentLocation.trim() || null,
                closingAppointmentNotes: closingAppointmentNotes.trim() || null,
                finalReviewDeadline: fromLocalInputValue(finalReviewDeadline),
                finalFundsConfirmationDeadline: fromLocalInputValue(finalFundsConfirmationDeadline),
                finalFundsAmountConfirmed:
                  finalFundsAmountConfirmed.trim() === ""
                    ? null
                    : Number(finalFundsAmountConfirmed),
                notes: notes.trim() || null,
                internalActivityNote: internalActivityNote.trim() || null
              })
            }
          >
            {canStart ? CLOSING_READINESS_COPY.startAction : CLOSING_READINESS_COPY.blockedAction}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() =>
                onUpdate(closingReadiness.id, {
                  targetClosingDate: fromLocalInputValue(targetClosingDate),
                  closingAppointmentAt: fromLocalInputValue(closingAppointmentAt),
                  closingAppointmentLocation: closingAppointmentLocation.trim() || null,
                  closingAppointmentNotes: closingAppointmentNotes.trim() || null,
                  finalReviewDeadline: fromLocalInputValue(finalReviewDeadline),
                  finalFundsConfirmationDeadline: fromLocalInputValue(finalFundsConfirmationDeadline),
                  finalFundsAmountConfirmed:
                    finalFundsAmountConfirmed.trim() === ""
                      ? null
                      : Number(finalFundsAmountConfirmed),
                  notes: notes.trim() || null,
                  internalActivityNote: internalActivityNote.trim() || null
                })
              }
            >
              {CLOSING_READINESS_COPY.updateAction}
            </button>
            {!closingReadiness.readyToClose && closingReadiness.overallClosingReadinessState !== "BLOCKED" ? (
              <button type="button" className="ghost-button" onClick={() => onMarkReady(closingReadiness.id)}>
                {CLOSING_READINESS_COPY.markReadyAction}
              </button>
            ) : null}
            {closingReadiness.readyToClose && !closingReadiness.closed ? (
              <button type="button" className="ghost-button" onClick={() => onMarkClosed(closingReadiness.id)}>
                {CLOSING_READINESS_COPY.markClosedAction}
              </button>
            ) : null}
            {closingReadiness.readyToClose ? (
              <span className="status-chip">{CLOSING_READINESS_COPY.readyAction}</span>
            ) : null}
            {closingReadiness.closed ? (
              <span className="status-chip">{CLOSING_READINESS_COPY.closedAction}</span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
