/**
 * Canvas theme + lane styles + ILaneOption contract.
 *
 * Moved out of workbench-canvas.tsx in spec 029 phase 3.4.5 to shrink
 * the monster file ahead of Step 3.5's confirmation-card surgery.
 * ZERO behavior change — this is a straight extract. Every consumer
 * imports the same names with the same shape.
 */

import type { ICompatScore } from "@/lib/workbench/compatibility"
import { COMPAT_GREEN, COMPAT_AMBER, COMPAT_RED } from "@/lib/workbench/compatibility"

export const EDGE_COLORS: Record<string, string> = {
  compatible: "#16a34a", untested: "#eab308", incompatible: "#C6351B", suggested: "#A3A7AC",
}

export interface ITheme {
  canvasBg: string
  gridColor: string
  cardBg: string
  cardBorder: string
  cardText: string
  cardTextSecondary: string
  cardTextTertiary: string
  selectedBorder: string
  dimOpacity: number
  dimHoverOpacity: number
  statusBadgeBg: string
  statusBadgeText: string
  deployLabOnly: { bg: string; text: string }
  deployCeMarked: { bg: string; text: string }
  edgeOpacity: number
  tagBg: string
  tagText: string
  scoreGreen: string
  scoreAmber: string
  scoreRed: string
  scoreBarBg: string
  linkColor: string
  compatGood: string
  compatBad: string
  edgeGreen: string
  edgeAmber: string
  edgeRed: string
  edgeNeutral: string
  edgeLabelBg: string
  rowBorder: string
  sectionHeader: string
  standaloneBg: string
  standaloneText: string
  standaloneTextSecondary: string
  standaloneBorder: string
}

export const LIGHT_THEME: ITheme = {
  canvasBg: "#F9F9F7",
  gridColor: "rgba(11,28,54,0.08)",
  cardBg: "#ffffff",
  cardBorder: "rgba(11,28,54,0.5)",
  cardText: "#0B1C36",
  cardTextSecondary: "rgba(11,28,54,0.5)",
  cardTextTertiary: "rgba(11,28,54,0.4)",
  selectedBorder: "#3b82f6",
  dimOpacity: 0.45,
  dimHoverOpacity: 0.7,
  statusBadgeBg: "#0B1C36",
  statusBadgeText: "#EFECE4",
  deployLabOnly: { bg: "#FCEBEB", text: "#791F1F" },
  deployCeMarked: { bg: "#E1F5EE", text: "#085041" },
  edgeOpacity: 1,
  tagBg: "rgba(11,28,54,0.06)",
  tagText: "rgba(11,28,54,0.6)",
  scoreGreen: "#085041",
  scoreAmber: "#633806",
  scoreRed: "#791F1F",
  scoreBarBg: "rgba(11,28,54,0.06)",
  linkColor: "#3C3489",
  compatGood: "#085041",
  compatBad: "#791F1F",
  edgeGreen: COMPAT_GREEN,
  edgeAmber: COMPAT_AMBER,
  edgeRed: COMPAT_RED,
  edgeNeutral: "rgba(11,28,54,0.2)",
  edgeLabelBg: "#ffffff",
  rowBorder: "rgba(11,28,54,0.1)",
  sectionHeader: "#0B1C36",
  standaloneBg: "#ffffff",
  standaloneText: "#0B1C36",
  standaloneTextSecondary: "rgba(11,28,54,0.5)",
  standaloneBorder: "rgba(11,28,54,0.2)",
}

export const DARK_THEME: ITheme = {
  canvasBg: "#0B1C36",
  gridColor: "rgba(239,236,228,0.12)",
  cardBg: "#162033",
  cardBorder: "rgba(239,236,228,0.5)",
  cardText: "#EFECE4",
  cardTextSecondary: "#6B7280",
  cardTextTertiary: "#6B7280",
  selectedBorder: "#FFD326",
  dimOpacity: 0.7,
  dimHoverOpacity: 0.85,
  statusBadgeBg: "#FFD326",
  statusBadgeText: "#0B1C36",
  deployLabOnly: { bg: "#3a1515", text: "#F09595" },
  deployCeMarked: { bg: "#0a2e20", text: "#5DCAA5" },
  edgeOpacity: 1,
  tagBg: "#1e2d45",
  tagText: "#9FAAB8",
  scoreGreen: "#5DCAA5",
  scoreAmber: "#FAC775",
  scoreRed: "#F09595",
  scoreBarBg: "#1e2d45",
  linkColor: "#85B7EB",
  compatGood: "#5DCAA5",
  compatBad: "#F09595",
  edgeGreen: "#5DCAA5",
  edgeAmber: "#FAC775",
  edgeRed: "#F09595",
  edgeNeutral: "rgba(239,236,228,0.5)",
  edgeLabelBg: "#EFECE4",
  rowBorder: "rgba(239,236,228,0.08)",
  sectionHeader: "#9FAAB8",
  standaloneBg: "#EFECE4",
  standaloneText: "#0B1C36",
  standaloneTextSecondary: "#6B7280",
  standaloneBorder: "#d4d0c8",
}

export const LANE_STYLES_DARK: Record<string, { border: string; bg: string; label: string }> = {
  robot: { border: "#d4d0c8", bg: "#EFECE4", label: "#0C447C" },
  policy: { border: "#d4d0c8", bg: "#EFECE4", label: "#3C3489" },
  environment: { border: "#d4d0c8", bg: "#EFECE4", label: "#085041" },
  task: { border: "#d4d0c8", bg: "#EFECE4", label: "#27500A" },
}
export const DEFAULT_LANE_DARK = { border: "rgba(239,236,228,0.12)", bg: "transparent", label: "rgba(239,236,228,0.5)" }

export const LANE_STYLES: Record<string, { border: string; bg: string; label: string }> = {
  robot: { border: "#85B7EB", bg: "#E6F1FB", label: "#0C447C" },
  policy: { border: "#AFA9EC", bg: "#EEEDFE", label: "#3C3489" },
  environment: { border: "#5DCAA5", bg: "#E1F5EE", label: "#085041" },
  task: { border: "#97C459", bg: "#EAF3DE", label: "#27500A" },
}
export const DEFAULT_LANE = { border: "rgba(11,28,54,0.15)", bg: "transparent", label: "rgba(11,28,54,0.5)" }

export interface ILaneOption {
  id: string
  name: string
  stat: string
  nodeType: string
  selected: boolean
  imageUrl?: string
  compat?: ICompatScore
  nodeData: Record<string, unknown>
  selectedRobotName?: string
  selectedRobotSlug?: string
  /**
   * Slug of the currently-selected policy across visible policy lanes.
   * EnvironmentCard uses this to look up the specific (policy × env)
   * simulation and to POST a new one if none exists.
   */
  selectedPolicySlug?: string
  /**
   * HuggingFace repo id of the currently-selected policy, if any.
   * Used by EnvironmentCard to distinguish runnable policies (pi0,
   * open-source VLAs) from closed-source stubs (Helix, proprietary
   * models). When undefined, the env card renders "Coming Soon" for
   * the render path rather than a button that's doomed to fail.
   */
  selectedPolicyHfRepoId?: string
  expanded?: boolean
  theme: ITheme
}
