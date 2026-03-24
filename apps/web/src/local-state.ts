import { DEFAULT_PROPERTY_TYPES, DEFAULT_WEIGHTS } from "@nhalo/config";
import type {
  PropertyType,
  SearchRequest,
  SearchWeights,
  SessionIdentity
} from "@nhalo/types";
import type { ResultControlsState } from "./view-model";

const SESSION_KEY = "nhalo.session.identity";
const PREFERENCES_KEY = "nhalo.ui.preferences";

export interface UiPreferences {
  preferredSortMode: ResultControlsState["sortMode"];
  lastWeights: SearchWeights;
  lastPropertyTypes: PropertyType[];
  comparisonIds: string[];
}

const DEFAULT_PREFERENCES: UiPreferences = {
  preferredSortMode: "server",
  lastWeights: DEFAULT_WEIGHTS,
  lastPropertyTypes: DEFAULT_PROPERTY_TYPES,
  comparisonIds: []
};

function safeParse<T>(value: string | null): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function generateSessionId(): string {
  return `nhalo_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function getOrCreateSessionIdentity(storage: Pick<Storage, "getItem" | "setItem"> | null): SessionIdentity {
  if (!storage) {
    return {
      sessionId: null,
      source: "none"
    };
  }

  const existing = safeParse<{ sessionId?: string }>(storage.getItem(SESSION_KEY));
  if (existing?.sessionId) {
    return {
      sessionId: existing.sessionId,
      source: "local_storage"
    };
  }

  const sessionId = generateSessionId();
  storage.setItem(SESSION_KEY, JSON.stringify({ sessionId }));

  return {
    sessionId,
    source: "local_storage"
  };
}

export function loadUiPreferences(storage: Pick<Storage, "getItem"> | null): UiPreferences {
  if (!storage) {
    return DEFAULT_PREFERENCES;
  }

  const stored = safeParse<Partial<UiPreferences>>(storage.getItem(PREFERENCES_KEY));
  if (!stored) {
    return DEFAULT_PREFERENCES;
  }

  return {
    preferredSortMode: stored.preferredSortMode ?? DEFAULT_PREFERENCES.preferredSortMode,
    lastWeights: stored.lastWeights ?? DEFAULT_PREFERENCES.lastWeights,
    lastPropertyTypes: stored.lastPropertyTypes ?? DEFAULT_PREFERENCES.lastPropertyTypes,
    comparisonIds: stored.comparisonIds ?? DEFAULT_PREFERENCES.comparisonIds
  };
}

export function saveUiPreferences(
  storage: Pick<Storage, "setItem"> | null,
  preferences: UiPreferences
): void {
  if (!storage) {
    return;
  }

  storage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
}

export function applyPreferencesToRequest(
  request: SearchRequest,
  preferences: UiPreferences
): SearchRequest {
  return {
    ...request,
    propertyTypes: preferences.lastPropertyTypes,
    weights: preferences.lastWeights
  };
}
