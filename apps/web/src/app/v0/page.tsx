import type { Metadata } from "next"
import Link from "next/link"
import { Firehose } from "@/components/home/firehose"
import { SiteHeader } from "@/components/site-header"

// /v0 keeps the prior homepage as a backup we can swap back to. Not for
// public traffic — noindex so it doesn't compete with / in search.
export const metadata: Metadata = {
  title: "Festivus v0 — backup homepage",
  description: "Prior homepage layout, kept as a fallback.",
  alternates: { canonical: "/v0" },
  robots: { index: false, follow: false },
}

export default function HomePageV0() {
  return (
    <main>
      <SiteHeader />
      {/* ── Section 1: Hero — Blueprint Sheet ──────────────────────── */}
      <section className="relative min-h-[70vh] bg-drafting-cream bg-[linear-gradient(rgba(11,28,54,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(11,28,54,0.03)_1px,transparent_1px)] bg-[size:40px_40px]">
        {/* Registration marks */}
        <div className="pointer-events-none absolute inset-0">
          {/* Top-left */}
          <div className="absolute left-4 top-4 h-5 w-5 border-l-2 border-t-2 border-blueprint-navy/20 md:left-8 md:top-8 md:h-8 md:w-8" />
          {/* Top-right */}
          <div className="absolute right-4 top-4 h-5 w-5 border-r-2 border-t-2 border-blueprint-navy/20 md:right-8 md:top-8 md:h-8 md:w-8" />
          {/* Bottom-left */}
          <div className="absolute bottom-4 left-4 h-5 w-5 border-b-2 border-l-2 border-blueprint-navy/20 md:bottom-8 md:left-8 md:h-8 md:w-8" />
          {/* Bottom-right */}
          <div className="absolute bottom-4 right-4 h-5 w-5 border-b-2 border-r-2 border-blueprint-navy/20 md:bottom-8 md:right-8 md:h-8 md:w-8" />
        </div>

        {/* Centered content */}
        <div className="relative flex min-h-[70vh] flex-col items-center justify-center px-6 py-16 sm:px-10 md:py-20">
          {/* Main headline: three lines, OPEN SOURCE promoted */}
          <h1 className="text-blueprint-navy text-center font-mono font-bold uppercase leading-[1.05] tracking-tight">
            <span className="text-blueprint-navy/55 block text-3xl sm:text-4xl md:text-5xl">
              Open Source
            </span>
            <span className="mt-2 block text-5xl sm:text-6xl md:text-7xl">
              Physical AI
            </span>
            <span className="text-blueprint-navy/70 mt-2 block text-4xl font-medium italic sm:text-5xl md:text-6xl">
              &ldquo;for the Rest of Us&rdquo;
            </span>
          </h1>

          <p className="text-blueprint-navy/60 mx-auto mt-8 max-w-lg text-center text-base leading-relaxed md:text-lg">
            The open platform for building, researching,
            and shipping in Physical AI.
          </p>

          {/* CTAs — side by side on desktop, stacked on mobile.
              Workbench CTA hidden until the formal launch. */}
          <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <Link
              className="bg-safety-yellow text-blueprint-navy rounded-lg px-6 py-3 text-center text-sm font-bold uppercase tracking-wider"
              href="/data"
            >
              Browse the Data →
            </Link>
            <Link
              className="text-blueprint-navy rounded-lg border-2 border-blueprint-navy px-6 py-3 text-center text-sm font-bold uppercase tracking-wider"
              href="/contribute"
            >
              Contribute →
            </Link>
          </div>

        </div>
      </section>

      {/* ── Section 2: Three Pillar Preview Cards ──────────────────── */}
      <section className="bg-drafting-cream px-6 py-16 sm:px-10">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2 lg:grid-cols-4">

          {/* Card 01: Open Source-First */}
          <div className="bg-blueprint-navy blueprint-grid rounded-lg p-8 transition-transform hover:-translate-y-0.5">
            <p className="text-safety-yellow mb-4 font-mono text-2xl font-bold">01</p>
            <h3 className="text-drafting-cream mb-6 font-mono text-lg font-bold uppercase tracking-wider">
              Open Source-First
            </h3>

            <p className="text-safety-yellow mb-6 text-sm font-bold leading-relaxed">
              Physical AI is non-zero-sum.
            </p>

            <p className="text-drafting-cream/80 mb-6 text-sm leading-relaxed">
              You can clone this, fork it, use it, remix it. Likewise we contribute, never
              extract: papers stay in arXiv, code on GitHub, models on Hugging Face, etc.
              It&apos;s important that credit and provenance stay clear.
            </p>

            <Link
              className="text-safety-yellow text-sm font-bold uppercase tracking-wider"
              href="/open-source"
            >
              Read more →
            </Link>
          </div>

          {/* Card 02: Robotics-First */}
          <div className="bg-blueprint-navy blueprint-grid rounded-lg p-8 transition-transform hover:-translate-y-0.5">
            <p className="text-safety-yellow mb-4 font-mono text-2xl font-bold">02</p>
            <h3 className="text-drafting-cream mb-6 font-mono text-lg font-bold uppercase tracking-wider">
              Robotics-First
            </h3>

            <p className="text-safety-yellow mb-6 text-sm font-bold leading-relaxed">
              Built from the ground up to focus on robotics.
            </p>

            <p className="text-drafting-cream/80 mb-6 text-sm leading-relaxed">
              The GitHub for robotics is GitHub. The HuggingFace for robotics is HuggingFace.
              But robotics has its own nuances: hardware choices matter more, visuals matter,
              deployment has edge cases, environments matter.
            </p>

            <Link
              className="text-safety-yellow text-sm font-bold uppercase tracking-wider"
              href="/robotics-first"
            >
              Read more →
            </Link>
          </div>

          {/* Card 03: Agent-First */}
          <div className="bg-blueprint-navy blueprint-grid rounded-lg p-8 transition-transform hover:-translate-y-0.5">
            <p className="text-safety-yellow mb-4 font-mono text-2xl font-bold">03</p>
            <h3 className="text-drafting-cream mb-6 font-mono text-lg font-bold uppercase tracking-wider">
              Agent-First
            </h3>

            <p className="text-safety-yellow mb-6 text-sm font-bold leading-relaxed">
              Physical AI advancements are a firehose.
            </p>

            <p className="text-drafting-cream/80 mb-6 text-sm leading-relaxed">
              Agents harness it: they see gaps, contribute, fix, evolve, adapt. They{" "}
              <span className="text-drafting-cream font-bold">let humans play and be creative</span>
              {" "}no matter your skill or expertise.
            </p>

            <Link
              className="text-safety-yellow text-sm font-bold uppercase tracking-wider"
              href="/agent-native"
            >
              Read more →
            </Link>
          </div>

          {/* Card 04: Fun */}
          <div className="bg-blueprint-navy blueprint-grid rounded-lg p-8 transition-transform hover:-translate-y-0.5">
            <p className="text-safety-yellow mb-4 font-mono text-2xl font-bold">04</p>
            <h3 className="text-drafting-cream mb-6 font-mono text-lg font-bold uppercase tracking-wider">
              Fun
            </h3>

            <p className="text-safety-yellow mb-6 text-sm font-bold leading-relaxed">
              Fun is underrated.
            </p>

            <p className="text-drafting-cream/80 mb-6 text-sm leading-relaxed">
              It should be fun to play with robots. Should be fun to contribute.
              Should even be fun when you find a gap in data or a hole — fun to fix
              it, plug it. The agents are meant to make the experience of Physical AI{" "}
              <span className="text-drafting-cream font-bold">fun</span>.
            </p>

            {/* "Try it →" link to /workbench hidden until the formal launch. */}
          </div>

        </div>

        {/* CTA — browse the open-source data beneath the pillars */}
        <div className="mx-auto mt-12 flex max-w-7xl justify-center">
          <Link
            className="bg-safety-yellow text-blueprint-navy rounded-lg px-8 py-4 text-center text-sm font-bold uppercase tracking-wider"
            href="/data"
          >
            Explore the Open Source Data →
          </Link>
        </div>
      </section>

      {/* ── Section 3: Firehose (includes the agent prompt + CTA) ──── */}
      <Firehose />

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="bg-blueprint-navy px-6 py-8 sm:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <p className="text-drafting-cream/40 text-xs font-bold uppercase tracking-wider">
            Festivus
          </p>
          <p className="text-drafting-cream/30 text-xs">
            Open Source Physical AI for the Rest of Us by{" "}
            <a
              className="text-drafting-cream/50 underline decoration-dotted transition-colors hover:text-drafting-cream"
              href="https://hapticlabs.ai"
              rel="noopener noreferrer"
              target="_blank"
            >
              Haptic
            </a>
          </p>
        </div>
      </footer>
    </main>
  )
}
