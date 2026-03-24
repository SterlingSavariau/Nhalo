interface PilotContactPanelProps {
  ctaLabel: string;
  ctaUrl: string | null;
  onClick(): void;
}

export function PilotContactPanel({ ctaLabel, ctaUrl, onClick }: PilotContactPanelProps) {
  if (!ctaUrl) {
    return null;
  }

  return (
    <section className="pilot-cta-panel">
      <p className="section-label">Pilot contact</p>
      <h3>Continue the conversation</h3>
      <p className="muted">
        This action opens a lightweight contact path for pilot discussions. It does not create an account.
      </p>
      <a className="submit-button cta-link" href={ctaUrl} onClick={onClick}>
        {ctaLabel}
      </a>
    </section>
  );
}
