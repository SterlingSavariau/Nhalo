import type {
  DemoScenario,
  FeedbackCategory,
  GeocodePrecision,
  HistoricalComparisonPayload,
  ListingRejectionSummary,
  ScoredHome,
  SearchRequest,
  SearchResponse,
  SearchSnapshotRecord,
  ShortlistItem
} from "@nhalo/types";

export const ONBOARDING_CONTENT = {
  title: "How Nhalo helps a family choose a home",
  sections: [
    {
      heading: "What Nhalo does",
      body:
        "Nhalo ranks homes for a family decision, not for browsing. Every result is scored on price, size, and safety."
    },
    {
      heading: "How radius works",
      body:
        "Radius is measured from the resolved city, ZIP, or address point. More exact addresses usually give more exact distance filtering."
    },
    {
      heading: "How to trust the result",
      body:
        "Confidence and provenance show whether data was fresh, cached, stale, mock, or partial. Lower confidence means you should read the tradeoffs more carefully."
    },
    {
      heading: "Saved work in this phase",
      body:
        "Saved searches, history, and snapshots are tied to this browser session or local device. They are not account-based yet."
    }
  ]
} as const;

export const SEARCH_FORM_COPY = {
  locationType: "Choose the area anchor for the search.",
  locationValue: {
    city: {
      label: "City",
      placeholder: "Southfield, MI",
      helper: "Use a city and state when you want a broad family-home search area."
    },
    zip: {
      label: "ZIP code",
      placeholder: "48075",
      helper: "Use ZIP when you already know the neighborhood area you want to center on."
    },
    address: {
      label: "Address",
      placeholder: "123 Main St, Southfield, MI",
      helper: "Address search uses the exact geocoded point, so a small radius can narrow results quickly."
    }
  },
  radius:
    "Default is 5 miles. Wider radius usually finds more homes and more comparable data.",
  budget: "Set a hard maximum if affordability is non-negotiable.",
  sqft: "Use minimum square footage to reflect the smallest space your family can live with.",
  bedrooms: "Use minimum bedrooms as a hard family constraint.",
  weights: {
    price: "Price affects affordability and value.",
    size: "Size affects usable family space.",
    safety: "Safety affects neighborhood and school context."
  }
} as const;

export const RESULT_COPY = {
  whyThisHome: "Why this home",
  tradeoffs: "Family tradeoffs",
  concerns: "What may concern a family",
  confidence: "Data confidence",
  originPrecision: "Search origin precision",
  detailTitle: "Home detail",
  sharedSnapshotTitle: "Shared snapshot",
  sharedSnapshotWarning:
    "This is a read-only stored snapshot. It does not rerun the search or refresh provider data.",
  shareSnapshotHelp:
    "Sharing creates a read-only link to this exact stored result set. It does not expose a live search.",
  validationPromptTitle: "Quick feedback",
  demoScenarioTitle: "Guided demos",
  executiveSummaryTitle: "Snapshot summary",
  exportTitle: "Stakeholder export",
  notesTitle: "Presenter notes",
  walkthroughTitle: "Demo walkthrough",
  shortlistTitle: "Shortlists",
  shortlistWarning: "Shortlists and notes are mutable workflow tools. They do not change stored results or scores.",
  historicalCompareTitle: "Historical compare",
  resultNotesTitle: "Decision notes"
} as const;

export const SHORTLIST_COPY = {
  createTitle: "Create shortlist",
  defaultTitle: "Family shortlist",
  descriptionPlaceholder: "Why this set of homes matters for the partner conversation.",
  addAction: "Save to shortlist",
  removeAction: "Remove from shortlist",
  notesPlaceholder: "Example: Strong safety, but the tradeoff is size.",
  compareExplanation:
    "This compares the stored shortlist capture against the currently returned result. Historical values come from saved data only.",
  shareTitle: "Share shortlist",
  shareReadOnly: "Read-only",
  shareCommentOnly: "Comments only",
  shareReviewOnly: "Review and comments",
  sharedWarning:
    "Shared shortlist links use stored shortlist captures. Comments and reviewer decisions do not change scores or snapshots.",
  commentPlaceholder: "Add a short partner comment about this home.",
  reviewerDecisionLabel: "Reviewer decision",
  reviewerDecisionPlaceholder: "Optional note about why you agree, disagree, or want to discuss.",
  immutableWarning:
    "Stored home facts and scores are fixed here. Comments and reviewer decisions are separate workflow notes."
} as const;

