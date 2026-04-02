import { useEffect, useState } from "react";
import type { OfferPreparation, OfferSubmission, WorkflowNotification } from "@nhalo/types";
import { DecisionExplainabilityPanel } from "./DecisionExplainabilityPanel";
import { WorkflowAlertList } from "./WorkflowAlertList";
import { OFFER_SUBMISSION_COPY } from "../content";

interface OfferSubmissionCardProps {
  propertyId: string;
  propertyAddressLabel: string;
  shortlistId?: string | null;
  notifications?: WorkflowNotification[];
  offerPreparation: OfferPreparation | null;
  offerSubmission?: OfferSubmission | null;
  onCreate(payload: {
    propertyId: string;
    propertyAddressLabel: string;
    shortlistId?: string | null;
    financialReadinessId?: string | null;
    offerPreparationId: string;
    submissionMethod?: OfferSubmission["submissionMethod"];
    offerExpirationAt?: string | null;
    notes?: string | null;
    internalActivityNote?: string | null;
  }): Promise<void> | void;
  onSubmit(id: string, submittedAt?: string | null): Promise<void> | void;
  onUpdate(
    id: string,
    patch: {
      submissionMethod?: OfferSubmission["submissionMethod"];
      offerExpirationAt?: string | null;
      sellerResponseState?: OfferSubmission["sellerResponseState"];
      sellerRespondedAt?: string | null;
      buyerCounterDecision?: OfferSubmission["buyerCounterDecision"];
      withdrawnAt?: string | null;
      withdrawalReason?: string | null;
      counterofferPrice?: number | null;
      counterofferClosingTimelineDays?: number | null;
      counterofferFinancingContingency?: OfferSubmission["counterofferSummary"]["counterofferFinancingContingency"];
      counterofferInspectionContingency?: OfferSubmission["counterofferSummary"]["counterofferInspectionContingency"];
      counterofferAppraisalContingency?: OfferSubmission["counterofferSummary"]["counterofferAppraisalContingency"];
      counterofferExpirationAt?: string | null;
      notes?: string | null;
      internalActivityNote?: string | null;
    }
  ): Promise<void> | void;
  onRespondToCounter(
    id: string,
    decision: NonNullable<OfferSubmission["buyerCounterDecision"]>
  ): Promise<void> | void;
}

function currency(value: number | null | undefined): string {
  if (typeof value !== "number") {
    return "Not set";
  }

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });
}

function parseNullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
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

