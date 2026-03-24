import type { ScoredHome } from "@nhalo/types";
import { sourceFreshnessLabel } from "../view-model";

interface ComparisonTrayProps {
  homes: ScoredHome[];
  onRemove(homeId: string): void;
}

export function ComparisonTray({ homes, onRemove }: ComparisonTrayProps) {
  if (homes.length === 0) {
    return null;
  }

  return (
    <section className="comparison-panel">
      <div className="summary-header">
        <div>
          <p className="section-label">Comparison Tray</p>
          <h3>Side-by-side family decision view</h3>
        </div>
        <p className="muted">Compare up to three homes at once.</p>
      </div>

      <div className="comparison-grid">
        {homes.map((home) => (
          <article className="comparison-card" key={home.id}>
            <div className="comparison-card-header">
              <div>
                <h4>{home.address}</h4>
                <p className="muted">
                  {home.city}, {home.state} {home.zipCode}
                </p>
              </div>
              <button className="chip" onClick={() => onRemove(home.id)} type="button">
                Remove
              </button>
            </div>

            <div className="comparison-facts">
              <span>${home.price.toLocaleString()}</span>
              <span>{home.sqft.toLocaleString()} sqft</span>
              <span>{home.bedrooms} bd</span>
              <span>{home.bathrooms} ba</span>
              <span>{home.distanceMiles?.toFixed(2) ?? "0.00"} mi</span>
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

            <div className="comparison-details">
              <p>
                Confidence: {home.scores.overallConfidence} · safety confidence:{" "}
                {home.scores.safetyConfidence}
              </p>
              <p>
                Listing {sourceFreshnessLabel(home.provenance?.listingDataSource)} · safety{" "}
                {sourceFreshnessLabel(home.provenance?.safetyDataSource)} · geocode{" "}
                {sourceFreshnessLabel(home.provenance?.geocodeDataSource)}
              </p>
            </div>

            <div className="comparison-list-block">
              <p className="section-label">Strengths</p>
              <ul>
                {(home.strengths ?? []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="comparison-list-block">
              <p className="section-label">Risks</p>
              <ul>
                {(home.risks ?? []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
