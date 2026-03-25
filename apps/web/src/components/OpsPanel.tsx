import type {
  DataQualityEvent,
  DataQualitySummary,
  OpsActionRecord,
  OpsSummary,
  PilotActivityRecord,
  PilotFeatureOverrides,
  PilotLinkRecord,
  PilotPartner,
  PilotPartnerStatus,
  SearchMetrics
} from "@nhalo/types";
import { useState } from "react";
import { PILOT_OPS_COPY } from "../content";

interface OpsPanelProps {
  summary:
    | {
        summary: OpsSummary;
        performance: {
          averageSearchLatencyMs: number;
          p95SearchLatencyMs: number;
          providerCallCountByType: SearchMetrics["providerCallCountByType"];
          cacheHitRate: SearchMetrics["cacheHitRate"];
          liveFetchBudgetExhaustionCount: SearchMetrics["liveFetchBudgetExhaustionCount"];
          heavyEndpointReadCounts: SearchMetrics["heavyEndpointReadCounts"];
        } | null;
        dataQualitySummary: DataQualitySummary;
        errors: SearchMetrics["errorRateByCategory"];
      }
    | null;
  partners: PilotPartner[];
  selectedPartnerId: string | null;
  links: PilotLinkRecord[];
  activity: PilotActivityRecord[];
  actions: OpsActionRecord[];
  qualityEvents: DataQualityEvent[];
  loading?: boolean;
  error?: string | null;
  onSelectPartner(partnerId: string): void;
  onRefresh(): void;
  onCreatePartner(payload: {
    name: string;
    slug: string;
    status: PilotPartnerStatus;
  }): void | Promise<void>;
  onUpdatePartner(
    partnerId: string,
    patch: {
      status?: PilotPartnerStatus;
      featureOverrides?: Partial<PilotFeatureOverrides>;
    }
  ): void | Promise<void>;
  onCreateLink(partnerId: string): void | Promise<void>;
  onRevokeLink(token: string): void | Promise<void>;
  onUpdateDataQualityEvent(
    eventId: string,
    status: "acknowledged" | "resolved" | "ignored"
  ): void | Promise<void>;
}

function formatTimestamp(value?: string | null): string {
  if (!value) {
    return "Not set";
  }

  return new Date(value).toLocaleString();
}

function renderStatus(status: PilotPartnerStatus): string {
  switch (status) {
    case "paused":
      return PILOT_OPS_COPY.pausedLabel;
    case "inactive":
      return PILOT_OPS_COPY.inactiveLabel;
    default:
      return PILOT_OPS_COPY.activeLabel;
  }
}

function describeOverrides(overrides: PilotFeatureOverrides): string {
  const enabled = Object.entries(overrides)
    .filter(([, value]) => value)
    .map(([key]) => key.replace(/Enabled$/, "").replace(/([A-Z])/g, " $1").toLowerCase());

  return enabled.length > 0 ? enabled.join(", ") : "No partner-specific features enabled";
}

