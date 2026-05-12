"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import type { IPolicyEntry, IRobotEntry, ITaskEntry as ITask } from "@/data/seed/types"
import { useAgentChatDrawer } from "@/lib/agent-chat/drawer-context"

type AxisMode = "robots-policies" | "robots-tasks"

const POLICY_SAMPLE_SIZE = 8
const TASK_SAMPLE_SIZE = 8

interface ICoverageMatrixProps {
  robots: IRobotEntry[]
  policies: IPolicyEntry[]
  tasks?: ITask[]
  combinations: number
}

export function CoverageMatrix({ robots, policies, tasks = [], combinations }: ICoverageMatrixProps) {
  const [axis, setAxis] = useState<AxisMode>("robots-policies")
  const { openDrawer } = useAgentChatDrawer()

  const samplePolicies = useMemo(() => {
    const popularity = new Map<string, number>()
    for (const r of robots) {
      for (const slug of r.compatible_policy_slugs) {
        popularity.set(slug, (popularity.get(slug) ?? 0) + 1)
      }
    }
    return [...policies]
      .sort(
        (a, b) =>
          (popularity.get(b.slug) ?? 0) - (popularity.get(a.slug) ?? 0),
      )
      .slice(0, POLICY_SAMPLE_SIZE)
  }, [policies, robots])

  const sampleTasks = useMemo(() => tasks.slice(0, TASK_SAMPLE_SIZE), [tasks])

  const filledCount = useMemo(() => {
    if (axis === "robots-policies") {
      let n = 0
      for (const r of robots) {
        for (const slug of r.compatible_policy_slugs) {
          if (samplePolicies.some((p) => p.slug === slug)) n += 1
        }
      }
      return n
    }
    let n = 0
    for (const r of robots) {
      for (const task of sampleTasks) {
        if (task.compatible_robot_types.includes(r.type as typeof task.compatible_robot_types[number])) n += 1
      }
    }
    return n
  }, [axis, robots, samplePolicies, sampleTasks])

  const totalCount =
    axis === "robots-policies"
      ? robots.length * samplePolicies.length
      : robots.length * sampleTasks.length

  return (
    <section className="mb-14">
      <SubSectionHeading
        description="Aggregate totals across the full seed — no sampling, no filter."
        title="Global Coverage"
      />
      <div className="mb-12 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatPill
          label="Total combinations"
          sub="robots × policies × tasks × environments"
          value={combinations.toLocaleString()}
        />
        <StatPill
          label="Cells filled on this axis"
          sub={axis === "robots-policies" ? "robot × policy pairs" : "robot × task pairs"}
          value={`${filledCount} / ${totalCount}`}
        />
        <StatPill
          label="Covered"
          sub={`${filledCount} filled of ${totalCount}`}
          value={`${totalCount > 0 ? ((filledCount / totalCount) * 100).toFixed(1) : "0.0"}%`}
        />
      </div>

      <SubSectionHeading
        description="A grid of most popular pairs of (robot, policies), (robots, tasks) to give a sense of what data is available and what opportunities there are for contributing."
        title="Sample Combinations"
      />

      <div className="mb-4 flex flex-wrap items-center justify-end gap-2 font-mono text-xs font-bold uppercase tracking-wider">
        <AxisToggle active={axis === "robots-policies"} label="robots × policies" onClick={() => { setAxis("robots-policies") }} />
        <AxisToggle active={axis === "robots-tasks"} label="robots × tasks" onClick={() => { setAxis("robots-tasks") }} />
      </div>

      <div className="border-blueprint-navy/10 bg-white overflow-x-auto rounded-lg border">
        {axis === "robots-policies" ? (
          <RobotsPoliciesGrid openDrawer={openDrawer} policies={samplePolicies} robots={robots} />
        ) : (
          <RobotsTasksGrid openDrawer={openDrawer} policies={policies} robots={robots} tasks={sampleTasks} />
        )}
      </div>

      <p className="text-blueprint-navy/60 mt-3 font-mono text-[14px]">
        {axis === "robots-policies" ? (
          <>
            Showing top {samplePolicies.length} of {policies.length} policies
            (ranked by robot coverage).{" "}
            <Link
              className="text-blueprint-navy hover:text-annotation-red font-semibold underline underline-offset-2"
              href="/data/policies"
            >
              See all policies →
            </Link>
          </>
        ) : (
          <>
            Showing top {sampleTasks.length} of {tasks.length} tasks.{" "}
            <Link
              className="text-blueprint-navy hover:text-annotation-red font-semibold underline underline-offset-2"
              href="/data/tasks"
            >
              See all tasks →
            </Link>
          </>
        )}
      </p>

    </section>
  )
}

