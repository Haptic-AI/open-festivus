import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import type { ICompatibilityEdge, IPolicy, IRobot } from "@festivus/types"
import { AskAIButton } from "@/components/agent-chat/AskAIButton"
import { SiteHeader } from "@/components/site-header"

export const dynamicParams = true

const API_BASE = (process.env["FESTIVUS_DATASET_API_URL"] ?? "https://api.festivus.hapticlabs.ai").replace(/\/$/, "")
const FETCH_OPTS: RequestInit = {
  next: { revalidate: 60 },
  headers: { accept: "application/json" },
}

const STATUS_COLOR: Record<string, string> = {
  verified: "bg-blueprint-navy text-safety-yellow",
  reported: "bg-safety-yellow/30 text-blueprint-navy",
  inferred: "bg-blueprint-navy/10 text-blueprint-navy/80",
  untested: "bg-annotation-red/10 text-annotation-red",
}

async function fetchOne<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, FETCH_OPTS)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

// Direct slug lookup — `/v1/compatibility-edges/:slug` is O(1) at the API.
// Previous implementation fetched 500 records and linear-scanned, which cost
// ~100× bytes-over-the-wire per page render and added a latent CF-throttle
// risk during ISR revalidation. Mirrors the benchmarks/[slug] pattern.
async function findEdge(slug: string): Promise<ICompatibilityEdge | null> {
  return fetchOne<ICompatibilityEdge>(`/v1/compatibility-edges/${encodeURIComponent(slug)}`)
}

interface IPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: IPageProps): Promise<Metadata> {
  const { slug } = await params
  const edge = await findEdge(slug)
  if (edge === null) return { title: "Not found | Festivus" }
  return {
    title: `${edge.robot_slug} × ${edge.policy_slug} · compatibility | Festivus`,
    description: `${edge.status} compatibility from ${edge.source}`,
  }
}

