import type { Metadata } from "next"
import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { SimulationsFilterBar } from "./filter-bar"

export const metadata: Metadata = {
  title: "Simulations | Festivus",
  description:
    "Each simulation is robot × policy × task and contains multiple episodes.",
}

const API_BASE = (process.env["FESTIVUS_DATASET_API_URL"] ?? "https://api.festivus.hapticlabs.ai").replace(/\/$/, "")

// Hardcoded env list — matches the workbench/sim-test card env_slugs. The
// /v1/environments seed is currently empty; revisit when env records exist.
const ENV_OPTIONS: ReadonlyArray<{ slug: string; label: string }> = [
  { slug: "isaac-lab-humanoid", label: "Isaac Lab Humanoid" },
  { slug: "mujoco-humanoid-cloth", label: "MuJoCo Humanoid Cloth" },
  { slug: "softgym-cloth-manipulation", label: "SoftGym Cloth Manipulation" },
]

interface ISimulationGroup {
  id: string
  slug: string
  policy_slug: string
  environment_slug: string
  task_slug: string | null
  robot_slug: string | null
  created_at: string
  episode_count: number
  first_episode_video_url: string | null
}

interface IPickerRecord {
  slug: string
  name?: string
}

interface IFilterState {
  policy_slug: string
  environment_slug: string
  task_slug: string
  robot_slug: string
}

function parseSearchParams(raw: Record<string, string | string[] | undefined>): IFilterState {
  const get = (k: keyof IFilterState): string => {
    const v = raw[k]
    return typeof v === "string" ? v : ""
  }
  return {
    policy_slug: get("policy_slug"),
    environment_slug: get("environment_slug"),
    task_slug: get("task_slug"),
    robot_slug: get("robot_slug"),
  }
}

function buildQueryString(filters: IFilterState, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v) params.set(k, v)
  }
  for (const [k, v] of Object.entries(extra)) {
    if (v) params.set(k, v)
  }
  const s = params.toString()
  return s ? `?${s}` : ""
}

async function fetchSimulations(filters: IFilterState, limit = 500): Promise<ISimulationGroup[]> {
  try {
    const qs = buildQueryString(filters, { limit: String(limit) })
    const res = await fetch(`${API_BASE}/v1/simulations${qs}`, {
      next: { revalidate: 60 },
      headers: { accept: "application/json" },
    })
    if (!res.ok) return []
    const body = (await res.json()) as { results?: ISimulationGroup[] }
    return body.results ?? []
  } catch {
    return []
  }
}

async function fetchSimulationCount(filters: IFilterState): Promise<number> {
  try {
    const qs = buildQueryString(filters, { limit: "1" })
    const res = await fetch(`${API_BASE}/v1/simulations${qs}`, {
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

async function fetchPickerList(path: string): Promise<IPickerRecord[]> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      next: { revalidate: 300 },
      headers: { accept: "application/json" },
    })
    if (!res.ok) return []
    const body = (await res.json()) as { results?: IPickerRecord[] }
    return body.results ?? []
  } catch {
    return []
  }
}

interface IPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function SimulationsIndexPage({ searchParams }: IPageProps) {
  const raw = await searchParams
  const filters = parseSearchParams(raw)
  const [sims, total, policies, tasks, robots] = await Promise.all([
    fetchSimulations(filters, 500),
    fetchSimulationCount(filters),
    fetchPickerList("/v1/policies?limit=500"),
    fetchPickerList("/v1/tasks?limit=500"),
    fetchPickerList("/v1/robots?limit=500"),
  ])

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

        <header className="mb-8">
          <h1 className="text-blueprint-navy text-3xl font-bold uppercase tracking-tight md:text-5xl">
            Simulations
          </h1>
          <p className="text-blueprint-navy/70 mt-3 max-w-3xl text-base leading-relaxed md:text-lg">
            {total.toLocaleString()} {total === 1 ? "record" : "records"}. Each simulation is robot × policy × task and contains multiple episodes.
          </p>
        </header>

        <SimulationsFilterBar
          envOptions={ENV_OPTIONS}
          filters={filters}
          policyOptions={policies.map((p) => ({ slug: p.slug, label: p.name ?? p.slug }))}
          robotOptions={robots.map((r) => ({ slug: r.slug, label: r.name ?? r.slug }))}
          taskOptions={tasks.map((t) => ({ slug: t.slug, label: t.name ?? t.slug }))}
        />

        {sims.length === 0 ? (
          <div className="border-blueprint-navy/10 mt-6 rounded-lg border bg-white p-10 text-center">
            <p className="text-blueprint-navy/70">
              No simulations match these filters.{" "}
              <Link className="underline decoration-dotted" href="/data/simulations">
                Clear filters
              </Link>
              .
            </p>
          </div>
        ) : (
          <ul className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sims.map((sim) => (
              <li
                className="border-blueprint-navy/10 hover:border-blueprint-navy/40 overflow-hidden rounded-lg border bg-white transition-colors"
                key={sim.slug}
              >
                <Link className="block" href={`/data/simulations/${sim.slug}`}>
                  <div className="bg-blueprint-navy/5 flex h-40 items-center justify-center">
                    {sim.first_episode_video_url ? (
                      <video
                        aria-label={`${sim.policy_slug} on ${sim.environment_slug} — first episode preview`}
                        className="h-full w-full object-cover"
                        preload="metadata"
                        src={sim.first_episode_video_url}
                      />
                    ) : (
                      <span className="text-blueprint-navy/40 font-mono text-[14px] uppercase tracking-wider">
                        rendering…
                      </span>
                    )}
                  </div>
                </Link>
                <div className="p-5">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="bg-blueprint-navy/10 text-blueprint-navy rounded px-2 py-0.5 font-mono text-[13px] font-bold uppercase tracking-wider">
                      {sim.episode_count} ep{sim.episode_count === 1 ? "" : "s"}
                    </span>
                    <span className="text-blueprint-navy/60 font-mono text-[13px] font-bold uppercase tracking-wider">
                      {new Date(sim.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <dl className="space-y-1.5 text-xs">
                    <FacetRow href={`/data/robots/${sim.robot_slug ?? ""}`} label="Robot" value={sim.robot_slug} />
                    <FacetRow href={`/data/policies/${sim.policy_slug}`} label="Policy" value={sim.policy_slug} />
                    <FacetRow href={`/data/tasks/${sim.task_slug ?? ""}`} label="Task" value={sim.task_slug} />
                    <FacetRow href={`/data/environments/${sim.environment_slug}`} label="Env" value={sim.environment_slug} />
                  </dl>
                  <Link
                    className="text-blueprint-navy/60 hover:text-blueprint-navy mt-3 inline-block font-mono text-[13px] font-bold uppercase tracking-wider"
                    href={`/data/simulations/${sim.slug}`}
                  >
                    Play {sim.episode_count} episode{sim.episode_count === 1 ? "" : "s"} →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}

function FacetRow({
  label,
  value,
  href,
}: {
  label: string
  value: string | null
  href: string
}) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-blueprint-navy/60 w-12 shrink-0 font-mono text-[13px] font-bold uppercase tracking-wider">
        {label}
      </dt>
      <dd className="text-blueprint-navy min-w-0 flex-1 truncate">
        {value ? (
          <Link className="underline decoration-dotted hover:no-underline" href={href}>
            {value}
          </Link>
        ) : (
          <span className="text-blueprint-navy/40">—</span>
        )}
      </dd>
    </div>
  )
}
