import type { SelectedChoiceOfferStrategy } from "@nhalo/types";
import { AlertTriangle, ArrowRight, Gauge, ShieldCheck, Tags } from "lucide-react";
import { OFFER_STRATEGY_COPY } from "../content";

interface OfferStrategyCardProps {
  strategy: SelectedChoiceOfferStrategy | null;
  compact?: boolean;
  className?: string;
}

function joinClasses(...values: Array<string | null | undefined | false>) {
  return values.filter(Boolean).join(" ");
}

function humanize(value: string): string {
  return value.replaceAll("_", " ");
}

function formatCurrency(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "N/A";
  }

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });
}

function formatPricePerSqft(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "N/A";
  }

  return `$${value.toFixed(0)}/sqft`;
}

export function OfferStrategyCard({
  strategy,
  compact = false,
  className
}: OfferStrategyCardProps) {
  if (!strategy) {
    return null;
  }

  const risks = compact ? strategy.marketRisks.slice(0, 2) : strategy.marketRisks.slice(0, 3);
  const rationale = compact ? strategy.strategyRationale.slice(0, 2) : strategy.strategyRationale.slice(0, 3);

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
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {OFFER_STRATEGY_COPY.title}
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="border border-border px-2 py-1 text-foreground">
              {humanize(strategy.offerPosture)}
            </span>
            <span className="border border-border px-2 py-1 text-muted-foreground">
              {OFFER_STRATEGY_COPY.urgencyLabel}: {humanize(strategy.urgencyLevel)}
            </span>
            <span className="border border-border px-2 py-1 text-muted-foreground">
              {OFFER_STRATEGY_COPY.strategyConfidenceLabel}: {humanize(strategy.strategyConfidence)}
            </span>
          </div>
        </div>
      </div>

      {strategy.strategyConfidence === "low" ? (
        <div className="border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          {OFFER_STRATEGY_COPY.provisionalWarning}
        </div>
      ) : null}

      <div className="border border-border bg-muted/30 p-4">
        <div className="flex items-start gap-2">
          <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground" />
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              {OFFER_STRATEGY_COPY.nextActionLabel}
            </p>
            <p className="mt-1 text-sm text-foreground">{humanize(strategy.recommendedNextOfferAction)}</p>
          </div>
        </div>
      </div>

      <div className={joinClasses("grid gap-4", compact ? "sm:grid-cols-2" : "md:grid-cols-3")}>
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <Gauge className="h-3.5 w-3.5" />
            {OFFER_STRATEGY_COPY.pricePositionTitle}
          </p>
          <p className="text-sm text-foreground">
            List {formatCurrency(strategy.pricePosition.listPrice)} · Recommended{" "}
            {formatCurrency(strategy.pricePosition.recommendedOfferPrice)}
          </p>
          <p className="text-sm text-muted-foreground">
            {humanize(strategy.pricePosition.versusList)} · {humanize(strategy.pricePosition.versusMarket)}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatPricePerSqft(strategy.pricePosition.pricePerSqft)} vs market{" "}
            {formatPricePerSqft(strategy.pricePosition.medianPricePerSqft)}
          </p>
        </div>

        <div className="space-y-2">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <Tags className="h-3.5 w-3.5" />
            {OFFER_STRATEGY_COPY.concessionLabel}
          </p>
          <p className="text-sm text-foreground">{humanize(strategy.concessionStrategy)}</p>
          <p className="text-sm text-muted-foreground">
            {strategy.marketContext.listingStatus
              ? `Listing ${humanize(strategy.marketContext.listingStatus)}`
              : "Listing status unavailable"}
            {" · "}
            {strategy.marketContext.daysOnMarket !== null
              ? `${strategy.marketContext.daysOnMarket} days on market`
              : "DOM unavailable"}
          </p>
        </div>

        <div className="space-y-2">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Market context
          </p>
          <p className="text-sm text-foreground">
            {strategy.marketContext.comparableSampleSize ?? "N/A"} comparables ·{" "}
            {strategy.marketContext.comparableStrategyUsed
              ? humanize(strategy.marketContext.comparableStrategyUsed)
              : "strategy unavailable"}
          </p>
          <p className="text-sm text-muted-foreground">
            {strategy.marketContext.overallConfidence
              ? `${humanize(strategy.marketContext.overallConfidence)} data confidence`
              : "confidence unavailable"}
          </p>
        </div>
      </div>

      {!compact ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              {OFFER_STRATEGY_COPY.rationaleTitle}
            </p>
            {rationale.length > 0 ? (
              <ul className="space-y-2 text-sm text-foreground">
                {rationale.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No strategy rationale is stored yet.</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" />
              {OFFER_STRATEGY_COPY.risksTitle}
            </p>
            {risks.length > 0 ? (
              <ul className="space-y-2 text-sm text-foreground">
                {risks.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No market risks are currently surfaced.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {rationale.length > 0 ? (
            <p className="text-sm text-foreground">{rationale.join(" · ")}</p>
          ) : null}
          {risks.length > 0 ? (
            <p className="text-sm text-muted-foreground">{risks.join(" · ")}</p>
          ) : null}
        </div>
      )}
    </section>
  );
}