export default async function CompatibilityEdgePage({ params }: IPageProps) {
  const { slug } = await params
  const edge = await findEdge(slug)
  if (edge === null) notFound()

  const [robot, policy] = await Promise.all([
    fetchOne<IRobot>(`/v1/robots/${encodeURIComponent(edge.robot_slug)}`),
    fetchOne<IPolicy>(`/v1/policies/${encodeURIComponent(edge.policy_slug)}`),
  ])

  const statusClasses = STATUS_COLOR[edge.status] ?? "bg-blueprint-navy/10 text-blueprint-navy"
  const successPct =
    typeof edge.success_rate === "number"
      ? `${(edge.success_rate * 100).toFixed(1)}%`
      : null
  // The CompatibilityEdge type allows several fields to be optional — the prod
  // dataset frequently omits updated_at / gaps / evidence_url for community-
  // sourced edges. Treat each as defensively-optional so the page renders
  // instead of 500-ing on `.slice()` / `.length` of undefined.
  const updatedAtShort =
    typeof edge.updated_at === "string" && edge.updated_at.length >= 10
      ? edge.updated_at.slice(0, 10)
      : null
  const gaps = Array.isArray(edge.gaps) ? edge.gaps : []
  const evidenceUrl = typeof edge.evidence_url === "string" ? edge.evidence_url : null
  // The seed data carries an extra `notes` field on community-sourced edges
  // that didn't make it into ICompatibilityEdge (yet). Read it defensively.
  const edgeNotes = (edge as unknown as { notes?: string }).notes ?? null

  return (
    <main className="bg-drafting-cream min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-4xl px-6 py-12 sm:px-10">
        <Link
          className="text-blueprint-navy/60 hover:text-blueprint-navy mb-6 inline-block font-mono text-xs font-bold uppercase tracking-wider"
          href="/data"
        >
          ← Back to Open Data
        </Link>

        <header className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={`rounded px-2.5 py-1 font-mono text-[14px] font-bold uppercase tracking-wider ${statusClasses}`}>
              {edge.status}
            </span>
            <span className="text-blueprint-navy/60 font-mono text-[13px] font-bold uppercase tracking-wider">
              source · {edge.source}
            </span>
            {edge.environment !== null ? (
              <span className="text-blueprint-navy/60 font-mono text-[13px] font-bold uppercase tracking-wider">
                env · {edge.environment}
              </span>
            ) : null}
          </div>
          <h1 className="text-blueprint-navy text-2xl font-bold leading-tight md:text-3xl">
            <Link className="hover:text-annotation-red underline decoration-transparent hover:decoration-current" href={`/data/robots/${edge.robot_slug}`}>
              {robot?.name ?? edge.robot_slug}
            </Link>
            <span className="text-blueprint-navy/60 mx-3">×</span>
            <Link className="hover:text-annotation-red underline decoration-transparent hover:decoration-current" href={`/data/policies/${edge.policy_slug}`}>
              {policy?.name ?? edge.policy_slug}
            </Link>
          </h1>
          {robot !== null && policy !== null ? (
            <p className="text-blueprint-navy/60 mt-2 text-sm">
              {[robot.manufacturer, policy.framework, policy.author]
                .filter((s): s is string => typeof s === "string" && s.length > 0)
                .join(" · ")}
            </p>
          ) : null}
        </header>

        <section className="border-blueprint-navy/10 mb-6 rounded-lg border bg-white p-6">
          <h2 className="text-blueprint-navy/80 mb-4 font-mono text-[14px] font-bold uppercase tracking-[0.2em]">Evidence</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-3">
            <div>
              <dt className="text-blueprint-navy/60 text-[14px] uppercase tracking-wider">Success rate</dt>
              <dd className="text-blueprint-navy mt-0.5 font-bold tabular-nums">{successPct ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-blueprint-navy/60 text-[14px] uppercase tracking-wider">Episodes tested</dt>
              <dd className="text-blueprint-navy mt-0.5 font-bold tabular-nums">{edge.episodes_tested?.toLocaleString() ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-blueprint-navy/60 text-[14px] uppercase tracking-wider">Updated</dt>
              <dd className="text-blueprint-navy/80 mt-0.5 font-mono text-xs">{updatedAtShort ?? "—"}</dd>
            </div>
          </dl>
          {evidenceUrl !== null && evidenceUrl.length > 0 ? (
            <p className="mt-5">
              <a
                className="text-blueprint-navy hover:text-annotation-red text-sm underline decoration-dotted"
                href={evidenceUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                {evidenceUrl}
              </a>
            </p>
          ) : null}
        </section>

        {edgeNotes !== null && edgeNotes.length > 0 ? (
          <section className="border-blueprint-navy/10 mb-6 rounded-lg border bg-white p-6">
            <h2 className="text-blueprint-navy/80 mb-3 font-mono text-[14px] font-bold uppercase tracking-[0.2em]">
              Notes
            </h2>
            <p className="text-blueprint-navy/80 text-sm leading-relaxed">{edgeNotes}</p>
          </section>
        ) : null}

        {gaps.length > 0 ? (
          <section className="border-blueprint-navy/10 mb-6 rounded-lg border bg-white p-6">
            <h2 className="text-blueprint-navy/80 mb-3 font-mono text-[14px] font-bold uppercase tracking-[0.2em]">
              Gaps noted
            </h2>
            <ul className="space-y-1">
              {gaps.map((g) => (
                <li className="text-blueprint-navy/80 text-sm" key={g}>· {g}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {robot !== null ? (
          <section className="border-blueprint-navy/10 mb-6 rounded-lg border bg-white p-6">
            <h2 className="text-blueprint-navy/80 mb-3 font-mono text-[14px] font-bold uppercase tracking-[0.2em]">
              Robot · {robot.name}
            </h2>
            {typeof robot.description === "string" && robot.description.length > 0 ? (
              <p className="text-blueprint-navy/80 mb-3 text-sm leading-relaxed">
                {robot.description.slice(0, 400)}{robot.description.length > 400 ? "…" : ""}
              </p>
            ) : null}
            <p className="font-mono text-xs">
              <Link className="text-blueprint-navy hover:text-annotation-red underline decoration-dotted" href={`/data/robots/${robot.slug}`}>
                View robot profile →
              </Link>
            </p>
          </section>
        ) : null}

        {policy !== null ? (
          <section className="border-blueprint-navy/10 rounded-lg border bg-white p-6">
            <h2 className="text-blueprint-navy/80 mb-3 font-mono text-[14px] font-bold uppercase tracking-[0.2em]">
              Policy · {policy.name}
            </h2>
            {typeof policy.task_description === "string" && policy.task_description.length > 0 ? (
              <p className="text-blueprint-navy/80 mb-3 text-sm leading-relaxed">
                {policy.task_description.slice(0, 400)}{policy.task_description.length > 400 ? "…" : ""}
              </p>
            ) : null}
            <p className="font-mono text-xs">
              <Link className="text-blueprint-navy hover:text-annotation-red underline decoration-dotted" href={`/data/policies/${policy.slug}`}>
                View policy profile →
              </Link>
            </p>
          </section>
        ) : null}
      </div>

      <AskAIButton
        recordName={`${edge.robot_slug} × ${edge.policy_slug}`}
        slug={edge.slug}
        table="compatibility_edges"
      />
    </main>
  )
}
