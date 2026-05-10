"use client"

/**
 * Client-side live ticker.
 *
 * Starts from the server-provided events and simulates a firehose:
 * every random 15-55 seconds, prepend a synthetic event generated
 * from a pool of real tasks and a pool of real contributor names.
 *
 * This is a UI-iteration approximation — when the contribution flow
 * is real, replace the interval with a websocket / SSE subscription
 * and drop the synthetic event generation.
 */

import { useEffect, useState } from "react"
import type { TaskArea } from "./fetch-tasks-types"
import { AREA_STYLES, timeAgo } from "./area-meta"

export type TickerEventKind = "filed" | "claimed" | "merged"

export interface ITickerEvent {
  kind: TickerEventKind
  at: string
  number: number
  area: TaskArea | null
  title: string
  actor: string | null
  url: string
  /** true when inserted client-side by the live timer (drives fade-in). */
  fresh?: boolean
}

export interface ITickerPoolTask {
  number: number
  title: string
  area: TaskArea | null
  url: string
}

const MAX_VISIBLE = 30
const MIN_INTERVAL_MS = 15_000
const MAX_INTERVAL_MS = 55_000

// Weighted kind distribution — merged most common, filed least
const KIND_POOL: TickerEventKind[] = [
  "merged", "merged", "merged",
  "claimed", "claimed",
  "filed",
]

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T
}

function randomIntervalMs(): number {
  return MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS)
}

function synthEvent(
  taskPool: ITickerPoolTask[],
  authorPool: string[],
  nonce: number,
): ITickerEvent {
  const task = pickRandom(taskPool)
  const kind = pickRandom(KIND_POOL)
  const actor = kind === "filed" ? null : pickRandom(authorPool)
  return {
    kind,
    at: new Date().toISOString(),
    number: task.number + 100_000 + nonce,
    area: task.area,
    title: task.title,
    actor,
    url: task.url,
    fresh: true,
  }
}

// ── UI atoms ──────────────────────────────────────────────────────

function EventKindBadge({ kind }: { kind: TickerEventKind }) {
  const styles: Record<TickerEventKind, string> = {
    filed: "text-[#0e8a16]",
    claimed: "text-[#1d76db]",
    merged: "text-[#5319e7]",
  }
  return (
    <span className={`${styles[kind]} font-mono text-[14px] font-semibold uppercase tracking-wider`}>
      {kind}
    </span>
  )
}

function AreaChip({ area }: { area: TaskArea | null }) {
  if (area === null) {
    return (
      <span className="border-blueprint-navy/20 text-blueprint-navy/60 rounded border px-1.5 py-0.5 text-[13px] font-bold uppercase">
        —
      </span>
    )
  }
  const style = AREA_STYLES[area]
  return (
    <span
      className={`${style.bg} ${style.text} ${style.border} rounded border px-1.5 py-0.5 text-[13px] font-bold uppercase tracking-wider`}
    >
      {style.name}
    </span>
  )
}

function TickerRow({ event }: { event: ITickerEvent }) {
  return (
    <a
      className={`group border-blueprint-navy/5 hover:bg-white flex items-center gap-3 border-b px-4 py-2 transition-all duration-300 last:border-b-0 ${
        event.fresh === true ? "bg-[#fffbea]" : ""
      }`}
      href={event.url}
      rel="noreferrer"
      target="_blank"
    >
      <span className="text-blueprint-navy/40 w-20 shrink-0 font-mono text-[14px] tabular-nums">
        {timeAgo(new Date(event.at))}
      </span>
      <EventKindBadge kind={event.kind} />
      <span className="text-blueprint-navy/40 font-mono text-[14px] tabular-nums">
        #{event.number}
      </span>
      <AreaChip area={event.area} />
      <span className="text-blueprint-navy group-hover:underline min-w-0 flex-1 truncate text-sm">
        {event.title.replace(/^\[task\]\s*/, "")}
      </span>
      {event.actor !== null ? (
        <span className="text-blueprint-navy/50 shrink-0 text-[14px]">@{event.actor}</span>
      ) : null}
    </a>
  )
}

// ── Top-level LiveTicker ──────────────────────────────────────────

export function LiveTicker({
  initialEvents,
  taskPool,
  authorPool,
}: {
  initialEvents: ITickerEvent[]
  taskPool: ITickerPoolTask[]
  authorPool: string[]
}) {
  const [events, setEvents] = useState<ITickerEvent[]>(() =>
    initialEvents.slice(0, MAX_VISIBLE),
  )
  const [, forceRerender] = useState(0)

  // Synthetic event insertion on a random 15-55s cadence.
  useEffect(() => {
    if (taskPool.length === 0) return
    let cancelled = false
    let nonce = 0

    const schedule = () => {
      if (cancelled) return
      const delay = randomIntervalMs()
      const timer = setTimeout(() => {
        if (cancelled) return
        nonce += 1
        const fresh = synthEvent(taskPool, authorPool, nonce)
        setEvents((prev) => {
          // Clear 'fresh' on older events so the highlight only sits on the newest.
          const stale = prev.map((e) => ({ ...e, fresh: false }))
          return [fresh, ...stale].slice(0, MAX_VISIBLE)
        })
        schedule()
      }, delay)
      return timer
    }

    schedule()
    return () => {
      cancelled = true
    }
  }, [taskPool, authorPool])

  // Re-render every 30s so time-ago labels tick forward naturally.
  useEffect(() => {
    const t = setInterval(() => forceRerender((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="border-blueprint-navy/10 bg-white/40 overflow-hidden rounded-lg border">
      <div className="border-blueprint-navy/10 flex items-center justify-between border-b px-4 py-2">
        <span className="text-blueprint-navy/60 font-mono text-[14px] uppercase tracking-wider">
          live · recent activity
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#0e8a16]" />
          <span className="text-blueprint-navy/50 text-[14px]">live</span>
        </span>
      </div>
      <div>
        {events.map((event, idx) => (
          <TickerRow event={event} key={`${event.kind}-${event.number}-${event.at}-${idx}`} />
        ))}
      </div>
    </div>
  )
}
