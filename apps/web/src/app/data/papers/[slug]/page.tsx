import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import type { IPaper } from "@festivus/types"
import { AskAIButton } from "@/components/agent-chat/AskAIButton"
import { SiteHeader } from "@/components/site-header"

export const dynamicParams = true

const API_BASE = (process.env["FESTIVUS_DATASET_API_URL"] ?? "https://api.festivus.hapticlabs.ai").replace(/\/$/, "")

interface IPageProps {
  params: Promise<{ slug: string }>
}

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

async function findPaper(id: string): Promise<IPaper | null> {
  const papers = await fetchPapers()
  return papers.find((p) => p.id === id) ?? null
}

export async function generateMetadata({ params }: IPageProps): Promise<Metadata> {
  const { slug } = await params
  const paper = await findPaper(slug)
  if (paper === null) return { title: "Not found | Festivus" }
  return {
    title: `${paper.title} · paper | Festivus`,
    description: paper.abstract.slice(0, 160),
  }
}

export default async function PaperProfilePage({ params }: IPageProps) {
  const { slug } = await params
  const paper = await findPaper(slug)
  if (paper === null) notFound()

  return (
    <main className="bg-drafting-cream min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-4xl px-6 py-12 sm:px-10">
        <Link
          className="text-blueprint-navy/60 hover:text-blueprint-navy mb-6 inline-block font-mono text-xs font-bold uppercase tracking-wider"
          href="/data/papers"
        >
          ← Back to Papers
        </Link>

        <header className="mb-8">
          <div className="text-blueprint-navy/60 mb-3 font-mono text-[13px] font-bold uppercase tracking-wider">
            {paper.venue} · {paper.date}{paper.citations > 0 ? ` · ${paper.citations} citations` : ""}
          </div>
          <h1 className="text-blueprint-navy text-2xl font-bold leading-tight md:text-3xl">{paper.title}</h1>
          <p className="text-blueprint-navy/70 mt-2 text-sm">{paper.authors.join(", ")}</p>
        </header>

        <section className="border-blueprint-navy/10 mb-6 rounded-lg border bg-white p-6">
          <h2 className="text-blueprint-navy/80 mb-3 font-mono text-[14px] font-bold uppercase tracking-[0.2em]">Abstract</h2>
          <p className="text-blueprint-navy/80 text-sm leading-relaxed">{paper.abstract}</p>
        </section>

        {paper.arxiv_url !== null ? (
          <section className="border-blueprint-navy/10 mb-6 rounded-lg border bg-white p-6">
            <h2 className="text-blueprint-navy/80 mb-3 font-mono text-[14px] font-bold uppercase tracking-[0.2em]">Paper</h2>
            <a
              className="text-blueprint-navy hover:text-annotation-red text-sm underline decoration-dotted"
              href={paper.arxiv_url}
              rel="noopener noreferrer"
              target="_blank"
            >
              {paper.arxiv_url}
            </a>
          </section>
        ) : null}

        {paper.robot_tags.length > 0 || paper.policy_tags.length > 0 || paper.task_tags.length > 0 ? (
          <section className="border-blueprint-navy/10 rounded-lg border bg-white p-6">
            <h2 className="text-blueprint-navy/80 mb-3 font-mono text-[14px] font-bold uppercase tracking-[0.2em]">Tags</h2>
            <div className="space-y-3">
              {paper.robot_tags.length > 0 ? (
                <div>
                  <p className="text-blueprint-navy/60 mb-1 font-mono text-[13px] uppercase tracking-wider">Robots</p>
                  <ul className="flex flex-wrap gap-2">
                    {paper.robot_tags.map((t) => (
                      <li className="bg-blueprint-navy/5 text-blueprint-navy/80 rounded px-2 py-1 font-mono text-xs" key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {paper.policy_tags.length > 0 ? (
                <div>
                  <p className="text-blueprint-navy/60 mb-1 font-mono text-[13px] uppercase tracking-wider">Policies</p>
                  <ul className="flex flex-wrap gap-2">
                    {paper.policy_tags.map((t) => (
                      <li className="bg-blueprint-navy/5 text-blueprint-navy/80 rounded px-2 py-1 font-mono text-xs" key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {paper.task_tags.length > 0 ? (
                <div>
                  <p className="text-blueprint-navy/60 mb-1 font-mono text-[13px] uppercase tracking-wider">Tasks</p>
                  <ul className="flex flex-wrap gap-2">
                    {paper.task_tags.map((t) => (
                      <li className="bg-blueprint-navy/5 text-blueprint-navy/80 rounded px-2 py-1 font-mono text-xs" key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>

      <AskAIButton recordName={paper.title} slug={paper.id} table="papers" />
    </main>
  )
}
