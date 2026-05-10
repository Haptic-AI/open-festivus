import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import type { IBenchmarkRecord } from "@festivus/types"
import { AskAIButton } from "@/components/agent-chat/AskAIButton"
import { SiteHeader } from "@/components/site-header"

export const dynamicParams = true

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

interface IPageProps {
  params: Promise<{ slug: string }>
}

async function findBenchmark(slug: string): Promise<IBenchmarkRecord | null> {
  try {
    const res = await fetch(`${API_BASE}/v1/benchmarks/${encodeURIComponent(slug)}`, {
      headers: { accept: "application/json" },
    })
    if (!res.ok) return null
    return (await res.json()) as IBenchmarkRecord
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: IPageProps): Promise<Metadata> {
  const { slug } = await params
  const bm = await findBenchmark(slug)
  if (bm === null) return { title: "Not found | Festivus" }
  return {
    title: `${bm.name} · benchmark | Festivus`,
    description: bm.description.slice(0, 160),
  }
}

export default async function BenchmarkProfilePage({ params }: IPageProps) {
  const { slug } = await params
  const bm = await findBenchmark(slug)
  if (bm === null) notFound()

  return (
    <main className="bg-drafting-cream min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-4xl px-6 py-12 sm:px-10">
        <Link
          className="text-blueprint-navy/60 hover:text-blueprint-navy mb-6 inline-block font-mono text-xs font-bold uppercase tracking-wider"
          href="/data/benchmarks"
        >
          ← Back to Benchmarks
        </Link>

        <header className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={`rounded px-2 py-0.5 font-mono text-[13px] font-bold uppercase tracking-wider ${ENV_COLOR[bm.environment] ?? "bg-blueprint-navy/10 text-blueprint-navy"}`}>
              {bm.environment}
            </span>
            <span className={`rounded px-2 py-0.5 font-mono text-[13px] font-bold uppercase tracking-wider ${DIFFICULTY_COLOR[bm.difficulty] ?? "bg-blueprint-navy/10 text-blueprint-navy"}`}>
              {bm.difficulty}
            </span>
            <span className="text-blueprint-navy/60 font-mono text-[13px] font-bold uppercase tracking-wider">
              {bm.task_scope}
            </span>
            <span className="text-blueprint-navy/60 font-mono text-[13px] font-bold uppercase tracking-wider">
              metric · {bm.metric}
            </span>
          </div>
          <h1 className="text-blueprint-navy text-2xl font-bold leading-tight md:text-3xl">{bm.name}</h1>
        </header>

        <section className="border-blueprint-navy/10 mb-6 rounded-lg border bg-white p-6">
          <h2 className="text-blueprint-navy/80 mb-3 font-mono text-[14px] font-bold uppercase tracking-[0.2em]">Description</h2>
          <p className="text-blueprint-navy/80 text-sm leading-relaxed">{bm.description}</p>
        </section>

        {bm.source_url.length > 0 ? (
          <section className="border-blueprint-navy/10 mb-6 rounded-lg border bg-white p-6">
            <h2 className="text-blueprint-navy/80 mb-3 font-mono text-[14px] font-bold uppercase tracking-[0.2em]">Source</h2>
            <a
              className="text-blueprint-navy hover:text-annotation-red text-sm underline decoration-dotted"
              href={bm.source_url}
              rel="noopener noreferrer"
              target="_blank"
            >
              {bm.source_url}
            </a>
          </section>
        ) : null}

        {bm.linked_policy_slugs.length > 0 ? (
          <section className="border-blueprint-navy/10 mb-6 rounded-lg border bg-white p-6">
            <h2 className="text-blueprint-navy/80 mb-3 font-mono text-[14px] font-bold uppercase tracking-[0.2em]">Linked policies</h2>
            <ul className="space-y-1">
              {bm.linked_policy_slugs.map((s) => (
                <li key={s}>
                  <Link className="text-blueprint-navy hover:text-annotation-red text-sm underline decoration-dotted" href={`/data/policies/${s}`}>
                    {s}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {bm.linked_dataset_slugs.length > 0 ? (
          <section className="border-blueprint-navy/10 mb-6 rounded-lg border bg-white p-6">
            <h2 className="text-blueprint-navy/80 mb-3 font-mono text-[14px] font-bold uppercase tracking-[0.2em]">Linked datasets</h2>
            <ul className="space-y-1">
              {bm.linked_dataset_slugs.map((s) => (
                <li key={s}>
                  <Link className="text-blueprint-navy hover:text-annotation-red text-sm underline decoration-dotted" href={`/data/datasets/${s}`}>
                    {s}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {bm.baseline_results.length > 0 ? (
          <section className="border-blueprint-navy/10 rounded-lg border bg-white p-6">
            <h2 className="text-blueprint-navy/80 mb-3 font-mono text-[14px] font-bold uppercase tracking-[0.2em]">Baseline results</h2>
            <pre className="text-blueprint-navy/80 overflow-x-auto text-xs">{JSON.stringify(bm.baseline_results, null, 2)}</pre>
          </section>
        ) : null}
      </div>

      <AskAIButton recordName={bm.name} slug={bm.slug} table="benchmarks" />
    </main>
  )
}
