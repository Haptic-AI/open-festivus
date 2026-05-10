import type { Metadata } from "next"
import Link from "next/link"
import type { IPaper } from "@festivus/types"
import { SiteHeader } from "@/components/site-header"

export const metadata: Metadata = {
  title: "Papers | Festivus",
  description: "Every paper in the Festivus dataset — arXiv references linked to robots, policies, and tasks.",
}

const API_BASE = (process.env["FESTIVUS_DATASET_API_URL"] ?? "https://api.festivus.hapticlabs.ai").replace(/\/$/, "")

async function fetchPapers(): Promise<IPaper[]> {
  try {
    const res = await fetch(`${API_BASE}/v1/papers?limit=500`, {
      next: { revalidate: 60 },
      headers: { accept: "application/json" },
    })
    if (!res.ok) return []
    const body = (await res.json()) as { results?: IPaper[] }
    return body.results ?? []
  } catch {
    return []
  }
}

export default async function PapersIndexPage() {
  const papers = await fetchPapers()

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
            Papers
          </h1>
          <p className="text-blueprint-navy/70 mt-3 max-w-3xl text-base leading-relaxed md:text-lg">
            {papers.length} records. arXiv references with robot, policy, and task tags.
          </p>
        </header>

        {papers.length === 0 ? (
          <div className="border-blueprint-navy/10 rounded-lg border bg-white p-10 text-center">
            <p className="text-blueprint-navy/70">No papers in the dataset yet. The schema is ready; rows have not been seeded.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {papers.map((paper) => (
              <li key={paper.id}>
                <Link
                  className="border-blueprint-navy/10 hover:border-blueprint-navy/40 block rounded-lg border bg-white p-5 transition-colors"
                  href={`/data/papers/${paper.id}`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-blueprint-navy/60 font-mono text-[13px] font-bold uppercase tracking-wider">
                      {paper.venue} · {paper.date}
                    </span>
                    {paper.citations > 0 ? (
                      <span className="text-blueprint-navy/60 font-mono text-[13px] font-bold uppercase tracking-wider">
                        · {paper.citations} citations
                      </span>
                    ) : null}
                  </div>
                  <p className="text-blueprint-navy text-sm font-bold leading-snug">{paper.title}</p>
                  <p className="text-blueprint-navy/60 mt-1 text-xs">{paper.authors.slice(0, 3).join(", ")}{paper.authors.length > 3 ? ` · +${paper.authors.length - 3}` : ""}</p>
                  <p className="text-blueprint-navy/70 mt-2 line-clamp-2 text-xs leading-relaxed">{paper.abstract}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
