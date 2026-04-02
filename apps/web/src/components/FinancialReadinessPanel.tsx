import { useEffect, useMemo, useState } from "react";
import type { FinancialReadiness, WorkflowNotification } from "@nhalo/types";
import { DecisionExplainabilityPanel } from "./DecisionExplainabilityPanel";
import { WorkflowAlertList } from "./WorkflowAlertList";
import { FINANCIAL_READINESS_COPY } from "../content";

interface FinancialReadinessPanelProps {
  readiness: FinancialReadiness | null;
  notifications?: WorkflowNotification[];
  onCreate(payload: {
    annualHouseholdIncome: number | null;
    monthlyDebtPayments: number | null;
    availableCashSavings: number | null;
    creditScoreRange: FinancialReadiness["creditScoreRange"];
    desiredHomePrice: number | null;
    purchaseLocation: string | null;
    downPaymentPreferencePercent?: number | null;
    loanType?: FinancialReadiness["loanType"];
    preApprovalStatus: FinancialReadiness["preApprovalStatus"];
    preApprovalExpiresAt?: string | null;
    proofOfFundsStatus: FinancialReadiness["proofOfFundsStatus"];
  }): void;
  onUpdate(
    id: string,
    patch: {
      annualHouseholdIncome?: number | null;
      monthlyDebtPayments?: number | null;
      availableCashSavings?: number | null;
      creditScoreRange?: FinancialReadiness["creditScoreRange"];
      desiredHomePrice?: number | null;
      purchaseLocation?: string | null;
      downPaymentPreferencePercent?: number | null;
      loanType?: FinancialReadiness["loanType"];
      preApprovalStatus?: FinancialReadiness["preApprovalStatus"];
      preApprovalExpiresAt?: string | null;
      proofOfFundsStatus?: FinancialReadiness["proofOfFundsStatus"];
    }
  ): void;
}

function currency(value: number | null | undefined): string {
  if (typeof value !== "number") {
    return "Not available";
  }

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });
}

function percent(value: number | null | undefined): string {
  if (typeof value !== "number") {
    return "Not available";
  }

  return `${Math.round(value * 100)}%`;
}

function titleCaseStatus(value: string): string {
  return value.replaceAll("_", " ").toLowerCase();
}

function parseNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function FinancialReadinessPanel({
  readiness,
  notifications = [],
  onCreate,
  onUpdate
}: FinancialReadinessPanelProps) {
  const [annualIncome, setAnnualIncome] = useState("");
  const [monthlyDebt, setMonthlyDebt] = useState("");
  const [cashSavings, setCashSavings] = useState("");
  const [desiredHomePrice, setDesiredHomePrice] = useState("");
  const [location, setLocation] = useState("");
  const [downPaymentPercent, setDownPaymentPercent] = useState("");
  const [creditScoreRange, setCreditScoreRange] = useState<FinancialReadiness["creditScoreRange"]>("good_720_759");
  const [loanType, setLoanType] = useState<FinancialReadiness["loanType"]>("conventional");
  const [preApprovalStatus, setPreApprovalStatus] = useState<FinancialReadiness["preApprovalStatus"]>("not_started");
  const [proofOfFundsStatus, setProofOfFundsStatus] = useState<FinancialReadiness["proofOfFundsStatus"]>("not_started");

  useEffect(() => {
    setAnnualIncome(readiness?.annualHouseholdIncome?.toString() ?? "");
    setMonthlyDebt(readiness?.monthlyDebtPayments?.toString() ?? "");
    setCashSavings(readiness?.availableCashSavings?.toString() ?? "");
    setDesiredHomePrice(readiness?.desiredHomePrice?.toString() ?? "");
    setLocation(readiness?.purchaseLocation ?? "");
    setDownPaymentPercent(readiness?.downPaymentPreferencePercent?.toString() ?? "");
    setCreditScoreRange(readiness?.creditScoreRange ?? "good_720_759");
    setLoanType(readiness?.loanType ?? "conventional");
    setPreApprovalStatus(readiness?.preApprovalStatus ?? "not_started");
    setProofOfFundsStatus(readiness?.proofOfFundsStatus ?? "not_started");
  }, [readiness]);

  const completion = useMemo(() => {
    const completed: string[] = [];
    const inProgress: string[] = [];

    if (annualIncome && monthlyDebt && desiredHomePrice && location.trim()) {
      completed.push("Income, debt, target price, and location are recorded");
    } else {
      inProgress.push("Complete income, debt, target price, and location");
    }

    if (cashSavings && proofOfFundsStatus === "verified") {
      completed.push("Cash available and proof of funds are verified");
    } else {
      inProgress.push("Confirm available cash and proof of funds");
    }

    if (preApprovalStatus === "verified") {
      completed.push("Pre-approval is verified");
    } else {
      inProgress.push("Get pre-approval");
    }

    return { completed, inProgress };
  }, [annualIncome, cashSavings, desiredHomePrice, location, monthlyDebt, preApprovalStatus, proofOfFundsStatus]);

  const savePayload = {
    annualHouseholdIncome: parseNumber(annualIncome),
    monthlyDebtPayments: parseNumber(monthlyDebt),
    availableCashSavings: parseNumber(cashSavings),
    creditScoreRange,
    desiredHomePrice: parseNumber(desiredHomePrice),
    purchaseLocation: location.trim() || null,
    downPaymentPreferencePercent: parseNumber(downPaymentPercent),
    loanType,
    preApprovalStatus,
    proofOfFundsStatus
  };

  return (
    <section className="activity-panel financial-readiness-panel">
      <div className="summary-header">
        <div>
          <p className="section-label">{FINANCIAL_READINESS_COPY.title}</p>
          <h3>{readiness ? titleCaseStatus(readiness.readinessState) : FINANCIAL_READINESS_COPY.emptyTitle}</h3>
          <p className="muted">{FINANCIAL_READINESS_COPY.intro}</p>
        </div>
        <div className="status-chip-row">
          {readiness ? (
            <>
              <span className="status-chip">
                {FINANCIAL_READINESS_COPY.stateLabel}: {titleCaseStatus(readiness.readinessState)}
              </span>
              <span className="status-chip">
                {FINANCIAL_READINESS_COPY.affordabilityLabel}:{" "}
                {titleCaseStatus(readiness.affordabilityClassification)}
              </span>
            </>
          ) : (
            <span className="status-chip">Not started</span>
          )}
        </div>
      </div>

      {!readiness ? <p className="muted">{FINANCIAL_READINESS_COPY.emptyBody}</p> : null}

      {readiness ? (
        <DecisionExplainabilityPanel
          label="Why this state?"
          moduleName="financial_readiness"
          subjectId={readiness.id}
          subjectType="financial_readiness"
        />
      ) : null}

      <WorkflowAlertList
        notifications={notifications}
        title="Active alerts"
        emptyMessage="No active financial readiness alerts."
      />

      <div className="summary-grid">
        <div className="summary-block">
          <h3>{FINANCIAL_READINESS_COPY.maxHomePriceLabel}</h3>
          <p>{currency(readiness?.maxAffordableHomePrice)}</p>
        </div>
        <div className="summary-block">
          <h3>{FINANCIAL_READINESS_COPY.monthlyPaymentLabel}</h3>
          <p>{currency(readiness?.estimatedMonthlyPayment)}</p>
        </div>
        <div className="summary-block">
          <h3>{FINANCIAL_READINESS_COPY.cashRequiredLabel}</h3>
          <p>{currency(readiness?.totalCashRequiredToClose)}</p>
        </div>
        <div className="summary-block">
          <h3>{FINANCIAL_READINESS_COPY.dtiLabel}</h3>
          <p>{percent(readiness?.debtToIncomeRatio)}</p>
        </div>
      </div>

      {readiness ? (
        <div className="summary-grid">
          <div className="summary-block">
            <h3>{FINANCIAL_READINESS_COPY.completedLabel}</h3>
            <ul>
              {completion.completed.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          </div>
          <div className="summary-block">
            <h3>{FINANCIAL_READINESS_COPY.inProgressLabel}</h3>
            <ul>
              {completion.inProgress.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {(readiness?.blockers.length ?? 0) > 0 ? (
        <div className="summary-block">
          <h3>{FINANCIAL_READINESS_COPY.blockersTitle}</h3>
          <ul>
            {readiness?.blockers.map((blocker) => (
              <li key={`${blocker.code}-${blocker.message}`}>
                <strong>{blocker.message}</strong> {blocker.howToFix}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {readiness ? (
        <div className="summary-grid">
          <div className="summary-block">
            <h3>{FINANCIAL_READINESS_COPY.recommendationTitle}</h3>
            <p>{readiness.recommendation}</p>
            <p className="muted">Risk: {readiness.risk}</p>
            <p className="muted">Alternative: {readiness.alternative}</p>
          </div>
          <div className="summary-block">
            <h3>{FINANCIAL_READINESS_COPY.nextStepsTitle}</h3>
            <ul>
              {readiness.nextSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
            <p className="muted">
              {FINANCIAL_READINESS_COPY.nextActionLabel}: {readiness.nextAction}
            </p>
          </div>
        </div>
      ) : null}

      {readiness ? (
        <div className="summary-grid">
          <div className="summary-block">
            <h3>{FINANCIAL_READINESS_COPY.downPaymentLabel}</h3>
            <p>{currency(readiness.estimatedDownPayment)}</p>
            <p className="muted">
              {FINANCIAL_READINESS_COPY.closingCostsLabel}: {currency(readiness.estimatedClosingCosts)}
            </p>
            <p className="muted">
              {FINANCIAL_READINESS_COPY.housingRatioLabel}: {percent(readiness.housingRatio)}
            </p>
          </div>
          <div className="summary-block">
            <h3>{FINANCIAL_READINESS_COPY.assumptionsTitle}</h3>
            <p className="muted">
              Interest rate {(readiness.assumptionsUsed.interestRate ?? 0) * 100 || 0}%
            </p>
            <p className="muted">
              Down payment {(readiness.assumptionsUsed.downPaymentPercent ?? 0) * 100 || 0}%
            </p>
            <p className="muted">
              Closing costs {(readiness.assumptionsUsed.closingCostPercent ?? 0) * 100 || 0}%
            </p>
          </div>
        </div>
      ) : null}

      <div className="offer-readiness-grid">
        <label>
          <span>Annual household income</span>
          <input value={annualIncome} onChange={(event) => setAnnualIncome(event.target.value)} />
        </label>
        <label>
          <span>Monthly debt payments</span>
          <input value={monthlyDebt} onChange={(event) => setMonthlyDebt(event.target.value)} />
        </label>
        <label>
          <span>Available cash savings</span>
          <input value={cashSavings} onChange={(event) => setCashSavings(event.target.value)} />
        </label>
        <label>
          <span>Desired home price</span>
          <input value={desiredHomePrice} onChange={(event) => setDesiredHomePrice(event.target.value)} />
        </label>
        <label>
          <span>Purchase location</span>
          <input value={location} onChange={(event) => setLocation(event.target.value)} />
        </label>
        <label>
          <span>Down payment preference (%)</span>
          <input value={downPaymentPercent} onChange={(event) => setDownPaymentPercent(event.target.value)} />
        </label>
        <label>
          <span>Credit score range</span>
          <select
            value={creditScoreRange ?? "good_720_759"}
            onChange={(event) => setCreditScoreRange(event.target.value as FinancialReadiness["creditScoreRange"])}
          >
            <option value="excellent_760_plus">760+</option>
            <option value="good_720_759">720-759</option>
            <option value="fair_680_719">680-719</option>
            <option value="limited_620_679">620-679</option>
            <option value="below_620">Below 620</option>
          </select>
        </label>
        <label>
          <span>Loan type</span>
          <select value={loanType ?? "conventional"} onChange={(event) => setLoanType(event.target.value as FinancialReadiness["loanType"])}>
            <option value="conventional">Conventional</option>
            <option value="fha">FHA</option>
            <option value="va">VA</option>
            <option value="usda">USDA</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          <span>Pre-approval</span>
          <select
            value={preApprovalStatus ?? "not_started"}
            onChange={(event) => setPreApprovalStatus(event.target.value as FinancialReadiness["preApprovalStatus"])}
          >
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="verified">Verified</option>
            <option value="expired">Expired</option>
          </select>
        </label>
        <label>
          <span>Proof of funds</span>
          <select
            value={proofOfFundsStatus ?? "not_started"}
            onChange={(event) => setProofOfFundsStatus(event.target.value as FinancialReadiness["proofOfFundsStatus"])}
          >
            <option value="not_started">Not started</option>
            <option value="partial">Partial</option>
            <option value="verified">Verified</option>
          </select>
        </label>
      </div>

      <div className="activity-actions">
        {readiness ? (
          <button className="submit-button" onClick={() => onUpdate(readiness.id, savePayload)} type="button">
            {FINANCIAL_READINESS_COPY.updateAction}
          </button>
        ) : (
          <button className="submit-button" onClick={() => onCreate(savePayload)} type="button">
            {FINANCIAL_READINESS_COPY.startAction}
          </button>
        )}
        {readiness ? <span className="status-chip">{readiness.nextAction}</span> : null}
      </div>
    </section>
  );
}
