import type { PilotContext } from "@nhalo/types";
import { PILOT_OPS_COPY } from "../content";

interface PilotContextBannerProps {
  context: PilotContext;
}

export function PilotContextBanner({ context }: PilotContextBannerProps) {
  const activeCapabilities = [
    context.capabilities.canShareSnapshots
      ? PILOT_OPS_COPY.capabilityLabels.canShareSnapshots
      : null,
    context.capabilities.canShareShortlists
      ? PILOT_OPS_COPY.capabilityLabels.canShareShortlists
      : null,
    context.capabilities.canUseDemoMode
      ? PILOT_OPS_COPY.capabilityLabels.canUseDemoMode
      : null,
    context.capabilities.canExportResults
      ? PILOT_OPS_COPY.capabilityLabels.canExportResults
      : null,
    context.capabilities.canUseCollaboration
      ? PILOT_OPS_COPY.capabilityLabels.canUseCollaboration
      : null
  ].filter((value): value is string => Boolean(value));

  return (
    <section className="pilot-context-banner">
      <div>
        <p className="section-label">{PILOT_OPS_COPY.contextLabel}</p>
        <h2>{context.partnerName}</h2>
        <p className="muted">
          {context.partnerSlug} · {context.status} · {PILOT_OPS_COPY.planLabel.toLowerCase()} {context.planTier} · pilot link {context.pilotLinkId}
        </p>
        {activeCapabilities.length > 0 ? (
          <p className="muted">{activeCapabilities.join(" · ")}</p>
        ) : null}
      </div>
      <div className="status-chip medium">
        <span>Partner-scoped pilot mode</span>
      </div>
    </section>
  );
}
