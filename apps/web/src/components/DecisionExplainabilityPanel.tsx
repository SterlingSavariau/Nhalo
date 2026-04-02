import { useEffect, useState } from "react";
import type { DecisionExplanationBundle, ExplanationModuleName } from "@nhalo/types";
import {
  fetchDecisionExplanations,
  fetchTransactionCommandCenterExplanations
} from "../api";

type DecisionExplainabilityPanelProps =
  | {
      kind?: "module";
      moduleName: ExplanationModuleName;
      subjectType: string;
      subjectId: string | null | undefined;
      sessionId?: string | null;
      label?: string;
    }
  | {
      kind: "command-center";
      propertyId: string | null | undefined;
      propertyAddressLabel?: string | null;
      shortlistId?: string | null;
      sessionId?: string | null;
      label?: string;
    };

function humanizeCategory(value: string): string {
  return value.replaceAll("_", " ").toLowerCase();
}

export function DecisionExplainabilityPanel(props: DecisionExplainabilityPanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bundle, setBundle] = useState<DecisionExplanationBundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  const label = props.label ?? "Why this?";
  const cacheKey =
    props.kind === "command-center"
      ? `command-center:${props.propertyId ?? "missing"}:${props.shortlistId ?? "none"}:${props.sessionId ?? "none"}`
      : `${props.moduleName}:${props.subjectType}:${props.subjectId ?? "missing"}:${props.sessionId ?? "none"}`;

  useEffect(() => {
    setOpen(false);
    setLoading(false);
    setBundle(null);
    setError(null);
  }, [cacheKey]);

  if (props.kind === "command-center" && !props.propertyId) {
    return null;
  }

  if ((props.kind === undefined || props.kind === "module") && !props.subjectId) {
    return null;
  }

  async function handleToggle(): Promise<void> {
    const nextOpen = !open;
    setOpen(nextOpen);

    if (!nextOpen || bundle || loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nextBundle =
        props.kind === "command-center"
          ? await fetchTransactionCommandCenterExplanations({
              propertyId: props.propertyId ?? "",
              propertyAddressLabel: props.propertyAddressLabel,
              shortlistId: props.shortlistId,
              sessionId: props.sessionId
            })
          : await fetchDecisionExplanations({
              moduleName: props.moduleName,
              subjectType: props.subjectType,
              subjectId: props.subjectId ?? "",
              sessionId: props.sessionId
            });
      setBundle(nextBundle);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Explanation unavailable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="summary-block">
      <button className="chip" onClick={() => void handleToggle()} type="button">
        {label}
      </button>

      {open ? (
        <div className="summary-grid" style={{ marginTop: 12 }}>
          {loading ? <p className="muted">Loading explanation…</p> : null}
          {error ? <p className="muted">{error}</p> : null}
          {!loading && !error && bundle && bundle.explanations.length === 0 ? (
            <p className="muted">No explanation is available for this result yet.</p>
          ) : null}
          {!loading && !error && bundle
            ? bundle.explanations.map((explanation) => (
                <div className="summary-block" key={explanation.id}>
                  <h3>{humanizeCategory(explanation.category)}</h3>
                  <p>{explanation.summary}</p>
                  {explanation.reasonItems.length > 0 ? (
                    <ul>
                      {explanation.reasonItems.map((reason) => (
                        <li key={`${explanation.id}-${reason.label}`}>
                          <strong>{reason.label}</strong>: {reason.detail}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {explanation.whatToChange.length > 0 ? (
                    <>
                      <p className="muted">What to change</p>
                      <ul>
                        {explanation.whatToChange.map((item) => (
                          <li key={`${explanation.id}-${item.action}`}>
                            <strong>{item.action}</strong>: {item.effect}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
