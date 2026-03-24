import { useMemo, useState } from "react";
import type {
  CollaborationActivityRecord,
  ReviewerDecision,
  ReviewerDecisionValue,
  SharedComment,
  SharedShortlistView
} from "@nhalo/types";
import { COLLABORATION_COPY, RESULT_COPY, SHORTLIST_COPY } from "../content";

const REVIEWER_DECISIONS: ReviewerDecisionValue[] = [
  "agree",
  "disagree",
  "discuss",
  "favorite",
  "pass"
];

function formatTimestamp(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString() : "Unknown";
}

function modeLabel(mode: SharedShortlistView["share"]["shareMode"]): string {
  switch (mode) {
    case "read_only":
      return SHORTLIST_COPY.shareReadOnly;
    case "comment_only":
      return SHORTLIST_COPY.shareCommentOnly;
    case "review_only":
      return SHORTLIST_COPY.shareReviewOnly;
  }
}

function eventLabel(entry: CollaborationActivityRecord): string {
  switch (entry.eventType) {
    case "shortlist_shared":
      return "Share link created";
    case "shared_shortlist_opened":
      return "Shared shortlist opened";
    case "shared_comment_added":
      return "Comment added";
    case "shared_comment_updated":
      return "Comment updated";
    case "shared_comment_deleted":
      return "Comment deleted";
    case "reviewer_decision_submitted":
      return "Reviewer decision submitted";
    case "reviewer_decision_updated":
      return "Reviewer decision updated";
    case "share_link_revoked":
      return "Share link revoked";
    case "share_link_expired":
      return "Share link expired";
  }
}

interface SharedShortlistViewProps {
  sharedView: SharedShortlistView;
  comments: SharedComment[];
  reviewerDecisions: ReviewerDecision[];
  collaborationActivity: CollaborationActivityRecord[];
  onSaveComment?(itemId: string, comment: SharedComment | null, body: string, authorLabel?: string | null): void;
  onDeleteComment?(commentId: string): void;
  onSaveDecision?(itemId: string, existing: ReviewerDecision | null, decision: ReviewerDecisionValue, note?: string | null): void;
}

