"use client"

import type { IBenchmarkResult, IRobotBenchmark } from "@festivus/types"
import { useRobotSelection } from "./robot-selection"

interface IBenchmarksSectionProps {
  benchmarks: IBenchmarkResult[]
  robotBenchmarks?: IRobotBenchmark[]
}

function SummaryCards({ robotBenchmarks }: { robotBenchmarks: IRobotBenchmark[] }) {
  const { toggleRobot } = useRobotSelection()
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {robotBenchmarks.map((rb) => {
        const best = rb.benchmarks.reduce(
          (max, b) => (b.successRate > max.successRate ? b : max),
          rb.benchmarks[0]!,
        )
        return (
          <button
            className="border-blueprint-navy/10 hover:border-blueprint-navy/30 cursor-pointer border p-4 text-left transition-colors"
            key={rb.robotSlug}
            onClick={() => toggleRobot(rb.robotSlug)}
            type="button"
          >
            <p className="text-blueprint-navy text-sm font-bold">{rb.robotName}</p>
            <p className="text-blueprint-navy mt-1 text-2xl font-bold">{best.successRate}%</p>
            <p className="text-blueprint-navy/70 mt-1 text-xs">
              {best.realOrSim} · {best.episodes.toLocaleString()} eps · {best.environment}
            </p>
          </button>
        )
      })}
    </div>
  )
}

