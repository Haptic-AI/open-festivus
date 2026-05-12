/**
 * Gap finder — surfaces holes in the dataset for shape 21 (X→G).
 *
 * The whole point of the system is "reveal gaps instead of hallucinate."
 * The api-tools `find_gaps` dispatcher calls the API for one domain at a
 * time; this module is the higher-level agent helper that takes already-
 * fetched lists and produces structured reports the Community Scout can
 * cite verbatim.
 *
 * Categories surfaced:
 *   1. Robots with no compatible policies at all
 *   2. Robots whose only evidence is tier-4 (taxonomy guess) — high-value
 *      verification candidates per spec Rule 5
 *   3. Tasks with no compatible policies (no one has tried to solve this)
 *   4. Policies with no verified evidence (only sim or community reports)
 *   5. Tier-4-only edges (verification opportunity counts)
 *
 * Each gap carries a `reason` string the agent can quote directly. No
 * invented numbers — every count comes from data the caller passed in.
 */

import type { ICompatibilityEdge, IPolicy, IRobot, ITask } from "@festivus/types"
import { reliabilityTier } from "@/lib/schemas/domain"

export interface IRobotGap {
  robot: { slug: string; name: string }
  reason: string
}

export interface ITaskGap {
  task: { slug: string; name: string }
  reason: string
}

export interface IPolicyGap {
  policy: { slug: string; name: string }
  reason: string
}

export interface IGapReport {
  /** Robots that have zero compatible policies anywhere in the dataset. */
  robotsWithoutPolicies: IRobotGap[]
  /** Robots whose ONLY compatibility evidence is tier-4 taxonomy guesses. */
  robotsWithOnlyTier4Evidence: IRobotGap[]
  /** Tasks with no compatible_policy_slugs (no one has tried this). */
  tasksWithoutData: ITaskGap[]
  /** Policies with no benchmark and no verified compatibility edge. */
  policiesWithoutVerifiedEvidence: IPolicyGap[]
  /** Aggregate counts the agent can cite as "X high-value verification targets". */
  counts: {
    robotsWithoutPolicies: number
    robotsWithOnlyTier4Evidence: number
    tasksWithoutData: number
    policiesWithoutVerifiedEvidence: number
    tier4OnlyEdges: number
  }
}

// ── Individual finders ────────────────────────────────────────────

/**
 * Robots that have NO compatible policy in the dataset. Checks both the
 * loose `compatible_policy_slugs` array on the robot record AND the
 * compatibility edges, since either can be the source of truth.
 */
export function findRobotsWithoutPolicies(robots: readonly IRobot[], edges: readonly ICompatibilityEdge[]): IRobotGap[] {
  const robotsWithEdges = new Set(edges.map((e) => e.robot_slug))
  const gaps: IRobotGap[] = []
  for (const robot of robots) {
    const hasLoose = robot.compatible_policy_slugs.length > 0
    const hasEdge = robotsWithEdges.has(robot.slug)
    if (!hasLoose && !hasEdge) {
      gaps.push({
        robot: { slug: robot.slug, name: robot.name },
        reason: "no compatible policies in compatible_policy_slugs and no compatibility edges in the dataset",
      })
    }
  }
  return gaps
}

/**
 * Robots whose ONLY compatibility evidence is tier-4 (taxonomy-match).
 * These are the highest-value verification targets per Rule 5: someone
 * should run a real test on them, but no one has.
 */
export function findRobotsWithOnlyTier4Evidence(robots: readonly IRobot[], edges: readonly ICompatibilityEdge[]): IRobotGap[] {
  const edgesBySlug = new Map<string, ICompatibilityEdge[]>()
  for (const edge of edges) {
    const list = edgesBySlug.get(edge.robot_slug) ?? []
    list.push(edge)
    edgesBySlug.set(edge.robot_slug, list)
  }
  const gaps: IRobotGap[] = []
  for (const robot of robots) {
    const robotEdges = edgesBySlug.get(robot.slug) ?? []
    if (robotEdges.length === 0) continue
    const allTier4 = robotEdges.every((e) => reliabilityTier(e) === 4)
    if (allTier4) {
      gaps.push({
        robot: { slug: robot.slug, name: robot.name },
        reason: `all ${robotEdges.length} compatibility edge${robotEdges.length === 1 ? "" : "s"} are tier-4 taxonomy matches — never tested in sim or real`,
      })
    }
  }
  return gaps
}

