/**
 * Question router — classifies a user question into one of the 22 MECE shapes.
 *
 * The shapes are defined in `specs/013-agentic-robotics-platform.md` (section
 * "The 22 question shapes"). Each shape has a recipe in `recipes/` that produces
 * the API calls needed to answer questions of that shape.
 *
 * Strategy: ordered rule list, most specific first. Each rule is a predicate
 * over the lowercased question; the first match wins. The default shape is
 * T→R (the most common "what robot can do X" lookup).
 *
 * This is intentionally NOT an LLM call. Routing must be deterministic, fast,
 * and auditable — the spec calls it the "router" because it should be cheap
 * enough to run on every keystroke if needed.
 */

export type IQuestionShape =
  // Shapes 1-13: lookups (start → target)
  | "T->R"   // task → robot
  | "T->P"   // task → policy
  | "T->D"   // task → dataset
  | "R->P"   // robot → policy
  | "R->T"   // robot → task
  | "R->S"   // robot → safety / deploy notes
  | "P->R"   // policy → robot
  | "P->E"   // policy → evidence (benchmarks)
  | "P->D"   // policy → dataset
  | "B->R"   // budget → robot
  | "K->P"   // ranking → policy
  | "K->R"   // ranking → robot
  | "X->X"   // everything for X (cross-cutting)
  // Shapes 14-22: extended
  | "I->R"   // industry → robot
  | "I->P"   // industry → policy
  | "F->P"   // framework / stack → policy
  | "A->X"   // paper citation → reproduction guide
  | "RxR->C" // robot × robot → compare
  | "PxP->C" // policy × policy → compare
  | "R->W"   // robot → workflow / setup guide
  | "X->G"   // gap finder
  | "R->$"   // robot → total cost of ownership

export interface IRouterResult {
  shape: IQuestionShape
  /** Which rule matched. Useful for debugging and the integration test. */
  rule: string
  /** Words / phrases that triggered the match. */
  signals: string[]
}

interface IRule {
  shape: IQuestionShape
  name: string
  /** Returns matched signals if the rule fires, [] if not. */
  test(q: string): string[]
}

// ── Helpers ───────────────────────────────────────────────────────

function findAll(q: string, patterns: (RegExp | string)[]): string[] {
  const hits: string[] = []
  for (const p of patterns) {
    if (typeof p === "string") {
      if (q.includes(p)) hits.push(p)
    } else {
      const m = q.match(p)
      if (m !== null) hits.push(m[0])
    }
  }
  return hits
}

function any(q: string, patterns: (RegExp | string)[]): string[] {
  for (const p of patterns) {
    if (typeof p === "string") {
      if (q.includes(p)) return [p]
    } else {
      const m = q.match(p)
      if (m !== null) return [m[0]]
    }
  }
  return []
}

// Common phrase lists. Kept here so the test file can import and reuse them.

export const GAP_PHRASES: (RegExp | string)[] = [
  "no policy",
  "no policies",
  "no data",
  "no dataset",
  "no datasets",
  "untested",
  "missing",
  "what's missing",
  "what is missing",
  "gaps",
  "needs verification",
  "untouched",
  /robots?\s+(that\s+have|with)\s+no\s+\w+/,
]

export const COMPARE_PHRASES: (RegExp | string)[] = [
  " vs ",
  " versus ",
  "compare ",
  "side by side",
  "side-by-side",
  "diff between",
  "difference between",
]

export const SETUP_PHRASES: (RegExp | string)[] = [
  "how do i set up",
  "set up",
  "from scratch",
  "step by step",
  "step-by-step",
  "tutorial",
  "walk me through",
  "getting started",
  "bring up",
]

export const COST_PHRASES: (RegExp | string)[] = [
  "total cost",
  "tco",
  "cost of ownership",
  /\$.*(year|month|annual)/,
  /(year|annual|monthly)\s+cost/,
  "yearly cost",
  "monthly cost",
]

export const PAPER_CITATION_PHRASES: (RegExp | string)[] = [
  "i read the",
  "this paper",
  "the paper",
  "reproduce",
  "reproduction",
  "arxiv",
  "from the paper",
  "based on the paper",
]

export const STACK_PHRASES: (RegExp | string)[] = [
  "ros 2",
  "ros2",
  "ros ",
  "jetson",
  "raspberry pi",
  "i have a ",
  "i have ros",
  "running on",
  "my stack",
  "moveit",
  "isaac sim",
  "mujoco",
  "pybullet",
]

export const INDUSTRY_PHRASES: (RegExp | string)[] = [
  "warehouse",
  "logistics",
  "agriculture",
  "agricultural",
  "harvest",
  "farming",
  "healthcare",
  "hospital",
  "surgical",
  "manufacturing",
  "factory",
  "construction",
  "delivery",
  "inspection",
  "i work in",
  "my industry",
]

