"use client"

import Link from "next/link"
import { useState } from "react"
import type { IRichPolicy } from "@festivus/types"

interface IPolicySearchProps {
  policies: IRichPolicy[]
}

const SKILL_LABELS: Record<string, string> = {
  manipulation: "Manipulation",
  locomotion: "Locomotion",
  navigation: "Navigation",
  aerial: "Aerial",
  other: "Other",
}

const EVIDENCE_LABELS: Record<string, string> = {
  verified: "Verified on real hardware",
  "sim-tested": "Tested in simulation",
  "model-card-only": "Model card only",
}

const EVIDENCE_COLORS: Record<string, string> = {
  verified: "bg-safety-yellow text-blueprint-navy",
  "sim-tested": "bg-blueprint-navy text-drafting-cream",
  "model-card-only": "bg-cold-gray/30 text-blueprint-navy/80",
}

function matchesSearch(policy: IRichPolicy, query: string): boolean {
  const q = query.toLowerCase()
  return (
    policy.name.toLowerCase().includes(q) ||
    policy.taskDescription.toLowerCase().includes(q) ||
    policy.task.toLowerCase().includes(q) ||
    policy.description.toLowerCase().includes(q) ||
    policy.tags.some((t) => t.toLowerCase().includes(q)) ||
    policy.hardware.some((h) => h.name.toLowerCase().includes(q))
  )
}

function evidenceScore(policy: IRichPolicy): number {
  if (policy.evidence.level === "verified") return 3
  if (policy.evidence.level === "sim-tested") return 2
  return 1
}

function evidenceSummary(policy: IRichPolicy): string {
  const e = policy.evidence
  const parts: string[] = []
  if (e.testedRobots > 0) parts.push(`${e.testedRobots} robot${e.testedRobots > 1 ? "s" : ""}`)
  if (e.testedEnvironments > 0) parts.push(`${e.testedEnvironments} env${e.testedEnvironments > 1 ? "s" : ""}`)
  const episodes = e.realWorldEpisodes + e.simEpisodes
  if (episodes > 0) parts.push(`${episodes.toLocaleString()} episodes`)
  if (parts.length === 0) return "No test data available"
  return `Tested on ${parts.join(", ")}`
}

