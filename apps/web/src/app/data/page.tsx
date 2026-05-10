import type { Metadata } from "next"
import { SiteHeader } from "@/components/site-header"
import { DataOverviewSections } from "./data-overview-sections"

export const metadata: Metadata = {
  title: "Data | Festivus",
  description:
    "A coverage map of open Physical AI — robots, policies, datasets, and environments, and the gaps between them.",
}

export default function DataPage() {
  const apiBase = (
    process.env["FESTIVUS_DATASET_API_URL"] ?? "https://api.festivus.hapticlabs.ai"
  ).replace(/\/$/, "")

  return (
    <main className="bg-drafting-cream min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-6xl px-6 py-12 sm:px-10">
        <PageIntro />

        <SectionDivider />

        <DataOverviewSections apiBase={apiBase} />
      </div>
    </main>
  )
}

function PageIntro() {
  return (
    <header className="mb-14">
      <h1 className="text-blueprint-navy text-3xl font-bold uppercase tracking-tight md:text-5xl">
        Open Data
      </h1>
      <p className="text-blueprint-navy/70 mt-4 max-w-3xl text-base leading-relaxed md:text-lg">
        Every robot, policy, dataset, and environment in Festivus. Click any record to open its profile and flag anything wrong. Empty combinations are gaps you can fill.
      </p>
    </header>
  )
}

function SectionDivider() {
  return <hr className="border-blueprint-navy/10 my-16 border-t" />
}
