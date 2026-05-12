/**
 * System prompt structure tests.
 *
 * Step 2.3 rewrote the prompt to remove inlined seed data and rely on API
 * tools instead. Phase 4.2 split each specialist's section into its own
 * versioned `.md` file under `prompts/` and made `system-prompt.ts` a
 * loader. These tests assert that the ASSEMBLED prompt (after loading
 * + concatenation) still carries the load-bearing behavioral rules:
 * six specialists, status-first, mandatory deployment annotation,
 * never-go-silent, lane pipeline, and tool patterns.
 *
 * Calls `buildSystemPrompt("", "{}")` directly so the test sees what the
 * agent route actually sees, not what the .ts source happens to declare.
 */

import { describe, expect, it } from "vitest"
import { buildSystemPrompt } from "@/lib/agent/system-prompt"

const promptText = buildSystemPrompt("", "{}")

describe("system prompt structure", () => {
  it("contains prompt text", () => {
    expect(promptText.length).toBeGreaterThan(500)
  })

  it("names all 6 specialists", () => {
    expect(promptText).toContain("task")
    expect(promptText).toContain("hardware")
    expect(promptText).toContain("policy")
    expect(promptText).toContain("simulation")
    expect(promptText).toContain("community")
    expect(promptText).toContain("deployment")
  })

  it("lists task before hardware before policy in the specialist section", () => {
    const taskIdx = promptText.indexOf("task-analyst")
    const hardwareIdx = promptText.indexOf("hardware-scout")
    const policyIdx = promptText.indexOf("policy-scout")
    expect(taskIdx).toBeGreaterThan(-1)
    expect(taskIdx).toBeLessThan(hardwareIdx)
    expect(hardwareIdx).toBeLessThan(policyIdx)
  })

  it("requires the agent to never go silent after a lane (rule 10)", () => {
    expect(promptText).toMatch(/Never go silent|never go silent/i)
    expect(promptText).toContain("ask_user")
  })

  it("requires deployment annotation on every robot suggestion", () => {
    expect(promptText).toMatch(/MANDATORY|DEPLOY ADVISOR ON EVERY ROBOT/)
    expect(promptText).toContain("deployment")
  })

  it("requires set_canvas_status as the first tool call of every turn", () => {
    expect(promptText).toContain("set_canvas_status")
    expect(promptText).toMatch(/starts with set_canvas_status|first call|FIRST tool call/i)
  })

  it("contains the lane pipeline rule (selection ends a lane, opens the next)", () => {
    expect(promptText).toMatch(/lane is DONE|Lane pipeline/)
    expect(promptText).toMatch(/NEXT lane|next lane/)
  })

  it("documents the API tool surface so the model knows to call them", () => {
    expect(promptText).toContain("search_robots")
    expect(promptText).toContain("search_policies")
    expect(promptText).toContain("search_compatibility")
    expect(promptText).toContain("search_tasks")
    expect(promptText).toContain("get_robot_full")
    expect(promptText).toContain("find_gaps")
  })

  it("documents the four reliability tiers for compatibility edges", () => {
    expect(promptText).toMatch(/Tier 1/)
    expect(promptText).toMatch(/Tier 4/)
    expect(promptText).toMatch(/taxonomy-match/)
  })

  it("contains all tool usage patterns A through E", () => {
    expect(promptText).toContain("A.")
    expect(promptText).toContain("B.")
    expect(promptText).toContain("C.")
    expect(promptText).toContain("D.")
    expect(promptText).toContain("E.")
  })

  it("every robot/policy/env pattern ends with ask_user", () => {
    const patternA = promptText.slice(promptText.indexOf("A."), promptText.indexOf("B."))
    const patternB = promptText.slice(promptText.indexOf("B."), promptText.indexOf("C."))
    const patternC = promptText.slice(promptText.indexOf("C."), promptText.indexOf("D."))
    expect(patternA).toContain("ask_user")
    expect(patternB).toContain("ask_user")
    expect(patternC).toContain("ask_user")
  })

  it("forbids inventing slugs / benchmarks / paper URLs", () => {
    expect(promptText).toMatch(/Never invent|never invent|NEVER invent/)
  })

  it("contains NO inlined slug whitelist (data lives in the API now)", () => {
    // Pre-Step-2.3 the prompt embedded "Valid robot slugs: so-100, koch-v11, ..."
    // After Step 2.3, slugs come from API responses only.
    expect(promptText).not.toContain("Valid robot slugs:")
    expect(promptText).not.toContain("Valid policy slugs:")
    expect(promptText).not.toContain("Valid environment slugs:")
  })
})