export const OFFER_READINESS_COPY = {
  title: "Offer readiness",
  intro:
    "Offer readiness is a mutable workflow layer. It helps the buyer move from interest to a disciplined offer decision without changing Nhalo scores.",
  startAction: "Start offer readiness",
  updateAction: "Update offer readiness",
  scoreLabel: "Readiness score",
  recommendedOfferLabel: "Recommended offer",
  blockingIssuesTitle: "Blocking issues",
  nextStepsTitle: "Next steps",
  financingLabel: "Financing readiness",
  propertyFitLabel: "Property fit confidence",
  riskAlignmentLabel: "Risk tolerance alignment",
  riskLevelLabel: "Offer risk level",
  userConfirmedLabel: "Buyer confirmed this home as a real offer candidate",
  dataCompletenessLabel: "Data completeness",
  recommendationWarning:
    "This recommendation is deterministic and based on stored shortlist data, not live negotiation or legal advice."
} as const;

export const COLLABORATION_COPY = {
  sharedShortlistTitle: "Shared shortlist review",
  readOnlyLabel: "Read-only access",
  reviewerLabel: "Reviewer access",
  ownerLabel: "Owner controls",
  expiredLabel: "This share link has expired.",
  revokedLabel: "This share link has been revoked.",
  activityTitle: "Collaboration activity"
} as const;

export const PILOT_OPS_COPY = {
  contextLabel: "Pilot context",
  planLabel: "Plan",
  internalLabel: "Internal pilot ops",
  inactiveLabel: "Inactive",
  pausedLabel: "Paused",
  activeLabel: "Active",
  linkWarning: "Pilot links apply partner-scoped presentation and workflow flags only. They do not change ranking logic.",
  revokedLinkLabel: "This pilot link has been revoked.",
  expiredLinkLabel: "This pilot link has expired.",
  opsWarning: "These controls manage pilot packaging and access only. They never mutate stored scores or snapshot payloads.",
  createPartnerTitle: "Add pilot partner",
  createLinkAction: "Create pilot link",
  revokeLinkAction: "Revoke link",
  capabilityLabels: {
    canShareSnapshots: "Snapshot sharing",
    canShareShortlists: "Shortlist sharing",
    canUseDemoMode: "Demo mode",
    canExportResults: "Exports",
    canUseCollaboration: "Collaboration"
  }
} as const;

export const DEMO_SCENARIO_COPY: DemoScenario[] = [
  {
    id: "southfield-family-balance",
    label: "Best family-fit homes in Southfield under $425k",
    description: "Balanced affordability, family space, and safety using the seeded Southfield scenario.",
    whyThisMatters:
      "This shows the core Nhalo promise: a family-first shortlist that balances budget, space, and safety in one pass.",
    request: {
      locationType: "city",
      locationValue: "Southfield, MI",
      radiusMiles: 5,
      budget: { max: 425000 },
      minSqft: 1800,
      minBedrooms: 3,
      propertyTypes: ["single_family", "condo", "townhome"],
      weights: { price: 40, size: 30, safety: 30 }
    }
  },
  {
    id: "novi-safety-priority",
    label: "Safer but smaller options near Novi",
    description: "A safety-heavy family search that shows how safer areas can trade off against size.",
    whyThisMatters:
      "This scenario helps stakeholders see that safety can materially change the shortlist without changing the scoring engine.",
    request: {
      locationType: "city",
      locationValue: "Novi, MI",
      radiusMiles: 6,
      budget: { max: 500000 },
      minSqft: 1500,
      minBedrooms: 3,
      propertyTypes: ["single_family", "townhome", "condo"],
      weights: { price: 25, size: 20, safety: 55 }
    }
  },
  {
    id: "austin-address-tight-radius",
    label: "Address-based search with tighter radius",
    description: "Shows how a more exact address anchor narrows distance filtering and confidence context.",
    whyThisMatters:
      "This demonstrates geocode precision, radius discipline, and why more exact origins can change which homes survive the search.",
    request: {
      locationType: "address",
      locationValue: "1500 South Lamar Blvd, Austin, TX",
      radiusMiles: 2,
      budget: { max: 650000 },
      minSqft: 1400,
      minBedrooms: 3,
      propertyTypes: ["single_family", "townhome", "condo"],
      weights: { price: 35, size: 30, safety: 35 }
    }
  },
  {
    id: "royal-oak-low-result-recovery",
    label: "Low-result recovery example",
    description: "A deliberately tight family search to show why results can narrow and how to recover cleanly.",
    whyThisMatters:
      "This lets external viewers see that Nhalo explains thin result sets rather than silently relaxing the search.",
    request: {
      locationType: "city",
      locationValue: "Royal Oak, MI",
      radiusMiles: 2,
      budget: { max: 300000 },
      minSqft: 2200,
      minBedrooms: 4,
      propertyTypes: ["single_family"],
      weights: { price: 40, size: 30, safety: 30 }
    }
  }
];

