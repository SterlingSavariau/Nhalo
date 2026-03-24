import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WalkthroughPanel } from "./WalkthroughPanel";

describe("WalkthroughPanel", () => {
  it("renders deterministic walkthrough steps and a dismiss control", () => {
    const markup = renderToStaticMarkup(
      <WalkthroughPanel
        onDismiss={vi.fn()}
        steps={[
          {
            title: "What was searched",
            body: "Review the family filters first."
          },
          {
            title: "Why the top home ranked highest",
            body: "Use the stored summary to explain the result."
          }
        ]}
      />
    );

    expect(markup).toContain("Use this sequence during a live demo");
    expect(markup).toContain("Dismiss");
    expect(markup).toContain("Why the top home ranked highest");
  });
});
