import type { Metadata } from "next"
import Link from "next/link"
import type { IRichRobot, IRobot } from "@festivus/types"
import { SiteHeader } from "@/components/site-header"
import { KindIndexClient } from "@/components/data-kind/kind-index-client"
import { FestivusClient } from "@/lib/api/festivus-client"

export const metadata: Metadata = {
  title: "Robots | Festivus",
  description:
    "Every robot in the Festivus dataset — hardware records, URDFs, configs, and BOMs. Search, flag, and fill gaps.",
}

export const revalidate = 60

function toRichRobot(r: IRobot): IRichRobot {
  const hwType: IRichRobot["hardware"]["type"] = (() => {
    switch (r.type) {
      case "arm":
      case "dual-arm":
      case "quadruped":
        return r.type
      case "humanoid":
        return "biped"
      case "drone":
      case "rover":
        return "mobile"
      default:
        return "other"
    }
  })()
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    manufacturer: r.manufacturer,
    description: r.description,
    hardware: r.hardware ?? {
      id: `${r.slug}-hw`,
      name: r.name,
      manufacturer: r.manufacturer,
      type: hwType,
      degreesOfFreedom: r.dof ?? 0,
      sensors: [],
      actuators: [],
      description: r.description,
    },
    compatiblePolicySlugs: r.compatible_policy_slugs,
    imageUrl: r.image_url ?? undefined,
    createdAt: new Date(0).toISOString(),
  }
}

export default async function RobotsIndexPage() {
  const client = new FestivusClient()
  const raw = await client.searchRobots({ limit: 500 })
  const robots: IRichRobot[] = (raw ?? []).map(toRichRobot)

  return (
    <main className="bg-drafting-cream min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-6xl px-6 py-12 sm:px-10">
        <Link
          className="text-blueprint-navy/60 hover:text-blueprint-navy mb-6 inline-block font-mono text-xs font-bold uppercase tracking-wider"
          href="/data"
        >
          ← Back to Open Data
        </Link>

        <header className="mb-10 flex flex-wrap items-start justify-between gap-6">
          <div>
            <h1 className="text-blueprint-navy text-3xl font-bold uppercase tracking-tight md:text-5xl">
              Robots
            </h1>
            <p className="text-blueprint-navy/70 mt-3 max-w-3xl text-base leading-relaxed md:text-lg">
              {robots.length} records. Hardware platforms with specs,
              compatibility, and BOMs. Flag missing or wrong fields; empty cells
              on the coverage map are gaps you or your agent can fill.
            </p>
          </div>
          <Link
            className="bg-safety-yellow text-blueprint-navy shrink-0 rounded px-4 py-2 text-xs font-bold uppercase tracking-wider"
            href="/data/gaps"
          >
            Pick a gap →
          </Link>
        </header>

        <KindIndexClient kind="robot" records={robots} />
      </div>
    </main>
  )
}
