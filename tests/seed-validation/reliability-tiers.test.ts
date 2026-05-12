/**
 * Reliability tier tests.
 *
 * Covers the three pieces of the tier system that the agent depends on:
 *
 *   1. reliabilityTier(edge) — pure function, source+status → tier number
 *   2. compatibilityEdgeSchema — Zod schema rejects impossible combos
 *   3. summarizeEdgesByTier(edges) — aggregation that NEVER conflates tiers
 *
 * The whole point of this layer is the spec invariant: the agent must
 * never display 36,232 taxonomy-match guesses as if they were the same
 * thing as 11 paper-verified evaluations.
 */

import { describe, expect, it } from "vitest"
import {
  compatibilityEdgeSchema,
  reliabilityTier,
  summarizeEdgesByTier,
} from "@/lib/schemas/domain"

// ── reliabilityTier ───────────────────────────────────────────────

describe("reliabilityTier", () => {
  it("paper + verified is tier 1", () => {
    expect(reliabilityTier({ source: "paper", status: "verified" })).toBe(1)
  })

  it("community + reported is tier 2", () => {
    expect(reliabilityTier({ source: "community", status: "reported" })).toBe(2)
  })

  it("community + verified is also tier 2 (community-verified, no published paper)", () => {
    expect(reliabilityTier({ source: "community", status: "verified" })).toBe(2)
  })

  it("paper + reported demotes to tier 2 (paper exists but no first-hand benchmark)", () => {
    expect(reliabilityTier({ source: "paper", status: "reported" })).toBe(2)
  })

  it("inferred + untested is tier 3", () => {
    expect(reliabilityTier({ source: "inferred", status: "untested" })).toBe(3)
  })

  it("taxonomy-match + inferred is tier 4", () => {
    expect(reliabilityTier({ source: "taxonomy-match", status: "inferred" })).toBe(4)
  })

  it("taxonomy-match + untested is also tier 4", () => {
    expect(reliabilityTier({ source: "taxonomy-match", status: "untested" })).toBe(4)
  })

  it("returns null for impossible combos", () => {
    expect(reliabilityTier({ source: "paper", status: "inferred" })).toBeNull()
    expect(reliabilityTier({ source: "paper", status: "untested" })).toBeNull()
    expect(reliabilityTier({ source: "taxonomy-match", status: "verified" })).toBeNull()
    expect(reliabilityTier({ source: "taxonomy-match", status: "reported" })).toBeNull()
    expect(reliabilityTier({ source: "inferred", status: "verified" })).toBeNull()
    expect(reliabilityTier({ source: "community", status: "untested" })).toBeNull()
  })
})

// ── Zod refinement: impossible combos rejected ────────────────────

const baseEdge = {
  slug: "franka-panda__diffusion-policy-pusht__real",
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

describe("compatibilityEdgeSchema refinement", () => {
  it("accepts every canonical tier combo", () => {
    const combos: { source: string; status: string }[] = [
      { source: "paper", status: "verified" },
      { source: "paper", status: "reported" },
      { source: "community", status: "verified" },
      { source: "community", status: "reported" },
      { source: "inferred", status: "untested" },
      { source: "taxonomy-match", status: "inferred" },
      { source: "taxonomy-match", status: "untested" },
    ]
    for (const c of combos) {
      const result = compatibilityEdgeSchema.safeParse({ ...baseEdge, ...c })
      expect(result.success, `combo ${c.source}+${c.status} should parse`).toBe(true)
    }
  })

  it("REJECTS source=paper with status=inferred", () => {
    const result = compatibilityEdgeSchema.safeParse({ ...baseEdge, status: "inferred" })
    expect(result.success).toBe(false)
  })

  it("REJECTS source=taxonomy-match with status=verified", () => {
    const result = compatibilityEdgeSchema.safeParse({
      ...baseEdge,
      source: "taxonomy-match",
      status: "verified",
    })
    expect(result.success).toBe(false)
  })

  it("REJECTS source=taxonomy-match with status=reported", () => {
    const result = compatibilityEdgeSchema.safeParse({
      ...baseEdge,
      source: "taxonomy-match",
      status: "reported",
    })
    expect(result.success).toBe(false)
  })

  it("REJECTS source=inferred with status=verified", () => {
    const result = compatibilityEdgeSchema.safeParse({ ...baseEdge, source: "inferred", status: "verified" })
    expect(result.success).toBe(false)
  })

  it("error message names the offending source and status", () => {
    const result = compatibilityEdgeSchema.safeParse({ ...baseEdge, status: "inferred" })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(" ")
      expect(messages).toContain("paper")
      expect(messages).toContain("inferred")
    }
  })
})

// ── summarizeEdgesByTier ──────────────────────────────────────────

describe("summarizeEdgesByTier", () => {
  it("groups a mixed list of edges by tier without conflation", () => {
    const edges = [
      { source: "paper", status: "verified" },
      { source: "paper", status: "verified" },
      { source: "community", status: "reported" },
      { source: "inferred", status: "untested" },
      { source: "taxonomy-match", status: "inferred" },
      { source: "taxonomy-match", status: "inferred" },
      { source: "taxonomy-match", status: "inferred" },
    ]
    expect(summarizeEdgesByTier(edges)).toEqual({
      tier1: 2,
      tier2: 1,
      tier3: 1,
      tier4: 3,
      unknown: 0,
    })
  })

  it("counts impossible combos under unknown so they can never bleed into a tier", () => {
    const edges = [
      { source: "paper", status: "verified" },
      { source: "paper", status: "inferred" }, // impossible
      { source: "taxonomy-match", status: "verified" }, // impossible
    ]
    expect(summarizeEdgesByTier(edges)).toEqual({
      tier1: 1,
      tier2: 0,
      tier3: 0,
      tier4: 0,
      unknown: 2,
    })
  })

  it("tier4 count is reported separately so callers cannot say 'N compatible policies'", () => {
    // 36K taxonomy-match edges + 11 paper-verified is what the real dataset looks like.
    const edges = [
      ...Array.from({ length: 36000 }, () => ({ source: "taxonomy-match", status: "inferred" })),
      ...Array.from({ length: 11 }, () => ({ source: "paper", status: "verified" })),
    ]
    const summary = summarizeEdgesByTier(edges)
    // The point: anyone reading these counts immediately sees 36,000 are
    // tier-4 guesses. There is no single "compatible" number that conflates them.
    expect(summary.tier1).toBe(11)
    expect(summary.tier4).toBe(36000)
    expect(summary.tier1 + summary.tier4).toBe(36011)
  })
})
