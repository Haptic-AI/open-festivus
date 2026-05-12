import type {
  IFetchTasksResult,
  IMergedPR,
  ITask,
  TaskArea,
  TaskKind,
} from "./fetch-tasks"
import Link from "next/link"

import { FlowView } from "./flow-view"

export type TasksViewName = "flow" | "browse"

// ── Area metadata ─────────────────────────────────────────────────

interface IAreaMeta {
  name: string
  purpose: string
  invitation: string
  accent: string
  accentBg: string
  accentText: string
  accentBorder: string
}

const AREA_META: Record<TaskArea, IAreaMeta> = {
  robots: {
    name: "Robots",
    purpose: "Hardware records: URDFs, configs, BOMs, actuator specs.",
    invitation: "Catalog what the world's robots actually are.",
    accent: "#1d76db",
    accentBg: "bg-[#1d76db]/10",
    accentText: "text-[#1d76db]",
    accentBorder: "border-[#1d76db]/40",
  },
  policies: {
    name: "Policies",
    purpose: "Trained models: checkpoints, hyperparams, training details.",
    invitation: "Map which models exist and what they can do.",
    accent: "#5319e7",
    accentBg: "bg-[#5319e7]/10",
    accentText: "text-[#5319e7]",
    accentBorder: "border-[#5319e7]/40",
  },
  simulations: {
    name: "Simulations",
    purpose: "Sim environments, scenes, benchmark results.",
    invitation: "Run real experiments and submit the numbers.",
    accent: "#0e8a16",
    accentBg: "bg-[#0e8a16]/10",
    accentText: "text-[#0e8a16]",
    accentBorder: "border-[#0e8a16]/40",
  },
  datasets: {
    name: "Datasets",
    purpose: "Episode data: formats, provenance, completeness.",
    invitation: "Grow the training commons, dataset by dataset.",
    accent: "#d93f0b",
    accentBg: "bg-[#d93f0b]/10",
    accentText: "text-[#d93f0b]",
    accentBorder: "border-[#d93f0b]/40",
  },
  papers: {
    name: "Papers",
    purpose: "arxiv citations, abstracts, links to models and data.",
    invitation: "Connect the literature to the commons.",
    accent: "#a87408",
    accentBg: "bg-[#f9a826]/10",
    accentText: "text-[#a87408]",
    accentBorder: "border-[#f9a826]/40",
  },
  platform: {
    name: "Platform",
    purpose: "Festivus itself: UI, API, infra, agents, contribution flow.",
    invitation: "Build the commons that builds the commons.",
    accent: "#444444",
    accentBg: "bg-black/5",
    accentText: "text-black/70",
    accentBorder: "border-black/20",
  },
}

const AREA_ORDER: TaskArea[] = [
  "robots",
  "policies",
  "simulations",
  "datasets",
  "papers",
  "platform",
]

// ── Small chips and badges ─────────────────────────────────────────

function AreaBadge({ area }: { area: TaskArea | null }) {
  if (area === null) {
    return (
      <span className="border-blueprint-navy/20 text-blueprint-navy/60 rounded border px-2 py-0.5 text-[13px] font-bold uppercase tracking-wider">
        unlabeled
      </span>
    )
  }
  const meta = AREA_META[area]
  return (
    <span
      className={`${meta.accentBg} ${meta.accentText} ${meta.accentBorder} rounded border px-2 py-0.5 text-[13px] font-bold uppercase tracking-wider`}
    >
      {meta.name}
    </span>
  )
}

function KindChip({ kind }: { kind: TaskKind | null }) {
  if (kind === null) return null
  return (
    <span className="border-blueprint-navy/10 text-blueprint-navy/60 rounded border px-2 py-0.5 text-[14px]">
      {kind}
    </span>
  )
}

function MetaChip({ label }: { label: string }) {
  return (
    <span className="border-blueprint-navy/10 text-blueprint-navy/60 rounded border px-2 py-0.5 text-[14px]">
      {label}
    </span>
  )
}

// ── View switcher ─────────────────────────────────────────────────

function ViewSegment({
  label,
  active,
  href,
}: {
  label: string
  active: boolean
  href: string
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`${
        active
          ? "bg-blueprint-navy text-drafting-cream shadow-sm"
          : "text-blueprint-navy/60 hover:text-blueprint-navy"
      } rounded-full px-6 py-2 text-sm font-semibold uppercase tracking-wider transition-all`}
      href={href}
      scroll={false}
    >
      {label}
    </Link>
  )
}