export const FEEDBACK_PROMPTS: Record<
  "results" | "comparison" | "empty",
  {
    title: string;
    question: string;
    category: FeedbackCategory;
    options: Array<{
      label: string;
      value: "positive" | "negative" | "clear" | "unclear" | "accurate" | "inaccurate";
    }>;
  }
> = {
  results: {
    title: "Did these results feel useful?",
    question: "This helps us learn whether the ranked homes felt relevant for a real family decision.",
    category: "useful",
    options: [
      { label: "Yes", value: "positive" },
      { label: "No", value: "negative" }
    ]
  },
  comparison: {
    title: "Did comparison help narrow the decision?",
    question: "Use this after comparing homes side by side.",
    category: "comparison_helpful",
    options: [
      { label: "Yes", value: "positive" },
      { label: "No", value: "negative" }
    ]
  },
  empty: {
    title: "Was this guidance helpful?",
    question: "Use this after reviewing the recovery suggestions for a tight or empty result set.",
    category: "empty_state_helpful",
    options: [
      { label: "Clear", value: "clear" },
      { label: "Confusing", value: "unclear" }
    ]
  }
};

export const DEMO_WALKTHROUGH_STEPS = [
  {
    title: "What was searched",
    body: "Start with the search summary so the viewer sees the location anchor, family filters, and weighting before reading results."
  },
  {
    title: "How Nhalo scored the shortlist",
    body: "Explain that Nhalo applies hard family constraints first, then ranks homes with deterministic price, size, and safety scores."
  },
  {
    title: "Why the top home ranked highest",
    body: "Use the top card and the snapshot summary to show which tradeoffs were strongest for the leading option."
  },
  {
    title: "Where confidence and provenance matter",
    body: "Point out stale, cached, mock, or partial data indicators so the audience understands how trust changes across homes."
  },
  {
    title: "How snapshots can be shared",
    body: "Show that shared snapshots are stored, read-only outputs that preserve the exact result set without rerunning the search."
  }
] as const;

export function geocodePrecisionExplanation(precision: GeocodePrecision): string {
  switch (precision) {
    case "rooftop":
      return "Exact address point.";
    case "range_interpolated":
      return "Estimated street position.";
    case "approximate":
      return "Approximate area match.";
    case "centroid":
      return "Center point of the city or ZIP.";
    case "mock":
      return "Mock fallback geocode.";
    default:
      return "No resolved origin precision.";
  }
}

export function buildDecisionLabels(home: ScoredHome, homes: ScoredHome[]): string[] {
  const labels: string[] = [];
  const maxSafety = Math.max(...homes.map((item) => item.scores.safety));
  const maxSize = Math.max(...homes.map((item) => item.scores.size));
  const maxPrice = Math.max(...homes.map((item) => item.scores.price));
  const minDistance = Math.min(...homes.map((item) => item.distanceMiles ?? Number.POSITIVE_INFINITY));
  const confidenceRank = { none: 0, low: 1, medium: 2, high: 3 };
  const minConfidence = Math.min(...homes.map((item) => confidenceRank[item.scores.overallConfidence]));

  if (home.scores.safety === maxSafety && maxSafety >= 70) {
    labels.push("Best for safety");
  }
  if (home.scores.size === maxSize && maxSize >= 70) {
    labels.push("Best for space");
  }
  if (home.scores.price === maxPrice && maxPrice >= 70) {
    labels.push("Best value");
  }
  if ((home.distanceMiles ?? Number.POSITIVE_INFINITY) === minDistance) {
    labels.push("Closest option");
  }
  if (confidenceRank[home.scores.overallConfidence] === minConfidence) {
    labels.push("Lowest confidence");
  }
  if (
    home.scores.overallConfidence === "low" ||
    home.scores.overallConfidence === "none" ||
    (home.qualityFlags ?? []).includes("mockFallbackUsed")
  ) {
    labels.push("Needs caution");
  }

  return [...new Set(labels)];
}

