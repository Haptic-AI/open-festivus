"use client"

/**
 * Standalone test surface for the oneclick render loop (spec 025 iter-0 →
 * 026 iter-1).
 *
 * Pickers (policy + env + task? + robot? + episode_count) populate the FK
 * shape of the new Simulations+Episodes taxonomy. Clicking a Sim card still
 * triggers a render, but `hf_url` is now derived from the selected policy's
 * `hf_repo_id` rather than the old hardcoded `HF_URL` constant (kept as a
 * debug label).
 *
 * Step 3.1 (this step): pickers shipped + hf_url derivation. POST still goes
 * to /api/episodes (single Episode). Step 3.2 wires POST /api/simulations to
 * create a parent Simulation + N Episodes atomically.
 */

import { useEffect, useMemo, useRef, useState } from "react"

// Fallback only. Shown as a debug line below the pickers when no policy is
// selected; the POST itself always uses the picker-derived hf_url.
const HF_URL_FALLBACK = "https://huggingface.co/sb3/sac-Humanoid-v3"

const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 90_000

const EPISODE_COUNT_OPTIONS = [1, 2, 3, 4, 5] as const
const DEFAULT_EPISODE_COUNT = 2

interface IPickerRecord {
  slug: string
  name?: string
  hf_repo_id?: string
}

interface ISimCard {
  env_slug: string
  label: string
  blurb: string
}

const SIM_CARDS: readonly ISimCard[] = [
  {
    env_slug: "isaac-lab-humanoid",
    label: "Isaac Lab Humanoid",
    blurb: "NVIDIA Isaac Lab, MJX-backed humanoid locomotion.",
  },
  {
    env_slug: "mujoco-humanoid-cloth",
    label: "MuJoCo Humanoid Cloth",
    blurb: "MuJoCo 3.x humanoid with deformable cloth payload.",
  },
  {
    env_slug: "softgym-cloth-manipulation",
    label: "SoftGym Cloth Manipulation",
    blurb: "SoftGym flatten/fold benchmark with a WidowX gripper.",
  },
] as const

type ICardStatus = "idle" | "loading" | "done" | "failed"

interface ICardState {
  status: ICardStatus
  simulation_id?: string
  /** Spec 026: parent Simulation slug (for the deep link to /data/simulations/[slug]). */
  simulation_slug?: string
  /** First done episode's video_url, shown inline on the card. */
  video_url?: string
  error_message?: string
  /** Total episodes ordered by the user — display in the card body. */
  episode_count?: number
  /** Count of episodes already in a terminal state (done | failed). */
  terminal_count?: number
  /** Monotonic timestamp when the poll loop started, for the 90s cap + elapsed display. */
  started_at?: number
}

interface IEpisodeRow {
  id: string
  episode_index: number | null
  status: "pending" | "running" | "done" | "failed"
  video_url: string | null
  error_message: string | null
}

interface ISimulationDetail {
  id: string
  slug: string
  episodes: IEpisodeRow[]
}

const INITIAL_STATES: Record<string, ICardState> = Object.fromEntries(
  SIM_CARDS.map((c) => [c.env_slug, { status: "idle" as ICardStatus }]),
)

interface IPickerState {
  policySlug: string
  envSlug: string
  taskSlug: string
  robotSlug: string
  episodeCount: number
}

const INITIAL_PICKER_STATE: IPickerState = {
  policySlug: "",
  envSlug: "",
  taskSlug: "",
  robotSlug: "",
  episodeCount: DEFAULT_EPISODE_COUNT,
}