export const BUDGET_PHRASES: (RegExp | string)[] = [
  /under\s*\$\s*\d/,
  /less than\s*\$\s*\d/,
  /below\s*\$\s*\d/,
  /\$\d+\s*(k|usd|budget|max)/,
  "budget",
  "cheap",
  "cheapest",
  "affordable",
  "low cost",
]

export const RANKING_PHRASES: (RegExp | string)[] = [
  "top ",
  "top-",
  "best ",
  "most popular",
  "popular",
  "leading",
  "ranked",
  /top\s+\d/,
  "highest rated",
]

export const EVERYTHING_PHRASES: (RegExp | string)[] = [
  "everything for",
  "everything about",
  "the whole stack",
  "full stack",
  "all the",
  "complete picture",
  "tell me everything",
]

const ROBOT_KEYWORD = /(robot|arm|gripper|manipulator|humanoid|quadruped|drone|rover|hardware|panda|ur5|ur5e|aloha|so-?100|spot|go2|g1|tello)/
const POLICY_KEYWORD = /(polic(y|ies)|model|checkpoint|act|octo|diffusion|rt-?[12]|pi0|openvla|gr00t|rt2|vla)/
const TASK_KEYWORD = /(task|fold|laundry|pick(\s|-)and(\s|-)place|grasp|insertion|assembl|cook|wipe|clean|sort|walk|navigate|patrol|drone landing|land)/
const DATASET_KEYWORD = /(dataset|training data|episodes|trajector|demonstrations|teleop)/
const SAFETY_KEYWORD = /(gotcha|safety|certif|risk|hazard|deploy(ment)? note|e-?stop|iso)/

// ── Rules (highest priority first) ────────────────────────────────

