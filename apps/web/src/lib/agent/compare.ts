/**
 * Compare agent — produces structured diffs for shapes 18 (RxR→C) and 19 (PxP→C).
 *
 * Pure functions. The recipe layer (Step 3.2) plans the get_robot_full or
 * search_policies calls; the route layer executes them; this module turns
 * the resulting records into a structured diff the agent can render as a
 * side-by-side table.
 *
 * Output is a flat list of axes plus a one-paragraph summary. The agent
 * uses the axes to populate `add_node` cards and the summary to populate
 * `show_agent_message`.
 */

import type { IPolicy, IRobot } from "@festivus/types"

export type IComparisonValue = string | number | null

export interface ICompareAxis {
  /** Human-readable axis name shown in the table header. */
  label: string
  leftValue: IComparisonValue
  rightValue: IComparisonValue
  /** True when both sides have the same effective value. */
  agree: boolean
  /** For numeric axes: who wins on a "more is better" or explicit semantic. */
  winner: "left" | "right" | "tie" | "n/a"
  /** Optional one-line difference note for the table. */
  note?: string
}

export interface IRobotComparison {
  left: { slug: string; name: string }
  right: { slug: string; name: string }
  axes: ICompareAxis[]
  summary: string
}

export interface IPolicyComparison {
  left: { slug: string; name: string }
  right: { slug: string; name: string }
  axes: ICompareAxis[]
  summary: string
}

// ── Helpers ───────────────────────────────────────────────────────

function axisString(label: string, l: string | null, r: string | null, semantics: "match" | "info" = "match"): ICompareAxis {
  const agree = (l ?? "").trim().toLowerCase() === (r ?? "").trim().toLowerCase()
  return {
    label,
    leftValue: l,
    rightValue: r,
    agree,
    winner: semantics === "info" ? "n/a" : "n/a",
  }
}

function axisNumberHigherWins(label: string, l: number | null, r: number | null): ICompareAxis {
  if (l === null || r === null) {
    return { label, leftValue: l, rightValue: r, agree: l === r, winner: "n/a" }
  }
  const agree = l === r
  const winner: "left" | "right" | "tie" = agree ? "tie" : (l > r ? "left" : "right")
  return { label, leftValue: l, rightValue: r, agree, winner }
}

function axisNumberLowerWins(label: string, l: number | null, r: number | null): ICompareAxis {
  if (l === null || r === null) {
    return { label, leftValue: l, rightValue: r, agree: l === r, winner: "n/a" }
  }
  const agree = l === r
  const winner: "left" | "right" | "tie" = agree ? "tie" : (l < r ? "left" : "right")
  return { label, leftValue: l, rightValue: r, agree, winner }
}

function setOverlap<T>(left: readonly T[], right: readonly T[]): { both: T[]; onlyLeft: T[]; onlyRight: T[] } {
  const ls = new Set(left)
  const rs = new Set(right)
  const both: T[] = []
  const onlyLeft: T[] = []
  const onlyRight: T[] = []
  for (const x of ls) {
    if (rs.has(x)) both.push(x)
    else onlyLeft.push(x)
  }
  for (const x of rs) {
    if (!ls.has(x)) onlyRight.push(x)
  }
  return { both, onlyLeft, onlyRight }
}

function axisListOverlap(label: string, left: readonly string[], right: readonly string[]): ICompareAxis {
  const { both, onlyLeft, onlyRight } = setOverlap(left, right)
  const agree = onlyLeft.length === 0 && onlyRight.length === 0
  const noteParts: string[] = []
  if (both.length > 0) noteParts.push(`shared: ${both.join(", ")}`)
  if (onlyLeft.length > 0) noteParts.push(`only left: ${onlyLeft.join(", ")}`)
  if (onlyRight.length > 0) noteParts.push(`only right: ${onlyRight.join(", ")}`)
  return {
    label,
    leftValue: left.length === 0 ? null : left.join(", "),
    rightValue: right.length === 0 ? null : right.join(", "),
    agree,
    winner: "n/a",
    note: noteParts.join(" · "),
  }
}

// ── Robot compare ─────────────────────────────────────────────────

/**
 * Build a structured diff between two robots. Axes ordered roughly by
 * what a buyer cares about: price first, then capabilities, then taxonomy.
 *
 * Throws if either record has the same slug — comparing a record to
 * itself is almost always a bug.
 */
export function compareRobots(left: IRobot, right: IRobot): IRobotComparison {
  if (left.slug === right.slug) {
    throw new Error(`compareRobots: cannot compare a record to itself (slug=${left.slug})`)
  }

  const axes: ICompareAxis[] = [
    axisString("Manufacturer", left.manufacturer, right.manufacturer, "info"),
    axisString("Type", left.type, right.type, "info"),
    axisNumberLowerWins("Price (USD)", left.price_usd, right.price_usd),
    axisNumberHigherWins("Degrees of freedom", left.dof, right.dof),
    axisNumberLowerWins("Weight (kg)", left.weight_kg, right.weight_kg),
    axisString("Deploy readiness", left.deploy_readiness, right.deploy_readiness, "info"),
    axisString("Community size", left.community_size, right.community_size, "info"),
    axisListOverlap(
      "Sensors",
      left.sensors,
      right.sensors,
    ),
    axisListOverlap(
      "Compatible policies",
      left.compatible_policy_slugs,
      right.compatible_policy_slugs,
    ),
    axisListOverlap(
      "Compatible environments",
      left.compatible_env_slugs,
      right.compatible_env_slugs,
    ),
  ]

  // Taxonomy axes (when both robots have a taxonomy populated).
  if (left.taxonomy != null && right.taxonomy != null) {
    axes.push(
      axisString("Embodiment", left.taxonomy.embodiment, right.taxonomy.embodiment, "info"),
      axisString("Mobility", left.taxonomy.mobility, right.taxonomy.mobility, "info"),
      axisString("Actuation", left.taxonomy.actuation, right.taxonomy.actuation, "info"),
      axisListOverlap("Control interfaces", left.taxonomy.control_interfaces, right.taxonomy.control_interfaces),
      axisListOverlap("Perception", left.taxonomy.perception, right.taxonomy.perception),
    )
  }

  return {
    left: { slug: left.slug, name: left.name },
    right: { slug: right.slug, name: right.name },
    axes,
    summary: buildRobotSummary(left, right, axes),
  }
}

