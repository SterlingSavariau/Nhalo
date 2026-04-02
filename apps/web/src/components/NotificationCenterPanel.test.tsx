import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { NotificationCenterPanel } from "./NotificationCenterPanel";

describe("NotificationCenterPanel", () => {
  it("renders active alerts, severity buckets, and history", () => {
    const markup = renderToStaticMarkup(
      <NotificationCenterPanel
        history={[
          {
            id: "history-1",
            notificationId: "notification-1",
            eventType: "CREATED",
            previousValue: null,
            nextValue: "UNREAD",
            createdAt: "2026-04-01T20:00:00.000Z"
          }
        ]}
        notifications={[
          {
            id: "notification-1",
            workflowId: "offer-submission-1",
            sessionId: "session-1",
            propertyId: "canonical-1",
            propertyAddressLabel: "123 Main St, Royal Oak, MI",
            shortlistId: "shortlist-1",
            moduleName: "offer_submission",
            alertCategory: "DEADLINE_ALERT",
            severity: "WARNING",
            status: "UNREAD",
            triggeringRuleLabel: "offer_submission_expiration_72h",
            relatedSubjectType: "offer_submission",
            relatedSubjectId: "offer-submission-1",
            title: "Offer expiration is approaching",
            message: "Your submitted offer expires within the next 72 hours.",
            actionLabel: "Review offer expiration",
            actionTarget: {
              type: "module",
              moduleName: "offer_submission",
              subjectType: "offer_submission",
              subjectId: "offer-submission-1"
            },
            dueAt: "2026-04-03T21:00:00.000Z",
            readAt: null,
            dismissedAt: null,
            resolvedAt: null,
            explanationSubjectType: "offer_submission",
            explanationSubjectId: "offer-submission-1",
            createdAt: "2026-04-01T20:00:00.000Z",
            updatedAt: "2026-04-01T20:00:00.000Z"
          }
        ]}
        onDismiss={vi.fn()}
        onMarkRead={vi.fn()}
      />
    );

    expect(markup).toContain("Active transaction alerts");
    expect(markup).toContain("Offer expiration is approaching");
    expect(markup).toContain("Warnings");
    expect(markup).toContain("History");
  });
});
