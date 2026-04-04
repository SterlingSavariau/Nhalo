import type {
  AuthenticatedUser,
  FinancialReadiness,
  ScoredHome,
  SearchRequest,
  SelectedChoiceConciergeSummary,
  WorkflowNotification
} from "@nhalo/types";
import { Check, ChevronRight, Circle, Heart, MapPin, Plus, Square, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OfferStrategyCard } from "@/components/OfferStrategyCard";
import { SelectedChoiceSummaryCard } from "@/components/SelectedChoiceSummaryCard";
import { AuthStatusControl } from "./AuthStatusControl";
import { buildOfferChecklist, buildHomeReasons, formatCurrency, formatSearchBudget } from "./format";
import { BrandMark } from "./BrandMark";

interface DashboardPageProps {
  busy: boolean;
  error: string | null;
  formState: SearchRequest;
  homes: ScoredHome[];
  user: AuthenticatedUser | null;
  shortlistedIds: Set<string>;
  selectedChoiceSummary: SelectedChoiceConciergeSummary | null;
  financialReadiness: FinancialReadiness | null;
  notifications: WorkflowNotification[];
  shortlistCount: number;
  onNavigate(path: string): void;
  onRunSearch(): void;
  onSignIn(): void;
  onSignOut(): void;
  onToggleShortlist(home: ScoredHome): void;
  onOpenHome(homeId: string): void;
  onOpenWorkspace(): void;
}

