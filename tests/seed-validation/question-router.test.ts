/**
 * Question router tests (Step 3.1).
 *
 * Asserts the router correctly classifies one canonical example for each
 * of the 22 MECE shapes from the spec, plus a few adversarial cases:
 *
 *   - "robots WITHOUT policies" must route to gap-finder, not R→P
 *   - "compare X vs Y" must route to compare, not R→P / P→R
 *   - "I read the ACT paper" must route to reproduction, not P→E
 *   - empty/garbage questions fall back to T→R with rule="fallback"
 *
 * The test asserts both the shape AND the matching rule name so future
 * router edits don't change the rule that fires (which would shift the
 * recipe used in Step 3.2).
 */

import { describe, expect, it } from "vitest"
import { ALL_SHAPES, routeQuestion } from "@/lib/agent/router"
import type { IQuestionShape } from "@/lib/agent/router"

interface IShapeFixture {
  shape: IQuestionShape
  question: string
}

// One canonical example per shape, sourced from the spec table.
const FIXTURES: IShapeFixture[] = [
  { shape: "T->R", question: "What robot can fold laundry?" },
  { shape: "T->P", question: "What policy for pick-and-place?" },
  { shape: "T->D", question: "What training data for table cleaning?" },
  { shape: "R->P", question: "What policies run on my Franka Panda?" },
  { shape: "R->T", question: "What tasks is the Go2 good for?" },
  { shape: "R->S", question: "Deployment gotchas for humanoids?" },
  { shape: "P->R", question: "What robots can run diffusion policy?" },
  { shape: "P->E", question: "Has ACT been tested on ALOHA? Success rate?" },
  { shape: "P->D", question: "What dataset was Octo trained on?" },
  { shape: "B->R", question: "Robots under $10K for manipulation?" },
  { shape: "K->P", question: "Top 5 locomotion policies for quadrupeds?" },
  { shape: "K->R", question: "Most popular robots for imitation learning?" },
  { shape: "X->X", question: "Everything for ALOHA: robot, policies, datasets, benchmarks, safety" },
  { shape: "I->R", question: "I work in warehouse logistics. What robots?" },
  { shape: "I->P", question: "Policies for agricultural harvesting?" },
  { shape: "F->P", question: "I have ROS 2 and a Jetson. What policies?" },
  { shape: "A->X", question: "I read the ACT paper. How do I reproduce it?" },
  { shape: "RxR->C", question: "Compare Franka Panda vs UR5e" },
  { shape: "PxP->C", question: "Compare Diffusion Policy vs ACT on bimanual" },
  { shape: "R->W", question: "How do I set up ALOHA 2 from scratch?" },
  { shape: "X->G", question: "What robots have no policies? What tasks have no data?" },
  { shape: "R->$", question: "Total cost of ownership for Franka for one year?" },
]

describe("routeQuestion — every shape has a fixture", () => {
  it("covers all 22 shapes with one canonical example each", () => {
    expect(FIXTURES.length).toBe(22)
    const shapes = new Set(FIXTURES.map((f) => f.shape))
    expect(shapes.size).toBe(22)
    expect(new Set(ALL_SHAPES)).toEqual(shapes)
  })

  for (const { shape, question } of FIXTURES) {
    it(`classifies "${question.slice(0, 60)}..." as ${shape}`, () => {
      const result = routeQuestion(question)
      expect(result.shape).toBe(shape)
      expect(result.signals.length).toBeGreaterThan(0)
      expect(result.rule).not.toBe("fallback")
    })
  }
})

describe("routeQuestion — adversarial / disambiguation", () => {
  it("'robots that have no policies' routes to gap-finder, not R->P", () => {
    expect(routeQuestion("which robots have no policies?").shape).toBe("X->G")
  })

  it("'untested combinations' routes to gap-finder", () => {
    expect(routeQuestion("show me untested robot+policy combinations").shape).toBe("X->G")
  })

  it("'compare ACT vs Diffusion Policy' routes to PxP->C even with policy keywords on each side", () => {
    expect(routeQuestion("compare ACT vs Diffusion Policy").shape).toBe("PxP->C")
  })

  it("'compare panda vs ur5e' routes to RxR->C with two robot mentions", () => {
    expect(routeQuestion("compare panda vs ur5e").shape).toBe("RxR->C")
  })

  it("'I read the ACT paper, how do I reproduce it' routes to A->X, not P->E", () => {
    const result = routeQuestion("I read the ACT paper, how do I reproduce it")
    expect(result.shape).toBe("A->X")
  })

  it("'I have ROS 2 and a Jetson, what policies?' routes to F->P, not I->P", () => {
    expect(routeQuestion("I have ROS 2 and a Jetson, what policies?").shape).toBe("F->P")
  })

  it("'TCO for Franka for one year' routes to R->$ even though it mentions a robot", () => {
    expect(routeQuestion("TCO for Franka for one year").shape).toBe("R->$")
  })

  it("'how do I set up ALOHA 2' routes to R->W, not R->P", () => {
    expect(routeQuestion("how do I set up ALOHA 2").shape).toBe("R->W")
  })
})

describe("routeQuestion — fallback behavior", () => {
  it("empty string falls back to T->R with rule='fallback'", () => {
    const result = routeQuestion("")
    expect(result.shape).toBe("T->R")
    expect(result.rule).toBe("fallback")
  })

  it("nonsense input falls back to T->R", () => {
    const result = routeQuestion("xyzzy plover")
    expect(result.shape).toBe("T->R")
    expect(result.rule).toBe("fallback")
  })

  it("is case-insensitive", () => {
    const upper = routeQuestion("WHAT POLICIES RUN ON MY FRANKA PANDA?")
    const lower = routeQuestion("what policies run on my franka panda?")
    expect(upper.shape).toBe(lower.shape)
    expect(upper.rule).toBe(lower.rule)
  })

  it("returns deterministic output for the same question", () => {
    const a = routeQuestion("what robot can fold laundry?")
    const b = routeQuestion("what robot can fold laundry?")
    expect(a).toEqual(b)
  })
})

describe("routeQuestion — signals are surfaceable for debugging", () => {
  it("returns the matched signal so callers can show why a shape was chosen", () => {
    const result = routeQuestion("what policies run on my Franka Panda?")
    expect(result.shape).toBe("R->P")
    expect(result.signals.length).toBeGreaterThan(0)
  })

  it("returns the rule name so the recipe layer can dispatch", () => {
    const result = routeQuestion("compare panda vs ur5e")
    expect(result.rule).toBe("robot-compare")
  })
})
