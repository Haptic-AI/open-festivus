/**
 * CompatibilityBadge view tests.
 *
 * Targets `computeBadgeView` (the pure helper extracted in Step 5.3),
 * not the JSX component, so vitest can run without a JSX transform
 * pipeline. The .tsx component is a thin wrapper that just renders
 * whatever this function returns.
 *
 *   - Each tier produces the right glyph + label + color class
 *   - Tier 3 / tier 4 NEVER include success_rate, even when present
 *   - Tier 1 cites the success_rate only when present
 *   - tierLabel reflects the computed tier (or "?" for impossible combos)
 *
 * Defense-in-depth assertions live in badge-defense-in-depth.test.ts;
 * this file pins the happy paths.
 */

import { describe, expect, it } from "vitest"
import { computeBadgeView } from "@/lib/compatibility-badge-view"
import type { ICompatibilityEdge } from "@festivus/types"

const baseEdge: ICompatibilityEdge = {
  robot_slug: "franka-panda",
  policy_slug: "diffusion-policy-pusht",
  status: "verified",
  success_rate: 0.91,
  episodes_tested: 200,
  environment: "real",
  source: "paper",
  evidence_url: "https://arxiv.org/abs/2303.04137",
  gaps: [],
  updated_at: "2026-04-10",
}

describe("computeBadgeView — tier 1 (paper-verified)", () => {
  const view = computeBadgeView(baseEdge)

  it("computes tier 1 with label T1", () => {
    expect(view.tier).toBe(1)
    expect(view.tierLabel).toBe("T1")
  })

  it("uses green styling", () => {
    expect(view.containerClass).toMatch(/green/)
  })

  it("renders the success rate as a whole percent", () => {
    expect(view.label).toContain("91%")
  })

  it("renders the episode count", () => {
    expect(view.label).toContain("200 ep")
  })

  it("uses the green check glyph and the Verified label", () => {
    expect(view.glyph).toBe("✅")
    expect(view.label).toContain("Verified")
  })

  it("surfaces the evidence URL as the helper", () => {
    expect(view.helper).toBe("https://arxiv.org/abs/2303.04137")
  })
})

describe("computeBadgeView — tier 2 (community-reported)", () => {
  const edge: ICompatibilityEdge = {
    ...baseEdge,
    source: "community",
    status: "reported",
    success_rate: null,
    episodes_tested: null,
    environment: null,
    evidence_url: null,
  }
  const view = computeBadgeView(edge)

  it("uses amber styling", () => {
    expect(view.containerClass).toMatch(/amber/)
  })

  it("labels as Reported with the no-benchmark helper", () => {
    expect(view.label).toBe("Reported")
    expect(view.helper).toBe("No published benchmark")
  })

  it("sets tierLabel to T2", () => {
    expect(view.tierLabel).toBe("T2")
  })
})

describe("computeBadgeView — tier 3 (hand-inferred / untested)", () => {
  const edge: ICompatibilityEdge = {
    ...baseEdge,
    source: "inferred",
    status: "untested",
    success_rate: 0.42, // intentionally set — must NOT appear in the rendered output
    episodes_tested: 99,
    evidence_url: null,
    gaps: ["matching action space, no test performed"],
  }
  const view = computeBadgeView(edge)

  it("uses stone (grey) styling", () => {
    expect(view.containerClass).toMatch(/stone/)
  })

  it("labels as Untested but plausible", () => {
    expect(view.label).toContain("Untested")
  })

  it("displays the first gap as the helper", () => {
    expect(view.helper).toContain("matching action space")
  })

  it("does NOT include the (impossible) success_rate from a tier-3 edge", () => {
    expect(view.label).not.toContain("42")
    expect(view.helper ?? "").not.toContain("42")
  })

  it("does NOT include the (impossible) episodes_tested from a tier-3 edge", () => {
    expect(view.label).not.toContain("99")
    expect(view.helper ?? "").not.toContain("99")
  })

  it("sets tierLabel to T3", () => {
    expect(view.tierLabel).toBe("T3")
  })
})

describe("computeBadgeView — tier 4 (taxonomy-match)", () => {
  const edge: ICompatibilityEdge = {
    ...baseEdge,
    source: "taxonomy-match",
    status: "inferred",
    success_rate: 0.88, // ALSO intentional — even if a script computed one, never show it
    episodes_tested: 500,
    evidence_url: null,
    gaps: [],
  }
  const view = computeBadgeView(edge)

  it("uses stone (grey) styling", () => {
    expect(view.containerClass).toMatch(/stone/)
  })

  it("labels as Taxonomically compatible — UNTESTED", () => {
    expect(view.label).toContain("Taxonomically compatible")
    expect(view.label).toContain("UNTESTED")
  })

  it("does NOT include the (impossible) success_rate from a tier-4 edge", () => {
    expect(view.label).not.toContain("88")
    expect(view.helper ?? "").not.toContain("88")
  })

  it("does NOT include the (impossible) episodes_tested", () => {
    expect(view.label).not.toContain("500")
    expect(view.helper ?? "").not.toContain("500")
  })

  it("includes the needs-verification helper", () => {
    expect(view.helper).toBe("needs verification")
  })

  it("sets tierLabel to T4", () => {
    expect(view.tierLabel).toBe("T4")
  })
})

describe("computeBadgeView — defensive: impossible source/status combo", () => {
  // The Zod refinement on compatibilityEdgeSchema rejects this at parse time,
  // but if a malformed edge slips through (e.g., from mocked data), the badge
  // must still degrade safely instead of silently displaying as "compatible".
  const edge = {
    ...baseEdge,
    source: "paper",
    status: "inferred", // impossible: a paper isn't an inference
  } as unknown as ICompatibilityEdge
  const view = computeBadgeView(edge)

  it("returns tier=null for an impossible combo", () => {
    expect(view.tier).toBeNull()
    expect(view.tierLabel).toBe("?")
  })

  it("renders the impossible-combo warning instead of a tier badge", () => {
    expect(view.label).toContain("Impossible")
  })

  it("uses red styling so the gap is visible", () => {
    expect(view.containerClass).toMatch(/red/)
  })
})
