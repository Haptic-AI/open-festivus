/**
 * System prompt tier-rule tests (Step 3.0).
 *
 * The lean prompt removed seed data and now relies on tools, but a model
 * left to its own devices will happily say "X works with Y" when the only
 * evidence is a tier-4 inferred edge. The badge component is correct but
 * the agent's prose would still hallucinate confidence.
 *
 * Step 3.0 added a COMPATIBILITY DATA RULES section that:
 *   - Tells the model to read reliability_tier on every edge BEFORE writing
 *   - Pins exactly what to say for each of the four tiers
 *   - Forbids "compatible" / "works with" language for tier 3 / tier 4
 *   - Forbids aggregating tier-4 edges into a flat count
 *
 * These tests pin the literal strings the plan calls for so future prompt
 * edits cannot silently drop the tier discipline.
 */

import { describe, expect, it } from "vitest"
import { buildSystemPrompt } from "@/lib/agent/system-prompt"

const prompt = buildSystemPrompt("", "{}")

describe("system prompt tier rules (Step 3.0)", () => {
  it("contains the COMPATIBILITY DATA RULES header", () => {
    expect(prompt).toContain("COMPATIBILITY DATA RULES")
  })

  it("references reliability_tier explicitly so the model checks the field", () => {
    expect(prompt).toContain("reliability_tier")
  })

  it("names every tier from 1 through 4", () => {
    expect(prompt).toContain("Tier 1")
    expect(prompt).toContain("Tier 2")
    expect(prompt).toContain("Tier 3")
    expect(prompt).toContain("Tier 4")
  })

  it("includes the tier-3 plausibility phrasing the spec requires", () => {
    expect(prompt).toMatch(/untested but plausible/i)
  })

  it("includes the tier-4 verification call to action", () => {
    expect(prompt).toContain("Help verify it")
  })

  it("teaches the model to group results by tier in summaries", () => {
    expect(prompt).toMatch(/group .* by tier|present each group separately/i)
  })

  it("forbids the word 'compatible' for tier 3/4 edges (forbidden phrases list)", () => {
    expect(prompt).toMatch(/Forbidden phrases/)
    expect(prompt).toContain('"compatible"')
    expect(prompt).toContain('"works with"')
  })

  it("forbids aggregating tier-4 edges into a flat count", () => {
    expect(prompt).toMatch(/NEVER aggregate tier-4|never aggregate.*count/i)
  })

  it("still fits within the token budget after adding the new section", () => {
    // Budget bumped to 3800 in spec 029 Phase 3.3 — see the comment block in
    // tests/seed-validation/system-prompt-size.test.ts for the rationale.
    const estimatedTokens = Math.ceil(prompt.length / 4)
    expect(estimatedTokens).toBeLessThan(3800)
  })
})