/**
 * Tasks with no compatible_policy_slugs. The dataset has the task defined
 * (someone wrote the description, sub_tasks, required_capabilities) but no
 * one has wired a policy to it.
 */
export function findTasksWithoutData(tasks: readonly ITask[]): ITaskGap[] {
  const gaps: ITaskGap[] = []
  for (const task of tasks) {
    if (task.compatible_policy_slugs.length === 0) {
      gaps.push({
        task: { slug: task.slug, name: task.name },
        reason: `task is in the dataset (${task.sub_tasks.length} sub-tasks defined) but has zero compatible_policy_slugs — no one has tried to solve it`,
      })
    }
  }
  return gaps
}

/**
 * Policies with no benchmarks AND no tier-1 or tier-2 compatibility edges.
 * These are policies that exist in the dataset (slug, framework, paper)
 * but have no published evidence anyone has actually tested them.
 */
export function findPoliciesWithoutVerifiedEvidence(policies: readonly IPolicy[], edges: readonly ICompatibilityEdge[]): IPolicyGap[] {
  const goodEdgeSlugs = new Set<string>()
  for (const edge of edges) {
    const tier = reliabilityTier(edge)
    if (tier === 1 || tier === 2) goodEdgeSlugs.add(edge.policy_slug)
  }
  const gaps: IPolicyGap[] = []
  for (const policy of policies) {
    const hasBenchmark = policy.benchmarks.length > 0
    const hasGoodEdge = goodEdgeSlugs.has(policy.slug)
    if (!hasBenchmark && !hasGoodEdge) {
      gaps.push({
        policy: { slug: policy.slug, name: policy.name },
        reason: `evidence_level=${policy.evidence_level}, zero benchmarks, zero tier-1 or tier-2 compatibility edges`,
      })
    }
  }
  return gaps
}

/**
 * Count edges that are tier 4 (taxonomy-match). Useful for the agent's
 * "47 high-value verification targets" call to action.
 */
export function countTier4Edges(edges: readonly ICompatibilityEdge[]): number {
  let count = 0
  for (const edge of edges) {
    if (reliabilityTier(edge) === 4) count += 1
  }
  return count
}

// ── Aggregate ─────────────────────────────────────────────────────

export interface IFindGapsInput {
  robots: readonly IRobot[]
  policies: readonly IPolicy[]
  tasks: readonly ITask[]
  edges: readonly ICompatibilityEdge[]
}

export function findGaps(input: IFindGapsInput): IGapReport {
  const robotsWithoutPolicies = findRobotsWithoutPolicies(input.robots, input.edges)
  const robotsWithOnlyTier4Evidence = findRobotsWithOnlyTier4Evidence(input.robots, input.edges)
  const tasksWithoutData = findTasksWithoutData(input.tasks)
  const policiesWithoutVerifiedEvidence = findPoliciesWithoutVerifiedEvidence(input.policies, input.edges)
  const tier4OnlyEdges = countTier4Edges(input.edges)
  return {
    robotsWithoutPolicies,
    robotsWithOnlyTier4Evidence,
    tasksWithoutData,
    policiesWithoutVerifiedEvidence,
    counts: {
      robotsWithoutPolicies: robotsWithoutPolicies.length,
      robotsWithOnlyTier4Evidence: robotsWithOnlyTier4Evidence.length,
      tasksWithoutData: tasksWithoutData.length,
      policiesWithoutVerifiedEvidence: policiesWithoutVerifiedEvidence.length,
      tier4OnlyEdges,
    },
  }
}
