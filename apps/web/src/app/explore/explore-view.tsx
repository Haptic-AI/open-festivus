"use client"

import Link from "next/link"
import { useState } from "react"
import type { IRichDataset, IRichPolicy, IRichRobot, ISimEnvironment } from "@festivus/types"
import { SuggestEditChip } from "@/components/suggest-edit/suggest-edit-chip"

interface IExploreViewProps {
  policies: IRichPolicy[]
  robots: IRichRobot[]
  datasets: IRichDataset[]
  environments: ISimEnvironment[]
}

const SKILL_CHIPS = ["All", "Manipulation", "Locomotion", "Navigation", "Aerial"] as const

const EVIDENCE_COLORS: Record<string, string> = {
  verified: "bg-safety-yellow text-blueprint-navy",
  "sim-tested": "bg-blueprint-navy text-drafting-cream",
  "model-card-only": "bg-cold-gray/30 text-blueprint-navy/80",
}

const EVIDENCE_SHORT: Record<string, string> = {
  verified: "Verified",
  "sim-tested": "Sim tested",
  "model-card-only": "Model card",
}

function matchesQuery(text: string, query: string): boolean {
  const q = query.toLowerCase()
  return text.toLowerCase().includes(q)
}

function SectionHeader({ count, title }: { count: number; title: string }) {
  return (
    <div className="mb-4 flex items-baseline gap-3">
      <h2 className="text-blueprint-navy text-lg font-bold uppercase tracking-tight md:text-xl">
        {title}
      </h2>
      <span className="text-blueprint-navy/70 text-xs">{count}</span>
    </div>
  )
}

