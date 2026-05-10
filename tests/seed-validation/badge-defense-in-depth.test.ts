/**
 * Defense-in-depth badge test (Step 5.3 / Lesson 21 / Codified Rule 13).
 *
 * The compatibility-badge view computation MUST drop `success_rate`,
 * `episodes_tested`, `environment`, and `evidence_url` from the
 * rendered output for tier-3 and tier-4 edges, even when those fields
 * are present in the input record. The tier-3/4 invariant is the
 * structural guarantee against confidence hallucination — if upstream
 * data ever leaks a number onto an untested edge (data bug, future
 * scraper mishap, type-cast mistake), the renderer is the last line
 * of defense.
 *
 * The Zod refinement on compatibilityEdgeSchema rejects impossible
 * source/status combos at PARSE time, but Step 5.3 verifies the
 * RENDER time guarantee separately so a parser bypass cannot leak
 * a confidence number to the user.
 *
 * Targets the pure `computeBadgeView` helper, not the JSX component,
 * so the test runs without the JSX transform pipeline. The component
 * is a thin shell that just renders the view object — if the view
 * never contains the forbidden number, neither does the rendered DOM.
 */

import { describe, expect, it } from "vitest"
import { computeBadgeView, type IBadgeView } from "@/lib/compatibility-badge-view"
import type { ICompatibilityEdge } from "@festivus/types"

/**
 * Build a tier-N edge with intentionally-leaked success_rate and
 * episodes_tested values, plus an evidence URL and environment string
 * that should also stay out of the rendered output for tier 3/4.
 */
function leakingEdge(overrides: Pick<ICompatibilityEdge, "source" | "status">): ICompatibilityEdge {
  return {
    robot_slug: "leaky-robot",
    policy_slug: "leaky-policy",
    success_rate: 0.91,
    episodes_tested: 500,
    environment: "real (sneaky leak)",
    evidence_url: "https://arxiv.org/abs/9999.99999",
    gaps: ["data bug — this number should never be rendered"],
    updated_at: "2026-04-12",
    ...overrides,
  }
}

// Numbers and number-strings that must NEVER appear anywhere in the rendered
// view text for tier 3 or tier 4. Cover every plausible format the renderer
// could pick (raw float, percent, "ep" suffix, episode count, arxiv id).
const FORBIDDEN_NUMBERS = [
  "0.91", "91%", "91 %", "91",
  "500 ep", "500ep", "500 episodes", "500",
  "9999.99999",
  "sneaky leak",
]

/**
 * Concatenate every string the renderer would put in the DOM. The JSX
 * component renders glyph + tierLabel + label + helper, so the same four
 * fields are the entire surface area to grep over.
 */
function visibleText(view: IBadgeView): string {
  return `${view.glyph} ${view.tierLabel} ${view.label} ${view.helper ?? ""}`
}

function assertNoForbiddenNumbers(view: IBadgeView, label: string): void {
  const text = visibleText(view)
  for (const forbidden of FORBIDDEN_NUMBERS) {
    expect(
      text.includes(forbidden),
      `${label}: rendered output must NOT contain "${forbidden}" but found it in: ${text}`,
    ).toBe(false)
  }
}

describe("CompatibilityBadge — defense in depth (Step 5.3)", () => {
  // ── Tier 3 ──────────────────────────────────────────────────────

  describe("tier 3 (inferred + untested) with leaked confidence numbers", () => {
    const edge = leakingEdge({ source: "inferred", status: "untested" })
    const view = computeBadgeView(edge)

    it("computes tier 3", () => {
      expect(view.tier).toBe(3)
      expect(view.tierLabel).toBe("T3")
    })

    it("renders the grey/stone color, not green or amber", () => {
      expect(view.containerClass).toMatch(/stone/)
      expect(view.containerClass).not.toMatch(/green/)
      expect(view.containerClass).not.toMatch(/amber/)
    })

    it("does NOT render any forbidden number from the leaking edge", () => {
      assertNoForbiddenNumbers(view, "tier 3")
    })

    it("does NOT render the leaked environment string", () => {
      expect(visibleText(view)).not.toContain("sneaky leak")
    })

    it("DOES render the gap reason (the legitimate signal for an untested edge)", () => {
      expect(view.helper).toContain("data bug")
    })
  })

  // ── Tier 4 ──────────────────────────────────────────────────────

  describe("tier 4 (taxonomy-match + inferred) with leaked confidence numbers", () => {
    const edge = leakingEdge({ source: "taxonomy-match", status: "inferred" })
    const view = computeBadgeView(edge)

    it("computes tier 4", () => {
      expect(view.tier).toBe(4)
      expect(view.tierLabel).toBe("T4")
    })

    it("renders the grey/stone color, not green or amber", () => {
      expect(view.containerClass).toMatch(/stone/)
      expect(view.containerClass).not.toMatch(/green/)
      expect(view.containerClass).not.toMatch(/amber/)
    })

    it("does NOT render any forbidden number from the leaking edge", () => {
      assertNoForbiddenNumbers(view, "tier 4")
    })

    it("does NOT render the evidence URL (taxonomy match has no real evidence)", () => {
      expect(visibleText(view)).not.toContain("9999.99999")
      expect(visibleText(view)).not.toContain("arxiv")
    })

    it("DOES render the 'needs verification' helper", () => {
      expect(view.helper).toBe("needs verification")
    })

    it("uses the literal word UNTESTED so the agent's prose can grep for it", () => {
      expect(view.label).toContain("UNTESTED")
    })
  })

  // ── Other taxonomy-match status combos ──────────────────────────

  describe("tier 4 (taxonomy-match + untested) — same defense", () => {
    const edge = leakingEdge({ source: "taxonomy-match", status: "untested" })
    const view = computeBadgeView(edge)

    it("still classifies as tier 4", () => {
      expect(view.tier).toBe(4)
    })

    it("still drops every forbidden number", () => {
      assertNoForbiddenNumbers(view, "tier 4 (untested status variant)")
    })
  })

  // ── Sanity: tier 1 SHOULD render numbers ────────────────────────

  describe("tier 1 (paper + verified) — sanity check that the dropper is tier-aware, not blanket", () => {
    const edge: ICompatibilityEdge = {
      robot_slug: "real-robot",
      policy_slug: "real-policy",
      status: "verified",
      source: "paper",
      success_rate: 0.91,
      episodes_tested: 500,
      environment: "real",
      evidence_url: "https://arxiv.org/abs/2303.04137",
      gaps: [],
      updated_at: "2026-04-10",
    }
    const view = computeBadgeView(edge)

    it("computes tier 1", () => {
      expect(view.tier).toBe(1)
    })

    it("DOES render the success rate as a percent", () => {
      expect(view.label).toContain("91%")
    })

    it("DOES render the episode count", () => {
      expect(view.label).toContain("500 ep")
    })

    it("uses green color, not stone or amber", () => {
      expect(view.containerClass).toMatch(/green/)
    })
  })
})
