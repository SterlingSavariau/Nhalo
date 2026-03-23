import type { ScoredHome } from "@nhalo/types";

interface ResultCardProps {
  home: ScoredHome;
  rank: number;
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

export function ResultCard({ home, rank }: ResultCardProps) {
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
      </div>

      <p className="explanation">{home.explanation}</p>

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

      <p className="muted">
        Safety confidence: {home.scores.safetyConfidence}. Formula version: {home.scores.formulaVersion}.
      </p>
    </article>
  );
}
