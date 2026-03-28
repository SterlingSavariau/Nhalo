import type { AppConfig } from "@nhalo/config";
import type { EffectiveCapabilities, PilotFeatureOverrides, PlanTier } from "@nhalo/types";

const PLAN_FEATURE_DEFAULTS: Record<
  PlanTier,
  Pick<
    EffectiveCapabilities,
    | "canShareSnapshots"
    | "canShareShortlists"
    | "canUseDemoMode"
    | "canExportResults"
    | "canUseCollaboration"
    | "canUseOpsViews"
    | "canSubmitFeedback"
    | "canSeeValidationPrompts"
  >
> = {
  free_demo: {
    canShareSnapshots: true,
    canShareShortlists: false,
    canUseDemoMode: true,
    canExportResults: true,
    canUseCollaboration: false,
    canUseOpsViews: false,
    canSubmitFeedback: true,
    canSeeValidationPrompts: true
  },
  pilot: {
    canShareSnapshots: true,
    canShareShortlists: true,
    canUseDemoMode: true,
    canExportResults: true,
    canUseCollaboration: false,
    canUseOpsViews: false,
    canSubmitFeedback: true,
    canSeeValidationPrompts: true
  },
  partner: {
    canShareSnapshots: true,
    canShareShortlists: true,
    canUseDemoMode: true,
    canExportResults: true,
    canUseCollaboration: true,
    canUseOpsViews: false,
    canSubmitFeedback: true,
    canSeeValidationPrompts: true
  },
  internal: {
    canShareSnapshots: true,
    canShareShortlists: true,
    canUseDemoMode: true,
    canExportResults: true,
    canUseCollaboration: true,
    canUseOpsViews: true,
    canSubmitFeedback: true,
    canSeeValidationPrompts: true
  }
};

export function resolveEffectiveCapabilities(args: {
  config: AppConfig;
  planTier: PlanTier;
  overrides?: Partial<PilotFeatureOverrides> | null;
}): EffectiveCapabilities {
  const { config, planTier, overrides } = args;
  const defaults = PLAN_FEATURE_DEFAULTS[planTier];
  const enabled = config.product.enabled;

  return {
    planTier,
    canShareSnapshots:
      enabled &&
      defaults.canShareSnapshots &&
      config.validation.enabled &&
      config.validation.sharedSnapshotsEnabled &&
      config.security.publicSharedViewsEnabled &&
      (overrides?.sharedSnapshotsEnabled ?? true),
    canShareShortlists:
      enabled &&
      defaults.canShareShortlists &&
      config.workflow.shortlistsEnabled &&
      config.workflow.sharedShortlistsEnabled &&
      config.security.publicSharedShortlistsEnabled &&
      (overrides?.sharedShortlistsEnabled ?? true),
    canUseDemoMode:
      enabled &&
      defaults.canUseDemoMode &&
      config.validation.enabled &&
      config.validation.demoScenariosEnabled &&
      (overrides?.demoModeEnabled ?? true),
    canExportResults:
      enabled &&
      defaults.canExportResults &&
      (overrides?.exportResultsEnabled ?? true),
    canUseCollaboration:
      enabled &&
      defaults.canUseCollaboration &&
      config.workflow.sharedShortlistsEnabled &&
      (config.workflow.sharedCommentsEnabled || config.workflow.reviewerDecisionsEnabled) &&
      (overrides?.shortlistCollaborationEnabled ?? true),
    canUseOpsViews:
      defaults.canUseOpsViews &&
      config.ops.pilotOpsEnabled &&
      config.ops.internalOpsUiEnabled,
    canSubmitFeedback:
      enabled &&
      defaults.canSubmitFeedback &&
      config.validation.enabled &&
      config.validation.feedbackEnabled &&
      (overrides?.feedbackEnabled ?? true),
    canSeeValidationPrompts:
      enabled &&
      defaults.canSeeValidationPrompts &&
      config.validation.enabled &&
      (overrides?.validationPromptsEnabled ?? true),
    limits: {
      savedSearches: planTier === "internal" ? null : config.product.maxSavedSearchesPerSession,
      shortlists: planTier === "internal" ? null : config.product.maxShortlistsPerSession,
      shareLinks: planTier === "internal" ? null : config.product.maxShareLinksPerSession,
      exportsPerSession:
        planTier === "internal" || !config.product.exportLimitsEnabled
          ? null
          : config.product.maxExportsPerSession
    }
  };
}

export function capabilityEnabled(capabilities: EffectiveCapabilities, key: keyof EffectiveCapabilities): boolean {
  const value = capabilities[key];
  return typeof value === "boolean" ? value : false;
}
