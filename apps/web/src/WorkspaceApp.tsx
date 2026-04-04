import type {
  BuyerTransactionCommandCenterView,
  ClosingReadiness,
  CollaborationActivityRecord,
  DataQualityEvent,
  DemoScenario,
  FeedbackRecord,
  FinancialReadiness,
  HistoricalComparisonPayload,
  NegotiationEvent,
  NegotiationRecord,
  OfferPreparation,
  OfferSubmission,
  OfferReadiness,
  UnderContractCoordination,
  OpsActionRecord,
  PilotActivityRecord,
  PilotContext,
  PilotLinkRecord,
  PilotPartner,
  ReviewerDecision,
  ResultNote,
  ScoreAuditRecord,
  SelectedChoiceConciergeSummary,
  SharedComment,
  SharedShortlist,
  SharedShortlistView,
  Shortlist,
  ShortlistItem,
  SearchDefinition,
  SearchRestorePayload,
  SearchHistoryRecord,
  SearchRequest,
  SearchResponse,
  SearchSnapshotRecord,
  SharedSnapshotView,
  UnifiedActivityRecord,
  WorkflowNotification,
  WorkflowNotificationHistoryEvent,
  WorkflowActivityRecord,
  SessionIdentity
} from "@nhalo/types";
import { DEFAULT_WEIGHTS } from "@nhalo/config";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  addShortlistItem,
  createFinancialReadiness,
  createClosingReadiness,
  createUnderContractCoordination,
  createOfferPreparation,
  createOfferSubmission,
  createNegotiation,
  createNegotiationEvent,
  createOfferReadiness,
  createPilotLink,
  createPilotPartner,
  createReviewerDecision,
  createSharedComment,
  createSharedShortlist,
  createResultNote,
  createShortlist,
  createSharedSnapshot,
  createSearchDefinition,
  createSearchSnapshot,
  deleteResultNote,
  deleteSharedComment,
  deleteShortlist,
  deleteShortlistItem,
  deleteSearchDefinition,
  fetchCollaborationActivity,
  fetchDataQualityEvents,
  fetchDemoScenarios,
  fetchLatestFinancialReadiness,
  fetchWorkflowNotifications,
  fetchWorkflowNotificationHistory,
  fetchNegotiationEvents,
  fetchTransactionCommandCenterSummary,
  markClosingComplete,
  markClosingReady,
  dismissWorkflowNotification,
  markWorkflowNotificationRead,
  updateFinancialReadiness,
  submitOfferSubmission,
  updateOfferPreparation,
  updateOfferSubmission,
  respondToOfferSubmissionCounter,
  updateUnderContractCoordination,
  updateClosingChecklistItem,
  updateClosingMilestone,
  updateClosingReadiness,
  updateUnderContractTask,
  updateUnderContractMilestone,
  fetchOpsActions,
  fetchOpsSummary,
  fetchPilotActivity,
  fetchPilotLink,
  fetchPilotLinks,
  fetchPilotPartners,
  fetchReviewerDecisions,
  fetchSharedComments,
  fetchSharedShortlist,
  fetchSharedShortlists,
  fetchRecentSnapshots,
  fetchResultNotes,
  fetchScoreAudit,
  fetchSearchDefinitions,
  fetchSearchHistory,
  fetchSearchSnapshot,
  fetchSelectedChoiceSummary,
  fetchShortlistItems,
  fetchShortlists,
  fetchSharedSnapshot,
  fetchUnifiedActivity,
  fetchWorkflowActivity,
  recordValidationEvent,
  revokePilotLink,
  rerunSearchDefinition,
  rerunSearchHistory,
  searchHomes,
  setPilotLinkContext,
  submitFeedback,
  trackUiMetric,
  revokeSharedShortlist,
  updateDataQualityEventStatus,
  updateNegotiation,
  updateOfferReadiness,
  updatePilotPartner,
  updateResultNote,
  updateReviewerDecision,
  updateSharedComment,
  updateShortlist,
  updateShortlistItem,
  updateSearchDefinition
} from "./api";
import { AuditDrawer } from "./components/AuditDrawer";
import { ComparisonTray } from "./components/ComparisonTray";
import { DemoScenarioPanel } from "./components/DemoScenarioPanel";
import { EmptyStatePanel } from "./components/EmptyStatePanel";
import { ExportPanel } from "./components/ExportPanel";
import { FeedbackPrompt } from "./components/FeedbackPrompt";
import { FinancialReadinessPanel } from "./components/FinancialReadinessPanel";
import { NotificationCenterPanel } from "./components/NotificationCenterPanel";
import { HistoricalComparePanel } from "./components/HistoricalComparePanel";
import { HomeDetailPanel } from "./components/HomeDetailPanel";
import { OnboardingModal } from "./components/OnboardingModal";
import { OpsPanel } from "./components/OpsPanel";
import { PilotContextBanner } from "./components/PilotContextBanner";
import { PilotContactPanel } from "./components/PilotContactPanel";
import { RecentActivityPanel } from "./components/RecentActivityPanel";
import { ResultCard } from "./components/ResultCard";
import { ResultControls } from "./components/ResultControls";
import { INITIAL_SEARCH_REQUEST, SearchForm } from "./components/SearchForm";
import { SearchSummaryPanel } from "./components/SearchSummaryPanel";
import { SharedSnapshotBanner } from "./components/SharedSnapshotBanner";
import { SharedShortlistViewPanel } from "./components/SharedShortlistView";
import { SnapshotExecutiveSummary } from "./components/SnapshotExecutiveSummary";
import { SelectedChoiceSummaryCard } from "./components/SelectedChoiceSummaryCard";
import { ShortlistPanel } from "./components/ShortlistPanel";
import { StakeholderNotesPanel } from "./components/StakeholderNotesPanel";
import { WalkthroughPanel } from "./components/WalkthroughPanel";
import { applyPageMetadata, buildSharedSnapshotMetadata, getBrandingConfig } from "./branding";
import { BrandMark } from "./redesign/BrandMark";
import { formatSearchBudget } from "./redesign/format";
import { useShortlistDecisionActions } from "./useShortlistDecisionActions";
import {
  dismissWalkthrough,
  isWalkthroughDismissed,
  loadPilotContext,
  loadStakeholderNote,
  saveStakeholderNote,
  savePilotContext,
  markValidationPromptSeen,
  shouldShowValidationPrompt,
  applyPreferencesToRequest,
  dismissOnboarding,
  getOrCreateSessionIdentity,
  isOnboardingDismissed,
  loadUiPreferences,
  saveUiPreferences
} from "./local-state";
import {
  DEMO_WALKTHROUGH_STEPS,
  FEEDBACK_PROMPTS,
  buildHistoricalComparison,
  buildShareSnapshotUrl,
  buildSnapshotExportText
} from "./content";
import {
  applyResultControls,
  DEFAULT_RESULT_CONTROLS,
  toggleComparisonSelection,
  type ResultControlsState
} from "./view-model";

