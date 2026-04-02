import type {
  BuyerTransactionCommandCenterView,
  CollaborationActivityRecord,
  DataQualityEvent,
  DataQualitySummary,
  DemoScenario,
  DecisionExplanationBundle,
  FeedbackCategory,
  FeedbackRecord,
  FinancialReadiness,
  FinancialReadinessSummary,
  GoLiveCheckSummary,
  ClosingReadiness,
  ClosingReadinessSummary,
  NegotiationEvent,
  NegotiationRecord,
  NegotiationSummary,
  OfferPreparation,
  OfferPreparationSummary,
  OfferSubmission,
  OfferSubmissionSummary,
  UnderContractCoordination,
  UnderContractCoordinationSummary,
  OfferReadiness,
  OfferReadinessRecommendation,
  OpsActionRecord,
  OpsSummary,
  PilotContext,
  PilotFeatureOverrides,
  PilotLinkRecord,
  PilotLinkView,
  PilotPartner,
  PilotPartnerStatus,
  PilotActivityRecord,
  ReviewerDecision,
  ReviewerDecisionValue,
  ReliabilityStateSummary,
  ReleaseSummary,
  ResultNote,
  ScoreAuditRecord,
  SearchMetrics,
  SharedComment,
  SharedShortlist,
  SharedShortlistView,
  Shortlist,
  ShortlistItem,
  SupportContextSummary,
  SearchDefinition,
  SearchHistoryRecord,
  SearchRequest,
  SearchResponse,
  SearchSnapshotRecord,
  ValidationEventRecord,
  ValidationSummary,
  UnifiedActivityRecord,
  WorkflowNotification,
  WorkflowNotificationHistoryEvent,
  WorkflowActivityRecord,
  ReviewState
} from "@nhalo/types";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
let activePilotLinkId: string | null = null;

function buildSessionHeaders(sessionId?: string | null): Record<string, string> {
  return {
    ...(sessionId ? { "x-nhalo-session-id": sessionId } : {}),
    ...(activePilotLinkId ? { "x-nhalo-pilot-link-id": activePilotLinkId } : {})
  };
}

export function setPilotLinkContext(pilotLinkId: string | null): void {
  activePilotLinkId = pilotLinkId;
}

