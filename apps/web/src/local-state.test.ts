import { describe, expect, it } from "vitest";
import {
  applyPreferencesToRequest,
  dismissWalkthrough,
  dismissOnboarding,
  getOrCreateSessionIdentity,
  isOnboardingDismissed,
  isWalkthroughDismissed,
  loadPilotContext,
  loadStakeholderNote,
  loadUiPreferences,
  markValidationPromptSeen,
  savePilotContext,
  saveStakeholderNote,
  saveUiPreferences,
  shouldShowValidationPrompt
} from "./local-state";
import { INITIAL_SEARCH_REQUEST } from "./components/SearchForm";

function createMemoryStorage() {
  const store = new Map<string, string>();

  return {
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    }
  };
}

describe("local-state", () => {
  it("creates a stable anonymous session identity in local storage", () => {
    const storage = createMemoryStorage();
    const first = getOrCreateSessionIdentity(storage);
    const second = getOrCreateSessionIdentity(storage);

    expect(first.sessionId).toBeTruthy();
    expect(second.sessionId).toBe(first.sessionId);
  });

  it("handles corrupted local preferences safely", () => {
    const storage = createMemoryStorage();
    storage.setItem("nhalo.ui.preferences", "{bad json");

    const preferences = loadUiPreferences(storage);

    expect(preferences.preferredSortMode).toBe("server");
    expect(preferences.lastPropertyTypes.length).toBeGreaterThan(0);
  });

  it("applies stored weight and property preferences without mutating the base request", () => {
    const storage = createMemoryStorage();
    saveUiPreferences(storage, {
      preferredSortMode: "highest_safety",
      lastWeights: {
        price: 20,
        size: 20,
        safety: 60
      },
      lastPropertyTypes: ["condo"],
      comparisonIds: ["a", "b"]
    });

    const request = applyPreferencesToRequest(INITIAL_SEARCH_REQUEST, loadUiPreferences(storage));

    expect(request.weights).toEqual({
      price: 20,
      size: 20,
      safety: 60
    });
    expect(request.propertyTypes).toEqual(["condo"]);
    expect(INITIAL_SEARCH_REQUEST.propertyTypes).not.toEqual(["condo"]);
  });

  it("persists onboarding dismissal safely in local storage", () => {
    const storage = createMemoryStorage();

    expect(isOnboardingDismissed(storage)).toBe(false);

    dismissOnboarding(storage);

    expect(isOnboardingDismissed(storage)).toBe(true);
  });

  it("rate-limits validation prompts safely in local storage", () => {
    const storage = createMemoryStorage();

    expect(shouldShowValidationPrompt(storage, "results", 12)).toBe(true);

    markValidationPromptSeen(storage, "results");

    expect(shouldShowValidationPrompt(storage, "results", 12)).toBe(false);
    expect(shouldShowValidationPrompt(storage, "comparison", 12)).toBe(true);
  });

  it("stores stakeholder notes locally without affecting shared state", () => {
    const storage = createMemoryStorage();

    expect(loadStakeholderNote(storage, "demo:southfield")).toBe("");

    saveStakeholderNote(storage, "demo:southfield", "Lead with the family-safe shortlist.");

    expect(loadStakeholderNote(storage, "demo:southfield")).toBe(
      "Lead with the family-safe shortlist."
    );
    expect(loadStakeholderNote(storage, "snapshot:abc")).toBe("");
  });

  it("persists walkthrough dismissal safely in local storage", () => {
    const storage = createMemoryStorage();

    expect(isWalkthroughDismissed(storage, "southfield-family-balance")).toBe(false);

    dismissWalkthrough(storage, "southfield-family-balance");

    expect(isWalkthroughDismissed(storage, "southfield-family-balance")).toBe(true);
  });

  it("stores pilot context locally without changing the base session id", () => {
    const storage = createMemoryStorage();
    const session = getOrCreateSessionIdentity(storage);

    savePilotContext(storage, {
      partnerId: "partner-1",
      partnerSlug: "acme-pilot",
      partnerName: "Acme Pilot",
      status: "active",
      pilotLinkId: "pilot-link-1",
      pilotToken: "pilot-token-1",
      allowedFeatures: {
        demoModeEnabled: true,
        sharedSnapshotsEnabled: false,
        sharedShortlistsEnabled: true,
        feedbackEnabled: true,
        validationPromptsEnabled: true,
        shortlistCollaborationEnabled: false
      }
    });

    const context = loadPilotContext(storage);
    const nextSession = getOrCreateSessionIdentity(storage);

    expect(context?.partnerSlug).toBe("acme-pilot");
    expect(context?.pilotToken).toBe("pilot-token-1");
    expect(nextSession.sessionId).toBe(session.sessionId);
  });

  it("ignores corrupted pilot context safely", () => {
    const storage = createMemoryStorage();
    storage.setItem("nhalo.ui.pilot.context", JSON.stringify({ partnerId: "partner-1" }));

    expect(loadPilotContext(storage)).toBeNull();
  });
});
