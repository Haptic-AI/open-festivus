/**
 * Compatibility edge tests.
 *
 * The `data/*.json` in this repo currently ships ~36K compatibility edges
 * (20 hand-curated + 36K taxonomy-matched). The Zod schema must accept
 * BOTH shapes:
 *
 *   - paper-sourced edge:    success_rate + episodes + evidence URL populated
 *   - taxonomy-match edge:   success_rate / episodes / environment / evidence_url all null
 *
 * This file also runs cross-reference checks: every edge points at non-empty
 * robot_slug and policy_slug strings, every status is in the enum, every
 * source is in the enum.
 */

import { describe, expect, it } from "vitest"
import { compatibilityEdgeSchema, parseCompatibilityEdges } from "@/lib/schemas/domain"

const edges = [
  {
    slug: "aloha-2__act-aloha-sim-transfer-cube__sim-mujoco",
    robot_slug: "aloha-2",
    policy_slug: "act-aloha-sim-transfer-cube",
    status: "verified",
    success_rate: 0.96,
    episodes_tested: 500,
    environment: "sim (MuJoCo)",
    source: "paper",
    evidence_url: "https://arxiv.org/abs/2304.13705",
    gaps: [],
    updated_at: "2026-04-10",
  },
  {
    slug: "franka-panda__rt-1__global",
    robot_slug: "franka-panda",
    policy_slug: "rt-1",
    status: "reported",
    success_rate: null,
    episodes_tested: null,
    environment: null,
    source: "community",
    evidence_url: null,
    gaps: ["no published benchmarks for Franka specifically"],
    updated_at: "2026-04-10",
  },
  {
    slug: "agilex-piper__openvla-openvla-7b__global",
    robot_slug: "agilex-piper",
    policy_slug: "openvla-openvla-7b",
    status: "inferred",
    success_rate: null,
    episodes_tested: null,
    environment: null,
    source: "taxonomy-match",
    evidence_url: null,
    gaps: [],
    updated_at: "2026-04-12",
  },
]

describe("compatibilityEdgeSchema", () => {
  it("accepts a paper-sourced verified edge", () => {
    const result = compatibilityEdgeSchema.safeParse(edges[0])
    expect(result.success).toBe(true)
  })

  it("accepts a community-reported edge with all metric fields null", () => {
    const result = compatibilityEdgeSchema.safeParse(edges[1])
    expect(result.success).toBe(true)
  })

  it("accepts a taxonomy-matched inferred edge", () => {
    const result = compatibilityEdgeSchema.safeParse(edges[2])
    expect(result.success).toBe(true)
  })

  it("rejects an edge with an unknown status value", () => {
    const result = compatibilityEdgeSchema.safeParse({ ...edges[0], status: "approved" })
    expect(result.success).toBe(false)
  })

  it("rejects an edge with an unknown source value", () => {
    const result = compatibilityEdgeSchema.safeParse({ ...edges[0], source: "scraped" })
    expect(result.success).toBe(false)
  })

  it("rejects an edge missing the robot_slug field", () => {
    const broken = { ...edges[0] } as Record<string, unknown>
    delete broken["robot_slug"]
    const result = compatibilityEdgeSchema.safeParse(broken)
    expect(result.success).toBe(false)
  })

  it("rejects an edge where gaps is not an array", () => {
    const result = compatibilityEdgeSchema.safeParse({ ...edges[0], gaps: "no gaps" })
    expect(result.success).toBe(false)
  })
})

describe("parseCompatibilityEdges", () => {
  it("parses a list of mixed-source edges", () => {
    const parsed = parseCompatibilityEdges(edges)
    expect(parsed).not.toBeNull()
    expect(parsed?.length).toBe(3)
  })

  it("returns null when any edge in the list is malformed", () => {
    const parsed = parseCompatibilityEdges([edges[0], { ...edges[1], status: "wat" }])
    expect(parsed).toBeNull()
  })

  it("every parsed edge has non-empty robot_slug and policy_slug", () => {
    const parsed = parseCompatibilityEdges(edges)
    expect(parsed).not.toBeNull()
    for (const edge of parsed ?? []) {
      expect(edge.robot_slug.length).toBeGreaterThan(0)
      expect(edge.policy_slug.length).toBeGreaterThan(0)
    }
  })

  it("every parsed edge has a known status and source", () => {
    const parsed = parseCompatibilityEdges(edges)
    const validStatuses = new Set(["verified", "reported", "inferred", "untested"])
    const validSources = new Set(["paper", "community", "inferred", "taxonomy-match"])
    for (const edge of parsed ?? []) {
      expect(validStatuses.has(edge.status)).toBe(true)
      expect(validSources.has(edge.source)).toBe(true)
    }
  })
})