function ViewSwitcher({ current }: { current: TasksViewName }) {
  return (
    <div className="mt-10 flex justify-center">
      <div
        aria-label="View"
        className="border-blueprint-navy/10 bg-blueprint-navy/5 inline-flex gap-1 rounded-full border p-1"
        role="tablist"
      >
        <ViewSegment active={current === "flow"} href="/contribute?view=flow" label="Flow" />
        <ViewSegment active={current === "browse"} href="/contribute" label="Browse" />
      </div>
    </div>
  )
}

// ── Area grid ──────────────────────────────────────────────────────

function AreaCard({
  area,
  openCount,
  active,
}: {
  area: TaskArea
  openCount: number
  active: boolean
}) {
  const meta = AREA_META[area]
  const isFocused = active
  return (
    <Link
      className={`group relative block rounded-lg border p-5 transition-all ${
        isFocused
          ? `${meta.accentBorder} ${meta.accentBg} ring-2 ring-offset-2`
          : "border-blueprint-navy/10 bg-white/50 hover:border-blueprint-navy/30 hover:bg-white"
      }`}
      href={isFocused ? "/contribute" : `/contribute?area=${area}`}
      scroll={false}
      style={isFocused ? { boxShadow: `0 0 0 2px ${meta.accent}40` } : undefined}
    >
      <div className="flex items-start justify-between">
        <h3 className={`text-lg font-bold tracking-tight ${meta.accentText}`}>{meta.name}</h3>
        <span
          className={`${meta.accentBg} ${meta.accentBorder} ${meta.accentText} rounded border px-2 py-0.5 font-mono text-[14px] font-semibold`}
        >
          {openCount} open
        </span>
      </div>
      <p className="text-blueprint-navy/70 mt-2 text-sm leading-snug">{meta.purpose}</p>
      <p className="text-blueprint-navy/50 mt-3 text-[15px] italic">{meta.invitation}</p>
      <p className={`${meta.accentText} mt-4 text-[15px] font-semibold uppercase tracking-wider`}>
        {isFocused ? "clear filter ←" : `view tasks →`}
      </p>
    </Link>
  )
}

function AreaGrid({
  counts,
  activeArea,
}: {
  counts: IFetchTasksResult["openCountsByArea"]
  activeArea: TaskArea | null
}) {
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {AREA_ORDER.map((area) => (
        <AreaCard
          active={activeArea === area}
          area={area}
          key={area}
          openCount={counts[area]}
        />
      ))}
    </div>
  )
}

// ── Task rows (table-like for density) ───────────────────────────

function buildPreviewHref(currentView: TasksViewName, currentArea: TaskArea | null, number: number): string {
  const params = new URLSearchParams()
  if (currentView === "flow") params.set("view", "flow")
  if (currentArea !== null) params.set("area", currentArea)
  params.set("preview", String(number))
  return `/contribute?${params.toString()}`
}

function TaskRow({
  task,
  viewName,
  areaFilter,
}: {
  task: ITask
  viewName: TasksViewName
  areaFilter: TaskArea | null
}) {
  const href = buildPreviewHref(viewName, areaFilter, task.number)
  return (
    <Link
      className="group border-blueprint-navy/5 hover:bg-white flex items-center gap-3 border-b px-3 py-2 transition-colors last:border-b-0"
      href={href}
      scroll={false}
    >
      <AreaBadge area={task.area} />
      <span className="text-blueprint-navy/40 font-mono text-[14px] tabular-nums">#{task.number}</span>
      <span className="text-blueprint-navy group-hover:underline min-w-0 flex-1 truncate text-sm font-medium">
        {task.title.replace(/^\[task\]\s*/, "")}
      </span>
      <div className="flex shrink-0 items-center gap-1.5">
        {task.kind !== null ? <KindChip kind={task.kind} /> : null}
        {task.needs !== null && task.needs !== "none" ? (
          <MetaChip label={`needs:${task.needs}`} />
        ) : null}
        {task.difficulty !== null ? <MetaChip label={task.difficulty} /> : null}
        {task.assignees.length > 0 ? (
          <MetaChip label={`@${task.assignees.join(" @")}`} />
        ) : null}
      </div>
    </Link>
  )
}

function MergedPRRow({ pr }: { pr: IMergedPR }) {
  return (
    <a
      className="group border-blueprint-navy/5 hover:bg-white flex items-center gap-3 border-b px-3 py-2 transition-colors last:border-b-0"
      href={pr.url}
      rel="noreferrer"
      target="_blank"
    >
      <AreaBadge area={pr.lane} />
      <span className="text-blueprint-navy/40 font-mono text-[14px] tabular-nums">#{pr.number}</span>
      <span className="text-blueprint-navy group-hover:underline min-w-0 flex-1 truncate text-sm font-medium">
        {pr.title}
      </span>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="text-blueprint-navy/50 text-[14px]">@{pr.author}</span>
        <span className="text-blueprint-navy/40 text-[14px]">{timeAgo(new Date(pr.mergedAt))}</span>
      </div>
    </a>
  )
}

function TaskTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-blueprint-navy/10 mt-4 overflow-hidden rounded-lg border bg-white/40">
      {children}
    </div>
  )
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

// ── Sections ───────────────────────────────────────────────────────

function Section({
  title,
  count,
  empty,
  children,
}: {
  title: string
  count: number
  empty: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-10">
      <div className="flex items-baseline gap-3">
        <h2 className="text-blueprint-navy text-lg font-semibold tracking-tight">{title}</h2>
        <span className="text-blueprint-navy/50 font-mono text-sm">{count}</span>
      </div>
      {count === 0 ? (
        <p className="text-blueprint-navy/50 mt-3 text-sm">{empty}</p>
      ) : (
        <TaskTable>{children}</TaskTable>
      )}
    </section>
  )
}

// ── Top-level view ────────────────────────────────────────────────

function ErrorState({ error, repoUrl }: { error: string; repoUrl: string }) {
  return (
    <div className="border-blueprint-navy/20 rounded-lg border bg-white/50 p-6">
      <h2 className="text-blueprint-navy text-lg font-semibold">Couldn&apos;t load tasks</h2>
      <p className="text-blueprint-navy/70 mt-2 text-sm">{error}</p>
      <p className="text-blueprint-navy/60 mt-4 text-sm">
        You can browse tasks directly on{" "}
        <a
          className="underline"
          href={`${repoUrl}/issues?q=is%3Aissue+is%3Aopen+label%3Atask`}
          rel="noreferrer"
          target="_blank"
        >
          GitHub
        </a>
        .
      </p>
    </div>
  )
}

function filterByArea<T extends { area: TaskArea | null }>(items: T[], area: TaskArea | null): T[] {
  if (area === null) return items
  return items.filter((i) => i.area === area)
}

function filterMergedByArea(items: IMergedPR[], area: TaskArea | null): IMergedPR[] {
  if (area === null) return items
  return items.filter((i) => i.lane === area)
}

