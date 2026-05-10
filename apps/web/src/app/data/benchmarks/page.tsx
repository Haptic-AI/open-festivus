import type { Metadata } from "next"
import Link from "next/link"
import type { IBenchmarkRecord } from "@festivus/types"
import { SiteHeader } from "@/components/site-header"

export const metadata: Metadata = {
  title: "Benchmarks | Festivus",
  description:
    "Every benchmark in the Festivus dataset — sim environments, scenes, and results policies have been evaluated on.",
}

const API_BASE = (process.env["FESTIVUS_DATASET_API_URL"] ?? "https://api.festivus.hapticlabs.ai").replace(/\/$/, "")

const ENV_COLOR: Record<string, string> = {
  sim: "bg-blueprint-navy/10 text-blueprint-navy",
  real: "bg-safety-yellow/20 text-blueprint-navy",
}

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "bg-blueprint-navy/10 text-blueprint-navy",
  medium: "bg-safety-yellow/20 text-blueprint-navy",
  hard: "bg-annotation-red/10 text-annotation-red",
  unsolved: "bg-annotation-red/15 text-annotation-red",
}

async function fetchBenchmarks(limit = 500): Promise<IBenchmarkRecord[]> {
  try {
    const res = await fetch(`${API_BASE}/v1/benchmarks?limit=${limit}`, {
      next: { revalidate: 60 },
      headers: { accept: "application/json" },
    })
    if (!res.ok) return []
    const body = (await res.json()) as { count?: number; results?: IBenchmarkRecord[] }
    return body.results ?? []
  } catch {
    return []
  }
}

async function fetchBenchmarkCount(): Promise<number> {
  try {
    const res = await fetch(`${API_BASE}/v1/benchmarks?limit=1`, {
      next: { revalidate: 60 },
      headers: { accept: "application/json" },
    })
    if (!res.ok) return 0
    const body = (await res.json()) as { count?: number }
    return body.count ?? 0
  } catch {
    return 0
  }
}

export default async function BenchmarksIndexPage() {
  const [benchmarks, total] = await Promise.all([fetchBenchmarks(500), fetchBenchmarkCount()])

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

        <header className="mb-10">
          <h1 className="text-blueprint-navy text-3xl font-bold uppercase tracking-tight md:text-5xl">
            Benchmarks
          </h1>
          <p className="text-blueprint-navy/70 mt-3 max-w-3xl text-base leading-relaxed md:text-lg">
            {total.toLocaleString()} records. Sim environments, scenes, and benchmark results. Run real experiments and submit the numbers.
          </p>
          {benchmarks.length < total ? (
            <p className="text-blueprint-navy/50 mt-2 font-mono text-[14px]">
              Showing first {benchmarks.length.toLocaleString()}.
            </p>
          ) : null}
        </header>

        {benchmarks.length === 0 ? (
          <div className="border-blueprint-navy/10 rounded-lg border bg-white p-10 text-center">
            <p className="text-blueprint-navy/70">No benchmarks in the dataset yet.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {benchmarks.map((bm) => (
              <li key={bm.slug}>
                <Link
                  className="border-blueprint-navy/10 hover:border-blueprint-navy/40 block rounded-lg border bg-white p-5 transition-colors"
                  href={`/data/benchmarks/${bm.slug}`}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded px-2 py-0.5 font-mono text-[13px] font-bold uppercase tracking-wider ${ENV_COLOR[bm.environment] ?? "bg-blueprint-navy/10 text-blueprint-navy"}`}>
                      {bm.environment}
                    </span>
                    <span className={`rounded px-2 py-0.5 font-mono text-[13px] font-bold uppercase tracking-wider ${DIFFICULTY_COLOR[bm.difficulty] ?? "bg-blueprint-navy/10 text-blueprint-navy"}`}>
                      {bm.difficulty}
                    </span>
                    <span className="text-blueprint-navy/60 font-mono text-[13px] font-bold uppercase tracking-wider">
                      {bm.task_scope}
                    </span>
                  </div>
                  <p className="text-blueprint-navy text-sm font-bold leading-snug">{bm.name}</p>
                  <p className="text-blueprint-navy/70 mt-2 line-clamp-2 text-xs leading-relaxed">{bm.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
