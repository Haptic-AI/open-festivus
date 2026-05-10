"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import type { ICompatibilityEdge, IPolicy, IRobot, ITask } from "@festivus/types"
import { CoverageMatrix } from "@/components/data-matrix/coverage-matrix"

interface IStats {
  robots: number
  policies: number
  benchmarks: number
  simulations: number
  tasks: number
  environments: number
  datasets: number
  papers: number
  deploys: number
  compatibility_edges: number
}

interface IApiStatsResponse {
  robots?: number
  policies?: number
  datasets?: number
  benchmarks?: number
  deploy_notes?: number
  environments?: number
  tasks?: number
  papers?: number
  compatibility_edges?: number
}

interface ICoverageData {
  robots: IRobot[]
  policies: IPolicy[]
  tasks: ITask[]
  combinations: number
}

export function DataOverviewSections({ apiBase }: { apiBase: string }) {
  const [stats, setStats] = useState<IStats | null>(null)
  const [coverage, setCoverage] = useState<ICoverageData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        const s = await fetchStats(apiBase)
        if (cancelled) return
        setStats(s)
        const c = await fetchCoverage(apiBase, s)
        if (cancelled) return
        setCoverage(c)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Failed to load")
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [apiBase])

  return (
    <>
      <SectionHeading
        description="Search, open, edit, add, or delete any record. Open a profile to flag a field, suggest a new record, or retire one that no longer applies."
        number="01"
        title="Overview"
      />
      {error ? (
        <ErrorBox message={error} />
      ) : stats ? (
        <StatGrid stats={stats} />
      ) : (
        <StatGridSkeleton />
      )}

      <SectionDivider />

      <SectionHeading
        action={{ href: "/data/gaps", label: "Pick a gap →" }}
        description="How much of the combinations space is covered today, and where the gaps live."
        number="02"
        title="Coverage Map"
      />
      {error ? (
        <ErrorBox message={error} />
      ) : coverage ? (
        <CoverageMatrix
          combinations={coverage.combinations}
          policies={coverage.policies}
          robots={coverage.robots}
          tasks={coverage.tasks}
        />
      ) : (
        <MatrixSkeleton />
      )}
    </>
  )
}

async function fetchStats(apiBase: string): Promise<IStats> {
  const [statsRes, simRes] = await Promise.all([
    fetch(`${apiBase}/v1/stats`, { headers: { accept: "application/json" } }),
    fetch(`${apiBase}/v1/simulations?limit=1`, { headers: { accept: "application/json" } }),
  ])
  if (!statsRes.ok) {
    throw new Error(`stats fetch ${statsRes.status} ${statsRes.statusText}`)
  }
  const raw = (await statsRes.json()) as IApiStatsResponse
  // Spec 026: simulations count comes from /v1/simulations (the new groups
  // route), not /v1/stats which still tracks the legacy benchmarks count.
  let simulations = 0
  if (simRes.ok) {
    const simBody = (await simRes.json()) as { count?: number }
    simulations = simBody.count ?? 0
  }
  return {
    robots: raw.robots ?? 0,
    policies: raw.policies ?? 0,
    benchmarks: raw.benchmarks ?? 0,
    simulations,
    tasks: raw.tasks ?? 0,
    environments: raw.environments ?? 0,
    datasets: raw.datasets ?? 0,
    papers: raw.papers ?? 0,
    deploys: raw.deploy_notes ?? 0,
    compatibility_edges: raw.compatibility_edges ?? 0,
  }
}

async function fetchResults<T>(apiBase: string, path: string): Promise<T[]> {
  const res = await fetch(`${apiBase}${path}`, {
    headers: { accept: "application/json" },
  })
  if (!res.ok) {
    throw new Error(`${path} ${res.status} ${res.statusText}`)
  }
  const body = (await res.json()) as { results?: T[] }
  return body.results ?? []
}

async function fetchOne<T>(apiBase: string, path: string): Promise<T | null> {
  const res = await fetch(`${apiBase}${path}`, {
    headers: { accept: "application/json" },
  })
  if (!res.ok) {
    if (res.status === 404) return null
    throw new Error(`${path} ${res.status} ${res.statusText}`)
  }
  return (await res.json()) as T
}

