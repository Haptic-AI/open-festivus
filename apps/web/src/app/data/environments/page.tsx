import type { Metadata } from "next"
import Link from "next/link"
import type { IEnvironment, ISimEnvironment } from "@festivus/types"
import { SiteHeader } from "@/components/site-header"
import { KindIndexClient } from "@/components/data-kind/kind-index-client"
import { FestivusClient } from "@/lib/api/festivus-client"

export const metadata: Metadata = {
  title: "Environments | Festivus",
  description:
    "Every simulation environment in the Festivus dataset — scenes, tasks, and simulator targets policies are evaluated on. Search, flag, and fill gaps.",
}

const KNOWN_SIMULATORS: ReadonlySet<ISimEnvironment["simulator"]> = new Set([
  "mujoco",
  "isaac-sim",
  "pybullet",
  "isaac-gym",
  "habitat",
  "genesis",
  "other",
])

function toSimEnvironment(e: IEnvironment): ISimEnvironment {
  const sim: ISimEnvironment["simulator"] = KNOWN_SIMULATORS.has(
    e.simulator as ISimEnvironment["simulator"],
  )
    ? (e.simulator as ISimEnvironment["simulator"])
    : "other"
  return {
    id: e.id,
    name: e.name,
    simulator: sim,
    scene: e.scene,
    description: e.description,
  }
}

export default async function EnvironmentsIndexPage() {
  const client = new FestivusClient()
  const raw = await client.searchEnvironments({ limit: 500 })
  const environments: ISimEnvironment[] = (raw ?? []).map(toSimEnvironment)

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
              Environments
            </h1>
            <p className="text-blueprint-navy/70 mt-3 max-w-3xl text-base leading-relaxed md:text-lg">
              {environments.length} records. Simulation scenes policies benchmark against: MuJoCo, Isaac, PyBullet, Habitat.
            </p>
          </div>
          <Link
            className="bg-safety-yellow text-blueprint-navy shrink-0 rounded px-4 py-2 text-xs font-bold uppercase tracking-wider"
            href="/data/gaps"
          >
            Pick a gap →
          </Link>
        </header>

        {environments.length === 0 ? (
          <div className="border-blueprint-navy/10 rounded-lg border bg-white p-10 text-center">
            <p className="text-blueprint-navy/70">No environments in the dataset yet. The schema is ready; rows have not been seeded.</p>
          </div>
        ) : (
          <KindIndexClient kind="environment" records={environments} />
        )}
      </div>
    </main>
  )
}
