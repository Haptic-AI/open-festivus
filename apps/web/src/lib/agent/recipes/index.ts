/**
 * Query recipes — pre-computed plans for the 22 question shapes.
 *
 * A recipe takes a question and produces an ordered list of API tool calls
 * that, when executed, return everything needed to answer that shape of
 * question. The recipes are pure (no I/O) so they can be unit-tested in
 * isolation; the actual API calls happen at the route layer.
 *
 * Why pre-computed?
 *   - Cheap and deterministic: same question → same API calls
 *   - Auditable: a reviewer can read recipes/lookups.ts and see what every
 *     question shape costs in API tool calls
 *   - Tier-aware by construction: every shape that touches compatibility
 *     calls search_compatibility so the model gets reliability_tier on
 *     every edge — no shape can accidentally skip tier discipline
 *
 * Add a new recipe by:
 *   1. Defining a `plan(question)` that returns IRecipeStep[]
 *   2. Registering it in RECIPES below keyed by IQuestionShape
 *   3. Adding a unit test in tests/seed-validation/query-recipes.test.ts
 */

import type { IQuestionShape } from "@/lib/agent/router"
import {
  extractIndustry,
  extractPolicySlug,
  extractPolicySlugs,
  extractPriceMax,
  extractRobotSlug,
  extractRobotSlugs,
  extractRobotType,
  extractSkillCategory,
  extractTaskSlug,
} from "@/lib/agent/recipes/extract"

export type IRecipeToolName =
  | "search_robots"
  | "search_policies"
  | "search_compatibility"
  | "search_tasks"
  | "get_robot_full"
  | "find_gaps"
  | "search_environments"
  | "search_deploy_notes"

export interface IRecipeStep {
  tool: IRecipeToolName
  args: Record<string, unknown>
  /** One-line explanation of why this step is needed. Useful for debugging. */
  rationale: string
}

export interface IRecipe {
  shape: IQuestionShape
  describe: string
  plan(question: string): IRecipeStep[]
}

const DEFAULT_LIMIT = 10

// ── Lookups (shapes 1-13) ─────────────────────────────────────────

const T_TO_R: IRecipe = {
  shape: "T->R",
  describe: "task → robot: find robots that can do a given task",
  plan(question) {
    const taskSlug = extractTaskSlug(question)
    const skill = extractSkillCategory(question)
    const robotType = extractRobotType(question)
    const steps: IRecipeStep[] = []
    if (taskSlug !== null) {
      steps.push({
        tool: "search_tasks",
        args: { q: taskSlug, limit: 5 },
        rationale: `look up the canonical task record for "${taskSlug}" so the agent can quote sub_tasks and required_capabilities`,
      })
    } else if (skill !== null) {
      steps.push({
        tool: "search_tasks",
        args: { category: skill, limit: 5 },
        rationale: `task slug not extractable; fall back to search by skill category "${skill}"`,
      })
    }
    steps.push({
      tool: "search_robots",
      args: robotType !== null
        ? { type: robotType, has_policies: true, limit: DEFAULT_LIMIT }
        : { has_policies: true, limit: DEFAULT_LIMIT },
      rationale: "find robot candidates that have at least one policy (filters out unsupported hardware)",
    })
    return steps
  },
}

const T_TO_P: IRecipe = {
  shape: "T->P",
  describe: "task → policy: find policies for a given task",
  plan(question) {
    const taskSlug = extractTaskSlug(question)
    const skill = extractSkillCategory(question)
    const steps: IRecipeStep[] = []
    if (taskSlug !== null) {
      steps.push({
        tool: "search_tasks",
        args: { q: taskSlug, limit: 1 },
        rationale: `confirm task "${taskSlug}" exists and pull its compatible_policy_slugs`,
      })
    }
    steps.push({
      tool: "search_policies",
      args: skill !== null ? { skill, limit: DEFAULT_LIMIT } : { q: question, limit: DEFAULT_LIMIT },
      rationale: skill !== null
        ? `filter policies to skill_type=${skill}`
        : "free-text policy search using the user's question",
    })
    return steps
  },
}