async function fetchCoverage(apiBase: string, stats: IStats): Promise<ICoverageData> {
  const [allRobots, edges, tasks] = await Promise.all([
    fetchResults<IRobot>(apiBase, "/v1/robots?limit=500"),
    fetchResults<ICompatibilityEdge>(apiBase, "/v1/compatibility-edges?limit=500"),
    fetchResults<ITask>(apiBase, "/v1/tasks?limit=500"),
  ])

  const edgesByRobot = new Map<string, string[]>()
  const referencedPolicies = new Set<string>()
  for (const edge of edges) {
    if (!edgesByRobot.has(edge.robot_slug)) edgesByRobot.set(edge.robot_slug, [])
    edgesByRobot.get(edge.robot_slug)?.push(edge.policy_slug)
    referencedPolicies.add(edge.policy_slug)
  }

  const hydratedRobots = allRobots.map<IRobot>((r) => ({
    ...r,
    compatible_policy_slugs: edgesByRobot.get(r.slug) ?? [],
  }))

  const policies = (
    await Promise.all(
      Array.from(referencedPolicies).map((slug) =>
        fetchOne<IPolicy>(apiBase, `/v1/policies/${encodeURIComponent(slug)}`),
      ),
    )
  ).filter((p): p is IPolicy => p !== null)

  const combinations =
    stats.robots *
    stats.policies *
    Math.max(stats.tasks, 1) *
    Math.max(stats.environments, 1)

  return { robots: hydratedRobots, policies, tasks, combinations }
}

interface ISectionHeadingProps {
  number: string
  title: string
  description: string
  action?: { href: string; label: string }
}

function SectionHeading({ number, title, description, action }: ISectionHeadingProps) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-6">
      <div className="flex items-start gap-4">
        <span className="bg-blueprint-navy text-safety-yellow inline-flex shrink-0 items-center justify-center rounded px-3 py-1.5 font-mono text-sm font-bold">
          {number}
        </span>
        <div className="min-w-0">
          <h2 className="text-blueprint-navy text-2xl font-bold uppercase tracking-tight md:text-4xl">
            {title}
          </h2>
          <p className="text-blueprint-navy/60 mt-2 max-w-3xl text-sm leading-relaxed md:text-base">
            {description}
          </p>
        </div>
      </div>
      {action ? (
        <Link
          className="bg-safety-yellow text-blueprint-navy shrink-0 rounded px-4 py-2 text-xs font-bold uppercase tracking-wider"
          href={action.href}
        >
          {action.label}
        </Link>
      ) : null}
    </header>
  )
}

function SectionDivider() {
  return <hr className="border-blueprint-navy/10 my-16 border-t" />
}

function StatGrid({ stats }: { stats: IStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8">
      <StatCell href="/data/robots" label="Robots" value={stats.robots} />
      <StatCell href="/data/policies" label="Policies" value={stats.policies} />
      <StatCell href="/data/benchmarks" label="Benchmarks" value={stats.benchmarks} />
      <StatCell href="/data/simulations" label="Simulations" value={stats.simulations} />
      <StatCell href="/data/tasks" label="Tasks" value={stats.tasks} />
      <StatCell href="/data/environments" label="Environments" value={stats.environments} />
      <StatCell href="/data/datasets" label="Datasets" value={stats.datasets} />
      <StatCell href="/data/papers" label="Papers" value={stats.papers} />
      <StatCell href="/data/deploys" label="Deploys" value={stats.deploys} />
    </div>
  )
}

function StatCell({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      className="border-blueprint-navy/10 hover:border-blueprint-navy/40 bg-white block rounded-lg border p-4 transition-colors"
      href={href}
    >
      <p className="text-blueprint-navy font-mono text-xs font-bold uppercase tracking-wider">
        {label}
      </p>
      <p className="text-blueprint-navy/80 mt-2 text-sm tabular-nums">
        <span className="text-blueprint-navy text-2xl font-bold md:text-3xl">
          {value.toLocaleString()}
        </span>{" "}
        <span className="text-blueprint-navy/50 font-mono text-[14px] font-bold uppercase tracking-wider">
          records
        </span>
      </p>
    </Link>
  )
}

function StatGridSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading record counts"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8"
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          className="border-blueprint-navy/10 bg-white/60 h-[92px] animate-pulse rounded-lg border p-4"
          key={i}
        />
      ))}
    </div>
  )
}

function MatrixSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading coverage map"
      className="border-blueprint-navy/10 bg-white/60 h-64 animate-pulse rounded-lg border"
    />
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="border-blueprint-navy/20 bg-white/80 text-blueprint-navy/80 rounded-lg border p-4 text-sm">
      Couldn&apos;t load this section: {message}. Refresh to try again.
    </div>
  )
}
