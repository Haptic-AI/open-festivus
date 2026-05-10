/**
 * Entity extractors for query recipes.
 *
 * Recipes need to pull structured params out of free-text questions
 * (a robot slug, a price ceiling, an industry name, etc.) before they
 * can plan API calls. These extractors are deliberately conservative —
 * they prefer "no match" to a wrong match. Better to fall through to
 * a broad search than to query the wrong slug.
 */

// Known robot slug aliases. Maps user-typed phrases to canonical slugs that
// exist in robots.json. New robots get added here when the recipes need them.
const ROBOT_ALIASES: { aliases: RegExp[]; slug: string }[] = [
  { aliases: [/franka(\s+panda)?/, /panda\b/], slug: "franka-panda" },
  { aliases: [/ur5e?\b/, /universal\s+robots\s+ur5/], slug: "ur5e" },
  { aliases: [/aloha\s*2/, /aloha-2/, /\baloha\b/], slug: "aloha-2" },
  { aliases: [/so-?100/], slug: "so-100" },
  { aliases: [/koch\s*v?1\.?1?/], slug: "koch-v11" },
  { aliases: [/so-?arm\s*101/], slug: "so-arm101" },
  { aliases: [/unitree\s*go\s*2/, /\bgo2\b/], slug: "unitree-go2" },
  { aliases: [/unitree\s*g\s*1/, /\bg1\b/], slug: "unitree-g1" },
  { aliases: [/dji\s*tello/, /\btello\b/], slug: "dji-tello" },
  { aliases: [/widowx\s*250/], slug: "widowx-250" },
  { aliases: [/kinova\s*gen\s*3/], slug: "kinova-gen3" },
  { aliases: [/spot\b/], slug: "boston-dynamics-spot" },
  { aliases: [/stretch\s*3/], slug: "stretch-3" },
]

const POLICY_ALIASES: { aliases: RegExp[]; slug: string }[] = [
  { aliases: [/diffusion\s*polic(y|ies)/, /diffusion-policy/], slug: "diffusion-policy-pusht" },
  { aliases: [/\bact\b/, /action\s*chunking/], slug: "act-aloha-sim-transfer-cube" },
  { aliases: [/octo[-\s]?base/], slug: "octo-base" },
  { aliases: [/octo[-\s]?small/], slug: "octo-small" },
  { aliases: [/\brt-?1\b/], slug: "rt-1" },
  { aliases: [/\brt-?2(-x)?\b/], slug: "rt-2-x" },
  { aliases: [/openvla/, /open\s*vla/], slug: "openvla-7b" },
  { aliases: [/pi0[-\s]?base/, /pi-?0/], slug: "pi0-base" },
  { aliases: [/g1\s*whole[-\s]?body/], slug: "g1-whole-body-control" },
  { aliases: [/walk[-\s]?these[-\s]?ways/], slug: "walk-these-ways-go2" },
  { aliases: [/extreme\s*parkour/], slug: "extreme-parkour-go2" },
  { aliases: [/mobile[-\s]?aloha/], slug: "mobile-aloha-cooking" },
]

const TASK_ALIASES: { aliases: RegExp[]; slug: string }[] = [
  { aliases: [/pick(\s|-)and(\s|-)place/, /pick.+place/], slug: "pick-and-place" },
  { aliases: [/fold\s*(laundry|cloth|clothes|towel)/], slug: "fold-laundry" },
  { aliases: [/peg\s*insertion/, /insertion/], slug: "peg-insertion" },
  { aliases: [/cube\s*transfer/, /bimanual\s*transfer/], slug: "cube-transfer" },
  { aliases: [/push\s*(to\s*target|object)/], slug: "push-to-target" },
  { aliases: [/walk(ing)?\s*(on\s*)?flat/], slug: "walk-flat-terrain" },
  { aliases: [/(rough|uneven|stair)\s*terrain/, /traverse/], slug: "traverse-rough-terrain" },
  { aliases: [/cook(\s*meal)?/, /kitchen/], slug: "cook-meal" },
  { aliases: [/(visual\s*)?landing/, /land\s*on/], slug: "visual-landing" },
  { aliases: [/sort(\s*objects)?(\s*by\s*color)?/], slug: "sort-objects-by-color" },
  { aliases: [/open\s*(a\s*)?drawer/], slug: "open-drawer" },
  { aliases: [/whole[-\s]?body\s*locomotion/, /humanoid\s*walk/], slug: "whole-body-locomotion" },
  { aliases: [/(clean|wipe)(\s*the)?\s*table/], slug: "clean-table-surface" },
  { aliases: [/monitor(\s*(a|the)?\s*room)?/, /patrol/], slug: "monitor-room" },
  { aliases: [/dance/, /choreograph/], slug: "dance" },
]