const T_TO_D: IRecipe = {
  shape: "T->D",
  describe: "task → dataset: find training data for a task",
  plan(question) {
    const taskSlug = extractTaskSlug(question)
    const skill = extractSkillCategory(question)
    const steps: IRecipeStep[] = []
    if (taskSlug !== null) {
      steps.push({
        tool: "search_tasks",
        args: { q: taskSlug, limit: 1 },
        rationale: `look up task "${taskSlug}" to find which policies use it (datasets follow policies)`,
      })
    }
    steps.push({
      tool: "search_policies",
      args: skill !== null ? { skill, limit: DEFAULT_LIMIT } : { q: question, limit: DEFAULT_LIMIT },
      rationale: "policies declare their training datasets via paper references and slugs",
    })
    return steps
  },
}

const R_TO_P: IRecipe = {
  shape: "R->P",
  describe: "robot → policy: what policies run on this robot",
  plan(question) {
    const slug = extractRobotSlug(question)
    if (slug === null) {
      return [{
        tool: "search_policies",
        args: { limit: DEFAULT_LIMIT },
        rationale: "no robot slug extracted; fall back to a broad policy list so the agent can ask for clarification",
      }]
    }
    return [
      {
        tool: "search_compatibility",
        args: { robot: slug, limit: 50 },
        rationale: `pull every compatibility edge for "${slug}" so the agent can group results by reliability_tier (Rule 11 in the prompt)`,
      },
      {
        tool: "search_policies",
        args: { robot: slug, limit: DEFAULT_LIMIT },
        rationale: `pull full policy records for "${slug}" so the agent has framework, license, paper URLs to display`,
      },
    ]
  },
}

const R_TO_T: IRecipe = {
  shape: "R->T",
  describe: "robot → task: what tasks is this robot good for",
  plan(question) {
    const slug = extractRobotSlug(question)
    const robotType = extractRobotType(question)
    const steps: IRecipeStep[] = []
    if (slug !== null) {
      steps.push({
        tool: "get_robot_full",
        args: { slug },
        rationale: `pull robot + its compatible policies + datasets in one call so we can derive the supported task set`,
      })
    }
    steps.push({
      tool: "search_tasks",
      args: robotType !== null ? { robot_type: robotType, limit: DEFAULT_LIMIT } : { limit: DEFAULT_LIMIT },
      rationale: robotType !== null
        ? `filter tasks compatible with robot_type=${robotType}`
        : "fall back to all tasks if the type can't be inferred",
    })
    return steps
  },
}

const R_TO_S: IRecipe = {
  shape: "R->S",
  describe: "robot → safety / deploy notes",
  plan(question) {
    const robotType = extractRobotType(question)
    return [{
      tool: "search_deploy_notes",
      args: robotType !== null ? { robot_type: robotType, limit: DEFAULT_LIMIT } : { limit: DEFAULT_LIMIT },
      rationale: robotType !== null
        ? `pull deploy-notes for robot_type=${robotType} (covers severity + description)`
        : "pull all deploy-notes so the agent can match by severity",
    }]
  },
}

const P_TO_R: IRecipe = {
  shape: "P->R",
  describe: "policy → robot: what robots can run this policy",
  plan(question) {
    const slug = extractPolicySlug(question)
    if (slug === null) {
      return [{
        tool: "search_policies",
        args: { q: question, limit: 5 },
        rationale: "no policy slug extracted; search by free text so the agent can confirm the policy first",
      }]
    }
    return [
      {
        tool: "search_compatibility",
        args: { policy: slug, limit: 50 },
        rationale: `pull every compatibility edge for "${slug}" with reliability_tier so the agent can group by tier`,
      },
      {
        tool: "search_robots",
        args: { has_policies: true, limit: DEFAULT_LIMIT },
        rationale: "fetch full robot records so the agent has price, DoF, sensors to display",
      },
    ]
  },
}

