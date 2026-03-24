import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { INITIAL_SEARCH_REQUEST, SearchForm } from "./SearchForm";

describe("SearchForm", () => {
  it("renders family-first defaults, helper text, and reset affordances", () => {
    const markup = renderToStaticMarkup(
      <SearchForm
        busy={false}
        onChange={vi.fn()}
        onResetWeights={vi.fn()}
        onSubmit={vi.fn()}
        value={INITIAL_SEARCH_REQUEST}
      />
    );

    expect(markup).toContain("Start with what your family needs most.");
    expect(markup).toContain("Southfield, MI");
    expect(markup).toContain("Default is 5 miles.");
    expect(markup).toContain("Reset defaults");
    expect(markup).toContain("Run Nhalo Search");
  });
});
