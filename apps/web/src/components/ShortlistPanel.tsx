import { useMemo, useState } from "react";
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
  SharedShortlist,
  ResultNote,
  ReviewState,
  SelectedChoiceConciergeSummary,
  Shortlist,
  ShortlistItem,
  WorkflowNotification,
  WorkflowActivityRecord
} from "@nhalo/types";
import {
  RESULT_COPY,
  SHORTLIST_COPY,
  buildWorkflowActivityLabel
} from "../content";
import { NegotiationTrackerCard } from "./NegotiationTrackerCard";
import { BuyerTransactionCommandCenterCard } from "./BuyerTransactionCommandCenterCard";
import { OfferPreparationCard } from "./OfferPreparationCard";
import { OfferSubmissionCard } from "./OfferSubmissionCard";
import { OfferReadinessCard } from "./OfferReadinessCard";
import { ClosingReadinessCard } from "./ClosingReadinessCard";
import { UnderContractCoordinationCard } from "./UnderContractCoordinationCard";
import { SelectedChoiceSummaryCard } from "./SelectedChoiceSummaryCard";
import { DecisionRationaleEditor } from "./DecisionRationaleEditor";
import { OfferStrategyCard } from "./OfferStrategyCard";

interface ShortlistPanelProps {
  shortlists: Shortlist[];
  selectedShortlistId: string | null;
  financialReadiness: FinancialReadiness | null;
  notifications?: WorkflowNotification[];
  selectedChoiceSummary?: SelectedChoiceConciergeSummary | null;
  items: ShortlistItem[];
  offerPreparations: OfferPreparation[];
  offerSubmissions: OfferSubmission[];
  underContracts: UnderContractCoordination[];
  closingReadiness: ClosingReadiness[];
  transactionCommandCenters: BuyerTransactionCommandCenterView[];
  offerReadiness: OfferReadiness[];
  negotiations: NegotiationRecord[];
  negotiationEventsByRecordId: Record<string, NegotiationEvent[]>;
  notes: ResultNote[];
  workflowActivity: WorkflowActivityRecord[];
  onCreate(payload: { title: string; description?: string | null }): void;
  onSelect(shortlistId: string): void;
  onTogglePinned(shortlist: Shortlist): void;
  onDelete(shortlistId: string): void;
  onRemoveItem(shortlistId: string, itemId: string): void;
  onReviewStateChange(shortlistId: string, itemId: string, reviewState: ReviewState): void;
  onUpdateDecision?(
    shortlistId: string,
    itemId: string,
    patch: {
      decisionRationale?: string | null;
      decisionConfidence?: ShortlistItem["decisionConfidence"];
      lastDecisionReviewedAt?: string | null;
    }
  ): void;
  onSelectChoice?(shortlistId: string, itemId: string): void;
  onDropChoice?(shortlistId: string, itemId: string): void;
  onMoveBackup?(shortlistId: string, itemId: string, direction: "up" | "down"): void;
  onCreateOfferReadiness(payload: {
    shortlistId: string;
    propertyId: string;
    status?: OfferReadiness["status"];
    financingReadiness?: OfferReadiness["inputs"]["financingReadiness"];
    propertyFitConfidence?: OfferReadiness["inputs"]["propertyFitConfidence"];
    riskToleranceAlignment?: OfferReadiness["inputs"]["riskToleranceAlignment"];
    riskLevel?: OfferReadiness["inputs"]["riskLevel"];
    userConfirmed?: boolean;
  }): void;
  onUpdateOfferReadiness(
    id: string,
    patch: {
      status?: OfferReadiness["status"];
      financingReadiness?: OfferReadiness["inputs"]["financingReadiness"];
      propertyFitConfidence?: OfferReadiness["inputs"]["propertyFitConfidence"];
      riskToleranceAlignment?: OfferReadiness["inputs"]["riskToleranceAlignment"];
      riskLevel?: OfferReadiness["inputs"]["riskLevel"];
      userConfirmed?: boolean;
    }
  ): void;
  onCreateOfferPreparation(payload: {
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
  onUpdateOfferPreparation(
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
  onCreateOfferSubmission(payload: {
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
  onSubmitOfferSubmission(id: string, submittedAt?: string | null): Promise<void> | void;
  onUpdateOfferSubmission(
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
  onRespondToOfferSubmissionCounter(
    id: string,
    decision: NonNullable<OfferSubmission["buyerCounterDecision"]>
  ): Promise<void> | void;
  onCreateUnderContract(payload: {
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
  onUpdateUnderContract(
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
  onUpdateUnderContractTask(
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
  onUpdateUnderContractMilestone(
    id: string,
    milestoneType: UnderContractCoordination["milestoneSummaries"][number]["milestoneType"],
    patch: {
      status?: UnderContractCoordination["milestoneSummaries"][number]["status"];
      occurredAt?: string | null;
      notes?: string | null;
    }
  ): Promise<void> | void;
  onCreateClosingReadiness(payload: {
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
  onUpdateClosingReadiness(
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
  onUpdateClosingChecklistItem(
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
  onUpdateClosingMilestone(
    id: string,
    milestoneType: ClosingReadiness["milestoneSummaries"][number]["milestoneType"],
    patch: {
      status?: ClosingReadiness["milestoneSummaries"][number]["status"];
      occurredAt?: string | null;
      notes?: string | null;
    }
  ): Promise<void> | void;
  onMarkClosingReady(id: string): Promise<void> | void;
  onMarkClosingComplete(id: string): Promise<void> | void;
  onCreateNegotiation(payload: {
    propertyId: string;
    shortlistId?: string | null;
    offerReadinessId?: string | null;
    status?: NegotiationRecord["status"];
    initialOfferPrice: number;
    currentOfferPrice?: number;
    buyerWalkAwayPrice?: number | null;
  }): Promise<void> | void;
  onUpdateNegotiation(
    id: string,
    patch: {
      status?: NegotiationRecord["status"];
      currentOfferPrice?: number;
      sellerCounterPrice?: number | null;
      buyerWalkAwayPrice?: number | null;
      roundNumber?: number;
    }
  ): Promise<void> | void;
  onAddNegotiationEvent(
    negotiationId: string,
    payload: {
      type: NegotiationEvent["type"];
      label: string;
      details?: string | null;
    }
  ): Promise<void> | void;
  onSaveNote(entityId: string, noteId: string | null, body: string): void;
  onDeleteNote(noteId: string): void;
  onOpenHistoricalCompare(itemId: string): void;
  historicalCompareEnabled: boolean;
  sharedShortlists?: SharedShortlist[];
  onCreateShare?(shortlistId: string, shareMode: SharedShortlist["shareMode"]): void;
  onCopyShareLink?(share: SharedShortlist): void;
  onRevokeShare?(shareId: string): void;
}

const REVIEW_STATES: ReviewState[] = [
  "undecided",
  "interested",
  "needs_review",
  "rejected"
];

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}

function choiceLabel(item: ShortlistItem): string {
  switch (item.choiceStatus) {
    case "selected":
      return "Selected choice";
    case "backup":
      return `Backup${item.selectionRank ? ` #${item.selectionRank - 1}` : ""}`;
    case "active_pursuit":
      return "Active pursuit";
    case "under_contract":
      return "Under contract";
    case "closed":
      return "Closed";
    case "dropped":
      return "Dropped";
    case "replaced":
      return "Replaced";
    default:
      return "Candidate";
  }
}

function choicePriority(item: ShortlistItem): number {
  switch (item.choiceStatus) {
    case "closed":
      return 0;
    case "under_contract":
      return 1;
    case "active_pursuit":
      return 2;
    case "selected":
      return 3;
    case "backup":
      return 4;
    case "candidate":
      return 5;
    case "dropped":
      return 6;
    case "replaced":
      return 7;
  }
}

export function ShortlistPanel({
  shortlists,
  selectedShortlistId,
  financialReadiness,
  notifications = [],
  selectedChoiceSummary = null,
  items,
  offerPreparations,
  offerSubmissions,
  underContracts,
  closingReadiness,
  offerReadiness,
  negotiations,
  negotiationEventsByRecordId,
  notes,
  workflowActivity,
  onCreate,
  onSelect,
  onTogglePinned,
  onDelete,
  onRemoveItem,
  onReviewStateChange,
  onUpdateDecision,
  onSelectChoice,
  onDropChoice,
  onMoveBackup,
  onCreateOfferReadiness,
  onUpdateOfferReadiness,
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
  onMarkClosingComplete,
  transactionCommandCenters,
  onCreateNegotiation,
  onUpdateNegotiation,
  onAddNegotiationEvent,
  onSaveNote,
  onDeleteNote,
  onOpenHistoricalCompare,
  historicalCompareEnabled,
  sharedShortlists = [],
  onCreateShare,
  onCopyShareLink,
  onRevokeShare
}: ShortlistPanelProps) {
  const [title, setTitle] = useState(SHORTLIST_COPY.defaultTitle);
  const [description, setDescription] = useState("");
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});

  const selectedShortlist = useMemo(
    () => shortlists.find((entry) => entry.id === selectedShortlistId) ?? null,
    [selectedShortlistId, shortlists]
  );
  const activeShortlistId = selectedShortlist?.id ?? "";
  const offerPreparationsByPropertyId = useMemo(() => {
    const map = new Map<string, OfferPreparation>();
    for (const entry of offerPreparations) {
      map.set(entry.propertyId, entry);
    }
    return map;
  }, [offerPreparations]);
  const offerReadinessByPropertyId = useMemo(() => {
    const map = new Map<string, OfferReadiness>();
    for (const entry of offerReadiness) {
      map.set(entry.propertyId, entry);
    }
    return map;
  }, [offerReadiness]);
  const offerSubmissionsByPropertyId = useMemo(() => {
    const map = new Map<string, OfferSubmission>();
    for (const entry of offerSubmissions) {
      map.set(entry.propertyId, entry);
    }
    return map;
  }, [offerSubmissions]);
  const underContractsByPropertyId = useMemo(() => {
    const map = new Map<string, UnderContractCoordination>();
    for (const entry of underContracts) {
      map.set(entry.propertyId, entry);
    }
    return map;
  }, [underContracts]);
  const closingReadinessByPropertyId = useMemo(() => {
    const map = new Map<string, ClosingReadiness>();
    for (const entry of closingReadiness) {
      map.set(entry.propertyId, entry);
    }
    return map;
  }, [closingReadiness]);
  const commandCentersByPropertyId = useMemo(() => {
    const map = new Map<string, BuyerTransactionCommandCenterView>();
    for (const entry of transactionCommandCenters) {
      map.set(entry.propertyId, entry);
    }
    return map;
  }, [transactionCommandCenters]);
  const notificationsByPropertyId = useMemo(() => {
    const map = new Map<string, WorkflowNotification[]>();
    for (const entry of notifications) {
      if (!entry.propertyId) {
        continue;
      }
      const next = map.get(entry.propertyId) ?? [];
      next.push(entry);
      map.set(entry.propertyId, next);
    }
    return map;
  }, [notifications]);
  const negotiationsByPropertyId = useMemo(() => {
    const map = new Map<string, NegotiationRecord>();
    for (const entry of negotiations) {
      map.set(entry.propertyId, entry);
    }
    return map;
  }, [negotiations]);
  const sortedItems = useMemo(
    () =>
      [...items].sort((left, right) => {
        const priorityDelta = choicePriority(left) - choicePriority(right);
        if (priorityDelta !== 0) {
          return priorityDelta;
        }
        if ((left.selectionRank ?? Number.POSITIVE_INFINITY) !== (right.selectionRank ?? Number.POSITIVE_INFINITY)) {
          return (left.selectionRank ?? Number.POSITIVE_INFINITY) - (right.selectionRank ?? Number.POSITIVE_INFINITY);
        }
        return right.updatedAt.localeCompare(left.updatedAt);
      }),
    [items]
  );
  const primaryItem = useMemo(
    () =>
      sortedItems.find((item) =>
        ["selected", "active_pursuit", "under_contract", "closed"].includes(item.choiceStatus)
      ) ?? null,
    [sortedItems]
  );
  const backupCount = useMemo(
    () => sortedItems.filter((item) => item.choiceStatus === "backup").length,
    [sortedItems]
  );
  const backupItems = useMemo(
    () => sortedItems.filter((item) => item.choiceStatus === "backup"),
    [sortedItems]
  );
  const secondaryItems = useMemo(
    () =>
      sortedItems.filter((item) => item.id !== primaryItem?.id && item.choiceStatus !== "backup"),
    [primaryItem?.id, sortedItems]
  );

  function renderReviewState(item: ShortlistItem) {
    return (
      <label>
        <span>Review state</span>
        <select
          value={item.reviewState}
          onChange={(event) =>
            onReviewStateChange(activeShortlistId, item.id, event.target.value as ReviewState)
          }
        >
          {REVIEW_STATES.map((state) => (
            <option key={state} value={state}>
              {state.replace("_", " ")}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <section className="activity-panel shortlist-panel">
      <div className="summary-header">
        <div>
          <p className="section-label">{RESULT_COPY.shortlistTitle}</p>
          <h3>Save homes for partner review</h3>
        </div>
      </div>

      <p className="muted">{RESULT_COPY.shortlistWarning}</p>

      <div className="activity-save">
        <label>
          <span>{SHORTLIST_COPY.createTitle}</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          <span>Description</span>
          <textarea
            placeholder={SHORTLIST_COPY.descriptionPlaceholder}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <button
          className="submit-button"
          disabled={!title.trim()}
          onClick={() => {
            onCreate({
              title: title.trim(),
              description: description.trim() || null
            });
            setDescription("");
          }}
          type="button"
        >
          Create shortlist
        </button>
      </div>

      <div className="activity-section">
        <div className="summary-header">
          <h4>Shortlists</h4>
          <p className="muted">{shortlists.length} saved</p>
        </div>
        <div className="activity-list">
          {shortlists.map((shortlist) => (
            <article
              className={`activity-card ${selectedShortlistId === shortlist.id ? "active-card" : ""}`}
              key={shortlist.id}
            >
              <div>
                <p className="section-label">
                  Mutable workflow list {shortlist.pinned ? "· pinned" : ""}
                </p>
                <strong>{shortlist.title}</strong>
                <p className="muted">
                  {shortlist.itemCount} homes · updated {formatTimestamp(shortlist.updatedAt)}
                </p>
                {shortlist.description ? <p className="muted">{shortlist.description}</p> : null}
              </div>
              <div className="activity-actions">
                <button className="chip" onClick={() => onSelect(shortlist.id)} type="button">
                  Open
                </button>
                <button className="chip" onClick={() => onTogglePinned(shortlist)} type="button">
                  {shortlist.pinned ? "Unpin" : "Pin"}
                </button>
                <button className="chip" onClick={() => onDelete(shortlist.id)} type="button">
                  Delete
                </button>
              </div>
            </article>
          ))}
          {shortlists.length === 0 ? <p className="muted">No shortlists created yet.</p> : null}
        </div>
      </div>

      {selectedShortlist ? (
        <div className="activity-section">
          <div className="summary-header">
            <h4>{selectedShortlist.title}</h4>
            <p className="muted">{items.length} homes saved</p>
          </div>
          {onCreateShare ? (
            <div className="activity-card">
              <div>
                <p className="section-label">{SHORTLIST_COPY.shareTitle}</p>
                <strong>Invite a viewer or reviewer</strong>
                <p className="muted">{SHORTLIST_COPY.sharedWarning}</p>
              </div>
              <div className="activity-actions">
                <button className="chip" onClick={() => onCreateShare(selectedShortlist.id, "read_only")} type="button">
                  {SHORTLIST_COPY.shareReadOnly}
                </button>
                <button className="chip" onClick={() => onCreateShare(selectedShortlist.id, "comment_only")} type="button">
                  {SHORTLIST_COPY.shareCommentOnly}
                </button>
                <button className="chip" onClick={() => onCreateShare(selectedShortlist.id, "review_only")} type="button">
                  {SHORTLIST_COPY.shareReviewOnly}
                </button>
              </div>
              {sharedShortlists.filter((entry) => entry.shortlistId === selectedShortlist.id).length > 0 ? (
                <div className="activity-list">
                  {sharedShortlists
                    .filter((entry) => entry.shortlistId === selectedShortlist.id)
                    .map((share) => (
                      <article className="activity-card" key={share.id}>
                        <div>
                          <p className="section-label">{share.shareMode.replace("_", " ")}</p>
                          <strong>{share.status}</strong>
                          <p className="muted">
                            {share.openCount} opens · created {formatTimestamp(share.createdAt)}
                          </p>
                        </div>
                        <div className="activity-actions">
                          <button className="chip" onClick={() => onCopyShareLink?.(share)} type="button">
                            Copy link
                          </button>
                          {share.status === "active" ? (
                            <button className="chip" onClick={() => onRevokeShare?.(share.shareId)} type="button">
                              Revoke
                            </button>
                          ) : null}
                        </div>
                      </article>
                    ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {selectedChoiceSummary ? (
            <>
              <SelectedChoiceSummaryCard
                summary={selectedChoiceSummary}
                title="Selected choice concierge"
              />
              <OfferStrategyCard strategy={selectedChoiceSummary.offerStrategy} />
            </>
          ) : (
            <article className={`activity-card ${primaryItem ? "active-card" : ""}`}>
              <div>
                <p className="section-label">Selected choice decision layer</p>
                <strong>
                  {primaryItem
                    ? `${primaryItem.capturedHome.address} · ${choiceLabel(primaryItem)}`
                    : "No selected choice is active"}
                </strong>
                <p className="muted">
                  {primaryItem?.decisionRationale?.trim()
                    ? primaryItem.decisionRationale
                    : primaryItem
                      ? "This home owns the active workflow narrative for the shortlist."
                      : "Promote a shortlisted home to make one property the primary decision track."}
                </p>
                <p className="muted">
                  {backupCount} backup{backupCount === 1 ? "" : "s"}
                  {primaryItem?.decisionConfidence ? ` · ${primaryItem.decisionConfidence} decision confidence` : ""}
                </p>
              </div>
            </article>
          )}
          {primaryItem ? (
            <div className="activity-list">
              {(() => {
                const note = notes.find((entry) => entry.entityId === primaryItem.id) ?? null;
                const draft = draftNotes[primaryItem.id] ?? note?.body ?? "";

                return (
                  <article className="activity-card active-card" key={primaryItem.id}>
                    <div>
                      <p className="section-label">
                        {choiceLabel(primaryItem)} · {primaryItem.capturedHome.address} · {primaryItem.capturedHome.scores.nhalo} Nhalo
                      </p>
                      <strong>
                        {primaryItem.capturedHome.price.toLocaleString("en-US", {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 0
                        })}{" "}
                        · {primaryItem.capturedHome.bedrooms} bd · {primaryItem.capturedHome.sqft.toLocaleString()} sqft
                      </strong>
                      <p className="muted">
                        Captured {formatTimestamp(primaryItem.addedAt)} · {primaryItem.capturedHome.scores.overallConfidence} confidence
                      </p>
                      {primaryItem.decisionRisks.length > 0 ? (
                        <p className="muted">Decision risks: {primaryItem.decisionRisks.join(" · ")}</p>
                      ) : null}
                    </div>

                    <DecisionRationaleEditor
                      item={primaryItem}
                      onSave={(patch) => onUpdateDecision?.(activeShortlistId, primaryItem.id, patch)}
                    />

                    <div className="workflow-controls">
                      {renderReviewState(primaryItem)}

                      <div className="activity-actions">
                        {onDropChoice && primaryItem.choiceStatus !== "closed" ? (
                          <button className="chip" onClick={() => onDropChoice(activeShortlistId, primaryItem.id)} type="button">
                            Drop choice
                          </button>
                        ) : null}
                        {historicalCompareEnabled ? (
                          <button className="chip" onClick={() => onOpenHistoricalCompare(primaryItem.id)} type="button">
                            Compare to current
                          </button>
                        ) : null}
                        <button className="chip" onClick={() => onRemoveItem(activeShortlistId, primaryItem.id)} type="button">
                          Remove
                        </button>
                      </div>
                    </div>

                    <BuyerTransactionCommandCenterCard
                      notifications={
                        (notificationsByPropertyId.get(primaryItem.canonicalPropertyId) ?? []).filter(
                          (entry) => entry.moduleName === "transaction_command_center"
                        )
                      }
                      summary={commandCentersByPropertyId.get(primaryItem.canonicalPropertyId) ?? null}
                    />

                    <OfferReadinessCard
                      item={primaryItem}
                      offerReadiness={offerReadinessByPropertyId.get(primaryItem.canonicalPropertyId) ?? null}
                      onCreate={onCreateOfferReadiness}
                      onUpdate={onUpdateOfferReadiness}
                    />
                    <OfferPreparationCard
                      anchorPrice={primaryItem.capturedHome.price}
                      financialReadiness={financialReadiness}
                      notifications={
                        (notificationsByPropertyId.get(primaryItem.canonicalPropertyId) ?? []).filter(
                          (entry) => entry.moduleName === "offer_preparation"
                        )
                      }
                      offerPreparation={offerPreparationsByPropertyId.get(primaryItem.canonicalPropertyId) ?? null}
                      offerReadiness={offerReadinessByPropertyId.get(primaryItem.canonicalPropertyId) ?? null}
                      offerStrategy={selectedChoiceSummary?.offerStrategy ?? null}
                      onCreate={onCreateOfferPreparation}
                      onUpdate={onUpdateOfferPreparation}
                      propertyAddressLabel={primaryItem.capturedHome.address}
                      propertyId={primaryItem.canonicalPropertyId}
                      shortlistId={primaryItem.shortlistId}
                    />
                    <OfferSubmissionCard
                      notifications={
                        (notificationsByPropertyId.get(primaryItem.canonicalPropertyId) ?? []).filter(
                          (entry) => entry.moduleName === "offer_submission"
                        )
                      }
                      offerPreparation={offerPreparationsByPropertyId.get(primaryItem.canonicalPropertyId) ?? null}
                      offerSubmission={offerSubmissionsByPropertyId.get(primaryItem.canonicalPropertyId) ?? null}
                      onCreate={onCreateOfferSubmission}
                      onRespondToCounter={onRespondToOfferSubmissionCounter}
                      onSubmit={onSubmitOfferSubmission}
                      onUpdate={onUpdateOfferSubmission}
                      propertyAddressLabel={primaryItem.capturedHome.address}
                      propertyId={primaryItem.canonicalPropertyId}
                      shortlistId={primaryItem.shortlistId}
                    />
                    <UnderContractCoordinationCard
                      notifications={
                        (notificationsByPropertyId.get(primaryItem.canonicalPropertyId) ?? []).filter(
                          (entry) => entry.moduleName === "under_contract"
                        )
                      }
                      offerSubmission={offerSubmissionsByPropertyId.get(primaryItem.canonicalPropertyId) ?? null}
                      underContract={underContractsByPropertyId.get(primaryItem.canonicalPropertyId) ?? null}
                      onCreate={onCreateUnderContract}
                      onUpdate={onUpdateUnderContract}
                      onUpdateMilestone={onUpdateUnderContractMilestone}
                      onUpdateTask={onUpdateUnderContractTask}
                      propertyAddressLabel={primaryItem.capturedHome.address}
                      propertyId={primaryItem.canonicalPropertyId}
                      shortlistId={primaryItem.shortlistId}
                    />
                    <ClosingReadinessCard
                      closingReadiness={closingReadinessByPropertyId.get(primaryItem.canonicalPropertyId) ?? null}
                      notifications={
                        (notificationsByPropertyId.get(primaryItem.canonicalPropertyId) ?? []).filter(
                          (entry) => entry.moduleName === "closing_readiness"
                        )
                      }
                      underContract={underContractsByPropertyId.get(primaryItem.canonicalPropertyId) ?? null}
                      onCreate={onCreateClosingReadiness}
                      onMarkClosed={onMarkClosingComplete}
                      onMarkReady={onMarkClosingReady}
                      onUpdate={onUpdateClosingReadiness}
                      onUpdateChecklistItem={onUpdateClosingChecklistItem}
                      onUpdateMilestone={onUpdateClosingMilestone}
                      propertyAddressLabel={primaryItem.capturedHome.address}
                      propertyId={primaryItem.canonicalPropertyId}
                      shortlistId={primaryItem.shortlistId}
                    />
                    <NegotiationTrackerCard
                      item={primaryItem}
                      negotiation={negotiationsByPropertyId.get(primaryItem.canonicalPropertyId) ?? null}
                      offerReadiness={offerReadinessByPropertyId.get(primaryItem.canonicalPropertyId) ?? null}
                      events={
                        negotiationEventsByRecordId[
                          negotiationsByPropertyId.get(primaryItem.canonicalPropertyId)?.id ?? ""
                        ] ?? []
                      }
                      onAddEvent={onAddNegotiationEvent}
                      onCreate={onCreateNegotiation}
                      onUpdate={onUpdateNegotiation}
                    />

                    <label className="note-editor">
                      <span>{RESULT_COPY.resultNotesTitle}</span>
                      <textarea
                        placeholder={SHORTLIST_COPY.notesPlaceholder}
                        value={draft}
                        onChange={(event) =>
                          setDraftNotes((current) => ({
                            ...current,
                            [primaryItem.id]: event.target.value
                          }))
                        }
                      />
                    </label>

                    <div className="activity-actions">
                      <button
                        className="chip"
                        disabled={!draft.trim()}
                        onClick={() => onSaveNote(primaryItem.id, note?.id ?? null, draft.trim())}
                        type="button"
                      >
                        {note ? "Update note" : "Save note"}
                      </button>
                      {note ? (
                        <button className="chip" onClick={() => onDeleteNote(note.id)} type="button">
                          Delete note
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })()}
            </div>
          ) : null}

          {backupItems.length > 0 ? (
            <div className="activity-section">
              <div className="summary-header">
                <h4>{SHORTLIST_COPY.backupsLabel}</h4>
                <p className="muted">{backupItems.length} ordered fallback homes</p>
              </div>
              <div className="activity-list">
                {backupItems.map((item, index) => (
                  <article className="activity-card" key={item.id}>
                    <div>
                      <p className="section-label">
                        {choiceLabel(item)} · {item.capturedHome.address}
                      </p>
                      <strong>
                        {item.capturedHome.price.toLocaleString("en-US", {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 0
                        })}{" "}
                        · {item.capturedHome.bedrooms} bd · {item.capturedHome.sqft.toLocaleString()} sqft
                      </strong>
                      <p className="muted">
                        {item.decisionConfidence
                          ? `${item.decisionConfidence} decision confidence`
                          : SHORTLIST_COPY.confidenceUnset}
                      </p>
                    </div>

                    <DecisionRationaleEditor
                      compact
                      item={item}
                      onSave={(patch) => onUpdateDecision?.(activeShortlistId, item.id, patch)}
                    />

                    <div className="activity-actions">
                      {onSelectChoice ? (
                        <button className="chip" onClick={() => onSelectChoice(activeShortlistId, item.id)} type="button">
                          Set as selected choice
                        </button>
                      ) : null}
                      {onMoveBackup ? (
                        <button
                          className="chip"
                          disabled={index === 0}
                          onClick={() => onMoveBackup(activeShortlistId, item.id, "up")}
                          type="button"
                        >
                          {SHORTLIST_COPY.moveBackupUpAction}
                        </button>
                      ) : null}
                      {onMoveBackup ? (
                        <button
                          className="chip"
                          disabled={index === backupItems.length - 1}
                          onClick={() => onMoveBackup(activeShortlistId, item.id, "down")}
                          type="button"
                        >
                          {SHORTLIST_COPY.moveBackupDownAction}
                        </button>
                      ) : null}
                      {historicalCompareEnabled ? (
                        <button className="chip" onClick={() => onOpenHistoricalCompare(item.id)} type="button">
                          Compare to current
                        </button>
                      ) : null}
                      <button className="chip" onClick={() => onRemoveItem(activeShortlistId, item.id)} type="button">
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {secondaryItems.length > 0 ? (
            <div className="activity-section">
              <div className="summary-header">
                <h4>{SHORTLIST_COPY.otherHomesLabel}</h4>
                <p className="muted">{secondaryItems.length} additional homes in the shortlist</p>
              </div>
              <div className="activity-list">
                {secondaryItems.map((item) => (
                  <article className="activity-card" key={item.id}>
                    <div>
                      <p className="section-label">
                        {choiceLabel(item)} · {item.capturedHome.address}
                      </p>
                      <strong>
                        {item.capturedHome.price.toLocaleString("en-US", {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 0
                        })}{" "}
                        · {item.capturedHome.bedrooms} bd · {item.capturedHome.sqft.toLocaleString()} sqft
                      </strong>
                      <p className="muted">
                        Captured {formatTimestamp(item.addedAt)} · {item.capturedHome.scores.overallConfidence} confidence
                      </p>
                      {item.decisionRationale?.trim() ? <p className="muted">{item.decisionRationale}</p> : null}
                    </div>

                    <div className="workflow-controls">
                      {renderReviewState(item)}
                      <div className="activity-actions">
                        {item.choiceStatus === "candidate" && onSelectChoice ? (
                          <button className="chip" onClick={() => onSelectChoice(activeShortlistId, item.id)} type="button">
                            Set as selected choice
                          </button>
                        ) : null}
                        {historicalCompareEnabled ? (
                          <button className="chip" onClick={() => onOpenHistoricalCompare(item.id)} type="button">
                            Compare to current
                          </button>
                        ) : null}
                        <button className="chip" onClick={() => onRemoveItem(activeShortlistId, item.id)} type="button">
                          Remove
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {items.length === 0 ? <p className="muted">No homes saved in this shortlist yet.</p> : null}
        </div>
      ) : null}

      <div className="activity-section">
        <div className="summary-header">
          <h4>Workflow history</h4>
          <p className="muted">{workflowActivity.length} recent actions</p>
        </div>
        <div className="activity-list">
          {workflowActivity.map((entry) => (
            <article className="activity-card" key={entry.id}>
              <div>
                <p className="section-label">{buildWorkflowActivityLabel(entry.eventType)}</p>
                <p className="muted">{formatTimestamp(entry.createdAt)}</p>
              </div>
            </article>
          ))}
          {workflowActivity.length === 0 ? <p className="muted">No shortlist or note activity yet.</p> : null}
        </div>
      </div>
    </section>
  );
}
