/**
 * System prompt tool-call discipline (Phase 4.2 Part 2 / Codified Rule 26).
 *
 * Rule 26: "The agent's FIRST action on any data-shaped question is a
 * tool call." Lesson 29 caught the underlying bug — the integration
 * test passed because we used "look up the dataset" phrasing, but in
 * production, real users won't reword their questions.
 *
 * The fix is to bake the literal Rule 26 language into the system
 * prompt and pin it with this unit test so a future prompt rewrite
 * cannot silently drop the discipline. The natural-phrasing smoke
 * test in `tests/persona-tests/agent-natural-phrasing.test.ts` is
 * the runtime gate; this file is the static gate.
 *
 * Why both?
 *  - Static (this file): cheap, deterministic, runs in 5ms. Catches
 *    "someone deleted the section." Cannot catch "the LLM ignores it."
 *  - Runtime (smoke test): catches "the LLM ignores it" by firing 5
 *    natural-phrasing questions and asserting api_tool_called events.
 *    Slow + non-deterministic, but it's the production correctness gate.
 *
 * Both must pass.
 */

import { describe, expect, it } from "vitest"
import { buildSystemPrompt } from "@/lib/agent/system-prompt"

const prompt = buildSystemPrompt("", "{}")

describe("system prompt tool-call discipline (Step 4.2 / Rule 26)", () => {
  it("contains the TOOL-CALL DISCIPLINE section header", () => {
    expect(prompt).toContain("TOOL-CALL DISCIPLINE")
  })

  it("declares the FIRST-action requirement verbatim", () => {
    expect(prompt).toContain("FIRST action on any data-shaped question is a tool call")
  })

  it("names the entity types that trigger the rule", () => {
    expect(prompt).toContain("robot, policy, task, dataset, deploy note, benchmark, environment, or compatibility")
  })

  it("contains the STOP-and-call-the-tool fallback the spec quotes", () => {
    expect(prompt).toContain("STOP and call the tool first")
  })

  it("explicitly says natural phrasings still require a tool call", () => {
    expect(prompt).toMatch(/natural phrasings.*STILL.*tool call/i)
  })

  it("rejects 'prompt vocabulary as substitute for live data'", () => {
    expect(prompt).toMatch(/prompt vocabulary.*NOT a substitute|not a substitute/i)
  })

  it("provides at least one concrete natural-phrasing example for each shape that bit us", () => {
    expect(prompt).toContain("What can break on a Go2?")
    expect(prompt).toContain("Is the Tello safe?")
    expect(prompt).toContain("Should I buy an ALOHA?")
    expect(prompt).toContain("What policies work with my Franka?")
    expect(prompt).toContain("What's the best policy for picking things up?")
  })

  it("teaches a fallback when the right tool isn't obvious (free-text q)", () => {
    expect(prompt).toMatch(/free-text q parameter|search_robots .* search_policies/)
  })

  it("the section appears BEFORE the reliability tiers section in the assembled prompt", () => {
    const disciplineIdx = prompt.indexOf("TOOL-CALL DISCIPLINE")
    const tiersIdx = prompt.indexOf("Reliability tiers")
    expect(disciplineIdx).toBeGreaterThan(-1)
    expect(tiersIdx).toBeGreaterThan(-1)
    expect(disciplineIdx).toBeLessThan(tiersIdx)
  })

  it("still fits within the token budget after adding the discipline section", () => {
    // Budget is 3800 — see tests/seed-validation/system-prompt-size.test.ts
    // for the budget history rationale. Spec 029 Phase 3.3 bumped from 3500
    // because the data-edit tools + rules are load-bearing.
    const estimatedTokens = Math.ceil(prompt.length / 4)
    expect(estimatedTokens).toBeLessThan(3800)
  })
})
