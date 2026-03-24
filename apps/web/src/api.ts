import type { ScoreAuditRecord, SearchRequest, SearchResponse, SearchSnapshotRecord } from "@nhalo/types";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function searchHomes(payload: SearchRequest): Promise<SearchResponse> {
  const response = await fetch(`${API_BASE_URL}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
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
}): Promise<SearchSnapshotRecord> {
  const response = await fetch(`${API_BASE_URL}/search/snapshots`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
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

export async function trackUiMetric(eventType: "comparison_view" | "explainability_render"): Promise<void> {
  await fetch(`${API_BASE_URL}/metrics/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ eventType })
  });
}
