/**
 * Query recipes tests (Step 3.2).
 *
 * The plan calls for "Unit test: recipe for shape 4 (R→P) produces correct
 * API calls." This file goes broader and asserts every recipe in the
 * registry returns at least one valid step for a canonical question, plus
 * shape-specific assertions on the most load-bearing recipes:
 *
 *   - R→P: must call BOTH search_compatibility (for tier breakdown) and
 *     search_policies. The compatibility call is mandatory — without it,
 *     the agent would skip Rule 11 (tier discipline).
 *   - X→X: must call get_robot_full (the joined endpoint that's the whole
 *     point of having that endpoint).
 *   - X→G: must call find_gaps with the right domain depending on which
 *     gap phrase the user used.
 *   - B→R: must extract the price ceiling and pass it as price_max.
 *   - RxR→C: must produce TWO get_robot_full calls when two robots are named.
 */

import { describe, expect, it } from "vitest"
import {
  extractIndustry,
  extractPolicySlugs,
  extractPriceMax,
  extractRobotSlug,
  extractRobotSlugs,
  extractRobotType,
  extractTaskSlug,
} from "@/lib/agent/recipes/extract"
import { getRecipe, planForQuestion, RECIPES } from "@/lib/agent/recipes"
import { ALL_SHAPES, routeQuestion } from "@/lib/agent/router"

// ── Registry sanity ───────────────────────────────────────────────

describe("recipe registry", () => {
  it("has a recipe for every shape in ALL_SHAPES", () => {
    for (const shape of ALL_SHAPES) {
      const recipe = getRecipe(shape)
      expect(recipe).toBeDefined()
      expect(recipe.shape).toBe(shape)
      expect(recipe.describe).toBeTruthy()
    }
  })

  it("every recipe returns at least one step for a generic question", () => {
    for (const shape of ALL_SHAPES) {
      const steps = getRecipe(shape).plan("test question with no specifics")
      expect(steps.length, `recipe ${shape} returned no steps`).toBeGreaterThan(0)
      for (const step of steps) {
        expect(step.tool).toBeTruthy()
        expect(step.rationale.length).toBeGreaterThan(10)
      }
    }
  })

  it("RECIPES has exactly 22 entries", () => {
    expect(Object.keys(RECIPES).length).toBe(22)
  })
})

// ── Shape 4: R→P (the spec's example test) ───────────────────────

describe("R->P recipe (shape 4 — the spec's canonical test)", () => {
  it("for 'What policies run on my Franka Panda?' calls search_compatibility AND search_policies", () => {
    const steps = planForQuestion("What policies run on my Franka Panda?", "R->P")
    expect(steps.length).toBe(2)
    const tools = steps.map((s) => s.tool)
    expect(tools).toContain("search_compatibility")
    expect(tools).toContain("search_policies")
  })

  it("passes the extracted robot slug as the `robot` filter to BOTH calls", () => {
    const steps = planForQuestion("What policies run on my Franka Panda?", "R->P")
    for (const step of steps) {
      expect(step.args["robot"]).toBe("franka-panda")
    }
  })

  it("requests up to 50 compatibility edges so the tier breakdown is complete", () => {
    const steps = planForQuestion("What policies run on my Franka Panda?", "R->P")
    const compatStep = steps.find((s) => s.tool === "search_compatibility")
    expect(compatStep).toBeDefined()
    expect(compatStep?.args["limit"]).toBe(50)
  })

  it("falls back to a broad search_policies when no robot slug can be extracted", () => {
    const steps = planForQuestion("What policies are there?", "R->P")
    expect(steps.length).toBe(1)
    expect(steps[0]?.tool).toBe("search_policies")
  })
})

// ── Other load-bearing recipes ────────────────────────────────────

describe("X->X recipe (everything for X)", () => {
  it("calls get_robot_full + search_compatibility + search_deploy_notes", () => {
    const steps = planForQuestion("Everything for ALOHA 2: robot, policies, datasets", "X->X")
    const tools = new Set(steps.map((s) => s.tool))
    expect(tools.has("get_robot_full")).toBe(true)
    expect(tools.has("search_compatibility")).toBe(true)
    expect(tools.has("search_deploy_notes")).toBe(true)
  })

  it("passes the extracted robot slug to get_robot_full", () => {
    const steps = planForQuestion("Everything for ALOHA 2", "X->X")
    const fullStep = steps.find((s) => s.tool === "get_robot_full")
    expect(fullStep?.args["slug"]).toBe("aloha-2")
  })
})