const RULES: IRule[] = [
  // 1. Gap-finder: must come first because phrases like "robots with no policies"
  // would otherwise look like an R→P question.
  {
    shape: "X->G",
    name: "gap-finder",
    test: (q) => findAll(q, GAP_PHRASES),
  },

  // 2. Compare: "X vs Y" or "compare X and Y".
  {
    shape: "RxR->C",
    name: "robot-compare",
    test: (q) => {
      const compareHits = any(q, COMPARE_PHRASES)
      if (compareHits.length === 0) return []
      // Robot compare wins when the question is dominated by hardware nouns
      // and not by policy nouns.
      if (ROBOT_KEYWORD.test(q) && !POLICY_KEYWORD.test(q)) return compareHits
      // "compare panda vs ur5e" with two robot mentions
      const robotMatches = q.match(/(panda|ur5e?|aloha|so-?100|spot|go2|g1|tello|stretch|kuka)/g)
      if (robotMatches !== null && robotMatches.length >= 2) return compareHits
      return []
    },
  },
  {
    shape: "PxP->C",
    name: "policy-compare",
    test: (q) => {
      const compareHits = any(q, COMPARE_PHRASES)
      if (compareHits.length === 0) return []
      if (POLICY_KEYWORD.test(q)) return compareHits
      return []
    },
  },

  // 3. Workflow / setup guide.
  {
    shape: "R->W",
    name: "setup-guide",
    test: (q) => any(q, SETUP_PHRASES),
  },

  // 4. Total cost of ownership.
  {
    shape: "R->$",
    name: "cost-of-ownership",
    test: (q) => any(q, COST_PHRASES),
  },

  // 5. Paper citation → reproduction guide.
  {
    shape: "A->X",
    name: "paper-reproduction",
    test: (q) => {
      const hits = any(q, PAPER_CITATION_PHRASES)
      if (hits.length === 0) return []
      // "I read the paper" is the strongest signal; also accept "this paper"
      // when followed by "how do i" / "reproduce" / "implement".
      return hits
    },
  },

  // 6. Framework / stack constraint.
  {
    shape: "F->P",
    name: "stack-policy",
    test: (q) => {
      const hits = any(q, STACK_PHRASES)
      if (hits.length === 0) return []
      // Only fires when the user is asking for policies, not for hardware.
      if (POLICY_KEYWORD.test(q) || /policy|policies|model|run/.test(q)) return hits
      return []
    },
  },

  // 7. Industry → robot or policy.
  {
    shape: "I->P",
    name: "industry-policy",
    test: (q) => {
      const hits = any(q, INDUSTRY_PHRASES)
      if (hits.length === 0) return []
      if (POLICY_KEYWORD.test(q) || /polic(y|ies)/.test(q)) return hits
      return []
    },
  },
  {
    shape: "I->R",
    name: "industry-robot",
    test: (q) => {
      const hits = any(q, INDUSTRY_PHRASES)
      if (hits.length === 0) return []
      // Default industry questions to robot lookup.
      return hits
    },
  },

  // 8. Budget → robot.
  {
    shape: "B->R",
    name: "budget-robot",
    test: (q) => any(q, BUDGET_PHRASES),
  },

  // 9. Ranking (top / best / popular) → policy or robot.
  {
    shape: "K->P",
    name: "ranking-policy",
    test: (q) => {
      const hits = any(q, RANKING_PHRASES)
      if (hits.length === 0) return []
      if (POLICY_KEYWORD.test(q) || /polic(y|ies)/.test(q)) return hits
      return []
    },
  },
  {
    shape: "K->R",
    name: "ranking-robot",
    test: (q) => {
      const hits = any(q, RANKING_PHRASES)
      if (hits.length === 0) return []
      return hits
    },
  },

  // 10. Everything for X — broad cross-cutting query.
  {
    shape: "X->X",
    name: "everything-for-x",
    test: (q) => any(q, EVERYTHING_PHRASES),
  },

  // 11. Policy → dataset (what was X trained on).
  {
    shape: "P->D",
    name: "policy-to-dataset",
    test: (q) => {
      if (!POLICY_KEYWORD.test(q)) return []
      if (/trained on|training data|what dataset/.test(q)) return ["trained on"]
      return []
    },
  },

  // 12. Policy → evidence (benchmarks, success rate).
  {
    shape: "P->E",
    name: "policy-to-evidence",
    test: (q) => {
      if (!POLICY_KEYWORD.test(q)) return []
      if (/tested on|success rate|benchmark|evaluation|how well/.test(q)) return ["evidence"]
      return []
    },
  },

  // 13. Policy → robot (which robots run X).
  {
    shape: "P->R",
    name: "policy-to-robot",
    test: (q) => {
      if (!POLICY_KEYWORD.test(q)) return []
      if (/which robots|what robots|robots? (can|that) run|robots? for/.test(q)) return ["policy->robot"]
      return []
    },
  },

  // 14. Robot → safety / deploy notes.
  {
    shape: "R->S",
    name: "robot-to-safety",
    test: (q) => {
      if (!SAFETY_KEYWORD.test(q)) return []
      return ["safety"]
    },
  },

  // 15. Robot → task (what can my robot do).
  {
    shape: "R->T",
    name: "robot-to-task",
    test: (q) => {
      if (!ROBOT_KEYWORD.test(q)) return []
      if (/what tasks|good for|can it do|what can .* do/.test(q)) return ["robot->task"]
      return []
    },
  },

  // 16. Robot → policy (what runs on my robot).
  {
    shape: "R->P",
    name: "robot-to-policy",
    test: (q) => {
      if (!ROBOT_KEYWORD.test(q)) return []
      if (/what polic|which polic|polic(y|ies) (run|work) on|run on my|for my (panda|ur5|robot|aloha|so-?100|go2|g1)/.test(q)) {
        return ["robot->policy"]
      }
      return []
    },
  },

  // 17. Task → dataset.
  {
    shape: "T->D",
    name: "task-to-dataset",
    test: (q) => {
      if (!DATASET_KEYWORD.test(q) && !/training data/.test(q)) return []
      if (TASK_KEYWORD.test(q)) return ["task->dataset"]
      return []
    },
  },

  // 18. Task → policy.
  {
    shape: "T->P",
    name: "task-to-policy",
    test: (q) => {
      if (!POLICY_KEYWORD.test(q) && !/polic(y|ies)/.test(q)) return []
      if (TASK_KEYWORD.test(q) || /for (pick|fold|grasp|cook|wipe|sort|walk|navigate|insertion)/.test(q)) {
        return ["task->policy"]
      }
      return []
    },
  },

  // 19. Default: T→R (what robot can do X).
  {
    shape: "T->R",
    name: "task-to-robot-default",
    test: (q) => {
      if (TASK_KEYWORD.test(q) || /what (robot|hardware)/.test(q)) return ["task->robot"]
      return []
    },
  },
]

/**
 * Classify a question into one of the 22 shapes. Always returns a result —
 * if no specific rule matches, falls back to T→R with the "fallback" rule
 * name so the integration test can detect uncovered question phrasings.
 */
export function routeQuestion(question: string): IRouterResult {
  const q = question.toLowerCase().trim()
  for (const rule of RULES) {
    const signals = rule.test(q)
    if (signals.length > 0) {
      return { shape: rule.shape, rule: rule.name, signals }
    }
  }
  return { shape: "T->R", rule: "fallback", signals: [] }
}

export const ALL_SHAPES: IQuestionShape[] = [
  "T->R", "T->P", "T->D", "R->P", "R->T", "R->S", "P->R", "P->E", "P->D",
  "B->R", "K->P", "K->R", "X->X", "I->R", "I->P", "F->P", "A->X",
  "RxR->C", "PxP->C", "R->W", "X->G", "R->$",
]
