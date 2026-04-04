"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Star,
  MapPin,
  Bed,
  Bath,
  Square,
  TrendingUp,
  TrendingDown,
  Heart,
  Calendar,
  MessageSquare,
  ChevronRight,
  Plus,
  Send,
  Check,
  X,
} from "lucide-react"

const PROSPECTS = [
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
    daysOnMarket: 12,
    status: "viewing_scheduled",
    viewingDate: "Sat Apr 5, 10:00am",
    priceChange: null,
    image: "/placeholder.svg?height=200&width=300",
    notes: [
      { author: "Sarah", time: "2 days ago", text: "Love the open kitchen layout. Perfect for hosting." },
      { author: "Mike", time: "2 days ago", text: "Backyard feels small. Could we expand the deck?" },
      { author: "Sarah", time: "1 day ago", text: "Checked — deck expansion allowed per HOA." },
    ],
    priorities: [
      { label: "Schools", score: 98, trend: "up" },
      { label: "Commute", score: 92, trend: "up" },
      { label: "Safety", score: 95, trend: "up" },
      { label: "Outdoor space", score: 78, trend: "down" },
    ],
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
    daysOnMarket: 8,
    status: "considering",
    viewingDate: null,
    priceChange: -10000,
    image: "/placeholder.svg?height=200&width=300",
    notes: [
      { author: "Mike", time: "3 days ago", text: "Great value per sqft. New construction is a big plus." },
      { author: "Sarah", time: "1 day ago", text: "Schedule second viewing this weekend?" },
    ],
    priorities: [
      { label: "Schools", score: 85, trend: "up" },
      { label: "Commute", score: 88, trend: "up" },
      { label: "Safety", score: 91, trend: "up" },
      { label: "Outdoor space", score: 90, trend: "up" },
    ],
  },
]

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  viewing_scheduled: { label: "Viewing scheduled", color: "text-green-700 bg-green-50 border-green-200" },
  considering: { label: "Considering", color: "text-amber-700 bg-amber-50 border-amber-200" },
  offer_pending: { label: "Offer pending", color: "text-blue-700 bg-blue-50 border-blue-200" },
  passed: { label: "Passed", color: "text-muted-foreground bg-muted border-border" },
}

