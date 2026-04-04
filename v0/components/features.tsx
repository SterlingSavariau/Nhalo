export function Features() {
  return (
    <section id="product" className="py-24 lg:py-32 border-t border-border">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid lg:grid-cols-3 gap-16 lg:gap-12">
          <Feature 
            title="Ranked by your priorities"
            description="Set what matters—schools, price, safety, commute—and see every home scored and ranked automatically."
          />
          <Feature 
            title="One shortlist for everyone"
            description="Add notes, share opinions, keep the whole family on the same page without endless group texts."
          />
          <Feature 
            title="Offer-ready when you are"
            description="Track pre-approval, inspections, and paperwork. Know exactly what's left before you can make an offer."
          />
        </div>
      </div>
    </section>
  )
}

function Feature({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="font-serif text-xl text-foreground">{title}</h3>
      <p className="mt-3 text-muted-foreground leading-relaxed">{description}</p>
    </div>
  )
}