export function OpsPanel({
  summary,
  partners,
  selectedPartnerId,
  links,
  activity,
  actions,
  qualityEvents = [],
  loading = false,
  error = null,
  onSelectPartner,
  onRefresh,
  onCreatePartner,
  onUpdatePartner,
  onCreateLink,
  onRevokeLink,
  onUpdateDataQualityEvent
}: OpsPanelProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const selectedPartner = partners.find((entry) => entry.id === selectedPartnerId) ?? null;
  const partnerUsage = summary?.summary.partnerUsage ?? [];
  const selectedPartnerUsage =
    selectedPartner
      ? partnerUsage.find((entry) => entry.partnerId === selectedPartner.id) ?? null
      : null;

  return (
    <section className="ops-panel">
      <div className="summary-header">
        <div>
          <p className="section-label">{PILOT_OPS_COPY.internalLabel}</p>
          <h2>Pilot operations</h2>
          <p className="muted">{PILOT_OPS_COPY.opsWarning}</p>
        </div>
        <button className="ghost-button" onClick={onRefresh} type="button">
          Refresh ops
        </button>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="summary-grid">
        <div className="summary-block">
          <h3>Partner summary</h3>
          <p>{summary?.summary.activePilotPartners ?? 0} active partners</p>
          <p className="muted">
            {summary?.summary.pilotLinkCounts.active ?? 0} active links ·{" "}
            {summary?.summary.pilotLinkCounts.revoked ?? 0} revoked
          </p>
        </div>
        <div className="summary-block">
          <h3>Usage summary</h3>
          <p>{summary?.summary.recentSharedSnapshotCount ?? 0} recent shared snapshots</p>
          <p className="muted">
            {summary?.summary.recentShortlistShareCount ?? 0} shortlist shares ·{" "}
            {summary?.summary.feedbackCount ?? 0} feedback records
          </p>
        </div>
        <div className="summary-block">
          <h3>Operational health</h3>
          <p>{summary?.summary.providerDegradationCount ?? 0} provider degradations during pilot use</p>
          <p className="muted">
            Top errors:{" "}
            {summary?.summary.topErrorCategories.length
              ? summary.summary.topErrorCategories
                  .slice(0, 2)
                  .map((entry) => `${entry.category} (${entry.count})`)
                  .join(", ")
              : "none"}
          </p>
        </div>
        <div className="summary-block">
          <h3>Data quality</h3>
          <p>{summary?.dataQualitySummary?.openCount ?? 0} open integrity events</p>
          <p className="muted">
            {summary?.dataQualitySummary?.criticalCount ?? 0} critical ·{" "}
            {summary?.dataQualitySummary?.resolvedCount ?? 0} resolved
          </p>
        </div>
        <div className="summary-block">
          <h3>Performance</h3>
          <p>
            avg {summary?.performance?.averageSearchLatencyMs ?? 0} ms · p95{" "}
            {summary?.performance?.p95SearchLatencyMs ?? 0} ms
          </p>
          <p className="muted">
            cache hit {summary?.performance?.cacheHitRate.rate ?? 0} · budgets{" "}
            {(summary?.performance?.liveFetchBudgetExhaustionCount.geocoder ?? 0) +
              (summary?.performance?.liveFetchBudgetExhaustionCount.listing ?? 0) +
              (summary?.performance?.liveFetchBudgetExhaustionCount.safety ?? 0)}
          </p>
        </div>
      </div>

      <div className="ops-create-form">
        <h3>{PILOT_OPS_COPY.createPartnerTitle}</h3>
        <div className="field-grid">
          <label className="search-field">
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Acme Realty pilot" />
          </label>
          <label className="search-field">
            <span>Slug</span>
            <input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="acme-realty" />
          </label>
        </div>
        <button
          className="primary-button"
          disabled={!name.trim() || !slug.trim() || loading}
          onClick={() => {
            void onCreatePartner({
              name: name.trim(),
              slug: slug.trim(),
              status: "active"
            });
            setName("");
            setSlug("");
          }}
          type="button"
        >
          Create partner
        </button>
      </div>

      <div className="ops-columns">
        <div className="ops-list">
          <h3>Partners</h3>
          {partners.length === 0 ? <p className="muted">No pilot partners yet.</p> : null}
          {partners.map((partner) => (
            <button
              key={partner.id}
              className={`ops-list-item ${partner.id === selectedPartnerId ? "active" : ""}`}
              onClick={() => onSelectPartner(partner.id)}
              type="button"
            >
              <strong>{partner.name}</strong>
              <span>{renderStatus(partner.status)}</span>
              <small>{describeOverrides(partner.featureOverrides)}</small>
            </button>
          ))}
        </div>

        <div className="ops-detail">
          {selectedPartner ? (
            <>
              <div className="summary-header">
                <div>
                  <h3>{selectedPartner.name}</h3>
                  <p className="muted">
                    {selectedPartner.slug} · {renderStatus(selectedPartner.status)}
                  </p>
                </div>
                <div className="summary-actions">
                  <button
                    className="ghost-button"
                    onClick={() => void onCreateLink(selectedPartner.id)}
                    type="button"
                  >
                    {PILOT_OPS_COPY.createLinkAction}
                  </button>
                  <button
                    className="ghost-button"
                    onClick={() =>
                      void onUpdatePartner(selectedPartner.id, {
                        status: selectedPartner.status === "paused" ? "active" : "paused"
                      })
                    }
                    type="button"
                  >
                    {selectedPartner.status === "paused" ? "Resume partner" : "Pause partner"}
                  </button>
                </div>
              </div>

              <p className="muted">{PILOT_OPS_COPY.linkWarning}</p>

              <div className="summary-grid">
                <div className="summary-block">
                  <h3>Partner flags</h3>
                  <p>{describeOverrides(selectedPartner.featureOverrides)}</p>
                  <p className="muted">Updated {formatTimestamp(selectedPartner.updatedAt)}</p>
                </div>
                <div className="summary-block">
                  <h3>Links</h3>
                  <p>{links.length} total</p>
                  <p className="muted">
                    {links.filter((entry) => entry.status === "active").length} active ·{" "}
                    {links.filter((entry) => entry.status !== "active").length} unavailable
                  </p>
                </div>
                <div className="summary-block">
                  <h3>Partner usage</h3>
                  <p>{selectedPartnerUsage?.searches ?? 0} searches</p>
                  <p className="muted">
                    {selectedPartnerUsage?.liveProviderCalls ?? 0} live calls · cache hit{" "}
                    {selectedPartnerUsage?.cacheHitRate ?? 0}
                  </p>
                </div>
              </div>

              <div className="ops-subsection">
                <h3>Pilot links</h3>
                {links.length === 0 ? <p className="muted">No pilot links for this partner yet.</p> : null}
                {links.map((link) => (
                  <div className="ops-record" key={link.id}>
                    <div>
                      <strong>{link.status}</strong>
                      <p className="muted">
                        Token {link.token} · opens {link.openCount}
                      </p>
                      <p className="muted">
                        Created {formatTimestamp(link.createdAt)} · expires {formatTimestamp(link.expiresAt)}
                      </p>
                    </div>
                    <button
                      className="ghost-button"
                      disabled={link.status !== "active"}
                      onClick={() => void onRevokeLink(link.token)}
                      type="button"
                    >
                      {PILOT_OPS_COPY.revokeLinkAction}
                    </button>
                  </div>
                ))}
              </div>

              <div className="ops-subsection">
                <h3>Recent data quality events</h3>
                {qualityEvents.length === 0 ? <p className="muted">No recent integrity events for this partner.</p> : null}
                {qualityEvents.map((event) => (
                  <div className="ops-record" key={event.id}>
                    <div>
                      <strong>
                        {event.severity} · {event.category}
                      </strong>
                      <p className="muted">{event.message}</p>
                      <p className="muted">
                        {event.sourceDomain} · {event.provider ?? "unknown provider"} · {formatTimestamp(event.createdAt)}
                      </p>
                    </div>
                    <div className="summary-actions">
                      <span className="chip subdued">{event.status}</span>
                      {event.status !== "acknowledged" ? (
                        <button
                          className="ghost-button"
                          onClick={() => void onUpdateDataQualityEvent(event.id, "acknowledged")}
                          type="button"
                        >
                          Acknowledge
                        </button>
                      ) : null}
                      {event.status !== "resolved" ? (
                        <button
                          className="ghost-button"
                          onClick={() => void onUpdateDataQualityEvent(event.id, "resolved")}
                          type="button"
                        >
                          Resolve
                        </button>
                      ) : null}
                      {event.status !== "ignored" ? (
                        <button
                          className="ghost-button"
                          onClick={() => void onUpdateDataQualityEvent(event.id, "ignored")}
                          type="button"
                        >
                          Ignore
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <div className="ops-subsection">
                <h3>Recent pilot activity</h3>
                {activity.length === 0 ? <p className="muted">No activity recorded for this partner yet.</p> : null}
                {activity.map((record) => (
                  <div className="ops-record" key={record.id}>
                    <div>
                      <strong>{record.eventType.replaceAll("_", " ")}</strong>
                      <p className="muted">{formatTimestamp(record.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="ops-subsection">
                <h3>Ops actions</h3>
                {actions.length === 0 ? <p className="muted">No ops actions recorded for this partner yet.</p> : null}
                {actions.map((action) => (
                  <div className="ops-record" key={action.id}>
                    <div>
                      <strong>{action.actionType.replaceAll("_", " ")}</strong>
                      <p className="muted">
                        {action.targetType} · {action.result} · {formatTimestamp(action.performedAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state compact">
              <p className="section-label">Pilot operations</p>
              <h3>Select a pilot partner</h3>
              <p className="muted">Choose a partner to review links, activity, and safe pilot controls.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