export function SharedShortlistViewPanel({
  sharedView,
  comments,
  reviewerDecisions,
  collaborationActivity,
  onSaveComment,
  onDeleteComment,
  onSaveDecision
}: SharedShortlistViewProps) {
  const [draftComments, setDraftComments] = useState<Record<string, string>>({});
  const [draftAuthors, setDraftAuthors] = useState<Record<string, string>>({});
  const [draftDecisionNotes, setDraftDecisionNotes] = useState<Record<string, string>>({});

  const interactionMode = sharedView.share.shareMode;
  const canComment = interactionMode === "comment_only" || interactionMode === "review_only";
  const canReview = interactionMode === "review_only";

  const commentByItem = useMemo(() => {
    const map = new Map<string, SharedComment>();
    for (const comment of comments) {
      if (!map.has(comment.entityId)) {
        map.set(comment.entityId, comment);
      }
    }
    return map;
  }, [comments]);

  const decisionByItem = useMemo(() => {
    const map = new Map<string, ReviewerDecision>();
    for (const decision of reviewerDecisions) {
      if (!map.has(decision.shortlistItemId)) {
        map.set(decision.shortlistItemId, decision);
      }
    }
    return map;
  }, [reviewerDecisions]);

  return (
    <section className="activity-panel">
      <div className="summary-header">
        <div>
          <p className="section-label">{COLLABORATION_COPY.sharedShortlistTitle}</p>
          <h2>{sharedView.shortlist.title}</h2>
          <p className="muted">
            {modeLabel(sharedView.share.shareMode)} · Stored shortlist capture · Created{" "}
            {formatTimestamp(sharedView.share.createdAt)}
          </p>
        </div>
      </div>

      <div className="status-chip-row">
        <span className="status-pill">{sharedView.share.status}</span>
        <span className="status-pill">{modeLabel(sharedView.share.shareMode)}</span>
        <span className="status-pill">{sharedView.items.length} homes</span>
        <span className="status-pill">{sharedView.share.openCount} opens</span>
      </div>

      <p className="muted">{SHORTLIST_COPY.immutableWarning}</p>

      <div className="activity-list">
        {sharedView.items.map((item) => {
          const comment = commentByItem.get(item.id) ?? null;
          const reviewerDecision = decisionByItem.get(item.id) ?? null;
          const draftComment = draftComments[item.id] ?? comment?.body ?? "";
          const draftAuthor = draftAuthors[item.id] ?? comment?.authorLabel ?? "";
          const draftDecisionNote = draftDecisionNotes[item.id] ?? reviewerDecision?.note ?? "";

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
                  {item.capturedHome.scores.overallConfidence} confidence · {item.capturedHome.provenance?.listingDataSource ?? "unknown"} listing data
                </p>
                <p className="muted">
                  {RESULT_COPY.whyThisHome}: {item.capturedHome.explainability?.headline ?? item.capturedHome.explanation}
                </p>
              </div>

              <div className="status-chip-row">
                <span className="status-pill">Owner review: {item.reviewState.replace("_", " ")}</span>
                {reviewerDecision ? (
                  <span className="status-pill">
                    Reviewer: {reviewerDecision.decision.replace("_", " ")}
                  </span>
                ) : null}
              </div>

              {canReview ? (
                <div className="workflow-controls">
                  <label>
                    <span>{SHORTLIST_COPY.reviewerDecisionLabel}</span>
                    <select
                      defaultValue={reviewerDecision?.decision ?? "discuss"}
                      onChange={(event) =>
                        onSaveDecision?.(
                          item.id,
                          reviewerDecision,
                          event.target.value as ReviewerDecisionValue,
                          draftDecisionNote.trim() || null
                        )
                      }
                    >
                      {REVIEWER_DECISIONS.map((decision) => (
                        <option key={decision} value={decision}>
                          {decision.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="note-editor">
                    <span>Reviewer note</span>
                    <textarea
                      placeholder={SHORTLIST_COPY.reviewerDecisionPlaceholder}
                      value={draftDecisionNote}
                      onChange={(event) =>
                        setDraftDecisionNotes((current) => ({
                          ...current,
                          [item.id]: event.target.value
                        }))
                      }
                    />
                  </label>
                  <button
                    className="chip"
                    onClick={() =>
                      onSaveDecision?.(
                        item.id,
                        reviewerDecision,
                        reviewerDecision?.decision ?? "discuss",
                        draftDecisionNote.trim() || null
                      )
                    }
                    type="button"
                  >
                    {reviewerDecision ? "Update decision note" : "Save decision note"}
                  </button>
                </div>
              ) : null}

              {canComment ? (
                <>
                  <label className="note-editor">
                    <span>Reviewer label</span>
                    <input
                      placeholder="Optional name"
                      value={draftAuthor}
                      onChange={(event) =>
                        setDraftAuthors((current) => ({
                          ...current,
                          [item.id]: event.target.value
                        }))
                      }
                    />
                  </label>
                  <label className="note-editor">
                    <span>Comment</span>
                    <textarea
                      placeholder={SHORTLIST_COPY.commentPlaceholder}
                      value={draftComment}
                      onChange={(event) =>
                        setDraftComments((current) => ({
                          ...current,
                          [item.id]: event.target.value
                        }))
                      }
                    />
                  </label>
                  <div className="activity-actions">
                    <button
                      className="chip"
                      disabled={!draftComment.trim()}
                      onClick={() =>
                        onSaveComment?.(
                          item.id,
                          comment,
                          draftComment.trim(),
                          draftAuthor.trim() || null
                        )
                      }
                      type="button"
                    >
                      {comment ? "Update comment" : "Save comment"}
                    </button>
                    {comment ? (
                      <button className="chip" onClick={() => onDeleteComment?.(comment.id)} type="button">
                        Delete comment
                      </button>
                    ) : null}
                  </div>
                </>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="activity-section">
        <div className="summary-header">
          <h4>{COLLABORATION_COPY.activityTitle}</h4>
          <p className="muted">{collaborationActivity.length} recent actions</p>
        </div>
        <div className="activity-list">
          {collaborationActivity.map((entry) => (
            <article className="activity-card" key={entry.id}>
              <strong>{eventLabel(entry)}</strong>
              <p className="muted">{formatTimestamp(entry.createdAt)}</p>
            </article>
          ))}
          {collaborationActivity.length === 0 ? (
            <p className="muted">No collaboration activity yet.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
