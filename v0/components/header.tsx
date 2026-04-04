"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-6">
        <nav className="flex items-center justify-between h-20">
          <Link href="/" className="font-serif text-xl tracking-tight text-foreground">
            Nhalo
          </Link>

          <div className="flex items-center gap-8">
            <Link 
              href="#product" 
              className="hidden sm:block text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Product
            </Link>
            <Button size="sm" className="rounded-none px-6 h-9 text-sm font-normal" asChild>
              <Link href="/get-started">Get Started</Link>
            </Button>
          </div>
        </nav>
      </div>
    </header>
  )
}
