import type {
  BuyerTransactionCommandCenterView,
  ClosingReadiness,
  FinancialReadiness,
  NegotiationEvent,
  NegotiationRecord,
  OfferPreparation,
  OfferSubmission,
  OfferReadiness,
  UnderContractCoordination,
  ResultNote,
  UnifiedActivityRecord,
  WorkflowNotification,
  ScoredHome
} from "@nhalo/types";
import { RESULT_COPY, buildDecisionLabels, buildTradeoffSummary, geocodePrecisionExplanation } from "../content";
import { sourceFreshnessLabel } from "../view-model";
import { useEffect, useState } from "react";
import { NegotiationTrackerCard } from "./NegotiationTrackerCard";
import { BuyerTransactionCommandCenterCard } from "./BuyerTransactionCommandCenterCard";
import { OfferPreparationCard } from "./OfferPreparationCard";
import { OfferSubmissionCard } from "./OfferSubmissionCard";
import { ClosingReadinessCard } from "./ClosingReadinessCard";
import { UnderContractCoordinationCard } from "./UnderContractCoordinationCard";
import { UnifiedActivityFeedPanel } from "./UnifiedActivityFeedPanel";

interface HomeDetailPanelProps {
  home: ScoredHome | null;
  allHomes: ScoredHome[];
  note?: ResultNote | null;
  financialReadiness?: FinancialReadiness | null;
  offerPreparation?: OfferPreparation | null;
  offerSubmission?: OfferSubmission | null;
  underContract?: UnderContractCoordination | null;
  closingReadiness?: ClosingReadiness | null;
  transactionCommandCenter?: BuyerTransactionCommandCenterView | null;
  notifications?: WorkflowNotification[];
  unifiedActivity?: UnifiedActivityRecord[];
  offerReadiness?: OfferReadiness | null;
  negotiation?: NegotiationRecord | null;
  negotiationEvents?: NegotiationEvent[];
  noteEnabled?: boolean;
  onClose(): void;
  onSaveNote?(body: string): void;
  onDeleteNote?(): void;
  onViewAudit(homeId: string): void;
  onCreateNegotiation?(payload: {
    propertyId: string;
    shortlistId?: string | null;
    offerReadinessId?: string | null;
    status?: NegotiationRecord["status"];
    initialOfferPrice: number;
    currentOfferPrice?: number;
    buyerWalkAwayPrice?: number | null;
  }): Promise<void> | void;
  onUpdateNegotiation?(
    id: string,
    patch: {
      status?: NegotiationRecord["status"];
      currentOfferPrice?: number;
      sellerCounterPrice?: number | null;
      buyerWalkAwayPrice?: number | null;
      roundNumber?: number;
    }
  ): Promise<void> | void;
  onAddNegotiationEvent?(
    negotiationId: string,
    payload: {
      type: NegotiationEvent["type"];
      label: string;
      details?: string | null;
    }
  ): Promise<void> | void;
  onCreateOfferPreparation?(payload: {
    propertyId: string;
    propertyAddressLabel: string;
    shortlistId?: string | null;
    offerReadinessId?: string | null;
    financialReadinessId: string;
    offerPrice?: number | null;
    earnestMoneyAmount?: number | null;
    downPaymentType?: OfferPreparation["downPaymentType"];
    downPaymentAmount?: number | null;
    downPaymentPercent?: number | null;
    financingContingency?: OfferPreparation["financingContingency"];
    inspectionContingency?: OfferPreparation["inspectionContingency"];
    appraisalContingency?: OfferPreparation["appraisalContingency"];
    closingTimelineDays?: number | null;
    possessionTiming?: OfferPreparation["possessionTiming"];
    possessionDaysAfterClosing?: number | null;
    notes?: string | null;
    buyerRationale?: string | null;
  }): Promise<void> | void;
  onUpdateOfferPreparation?(
    id: string,
    patch: {
      propertyAddressLabel?: string;
      offerPrice?: number | null;
      earnestMoneyAmount?: number | null;
      downPaymentType?: OfferPreparation["downPaymentType"];
      downPaymentAmount?: number | null;
      downPaymentPercent?: number | null;
      financingContingency?: OfferPreparation["financingContingency"];
      inspectionContingency?: OfferPreparation["inspectionContingency"];
      appraisalContingency?: OfferPreparation["appraisalContingency"];
      closingTimelineDays?: number | null;
      possessionTiming?: OfferPreparation["possessionTiming"];
      possessionDaysAfterClosing?: number | null;
      notes?: string | null;
      buyerRationale?: string | null;
    }
  ): Promise<void> | void;
  onCreateOfferSubmission?(payload: {
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
  onSubmitOfferSubmission?(id: string, submittedAt?: string | null): Promise<void> | void;
  onUpdateOfferSubmission?(
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
  onRespondToOfferSubmissionCounter?(
    id: string,
    decision: NonNullable<OfferSubmission["buyerCounterDecision"]>
  ): Promise<void> | void;
  onCreateUnderContract?(payload: {
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
  onUpdateUnderContract?(
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
  onUpdateUnderContractTask?(
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
  onUpdateUnderContractMilestone?(
    id: string,
    milestoneType: UnderContractCoordination["milestoneSummaries"][number]["milestoneType"],
    patch: {
      status?: UnderContractCoordination["milestoneSummaries"][number]["status"];
      occurredAt?: string | null;
      notes?: string | null;
    }
  ): Promise<void> | void;
  onCreateClosingReadiness?(payload: {
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
  onUpdateClosingReadiness?(
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
  onUpdateClosingChecklistItem?(
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
  onUpdateClosingMilestone?(
    id: string,
    milestoneType: ClosingReadiness["milestoneSummaries"][number]["milestoneType"],
    patch: {
      status?: ClosingReadiness["milestoneSummaries"][number]["status"];
      occurredAt?: string | null;
      notes?: string | null;
    }
  ): Promise<void> | void;
  onMarkClosingReady?(id: string): Promise<void> | void;
  onMarkClosingComplete?(id: string): Promise<void> | void;
}

export function HomeDetailPanel({
  home,
  allHomes,
  note,
  financialReadiness,
  offerPreparation,
  offerSubmission,
  underContract,
  closingReadiness,
  transactionCommandCenter,
  notifications = [],
  unifiedActivity = [],
  offerReadiness,
  negotiation,
  negotiationEvents = [],
  noteEnabled,
  onClose,
  onSaveNote,
  onDeleteNote,
  onViewAudit,
  onCreateNegotiation,
  onUpdateNegotiation,
  onAddNegotiationEvent,
  onCreateOfferPreparation,
  onUpdateOfferPreparation,
  onCreateOfferSubmission,
  onSubmitOfferSubmission,
  onUpdateOfferSubmission,
  onRespondToOfferSubmissionCounter,
  onCreateUnderContract,
  onUpdateUnderContract,
  onUpdateUnderContractTask,
  onUpdateUnderContractMilestone,
  onCreateClosingReadiness,
  onUpdateClosingReadiness,
  onUpdateClosingChecklistItem,
  onUpdateClosingMilestone,
  onMarkClosingReady,
  onMarkClosingComplete
}: HomeDetailPanelProps) {
  const [draftNote, setDraftNote] = useState("");

  useEffect(() => {
    setDraftNote(note?.body ?? "");
  }, [note?.body, home?.id]);

  if (!home) {
    return null;
  }

  const labels = buildDecisionLabels(home, allHomes);
  const tradeoff = buildTradeoffSummary(home);

  return (
    <aside className="detail-panel">
      <div className="summary-header">
        <div>
          <p className="section-label">{RESULT_COPY.detailTitle}</p>
          <h3>{home.address}</h3>
          <p className="muted">
            {home.city}, {home.state} {home.zipCode}
          </p>
        </div>
        <button className="ghost-button" onClick={onClose} type="button">
          Close
        </button>
      </div>

      <div className="chip-row">
        {labels.map((label) => (
          <span className="chip active" key={label}>
            {label}
          </span>
        ))}
      </div>

      <div className="summary-grid">
        <div className="summary-block">
          <h3>Home facts</h3>
          <p>
            ${home.price.toLocaleString()} · {home.sqft.toLocaleString()} sqft · {home.bedrooms} bd ·{" "}
            {home.bathrooms} ba
          </p>
          <p className="muted">
            {home.propertyType.replace("_", " ")} · {home.distanceMiles?.toFixed(2) ?? "0.00"} miles from origin
          </p>
        </div>

        <div className="summary-block">
          <h3>{RESULT_COPY.tradeoffs}</h3>
          <p>{tradeoff}</p>
          <p className="muted">{RESULT_COPY.confidence}: {home.scores.overallConfidence}</p>
        </div>
      </div>

      <div className="score-grid">
        <div className="score-pill strong">
          <span>Nhalo</span>
          <strong>{home.scores.nhalo}</strong>
        </div>
        <div className="score-pill steady">
          <span>Price</span>
          <strong>{home.scores.price}</strong>
        </div>
        <div className="score-pill steady">
          <span>Size</span>
          <strong>{home.scores.size}</strong>
        </div>
        <div className="score-pill steady">
          <span>Safety</span>
          <strong>{home.scores.safety}</strong>
        </div>
      </div>

      {offerReadiness ? (
        <div className="summary-grid">
          <div className="summary-block">
            <h3>Offer readiness</h3>
            <p>
              {offerReadiness.status.replaceAll("_", " ").toLowerCase()} · {offerReadiness.readinessScore} readiness
              score
            </p>
            <p className="muted">
              Recommended offer {offerReadiness.recommendedOfferPrice.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0
              })}{" "}
              · {offerReadiness.confidence} confidence
            </p>
          </div>
          <div className="summary-block">
            <h3>Offer blockers and next steps</h3>
            <p className="muted">
              {offerReadiness.blockingIssues.length > 0
                ? offerReadiness.blockingIssues.join(" ")
                : "No blocking issues are currently stored."}
            </p>
            <p className="muted">{offerReadiness.nextSteps.join(" · ")}</p>
          </div>
        </div>
      ) : null}

      <BuyerTransactionCommandCenterCard
        notifications={notifications.filter((entry) => entry.moduleName === "transaction_command_center")}
        summary={transactionCommandCenter ?? null}
      />

      <UnifiedActivityFeedPanel
        activity={unifiedActivity}
        title="Transaction activity"
        emptyMessage="No transaction activity is stored for this property yet."
      />

      {financialReadiness && onCreateOfferPreparation && onUpdateOfferPreparation ? (
        <OfferPreparationCard
          anchorPrice={home.price}
          financialReadiness={financialReadiness}
          notifications={notifications.filter((entry) => entry.moduleName === "offer_preparation")}
          offerPreparation={offerPreparation}
          offerReadiness={offerReadiness}
          onCreate={onCreateOfferPreparation}
          onUpdate={onUpdateOfferPreparation}
          propertyAddressLabel={home.address}
          propertyId={home.canonicalPropertyId ?? home.id}
          shortlistId={offerPreparation?.shortlistId ?? negotiation?.shortlistId ?? offerReadiness?.shortlistId ?? null}
        />
      ) : null}

      {offerPreparation &&
      onCreateOfferSubmission &&
      onSubmitOfferSubmission &&
      onUpdateOfferSubmission &&
      onRespondToOfferSubmissionCounter ? (
        <OfferSubmissionCard
          notifications={notifications.filter((entry) => entry.moduleName === "offer_submission")}
          offerPreparation={offerPreparation}
          offerSubmission={offerSubmission}
          onCreate={onCreateOfferSubmission}
          onRespondToCounter={onRespondToOfferSubmissionCounter}
          onSubmit={onSubmitOfferSubmission}
          onUpdate={onUpdateOfferSubmission}
          propertyAddressLabel={home.address}
          propertyId={home.canonicalPropertyId ?? home.id}
          shortlistId={
            offerSubmission?.shortlistId ??
            offerPreparation.shortlistId ??
            negotiation?.shortlistId ??
            offerReadiness?.shortlistId ??
            null
          }
        />
      ) : null}

      {offerSubmission &&
      onCreateUnderContract &&
      onUpdateUnderContract &&
      onUpdateUnderContractTask &&
      onUpdateUnderContractMilestone ? (
        <UnderContractCoordinationCard
          notifications={notifications.filter((entry) => entry.moduleName === "under_contract")}
          offerSubmission={offerSubmission}
          underContract={underContract}
          onCreate={onCreateUnderContract}
          onUpdate={onUpdateUnderContract}
          onUpdateMilestone={onUpdateUnderContractMilestone}
          onUpdateTask={onUpdateUnderContractTask}
          propertyAddressLabel={home.address}
          propertyId={home.canonicalPropertyId ?? home.id}
          shortlistId={
            underContract?.shortlistId ??
            offerSubmission.shortlistId ??
            offerPreparation?.shortlistId ??
            negotiation?.shortlistId ??
            offerReadiness?.shortlistId ??
            null
          }
        />
      ) : null}

      {underContract &&
      onCreateClosingReadiness &&
      onUpdateClosingReadiness &&
      onUpdateClosingChecklistItem &&
      onUpdateClosingMilestone &&
      onMarkClosingReady &&
      onMarkClosingComplete ? (
        <ClosingReadinessCard
          closingReadiness={closingReadiness}
          notifications={notifications.filter((entry) => entry.moduleName === "closing_readiness")}
          underContract={underContract}
          onCreate={onCreateClosingReadiness}
          onMarkClosed={onMarkClosingComplete}
          onMarkReady={onMarkClosingReady}
          onUpdate={onUpdateClosingReadiness}
          onUpdateChecklistItem={onUpdateClosingChecklistItem}
          onUpdateMilestone={onUpdateClosingMilestone}
          propertyAddressLabel={home.address}
          propertyId={home.canonicalPropertyId ?? home.id}
          shortlistId={
            closingReadiness?.shortlistId ??
            underContract.shortlistId ??
            offerSubmission?.shortlistId ??
            offerPreparation?.shortlistId ??
            negotiation?.shortlistId ??
            offerReadiness?.shortlistId ??
            null
          }
        />
      ) : null}

      {onCreateNegotiation && onUpdateNegotiation && onAddNegotiationEvent && (negotiation || offerReadiness) ? (
        <NegotiationTrackerCard
          item={{
            id: `detail-${home.canonicalPropertyId ?? home.id}`,
            shortlistId: negotiation?.shortlistId ?? offerReadiness?.shortlistId ?? "",
            canonicalPropertyId: home.canonicalPropertyId ?? home.id,
            sourceSnapshotId: null,
            sourceHistoryId: null,
            sourceSearchDefinitionId: null,
            capturedHome: home,
            reviewState: "undecided",
            addedAt: negotiation?.createdAt ?? offerReadiness?.createdAt ?? new Date().toISOString(),
            updatedAt: negotiation?.updatedAt ?? offerReadiness?.updatedAt ?? new Date().toISOString()
          }}
          events={negotiationEvents}
          negotiation={negotiation}
          offerReadiness={offerReadiness}
          onAddEvent={onAddNegotiationEvent}
          onCreate={onCreateNegotiation}
          onUpdate={onUpdateNegotiation}
        />
      ) : null}

      <div className="summary-block">
        <h3>{RESULT_COPY.whyThisHome}</h3>
        <p>{home.explainability?.headline ?? home.explanation}</p>
        <p className="muted">
          Primary {home.explainability?.scoreDrivers.primary ?? "n/a"} · secondary{" "}
          {home.explainability?.scoreDrivers.secondary ?? "n/a"} · weakest{" "}
          {home.explainability?.scoreDrivers.weakest ?? "n/a"}
        </p>
      </div>

      <div className="two-column-list">
        <div>
          <p className="section-label">Strengths</p>
          <ul>
            {(home.strengths ?? []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="section-label">{RESULT_COPY.concerns}</p>
          <ul>
            {(home.risks ?? []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-block">
          <h3>Freshness and provenance</h3>
          <p>
            Listing {sourceFreshnessLabel(home.provenance?.listingDataSource)} · safety{" "}
            {sourceFreshnessLabel(home.provenance?.safetyDataSource)} · geocode{" "}
            {sourceFreshnessLabel(home.provenance?.geocodeDataSource)}
          </p>
          <p className="muted">
            Listing provider {home.provenance?.listingProvider ?? "n/a"} · safety source{" "}
            {home.provenance?.crimeProvider ?? "n/a"} / {home.provenance?.schoolProvider ?? "n/a"}
          </p>
        </div>
        <div className="summary-block">
          <h3>{RESULT_COPY.originPrecision}</h3>
          <p>{home.provenance?.geocodePrecision ?? "none"}</p>
          <p className="muted">
            {geocodePrecisionExplanation(home.provenance?.geocodePrecision ?? "none")}
          </p>
        </div>
      </div>

      {(home.dataWarnings ?? []).length > 0 || (home.degradedReasons ?? []).length > 0 ? (
        <div className="summary-block">
          <h3>Data warnings</h3>
          <ul>
            {[...(home.dataWarnings ?? []), ...(home.degradedReasons ?? [])].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {(home.qualityFlags ?? []).length > 0 || (home.integrityFlags ?? []).length > 0 ? (
        <div className="chip-row">
          {(home.qualityFlags ?? []).map((flag) => (
            <span className="chip subdued" key={flag}>
              {flag}
            </span>
          ))}
          {(home.integrityFlags ?? []).map((flag) => (
            <span className="chip subdued" key={flag}>
              {flag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="card-actions">
        {noteEnabled && onSaveNote ? (
          <>
            <label className="note-editor">
              <span>{RESULT_COPY.resultNotesTitle}</span>
              <textarea
                placeholder="Example: Keep this one in the partner shortlist because safety is strong."
                value={draftNote}
                onChange={(event) => setDraftNote(event.target.value)}
              />
            </label>
            <button
              className="ghost-button"
              disabled={!draftNote.trim()}
              onClick={() => onSaveNote(draftNote.trim())}
              type="button"
            >
              {note ? "Update note" : "Save note"}
            </button>
            {note && onDeleteNote ? (
              <button className="ghost-button" onClick={onDeleteNote} type="button">
                Delete note
              </button>
            ) : null}
          </>
        ) : null}
        <button className="ghost-button" onClick={() => onViewAudit(home.id)} type="button">
          View audit details
        </button>
      </div>
    </aside>
  );
}
