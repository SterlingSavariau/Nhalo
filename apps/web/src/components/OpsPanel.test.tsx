import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { OpsPanel } from "./OpsPanel";

describe("OpsPanel", () => {
  it("renders pilot summary, links, and activity for internal ops review", () => {
    const markup = renderToStaticMarkup(
      <OpsPanel
        actions={[
          {
            id: "action-1",
            actionType: "pilot_link_created",
            targetType: "pilot_link",
            targetId: "link-1",
            partnerId: "partner-1",
            performedAt: "2026-03-24T12:00:00.000Z",
            result: "success",
            details: null
          }
        ]}
        activity={[
          {
            id: "activity-1",
            partnerId: "partner-1",
            pilotLinkId: "link-1",
            eventType: "pilot_link_opened",
            payload: null,
            createdAt: "2026-03-24T12:10:00.000Z"
          }
        ]}
        links={[
          {
            id: "link-1",
            partnerId: "partner-1",
            token: "pilot-token-1",
            allowedFeatures: {
              demoModeEnabled: true,
              sharedSnapshotsEnabled: true,
              sharedShortlistsEnabled: true,
              feedbackEnabled: true,
              validationPromptsEnabled: true,
              shortlistCollaborationEnabled: true
            },
            createdAt: "2026-03-24T12:00:00.000Z",
            expiresAt: "2026-04-23T12:00:00.000Z",
            revokedAt: null,
            openCount: 3,
            status: "active"
          }
        ]}
        onCreateLink={vi.fn()}
        onCreatePartner={vi.fn()}
        onRefresh={vi.fn()}
        onRevokeLink={vi.fn()}
        onSelectPartner={vi.fn()}
        onUpdatePartner={vi.fn()}
        partners={[
          {
            id: "partner-1",
            name: "Acme Pilot",
            slug: "acme-pilot",
            status: "active",
            contactLabel: null,
            notes: null,
            featureOverrides: {
              demoModeEnabled: true,
              sharedSnapshotsEnabled: false,
              sharedShortlistsEnabled: true,
              feedbackEnabled: true,
              validationPromptsEnabled: true,
              shortlistCollaborationEnabled: false
            },
            createdAt: "2026-03-24T12:00:00.000Z",
            updatedAt: "2026-03-24T12:00:00.000Z"
          }
        ]}
        selectedPartnerId="partner-1"
        summary={{
          summary: {
            activePilotPartners: 1,
            pilotLinkCounts: {
              total: 1,
              active: 1,
              revoked: 0,
              expired: 0
            },
            recentSharedSnapshotCount: 2,
            recentShortlistShareCount: 1,
            feedbackCount: 4,
            validationEventCount: 9,
            topErrorCategories: [{ category: "PROVIDER_ERROR", count: 2 }],
            providerDegradationCount: 1
          },
          errors: {
            VALIDATION_ERROR: { count: 0 },
            PROVIDER_ERROR: { count: 2 },
            DATABASE_ERROR: { count: 0 },
            CONFIG_ERROR: { count: 0 },
            INTERNAL_ERROR: { count: 0 }
          }
        }}
      />
    );

    expect(markup).toContain("Pilot operations");
    expect(markup).toContain("Acme Pilot");
    expect(markup).toContain("pilot-token-1");
    expect(markup).toContain("pilot link opened");
  });
});
