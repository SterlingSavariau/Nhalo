import { useEffect, useState } from "react";
import type {
  FinancialReadiness,
  OfferPreparation,
  OfferReadiness,
  WorkflowNotification
} from "@nhalo/types";
import { DecisionExplainabilityPanel } from "./DecisionExplainabilityPanel";
import { WorkflowAlertList } from "./WorkflowAlertList";
import { OFFER_PREPARATION_COPY } from "../content";

interface OfferPreparationCardProps {
  propertyId: string;
  propertyAddressLabel: string;
  shortlistId?: string | null;
  anchorPrice: number;
  notifications?: WorkflowNotification[];
  financialReadiness: FinancialReadiness | null;
  offerReadiness?: OfferReadiness | null;
  offerPreparation?: OfferPreparation | null;
  onCreate(payload: {
    propertyId: string;
    propertyAddressLabel: string;
    shortlistId?: string | null;
    offerReadinessId?: string | null;
    financialReadinessId: string;
    offerPrice?: number | null;
    earnestMoneyAmount?: number | null;
    downPaymentType?: OfferPreparation["downPaymentType"];
    downPaymentAmount?: number | null;
    downPaymentPercent?: number | null;
    financingContingency?: OfferPreparation["financingContingency"];
    inspectionContingency?: OfferPreparation["inspectionContingency"];
    appraisalContingency?: OfferPreparation["appraisalContingency"];
    closingTimelineDays?: number | null;
    possessionTiming?: OfferPreparation["possessionTiming"];
    possessionDaysAfterClosing?: number | null;
    notes?: string | null;
    buyerRationale?: string | null;
  }): Promise<void> | void;
  onUpdate(
    id: string,
    patch: {
      propertyAddressLabel?: string;
      offerPrice?: number | null;
      earnestMoneyAmount?: number | null;
      downPaymentType?: OfferPreparation["downPaymentType"];
      downPaymentAmount?: number | null;
      downPaymentPercent?: number | null;
      financingContingency?: OfferPreparation["financingContingency"];
      inspectionContingency?: OfferPreparation["inspectionContingency"];
      appraisalContingency?: OfferPreparation["appraisalContingency"];
      closingTimelineDays?: number | null;
      possessionTiming?: OfferPreparation["possessionTiming"];
      possessionDaysAfterClosing?: number | null;
      notes?: string | null;
      buyerRationale?: string | null;
    }
  ): Promise<void> | void;
}

function parseNullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? Math.round(numeric) : null;
}

function currency(value: number | null | undefined): string {
  if (typeof value !== "number") {
    return "Not set";
  }

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });
}

function percent(value: number | null | undefined): string {
  if (typeof value !== "number") {
    return "Not set";
  }

  return `${value.toFixed(1)}%`;
}