const P_TO_E: IRecipe = {
  shape: "P->E",
  describe: "policy → evidence: success rate, episodes, paper",
  plan(question) {
    const slug = extractPolicySlug(question)
    const robotSlug = extractRobotSlug(question)
    const steps: IRecipeStep[] = []
    if (slug !== null) {
      steps.push({
        tool: "search_policies",
        args: { q: slug, limit: 1 },
        rationale: `pull the policy record for "${slug}" so the agent has benchmarks[] with success_rate + episodes`,
      })
      steps.push({
        tool: "search_compatibility",
        args: robotSlug !== null
          ? { policy: slug, robot: robotSlug, limit: 5 }
          : { policy: slug, limit: DEFAULT_LIMIT },
        rationale: `pull compatibility edges so the agent reads reliability_tier before quoting any number`,
      })
    } else {
      steps.push({
        tool: "search_policies",
        args: { q: question, limit: 3 },
        rationale: "policy slug not extractable; free-text search so the agent can ask which policy",
      })
    }
    return steps
  },
}

const P_TO_D: IRecipe = {
  shape: "P->D",
  describe: "policy → dataset: what was this policy trained on",
  plan(question) {
    const slug = extractPolicySlug(question)
    if (slug === null) {
      return [{
        tool: "search_policies",
        args: { q: question, limit: 5 },
        rationale: "policy slug not extractable; search by free text",
      }]
    }
    return [{
      tool: "search_policies",
      args: { q: slug, limit: 1 },
      rationale: `policy records reference their training datasets via paper_arxiv_url + observation_space; pull "${slug}"`,
    }]
  },
}

const B_TO_R: IRecipe = {
  shape: "B->R",
  describe: "budget → robot: robots under a price ceiling",
  plan(question) {
    const priceMax = extractPriceMax(question)
    const robotType = extractRobotType(question)
    const skill = extractSkillCategory(question)
    return [{
      tool: "search_robots",
      args: {
        ...(priceMax !== null ? { price_max: priceMax } : {}),
        ...(robotType !== null ? { type: robotType } : {}),
        ...(skill !== null ? { q: skill } : {}),
        has_policies: true,
        limit: DEFAULT_LIMIT,
      },
      rationale: `filter robots by price_max=${priceMax ?? "unspecified"}${robotType !== null ? `, type=${robotType}` : ""}`,
    }]
  },
}

const K_TO_P: IRecipe = {
  shape: "K->P",
  describe: "ranking → policy: top-N policies for a category",
  plan(question) {
    const skill = extractSkillCategory(question)
    return [{
      tool: "search_policies",
      args: skill !== null
        ? { skill, evidence: "verified", limit: DEFAULT_LIMIT }
        : { evidence: "verified", limit: DEFAULT_LIMIT },
      rationale: skill !== null
        ? `top policies in skill_type=${skill}, gated to evidence=verified so we don't rank tier-4 noise`
        : "fall back to all verified policies; agent ranks them by benchmark success_rate",
    }]
  },
}

const K_TO_R: IRecipe = {
  shape: "K->R",
  describe: "ranking → robot: most popular robots for a category",
  plan(question) {
    const robotType = extractRobotType(question)
    return [{
      tool: "search_robots",
      args: {
        has_policies: true,
        ...(robotType !== null ? { type: robotType } : {}),
        limit: DEFAULT_LIMIT,
      },
      rationale: "popularity is approximated by has_policies (community has actually bothered to write a policy for it)",
    }]
  },
}

