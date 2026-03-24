import type { DemoScenario } from "@nhalo/types";
import { RESULT_COPY } from "../content";

interface DemoScenarioPanelProps {
  scenarios: DemoScenario[];
  onLoadScenario(scenario: DemoScenario): void;
}

export function DemoScenarioPanel({ scenarios, onLoadScenario }: DemoScenarioPanelProps) {
  if (scenarios.length === 0) {
    return null;
  }

  return (
    <section className="demo-panel">
      <div className="summary-header">
        <div>
          <p className="section-label">{RESULT_COPY.demoScenarioTitle}</p>
          <h3>Branded demo mode</h3>
          <p className="muted">
            Use these preset scenarios for stakeholder walkthroughs and pilot conversations.
          </p>
        </div>
      </div>

      <div className="activity-list">
        {scenarios.map((scenario) => (
          <article className="activity-card" key={scenario.id}>
            <div>
              <strong>{scenario.label}</strong>
              <p className="muted">{scenario.description}</p>
              {scenario.whyThisMatters ? (
                <p className="muted">Why this matters: {scenario.whyThisMatters}</p>
              ) : null}
            </div>
            <div className="activity-actions">
              <button className="chip" onClick={() => onLoadScenario(scenario)} type="button">
                Load scenario
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
