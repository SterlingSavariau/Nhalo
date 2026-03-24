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
const ONBOARDING_KEY = "nhalo.ui.onboarding.dismissed";
const VALIDATION_PROMPT_KEY = "nhalo.ui.validation.prompts";
const STAKEHOLDER_NOTES_KEY = "nhalo.ui.stakeholder.notes";
const WALKTHROUGH_DISMISS_KEY = "nhalo.ui.walkthrough.dismissed";

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

export function isOnboardingDismissed(storage: Pick<Storage, "getItem"> | null): boolean {
  if (!storage) {
    return false;
  }

  return storage.getItem(ONBOARDING_KEY) === "true";
}

export function dismissOnboarding(storage: Pick<Storage, "setItem"> | null): void {
  if (!storage) {
    return;
  }

  storage.setItem(ONBOARDING_KEY, "true");
}

type ValidationPromptState = Record<string, string>;
type StakeholderNotesState = Record<string, string>;
type WalkthroughDismissState = Record<string, string>;

export function shouldShowValidationPrompt(
  storage: Pick<Storage, "getItem"> | null,
  promptKey: string,
  cooldownHours = 12
): boolean {
  if (!storage) {
    return true;
  }

  const stored = safeParse<ValidationPromptState>(storage.getItem(VALIDATION_PROMPT_KEY)) ?? {};
  const timestamp = stored[promptKey];
  if (!timestamp) {
    return true;
  }

  const elapsedMs = Date.now() - new Date(timestamp).getTime();
  return elapsedMs >= cooldownHours * 60 * 60 * 1000;
}

export function markValidationPromptSeen(
  storage: Pick<Storage, "getItem" | "setItem"> | null,
  promptKey: string
): void {
  if (!storage) {
    return;
  }

  const stored = safeParse<ValidationPromptState>(storage.getItem(VALIDATION_PROMPT_KEY)) ?? {};
  stored[promptKey] = new Date().toISOString();
  storage.setItem(VALIDATION_PROMPT_KEY, JSON.stringify(stored));
}

export function loadStakeholderNote(
  storage: Pick<Storage, "getItem"> | null,
  noteKey: string
): string {
  if (!storage) {
    return "";
  }

  const stored = safeParse<StakeholderNotesState>(storage.getItem(STAKEHOLDER_NOTES_KEY)) ?? {};
  return stored[noteKey] ?? "";
}

export function saveStakeholderNote(
  storage: Pick<Storage, "getItem" | "setItem"> | null,
  noteKey: string,
  note: string
): void {
  if (!storage) {
    return;
  }

  const stored = safeParse<StakeholderNotesState>(storage.getItem(STAKEHOLDER_NOTES_KEY)) ?? {};
  stored[noteKey] = note;
  storage.setItem(STAKEHOLDER_NOTES_KEY, JSON.stringify(stored));
}

export function isWalkthroughDismissed(
  storage: Pick<Storage, "getItem"> | null,
  walkthroughKey: string
): boolean {
  if (!storage) {
    return false;
  }

  const stored = safeParse<WalkthroughDismissState>(storage.getItem(WALKTHROUGH_DISMISS_KEY)) ?? {};
  return Boolean(stored[walkthroughKey]);
}

export function dismissWalkthrough(
  storage: Pick<Storage, "getItem" | "setItem"> | null,
  walkthroughKey: string
): void {
  if (!storage) {
    return;
  }

  const stored = safeParse<WalkthroughDismissState>(storage.getItem(WALKTHROUGH_DISMISS_KEY)) ?? {};
  stored[walkthroughKey] = new Date().toISOString();
  storage.setItem(WALKTHROUGH_DISMISS_KEY, JSON.stringify(stored));
}
