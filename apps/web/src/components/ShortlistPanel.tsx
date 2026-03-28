import { useMemo, useState } from "react";
import type {
  OfferReadiness,
  SharedShortlist,
  ResultNote,
  ReviewState,
  Shortlist,
  ShortlistItem,
  WorkflowActivityRecord
} from "@nhalo/types";
import {
  RESULT_COPY,
  SHORTLIST_COPY,
  buildWorkflowActivityLabel
} from "../content";
import { OfferReadinessCard } from "./OfferReadinessCard";

interface ShortlistPanelProps {
  shortlists: Shortlist[];
  selectedShortlistId: string | null;
  items: ShortlistItem[];
  offerReadiness: OfferReadiness[];
  notes: ResultNote[];
  workflowActivity: WorkflowActivityRecord[];
  onCreate(payload: { title: string; description?: string | null }): void;
  onSelect(shortlistId: string): void;
  onTogglePinned(shortlist: Shortlist): void;
  onDelete(shortlistId: string): void;
  onRemoveItem(shortlistId: string, itemId: string): void;
  onReviewStateChange(shortlistId: string, itemId: string, reviewState: ReviewState): void;
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

export function ShortlistPanel({
  shortlists,
  selectedShortlistId,
  items,
  offerReadiness,
  notes,
  workflowActivity,
  onCreate,
  onSelect,
  onTogglePinned,
  onDelete,
  onRemoveItem,
  onReviewStateChange,
  onCreateOfferReadiness,
  onUpdateOfferReadiness,
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
  const offerReadinessByPropertyId = useMemo(() => {
    const map = new Map<string, OfferReadiness>();
    for (const entry of offerReadiness) {
      map.set(entry.propertyId, entry);
    }
    return map;
  }, [offerReadiness]);

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
          <div className="activity-list">
            {items.map((item) => {
              const note = notes.find((entry) => entry.entityId === item.id) ?? null;
              const draft = draftNotes[item.id] ?? note?.body ?? "";

              return (
                <article className="activity-card" key={item.id}>
                  <div>
                    <p className="section-label">
                      {item.capturedHome.address} · {item.capturedHome.scores.nhalo} Nhalo
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
                  </div>

                  <div className="workflow-controls">
                    <label>
                      <span>Review state</span>
                      <select
                        value={item.reviewState}
                        onChange={(event) =>
                          onReviewStateChange(
                            selectedShortlist.id,
                            item.id,
                            event.target.value as ReviewState
                          )
                        }
                      >
                        {REVIEW_STATES.map((state) => (
                          <option key={state} value={state}>
                            {state.replace("_", " ")}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="activity-actions">
                      {historicalCompareEnabled ? (
                        <button className="chip" onClick={() => onOpenHistoricalCompare(item.id)} type="button">
                          Compare to current
                        </button>
                      ) : null}
                      <button
                        className="chip"
                        onClick={() => onRemoveItem(selectedShortlist.id, item.id)}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <OfferReadinessCard
                    item={item}
                    offerReadiness={offerReadinessByPropertyId.get(item.canonicalPropertyId) ?? null}
                    onCreate={onCreateOfferReadiness}
                    onUpdate={onUpdateOfferReadiness}
                  />

                  <label className="note-editor">
                    <span>{RESULT_COPY.resultNotesTitle}</span>
                    <textarea
                      placeholder={SHORTLIST_COPY.notesPlaceholder}
                      value={draft}
                      onChange={(event) =>
                        setDraftNotes((current) => ({
                          ...current,
                          [item.id]: event.target.value
                        }))
                      }
                    />
                  </label>

                  <div className="activity-actions">
                    <button
                      className="chip"
                      disabled={!draft.trim()}
                      onClick={() => onSaveNote(item.id, note?.id ?? null, draft.trim())}
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
            })}
            {items.length === 0 ? <p className="muted">No homes saved in this shortlist yet.</p> : null}
          </div>
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
