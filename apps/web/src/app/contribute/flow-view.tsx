import Link from "next/link"
import type {
  IFetchTasksResult,
  IMergedPR,
  ITask,
  TaskArea,
} from "./fetch-tasks-types"
import { AREAS } from "./fetch-tasks-types"
import { AREA_STYLES } from "./area-meta"
import { LiveTicker, type ITickerEvent, type ITickerPoolTask } from "./live-ticker"

// ── Helpers ────────────────────────────────────────────────────────

function buildActivityStream(
  open: ITask[],
  inProgress: ITask[],
  merged: IMergedPR[],
): ITickerEvent[] {
  const events: ITickerEvent[] = []
  for (const t of open) {
    events.push({
      kind: "filed",
      at: t.createdAt,
      number: t.number,
      area: t.area,
      title: t.title,
      actor: null,
      url: t.url,
    })
  }
  for (const t of inProgress) {
    events.push({
      kind: "claimed",
      at: t.createdAt,
      number: t.number,
      area: t.area,
      title: t.title,
      actor: t.assignees[0] ?? null,
      url: t.url,
    })
  }
  for (const m of merged) {
    events.push({
      kind: "merged",
      at: m.mergedAt,
      number: m.number,
      area: m.lane,
      title: m.title,
      actor: m.author,
      url: m.url,
    })
  }
  events.sort((a, b) => (a.at > b.at ? -1 : 1))
  return events
}

function buildTaskPool(open: ITask[], inProgress: ITask[]): ITickerPoolTask[] {
  return [...open, ...inProgress].map((t) => ({
    number: t.number,
    title: t.title,
    area: t.area,
    url: t.url,
  }))
}

function buildAuthorPool(inProgress: ITask[], merged: IMergedPR[]): string[] {
  const set = new Set<string>()
  for (const t of inProgress) for (const a of t.assignees) set.add(a)
  for (const m of merged) set.add(m.author)
  return [...set]
}

function countEventsByArea(events: ITickerEvent[], withinMs: number): Record<TaskArea, number> {
  const now = Date.now()
  const counts: Record<TaskArea, number> = { robots: 0, policies: 0, simulations: 0, datasets: 0, papers: 0, platform: 0 }
  for (const ev of events) {
    if (ev.area === null) continue
    const t = Date.parse(ev.at)
    if (isNaN(t) || now - t > withinMs) continue
    counts[ev.area] += 1
  }
  return counts
}

// ── Area activity bars ─────────────────────────────────────────────

function AreaBars({ counts }: { counts: Record<TaskArea, number> }) {
  const maxCount = Math.max(1, ...AREAS.map((a) => counts[a]))
  const orderedByActivity: TaskArea[] = [...AREAS].sort((a, b) => counts[b] - counts[a])
  return (
    <div className="border-blueprint-navy/10 bg-white/40 rounded-lg border p-4">
      <div className="text-blueprint-navy/60 font-mono text-[14px] uppercase tracking-wider">
        area activity · last 24h
      </div>
      <div className="mt-4 space-y-2.5">
        {orderedByActivity.map((area) => {
          const style = AREA_STYLES[area]
          const count = counts[area]
          const pct = Math.max(1, Math.round((count / maxCount) * 100))
          return (
            <Link
              className="group flex items-center gap-3 hover:bg-white/60 -mx-2 rounded px-2 py-1 transition-colors"
              href={`/contribute?view=browse&area=${area}`}
              key={area}
            >
              <span
                className={`${style.text} w-16 shrink-0 text-xs font-bold uppercase tracking-wider`}
              >
                {style.name}
              </span>
              <div className="flex-1">
                <div
                  className={`${style.bg} h-4 rounded-sm`}
                  style={{ width: `${pct}%` }}
                  title={`${count} events`}
                />
              </div>
              <span className="text-blueprint-navy/70 w-16 text-right font-mono text-xs tabular-nums">
                {count} {count === 1 ? "event" : "events"}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ── Today totals ───────────────────────────────────────────────────

function TodayTotals({ data }: { data: IFetchTasksResult }) {
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000

  // Bucket-style: each item counted once, in its current bucket.
  // filed = still open, created today.
  // claimed = in progress, created today.
  // merged = merged PR, merged today.
  // These three sum to the total events in the last 24h — matches AreaBars.
  const filedToday = data.open.filter((t) => now - Date.parse(t.createdAt) <= day).length
  const claimedToday = data.inProgress.filter(
    (t) => now - Date.parse(t.createdAt) <= day,
  ).length
  const mergedToday = data.merged.filter(
    (m) => now - Date.parse(m.mergedAt) <= day,
  ).length

  const contributorSet = new Set<string>()
  for (const m of data.merged) {
    if (now - Date.parse(m.mergedAt) <= day) contributorSet.add(m.author)
  }
  for (const t of data.inProgress) {
    if (now - Date.parse(t.createdAt) <= day) for (const a of t.assignees) contributorSet.add(a)
  }

  const Stat = ({ label, value }: { label: string; value: number | string }) => (
    <div className="text-center">
      <div className="text-blueprint-navy font-mono text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-blueprint-navy/50 mt-1 text-[14px] uppercase tracking-wider">
        {label}
      </div>
    </div>
  )

  return (
    <div className="border-blueprint-navy/10 bg-white/40 grid grid-cols-2 gap-6 rounded-lg border p-6 sm:grid-cols-4">
      <Stat label="filed today" value={filedToday} />
      <Stat label="claimed today" value={claimedToday} />
      <Stat label="merged today" value={mergedToday} />
      <Stat label="active contributors" value={contributorSet.size} />
    </div>
  )
}

// ── Top-level FlowView ─────────────────────────────────────────────

export function FlowView({ data }: { data: IFetchTasksResult }) {
  const events = buildActivityStream(data.open, data.inProgress, data.merged)
  const areaCounts = countEventsByArea(events, 24 * 60 * 60 * 1000)
  const taskPool = buildTaskPool(data.open, data.inProgress)
  const authorPool = buildAuthorPool(data.inProgress, data.merged)

  return (
    <div className="space-y-6">
      <TodayTotals data={data} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <AreaBars counts={areaCounts} />
        <LiveTicker
          authorPool={authorPool}
          initialEvents={events}
          taskPool={taskPool}
        />
      </div>
    </div>
  )
}
