import { resetConfigCache } from "@nhalo/config";
import {
  InMemoryGeocodeCacheRepository,
  InMemoryListingCacheRepository,
  InMemoryMarketSnapshotRepository,
  InMemorySafetySignalCacheRepository,
  InMemorySearchRepository
} from "@nhalo/db";
import { createMockProviders } from "@nhalo/providers";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { MetricsCollector } from "../src/metrics";

const ORIGINAL_ENV = { ...process.env };

describe("pilot operations", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetConfigCache();
  });

  it("supports pilot partners, links, summaries, activity, and safe revocation", async () => {
    process.env.ENABLE_PILOT_OPS = "true";
    process.env.ENABLE_PILOT_LINKS = "true";
    process.env.VALIDATION_MODE = "true";
    process.env.ENABLE_DEMO_SCENARIOS = "true";
    process.env.ENABLE_PLAN_CAPABILITIES = "true";
    process.env.ENABLE_USAGE_FUNNEL_SUMMARY = "true";
    process.env.ENABLE_USAGE_FRICTION_SUMMARY = "true";
    resetConfigCache();

    const providers = createMockProviders();
    providers.geocoder.getStatus = async () => ({
      provider: "GeocoderProvider",
      providerName: "GeocoderProvider",
      status: "degraded",
      lastUpdatedAt: new Date().toISOString(),
      dataAgeHours: 2,
      latencyMs: 90,
      failureCount: 1,
      mode: "mock",
      detail: "pilot degraded test"
    });

    const app = await buildApp({
      repository: new InMemorySearchRepository(),
      marketSnapshotRepository: new InMemoryMarketSnapshotRepository(),
      safetySignalCacheRepository: new InMemorySafetySignalCacheRepository(),
      listingCacheRepository: new InMemoryListingCacheRepository(),
      geocodeCacheRepository: new InMemoryGeocodeCacheRepository(),
      providers,
      metrics: new MetricsCollector()
    });

    const createPartner = await app.inject({
      method: "POST",
      url: "/ops/pilots",
      payload: {
        name: "Acme Pilot",
        slug: "acme-pilot",
        planTier: "partner",
        featureOverrides: {
          demoModeEnabled: false,
          feedbackEnabled: true
        }
      }
    });
    expect(createPartner.statusCode).toBe(201);
    const partner = createPartner.json();

    const createLink = await app.inject({
      method: "POST",
      url: "/pilot/links",
      payload: {
        partnerId: partner.id
      }
    });
    expect(createLink.statusCode).toBe(201);
    const linkPayload = createLink.json();
    const token = linkPayload.link.token;

    const openLink = await app.inject({
      method: "GET",
      url: `/pilot/links/${token}`
    });
    expect(openLink.statusCode).toBe(200);
    expect(openLink.json().context.partnerId).toBe(partner.id);
    expect(openLink.json().context.planTier).toBe("partner");
    expect(openLink.json().context.allowedFeatures.demoModeEnabled).toBe(false);
    expect(openLink.json().context.capabilities.canUseCollaboration).toBe(true);

    const demoBlocked = await app.inject({
      method: "GET",
      url: "/validation/demo-scenarios",
      headers: {
        "x-nhalo-pilot-link-id": token
      }
    });
    expect(demoBlocked.statusCode).toBe(403);
    expect(demoBlocked.json().error.code).toBe("PILOT_FEATURE_DISABLED");

    const searchResponse = await app.inject({
      method: "POST",
      url: "/search",
      headers: {
        "x-nhalo-pilot-link-id": token,
        "x-nhalo-session-id": "pilot-session"
      },
      payload: {
        locationType: "city",
        locationValue: "Southfield, MI",
        radiusMiles: 5,
        budget: { max: 425000 },
        minSqft: 1800,
        minBedrooms: 3
      }
    });
    expect(searchResponse.statusCode).toBe(200);

    const updatePartner = await app.inject({
      method: "PATCH",
      url: `/ops/pilots/${partner.id}`,
      payload: {
        status: "paused",
        featureOverrides: {
          sharedSnapshotsEnabled: false
        }
      }
    });
    expect(updatePartner.statusCode).toBe(200);
    expect(updatePartner.json().status).toBe("paused");

    const partnerDetail = await app.inject({
      method: "GET",
      url: `/ops/pilots/${partner.id}`
    });
    expect(partnerDetail.statusCode).toBe(200);
    expect(partnerDetail.json().effectiveCapabilities.planTier).toBe("partner");
    expect(partnerDetail.json().links).toHaveLength(1);
    expect(partnerDetail.json().actions.length).toBeGreaterThanOrEqual(2);

    const activityResponse = await app.inject({
      method: "GET",
      url: `/ops/pilots/${partner.id}/activity`
    });
    expect(activityResponse.statusCode).toBe(200);
    expect(
      activityResponse
        .json()
        .activity.map((entry: { eventType: string }) => entry.eventType)
    ).toEqual(
      expect.arrayContaining([
        "pilot_link_created",
        "pilot_link_opened",
        "partner_updated",
        "provider_degraded_during_pilot"
      ])
    );

    const summaryResponse = await app.inject({
      method: "GET",
      url: "/ops/summary"
    });
    expect(summaryResponse.statusCode).toBe(200);
    expect(summaryResponse.json().summary.activePilotPartners).toBe(0);
    expect(summaryResponse.json().summary.pilotLinkCounts.total).toBe(1);

    const usageFunnelResponse = await app.inject({
      method: "GET",
      url: "/ops/usage-funnel"
    });
    expect(usageFunnelResponse.statusCode).toBe(200);
    expect(
      usageFunnelResponse
        .json()
        .funnel.steps.find((step: { key: string }) => step.key === "search_started")?.count
    ).toBeGreaterThanOrEqual(1);

    const usageFrictionResponse = await app.inject({
      method: "GET",
      url: "/ops/usage-friction"
    });
    expect(usageFrictionResponse.statusCode).toBe(200);
    expect(usageFrictionResponse.json().friction.emptyResultRateBySearchType.city.searches).toBeGreaterThanOrEqual(1);

    const planSummaryResponse = await app.inject({
      method: "GET",
      url: "/ops/plans/summary"
    });
    expect(planSummaryResponse.statusCode).toBe(200);
    expect(planSummaryResponse.json().summary.planDistribution.partner).toBeGreaterThanOrEqual(1);

    const partnerUsageResponse = await app.inject({
      method: "GET",
      url: `/ops/partners/${partner.id}/usage`
    });
    expect(partnerUsageResponse.statusCode).toBe(200);
    expect(partnerUsageResponse.json().usage.planTier).toBe("partner");

    const revokeLink = await app.inject({
      method: "POST",
      url: `/pilot/links/${token}/revoke`
    });
    expect(revokeLink.statusCode).toBe(200);
    expect(revokeLink.json().link.status).toBe("revoked");

    const revokedOpen = await app.inject({
      method: "GET",
      url: `/pilot/links/${token}`
    });
    expect(revokedOpen.statusCode).toBe(410);

    const metricsResponse = await app.inject({
      method: "GET",
      url: "/metrics"
    });
    expect(metricsResponse.statusCode).toBe(200);
    expect(metricsResponse.json().pilotPartnerCreateCount).toBe(1);
    expect(metricsResponse.json().pilotLinkCreateCount).toBe(1);
    expect(metricsResponse.json().pilotLinkOpenCount).toBe(1);
    expect(metricsResponse.json().pilotLinkRevokeCount).toBe(1);
    expect(metricsResponse.json().opsSummaryReadCount).toBe(1);
    expect(metricsResponse.json().usageFunnelReadCount).toBe(1);
    expect(metricsResponse.json().usageFrictionReadCount).toBe(1);
    expect(metricsResponse.json().planSummaryReadCount).toBe(1);
    expect(metricsResponse.json().partnerUsageSummaryReadCount).toBe(1);
    expect(metricsResponse.json().planCapabilityResolutionCount).toBe(1);
    expect(metricsResponse.json().pilotActivityReadCount).toBe(1);
    expect(metricsResponse.json().providerDegradedDuringPilotCount).toBe(1);
    expect(metricsResponse.json().partnerFeatureOverrideCount).toBeGreaterThanOrEqual(2);

    await app.close();
  });

  it("hides ops surfaces when pilot ops are disabled", async () => {
    process.env.ENABLE_PILOT_OPS = "false";
    process.env.ENABLE_PILOT_LINKS = "false";
    resetConfigCache();

    const app = await buildApp({
      repository: new InMemorySearchRepository(),
      marketSnapshotRepository: new InMemoryMarketSnapshotRepository(),
      safetySignalCacheRepository: new InMemorySafetySignalCacheRepository(),
      listingCacheRepository: new InMemoryListingCacheRepository(),
      geocodeCacheRepository: new InMemoryGeocodeCacheRepository(),
      providers: createMockProviders(),
      metrics: new MetricsCollector()
    });

    const opsResponse = await app.inject({
      method: "GET",
      url: "/ops/summary"
    });
    expect(opsResponse.statusCode).toBe(404);
    expect(opsResponse.json().error.code).toBe("FEATURE_DISABLED");

    const linkResponse = await app.inject({
      method: "POST",
      url: "/pilot/links",
      payload: {
        partnerId: "partner-1"
      }
    });
    expect(linkResponse.statusCode).toBe(404);
    expect(linkResponse.json().error.code).toBe("FEATURE_DISABLED");

    await app.close();
  });

  it("enforces configured saved-search limits with an explicit error", async () => {
    process.env.ENABLE_PLAN_CAPABILITIES = "true";
    process.env.MAX_SAVED_SEARCHES_PER_SESSION = "1";
    resetConfigCache();

    const app = await buildApp({
      repository: new InMemorySearchRepository(),
      marketSnapshotRepository: new InMemoryMarketSnapshotRepository(),
      safetySignalCacheRepository: new InMemorySafetySignalCacheRepository(),
      listingCacheRepository: new InMemoryListingCacheRepository(),
      geocodeCacheRepository: new InMemoryGeocodeCacheRepository(),
      providers: createMockProviders(),
      metrics: new MetricsCollector()
    });

    const payload = {
      sessionId: "limit-session",
      label: "First search",
      request: {
        locationType: "city",
        locationValue: "Southfield, MI",
        radiusMiles: 5,
        propertyTypes: ["single_family", "condo", "townhome"],
        preferences: [],
        weights: {
          price: 40,
          size: 30,
          safety: 30
        }
      }
    };

    const firstCreate = await app.inject({
      method: "POST",
      url: "/search/definitions",
      payload
    });
    expect(firstCreate.statusCode).toBe(201);

    const limitedCreate = await app.inject({
      method: "POST",
      url: "/search/definitions",
      payload: {
        ...payload,
        label: "Second search"
      }
    });
    expect(limitedCreate.statusCode).toBe(403);
    expect(limitedCreate.json().error.code).toBe("CAPABILITY_LIMIT_HIT");

    const metricsResponse = await app.inject({
      method: "GET",
      url: "/metrics"
    });
    expect(metricsResponse.statusCode).toBe(200);
    expect(metricsResponse.json().capabilityLimitHitCount).toBe(1);

    await app.close();
  });
});
