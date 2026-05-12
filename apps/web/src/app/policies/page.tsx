import type { Metadata } from "next"
import { ALL_POLICIES } from "@/data/seed"
import { SiteHeader } from "@/components/site-header"
import { PolicySearch } from "./policy-search"

export const metadata: Metadata = {
  title: "Find Policies | Festivus",
  description:
    "Search and browse robotics policies by task and hardware. Find trained models that work on your robot.",
}

export default function PoliciesPage() {
  return (
    <main className="bg-drafting-cream min-h-screen">
      <SiteHeader />

      {/* Page content */}
      <div className="mx-auto max-w-5xl px-6 py-12 sm:px-10">
        <div className="mb-10">
          <h1 className="text-blueprint-navy mb-2 text-2xl font-bold uppercase tracking-tight md:text-4xl">
            I want to train a robot
          </h1>
          <p className="text-blueprint-navy/70 text-sm">
            Find policies, datasets, and simulation environments that work with your hardware
          </p>
        </div>

        <PolicySearch policies={ALL_POLICIES} />
      </div>
    </main>
  )
}
