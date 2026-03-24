import type { SearchResponse, SearchSnapshotRecord } from "@nhalo/types";

interface SearchSummaryPanelProps {
  results: SearchResponse;
  savingSnapshot: boolean;
  snapshot: SearchSnapshotRecord | null;
  onSaveSnapshot(): void;
}

function formatBudget(results: SearchResponse): string {
  if (typeof results.appliedFilters.budget?.max === "number") {
    return `$${results.appliedFilters.budget.max.toLocaleString()} max`;
  }

  return "No max budget";
}

export function SearchSummaryPanel({
  results,
  savingSnapshot,
  snapshot,
  onSaveSnapshot
}: SearchSummaryPanelProps) {
  const origin = results.metadata.searchOrigin;

  return (
    <section className="summary-panel">
      <div className="summary-header">
        <div>
          <p className="section-label">Search Summary</p>
          <h2>{results.metadata.returnedCount} ranked homes</h2>
          <p className="muted">
            {results.appliedFilters.locationValue} within {results.appliedFilters.radiusMiles} miles.
          </p>
        </div>
        <div className="summary-actions">
          <button className="ghost-button" onClick={onSaveSnapshot} type="button" disabled={savingSnapshot}>
            {savingSnapshot ? "Saving snapshot..." : "Save snapshot"}
          </button>
        </div>
      </div>

      {snapshot ? (
        <div className="callout suggestion">
          Snapshot saved:{" "}
          <a href={`/?snapshot=${snapshot.id}`}>{snapshot.id}</a>
          <span className="muted"> preserves this exact result set.</span>
        </div>
      ) : null}

      {results.metadata.rerunResultMetadata ? (
        <div className="callout suggestion">
          Fresh rerun from {results.metadata.rerunResultMetadata.sourceType}{" "}
          {results.metadata.rerunResultMetadata.sourceId}. This result set is a new live search event.
        </div>
      ) : null}

      <div className="summary-grid">
        <div className="summary-block">
          <h3>Resolved origin</h3>
          <p>{origin?.resolvedFormattedAddress ?? results.appliedFilters.locationValue}</p>
          <p className="muted">
            {origin?.precision ?? "none"} precision, {origin?.geocodeDataSource ?? "none"} geocode
          </p>
        </div>

        <div className="summary-block">
          <h3>Filters</h3>
          <p>
            {formatBudget(results)} · {results.appliedFilters.minSqft ?? 0} sqft min ·{" "}
            {results.appliedFilters.minBedrooms ?? 0} bedrooms min
          </p>
          <p className="muted">
            {results.appliedFilters.propertyTypes.join(", ").replaceAll("_", " ")}
          </p>
        </div>

        <div className="summary-block">
          <h3>Weights</h3>
          <p>
            Price {results.appliedWeights.price} · Size {results.appliedWeights.size} · Safety{" "}
            {results.appliedWeights.safety}
          </p>
          <p className="muted">Formula remains {results.homes[0]?.scores.formulaVersion ?? "nhalo-v1"}.</p>
        </div>

        <div className="summary-block">
          <h3>Pipeline counts</h3>
          <p>
            Retrieved {results.metadata.candidatesRetrieved ?? 0} → normalized{" "}
            {results.metadata.candidatesAfterNormalization ?? 0} → quality gate{" "}
            {results.metadata.candidatesAfterQualityGate ?? 0}
          </p>
          <p className="muted">
            Deduped {results.metadata.candidatesAfterDeduplication ?? 0} → radius{" "}
            {results.metadata.candidatesAfterRadiusFilter ?? 0} → hard filters{" "}
            {results.metadata.candidatesAfterHardFilters ?? 0}
          </p>
        </div>

        <div className="summary-block">
          <h3>Comparable context</h3>
          <p>
            Sample size {results.metadata.comparableSampleSize ?? 0} · strategy{" "}
            {results.metadata.comparableStrategyUsed ?? "unknown"}
          </p>
          <p className="muted">
            Deduplicated {results.metadata.deduplicatedCount ?? 0} listings across{" "}
            {results.metadata.duplicateGroupsDetected ?? 0} groups.
          </p>
        </div>

        <div className="summary-block">
          <h3>Runtime</h3>
          <p>{results.metadata.durationMs} ms</p>
          <p className="muted">
            {results.metadata.mockFallbackUsed ? "Mock fallback used." : "No mock fallback used."}{" "}
            {results.metadata.staleDataPresent ? "Some result data is stale." : "No stale result data flagged."}
          </p>
        </div>

        <div className="summary-block">
          <h3>Continuity</h3>
          <p>Session {results.metadata.sessionId ?? "none"}</p>
          <p className="muted">History record {results.metadata.historyRecordId ?? "not recorded"}.</p>
        </div>
      </div>

      {results.metadata.warnings.length > 0 ? (
        <div className="callout warning">
          {results.metadata.warnings.map((warning) => warning.message).join(" ")}
        </div>
      ) : null}

      {results.metadata.suggestions.length > 0 ? (
        <div className="callout suggestion">
          {results.metadata.suggestions.map((suggestion) => suggestion.message).join(" ")}
        </div>
      ) : null}
    </section>
  );
}
