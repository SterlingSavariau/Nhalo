import type { AuthenticatedUser, SearchRequest } from "@nhalo/types";
import { ArrowLeft, ArrowRight, Check, Loader2, MapPin } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchLocationSuggestions, type LocationSuggestionResult } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { AuthStatusControl } from "./AuthStatusControl";
import { BrandMark } from "./BrandMark";

const PRIORITIES = [
  { id: "schools", label: "School quality" },
  { id: "price", label: "Price / value" },
  { id: "safety", label: "Safety" },
  { id: "commute", label: "Commute time" },
  { id: "space", label: "Space / lot size" },
  { id: "neighborhood", label: "Neighborhood vibe" }
] as const;

const GOOGLE_MAPS_SCRIPT_SRC = "https://maps.googleapis.com/maps/api/js";
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? "";
// Keep Google Places wired for the official switch, but disable it for now.
const ENABLE_GOOGLE_PLACES = false;
const BUDGET_MIN = 100_000;
const BUDGET_MAX = 1_500_000;
const BUDGET_STEP = 25_000;
const DEFAULT_BUDGET_RANGE: [number, number] = [300_000, 500_000];

let googleMapsScriptPromise: Promise<void> | null = null;

function loadGoogleMapsPlacesScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Places is only available in the browser."));
  }

  if (window.google?.maps?.places?.Autocomplete) {
    return Promise.resolve();
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(new Error("Google Places is not configured yet."));
  }

  if (googleMapsScriptPromise) {
    return googleMapsScriptPromise;
  }

  googleMapsScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src^="${GOOGLE_MAPS_SCRIPT_SRC}"]`
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Google Places failed to load.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = `${GOOGLE_MAPS_SCRIPT_SRC}?key=${encodeURIComponent(
      GOOGLE_MAPS_API_KEY
    )}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Places failed to load."));
    document.head.appendChild(script);
  });

  return googleMapsScriptPromise;
}

function inferLocationType(value: string): SearchRequest["locationType"] {
  const trimmed = value.trim();
  if (/^\d{5}$/.test(trimmed)) {
    return "zip";
  }

  if (/^\d+\s/.test(trimmed)) {
    return "address";
  }

  return "city";
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function clampBudget(value: number): number {
  return Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, value));
}

function roundBudgetToStep(value: number): number {
  return Math.round(value / BUDGET_STEP) * BUDGET_STEP;
}

function getInitialBudgetRange(budget?: SearchRequest["budget"]): [number, number] {
  if (!budget?.min && !budget?.max) {
    return DEFAULT_BUDGET_RANGE;
  }

  const min = budget.min ? clampBudget(roundBudgetToStep(budget.min)) : DEFAULT_BUDGET_RANGE[0];
  const max = budget.max ? clampBudget(roundBudgetToStep(budget.max)) : DEFAULT_BUDGET_RANGE[1];

  if (min >= max) {
    return [Math.max(BUDGET_MIN, max - BUDGET_STEP), max];
  }

  return [min, max];
}

interface GetStartedPageProps {
  initialRequest: SearchRequest;
  user: AuthenticatedUser | null;
  onBackHome(): void;
  onComplete(nextRequest: SearchRequest): Promise<void> | void;
  onSignIn(): void;
  onSignOut(): void;
}

