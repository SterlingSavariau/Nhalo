import Link from "next/link"

export function Footer() {
  return (
    <footer className="py-12 border-t border-border">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <Link href="/" className="font-serif text-lg text-foreground">
            Nhalo
          </Link>
          <div className="flex items-center gap-8 text-sm text-muted-foreground">
            <Link href="#" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="#" className="hover:text-foreground transition-colors">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
