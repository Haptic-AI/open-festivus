import type { Metadata } from "next"
import Link from "next/link"
import { SiteHeader } from "@/components/site-header"

export const metadata: Metadata = {
  title: "Gaps · queue | Festivus",
  description:
    "Ranked list of coverage holes across Physical AI — robots and policies that haven't been benchmarked together.",
}

export default function GapsPage() {
  return (
    <main className="bg-drafting-cream min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-5xl px-6 py-10 sm:px-10">
        <nav className="text-blueprint-navy/50 mb-4 flex items-center gap-2 font-mono text-[13px] uppercase tracking-wider">
          <Link className="hover:text-blueprint-navy" href="/data">
            Data
          </Link>
          <span>/</span>
          <span className="text-blueprint-navy/80">Gaps</span>
        </nav>

        <header className="border-blueprint-navy/10 mb-8 border-b pb-6">
          <h1 className="text-blueprint-navy text-2xl font-bold uppercase tracking-tight md:text-4xl">
            Ready-to-fill gaps
          </h1>
          <p className="text-blueprint-navy/70 mt-2 max-w-3xl text-sm md:text-base">
            Every row is a (robot × policy) pair that nobody has marked compatible yet. Ranked by robot community size times policy benchmark count.
          </p>
        </header>

        <section className="border-blueprint-navy/10 rounded-lg border bg-white p-10 text-center">
          <p className="text-blueprint-navy text-lg font-bold">No gaps to rank yet.</p>
          <p className="text-blueprint-navy/70 mt-3 text-sm leading-relaxed">
            Gap ranking is powered by the dataset&rsquo;s <span className="font-mono">compatibility_edges</span> table. That table is currently empty in production, so there&rsquo;s nothing to subtract from. When edges are seeded, this page will populate.
          </p>
          <p className="text-blueprint-navy/50 mt-6 font-mono text-[14px]">
            <Link className="hover:text-blueprint-navy underline" href="/data">
              ← back to Open Data
            </Link>
          </p>
        </section>
      </div>
    </main>
  )
}
