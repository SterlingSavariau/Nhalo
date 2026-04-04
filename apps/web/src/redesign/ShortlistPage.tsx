import type { AuthenticatedUser, ResultNote, SelectedChoiceConciergeSummary, ShortlistItem } from "@nhalo/types";
import {
  ArrowLeft,
  Bath,
  Heart,
  MapPin,
  Plus,
  Send,
  Square,
  Star
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { OfferStrategyCard } from "@/components/OfferStrategyCard";
import { SelectedChoiceSummaryCard } from "@/components/SelectedChoiceSummaryCard";
import { AuthStatusControl } from "./AuthStatusControl";
import { BrandMark } from "./BrandMark";
import { reviewStateLabel } from "./format";

interface ShortlistPageProps {
  items: ShortlistItem[];
  notes: ResultNote[];
  selectedChoiceSummary: SelectedChoiceConciergeSummary | null;
  shortlistTitle?: string | null;
  user: AuthenticatedUser | null;
  onNavigate(path: string): void;
  onOpenHome(homeId: string): void;
  onOpenWorkspace(): void;
  onSignIn(): void;
  onSignOut(): void;
}

export function ShortlistPage({
  items,
  notes,
  selectedChoiceSummary,
  shortlistTitle,
  user,
  onNavigate,
  onOpenHome,
  onOpenWorkspace,
  onSignIn,
  onSignOut
}: ShortlistPageProps) {
  const sortedItems = useMemo(
    () =>
      [...items].sort((left, right) => {
        const priority = (value: ShortlistItem["choiceStatus"]) => {
          switch (value) {
            case "closed":
              return 0;
            case "under_contract":
              return 1;
            case "active_pursuit":
              return 2;
            case "selected":
              return 3;
            case "backup":
              return 4;
            case "candidate":
              return 5;
            case "dropped":
              return 6;
            case "replaced":
              return 7;
          }
        };

        const delta = priority(left.choiceStatus) - priority(right.choiceStatus);
        if (delta !== 0) {
          return delta;
        }
        return (left.selectionRank ?? Number.POSITIVE_INFINITY) - (right.selectionRank ?? Number.POSITIVE_INFINITY);
      }),
    [items]
  );
  const [activeId, setActiveId] = useState(sortedItems[0]?.id ?? "");
  const primaryItem = useMemo(
    () =>
      sortedItems.find((item) =>
        ["selected", "active_pursuit", "under_contract", "closed"].includes(item.choiceStatus)
      ) ?? null,
    [sortedItems]
  );
  const activeItem = sortedItems.find((item) => item.id === activeId) ?? sortedItems[0] ?? null;

  const notesByCanonicalPropertyId = useMemo(() => {
    const map = new Map<string, ResultNote[]>();
    for (const note of notes) {
      const entries = map.get(note.entityId) ?? [];
      entries.push(note);
      map.set(note.entityId, entries);
    }
    return map;
  }, [notes]);

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-6">
          <nav className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-6">
              <button
                className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => onNavigate("/dashboard")}
                type="button"
              >
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </button>
              <span className="text-border">|</span>
              <span className="text-sm font-medium text-foreground">{shortlistTitle ?? "Shortlist"}</span>
            </div>

            <button
              className="inline-flex items-center"
              onClick={() => onNavigate("/")}
              type="button"
            >
              <BrandMark />
            </button>

            <div className="flex items-center gap-3">
              <Button
                className="rounded-none text-sm font-normal"
                onClick={onOpenWorkspace}
                size="sm"
                type="button"
                variant="outline"
              >
                <Plus className="mr-2 h-3 w-3" />
                Open workspace
              </Button>
              <AuthStatusControl onSignIn={onSignIn} onSignOut={onSignOut} user={user} />
            </div>
          </nav>
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-56px)] pt-14">
        <div className="mx-auto flex w-full max-w-7xl">
          <div className="w-[340px] flex-shrink-0 border-r border-border">
            <div className="border-b border-border px-6 py-4">
              <p className="text-sm text-muted-foreground">{items.length} homes tracked</p>
              {primaryItem ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Selected choice: {primaryItem.capturedHome.address}
                </p>
              ) : null}
            </div>

            {sortedItems.length > 0 ? (
              <div className="divide-y divide-border">
                {sortedItems.map((item) => {
                  const home = item.capturedHome;
                  const isActive = item.id === (activeItem?.id ?? "");
                  const statusLabel =
                    item.choiceStatus === "selected"
                      ? "Selected choice"
                      : item.choiceStatus === "backup"
                        ? `Backup${item.selectionRank ? ` #${item.selectionRank - 1}` : ""}`
                        : item.choiceStatus === "active_pursuit"
                          ? "Active pursuit"
                          : item.choiceStatus === "under_contract"
                            ? "Under contract"
                            : item.choiceStatus === "closed"
                              ? "Closed"
                              : item.choiceStatus === "dropped"
                                ? "Dropped"
                                : item.choiceStatus === "replaced"
                                  ? "Replaced"
                                  : "Candidate";

                  return (
                    <button
                      className={`w-full p-5 text-left transition-colors ${
                        isActive ? "bg-muted/50" : "hover:bg-muted/20"
                      }`}
                      key={item.id}
                      onClick={() => setActiveId(item.id)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{home.address}</p>
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {home.city}, {home.state}
                          </p>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-1">
                          <Star className="h-3 w-3 fill-foreground text-foreground" />
                          <span className="text-sm font-medium">{home.scores.nhalo}</span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-sm font-medium text-foreground">
                          ${home.price.toLocaleString()}
                        </p>
                        <span className="border border-border px-2 py-0.5 text-xs text-muted-foreground">
                          {statusLabel} · {reviewStateLabel(item.reviewState)}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{home.bedrooms}bd</span>
                        <span>{home.bathrooms}ba</span>
                        <span>{home.sqft.toLocaleString()} sqft</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-6 py-12">
                <p className="text-sm text-muted-foreground">
                  No shortlisted homes yet. Add homes from the dashboard shortlist controls.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col overflow-hidden">
            {activeItem ? (
              <>
                <div className="h-52 flex-shrink-0 bg-muted">
                  <img
                    alt={activeItem.capturedHome.address}
                    className="h-full w-full object-cover"
                    src="/placeholder.svg?height=200&width=300"
                  />
                </div>

                <div className="flex flex-1 overflow-hidden">
                  <div className="flex-1 overflow-y-auto border-r border-border p-8">
                    <div className="flex items-start justify-between">
                      <div>
                        {selectedChoiceSummary ? (
                          <>
                            <SelectedChoiceSummaryCard
                              className="mb-8"
                              compact={
                                (selectedChoiceSummary.property?.canonicalPropertyId ?? null) !==
                                activeItem.canonicalPropertyId
                              }
                              summary={selectedChoiceSummary}
                              title="Selected choice concierge"
                            />
                            <OfferStrategyCard
                              className="mb-8"
                              compact={
                                (selectedChoiceSummary.property?.canonicalPropertyId ?? null) !==
                                activeItem.canonicalPropertyId
                              }
                              strategy={selectedChoiceSummary.offerStrategy}
                            />
                          </>
                        ) : null}
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          {activeItem.choiceStatus === "selected"
                            ? "Selected choice"
                            : activeItem.choiceStatus === "backup"
                              ? `Backup${activeItem.selectionRank ? ` #${activeItem.selectionRank - 1}` : ""}`
                              : activeItem.choiceStatus.replaceAll("_", " ")}
                        </p>
                        <h1 className="font-serif text-2xl text-foreground">
                          {activeItem.capturedHome.address}
                        </h1>
                        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {activeItem.capturedHome.city}, {activeItem.capturedHome.state}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-serif text-2xl text-foreground">
                          ${activeItem.capturedHome.price.toLocaleString()}
                        </p>
                        <div className="mt-1 flex items-center justify-end gap-1.5">
                          <Star className="h-4 w-4 fill-foreground text-foreground" />
                          <span className="text-base font-medium">{activeItem.capturedHome.scores.nhalo}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 border-y border-border py-4 text-sm text-muted-foreground">
                      <span>{activeItem.capturedHome.bedrooms} beds</span>
                      <span className="flex items-center gap-1.5">
                        <Bath className="h-4 w-4" />
                        {activeItem.capturedHome.bathrooms} baths
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Square className="h-4 w-4" />
                        {activeItem.capturedHome.sqft.toLocaleString()} sqft
                      </span>
                    </div>

                    <div className="mt-10">
                      <h2 className="mb-5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Decision intelligence
                      </h2>
                      <p className="text-lg text-foreground">
                        {activeItem.decisionRationale?.trim()
                          ? activeItem.decisionRationale
                          : activeItem.capturedHome.explainability?.headline ?? activeItem.capturedHome.explanation}
                      </p>
                      <div className="mt-5 space-y-3">
                        {(activeItem.capturedHome.explainability?.strengths ?? activeItem.capturedHome.strengths ?? []).map(
                          (reason) => (
                            <div className="border border-border p-4" key={reason}>
                              <p className="text-sm text-foreground">{reason}</p>
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    <div className="mt-10">
                      <Button
                        className="rounded-none"
                        onClick={() => onOpenHome(activeItem.capturedHome.id)}
                        type="button"
                      >
                        View full property
                      </Button>
                    </div>
                  </div>

                  <div className="w-[360px] flex-shrink-0 overflow-y-auto p-6">
                    <div className="mb-6 flex items-center gap-2">
                      <Heart className="h-4 w-4 fill-current text-foreground" />
                      <h2 className="text-sm font-medium uppercase tracking-wider text-foreground">
                        Family Notes
                      </h2>
                    </div>

                    <div className="space-y-4">
                      {(notesByCanonicalPropertyId.get(activeItem.id) ?? []).map((note) => (
                        <div className="border border-border p-4" key={note.id}>
                          <p className="text-sm text-foreground">{note.body}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Updated {new Date(note.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                      ))}

                      {(notesByCanonicalPropertyId.get(activeItem.id) ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Notes and collaboration tools remain available in the workspace.
                        </p>
                      ) : null}
                    </div>

                    <Button
                      className="mt-6 w-full rounded-none"
                      onClick={onOpenWorkspace}
                      type="button"
                      variant="outline"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Open collaboration workspace
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center px-8">
                <p className="text-muted-foreground">Select a shortlisted home to review it here.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
