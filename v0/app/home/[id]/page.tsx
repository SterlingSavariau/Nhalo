"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Heart,
  Star,
  MapPin,
  Bed,
  Bath,
  Square,
  Calendar,
  Car,
  TreePine,
  GraduationCap,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Check,
  Plus,
  Send,
  ChevronRight,
} from "lucide-react"

const HOME_DATA = {
  id: 1,
  address: "2847 Willow Creek Dr",
  city: "Austin, TX 78749",
  price: 625000,
  beds: 4,
  baths: 3,
  sqft: 2450,
  lotSize: "0.28 acres",
  yearBuilt: 2018,
  garage: 2,
  score: 94,
  scoreLabel: "Excellent match",
  daysOnMarket: 12,
  pricePerSqft: 255,
  images: [
    "/placeholder.svg?height=500&width=800",
    "/placeholder.svg?height=500&width=800",
    "/placeholder.svg?height=500&width=800",
    "/placeholder.svg?height=500&width=800",
  ],
}

const PRIORITY_BREAKDOWN = [
  {
    priority: "School quality",
    weight: "Very important",
    score: 98,
    insight: "Zoned for Eanes ISD. Elementary rated 10/10, Middle 9/10, High 9/10.",
    trend: "up",
  },
  {
    priority: "Commute time",
    weight: "Important",
    score: 92,
    insight: "12 min to Downtown Austin via MoPac. 18 min during peak traffic.",
    trend: "up",
  },
  {
    priority: "Neighborhood safety",
    weight: "Very important",
    score: 95,
    insight: "Crime rate 68% below city average. Active HOA neighborhood watch.",
    trend: "up",
  },
  {
    priority: "Outdoor space",
    weight: "Nice to have",
    score: 78,
    insight: "Backyard smaller than average for price range. Mature trees provide privacy.",
    trend: "down",
  },
  {
    priority: "Home condition",
    weight: "Important",
    score: 96,
    insight: "Built 2018. No major repairs needed. HVAC serviced 2024.",
    trend: "up",
  },
]

const AI_INSIGHTS = [
  {
    type: "positive",
    title: "Strong appreciation potential",
    detail: "This zip code appreciated 8.2% last year vs 5.1% city average.",
  },
  {
    type: "positive",
    title: "Priced well for the area",
    detail: "$255/sqft is 6% below comparable homes in this school district.",
  },
  {
    type: "neutral",
    title: "Moderate competition",
    detail: "2 other families viewing this week. Offers typically come within 14 days.",
  },
  {
    type: "caution",
    title: "HOA consideration",
    detail: "$180/month HOA. Covers landscaping, pool access, and neighborhood security.",
  },
]

const FAMILY_NOTES = [
  {
    author: "Sarah",
    time: "2 days ago",
    note: "Love the open kitchen layout. Perfect for hosting family dinners.",
  },
  {
    author: "Mike",
    time: "2 days ago",
    note: "Backyard feels small for the kids. Could we add onto the deck?",
  },
  {
    author: "Sarah",
    time: "1 day ago",
    note: "Checked with agent - yes, deck expansion is allowed per HOA.",
  },
]

const COMPARABLE_HOMES = [
  {
    address: "2901 Willow Creek Dr",
    price: 649000,
    sqft: 2380,
    sold: "2 weeks ago",
    pricePerSqft: 273,
  },
  {
    address: "2756 Willow Creek Dr",
    price: 612000,
    sqft: 2510,
    sold: "1 month ago",
    pricePerSqft: 244,
  },
  {
    address: "3012 Oak Hollow Ln",
    price: 635000,
    sqft: 2420,
    sold: "3 weeks ago",
    pricePerSqft: 262,
  },
]