describe("X->G recipe (gap finder)", () => {
  it("'robots with no policies' uses domain=robots-without-policies", () => {
    const steps = planForQuestion("which robots have no policies?", "X->G")
    expect(steps[0]?.tool).toBe("find_gaps")
    expect(steps[0]?.args["domain"]).toBe("robots-without-policies")
  })

  it("'tasks with no data' uses domain=tasks-without-data", () => {
    const steps = planForQuestion("what tasks have no data?", "X->G")
    expect(steps[0]?.args["domain"]).toBe("tasks-without-data")
  })

  it("default fallback uses domain=untested-edges", () => {
    const steps = planForQuestion("untested combinations", "X->G")
    expect(steps[0]?.args["domain"]).toBe("untested-edges")
  })
})

describe("B->R recipe (budget → robot)", () => {
  it("extracts a price ceiling like '$10K' and passes it as price_max", () => {
    const steps = planForQuestion("Robots under $10K for manipulation", "B->R")
    expect(steps[0]?.tool).toBe("search_robots")
    expect(steps[0]?.args["price_max"]).toBe(10000)
  })

  it("extracts '$5,000' (with comma)", () => {
    const steps = planForQuestion("manipulation arms under $5,000", "B->R")
    expect(steps[0]?.args["price_max"]).toBe(5000)
  })
})

describe("RxR->C recipe (compare two robots)", () => {
  it("produces two get_robot_full steps when two robots are named", () => {
    const steps = planForQuestion("Compare Franka Panda vs UR5e", "RxR->C")
    expect(steps.length).toBe(2)
    expect(steps.every((s) => s.tool === "get_robot_full")).toBe(true)
    const slugs = steps.map((s) => s.args["slug"])
    expect(slugs).toContain("franka-panda")
    expect(slugs).toContain("ur5e")
  })

  it("falls back to a broad search if fewer than two robots are named", () => {
    const steps = planForQuestion("compare some arms", "RxR->C")
    expect(steps.length).toBe(1)
    expect(steps[0]?.tool).toBe("search_robots")
  })
})

describe("PxP->C recipe (compare two policies)", () => {
  it("produces two policy lookups when two policies are named", () => {
    const steps = planForQuestion("Compare Diffusion Policy vs ACT on bimanual", "PxP->C")
    expect(steps.length).toBe(2)
    expect(steps.every((s) => s.tool === "search_policies")).toBe(true)
  })
})

describe("P->E recipe (policy evidence)", () => {
  it("calls search_compatibility filtered by both policy AND robot when both are named", () => {
    const steps = planForQuestion("Has ACT been tested on ALOHA? Success rate?", "P->E")
    const compatStep = steps.find((s) => s.tool === "search_compatibility")
    expect(compatStep).toBeDefined()
    expect(compatStep?.args["policy"]).toBe("act-aloha-sim-transfer-cube")
    expect(compatStep?.args["robot"]).toBe("aloha-2")
  })
})

describe("R->$ recipe (TCO)", () => {
  it("calls get_robot_full so it can read price_usd, build_paths, deploy_readiness", () => {
    const steps = planForQuestion("Total cost of ownership for Franka for one year", "R->$")
    expect(steps[0]?.tool).toBe("get_robot_full")
    expect(steps[0]?.args["slug"]).toBe("franka-panda")
  })
})

describe("R->W recipe (setup workflow)", () => {
  it("pulls robot record + deploy notes for the setup guide", () => {
    const steps = planForQuestion("How do I set up ALOHA 2 from scratch?", "R->W")
    const tools = new Set(steps.map((s) => s.tool))
    expect(tools.has("get_robot_full")).toBe(true)
    expect(tools.has("search_deploy_notes")).toBe(true)
  })
})

describe("F->P recipe (stack → policy)", () => {
  it("filters by framework=PyTorch when the user mentions pytorch", () => {
    const steps = planForQuestion("I have ROS 2 and pytorch, what policies?", "F->P")
    expect(steps[0]?.args["framework"]).toBe("PyTorch")
  })

  it("falls back to free-text search when no framework is mentioned", () => {
    const steps = planForQuestion("I have ROS 2 and a Jetson, what policies?", "F->P")
    expect(steps[0]?.tool).toBe("search_policies")
    expect(typeof steps[0]?.args["q"]).toBe("string")
  })
})