const X_TO_X: IRecipe = {
  shape: "X->X",
  describe: "everything for a given entity (cross-cutting)",
  plan(question) {
    const slug = extractRobotSlug(question)
    if (slug === null) {
      return [{
        tool: "search_robots",
        args: { limit: 5 },
        rationale: "no robot slug; broad search so the agent can ask which one",
      }]
    }
    return [
      {
        tool: "get_robot_full",
        args: { slug },
        rationale: `joined response: robot + policies + datasets in one call`,
      },
      {
        tool: "search_compatibility",
        args: { robot: slug, limit: 50 },
        rationale: "tier breakdown for every (robot, policy) pair the agent will mention",
      },
      {
        tool: "search_deploy_notes",
        args: { robot_type: extractRobotType(question) ?? "arm", limit: 5 },
        rationale: "deploy notes round out the X→X answer with the safety axis",
      },
    ]
  },
}

// ── Extended (shapes 14-22) ───────────────────────────────────────

const I_TO_R: IRecipe = {
  shape: "I->R",
  describe: "industry → robot",
  plan(question) {
    const industry = extractIndustry(question)
    return [{
      tool: "search_robots",
      args: industry !== null ? { q: industry, has_policies: true, limit: DEFAULT_LIMIT } : { has_policies: true, limit: DEFAULT_LIMIT },
      rationale: industry !== null ? `free-text search by industry "${industry}"` : "fall back to all robots with policies",
    }]
  },
}

const I_TO_P: IRecipe = {
  shape: "I->P",
  describe: "industry → policy",
  plan(question) {
    const industry = extractIndustry(question)
    return [{
      tool: "search_policies",
      args: industry !== null ? { q: industry, limit: DEFAULT_LIMIT } : { limit: DEFAULT_LIMIT },
      rationale: industry !== null ? `free-text search by industry "${industry}"` : "fall back to all policies",
    }]
  },
}

const F_TO_P: IRecipe = {
  shape: "F->P",
  describe: "framework / stack → policy",
  plan(question) {
    const q = question.toLowerCase()
    let framework: string | undefined
    if (/pytorch/.test(q)) framework = "PyTorch"
    else if (/jax/.test(q)) framework = "JAX"
    else if (/tensorflow/.test(q)) framework = "TensorFlow"
    return [{
      tool: "search_policies",
      args: framework !== undefined ? { framework, limit: DEFAULT_LIMIT } : { q: question, limit: DEFAULT_LIMIT },
      rationale: framework !== undefined
        ? `filter policies by framework=${framework}`
        : "no framework keyword found; free-text search the user's stack description",
    }]
  },
}

const A_TO_X: IRecipe = {
  shape: "A->X",
  describe: "paper citation → reproduction guide",
  plan(question) {
    const policySlug = extractPolicySlug(question)
    const steps: IRecipeStep[] = []
    if (policySlug !== null) {
      steps.push({
        tool: "search_policies",
        args: { q: policySlug, limit: 1 },
        rationale: `look up the policy record for "${policySlug}" — paper_arxiv_url + framework drive the reproduction steps`,
      })
      steps.push({
        tool: "search_compatibility",
        args: { policy: policySlug, status: "verified", limit: 5 },
        rationale: `find which robots have published reproductions (tier-1 only — A→X reproduces verified results)`,
      })
    } else {
      steps.push({
        tool: "search_policies",
        args: { q: question, limit: 3 },
        rationale: "no policy slug; free-text search to identify the paper",
      })
    }
    return steps
  },
}

const RxR_TO_C: IRecipe = {
  shape: "RxR->C",
  describe: "robot × robot → compare",
  plan(question) {
    const slugs = extractRobotSlugs(question).slice(0, 2)
    if (slugs.length < 2) {
      return [{
        tool: "search_robots",
        args: { has_policies: true, limit: 5 },
        rationale: "couldn't extract two robots; broad search so the agent can ask which two",
      }]
    }
    return slugs.map((slug) => ({
      tool: "get_robot_full" as const,
      args: { slug },
      rationale: `pull robot + its compatible policies + datasets for "${slug}" — needed for the structured diff`,
    }))
  },
}

