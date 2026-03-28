import { FORMULA_VERSION, type AppConfig } from "@nhalo/config";
import type {
  BackgroundJobStatus,
  BuildMetadata,
  DependencyClassification,
  DependencyReadinessRecord,
  ProviderStatus,
  ReliabilityIncident,
  ReliabilityIncidentStatus,
  ReliabilityStateSummary,
  RuntimeReliabilityState,
  SearchProviderUsage
} from "@nhalo/types";
import { MetricsCollector } from "./metrics";

type ConditionImpact = Exclude<RuntimeReliabilityState, "healthy">;

type ReliabilityCondition = {
  key: string;
  impact: ConditionImpact;
  message: string;
  category: string;
  severity: ReliabilityIncident["severity"];
  provider?: string | null;
  partnerId?: string | null;
  context?: Record<string, unknown> | null;
};

type ReliabilityIncidentFilters = {
  status?: ReliabilityIncidentStatus;
  category?: string;
  provider?: string;
  limit?: number;
};

export function classifyStartupDependencies(payload: {
  config: AppConfig;
  persistenceMode: "memory" | "prisma";
  readiness: {
    database: boolean;
    cache: boolean;
  };
  providers: ProviderStatus[];
}): DependencyReadinessRecord[] {
  const productionLike = payload.config.deployment.environmentBehavior.productionLike;
  const dependencies: DependencyReadinessRecord[] = [
    {
      name: "database",
      classification: productionLike ? "required" : "optional",
      status: payload.readiness.database ? "healthy" : "unavailable",
      detail: payload.readiness.database
        ? `${payload.persistenceMode} persistence ready`
        : "Primary persistence is unavailable"
    },
    {
      name: "cache",
      classification: "optional",
      status: payload.readiness.cache ? "healthy" : "degraded",
      detail: payload.readiness.cache ? "Cache layer ready" : "Cache layer degraded"
    },
    {
      name: "ops_surfaces",
      classification: "internal_only",
      status: payload.config.ops.pilotOpsEnabled ? "healthy" : "degraded",
      detail: payload.config.ops.pilotOpsEnabled ? "Internal ops enabled" : "Internal ops disabled by config"
    },
    {
      name: "background_jobs",
      classification: "background",
      status: payload.config.deployment.backgroundJobsEnabled ? "healthy" : "degraded",
      detail: payload.config.deployment.backgroundJobsEnabled
        ? "Background jobs enabled"
        : "Background jobs disabled"
    }
  ];

  for (const status of payload.providers) {
    dependencies.push({
      name: status.providerName,
      classification: "optional",
      status:
        status.status === "healthy"
          ? "healthy"
          : status.status === "degraded"
            ? "degraded"
            : "unavailable",
      detail: status.detail ?? status.status
    });
  }

  return dependencies;
}

function createBuildMetadata(config: AppConfig): BuildMetadata {
  return {
    appVersion: config.deployment.buildMetadata.appVersion,
    buildId: config.deployment.buildMetadata.buildId,
    gitSha: config.deployment.buildMetadata.gitSha,
    buildTimestamp: config.deployment.buildMetadata.buildTimestamp,
    environment: config.runtimeEnvironment,
    profile: config.deployment.profile,
    formulaVersions: [FORMULA_VERSION]
  };
}

export class ReliabilityManager {
  private readonly conditions = new Map<string, ReliabilityCondition>();
  private readonly incidents: ReliabilityIncident[] = [];
  private readonly backgroundJobs = new Map<string, BackgroundJobStatus>();
  private dependencies: DependencyReadinessRecord[] = [];
  private state: RuntimeReliabilityState = "healthy";
  private reasons: string[] = [];
  private cacheOnlyMode = false;
  private readOnlyMode = false;

  constructor(
    private readonly config: AppConfig,
    private readonly metrics: MetricsCollector
  ) {}

  getBuildMetadata(): BuildMetadata {
    return createBuildMetadata(this.config);
  }

