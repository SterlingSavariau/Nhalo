"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, ArrowRight, Check } from "lucide-react"

const PRIORITIES = [
  { id: "schools", label: "School quality" },
  { id: "price", label: "Price / value" },
  { id: "safety", label: "Safety" },
  { id: "commute", label: "Commute time" },
  { id: "space", label: "Space / lot size" },
  { id: "neighborhood", label: "Neighborhood vibe" },
]

export default function GetStartedPage() {
  const [step, setStep] = useState(1)
  const [location, setLocation] = useState("")
  const [budget, setBudget] = useState("")
  const [priorities, setPriorities] = useState<string[]>([])

  const togglePriority = (id: string) => {
    setPriorities((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  const canProceed =
    (step === 1 && location.trim()) ||
    (step === 2 && budget.trim()) ||
    (step === 3 && priorities.length > 0) ||
    step === 4

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-sm border-b border-border">
        <div className="mx-auto max-w-6xl px-6">
          <nav className="flex items-center justify-between h-16">
            <Link
              href="/"
              className="font-serif text-xl tracking-tight text-foreground"
            >
              Nhalo
            </Link>
            <span className="text-sm text-muted-foreground">
              Step {step} of 4
            </span>
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="pt-32 pb-24 px-6">
        <div className="mx-auto max-w-md">
          {/* Step 1: Location */}
          {step === 1 && (
            <div className="space-y-8">
              <div>
                <h1 className="font-serif text-3xl text-foreground">
                  Where are you looking?
                </h1>
                <p className="mt-3 text-muted-foreground">
                  City, neighborhood, or zip code.
                </p>
              </div>

              <Input
                type="text"
                placeholder="e.g. Austin, TX"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="h-12 rounded-none text-base"
                autoFocus
              />
            </div>
          )}

          {/* Step 2: Budget */}
          {step === 2 && (
            <div className="space-y-8">
              <div>
                <h1 className="font-serif text-3xl text-foreground">
                  What&apos;s your budget?
                </h1>
                <p className="mt-3 text-muted-foreground">
                  A rough range is fine.
                </p>
              </div>

              <Input
                type="text"
                placeholder="e.g. $500k - $700k"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="h-12 rounded-none text-base"
                autoFocus
              />
            </div>
          )}

          {/* Step 3: Priorities */}
          {step === 3 && (
            <div className="space-y-8">
              <div>
                <h1 className="font-serif text-3xl text-foreground">
                  What matters most?
                </h1>
                <p className="mt-3 text-muted-foreground">
                  Select all that apply. We&apos;ll rank homes based on these.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {PRIORITIES.map((priority) => {
                  const selected = priorities.includes(priority.id)
                  return (
                    <button
                      key={priority.id}
                      onClick={() => togglePriority(priority.id)}
                      className={`flex items-center justify-between px-4 py-3 border text-left transition-colors ${
                        selected
                          ? "border-foreground bg-foreground text-primary-foreground"
                          : "border-border bg-card text-foreground hover:border-foreground/50"
                      }`}
                    >
                      <span className="text-sm">{priority.label}</span>
                      {selected && <Check className="h-4 w-4" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 4: Complete */}
          {step === 4 && (
            <div className="space-y-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-foreground text-primary-foreground">
                <Check className="h-8 w-8" />
              </div>

              <div>
                <h1 className="font-serif text-3xl text-foreground">
                  You&apos;re all set
                </h1>
                <p className="mt-3 text-muted-foreground">
                  Your AI agent is ready to find homes in {location}.
                </p>
              </div>

              <div className="pt-4 space-y-4">
                <div className="p-4 border border-border bg-card text-left">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                    Your search
                  </p>
                  <p className="text-sm text-foreground">{location}</p>
                  <p className="text-sm text-muted-foreground">{budget}</p>
                </div>

                <div className="p-4 border border-border bg-card text-left">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                    Ranking by
                  </p>
                  <p className="text-sm text-foreground">
                    {priorities
                      .map((p) => PRIORITIES.find((pr) => pr.id === p)?.label)
                      .join(", ")}
                  </p>
                </div>
              </div>

              <Button
                size="lg"
                className="w-full rounded-none h-12 text-base font-normal mt-6"
                asChild
              >
                <Link href="/dashboard">
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}

          {/* Navigation */}
          {step < 4 && (
            <div className="flex items-center justify-between mt-12 pt-8 border-t border-border">
              <Button
                variant="ghost"
                onClick={() => setStep((s) => s - 1)}
                disabled={step === 1}
                className="rounded-none text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canProceed}
                className="rounded-none px-8 h-10"
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
