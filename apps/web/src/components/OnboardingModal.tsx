import { ONBOARDING_CONTENT } from "../content";

interface OnboardingModalProps {
  open: boolean;
  onDismiss(): void;
}

export function OnboardingModal({ open, onDismiss }: OnboardingModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="modal-panel">
        <div className="summary-header">
          <div>
            <p className="section-label">Welcome</p>
            <h2>{ONBOARDING_CONTENT.title}</h2>
          </div>
          <button className="ghost-button" onClick={onDismiss} type="button">
            Skip
          </button>
        </div>

        <div className="onboarding-grid">
          {ONBOARDING_CONTENT.sections.map((section) => (
            <article className="summary-block" key={section.heading}>
              <h3>{section.heading}</h3>
              <p className="muted">{section.body}</p>
            </article>
          ))}
        </div>

        <div className="summary-actions">
          <button className="submit-button" onClick={onDismiss} type="button">
            Start searching
          </button>
        </div>
      </section>
    </div>
  );
}
