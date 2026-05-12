/**
 * CompatibilityBadge — renders a compatibility edge with tier-aware UI.
 *
 * The pure presentation logic lives in `lib/compatibility-badge-view.ts`
 * (Step 5.3) so vitest can test it without dragging the JSX file through
 * the import-analysis pipeline. This component is just the JSX shell —
 * pass an edge in, render the view object out.
 *
 * Display rules per spec section "Compatibility edge reliability tiers":
 *   Tier 1 (paper-verified)        → green ✅, cite paper, show success_rate
 *   Tier 2 (community-reported)    → yellow ⚠️, "no published benchmark"
 *   Tier 3 (hand-inferred/untested)→ grey ◯, NEVER show success_rate
 *   Tier 4 (taxonomy-match)        → grey ◯, "needs verification"
 */

import { computeBadgeView } from "@/lib/compatibility-badge-view"
import type { ICompatibilityEdge } from "@festivus/types"

interface ICompatibilityBadgeProps {
  edge: ICompatibilityEdge
  className?: string
}

export function CompatibilityBadge({ edge, className }: ICompatibilityBadgeProps): React.ReactElement {
  const view = computeBadgeView(edge)

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-xs ${view.containerClass} ${className ?? ""}`}
      data-tier={view.tierLabel}
      role="status"
    >
      <span aria-hidden="true">{view.glyph}</span>
      <span className="font-bold">{view.tierLabel}</span>
      <span>{view.label}</span>
      {view.helper !== null ? <span className="opacity-70">— {view.helper}</span> : null}
    </span>
  )
}
