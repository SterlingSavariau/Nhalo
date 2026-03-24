import type { SearchRequest, SearchResponse } from "@nhalo/types";
import { buildEmptyStateSuggestions } from "../content";

interface EmptyStatePanelProps {
  results: SearchResponse;
  onApplySuggestion(patch: Partial<SearchRequest>, code: string): void;
}

export function EmptyStatePanel({ results, onApplySuggestion }: EmptyStatePanelProps) {
  const items = buildEmptyStateSuggestions(results);

  if (results.metadata.returnedCount > 0 && results.metadata.returnedCount >= 5) {
    return null;
  }

  return (
    <section className="empty-guidance-panel">
      <div>
        <p className="section-label">Recovery Guidance</p>
        <h3>
          {results.metadata.returnedCount === 0
            ? "No homes matched the current family criteria."
            : "Only a few homes matched the current family criteria."}
        </h3>
        <p className="muted">
          The search pipeline filtered homes before ranking. Use one adjustment at a time, then rerun when
          you are ready.
        </p>
      </div>

      <div className="activity-list">
        {items.map((item) => (
          <article className="activity-card" key={item.code}>
            <div>
              <strong>{item.label}</strong>
              <p className="muted">{item.detail}</p>
            </div>
            {item.patch ? (
              <div className="activity-actions">
                <button
                  className="chip"
                  onClick={() => onApplySuggestion(item.patch!, item.code)}
                  type="button"
                >
                  Apply to form
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
