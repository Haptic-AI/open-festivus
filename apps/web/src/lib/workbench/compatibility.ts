export const COMPAT_GREEN = "#1D9E75"
export const COMPAT_AMBER = "#BA7517"
export const COMPAT_RED = "#E24B4A"

export interface ICompatScore {
  score: number | null
  color: string
  label: string
  explanation: string
}

export interface ILiveEdge {
  success_rate: number | null
  tier: number | null
}

export function computeCompatibility(
  policyData: Record<string, unknown>,
  robotSlug: string,
  robotName: string,
  liveEdge?: ILiveEdge,
): ICompatScore {
  // Live compat edge (from /v1/compatibility) is the source of truth when
  // present — it reflects tested/reported pairings across the whole dataset,
  // not just what the policy itself self-declares in compatible_robot_slugs.
  if (liveEdge !== undefined && liveEdge.success_rate !== null && (liveEdge.tier === 1 || liveEdge.tier === 2)) {
    const pct = Math.round(liveEdge.success_rate * 100)
    const color = pct > 75 ? COMPAT_GREEN : pct >= 40 ? COMPAT_AMBER : COMPAT_RED
    const qualifier = liveEdge.tier === 2 ? " (community-reported)" : ""
    const explanation = pct > 75
      ? `Best match for ${robotName}${qualifier}`
      : pct >= 40
        ? `Needs fine-tuning${qualifier}`
        : `Low success rate${qualifier}`
    return { score: pct, color, label: `${pct}%`, explanation }
  }

  const compatSlugs = (policyData["compatible_robot_slugs"] as string[] | undefined) ?? []
  const benchmarks =
    (policyData["benchmarks"] as Array<{ robot: string; success_rate: number | null }> | undefined) ?? []

  if (!compatSlugs.includes(robotSlug)) {
    return { score: 0, color: COMPAT_RED, label: "N/A", explanation: `Not built for ${robotName}` }
  }

  const robotNameLower = robotName.toLowerCase()
  const benchmark = benchmarks.find((b) => {
    const bRobot = b.robot.toLowerCase()
    return bRobot.includes(robotNameLower) || robotNameLower.includes(bRobot.replace(/[^a-z0-9]/g, ""))
  })

  if (benchmark !== undefined && benchmark.success_rate !== null) {
    const pct = Math.round(benchmark.success_rate * 100)
    const color = pct > 75 ? COMPAT_GREEN : pct >= 40 ? COMPAT_AMBER : COMPAT_RED
    const explanation =
      pct > 75 ? `Best match for ${robotName}` : pct >= 40 ? "Needs fine-tuning" : "Low success rate"
    return { score: pct, color, label: `${pct}%`, explanation }
  }

  return { score: null, color: COMPAT_AMBER, label: "Untested", explanation: `Compatible but no benchmark for ${robotName}` }
}

/** Normalize success rate: values ≤1 are decimals (0.82 = 82%), values >1 are already percentages */
export function normalizeSuccessRate(raw: number): number {
  return raw <= 1 ? Math.round(raw * 100) : Math.round(raw)
}
