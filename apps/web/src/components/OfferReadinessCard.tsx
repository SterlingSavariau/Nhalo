import { useEffect, useState } from "react";
import type {
  OfferReadiness,
  OfferReadinessStatus,
  ShortlistItem
} from "@nhalo/types";
import { OFFER_READINESS_COPY } from "../content";

interface OfferReadinessCardProps {
  item: ShortlistItem;
  offerReadiness?: OfferReadiness | null;
  onCreate(payload: {
    shortlistId: string;
    propertyId: string;
    status?: OfferReadinessStatus;
    financingReadiness?: OfferReadiness["inputs"]["financingReadiness"];
    propertyFitConfidence?: OfferReadiness["inputs"]["propertyFitConfidence"];
    riskToleranceAlignment?: OfferReadiness["inputs"]["riskToleranceAlignment"];
    riskLevel?: OfferReadiness["inputs"]["riskLevel"];
    userConfirmed?: boolean;
  }): void;
  onUpdate(
    id: string,
    patch: {
      status?: OfferReadinessStatus;
      financingReadiness?: OfferReadiness["inputs"]["financingReadiness"];
      propertyFitConfidence?: OfferReadiness["inputs"]["propertyFitConfidence"];
      riskToleranceAlignment?: OfferReadiness["inputs"]["riskToleranceAlignment"];
      riskLevel?: OfferReadiness["inputs"]["riskLevel"];
      userConfirmed?: boolean;
    }
  ): void;
}

function formatStatus(status: OfferReadinessStatus): string {
  return status.replaceAll("_", " ").toLowerCase();
}

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });
}

