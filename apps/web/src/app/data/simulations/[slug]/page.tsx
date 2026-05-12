import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { SiteHeader } from "@/components/site-header"

export const dynamicParams = true

const API_BASE = (process.env["FESTIVUS_DATASET_API_URL"] ?? "https://api.festivus.hapticlabs.ai").replace(/\/$/, "")

interface IEpisodeRow {
  id: string
  simulation_id: string
  episode_index: number
  status: "pending" | "running" | "done" | "failed"
  hf_url: string
  env_slug: string
  oneclick_job_id: string | null
  video_url: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

interface ISimulationDetail {
  id: string
  slug: string
  policy_slug: string
  environment_slug: string
  task_slug: string | null
  robot_slug: string | null
  created_at: string
  updated_at: string
  episodes: IEpisodeRow[]
}

interface IPageProps {
  params: Promise<{ slug: string }>
}

async function findSimulation(slug: string): Promise<ISimulationDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/v1/simulations/${encodeURIComponent(slug)}`, {
      next: { revalidate: 10 },
      headers: { accept: "application/json" },
    })
    if (!res.ok) return null
    return (await res.json()) as ISimulationDetail
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: IPageProps): Promise<Metadata> {
  const { slug } = await params
  const sim = await findSimulation(slug)
  if (!sim) return { title: "Not found | Festivus" }
  const n = sim.episodes.length
  return {
    title: `${sim.policy_slug} on ${sim.environment_slug} | Festivus`,
    description: `${n} ${n === 1 ? "episode" : "episodes"} of ${sim.policy_slug} rendered on ${sim.environment_slug}.`,
  }
}

export default async function SimulationDetailPage({ params }: IPageProps) {
  const { slug } = await params
  const sim = await findSimulation(slug)
  if (!sim) notFound()

  return (
    <main className="bg-drafting-cream min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-5xl px-6 py-12 sm:px-10">
        <Link
          className="text-blueprint-navy/60 hover:text-blueprint-navy mb-6 inline-block font-mono text-xs font-bold uppercase tracking-wider"
          href="/data/simulations"
        >
          ← Back to Simulations
        </Link>

        <header className="mb-8">
          <h1 className="text-blueprint-navy text-2xl font-bold leading-tight md:text-3xl">
            {sim.policy_slug} <span className="text-blueprint-navy/60">on</span> {sim.environment_slug}
          </h1>
          <p className="text-blueprint-navy/60 mt-2 font-mono text-xs">
            {sim.episodes.length} {sim.episodes.length === 1 ? "episode" : "episodes"} · created {new Date(sim.created_at).toLocaleString()}
          </p>
        </header>

        <section className="border-blueprint-navy/10 mb-8 rounded-lg border bg-white p-5 text-sm">
          <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <MetaRow label="Policy">
              <Link className="underline decoration-dotted" href={`/data/policies/${sim.policy_slug}`}>
                {sim.policy_slug}
              </Link>
            </MetaRow>
            <MetaRow label="Environment">
              <Link className="underline decoration-dotted" href={`/data/environments/${sim.environment_slug}`}>
                {sim.environment_slug}
              </Link>
            </MetaRow>
            {sim.task_slug ? (
              <MetaRow label="Task">
                <Link className="underline decoration-dotted" href={`/data/tasks/${sim.task_slug}`}>
                  {sim.task_slug}
                </Link>
              </MetaRow>
            ) : null}
            {sim.robot_slug ? (
              <MetaRow label="Robot">
                <Link className="underline decoration-dotted" href={`/data/robots/${sim.robot_slug}`}>
                  {sim.robot_slug}
                </Link>
              </MetaRow>
            ) : null}
          </dl>
        </section>

        <section>
          <h2 className="text-blueprint-navy/80 mb-4 font-mono text-[14px] font-bold uppercase tracking-[0.2em]">
            Episodes
          </h2>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {sim.episodes.map((ep) => (
              <li
                className="border-blueprint-navy/10 overflow-hidden rounded-lg border bg-white"
                key={ep.id}
              >
                <EpisodePlayer episode={ep} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-blueprint-navy/60 font-mono text-[13px] font-bold uppercase tracking-wider">{label}</dt>
      <dd className="text-blueprint-navy mt-1 text-sm">{children}</dd>
    </div>
  )
}

function EpisodePlayer({ episode }: { episode: IEpisodeRow }) {
  return (
    <>
      <div className="bg-blueprint-navy/5 flex h-56 items-center justify-center">
        {episode.status === "done" && episode.video_url ? (
          <video
            controls
            aria-label={`Episode ${episode.episode_index + 1}`}
            className="h-full w-full object-contain"
            preload="metadata"
            src={episode.video_url}
          />
        ) : episode.status === "failed" ? (
          <div className="bg-annotation-red/10 mx-4 my-4 rounded p-4 text-xs text-annotation-red">
            <div className="mb-1 font-mono font-bold uppercase tracking-wider">render failed</div>
            <div className="whitespace-pre-wrap break-words text-annotation-red/80">
              {episode.error_message ?? "unknown error"}
            </div>
          </div>
        ) : (
          <div className="text-blueprint-navy/40 flex flex-col items-center gap-2 text-xs">
            <div className="border-blueprint-navy/30 h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
            <span className="font-mono uppercase tracking-wider">rendering…</span>
          </div>
        )}
      </div>
      <div className="border-blueprint-navy/10 flex items-center justify-between border-t px-4 py-2 text-[14px]">
        <span className="text-blueprint-navy/60 font-mono uppercase tracking-wider">
          episode {episode.episode_index + 1}
        </span>
        <StatusBadge status={episode.status} />
      </div>
    </>
  )
}

function StatusBadge({ status }: { status: IEpisodeRow["status"] }) {
  const map: Record<IEpisodeRow["status"], { label: string; className: string }> = {
    pending: { label: "pending", className: "bg-blueprint-navy/10 text-blueprint-navy/70" },
    running: { label: "rendering", className: "bg-safety-yellow/30 text-blueprint-navy" },
    done: { label: "done", className: "bg-emerald-100 text-emerald-700" },
    failed: { label: "failed", className: "bg-annotation-red/15 text-annotation-red" },
  }
  const { label, className } = map[status]
  return (
    <span className={`rounded px-2 py-0.5 font-mono text-[13px] font-bold uppercase tracking-wider ${className}`}>
      {label}
    </span>
  )
}
