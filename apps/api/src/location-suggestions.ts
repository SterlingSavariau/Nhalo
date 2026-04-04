import { City, State } from "country-state-city-js";

export interface LocationSuggestion {
  id: string;
  label: string;
  detail: string;
  locationType: "city";
  locationValue: string;
  stateCode: string;
  normalizedQuery: string;
}

type RawState = {
  name?: string;
  code?: string;
  isoCode?: string;
  iso?: string;
  state_code?: string;
};

type RawCity = {
  name?: string;
};

function stateCodeFor(state: RawState): string | null {
  const code = state.code ?? state.isoCode ?? state.iso ?? state.state_code;
  return typeof code === "string" && code.trim().length > 0 ? code.trim() : null;
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function buildUsCitySuggestions(): LocationSuggestion[] {
  const rawStates = (State("US") ?? []) as RawState[];

  return rawStates.flatMap((state) => {
    const stateCode = stateCodeFor(state);
    const stateName = typeof state.name === "string" ? state.name.trim() : "";

    if (!stateCode || !stateName) {
      return [];
    }

    const rawCities = (City("US", stateCode) ?? []) as RawCity[];
    return rawCities
      .map((city) => {
        const cityName = typeof city.name === "string" ? city.name.trim() : "";
        if (!cityName) {
          return null;
        }

        const label = `${cityName}, ${stateCode}`;
        return {
          id: `city:${normalizeQuery(label)}`,
          label,
          detail: stateName,
          locationType: "city" as const,
          locationValue: label,
          stateCode,
          normalizedQuery: normalizeQuery(`${cityName} ${stateName} ${stateCode}`)
        };
      })
      .filter((entry): entry is LocationSuggestion => Boolean(entry));
  });
}

const US_CITY_SUGGESTIONS = buildUsCitySuggestions();

export function suggestUsLocations(query: string, limit = 8): LocationSuggestion[] {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return [];
  }

  const startsWithMatches: LocationSuggestion[] = [];
  const includesMatches: LocationSuggestion[] = [];

  for (const suggestion of US_CITY_SUGGESTIONS) {
    if (suggestion.normalizedQuery.startsWith(normalized)) {
      startsWithMatches.push(suggestion);
      continue;
    }

    if (suggestion.normalizedQuery.includes(normalized)) {
      includesMatches.push(suggestion);
    }
  }

  return [...startsWithMatches, ...includesMatches].slice(0, limit);
}
