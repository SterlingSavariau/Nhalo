import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UnifiedActivityFeedPanel } from "./UnifiedActivityFeedPanel";

describe("UnifiedActivityFeedPanel", () => {
  it("renders unified workflow activity entries", () => {
    const markup = renderToStaticMarkup(
      <UnifiedActivityFeedPanel
        activity={[
          {
            id: "activity-1",
            workflowId: null,
            sessionId: "session-1",
            propertyId: "property-1",
            propertyAddressLabel: "123 Main St",
            shortlistId: "shortlist-1",
            moduleName: "offer_submission",
            eventCategory: "STATE_CHANGED",
            subjectType: "offer_submission",
            subjectId: "submission-1",
            title: "Offer submitted",
            summary: "The offer was recorded as submitted.",
            oldValueSnapshot: { submissionState: "READY_TO_SUBMIT" },
            newValueSnapshot: { submissionState: "SUBMITTED" },
            triggerType: "STATUS_TRANSITION",
            triggerLabel: "offer_submission_submitted",
            actorType: "USER",
            actorId: null,
            relatedNotificationId: null,
            relatedExplanationId: null,
            createdAt: "2026-04-01T15:00:00.000Z"
          }
        ]}
      />
    );

    expect(markup).toContain("Activity and audit log");
    expect(markup).toContain("Offer submitted");
    expect(markup).toContain("offer submission · state changed");
  });
});