  initializeDependencies(dependencies: DependencyReadinessRecord[]): ReliabilityStateSummary {
    this.dependencies = dependencies;

    const database = dependencies.find((entry) => entry.name === "database");
    if (database?.classification === "required" && database.status !== "healthy") {
      this.clearCondition("database_degraded");
      this.setCondition({
        key: "database_unavailable",
        impact: "startup_blocked",
        category: "database_unavailable",
        severity: "critical",
        message: "Required database dependency is unavailable.",
        context: {
          detail: database.detail
        }
      });
    } else if (database?.status !== "healthy") {
      this.clearCondition("database_unavailable");
      this.setCondition({
        key: "database_degraded",
        impact: "read_only_degraded",
        category: "database_degraded",
        severity: "error",
        message: "Persistence is degraded; mutable operations may be blocked.",
        context: {
          detail: database?.detail ?? "unavailable"
        }
      });
    } else {
      this.clearCondition("database_unavailable");
      this.clearCondition("database_degraded");
    }

    const unhealthyProviders = dependencies.filter(
      (entry) => entry.classification === "optional" && entry.name !== "cache" && entry.status !== "healthy"
    );
    if (unhealthyProviders.length > 0) {
      this.setCondition({
        key: "optional_provider_degraded",
        impact: "degraded",
        category: "provider_startup_degraded",
        severity: "warn",
        message: "One or more optional providers started in a degraded state.",
        context: {
          providers: unhealthyProviders.map((entry) => ({
            name: entry.name,
            status: entry.status
          }))
        }
      });
    } else {
      this.clearCondition("optional_provider_degraded");
    }

    return this.snapshot();
  }

  canWrite(): boolean {
    return this.state !== "startup_blocked" && !this.readOnlyMode;
  }

  noteProviderUsage(usage?: SearchProviderUsage): void {
    if (!usage) {
      return;
    }

    const outageFallback =
      usage.geocoderStaleFallbacks +
        usage.listingStaleFallbacks +
        usage.safetyStaleFallbacks >
        0 ||
      usage.geocoderBudgetExceeded ||
      usage.listingBudgetExceeded ||
      usage.safetyBudgetExceeded;

    if (outageFallback) {
      this.metrics.recordProviderOutageFallback();
      this.setCondition({
        key: "provider_outage_fallback",
        impact: "degraded",
        category: "provider_outage_fallback",
        severity: "warn",
        message: "Searches are relying on cached or budget-exhaustion provider fallbacks.",
        context: {
          usage
        }
      });
    } else {
      this.clearCondition("provider_outage_fallback");
    }

    const cacheOnly =
      usage.geocoderLiveFetches + usage.listingLiveFetches + usage.safetyLiveFetches === 0 &&
      usage.geocoderCacheHits + usage.listingCacheHits + usage.safetyCacheHits > 0;

    if (cacheOnly) {
      if (!this.cacheOnlyMode) {
        this.metrics.recordCacheOnlyMode();
      }
      this.cacheOnlyMode = true;
      this.setCondition({
        key: "cache_only_mode",
        impact: "degraded",
        category: "cache_only_mode",
        severity: "warn",
        message: "Searches are currently operating in cache-only mode.",
        context: {
          usage
        }
      });
    } else {
      this.clearCondition("cache_only_mode");
    }
  }

  updateBackgroundJobDefinition(name: string, enabled: boolean): void {
    const existing = this.backgroundJobs.get(name);
    this.backgroundJobs.set(name, {
      name,
      enabled,
      status: enabled ? (existing?.status ?? "idle") : "disabled",
      lastRunAt: existing?.lastRunAt ?? null,
      lastCompletedAt: existing?.lastCompletedAt ?? null,
      lastFailedAt: existing?.lastFailedAt ?? null,
      lastDurationMs: existing?.lastDurationMs ?? null,
      runCount: existing?.runCount ?? 0,
      failureCount: existing?.failureCount ?? 0,
      lastError: existing?.lastError ?? null
    });
  }

  startBackgroundJob(name: string): void {
    const existing = this.backgroundJobs.get(name);
    const now = new Date().toISOString();
    this.backgroundJobs.set(name, {
      name,
      enabled: existing?.enabled ?? true,
      status: "running",
      lastRunAt: now,
      lastCompletedAt: existing?.lastCompletedAt ?? null,
      lastFailedAt: existing?.lastFailedAt ?? null,
      lastDurationMs: existing?.lastDurationMs ?? null,
      runCount: (existing?.runCount ?? 0) + 1,
      failureCount: existing?.failureCount ?? 0,
      lastError: existing?.lastError ?? null
    });
    this.metrics.recordBackgroundJobRun();
  }

  completeBackgroundJob(name: string, durationMs: number): void {
    const existing = this.backgroundJobs.get(name);
    const now = new Date().toISOString();
    this.backgroundJobs.set(name, {
      name,
      enabled: existing?.enabled ?? true,
      status: "succeeded",
      lastRunAt: existing?.lastRunAt ?? now,
      lastCompletedAt: now,
      lastFailedAt: existing?.lastFailedAt ?? null,
      lastDurationMs: durationMs,
      runCount: existing?.runCount ?? 1,
      failureCount: existing?.failureCount ?? 0,
      lastError: null
    });
    this.clearCondition("background_job_failure");
  }