function SingleRobotView({ rb }: { rb: IRobotBenchmark }) {
  return (
    <div className="space-y-6">
      {/* Performance by environment */}
      <div>
        <p className="text-blueprint-navy/70 mb-3 text-xs font-bold uppercase tracking-wider">
          Performance by environment
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-blueprint-navy/10 border-b">
                <th className="text-blueprint-navy/70 pb-2 pr-4 text-xs font-bold uppercase tracking-wider">Environment</th>
                <th className="text-blueprint-navy/70 pb-2 pr-4 text-xs font-bold uppercase tracking-wider">Success Rate</th>
                <th className="text-blueprint-navy/70 pb-2 pr-4 text-xs font-bold uppercase tracking-wider">Episodes</th>
                <th className="text-blueprint-navy/70 pb-2 text-xs font-bold uppercase tracking-wider">Real/Sim</th>
              </tr>
            </thead>
            <tbody>
              {rb.benchmarks.map((b, i) => (
                <tr className="border-blueprint-navy/5 border-b" key={i}>
                  <td className="text-blueprint-navy py-2 pr-4 text-sm">{b.environment}</td>
                  <td className="text-blueprint-navy py-2 pr-4 text-sm font-bold">{b.successRate}%</td>
                  <td className="text-blueprint-navy/70 py-2 pr-4 text-sm">{b.episodes.toLocaleString()}</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 text-xs font-bold ${b.realOrSim === "real" ? "bg-green-600/10 text-green-700" : "bg-blueprint-navy/5 text-blueprint-navy/70"}`}>
                      {b.realOrSim}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Performance by task */}
      {rb.taskResults.length > 0 ? (
        <div>
          <p className="text-blueprint-navy/70 mb-3 text-xs font-bold uppercase tracking-wider">
            Performance by task
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-blueprint-navy/10 border-b">
                  <th className="text-blueprint-navy/70 pb-2 pr-4 text-xs font-bold uppercase tracking-wider">Task</th>
                  <th className="text-blueprint-navy/70 pb-2 pr-4 text-xs font-bold uppercase tracking-wider">Success Rate</th>
                  <th className="text-blueprint-navy/70 pb-2 text-xs font-bold uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody>
                {rb.taskResults.map((t, i) => (
                  <tr className="border-blueprint-navy/5 border-b" key={i}>
                    <td className="text-blueprint-navy py-2 pr-4 text-sm">{t.task}</td>
                    <td className="text-blueprint-navy py-2 pr-4 text-sm font-bold">{t.successRate}%</td>
                    <td className="text-blueprint-navy/70 py-2 text-xs">{t.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Compared to alternatives */}
      {rb.alternatives !== undefined && rb.alternatives.length > 0 ? (
        <div>
          <p className="text-blueprint-navy/70 mb-3 text-xs font-bold uppercase tracking-wider">
            Compared to alternatives on {rb.robotName}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-blueprint-navy/10 border-b">
                  <th className="text-blueprint-navy/70 pb-2 pr-4 text-xs font-bold uppercase tracking-wider">Policy</th>
                  <th className="text-blueprint-navy/70 pb-2 pr-4 text-xs font-bold uppercase tracking-wider">Success</th>
                  <th className="text-blueprint-navy/70 pb-2 text-xs font-bold uppercase tracking-wider">Episodes</th>
                </tr>
              </thead>
              <tbody>
                {rb.alternatives.map((a, i) => (
                  <tr className="border-blueprint-navy/5 border-b" key={i}>
                    <td className="text-blueprint-navy py-2 pr-4 text-sm">{a.policyName}</td>
                    <td className="text-blueprint-navy py-2 pr-4 text-sm font-bold">{a.successRate}%</td>
                    <td className="text-blueprint-navy/70 py-2 text-sm">{a.episodes.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Failure modes */}
      {rb.failureModes.length > 0 ? (
        <div>
          <p className="text-blueprint-navy/70 mb-3 text-xs font-bold uppercase tracking-wider">
            Failure modes on {rb.robotName}
          </p>
          <div className="space-y-1">
            {rb.failureModes.map((f, i) => (
              <p className="text-blueprint-navy/70 text-sm" key={i}>· {f}</p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ComparisonView({ robots }: { robots: IRobotBenchmark[] }) {
  const shown = robots.slice(0, 3)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-blueprint-navy/10 border-b">
            <th className="text-blueprint-navy/70 pb-2 pr-4 text-xs font-bold uppercase tracking-wider">Metric</th>
            {shown.map((rb) => (
              <th className="text-blueprint-navy pb-2 pr-4 text-xs font-bold uppercase tracking-wider" key={rb.robotSlug}>
                {rb.robotName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-blueprint-navy/5 border-b">
            <td className="text-blueprint-navy/70 py-2 pr-4 text-sm">Best success rate</td>
            {shown.map((rb) => {
              const best = rb.benchmarks.reduce((max, b) => (b.successRate > max.successRate ? b : max), rb.benchmarks[0]!)
              return (
                <td className="text-blueprint-navy py-2 pr-4 text-sm font-bold" key={rb.robotSlug}>
                  {best.successRate}%
                </td>
              )
            })}
          </tr>
          <tr className="border-blueprint-navy/5 border-b">
            <td className="text-blueprint-navy/70 py-2 pr-4 text-sm">Total episodes</td>
            {shown.map((rb) => (
              <td className="text-blueprint-navy py-2 pr-4 text-sm" key={rb.robotSlug}>
                {rb.benchmarks.reduce((sum, b) => sum + b.episodes, 0).toLocaleString()}
              </td>
            ))}
          </tr>
          <tr className="border-blueprint-navy/5 border-b">
            <td className="text-blueprint-navy/70 py-2 pr-4 text-sm">Tasks tested</td>
            {shown.map((rb) => (
              <td className="text-blueprint-navy py-2 pr-4 text-sm" key={rb.robotSlug}>
                {rb.taskResults.length}
              </td>
            ))}
          </tr>
          <tr className="border-blueprint-navy/5 border-b">
            <td className="text-blueprint-navy/70 py-2 pr-4 text-sm">Known failure modes</td>
            {shown.map((rb) => (
              <td className="text-blueprint-navy py-2 pr-4 text-sm" key={rb.robotSlug}>
                {rb.failureModes.length}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export function BenchmarksSection({ benchmarks, robotBenchmarks }: IBenchmarksSectionProps) {
  const { selectedSlugs } = useRobotSelection()

  const hasRobotBenchmarks = robotBenchmarks !== undefined && robotBenchmarks.length > 0
  const selectedRobots = hasRobotBenchmarks
    ? robotBenchmarks.filter((rb) => selectedSlugs.has(rb.robotSlug))
    : []

  if (benchmarks.length === 0 && !hasRobotBenchmarks) return null

  return (
    <section className="mb-6">
      <details className="group">
        <summary className="border-blueprint-navy/10 cursor-pointer list-none border p-6 [&::-webkit-details-marker]:hidden">
          <div className="flex items-center justify-between">
            <h2 className="text-blueprint-navy text-xl font-bold uppercase tracking-tight md:text-2xl">
              Benchmarks
            </h2>
            <svg className="text-blueprint-navy/60 h-5 w-5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
            </svg>
          </div>
        </summary>
        <div className="border-blueprint-navy/10 border-x border-b p-6">
          {hasRobotBenchmarks ? (
            <>
              {/* State 3: Multiple robots selected */}
              {selectedRobots.length > 1 ? (
                <ComparisonView robots={selectedRobots} />
              ) : selectedRobots.length === 1 ? (
                /* State 2: One robot selected */
                <SingleRobotView rb={selectedRobots[0]!} />
              ) : (
                /* State 1: No selection — summary cards */
                <SummaryCards robotBenchmarks={robotBenchmarks} />
              )}
            </>
          ) : (
            /* Fallback: flat benchmarks (no per-robot data) */
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {benchmarks.map((b, i) => (
                <div className="border-blueprint-navy/10 border p-4" key={i}>
                  <p className="text-blueprint-navy/70 mb-1 text-xs font-bold uppercase tracking-wider">{b.metric}</p>
                  <p className="text-blueprint-navy text-2xl font-bold">{b.value}{b.unit}</p>
                  <p className="text-cold-gray mt-1 text-xs uppercase">
                    {b.environment}{b.details !== undefined ? ` — ${b.details}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </details>
    </section>
  )
}
