import type { AuthenticatedUser } from "@nhalo/types";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthStatusControl } from "./AuthStatusControl";
import { BrandMark } from "./BrandMark";

interface LandingPageProps {
  user: AuthenticatedUser | null;
  onNavigate(path: string): void;
  onSignIn(): void;
  onSignOut(): void;
}

export function LandingPage({ user, onNavigate, onSignIn, onSignOut }: LandingPageProps) {
  const primaryCtaLabel = user ? "Open dashboard" : "Try the AI Agent";
  const primaryCtaPath = user ? "/dashboard" : "/get-started";

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6">
          <nav className="flex h-20 items-center justify-between">
            <button
              className="inline-flex items-center"
              onClick={() => onNavigate("/")}
              type="button"
            >
              <BrandMark />
            </button>
            <div className="flex items-center gap-8">
              <a
                className="hidden text-sm text-[#2f5d50] transition-colors hover:text-[#23483d] sm:block"
                href="#product"
              >
                Product
              </a>
              <AuthStatusControl onSignIn={onSignIn} onSignOut={onSignOut} user={user} />
              <Button
                className="h-9 rounded-none px-6 text-sm font-normal"
                onClick={() => onNavigate(primaryCtaPath)}
                size="sm"
                type="button"
              >
                {user ? "Dashboard" : "Get Started"}
              </Button>
            </div>
          </nav>
        </div>
      </header>

      <main>
        <section className="pb-24 pt-32 lg:pb-32 lg:pt-40">
          <div className="mx-auto max-w-6xl px-6">
            <div className="max-w-3xl">
              <h1 className="font-serif text-4xl font-normal leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Your AI agent for buying a home
              </h1>

              <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Nhalo ranks homes by what matters to you, keeps your family aligned, and gets you
                offer-ready.
              </p>

              <div className="mt-10">
                <Button
                  className="h-12 rounded-none px-8 text-base font-normal"
                  onClick={() => onNavigate(primaryCtaPath)}
                  size="lg"
                  type="button"
                >
                  {primaryCtaLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="mt-20 lg:mt-24">
              <div className="overflow-hidden rounded-sm border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between border-b border-border px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-foreground">Family Homes in Austin</span>
                    <span className="text-xs text-muted-foreground">12 ranked</span>
                  </div>
                  <div className="flex items-center gap-6 text-xs text-muted-foreground">
                    <span>Shortlist (3)</span>
                    <span>Offer Ready</span>
                  </div>
                </div>

                <div className="grid lg:grid-cols-[1fr,320px]">
                  <div className="space-y-4 p-6">
                    <PreviewRow
                      address="4521 Oak Valley Dr"
                      details="4 bed · 3 bath · 2,850 sqft"
                      price="$685,000"
                      rank={1}
                      reason="Best match: price/sqft, 9/10 schools, low crime"
                      shortlisted
                    />
                    <PreviewRow
                      address="892 Maple Creek Ln"
                      details="3 bed · 2.5 bath · 2,200 sqft"
                      price="$545,000"
                      rank={2}
                      reason="Strong value, shorter commute, newer build"
                    />
                    <PreviewRow
                      address="1203 Willow Bend Ct"
                      details="4 bed · 3.5 bath · 3,100 sqft"
                      price="$725,000"
                      rank={3}
                      reason="Largest lot, pool, premium finishes"
                    />
                  </div>

                  <div className="hidden border-l border-border bg-secondary/30 p-6 lg:block">
                    <p className="mb-4 text-xs uppercase tracking-wider text-muted-foreground">
                      Why #1
                    </p>
                    <p className="text-sm leading-relaxed text-foreground">
                      Based on your priorities: school quality, value, safety, and commute.
                    </p>
                    <p className="mt-4 text-sm leading-relaxed text-foreground">
                      This home scores highest overall. It&apos;s under budget with a strong school
                      rating and stable neighborhood signals.
                    </p>
                    <div className="mt-6 border-t border-border pt-6">
                      <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
                        Family Notes
                      </p>
                      <p className="text-sm italic text-muted-foreground">
                        &quot;Kids loved the backyard. Close to mom.&quot;
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border py-24 lg:py-32" id="product">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-16 lg:grid-cols-3 lg:gap-12">
              <Feature
                description="Set what matters, then see every home scored and ranked automatically."
                title="Ranked by your priorities"
              />
              <Feature
                description="Add notes, share opinions, and keep the whole family on the same page."
                title="One shortlist for everyone"
              />
              <Feature
                description="Track pre-approval, inspections, and paperwork before you make an offer."
                title="Offer-ready when you are"
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <button
              className="inline-flex items-center"
              onClick={() => onNavigate("/")}
              type="button"
            >
              <BrandMark compact />
            </button>
            <div className="flex items-center gap-8 text-sm text-[#2f5d50]">
              <a className="text-[#2f5d50] transition-colors hover:text-[#23483d]" href="#">
                Privacy
              </a>
              <a className="text-[#2f5d50] transition-colors hover:text-[#23483d]" href="#">
                Terms
              </a>
              <a className="text-[#2f5d50] transition-colors hover:text-[#23483d]" href="#">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PreviewRow(props: {
  rank: number;
  address: string;
  details: string;
  price: string;
  reason: string;
  shortlisted?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-4 rounded-sm p-4 transition-colors ${
        props.shortlisted ? "bg-secondary/50" : "hover:bg-secondary/30"
      }`}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-xs font-medium text-primary-foreground">
        {props.rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <span className="font-medium text-foreground">{props.address}</span>
          {props.shortlisted ? (
            <span className="text-xs text-muted-foreground">Shortlisted</span>
          ) : null}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{props.details}</p>
        <p className="mt-2 text-xs text-muted-foreground">{props.reason}</p>
      </div>
      <span className="text-sm font-medium text-foreground">{props.price}</span>
    </div>
  );
}

function Feature(props: { title: string; description: string }) {
  return (
    <div>
      <h3 className="font-serif text-xl text-foreground">{props.title}</h3>
      <p className="mt-3 leading-relaxed text-muted-foreground">{props.description}</p>
    </div>
  );
}
