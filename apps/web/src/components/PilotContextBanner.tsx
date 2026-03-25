import type { PilotContext } from "@nhalo/types";
import { PILOT_OPS_COPY } from "../content";

interface PilotContextBannerProps {
  context: PilotContext;
}

export function PilotContextBanner({ context }: PilotContextBannerProps) {
  return (
    <section className="pilot-context-banner">
      <div>
        <p className="section-label">{PILOT_OPS_COPY.contextLabel}</p>
        <h2>{context.partnerName}</h2>
        <p className="muted">
          {context.partnerSlug} · {context.status} · pilot link {context.pilotLinkId}
        </p>
      </div>
      <div className="status-chip medium">
        <span>Partner-scoped pilot mode</span>
      </div>
    </section>
  );
}
