import type { Metadata } from "next"
import Link from "next/link"
import type { IPolicy, IRichPolicy, ISkillType } from "@festivus/types"
import { SiteHeader } from "@/components/site-header"
import { KindIndexClient } from "@/components/data-kind/kind-index-client"
import { FestivusClient } from "@/lib/api/festivus-client"

export const metadata: Metadata = {
  title: "Policies | Festivus",
  description:
    "Every policy in the Festivus dataset — checkpoints, benchmarks, evaluations, and hardware compatibility. Search, flag, and fill gaps.",
}

const SKILL_TYPES: ReadonlySet<ISkillType> = new Set([
  "manipulation",
  "locomotion",
  "navigation",
  "aerial",
  "other",
])

function toRichPolicy(p: IPolicy): IRichPolicy {
  const skillType: ISkillType = SKILL_TYPES.has(p.skill_type as ISkillType)
    ? (p.skill_type as ISkillType)
    : "other"
  const evidence: IRichPolicy["evidence"]["level"] =
    p.evidence_level === "verified"
      ? "verified"
      : p.evidence_level === "reported"
      ? "sim-tested"
      : "model-card-only"
  const now = new Date(0).toISOString()
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.task_description,
    taskDescription: p.task_description,
    author: p.author,
    task: p.task_description,
    skillType,
    tags: [],
    framework: p.framework,
    license: p.license,
    hardware: [],
    actionSpace: {
      type: p.action_space.type,
      dimensions: p.action_space.dimensions ?? 0,
      controlFrequencyHz: p.action_space.frequency_hz ?? 0,
    },
    observationSpace: {
      type: p.observation_space.type,
      components: p.observation_space.components.map((c) => ({ name: c, type: "sensor" })),
    },
    benchmarks: [],
    evidence: {
      level: evidence,
      realWorldVideos: 0,
      simVideos: 0,
      realWorldEpisodes: 0,
      simEpisodes: 0,
      testedRobots: 0,
      testedEnvironments: 0,
    },
    hfRepoId: p.hf_repo_id ?? undefined,
    createdAt: now,
    updatedAt: now,
  }
}

export default async function PoliciesIndexPage() {
  const client = new FestivusClient()
  const raw = await client.searchPolicies({ limit: 500 })
  const policies: IRichPolicy[] = (raw ?? []).map(toRichPolicy)

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
              Policies
            </h1>
            <p className="text-blueprint-navy/70 mt-3 max-w-3xl text-base leading-relaxed md:text-lg">
              {policies.length} records. Checkpoints with benchmarks,
              evaluations, and hardware compatibility. Flag missing evidence or
              out-of-date numbers; every untested robot is a gap you or your
              agent can fill.
            </p>
          </div>
          <Link
            className="bg-safety-yellow text-blueprint-navy shrink-0 rounded px-4 py-2 text-xs font-bold uppercase tracking-wider"
            href="/data/gaps"
          >
            Pick a gap →
          </Link>
        </header>

        <KindIndexClient kind="policy" records={policies} />
      </div>
    </main>
  )
}
