import type {
  ScoreAuditRecord,
  SearchDefinition,
  SearchRestorePayload,
  SearchHistoryRecord,
  SearchRequest,
  SearchResponse,
  SearchSnapshotRecord,
  SessionIdentity
} from "@nhalo/types";
import { DEFAULT_WEIGHTS } from "@nhalo/config";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createSearchDefinition,
  createSearchSnapshot,
  deleteSearchDefinition,
  fetchRecentSnapshots,
  fetchScoreAudit,
  fetchSearchDefinitions,
  fetchSearchHistory,
  fetchSearchSnapshot,
  rerunSearchDefinition,
  rerunSearchHistory,
  searchHomes,
  trackUiMetric,
  updateSearchDefinition
} from "./api";
import { AuditDrawer } from "./components/AuditDrawer";
import { ComparisonTray } from "./components/ComparisonTray";
import { EmptyStatePanel } from "./components/EmptyStatePanel";
import { HomeDetailPanel } from "./components/HomeDetailPanel";
import { OnboardingModal } from "./components/OnboardingModal";
import { RecentActivityPanel } from "./components/RecentActivityPanel";
import { ResultCard } from "./components/ResultCard";
import { ResultControls } from "./components/ResultControls";
import { INITIAL_SEARCH_REQUEST, SearchForm } from "./components/SearchForm";
import { SearchSummaryPanel } from "./components/SearchSummaryPanel";
import {
  applyPreferencesToRequest,
  dismissOnboarding,
  getOrCreateSessionIdentity,
  isOnboardingDismissed,
  loadUiPreferences,
  saveUiPreferences
} from "./local-state";
import {
  applyResultControls,
  DEFAULT_RESULT_CONTROLS,
  toggleComparisonSelection,
  type ResultControlsState
} from "./view-model";

