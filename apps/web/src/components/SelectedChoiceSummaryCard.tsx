import type { SelectedChoiceConciergeSummary } from "@nhalo/types";
import { AlertTriangle, ArrowRight, CheckCircle2, Home, Layers3 } from "lucide-react";

interface SelectedChoiceSummaryCardProps {
  summary: SelectedChoiceConciergeSummary | null;
  title?: string;
  compact?: boolean;
  className?: string;
}

function joinClasses(...values: Array<string | null | undefined | false>) {
  return values.filter(Boolean).join(" ");
}

function choiceStatusLabel(status: SelectedChoiceConciergeSummary["choiceStatus"]) {
  switch (status) {
    case "selected":
      return "Selected choice";
    case "active_pursuit":
      return "Active pursuit";
    case "under_contract":
      return "Under contract";
    case "closed":
      return "Closed";
    case "dropped":
      return "Dropped";
    case "replaced":
      return "Replaced";
    case "backup":
      return "Backup";
    case "candidate":
      return "Candidate";
    default:
      return "Shortlist open";
  }
}

function decisionStageLabel(stage: SelectedChoiceConciergeSummary["decisionStage"]) {
  switch (stage) {
    case "selected_choice":
      return "Selected choice";
    case "offer_pursuit":
      return "Offer pursuit";
    case "contract_to_close":
      return "Contract to close";
    case "finished":
      return "Finished";
    case "considering":
      return "Considering";
    default:
      return "Not selected";
  }
}

function sourceModuleLabel(sourceModule: SelectedChoiceConciergeSummary["concierge"]["sourceModule"]) {
  return sourceModule.replaceAll("_", " ");
}

export function SelectedChoiceSummaryCard({
  summary,
  title = "Selected choice concierge",
  compact = false,
  className
}: SelectedChoiceSummaryCardProps) {
  if (!summary) {
    return null;
  }

  const riskItems =
    summary.concierge.topRisks.length > 0 ? summary.concierge.topRisks : summary.decision.decisionRisks;
  const nextSteps = compact ? summary.concierge.nextSteps.slice(0, 2) : summary.concierge.nextSteps.slice(0, 4);
  const blockers = compact ? summary.concierge.blockers.slice(0, 2) : summary.concierge.blockers.slice(0, 3);
  const topRisks = compact ? riskItems.slice(0, 2) : riskItems.slice(0, 3);

  return (
    <section
      className={joinClasses(
        "border border-border bg-background p-5",
        compact ? "space-y-4" : "space-y-5",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="border border-border px-2 py-1 text-foreground">
              {decisionStageLabel(summary.decisionStage)}
            </span>
            <span className="border border-border px-2 py-1 text-muted-foreground">
              {choiceStatusLabel(summary.choiceStatus)}
            </span>
            <span className="border border-border px-2 py-1 text-muted-foreground">
              {sourceModuleLabel(summary.concierge.sourceModule)}
            </span>
          </div>
        </div>

        <div className="text-right text-xs text-muted-foreground">
          <div>{summary.decision.backupCount} backup{summary.decision.backupCount === 1 ? "" : "s"}</div>
          {summary.decision.decisionConfidence ? (
            <div>{summary.decision.decisionConfidence} decision confidence</div>
          ) : null}
          {summary.alerts.unreadCount > 0 ? (
            <div>{summary.alerts.unreadCount} active alert{summary.alerts.unreadCount === 1 ? "" : "s"}</div>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <Home className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground" />
          <div>
            <p className="text-base font-medium text-foreground">
              {summary.property ? summary.property.address : "No primary home selected"}
            </p>
            <p className="text-sm text-muted-foreground">
              {summary.property
                ? `${summary.property.city}, ${summary.property.state}`
                : "Shortlist the best-fit homes, then promote one into the active decision track."}
            </p>
          </div>
        </div>

        <div>
          <h3 className={joinClasses("text-foreground", compact ? "text-lg font-medium" : "text-2xl font-serif")}>
            {summary.concierge.headline}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">{summary.concierge.recommendationSummary}</p>
        </div>
      </div>

      <div className="border border-border bg-muted/30 p-4">
        <div className="flex items-start gap-2">
          <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground" />
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Next action</p>
            <p className="mt-1 text-sm text-foreground">{summary.concierge.nextAction}</p>
          </div>
        </div>
      </div>

      {!compact ? (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Next steps
            </p>
            {nextSteps.length > 0 ? (
              <ul className="space-y-2 text-sm text-foreground">
                {nextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No additional next steps are stored yet.</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <Layers3 className="h-3.5 w-3.5" />
              Blockers
            </p>
            {blockers.length > 0 ? (
              <ul className="space-y-2 text-sm text-foreground">
                {blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No active blockers in the current workflow path.</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" />
              Top risks
            </p>
            {topRisks.length > 0 ? (
              <ul className="space-y-2 text-sm text-foreground">
                {topRisks.map((risk) => (
                  <li key={risk}>{risk}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No elevated risks are currently surfaced.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {nextSteps.length > 0 ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Next steps</p>
              <p className="mt-1 text-sm text-foreground">{nextSteps.join(" · ")}</p>
            </div>
          ) : null}
          {blockers.length > 0 || topRisks.length > 0 ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                {blockers.length > 0 ? "Blockers" : "Top risks"}
              </p>
              <p className="mt-1 text-sm text-foreground">
                {(blockers.length > 0 ? blockers : topRisks).join(" · ")}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
