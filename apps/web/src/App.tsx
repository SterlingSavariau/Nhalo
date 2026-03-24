import type { ScoreAuditRecord, SearchRequest, SearchResponse, SearchSnapshotRecord } from "@nhalo/types";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createSearchSnapshot,
  fetchScoreAudit,
  fetchSearchSnapshot,
  searchHomes,
  trackUiMetric
} from "./api";
import { AuditDrawer } from "./components/AuditDrawer";
import { ComparisonTray } from "./components/ComparisonTray";
import { ResultCard } from "./components/ResultCard";
import { ResultControls } from "./components/ResultControls";
import { SearchForm } from "./components/SearchForm";
import { SearchSummaryPanel } from "./components/SearchSummaryPanel";
import {
  applyResultControls,
  DEFAULT_RESULT_CONTROLS,
  toggleComparisonSelection,
  type ResultControlsState
} from "./view-model";

export default function App() {
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [lastRequest, setLastRequest] = useState<SearchRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [controls, setControls] = useState<ResultControlsState>(DEFAULT_RESULT_CONTROLS);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [audit, setAudit] = useState<ScoreAuditRecord | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SearchSnapshotRecord | null>(null);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const comparedRef = useRef(0);
  const renderedSnapshotRef = useRef<string | null>(null);

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
        setSnapshot(loadedSnapshot);
        setLastRequest(loadedSnapshot.request);
        setResults(loadedSnapshot.response);
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
    if (comparisonIds.length > 0 && comparedRef.current === 0) {
      void trackUiMetric("comparison_view");
    }
    comparedRef.current = comparisonIds.length;
  }, [comparisonIds]);

  const visibleHomes = useMemo(
    () => (results ? applyResultControls(results.homes, controls) : []),
    [results, controls]
  );

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
    setSnapshot(null);
    setControls(DEFAULT_RESULT_CONTROLS);

    try {
      const response = await searchHomes(payload);
      setLastRequest(payload);
      setResults(response);
      window.history.replaceState({}, "", window.location.pathname);
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
        response: results
      });
      setSnapshot(created);
      window.history.replaceState({}, "", `/?snapshot=${created.id}`);
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

  const resorted = controls.sortMode !== "server" || controls.confidence !== "all" || controls.propertyType !== "all";

  return (
    <main className="page-shell">
      <section className="hero-panel">
        <p className="eyebrow">Nhalo Decision Console</p>
        <h1>Make ranked home results easier to trust and compare.</h1>
        <p className="hero-copy">
          This internal console is for validating how clearly Nhalo explains tradeoffs, provenance, and
          confidence when a family is choosing where to live.
        </p>
      </section>

      <section className="content-grid">
        <div className="panel">
          <SearchForm busy={busy} onSubmit={handleSubmit} />
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
                    onToggleCompare={(homeId) =>
                      setComparisonIds((current) => toggleComparisonSelection(current, homeId))
                    }
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
                Run a search, save an immutable snapshot, compare results side by side, and inspect stored
                audit details without changing ranking behavior.
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
    </main>
  );
}
