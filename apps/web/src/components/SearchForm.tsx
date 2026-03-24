import { DEFAULT_PROPERTY_TYPES, DEFAULT_RADIUS_MILES, DEFAULT_WEIGHTS } from "@nhalo/config";
import type { PropertyType, SearchRequest } from "@nhalo/types";
import { FormEvent } from "react";
import { SEARCH_FORM_COPY } from "../content";

const PROPERTY_TYPE_OPTIONS: Array<{ label: string; value: PropertyType }> = [
  { label: "Single-family", value: "single_family" },
  { label: "Condo", value: "condo" },
  { label: "Townhome", value: "townhome" }
];

export const INITIAL_SEARCH_REQUEST: SearchRequest = {
  locationType: "city",
  locationValue: "Southfield, MI",
  radiusMiles: DEFAULT_RADIUS_MILES,
  budget: {
    max: 425000
  },
  minSqft: 1800,
  minBedrooms: 3,
  propertyTypes: DEFAULT_PROPERTY_TYPES,
  preferences: [],
  weights: DEFAULT_WEIGHTS
};

interface SearchFormProps {
  busy: boolean;
  value: SearchRequest;
  onChange(payload: SearchRequest): void;
  onSubmit(payload: SearchRequest): void;
  onResetWeights(): void;
}

export function SearchForm({ busy, value, onChange, onSubmit, onResetWeights }: SearchFormProps) {
  const formState = value;
  const locationCopy = SEARCH_FORM_COPY.locationValue[formState.locationType];

  function togglePropertyType(value: PropertyType) {
    const current = formState.propertyTypes ?? DEFAULT_PROPERTY_TYPES;
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];

    onChange({
      ...formState,
      propertyTypes: next
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(formState);
  }

  return (
    <form className="search-form" onSubmit={handleSubmit}>
      <div className="form-intro">
        <p className="section-label">Search Setup</p>
        <h2>Start with what your family needs most.</h2>
        <p className="muted">
          Enter an area, set hard family constraints, and adjust how much price, size, and safety should
          matter in the ranking.
        </p>
      </div>

      <div className="field-grid">
        <label>
          <span>Search area type</span>
          <select
            value={formState.locationType}
            onChange={(event) =>
              onChange({
                ...formState,
                locationType: event.target.value as SearchRequest["locationType"]
              })
            }
          >
            <option value="city">City</option>
            <option value="zip">ZIP</option>
            <option value="address">Address</option>
          </select>
          <small className="helper-copy">{SEARCH_FORM_COPY.locationType}</small>
        </label>
        <label>
          <span>{locationCopy.label}</span>
          <input
            placeholder={locationCopy.placeholder}
            value={formState.locationValue}
            onChange={(event) =>
              onChange({
                ...formState,
                locationValue: event.target.value
              })
            }
          />
          <small className="helper-copy">{locationCopy.helper}</small>
        </label>
        <label>
          <span>Radius (miles)</span>
          <input
            type="number"
            min="1"
            max="50"
            value={formState.radiusMiles ?? DEFAULT_RADIUS_MILES}
            onChange={(event) =>
              onChange({
                ...formState,
                radiusMiles: Number(event.target.value)
              })
            }
          />
          <small className="helper-copy">{SEARCH_FORM_COPY.radius}</small>
        </label>
        <label>
          <span>Maximum budget</span>
          <input
            type="number"
            min="50000"
            placeholder="425000"
            value={formState.budget?.max ?? ""}
            onChange={(event) =>
              onChange({
                ...formState,
                budget: {
                  ...formState.budget,
                  max: Number(event.target.value)
                }
              })
            }
          />
          <small className="helper-copy">{SEARCH_FORM_COPY.budget}</small>
        </label>
        <label>
          <span>Minimum Sqft</span>
          <input
            type="number"
            min="500"
            placeholder="1800"
            value={formState.minSqft ?? ""}
            onChange={(event) =>
              onChange({
                ...formState,
                minSqft: Number(event.target.value)
              })
            }
          />
          <small className="helper-copy">{SEARCH_FORM_COPY.sqft}</small>
        </label>
        <label>
          <span>Minimum Bedrooms</span>
          <input
            type="number"
            min="1"
            placeholder="3"
            value={formState.minBedrooms ?? ""}
            onChange={(event) =>
              onChange({
                ...formState,
                minBedrooms: Number(event.target.value)
              })
            }
          />
          <small className="helper-copy">{SEARCH_FORM_COPY.bedrooms}</small>
        </label>
      </div>

      <div className="weight-panel">
        <div>
          <p className="section-label">Property Types</p>
          <div className="chip-row">
            {PROPERTY_TYPE_OPTIONS.map((option) => {
              const active = (formState.propertyTypes ?? []).includes(option.value);

              return (
                <button
                  key={option.value}
                  className={active ? "chip active" : "chip"}
                  onClick={(event) => {
                    event.preventDefault();
                    togglePropertyType(option.value);
                  }}
                  type="button"
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="summary-header">
            <div>
              <p className="section-label">Ranking Weights</p>
              <p className="muted">Reset to family-first defaults at any time.</p>
            </div>
            <button className="ghost-button" onClick={onResetWeights} type="button">
              Reset defaults
            </button>
          </div>
          <div className="weight-grid">
            <label>
              <span>Price</span>
              <input
                type="number"
                min="0"
                max="100"
                value={formState.weights?.price ?? 0}
                onChange={(event) =>
                  onChange({
                    ...formState,
                    weights: {
                      ...formState.weights!,
                      price: Number(event.target.value)
                    }
                  })
                }
              />
              <small className="helper-copy">{SEARCH_FORM_COPY.weights.price}</small>
            </label>
            <label>
              <span>Size</span>
              <input
                type="number"
                min="0"
                max="100"
                value={formState.weights?.size ?? 0}
                onChange={(event) =>
                  onChange({
                    ...formState,
                    weights: {
                      ...formState.weights!,
                      size: Number(event.target.value)
                    }
                  })
                }
              />
              <small className="helper-copy">{SEARCH_FORM_COPY.weights.size}</small>
            </label>
            <label>
              <span>Safety</span>
              <input
                type="number"
                min="0"
                max="100"
                value={formState.weights?.safety ?? 0}
                onChange={(event) =>
                  onChange({
                    ...formState,
                    weights: {
                      ...formState.weights!,
                      safety: Number(event.target.value)
                    }
                  })
                }
              />
              <small className="helper-copy">{SEARCH_FORM_COPY.weights.safety}</small>
            </label>
          </div>
          <p className="weight-total">
            Total weight:{" "}
            {(formState.weights?.price ?? 0) +
              (formState.weights?.size ?? 0) +
              (formState.weights?.safety ?? 0)}
          </p>
        </div>
      </div>

      <button className="submit-button" disabled={busy} type="submit">
        {busy ? "Ranking homes..." : "Run Nhalo Search"}
      </button>
    </form>
  );
}
