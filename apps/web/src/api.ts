import type { SearchRequest, SearchResponse } from "@nhalo/types";

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