export function TasksView(
  props: IFetchTasksResult & { areaFilter: TaskArea | null; viewName: TasksViewName },
) {
  const {
    open,
    inProgress,
    merged,
    openCountsByArea,
    error,
    repoUrl,
    newTaskUrl,
    areaFilter,
    viewName,
  } = props

  if (error !== null) {
    return <ErrorState error={error} repoUrl={repoUrl} />
  }

  const filteredOpen = filterByArea(open, areaFilter)
  const filteredInProgress = filterByArea(inProgress, areaFilter)
  const filteredMerged = filterMergedByArea(merged, areaFilter)
  const areaMeta = areaFilter !== null ? AREA_META[areaFilter] : null

  return (
    <>
      <div className="max-w-3xl">
        <p className="text-blueprint-navy/50 font-mono text-[14px] font-semibold uppercase tracking-[0.2em]">
          The firehose
        </p>
        <h1 className="text-blueprint-navy mt-2 font-mono text-4xl font-bold uppercase tracking-tight md:text-5xl">
          Contribute
        </h1>

        <div className="border-blueprint-navy/15 mt-8 border-l-4 pl-6">
          <p className="text-blueprint-navy text-2xl font-bold leading-tight tracking-tight md:text-3xl">
            Festivus is built for a world moving very fast.
          </p>
          <ol className="mt-6 space-y-4">
            <li className="flex items-baseline gap-5">
              <span className="text-blueprint-navy/40 shrink-0 font-mono text-base font-bold tabular-nums">
                01
              </span>
              <span className="text-blueprint-navy/80 text-base leading-relaxed md:text-lg">
                Constant firehose of data — new policies, new datasets, new robots.
              </span>
            </li>
            <li className="flex items-baseline gap-5">
              <span className="text-blueprint-navy/40 shrink-0 font-mono text-base font-bold tabular-nums">
                02
              </span>
              <span className="text-blueprint-navy/80 text-base leading-relaxed md:text-lg">
                Agents do most of the contribution on behalf of humans.
              </span>
            </li>
          </ol>
        </div>

        <p className="text-blueprint-navy/70 mt-10 text-base leading-relaxed">
          <span className="text-blueprint-navy font-semibold">Pick a task</span> to help
          the robotics ecosystem — no matter your field of interest or specialty.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="bg-safety-yellow text-blueprint-navy rounded px-4 py-2 text-sm font-bold hover:opacity-90"
            href="/contribute/new-compatibility"
          >
            + Add a Robot × Policy edge
          </Link>
          <a
            className="bg-blueprint-navy text-drafting-cream rounded px-4 py-2 text-sm font-semibold hover:opacity-90"
            href={newTaskUrl}
            rel="noreferrer"
            target="_blank"
          >
            + File a Bug / Feature
          </a>
          <a
            className="border-blueprint-navy/20 text-blueprint-navy rounded border px-4 py-2 text-sm hover:bg-white"
            href={`${repoUrl}/discussions`}
            rel="noreferrer"
            target="_blank"
          >
            Discuss on GitHub ↗
          </a>
        </div>
      </div>

      <ViewSwitcher current={viewName} />

      {viewName === "flow" ? (
        <div className="mt-8">
          <FlowView data={props} />
        </div>
      ) : (
        <>
          <div>
            <h2 className="text-blueprint-navy mt-8 text-xl font-semibold tracking-tight">
              Pick an area
            </h2>
            <p className="text-blueprint-navy/60 mt-2 text-sm">
              Each area is a community — click one to scope the task list below.
            </p>
            <AreaGrid activeArea={areaFilter} counts={openCountsByArea} />
          </div>
        </>
      )}

      {viewName === "browse" && areaMeta !== null ? (
        <div className={`${areaMeta.accentBg} ${areaMeta.accentBorder} mt-10 rounded-lg border p-4`}>
          <p className={`${areaMeta.accentText} text-sm font-semibold`}>
            Showing {areaMeta.name} tasks only
          </p>
          <p className="text-blueprint-navy/60 mt-1 text-sm">{areaMeta.invitation}</p>
        </div>
      ) : null}

      {viewName === "browse" ? (
        <>
          <div className="border-blueprint-navy/10 mt-10 rounded-lg border bg-white/50 p-5">
            <p className="text-blueprint-navy text-base font-bold leading-relaxed">
              The task page is a shopping list of records that need work.
            </p>
            <p className="text-blueprint-navy/80 mt-3 text-sm leading-relaxed">
              Each task names one record &mdash; a robot, a policy, or a Robot
              &times; Policy pair. Click a task, read what&apos;s wrong, then
              hit <strong className="text-blueprint-navy">Open the record</strong>.
              Every field on a record page has a{" "}
              <span className="bg-safety-yellow/40 rounded px-1 font-mono text-xs">suggest-edit</span>{" "}
              chip beside it. Type your fix, submit, done. Live in seconds. A
              moderator can revert if you got it wrong.
            </p>
            <p className="text-blueprint-navy/80 mt-3 text-sm leading-relaxed">
              That&apos;s the whole flow. No GitHub, no &ldquo;claim&rdquo; step.
              Editing is cheap and revertible, so two people fixing the same
              thing is fine &mdash; the second edit overrides the first, both
              are logged.
            </p>
            <p className="text-blueprint-navy/80 mt-3 text-sm leading-relaxed">
              For brand-new Robot &times; Policy pairs, use the{" "}
              <strong className="text-blueprint-navy">+ Add a Robot &times; Policy edge</strong>{" "}
              button at the top of this page instead.
            </p>
          </div>

          <Section
            count={filteredOpen.length}
            empty={
              areaFilter !== null
                ? `No open ${AREA_META[areaFilter].name} tasks right now. Be the first to file one.`
                : "No open tasks right now. Quiet days happen — check back, or file one."
            }
            title="Open"
          >
            {filteredOpen.map((task) => (
              <TaskRow areaFilter={areaFilter} key={task.number} task={task} viewName={viewName} />
            ))}
          </Section>

          <Section
            count={filteredInProgress.length}
            empty={
              areaFilter !== null
                ? `Nothing in progress in ${AREA_META[areaFilter].name}. When someone claims a task, it appears here.`
                : "Nothing in progress. When someone claims a task, it appears here."
            }
            title="In progress"
          >
            {filteredInProgress.map((task) => (
              <TaskRow areaFilter={areaFilter} key={task.number} task={task} viewName={viewName} />
            ))}
          </Section>

          <Section
            count={filteredMerged.length}
            empty={
              areaFilter !== null
                ? `No ${AREA_META[areaFilter].name} merges in the last 7 days.`
                : "No merges in the last 7 days."
            }
            title="Recently merged"
          >
            {filteredMerged.map((pr) => (
              <MergedPRRow key={pr.number} pr={pr} />
            ))}
          </Section>
        </>
      ) : null}
    </>
  )
}