export default function App() {
  const localStorageRef =
    typeof window !== "undefined" ? window.localStorage : null;
  const initialPreferences = loadUiPreferences(localStorageRef);
  const [sessionIdentity, setSessionIdentity] = useState<SessionIdentity>({
    sessionId: null,
    source: "none"
  });
  const [formState, setFormState] = useState<SearchRequest>(() =>
    applyPreferencesToRequest(INITIAL_SEARCH_REQUEST, initialPreferences)
  );
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [lastRequest, setLastRequest] = useState<SearchRequest | null>(null);
  const [currentHistoryRecordId, setCurrentHistoryRecordId] = useState<string | null>(null);
  const [currentSearchDefinitionId, setCurrentSearchDefinitionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [controls, setControls] = useState<ResultControlsState>({
    ...DEFAULT_RESULT_CONTROLS,
    sortMode: initialPreferences.preferredSortMode
  });
  const [comparisonIds, setComparisonIds] = useState<string[]>(initialPreferences.comparisonIds);
  const [audit, setAudit] = useState<ScoreAuditRecord | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SearchSnapshotRecord | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedHomeId, setSelectedHomeId] = useState<string | null>(null);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [definitions, setDefinitions] = useState<SearchDefinition[]>([]);
  const [history, setHistory] = useState<SearchHistoryRecord[]>([]);
  const [snapshots, setSnapshots] = useState<SearchSnapshotRecord[]>([]);
  const [saveLabel, setSaveLabel] = useState("Family shortlist");
  const [savingDefinition, setSavingDefinition] = useState(false);
  const comparedRef = useRef(0);
  const renderedSnapshotRef = useRef<string | null>(null);
  const activityTrackedRef = useRef(false);
  const onboardingTrackedRef = useRef(false);
  const emptyStateTrackedRef = useRef<string | null>(null);

  async function refreshRecentActivity(sessionId = sessionIdentity.sessionId) {
    if (!sessionId) {
      setDefinitions([]);
      setHistory([]);
      setSnapshots([]);
      return;
    }

    const [nextDefinitions, nextHistory, nextSnapshots] = await Promise.all([
      fetchSearchDefinitions(sessionId),
      fetchSearchHistory(sessionId, 8),
      fetchRecentSnapshots(sessionId, 8)
    ]);

    setDefinitions(nextDefinitions);
    setHistory(nextHistory);
    setSnapshots(nextSnapshots);

    if (!activityTrackedRef.current) {
      activityTrackedRef.current = true;
      void trackUiMetric("recent_activity_panel_view");
    }
  }

  function applyResultSet(
    response: SearchResponse,
    request: SearchRequest,
    options?: {
      snapshot?: SearchSnapshotRecord | null;
      historyRecordId?: string | null;
      searchDefinitionId?: string | null;
    }
  ) {
    setResults(response);
    setLastRequest(request);
    setFormState(request);
    setSnapshot(options?.snapshot ?? null);
    setCurrentHistoryRecordId(
      options?.historyRecordId ?? response.metadata.historyRecordId ?? null
    );
    setCurrentSearchDefinitionId(
      options?.searchDefinitionId ??
        (response.metadata.rerunResultMetadata?.sourceType === "definition"
          ? response.metadata.rerunResultMetadata.sourceId
          : null)
    );
    setSelectedHomeId(null);
  }

  useEffect(() => {
    const identity = getOrCreateSessionIdentity(localStorageRef);
    setSessionIdentity(identity);
    setShowOnboarding(!isOnboardingDismissed(localStorageRef));
    void refreshRecentActivity(identity.sessionId);
  }, []);

  useEffect(() => {
    saveUiPreferences(localStorageRef, {
      preferredSortMode: controls.sortMode,
      lastWeights: formState.weights ?? INITIAL_SEARCH_REQUEST.weights!,
      lastPropertyTypes: formState.propertyTypes ?? INITIAL_SEARCH_REQUEST.propertyTypes!,
      comparisonIds
    });
  }, [comparisonIds, controls.sortMode, formState.propertyTypes, formState.weights, localStorageRef]);

  useEffect(() => {
    async function loadSnapshotFromUrl() {
      const snapshotId = new URLSearchParams(window.location.search).get("snapshot");

      if (!snapshotId) {
        return;
      }

      setBusy(true);
      setError(null);

      try {
        const loadedSnapshot = await fetchSearchSnapshot(snapshotId);
        applyResultSet(loadedSnapshot.response, loadedSnapshot.request, {
          snapshot: loadedSnapshot,
          historyRecordId: loadedSnapshot.historyRecordId ?? null,
          searchDefinitionId: loadedSnapshot.searchDefinitionId ?? null
        });
        void trackUiMetric("snapshot_reopen");
      } catch (snapshotError) {
        setError(snapshotError instanceof Error ? snapshotError.message : "Unable to load snapshot");
      } finally {
        setBusy(false);
      }
    }

    void loadSnapshotFromUrl();
  }, []);

  useEffect(() => {
    if (!results) {
      return;
    }

    const snapshotKey = `${results.metadata.returnedCount}:${results.metadata.durationMs}:${results.homes[0]?.id ?? "none"}`;
    if (renderedSnapshotRef.current === snapshotKey) {
      return;
    }
    renderedSnapshotRef.current = snapshotKey;
    void trackUiMetric("explainability_render");
  }, [results]);

  useEffect(() => {
    if (showOnboarding && !onboardingTrackedRef.current) {
      onboardingTrackedRef.current = true;
      void trackUiMetric("onboarding_view");
    }
  }, [showOnboarding]);

  useEffect(() => {
    if (comparisonIds.length > 0 && comparedRef.current === 0) {
      void trackUiMetric("comparison_view");
    }
    comparedRef.current = comparisonIds.length;
  }, [comparisonIds]);

  useEffect(() => {
    if (!results || results.metadata.returnedCount >= 5) {
      emptyStateTrackedRef.current = null;
      return;
    }

    const key = `${results.metadata.returnedCount}:${results.metadata.totalMatched}:${results.metadata.durationMs}`;
    if (emptyStateTrackedRef.current === key) {
      return;
    }

    emptyStateTrackedRef.current = key;
    void trackUiMetric("empty_state_view");
  }, [results]);

  const visibleHomes = useMemo(
    () => (results ? applyResultControls(results.homes, controls) : []),
    [results, controls]
  );

  const selectedHome = useMemo(() => {
    if (!results || !selectedHomeId) {
      return null;
    }

    return results.homes.find((home) => home.id === selectedHomeId) ?? null;
  }, [results, selectedHomeId]);

  const comparedHomes = useMemo(() => {
    if (!results) {
      return [];
    }

    return comparisonIds
      .map((homeId) => results.homes.find((home) => home.id === homeId))
      .filter((home): home is NonNullable<typeof home> => Boolean(home));
  }, [comparisonIds, results]);

  async function handleSubmit(payload: SearchRequest) {
    setBusy(true);
    setError(null);
    setComparisonIds([]);
    setControls((previous) => ({ ...previous, confidence: "all", propertyType: "all" }));

    try {
      const response = await searchHomes(payload, sessionIdentity.sessionId);
      applyResultSet(response, payload, {
        historyRecordId: response.metadata.historyRecordId ?? null
      });
      window.history.replaceState({}, "", window.location.pathname);
      await refreshRecentActivity();
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Unable to complete search");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveSnapshot() {
    if (!results || !lastRequest) {
      return;
    }

    setSavingSnapshot(true);

    try {
      const created = await createSearchSnapshot({
        request: lastRequest,
        response: results,
        sessionId: sessionIdentity.sessionId,
        searchDefinitionId: currentSearchDefinitionId,
        historyRecordId: currentHistoryRecordId
      });
      setSnapshot(created);
      window.history.replaceState({}, "", `/?snapshot=${created.id}`);
      await refreshRecentActivity();
    } catch (snapshotError) {
      setError(snapshotError instanceof Error ? snapshotError.message : "Unable to save snapshot");
    } finally {
      setSavingSnapshot(false);
    }
  }

  async function handleViewAudit(propertyId: string) {
    setAuditLoading(true);
    setAuditError(null);

    try {
      const response = await fetchScoreAudit(propertyId);
      setAudit(response);
    } catch (viewError) {
      setAudit(null);
      setAuditError(viewError instanceof Error ? viewError.message : "Unable to load audit");
    } finally {
      setAuditLoading(false);
    }
  }

  async function handleSaveDefinition() {
    setSavingDefinition(true);
    setError(null);

    try {
      await createSearchDefinition({
        sessionId: sessionIdentity.sessionId,
        label: saveLabel.trim(),
        request: formState
      });
      await refreshRecentActivity();
      setSaveLabel(`${formState.locationValue} follow-up`);
    } catch (definitionError) {
      setError(
        definitionError instanceof Error ? definitionError.message : "Unable to save search definition"
      );
    } finally {
      setSavingDefinition(false);
    }
  }

  async function handleOpenSnapshot(snapshotId: string) {
    setBusy(true);
    setError(null);

    try {
      const loadedSnapshot = await fetchSearchSnapshot(snapshotId);
      applyResultSet(loadedSnapshot.response, loadedSnapshot.request, {
        snapshot: loadedSnapshot,
        historyRecordId: loadedSnapshot.historyRecordId ?? null,
        searchDefinitionId: loadedSnapshot.searchDefinitionId ?? null
      });
      void trackUiMetric("snapshot_reopen");
      window.history.replaceState({}, "", `/?snapshot=${snapshotId}`);
    } catch (snapshotError) {
      setError(snapshotError instanceof Error ? snapshotError.message : "Unable to open snapshot");
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore(payload: SearchRestorePayload) {
    setFormState(payload.request);
    await trackUiMetric("search_restore");
    if (payload.sourceType === "definition") {
      await trackUiMetric("saved_search_restore");
    }
  }

  async function handleRerunDefinition(definitionId: string) {
    setBusy(true);
    setError(null);

    try {
      const response = await rerunSearchDefinition(definitionId, sessionIdentity.sessionId);
      const definition = definitions.find((entry) => entry.id === definitionId);
      applyResultSet(response, definition?.request ?? formState, {
        historyRecordId: response.metadata.historyRecordId ?? null,
        searchDefinitionId: definitionId
      });
      window.history.replaceState({}, "", window.location.pathname);
      await refreshRecentActivity();
    } catch (rerunError) {
      setError(rerunError instanceof Error ? rerunError.message : "Unable to rerun saved search");
    } finally {
      setBusy(false);
    }
  }

  async function handleRerunHistory(historyId: string) {
    setBusy(true);
    setError(null);

    try {
      const response = await rerunSearchHistory(historyId, sessionIdentity.sessionId);
      const record = history.find((entry) => entry.id === historyId);
      applyResultSet(response, record?.request ?? formState, {
        historyRecordId: response.metadata.historyRecordId ?? null,
        searchDefinitionId: response.metadata.rerunResultMetadata?.sourceType === "definition"
          ? response.metadata.rerunResultMetadata.sourceId
          : record?.searchDefinitionId ?? null
      });
      window.history.replaceState({}, "", window.location.pathname);
      await refreshRecentActivity();
    } catch (rerunError) {
      setError(rerunError instanceof Error ? rerunError.message : "Unable to rerun search history");
    } finally {
      setBusy(false);
    }
  }

  async function handleTogglePinned(definition: SearchDefinition) {
    try {
      await updateSearchDefinition(definition.id, {
        pinned: !definition.pinned
      });
      await refreshRecentActivity();
    } catch (definitionError) {
      setError(
        definitionError instanceof Error ? definitionError.message : "Unable to update saved search"
      );
    }
  }

  async function handleDeleteDefinition(definitionId: string) {
    try {
      await deleteSearchDefinition(definitionId);
      await refreshRecentActivity();
    } catch (definitionError) {
      setError(
        definitionError instanceof Error ? definitionError.message : "Unable to delete saved search"
      );
    }
  }

  const resorted =
    controls.sortMode !== "server" ||
    controls.confidence !== "all" ||
    controls.propertyType !== "all";

  async function handleDismissOnboarding() {
    dismissOnboarding(localStorageRef);
    setShowOnboarding(false);
    await trackUiMetric("onboarding_dismiss");
  }

  async function handleApplySuggestion(patch: Partial<SearchRequest>) {
    setFormState((current) => ({
      ...current,
      ...patch,
      budget: patch.budget ? { ...current.budget, ...patch.budget } : current.budget,
      weights: patch.weights ? { ...current.weights, ...patch.weights } : current.weights
    }));
    await trackUiMetric("suggestion_click");
  }

  async function handleOpenDetails(homeId: string) {
    setSelectedHomeId(homeId);
    await trackUiMetric("detail_panel_open");
  }

  async function handleToggleCompare(homeId: string) {
    setComparisonIds((current) => {
      const next = toggleComparisonSelection(current, homeId);
      if (!current.includes(homeId) && next.includes(homeId)) {
        void trackUiMetric("result_compare_add");
      }
      return next;
    });
  }

  return (
    <main className="page-shell">
      <OnboardingModal onDismiss={handleDismissOnboarding} open={showOnboarding} />

      <section className="hero-panel">
        <p className="eyebrow">Nhalo Home Decision Engine</p>
        <h1>Find homes your family can afford, live in, and feel safe in.</h1>
        <p className="hero-copy">
          Nhalo ranks homes with deterministic price, size, and safety signals. Use this console to
          run a search, compare tradeoffs, and revisit saved work without losing the reasoning behind
          each result.
        </p>
      </section>

      <section className="content-grid">
        <div className="sidebar-stack">
          <div className="panel">
            <SearchForm
              busy={busy}
              onChange={setFormState}
              onResetWeights={() =>
                setFormState((current) => ({
                  ...current,
                  weights: DEFAULT_WEIGHTS
                }))
              }
              onSubmit={handleSubmit}
              value={formState}
            />
          </div>

          <div className="panel">
            <RecentActivityPanel
              currentRequest={formState}
              definitions={definitions}
              history={history}
              onDeleteDefinition={handleDeleteDefinition}
              onOpenSnapshot={handleOpenSnapshot}
              onRestore={handleRestore}
              onRerunDefinition={handleRerunDefinition}
              onRerunHistory={handleRerunHistory}
              onSaveDefinition={handleSaveDefinition}
              onSaveLabelChange={setSaveLabel}
              onTogglePinned={handleTogglePinned}
              saveLabel={saveLabel}
              savingDefinition={savingDefinition}
              snapshots={snapshots}
            />
          </div>
        </div>

        <div className="panel results-panel">
          {error ? <div className="error-banner">{error}</div> : null}

          {results ? (
            <div className="decision-console">
              <SearchSummaryPanel
                onSaveSnapshot={handleSaveSnapshot}
                results={results}
                savingSnapshot={savingSnapshot}
                snapshot={snapshot}
              />

              <EmptyStatePanel results={results} onApplySuggestion={handleApplySuggestion} />

              <ResultControls controls={controls} onChange={setControls} resorted={resorted} />

              <ComparisonTray
                homes={comparedHomes}
                onRemove={(homeId) => setComparisonIds((current) => current.filter((id) => id !== homeId))}
              />

              <div className="results-stack">
                {visibleHomes.map((home, index) => (
                  <ResultCard
                    key={home.id}
                    compared={comparisonIds.includes(home.id)}
                    compareDisabled={comparisonIds.length >= 3}
                    home={home}
                    homes={results.homes}
                    onOpenDetails={handleOpenDetails}
                    onToggleCompare={handleToggleCompare}
                    onViewAudit={handleViewAudit}
                    rank={index + 1}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p className="section-label">No search yet</p>
              <h2>Start with Southfield, MI</h2>
              <p className="muted">
                Save the search definition, rerun it later, or reopen an immutable snapshot without
                changing the ranking engine.
              </p>
            </div>
          )}
        </div>
      </section>

      <AuditDrawer
        audit={audit}
        error={auditError}
        loading={auditLoading}
        onClose={() => {
          setAudit(null);
          setAuditError(null);
        }}
      />

      <HomeDetailPanel
        allHomes={results?.homes ?? []}
        home={selectedHome}
        onClose={() => setSelectedHomeId(null)}
        onViewAudit={handleViewAudit}
      />
    </main>
  );
}
