"use client"

import { Flag } from "lucide-react"
import { useUser } from "@clerk/nextjs"
import { useAgentChatDrawer } from "@/lib/agent-chat/drawer-context"

/**
 * Per-field and per-record flag trigger. A signed-in click opens the
 * app-wide agent drawer scoped to `{table, slug, field?}`. Hidden when
 * the user is signed out, matching `AskAIButton`. No GitHub Issue
 * fallback — dropped in spec 029 phase 2.3.
 */

export type RecordKind = "policy" | "robot" | "dataset" | "environment"

interface ISuggestEditChipProps {
  recordKind: RecordKind
  recordId: string
  recordName: string
  /** Unused since the drawer replaces the legacy form. Kept for ergonomic parity with earlier call-sites. */
  currentValueHint?: string
  visibility?: "always" | "hover"
  fieldName?: string
  fieldLabel?: string
  layout?: "chip" | "inline"
}

const RECORD_KIND_TO_TABLE: Record<RecordKind, string> = {
  robot: "robots",
  policy: "policies",
  dataset: "datasets",
  environment: "environments",
}

export function SuggestEditChip({
  recordKind,
  recordId,
  recordName,
  visibility = "hover",
  fieldName,
  fieldLabel,
  layout = "chip",
}: ISuggestEditChipProps) {
  const { isSignedIn, isLoaded } = useUser()
  const { openDrawer } = useAgentChatDrawer()

  if (!isLoaded || !isSignedIn) return null

  const visibilityClass =
    visibility === "always"
      ? "opacity-100"
      : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100"

  const scopedLabel = fieldLabel ?? fieldName
  const ariaLabel =
    scopedLabel !== undefined
      ? `Suggest edit for ${recordName} · ${scopedLabel}`
      : `Suggest edit for ${recordName}`

  const buttonClass =
    layout === "inline"
      ? `${visibilityClass} text-blueprint-navy/40 hover:text-blueprint-navy inline-flex items-center rounded p-1 transition-colors`
      : `${visibilityClass} border-blueprint-navy/20 text-blueprint-navy/70 hover:bg-blueprint-navy hover:text-drafting-cream inline-flex items-center gap-1 rounded border bg-white/80 px-1.5 py-0.5 font-mono text-[12px] font-bold uppercase tracking-wider backdrop-blur transition-all`

  return (
    <button
      aria-label={ariaLabel}
      className={buttonClass}
      data-testid="suggest-edit-chip"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        openDrawer({
          table: RECORD_KIND_TO_TABLE[recordKind],
          slug: recordId,
          recordName,
          ...(fieldName !== undefined ? { field: fieldName } : {}),
        })
      }}
      type="button"
    >
      <Flag size={layout === "inline" ? 12 : 10} strokeWidth={2.25} />
      {layout === "chip" ? <span>Suggest edit</span> : null}
    </button>
  )
}
