import type { BuyerTransactionCommandCenterView, WorkflowNotification } from "@nhalo/types";
import { DecisionExplainabilityPanel } from "./DecisionExplainabilityPanel";
import { WorkflowAlertList } from "./WorkflowAlertList";
import { TRANSACTION_COMMAND_CENTER_COPY } from "../content";

interface BuyerTransactionCommandCenterCardProps {
  summary: BuyerTransactionCommandCenterView | null;
  notifications?: WorkflowNotification[];
}

function humanize(value: string): string {
  return value.replaceAll("_", " ").toLowerCase();
}

export function BuyerTransactionCommandCenterCard({
  summary,
  notifications = []
}: BuyerTransactionCommandCenterCardProps) {
  if (!summary) {
    return null;
  }

  return (
    <div className="activity-card negotiation-card">
      <div className="summary-header">
        <div>
          <p className="section-label">{TRANSACTION_COMMAND_CENTER_COPY.title}</p>
          <strong>{summary.propertyAddressLabel}</strong>
          <p className="muted">{TRANSACTION_COMMAND_CENTER_COPY.intro}</p>
        </div>
        <div className="status-chip-row">
          <span className="status-chip">
            {TRANSACTION_COMMAND_CENTER_COPY.currentStageLabel}: {humanize(summary.currentStage)}
          </span>
          <span className="status-chip">
            {TRANSACTION_COMMAND_CENTER_COPY.overallStateLabel}: {humanize(summary.overallState)}
          </span>
          <span className="status-chip">
            {TRANSACTION_COMMAND_CENTER_COPY.riskLevelLabel}: {humanize(summary.overallRiskLevel)}
          </span>
        </div>
      </div>

      <DecisionExplainabilityPanel
        kind="command-center"
        label="Why this stage?"
        propertyAddressLabel={summary.propertyAddressLabel}
        propertyId={summary.propertyId}
        sessionId={summary.sessionId}
        shortlistId={summary.shortlistId}
      />

      <WorkflowAlertList
        notifications={notifications}
        title="Top alerts"
        emptyMessage="No active transaction alerts for this property."
      />

      <div className="summary-grid">
        <div className="summary-block">
          <h3>{TRANSACTION_COMMAND_CENTER_COPY.propertyTitle}</h3>
          <p>
            {TRANSACTION_COMMAND_CENTER_COPY.currentStageLabel}: {humanize(summary.currentStage)}
          </p>
          <p>
            {TRANSACTION_COMMAND_CENTER_COPY.overallStateLabel}: {humanize(summary.overallState)}
          </p>
          <p className="muted">
            {TRANSACTION_COMMAND_CENTER_COPY.progressLabel}: {summary.progressPercent}% ·{" "}
            {summary.completedStageCount}/{summary.totalStageCount} stages completed
          </p>
          {summary.isStale ? <p className="muted">This workflow may be stale and needs review.</p> : null}
        </div>

        <div className="summary-block">
          <h3>{TRANSACTION_COMMAND_CENTER_COPY.nextActionTitle}</h3>
          <p>{summary.nextAction}</p>
          <ul>
            {summary.nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="summary-block">
        <h3>{TRANSACTION_COMMAND_CENTER_COPY.progressTitle}</h3>
        <div className="chip-row">
          {summary.stageSummaries.map((stage) => (
            <span className={`chip ${stage.stage === summary.currentStage ? "active" : ""}`} key={stage.stage}>
              {stage.label}: {humanize(stage.status)}
            </span>
          ))}
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-block">
          <h3>{TRANSACTION_COMMAND_CENTER_COPY.blockersTitle}</h3>
          {summary.activeBlockers.length > 0 ? (
            <ul>
              {summary.activeBlockers.map((blocker) => (
                <li key={`${blocker.sourceStage}-${blocker.code}`}>
                  <strong>{blocker.message}</strong>
                  <div className="muted">
                    {blocker.whyItMatters} Fix: {blocker.howToFix}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No active blockers are stored right now.</p>
          )}
        </div>

        <div className="summary-block">
          <h3>{TRANSACTION_COMMAND_CENTER_COPY.riskTitle}</h3>
          {summary.topRisks.length > 0 ? (
            <ul>
              {summary.topRisks.map((risk) => (
                <li key={`${risk.sourceStage}-${risk.code}`}>
                  <strong>{risk.message}</strong>
                  <div className="muted">
                    {humanize(risk.level)}
                    {risk.dueAt ? ` · ${new Date(risk.dueAt).toLocaleString()}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No high-priority risks are currently stored.</p>
          )}
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-block">
          <h3>{TRANSACTION_COMMAND_CENTER_COPY.keyDatesTitle}</h3>
          {summary.keyDates.length > 0 ? (
            <ul>
              {summary.keyDates.map((entry) => (
                <li key={`${entry.sourceStage}-${entry.key}`}>
                  <strong>{entry.label}</strong>: {new Date(entry.date).toLocaleString()}
                  <div className="muted">
                    {humanize(entry.status)} · {humanize(entry.sourceStage)}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No key dates are available yet.</p>
          )}
        </div>

        <div className="summary-block">
          <h3>{TRANSACTION_COMMAND_CENTER_COPY.activityTitle}</h3>
          {summary.recentActivity.length > 0 ? (
            <ul>
              {summary.recentActivity.map((entry) => (
                <li key={entry.id}>
                  <strong>{entry.label}</strong>
                  <div className="muted">
                    {new Date(entry.occurredAt).toLocaleString()} · {humanize(entry.sourceStage)}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No recent workflow activity is stored for this property yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
