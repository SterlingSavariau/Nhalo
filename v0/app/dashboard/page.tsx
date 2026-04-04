"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Heart,
  Star,
  MapPin,
  Bed,
  Bath,
  Square,
  ChevronRight,
  Check,
  Circle,
  Plus,
  MessageSquare,
} from "lucide-react"

const HOMES = [
  {
    id: 1,
    address: "2847 Willow Creek Dr",
    city: "Austin, TX",
    price: 625000,
    beds: 4,
    baths: 3,
    sqft: 2450,
    score: 94,
    scoreLabel: "Excellent match",
    reasons: ["Top-rated schools", "12 min commute", "Quiet street"],
    image: "/placeholder.svg?height=200&width=300",
  },
  {
    id: 2,
    address: "1523 Oak Valley Ln",
    city: "Austin, TX",
    price: 589000,
    beds: 3,
    baths: 2,
    sqft: 2100,
    score: 88,
    scoreLabel: "Strong match",
    reasons: ["Great value", "Large backyard", "New construction"],
    image: "/placeholder.svg?height=200&width=300",
  },
  {
    id: 3,
    address: "4201 Sunrise Blvd",
    city: "Austin, TX",
    price: 675000,
    beds: 4,
    baths: 3,
    sqft: 2800,
    score: 85,
    scoreLabel: "Good match",
    reasons: ["Pool", "Corner lot", "Updated kitchen"],
    image: "/placeholder.svg?height=200&width=300",
  },
  {
    id: 4,
    address: "892 Maple Heights",
    city: "Austin, TX",
    price: 545000,
    beds: 3,
    baths: 2,
    sqft: 1950,
    score: 82,
    scoreLabel: "Good match",
    reasons: ["Best price/sqft", "Move-in ready", "Near park"],
    image: "/placeholder.svg?height=200&width=300",
  },
]

const OFFER_STEPS = [
  { id: 1, label: "Pre-approval letter", done: true },
  { id: 2, label: "Proof of funds", done: true },
  { id: 3, label: "Agent connected", done: false },
  { id: 4, label: "Offer template ready", done: false },
]

export default function DashboardPage() {
  const [prospects, setProspects] = useState<number[]>([1, 2])
  const [activeTab] = useState<"ranked">("ranked")

  const toggleProspect = (id: number) => {
    setProspects((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const completedSteps = OFFER_STEPS.filter((s) => s.done).length

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
        <div className="mx-auto max-w-7xl px-6">
          <nav className="flex items-center justify-between h-14">
            <Link href="/" className="font-serif text-xl tracking-tight text-foreground">
              Nhalo
            </Link>
            <div className="flex items-center gap-6">
              <span className="text-sm text-muted-foreground">
                Austin, TX &middot; $500k–$700k
              </span>
              <Button variant="ghost" size="sm" className="rounded-none text-sm">
                Settings
              </Button>
            </div>
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="pt-14">
        <div className="mx-auto max-w-7xl">
          <div className="flex">
            {/* Left: Homes List */}
            <div className="flex-1 border-r border-border min-h-[calc(100vh-56px)]">
              {/* Tabs */}
              <div className="flex items-center gap-8 px-6 py-4 border-b border-border">
                <button
                  className="text-sm pb-1 border-b-2 border-foreground text-foreground"
                >
                  Ranked for you
                </button>
                <Link
                  href="/prospects"
                  className="text-sm pb-1 border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors"
                >
                  Prospects ({prospects.length})
                </Link>
              </div>

              {/* Homes */}
              <div className="divide-y divide-border">
                {HOMES.map((home, index) => (
                  <Link
                    href={`/home/${home.id}`}
                    key={home.id}
                    className="flex gap-4 p-6 hover:bg-muted/30 transition-colors"
                  >
                    {/* Rank */}
                    <div className="flex-shrink-0 w-8 text-center">
                      <span className="text-sm text-muted-foreground">{index + 1}</span>
                    </div>

                    {/* Image */}
                    <div className="flex-shrink-0 w-32 h-24 bg-muted overflow-hidden">
                      <img
                        src={home.image}
                        alt={home.address}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-medium text-foreground">{home.address}</h3>
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" />
                            {home.city}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-foreground">
                            ${home.price.toLocaleString()}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <Star className="h-3 w-3 text-foreground fill-foreground" />
                            <span className="text-sm font-medium">{home.score}</span>
                            <span className="text-xs text-muted-foreground ml-1">
                              {home.scoreLabel}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Bed className="h-3 w-3" />{home.beds}
                        </span>
                        <span className="flex items-center gap-1">
                          <Bath className="h-3 w-3" />{home.baths}
                        </span>
                        <span className="flex items-center gap-1">
                          <Square className="h-3 w-3" />{home.sqft.toLocaleString()} sqft
                        </span>
                      </div>

                      {/* AI Reasons */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {home.reasons.map((reason) => (
                          <span key={reason} className="text-xs px-2 py-1 bg-muted text-muted-foreground">
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Prospect toggle */}
                    <div className="flex-shrink-0 flex flex-col items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          toggleProspect(home.id)
                        }}
                        className={`p-2 border transition-colors ${
                          prospects.includes(home.id)
                            ? "border-foreground bg-foreground text-primary-foreground"
                            : "border-border hover:border-foreground"
                        }`}
                      >
                        <Heart className={`h-4 w-4 ${prospects.includes(home.id) ? "fill-current" : ""}`} />
                      </button>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Right: Sidebar */}
            <div className="w-80 flex-shrink-0 p-6 space-y-8">
              {/* Offer Readiness */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium text-foreground uppercase tracking-wider">
                    Offer Ready
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    {completedSteps}/{OFFER_STEPS.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {OFFER_STEPS.map((step) => (
                    <div key={step.id} className="flex items-center gap-3 text-sm">
                      {step.done ? (
                        <div className="w-5 h-5 rounded-full bg-foreground flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      ) : (
                        <Circle className="w-5 h-5 text-border" />
                      )}
                      <span className={step.done ? "text-foreground" : "text-muted-foreground"}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>

                <Button variant="outline" size="sm" className="w-full mt-4 rounded-none text-sm">
                  Complete checklist
                  <ChevronRight className="ml-2 h-3 w-3" />
                </Button>
              </div>

              {/* Quick Actions */}
              <div>
                <h2 className="text-sm font-medium text-foreground uppercase tracking-wider mb-4">
                  Quick Actions
                </h2>
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full justify-start rounded-none text-sm font-normal">
                    <Plus className="mr-2 h-3 w-3" />
                    Add a listing
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start rounded-none text-sm font-normal">
                    <MessageSquare className="mr-2 h-3 w-3" />
                    Ask Nhalo
                  </Button>
                </div>
              </div>

              {/* Prospects widget */}
              {prospects.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-medium text-foreground uppercase tracking-wider">
                      Prospects
                    </h2>
                    <Link href="/prospects" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      View all
                    </Link>
                  </div>

                  <div className="space-y-2">
                    {HOMES.filter((h) => prospects.includes(h.id)).map((home) => (
                      <Link
                        key={home.id}
                        href={`/home/${home.id}`}
                        className="flex items-center justify-between p-3 border border-border bg-card hover:bg-muted/30 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">{home.address}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">${home.price.toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-foreground text-foreground" />
                          <span className="text-sm font-medium">{home.score}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
