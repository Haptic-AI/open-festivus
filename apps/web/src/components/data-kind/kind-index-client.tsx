"use client"

import Link from "next/link"
import { useState } from "react"
import type {
  IRichDataset,
  IRichPolicy,
  IRichRobot,
  ISimEnvironment,
} from "@festivus/types"
import { SuggestEditChip } from "@/components/suggest-edit/suggest-edit-chip"

type KindIndexProps =
  | { kind: "robot"; records: IRichRobot[] }
  | { kind: "policy"; records: IRichPolicy[] }
  | { kind: "dataset"; records: IRichDataset[] }
  | { kind: "environment"; records: ISimEnvironment[] }

function matchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase())
}

export function KindIndexClient(props: KindIndexProps) {
  const [query, setQuery] = useState("")
  const q = query.trim()

  const placeholder = getPlaceholder(props.kind)
  const suggestions = getSuggestions(props.kind)

  return (
    <div>
      <div className="mb-10">
        <label
          className="text-blueprint-navy/70 mb-2 block text-xs"
          htmlFor="kind-search"
        >
          Search {pluralLabel(props.kind)}
        </label>
        <input
          autoComplete="off"
          className="border-blueprint-navy/20 focus:border-blueprint-navy bg-drafting-cream text-blueprint-navy placeholder:text-blueprint-navy/50 w-full border-2 px-4 py-3 text-sm outline-none transition-colors"
          id="kind-search"
          onChange={(e) => {
            setQuery(e.target.value)
          }}
          placeholder={placeholder}
          type="text"
          value={query}
        />
        {q.length === 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                className="border-blueprint-navy/15 text-blueprint-navy/70 hover:border-blueprint-navy hover:text-blueprint-navy cursor-pointer border px-3 py-1 text-xs transition-colors"
                key={s}
                onClick={() => {
                  setQuery(s)
                }}
                type="button"
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          <button
            className="text-blueprint-navy/70 hover:text-blueprint-navy mt-2 text-xs underline underline-offset-2"
            onClick={() => {
              setQuery("")
            }}
            type="button"
          >
            Clear search
          </button>
        )}
      </div>

      {props.kind === "robot" ? (
        <RobotGrid q={q} records={props.records} />
      ) : props.kind === "policy" ? (
        <PolicyGrid q={q} records={props.records} />
      ) : props.kind === "dataset" ? (
        <DatasetGrid q={q} records={props.records} />
      ) : (
        <EnvironmentGrid q={q} records={props.records} />
      )}
    </div>
  )
}

function pluralLabel(kind: KindIndexProps["kind"]): string {
  switch (kind) {
    case "robot":
      return "robots"
    case "policy":
      return "policies"
    case "dataset":
      return "datasets"
    case "environment":
      return "environments"
  }
}

function getPlaceholder(kind: KindIndexProps["kind"]): string {
  switch (kind) {
    case "robot":
      return "SO-100, humanoid, quadruped, manufacturer..."
    case "policy":
      return "ACT, diffusion, Octo, pick-and-place..."
    case "dataset":
      return "ALOHA, Open X, bimanual, kitchen..."
    case "environment":
      return "MuJoCo, Isaac, tabletop, cluttered..."
  }
}

function getSuggestions(kind: KindIndexProps["kind"]): string[] {
  switch (kind) {
    case "robot":
      return ["humanoid", "quadruped", "arm", "SO-100"]
    case "policy":
      return ["manipulation", "locomotion", "ACT", "diffusion"]
    case "dataset":
      return ["ALOHA", "Open X", "bimanual"]
    case "environment":
      return ["MuJoCo", "Isaac", "tabletop"]
  }
}

function NoResults({
  label,
  onClear,
}: {
  label: string
  onClear: () => void
}) {
  return (
    <p className="text-blueprint-navy/70 text-sm italic">
      No {label} match your search.{" "}
      <button
        className="underline underline-offset-2"
        onClick={onClear}
        type="button"
      >
        Clear
      </button>
    </p>
  )
}

