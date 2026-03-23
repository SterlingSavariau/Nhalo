import type { SearchRequest, SearchResponse } from "@nhalo/types";
import { useState } from "react";
import { searchHomes } from "./api";
import { ResultCard } from "./components/ResultCard";
import { SearchForm } from "./components/SearchForm";

export default function App() {
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(payload: SearchRequest) {
    setBusy(true);
    setError(null);

    try {
      const response = await searchHomes(payload);
      setResults(response);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Unable to complete search");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="hero-panel">
        <p className="eyebrow">Nhalo Internal Search Console</p>
        <h1>Rank family homes by price, size, and safety.</h1>
        <p className="hero-copy">
          This internal console is for validating whether the ranking engine matches real family buying
          decisions. Submit a search, inspect the breakdown, and adjust the weights.
        </p>
      </section>

      <section className="content-grid">
        <div className="panel">
          <SearchForm busy={busy} onSubmit={handleSubmit} />
        </div>

        <div className="panel results-panel">
          {error ? <div className="error-banner">{error}</div> : null}

          {results ? (
            <>
              <div className="metadata-row">
                <div>
                  <p className="section-label">Search Summary</p>
                  <h2>{results.metadata.returnedCount} ranked homes</h2>
                  <p className="muted">
                    Scanned {results.metadata.totalCandidatesScanned} candidates, matched{" "}
                    {results.metadata.totalMatched}, rendered in {results.metadata.durationMs} ms.
                  </p>
                </div>
                <div className="metadata-badges">
                  <span>Price {results.appliedWeights.price}</span>
                  <span>Size {results.appliedWeights.size}</span>
                  <span>Safety {results.appliedWeights.safety}</span>
                </div>
              </div>

              {results.metadata.warnings.length > 0 ? (
                <div className="callout warning">
                  {results.metadata.warnings.map((warning) => warning.message).join(" ")}
                </div>
              ) : null}

              {results.metadata.suggestions.length > 0 ? (
                <div className="callout suggestion">
                  {results.metadata.suggestions.map((suggestion) => suggestion.message).join(" ")}
                </div>
              ) : null}

              <div className="results-stack">
                {results.homes.map((home, index) => (
                  <ResultCard key={home.id} home={home} rank={index + 1} />
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p className="section-label">No search yet</p>
              <h2>Start with Southfield, MI</h2>
              <p className="muted">
                The mock providers ship with seeded markets in metro Detroit and Austin to validate the
                scoring engine before live provider integration.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
