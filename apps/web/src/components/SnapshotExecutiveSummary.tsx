import type { SearchResponse } from "@nhalo/types";
import { RESULT_COPY, buildExecutiveSnapshotSummary } from "../content";

interface SnapshotExecutiveSummaryProps {
  results: SearchResponse;
}

export function SnapshotExecutiveSummary({ results }: SnapshotExecutiveSummaryProps) {
  const summary = buildExecutiveSnapshotSummary(results);

  return (
    <section className="executive-summary">
      <p className="section-label">{RESULT_COPY.executiveSummaryTitle}</p>
      <h3>{summary.headline}</h3>
      <p>{summary.topHomeSummary}</p>
      <p className="muted">{summary.confidenceSummary}</p>
      {summary.notableCaveats.length > 0 ? (
        <div className="chip-row">
          {summary.notableCaveats.map((caveat) => (
            <span className="chip subdued" key={caveat}>
              {caveat}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
