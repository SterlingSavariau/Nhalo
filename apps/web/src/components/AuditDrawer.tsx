import type { ScoreAuditRecord } from "@nhalo/types";

interface AuditDrawerProps {
  audit: ScoreAuditRecord | null;
  loading: boolean;
  error: string | null;
  onClose(): void;
}

export function AuditDrawer({ audit, loading, error, onClose }: AuditDrawerProps) {
  if (!loading && !error && !audit) {
    return null;
  }

  return (
    <aside className="audit-drawer">
      <div className="summary-header">
        <div>
          <p className="section-label">Audit Details</p>
          <h3>{audit?.propertyId ?? "Loading audit..."}</h3>
        </div>
        <button className="ghost-button" onClick={onClose} type="button">
          Close
        </button>
      </div>

      {loading ? <p className="muted">Loading stored audit details...</p> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      {audit ? (
        <div className="audit-stack">
          <div className="audit-section">
            <h4>Scores</h4>
            <p>
              Nhalo {audit.finalScore} · price {audit.subScores.price} · size {audit.subScores.size} ·
              safety {audit.subScores.safety}
            </p>
            <p className="muted">
              Formula {audit.formulaVersion} · overall confidence {audit.overallConfidence}
            </p>
          </div>

          <div className="audit-section">
            <h4>Explainability</h4>
            <p>{audit.explainability?.headline ?? "No stored explainability headline."}</p>
            <p className="muted">
              Strengths: {(audit.strengths ?? []).join(" · ") || "None"} | Risks:{" "}
              {(audit.risks ?? []).join(" · ") || "None"}
            </p>
          </div>

          <div className="audit-section">
            <h4>Origin and spatial context</h4>
            <p>{audit.searchOrigin?.resolvedFormattedAddress ?? audit.searchOrigin?.locationValue ?? "Unknown origin"}</p>
            <p className="muted">
              {audit.searchOrigin?.precision ?? "none"} precision · radius{" "}
              {audit.spatialContext?.radiusMiles ?? "n/a"} miles · distance{" "}
              {audit.spatialContext?.distanceMiles ?? "n/a"} miles
            </p>
          </div>

          <div className="audit-section">
            <h4>Quality context</h4>
            <p>
              Canonical property ID: {audit.searchQualityContext?.canonicalPropertyId ?? "n/a"}
            </p>
            <p className="muted">
              Comparables: {audit.searchQualityContext?.comparableSampleSize ?? "n/a"} · strategy{" "}
              {audit.searchQualityContext?.comparableStrategyUsed ?? "n/a"}
            </p>
            <p className="muted">
              Flags: {(audit.searchQualityContext?.resultQualityFlags ?? []).join(" · ") || "None"}
            </p>
          </div>

          <div className="audit-section">
            <h4>Stored inputs</h4>
            <pre>{JSON.stringify(audit.inputs, null, 2)}</pre>
          </div>

          <div className="audit-section">
            <h4>Stored provenance</h4>
            <pre>
              {JSON.stringify(
                {
                  listing: audit.listingProvenance,
                  safety: audit.safetyProvenance,
                  searchOrigin: audit.searchOrigin,
                  tieBreak: audit.searchQualityContext?.rankingTieBreakInputs
                },
                null,
                2
              )}
            </pre>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