function SubSectionHeading({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <header className="mb-5">
      <h3 className="text-blueprint-navy text-lg font-bold uppercase tracking-tight md:text-xl">
        {title}
      </h3>
      {description !== undefined ? (
        <p className="text-blueprint-navy/60 mt-1 max-w-3xl text-sm leading-relaxed">
          {description}
        </p>
      ) : null}
    </header>
  )
}

function StatPill({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="border-blueprint-navy/10 bg-white rounded-lg border px-5 py-4">
      <p className="text-blueprint-navy/60 font-mono text-[14px] font-bold uppercase tracking-[0.15em]">
        {label}
      </p>
      <p className="text-blueprint-navy mt-2 text-2xl font-bold tabular-nums md:text-3xl">
        {value}
      </p>
      {sub !== undefined ? (
        <p className="text-blueprint-navy/50 mt-1 font-mono text-[13px]">
          {sub}
        </p>
      ) : null}
    </div>
  )
}

function AxisToggle({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={
        active
          ? "bg-blueprint-navy text-safety-yellow rounded px-3 py-1.5"
          : "border-blueprint-navy/20 text-blueprint-navy/70 hover:border-blueprint-navy hover:text-blueprint-navy rounded border px-3 py-1.5"
      }
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  )
}

interface IGridCommonProps {
  robots: IRobotEntry[]
  policies: IPolicyEntry[]
  openDrawer: ReturnType<typeof useAgentChatDrawer>["openDrawer"]
}