export default function SimTestPage() {
  const [states, setStates] = useState<Record<string, ICardState>>(INITIAL_STATES)
  const pollHandles = useRef<Record<string, ReturnType<typeof setInterval>>>({})
  // A monotonic tick that forces the component to recompute elapsed-seconds
  // labels while any card is loading. Cheaper than holding elapsed in state
  // per card because it's only the label that needs refreshing, not the rest.
  const [, setNow] = useState(Date.now())
  const anyLoading = Object.values(states).some((s) => s.status === "loading")

  const [policies, setPolicies] = useState<readonly IPickerRecord[]>([])
  const [tasks, setTasks] = useState<readonly IPickerRecord[]>([])
  const [robots, setRobots] = useState<readonly IPickerRecord[]>([])
  const [picker, setPicker] = useState<IPickerState>(INITIAL_PICKER_STATE)
  const [pickerError, setPickerError] = useState<string | null>(null)

  // Fetch all three pick lists on mount. Paginate by 50 — first page is enough
  // to populate the dropdowns without overwhelming the client.
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [pRes, tRes, rRes] = await Promise.all([
          fetch("/api/policies?limit=50"),
          fetch("/api/tasks?limit=50"),
          fetch("/api/robots?limit=50"),
        ])
        if (cancelled) return
        const [pBody, tBody, rBody] = await Promise.all([
          pRes.json() as Promise<{ results?: IPickerRecord[] }>,
          tRes.json() as Promise<{ results?: IPickerRecord[] }>,
          rRes.json() as Promise<{ results?: IPickerRecord[] }>,
        ])
        if (cancelled) return
        setPolicies(pBody.results ?? [])
        setTasks(tBody.results ?? [])
        setRobots(rBody.results ?? [])
      } catch (err) {
        if (cancelled) return
        setPickerError(err instanceof Error ? err.message : String(err))
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const selectedPolicy = useMemo(
    () => policies.find((p) => p.slug === picker.policySlug) ?? null,
    [policies, picker.policySlug],
  )

  const derivedHfUrl = useMemo(() => {
    if (!selectedPolicy?.hf_repo_id) return null
    return `https://huggingface.co/${selectedPolicy.hf_repo_id}`
  }, [selectedPolicy])

  const canSubmit =
    Boolean(picker.policySlug) &&
    Boolean(picker.envSlug) &&
    Boolean(derivedHfUrl)

  // Clean up any in-flight intervals when the component unmounts.
  useEffect(() => {
    const handles = pollHandles.current
    return () => {
      for (const h of Object.values(handles)) clearInterval(h)
    }
  }, [])

  // Only tick while something is loading — idle pages do no work.
  useEffect(() => {
    if (!anyLoading) return
    const handle = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(handle)
  }, [anyLoading])

  function updateCard(envSlug: string, patch: Partial<ICardState>) {
    setStates((prev) => ({
      ...prev,
      [envSlug]: { ...(prev[envSlug] ?? { status: "idle" }), ...patch },
    }))
  }

  function stopPolling(envSlug: string) {
    const handle = pollHandles.current[envSlug]
    if (handle) {
      clearInterval(handle)
      delete pollHandles.current[envSlug]
    }
  }

  async function pollOnce(envSlug: string, slug: string, startedAt: number) {
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
      stopPolling(envSlug)
      updateCard(envSlug, {
        status: "failed",
        error_message: "render timed out; try again later",
      })
      return
    }
    try {
      const res = await fetch(`/api/simulations/${encodeURIComponent(slug)}`)
      if (!res.ok) {
        // Transient network / upstream — let the interval retry until timeout.
        return
      }
      const sim = (await res.json()) as ISimulationDetail
      const episodes = sim.episodes ?? []
      const terminal = episodes.filter(
        (e) => e.status === "done" || e.status === "failed",
      )
      const firstDone = episodes.find((e) => e.status === "done")
      const allFailed = episodes.length > 0 && episodes.every((e) => e.status === "failed")
      const allTerminal = episodes.length > 0 && terminal.length === episodes.length

      if (allTerminal) {
        stopPolling(envSlug)
        if (firstDone) {
          updateCard(envSlug, {
            status: "done",
            video_url: firstDone.video_url ?? undefined,
            terminal_count: terminal.length,
          })
        } else if (allFailed) {
          const firstErr =
            episodes.find((e) => e.error_message)?.error_message ??
            "all episodes failed"
          updateCard(envSlug, {
            status: "failed",
            error_message: firstErr,
            terminal_count: terminal.length,
          })
        }
      } else {
        // Partial progress — keep the spinner but update the terminal counter.
        updateCard(envSlug, {
          terminal_count: terminal.length,
          // If at least one done already, surface its video without waiting
          // for peer episodes — useful when N=2 and one finishes first.
          video_url: firstDone?.video_url ?? undefined,
        })
      }
    } catch {
      // Swallow transient errors; the interval will retry until timeout.
    }
  }

  async function handleClick(envSlug: string) {
    const current = states[envSlug]
    if (current?.status === "loading") return
    if (!canSubmit) {
      updateCard(envSlug, {
        status: "failed",
        error_message: "pick a policy + env (and ensure the policy has hf_repo_id)",
      })
      return
    }
    // Card click sets env in picker state too — keeps the explicit env picker
    // in sync when the user drives env via a card rather than the dropdown.
    setPicker((prev) => ({ ...prev, envSlug }))

    const episodeCount = picker.episodeCount

    // Reset card state + kick off a fresh submission.
    stopPolling(envSlug)
    updateCard(envSlug, {
      status: "loading",
      simulation_id: undefined,
      simulation_slug: undefined,
      video_url: undefined,
      error_message: undefined,
      episode_count: episodeCount,
      terminal_count: 0,
      started_at: Date.now(),
    })

    let id: string
    let slug: string
    try {
      const res = await fetch("/api/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policy_slug: picker.policySlug,
          environment_slug: envSlug,
          ...(picker.taskSlug ? { task_slug: picker.taskSlug } : {}),
          ...(picker.robotSlug ? { robot_slug: picker.robotSlug } : {}),
          episode_count: episodeCount,
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        updateCard(envSlug, {
          status: "failed",
          error_message: `submit failed (${res.status}): ${text.slice(0, 200)}`,
        })
        return
      }
      const body = (await res.json()) as { id: string; slug: string }
      id = body.id
      slug = body.slug
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      updateCard(envSlug, { status: "failed", error_message: `submit error: ${detail}` })
      return
    }

    const startedAt = Date.now()
    updateCard(envSlug, {
      simulation_id: id,
      simulation_slug: slug,
      started_at: startedAt,
    })

    // Kick off the first poll immediately so fast transitions (cache-hit) are
    // caught without waiting POLL_INTERVAL_MS for the first tick.
    void pollOnce(envSlug, slug, startedAt)
    pollHandles.current[envSlug] = setInterval(() => {
      void pollOnce(envSlug, slug, startedAt)
    }, POLL_INTERVAL_MS)
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Sim test — oneclick render</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500">
          Pick a policy + env (+ optional task + robot) and how many episodes
          to render. Click a Sim card to start. Each render lands as one
          Episode under a parent{" "}
          <code className="rounded bg-neutral-100 px-1 text-xs">Simulation</code>{" "}
          (spec 026).
        </p>
      </header>

      <section
        aria-label="render pickers"
        className="mb-8 rounded-lg border border-neutral-200 bg-white p-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <PickerSelect
            label="Policy (required)"
            onChange={(value) => setPicker((p) => ({ ...p, policySlug: value }))}
            options={policies.map((p) => ({
              label: p.name ?? p.slug,
              value: p.slug,
            }))}
            placeholder="— pick a policy —"
            testid="picker-policy"
            value={picker.policySlug}
          />
          <PickerSelect
            label="Environment (required)"
            onChange={(value) => setPicker((p) => ({ ...p, envSlug: value }))}
            options={SIM_CARDS.map((c) => ({ label: c.label, value: c.env_slug }))}
            placeholder="— pick an env —"
            testid="picker-env"
            value={picker.envSlug}
          />
          <PickerSelect
            label="Task (optional)"
            onChange={(value) => setPicker((p) => ({ ...p, taskSlug: value }))}
            options={tasks.map((t) => ({ label: t.name ?? t.slug, value: t.slug }))}
            placeholder="— none —"
            testid="picker-task"
            value={picker.taskSlug}
          />
          <PickerSelect
            label="Robot (optional)"
            onChange={(value) => setPicker((p) => ({ ...p, robotSlug: value }))}
            options={robots.map((r) => ({ label: r.name ?? r.slug, value: r.slug }))}
            placeholder="— none —"
            testid="picker-robot"
            value={picker.robotSlug}
          />
          <PickerSelect
            label="Episode count"
            onChange={(value) =>
              setPicker((p) => ({
                ...p,
                episodeCount: Number.parseInt(value, 10) || DEFAULT_EPISODE_COUNT,
              }))
            }
            options={EPISODE_COUNT_OPTIONS.map((n) => ({
              label: String(n),
              value: String(n),
            }))}
            testid="picker-episode-count"
            value={String(picker.episodeCount)}
          />
        </div>
        <p className="mt-3 text-[14px] uppercase tracking-wide text-neutral-400">
          hf_url ={" "}
          <code className="rounded bg-neutral-100 px-1 text-[13px] normal-case">
            {derivedHfUrl ?? HF_URL_FALLBACK}
          </code>
          {derivedHfUrl ? null : (
            <span className="ml-2 text-amber-600">
              (fallback — pick a policy with hf_repo_id)
            </span>
          )}
        </p>
        {pickerError ? (
          <p className="mt-2 text-xs text-red-600">picker load error: {pickerError}</p>
        ) : null}
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SIM_CARDS.map((card) => {
          const state = states[card.env_slug] ?? { status: "idle" as ICardStatus }
          return (
            <SimCard
              card={card}
              disabled={!canSubmit}
              key={card.env_slug}
              onClick={() => {
                void handleClick(card.env_slug)
              }}
              state={state}
            />
          )
        })}
      </div>
    </main>
  )
}