export function buildTradeoffSummary(home: ScoredHome): string {
  const { price, size, safety, overallConfidence } = home.scores;

  if (size - safety >= 15 && size >= price) {
    return "More space, weaker safety";
  }
  if (safety - size >= 15) {
    return "Safer area, smaller home";
  }
  if (price >= 75 && overallConfidence !== "high") {
    return "Strong value, moderate confidence";
  }
  if (price - size >= 15) {
    return "Better value, tighter space";
  }
  if (overallConfidence === "low" || overallConfidence === "none") {
    return "Balanced result, lower confidence";
  }

  return "Balanced space, price, and safety";
}

export function buildExecutiveSnapshotSummary(results: SearchResponse): {
  headline: string;
  topHomeSummary: string;
  confidenceSummary: string;
  notableCaveats: string[];
} {
  const topHome = results.homes[0];
  const caveats: string[] = [];

  if (results.metadata.mockFallbackUsed) {
    caveats.push("Some underlying inputs came from mock fallback.");
  }
  if (results.metadata.staleDataPresent) {
    caveats.push("Some listing or safety inputs are stale.");
  }
  if (results.metadata.returnedCount < 5) {
    caveats.push("Only a small number of homes met the family criteria.");
  }
  if (topHome && (topHome.scores.overallConfidence === "low" || topHome.scores.overallConfidence === "none")) {
    caveats.push("The top-ranked home should be reviewed carefully because confidence is reduced.");
  }
  if (results.metadata.warnings.length > 0) {
    caveats.push(results.metadata.warnings[0].message);
  }

  return {
    headline: `${results.metadata.returnedCount} homes ranked for ${results.appliedFilters.locationValue}.`,
    topHomeSummary: topHome
      ? `${topHome.address} leads with Nhalo ${topHome.scores.nhalo}, Price ${topHome.scores.price}, Size ${topHome.scores.size}, and Safety ${topHome.scores.safety}.`
      : "No homes were returned for this stored search.",
    confidenceSummary: topHome
      ? `Top result confidence is ${topHome.scores.overallConfidence}. Safety confidence is ${topHome.scores.safetyConfidence}.`
      : "No confidence summary is available because no homes were returned.",
    notableCaveats: caveats
  };
}

export function buildSnapshotExportText(snapshot: SearchSnapshotRecord, appName: string): string {
  const executive = buildExecutiveSnapshotSummary(snapshot.response);
  const topHome = snapshot.response.homes[0];

  return [
    `${appName} snapshot summary`,
    `Location: ${snapshot.request.locationValue}`,
    `Radius: ${snapshot.request.radiusMiles} miles`,
    `Budget max: ${snapshot.request.budget?.max ? `$${snapshot.request.budget.max.toLocaleString()}` : "Not set"}`,
    `Minimums: ${snapshot.request.minBedrooms ?? 0} bedrooms, ${snapshot.request.minSqft ?? 0} sqft`,
    `Weights: Price ${snapshot.response.appliedWeights.price}, Size ${snapshot.response.appliedWeights.size}, Safety ${snapshot.response.appliedWeights.safety}`,
    `Created: ${new Date(snapshot.createdAt).toLocaleString()}`,
    `Formula: ${snapshot.formulaVersion ?? "nhalo-v1"}`,
    executive.headline,
    executive.topHomeSummary,
    executive.confidenceSummary,
    topHome ? `Why this home: ${topHome.explainability?.headline ?? topHome.explanation}` : "No ranked home summary available.",
    executive.notableCaveats.length > 0 ? `Caveats: ${executive.notableCaveats.join(" ")}` : "Caveats: none flagged."
  ].join("\n");
}

export function buildShareSnapshotUrl(shareId: string): string {
  return `/?sharedSnapshot=${encodeURIComponent(shareId)}`;
}

export function buildWorkflowActivityLabel(
  eventType: string
): string {
  switch (eventType) {
    case "shortlist_created":
      return "Shortlist created";
    case "shortlist_updated":
      return "Shortlist updated";
    case "shortlist_deleted":
      return "Shortlist deleted";
    case "shortlist_item_added":
      return "Home added to shortlist";
    case "shortlist_item_removed":
      return "Home removed from shortlist";
    case "note_created":
      return "Note added";
    case "note_updated":
      return "Note updated";
    case "note_deleted":
      return "Note deleted";
    case "offer_readiness_created":
      return "Offer readiness started";
    case "offer_readiness_updated":
      return "Offer readiness updated";
    case "offer_status_changed":
      return "Offer status changed";
    case "review_state_changed":
      return "Review state changed";
    default:
      return "Workflow activity";
  }
}

