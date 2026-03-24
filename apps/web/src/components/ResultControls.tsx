import type { PropertyType } from "@nhalo/types";
import type { ResultControlsState } from "../view-model";

interface ResultControlsProps {
  controls: ResultControlsState;
  onChange(next: ResultControlsState): void;
  resorted: boolean;
}

export function ResultControls({ controls, onChange, resorted }: ResultControlsProps) {
  return (
    <section className="controls-panel">
      <div>
        <p className="section-label">Result Controls</p>
        <h3>Inspect the current result set</h3>
        <p className="muted">
          Server ranking stays primary. These controls only re-sort or filter the homes already returned.
        </p>
      </div>

      <div className="field-grid">
        <label>
          <span>Sort</span>
          <select
            value={controls.sortMode}
            onChange={(event) =>
              onChange({
                ...controls,
                sortMode: event.target.value as ResultControlsState["sortMode"]
              })
            }
          >
            <option value="server">Server ranking</option>
            <option value="highest_nhalo">Highest Nhalo</option>
            <option value="lowest_price">Lowest price</option>
            <option value="highest_safety">Highest safety</option>
            <option value="largest_size">Largest size</option>
            <option value="closest_distance">Closest distance</option>
          </select>
        </label>

        <label>
          <span>Confidence</span>
          <select
            value={controls.confidence}
            onChange={(event) =>
              onChange({
                ...controls,
                confidence: event.target.value as ResultControlsState["confidence"]
              })
            }
          >
            <option value="all">All confidence</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="none">None</option>
          </select>
        </label>

        <label>
          <span>Property type</span>
          <select
            value={controls.propertyType}
            onChange={(event) =>
              onChange({
                ...controls,
                propertyType: event.target.value as "all" | PropertyType
              })
            }
          >
            <option value="all">All property types</option>
            <option value="single_family">Single-family</option>
            <option value="condo">Condo</option>
            <option value="townhome">Townhome</option>
          </select>
        </label>
      </div>

      {resorted ? (
        <p className="muted">Viewing a client-side inspection order. Server ranking is temporarily overridden.</p>
      ) : null}
    </section>
  );
}