describe("K->P recipe (top policies)", () => {
  it("gates ranking to evidence=verified so tier-4 noise can't dominate the top-N", () => {
    const steps = planForQuestion("Top 5 locomotion policies for quadrupeds", "K->P")
    expect(steps[0]?.args["evidence"]).toBe("verified")
    expect(steps[0]?.args["skill"]).toBe("locomotion")
  })
})

describe("A->X recipe (paper reproduction)", () => {
  it("only requests verified compatibility edges (you can't reproduce a tier-4 inferred result)", () => {
    const steps = planForQuestion("I read the ACT paper, how do I reproduce it?", "A->X")
    const compatStep = steps.find((s) => s.tool === "search_compatibility")
    expect(compatStep?.args["status"]).toBe("verified")
  })
})

// ── Extractor unit tests ──────────────────────────────────────────

describe("entity extractors", () => {
  it("extractRobotSlug recognizes Franka Panda variations", () => {
    expect(extractRobotSlug("Franka Panda")).toBe("franka-panda")
    expect(extractRobotSlug("franka")).toBe("franka-panda")
    expect(extractRobotSlug("the panda")).toBe("franka-panda")
  })

  it("extractRobotSlug returns null for unknown robots", () => {
    expect(extractRobotSlug("the magic robot 9000")).toBeNull()
  })

  it("extractRobotSlugs returns multiple robot slugs from one question", () => {
    const slugs = extractRobotSlugs("compare franka vs ur5e")
    expect(slugs).toContain("franka-panda")
    expect(slugs).toContain("ur5e")
  })

  it("extractTaskSlug recognizes 'pick and place'", () => {
    expect(extractTaskSlug("what robot can pick and place?")).toBe("pick-and-place")
  })

  it("extractRobotType recognizes 'humanoid'", () => {
    expect(extractRobotType("Deployment gotchas for humanoids?")).toBe("humanoid")
  })

  it("extractIndustry recognizes 'warehouse logistics'", () => {
    expect(extractIndustry("I work in warehouse logistics")).toBe("warehouse")
  })

  it("extractPriceMax handles $10K", () => {
    expect(extractPriceMax("Robots under $10K")).toBe(10000)
  })

  it("extractPriceMax handles $5,000", () => {
    expect(extractPriceMax("under $5,000")).toBe(5000)
  })

  it("extractPriceMax returns null when no price is mentioned", () => {
    expect(extractPriceMax("the best robot")).toBeNull()
  })

  it("extractPolicySlugs returns multiple slugs", () => {
    const slugs = extractPolicySlugs("compare ACT vs diffusion policy")
    expect(slugs.length).toBeGreaterThanOrEqual(2)
  })
})

// ── Integration: route + plan together ────────────────────────────

describe("route + plan integration (every shape end-to-end)", () => {
  const FIXTURES: { question: string; expectedTool: string }[] = [
    { question: "What robot can fold laundry?", expectedTool: "search_robots" },
    { question: "What policies run on my Franka Panda?", expectedTool: "search_compatibility" },
    { question: "What tasks is the Go2 good for?", expectedTool: "search_tasks" },
    { question: "Deployment gotchas for humanoids?", expectedTool: "search_deploy_notes" },
    { question: "Robots under $10K for manipulation?", expectedTool: "search_robots" },
    { question: "Top 5 locomotion policies for quadrupeds?", expectedTool: "search_policies" },
    { question: "Everything for ALOHA 2", expectedTool: "get_robot_full" },
    { question: "what robots have no policies?", expectedTool: "find_gaps" },
    { question: "Compare Franka Panda vs UR5e", expectedTool: "get_robot_full" },
    { question: "TCO for Franka for one year", expectedTool: "get_robot_full" },
  ]

  for (const { question, expectedTool } of FIXTURES) {
    it(`"${question.slice(0, 50)}..." → routed → planned → calls ${expectedTool}`, () => {
      const { shape } = routeQuestion(question)
      const steps = planForQuestion(question, shape)
      const tools = steps.map((s) => s.tool)
      expect(tools).toContain(expectedTool)
    })
  }
})