export function DashboardPage({
  busy,
  error,
  formState,
  homes,
  user,
  shortlistedIds,
  selectedChoiceSummary,
  financialReadiness,
  notifications,
  shortlistCount,
  onNavigate,
  onRunSearch,
  onSignIn,
  onSignOut,
  onToggleShortlist,
  onOpenHome,
  onOpenWorkspace
}: DashboardPageProps) {
  const checklist = buildOfferChecklist(financialReadiness, shortlistCount);
  const completedSteps = checklist.filter((step) => step.done).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-6">
          <nav className="flex h-14 items-center justify-between">
            <button
              className="inline-flex items-center"
              onClick={() => onNavigate("/")}
              type="button"
            >
              <BrandMark />
            </button>
            <div className="flex items-center gap-6">
              <span className="text-sm text-muted-foreground">
                {formState.locationValue} · {formatSearchBudget(formState)}
              </span>
              <Button
                className="rounded-none text-sm"
                onClick={onOpenWorkspace}
                size="sm"
                type="button"
                variant="ghost"
              >
                Workspace
              </Button>
              <AuthStatusControl onSignIn={onSignIn} onSignOut={onSignOut} user={user} />
            </div>
          </nav>
        </div>
      </header>

      <main className="pt-14">
        <div className="mx-auto max-w-7xl">
          <div className="flex">
            <div className="min-h-[calc(100vh-56px)] flex-1 border-r border-border">
              <div className="flex items-center gap-8 border-b border-border px-6 py-4">
                <button className="border-b-2 border-foreground pb-1 text-sm text-foreground" type="button">
                  Ranked for you
                </button>
                <button
                  className="border-b-2 border-transparent pb-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => onNavigate("/shortlist")}
                  type="button"
                >
                  Shortlist ({shortlistCount})
                </button>
                <div className="ml-auto flex items-center gap-3">
                  <Button
                    className="rounded-none text-sm font-normal"
                    disabled={busy}
                    onClick={onRunSearch}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {busy ? "Searching..." : "Refresh search"}
                  </Button>
                </div>
              </div>

              {error ? (
                <div className="border-b border-border px-6 py-3 text-sm text-destructive">{error}</div>
              ) : null}

              {homes.length > 0 ? (
                <div className="divide-y divide-border">
                  {homes.map((home, index) => {
                    const shortlisted = shortlistedIds.has(home.canonicalPropertyId ?? home.id);
                    const reasons = buildHomeReasons(home);

                    return (
                      <button
                        className="flex w-full gap-4 p-6 text-left transition-colors hover:bg-muted/30"
                        key={home.id}
                        onClick={() => onOpenHome(home.id)}
                        type="button"
                      >
                        <div className="w-8 flex-shrink-0 text-center">
                          <span className="text-sm text-muted-foreground">{index + 1}</span>
                        </div>

                        <div className="h-24 w-32 flex-shrink-0 overflow-hidden bg-muted">
                          <img
                            alt={home.address}
                            className="h-full w-full object-cover"
                            src="/placeholder.svg?height=200&width=300"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="font-medium text-foreground">{home.address}</h3>
                              <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                {home.city}, {home.state}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-foreground">{formatCurrency(home.price)}</p>
                              <div className="mt-1 flex items-center gap-1">
                                <Star className="h-3 w-3 fill-foreground text-foreground" />
                                <span className="text-sm font-medium">{home.scores.nhalo}</span>
                                <span className="ml-1 text-xs text-muted-foreground">
                                  {home.explainability?.headline ?? home.explanation}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{home.bedrooms} bd</span>
                            <span>{home.bathrooms} ba</span>
                            <span className="flex items-center gap-1">
                              <Square className="h-3 w-3" />
                              {home.sqft.toLocaleString()} sqft
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {reasons.map((reason) => (
                              <span className="bg-muted px-2 py-1 text-xs text-muted-foreground" key={reason}>
                                {reason}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-shrink-0 flex-col items-center gap-2">
                          <button
                            className={`border p-2 transition-colors ${
                              shortlisted
                                ? "border-foreground bg-foreground text-primary-foreground"
                                : "border-border hover:border-foreground"
                            }`}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              onToggleShortlist(home);
                            }}
                            type="button"
                          >
                            <Heart className={`h-4 w-4 ${shortlisted ? "fill-current" : ""}`} />
                          </button>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="px-6 py-16">
                  <h1 className="font-serif text-3xl text-foreground">Your dashboard is ready</h1>
                  <p className="mt-3 max-w-lg text-muted-foreground">
                    Run the search to rank homes for {formState.locationValue}. The redesigned
                    dashboard will populate with live results from the current search engine.
                  </p>
                  <div className="mt-8 flex gap-3">
                    <Button
                      className="rounded-none px-8"
                      disabled={busy}
                      onClick={onRunSearch}
                      type="button"
                    >
                      {busy ? "Searching..." : "Run search"}
                    </Button>
                    <Button
                      className="rounded-none"
                      onClick={() => onNavigate("/get-started")}
                      type="button"
                      variant="outline"
                    >
                      Edit setup
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="w-80 flex-shrink-0 space-y-8 p-6">
              {selectedChoiceSummary ? (
                <>
                  <SelectedChoiceSummaryCard summary={selectedChoiceSummary} title="Selected choice concierge" />
                  <OfferStrategyCard compact strategy={selectedChoiceSummary.offerStrategy} />
                </>
              ) : null}

              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-medium uppercase tracking-wider text-foreground">
                    Offer Ready
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    {completedSteps}/{checklist.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {checklist.map((step) => (
                    <div className="flex items-center gap-3 text-sm" key={step.id}>
                      {step.done ? (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      ) : (
                        <Circle className="h-5 w-5 text-border" />
                      )}
                      <span className={step.done ? "text-foreground" : "text-muted-foreground"}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>

                <Button
                  className="mt-4 w-full rounded-none text-sm"
                  onClick={onOpenWorkspace}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Complete checklist
                  <ChevronRight className="ml-2 h-3 w-3" />
                </Button>
              </div>

              <div className="space-y-4 border-t border-border pt-8">
                <div>
                  <h2 className="text-sm font-medium uppercase tracking-wider text-foreground">
                    Search setup
                  </h2>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {formState.locationValue} · {formatSearchBudget(formState)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formState.minBedrooms ?? 0}+ beds · {formState.minSqft ?? 0}+ sqft
                  </p>
                </div>
                <Button
                  className="w-full rounded-none text-sm font-normal"
                  onClick={() => onNavigate("/get-started")}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Plus className="mr-2 h-3 w-3" />
                  Update search
                </Button>
              </div>

              <div className="space-y-3 border-t border-border pt-8">
                <h2 className="text-sm font-medium uppercase tracking-wider text-foreground">
                  Agent updates
                </h2>
                {notifications.slice(0, 3).map((notification) => (
                  <div className="border border-border p-3" key={notification.id}>
                    <p className="text-sm text-foreground">{notification.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{notification.message}</p>
                  </div>
                ))}
                {notifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No active alerts. Open the workspace for saved searches, exports, and ops tools.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
