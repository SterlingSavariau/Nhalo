import type {
  AuthenticatedUser,
  BuyerTransactionCommandCenterView,
  ClosingReadiness,
  FinancialReadiness,
  NegotiationEvent,
  NegotiationRecord,
  OfferPreparation,
  OfferSubmission,
  OfferReadiness,
  ScoredHome,
  SelectedChoiceConciergeSummary,
  UnderContractCoordination,
  UnifiedActivityRecord,
  WorkflowNotification
} from "@nhalo/types";
import {
  ArrowLeft,
  Bath,
  Bed,
  Heart,
  MapPin,
  Square,
  Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BuyerTransactionCommandCenterCard } from "@/components/BuyerTransactionCommandCenterCard";
import { ClosingReadinessCard } from "@/components/ClosingReadinessCard";
import { NegotiationTrackerCard } from "@/components/NegotiationTrackerCard";
import { OfferPreparationCard } from "@/components/OfferPreparationCard";
import { OfferSubmissionCard } from "@/components/OfferSubmissionCard";
import { OfferStrategyCard } from "@/components/OfferStrategyCard";
import { SelectedChoiceSummaryCard } from "@/components/SelectedChoiceSummaryCard";
import { UnderContractCoordinationCard } from "@/components/UnderContractCoordinationCard";
import { UnifiedActivityFeedPanel } from "@/components/UnifiedActivityFeedPanel";
import { AuthStatusControl } from "./AuthStatusControl";
import { formatCurrency } from "./format";
import { BrandMark } from "./BrandMark";

interface HomePageProps {
  home: ScoredHome | null;
  user: AuthenticatedUser | null;
  shortlisted: boolean;
  selectedChoiceSummary: SelectedChoiceConciergeSummary | null;
  financialReadiness: FinancialReadiness | null;
  offerPreparation: OfferPreparation | null;
  offerSubmission: OfferSubmission | null;
  underContract: UnderContractCoordination | null;
  closingReadiness: ClosingReadiness | null;
  transactionCommandCenter: BuyerTransactionCommandCenterView | null;
  notifications: WorkflowNotification[];
  unifiedActivity: UnifiedActivityRecord[];
  negotiation: NegotiationRecord | null;
  negotiationEvents: NegotiationEvent[];
  onNavigate(path: string): void;
  onSignIn(): void;
  onSignOut(): void;
  onToggleShortlist(): void;
  onOpenWorkspace(): void;
  onCreateNegotiation?: React.ComponentProps<typeof NegotiationTrackerCard>["onCreate"];
  onUpdateNegotiation?: React.ComponentProps<typeof NegotiationTrackerCard>["onUpdate"];
  onAddNegotiationEvent?: React.ComponentProps<typeof NegotiationTrackerCard>["onAddEvent"];
  onCreateOfferPreparation?: React.ComponentProps<typeof OfferPreparationCard>["onCreate"];
  onUpdateOfferPreparation?: React.ComponentProps<typeof OfferPreparationCard>["onUpdate"];
  onCreateOfferSubmission?: React.ComponentProps<typeof OfferSubmissionCard>["onCreate"];
  onSubmitOfferSubmission?: React.ComponentProps<typeof OfferSubmissionCard>["onSubmit"];
  onUpdateOfferSubmission?: React.ComponentProps<typeof OfferSubmissionCard>["onUpdate"];
  onRespondToOfferSubmissionCounter?: React.ComponentProps<typeof OfferSubmissionCard>["onRespondToCounter"];
  onCreateUnderContract?: React.ComponentProps<typeof UnderContractCoordinationCard>["onCreate"];
  onUpdateUnderContract?: React.ComponentProps<typeof UnderContractCoordinationCard>["onUpdate"];
  onUpdateUnderContractTask?: React.ComponentProps<typeof UnderContractCoordinationCard>["onUpdateTask"];
  onUpdateUnderContractMilestone?: React.ComponentProps<typeof UnderContractCoordinationCard>["onUpdateMilestone"];
  onCreateClosingReadiness?: React.ComponentProps<typeof ClosingReadinessCard>["onCreate"];
  onUpdateClosingReadiness?: React.ComponentProps<typeof ClosingReadinessCard>["onUpdate"];
  onUpdateClosingChecklistItem?: React.ComponentProps<typeof ClosingReadinessCard>["onUpdateChecklistItem"];
  onUpdateClosingMilestone?: React.ComponentProps<typeof ClosingReadinessCard>["onUpdateMilestone"];
  onMarkClosingReady?: React.ComponentProps<typeof ClosingReadinessCard>["onMarkReady"];
  onMarkClosingComplete?: React.ComponentProps<typeof ClosingReadinessCard>["onMarkComplete"];
}

