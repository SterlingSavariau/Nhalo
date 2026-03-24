import type {
  ScoreAuditRecord,
  SearchDefinition,
  SearchHistoryRecord,
  SearchRequest,
  SearchResponse,
  SearchSnapshotRecord
} from "@nhalo/types";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

function buildSessionHeaders(sessionId?: string | null): Record<string, string> {
  return sessionId ? { "x-nhalo-session-id": sessionId } : {};
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
): Promise<void> {
  await fetch(`${API_BASE_URL}/metrics/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ eventType })
  });
}