export async function searchHomes(payload: SearchRequest, sessionId?: string | null): Promise<SearchResponse> {
  const response = await fetch(`${API_BASE_URL}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildSessionHeaders(sessionId)
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Search failed");
  }

  return response.json();
}

export async function fetchScoreAudit(propertyId: string): Promise<ScoreAuditRecord> {
  const response = await fetch(`${API_BASE_URL}/scores/audit/${propertyId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Audit fetch failed");
  }

  return response.json();
}

export async function createSearchSnapshot(payload: {
  request: SearchRequest;
  response: SearchResponse;
  sessionId?: string | null;
  searchDefinitionId?: string | null;
  historyRecordId?: string | null;
}): Promise<SearchSnapshotRecord> {
  const response = await fetch(`${API_BASE_URL}/search/snapshots`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildSessionHeaders(payload.sessionId)
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Snapshot creation failed");
  }

  return response.json();
}

export async function fetchSearchSnapshot(id: string): Promise<SearchSnapshotRecord> {
  const response = await fetch(`${API_BASE_URL}/search/snapshots/${id}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Snapshot fetch failed");
  }

  return response.json();
}

export async function createSharedSnapshot(payload: {
  snapshotId: string;
  sessionId?: string | null;
  expiresInDays?: number;
}): Promise<{
  share: SharedSnapshotView["share"];
  shareUrl: string;
  readOnly: true;
}> {
  const response = await fetch(`${API_BASE_URL}/search/snapshots/${payload.snapshotId}/share`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildSessionHeaders(payload.sessionId)
    },
    body: JSON.stringify({
      sessionId: payload.sessionId,
      expiresInDays: payload.expiresInDays
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Shared snapshot creation failed");
  }

  return response.json();
}

export async function fetchSharedSnapshot(shareId: string): Promise<{
  readOnly: true;
  shared: true;
  share: SharedSnapshotView["share"];
  snapshot: SearchSnapshotRecord;
}> {
  const response = await fetch(`${API_BASE_URL}/shared/snapshots/${shareId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Shared snapshot fetch failed");
  }

  return response.json();
}

export async function fetchRecentSnapshots(
  sessionId?: string | null,
  limit = 10
): Promise<SearchSnapshotRecord[]> {
  const response = await fetch(`${API_BASE_URL}/search/snapshots?limit=${limit}`, {
    headers: buildSessionHeaders(sessionId)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Snapshot list fetch failed");
  }

  const payload = await response.json();
  return payload.snapshots;
}

export async function fetchDemoScenarios(): Promise<DemoScenario[]> {
  const response = await fetch(`${API_BASE_URL}/validation/demo-scenarios`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Demo scenarios fetch failed");
  }

  const payload = await response.json();
  return payload.scenarios;
}

export async function createSearchDefinition(payload: {
  sessionId?: string | null;
  label: string;
  request: SearchRequest;
  pinned?: boolean;
}): Promise<SearchDefinition> {
  const response = await fetch(`${API_BASE_URL}/search/definitions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildSessionHeaders(payload.sessionId)
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Saved search creation failed");
  }

  return response.json();
}

export async function fetchSearchDefinitions(sessionId?: string | null): Promise<SearchDefinition[]> {
  const response = await fetch(`${API_BASE_URL}/search/definitions`, {
    headers: buildSessionHeaders(sessionId)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Saved search list fetch failed");
  }

  const payload = await response.json();
  return payload.definitions;
}

export async function updateSearchDefinition(
  id: string,
  patch: { label?: string; pinned?: boolean }
): Promise<SearchDefinition> {
  const response = await fetch(`${API_BASE_URL}/search/definitions/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(patch)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Saved search update failed");
  }

  return response.json();
}

export async function deleteSearchDefinition(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/search/definitions/${id}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Saved search delete failed");
  }
}

export async function fetchSearchHistory(
  sessionId?: string | null,
  limit = 10
): Promise<SearchHistoryRecord[]> {
  const response = await fetch(`${API_BASE_URL}/search/history?limit=${limit}`, {
    headers: buildSessionHeaders(sessionId)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Search history fetch failed");
  }

  const payload = await response.json();
  return payload.history;
}

export async function createShortlist(payload: {
  sessionId?: string | null;
  title: string;
  description?: string | null;
  sourceSnapshotId?: string | null;
  pinned?: boolean;
}): Promise<Shortlist> {
  const response = await fetch(`${API_BASE_URL}/shortlists`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildSessionHeaders(payload.sessionId)
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Shortlist creation failed");
  }

  return response.json();
}

export async function fetchShortlists(sessionId?: string | null): Promise<Shortlist[]> {
  const response = await fetch(`${API_BASE_URL}/shortlists`, {
    headers: buildSessionHeaders(sessionId)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Shortlist fetch failed");
  }

  const payload = await response.json();
  return payload.shortlists;
}

export async function updateShortlist(
  id: string,
  patch: { title?: string; description?: string | null; pinned?: boolean }
): Promise<Shortlist> {
  const response = await fetch(`${API_BASE_URL}/shortlists/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(patch)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Shortlist update failed");
  }

  return response.json();
}

export async function deleteShortlist(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/shortlists/${id}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Shortlist delete failed");
  }
}

export async function createSharedShortlist(payload: {
  shortlistId: string;
  sessionId?: string | null;
  shareMode: SharedShortlist["shareMode"];
  expiresInDays?: number;
}): Promise<{
  share: SharedShortlist;
  shareUrl: string;
  readOnly: boolean;
}> {
  const response = await fetch(`${API_BASE_URL}/shortlists/${payload.shortlistId}/share`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildSessionHeaders(payload.sessionId)
    },
    body: JSON.stringify({
      sessionId: payload.sessionId,
      shareMode: payload.shareMode,
      expiresInDays: payload.expiresInDays
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Shared shortlist creation failed");
  }

  return response.json();
}

export async function fetchSharedShortlists(shortlistId: string): Promise<SharedShortlist[]> {
  const response = await fetch(`${API_BASE_URL}/shortlists/${shortlistId}/shares`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Shared shortlist fetch failed");
  }

  const payload = await response.json();
  return payload.shares;
}

export async function revokeSharedShortlist(shareId: string): Promise<SharedShortlist> {
  const response = await fetch(`${API_BASE_URL}/shortlists/shares/${shareId}/revoke`, {
    method: "POST"
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Shared shortlist revoke failed");
  }

  const payload = await response.json();
  return payload.share;
}

export async function fetchSharedShortlist(shareId: string): Promise<SharedShortlistView> {
  const response = await fetch(`${API_BASE_URL}/shared/shortlists/${shareId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Shared shortlist fetch failed");
  }

  return response.json();
}

export async function fetchShortlistItems(id: string): Promise<{
  shortlist: Shortlist;
  items: ShortlistItem[];
  offerPreparations: OfferPreparation[];
  offerSubmissions: OfferSubmission[];
  underContracts: UnderContractCoordination[];
  closingReadiness: ClosingReadiness[];
  offerReadiness: OfferReadiness[];
  negotiations: NegotiationRecord[];
}> {
  const response = await fetch(`${API_BASE_URL}/shortlists/${id}/items`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Shortlist items fetch failed");
  }

  return response.json();
}

export async function createNegotiation(payload: {
  propertyId: string;
  shortlistId?: string | null;
  offerReadinessId?: string | null;
  status?: NegotiationRecord["status"];
  initialOfferPrice: number;
  currentOfferPrice?: number;
  sellerCounterPrice?: number | null;
  buyerWalkAwayPrice?: number | null;
  roundNumber?: number;
}): Promise<NegotiationRecord> {
  const response = await fetch(`${API_BASE_URL}/negotiations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Negotiation creation failed");
  }

  return response.json();
}

export async function fetchNegotiation(
  propertyId: string,
  shortlistId?: string
): Promise<NegotiationRecord> {
  const query = shortlistId ? `?shortlistId=${encodeURIComponent(shortlistId)}` : "";
  const response = await fetch(`${API_BASE_URL}/negotiations/${encodeURIComponent(propertyId)}${query}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Negotiation fetch failed");
  }

  return response.json();
}

export async function updateNegotiation(
  id: string,
  patch: {
    status?: NegotiationRecord["status"];
    currentOfferPrice?: number;
    sellerCounterPrice?: number | null;
    buyerWalkAwayPrice?: number | null;
    roundNumber?: number;
  }
): Promise<NegotiationRecord> {
  const response = await fetch(`${API_BASE_URL}/negotiations/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(patch)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Negotiation update failed");
  }

  return response.json();
}

export async function createNegotiationEvent(
  negotiationId: string,
  payload: {
    type: NegotiationEvent["type"];
    label: string;
    details?: string | null;
  }
): Promise<NegotiationEvent> {
  const response = await fetch(`${API_BASE_URL}/negotiations/${encodeURIComponent(negotiationId)}/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Negotiation event creation failed");
  }

  return response.json();
}

export async function fetchNegotiationEvents(
  negotiationId: string
): Promise<NegotiationEvent[]> {
  const response = await fetch(`${API_BASE_URL}/negotiations/${encodeURIComponent(negotiationId)}/events`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Negotiation events fetch failed");
  }

  const payload = await response.json();
  return payload.events;
}

export async function fetchNegotiationSummary(
  propertyId: string,
  shortlistId?: string
): Promise<NegotiationSummary> {
  const query = shortlistId ? `?shortlistId=${encodeURIComponent(shortlistId)}` : "";
  const response = await fetch(
    `${API_BASE_URL}/negotiations/${encodeURIComponent(propertyId)}/summary${query}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Negotiation summary fetch failed");
  }

  return response.json();
}

export async function createFinancialReadiness(payload: {
  sessionId?: string | null;
  annualHouseholdIncome: number | null;
  monthlyDebtPayments: number | null;
  availableCashSavings: number | null;
  creditScoreRange: FinancialReadiness["creditScoreRange"];
  desiredHomePrice: number | null;
  purchaseLocation: string | null;
  downPaymentPreferencePercent?: number | null;
  loanType?: FinancialReadiness["loanType"];
  preApprovalStatus: FinancialReadiness["preApprovalStatus"];
  preApprovalExpiresAt?: string | null;
  proofOfFundsStatus: FinancialReadiness["proofOfFundsStatus"];
}): Promise<FinancialReadiness> {
  const response = await fetch(`${API_BASE_URL}/financial-readiness`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildSessionHeaders(payload.sessionId)
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Financial readiness creation failed");
  }

  return response.json();
}

export async function fetchLatestFinancialReadiness(
  sessionId?: string | null
): Promise<FinancialReadiness | null> {
  const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
  const response = await fetch(`${API_BASE_URL}/financial-readiness${query}`, {
    headers: buildSessionHeaders(sessionId)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Financial readiness fetch failed");
  }

  const payload = await response.json();
  return payload.record ?? null;
}

export async function fetchFinancialReadiness(id: string): Promise<FinancialReadiness> {
  const response = await fetch(`${API_BASE_URL}/financial-readiness/${encodeURIComponent(id)}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Financial readiness fetch failed");
  }

  return response.json();
}

export async function updateFinancialReadiness(
  id: string,
  patch: {
    annualHouseholdIncome?: number | null;
    monthlyDebtPayments?: number | null;
    availableCashSavings?: number | null;
    creditScoreRange?: FinancialReadiness["creditScoreRange"];
    desiredHomePrice?: number | null;
    purchaseLocation?: string | null;
    downPaymentPreferencePercent?: number | null;
    loanType?: FinancialReadiness["loanType"];
    preApprovalStatus?: FinancialReadiness["preApprovalStatus"];
    preApprovalExpiresAt?: string | null;
    proofOfFundsStatus?: FinancialReadiness["proofOfFundsStatus"];
  }
): Promise<FinancialReadiness> {
  const response = await fetch(`${API_BASE_URL}/financial-readiness/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(patch)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Financial readiness update failed");
  }

  return response.json();
}

export async function fetchFinancialReadinessSummary(
  id: string
): Promise<FinancialReadinessSummary> {
  const response = await fetch(`${API_BASE_URL}/financial-readiness/${encodeURIComponent(id)}/summary`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Financial readiness summary fetch failed");
  }

  return response.json();
}

export async function createOfferPreparation(payload: {
  sessionId?: string | null;
  propertyId: string;
  propertyAddressLabel: string;
  shortlistId?: string | null;
  offerReadinessId?: string | null;
  financialReadinessId: string;
  offerPrice?: number | null;
  earnestMoneyAmount?: number | null;
  downPaymentType?: OfferPreparation["downPaymentType"];
  downPaymentAmount?: number | null;
  downPaymentPercent?: number | null;
  financingContingency?: OfferPreparation["financingContingency"];
  inspectionContingency?: OfferPreparation["inspectionContingency"];
  appraisalContingency?: OfferPreparation["appraisalContingency"];
  closingTimelineDays?: number | null;
  possessionTiming?: OfferPreparation["possessionTiming"];
  possessionDaysAfterClosing?: number | null;
  sellerConcessionsRequestedAmount?: number | null;
  notes?: string | null;
  buyerRationale?: string | null;
}): Promise<OfferPreparation> {
  const response = await fetch(`${API_BASE_URL}/offer-preparation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildSessionHeaders(payload.sessionId)
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Offer preparation creation failed");
  }

  return response.json();
}

export async function fetchLatestOfferPreparation(payload: {
  propertyId: string;
  shortlistId?: string | null;
  sessionId?: string | null;
}): Promise<OfferPreparation | null> {
  const searchParams = new URLSearchParams({
    propertyId: payload.propertyId
  });
  if (payload.shortlistId) {
    searchParams.set("shortlistId", payload.shortlistId);
  }
  if (payload.sessionId) {
    searchParams.set("sessionId", payload.sessionId);
  }

  const response = await fetch(`${API_BASE_URL}/offer-preparation?${searchParams.toString()}`, {
    headers: buildSessionHeaders(payload.sessionId)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Offer preparation fetch failed");
  }

  const body = await response.json();
  return body.record ?? null;
}

export async function fetchOfferPreparation(id: string): Promise<OfferPreparation> {
  const response = await fetch(`${API_BASE_URL}/offer-preparation/${encodeURIComponent(id)}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Offer preparation fetch failed");
  }

  return response.json();
}

export async function updateOfferPreparation(
  id: string,
  patch: {
    propertyAddressLabel?: string;
    offerPrice?: number | null;
    earnestMoneyAmount?: number | null;
    downPaymentType?: OfferPreparation["downPaymentType"];
    downPaymentAmount?: number | null;
    downPaymentPercent?: number | null;
    financingContingency?: OfferPreparation["financingContingency"];
    inspectionContingency?: OfferPreparation["inspectionContingency"];
    appraisalContingency?: OfferPreparation["appraisalContingency"];
    closingTimelineDays?: number | null;
    possessionTiming?: OfferPreparation["possessionTiming"];
    possessionDaysAfterClosing?: number | null;
    sellerConcessionsRequestedAmount?: number | null;
    notes?: string | null;
    buyerRationale?: string | null;
  }
): Promise<OfferPreparation> {
  const response = await fetch(`${API_BASE_URL}/offer-preparation/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(patch)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Offer preparation update failed");
  }

  return response.json();
}

export async function fetchOfferPreparationSummary(
  id: string
): Promise<OfferPreparationSummary> {
  const response = await fetch(`${API_BASE_URL}/offer-preparation/${encodeURIComponent(id)}/summary`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Offer preparation summary fetch failed");
  }

  return response.json();
}

export async function createOfferSubmission(payload: {
  sessionId?: string | null;
  propertyId: string;
  propertyAddressLabel: string;
  shortlistId?: string | null;
  financialReadinessId?: string | null;
  offerPreparationId: string;
  submissionMethod?: OfferSubmission["submissionMethod"];
  offerExpirationAt?: string | null;
  notes?: string | null;
  internalActivityNote?: string | null;
}): Promise<OfferSubmission> {
  const response = await fetch(`${API_BASE_URL}/offer-submission`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildSessionHeaders(payload.sessionId)
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Offer submission creation failed");
  }

  return response.json();
}

export async function submitOfferSubmission(
  id: string,
  submittedAt?: string | null
): Promise<OfferSubmission> {
  const response = await fetch(`${API_BASE_URL}/offer-submission/${encodeURIComponent(id)}/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      submittedAt: submittedAt ?? null
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Offer submission failed");
  }

  return response.json();
}

export async function fetchLatestOfferSubmission(payload: {
  propertyId: string;
  shortlistId?: string | null;
  sessionId?: string | null;
}): Promise<OfferSubmission | null> {
  const searchParams = new URLSearchParams({
    propertyId: payload.propertyId
  });
  if (payload.shortlistId) {
    searchParams.set("shortlistId", payload.shortlistId);
  }
  if (payload.sessionId) {
    searchParams.set("sessionId", payload.sessionId);
  }

  const response = await fetch(`${API_BASE_URL}/offer-submission?${searchParams.toString()}`, {
    headers: buildSessionHeaders(payload.sessionId)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Offer submission fetch failed");
  }

  const body = await response.json();
  return body.record ?? null;
}

export async function fetchOfferSubmission(id: string): Promise<OfferSubmission> {
  const response = await fetch(`${API_BASE_URL}/offer-submission/${encodeURIComponent(id)}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Offer submission fetch failed");
  }

  return response.json();
}

export async function updateOfferSubmission(
  id: string,
  patch: {
    submissionMethod?: OfferSubmission["submissionMethod"];
    offerExpirationAt?: string | null;
    sellerResponseState?: OfferSubmission["sellerResponseState"];
    sellerRespondedAt?: string | null;
    buyerCounterDecision?: OfferSubmission["buyerCounterDecision"];
    withdrawnAt?: string | null;
    withdrawalReason?: string | null;
    counterofferPrice?: number | null;
    counterofferClosingTimelineDays?: number | null;
    counterofferFinancingContingency?: OfferSubmission["counterofferSummary"]["counterofferFinancingContingency"];
    counterofferInspectionContingency?: OfferSubmission["counterofferSummary"]["counterofferInspectionContingency"];
    counterofferAppraisalContingency?: OfferSubmission["counterofferSummary"]["counterofferAppraisalContingency"];
    counterofferExpirationAt?: string | null;
    notes?: string | null;
    internalActivityNote?: string | null;
  }
): Promise<OfferSubmission> {
  const response = await fetch(`${API_BASE_URL}/offer-submission/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(patch)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Offer submission update failed");
  }

  return response.json();
}

export async function respondToOfferSubmissionCounter(
  id: string,
  buyerCounterDecision: NonNullable<OfferSubmission["buyerCounterDecision"]>
): Promise<OfferSubmission> {
  const response = await fetch(
    `${API_BASE_URL}/offer-submission/${encodeURIComponent(id)}/counter-response`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ buyerCounterDecision })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Counter response update failed");
  }

  return response.json();
}

export async function fetchOfferSubmissionSummary(
  id: string
): Promise<OfferSubmissionSummary> {
  const response = await fetch(`${API_BASE_URL}/offer-submission/${encodeURIComponent(id)}/summary`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Offer submission summary fetch failed");
  }

  return response.json();
}

export async function createUnderContractCoordination(payload: {
  sessionId?: string | null;
  propertyId: string;
  propertyAddressLabel: string;
  shortlistId?: string | null;
  financialReadinessId?: string | null;
  offerPreparationId?: string | null;
  offerSubmissionId: string;
  acceptedAt: string;
  targetClosingDate: string;
  inspectionDeadline: string | null;
  appraisalDeadline: string | null;
  financingDeadline: string | null;
  contingencyDeadline: string | null;
  closingPreparationDeadline?: string | null;
  notes?: string | null;
  internalActivityNote?: string | null;
}): Promise<UnderContractCoordination> {
  const response = await fetch(`${API_BASE_URL}/under-contract`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildSessionHeaders(payload.sessionId)
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Under-contract coordination creation failed");
  }

  return response.json();
}

export async function fetchLatestUnderContractCoordination(payload: {
  propertyId: string;
  shortlistId?: string | null;
  sessionId?: string | null;
}): Promise<UnderContractCoordination | null> {
  const searchParams = new URLSearchParams({
    propertyId: payload.propertyId
  });
  if (payload.shortlistId) {
    searchParams.set("shortlistId", payload.shortlistId);
  }
  if (payload.sessionId) {
    searchParams.set("sessionId", payload.sessionId);
  }

  const response = await fetch(`${API_BASE_URL}/under-contract?${searchParams.toString()}`, {
    headers: buildSessionHeaders(payload.sessionId)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Under-contract coordination fetch failed");
  }

  const body = await response.json();
  return body.record ?? null;
}

export async function fetchUnderContractCoordination(id: string): Promise<UnderContractCoordination> {
  const response = await fetch(`${API_BASE_URL}/under-contract/${encodeURIComponent(id)}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Under-contract coordination fetch failed");
  }

  return response.json();
}

export async function updateUnderContractCoordination(
  id: string,
  patch: {
    targetClosingDate?: string | null;
    inspectionDeadline?: string | null;
    appraisalDeadline?: string | null;
    financingDeadline?: string | null;
    contingencyDeadline?: string | null;
    closingPreparationDeadline?: string | null;
    notes?: string | null;
    internalActivityNote?: string | null;
  }
): Promise<UnderContractCoordination> {
  const response = await fetch(`${API_BASE_URL}/under-contract/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(patch)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Under-contract coordination update failed");
  }

  return response.json();
}

export async function updateUnderContractTask(
  id: string,
  taskType: UnderContractCoordination["taskSummaries"][number]["taskType"],
  patch: {
    status?: UnderContractCoordination["taskSummaries"][number]["status"];
    deadline?: string | null;
    scheduledAt?: string | null;
    completedAt?: string | null;
    blockedReason?: string | null;
    notes?: string | null;
  }
): Promise<UnderContractCoordination> {
  const response = await fetch(
    `${API_BASE_URL}/under-contract/${encodeURIComponent(id)}/tasks/${encodeURIComponent(taskType)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(patch)
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Under-contract task update failed");
  }

  return response.json();
}

export async function updateUnderContractMilestone(
  id: string,
  milestoneType: UnderContractCoordination["milestoneSummaries"][number]["milestoneType"],
  patch: {
    status?: UnderContractCoordination["milestoneSummaries"][number]["status"];
    occurredAt?: string | null;
    notes?: string | null;
  }
): Promise<UnderContractCoordination> {
  const response = await fetch(
    `${API_BASE_URL}/under-contract/${encodeURIComponent(id)}/milestones/${encodeURIComponent(milestoneType)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(patch)
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Under-contract milestone update failed");
  }

  return response.json();
}

export async function fetchUnderContractCoordinationSummary(
  id: string
): Promise<UnderContractCoordinationSummary> {
  const response = await fetch(`${API_BASE_URL}/under-contract/${encodeURIComponent(id)}/summary`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Under-contract summary fetch failed");
  }

  return response.json();
}

export async function createClosingReadiness(payload: {
  sessionId?: string | null;
  propertyId: string;
  propertyAddressLabel: string;
  shortlistId?: string | null;
  financialReadinessId?: string | null;
  offerPreparationId?: string | null;
  offerSubmissionId?: string | null;
  underContractCoordinationId: string;
  targetClosingDate: string;
  closingAppointmentAt?: string | null;
  closingAppointmentLocation?: string | null;
  closingAppointmentNotes?: string | null;
  finalReviewDeadline?: string | null;
  finalFundsConfirmationDeadline?: string | null;
  finalFundsAmountConfirmed?: number | null;
  notes?: string | null;
  internalActivityNote?: string | null;
}): Promise<ClosingReadiness> {
  const response = await fetch(`${API_BASE_URL}/closing-readiness`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildSessionHeaders(payload.sessionId)
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Closing readiness creation failed");
  }

  return response.json();
}

export async function fetchLatestClosingReadiness(payload: {
  propertyId: string;
  shortlistId?: string | null;
  sessionId?: string | null;
}): Promise<ClosingReadiness | null> {
  const searchParams = new URLSearchParams({
    propertyId: payload.propertyId
  });
  if (payload.shortlistId) {
    searchParams.set("shortlistId", payload.shortlistId);
  }
  if (payload.sessionId) {
    searchParams.set("sessionId", payload.sessionId);
  }

  const response = await fetch(`${API_BASE_URL}/closing-readiness?${searchParams.toString()}`, {
    headers: buildSessionHeaders(payload.sessionId)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Closing readiness fetch failed");
  }

  const body = await response.json();
  return body.record ?? null;
}

export async function fetchClosingReadiness(id: string): Promise<ClosingReadiness> {
  const response = await fetch(`${API_BASE_URL}/closing-readiness/${encodeURIComponent(id)}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Closing readiness fetch failed");
  }

  return response.json();
}

export async function updateClosingReadiness(
  id: string,
  patch: {
    targetClosingDate?: string | null;
    closingAppointmentAt?: string | null;
    closingAppointmentLocation?: string | null;
    closingAppointmentNotes?: string | null;
    finalReviewDeadline?: string | null;
    finalFundsConfirmationDeadline?: string | null;
    finalFundsAmountConfirmed?: number | null;
    notes?: string | null;
    internalActivityNote?: string | null;
  }
): Promise<ClosingReadiness> {
  const response = await fetch(`${API_BASE_URL}/closing-readiness/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(patch)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Closing readiness update failed");
  }

  return response.json();
}

export async function updateClosingChecklistItem(
  id: string,
  itemType: ClosingReadiness["checklistItemSummaries"][number]["itemType"],
  patch: {
    status?: ClosingReadiness["checklistItemSummaries"][number]["status"];
    deadline?: string | null;
    completedAt?: string | null;
    blockedReason?: string | null;
    notes?: string | null;
  }
): Promise<ClosingReadiness> {
  const response = await fetch(
    `${API_BASE_URL}/closing-readiness/${encodeURIComponent(id)}/checklist/${encodeURIComponent(itemType)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(patch)
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Closing checklist update failed");
  }

  return response.json();
}

export async function updateClosingMilestone(
  id: string,
  milestoneType: ClosingReadiness["milestoneSummaries"][number]["milestoneType"],
  patch: {
    status?: ClosingReadiness["milestoneSummaries"][number]["status"];
    occurredAt?: string | null;
    notes?: string | null;
  }
): Promise<ClosingReadiness> {
  const response = await fetch(
    `${API_BASE_URL}/closing-readiness/${encodeURIComponent(id)}/milestones/${encodeURIComponent(milestoneType)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(patch)
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Closing milestone update failed");
  }

  return response.json();
}

export async function markClosingReady(id: string): Promise<ClosingReadiness> {
  const response = await fetch(`${API_BASE_URL}/closing-readiness/${encodeURIComponent(id)}/mark-ready`, {
    method: "POST"
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Closing ready state update failed");
  }

  return response.json();
}

export async function markClosingComplete(id: string): Promise<ClosingReadiness> {
  const response = await fetch(`${API_BASE_URL}/closing-readiness/${encodeURIComponent(id)}/mark-closed`, {
    method: "POST"
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Closing completion update failed");
  }

  return response.json();
}

export async function fetchClosingReadinessSummary(
  id: string
): Promise<ClosingReadinessSummary> {
  const response = await fetch(`${API_BASE_URL}/closing-readiness/${encodeURIComponent(id)}/summary`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Closing readiness summary fetch failed");
  }

  return response.json();
}

export async function fetchTransactionCommandCenterSummary(payload: {
  propertyId: string;
  propertyAddressLabel?: string | null;
  shortlistId?: string | null;
  sessionId?: string | null;
}): Promise<BuyerTransactionCommandCenterView> {
  const searchParams = new URLSearchParams({
    propertyId: payload.propertyId
  });
  if (payload.propertyAddressLabel) {
    searchParams.set("propertyAddressLabel", payload.propertyAddressLabel);
  }
  if (payload.shortlistId) {
    searchParams.set("shortlistId", payload.shortlistId);
  }
  if (payload.sessionId) {
    searchParams.set("sessionId", payload.sessionId);
  }

  const response = await fetch(`${API_BASE_URL}/transaction-command-center?${searchParams.toString()}`, {
    headers: buildSessionHeaders(payload.sessionId)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Transaction command center fetch failed");
  }

  return response.json();
}

export async function fetchDecisionExplanations(payload: {
  moduleName: string;
  subjectType: string;
  subjectId: string;
  sessionId?: string | null;
}): Promise<DecisionExplanationBundle> {
  const searchParams = new URLSearchParams({
    moduleName: payload.moduleName,
    subjectType: payload.subjectType,
    subjectId: payload.subjectId
  });

  const response = await fetch(`${API_BASE_URL}/explanations?${searchParams.toString()}`, {
    headers: buildSessionHeaders(payload.sessionId)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Explanation fetch failed");
  }

  return response.json();
}

export async function fetchTransactionCommandCenterExplanations(payload: {
  propertyId: string;
  propertyAddressLabel?: string | null;
  shortlistId?: string | null;
  sessionId?: string | null;
}): Promise<DecisionExplanationBundle> {
  const searchParams = new URLSearchParams({
    propertyId: payload.propertyId
  });
  if (payload.propertyAddressLabel) {
    searchParams.set("propertyAddressLabel", payload.propertyAddressLabel);
  }
  if (payload.shortlistId) {
    searchParams.set("shortlistId", payload.shortlistId);
  }
  if (payload.sessionId) {
    searchParams.set("sessionId", payload.sessionId);
  }

  const response = await fetch(
    `${API_BASE_URL}/transaction-command-center/explanations?${searchParams.toString()}`,
    {
      headers: buildSessionHeaders(payload.sessionId)
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Command center explanation fetch failed");
  }

  return response.json();
}

export async function fetchWorkflowNotifications(payload: {
  sessionId?: string | null;
  propertyId?: string | null;
  shortlistId?: string | null;
  limit?: number;
}): Promise<WorkflowNotification[]> {
  const searchParams = new URLSearchParams();
  if (payload.sessionId) {
    searchParams.set("sessionId", payload.sessionId);
  }
  if (payload.propertyId) {
    searchParams.set("propertyId", payload.propertyId);
  }
  if (payload.shortlistId) {
    searchParams.set("shortlistId", payload.shortlistId);
  }
  if (payload.limit) {
    searchParams.set("limit", String(payload.limit));
  }

  const response = await fetch(`${API_BASE_URL}/notifications?${searchParams.toString()}`, {
    headers: buildSessionHeaders(payload.sessionId)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Notification fetch failed");
  }

  const payloadJson = await response.json();
  return payloadJson.notifications;
}

export async function fetchWorkflowNotificationHistory(payload: {
  sessionId?: string | null;
  propertyId?: string | null;
  shortlistId?: string | null;
  limit?: number;
}): Promise<WorkflowNotificationHistoryEvent[]> {
  const searchParams = new URLSearchParams();
  if (payload.sessionId) {
    searchParams.set("sessionId", payload.sessionId);
  }
  if (payload.propertyId) {
    searchParams.set("propertyId", payload.propertyId);
  }
  if (payload.shortlistId) {
    searchParams.set("shortlistId", payload.shortlistId);
  }
  if (payload.limit) {
    searchParams.set("limit", String(payload.limit));
  }

  const response = await fetch(`${API_BASE_URL}/notifications/history?${searchParams.toString()}`, {
    headers: buildSessionHeaders(payload.sessionId)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Notification history fetch failed");
  }

  const payloadJson = await response.json();
  return payloadJson.history;
}

export async function markWorkflowNotificationRead(id: string): Promise<WorkflowNotification> {
  const response = await fetch(`${API_BASE_URL}/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH"
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Notification read update failed");
  }

  return response.json();
}

export async function dismissWorkflowNotification(id: string): Promise<WorkflowNotification> {
  const response = await fetch(`${API_BASE_URL}/notifications/${encodeURIComponent(id)}/dismiss`, {
    method: "PATCH"
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Notification dismissal failed");
  }

  return response.json();
}

export async function createOfferReadiness(payload: {
  shortlistId: string;
  propertyId: string;
  status?: OfferReadiness["status"];
  financingReadiness?: OfferReadiness["inputs"]["financingReadiness"];
  propertyFitConfidence?: OfferReadiness["inputs"]["propertyFitConfidence"];
  riskToleranceAlignment?: OfferReadiness["inputs"]["riskToleranceAlignment"];
  riskLevel?: OfferReadiness["inputs"]["riskLevel"];
  userConfirmed?: boolean;
}): Promise<OfferReadiness> {
  const response = await fetch(`${API_BASE_URL}/offer-readiness`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Offer readiness creation failed");
  }

  return response.json();
}

export async function fetchOfferReadiness(
  propertyId: string,
  shortlistId?: string
): Promise<OfferReadiness> {
  const query = shortlistId ? `?shortlistId=${encodeURIComponent(shortlistId)}` : "";
  const response = await fetch(`${API_BASE_URL}/offer-readiness/${encodeURIComponent(propertyId)}${query}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Offer readiness fetch failed");
  }

  return response.json();
}

export async function updateOfferReadiness(
  id: string,
  patch: {
    status?: OfferReadiness["status"];
    financingReadiness?: OfferReadiness["inputs"]["financingReadiness"];
    propertyFitConfidence?: OfferReadiness["inputs"]["propertyFitConfidence"];
    riskToleranceAlignment?: OfferReadiness["inputs"]["riskToleranceAlignment"];
    riskLevel?: OfferReadiness["inputs"]["riskLevel"];
    userConfirmed?: boolean;
  }
): Promise<OfferReadiness> {
  const response = await fetch(`${API_BASE_URL}/offer-readiness/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(patch)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Offer readiness update failed");
  }

  return response.json();
}

export async function fetchOfferReadinessRecommendation(
  propertyId: string,
  shortlistId?: string
): Promise<OfferReadinessRecommendation> {
  const query = shortlistId ? `?shortlistId=${encodeURIComponent(shortlistId)}` : "";
  const response = await fetch(
    `${API_BASE_URL}/offer-readiness/${encodeURIComponent(propertyId)}/recommendation${query}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Offer recommendation fetch failed");
  }

  return response.json();
}

export async function addShortlistItem(
  shortlistId: string,
  payload: {
    canonicalPropertyId: string;
    sourceSnapshotId?: string | null;
    sourceHistoryId?: string | null;
    sourceSearchDefinitionId?: string | null;
    capturedHome: ShortlistItem["capturedHome"];
    reviewState?: ReviewState;
  }
): Promise<ShortlistItem> {
  const response = await fetch(`${API_BASE_URL}/shortlists/${shortlistId}/items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Shortlist item add failed");
  }

  return response.json();
}

export async function updateShortlistItem(
  shortlistId: string,
  itemId: string,
  patch: {
    reviewState: ReviewState;
  }
): Promise<ShortlistItem> {
  const response = await fetch(`${API_BASE_URL}/shortlists/${shortlistId}/items/${itemId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(patch)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Shortlist item update failed");
  }

  return response.json();
}

export async function deleteShortlistItem(shortlistId: string, itemId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/shortlists/${shortlistId}/items/${itemId}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Shortlist item delete failed");
  }
}

export async function createResultNote(payload: {
  sessionId?: string | null;
  entityType: ResultNote["entityType"];
  entityId: string;
  body: string;
}): Promise<ResultNote> {
  const response = await fetch(`${API_BASE_URL}/notes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildSessionHeaders(payload.sessionId)
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Note creation failed");
  }

  return response.json();
}

export async function fetchResultNotes(filters?: {
  sessionId?: string | null;
  entityType?: ResultNote["entityType"];
  entityId?: string;
}): Promise<ResultNote[]> {
  const params = new URLSearchParams();
  if (filters?.entityType) {
    params.set("entityType", filters.entityType);
  }
  if (filters?.entityId) {
    params.set("entityId", filters.entityId);
  }
  const response = await fetch(`${API_BASE_URL}/notes${params.toString() ? `?${params}` : ""}`, {
    headers: buildSessionHeaders(filters?.sessionId)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Notes fetch failed");
  }

  const payload = await response.json();
  return payload.notes;
}

export async function updateResultNote(id: string, body: string): Promise<ResultNote> {
  const response = await fetch(`${API_BASE_URL}/notes/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ body })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Note update failed");
  }

  return response.json();
}

export async function deleteResultNote(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/notes/${id}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Note delete failed");
  }
}

export async function createSharedComment(payload: {
  shareId: string;
  entityType: SharedComment["entityType"];
  entityId: string;
  authorLabel?: string | null;
  body: string;
}): Promise<SharedComment> {
  const response = await fetch(`${API_BASE_URL}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Shared comment creation failed");
  }

  return response.json();
}

export async function fetchSharedComments(filters: {
  shareId: string;
  entityType?: SharedComment["entityType"];
  entityId?: string;
}): Promise<SharedComment[]> {
  const params = new URLSearchParams();
  params.set("shareId", filters.shareId);
  if (filters.entityType) {
    params.set("entityType", filters.entityType);
  }
  if (filters.entityId) {
    params.set("entityId", filters.entityId);
  }

  const response = await fetch(`${API_BASE_URL}/comments?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Shared comments fetch failed");
  }

  const payload = await response.json();
  return payload.comments;
}

export async function updateSharedComment(
  id: string,
  payload: {
    authorLabel?: string | null;
    body: string;
  }
): Promise<SharedComment> {
  const response = await fetch(`${API_BASE_URL}/comments/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Shared comment update failed");
  }

  return response.json();
}

export async function deleteSharedComment(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/comments/${id}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Shared comment delete failed");
  }
}

export async function createReviewerDecision(payload: {
  shareId: string;
  shortlistItemId: string;
  decision: ReviewerDecisionValue;
  note?: string | null;
}): Promise<ReviewerDecision> {
  const response = await fetch(`${API_BASE_URL}/reviewer-decisions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Reviewer decision save failed");
  }

  return response.json();
}

export async function fetchReviewerDecisions(filters: {
  shareId: string;
  shortlistItemId?: string;
}): Promise<ReviewerDecision[]> {
  const params = new URLSearchParams();
  params.set("shareId", filters.shareId);
  if (filters.shortlistItemId) {
    params.set("shortlistItemId", filters.shortlistItemId);
  }

  const response = await fetch(`${API_BASE_URL}/reviewer-decisions?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Reviewer decisions fetch failed");
  }

  const payload = await response.json();
  return payload.decisions;
}

export async function updateReviewerDecision(
  id: string,
  patch: {
    decision?: ReviewerDecisionValue;
    note?: string | null;
  }
): Promise<ReviewerDecision> {
  const response = await fetch(`${API_BASE_URL}/reviewer-decisions/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(patch)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Reviewer decision update failed");
  }

  return response.json();
}

export async function deleteReviewerDecision(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/reviewer-decisions/${id}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Reviewer decision delete failed");
  }
}

export async function fetchCollaborationActivity(filters: {
  shareId?: string;
  shortlistId?: string;
  limit?: number;
}): Promise<CollaborationActivityRecord[]> {
  const params = new URLSearchParams();
  if (filters.shareId) {
    params.set("shareId", filters.shareId);
  }
  if (filters.shortlistId) {
    params.set("shortlistId", filters.shortlistId);
  }
  if (typeof filters.limit === "number") {
    params.set("limit", String(filters.limit));
  }

  const response = await fetch(`${API_BASE_URL}/collaboration/activity?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Collaboration activity fetch failed");
  }

  const payload = await response.json();
  return payload.activity;
}

export async function fetchWorkflowActivity(
  sessionId?: string | null,
  limit = 12
): Promise<WorkflowActivityRecord[]> {
  const response = await fetch(`${API_BASE_URL}/workflow/activity?limit=${limit}`, {
    headers: buildSessionHeaders(sessionId)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Workflow activity fetch failed");
  }

  const payload = await response.json();
  return payload.activity;
}

export async function fetchUnifiedActivity(payload: {
  sessionId?: string | null;
  propertyId?: string | null;
  shortlistId?: string | null;
  limit?: number;
}): Promise<UnifiedActivityRecord[]> {
  const params = new URLSearchParams();
  if (payload.propertyId) {
    params.set("propertyId", payload.propertyId);
  }
  if (payload.shortlistId) {
    params.set("shortlistId", payload.shortlistId);
  }
  if (payload.limit) {
    params.set("limit", String(payload.limit));
  }

  const response = await fetch(`${API_BASE_URL}/activity?${params.toString()}`, {
    headers: buildSessionHeaders(payload.sessionId)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Unified activity fetch failed");
  }

  const result = await response.json();
  return result.activity;
}

export async function fetchUnifiedActivityHistory(payload: {
  sessionId?: string | null;
  propertyId?: string | null;
  shortlistId?: string | null;
  limit?: number;
}): Promise<UnifiedActivityRecord[]> {
  const params = new URLSearchParams();
  if (payload.propertyId) {
    params.set("propertyId", payload.propertyId);
  }
  if (payload.shortlistId) {
    params.set("shortlistId", payload.shortlistId);
  }
  if (payload.limit) {
    params.set("limit", String(payload.limit));
  }

  const response = await fetch(`${API_BASE_URL}/activity/history?${params.toString()}`, {
    headers: buildSessionHeaders(payload.sessionId)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Unified activity history fetch failed");
  }

  const result = await response.json();
  return result.activity;
}

export async function submitFeedback(payload: {
  sessionId?: string | null;
  snapshotId?: string | null;
  historyRecordId?: string | null;
  searchDefinitionId?: string | null;
  category: FeedbackCategory;
  value: FeedbackRecord["value"];
  comment?: string | null;
}): Promise<FeedbackRecord> {
  const response = await fetch(`${API_BASE_URL}/feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildSessionHeaders(payload.sessionId)
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Feedback submission failed");
  }

  return response.json();
}

export async function recordValidationEvent(payload: {
  eventName: ValidationEventRecord["eventName"];
  sessionId?: string | null;
  snapshotId?: string | null;
  historyRecordId?: string | null;
  searchDefinitionId?: string | null;
  demoScenarioId?: string | null;
  payload?: Record<string, unknown> | null;
}): Promise<ValidationEventRecord> {
  const response = await fetch(`${API_BASE_URL}/validation/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildSessionHeaders(payload.sessionId)
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Validation event record failed");
  }

  return response.json();
}

export async function fetchValidationSummary(): Promise<ValidationSummary> {
  const response = await fetch(`${API_BASE_URL}/validation/summary`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Validation summary fetch failed");
  }

  return response.json();
}

export async function createPilotPartner(payload: {
  name: string;
  slug: string;
  planTier?: PilotPartner["planTier"];
  status?: PilotPartnerStatus;
  contactLabel?: string | null;
  notes?: string | null;
  featureOverrides?: Partial<PilotFeatureOverrides>;
}): Promise<PilotPartner> {
  const response = await fetch(`${API_BASE_URL}/ops/pilots`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Pilot partner creation failed");
  }
  return response.json();
}

export async function fetchPilotPartners(): Promise<PilotPartner[]> {
  const response = await fetch(`${API_BASE_URL}/ops/pilots`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Pilot partner fetch failed");
  }
  const payload = await response.json();
  return payload.partners;
}

export async function fetchPilotLinks(partnerId?: string): Promise<PilotLinkRecord[]> {
  const params = new URLSearchParams();
  if (partnerId) {
    params.set("partnerId", partnerId);
  }

  const response = await fetch(`${API_BASE_URL}/pilot/links?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Pilot link fetch failed");
  }

  const payload = await response.json();
  return payload.links;
}

export async function updatePilotPartner(
  id: string,
  patch: {
    name?: string;
    planTier?: PilotPartner["planTier"];
    status?: PilotPartnerStatus;
    contactLabel?: string | null;
    notes?: string | null;
    featureOverrides?: Partial<PilotFeatureOverrides>;
  }
): Promise<PilotPartner> {
  const response = await fetch(`${API_BASE_URL}/ops/pilots/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(patch)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Pilot partner update failed");
  }
  return response.json();
}

export async function createPilotLink(payload: {
  partnerId: string;
  expiresInDays?: number;
  allowedFeatures?: Partial<PilotFeatureOverrides>;
}): Promise<{ link: PilotLinkRecord; url: string }> {
  const response = await fetch(`${API_BASE_URL}/pilot/links`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Pilot link creation failed");
  }
  return response.json();
}

export async function fetchPilotLink(token: string): Promise<PilotLinkView> {
  const response = await fetch(`${API_BASE_URL}/pilot/links/${token}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Pilot link fetch failed");
  }
  return response.json();
}

export async function revokePilotLink(token: string): Promise<PilotLinkRecord> {
  const response = await fetch(`${API_BASE_URL}/pilot/links/${token}/revoke`, {
    method: "POST"
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Pilot link revoke failed");
  }
  const payload = await response.json();
  return payload.link;
}

export async function fetchOpsSummary(): Promise<{
  summary: OpsSummary;
  performance: {
    averageSearchLatencyMs: number;
    p95SearchLatencyMs: number;
    providerCallCountByType: SearchMetrics["providerCallCountByType"];
    cacheHitRate: SearchMetrics["cacheHitRate"];
    liveFetchBudgetExhaustionCount: SearchMetrics["liveFetchBudgetExhaustionCount"];
    heavyEndpointReadCounts: SearchMetrics["heavyEndpointReadCounts"];
  } | null;
  reliability: ReliabilityStateSummary | null;
  dataQualitySummary: DataQualitySummary;
  goLiveCheck: GoLiveCheckSummary;
  support: SupportContextSummary;
  releaseSummary: ReleaseSummary;
  errors: SearchMetrics["errorRateByCategory"];
  providers: unknown[];
}> {
  const response = await fetch(`${API_BASE_URL}/ops/summary`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Ops summary fetch failed");
  }
  return response.json();
}

export async function fetchDataQualitySummary(): Promise<DataQualitySummary> {
  const response = await fetch(`${API_BASE_URL}/ops/data-quality/summary`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Data quality summary fetch failed");
  }
  const payload = await response.json();
  return payload.summary;
}

export async function fetchDataQualityEvents(filters?: {
  severity?: DataQualityEvent["severity"];
  sourceDomain?: DataQualityEvent["sourceDomain"];
  provider?: string;
  partnerId?: string;
  status?: DataQualityEvent["status"];
  limit?: number;
}): Promise<DataQualityEvent[]> {
  const params = new URLSearchParams();
  if (filters?.severity) {
    params.set("severity", filters.severity);
  }
  if (filters?.sourceDomain) {
    params.set("sourceDomain", filters.sourceDomain);
  }
  if (filters?.provider) {
    params.set("provider", filters.provider);
  }
  if (filters?.partnerId) {
    params.set("partnerId", filters.partnerId);
  }
  if (filters?.status) {
    params.set("status", filters.status);
  }
  if (filters?.limit) {
    params.set("limit", String(filters.limit));
  }
  const query = params.toString();
  const response = await fetch(`${API_BASE_URL}/ops/data-quality${query ? `?${query}` : ""}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Data quality events fetch failed");
  }
  const payload = await response.json();
  return payload.events;
}

export async function updateDataQualityEventStatus(
  eventId: string,
  status: "acknowledged" | "resolved" | "ignored"
): Promise<DataQualityEvent> {
  const response = await fetch(`${API_BASE_URL}/ops/data-quality/${eventId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ status })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Data quality event update failed");
  }
  return response.json();
}

export async function fetchOpsErrors(): Promise<{
  errors: SearchMetrics["errorRateByCategory"];
}> {
  const response = await fetch(`${API_BASE_URL}/ops/errors`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Ops errors fetch failed");
  }
  return response.json();
}

export async function fetchPilotActivity(partnerId: string): Promise<PilotActivityRecord[]> {
  const response = await fetch(`${API_BASE_URL}/ops/pilots/${partnerId}/activity`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Pilot activity fetch failed");
  }
  const payload = await response.json();
  return payload.activity;
}

export async function fetchOpsActions(partnerId?: string): Promise<OpsActionRecord[]> {
  const params = new URLSearchParams();
  if (partnerId) {
    params.set("partnerId", partnerId);
  }
  const response = await fetch(`${API_BASE_URL}/ops/actions?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Ops actions fetch failed");
  }
  const payload = await response.json();
  return payload.actions;
}

export async function rerunSearchDefinition(
  id: string,
  sessionId?: string | null,
  createSnapshot = false
): Promise<SearchResponse> {
  const response = await fetch(`${API_BASE_URL}/search/definitions/${id}/rerun`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildSessionHeaders(sessionId)
    },
    body: JSON.stringify({ sessionId, createSnapshot })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Saved search rerun failed");
  }

  return response.json();
}

export async function rerunSearchHistory(
  id: string,
  sessionId?: string | null,
  createSnapshot = false
): Promise<SearchResponse> {
  const response = await fetch(`${API_BASE_URL}/search/history/${id}/rerun`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildSessionHeaders(sessionId)
    },
    body: JSON.stringify({ sessionId, createSnapshot })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "History rerun failed");
  }

  return response.json();
}

export async function trackUiMetric(
  eventType:
    | "comparison_view"
    | "explainability_render"
    | "search_restore"
    | "recent_activity_panel_view"
    | "onboarding_view"
    | "onboarding_dismiss"
    | "empty_state_view"
    | "suggestion_click"
    | "detail_panel_open"
    | "result_compare_add"
    | "snapshot_reopen"
    | "saved_search_restore"
    | "validation_prompt_view"
    | "validation_prompt_response"
    | "demo_scenario_start"
    | "walkthrough_view"
    | "walkthrough_dismiss"
    | "export_use"
    | "cta_click"
    | "historical_compare_view"
): Promise<void> {
  await fetch(`${API_BASE_URL}/metrics/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ eventType })
  });
}
