import { useEffect, useState } from "react";
import type { DecisionConfidence, ShortlistItem } from "@nhalo/types";
import { SHORTLIST_COPY } from "../content";

interface DecisionRationaleEditorProps {
  item: ShortlistItem;
  compact?: boolean;
  onSave?(patch: {
    decisionRationale?: string | null;
    decisionConfidence?: DecisionConfidence | null;
    lastDecisionReviewedAt?: string | null;
  }): void;
}

const CONFIDENCE_OPTIONS: DecisionConfidence[] = ["low", "medium", "high", "confirmed"];

function buildRationalePreview(item: ShortlistItem, compact: boolean) {
  const rationale = item.decisionRationale?.trim();
  if (!rationale) {
    return item.choiceStatus === "selected"
      ? SHORTLIST_COPY.selectedChoiceFallback
      : item.choiceStatus === "backup"
        ? SHORTLIST_COPY.backupFallback
        : SHORTLIST_COPY.candidateFallback;
  }

  if (!compact || rationale.length <= 140) {
    return rationale;
  }

  return `${rationale.slice(0, 137).trimEnd()}...`;
}

export function DecisionRationaleEditor({
  item,
  compact = false,
  onSave
}: DecisionRationaleEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draftRationale, setDraftRationale] = useState(item.decisionRationale ?? "");
  const [draftConfidence, setDraftConfidence] = useState<DecisionConfidence | "">(
    item.decisionConfidence ?? ""
  );

  useEffect(() => {
    setEditing(false);
    setDraftRationale(item.decisionRationale ?? "");
    setDraftConfidence(item.decisionConfidence ?? "");
  }, [item.decisionConfidence, item.decisionRationale, item.id]);

  if (!editing) {
    return (
      <div className="summary-block">
        <h3>{SHORTLIST_COPY.decisionRationaleTitle}</h3>
        <p>{buildRationalePreview(item, compact)}</p>
        <p className="muted">
          {SHORTLIST_COPY.decisionConfidenceLabel}: {item.decisionConfidence ?? SHORTLIST_COPY.confidenceUnset}
        </p>
        {onSave ? (
          <div className="activity-actions">
            <button className="chip" onClick={() => setEditing(true)} type="button">
              {SHORTLIST_COPY.editRationaleAction}
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="summary-block">
      <h3>{SHORTLIST_COPY.decisionRationaleTitle}</h3>
      <label className="note-editor">
        <span>{SHORTLIST_COPY.rationaleFieldLabel}</span>
        <textarea
          placeholder={SHORTLIST_COPY.notesPlaceholder}
          rows={compact ? 3 : 4}
          value={draftRationale}
          onChange={(event) => setDraftRationale(event.target.value)}
        />
      </label>
      <label>
        <span>{SHORTLIST_COPY.decisionConfidenceLabel}</span>
        <select
          value={draftConfidence}
          onChange={(event) => setDraftConfidence(event.target.value as DecisionConfidence | "")}
        >
          <option value="">{SHORTLIST_COPY.confidenceUnset}</option>
          {CONFIDENCE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <div className="activity-actions">
        <button
          className="chip"
          onClick={() => {
            onSave?.({
              decisionRationale: draftRationale.trim() || null,
              decisionConfidence: draftConfidence || null,
              lastDecisionReviewedAt: new Date().toISOString()
            });
            setEditing(false);
          }}
          type="button"
        >
          {SHORTLIST_COPY.saveRationaleAction}
        </button>
        <button
          className="chip"
          onClick={() => {
            setDraftRationale(item.decisionRationale ?? "");
            setDraftConfidence(item.decisionConfidence ?? "");
            setEditing(false);
          }}
          type="button"
        >
          {SHORTLIST_COPY.cancelRationaleAction}
        </button>
      </div>
    </div>
  );
}
