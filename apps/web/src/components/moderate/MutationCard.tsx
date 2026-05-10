"use client"

import { useState, useTransition } from "react"
import type { IMutation } from "@festivus/types"
import { reviewAction } from "@/app/moderate/actions"

interface IMutationCardProps {
  mutation: IMutation
  conflicts?: Set<string>
}

export function MutationCard({ mutation, conflicts }: IMutationCardProps) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function act(action: "approve" | "reject") {
    setError(null)
    startTransition(async () => {
      const result = await reviewAction(mutation.id, action)
      if (!result.ok) {
        setError(result.error ?? "unknown error")
      }
    })
  }

  const fields = mutation.field_path.split(",").filter(Boolean)
  const oldValues = mutation.old_values as Record<string, unknown>
  const newValues = mutation.new_values as Record<string, unknown>

  // Spec 027 phase 10: at least one field on this mutation overlaps a
  // pending mutation elsewhere in the queue. Yellow border so moderators
  // notice before approving a silent overwrite.
  const hasConflict = fields.some((f) =>
    conflicts?.has(`${mutation.table_name}:${mutation.slug}:${f}`),
  )

  const borderClass = hasConflict
    ? "border-amber-400 bg-amber-50"
    : "border-neutral-300 bg-neutral-50"

  return (
    <article
      className={`rounded-lg border ${borderClass} p-4 text-sm scroll-mt-24 target:ring-2 target:ring-amber-400`}
      id={`mutation-${mutation.id}`}
    >
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-mono text-base">
          {mutation.table_name}/{mutation.slug}
        </h3>
        <span className="text-xs text-neutral-500">
          #{mutation.id} · {new Date(mutation.created_at).toLocaleString()}
        </span>
      </header>

      {hasConflict ? (
        <p className="mb-2 rounded bg-amber-100 px-2 py-1 text-xs text-amber-900">
          Another pending edit touches at least one of these fields. Approving both would let the
          later one silently overwrite the earlier.
        </p>
      ) : null}

      <dl className="mb-3 space-y-1">
        {fields.map((f) => {
          const fieldKey = `${mutation.table_name}:${mutation.slug}:${f}`
          const isConflict = conflicts?.has(fieldKey) ?? false
          return (
          <div className="flex flex-wrap gap-x-3" key={f}>
            <dt className={`font-mono text-xs ${isConflict ? "font-bold text-amber-800" : "text-neutral-500"}`}>
              {f}
              {isConflict ? " ⚠" : ""}
            </dt>
            <dd>
              <span className="rounded bg-red-50 px-1.5 py-0.5 font-mono text-xs text-red-700 line-through">
                {JSON.stringify(oldValues[f] ?? null)}
              </span>{" "}
              →{" "}
              <span className="rounded bg-green-50 px-1.5 py-0.5 font-mono text-xs text-green-700">
                {JSON.stringify(newValues[f] ?? null)}
              </span>
            </dd>
          </div>
          )
        })}
      </dl>

      {mutation.reason ? (
        <p className="mb-3 text-xs italic text-neutral-600">&ldquo;{mutation.reason}&rdquo;</p>
      ) : null}

      <footer className="flex items-center justify-between gap-2">
        <div className="text-xs text-neutral-500">
          by <span className="font-mono">{mutation.actor_id}</span>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
            disabled={pending}
            onClick={() => act("reject")}
            type="button"
          >
            Reject
          </button>
          <button
            className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50"
            disabled={pending}
            onClick={() => act("approve")}
            type="button"
          >
            {pending ? "Working..." : "Approve"}
          </button>
        </div>
      </footer>

      {error ? (
        <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p>
      ) : null}
    </article>
  )
}
