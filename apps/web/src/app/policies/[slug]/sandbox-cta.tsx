"use client"

import Link from "next/link"
import { useRobotSelection } from "./robot-selection"

interface ISandboxCtaProps {
  slug: string
}

export function SandboxCta({ slug }: ISandboxCtaProps) {
  const { selectedSlugs } = useRobotSelection()
  const robotParam = [...selectedSlugs][0]
  const href = robotParam !== undefined
    ? `/policies/${slug}/evaluate?robot=${robotParam}`
    : `/policies/${slug}/evaluate`

  return (
    <section className="mb-6">
      <Link
        className="bg-blueprint-navy text-drafting-cream hover:bg-blueprint-navy/90 group flex items-center justify-between rounded p-6 transition-all duration-200"
        href={href}
      >
        <div>
          <h2 className="text-xl font-bold uppercase tracking-tight md:text-2xl">
            Sandbox
          </h2>
          <p className="text-drafting-cream/70 mt-1 text-sm">
            Run this policy on a simulated robot and environment, already deployed for you
          </p>
        </div>
        <span className="text-safety-yellow text-2xl transition-transform group-hover:translate-x-1">→</span>
      </Link>
    </section>
  )
}