export function OfferReadinessCard({
  item,
  offerReadiness,
  onCreate,
  onUpdate
}: OfferReadinessCardProps) {
  const [status, setStatus] = useState<OfferReadinessStatus>("NOT_STARTED");
  const [financingReadiness, setFinancingReadiness] = useState<OfferReadiness["inputs"]["financingReadiness"]>(
    "not_started"
  );
  const [propertyFitConfidence, setPropertyFitConfidence] = useState<
    OfferReadiness["inputs"]["propertyFitConfidence"]
  >("not_assessed");
  const [riskToleranceAlignment, setRiskToleranceAlignment] = useState<
    OfferReadiness["inputs"]["riskToleranceAlignment"]
  >("not_reviewed");
  const [riskLevel, setRiskLevel] = useState<OfferReadiness["inputs"]["riskLevel"]>("balanced");
  const [userConfirmed, setUserConfirmed] = useState(false);

  useEffect(() => {
    setStatus(offerReadiness?.status ?? "NOT_STARTED");
    setFinancingReadiness(offerReadiness?.inputs.financingReadiness ?? "not_started");
    setPropertyFitConfidence(offerReadiness?.inputs.propertyFitConfidence ?? "not_assessed");
    setRiskToleranceAlignment(offerReadiness?.inputs.riskToleranceAlignment ?? "not_reviewed");
    setRiskLevel(offerReadiness?.inputs.riskLevel ?? "balanced");
    setUserConfirmed(offerReadiness?.inputs.userConfirmed ?? false);
  }, [offerReadiness, item.id]);

  const savePayload = {
    status,
    financingReadiness,
    propertyFitConfidence,
    riskToleranceAlignment,
    riskLevel,
    userConfirmed
  };

  return (
    <div className="activity-card offer-readiness-card">
      <div className="summary-header">
        <div>
          <p className="section-label">{OFFER_READINESS_COPY.title}</p>
          <strong>{offerReadiness ? formatStatus(offerReadiness.status) : "not started"}</strong>
          <p className="muted">{OFFER_READINESS_COPY.intro}</p>
        </div>
        <div className="status-chip-row">
          {offerReadiness ? (
            <>
              <span className="status-chip">{OFFER_READINESS_COPY.scoreLabel}: {offerReadiness.readinessScore}</span>
              <span className="status-chip">{offerReadiness.confidence} confidence</span>
              <span className="status-chip">
                {OFFER_READINESS_COPY.dataCompletenessLabel}: {offerReadiness.inputs.dataCompletenessScore}
              </span>
            </>
          ) : (
            <span className="status-chip">Not evaluated yet</span>
          )}
        </div>
      </div>

      {offerReadiness ? (
        <div className="summary-grid">
          <div className="summary-block">
            <h3>{OFFER_READINESS_COPY.recommendedOfferLabel}</h3>
            <p>{formatCurrency(offerReadiness.recommendedOfferPrice)}</p>
            <p className="muted">
              Last evaluated {new Date(offerReadiness.lastEvaluatedAt).toLocaleString()}
            </p>
          </div>
          <div className="summary-block">
            <h3>{OFFER_READINESS_COPY.nextStepsTitle}</h3>
            <ul>
              {offerReadiness.nextSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {(offerReadiness?.blockingIssues.length ?? 0) > 0 ? (
        <div className="summary-block">
          <h3>{OFFER_READINESS_COPY.blockingIssuesTitle}</h3>
          <ul>
            {offerReadiness?.blockingIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="offer-readiness-grid">
        <label>
          <span>{OFFER_READINESS_COPY.financingLabel}</span>
          <select value={financingReadiness} onChange={(event) => setFinancingReadiness(event.target.value as typeof financingReadiness)}>
            <option value="not_started">Not started</option>
            <option value="preapproved">Preapproved</option>
            <option value="cash_ready">Cash ready</option>
          </select>
        </label>

        <label>
          <span>{OFFER_READINESS_COPY.propertyFitLabel}</span>
          <select value={propertyFitConfidence} onChange={(event) => setPropertyFitConfidence(event.target.value as typeof propertyFitConfidence)}>
            <option value="not_assessed">Not assessed</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>

        <label>
          <span>{OFFER_READINESS_COPY.riskAlignmentLabel}</span>
          <select
            value={riskToleranceAlignment}
            onChange={(event) => setRiskToleranceAlignment(event.target.value as typeof riskToleranceAlignment)}
          >
            <option value="not_reviewed">Not reviewed</option>
            <option value="partial">Partial</option>
            <option value="aligned">Aligned</option>
          </select>
        </label>

        <label>
          <span>{OFFER_READINESS_COPY.riskLevelLabel}</span>
          <select value={riskLevel} onChange={(event) => setRiskLevel(event.target.value as typeof riskLevel)}>
            <option value="conservative">Conservative</option>
            <option value="balanced">Balanced</option>
            <option value="competitive">Competitive</option>
          </select>
        </label>

        <label>
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as OfferReadinessStatus)}>
            <option value="NOT_STARTED">Not started</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="READY">Ready</option>
            <option value="BLOCKED">Blocked</option>
            <option value="OFFER_SUBMITTED">Offer submitted</option>
          </select>
        </label>
      </div>

      <label className="checkbox-row">
        <input
          checked={userConfirmed}
          onChange={(event) => setUserConfirmed(event.target.checked)}
          type="checkbox"
        />
        <span>{OFFER_READINESS_COPY.userConfirmedLabel}</span>
      </label>

      <p className="muted">{OFFER_READINESS_COPY.recommendationWarning}</p>

      <div className="activity-actions">
        {offerReadiness ? (
          <button
            className="chip"
            onClick={() => onUpdate(offerReadiness.id, savePayload)}
            type="button"
          >
            {OFFER_READINESS_COPY.updateAction}
          </button>
        ) : (
          <button
            className="chip"
            onClick={() =>
              onCreate({
                shortlistId: item.shortlistId,
                propertyId: item.canonicalPropertyId,
                ...savePayload
              })
            }
            type="button"
          >
            {OFFER_READINESS_COPY.startAction}
          </button>
        )}
      </div>
    </div>
  );
}
