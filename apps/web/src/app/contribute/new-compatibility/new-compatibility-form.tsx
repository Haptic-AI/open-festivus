"use client"

import { useRouter } from "next/navigation"
import { useEffect, useId, useRef, useState } from "react"

interface ISearchHit {
  table: string
  slug: string
  data: Record<string, unknown>
}

type EdgeStatus = "verified" | "reported" | "inferred" | "untested"
type EdgeSource = "paper" | "community" | "inferred" | "taxonomy-match"

interface ITypeaheadProps {
  /** Which collection to search — robots or policies. */
  table: "robots" | "policies"
  label: string
  value: { slug: string; name: string } | null
  onChange: (selected: { slug: string; name: string } | null) => void
}

/**
 * Typeahead select powered by /api/search?tables=<table>. Local copy of the
 * SearchBar pattern; specialized for picking exactly one record.
 */
function RecordPicker({ table, label, value, onChange }: ITypeaheadProps) {
  const [q, setQ] = useState(value?.name ?? "")
  const [results, setResults] = useState<ISearchHit[]>([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputId = useId()

  useEffect(() => {
    const trimmed = q.trim()
    if (trimmed.length < 2) {
      setResults([])
      return
    }
    const ac = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}&tables=${table}&limit=8`,
          { signal: ac.signal },
        )
        if (!res.ok) {
          setResults([])
          return
        }
        const body = (await res.json()) as { results: ISearchHit[] }
        setResults(body.results)
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return
        setResults([])
      }
    }, 250)
    return () => {
      ac.abort()
      clearTimeout(t)
    }
  }, [q, table])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  return (
    <div className="relative" ref={containerRef}>
      <label
        className="text-blueprint-navy/60 mb-1 block font-mono text-[12px] font-bold uppercase tracking-wider"
        htmlFor={inputId}
      >
        {label}
      </label>
      <input
        autoComplete="off"
        className="border-blueprint-navy/15 focus:border-blueprint-navy w-full rounded border bg-white px-3 py-2 text-sm outline-none transition-colors"
        id={inputId}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
          if (value) onChange(null)
        }}
        onFocus={() => setOpen(true)}
        placeholder={`Search ${table}…`}
        type="search"
        value={q}
      />
      {value ? (
        <p className="text-blueprint-navy/60 mt-1 font-mono text-[11px]">
          slug · <span className="text-blueprint-navy">{value.slug}</span>
        </p>
      ) : null}
      {open && q.trim().length >= 2 && results.length > 0 ? (
        <ul className="bg-drafting-cream border-blueprint-navy/15 absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-72 overflow-y-auto rounded border shadow-lg">
          {results.map((hit) => {
            const name =
              typeof hit.data["name"] === "string"
                ? (hit.data["name"] as string)
                : hit.slug
            return (
              <li className="border-blueprint-navy/10 border-b last:border-b-0" key={hit.slug}>
                <button
                  className="hover:bg-blueprint-navy/5 flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors"
                  onClick={(e) => {
                    e.preventDefault()
                    onChange({ slug: hit.slug, name })
                    setQ(name)
                    setOpen(false)
                  }}
                  type="button"
                >
                  <span className="text-blueprint-navy text-sm font-medium">{name}</span>
                  <span className="text-blueprint-navy/50 font-mono text-[11px]">{hit.slug}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

interface IFormState {
  robot: { slug: string; name: string } | null
  policy: { slug: string; name: string } | null
  status: EdgeStatus
  source: EdgeSource
  notes: string
  environment: string
  evidence_url: string
  success_rate: string
  episodes_tested: string
  gaps: string
}

const INITIAL: IFormState = {
  robot: null,
  policy: null,
  status: "reported",
  source: "community",
  notes: "",
  environment: "",
  evidence_url: "",
  success_rate: "",
  episodes_tested: "",
  gaps: "",
}

export function NewCompatibilityForm() {
  const router = useRouter()
  const [state, setState] = useState<IFormState>(INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const slugPreview =
    state.robot && state.policy
      ? state.environment.trim().length > 0
        ? `${state.robot.slug}__${state.policy.slug}__${state.environment.trim()}`
        : `${state.robot.slug}__${state.policy.slug}`
      : null

  function field<K extends keyof IFormState>(key: K, val: IFormState[K]) {
    setState((s) => ({ ...s, [key]: val }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!state.robot || !state.policy) {
      setError("Pick both a robot and a policy.")
      return
    }
    if (state.notes.trim().length < 20) {
      setError("Notes must be at least 20 characters — give a future reader real context.")
      return
    }

    const payload = {
      robot_slug: state.robot.slug,
      policy_slug: state.policy.slug,
      status: state.status,
      source: state.source,
      notes: state.notes.trim(),
      environment: state.environment.trim() || null,
      evidence_url: state.evidence_url.trim() || null,
      success_rate:
        state.success_rate.trim() === "" ? null : Number.parseFloat(state.success_rate),
      episodes_tested:
        state.episodes_tested.trim() === ""
          ? null
          : Number.parseInt(state.episodes_tested, 10),
      gaps: state.gaps
        .split("\n")
        .map((g) => g.trim())
        .filter((g) => g.length > 0),
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/contribute/compatibility-edges", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = (await res.json()) as { slug?: string; error?: string; detail?: string }
      if (!res.ok) {
        setError(body.detail ?? body.error ?? `Submit failed (${res.status})`)
        return
      }
      if (body.slug) {
        router.push(`/data/compatibility/${encodeURIComponent(body.slug)}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit}>
      <div className="grid gap-5 md:grid-cols-2">
        <RecordPicker
          label="Robot"
          onChange={(v) => field("robot", v)}
          table="robots"
          value={state.robot}
        />
        <RecordPicker
          label="Policy"
          onChange={(v) => field("policy", v)}
          table="policies"
          value={state.policy}
        />
      </div>

      {slugPreview ? (
        <p className="text-blueprint-navy/60 font-mono text-[12px]">
          → will create <span className="text-blueprint-navy font-bold">{slugPreview}</span>
        </p>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label
            className="text-blueprint-navy/60 mb-1 block font-mono text-[12px] font-bold uppercase tracking-wider"
            htmlFor="status"
          >
            Status
          </label>
          <select
            className="border-blueprint-navy/15 focus:border-blueprint-navy w-full rounded border bg-white px-3 py-2 text-sm outline-none"
            id="status"
            onChange={(e) => field("status", e.target.value as EdgeStatus)}
            value={state.status}
          >
            <option value="verified">verified — paper or independently reproduced</option>
            <option value="reported">reported — someone tried it and shared results</option>
            <option value="inferred">inferred — schema-compatible, untested</option>
            <option value="untested">untested — flagged as gap to fill</option>
          </select>
        </div>
        <div>
          <label
            className="text-blueprint-navy/60 mb-1 block font-mono text-[12px] font-bold uppercase tracking-wider"
            htmlFor="source"
          >
            Source
          </label>
          <select
            className="border-blueprint-navy/15 focus:border-blueprint-navy w-full rounded border bg-white px-3 py-2 text-sm outline-none"
            id="source"
            onChange={(e) => field("source", e.target.value as EdgeSource)}
            value={state.source}
          >
            <option value="paper">paper — peer-reviewed result</option>
            <option value="community">community — Discord, GitHub, blog</option>
            <option value="inferred">inferred — author&apos;s reasoning</option>
            <option value="taxonomy-match">taxonomy-match — schema check only</option>
          </select>
        </div>
      </div>

      <div>
        <label
          className="text-blueprint-navy/60 mb-1 block font-mono text-[12px] font-bold uppercase tracking-wider"
          htmlFor="notes"
        >
          Notes <span className="text-annotation-red">*</span>
        </label>
        <textarea
          className="border-blueprint-navy/15 focus:border-blueprint-navy w-full rounded border bg-white px-3 py-2 text-sm outline-none transition-colors"
          id="notes"
          minLength={20}
          onChange={(e) => field("notes", e.target.value)}
          placeholder="What is this pair? What did you test or observe? At least 20 characters."
          rows={4}
          value={state.notes}
        />
      </div>

      <details className="border-blueprint-navy/10 rounded border p-4">
        <summary className="text-blueprint-navy/80 cursor-pointer font-mono text-[12px] font-bold uppercase tracking-wider">
          Optional details
        </summary>
        <div className="mt-4 grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                className="text-blueprint-navy/60 mb-1 block font-mono text-[12px] font-bold uppercase tracking-wider"
                htmlFor="success_rate"
              >
                Success rate (0–1)
              </label>
              <input
                className="border-blueprint-navy/15 focus:border-blueprint-navy w-full rounded border bg-white px-3 py-2 text-sm outline-none"
                id="success_rate"
                max={1}
                min={0}
                onChange={(e) => field("success_rate", e.target.value)}
                step={0.01}
                type="number"
                value={state.success_rate}
              />
            </div>
            <div>
              <label
                className="text-blueprint-navy/60 mb-1 block font-mono text-[12px] font-bold uppercase tracking-wider"
                htmlFor="episodes_tested"
              >
                Episodes tested
              </label>
              <input
                className="border-blueprint-navy/15 focus:border-blueprint-navy w-full rounded border bg-white px-3 py-2 text-sm outline-none"
                id="episodes_tested"
                min={0}
                onChange={(e) => field("episodes_tested", e.target.value)}
                step={1}
                type="number"
                value={state.episodes_tested}
              />
            </div>
          </div>

          <div>
            <label
              className="text-blueprint-navy/60 mb-1 block font-mono text-[12px] font-bold uppercase tracking-wider"
              htmlFor="environment"
            >
              Environment / benchmark
            </label>
            <input
              className="border-blueprint-navy/15 focus:border-blueprint-navy w-full rounded border bg-white px-3 py-2 text-sm outline-none"
              id="environment"
              onChange={(e) => field("environment", e.target.value)}
              placeholder="e.g. LIBERO-Spatial, BridgeData V2, MuJoCo cube-transfer"
              type="text"
              value={state.environment}
            />
          </div>

          <div>
            <label
              className="text-blueprint-navy/60 mb-1 block font-mono text-[12px] font-bold uppercase tracking-wider"
              htmlFor="evidence_url"
            >
              Evidence URL
            </label>
            <input
              className="border-blueprint-navy/15 focus:border-blueprint-navy w-full rounded border bg-white px-3 py-2 text-sm outline-none"
              id="evidence_url"
              onChange={(e) => field("evidence_url", e.target.value)}
              placeholder="arxiv.org / huggingface.co / github discussion / blog post"
              type="url"
              value={state.evidence_url}
            />
          </div>

          <div>
            <label
              className="text-blueprint-navy/60 mb-1 block font-mono text-[12px] font-bold uppercase tracking-wider"
              htmlFor="gaps"
            >
              Gaps (one per line)
            </label>
            <textarea
              className="border-blueprint-navy/15 focus:border-blueprint-navy w-full rounded border bg-white px-3 py-2 text-sm outline-none"
              id="gaps"
              onChange={(e) => field("gaps", e.target.value)}
              placeholder={"Open question or known limitation\nAnother one"}
              rows={3}
              value={state.gaps}
            />
          </div>
        </div>
      </details>

      {error ? (
        <p className="bg-annotation-red/10 text-annotation-red rounded px-3 py-2 text-sm">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          className="bg-blueprint-navy text-safety-yellow hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 rounded px-5 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-opacity"
          disabled={submitting || !state.robot || !state.policy}
          type="submit"
        >
          {submitting ? "Saving…" : "Submit edge"}
        </button>
        <p className="text-blueprint-navy/50 text-xs">
          Goes live immediately. A moderator can revert if needed.
        </p>
      </div>
    </form>
  )
}