export default function App() {
  const branding = useMemo(() => getBrandingConfig(), []);
  const localStorageRef =
    typeof window !== "undefined" ? window.localStorage : null;
  const initialPreferences = loadUiPreferences(localStorageRef);
  const [sessionIdentity, setSessionIdentity] = useState<SessionIdentity>({
    sessionId: null,
    source: "none"
  });
  const [pilotContext, setPilotContext] = useState<PilotContext | null>(null);
  const [formState, setFormState] = useState<SearchRequest>(() =>
    applyPreferencesToRequest(INITIAL_SEARCH_REQUEST, initialPreferences)
  );
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [lastRequest, setLastRequest] = useState<SearchRequest | null>(null);
  const [currentHistoryRecordId, setCurrentHistoryRecordId] = useState<string | null>(null);
  const [currentSearchDefinitionId, setCurrentSearchDefinitionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [controls, setControls] = useState<ResultControlsState>({
    ...DEFAULT_RESULT_CONTROLS,
    sortMode: initialPreferences.preferredSortMode
  });
  const [comparisonIds, setComparisonIds] = useState<string[]>(initialPreferences.comparisonIds);
  const [audit, setAudit] = useState<ScoreAuditRecord | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SearchSnapshotRecord | null>(null);
  const [sharedSnapshotView, setSharedSnapshotView] = useState<SharedSnapshotView | null>(null);
  const [sharedShortlistView, setSharedShortlistView] = useState<SharedShortlistView | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedHomeId, setSelectedHomeId] = useState<string | null>(null);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [sharingSnapshotId, setSharingSnapshotId] = useState<string | null>(null);
  const [sharedLink, setSharedLink] = useState<string | null>(null);
  const [definitions, setDefinitions] = useState<SearchDefinition[]>([]);
  const [history, setHistory] = useState<SearchHistoryRecord[]>([]);
  const [snapshots, setSnapshots] = useState<SearchSnapshotRecord[]>([]);
  const [financialReadiness, setFinancialReadiness] = useState<FinancialReadiness | null>(null);
  const [shortlists, setShortlists] = useState<Shortlist[]>([]);
  const [sharedShortlists, setSharedShortlists] = useState<SharedShortlist[]>([]);
  const [selectedShortlistId, setSelectedShortlistId] = useState<string | null>(null);
  const [shortlistItems, setShortlistItems] = useState<ShortlistItem[]>([]);
  const [selectedChoiceSummary, setSelectedChoiceSummary] = useState<SelectedChoiceConciergeSummary | null>(null);
  const [offerPreparations, setOfferPreparations] = useState<OfferPreparation[]>([]);
  const [offerSubmissions, setOfferSubmissions] = useState<OfferSubmission[]>([]);
  const [underContracts, setUnderContracts] = useState<UnderContractCoordination[]>([]);
  const [closingReadiness, setClosingReadiness] = useState<ClosingReadiness[]>([]);
  const [transactionCommandCenters, setTransactionCommandCenters] = useState<
    BuyerTransactionCommandCenterView[]
  >([]);
  const [offerReadiness, setOfferReadiness] = useState<OfferReadiness[]>([]);
  const [negotiations, setNegotiations] = useState<NegotiationRecord[]>([]);
  const [negotiationEventsByRecordId, setNegotiationEventsByRecordId] = useState<
    Record<string, NegotiationEvent[]>
  >({});
  const [resultNotes, setResultNotes] = useState<ResultNote[]>([]);
  const [workflowActivity, setWorkflowActivity] = useState<WorkflowActivityRecord[]>([]);
  const [unifiedActivity, setUnifiedActivity] = useState<UnifiedActivityRecord[]>([]);
  const [workflowNotifications, setWorkflowNotifications] = useState<WorkflowNotification[]>([]);
  const [workflowNotificationHistory, setWorkflowNotificationHistory] = useState<
    WorkflowNotificationHistoryEvent[]
  >([]);
  const [sharedComments, setSharedComments] = useState<SharedComment[]>([]);
  const [reviewerDecisions, setReviewerDecisions] = useState<ReviewerDecision[]>([]);
  const [collaborationActivity, setCollaborationActivity] = useState<CollaborationActivityRecord[]>([]);
  const [historicalComparison, setHistoricalComparison] = useState<HistoricalComparisonPayload | null>(null);
  const [demoScenarios, setDemoScenarios] = useState<DemoScenario[]>([]);
  const [activeDemoScenarioId, setActiveDemoScenarioId] = useState<string | null>(null);
  const [activeFeedbackPrompt, setActiveFeedbackPrompt] = useState<"results" | "comparison" | "empty" | null>(null);
  const [stakeholderNote, setStakeholderNote] = useState("");
  const [walkthroughVisible, setWalkthroughVisible] = useState(false);
  const [saveLabel, setSaveLabel] = useState("Family shortlist");
  const [savingDefinition, setSavingDefinition] = useState(false);
  const [opsSummary, setOpsSummary] = useState<Awaited<ReturnType<typeof fetchOpsSummary>> | null>(null);
  const [pilotPartners, setPilotPartners] = useState<PilotPartner[]>([]);
  const [selectedPilotPartnerId, setSelectedPilotPartnerId] = useState<string | null>(null);
  const [pilotLinks, setPilotLinks] = useState<PilotLinkRecord[]>([]);
  const [pilotActivity, setPilotActivity] = useState<PilotActivityRecord[]>([]);
  const [opsActions, setOpsActions] = useState<OpsActionRecord[]>([]);
  const [dataQualityEvents, setDataQualityEvents] = useState<DataQualityEvent[]>([]);
  const [opsLoading, setOpsLoading] = useState(false);
  const [opsError, setOpsError] = useState<string | null>(null);
  const comparedRef = useRef(0);
  const renderedSnapshotRef = useRef<string | null>(null);
  const activityTrackedRef = useRef(false);
  const onboardingTrackedRef = useRef(false);
  const emptyStateTrackedRef = useRef<string | null>(null);
  const noteContextKey = useMemo(() => {
    if (sharedSnapshotView) {
      return `shared:${sharedSnapshotView.share.shareId}`;
    }
    if (snapshot) {
      return `snapshot:${snapshot.id}`;
    }
    if (activeDemoScenarioId) {
      return `demo:${activeDemoScenarioId}`;
    }
    return `search:${formState.locationType}:${formState.locationValue}`;
  }, [activeDemoScenarioId, formState.locationType, formState.locationValue, sharedSnapshotView, snapshot]);
  const pilotCapabilities = pilotContext?.capabilities;
  const demoModeEnabled = branding.enableDemoMode && (pilotCapabilities?.canUseDemoMode ?? true);
  const feedbackEnabled = pilotCapabilities?.canSubmitFeedback ?? true;
  const sharedSnapshotsEnabled = pilotCapabilities?.canShareSnapshots ?? true;
  const sharedShortlistsEnabled =
    branding.enableSharedShortlists && (pilotCapabilities?.canShareShortlists ?? true);
  const shortlistCollaborationEnabled = pilotCapabilities?.canUseCollaboration ?? true;
  const sharedCommentsEnabled = branding.enableSharedComments && shortlistCollaborationEnabled;
  const reviewerDecisionsEnabled =
    branding.enableReviewerDecisions && shortlistCollaborationEnabled;
  const exportResultsEnabled =
    branding.enableSharedExports && (pilotCapabilities?.canExportResults ?? true);

  async function refreshRecentActivity(sessionId = sessionIdentity.sessionId) {
    if (!sessionId) {
      setDefinitions([]);
      setHistory([]);
      setSnapshots([]);
      return;
    }

    const [nextDefinitions, nextHistory, nextSnapshots] = await Promise.all([
      fetchSearchDefinitions(sessionId),
      fetchSearchHistory(sessionId, 8),
      fetchRecentSnapshots(sessionId, 8)
    ]);

    setDefinitions(nextDefinitions);
    setHistory(nextHistory);
    setSnapshots(nextSnapshots);

    if (!activityTrackedRef.current) {
      activityTrackedRef.current = true;
      void trackUiMetric("recent_activity_panel_view");
    }
  }

  async function refreshWorkflowState(
    sessionId = sessionIdentity.sessionId,
    preferredShortlistId: string | null = selectedShortlistId
  ) {
    if (!sessionId || (!branding.enableShortlists && !branding.enableResultNotes)) {
      setFinancialReadiness(null);
      setShortlists([]);
      setSharedShortlists([]);
      setShortlistItems([]);
      setSelectedChoiceSummary(null);
      setOfferPreparations([]);
      setOfferSubmissions([]);
      setUnderContracts([]);
      setClosingReadiness([]);
      setTransactionCommandCenters([]);
      setOfferReadiness([]);
      setNegotiations([]);
      setNegotiationEventsByRecordId({});
      setResultNotes([]);
      setWorkflowActivity([]);
      setUnifiedActivity([]);
      setWorkflowNotifications([]);
      setWorkflowNotificationHistory([]);
      setSelectedShortlistId(null);
      return;
    }

    const [nextFinancialReadiness, nextShortlists, nextNotes, nextActivity, nextUnifiedActivity, nextNotifications, nextNotificationHistory] = await Promise.all([
      fetchLatestFinancialReadiness(sessionId),
      branding.enableShortlists ? fetchShortlists(sessionId) : Promise.resolve([]),
      branding.enableResultNotes ? fetchResultNotes({ sessionId }) : Promise.resolve([]),
      branding.enableShortlists ? fetchWorkflowActivity(sessionId, 12) : Promise.resolve([]),
      branding.enableShortlists ? fetchUnifiedActivity({ sessionId, limit: 50 }) : Promise.resolve([]),
      branding.enableShortlists ? fetchWorkflowNotifications({ sessionId, limit: 50 }) : Promise.resolve([]),
      branding.enableShortlists
        ? fetchWorkflowNotificationHistory({ sessionId, limit: 25 })
        : Promise.resolve([])
    ]);

    setFinancialReadiness(nextFinancialReadiness);
    setShortlists(nextShortlists);
    setResultNotes(nextNotes);
    setWorkflowActivity(nextActivity);
    setUnifiedActivity(nextUnifiedActivity);
    setWorkflowNotifications(nextNotifications);
    setWorkflowNotificationHistory(nextNotificationHistory);

    const nextSelected =
      preferredShortlistId && nextShortlists.some((entry) => entry.id === preferredShortlistId)
        ? preferredShortlistId
        : nextShortlists[0]?.id ?? null;

    setSelectedShortlistId(nextSelected);

    if (!nextSelected) {
      setSharedShortlists([]);
      setShortlistItems([]);
      setSelectedChoiceSummary(null);
      setOfferPreparations([]);
      setOfferSubmissions([]);
      setUnderContracts([]);
      setClosingReadiness([]);
      setTransactionCommandCenters([]);
      setOfferReadiness([]);
      setNegotiations([]);
      setNegotiationEventsByRecordId({});
      setWorkflowNotifications(nextNotifications);
      setWorkflowNotificationHistory(nextNotificationHistory);
      return;
    }

    const [shortlistPayload, nextSelectedChoiceSummary] = await Promise.all([
      fetchShortlistItems(nextSelected),
      fetchSelectedChoiceSummary(nextSelected).catch(() => null)
    ]);
    setShortlistItems(shortlistPayload.items);
    setSelectedChoiceSummary(nextSelectedChoiceSummary);
    setOfferPreparations(shortlistPayload.offerPreparations ?? []);
    setOfferSubmissions(shortlistPayload.offerSubmissions ?? []);
    setUnderContracts(shortlistPayload.underContracts ?? []);
    setClosingReadiness(shortlistPayload.closingReadiness ?? []);
    const commandCenterPayloads = await Promise.all(
      Array.from(
        new Map(
          shortlistPayload.items.map((entry) => [
            entry.canonicalPropertyId,
            entry.capturedHome.address
          ])
        ).entries()
      ).map(async ([propertyId, propertyAddressLabel]) => {
        try {
          return await fetchTransactionCommandCenterSummary({
            propertyId,
            propertyAddressLabel,
            shortlistId: nextSelected,
            sessionId
          });
        } catch {
          return null;
        }
      })
    );
    setTransactionCommandCenters(
      commandCenterPayloads.filter((entry): entry is BuyerTransactionCommandCenterView => entry !== null)
    );
    setOfferReadiness(shortlistPayload.offerReadiness ?? []);
    setNegotiations(shortlistPayload.negotiations ?? []);
    if ((shortlistPayload.negotiations ?? []).length > 0) {
      const eventPayloads = await Promise.all(
        shortlistPayload.negotiations.map(async (entry) => ({
          id: entry.id,
          events: await fetchNegotiationEvents(entry.id).catch(() => [])
        }))
      );
      setNegotiationEventsByRecordId(
        Object.fromEntries(eventPayloads.map((entry) => [entry.id, entry.events]))
      );
    } else {
      setNegotiationEventsByRecordId({});
    }
    if (sharedShortlistsEnabled) {
      const shares = await fetchSharedShortlists(nextSelected);
      setSharedShortlists(shares);
    }
  }

  const {
    handleSelectShortlistChoice,
    handleDropShortlistChoice,
    handleUpdateShortlistDecision,
    handleMoveShortlistBackup
  } = useShortlistDecisionActions({
    sessionId: sessionIdentity.sessionId,
    shortlistItems,
    refreshWorkflowState,
    onError: (message) => setError(message)
  });

  async function refreshOpsState(preferredPartnerId: string | null = selectedPilotPartnerId) {
    if (!branding.enableInternalOpsUi) {
      setOpsSummary(null);
      setPilotPartners([]);
      setSelectedPilotPartnerId(null);
      setPilotLinks([]);
      setPilotActivity([]);
      setOpsActions([]);
      return;
    }

    setOpsLoading(true);
    setOpsError(null);

    try {
      const [summaryPayload, partners] = await Promise.all([
        fetchOpsSummary(),
        fetchPilotPartners()
      ]);
      setOpsSummary(summaryPayload);
      setPilotPartners(partners);

      const nextPartnerId =
        preferredPartnerId && partners.some((entry) => entry.id === preferredPartnerId)
          ? preferredPartnerId
          : partners[0]?.id ?? null;
      setSelectedPilotPartnerId(nextPartnerId);

      if (!nextPartnerId) {
        setPilotLinks([]);
        setPilotActivity([]);
        setOpsActions([]);
        setDataQualityEvents([]);
        return;
      }

      const [links, activity, actions, qualityEvents] = await Promise.all([
        fetchPilotLinks(nextPartnerId),
        fetchPilotActivity(nextPartnerId),
        fetchOpsActions(nextPartnerId),
        fetchDataQualityEvents({ partnerId: nextPartnerId, limit: 20 })
      ]);
      setPilotLinks(links);
      setPilotActivity(activity);
      setOpsActions(actions);
      setDataQualityEvents(qualityEvents);
    } catch (nextError) {
      setOpsError(nextError instanceof Error ? nextError.message : "Unable to load pilot operations");
    } finally {
      setOpsLoading(false);
    }
  }

  async function handleMarkWorkflowNotificationRead(id: string) {
    await markWorkflowNotificationRead(id);
    await refreshWorkflowState();
  }

  async function handleDismissWorkflowNotification(id: string) {
    await dismissWorkflowNotification(id);
    await refreshWorkflowState();
  }

  async function handleUpdateDataQualityEvent(
    eventId: string,
    status: "acknowledged" | "resolved" | "ignored"
  ) {
    await updateDataQualityEventStatus(eventId, status);
    await refreshOpsState(selectedPilotPartnerId);
  }

  async function refreshSharedShortlistState(shareId: string) {
    const [shared, comments, decisions, activity] = await Promise.all([
      fetchSharedShortlist(shareId),
      fetchSharedComments({ shareId }),
      fetchReviewerDecisions({ shareId }),
      fetchCollaborationActivity({ shareId, limit: 20 })
    ]);

    setSharedShortlistView({
      ...shared,
      comments,
      reviewerDecisions: decisions,
      collaborationActivity: activity
    });
    setSharedComments(comments);
    setReviewerDecisions(decisions);
    setCollaborationActivity(activity);
  }

  function applyResultSet(
    response: SearchResponse,
    request: SearchRequest,
    options?: {
      snapshot?: SearchSnapshotRecord | null;
      historyRecordId?: string | null;
      searchDefinitionId?: string | null;
      sharedSnapshotView?: SharedSnapshotView | null;
      sharedShortlistView?: SharedShortlistView | null;
    }
  ) {
    setResults(response);
    setLastRequest(request);
    setFormState(request);
    setSnapshot(options?.snapshot ?? null);
    setSharedSnapshotView(options?.sharedSnapshotView ?? null);
    setSharedShortlistView(options?.sharedShortlistView ?? null);
    setCurrentHistoryRecordId(
      options?.historyRecordId ?? response.metadata.historyRecordId ?? null
    );
    setCurrentSearchDefinitionId(
      options?.searchDefinitionId ??
        (response.metadata.rerunResultMetadata?.sourceType === "definition"
          ? response.metadata.rerunResultMetadata.sourceId
          : null)
    );
    setSelectedHomeId(null);
  }

  useEffect(() => {
    const identity = getOrCreateSessionIdentity(localStorageRef);
    const storedPilotContext = loadPilotContext(localStorageRef);
    setSessionIdentity({
      ...identity,
      partnerId: storedPilotContext?.partnerId ?? identity.partnerId ?? null,
      pilotLinkId: storedPilotContext?.pilotLinkId ?? identity.pilotLinkId ?? null
    });
    setPilotContext(storedPilotContext);
    setPilotLinkContext(storedPilotContext?.pilotToken ?? null);
    setShowOnboarding(!isOnboardingDismissed(localStorageRef));
    void refreshRecentActivity(identity.sessionId);
    void refreshWorkflowState(identity.sessionId, null);
    if (branding.enableInternalOpsUi) {
      void refreshOpsState();
    }
    if (demoModeEnabled) {
      void fetchDemoScenarios()
        .then(setDemoScenarios)
        .catch(() => setDemoScenarios([]));
    }
  }, []);

  useEffect(() => {
    setStakeholderNote(loadStakeholderNote(localStorageRef, noteContextKey));
  }, [localStorageRef, noteContextKey]);

  useEffect(() => {
    saveStakeholderNote(localStorageRef, noteContextKey, stakeholderNote);
  }, [localStorageRef, noteContextKey, stakeholderNote]);

  useEffect(() => {
    if (sharedSnapshotView) {
      applyPageMetadata(buildSharedSnapshotMetadata(sharedSnapshotView.snapshot, branding));
      return;
    }

    applyPageMetadata({
      title: `${branding.appName} | ${branding.tagline}`,
      description: branding.tagline,
      openGraphTitle: branding.appName,
      openGraphDescription: branding.tagline,
      noIndex: false
    });
  }, [branding, sharedSnapshotView]);

  useEffect(() => {
    saveUiPreferences(localStorageRef, {
      preferredSortMode: controls.sortMode,
      lastWeights: formState.weights ?? INITIAL_SEARCH_REQUEST.weights!,
      lastPropertyTypes: formState.propertyTypes ?? INITIAL_SEARCH_REQUEST.propertyTypes!,
      comparisonIds
    });
  }, [comparisonIds, controls.sortMode, formState.propertyTypes, formState.weights, localStorageRef]);

  useEffect(() => {
    async function loadSnapshotFromUrl() {
      const params = new URLSearchParams(window.location.search);
      const pilotToken = params.get("pilot");
      const sharedSnapshotId = params.get("sharedSnapshot");
      const sharedShortlistId = params.get("sharedShortlist");
      const snapshotId = params.get("snapshot");

      if (pilotToken && branding.enablePilotLinks) {
        try {
          const view = await fetchPilotLink(pilotToken);
          setPilotContext(view.context);
          savePilotContext(localStorageRef, view.context);
          setPilotLinkContext(view.link.token);
          setSessionIdentity((current) => ({
            ...current,
            partnerId: view.context.partnerId,
            pilotLinkId: view.context.pilotLinkId
          }));
          if (branding.enableInternalOpsUi) {
            await refreshOpsState(view.context.partnerId);
          }
        } catch (pilotError) {
          setError(pilotError instanceof Error ? pilotError.message : "Unable to load pilot context");
        }
      }

      if (sharedSnapshotId) {
        setBusy(true);
        setError(null);

        try {
          const shared = await fetchSharedSnapshot(sharedSnapshotId);
          setSharedSnapshotView({
            share: shared.share,
            snapshot: shared.snapshot
          });
          applyResultSet(shared.snapshot.response, shared.snapshot.request, {
            snapshot: shared.snapshot,
            historyRecordId: shared.snapshot.historyRecordId ?? null,
            searchDefinitionId: shared.snapshot.searchDefinitionId ?? null,
            sharedSnapshotView: {
              share: shared.share,
              snapshot: shared.snapshot
            }
          });
        } catch (snapshotError) {
          setError(snapshotError instanceof Error ? snapshotError.message : "Unable to load shared snapshot");
        } finally {
          setBusy(false);
        }
        return;
      }

      if (sharedShortlistId) {
        setBusy(true);
        setError(null);

        try {
          const shared = await fetchSharedShortlist(sharedShortlistId);
          setSharedShortlistView(shared);
          setSharedComments(shared.comments);
          setReviewerDecisions(shared.reviewerDecisions);
          setCollaborationActivity(shared.collaborationActivity);
          setResults(null);
          setSnapshot(null);
          setSharedSnapshotView(null);
        } catch (sharedShortlistError) {
          setError(
            sharedShortlistError instanceof Error
              ? sharedShortlistError.message
              : "Unable to load shared shortlist"
          );
        } finally {
          setBusy(false);
        }
        return;
      }

      if (!snapshotId) {
        return;
      }

      setBusy(true);
      setError(null);

      try {
        const loadedSnapshot = await fetchSearchSnapshot(snapshotId);
        applyResultSet(loadedSnapshot.response, loadedSnapshot.request, {
          snapshot: loadedSnapshot,
          historyRecordId: loadedSnapshot.historyRecordId ?? null,
          searchDefinitionId: loadedSnapshot.searchDefinitionId ?? null
        });
        void trackUiMetric("snapshot_reopen");
      } catch (snapshotError) {
        setError(snapshotError instanceof Error ? snapshotError.message : "Unable to load snapshot");
      } finally {
        setBusy(false);
      }
    }

    void loadSnapshotFromUrl();
  }, []);

  useEffect(() => {
    if (!results) {
      return;
    }

    const snapshotKey = `${results.metadata.returnedCount}:${results.metadata.durationMs}:${results.homes[0]?.id ?? "none"}`;
    if (renderedSnapshotRef.current === snapshotKey) {
      return;
    }
    renderedSnapshotRef.current = snapshotKey;
    void trackUiMetric("explainability_render");
  }, [results]);

  useEffect(() => {
    if (showOnboarding && !onboardingTrackedRef.current) {
      onboardingTrackedRef.current = true;
      void trackUiMetric("onboarding_view");
    }
  }, [showOnboarding]);

  useEffect(() => {
    if (comparisonIds.length > 0 && comparedRef.current === 0) {
      void trackUiMetric("comparison_view");
    }
    comparedRef.current = comparisonIds.length;
  }, [comparisonIds]);

  useEffect(() => {
    if (!results || results.metadata.returnedCount >= 5) {
      emptyStateTrackedRef.current = null;
      return;
    }

    const key = `${results.metadata.returnedCount}:${results.metadata.totalMatched}:${results.metadata.durationMs}`;
    if (emptyStateTrackedRef.current === key) {
      return;
    }

    emptyStateTrackedRef.current = key;
    void trackUiMetric("empty_state_view");
    void recordValidationEvent({
      eventName: "empty_state_encountered",
      sessionId: sessionIdentity.sessionId,
      historyRecordId: currentHistoryRecordId,
      snapshotId: snapshot?.id ?? null,
      payload: {
        returnedCount: results.metadata.returnedCount
      }
    }).catch(() => undefined);
  }, [results]);

  useEffect(() => {
    if (!feedbackEnabled || !results || activeFeedbackPrompt) {
      return;
    }

    if (
      results.metadata.returnedCount < 5 &&
      shouldShowValidationPrompt(localStorageRef, "empty")
    ) {
      setActiveFeedbackPrompt("empty");
      markValidationPromptSeen(localStorageRef, "empty");
      void trackUiMetric("validation_prompt_view");
      return;
    }

    if (
      results.metadata.returnedCount > 0 &&
      shouldShowValidationPrompt(localStorageRef, "results")
    ) {
      setActiveFeedbackPrompt("results");
      markValidationPromptSeen(localStorageRef, "results");
      void trackUiMetric("validation_prompt_view");
    }
  }, [activeFeedbackPrompt, feedbackEnabled, localStorageRef, results]);

  useEffect(() => {
    if (!feedbackEnabled) {
      return;
    }
    if (
      comparisonIds.length >= 2 &&
      !activeFeedbackPrompt &&
      shouldShowValidationPrompt(localStorageRef, "comparison")
    ) {
      setActiveFeedbackPrompt("comparison");
      markValidationPromptSeen(localStorageRef, "comparison");
      void trackUiMetric("validation_prompt_view");
    }
  }, [activeFeedbackPrompt, comparisonIds.length, feedbackEnabled, localStorageRef]);

  const visibleHomes = useMemo(
    () => (results ? applyResultControls(results.homes, controls) : []),
    [results, controls]
  );

  const selectedHome = useMemo(() => {
    if (!results || !selectedHomeId) {
      return null;
    }

    return results.homes.find((home) => home.id === selectedHomeId) ?? null;
  }, [results, selectedHomeId]);

  const comparedHomes = useMemo(() => {
    if (!results) {
      return [];
    }

    return comparisonIds
      .map((homeId) => results.homes.find((home) => home.id === homeId))
      .filter((home): home is NonNullable<typeof home> => Boolean(home));
  }, [comparisonIds, results]);

  const activeShortlist = useMemo(
    () => shortlists.find((entry) => entry.id === selectedShortlistId) ?? null,
    [selectedShortlistId, shortlists]
  );

  const shortlistItemsByCanonicalId = useMemo(() => {
    const map = new Map<string, ShortlistItem>();
    for (const item of shortlistItems) {
      map.set(item.canonicalPropertyId, item);
    }
    return map;
  }, [shortlistItems]);
  const offerReadinessByPropertyId = useMemo(() => {
    const map = new Map<string, OfferReadiness>();
    for (const entry of offerReadiness) {
      map.set(entry.propertyId, entry);
    }
    return map;
  }, [offerReadiness]);
  const offerPreparationsByPropertyId = useMemo(() => {
    const map = new Map<string, OfferPreparation>();
    for (const entry of offerPreparations) {
      map.set(entry.propertyId, entry);
    }
    return map;
  }, [offerPreparations]);
  const offerSubmissionsByPropertyId = useMemo(() => {
    const map = new Map<string, OfferSubmission>();
    for (const entry of offerSubmissions) {
      map.set(entry.propertyId, entry);
    }
    return map;
  }, [offerSubmissions]);
  const underContractsByPropertyId = useMemo(() => {
    const map = new Map<string, UnderContractCoordination>();
    for (const entry of underContracts) {
      map.set(entry.propertyId, entry);
    }
    return map;
  }, [underContracts]);
  const closingReadinessByPropertyId = useMemo(() => {
    const map = new Map<string, ClosingReadiness>();
    for (const entry of closingReadiness) {
      map.set(entry.propertyId, entry);
    }
    return map;
  }, [closingReadiness]);
  const transactionCommandCentersByPropertyId = useMemo(() => {
    const map = new Map<string, BuyerTransactionCommandCenterView>();
    for (const entry of transactionCommandCenters) {
      map.set(entry.propertyId, entry);
    }
    return map;
  }, [transactionCommandCenters]);
  const financialReadinessNotifications = useMemo(
    () => workflowNotifications.filter((entry) => entry.moduleName === "financial_readiness"),
    [workflowNotifications]
  );
  const workflowNotificationsByPropertyId = useMemo(() => {
    const map = new Map<string, WorkflowNotification[]>();
    for (const entry of workflowNotifications) {
      if (!entry.propertyId) {
        continue;
      }
      const next = map.get(entry.propertyId) ?? [];
      next.push(entry);
      map.set(entry.propertyId, next);
    }
    return map;
  }, [workflowNotifications]);
  const unifiedActivityByPropertyId = useMemo(() => {
    const map = new Map<string, UnifiedActivityRecord[]>();
    for (const entry of unifiedActivity) {
      if (!entry.propertyId) {
        continue;
      }
      const next = map.get(entry.propertyId) ?? [];
      next.push(entry);
      map.set(entry.propertyId, next);
    }
    return map;
  }, [unifiedActivity]);
  const negotiationsByPropertyId = useMemo(() => {
    const map = new Map<string, NegotiationRecord>();
    for (const entry of negotiations) {
      map.set(entry.propertyId, entry);
    }
    return map;
  }, [negotiations]);

  const selectedHomeNoteContext = useMemo(() => {
    if (!selectedHome) {
      return null;
    }

    if (sharedSnapshotView) {
      return {
        entityType: "shared_snapshot_result" as const,
        entityId: `${sharedSnapshotView.share.shareId}:${selectedHome.canonicalPropertyId ?? selectedHome.id}`
      };
    }

    if (snapshot) {
      return {
        entityType: "snapshot_result" as const,
        entityId: `${snapshot.id}:${selectedHome.canonicalPropertyId ?? selectedHome.id}`
      };
    }

    return null;
  }, [selectedHome, sharedSnapshotView, snapshot]);

  const selectedHomeNote = useMemo(() => {
    if (!selectedHomeNoteContext) {
      return null;
    }

    return (
      resultNotes.find(
        (entry) =>
          entry.entityType === selectedHomeNoteContext.entityType &&
          entry.entityId === selectedHomeNoteContext.entityId
      ) ?? null
    );
  }, [resultNotes, selectedHomeNoteContext]);

  async function handleSubmit(payload: SearchRequest) {
    setBusy(true);
    setError(null);
    setComparisonIds([]);
    setControls((previous) => ({ ...previous, confidence: "all", propertyType: "all" }));

    try {
      const response = await searchHomes(payload, sessionIdentity.sessionId);
      applyResultSet(response, payload, {
        historyRecordId: response.metadata.historyRecordId ?? null
      });
      setSharedLink(null);
      window.history.replaceState({}, "", window.location.pathname);
      await refreshRecentActivity();
      await refreshWorkflowState();
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Unable to complete search");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveSnapshot() {
    if (!results || !lastRequest) {
      return;
    }

    setSavingSnapshot(true);

    try {
      const created = await createSearchSnapshot({
        request: lastRequest,
        response: results,
        sessionId: sessionIdentity.sessionId,
        searchDefinitionId: currentSearchDefinitionId,
        historyRecordId: currentHistoryRecordId
      });
      setSnapshot(created);
      setSharedLink(null);
      window.history.replaceState({}, "", `/?snapshot=${created.id}`);
      await refreshRecentActivity();
      await refreshWorkflowState();
    } catch (snapshotError) {
      setError(snapshotError instanceof Error ? snapshotError.message : "Unable to save snapshot");
    } finally {
      setSavingSnapshot(false);
    }
  }

  async function handleShareSnapshot(snapshotId?: string) {
    const targetSnapshotId = snapshotId ?? snapshot?.id;
    if (!targetSnapshotId) {
      return;
    }

    setSharingSnapshotId(targetSnapshotId);

    try {
      const shared = await createSharedSnapshot({
        snapshotId: targetSnapshotId,
        sessionId: sessionIdentity.sessionId
      });
      const nextLink = buildShareSnapshotUrl(shared.share.shareId);
      setSharedLink(nextLink);
      await refreshRecentActivity();
      await refreshWorkflowState();
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : "Unable to share snapshot");
    } finally {
      setSharingSnapshotId(null);
    }
  }

  async function handleCopySummary() {
    const targetSnapshot = sharedSnapshotView?.snapshot ?? snapshot;
    if (!targetSnapshot || !exportResultsEnabled) {
      return;
    }

    const text = buildSnapshotExportText(targetSnapshot, branding.appName);
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    }
    await trackUiMetric("export_use");
    await recordValidationEvent({
      eventName: "export_generated",
      sessionId: sessionIdentity.sessionId,
      snapshotId: targetSnapshot.id,
      payload: {
        format: "summary_text"
      }
    }).catch(() => undefined);
  }

  async function handleDownloadJson() {
    const targetSnapshot = sharedSnapshotView?.snapshot ?? snapshot;
    if (!targetSnapshot || !exportResultsEnabled || typeof document === "undefined") {
      return;
    }

    const blob = new Blob([JSON.stringify(targetSnapshot, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${targetSnapshot.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
    await trackUiMetric("export_use");
    await recordValidationEvent({
      eventName: "export_generated",
      sessionId: sessionIdentity.sessionId,
      snapshotId: targetSnapshot.id,
      payload: {
        format: "json"
      }
    }).catch(() => undefined);
  }

  async function handlePrintView() {
    if (!exportResultsEnabled) {
      return;
    }

    if (typeof window !== "undefined") {
      window.print();
    }
    await trackUiMetric("export_use");
    const targetSnapshot = sharedSnapshotView?.snapshot ?? snapshot;
    await recordValidationEvent({
      eventName: "export_generated",
      sessionId: sessionIdentity.sessionId,
      snapshotId: targetSnapshot?.id ?? null,
      payload: {
        format: "print"
      }
    }).catch(() => undefined);
  }

  async function handleViewAudit(propertyId: string) {
    setAuditLoading(true);
    setAuditError(null);

    try {
      const response = await fetchScoreAudit(propertyId);
      setAudit(response);
    } catch (viewError) {
      setAudit(null);
      setAuditError(viewError instanceof Error ? viewError.message : "Unable to load audit");
    } finally {
      setAuditLoading(false);
    }
  }

  async function handleSaveDefinition() {
    setSavingDefinition(true);
    setError(null);

    try {
      await createSearchDefinition({
        sessionId: sessionIdentity.sessionId,
        label: saveLabel.trim(),
        request: formState
      });
      await refreshRecentActivity();
      await refreshWorkflowState();
      setSaveLabel(`${formState.locationValue} follow-up`);
    } catch (definitionError) {
      setError(
        definitionError instanceof Error ? definitionError.message : "Unable to save search definition"
      );
    } finally {
      setSavingDefinition(false);
    }
  }

  async function handleOpenSnapshot(snapshotId: string) {
    setBusy(true);
    setError(null);

    try {
      const loadedSnapshot = await fetchSearchSnapshot(snapshotId);
      setSharedSnapshotView(null);
      applyResultSet(loadedSnapshot.response, loadedSnapshot.request, {
        snapshot: loadedSnapshot,
        historyRecordId: loadedSnapshot.historyRecordId ?? null,
        searchDefinitionId: loadedSnapshot.searchDefinitionId ?? null
      });
      void trackUiMetric("snapshot_reopen");
      window.history.replaceState({}, "", `/?snapshot=${snapshotId}`);
    } catch (snapshotError) {
      setError(snapshotError instanceof Error ? snapshotError.message : "Unable to open snapshot");
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore(payload: SearchRestorePayload) {
    setFormState(payload.request);
    await trackUiMetric("search_restore");
    await recordValidationEvent({
      eventName: "restore_used",
      sessionId: sessionIdentity.sessionId,
      snapshotId: payload.sourceType === "snapshot" ? payload.sourceId : null,
      historyRecordId: payload.sourceType === "history" ? payload.sourceId : null,
      searchDefinitionId: payload.sourceType === "definition" ? payload.sourceId : null
    }).catch(() => undefined);
    if (payload.sourceType === "definition") {
      await trackUiMetric("saved_search_restore");
    }
  }

  async function handleLoadScenario(scenario: DemoScenario) {
    setFormState(scenario.request);
    setActiveDemoScenarioId(scenario.id);
    setSaveLabel(scenario.label);
    const showWalkthrough = !isWalkthroughDismissed(localStorageRef, scenario.id);
    setWalkthroughVisible(showWalkthrough);
    await trackUiMetric("demo_scenario_start");
    if (showWalkthrough) {
      await trackUiMetric("walkthrough_view");
    }
    await recordValidationEvent({
      eventName: "demo_scenario_started",
      sessionId: sessionIdentity.sessionId,
      demoScenarioId: scenario.id
    }).catch(() => undefined);
  }

  async function handleDismissWalkthrough() {
    if (activeDemoScenarioId) {
      dismissWalkthrough(localStorageRef, activeDemoScenarioId);
    }
    setWalkthroughVisible(false);
    await trackUiMetric("walkthrough_dismiss");
  }

  async function handleRerunDefinition(definitionId: string) {
    setBusy(true);
    setError(null);

    try {
      const response = await rerunSearchDefinition(definitionId, sessionIdentity.sessionId);
      const definition = definitions.find((entry) => entry.id === definitionId);
      applyResultSet(response, definition?.request ?? formState, {
        historyRecordId: response.metadata.historyRecordId ?? null,
        searchDefinitionId: definitionId
      });
      window.history.replaceState({}, "", window.location.pathname);
      setSharedSnapshotView(null);
      await refreshRecentActivity();
      await refreshWorkflowState();
    } catch (rerunError) {
      setError(rerunError instanceof Error ? rerunError.message : "Unable to rerun saved search");
    } finally {
      setBusy(false);
    }
  }

  async function handleRerunHistory(historyId: string) {
    setBusy(true);
    setError(null);

    try {
      const response = await rerunSearchHistory(historyId, sessionIdentity.sessionId);
      const record = history.find((entry) => entry.id === historyId);
      applyResultSet(response, record?.request ?? formState, {
        historyRecordId: response.metadata.historyRecordId ?? null,
        searchDefinitionId: response.metadata.rerunResultMetadata?.sourceType === "definition"
          ? response.metadata.rerunResultMetadata.sourceId
          : record?.searchDefinitionId ?? null
      });
      window.history.replaceState({}, "", window.location.pathname);
      setSharedSnapshotView(null);
      await refreshRecentActivity();
      await refreshWorkflowState();
    } catch (rerunError) {
      setError(rerunError instanceof Error ? rerunError.message : "Unable to rerun search history");
    } finally {
      setBusy(false);
    }
  }

  async function handleTogglePinned(definition: SearchDefinition) {
    try {
      await updateSearchDefinition(definition.id, {
        pinned: !definition.pinned
      });
      await refreshRecentActivity();
      await refreshWorkflowState();
    } catch (definitionError) {
      setError(
        definitionError instanceof Error ? definitionError.message : "Unable to update saved search"
      );
    }
  }

  async function handleDeleteDefinition(definitionId: string) {
    try {
      await deleteSearchDefinition(definitionId);
      await refreshRecentActivity();
      await refreshWorkflowState();
    } catch (definitionError) {
      setError(
        definitionError instanceof Error ? definitionError.message : "Unable to delete saved search"
      );
    }
  }

  const resorted =
    controls.sortMode !== "server" ||
    controls.confidence !== "all" ||
    controls.propertyType !== "all";

  async function handleDismissOnboarding() {
    dismissOnboarding(localStorageRef);
    setShowOnboarding(false);
    await trackUiMetric("onboarding_dismiss");
  }

  async function handleApplySuggestion(patch: Partial<SearchRequest>, code?: string) {
    setFormState((current) => ({
      ...current,
      ...patch,
      budget: patch.budget ? { ...current.budget, ...patch.budget } : current.budget,
      weights: patch.weights ? { ...current.weights, ...patch.weights } : current.weights
    }));
    await trackUiMetric("suggestion_click");
    await recordValidationEvent({
      eventName: "suggestion_used",
      sessionId: sessionIdentity.sessionId,
      historyRecordId: currentHistoryRecordId,
      snapshotId: snapshot?.id ?? null,
      payload: {
        code: code ?? null,
        patch
      }
    }).catch(() => undefined);
  }

  async function handleOpenDetails(homeId: string) {
    setSelectedHomeId(homeId);
    await trackUiMetric("detail_panel_open");
    await recordValidationEvent({
      eventName: "result_opened",
      sessionId: sessionIdentity.sessionId,
      snapshotId: snapshot?.id ?? null,
      historyRecordId: currentHistoryRecordId,
      payload: {
        homeId
      }
    }).catch(() => undefined);
  }

  async function handleToggleCompare(homeId: string) {
    setComparisonIds((current) => {
      const next = toggleComparisonSelection(current, homeId);
      if (!current.includes(homeId) && next.includes(homeId)) {
        void trackUiMetric("result_compare_add");
        if (next.length === 2) {
          void recordValidationEvent({
            eventName: "comparison_started",
            sessionId: sessionIdentity.sessionId,
            snapshotId: snapshot?.id ?? null,
            historyRecordId: currentHistoryRecordId,
            payload: {
              homeIds: next
            }
          }).catch(() => undefined);
        }
      }
      return next;
    });
  }

  async function handleFeedbackSubmit(payload: {
    category: FeedbackRecord["category"];
    value: FeedbackRecord["value"];
    comment?: string | null;
  }) {
    try {
      await submitFeedback({
        sessionId: sessionIdentity.sessionId,
        snapshotId: snapshot?.id ?? undefined,
        historyRecordId: currentHistoryRecordId ?? undefined,
        searchDefinitionId: currentSearchDefinitionId ?? undefined,
        ...payload
      });
      await trackUiMetric("validation_prompt_response");
      await refreshRecentActivity();
      await refreshWorkflowState();
    } catch (feedbackError) {
      setError(feedbackError instanceof Error ? feedbackError.message : "Unable to submit feedback");
    } finally {
      setActiveFeedbackPrompt(null);
    }
  }

  async function handleCreateShortlist(payload: { title: string; description?: string | null }) {
    try {
      const shortlist = await createShortlist({
        sessionId: sessionIdentity.sessionId,
        title: payload.title,
        description: payload.description?.trim() ? payload.description.trim() : undefined,
        sourceSnapshotId: snapshot?.id ?? undefined
      });
      await refreshWorkflowState(sessionIdentity.sessionId, shortlist.id);
    } catch (workflowError) {
      setError(workflowError instanceof Error ? workflowError.message : "Unable to create shortlist");
    }
  }

  async function handleSelectShortlist(shortlistId: string) {
    setSelectedShortlistId(shortlistId);
    try {
      await refreshWorkflowState(sessionIdentity.sessionId, shortlistId);
    } catch (workflowError) {
      setError(workflowError instanceof Error ? workflowError.message : "Unable to load shortlist");
    }
  }

  async function handleToggleShortlist(home: SearchResponse["homes"][number]) {
    try {
      let shortlistId = selectedShortlistId;
      if (!shortlistId) {
        const created = await createShortlist({
          sessionId: sessionIdentity.sessionId,
          title: `${formState.locationValue} shortlist`,
          sourceSnapshotId: snapshot?.id ?? undefined
        });
        shortlistId = created.id;
      }

      const canonicalPropertyId = home.canonicalPropertyId ?? home.id;
      const existing = shortlistItemsByCanonicalId.get(canonicalPropertyId);
      if (existing && existing.shortlistId === shortlistId) {
        await deleteShortlistItem(shortlistId, existing.id);
      } else {
        await addShortlistItem(shortlistId, {
          canonicalPropertyId,
          sourceSnapshotId: snapshot?.id ?? undefined,
          sourceHistoryId: currentHistoryRecordId ?? undefined,
          sourceSearchDefinitionId: currentSearchDefinitionId ?? undefined,
          capturedHome: home,
          reviewState: "undecided"
        });
      }

      await refreshWorkflowState(sessionIdentity.sessionId, shortlistId);
    } catch (workflowError) {
      setError(workflowError instanceof Error ? workflowError.message : "Unable to update shortlist");
    }
  }

  async function handleToggleShortlistPinned(shortlist: Shortlist) {
    try {
      await updateShortlist(shortlist.id, {
        pinned: !shortlist.pinned
      });
      await refreshWorkflowState(sessionIdentity.sessionId, shortlist.id);
    } catch (workflowError) {
      setError(workflowError instanceof Error ? workflowError.message : "Unable to update shortlist");
    }
  }

  async function handleDeleteShortlist(shortlistId: string) {
    try {
      await deleteShortlist(shortlistId);
      await refreshWorkflowState(
        sessionIdentity.sessionId,
        shortlistId === selectedShortlistId ? null : selectedShortlistId
      );
    } catch (workflowError) {
      setError(workflowError instanceof Error ? workflowError.message : "Unable to delete shortlist");
    }
  }

  async function handleReviewStateChange(
    shortlistId: string,
    itemId: string,
    reviewState: ShortlistItem["reviewState"]
  ) {
    try {
      await updateShortlistItem(shortlistId, itemId, { reviewState });
      await refreshWorkflowState(sessionIdentity.sessionId, shortlistId);
    } catch (workflowError) {
      setError(
        workflowError instanceof Error ? workflowError.message : "Unable to update review state"
      );
    }
  }

  async function handleRemoveShortlistItem(shortlistId: string, itemId: string) {
    try {
      await deleteShortlistItem(shortlistId, itemId);
      await refreshWorkflowState(sessionIdentity.sessionId, shortlistId);
    } catch (workflowError) {
      setError(
        workflowError instanceof Error ? workflowError.message : "Unable to remove shortlisted home"
      );
    }
  }

  async function handleCreateFinancialReadiness(payload: {
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
  }) {
    try {
      await createFinancialReadiness({
        sessionId: sessionIdentity.sessionId,
        ...payload
      });
      await refreshWorkflowState(sessionIdentity.sessionId, selectedShortlistId);
    } catch (workflowError) {
      setError(
        workflowError instanceof Error
          ? workflowError.message
          : "Unable to create financial readiness"
      );
    }
  }

  async function handleUpdateFinancialReadiness(
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
  ) {
    try {
      await updateFinancialReadiness(id, patch);
      await refreshWorkflowState(sessionIdentity.sessionId, selectedShortlistId);
    } catch (workflowError) {
      setError(
        workflowError instanceof Error
          ? workflowError.message
          : "Unable to update financial readiness"
      );
    }
  }

  async function handleCreateOfferPreparation(payload: {
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
    notes?: string | null;
    buyerRationale?: string | null;
  }) {
    try {
      await createOfferPreparation({
        sessionId: sessionIdentity.sessionId,
        ...payload
      });
      await refreshWorkflowState(sessionIdentity.sessionId, payload.shortlistId ?? selectedShortlistId);
    } catch (workflowError) {
      setError(
        workflowError instanceof Error ? workflowError.message : "Unable to start offer preparation"
      );
    }
  }

  async function handleUpdateOfferPreparation(
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
      notes?: string | null;
      buyerRationale?: string | null;
    }
  ) {
    try {
      const record = await updateOfferPreparation(id, patch);
      await refreshWorkflowState(sessionIdentity.sessionId, record.shortlistId ?? selectedShortlistId);
    } catch (workflowError) {
      setError(
        workflowError instanceof Error ? workflowError.message : "Unable to update offer preparation"
      );
    }
  }

  async function handleCreateOfferSubmission(payload: {
    propertyId: string;
    propertyAddressLabel: string;
    shortlistId?: string | null;
    financialReadinessId?: string | null;
    offerPreparationId: string;
    submissionMethod?: OfferSubmission["submissionMethod"];
    offerExpirationAt?: string | null;
    notes?: string | null;
    internalActivityNote?: string | null;
  }) {
    try {
      await createOfferSubmission({
        sessionId: sessionIdentity.sessionId,
        ...payload
      });
      await refreshWorkflowState(sessionIdentity.sessionId, payload.shortlistId ?? selectedShortlistId);
    } catch (workflowError) {
      setError(
        workflowError instanceof Error ? workflowError.message : "Unable to start offer submission"
      );
    }
  }

  async function handleSubmitOfferSubmission(id: string, submittedAt?: string | null) {
    try {
      const record = await submitOfferSubmission(id, submittedAt);
      await refreshWorkflowState(sessionIdentity.sessionId, record.shortlistId ?? selectedShortlistId);
    } catch (workflowError) {
      setError(workflowError instanceof Error ? workflowError.message : "Unable to submit offer");
    }
  }

  async function handleUpdateOfferSubmission(
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
  ) {
    try {
      const record = await updateOfferSubmission(id, patch);
      await refreshWorkflowState(sessionIdentity.sessionId, record.shortlistId ?? selectedShortlistId);
    } catch (workflowError) {
      setError(workflowError instanceof Error ? workflowError.message : "Unable to update offer submission");
    }
  }

  async function handleRespondToOfferSubmissionCounter(
    id: string,
    decision: NonNullable<OfferSubmission["buyerCounterDecision"]>
  ) {
    try {
      const record = await respondToOfferSubmissionCounter(id, decision);
      await refreshWorkflowState(sessionIdentity.sessionId, record.shortlistId ?? selectedShortlistId);
    } catch (workflowError) {
      setError(
        workflowError instanceof Error ? workflowError.message : "Unable to respond to seller counteroffer"
      );
    }
  }

  async function handleCreateUnderContract(payload: {
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
  }) {
    try {
      await createUnderContractCoordination({
        sessionId: sessionIdentity.sessionId,
        ...payload
      });
      await refreshWorkflowState(sessionIdentity.sessionId, payload.shortlistId ?? selectedShortlistId);
    } catch (workflowError) {
      setError(
        workflowError instanceof Error
          ? workflowError.message
          : "Unable to start under-contract coordination"
      );
    }
  }

  async function handleUpdateUnderContract(
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
  ) {
    try {
      const record = await updateUnderContractCoordination(id, patch);
      await refreshWorkflowState(sessionIdentity.sessionId, record.shortlistId ?? selectedShortlistId);
    } catch (workflowError) {
      setError(
        workflowError instanceof Error
          ? workflowError.message
          : "Unable to update under-contract coordination"
      );
    }
  }

  async function handleUpdateUnderContractTask(
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
  ) {
    try {
      const record = await updateUnderContractTask(id, taskType, patch);
      await refreshWorkflowState(sessionIdentity.sessionId, record.shortlistId ?? selectedShortlistId);
    } catch (workflowError) {
      setError(
        workflowError instanceof Error
          ? workflowError.message
          : "Unable to update contract task"
      );
    }
  }

  async function handleUpdateUnderContractMilestone(
    id: string,
    milestoneType: UnderContractCoordination["milestoneSummaries"][number]["milestoneType"],
    patch: {
      status?: UnderContractCoordination["milestoneSummaries"][number]["status"];
      occurredAt?: string | null;
      notes?: string | null;
    }
  ) {
    try {
      const record = await updateUnderContractMilestone(id, milestoneType, patch);
      await refreshWorkflowState(sessionIdentity.sessionId, record.shortlistId ?? selectedShortlistId);
    } catch (workflowError) {
      setError(
        workflowError instanceof Error
          ? workflowError.message
          : "Unable to update contract milestone"
      );
    }
  }

  async function handleCreateClosingReadiness(payload: {
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
  }) {
    try {
      await createClosingReadiness({
        sessionId: sessionIdentity.sessionId,
        ...payload
      });
      await refreshWorkflowState(sessionIdentity.sessionId, payload.shortlistId ?? selectedShortlistId);
    } catch (workflowError) {
      setError(
        workflowError instanceof Error
          ? workflowError.message
          : "Unable to start closing readiness"
      );
    }
  }

  async function handleUpdateClosingReadiness(
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
  ) {
    try {
      const record = await updateClosingReadiness(id, patch);
      await refreshWorkflowState(sessionIdentity.sessionId, record.shortlistId ?? selectedShortlistId);
    } catch (workflowError) {
      setError(
        workflowError instanceof Error
          ? workflowError.message
          : "Unable to update closing readiness"
      );
    }
  }

  async function handleUpdateClosingChecklistItem(
    id: string,
    itemType: ClosingReadiness["checklistItemSummaries"][number]["itemType"],
    patch: {
      status?: ClosingReadiness["checklistItemSummaries"][number]["status"];
      deadline?: string | null;
      completedAt?: string | null;
      blockedReason?: string | null;
      notes?: string | null;
    }
  ) {
    try {
      const record = await updateClosingChecklistItem(id, itemType, patch);
      await refreshWorkflowState(sessionIdentity.sessionId, record.shortlistId ?? selectedShortlistId);
    } catch (workflowError) {
      setError(
        workflowError instanceof Error
          ? workflowError.message
          : "Unable to update closing checklist item"
      );
    }
  }

  async function handleUpdateClosingMilestone(
    id: string,
    milestoneType: ClosingReadiness["milestoneSummaries"][number]["milestoneType"],
    patch: {
      status?: ClosingReadiness["milestoneSummaries"][number]["status"];
      occurredAt?: string | null;
      notes?: string | null;
    }
  ) {
    try {
      const record = await updateClosingMilestone(id, milestoneType, patch);
      await refreshWorkflowState(sessionIdentity.sessionId, record.shortlistId ?? selectedShortlistId);
    } catch (workflowError) {
      setError(
        workflowError instanceof Error
          ? workflowError.message
          : "Unable to update closing milestone"
      );
    }
  }

  async function handleMarkClosingReady(id: string) {
    try {
      const record = await markClosingReady(id);
      await refreshWorkflowState(sessionIdentity.sessionId, record.shortlistId ?? selectedShortlistId);
    } catch (workflowError) {
      setError(
        workflowError instanceof Error
          ? workflowError.message
          : "Unable to mark closing readiness"
      );
    }
  }

  async function handleMarkClosingComplete(id: string) {
    try {
      const record = await markClosingComplete(id);
      await refreshWorkflowState(sessionIdentity.sessionId, record.shortlistId ?? selectedShortlistId);
    } catch (workflowError) {
      setError(
        workflowError instanceof Error
          ? workflowError.message
          : "Unable to mark closing complete"
      );
    }
  }

  async function handleCreateOfferReadiness(payload: {
    shortlistId: string;
    propertyId: string;
    status?: OfferReadiness["status"];
    financingReadiness?: OfferReadiness["inputs"]["financingReadiness"];
    propertyFitConfidence?: OfferReadiness["inputs"]["propertyFitConfidence"];
    riskToleranceAlignment?: OfferReadiness["inputs"]["riskToleranceAlignment"];
    riskLevel?: OfferReadiness["inputs"]["riskLevel"];
    userConfirmed?: boolean;
  }) {
    try {
      await createOfferReadiness(payload);
      await refreshWorkflowState(sessionIdentity.sessionId, payload.shortlistId);
    } catch (workflowError) {
      setError(
        workflowError instanceof Error ? workflowError.message : "Unable to start offer readiness"
      );
    }
  }

  async function handleUpdateOfferReadiness(
    id: string,
    patch: {
      status?: OfferReadiness["status"];
      financingReadiness?: OfferReadiness["inputs"]["financingReadiness"];
      propertyFitConfidence?: OfferReadiness["inputs"]["propertyFitConfidence"];
      riskToleranceAlignment?: OfferReadiness["inputs"]["riskToleranceAlignment"];
      riskLevel?: OfferReadiness["inputs"]["riskLevel"];
      userConfirmed?: boolean;
    }
  ) {
    try {
      const record = await updateOfferReadiness(id, patch);
      await refreshWorkflowState(sessionIdentity.sessionId, record.shortlistId);
    } catch (workflowError) {
      setError(
        workflowError instanceof Error ? workflowError.message : "Unable to update offer readiness"
      );
    }
  }

  async function handleCreateNegotiation(payload: {
    propertyId: string;
    shortlistId?: string | null;
    offerReadinessId?: string | null;
    status?: NegotiationRecord["status"];
    initialOfferPrice: number;
    currentOfferPrice?: number;
    buyerWalkAwayPrice?: number | null;
  }) {
    try {
      await createNegotiation(payload);
      await refreshWorkflowState(sessionIdentity.sessionId, payload.shortlistId ?? selectedShortlistId);
    } catch (workflowError) {
      setError(
        workflowError instanceof Error ? workflowError.message : "Unable to start negotiation tracking"
      );
    }
  }

  async function handleUpdateNegotiation(
    id: string,
    patch: {
      status?: NegotiationRecord["status"];
      currentOfferPrice?: number;
      sellerCounterPrice?: number | null;
      buyerWalkAwayPrice?: number | null;
      roundNumber?: number;
    }
  ) {
    try {
      const record = await updateNegotiation(id, patch);
      await refreshWorkflowState(sessionIdentity.sessionId, record.shortlistId ?? selectedShortlistId);
    } catch (workflowError) {
      setError(
        workflowError instanceof Error ? workflowError.message : "Unable to update negotiation"
      );
    }
  }

  async function handleAddNegotiationEvent(
    negotiationId: string,
    payload: {
      type: NegotiationEvent["type"];
      label: string;
      details?: string | null;
    }
  ) {
    try {
      await createNegotiationEvent(negotiationId, payload);
      await refreshWorkflowState(sessionIdentity.sessionId, selectedShortlistId);
    } catch (workflowError) {
      setError(
        workflowError instanceof Error ? workflowError.message : "Unable to append negotiation event"
      );
    }
  }

  async function handleSaveResultNote(entityId: string, noteId: string | null, body: string) {
    try {
      if (noteId) {
        await updateResultNote(noteId, body);
      } else {
        await createResultNote({
          sessionId: sessionIdentity.sessionId,
          entityType: "shortlist_item",
          entityId,
          body
        });
      }
      await refreshWorkflowState(sessionIdentity.sessionId, selectedShortlistId);
    } catch (workflowError) {
      setError(workflowError instanceof Error ? workflowError.message : "Unable to save note");
    }
  }

  async function handleDeleteResultNote(noteId: string) {
    try {
      await deleteResultNote(noteId);
      await refreshWorkflowState(sessionIdentity.sessionId, selectedShortlistId);
    } catch (workflowError) {
      setError(workflowError instanceof Error ? workflowError.message : "Unable to delete note");
    }
  }

  async function handleSaveSelectedHomeNote(body: string) {
    if (!selectedHomeNoteContext) {
      return;
    }

    try {
      if (selectedHomeNote) {
        await updateResultNote(selectedHomeNote.id, body);
      } else {
        await createResultNote({
          sessionId: sessionIdentity.sessionId,
          entityType: selectedHomeNoteContext.entityType,
          entityId: selectedHomeNoteContext.entityId,
          body
        });
      }
      await refreshWorkflowState(sessionIdentity.sessionId, selectedShortlistId);
    } catch (workflowError) {
      setError(workflowError instanceof Error ? workflowError.message : "Unable to save result note");
    }
  }

  async function handleDeleteSelectedHomeNote() {
    if (!selectedHomeNote) {
      return;
    }

    try {
      await deleteResultNote(selectedHomeNote.id);
      await refreshWorkflowState(sessionIdentity.sessionId, selectedShortlistId);
    } catch (workflowError) {
      setError(workflowError instanceof Error ? workflowError.message : "Unable to delete result note");
    }
  }

  async function handleOpenHistoricalCompare(itemId: string) {
    const item = shortlistItems.find((entry) => entry.id === itemId);
    if (!item) {
      return;
    }

    const currentHome =
      results?.homes.find(
        (home) => (home.canonicalPropertyId ?? home.id) === item.canonicalPropertyId
      ) ?? null;

    setHistoricalComparison(buildHistoricalComparison(item, currentHome));
    await trackUiMetric("historical_compare_view");
  }

  async function handleCreatePilotPartner(payload: {
    name: string;
    slug: string;
    status: "active" | "paused" | "inactive";
  }) {
    try {
      const created = await createPilotPartner(payload);
      await refreshOpsState(created.id);
    } catch (pilotError) {
      setOpsError(pilotError instanceof Error ? pilotError.message : "Unable to create pilot partner");
    }
  }

  async function handleSelectPilotPartner(partnerId: string) {
    setSelectedPilotPartnerId(partnerId);
    await refreshOpsState(partnerId);
  }

  async function handleUpdatePilotPartner(
    partnerId: string,
    patch: {
      status?: "active" | "paused" | "inactive";
      featureOverrides?: Partial<PilotContext["allowedFeatures"]>;
    }
  ) {
    try {
      await updatePilotPartner(partnerId, patch);
      await refreshOpsState(partnerId);
      if (pilotContext?.partnerId === partnerId && patch.status) {
        const nextContext = {
          ...pilotContext,
          status: patch.status
        };
        setPilotContext(nextContext);
        savePilotContext(localStorageRef, nextContext);
      }
    } catch (pilotError) {
      setOpsError(pilotError instanceof Error ? pilotError.message : "Unable to update pilot partner");
    }
  }

  async function handleCreatePilotLink(partnerId: string) {
    try {
      const created = await createPilotLink({
        partnerId
      });
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${window.location.origin}${created.url}`);
      }
      await refreshOpsState(partnerId);
    } catch (pilotError) {
      setOpsError(pilotError instanceof Error ? pilotError.message : "Unable to create pilot link");
    }
  }

  async function handleRevokePilotLink(token: string) {
    try {
      const revoked = await revokePilotLink(token);
      if (pilotContext?.pilotLinkId === revoked.id) {
        setPilotContext(null);
        savePilotContext(localStorageRef, null);
        setPilotLinkContext(null);
        setSessionIdentity((current) => ({
          ...current,
          partnerId: null,
          pilotLinkId: null
        }));
      }
      await refreshOpsState(revoked.partnerId);
    } catch (pilotError) {
      setOpsError(pilotError instanceof Error ? pilotError.message : "Unable to revoke pilot link");
    }
  }

  async function handlePilotCtaClick() {
    await trackUiMetric("cta_click");
  }

  async function handleCreateShortlistShare(
    shortlistId: string,
    shareMode: SharedShortlist["shareMode"]
  ) {
    try {
      const created = await createSharedShortlist({
        shortlistId,
        sessionId: sessionIdentity.sessionId,
        shareMode
      });
      setSharedLink(created.shareUrl);
      if (selectedShortlistId) {
        const shares = await fetchSharedShortlists(selectedShortlistId);
        setSharedShortlists(shares);
      }
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : "Unable to share shortlist");
    }
  }

  async function handleCopyShortlistShare(share: SharedShortlist) {
    const shareUrl = `${window.location.origin}/?sharedShortlist=${share.shareId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setSharedLink(shareUrl);
    } catch {
      setSharedLink(shareUrl);
    }
  }

  async function handleRevokeShortlistShare(shareId: string) {
    try {
      await revokeSharedShortlist(shareId);
      if (selectedShortlistId) {
        const shares = await fetchSharedShortlists(selectedShortlistId);
        setSharedShortlists(shares);
      }
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : "Unable to revoke shortlist share");
    }
  }

  async function handleSaveSharedComment(
    itemId: string,
    comment: SharedComment | null,
    body: string,
    authorLabel?: string | null
  ) {
    if (!sharedShortlistView) {
      return;
    }

    try {
      if (comment) {
        await updateSharedComment(comment.id, {
          body,
          authorLabel
        });
      } else {
        await createSharedComment({
          shareId: sharedShortlistView.share.shareId,
          entityType: "shared_shortlist_item",
          entityId: itemId,
          authorLabel,
          body
        });
      }
      await refreshSharedShortlistState(sharedShortlistView.share.shareId);
    } catch (collaborationError) {
      setError(
        collaborationError instanceof Error ? collaborationError.message : "Unable to save comment"
      );
    }
  }

  async function handleDeleteSharedComment(commentId: string) {
    if (!sharedShortlistView) {
      return;
    }

    try {
      await deleteSharedComment(commentId);
      await refreshSharedShortlistState(sharedShortlistView.share.shareId);
    } catch (collaborationError) {
      setError(
        collaborationError instanceof Error ? collaborationError.message : "Unable to delete comment"
      );
    }
  }

  async function handleSaveReviewerDecision(
    itemId: string,
    existing: ReviewerDecision | null,
    decision: ReviewerDecision["decision"],
    note?: string | null
  ) {
    if (!sharedShortlistView) {
      return;
    }

    try {
      if (existing) {
        await updateReviewerDecision(existing.id, {
          decision,
          note
        });
      } else {
        await createReviewerDecision({
          shareId: sharedShortlistView.share.shareId,
          shortlistItemId: itemId,
          decision,
          note
        });
      }
      await refreshSharedShortlistState(sharedShortlistView.share.shareId);
    } catch (collaborationError) {
      setError(
        collaborationError instanceof Error
          ? collaborationError.message
          : "Unable to save reviewer decision"
      );
    }
  }

  return (
    <div className="workspace-v0">
      <OnboardingModal onDismiss={handleDismissOnboarding} open={showOnboarding} />

      <header className="workspace-v0-header">
        <div className="workspace-v0-header-inner">
          <div className="workspace-v0-brand">
            <BrandMark />
            <span className="workspace-v0-badge">Workspace</span>
          </div>
          <div className="workspace-v0-meta">
            <span>{formState.locationValue || "Search setup"}</span>
            <span>{formatSearchBudget(formState)}</span>
            <span>{results ? `${visibleHomes.length} ranked homes` : "Ready to search"}</span>
          </div>
        </div>
      </header>

      <main className="page-shell">
        <div className="workspace-v0-shell">
          <section className="workspace-v0-hero">
            <div className="hero-panel">
              <p className="eyebrow">Decision workspace</p>
              <h1>
                {selectedChoiceSummary
                  ? "Selected-choice concierge, shortlist alternatives, and workflow in one surface."
                  : "Run the search, shape the shortlist, and keep the reasoning visible."}
              </h1>
              <p className="hero-copy">
                {selectedChoiceSummary
                  ? selectedChoiceSummary.concierge.recommendationSummary
                  : "This is the full operating surface behind the v0 experience. Use the left rail to control the search and saved workflow, then review ranked homes, snapshots, and offer-readiness context in one place."}
              </p>
              {selectedChoiceSummary ? (
                <SelectedChoiceSummaryCard
                  className="mt-5"
                  compact
                  summary={selectedChoiceSummary}
                  title={activeShortlist?.title ? `${activeShortlist.title} selected choice` : "Selected choice concierge"}
                />
              ) : null}
            </div>

            <div className="workspace-v0-stat-grid">
              <article className="workspace-v0-stat">
                <p className="workspace-v0-stat-label">Search area</p>
                <strong>{formState.locationValue || "Not set"}</strong>
                <span>{formatSearchBudget(formState)}</span>
              </article>
              <article className="workspace-v0-stat">
                <p className="workspace-v0-stat-label">Saved workflow</p>
                <strong>{shortlistItems.length}</strong>
                <span>{shortlistItems.length === 1 ? "home in shortlist" : "homes in shortlist"}</span>
              </article>
              <article className="workspace-v0-stat">
                <p className="workspace-v0-stat-label">Selected choice</p>
                <strong>
                  {selectedChoiceSummary?.property ? selectedChoiceSummary.property.address : "Not selected"}
                </strong>
                <span>
                  {selectedChoiceSummary
                    ? `${selectedChoiceSummary.decision.backupCount} backup${selectedChoiceSummary.decision.backupCount === 1 ? "" : "s"} · ${selectedChoiceSummary.concierge.nextAction}`
                    : "Promote one shortlist item to start the active workflow path"}
                </span>
              </article>
              <article className="workspace-v0-stat">
                <p className="workspace-v0-stat-label">Search memory</p>
                <strong>{snapshots.length + history.length}</strong>
                <span>{snapshots.length} snapshots and {history.length} reruns</span>
              </article>
            </div>
          </section>

          {pilotContext ? <PilotContextBanner context={pilotContext} /> : null}

          <section className="content-grid">
        {sharedSnapshotView || sharedShortlistView ? null : (
          <div className="sidebar-stack">
            <div className="panel">
              <NotificationCenterPanel
                history={workflowNotificationHistory}
                notifications={workflowNotifications}
                onDismiss={handleDismissWorkflowNotification}
                onMarkRead={handleMarkWorkflowNotificationRead}
              />
            </div>

            <div className="panel">
              <FinancialReadinessPanel
                notifications={financialReadinessNotifications}
                onCreate={handleCreateFinancialReadiness}
                onUpdate={handleUpdateFinancialReadiness}
                readiness={financialReadiness}
              />
            </div>

            <div className="panel">
              <SearchForm
                busy={busy}
                onChange={setFormState}
                onResetWeights={() =>
                  setFormState((current) => ({
                    ...current,
                    weights: DEFAULT_WEIGHTS
                  }))
                }
                onSubmit={handleSubmit}
                value={formState}
              />
            </div>

            {demoModeEnabled ? (
              <div className="panel">
                <DemoScenarioPanel onLoadScenario={handleLoadScenario} scenarios={demoScenarios} />
              </div>
            ) : null}

            <div className="panel">
              <RecentActivityPanel
                currentRequest={formState}
                definitions={definitions}
                history={history}
                onDeleteDefinition={handleDeleteDefinition}
                onOpenSnapshot={handleOpenSnapshot}
                onRestore={handleRestore}
                onRerunDefinition={handleRerunDefinition}
                onRerunHistory={handleRerunHistory}
                onSaveDefinition={handleSaveDefinition}
                onSaveLabelChange={setSaveLabel}
                onShareSnapshot={handleShareSnapshot}
                onTogglePinned={handleTogglePinned}
                saveLabel={saveLabel}
                savingDefinition={savingDefinition}
                sharingSnapshotId={sharingSnapshotId}
                snapshots={snapshots}
              />
            </div>

            {branding.enableShortlists ? (
              <div className="panel">
                <ShortlistPanel
                  financialReadiness={financialReadiness}
                  historicalCompareEnabled={branding.enableHistoricalCompare}
                  items={shortlistItems}
                  notifications={workflowNotifications}
                  selectedChoiceSummary={selectedChoiceSummary}
                  offerPreparations={offerPreparations}
                  offerSubmissions={offerSubmissions}
                  underContracts={underContracts}
                  closingReadiness={closingReadiness}
                  transactionCommandCenters={transactionCommandCenters}
                  offerReadiness={offerReadiness}
                  negotiations={negotiations}
                  negotiationEventsByRecordId={negotiationEventsByRecordId}
                  notes={resultNotes.filter((entry) => entry.entityType === "shortlist_item")}
                  onAddNegotiationEvent={handleAddNegotiationEvent}
                  onCopyShareLink={handleCopyShortlistShare}
                  onCreateNegotiation={handleCreateNegotiation}
                  onCreateOfferPreparation={handleCreateOfferPreparation}
                  onCreateOfferSubmission={handleCreateOfferSubmission}
                  onCreateOfferReadiness={handleCreateOfferReadiness}
                  onCreateUnderContract={handleCreateUnderContract}
                  onCreateShare={sharedShortlistsEnabled ? handleCreateShortlistShare : undefined}
                  onCreate={handleCreateShortlist}
                  onDelete={handleDeleteShortlist}
                  onDeleteNote={handleDeleteResultNote}
                  onDropChoice={handleDropShortlistChoice}
                  onMoveBackup={handleMoveShortlistBackup}
                  onOpenHistoricalCompare={handleOpenHistoricalCompare}
                  onRevokeShare={handleRevokeShortlistShare}
                  onRemoveItem={handleRemoveShortlistItem}
                  onReviewStateChange={handleReviewStateChange}
                  onUpdateDecision={handleUpdateShortlistDecision}
                  onSaveNote={handleSaveResultNote}
                  onSelectChoice={handleSelectShortlistChoice}
                  onSelect={handleSelectShortlist}
                  onSubmitOfferSubmission={handleSubmitOfferSubmission}
                  onTogglePinned={handleToggleShortlistPinned}
                  onUpdateNegotiation={handleUpdateNegotiation}
                  onUpdateOfferPreparation={handleUpdateOfferPreparation}
                  onUpdateOfferSubmission={handleUpdateOfferSubmission}
                  onUpdateOfferReadiness={handleUpdateOfferReadiness}
                  onUpdateUnderContract={handleUpdateUnderContract}
                  onUpdateUnderContractTask={handleUpdateUnderContractTask}
                  onUpdateUnderContractMilestone={handleUpdateUnderContractMilestone}
                  onCreateClosingReadiness={handleCreateClosingReadiness}
                  onUpdateClosingReadiness={handleUpdateClosingReadiness}
                  onUpdateClosingChecklistItem={handleUpdateClosingChecklistItem}
                  onUpdateClosingMilestone={handleUpdateClosingMilestone}
                  onMarkClosingReady={handleMarkClosingReady}
                  onMarkClosingComplete={handleMarkClosingComplete}
                  onRespondToOfferSubmissionCounter={handleRespondToOfferSubmissionCounter}
                  selectedShortlistId={selectedShortlistId}
                  sharedShortlists={sharedShortlists}
                  shortlists={shortlists}
                  workflowActivity={workflowActivity}
                />
              </div>
            ) : null}

            <div className="panel">
              <StakeholderNotesPanel note={stakeholderNote} onChange={setStakeholderNote} />
            </div>

            {branding.enableInternalOpsUi ? (
              <div className="panel">
                <OpsPanel
                  actions={opsActions}
                  activity={pilotActivity}
                  error={opsError}
                  links={pilotLinks}
                  loading={opsLoading}
                  onUpdateDataQualityEvent={handleUpdateDataQualityEvent}
                  onCreateLink={handleCreatePilotLink}
                  onCreatePartner={handleCreatePilotPartner}
                  onRefresh={() => void refreshOpsState()}
                  onRevokeLink={handleRevokePilotLink}
                  onSelectPartner={handleSelectPilotPartner}
                  onUpdatePartner={handleUpdatePilotPartner}
                  partners={pilotPartners}
                  qualityEvents={dataQualityEvents}
                  selectedPartnerId={selectedPilotPartnerId}
                  summary={
                    opsSummary
                      ? {
                          summary: opsSummary.summary,
                          performance: opsSummary.performance,
                          dataQualitySummary: opsSummary.dataQualitySummary,
                          goLiveCheck: opsSummary.goLiveCheck,
                          support: opsSummary.support,
                          releaseSummary: opsSummary.releaseSummary,
                          errors: opsSummary.errors
                        }
                      : null
                  }
                />
              </div>
            ) : null}
          </div>
        )}

        <div className="panel results-panel">
          {error ? <div className="error-banner">{error}</div> : null}

          {sharedShortlistView ? (
            <div className="decision-console">
              <SharedShortlistViewPanel
                collaborationActivity={collaborationActivity}
                comments={sharedComments}
                onDeleteComment={sharedCommentsEnabled ? handleDeleteSharedComment : undefined}
                onSaveComment={sharedCommentsEnabled ? handleSaveSharedComment : undefined}
                onSaveDecision={
                  reviewerDecisionsEnabled ? handleSaveReviewerDecision : undefined
                }
                reviewerDecisions={reviewerDecisions}
                sharedView={sharedShortlistView}
              />
            </div>
          ) : results ? (
            <div className="decision-console">
              {sharedSnapshotView ? (
                <SharedSnapshotBanner
                  appName={branding.appName}
                  sharedView={sharedSnapshotView}
                  tagline={branding.tagline}
                />
              ) : null}
              {activeDemoScenarioId && walkthroughVisible ? (
                <WalkthroughPanel
                  onDismiss={handleDismissWalkthrough}
                  steps={DEMO_WALKTHROUGH_STEPS}
                />
              ) : null}
              <SnapshotExecutiveSummary results={results} />
              <SearchSummaryPanel
                onSaveSnapshot={handleSaveSnapshot}
                onShareSnapshot={() => handleShareSnapshot()}
                results={results}
                savingSnapshot={savingSnapshot}
                sharingSnapshot={Boolean(sharingSnapshotId && sharingSnapshotId === snapshot?.id)}
                sharedLink={sharedLink}
                shareEnabled={sharedSnapshotsEnabled}
                snapshot={snapshot}
                readOnly={Boolean(sharedSnapshotView)}
              />

              <ExportPanel
                exportDisabled={!exportResultsEnabled}
                onCopySummary={handleCopySummary}
                onDownloadJson={handleDownloadJson}
                onPrintView={handlePrintView}
                snapshot={sharedSnapshotView?.snapshot ?? snapshot}
              />

              <PilotContactPanel
                ctaLabel={branding.pilotCtaLabel}
                ctaUrl={branding.enablePilotCta ? branding.pilotCtaUrl : null}
                onClick={handlePilotCtaClick}
              />

              <EmptyStatePanel results={results} onApplySuggestion={handleApplySuggestion} />

              {activeFeedbackPrompt ? (
                <FeedbackPrompt
                  category={FEEDBACK_PROMPTS[activeFeedbackPrompt].category}
                  onDismiss={() => setActiveFeedbackPrompt(null)}
                  onSubmit={handleFeedbackSubmit}
                  open
                  options={FEEDBACK_PROMPTS[activeFeedbackPrompt].options}
                  question={FEEDBACK_PROMPTS[activeFeedbackPrompt].question}
                  title={FEEDBACK_PROMPTS[activeFeedbackPrompt].title}
                />
              ) : null}

              <ResultControls controls={controls} onChange={setControls} resorted={resorted} />

              <ComparisonTray
                homes={comparedHomes}
                onRemove={(homeId) => setComparisonIds((current) => current.filter((id) => id !== homeId))}
              />

              <div className="results-stack">
                {visibleHomes.map((home, index) => (
                  <ResultCard
                    key={home.id}
                    compared={comparisonIds.includes(home.id)}
                    compareDisabled={comparisonIds.length >= 3}
                    home={home}
                    homes={results.homes}
                    onToggleShortlist={branding.enableShortlists ? handleToggleShortlist : undefined}
                    onOpenDetails={handleOpenDetails}
                    onToggleCompare={handleToggleCompare}
                    onViewAudit={handleViewAudit}
                    rank={index + 1}
                    reviewState={
                      shortlistItemsByCanonicalId.get(home.canonicalPropertyId ?? home.id)?.reviewState ?? null
                    }
                    shortlistItem={
                      shortlistItemsByCanonicalId.get(home.canonicalPropertyId ?? home.id) ?? null
                    }
                    shortlistDisabled={!branding.enableShortlists}
                    shortlistLabel={activeShortlist?.title ?? null}
                    shortlisted={shortlistItemsByCanonicalId.has(home.canonicalPropertyId ?? home.id)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p className="section-label">No search yet</p>
              <h2>Start with Southfield, MI</h2>
              <p className="muted">
                Save the search definition, rerun it later, or reopen an immutable snapshot without
                changing the ranking engine.
              </p>
              {activeDemoScenarioId ? (
                <p className="muted">Demo loaded: {activeDemoScenarioId}. Review the form, then run the search.</p>
              ) : null}
            </div>
          )}
        </div>
          </section>
        </div>

        <AuditDrawer
          audit={audit}
          error={auditError}
          loading={auditLoading}
          onClose={() => {
            setAudit(null);
            setAuditError(null);
          }}
        />

        <HomeDetailPanel
          allHomes={results?.homes ?? []}
          financialReadiness={financialReadiness}
          home={selectedHome}
          note={selectedHomeNote}
          selectedChoiceSummary={selectedChoiceSummary}
          shortlistItem={
            selectedHome
              ? shortlistItemsByCanonicalId.get(selectedHome.canonicalPropertyId ?? selectedHome.id) ?? null
              : null
          }
          negotiation={
            selectedHome
              ? negotiationsByPropertyId.get(selectedHome.canonicalPropertyId ?? selectedHome.id) ?? null
              : null
          }
          negotiationEvents={
            selectedHome
              ? negotiationEventsByRecordId[
                  negotiationsByPropertyId.get(selectedHome.canonicalPropertyId ?? selectedHome.id)?.id ?? ""
                ] ?? []
              : []
          }
          offerReadiness={
            selectedHome
              ? offerReadinessByPropertyId.get(selectedHome.canonicalPropertyId ?? selectedHome.id) ?? null
              : null
          }
          offerPreparation={
            selectedHome
              ? offerPreparationsByPropertyId.get(selectedHome.canonicalPropertyId ?? selectedHome.id) ?? null
              : null
          }
          offerSubmission={
            selectedHome
              ? offerSubmissionsByPropertyId.get(selectedHome.canonicalPropertyId ?? selectedHome.id) ?? null
              : null
          }
          underContract={
            selectedHome
              ? underContractsByPropertyId.get(selectedHome.canonicalPropertyId ?? selectedHome.id) ?? null
              : null
          }
          closingReadiness={
            selectedHome
              ? closingReadinessByPropertyId.get(selectedHome.canonicalPropertyId ?? selectedHome.id) ?? null
              : null
          }
          transactionCommandCenter={
            selectedHome
              ? transactionCommandCentersByPropertyId.get(
                  selectedHome.canonicalPropertyId ?? selectedHome.id
                ) ?? null
              : null
          }
          notifications={
            selectedHome
              ? workflowNotificationsByPropertyId.get(selectedHome.canonicalPropertyId ?? selectedHome.id) ?? []
              : []
          }
          unifiedActivity={
            selectedHome
              ? unifiedActivityByPropertyId.get(selectedHome.canonicalPropertyId ?? selectedHome.id) ?? []
              : []
          }
          noteEnabled={branding.enableResultNotes && Boolean(selectedHomeNoteContext)}
          onAddNegotiationEvent={handleAddNegotiationEvent}
          onClose={() => setSelectedHomeId(null)}
          onCreateNegotiation={handleCreateNegotiation}
          onCreateOfferPreparation={handleCreateOfferPreparation}
          onCreateOfferSubmission={handleCreateOfferSubmission}
          onCreateUnderContract={handleCreateUnderContract}
          onCreateClosingReadiness={handleCreateClosingReadiness}
          onDeleteNote={handleDeleteSelectedHomeNote}
          onDropChoice={handleDropShortlistChoice}
          onMarkClosingComplete={handleMarkClosingComplete}
          onMarkClosingReady={handleMarkClosingReady}
          onMoveBackup={handleMoveShortlistBackup}
          onRespondToOfferSubmissionCounter={handleRespondToOfferSubmissionCounter}
          onSaveNote={handleSaveSelectedHomeNote}
          onSelectChoice={handleSelectShortlistChoice}
          onSubmitOfferSubmission={handleSubmitOfferSubmission}
          onUpdateShortlistDecision={handleUpdateShortlistDecision}
          onUpdateNegotiation={handleUpdateNegotiation}
          onUpdateOfferPreparation={handleUpdateOfferPreparation}
          onUpdateOfferSubmission={handleUpdateOfferSubmission}
          onUpdateUnderContract={handleUpdateUnderContract}
          onUpdateUnderContractTask={handleUpdateUnderContractTask}
          onUpdateUnderContractMilestone={handleUpdateUnderContractMilestone}
          onUpdateClosingReadiness={handleUpdateClosingReadiness}
          onUpdateClosingChecklistItem={handleUpdateClosingChecklistItem}
          onUpdateClosingMilestone={handleUpdateClosingMilestone}
          onViewAudit={handleViewAudit}
        />

        <HistoricalComparePanel
          comparison={historicalComparison}
          onClose={() => setHistoricalComparison(null)}
        />
      </main>
    </div>
  );
}