export function OfferPreparationCard({
  propertyId,
  propertyAddressLabel,
  shortlistId,
  anchorPrice,
  notifications = [],
  financialReadiness,
  offerReadiness,
  offerPreparation,
  onCreate,
  onUpdate
}: OfferPreparationCardProps) {
  const [offerPrice, setOfferPrice] = useState("");
  const [earnestMoneyAmount, setEarnestMoneyAmount] = useState("");
  const [downPaymentType, setDownPaymentType] = useState<OfferPreparation["downPaymentType"]>("percent");
  const [downPaymentAmount, setDownPaymentAmount] = useState("");
  const [downPaymentPercent, setDownPaymentPercent] = useState("");
  const [financingContingency, setFinancingContingency] =
    useState<OfferPreparation["financingContingency"]>("included");
  const [inspectionContingency, setInspectionContingency] =
    useState<OfferPreparation["inspectionContingency"]>("included");
  const [appraisalContingency, setAppraisalContingency] =
    useState<OfferPreparation["appraisalContingency"]>("included");
  const [closingTimelineDays, setClosingTimelineDays] = useState("30");
  const [possessionTiming, setPossessionTiming] =
    useState<OfferPreparation["possessionTiming"]>("at_closing");
  const [possessionDaysAfterClosing, setPossessionDaysAfterClosing] = useState("");
  const [notes, setNotes] = useState("");
  const [buyerRationale, setBuyerRationale] = useState("");

  useEffect(() => {
    const defaultOfferPrice = offerReadiness?.recommendedOfferPrice ?? anchorPrice;
    setOfferPrice(String(offerPreparation?.offerPrice ?? defaultOfferPrice ?? ""));
    setEarnestMoneyAmount(String(offerPreparation?.earnestMoneyAmount ?? ""));
    setDownPaymentType(offerPreparation?.downPaymentType ?? "percent");
    setDownPaymentAmount(String(offerPreparation?.downPaymentAmount ?? ""));
    setDownPaymentPercent(
      offerPreparation?.downPaymentPercent !== null && offerPreparation?.downPaymentPercent !== undefined
        ? String(offerPreparation.downPaymentPercent)
        : String(financialReadiness?.downPaymentPreferencePercent ?? 10)
    );
    setFinancingContingency(offerPreparation?.financingContingency ?? "included");
    setInspectionContingency(offerPreparation?.inspectionContingency ?? "included");
    setAppraisalContingency(offerPreparation?.appraisalContingency ?? "included");
    setClosingTimelineDays(String(offerPreparation?.closingTimelineDays ?? 30));
    setPossessionTiming(offerPreparation?.possessionTiming ?? "at_closing");
    setPossessionDaysAfterClosing(String(offerPreparation?.possessionDaysAfterClosing ?? ""));
    setNotes(offerPreparation?.notes ?? "");
    setBuyerRationale(offerPreparation?.buyerRationale ?? "");
  }, [anchorPrice, financialReadiness?.downPaymentPreferencePercent, offerPreparation, offerReadiness?.recommendedOfferPrice]);

  const canStart = Boolean(financialReadiness?.id);

  return (
    <div className="activity-card negotiation-card">
      <div className="summary-header">
        <div>
          <p className="section-label">{OFFER_PREPARATION_COPY.title}</p>
          <strong>
            {offerPreparation ? offerPreparation.offerState.replaceAll("_", " ").toLowerCase() : "not started"}
          </strong>
          <p className="muted">{OFFER_PREPARATION_COPY.intro}</p>
        </div>
        <div className="status-chip-row">
          <span className="status-chip">
            {OFFER_PREPARATION_COPY.dependencyLabel}:{" "}
            {financialReadiness?.readinessState.replaceAll("_", " ").toLowerCase() ?? "missing"}
          </span>
          {offerPreparation ? (
            <span className="status-chip">{offerPreparation.offerRiskLevel.replaceAll("_", " ").toLowerCase()}</span>
          ) : null}
        </div>
      </div>

      {offerPreparation ? (
        <DecisionExplainabilityPanel
          label="Why this draft?"
          moduleName="offer_preparation"
          subjectId={offerPreparation.id}
          subjectType="offer_preparation"
        />
      ) : null}

      <WorkflowAlertList
        notifications={notifications}
        title="Active alerts"
        emptyMessage="No active offer preparation alerts."
      />

      <div className="summary-grid">
        <div className="summary-block">
          <h3>{OFFER_PREPARATION_COPY.financialAlignmentTitle}</h3>
          <p>{OFFER_PREPARATION_COPY.maxAffordableLabel}: {currency(financialReadiness?.maxAffordableHomePrice)}</p>
          <p>{OFFER_PREPARATION_COPY.cashAvailableLabel}: {currency(financialReadiness?.availableCashSavings)}</p>
          <p className="muted">
            {OFFER_PREPARATION_COPY.affordabilityStatusLabel}:{" "}
            {financialReadiness?.affordabilityClassification.replaceAll("_", " ").toLowerCase() ?? "not started"}
          </p>
        </div>
        <div className="summary-block">
          <h3>{OFFER_PREPARATION_COPY.summaryTitle}</h3>
          <p>{OFFER_PREPARATION_COPY.offerPriceLabel}: {currency(offerPreparation?.offerSummary.offerPrice)}</p>
          <p>{OFFER_PREPARATION_COPY.earnestMoneyLabel}: {currency(offerPreparation?.offerSummary.earnestMoneyAmount)}</p>
          <p>{OFFER_PREPARATION_COPY.cashRequiredLabel}: {currency(offerPreparation?.cashRequiredAtOffer)}</p>
          <p className="muted">
            {OFFER_PREPARATION_COPY.readinessLabel}: {offerPreparation?.readinessToSubmit ? "ready to submit" : "not ready"}
          </p>
        </div>
      </div>

      {offerPreparation ? (
        <div className="summary-grid">
          <div className="summary-block">
            <h3>{OFFER_PREPARATION_COPY.blockersTitle}</h3>
            {offerPreparation.blockers.length > 0 ? (
              <ul>
                {offerPreparation.blockers.map((entry) => (
                  <li key={`${entry.code}-${entry.message}`}>
                    <strong>{entry.message}</strong> {entry.howToFix}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No blockers are currently stored.</p>
            )}
          </div>
          <div className="summary-block">
            <h3>{OFFER_PREPARATION_COPY.recommendationTitle}</h3>
            <p>{offerPreparation.recommendation}</p>
            <p className="muted">Risk: {offerPreparation.risk}</p>
            <p className="muted">Alternative: {offerPreparation.alternative}</p>
          </div>
        </div>
      ) : null}

      <div className="offer-readiness-grid">
        <label>
          <span>{OFFER_PREPARATION_COPY.offerPriceLabel}</span>
          <input inputMode="numeric" onChange={(event) => setOfferPrice(event.target.value)} value={offerPrice} />
        </label>
        <label>
          <span>{OFFER_PREPARATION_COPY.earnestMoneyLabel}</span>
          <input
            inputMode="numeric"
            onChange={(event) => setEarnestMoneyAmount(event.target.value)}
            value={earnestMoneyAmount}
          />
        </label>
        <label>
          <span>{OFFER_PREPARATION_COPY.downPaymentTypeLabel}</span>
          <select
            value={downPaymentType ?? "percent"}
            onChange={(event) =>
              setDownPaymentType(event.target.value as OfferPreparation["downPaymentType"])
            }
          >
            <option value="percent">Percent</option>
            <option value="amount">Amount</option>
          </select>
        </label>
        {downPaymentType === "amount" ? (
          <label>
            <span>{OFFER_PREPARATION_COPY.downPaymentAmountLabel}</span>
            <input
              inputMode="numeric"
              onChange={(event) => setDownPaymentAmount(event.target.value)}
              value={downPaymentAmount}
            />
          </label>
        ) : (
          <label>
            <span>{OFFER_PREPARATION_COPY.downPaymentPercentLabel}</span>
            <input
              inputMode="decimal"
              onChange={(event) => setDownPaymentPercent(event.target.value)}
              value={downPaymentPercent}
            />
          </label>
        )}
        <label>
          <span>{OFFER_PREPARATION_COPY.financingContingencyLabel}</span>
          <select
            value={financingContingency ?? "included"}
            onChange={(event) =>
              setFinancingContingency(event.target.value as OfferPreparation["financingContingency"])
            }
          >
            <option value="included">Included</option>
            <option value="waived">Waived</option>
          </select>
        </label>
        <label>
          <span>{OFFER_PREPARATION_COPY.inspectionContingencyLabel}</span>
          <select
            value={inspectionContingency ?? "included"}
            onChange={(event) =>
              setInspectionContingency(event.target.value as OfferPreparation["inspectionContingency"])
            }
          >
            <option value="included">Included</option>
            <option value="waived">Waived</option>
          </select>
        </label>
        <label>
          <span>{OFFER_PREPARATION_COPY.appraisalContingencyLabel}</span>
          <select
            value={appraisalContingency ?? "included"}
            onChange={(event) =>
              setAppraisalContingency(event.target.value as OfferPreparation["appraisalContingency"])
            }
          >
            <option value="included">Included</option>
            <option value="waived">Waived</option>
          </select>
        </label>
        <label>
          <span>{OFFER_PREPARATION_COPY.closingTimelineLabel}</span>
          <input
            inputMode="numeric"
            onChange={(event) => setClosingTimelineDays(event.target.value)}
            value={closingTimelineDays}
          />
        </label>
        <label>
          <span>{OFFER_PREPARATION_COPY.possessionTimingLabel}</span>
          <select
            value={possessionTiming ?? "at_closing"}
            onChange={(event) =>
              setPossessionTiming(event.target.value as OfferPreparation["possessionTiming"])
            }
          >
            <option value="at_closing">At closing</option>
            <option value="days_after_closing">Days after closing</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        {possessionTiming === "days_after_closing" || possessionTiming === "custom" ? (
          <label>
            <span>{OFFER_PREPARATION_COPY.possessionDaysLabel}</span>
            <input
              inputMode="numeric"
              onChange={(event) => setPossessionDaysAfterClosing(event.target.value)}
              value={possessionDaysAfterClosing}
            />
          </label>
        ) : null}
      </div>

      <div className="activity-save">
        <label>
          <span>{OFFER_PREPARATION_COPY.notesLabel}</span>
          <textarea onChange={(event) => setNotes(event.target.value)} value={notes} />
        </label>
        <label>
          <span>{OFFER_PREPARATION_COPY.rationaleLabel}</span>
          <textarea onChange={(event) => setBuyerRationale(event.target.value)} value={buyerRationale} />
        </label>
      </div>

      {offerPreparation ? (
        <div className="summary-block">
          <h3>{OFFER_PREPARATION_COPY.nextStepsTitle}</h3>
          <ul>
            {offerPreparation.nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
          <p className="muted">
            {OFFER_PREPARATION_COPY.nextActionLabel}: {offerPreparation.nextAction}
          </p>
          <p className="muted">
            {OFFER_PREPARATION_COPY.downPaymentDisplayLabel}: {currency(offerPreparation.offerSummary.downPaymentAmount)} ·{" "}
            {percent(offerPreparation.offerSummary.downPaymentPercent)}
          </p>
        </div>
      ) : null}

      <div className="activity-actions">
        {offerPreparation ? (
          <button
            className="chip"
            onClick={() =>
              onUpdate(offerPreparation.id, {
                propertyAddressLabel,
                offerPrice: parseNullableNumber(offerPrice),
                earnestMoneyAmount: parseNullableNumber(earnestMoneyAmount),
                downPaymentType,
                downPaymentAmount: downPaymentType === "amount" ? parseNullableNumber(downPaymentAmount) : null,
                downPaymentPercent: downPaymentType === "percent" ? parseNullableNumber(downPaymentPercent) : null,
                financingContingency,
                inspectionContingency,
                appraisalContingency,
                closingTimelineDays: parseNullableNumber(closingTimelineDays),
                possessionTiming,
                possessionDaysAfterClosing:
                  possessionTiming === "days_after_closing" || possessionTiming === "custom"
                    ? parseNullableNumber(possessionDaysAfterClosing)
                    : null,
                notes: notes.trim() || null,
                buyerRationale: buyerRationale.trim() || null
              })
            }
            type="button"
          >
            {OFFER_PREPARATION_COPY.updateAction}
          </button>
        ) : (
          <button
            className="chip"
            disabled={!canStart}
            onClick={() =>
              financialReadiness
                ? onCreate({
                    propertyId,
                    propertyAddressLabel,
                    shortlistId: shortlistId ?? null,
                    offerReadinessId: offerReadiness?.id ?? null,
                    financialReadinessId: financialReadiness.id,
                    offerPrice: parseNullableNumber(offerPrice),
                    earnestMoneyAmount: parseNullableNumber(earnestMoneyAmount),
                    downPaymentType,
                    downPaymentAmount:
                      downPaymentType === "amount" ? parseNullableNumber(downPaymentAmount) : null,
                    downPaymentPercent:
                      downPaymentType === "percent" ? parseNullableNumber(downPaymentPercent) : null,
                    financingContingency,
                    inspectionContingency,
                    appraisalContingency,
                    closingTimelineDays: parseNullableNumber(closingTimelineDays),
                    possessionTiming,
                    possessionDaysAfterClosing:
                      possessionTiming === "days_after_closing" || possessionTiming === "custom"
                        ? parseNullableNumber(possessionDaysAfterClosing)
                        : null,
                    notes: notes.trim() || null,
                    buyerRationale: buyerRationale.trim() || null
                  })
                : undefined
            }
            type="button"
          >
            {canStart ? OFFER_PREPARATION_COPY.startAction : OFFER_PREPARATION_COPY.blockedAction}
          </button>
        )}
        {offerPreparation?.readinessToSubmit ? (
          <span className="status-chip">{OFFER_PREPARATION_COPY.readyAction}</span>
        ) : null}
      </div>
    </div>
  );
}
