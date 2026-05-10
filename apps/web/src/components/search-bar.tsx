"use client"

import Link from "next/link"
import { useEffect, useId, useMemo, useRef, useState } from "react"

interface ISearchHit {
  table: string
  slug: string
  data: Record<string, unknown>
}

interface ISearchResponse {
  count: number
  results: ISearchHit[]
}

interface ISearchBarProps {
  variant?: "light" | "dark"
}

const TABLE_LABELS: Record<string, string> = {
  robots: "Robot",
  policies: "Policy",
  datasets: "Dataset",
  benchmarks: "Benchmark",
  tasks: "Task",
  papers: "Paper",
  hardware: "Hardware",
  laundry_compat_edges: "Laundry compat",
}

/** Pluralized labels used in the filter pills. */
const FILTER_LABELS: { table: string; label: string }[] = [
  { table: "robots", label: "Robots" },
  { table: "policies", label: "Policies" },
  { table: "datasets", label: "Datasets" },
  { table: "benchmarks", label: "Benchmarks" },
  { table: "tasks", label: "Tasks" },
  { table: "papers", label: "Papers" },
]

const TABLE_PATHS: Record<string, string> = {
  robots: "/data/robots",
  policies: "/data/policies",
  datasets: "/data/datasets",
  benchmarks: "/data/benchmarks",
  tasks: "/data/tasks",
  papers: "/data/papers",
  hardware: "/data/hardware",
  laundry_compat_edges: "/data/compatibility",
}

function hitTitle(hit: ISearchHit): string {
  const data = hit.data
  const name = typeof data["name"] === "string" ? (data["name"] as string) : null
  const title = typeof data["title"] === "string" ? (data["title"] as string) : null
  return name ?? title ?? hit.slug
}

function hitHref(hit: ISearchHit): string {
  const base = TABLE_PATHS[hit.table] ?? "/data"
  return `${base}/${hit.slug}`
}

function hitSummary(hit: ISearchHit): string | null {
  const data = hit.data
  const summary =
    typeof data["summary"] === "string" ? (data["summary"] as string) : null
  const description =
    typeof data["description"] === "string" ? (data["description"] as string) : null
  const out = summary ?? description
  if (!out) return null
  return out.length > 120 ? `${out.slice(0, 120)}…` : out
}

/**
 * Header search bar. Debounced 250ms type-ahead; results render in a
 * floating panel below the input. Hits the same-origin /api/search proxy
 * which forwards to the dataset API's /v1/search (Typesense-backed when
 * configured).
 */
export function SearchBar({ variant = "light" }: ISearchBarProps) {
  const [q, setQ] = useState("")
  const [results, setResults] = useState<ISearchHit[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  // Empty set means "every searchable table" — same default the API uses.
  const [activeTables, setActiveTables] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)
  const inputId = useId()

  // Stable string used by the fetch effect so toggling pills re-runs the
  // query without burning a new effect on every set-state.
  const tablesParam = useMemo(
    () => Array.from(activeTables).sort().join(","),
    [activeTables],
  )

  // Debounced fetch. Cancels in-flight requests on rapid typing so the
  // displayed result set always corresponds to the latest input value.
  useEffect(() => {
    const trimmed = q.trim()
    if (trimmed.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    const ac = new AbortController()
    const timer = setTimeout(async () => {
      try {
        setLoading(true)
        const url =
          `/api/search?q=${encodeURIComponent(trimmed)}&limit=8` +
          (tablesParam ? `&tables=${encodeURIComponent(tablesParam)}` : "")
        const res = await fetch(url, { signal: ac.signal })
        if (!res.ok) {
          setResults([])
          return
        }
        const body = (await res.json()) as ISearchResponse
        setResults(body.results)
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => {
      ac.abort()
      clearTimeout(timer)
    }
  }, [q, tablesParam])

  function toggleTable(table: string) {
    setActiveTables((prev) => {
      const next = new Set(prev)
      if (next.has(table)) next.delete(table)
      else next.add(table)
      return next
    })
  }

  // Close on outside click / escape.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [])

  const inputBg =
    variant === "dark"
      ? "bg-drafting-cream/10 text-drafting-cream placeholder:text-drafting-cream/50 focus:bg-drafting-cream/15"
      : "bg-blueprint-navy/5 text-blueprint-navy placeholder:text-blueprint-navy/50 focus:bg-blueprint-navy/10"
  const borderColor =
    variant === "dark" ? "border-drafting-cream/15" : "border-blueprint-navy/10"

  const showPanel = open && q.trim().length >= 2

  return (
    <div className="relative w-full max-w-md" ref={containerRef}>
      <label className="sr-only" htmlFor={inputId}>
        Search
      </label>
      <input
        autoComplete="off"
        className={`${inputBg} ${borderColor} w-full rounded border px-3 py-1.5 font-mono text-xs tracking-[0.05em] outline-none transition-colors`}
        id={inputId}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search robots, policies, papers…"
        type="search"
        value={q}
      />
      {showPanel ? (
        <div className="bg-drafting-cream border-blueprint-navy/15 absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-[60vh] overflow-y-auto rounded border shadow-lg">
          <div className="border-blueprint-navy/10 flex flex-wrap gap-1 border-b px-2 py-2">
            {FILTER_LABELS.map(({ table, label }) => {
              const active = activeTables.has(table)
              return (
                <button
                  className={
                    active
                      ? "bg-blueprint-navy text-safety-yellow rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider"
                      : "bg-blueprint-navy/5 text-blueprint-navy/60 hover:bg-blueprint-navy/10 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors"
                  }
                  key={table}
                  onClick={(e) => {
                    e.preventDefault()
                    toggleTable(table)
                  }}
                  type="button"
                >
                  {label}
                </button>
              )
            })}
            {activeTables.size > 0 ? (
              <button
                className="text-blueprint-navy/40 hover:text-blueprint-navy ml-auto font-mono text-[10px] font-bold uppercase tracking-wider transition-colors"
                onClick={(e) => {
                  e.preventDefault()
                  setActiveTables(new Set())
                }}
                type="button"
              >
                Clear
              </button>
            ) : null}
          </div>
          {loading && results.length === 0 ? (
            <div className="text-blueprint-navy/60 px-3 py-2 font-mono text-xs">
              Searching…
            </div>
          ) : results.length === 0 ? (
            <div className="text-blueprint-navy/60 px-3 py-2 font-mono text-xs">
              No matches.
            </div>
          ) : (
            <ul className="divide-blueprint-navy/10 divide-y">
              {results.map((hit) => {
                const summary = hitSummary(hit)
                return (
                  <li key={`${hit.table}:${hit.slug}`}>
                    <Link
                      className="hover:bg-blueprint-navy/5 flex flex-col gap-0.5 px-3 py-2 transition-colors"
                      href={hitHref(hit)}
                      onClick={() => setOpen(false)}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-blueprint-navy text-sm font-medium">
                          {hitTitle(hit)}
                        </span>
                        <span className="text-blueprint-navy/50 font-mono text-[11px] uppercase tracking-wider">
                          {TABLE_LABELS[hit.table] ?? hit.table}
                        </span>
                      </div>
                      {summary ? (
                        <span className="text-blueprint-navy/60 text-xs">{summary}</span>
                      ) : null}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
