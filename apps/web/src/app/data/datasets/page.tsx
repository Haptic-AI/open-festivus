import type { Metadata } from "next"
import Link from "next/link"
import type { IDataset, IRichDataset } from "@festivus/types"
import { SiteHeader } from "@/components/site-header"
import { KindIndexClient } from "@/components/data-kind/kind-index-client"
import { FestivusClient } from "@/lib/api/festivus-client"

export const metadata: Metadata = {
  title: "Datasets | Festivus",
  description:
    "Every dataset in the Festivus dataset — teleoperation and demonstration data linked to robots and policies.",
}

function toRichDataset(d: IDataset): IRichDataset {
  return {
    id: d.id,
    slug: d.slug,
    name: d.name,
    description: d.description,
    episodes: d.episodes ?? 0,
    robots: d.robots,
    robotNames: d.robot_names,
    source: d.source,
    hfDatasetId: d.hf_dataset_id ?? undefined,
  }
}

export default async function DatasetsIndexPage() {
  const client = new FestivusClient()
  const raw = await client.searchDatasets({ limit: 500 })
  const datasets: IRichDataset[] = (raw ?? []).map(toRichDataset)

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
              Datasets
            </h1>
            <p className="text-blueprint-navy/70 mt-3 max-w-3xl text-base leading-relaxed md:text-lg">
              {datasets.length} records. Teleoperation and demonstration datasets linked to robots and policies.
            </p>
          </div>
          <Link
            className="bg-safety-yellow text-blueprint-navy shrink-0 rounded px-4 py-2 text-xs font-bold uppercase tracking-wider"
            href="/data/gaps"
          >
            Pick a gap →
          </Link>
        </header>

        {datasets.length === 0 ? (
          <div className="border-blueprint-navy/10 rounded-lg border bg-white p-10 text-center">
            <p className="text-blueprint-navy/70">No datasets in the dataset yet.</p>
          </div>
        ) : (
          <KindIndexClient kind="dataset" records={datasets} />
        )}
      </div>
    </main>
  )
}