function RobotGrid({ records, q }: { records: IRichRobot[]; q: string }) {
  const filtered =
    q.length === 0
      ? records
      : records.filter(
          (r) =>
            matchesQuery(r.name, q) ||
            matchesQuery(r.manufacturer, q) ||
            matchesQuery(r.description, q) ||
            matchesQuery(r.hardware.type, q),
        )

  if (filtered.length === 0) {
    return <NoResults label="robots" onClear={() => undefined} />
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {filtered.map((r) => (
        <div className="group relative" key={r.id}>
          <Link
            className="border-blueprint-navy/10 hover:border-blueprint-navy/40 bg-white block h-full rounded-lg border p-5 transition-colors"
            href={`/data/robots/${r.slug}`}
          >
            <p className="text-blueprint-navy text-base font-bold">{r.name}</p>
            <p className="text-blueprint-navy/70 text-xs">{r.manufacturer}</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="bg-blueprint-navy/5 text-blueprint-navy/70 px-1.5 py-0.5 text-[12px] font-bold uppercase tracking-wider">
                {r.hardware.type}
              </span>
              <span className="text-blueprint-navy/70 text-[13px]">
                {r.hardware.degreesOfFreedom} DoF
              </span>
            </div>
            <p className="text-blueprint-navy/70 mt-3 text-[14px]">
              {r.compatiblePolicySlugs.length} compatible{" "}
              {r.compatiblePolicySlugs.length === 1 ? "policy" : "policies"}
            </p>
          </Link>
          <div className="absolute right-3 top-3">
            <SuggestEditChip
              recordId={r.slug}
              recordKind="robot"
              recordName={r.name}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function PolicyGrid({ records, q }: { records: IRichPolicy[]; q: string }) {
  const filtered =
    q.length === 0
      ? records
      : records.filter(
          (p) =>
            matchesQuery(p.name, q) ||
            matchesQuery(p.taskDescription, q) ||
            matchesQuery(p.task, q) ||
            matchesQuery(p.description, q) ||
            p.tags.some((t) => matchesQuery(t, q)) ||
            p.hardware.some((h) => matchesQuery(h.name, q)),
        )

  if (filtered.length === 0) {
    return <NoResults label="policies" onClear={() => undefined} />
  }

  const EVIDENCE_COLORS: Record<string, string> = {
    verified: "bg-safety-yellow text-blueprint-navy",
    "sim-tested": "bg-blueprint-navy text-drafting-cream",
    "model-card-only": "bg-cold-gray/30 text-blueprint-navy/80",
  }
  const EVIDENCE_SHORT: Record<string, string> = {
    verified: "Verified",
    "sim-tested": "Sim tested",
    "model-card-only": "Model card",
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {filtered.map((p) => (
        <div className="group relative" key={p.id}>
          <Link
            className="border-blueprint-navy/10 hover:border-blueprint-navy/40 bg-white block h-full rounded-lg border p-5 transition-colors"
            href={`/data/policies/${p.slug}`}
          >
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`px-1.5 py-0.5 text-[12px] font-bold uppercase tracking-wider ${EVIDENCE_COLORS[p.evidence.level] ?? ""}`}
              >
                {EVIDENCE_SHORT[p.evidence.level] ?? p.evidence.level}
              </span>
            </div>
            <p className="text-blueprint-navy text-base font-bold leading-tight">
              {p.name}
            </p>
            <p className="text-blueprint-navy/70 mt-1 text-xs leading-relaxed">
              {p.taskDescription}
            </p>
            <div className="mt-3 flex flex-wrap gap-1">
              {p.hardware.slice(0, 4).map((h) => (
                <span
                  className="bg-blueprint-navy/5 text-blueprint-navy/70 px-1.5 py-0.5 text-[12px]"
                  key={h.id}
                >
                  {h.name}
                </span>
              ))}
            </div>
          </Link>
          <div className="absolute right-3 top-3">
            <SuggestEditChip
              recordId={p.slug}
              recordKind="policy"
              recordName={p.name}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function DatasetGrid({ records, q }: { records: IRichDataset[]; q: string }) {
  const filtered =
    q.length === 0
      ? records
      : records.filter(
          (d) =>
            matchesQuery(d.name, q) ||
            matchesQuery(d.description, q) ||
            d.robotNames.some((n) => matchesQuery(n, q)),
        )

  if (filtered.length === 0) {
    return <NoResults label="datasets" onClear={() => undefined} />
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {filtered.map((d) => (
        <div className="group relative" key={d.id}>
          <Link
            className="border-blueprint-navy/10 hover:border-blueprint-navy/40 bg-white block h-full rounded-lg border p-5 transition-colors"
            href={`/data/datasets/${d.slug}`}
          >
            <p className="text-blueprint-navy text-base font-bold leading-tight">
              {d.name}
            </p>
            <p className="text-blueprint-navy/70 mt-1 text-xs leading-relaxed">
              {d.description}
            </p>
            <div className="text-blueprint-navy/70 mt-3 flex flex-wrap gap-2 text-[13px]">
              <span>{d.episodes.toLocaleString()} episodes</span>
              <span>·</span>
              <span>
                {d.robots} robot{d.robots > 1 ? "s" : ""}
              </span>
            </div>
          </Link>
          <div className="absolute right-3 top-3">
            <SuggestEditChip
              currentValueHint={
                d.hfDatasetId !== undefined
                  ? `https://huggingface.co/datasets/${d.hfDatasetId}`
                  : undefined
              }
              recordId={d.slug}
              recordKind="dataset"
              recordName={d.name}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function EnvironmentGrid({
  records,
  q,
}: {
  records: ISimEnvironment[]
  q: string
}) {
  const filtered =
    q.length === 0
      ? records
      : records.filter(
          (e) =>
            matchesQuery(e.name, q) ||
            matchesQuery(e.simulator, q) ||
            matchesQuery(e.description, q),
        )

  if (filtered.length === 0) {
    return <NoResults label="environments" onClear={() => undefined} />
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {filtered.map((e) => (
        <div className="group relative" key={e.id}>
          <Link
            className="border-blueprint-navy/10 hover:border-blueprint-navy/40 bg-white block h-full rounded-lg border p-5 transition-colors"
            href={`/data/environments/${e.id}`}
          >
            <p className="text-blueprint-navy text-base font-bold">{e.name}</p>
            <p className="text-blueprint-navy/70 mt-1 text-xs leading-relaxed">
              {e.description}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className="bg-blueprint-navy/5 text-blueprint-navy/70 px-1.5 py-0.5 text-[12px] font-bold uppercase tracking-wider">
                {e.simulator}
              </span>
              <span className="text-blueprint-navy/70 text-[13px]">
                {e.scene}
              </span>
            </div>
          </Link>
          <div className="absolute right-3 top-3">
            <SuggestEditChip
              recordId={e.id}
              recordKind="environment"
              recordName={e.name}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