export default function ProspectsPage() {
  const [activeId, setActiveId] = useState<number>(PROSPECTS[0].id)
  const [noteInputs, setNoteInputs] = useState<Record<number, string>>({})
  const [notes, setNotes] = useState<Record<number, { author: string; time: string; text: string }[]>>(
    Object.fromEntries(PROSPECTS.map((p) => [p.id, p.notes]))
  )

  const activeHome = PROSPECTS.find((p) => p.id === activeId)!
  const activeNotes = notes[activeId] ?? []

  const sendNote = (id: number) => {
    const text = noteInputs[id]?.trim()
    if (!text) return
    setNotes((prev) => ({
      ...prev,
      [id]: [...(prev[id] ?? []), { author: "You", time: "Just now", text }],
    }))
    setNoteInputs((prev) => ({ ...prev, [id]: "" }))
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
        <div className="mx-auto max-w-7xl px-6">
          <nav className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </Link>
              <span className="text-border">|</span>
              <span className="text-sm font-medium text-foreground">
                Prospects
              </span>
            </div>

            <Link href="/" className="font-serif text-xl tracking-tight text-foreground">
              Nhalo
            </Link>

            <Button variant="outline" size="sm" className="rounded-none text-sm font-normal">
              <Plus className="mr-2 h-3 w-3" />
              Add prospect
            </Button>
          </nav>
        </div>
      </header>

      <main className="pt-14 flex min-h-[calc(100vh-56px)]">
        <div className="mx-auto max-w-7xl w-full flex">

          {/* Left: Prospect List */}
          <div className="w-[340px] flex-shrink-0 border-r border-border">
            <div className="px-6 py-4 border-b border-border">
              <p className="text-sm text-muted-foreground">
                {PROSPECTS.length} homes tracked
              </p>
            </div>

            <div className="divide-y divide-border">
              {PROSPECTS.map((home) => {
                const status = STATUS_MAP[home.status]
                const isActive = home.id === activeId
                return (
                  <button
                    key={home.id}
                    onClick={() => setActiveId(home.id)}
                    className={`w-full text-left p-5 transition-colors ${
                      isActive ? "bg-muted/50" : "hover:bg-muted/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{home.address}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {home.city}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Star className="h-3 w-3 fill-foreground text-foreground" />
                        <span className="text-sm font-medium">{home.score}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <p className="text-sm font-medium text-foreground">
                        ${home.price.toLocaleString()}
                        {home.priceChange && (
                          <span className="ml-2 text-xs text-green-700 font-normal">
                            ↓ ${Math.abs(home.priceChange).toLocaleString()}
                          </span>
                        )}
                      </p>
                      <span className={`text-xs px-2 py-0.5 border ${status.color}`}>
                        {status.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{home.beds}bd</span>
                      <span>{home.baths}ba</span>
                      <span>{home.sqft.toLocaleString()} sqft</span>
                      <span className="ml-auto">{home.daysOnMarket}d on market</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right: Active Prospect Detail */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Property image strip */}
            <div className="h-52 bg-muted flex-shrink-0">
              <img
                src={activeHome.image}
                alt={activeHome.address}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex flex-1 overflow-hidden">

              {/* Center: Analysis */}
              <div className="flex-1 overflow-y-auto p-8 space-y-10 border-r border-border">

                {/* Title */}
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="font-serif text-2xl text-foreground">{activeHome.address}</h1>
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {activeHome.city}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-serif text-2xl text-foreground">${activeHome.price.toLocaleString()}</p>
                    <div className="flex items-center justify-end gap-1.5 mt-1">
                      <Star className="h-4 w-4 fill-foreground text-foreground" />
                      <span className="text-base font-medium">{activeHome.score}</span>
                      <span className="text-sm text-muted-foreground">{activeHome.scoreLabel}</span>
                    </div>
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-6 text-sm text-muted-foreground border-t border-b border-border py-4">
                  <span className="flex items-center gap-1.5"><Bed className="h-4 w-4" />{activeHome.beds} beds</span>
                  <span className="flex items-center gap-1.5"><Bath className="h-4 w-4" />{activeHome.baths} baths</span>
                  <span className="flex items-center gap-1.5"><Square className="h-4 w-4" />{activeHome.sqft.toLocaleString()} sqft</span>
                  <span className="ml-auto">{activeHome.daysOnMarket} days on market</span>
                </div>

                {/* Priority match breakdown */}
                <div>
                  <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-5">
                    Priority match
                  </h2>
                  <div className="space-y-3">
                    {activeHome.priorities.map((p) => (
                      <div key={p.label} className="flex items-center gap-4">
                        <span className="text-sm text-foreground w-32 flex-shrink-0">{p.label}</span>
                        <div className="flex-1 h-1.5 bg-muted overflow-hidden">
                          <div
                            className="h-full bg-foreground"
                            style={{ width: `${p.score}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-1.5 w-16 justify-end">
                          {p.trend === "up" ? (
                            <TrendingUp className="h-3 w-3 text-green-600" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-amber-600" />
                          )}
                          <span className="text-sm font-medium text-foreground">{p.score}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Next step */}
                <div>
                  <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-5">
                    Next step
                  </h2>
                  {activeHome.status === "viewing_scheduled" ? (
                    <div className="flex items-center justify-between p-4 border border-green-200 bg-green-50">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-green-700" />
                        <div>
                          <p className="text-sm font-medium text-green-900">Viewing confirmed</p>
                          <p className="text-xs text-green-700 mt-0.5">{activeHome.viewingDate}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="rounded-none text-xs border-green-300 text-green-800 hover:bg-green-100">
                          Reschedule
                        </Button>
                        <Button variant="outline" size="sm" className="rounded-none text-xs border-green-300 text-green-800 hover:bg-green-100">
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <Button size="sm" className="rounded-none font-normal">
                        <Calendar className="mr-2 h-3 w-3" />
                        Schedule viewing
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-none font-normal">
                        Start offer
                        <ChevronRight className="ml-2 h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* View full analysis link */}
                <Link
                  href={`/home/${activeHome.id}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                >
                  Full property analysis
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>

              {/* Right sidebar: Family Notes */}
              <div className="w-80 flex-shrink-0 flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-border flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-medium text-foreground">Family notes</h2>
                </div>

                {/* Notes feed */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {activeNotes.length === 0 && (
                    <p className="text-sm text-muted-foreground">No notes yet. Add one below.</p>
                  )}
                  {activeNotes.map((note, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground">{note.author}</span>
                        <span className="text-xs text-muted-foreground">{note.time}</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{note.text}</p>
                    </div>
                  ))}
                </div>

                {/* Note input */}
                <div className="p-4 border-t border-border">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={noteInputs[activeId] ?? ""}
                      onChange={(e) =>
                        setNoteInputs((prev) => ({ ...prev, [activeId]: e.target.value }))
                      }
                      onKeyDown={(e) => e.key === "Enter" && sendNote(activeId)}
                      placeholder="Add a note..."
                      className="flex-1 h-9 px-3 border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-none h-9 w-9 flex-shrink-0"
                      onClick={() => sendNote(activeId)}
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