  failBackgroundJob(name: string, error: string, durationMs: number): void {
    const existing = this.backgroundJobs.get(name);
    const now = new Date().toISOString();
    this.backgroundJobs.set(name, {
      name,
      enabled: existing?.enabled ?? true,
      status: "failed",
      lastRunAt: existing?.lastRunAt ?? now,
      lastCompletedAt: existing?.lastCompletedAt ?? null,
      lastFailedAt: now,
      lastDurationMs: durationMs,
      runCount: existing?.runCount ?? 1,
      failureCount: (existing?.failureCount ?? 0) + 1,
      lastError: error
    });
    this.metrics.recordBackgroundJobFailure();
    this.setCondition({
      key: "background_job_failure",
      impact: "degraded",
      category: "background_job_failure",
      severity: "error",
      message: `Background job ${name} failed.`,
      context: {
        job: name,
        error
      }
    });
  }

  recordStartup(): void {
    if (this.state === "startup_blocked") {
      this.metrics.recordStartupOutcome("failure");
      return;
    }

    this.metrics.recordStartupOutcome(this.state === "healthy" ? "success" : "degraded");
  }

  snapshot(): ReliabilityStateSummary {
    return {
      state: this.state,
      reasons: [...this.reasons],
      readOnlyMode: this.readOnlyMode,
      cacheOnlyMode: this.cacheOnlyMode,
      dependencies: this.dependencies.map((entry) => ({ ...entry })),
      backgroundJobs: [...this.backgroundJobs.values()].map((entry) => ({ ...entry })),
      build: this.getBuildMetadata()
    };
  }

  listIncidents(filters?: ReliabilityIncidentFilters): ReliabilityIncident[] {
    return this.incidents
      .filter((incident) => {
        if (filters?.status && incident.status !== filters.status) {
          return false;
        }
        if (filters?.category && incident.category !== filters.category) {
          return false;
        }
        if (filters?.provider && incident.provider !== filters.provider) {
          return false;
        }
        return true;
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, filters?.limit ?? 50)
      .map((incident) => ({ ...incident }));
  }

  updateIncidentStatus(id: string, status: ReliabilityIncidentStatus): ReliabilityIncident | null {
    const incident = this.incidents.find((entry) => entry.id === id);
    if (!incident) {
      return null;
    }

    incident.status = status;
    incident.updatedAt = new Date().toISOString();
    return { ...incident };
  }

  private setCondition(condition: ReliabilityCondition): void {
    const existing = this.conditions.get(condition.key);
    this.conditions.set(condition.key, condition);
    if (!existing) {
      const now = new Date().toISOString();
      this.incidents.push({
        id: `${condition.category}-${this.incidents.length + 1}`,
        category: condition.category,
        severity: condition.severity,
        state: condition.impact,
        status: "open",
        message: condition.message,
        provider: condition.provider ?? null,
        partnerId: condition.partnerId ?? null,
        context: condition.context ?? null,
        createdAt: now,
        updatedAt: now
      });
    }
    this.recomputeState();
  }

  private clearCondition(key: string): void {
    const existing = this.conditions.get(key);
    if (!existing) {
      return;
    }

    this.conditions.delete(key);
    const incident = [...this.incidents]
      .reverse()
      .find((entry) => entry.category === existing.category && entry.status === "open");
    if (incident) {
      incident.status = "resolved";
      incident.updatedAt = new Date().toISOString();
    }
    if (key === "cache_only_mode") {
      this.cacheOnlyMode = false;
    }
    if (key === "database_degraded") {
      this.readOnlyMode = false;
    }
    this.recomputeState();
  }

  private recomputeState(): void {
    const previous = this.state;
    this.readOnlyMode = [...this.conditions.values()].some((entry) => entry.impact === "read_only_degraded");
    const impacts = [...this.conditions.values()].map((entry) => entry.impact);
    if (impacts.includes("startup_blocked")) {
      this.state = "startup_blocked";
    } else if (this.readOnlyMode || impacts.includes("read_only_degraded")) {
      this.state = "read_only_degraded";
    } else if (impacts.includes("maintenance")) {
      this.state = "maintenance";
    } else if (this.conditions.size > 0) {
      this.state = "degraded";
    } else {
      this.state = "healthy";
    }

    this.reasons = [...this.conditions.values()]
      .map((entry) => entry.message)
      .sort((left, right) => left.localeCompare(right));

    if (this.state !== previous) {
      this.metrics.recordRuntimeReliabilityStateChange();
      if (this.state === "read_only_degraded") {
        this.metrics.recordReadOnlyDegradedMode();
      }
    }
  }
}
