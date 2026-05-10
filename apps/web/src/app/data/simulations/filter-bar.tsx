"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useTransition } from "react"

interface IOption {
  slug: string
  label: string
}

interface IEnvOption {
  slug: string
  label: string
}

interface IFilterState {
  policy_slug: string
  environment_slug: string
  task_slug: string
  robot_slug: string
}

interface IProps {
  filters: IFilterState
  policyOptions: readonly IOption[]
  robotOptions: readonly IOption[]
  taskOptions: readonly IOption[]
  envOptions: readonly IEnvOption[]
}

/**
 * Client-side filter UI for /data/simulations (spec 026 iter-1).
 *
 * State lives in the URL search params — every change is a router push so
 * the server component re-renders with a fresh `where` clause on
 * /v1/simulations. Keeps filtering server-authoritative (no client-side
 * list shrinking) and makes filter state shareable / bookmarkable.
 */
export function SimulationsFilterBar({
  filters,
  policyOptions,
  robotOptions,
  taskOptions,
  envOptions,
}: IProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const setFilter = useCallback(
    (key: keyof IFilterState, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set(key, value)
      else params.delete(key)
      const qs = params.toString()
      startTransition(() => {
        router.push(qs ? `/data/simulations?${qs}` : "/data/simulations")
      })
    },
    [router, searchParams],
  )

  const hasAnyFilter =
    Boolean(filters.policy_slug) ||
    Boolean(filters.environment_slug) ||
    Boolean(filters.task_slug) ||
    Boolean(filters.robot_slug)

  return (
    <section
      aria-label="filters"
      className="border-blueprint-navy/10 rounded-lg border bg-white p-4"
      data-pending={pending ? "true" : "false"}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect
          disabled={robotOptions.length === 0}
          label="Robot"
          onChange={(v) => setFilter("robot_slug", v)}
          options={robotOptions}
          placeholder="any robot"
          testid="filter-robot"
          value={filters.robot_slug}
        />
        <FilterSelect
          disabled={policyOptions.length === 0}
          label="Policy"
          onChange={(v) => setFilter("policy_slug", v)}
          options={policyOptions}
          placeholder="any policy"
          testid="filter-policy"
          value={filters.policy_slug}
        />
        <FilterSelect
          disabled={taskOptions.length === 0}
          disabledEmptyLabel="(no tasks seeded yet)"
          label="Task"
          onChange={(v) => setFilter("task_slug", v)}
          options={taskOptions}
          placeholder="any task"
          testid="filter-task"
          value={filters.task_slug}
        />
        <FilterSelect
          label="Environment"
          onChange={(v) => setFilter("environment_slug", v)}
          options={envOptions}
          placeholder="any env"
          testid="filter-env"
          value={filters.environment_slug}
        />
      </div>
      {hasAnyFilter ? (
        <button
          className="text-blueprint-navy/60 hover:text-blueprint-navy mt-3 font-mono text-[13px] font-bold uppercase tracking-wider underline"
          onClick={() => {
            startTransition(() => router.push("/data/simulations"))
          }}
          type="button"
        >
          Clear all filters
        </button>
      ) : null}
    </section>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  testid,
  disabled,
  disabledEmptyLabel,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly IOption[]
  placeholder: string
  testid?: string
  disabled?: boolean
  disabledEmptyLabel?: string
}) {
  return (
    <label className="text-blueprint-navy/70 flex flex-col gap-1 text-xs">
      <span className="font-mono text-[13px] font-bold uppercase tracking-wider">{label}</span>
      <select
        className="border-blueprint-navy/20 rounded border bg-white px-2 py-1.5 text-xs disabled:bg-neutral-50 disabled:text-neutral-400"
        data-testid={testid}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        value={value}
      >
        <option value="">
          {disabled && disabledEmptyLabel ? disabledEmptyLabel : placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt.slug} value={opt.slug}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}