export function PolicySearch({ policies }: IPolicySearchProps) {
  const [query, setQuery] = useState("")
  const [selectedRobot, setSelectedRobot] = useState<string>("")
  const [selectedEvidence, setSelectedEvidence] = useState<string>("")

  const filtered = policies
    .filter((p) => {
      if (query.length > 0 && !matchesSearch(p, query)) return false
      if (selectedRobot.length > 0 && !p.hardware.some((h) => h.name === selectedRobot)) return false
      if (selectedEvidence.length > 0 && p.evidence.level !== selectedEvidence) return false
      return true
    })
    .sort((a, b) => evidenceScore(b) - evidenceScore(a))

  const uniqueRobotNames = [...new Set(policies.flatMap((p) => p.hardware.map((h) => h.name)))].sort()

  return (
    <div>
      {/* Task search */}
      <div className="mb-8">
        <label className="text-blueprint-navy/70 mb-2 block text-xs font-bold uppercase tracking-[0.2em]" htmlFor="task-search">
          What do you want your robot to do?
        </label>
        <input
          autoComplete="off"
          className="border-blueprint-navy/20 focus:border-blueprint-navy bg-drafting-cream text-blueprint-navy placeholder:text-blueprint-navy/50 w-full border-2 px-4 py-3 text-sm outline-none transition-colors"
          id="task-search"
          onChange={(e) => setQuery(e.target.value)}
          placeholder="pick up objects, walk around, fold laundry, fly over a field..."
          type="text"
          value={query}
        />
      </div>

      {/* Filters row */}
      <div className="mb-8 flex flex-wrap gap-4">
        {/* Robot filter */}
        <div>
          <label className="text-blueprint-navy/70 mb-1 block text-xs font-bold uppercase tracking-[0.2em]" htmlFor="robot-filter">
            Robot
          </label>
          <select
            className="border-blueprint-navy/20 focus:border-blueprint-navy bg-drafting-cream text-blueprint-navy cursor-pointer border px-3 py-2 text-xs outline-none"
            id="robot-filter"
            onChange={(e) => setSelectedRobot(e.target.value)}
            value={selectedRobot}
          >
            <option value="">All robots</option>
            {uniqueRobotNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        {/* Evidence filter */}
        <div>
          <label className="text-blueprint-navy/70 mb-1 block text-xs font-bold uppercase tracking-[0.2em]" htmlFor="evidence-filter">
            Evidence
          </label>
          <select
            className="border-blueprint-navy/20 focus:border-blueprint-navy bg-drafting-cream text-blueprint-navy cursor-pointer border px-3 py-2 text-xs outline-none"
            id="evidence-filter"
            onChange={(e) => setSelectedEvidence(e.target.value)}
            value={selectedEvidence}
          >
            <option value="">Any evidence level</option>
            <option value="verified">Verified on real hardware</option>
            <option value="sim-tested">Tested in simulation</option>
            <option value="model-card-only">Model card only</option>
          </select>
        </div>

        {/* Result count */}
        <div className="flex items-end">
          <p className="text-blueprint-navy/70 pb-2 text-xs">
            {filtered.length} {filtered.length === 1 ? "policy" : "policies"}
          </p>
        </div>
      </div>

      {/* Results */}
      {filtered.length > 0 ? (
        <div className="space-y-4">
          {filtered.map((policy) => (
            <Link
              className="border-blueprint-navy/15 hover:border-blueprint-navy/40 block border p-6 transition-colors duration-200"
              href={`/policies/${policy.slug}`}
              key={policy.id}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  {/* Title and badges */}
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="text-blueprint-navy text-base font-bold">
                      {policy.name}
                    </h3>
                    <span className={`px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${EVIDENCE_COLORS[policy.evidence.level] ?? ""}`}>
                      {EVIDENCE_LABELS[policy.evidence.level] ?? policy.evidence.level}
                    </span>
                    <span className="border-blueprint-navy/20 text-blueprint-navy/50 border px-2 py-0.5 text-xs uppercase tracking-wider">
                      {SKILL_LABELS[policy.skillType] ?? policy.skillType}
                    </span>
                  </div>

                  {/* Task description */}
                  <p className="text-blueprint-navy/70 mb-3 text-sm leading-relaxed">
                    {policy.taskDescription}
                  </p>

                  {/* Metadata row */}
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    {/* Compatible robots */}
                    <div className="flex items-center gap-1">
                      <span className="text-blueprint-navy/70 uppercase tracking-wider">Robots:</span>
                      {policy.hardware.map((h) => (
                        <span
                          className={`px-1.5 py-0.5 ${
                            selectedRobot === h.name
                              ? "bg-safety-yellow text-blueprint-navy font-bold"
                              : "bg-blueprint-navy/5 text-blueprint-navy/60"
                          }`}
                          key={h.id}
                        >
                          {h.name}
                        </span>
                      ))}
                    </div>

                    <span className="bg-blueprint-navy/10 h-3 w-px" />

                    {/* Evidence summary */}
                    <span className="text-cold-gray">
                      {evidenceSummary(policy)}
                    </span>

                    <span className="bg-blueprint-navy/10 h-3 w-px" />

                    {/* Framework */}
                    <span className="text-cold-gray">
                      {policy.framework}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="border-blueprint-navy/10 border-2 border-dashed px-6 py-16 text-center">
          <p className="text-blueprint-navy/60 mb-2 text-sm font-bold">
            No policies found
          </p>
          {query.length > 0 || selectedRobot.length > 0 ? (
            <p className="text-blueprint-navy/70 text-xs">
              Try broadening your search or removing filters
            </p>
          ) : (
            <p className="text-blueprint-navy/70 text-xs">
              No policies available yet
            </p>
          )}
        </div>
      )}
    </div>
  )
}
