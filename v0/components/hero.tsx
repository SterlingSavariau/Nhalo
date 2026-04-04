import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export function Hero() {
  return (
    <section className="pt-32 pb-24 lg:pt-40 lg:pb-32">
      <div className="mx-auto max-w-6xl px-6">
        {/* Headline */}
        <div className="max-w-3xl">
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-foreground leading-[1.1]">
            Your AI agent for buying a home
          </h1>
          
          <p className="mt-8 text-lg text-muted-foreground leading-relaxed max-w-xl">
            Nhalo ranks homes by what matters to you, keeps your family aligned, and gets you offer-ready.
          </p>
          
          <div className="mt-10">
            <Button size="lg" className="rounded-none px-8 h-12 text-base font-normal" asChild>
              <Link href="/get-started">
                Try the AI Agent
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Product Preview */}
        <div className="mt-20 lg:mt-24">
          <div className="bg-card border border-border rounded-sm overflow-hidden shadow-sm">
            {/* Top bar */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm text-foreground">Family Homes in Austin</span>
                <span className="text-xs text-muted-foreground">12 ranked</span>
              </div>
              <div className="flex items-center gap-6 text-xs text-muted-foreground">
                <span>Shortlist (3)</span>
                <span>Offer Ready</span>
              </div>
            </div>

            {/* Content */}
            <div className="grid lg:grid-cols-[1fr,320px]">
              {/* Rankings */}
              <div className="p-6 space-y-4">
                <HomeRow 
                  rank={1}
                  address="4521 Oak Valley Dr"
                  details="4 bed · 3 bath · 2,850 sqft"
                  price="$685,000"
                  reason="Best match: price/sqft, 9/10 schools, low crime"
                  shortlisted
                />
                <HomeRow 
                  rank={2}
                  address="892 Maple Creek Ln"
                  details="3 bed · 2.5 bath · 2,200 sqft"
                  price="$545,000"
                  reason="Strong value, shorter commute, newer build"
                />
                <HomeRow 
                  rank={3}
                  address="1203 Willow Bend Ct"
                  details="4 bed · 3.5 bath · 3,100 sqft"
                  price="$725,000"
                  reason="Largest lot, pool, premium finishes"
                />
              </div>

              {/* Sidebar */}
              <div className="border-l border-border bg-secondary/30 p-6 hidden lg:block">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Why #1</p>
                <p className="text-sm text-foreground leading-relaxed">
                  Based on your priorities: school quality (40%), price per sqft (30%), safety (20%), commute (10%).
                </p>
                <p className="mt-4 text-sm text-foreground leading-relaxed">
                  This home scores highest overall. It&apos;s $40k under budget with a 9/10 school rating.
                </p>
                <div className="mt-6 pt-6 border-t border-border">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Family Notes</p>
                  <p className="text-sm text-muted-foreground italic">&quot;Kids loved the backyard. Close to mom.&quot;</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function HomeRow({ 
  rank, 
  address, 
  details, 
  price, 
  reason,
  shortlisted 
}: { 
  rank: number
  address: string
  details: string
  price: string
  reason: string
  shortlisted?: boolean
}) {
  return (
    <div className={`flex items-start gap-4 p-4 rounded-sm transition-colors ${shortlisted ? 'bg-secondary/50' : 'hover:bg-secondary/30'}`}>
      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-foreground text-primary-foreground text-xs font-medium">
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <span className="font-medium text-foreground">{address}</span>
          {shortlisted && (
            <span className="text-xs text-muted-foreground">Shortlisted</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">{details}</p>
        <p className="text-xs text-muted-foreground mt-2">{reason}</p>
      </div>
      <span className="text-sm font-medium text-foreground">{price}</span>
    </div>
  )
}