function RobotsPoliciesGrid({ robots, policies, openDrawer }: IGridCommonProps) {
  return (
    <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
      <colgroup>
        <col style={{ width: "200px" }} />
        {policies.map((p) => (
          <col key={p.slug} style={{ width: "128px" }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          <th className="border-blueprint-navy/10 bg-drafting-cream sticky left-0 z-10 border-b border-r px-3 py-3 text-left align-bottom font-mono text-[13px] font-bold uppercase tracking-wider">
            Robot
          </th>
          {policies.map((p) => (
            <th
              className="border-blueprint-navy/10 bg-drafting-cream border-b border-r px-2 py-3 align-bottom"
              key={p.slug}
            >
              <Link
                className="text-blueprint-navy/80 hover:text-blueprint-navy block text-center font-mono text-[14px] font-medium leading-tight"
                href={`/data/policies/${p.slug}`}
                title={p.name}
              >
                <span className="line-clamp-2">{p.name}</span>
              </Link>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {robots.map((r) => (
          <tr key={r.slug}>
            <th className="border-blueprint-navy/10 bg-drafting-cream sticky left-0 z-10 border-b border-r px-3 py-2 text-left">
              <Link
                className="text-blueprint-navy hover:text-annotation-red block truncate text-sm font-semibold"
                href={`/data/robots/${r.slug}`}
                title={r.name}
              >
                {r.name}
              </Link>
              <p
                className="text-blueprint-navy/50 mt-0.5 truncate font-mono text-[13px]"
                title={r.manufacturer}
              >
                {r.manufacturer}
              </p>
            </th>
            {policies.map((p) => {
              const filled = r.compatible_policy_slugs.includes(p.slug)
              return (
                <td
                  className="border-blueprint-navy/10 h-10 border-b border-r p-0"
                  key={`${r.slug}-${p.slug}`}
                >
                  <MatrixCell
                    filled={filled}
                    href={filled ? `/data/compatibility/${r.slug}__${p.slug}` : undefined}
                    onClick={() => {
                      if (filled) return
                      openDrawer({
                        table: "robots",
                        slug: r.slug,
                        recordName: r.name,
                      })
                    }}
                    title={`${r.name} × ${p.name}`}
                  />
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function RobotsTasksGrid({ robots, tasks, openDrawer }: IGridCommonProps & { tasks: ITask[] }) {
  return (
    <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
      <colgroup>
        <col style={{ width: "200px" }} />
        {tasks.map((t) => (
          <col key={t.slug} style={{ width: "128px" }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          <th className="border-blueprint-navy/10 bg-drafting-cream sticky left-0 z-10 border-b border-r px-3 py-3 text-left align-bottom font-mono text-[13px] font-bold uppercase tracking-wider">
            Robot
          </th>
          {tasks.map((t) => (
            <th
              className="border-blueprint-navy/10 bg-drafting-cream border-b border-r px-2 py-3 align-bottom"
              key={t.slug}
            >
              <Link
                className="text-blueprint-navy/80 hover:text-blueprint-navy block text-center font-mono text-[14px] font-medium leading-tight"
                href={`/data/tasks/${t.slug}`}
                title={t.name}
              >
                <span className="line-clamp-2">{t.name}</span>
              </Link>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {robots.map((r) => (
          <tr key={r.slug}>
            <th className="border-blueprint-navy/10 bg-drafting-cream sticky left-0 z-10 border-b border-r px-3 py-2 text-left">
              <Link
                className="text-blueprint-navy hover:text-annotation-red block truncate text-sm font-semibold"
                href={`/data/robots/${r.slug}`}
                title={r.name}
              >
                {r.name}
              </Link>
              <p
                className="text-blueprint-navy/50 mt-0.5 truncate font-mono text-[13px]"
                title={r.manufacturer}
              >
                {r.manufacturer}
              </p>
            </th>
            {tasks.map((t) => {
              const filled = t.compatible_robot_types.includes(r.type as typeof t.compatible_robot_types[number])
              return (
                <td className="border-blueprint-navy/10 h-10 border-b border-r p-0" key={`${r.slug}-${t.slug}`}>
                  <MatrixCell
                    filled={filled}
                    href={filled ? `/data/tasks/${t.slug}` : undefined}
                    onClick={() => {
                      if (filled) return
                      openDrawer({
                        table: "robots",
                        slug: r.slug,
                        recordName: r.name,
                      })
                    }}
                    title={`${r.name} × ${t.name}`}
                  />
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

interface IMatrixCellProps {
  filled: boolean
  title: string
  onClick: () => void
  href?: string
}

function MatrixCell({ filled, title, onClick, href }: IMatrixCellProps) {
  if (filled) {
    if (href !== undefined) {
      return (
        <Link
          aria-label={`${title} — covered, click for details`}
          className="bg-blueprint-navy/90 hover:bg-annotation-red block h-8 w-full transition-colors"
          href={href}
          title={`${title} — covered, click for details`}
        />
      )
    }
    return (
      <div
        aria-label={`${title} — covered`}
        className="bg-blueprint-navy/90 h-8 w-full"
        title={`${title} — covered`}
      />
    )
  }
  return (
    <button
      aria-label={`${title} — empty, click to flag`}
      className="hover:bg-annotation-red/20 h-8 w-full cursor-pointer bg-transparent transition-colors"
      onClick={onClick}
      title={`${title} — empty cell, click to flag`}
      type="button"
    >
      <span className="sr-only">Flag gap</span>
    </button>
  )
}
