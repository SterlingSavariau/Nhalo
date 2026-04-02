import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DecisionExplainabilityPanel } from "./DecisionExplainabilityPanel";

describe("DecisionExplainabilityPanel", () => {
  it("renders a compact explainability affordance for workflow subjects", () => {
    const markup = renderToStaticMarkup(
      <DecisionExplainabilityPanel
        label="Why this state?"
        moduleName="financial_readiness"
        subjectId="financial-1"
        subjectType="financial_readiness"
      />
    );

    expect(markup).toContain("Why this state?");
  });
});
