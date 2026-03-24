import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DemoScenarioPanel } from "./DemoScenarioPanel";

describe("DemoScenarioPanel", () => {
  it("renders branded demo descriptions and why-this-matters text", () => {
    const markup = renderToStaticMarkup(
      <DemoScenarioPanel
        onLoadScenario={vi.fn()}
        scenarios={[
          {
            id: "southfield-family-balance",
            label: "Best family-fit homes in Southfield under $425k",
            description: "Balanced affordability, family space, and safety.",
            whyThisMatters: "Shows the core family-first shortlist.",
            request: {
              locationType: "city",
              locationValue: "Southfield, MI",
              radiusMiles: 5,
              budget: { max: 425000 },
              minSqft: 1800,
              minBedrooms: 3,
              propertyTypes: ["single_family", "condo", "townhome"],
              preferences: [],
              weights: { price: 40, size: 30, safety: 30 }
            }
          }
        ]}
      />
    );

    expect(markup).toContain("Branded demo mode");
    expect(markup).toContain("Why this matters");
  });
});
