/**
 * Pure presentation logic for the compatibility badge.
 *
 * Lives in `lib/` (not `components/`) so vitest can import it without
 * dragging in the JSX file. The .tsx component is a thin wrapper that
 * just calls computeBadgeView() and renders the result. The defense-in-
 * depth tests (Step 5.3) target THIS module so the assertion runs without
 * the JSX transform pipeline.
 *
 * Display rules per spec section "Compatibility edge reliability tiers":
 *   Tier 1 (paper-verified)        → green ✅, cite paper, show success_rate
 *   Tier 2 (community-reported)    → yellow ⚠️, "no published benchmark"
 *   Tier 3 (hand-inferred/untested)→ grey ◯, NEVER show success_rate
 *   Tier 4 (taxonomy-match)        → grey ◯, "needs verification"
 *
 * Tier 3 and tier 4 badges intentionally drop success_rate AND
 * episodes_tested AND environment AND evidence_url even when those fields
 * are populated on the input record — that's lesson 21 / codified rule 13.
 */

import { reliabilityTier, type IReliabilityTier } from "@/lib/schemas/domain"
import type { ICompatibilityEdge } from "@festivus/types"

export interface IBadgeView {
  /** Computed reliability tier (1-4) or null for an impossible source/status combo. */
  tier: IReliabilityTier | null
  /** Short label like "T1" or "?" for the tier badge. */
  tierLabel: string
  /** Tailwind classes for the container. */
  containerClass: string
  /** Leading glyph (✅ ⚠️ ◯ ⛔). */
  glyph: string
  /** Main label string. */
  label: string
  /** Optional secondary line. */
  helper: string | null
}

export function computeBadgeView(edge: ICompatibilityEdge): IBadgeView {
  const tier = reliabilityTier(edge)
  const tierLabel = tier === null ? "?" : `T${tier}`

  if (tier === 1) {
    const rate = edge.success_rate !== null ? `${Math.round(edge.success_rate * 100)}%` : null
    const episodes = edge.episodes_tested !== null ? `${edge.episodes_tested} ep` : null
    const metricLabel = rate !== null && episodes !== null ? `${rate} on ${episodes}` : rate ?? episodes ?? null
    return {
      tier,
      tierLabel,
      containerClass: "border-green-600/40 bg-green-50 text-green-900",
      glyph: "✅",
      label: metricLabel !== null ? `Verified — ${metricLabel}` : "Verified",
      helper: edge.evidence_url ?? null,
    }
  }
  if (tier === 2) {
    return {
      tier,
      tierLabel,
      containerClass: "border-amber-500/50 bg-amber-50 text-amber-900",
      glyph: "⚠️",
      label: "Reported",
      helper: "No published benchmark",
    }
  }
  if (tier === 3) {
    // STRUCTURAL DROP: success_rate, episodes_tested, environment, evidence_url
    // are intentionally NOT read here. An untested edge with a number on it is
    // a data bug; the renderer is the last line of defense (codified rule 13).
    const reason = edge.gaps[0] ?? "no test performed"
    return {
      tier,
      tierLabel,
      containerClass: "border-stone-400/50 bg-stone-100 text-stone-700",
      glyph: "◯",
      label: "Untested but plausible",
      helper: reason,
    }
  }
  if (tier === 4) {
    // Same structural drop as tier 3.
    return {
      tier,
      tierLabel,
      containerClass: "border-stone-400/50 bg-stone-100 text-stone-700",
      glyph: "◯",
      label: "Taxonomically compatible — UNTESTED",
      helper: "needs verification",
    }
  }
  return {
    tier,
    tierLabel,
    containerClass: "border-red-500/60 bg-red-50 text-red-900",
    glyph: "⛔",
    label: "Impossible source/status combo",
    helper: `${edge.source} + ${edge.status}`,
  }
}
