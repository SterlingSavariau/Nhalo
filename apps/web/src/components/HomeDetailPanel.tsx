import type { ScoredHome } from "@nhalo/types";
import { RESULT_COPY, buildDecisionLabels, buildTradeoffSummary, geocodePrecisionExplanation } from "../content";
import { sourceFreshnessLabel } from "../view-model";

interface HomeDetailPanelProps {
  home: ScoredHome | null;
  allHomes: ScoredHome[];
  onClose(): void;
  onViewAudit(homeId: string): void;
}

export function HomeDetailPanel({ home, allHomes, onClose, onViewAudit }: HomeDetailPanelProps) {
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

      {(home.qualityFlags ?? []).length > 0 ? (
        <div className="chip-row">
          {(home.qualityFlags ?? []).map((flag) => (
            <span className="chip subdued" key={flag}>
              {flag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="card-actions">
        <button className="ghost-button" onClick={() => onViewAudit(home.id)} type="button">
          View audit details
        </button>
      </div>
    </aside>
  );
}
