import { RESULT_COPY } from "../content";

interface WalkthroughPanelProps {
  steps: ReadonlyArray<{
    title: string;
    body: string;
  }>;
  onDismiss(): void;
}

export function WalkthroughPanel({ steps, onDismiss }: WalkthroughPanelProps) {
  if (steps.length === 0) {
    return null;
  }

  return (
    <section className="walkthrough-panel">
      <div className="summary-header">
        <div>
          <p className="section-label">{RESULT_COPY.walkthroughTitle}</p>
          <h3>Use this sequence during a live demo</h3>
        </div>
        <button className="ghost-button" onClick={onDismiss} type="button">
          Dismiss
        </button>
      </div>

      <div className="activity-list">
        {steps.map((step, index) => (
          <article className="activity-card" key={step.title}>
            <strong>
              {index + 1}. {step.title}
            </strong>
            <p className="muted">{step.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