export default function PropertyPage() {
  const params = useParams()
  const [shortlisted, setShortlisted] = useState(true)
  const [newNote, setNewNote] = useState("")
  const [activeImage, setActiveImage] = useState(0)

  const home = HOME_DATA

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
        <div className="mx-auto max-w-7xl px-6">
          <nav className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to homes
              </Link>
            </div>

            <Link
              href="/"
              className="font-serif text-xl tracking-tight text-foreground"
            >
              Nhalo
            </Link>

            <div className="flex items-center gap-3">
              <Button
                variant={shortlisted ? "default" : "outline"}
                size="sm"
                className="rounded-none"
                onClick={() => setShortlisted(!shortlisted)}
              >
                <Heart className={`h-4 w-4 mr-2 ${shortlisted ? "fill-current" : ""}`} />
                {shortlisted ? "In Prospects" : "Add to Prospects"}
              </Button>
            </div>
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="pt-14">
        <div className="mx-auto max-w-7xl">
          {/* Image Gallery */}
          <div className="grid grid-cols-4 gap-1 h-[400px]">
            <div className="col-span-2 row-span-2 bg-muted">
              <img
                src={home.images[0]}
                alt={home.address}
                className="w-full h-full object-cover"
              />
            </div>
            {home.images.slice(1).map((img, i) => (
              <div key={i} className="bg-muted">
                <img
                  src={img}
                  alt={`${home.address} ${i + 2}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>

          <div className="flex">
            {/* Left: Property Details */}
            <div className="flex-1 border-r border-border p-8 space-y-10">
              {/* Header */}
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="font-serif text-3xl text-foreground">
                      {home.address}
                    </h1>
                    <p className="text-muted-foreground mt-1 flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {home.city}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-serif text-3xl text-foreground">
                      ${home.price.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      ${home.pricePerSqft}/sqft
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6 mt-6 pt-6 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Bed className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{home.beds} beds</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Bath className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{home.baths} baths</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Square className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{home.sqft.toLocaleString()} sqft</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TreePine className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{home.lotSize}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{home.garage} car garage</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">Built {home.yearBuilt}</span>
                  </div>
                </div>
              </div>

              {/* AI Score Breakdown */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-sm font-medium uppercase tracking-wider text-foreground">
                    How this home matches your priorities
                  </h2>
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-foreground fill-foreground" />
                    <span className="text-2xl font-medium">{home.score}</span>
                    <span className="text-sm text-muted-foreground">/ 100</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {PRIORITY_BREAKDOWN.map((item) => (
                    <div key={item.priority} className="border border-border p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-foreground">{item.priority}</span>
                          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted">
                            {item.weight}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.trend === "up" && (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          )}
                          {item.trend === "down" && (
                            <TrendingDown className="h-4 w-4 text-amber-600" />
                          )}
                          {item.trend === "neutral" && (
                            <Minus className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-lg font-medium">{item.score}</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.insight}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Insights */}
              <div>
                <h2 className="text-sm font-medium uppercase tracking-wider text-foreground mb-6">
                  Nhalo&apos;s analysis
                </h2>

                <div className="grid grid-cols-2 gap-4">
                  {AI_INSIGHTS.map((insight, i) => (
                    <div
                      key={i}
                      className={`p-4 border ${
                        insight.type === "positive"
                          ? "border-green-200 bg-green-50"
                          : insight.type === "caution"
                          ? "border-amber-200 bg-amber-50"
                          : "border-border bg-muted/30"
                      }`}
                    >
                      <p className={`text-sm font-medium ${
                        insight.type === "positive"
                          ? "text-green-900"
                          : insight.type === "caution"
                          ? "text-amber-900"
                          : "text-foreground"
                      }`}>
                        {insight.title}
                      </p>
                      <p className={`text-sm mt-1 ${
                        insight.type === "positive"
                          ? "text-green-700"
                          : insight.type === "caution"
                          ? "text-amber-700"
                          : "text-muted-foreground"
                      }`}>
                        {insight.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Comparables */}
              <div>
                <h2 className="text-sm font-medium uppercase tracking-wider text-foreground mb-6">
                  Recent sales nearby
                </h2>

                <div className="border border-border divide-y divide-border">
                  {COMPARABLE_HOMES.map((comp, i) => (
                    <div key={i} className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-foreground">{comp.address}</p>
                        <p className="text-sm text-muted-foreground">
                          {comp.sqft.toLocaleString()} sqft &middot; Sold {comp.sold}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-foreground">
                          ${comp.price.toLocaleString()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          ${comp.pricePerSqft}/sqft
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Sidebar */}
            <div className="w-96 flex-shrink-0 p-8 space-y-8">
              {/* Quick Actions */}
              <div className="space-y-3">
                <Button className="w-full rounded-none h-12 text-base font-normal">
                  Schedule a viewing
                </Button>
                <Button variant="outline" className="w-full rounded-none h-12 text-base font-normal">
                  Start an offer
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>

              {/* Market Context */}
              <div className="border border-border p-4">
                <h3 className="text-sm font-medium text-foreground mb-3">Market context</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Days on market</span>
                    <span className="text-foreground">{home.daysOnMarket} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Area average</span>
                    <span className="text-foreground">21 days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Price changes</span>
                    <span className="text-foreground">None</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Saves on Nhalo</span>
                    <span className="text-foreground">8 families</span>
                  </div>
                </div>
              </div>

              {/* Family Notes */}
              <div>
                <h3 className="text-sm font-medium uppercase tracking-wider text-foreground mb-4">
                  Family notes
                </h3>

                <div className="space-y-3 mb-4">
                  {FAMILY_NOTES.map((note, i) => (
                    <div key={i} className="p-3 border border-border bg-card">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground">{note.author}</span>
                        <span className="text-xs text-muted-foreground">{note.time}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{note.note}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note for your family..."
                    className="flex-1 h-10 px-3 border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                  />
                  <Button variant="outline" size="icon" className="rounded-none h-10 w-10">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Agent Info */}
              <div className="border border-border p-4">
                <h3 className="text-sm font-medium text-foreground mb-3">Listing agent</h3>
                <p className="text-foreground">Jennifer Martinez</p>
                <p className="text-sm text-muted-foreground">Compass Real Estate</p>
                <Button variant="link" className="p-0 h-auto text-sm mt-2">
                  Contact agent
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