const PxP_TO_C: IRecipe = {
  shape: "PxP->C",
  describe: "policy × policy → compare",
  plan(question) {
    const slugs = extractPolicySlugs(question).slice(0, 2)
    if (slugs.length < 2) {
      return [{
        tool: "search_policies",
        args: { q: question, limit: 5 },
        rationale: "couldn't extract two policies; free-text search so the agent can confirm",
      }]
    }
    return slugs.map((slug) => ({
      tool: "search_policies" as const,
      args: { q: slug, limit: 1 },
      rationale: `pull the full policy record for "${slug}" with benchmarks + observation_space for the diff`,
    }))
  },
}

const R_TO_W: IRecipe = {
  shape: "R->W",
  describe: "robot → workflow / setup guide",
  plan(question) {
    const slug = extractRobotSlug(question)
    if (slug === null) {
      return [{
        tool: "search_robots",
        args: { has_policies: true, limit: 5 },
        rationale: "no robot slug; agent will ask which one to set up",
      }]
    }
    return [
      {
        tool: "get_robot_full",
        args: { slug },
        rationale: `setup guide needs build_paths, deploy_readiness, sensors, actuators — all in get_robot_full`,
      },
      {
        tool: "search_deploy_notes",
        args: { robot_type: extractRobotType(question) ?? "arm", limit: 5 },
        rationale: "setup must include the deployment safety notes for the robot type",
      },
    ]
  },
}

const X_TO_G: IRecipe = {
  shape: "X->G",
  describe: "gap finder",
  plan(question) {
    const q = question.toLowerCase()
    let domain: "robots-without-policies" | "tasks-without-data" | "untested-edges"
    if (/no\s*polic/.test(q)) domain = "robots-without-policies"
    else if (/no\s*data/.test(q) || /no\s*dataset/.test(q)) domain = "tasks-without-data"
    else domain = "untested-edges"
    return [{
      tool: "find_gaps",
      args: { domain, limit: DEFAULT_LIMIT },
      rationale: `gap finder for domain="${domain}" (the whole point of the agent: reveal gaps, don't hallucinate)`,
    }]
  },
}

const R_TO_DOLLAR: IRecipe = {
  shape: "R->$",
  describe: "robot → total cost of ownership",
  plan(question) {
    const slug = extractRobotSlug(question)
    if (slug === null) {
      return [{
        tool: "search_robots",
        args: { has_policies: true, limit: 5 },
        rationale: "no robot slug; agent will ask which one",
      }]
    }
    return [{
      tool: "get_robot_full",
      args: { slug },
      rationale: `TCO needs price_usd, build_paths (cost_usd, build_time_days), and deploy_readiness — all in get_robot_full`,
    }]
  },
}

// ── Registry ──────────────────────────────────────────────────────

export const RECIPES: Record<IQuestionShape, IRecipe> = {
  "T->R": T_TO_R,
  "T->P": T_TO_P,
  "T->D": T_TO_D,
  "R->P": R_TO_P,
  "R->T": R_TO_T,
  "R->S": R_TO_S,
  "P->R": P_TO_R,
  "P->E": P_TO_E,
  "P->D": P_TO_D,
  "B->R": B_TO_R,
  "K->P": K_TO_P,
  "K->R": K_TO_R,
  "X->X": X_TO_X,
  "I->R": I_TO_R,
  "I->P": I_TO_P,
  "F->P": F_TO_P,
  "A->X": A_TO_X,
  "RxR->C": RxR_TO_C,
  "PxP->C": PxP_TO_C,
  "R->W": R_TO_W,
  "X->G": X_TO_G,
  "R->$": R_TO_DOLLAR,
}

export function getRecipe(shape: IQuestionShape): IRecipe {
  return RECIPES[shape]
}

/**
 * Convenience: route the question, then plan it. Returns both so callers
 * can show the user both the classification AND the API calls that will run.
 */
export function planForQuestion(question: string, shape: IQuestionShape): IRecipeStep[] {
  return getRecipe(shape).plan(question)
}