export function GetStartedPage({
  initialRequest,
  user,
  onBackHome,
  onComplete,
  onSignIn,
  onSignOut
}: GetStartedPageProps) {
  const locationInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState(1);
  const [location, setLocation] = useState(initialRequest.locationValue);
  const [budgetRange, setBudgetRange] = useState<[number, number]>(() =>
    getInitialBudgetRange(initialRequest.budget)
  );
  const [priorities, setPriorities] = useState<string[]>([]);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestionResult[]>([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [activeLocationSuggestionIndex, setActiveLocationSuggestionIndex] = useState(0);
  const [placesReady, setPlacesReady] = useState(false);
  const [placesLoading, setPlacesLoading] = useState(
    step === 1 && ENABLE_GOOGLE_PLACES && GOOGLE_MAPS_API_KEY.length > 0
  );
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canProceed = useMemo(
    () =>
      Boolean(
        (step === 1 && location.trim()) ||
          (step === 2 && budgetRange[0] < budgetRange[1]) ||
          (step === 3 && priorities.length > 0) ||
          step === 4
      ),
    [budgetRange, location, priorities.length, step]
  );

  useEffect(() => {
    if (!ENABLE_GOOGLE_PLACES) {
      return;
    }

    if (step !== 1 || !locationInputRef.current) {
      return;
    }

    if (!GOOGLE_MAPS_API_KEY) {
      setPlacesLoading(false);
      setPlacesReady(false);
      setPlacesError("Google Places needs a `VITE_GOOGLE_MAPS_API_KEY` to return US locations.");
      return;
    }

    let disposed = false;
    let autocompleteInstance: {
      addListener(eventName: "place_changed", handler: () => void): void;
      getPlace(): {
        name?: string;
        formatted_address?: string;
        types?: string[];
        address_components?: Array<{
          long_name: string;
          short_name: string;
          types: string[];
        }>;
      };
    } | null = null;

    async function attachPlacesAutocomplete() {
      setPlacesLoading(true);
      setPlacesError(null);

      try {
        await loadGoogleMapsPlacesScript();
        if (disposed || !locationInputRef.current || !window.google?.maps?.places?.Autocomplete) {
          return;
        }

        autocompleteInstance = new window.google.maps.places.Autocomplete(locationInputRef.current, {
          componentRestrictions: {
            country: "us"
          },
          fields: ["formatted_address", "name", "types", "address_components"],
          types: ["(regions)"]
        });

        autocompleteInstance.addListener("place_changed", () => {
          const place = autocompleteInstance?.getPlace();
          const fallback = locationInputRef.current?.value?.trim() ?? "";
          const formattedAddress = place?.formatted_address?.trim();
          const placeName = place?.name?.trim();
          const nextValue = formattedAddress || placeName || fallback;

          if (nextValue) {
            setLocation(nextValue);
          }
        });

        setPlacesReady(true);
      } catch (error) {
        if (!disposed) {
          setPlacesReady(false);
          setPlacesError(
            error instanceof Error ? error.message : "Google Places could not initialize."
          );
        }
      } finally {
        if (!disposed) {
          setPlacesLoading(false);
        }
      }
    }

    void attachPlacesAutocomplete();

    return () => {
      disposed = true;
      if (autocompleteInstance && window.google?.maps?.event?.clearInstanceListeners) {
        window.google.maps.event.clearInstanceListeners(autocompleteInstance);
      }
    };
  }, [step]);

  useEffect(() => {
    if (step !== 1 || ENABLE_GOOGLE_PLACES) {
      return;
    }

    const query = location.trim();
    if (query.length < 2) {
      setLocationSuggestions([]);
      setPlacesLoading(false);
      setPlacesError(null);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setPlacesLoading(true);
      setPlacesError(null);

      try {
        const suggestions = await fetchLocationSuggestions(query, 8);
        setLocationSuggestions(suggestions);
        setActiveLocationSuggestionIndex(0);
      } catch (error) {
        setLocationSuggestions([]);
        setPlacesError(
          error instanceof Error ? error.message : "Location suggestions could not load."
        );
      } finally {
        setPlacesLoading(false);
      }
    }, 150);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [location, step]);

  function togglePriority(id: string) {
    setPriorities((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );
  }

  function applyLocationSuggestion(suggestion: LocationSuggestionResult) {
    setLocation(suggestion.locationValue);
    setShowLocationSuggestions(false);
    setActiveLocationSuggestionIndex(0);
  }

  function buildRequest(): SearchRequest {
    const nextWeights = {
      ...initialRequest.weights!,
      price: priorities.includes("price") ? 45 : 30,
      size: priorities.some((entry) => ["space", "commute", "neighborhood"].includes(entry))
        ? 35
        : 30,
      safety: priorities.some((entry) => ["schools", "safety"].includes(entry)) ? 35 : 30
    };

    return {
      ...initialRequest,
      locationType: inferLocationType(location),
      locationValue: location.trim(),
      budget: {
        ...initialRequest.budget,
        min: budgetRange[0],
        max: budgetRange[1]
      },
      preferences: priorities,
      weights: nextWeights
    };
  }

  async function handleComplete() {
    setSubmitting(true);
    try {
      await onComplete(buildRequest());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6">
          <nav className="flex h-16 items-center justify-between">
            <button
              className="inline-flex items-center"
              onClick={onBackHome}
              type="button"
            >
              <BrandMark />
            </button>
            <div className="flex items-center gap-4">
              <span className="hidden text-sm text-muted-foreground sm:inline">Step {step} of 4</span>
              <AuthStatusControl onSignIn={onSignIn} onSignOut={onSignOut} user={user} />
            </div>
          </nav>
        </div>
      </header>

      <main className="px-6 pb-24 pt-32">
        <div className="mx-auto max-w-md">
          {step === 1 ? (
            <div className="space-y-8">
              <div>
                <h1 className="font-serif text-3xl text-foreground">Where are you looking?</h1>
                <p className="mt-3 text-muted-foreground">City, neighborhood, or zip code.</p>
              </div>

              <div className="relative">
                <Input
                  autoFocus
                  autoComplete="off"
                  className="h-12 rounded-none pr-10 text-base"
                  onBlur={() => {
                    window.setTimeout(() => setShowLocationSuggestions(false), 120);
                  }}
                  onChange={(event) => {
                    setLocation(event.target.value);
                    setShowLocationSuggestions(true);
                  }}
                  onFocus={() => setShowLocationSuggestions(true)}
                  onKeyDown={(event) => {
                    if (!locationSuggestions.length) {
                      return;
                    }

                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setShowLocationSuggestions(true);
                      setActiveLocationSuggestionIndex((current) =>
                        Math.min(current + 1, locationSuggestions.length - 1)
                      );
                    }

                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setActiveLocationSuggestionIndex((current) => Math.max(current - 1, 0));
                    }

                    if (event.key === "Enter" && showLocationSuggestions) {
                      const suggestion = locationSuggestions[activeLocationSuggestionIndex];
                      if (suggestion) {
                        event.preventDefault();
                        applyLocationSuggestion(suggestion);
                      }
                    }

                    if (event.key === "Escape") {
                      setShowLocationSuggestions(false);
                    }
                  }}
                  placeholder="e.g. Southfield, MI"
                  ref={locationInputRef}
                  type="text"
                  value={location}
                />
                {placesLoading ? (
                  <Loader2 className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                ) : (
                  <MapPin className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                )}

                {!ENABLE_GOOGLE_PLACES && showLocationSuggestions && locationSuggestions.length > 0 ? (
                  <div className="absolute top-[calc(100%+0.25rem)] left-0 right-0 z-20 border border-border bg-card shadow-sm">
                    {locationSuggestions.map((suggestion, index) => {
                      const active = index === activeLocationSuggestionIndex;
                      return (
                        <button
                          className={`flex w-full items-center justify-between border-b border-border px-4 py-3 text-left last:border-b-0 ${
                            active ? "bg-secondary text-foreground" : "bg-card text-foreground"
                          }`}
                          key={suggestion.id}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            applyLocationSuggestion(suggestion);
                          }}
                          type="button"
                        >
                          <span className="text-sm">{suggestion.label}</span>
                          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            {suggestion.detail}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <p className="text-sm text-muted-foreground">
                Start typing to search U.S. cities while Google Places is temporarily disabled.
              </p>

              {placesError ? <p className="text-sm text-destructive">{placesError}</p> : null}
              {!ENABLE_GOOGLE_PLACES ? (
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Free U.S. city autocomplete active
                </p>
              ) : null}
              {ENABLE_GOOGLE_PLACES && placesReady ? (
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Powered by Google Places
                </p>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-8">
              <div>
                <h1 className="font-serif text-3xl text-foreground">What&apos;s your budget?</h1>
                <p className="mt-3 text-muted-foreground">A rough range is fine.</p>
              </div>

              <div className="space-y-6">
                <div className="border border-border bg-card px-5 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Budget range
                  </p>
                  <p className="mt-2 font-serif text-2xl text-foreground">
                    {formatCurrency(budgetRange[0])} - {formatCurrency(budgetRange[1])}
                  </p>
                </div>

                <Slider
                  aria-label="Budget range"
                  autoFocus
                  className="py-3"
                  max={BUDGET_MAX}
                  min={BUDGET_MIN}
                  onValueChange={(value) => {
                    if (value.length < 2) {
                      return;
                    }

                    setBudgetRange([value[0]!, value[1]!]);
                  }}
                  step={BUDGET_STEP}
                  value={budgetRange}
                />

                <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <span>{formatCurrency(BUDGET_MIN)}</span>
                  <span>{formatCurrency(BUDGET_MAX)}</span>
                </div>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-8">
              <div>
                <h1 className="font-serif text-3xl text-foreground">What matters most?</h1>
                <p className="mt-3 text-muted-foreground">
                  Select all that apply. We&apos;ll rank homes based on these.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {PRIORITIES.map((priority) => {
                  const selected = priorities.includes(priority.id);
                  return (
                    <button
                      className={`flex items-center justify-between border px-4 py-3 text-left transition-colors ${
                        selected
                          ? "border-foreground bg-foreground text-primary-foreground"
                          : "border-border bg-card text-foreground hover:border-foreground/50"
                      }`}
                      key={priority.id}
                      onClick={() => togglePriority(priority.id)}
                      type="button"
                    >
                      <span className="text-sm">{priority.label}</span>
                      {selected ? <Check className="h-4 w-4" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-8 text-center">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-foreground text-primary-foreground">
                <Check className="h-8 w-8" />
              </div>

              <div>
                <h1 className="font-serif text-3xl text-foreground">You&apos;re all set</h1>
                <p className="mt-3 text-muted-foreground">
                  Your AI agent is ready to find homes in {location}.
                </p>
              </div>

              <div className="space-y-4 pt-4">
                <div className="border border-border bg-card p-4 text-left">
                  <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                    Your search
                  </p>
                  <p className="text-sm text-foreground">{location}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(budgetRange[0])} - {formatCurrency(budgetRange[1])}
                  </p>
                </div>

                <div className="border border-border bg-card p-4 text-left">
                  <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                    Ranking by
                  </p>
                  <p className="text-sm text-foreground">
                    {priorities
                      .map((priorityId) => PRIORITIES.find((entry) => entry.id === priorityId)?.label)
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              </div>

              <Button
                className="mt-6 h-12 w-full rounded-none text-base font-normal"
                disabled={submitting}
                onClick={() => void handleComplete()}
                size="lg"
                type="button"
              >
                Go to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ) : null}

          {step < 4 ? (
            <div className="mt-12 flex items-center justify-between border-t border-border pt-8">
              <Button
                className="rounded-none text-muted-foreground hover:text-foreground"
                disabled={step === 1}
                onClick={() => setStep((current) => current - 1)}
                type="button"
                variant="ghost"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              <Button
                className="h-10 rounded-none px-8"
                disabled={!canProceed}
                onClick={() => setStep((current) => current + 1)}
                type="button"
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
