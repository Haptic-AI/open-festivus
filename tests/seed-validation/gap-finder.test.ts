/**
 * Gap finder tests (Step 3.4).
 *
 * Asserts the agent helper that powers shape 21 (X→G):
 *   - Robots with no compatible policies anywhere
 *   - Robots whose only evidence is tier-4 (high-value verify targets)
 *   - Tasks with no compatible_policy_slugs (unsolved problems)
 *   - Policies with no verified evidence (tier-3/4 only or no benchmarks)
 *   - Tier-4-only edge counts
 *
 * The plan calls for "Unit test: finds robots with no policies." Done plus
 * coverage for every category in the report.
 */

import { describe, expect, it } from "vitest"
import {
  countTier4Edges,
  findGaps,
  findPoliciesWithoutVerifiedEvidence,
  findRobotsWithOnlyTier4Evidence,
  findRobotsWithoutPolicies,
  findTasksWithoutData,
} from "@/lib/agent/gap-finder"
import type { ICompatibilityEdge, IPolicy, IRobot, ITask } from "@festivus/types"

// ── Fixtures ──────────────────────────────────────────────────────

function makeRobot(overrides: Partial<IRobot> & Pick<IRobot, "slug" | "name">): IRobot {
  return {
    id: overrides.slug,
    slug: overrides.slug,
    name: overrides.name,
    manufacturer: "Acme",
    type: "arm",
    dof: 6,
    sensors: [],
    actuators: "",
    price_usd: null,
    weight_kg: null,
    build_paths: [],
    deploy_readiness: "lab_only",
    compatible_policy_slugs: [],
    compatible_env_slugs: [],
    image_url: null,
    community_size: "small",
    description: "",
    taxonomy: null,
    ...overrides,
  }
}

function makePolicy(overrides: Partial<IPolicy> & Pick<IPolicy, "slug" | "name">): IPolicy {
  return {
    id: overrides.slug,
    slug: overrides.slug,
    name: overrides.name,
    author: "",
    framework: "",
    license: "",
    task_description: "",
    skill_type: "manipulation",
    action_space: { type: "other", dimensions: null, frequency_hz: null },
    observation_space: { type: "other", components: [] },
    compatible_robot_slugs: [],
    compatible_env_slugs: [],
    benchmarks: [],
    hf_repo_id: null,
    paper_arxiv_url: null,
    evidence_level: "untested",
    taxonomy: null,
    ...overrides,
  }
}

function makeTask(overrides: Partial<ITask> & Pick<ITask, "slug" | "name">): ITask {
  return {
    id: overrides.slug,
    slug: overrides.slug,
    name: overrides.name,
    category: "manipulation",
    description: "",
    sub_tasks: ["a", "b"],
    required_capabilities: [],
    compatible_robot_types: ["arm"],
    compatible_policy_slugs: [],
    difficulty: "medium",
    has_real_world_demo: false,
    ...overrides,
  }
}

function makeEdge(robot_slug: string, policy_slug: string, source: string, status: string): ICompatibilityEdge {
  return {
    robot_slug,
    policy_slug,
    status: status as ICompatibilityEdge["status"],
    success_rate: null,
    episodes_tested: null,
    environment: null,
    source: source as ICompatibilityEdge["source"],
    evidence_url: null,
    gaps: [],
    updated_at: "2026-04-12",
  }
}

// ── findRobotsWithoutPolicies (the spec's example test) ───────────

describe("findRobotsWithoutPolicies (spec's canonical test)", () => {
  it("finds a robot with empty compatible_policy_slugs and no edges", () => {
    const orphan = makeRobot({ slug: "lonely-bot", name: "Lonely Bot" })
    const popular = makeRobot({
      slug: "popular-bot",
      name: "Popular Bot",
      compatible_policy_slugs: ["octo-base"],
    })
    const gaps = findRobotsWithoutPolicies([orphan, popular], [])
    expect(gaps.length).toBe(1)
    expect(gaps[0]?.robot.slug).toBe("lonely-bot")
    expect(gaps[0]?.reason).toContain("no compatible policies")
  })

  it("does NOT flag a robot if it has an edge in the dataset (even with empty array)", () => {
    const robot = makeRobot({ slug: "edge-only", name: "Edge Only" })
    const edge = makeEdge("edge-only", "octo-base", "paper", "verified")
    const gaps = findRobotsWithoutPolicies([robot], [edge])
    expect(gaps.length).toBe(0)
  })

  it("returns an empty list when every robot has at least one policy", () => {
    const a = makeRobot({ slug: "a", name: "A", compatible_policy_slugs: ["x"] })
    const b = makeRobot({ slug: "b", name: "B", compatible_policy_slugs: ["y"] })
    expect(findRobotsWithoutPolicies([a, b], [])).toEqual([])
  })
})

// ── findRobotsWithOnlyTier4Evidence ───────────────────────────────

describe("findRobotsWithOnlyTier4Evidence", () => {
  it("flags a robot whose only edges are tier-4 taxonomy matches", () => {
    const robot = makeRobot({ slug: "tax-only", name: "Tax Only" })
    const edges = [
      makeEdge("tax-only", "p1", "taxonomy-match", "inferred"),
      makeEdge("tax-only", "p2", "taxonomy-match", "inferred"),
      makeEdge("tax-only", "p3", "taxonomy-match", "inferred"),
    ]
    const gaps = findRobotsWithOnlyTier4Evidence([robot], edges)
    expect(gaps.length).toBe(1)
    expect(gaps[0]?.reason).toContain("3 compatibility edges are tier-4")
  })

  it("does NOT flag a robot with at least one tier-1 paper-verified edge", () => {
    const robot = makeRobot({ slug: "verified", name: "Verified" })
    const edges = [
      makeEdge("verified", "p1", "paper", "verified"),
      makeEdge("verified", "p2", "taxonomy-match", "inferred"),
    ]
    expect(findRobotsWithOnlyTier4Evidence([robot], edges)).toEqual([])
  })

  it("does not consider robots with zero edges (covered by the other category)", () => {
    const robot = makeRobot({ slug: "no-edges", name: "No Edges" })
    expect(findRobotsWithOnlyTier4Evidence([robot], [])).toEqual([])
  })
})