function buildRobotSummary(left: IRobot, right: IRobot, axes: ICompareAxis[]): string {
  const parts: string[] = []
  // Price comparison.
  const priceAxis = axes.find((a) => a.label === "Price (USD)")
  if (priceAxis !== undefined && priceAxis.winner !== "n/a" && priceAxis.winner !== "tie") {
    const cheaper = priceAxis.winner === "left" ? left : right
    const pricier = priceAxis.winner === "left" ? right : left
    parts.push(`${cheaper.name} is cheaper ($${cheaper.price_usd?.toLocaleString()}) than ${pricier.name} ($${pricier.price_usd?.toLocaleString()})`)
  }
  // DoF comparison.
  const dofAxis = axes.find((a) => a.label === "Degrees of freedom")
  if (dofAxis !== undefined && dofAxis.winner !== "n/a" && dofAxis.winner !== "tie") {
    const more = dofAxis.winner === "left" ? left : right
    parts.push(`${more.name} has more DoF (${more.dof})`)
  }
  // Policy overlap.
  const policyAxis = axes.find((a) => a.label === "Compatible policies")
  if (policyAxis !== undefined) {
    const sharedCount = (policyAxis.note ?? "").match(/shared: ([^·]+)/)?.[1]?.split(",").length ?? 0
    if (sharedCount > 0) parts.push(`${sharedCount} shared compatible policies`)
    else parts.push("no overlap in compatible policies — different ecosystems")
  }
  if (parts.length === 0) parts.push(`${left.name} and ${right.name} are very similar across the captured axes`)
  return parts.join(". ") + "."
}

// ── Policy compare ────────────────────────────────────────────────

export function comparePolicies(left: IPolicy, right: IPolicy): IPolicyComparison {
  if (left.slug === right.slug) {
    throw new Error(`comparePolicies: cannot compare a record to itself (slug=${left.slug})`)
  }

  const axes: ICompareAxis[] = [
    axisString("Author", left.author, right.author, "info"),
    axisString("Framework", left.framework, right.framework, "info"),
    axisString("License", left.license, right.license, "info"),
    axisString("Skill type", left.skill_type, right.skill_type, "info"),
    axisString("Evidence level", left.evidence_level, right.evidence_level, "info"),
    axisString("Action space type", left.action_space.type, right.action_space.type, "info"),
    axisNumberHigherWins("Action dimensions", left.action_space.dimensions, right.action_space.dimensions),
    axisNumberHigherWins("Frequency (Hz)", left.action_space.frequency_hz, right.action_space.frequency_hz),
    axisListOverlap("Observation components", left.observation_space.components, right.observation_space.components),
    axisListOverlap("Compatible robots", left.compatible_robot_slugs, right.compatible_robot_slugs),
  ]

  // Best benchmark per side (max success_rate, ignoring nulls).
  const leftBest = bestBenchmark(left)
  const rightBest = bestBenchmark(right)
  axes.push(axisNumberHigherWins("Best benchmark success rate", leftBest, rightBest))

  if (left.taxonomy != null && right.taxonomy != null) {
    axes.push(
      axisListOverlap("Required control", left.taxonomy.required_control, right.taxonomy.required_control),
      axisListOverlap("Required perception", left.taxonomy.required_perception, right.taxonomy.required_perception),
    )
  }

  return {
    left: { slug: left.slug, name: left.name },
    right: { slug: right.slug, name: right.name },
    axes,
    summary: buildPolicySummary(left, right, leftBest, rightBest, axes),
  }
}

function bestBenchmark(policy: IPolicy): number | null {
  let best: number | null = null
  for (const b of policy.benchmarks) {
    if (b.success_rate === null) continue
    if (best === null || b.success_rate > best) best = b.success_rate
  }
  return best
}

function buildPolicySummary(
  left: IPolicy,
  right: IPolicy,
  leftBest: number | null,
  rightBest: number | null,
  axes: ICompareAxis[],
): string {
  const parts: string[] = []
  if (left.evidence_level === "verified" && right.evidence_level !== "verified") {
    parts.push(`${left.name} has stronger evidence (${left.evidence_level} vs ${right.evidence_level})`)
  } else if (right.evidence_level === "verified" && left.evidence_level !== "verified") {
    parts.push(`${right.name} has stronger evidence (${right.evidence_level} vs ${left.evidence_level})`)
  }
  if (leftBest !== null && rightBest !== null && leftBest !== rightBest) {
    const higher = leftBest > rightBest ? left : right
    const higherRate = leftBest > rightBest ? leftBest : rightBest
    parts.push(`${higher.name} reports a higher best benchmark (${Math.round(higherRate * 100)}%)`)
  }
  const robotsAxis = axes.find((a) => a.label === "Compatible robots")
  if (robotsAxis !== undefined) {
    const shared = (robotsAxis.note ?? "").match(/shared: ([^·]+)/)?.[1]?.split(",").length ?? 0
    if (shared > 0) parts.push(`${shared} robots in common`)
    else parts.push("no robot overlap — different deployment targets")
  }
  if (parts.length === 0) parts.push(`${left.name} and ${right.name} look comparable across the captured axes`)
  return parts.join(". ") + "."
}
