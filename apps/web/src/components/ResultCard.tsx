import type { ReviewState, ScoredHome } from "@nhalo/types";
import {
  RESULT_COPY,
  SHORTLIST_COPY,
  buildDecisionLabels,
  buildTradeoffSummary,
  geocodePrecisionExplanation
} from "../content";
import { sourceFreshnessLabel } from "../view-model";

interface ResultCardProps {
  home: ScoredHome;
  homes: ScoredHome[];
  rank: number;
  compared: boolean;
  compareDisabled: boolean;
  shortlisted: boolean;
  shortlistDisabled?: boolean;
  shortlistLabel?: string | null;
  reviewState?: ReviewState | null;
  onToggleCompare(homeId: string): void;
  onToggleShortlist?(home: ScoredHome): void;
  onOpenDetails(homeId: string): void;
  onViewAudit(homeId: string): void;
}

function scoreTone(score: number): string {
  if (score >= 80) {
    return "score-pill strong";
  }

  if (score >= 60) {
    return "score-pill steady";
  }

  return "score-pill weak";
}

function confidenceTone(confidence: ScoredHome["scores"]["overallConfidence"]): string {
  return `confidence-pill ${confidence}`;
}

export function ResultCard({
  home,
  homes,
  rank,
  compared,
  compareDisabled,
  shortlisted,
  shortlistDisabled,
  shortlistLabel,
  reviewState,
  onToggleCompare,
  onToggleShortlist,
  onOpenDetails,
  onViewAudit
}: ResultCardProps) {
  const decisionLabels = buildDecisionLabels(home, homes);
  const tradeoffSummary = buildTradeoffSummary(home);

  return (
    <article className="result-card">
      <div className="result-header">
        <div>
          <p className="result-rank">Rank #{rank}</p>
          <h3>{home.address}</h3>
          <p className="muted">
            {home.city}, {home.state} {home.zipCode}
          </p>
        </div>
        <div className="headline-score">
          <span>Nhalo Score</span>
          <strong>{home.scores.nhalo}</strong>
        </div>
      </div>

      <div className="listing-facts">
        <span>${home.price.toLocaleString()}</span>
        <span>{home.sqft.toLocaleString()} sqft</span>
        <span>{home.bedrooms} bd</span>
        <span>{home.bathrooms} ba</span>
        <span>{home.propertyType.replace("_", " ")}</span>
        <span>{home.distanceMiles?.toFixed(2) ?? "0.00"} mi away</span>
      </div>

      <div className="status-row">
        <span className={confidenceTone(home.scores.overallConfidence)}>
          Overall confidence {home.scores.overallConfidence}
        </span>
        <span className={confidenceTone(home.scores.safetyConfidence)}>
          Safety confidence {home.scores.safetyConfidence}
        </span>
        <span className="chip">
          Listing {sourceFreshnessLabel(home.provenance?.listingDataSource)}
        </span>
        <span className="chip">
          Safety {sourceFreshnessLabel(home.provenance?.safetyDataSource)}
        </span>
      </div>

      {decisionLabels.length > 0 ? (
        <div className="chip-row">
          {decisionLabels.map((label) => (
            <span className="chip active" key={label}>
              {label}
            </span>
          ))}
          {shortlisted ? (
            <span className="chip active">
              Shortlisted{reviewState ? ` · ${reviewState.replace("_", " ")}` : ""}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="why-home">
        <p className="section-label">{RESULT_COPY.whyThisHome}</p>
        <h4>{home.explainability?.headline ?? home.explanation}</h4>
        <p className="muted">
          Primary driver {home.explainability?.scoreDrivers.primary ?? "n/a"} · secondary{" "}
          {home.explainability?.scoreDrivers.secondary ?? "n/a"} · weakest{" "}
          {home.explainability?.scoreDrivers.weakest ?? "n/a"}
        </p>
      </div>

      <div className="tradeoff-panel">
        <p className="section-label">{RESULT_COPY.tradeoffs}</p>
        <h4>{tradeoffSummary}</h4>
        <p className="muted">
          {RESULT_COPY.confidence}: {home.scores.overallConfidence} · {RESULT_COPY.originPrecision}:{" "}
          {geocodePrecisionExplanation(home.provenance?.geocodePrecision ?? "none")}
        </p>
      </div>

      <div className="score-grid">
        <div className={scoreTone(home.scores.price)}>
          <span>Price</span>
          <strong>{home.scores.price}</strong>
        </div>
        <div className={scoreTone(home.scores.size)}>
          <span>Size</span>
          <strong>{home.scores.size}</strong>
        </div>
        <div className={scoreTone(home.scores.safety)}>
          <span>Safety</span>
          <strong>{home.scores.safety}</strong>
        </div>
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

      {(home.confidenceReasons ?? []).length > 0 ? (
        <div className="callout warning compact">
          {(home.confidenceReasons ?? []).join(" ")}
        </div>
      ) : null}

      {(home.dataWarnings ?? []).length > 0 || (home.degradedReasons ?? []).length > 0 ? (
        <div className="callout warning compact">
          {[...(home.dataWarnings ?? []), ...(home.degradedReasons ?? [])].join(" ")}
        </div>
      ) : null}

      {(home.qualityFlags ?? []).length > 0 || (home.integrityFlags ?? []).length > 0 ? (
        <div className="chip-row">
          {(home.qualityFlags ?? []).map((flag) => (
            <span className="chip subdued" key={flag}>
              {flag}
            </span>
          ))}
          {(home.integrityFlags ?? []).map((flag) => (
            <span className="chip subdued" key={flag}>
              {flag}
            </span>
          ))}
        </div>
      ) : null}

      <details className="provenance-details">
        <summary>Provenance and freshness</summary>
        <div className="provenance-grid">
          <div>
            <p>Listing source</p>
            <strong>{home.provenance?.listingDataSource ?? "none"}</strong>
            <p className="muted">
              {home.provenance?.listingProvider ?? "unknown"} ·{" "}
              {home.provenance?.listingFetchedAt ?? "no fetch time"}
            </p>
          </div>
          <div>
            <p>Safety source</p>
            <strong>{home.provenance?.safetyDataSource ?? "none"}</strong>
            <p className="muted">
              Crime {home.provenance?.crimeProvider ?? "n/a"} · School{" "}
              {home.provenance?.schoolProvider ?? "n/a"}
            </p>
          </div>
          <div>
            <p>Geocode precision</p>
            <strong>{home.provenance?.geocodePrecision ?? "none"}</strong>
            <p className="muted">
              {home.provenance?.geocodeDataSource ?? "none"} ·{" "}
              {home.provenance?.geocodeFetchedAt ?? "no fetch time"}
            </p>
          </div>
        </div>
      </details>

      <div className="card-actions">
        {onToggleShortlist ? (
          <button
            className={shortlisted ? "ghost-button active" : "ghost-button"}
            disabled={shortlistDisabled}
            onClick={() => onToggleShortlist(home)}
            type="button"
          >
            {shortlisted
              ? SHORTLIST_COPY.removeAction
              : `${SHORTLIST_COPY.addAction}${shortlistLabel ? ` · ${shortlistLabel}` : ""}`}
          </button>
        ) : null}
        <button
          className={compared ? "ghost-button active" : "ghost-button"}
          disabled={compareDisabled && !compared}
          onClick={() => onToggleCompare(home.id)}
          type="button"
        >
          {compared ? "Remove from compare" : "Compare"}
        </button>
        <button className="ghost-button" onClick={() => onOpenDetails(home.id)} type="button">
          View details
        </button>
        <button className="ghost-button" onClick={() => onViewAudit(home.id)} type="button">
          View audit details
        </button>
      </div>

      <p className="muted">Formula version: {home.scores.formulaVersion}.</p>
    </article>
  );
}
