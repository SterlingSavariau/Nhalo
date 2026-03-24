import type { HistoricalComparisonPayload } from "@nhalo/types";
import { RESULT_COPY, SHORTLIST_COPY } from "../content";

interface HistoricalComparePanelProps {
  comparison: HistoricalComparisonPayload | null;
  onClose(): void;
}

export function HistoricalComparePanel({
  comparison,
  onClose
}: HistoricalComparePanelProps) {
  if (!comparison) {
    return null;
  }

  return (
    <aside className="detail-panel">
      <div className="summary-header">
        <div>
          <p className="section-label">{RESULT_COPY.historicalCompareTitle}</p>
          <h3>{comparison.historical.home.address}</h3>
          <p className="muted">{SHORTLIST_COPY.compareExplanation}</p>
        </div>
        <button className="ghost-button" onClick={onClose} type="button">
          Close
        </button>
      </div>

      <div className="summary-grid">
        <div className="summary-block">
          <h3>{comparison.historical.label}</h3>
          <p>
            Nhalo {comparison.historical.home.scores.nhalo} · price {comparison.historical.home.scores.price} · size{" "}
            {comparison.historical.home.scores.size} · safety {comparison.historical.home.scores.safety}
          </p>
          <p className="muted">Captured {new Date(comparison.historical.capturedAt).toLocaleString()}</p>
        </div>

        <div className="summary-block">
          <h3>{comparison.current ? comparison.current.label : "Current result unavailable"}</h3>
          {comparison.current ? (
            <>
              <p>
                Nhalo {comparison.current.home.scores.nhalo} · price {comparison.current.home.scores.price} · size{" "}
                {comparison.current.home.scores.size} · safety {comparison.current.home.scores.safety}
              </p>
              <p className="muted">
                Current confidence {comparison.current.home.scores.overallConfidence}
              </p>
            </>
          ) : (
            <p className="muted">This home is not present in the current result set.</p>
          )}
        </div>
      </div>

      <div className="activity-list">
        {comparison.changes.map((change) => (
          <article className="activity-card" key={change.field}>
            <div>
              <p className="section-label">{change.field}</p>
              <strong>
                {Array.isArray(change.from) ? change.from.join(", ") : String(change.from ?? "none")} →{" "}
                {Array.isArray(change.to) ? change.to.join(", ") : String(change.to ?? "none")}
              </strong>
              <p className="muted">{change.status}</p>
            </div>
          </article>
        ))}
        {comparison.changes.length === 0 ? (
          <p className="muted">No stored differences were detected between the saved and current result.</p>
        ) : null}
      </div>
    </aside>
  );
}