export function buildHistoricalComparison(
  item: ShortlistItem,
  currentHome: ScoredHome | null
): HistoricalComparisonPayload {
  const changes: HistoricalComparisonPayload["changes"] = [];
  const previous = item.capturedHome;

  if (currentHome) {
    const scorePairs = [
      ["nhaloScore", previous.scores.nhalo, currentHome.scores.nhalo],
      ["priceScore", previous.scores.price, currentHome.scores.price],
      ["sizeScore", previous.scores.size, currentHome.scores.size],
      ["safetyScore", previous.scores.safety, currentHome.scores.safety]
    ] as const;

    for (const [field, from, to] of scorePairs) {
      if (from !== to) {
        changes.push({
          field,
          from,
          to,
          status: to > from ? "improved" : "declined"
        });
      }
    }

    if (previous.scores.overallConfidence !== currentHome.scores.overallConfidence) {
      changes.push({
        field: "overallConfidence",
        from: previous.scores.overallConfidence,
        to: currentHome.scores.overallConfidence,
        status: "changed"
      });
    }

    if (previous.scores.safetyConfidence !== currentHome.scores.safetyConfidence) {
      changes.push({
        field: "safetyConfidence",
        from: previous.scores.safetyConfidence,
        to: currentHome.scores.safetyConfidence,
        status: "changed"
      });
    }

    if (previous.provenance?.listingDataSource !== currentHome.provenance?.listingDataSource) {
      changes.push({
        field: "listingSource",
        from: previous.provenance?.listingDataSource ?? null,
        to: currentHome.provenance?.listingDataSource ?? null,
        status: "changed"
      });
    }

    if (previous.provenance?.safetyDataSource !== currentHome.provenance?.safetyDataSource) {
      changes.push({
        field: "safetySource",
        from: previous.provenance?.safetyDataSource ?? null,
        to: currentHome.provenance?.safetyDataSource ?? null,
        status: "changed"
      });
    }

    const previousFlags = previous.qualityFlags ?? [];
    const currentFlags = currentHome.qualityFlags ?? [];
    if (previousFlags.join("|") !== currentFlags.join("|")) {
      changes.push({
        field: "qualityFlags",
        from: previousFlags,
        to: currentFlags,
        status: "changed"
      });
    }
  }

  return {
    canonicalPropertyId: item.canonicalPropertyId,
    historical: {
      label: "Saved shortlist capture",
      home: item.capturedHome,
      sourceSnapshotId: item.sourceSnapshotId ?? null,
      capturedAt: item.addedAt
    },
    current: currentHome
      ? {
          label: "Current result",
          home: currentHome
        }
      : null,
    changes
  };
}

export function buildEmptyStateSuggestions(response: SearchResponse): Array<{
  code: string;
  label: string;
  detail: string;
  patch?: Partial<SearchRequest>;
}> {
  const suggestions: Array<{
    code: string;
    label: string;
    detail: string;
    patch?: Partial<SearchRequest>;
  }> = [];
  const rejection = response.metadata.rejectionSummary;

  if (!rejection) {
    return suggestions;
  }

  if (rejection.outsideRadius > 0) {
    suggestions.push({
      code: "radius",
      label: "Increase radius",
      detail: "More homes were nearby but just outside the requested radius.",
      patch: {
        radiusMiles: (response.appliedFilters.radiusMiles ?? 5) + 3
      }
    });
  }

  if (rejection.aboveBudget > 0 && typeof response.appliedFilters.budget?.max === "number") {
    suggestions.push({
      code: "budget",
      label: "Raise budget",
      detail: "Several homes were filtered out for being above the current budget cap.",
      patch: {
        budget: {
          ...response.appliedFilters.budget,
          max: response.appliedFilters.budget.max + 50000
        }
      }
    });
  }

  if (rejection.belowSqft > 0 && typeof response.appliedFilters.minSqft === "number") {
    suggestions.push({
      code: "sqft",
      label: "Lower min sqft",
      detail: "Many nearby homes were smaller than the current space requirement.",
      patch: {
        minSqft: Math.max(500, response.appliedFilters.minSqft - 250)
      }
    });
  }

  if (rejection.wrongPropertyType > 0) {
    suggestions.push({
      code: "propertyTypes",
      label: "Allow more property types",
      detail: "More homes exist nearby if you broaden the home type filter.",
      patch: {
        propertyTypes: ["single_family", "condo", "townhome"]
      }
    });
  }

  if (response.appliedFilters.locationType === "address") {
    suggestions.push({
      code: "cityInstead",
      label: "Try city instead of address",
      detail: "Address-based search can narrow the radius too tightly for first-pass exploration.",
      patch: {
        locationType: "city"
      }
    });
  }

  return suggestions;
}