export function OfferSubmissionCard({
  propertyId,
  propertyAddressLabel,
  shortlistId,
  notifications = [],
  offerPreparation,
  offerSubmission,
  onCreate,
  onSubmit,
  onUpdate,
  onRespondToCounter
}: OfferSubmissionCardProps) {
  const [offerExpirationAt, setOfferExpirationAt] = useState("");
  const [submissionMethod, setSubmissionMethod] = useState<OfferSubmission["submissionMethod"]>("recorded_manual");
  const [notes, setNotes] = useState("");
  const [internalActivityNote, setInternalActivityNote] = useState("");
  const [sellerResponseState, setSellerResponseState] =
    useState<OfferSubmission["sellerResponseState"]>("NO_RESPONSE");
  const [sellerRespondedAt, setSellerRespondedAt] = useState("");
  const [counterofferPrice, setCounterofferPrice] = useState("");
  const [counterofferClosingTimelineDays, setCounterofferClosingTimelineDays] = useState("");
  const [counterofferFinancingContingency, setCounterofferFinancingContingency] =
    useState<OfferSubmission["counterofferSummary"]["counterofferFinancingContingency"]>("included");
  const [counterofferInspectionContingency, setCounterofferInspectionContingency] =
    useState<OfferSubmission["counterofferSummary"]["counterofferInspectionContingency"]>("included");
  const [counterofferAppraisalContingency, setCounterofferAppraisalContingency] =
    useState<OfferSubmission["counterofferSummary"]["counterofferAppraisalContingency"]>("included");
  const [counterofferExpirationAt, setCounterofferExpirationAt] = useState("");
  const [withdrawalReason, setWithdrawalReason] = useState("");

  useEffect(() => {
    setOfferExpirationAt(toLocalInputValue(offerSubmission?.offerExpirationAt));
    setSubmissionMethod(offerSubmission?.submissionMethod ?? "recorded_manual");
    setNotes(offerSubmission?.notes ?? "");
    setInternalActivityNote("");
    setSellerResponseState(offerSubmission?.sellerResponseState ?? "NO_RESPONSE");
    setSellerRespondedAt(toLocalInputValue(offerSubmission?.sellerRespondedAt));
    setCounterofferPrice(String(offerSubmission?.counterofferPrice ?? ""));
    setCounterofferClosingTimelineDays(String(offerSubmission?.counterofferClosingTimelineDays ?? ""));
    setCounterofferFinancingContingency(
      offerSubmission?.counterofferFinancingContingency ?? "included"
    );
    setCounterofferInspectionContingency(
      offerSubmission?.counterofferInspectionContingency ?? "included"
    );
    setCounterofferAppraisalContingency(
      offerSubmission?.counterofferAppraisalContingency ?? "included"
    );
    setCounterofferExpirationAt(toLocalInputValue(offerSubmission?.counterofferExpirationAt));
    setWithdrawalReason(offerSubmission?.withdrawalReason ?? "");
  }, [offerSubmission]);

  const isReadyToCreate = Boolean(offerPreparation?.id);
  const isUpstreamReady = Boolean(offerPreparation?.readinessToSubmit);

  return (
    <div className="activity-card negotiation-card">
      <div className="summary-header">
        <div>
          <p className="section-label">{OFFER_SUBMISSION_COPY.title}</p>
          <strong>
            {offerSubmission
              ? offerSubmission.submissionState.replaceAll("_", " ").toLowerCase()
              : isUpstreamReady
                ? "ready to submit"
                : "not started"}
          </strong>
          <p className="muted">{OFFER_SUBMISSION_COPY.intro}</p>
        </div>
        <div className="status-chip-row">
          <span className="status-chip">
            {OFFER_SUBMISSION_COPY.dependencyLabel}:{" "}
            {offerPreparation?.offerState.replaceAll("_", " ").toLowerCase() ?? "missing"}
          </span>
          {offerSubmission ? <span className="status-chip">{offerSubmission.urgencyLevel.replaceAll("_", " ").toLowerCase()}</span> : null}
        </div>
      </div>

      {offerSubmission ? (
        <DecisionExplainabilityPanel
          label="Why this submission state?"
          moduleName="offer_submission"
          subjectId={offerSubmission.id}
          subjectType="offer_submission"
        />
      ) : null}

      <WorkflowAlertList
        notifications={notifications}
        title="Active alerts"
        emptyMessage="No active offer submission alerts."
      />

      <div className="summary-grid">
        <div className="summary-block">
          <h3>{OFFER_SUBMISSION_COPY.statusTitle}</h3>
          <p>{OFFER_SUBMISSION_COPY.stateLabel}: {offerSubmission?.submissionState.replaceAll("_", " ").toLowerCase() ?? "not started"}</p>
          <p>{OFFER_SUBMISSION_COPY.submittedAtLabel}: {offerSubmission?.submittedAt ? new Date(offerSubmission.submittedAt).toLocaleString() : "Not recorded"}</p>
          <p>{OFFER_SUBMISSION_COPY.expirationLabel}: {offerSubmission?.offerExpirationAt ? new Date(offerSubmission.offerExpirationAt).toLocaleString() : "Not set"}</p>
          <p className="muted">{OFFER_SUBMISSION_COPY.urgencyLabel}: {offerSubmission?.urgencyLevel.replaceAll("_", " ").toLowerCase() ?? "low urgency"}</p>
        </div>
        <div className="summary-block">
          <h3>{OFFER_SUBMISSION_COPY.responseTitle}</h3>
          <p>{OFFER_SUBMISSION_COPY.sellerResponseLabel}: {offerSubmission?.sellerResponseState.replaceAll("_", " ").toLowerCase() ?? "no response"}</p>
          <p>{OFFER_SUBMISSION_COPY.offerPriceLabel}: {currency(offerSubmission?.submissionSummary.currentOfferPrice ?? offerPreparation?.offerPrice)}</p>
          <p>{OFFER_SUBMISSION_COPY.earnestMoneyLabel}: {currency(offerSubmission?.submissionSummary.earnestMoneyAmount ?? offerPreparation?.earnestMoneyAmount)}</p>
          <p className="muted">{OFFER_SUBMISSION_COPY.closingTimelineLabel}: {offerSubmission?.submissionSummary.closingTimelineDays ?? offerPreparation?.closingTimelineDays ?? "Not set"}</p>
        </div>
      </div>

      {offerSubmission ? (
        <div className="summary-grid">
          <div className="summary-block">
            <h3>{OFFER_SUBMISSION_COPY.recommendationTitle}</h3>
            <p>{offerSubmission.recommendation}</p>
            <p className="muted">Risk: {offerSubmission.risk}</p>
            <p className="muted">Alternative: {offerSubmission.alternative}</p>
          </div>
          <div className="summary-block">
            <h3>{OFFER_SUBMISSION_COPY.counterofferTitle}</h3>
            {offerSubmission.counterofferSummary.present ? (
              <>
                <p>{OFFER_SUBMISSION_COPY.counterPriceLabel}: {currency(offerSubmission.counterofferSummary.counterofferPrice)}</p>
                <p>{OFFER_SUBMISSION_COPY.counterTimelineLabel}: {offerSubmission.counterofferSummary.counterofferClosingTimelineDays ?? "Not set"}</p>
                <p>{OFFER_SUBMISSION_COPY.counterExpirationLabel}: {offerSubmission.counterofferSummary.counterofferExpirationAt ? new Date(offerSubmission.counterofferSummary.counterofferExpirationAt).toLocaleString() : "Not set"}</p>
                <p className="muted">{OFFER_SUBMISSION_COPY.buyerDecisionLabel}: {offerSubmission.buyerCounterDecision ?? "pending"}</p>
              </>
            ) : (
              <p className="muted">No counteroffer is stored.</p>
            )}
          </div>
        </div>
      ) : null}

      {!offerSubmission ? (
        <div className="offer-readiness-grid">
          <label>
            <span>{OFFER_SUBMISSION_COPY.expirationLabel}</span>
            <input
              type="datetime-local"
              value={offerExpirationAt}
              onChange={(event) => setOfferExpirationAt(event.target.value)}
            />
          </label>
          <label>
            <span>Submission method</span>
            <select
              value={submissionMethod ?? "recorded_manual"}
              onChange={(event) => setSubmissionMethod(event.target.value as OfferSubmission["submissionMethod"])}
            >
              <option value="recorded_manual">Recorded manual</option>
              <option value="simulated_delivery">Simulated delivery</option>
            </select>
          </label>
          <label className="span-2">
            <span>{OFFER_SUBMISSION_COPY.notesLabel}</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
        </div>
      ) : (
        <div className="offer-readiness-grid">
          <label>
            <span>{OFFER_SUBMISSION_COPY.sellerResponseLabel}</span>
            <select
              value={sellerResponseState}
              onChange={(event) =>
                setSellerResponseState(event.target.value as OfferSubmission["sellerResponseState"])
              }
            >
              <option value="NO_RESPONSE">No response</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="REJECTED">Rejected</option>
              <option value="COUNTERED">Countered</option>
            </select>
          </label>
          <label>
            <span>Seller responded at</span>
            <input
              type="datetime-local"
              value={sellerRespondedAt}
              onChange={(event) => setSellerRespondedAt(event.target.value)}
            />
          </label>
          {sellerResponseState === "COUNTERED" ? (
            <>
              <label>
                <span>{OFFER_SUBMISSION_COPY.counterPriceLabel}</span>
                <input
                  inputMode="numeric"
                  value={counterofferPrice}
                  onChange={(event) => setCounterofferPrice(event.target.value)}
                />
              </label>
              <label>
                <span>{OFFER_SUBMISSION_COPY.counterTimelineLabel}</span>
                <input
                  inputMode="numeric"
                  value={counterofferClosingTimelineDays}
                  onChange={(event) => setCounterofferClosingTimelineDays(event.target.value)}
                />
              </label>
              <label>
                <span>Counter financing contingency</span>
                <select
                  value={counterofferFinancingContingency ?? "included"}
                  onChange={(event) =>
                    setCounterofferFinancingContingency(
                      event.target.value as OfferSubmission["counterofferSummary"]["counterofferFinancingContingency"]
                    )
                  }
                >
                  <option value="included">Included</option>
                  <option value="waived">Waived</option>
                </select>
              </label>
              <label>
                <span>Counter inspection contingency</span>
                <select
                  value={counterofferInspectionContingency ?? "included"}
                  onChange={(event) =>
                    setCounterofferInspectionContingency(
                      event.target.value as OfferSubmission["counterofferSummary"]["counterofferInspectionContingency"]
                    )
                  }
                >
                  <option value="included">Included</option>
                  <option value="waived">Waived</option>
                </select>
              </label>
              <label>
                <span>Counter appraisal contingency</span>
                <select
                  value={counterofferAppraisalContingency ?? "included"}
                  onChange={(event) =>
                    setCounterofferAppraisalContingency(
                      event.target.value as OfferSubmission["counterofferSummary"]["counterofferAppraisalContingency"]
                    )
                  }
                >
                  <option value="included">Included</option>
                  <option value="waived">Waived</option>
                </select>
              </label>
              <label>
                <span>{OFFER_SUBMISSION_COPY.counterExpirationLabel}</span>
                <input
                  type="datetime-local"
                  value={counterofferExpirationAt}
                  onChange={(event) => setCounterofferExpirationAt(event.target.value)}
                />
              </label>
            </>
          ) : null}
          <label className="span-2">
            <span>{OFFER_SUBMISSION_COPY.notesLabel}</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <label className="span-2">
            <span>Internal activity note</span>
            <textarea
              value={internalActivityNote}
              onChange={(event) => setInternalActivityNote(event.target.value)}
            />
          </label>
          <label className="span-2">
            <span>Withdrawal reason</span>
            <textarea
              value={withdrawalReason}
              onChange={(event) => setWithdrawalReason(event.target.value)}
            />
          </label>
        </div>
      )}

      {offerSubmission?.blockers.length ? (
        <div className="summary-block">
          <h3>Blockers</h3>
          <ul>
            {offerSubmission.blockers.map((entry) => (
              <li key={`${entry.code}-${entry.message}`}>
                <strong>{entry.message}</strong> {entry.howToFix}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="summary-block">
        <h3>{OFFER_SUBMISSION_COPY.nextStepsTitle}</h3>
        <ul>
          {(offerSubmission?.nextSteps ?? [isUpstreamReady ? "Submit offer" : "Complete offer preparation"]).map(
            (step) => (
              <li key={step}>{step}</li>
            )
          )}
        </ul>
        <p className="muted">
          {OFFER_SUBMISSION_COPY.nextActionLabel}: {offerSubmission?.nextAction ?? (isUpstreamReady ? "Submit offer" : "Complete offer preparation")}
        </p>
      </div>

      <div className="shortlist-actions">
        {!offerSubmission ? (
          <button
            type="button"
            disabled={!isReadyToCreate}
            onClick={() =>
              onCreate({
                propertyId,
                propertyAddressLabel,
                shortlistId,
                financialReadinessId: offerPreparation?.financialReadinessId ?? null,
                offerPreparationId: offerPreparation?.id ?? "",
                submissionMethod,
                offerExpirationAt: fromLocalInputValue(offerExpirationAt),
                notes: notes.trim() || null,
                internalActivityNote: null
              })
            }
          >
            {isUpstreamReady ? OFFER_SUBMISSION_COPY.startAction : OFFER_SUBMISSION_COPY.blockedAction}
          </button>
        ) : (
          <>
            {offerSubmission.submissionState === "READY_TO_SUBMIT" ? (
              <button type="button" onClick={() => onSubmit(offerSubmission.id, new Date().toISOString())}>
                {OFFER_SUBMISSION_COPY.submitAction}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() =>
                onUpdate(offerSubmission.id, {
                  submissionMethod,
                  offerExpirationAt: fromLocalInputValue(offerExpirationAt),
                  sellerResponseState,
                  sellerRespondedAt: fromLocalInputValue(sellerRespondedAt),
                  counterofferPrice: parseNullableNumber(counterofferPrice),
                  counterofferClosingTimelineDays: parseNullableNumber(counterofferClosingTimelineDays),
                  counterofferFinancingContingency,
                  counterofferInspectionContingency,
                  counterofferAppraisalContingency,
                  counterofferExpirationAt: fromLocalInputValue(counterofferExpirationAt),
                  notes: notes.trim() || null,
                  internalActivityNote: internalActivityNote.trim() || null,
                  ...(withdrawalReason.trim()
                    ? {
                        withdrawnAt: new Date().toISOString(),
                        withdrawalReason: withdrawalReason.trim()
                      }
                    : {})
                })
              }
            >
              {OFFER_SUBMISSION_COPY.updateAction}
            </button>
            {offerSubmission.submissionState === "COUNTERED" ? (
              <>
                <button type="button" onClick={() => onRespondToCounter(offerSubmission.id, "accepted")}>
                  Accept counteroffer
                </button>
                <button type="button" onClick={() => onRespondToCounter(offerSubmission.id, "rejected")}>
                  Reject counteroffer
                </button>
              </>
            ) : null}
            {offerSubmission.submissionState === "ACCEPTED" ? (
              <span className="status-chip">{OFFER_SUBMISSION_COPY.readyAction}</span>
            ) : null}
          </>
        )}
      </div>

      {offerSubmission?.activityLog.length ? (
        <div className="summary-block">
          <h3>{OFFER_SUBMISSION_COPY.activityTitle}</h3>
          <ul>
            {offerSubmission.activityLog.map((entry) => (
              <li key={`${entry.type}-${entry.createdAt}`}>
                <strong>{entry.label}</strong>
                {entry.details ? ` ${entry.details}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
