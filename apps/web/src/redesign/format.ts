import type {
  FinancialReadiness,
  ScoredHome,
  SearchRequest,
  ShortlistItem
} from "@nhalo/types";

export function formatCurrency(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export function formatCompactCurrency(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

export function formatSearchBudget(request: SearchRequest) {
  const min = request.budget?.min;
  const max = request.budget?.max;

  if (min && max) {
    return `${formatCompactCurrency(min)} - ${formatCompactCurrency(max)}`;
  }

  if (max) {
    return `Up to ${formatCompactCurrency(max)}`;
  }

  if (min) {
    return `From ${formatCompactCurrency(min)}`;
  }

  return "Budget flexible";
}

export function formatBedsBaths(home: ScoredHome) {
  return `${home.bedrooms} bd · ${home.bathrooms} ba · ${home.sqft.toLocaleString()} sqft`;
}

export function buildHomeReasons(home: ScoredHome) {
  return [...(home.explainability?.strengths ?? home.strengths ?? []), ...(home.risks ?? [])]
    .slice(0, 3);
}

export function buildOfferChecklist(readiness: FinancialReadiness | null, shortlistCount: number) {
  return [
    {
      id: "preapproval",
      label: "Pre-approval letter",
      done: readiness?.preApprovalStatus === "verified"
    },
    {
      id: "funds",
      label: "Proof of funds",
      done: readiness?.proofOfFundsStatus === "verified"
    },
    {
      id: "shortlist",
      label: "Shortlist",
      done: shortlistCount > 0
    },
    {
      id: "ready",
      label: "Offer readiness",
      done: readiness?.readinessState === "READY"
    }
  ];
}

export function reviewStateLabel(reviewState: ShortlistItem["reviewState"]) {
  return reviewState.replace(/_/g, " ");
}

export function priceChangeLabel(home: ScoredHome) {
  const priceScore = home.scores.price;

  if (priceScore >= 85) {
    return "Strong value";
  }

  if (priceScore >= 70) {
    return "Fair value";
  }

  return "Stretch";
}