export function ExploreView({ policies, robots, datasets, environments }: IExploreViewProps) {
  const [query, setQuery] = useState("")
  const [skillFilter, setSkillFilter] = useState<string>("All")

  const q = query.trim()

  // Filter policies
  const filteredPolicies = policies.filter((p) => {
    if (skillFilter !== "All" && p.skillType !== skillFilter.toLowerCase()) return false
    if (q.length === 0) return true
    return (
      matchesQuery(p.name, q) ||
      matchesQuery(p.taskDescription, q) ||
      matchesQuery(p.task, q) ||
      matchesQuery(p.description, q) ||
      p.tags.some((t) => matchesQuery(t, q)) ||
      p.hardware.some((h) => matchesQuery(h.name, q))
    )
  }).sort((a, b) => {
    const ea = a.evidence.level === "verified" ? 3 : a.evidence.level === "sim-tested" ? 2 : 1
    const eb = b.evidence.level === "verified" ? 3 : b.evidence.level === "sim-tested" ? 2 : 1
    if (eb !== ea) return eb - ea
    return (b.downloads?.lastMonth ?? 0) - (a.downloads?.lastMonth ?? 0)
  })

  // Filter robots
  const filteredRobots = robots.filter((r) => {
    if (q.length === 0) return true
    return matchesQuery(r.name, q) || matchesQuery(r.manufacturer, q) || matchesQuery(r.description, q) || matchesQuery(r.hardware.type, q)
  })

  // Filter datasets
  const filteredDatasets = datasets.filter((d) => {
    if (q.length === 0) return true
    return matchesQuery(d.name, q) || matchesQuery(d.description, q) || d.robotNames.some((r) => matchesQuery(r, q))
  })

  // Filter environments
  const filteredEnvironments = environments.filter((e) => {
    if (q.length === 0) return true
    return matchesQuery(e.name, q) || matchesQuery(e.simulator, q) || matchesQuery(e.description, q)
  })

  const suggestions = ["pick and place SO-100", "walking quadruped", "drone survey", "bimanual manipulation"]

  return (
    <div>
      {/* Context Bar */}
      <div className="mb-10">
        <label className="text-blueprint-navy/70 mb-2 block text-xs" htmlFor="explore-search">
          What are you working on? Describe your robot, task, or goal...
        </label>
        <input
          autoComplete="off"
          className="border-blueprint-navy/20 focus:border-blueprint-navy bg-drafting-cream text-blueprint-navy placeholder:text-blueprint-navy/50 w-full border-2 px-4 py-3 text-sm outline-none transition-colors"
          id="explore-search"
          onChange={(e) => setQuery(e.target.value)}
          placeholder="pick up objects with SO-100, walking humanoid, drone survey..."
          type="text"
          value={query}
        />
        {q.length === 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                className="border-blueprint-navy/15 text-blueprint-navy/70 hover:border-blueprint-navy hover:text-blueprint-navy cursor-pointer border px-3 py-1 text-xs transition-colors"
                key={s}
                onClick={() => setQuery(s)}
                type="button"
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          <button
            className="text-blueprint-navy/70 hover:text-blueprint-navy mt-2 text-xs underline underline-offset-2"
            onClick={() => { setQuery(""); setSkillFilter("All") }}
            type="button"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Section 1: Policies */}
      <section className="mb-10">
        <div className="mb-4 flex flex-wrap items-baseline gap-4">
          <SectionHeader count={filteredPolicies.length} title="Policies" />
          <div className="flex gap-1.5">
            {SKILL_CHIPS.map((chip) => (
              <button
                className={`cursor-pointer border px-2.5 py-1 text-[13px] font-bold uppercase tracking-wider transition-colors ${
                  skillFilter === chip
                    ? "bg-blueprint-navy text-drafting-cream border-blueprint-navy"
                    : "border-blueprint-navy/15 text-blueprint-navy/70 hover:border-blueprint-navy"
                }`}
                key={chip}
                onClick={() => setSkillFilter(chip)}
                type="button"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
        {filteredPolicies.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {filteredPolicies.slice(0, 8).map((p) => (
              <div className="group relative w-64 shrink-0" key={p.id}>
                <Link
                  className="border-blueprint-navy/10 hover:border-blueprint-navy/30 block border p-4 transition-colors"
                  href={`/data/policies/${p.slug}`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 text-[12px] font-bold uppercase tracking-wider ${EVIDENCE_COLORS[p.evidence.level] ?? ""}`}>
                      {EVIDENCE_SHORT[p.evidence.level] ?? p.evidence.level}
                    </span>
                  </div>
                  <p className="text-blueprint-navy text-sm font-bold leading-tight">{p.name}</p>
                  <p className="text-blueprint-navy/70 mt-1 text-xs leading-relaxed">{p.taskDescription}</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {p.hardware.slice(0, 3).map((h) => (
                      <span className="bg-blueprint-navy/5 text-blueprint-navy/70 px-1.5 py-0.5 text-[12px]" key={h.id}>
                        {h.name}
                      </span>
                    ))}
                  </div>
                  {p.benchmarks.length > 0 ? (
                    <div className="text-blueprint-navy/70 mt-2 flex gap-2 text-[13px]">
                      {p.benchmarks.find((b) => b.environment === "real") !== undefined ? (
                        <span>{p.benchmarks.find((b) => b.environment === "real")?.value}{p.benchmarks.find((b) => b.environment === "real")?.unit} real</span>
                      ) : p.benchmarks[0] !== undefined ? (
                        <span>{p.benchmarks[0].value}{p.benchmarks[0].unit} {p.benchmarks[0].environment}</span>
                      ) : null}
                      <span>·</span>
                      <span>{p.evidence.realWorldEpisodes + p.evidence.simEpisodes} eps</span>
                    </div>
                  ) : null}
                </Link>
                <div className="absolute right-2 top-2">
                  <SuggestEditChip recordId={p.slug} recordKind="policy" recordName={p.name} />
                </div>
              </div>
            ))}
            {filteredPolicies.length > 8 ? (
              <Link
                className="border-blueprint-navy/10 text-blueprint-navy/70 hover:text-blueprint-navy flex w-32 shrink-0 items-center justify-center border text-xs font-bold transition-colors"
                href="/policies"
              >
                View all {filteredPolicies.length} →
              </Link>
            ) : null}
          </div>
        ) : (
          <p className="text-blueprint-navy/70 text-sm italic">No policies match your filters. <button className="underline" onClick={() => { setQuery(""); setSkillFilter("All") }} type="button">Clear filters</button></p>
        )}
      </section>

      {/* Section 2: Robots */}
      <section className="mb-10">
        <SectionHeader count={filteredRobots.length} title="Robots" />
        {filteredRobots.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {filteredRobots.slice(0, 8).map((r) => (
              <div className="group relative w-56 shrink-0" key={r.id}>
                <Link
                  className="border-blueprint-navy/10 hover:border-blueprint-navy/30 block border p-4 transition-colors"
                  href={`/data/robots/${r.slug}`}
                >
                  <p className="text-blueprint-navy text-sm font-bold">{r.name}</p>
                  <p className="text-blueprint-navy/70 text-xs">{r.manufacturer}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="bg-blueprint-navy/5 text-blueprint-navy/70 px-1.5 py-0.5 text-[12px] uppercase">{r.hardware.type}</span>
                    <span className="text-blueprint-navy/70 text-[13px]">{r.hardware.degreesOfFreedom} DoF</span>
                  </div>
                  <p className="text-blueprint-navy/70 mt-2 text-[13px]">
                    {r.compatiblePolicySlugs.length} compatible {r.compatiblePolicySlugs.length === 1 ? "policy" : "policies"}
                  </p>
                </Link>
                <div className="absolute right-2 top-2">
                  <SuggestEditChip recordId={r.slug} recordKind="robot" recordName={r.name} />
                </div>
              </div>
            ))}
            {filteredRobots.length > 8 ? (
              <div className="border-blueprint-navy/10 text-blueprint-navy/70 flex w-32 shrink-0 items-center justify-center border text-xs font-bold">
                View all {filteredRobots.length} →
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-blueprint-navy/70 text-sm italic">No robots match your filters. <button className="underline" onClick={() => { setQuery(""); setSkillFilter("All") }} type="button">Clear filters</button></p>
        )}
      </section>

      {/* Section 3: Datasets */}
      <section className="mb-10">
        <SectionHeader count={filteredDatasets.length} title="Datasets" />
        {filteredDatasets.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {filteredDatasets.slice(0, 8).map((d) => (
              <div className="group relative w-64 shrink-0" key={d.id}>
                <Link
                  className="border-blueprint-navy/10 hover:border-blueprint-navy/30 block border p-4 transition-colors"
                  href={`/data/datasets/${d.slug}`}
                >
                  <p className="text-blueprint-navy text-sm font-bold leading-tight">{d.name}</p>
                  <p className="text-blueprint-navy/70 mt-1 text-xs leading-relaxed">{d.description}</p>
                  <div className="text-blueprint-navy/70 mt-2 flex flex-wrap gap-2 text-[13px]">
                    <span>{d.episodes.toLocaleString()} episodes</span>
                    <span>·</span>
                    <span>{d.robots} robot{d.robots > 1 ? "s" : ""}</span>
                  </div>
                </Link>
                <div className="absolute right-2 top-2">
                  <SuggestEditChip
                    currentValueHint={d.hfDatasetId !== undefined ? `https://huggingface.co/datasets/${d.hfDatasetId}` : undefined}
                    recordId={d.slug}
                    recordKind="dataset"
                    recordName={d.name}
                  />
                </div>
              </div>
            ))}
            {filteredDatasets.length > 8 ? (
              <div className="border-blueprint-navy/10 text-blueprint-navy/70 flex w-32 shrink-0 items-center justify-center border text-xs font-bold">
                View all {filteredDatasets.length} →
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-blueprint-navy/70 text-sm italic">No datasets match your filters. <button className="underline" onClick={() => { setQuery(""); setSkillFilter("All") }} type="button">Clear filters</button></p>
        )}
      </section>

      {/* Section 4: Simulation Environments */}
      <section className="mb-10">
        <SectionHeader count={filteredEnvironments.length} title="Environments" />
        {filteredEnvironments.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {filteredEnvironments.slice(0, 8).map((e) => (
              <div className="group relative w-56 shrink-0" key={e.id}>
                <Link
                  className="border-blueprint-navy/10 hover:border-blueprint-navy/30 block border p-4 transition-colors"
                  href={`/data/environments/${e.id}`}
                >
                  <p className="text-blueprint-navy text-sm font-bold">{e.name}</p>
                  <p className="text-blueprint-navy/70 mt-1 text-xs leading-relaxed">{e.description}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="bg-blueprint-navy/5 text-blueprint-navy/70 px-1.5 py-0.5 text-[12px] uppercase">
                      {e.simulator}
                    </span>
                    <span className="text-blueprint-navy/70 text-[13px]">{e.scene}</span>
                  </div>
                </Link>
                <div className="absolute right-2 top-2">
                  <SuggestEditChip recordId={e.id} recordKind="environment" recordName={e.name} />
                </div>
              </div>
            ))}
            {filteredEnvironments.length > 8 ? (
              <div className="border-blueprint-navy/10 text-blueprint-navy/70 flex w-32 shrink-0 items-center justify-center border text-xs font-bold">
                View all {filteredEnvironments.length} →
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-blueprint-navy/70 text-sm italic">No environments match your filters. <button className="underline" onClick={() => { setQuery(""); setSkillFilter("All") }} type="button">Clear filters</button></p>
        )}
      </section>
    </div>
  )
}
