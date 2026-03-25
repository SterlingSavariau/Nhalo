import type { SearchSnapshotRecord } from "@nhalo/types";

export interface BrandingConfig {
  appName: string;
  tagline: string;
  pilotCtaLabel: string;
  pilotCtaUrl: string | null;
  enableDemoMode: boolean;
  enableSharedExports: boolean;
  enablePilotCta: boolean;
  enableShortlists: boolean;
  enableResultNotes: boolean;
  enableHistoricalCompare: boolean;
  enableSharedShortlists: boolean;
  enableSharedComments: boolean;
  enableReviewerDecisions: boolean;
  enablePilotOps: boolean;
  enableInternalOpsUi: boolean;
  enablePilotLinks: boolean;
  sharedNoIndex: boolean;
}

export interface PageMetadata {
  title: string;
  description: string;
  openGraphTitle: string;
  openGraphDescription: string;
  noIndex: boolean;
}

export function getBrandingConfig(
  env: Record<string, string | boolean | undefined> = import.meta.env as Record<string, string | boolean | undefined>
): BrandingConfig {
  return {
    appName: String(env.VITE_APP_NAME ?? "Nhalo"),
    tagline: String(
      env.VITE_APP_TAGLINE ?? "Find homes your family can afford, live in, and feel safe in."
    ),
    pilotCtaLabel: String(env.VITE_PILOT_CTA_LABEL ?? "Request pilot access"),
    pilotCtaUrl:
      typeof env.VITE_PILOT_CTA_URL === "string" && env.VITE_PILOT_CTA_URL.trim().length > 0
        ? env.VITE_PILOT_CTA_URL.trim()
        : null,
    enableDemoMode: String(env.VITE_ENABLE_DEMO_MODE ?? "true") === "true",
    enableSharedExports: String(env.VITE_ENABLE_SHARED_EXPORTS ?? "true") === "true",
    enablePilotCta: String(env.VITE_ENABLE_PILOT_CTA ?? "false") === "true",
    enableShortlists: String(env.VITE_ENABLE_SHORTLISTS ?? "true") === "true",
    enableResultNotes: String(env.VITE_ENABLE_RESULT_NOTES ?? "true") === "true",
    enableHistoricalCompare: String(env.VITE_ENABLE_HISTORICAL_COMPARE ?? "true") === "true",
    enableSharedShortlists: String(env.VITE_ENABLE_SHARED_SHORTLISTS ?? "true") === "true",
    enableSharedComments: String(env.VITE_ENABLE_SHARED_COMMENTS ?? "true") === "true",
    enableReviewerDecisions: String(env.VITE_ENABLE_REVIEWER_DECISIONS ?? "true") === "true",
    enablePilotOps: String(env.VITE_ENABLE_PILOT_OPS ?? "false") === "true",
    enableInternalOpsUi: String(env.VITE_ENABLE_INTERNAL_OPS_UI ?? "false") === "true",
    enablePilotLinks: String(env.VITE_ENABLE_PILOT_LINKS ?? "false") === "true",
    sharedNoIndex: String(env.VITE_SHARED_NOINDEX ?? "true") === "true"
  };
}

export function buildSharedSnapshotMetadata(
  snapshot: SearchSnapshotRecord,
  branding: BrandingConfig
): PageMetadata {
  const topHome = snapshot.response.homes[0];
  const title = `${branding.appName} snapshot: ${snapshot.request.locationValue}`;
  const description = topHome
    ? `${snapshot.response.metadata.returnedCount} ranked homes. Top result: ${topHome.address} with Nhalo ${topHome.scores.nhalo}.`
    : `${snapshot.response.metadata.returnedCount} ranked homes for ${snapshot.request.locationValue}.`;

  return {
    title,
    description,
    openGraphTitle: title,
    openGraphDescription: description,
    noIndex: branding.sharedNoIndex
  };
}

function upsertMetaTag(attribute: "name" | "property", key: string, content: string): void {
  if (typeof document === "undefined") {
    return;
  }

  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

export function applyPageMetadata(metadata: PageMetadata): void {
  if (typeof document === "undefined") {
    return;
  }

  document.title = metadata.title;
  upsertMetaTag("name", "description", metadata.description);
  upsertMetaTag("property", "og:title", metadata.openGraphTitle);
  upsertMetaTag("property", "og:description", metadata.openGraphDescription);
  upsertMetaTag("name", "robots", metadata.noIndex ? "noindex, nofollow" : "index, follow");
}