// ── findTasksWithoutData ──────────────────────────────────────────

describe("findTasksWithoutData", () => {
  it("flags tasks with empty compatible_policy_slugs", () => {
    const lonely = makeTask({ slug: "dance", name: "Dance" })
    const solved = makeTask({
      slug: "pick-and-place",
      name: "Pick and Place",
      compatible_policy_slugs: ["octo-base"],
    })
    const gaps = findTasksWithoutData([lonely, solved])
    expect(gaps.length).toBe(1)
    expect(gaps[0]?.task.slug).toBe("dance")
    expect(gaps[0]?.reason).toContain("no one has tried")
  })
})

// ── findPoliciesWithoutVerifiedEvidence ──────────────────────────

describe("findPoliciesWithoutVerifiedEvidence", () => {
  it("flags policies with no benchmarks AND no tier-1/2 edges", () => {
    const orphan = makePolicy({ slug: "lonely-policy", name: "Lonely Policy" })
    const verified = makePolicy({
      slug: "good-policy",
      name: "Good Policy",
      benchmarks: [{ robot: "x", environment: "real", success_rate: 0.9, episodes: 100 }],
    })
    const edges = [makeEdge("r", "good-policy", "paper", "verified")]
    const gaps = findPoliciesWithoutVerifiedEvidence([orphan, verified], edges)
    expect(gaps.length).toBe(1)
    expect(gaps[0]?.policy.slug).toBe("lonely-policy")
  })

  it("considers a tier-2 community edge as evidence (does NOT flag the policy)", () => {
    const policy = makePolicy({ slug: "tier2", name: "Tier 2" })
    const edges = [makeEdge("r", "tier2", "community", "reported")]
    expect(findPoliciesWithoutVerifiedEvidence([policy], edges)).toEqual([])
  })

  it("does NOT consider tier-4 edges as evidence — flags the policy", () => {
    const policy = makePolicy({ slug: "tier4", name: "Tier 4" })
    const edges = [makeEdge("r", "tier4", "taxonomy-match", "inferred")]
    const gaps = findPoliciesWithoutVerifiedEvidence([policy], edges)
    expect(gaps.length).toBe(1)
  })
})

// ── countTier4Edges ───────────────────────────────────────────────

describe("countTier4Edges", () => {
  it("counts only tier-4 edges in a mixed-source list", () => {
    const edges = [
      makeEdge("a", "p", "paper", "verified"),
      makeEdge("b", "p", "community", "reported"),
      makeEdge("c", "p", "taxonomy-match", "inferred"),
      makeEdge("d", "p", "taxonomy-match", "inferred"),
      makeEdge("e", "p", "inferred", "untested"),
    ]
    expect(countTier4Edges(edges)).toBe(2)
  })
})

// ── Aggregate findGaps ────────────────────────────────────────────

describe("findGaps (aggregate)", () => {
  it("returns a single report covering all five categories", () => {
    const robots: IRobot[] = [
      makeRobot({ slug: "lonely", name: "Lonely" }),
      makeRobot({ slug: "tier4-only", name: "Tier 4 Only" }),
      makeRobot({ slug: "verified", name: "Verified", compatible_policy_slugs: ["good"] }),
    ]
    const policies: IPolicy[] = [
      makePolicy({ slug: "good", name: "Good", benchmarks: [{ robot: "x", environment: "real", success_rate: 0.9, episodes: 100 }] }),
      makePolicy({ slug: "lonely-policy", name: "Lonely Policy" }),
    ]
    const tasks: ITask[] = [
      makeTask({ slug: "solved", name: "Solved", compatible_policy_slugs: ["good"] }),
      makeTask({ slug: "unsolved", name: "Unsolved" }),
    ]
    const edges: ICompatibilityEdge[] = [
      makeEdge("verified", "good", "paper", "verified"),
      makeEdge("tier4-only", "x", "taxonomy-match", "inferred"),
      makeEdge("tier4-only", "y", "taxonomy-match", "inferred"),
    ]
    const report = findGaps({ robots, policies, tasks, edges })

    expect(report.robotsWithoutPolicies.map((g) => g.robot.slug)).toEqual(["lonely"])
    expect(report.robotsWithOnlyTier4Evidence.map((g) => g.robot.slug)).toEqual(["tier4-only"])
    expect(report.tasksWithoutData.map((g) => g.task.slug)).toEqual(["unsolved"])
    expect(report.policiesWithoutVerifiedEvidence.map((g) => g.policy.slug)).toEqual(["lonely-policy"])
    expect(report.counts.tier4OnlyEdges).toBe(2)
    expect(report.counts.robotsWithoutPolicies).toBe(1)
    expect(report.counts.robotsWithOnlyTier4Evidence).toBe(1)
    expect(report.counts.tasksWithoutData).toBe(1)
    expect(report.counts.policiesWithoutVerifiedEvidence).toBe(1)
  })

  it("returns empty arrays + zero counts on empty input (no false positives)", () => {
    const report = findGaps({ robots: [], policies: [], tasks: [], edges: [] })
    expect(report.robotsWithoutPolicies).toEqual([])
    expect(report.counts.tier4OnlyEdges).toBe(0)
  })
})