const SKILL_KEYWORDS: { keywords: RegExp[]; category: string }[] = [
  { keywords: [/manipulat/, /pick/, /grasp/, /fold/, /sort/, /insertion/, /assembl/], category: "manipulation" },
  { keywords: [/walk/, /locomot/, /traverse/, /run/], category: "locomotion" },
  { keywords: [/navigat/, /patrol/, /room/], category: "navigation" },
  { keywords: [/fly/, /landing/, /drone/, /aerial/], category: "aerial" },
]

const ROBOT_TYPE_KEYWORDS: { keywords: RegExp[]; type: string }[] = [
  { keywords: [/dual[-\s]?arm/, /bimanual/], type: "dual-arm" },
  { keywords: [/quadruped/, /four[-\s]?legged/, /go2/, /spot/], type: "quadruped" },
  { keywords: [/humanoid/, /biped/, /atlas/, /digit/, /g1\b/], type: "humanoid" },
  { keywords: [/drone/, /quadcopter/, /uav/, /tello/], type: "drone" },
  { keywords: [/rover/, /amr/, /mobile\s+base/], type: "rover" },
  { keywords: [/\barm\b/, /manipulator/, /panda/, /ur5/], type: "arm" },
]

const INDUSTRY_KEYWORDS: { keywords: RegExp[]; industry: string }[] = [
  { keywords: [/warehouse/, /logistics/, /fulfill/], industry: "warehouse" },
  { keywords: [/agricultur/, /farm/, /harvest/, /crop/], industry: "agriculture" },
  { keywords: [/healthcare/, /hospital/, /surgical/, /medical/], industry: "healthcare" },
  { keywords: [/manufactur/, /factory/, /assembly/], industry: "manufacturing" },
  { keywords: [/construct/], industry: "construction" },
  { keywords: [/inspection/, /survey/], industry: "inspection" },
  { keywords: [/delivery/, /last\s*mile/], industry: "delivery" },
  { keywords: [/research/, /lab/], industry: "research" },
  { keywords: [/home/, /domestic/, /consumer/], industry: "home" },
]

function matchAlias<T extends { aliases: RegExp[] }>(q: string, list: T[]): T | null {
  for (const entry of list) {
    for (const a of entry.aliases) {
      if (a.test(q)) return entry
    }
  }
  return null
}

function matchKeyword<T extends { keywords: RegExp[] }>(q: string, list: T[]): T | null {
  for (const entry of list) {
    for (const k of entry.keywords) {
      if (k.test(q)) return entry
    }
  }
  return null
}

export function extractRobotSlug(question: string): string | null {
  return matchAlias(question.toLowerCase(), ROBOT_ALIASES)?.slug ?? null
}

export function extractRobotSlugs(question: string): string[] {
  const q = question.toLowerCase()
  const found: string[] = []
  for (const entry of ROBOT_ALIASES) {
    for (const a of entry.aliases) {
      if (a.test(q)) {
        if (!found.includes(entry.slug)) found.push(entry.slug)
        break
      }
    }
  }
  return found
}

export function extractPolicySlug(question: string): string | null {
  return matchAlias(question.toLowerCase(), POLICY_ALIASES)?.slug ?? null
}

export function extractPolicySlugs(question: string): string[] {
  const q = question.toLowerCase()
  const found: string[] = []
  for (const entry of POLICY_ALIASES) {
    for (const a of entry.aliases) {
      if (a.test(q)) {
        if (!found.includes(entry.slug)) found.push(entry.slug)
        break
      }
    }
  }
  return found
}

export function extractTaskSlug(question: string): string | null {
  return matchAlias(question.toLowerCase(), TASK_ALIASES)?.slug ?? null
}

export function extractSkillCategory(question: string): string | null {
  return matchKeyword(question.toLowerCase(), SKILL_KEYWORDS)?.category ?? null
}

export function extractRobotType(question: string): string | null {
  return matchKeyword(question.toLowerCase(), ROBOT_TYPE_KEYWORDS)?.type ?? null
}

export function extractIndustry(question: string): string | null {
  return matchKeyword(question.toLowerCase(), INDUSTRY_KEYWORDS)?.industry ?? null
}

/**
 * Extract a price ceiling in USD. Handles "$10K", "$10,000", "under $5000",
 * "less than $1k", "$5000 max". Returns null if no number can be parsed.
 */
export function extractPriceMax(question: string): number | null {
  const q = question.toLowerCase()
  const match = q.match(/(?:under|less than|below|<|max(?:imum)?|up to)?\s*\$\s*([\d,]+)\s*(k|usd|thousand)?/)
  if (match === null || match[1] === undefined) return null
  const raw = match[1].replace(/,/g, "")
  const n = parseFloat(raw)
  if (Number.isNaN(n)) return null
  const unit = match[2]
  if (unit === "k" || unit === "thousand") return n * 1000
  return n
}

export function extractDifficulty(question: string): string | null {
  const q = question.toLowerCase()
  if (/\beasy\b/.test(q)) return "easy"
  if (/\bmedium\b/.test(q)) return "medium"
  if (/\bhard\b/.test(q)) return "hard"
  if (/\bunsolved\b/.test(q)) return "unsolved"
  return null
}