export function HomePage({
  home,
  user,
  shortlisted,
  selectedChoiceSummary,
  financialReadiness,
  offerPreparation,
  offerSubmission,
  underContract,
  closingReadiness,
  transactionCommandCenter,
  notifications,
  unifiedActivity,
  negotiation,
  negotiationEvents,
  onNavigate,
  onSignIn,
  onSignOut,
  onToggleShortlist,
  onOpenWorkspace,
  onCreateNegotiation,
  onUpdateNegotiation,
  onAddNegotiationEvent,
  onCreateOfferPreparation,
  onUpdateOfferPreparation,
  onCreateOfferSubmission,
  onSubmitOfferSubmission,
  onUpdateOfferSubmission,
  onRespondToOfferSubmissionCounter,
  onCreateUnderContract,
  onUpdateUnderContract,
  onUpdateUnderContractTask,
  onUpdateUnderContractMilestone,
  onCreateClosingReadiness,
  onUpdateClosingReadiness,
  onUpdateClosingChecklistItem,
  onUpdateClosingMilestone,
  onMarkClosingReady,
  onMarkClosingComplete
}: HomePageProps) {
  if (!home) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="text-center">
          <p className="text-muted-foreground">Home not loaded yet.</p>
          <Button className="mt-4 rounded-none" onClick={() => onNavigate("/dashboard")} type="button">
            Back to dashboard
          </Button>
        </div>
      </div>
    );
  }

  const currentPropertyId = home.canonicalPropertyId ?? home.id;
  const selectedChoicePropertyId = selectedChoiceSummary?.property?.canonicalPropertyId ?? null;
  const summaryMatchesHome = selectedChoicePropertyId === currentPropertyId;

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-6">
          <nav className="flex h-14 items-center justify-between">
            <button
              className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => onNavigate("/dashboard")}
              type="button"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to homes
            </button>

            <button
              className="inline-flex items-center"
              onClick={() => onNavigate("/")}
              type="button"
            >
              <BrandMark />
            </button>

            <div className="flex items-center gap-3">
              <Button
                className="rounded-none"
                onClick={onToggleShortlist}
                size="sm"
                type="button"
                variant={shortlisted ? "default" : "outline"}
              >
                <Heart className={`mr-2 h-4 w-4 ${shortlisted ? "fill-current" : ""}`} />
                {shortlisted ? "In Shortlist" : "Add to Shortlist"}
              </Button>
              <AuthStatusControl onSignIn={onSignIn} onSignOut={onSignOut} user={user} />
            </div>
          </nav>
        </div>
      </header>

      <main className="pt-14">
        <div className="mx-auto max-w-7xl">
          <div className="grid h-[400px] grid-cols-4 gap-1">
            <div className="col-span-2 row-span-2 bg-muted">
              <img
                alt={home.address}
                className="h-full w-full object-cover"
                src="/placeholder.svg?height=500&width=800"
              />
            </div>
            {Array.from({ length: 3 }).map((_, index) => (
              <div className="bg-muted" key={index}>
                <img
                  alt={`${home.address} ${index + 2}`}
                  className="h-full w-full object-cover"
                  src="/placeholder.svg?height=500&width=800"
                />
              </div>
            ))}
          </div>

          <div className="flex">
            <div className="flex-1 border-r border-border p-8">
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="font-serif text-3xl text-foreground">{home.address}</h1>
                    <p className="mt-1 flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {home.city}, {home.state} {home.zipCode}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-serif text-3xl text-foreground">{formatCurrency(home.price)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {home.distanceMiles?.toFixed(1) ?? "0.0"} miles away
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-6 border-t border-border pt-6">
                  <div className="flex items-center gap-2">
                    <Bed className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{home.bedrooms} beds</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Bath className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{home.bathrooms} baths</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Square className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{home.sqft.toLocaleString()} sqft</span>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    <Star className="h-4 w-4 fill-foreground text-foreground" />
                    <span className="text-base font-medium">{home.scores.nhalo}</span>
                    <span className="text-sm text-muted-foreground">Nhalo score</span>
                  </div>
                </div>
              </div>

              <section className="mt-10">
                {selectedChoiceSummary ? (
                  <>
                    <SelectedChoiceSummaryCard
                      className="mb-8"
                      compact={!summaryMatchesHome}
                      summary={selectedChoiceSummary}
                      title={summaryMatchesHome ? "Selected choice concierge" : "Current selected choice"}
                    />
                    <OfferStrategyCard
                      className="mb-8"
                      compact={!summaryMatchesHome}
                      strategy={selectedChoiceSummary.offerStrategy}
                    />
                  </>
                ) : null}

                <h2 className="mb-5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  AI explanation
                </h2>
                <div className="space-y-4">
                  <div className="border border-border p-5">
                    <p className="text-lg text-foreground">
                      {home.explainability?.headline ?? home.explanation}
                    </p>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Primary: {home.explainability?.scoreDrivers.primary ?? "n/a"} · Secondary:{" "}
                      {home.explainability?.scoreDrivers.secondary ?? "n/a"} · Weakest:{" "}
                      {home.explainability?.scoreDrivers.weakest ?? "n/a"}
                    </p>
                  </div>

                  {(home.explainability?.strengths ?? home.strengths ?? []).map((item) => (
                    <div className="border border-border p-4" key={item}>
                      <p className="text-sm text-foreground">{item}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-10">
                <h2 className="mb-5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Buyer workflow
                </h2>
                <div className="space-y-6">
                  <NegotiationTrackerCard
                    events={negotiationEvents}
                    negotiation={negotiation}
                    onAddEvent={onAddNegotiationEvent}
                    onCreate={onCreateNegotiation}
                    onUpdate={onUpdateNegotiation}
                    offerReadiness={null}
                    property={home}
                    shortlistId={null}
                  />
                  <OfferPreparationCard
                    anchorPrice={home.price}
                    financialReadiness={financialReadiness}
                    offerPreparation={offerPreparation}
                    onCreate={onCreateOfferPreparation}
                    onUpdate={onUpdateOfferPreparation}
                    offerReadiness={null}
                    offerStrategy={summaryMatchesHome ? selectedChoiceSummary?.offerStrategy ?? null : null}
                    propertyAddressLabel={home.address}
                    propertyId={home.canonicalPropertyId ?? home.id}
                    shortlistId={null}
                  />
                  <OfferSubmissionCard
                    financialReadiness={financialReadiness}
                    offerPreparation={offerPreparation}
                    offerSubmission={offerSubmission}
                    onCreate={onCreateOfferSubmission}
                    onRespondToCounter={onRespondToOfferSubmissionCounter}
                    onSubmit={onSubmitOfferSubmission}
                    onUpdate={onUpdateOfferSubmission}
                    property={home}
                    shortlistId={null}
                  />
                  <UnderContractCoordinationCard
                    financialReadiness={financialReadiness}
                    offerPreparation={offerPreparation}
                    offerSubmission={offerSubmission}
                    onCreate={onCreateUnderContract}
                    onUpdate={onUpdateUnderContract}
                    onUpdateMilestone={onUpdateUnderContractMilestone}
                    onUpdateTask={onUpdateUnderContractTask}
                    property={home}
                    shortlistId={null}
                    underContract={underContract}
                  />
                  <ClosingReadinessCard
                    closingReadiness={closingReadiness}
                    financialReadiness={financialReadiness}
                    offerPreparation={offerPreparation}
                    offerSubmission={offerSubmission}
                    onCreate={onCreateClosingReadiness}
                    onMarkComplete={onMarkClosingComplete}
                    onMarkReady={onMarkClosingReady}
                    onUpdate={onUpdateClosingReadiness}
                    onUpdateChecklistItem={onUpdateClosingChecklistItem}
                    onUpdateMilestone={onUpdateClosingMilestone}
                    property={home}
                    shortlistId={null}
                    underContract={underContract}
                  />
                </div>
              </section>
            </div>

            <div className="w-[360px] flex-shrink-0 space-y-8 p-6">
              <div>
                <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-foreground">
                  Activity
                </h2>
                <UnifiedActivityFeedPanel activity={unifiedActivity} />
              </div>

              <div>
                <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-foreground">
                  Command center
                </h2>
                <BuyerTransactionCommandCenterCard commandCenter={transactionCommandCenter} />
              </div>

              <div className="space-y-3 border-t border-border pt-8">
                <h2 className="text-sm font-medium uppercase tracking-wider text-foreground">
                  Notifications
                </h2>
                {notifications.slice(0, 4).map((notification) => (
                  <div className="border border-border p-3" key={notification.id}>
                    <p className="text-sm text-foreground">{notification.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{notification.message}</p>
                  </div>
                ))}
                <Button
                  className="w-full rounded-none"
                  onClick={onOpenWorkspace}
                  type="button"
                  variant="outline"
                >
                  Open full workspace
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