interface IPickerSelectProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly { label: string; value: string }[]
  placeholder?: string
  testid?: string
}

function PickerSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  testid,
}: IPickerSelectProps) {
  return (
    <label className="flex flex-col gap-1 text-xs text-neutral-600">
      <span className="font-medium uppercase tracking-wide text-neutral-500">{label}</span>
      <select
        className="rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-800"
        data-testid={testid}
        onChange={(e) => onChange(e.target.value)}
        value={value}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function SimCard({
  card,
  state,
  onClick,
  disabled,
}: {
  card: ISimCard
  state: ICardState
  onClick: () => void
  disabled: boolean
}) {
  const { status } = state
  const isDisabled = disabled || status === "loading"
  return (
    <button
      className="group flex flex-col items-stretch rounded-xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition hover:border-neutral-300 hover:shadow disabled:cursor-not-allowed disabled:opacity-60"
      data-status={status}
      data-testid={`sim-card-${card.env_slug}`}
      disabled={isDisabled}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-medium text-neutral-900">{card.label}</h2>
        <StatusPill status={status} />
      </div>
      <p className="mt-1 text-xs text-neutral-500">{card.blurb}</p>
      <div className="mt-4 flex min-h-[180px] items-center justify-center rounded-lg bg-neutral-50">
        <CardBody label={card.label} state={state} />
      </div>
      <p className="mt-3 text-[14px] uppercase tracking-wide text-neutral-400">
        env_slug: <code>{card.env_slug}</code>
      </p>
      {state.simulation_slug ? (
        <a
          className="mt-2 text-[14px] font-medium uppercase tracking-wide text-blue-600 hover:text-blue-800"
          href={`/data/simulations/${state.simulation_slug}`}
          onClick={(e) => e.stopPropagation()}
          rel="noopener noreferrer"
          target="_blank"
        >
          see all {state.episode_count ?? "N"} episodes →
        </a>
      ) : null}
    </button>
  )
}

function StatusPill({ status }: { status: ICardStatus }) {
  const map: Record<ICardStatus, { label: string; className: string }> = {
    idle: { label: "idle", className: "bg-neutral-100 text-neutral-600" },
    loading: { label: "rendering…", className: "bg-blue-100 text-blue-700" },
    done: { label: "done", className: "bg-emerald-100 text-emerald-700" },
    failed: { label: "failed", className: "bg-red-100 text-red-700" },
  }
  const { label, className } = map[status]
  return (
    <span className={`rounded-full px-2 py-0.5 text-[13px] font-medium uppercase tracking-wide ${className}`}>
      {label}
    </span>
  )
}

function CardBody({ state, label }: { state: ICardState; label: string }) {
  if (state.status === "loading") {
    const elapsed = state.started_at ? Math.max(0, Math.floor((Date.now() - state.started_at) / 1000)) : 0
    const total = state.episode_count ?? 1
    const terminal = state.terminal_count ?? 0
    const narration =
      total > 1
        ? `rendering ${total} episodes · ${terminal}/${total} done`
        : "waiting for oneclick…"
    const pct = Math.min(100, Math.round((elapsed / 90) * 100))
    return (
      <div className="flex w-full flex-col items-center gap-3 px-4 text-neutral-500">
        <Spinner />
        <div className="flex w-full flex-col items-center gap-1">
          <span className="line-clamp-2 text-center text-xs text-neutral-700">{narration}</span>
          <span className="text-[13px] uppercase tracking-wide text-neutral-400">
            {elapsed}s elapsed · up to 90s
          </span>
        </div>
        <div
          aria-hidden="true"
          className="h-1 w-full overflow-hidden rounded-full bg-neutral-200"
        >
          <div
            className="h-full rounded-full bg-blue-400 transition-[width] duration-700 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    )
  }
  if (state.status === "done" && state.video_url) {
    return (
      <video
        controls
        aria-label={`${label} rendered video — first episode`}
        className="h-full max-h-[200px] w-full rounded-md"
        src={state.video_url}
      />
    )
  }
  if (state.status === "failed") {
    return (
      <div className="flex w-full flex-col gap-1 px-3 text-xs text-red-700">
        <div className="font-medium">render failed</div>
        <div className="whitespace-pre-wrap break-words text-red-600/80">
          {state.error_message ?? "unknown error"}
        </div>
      </div>
    )
  }
  return (
    <span className="text-xs text-neutral-400">click the card to start a render</span>
  )
}

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      className="h-6 w-6 animate-spin text-blue-500"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        fill="currentColor"
      />
    </svg>
  )
}
