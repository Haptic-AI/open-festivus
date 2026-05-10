/**
 * System prompt size guard.
 *
 * Step 2.3 removed the inlined seed JSON from the system prompt — the agent
 * now fetches every record on demand via API tools. This test enforces a
 * token budget so we don't slip back into prompt-stuffing.
 *
 * Budget history:
 *   - Step 2.3 (initial split):   3000 tokens (lean prompt was ~1500)
 *   - Step 3.0 (tier rules):      3000 tokens (still ~1500 after splitting)
 *   - Step 4.2 Part 1 (file split): 3000 tokens (dedup'd the Reliability
 *     tiers + COMPATIBILITY DATA RULES sections to stay under 3000)
 *   - Step 4.2 Part 2 (Rule 26):  3500 tokens — Phase 4.2 added the
 *     TOOL-CALL DISCIPLINE section (Rule 26) which is load-bearing for
 *     production correctness on natural-phrasing questions. Trimming the
 *     section to fit 3000 would defeat the purpose. The new ceiling
 *     gives ~400 tokens of headroom for future iterations without
 *     reverting to a "best-effort" budget.
 *   - Spec 029 Phase 3.3 (data-edit tools): 3800 tokens — added the
 *     list_candidates / propose_edit / apply_edit tools to the workbench
 *     agent (replacing the old one-step patch_record), plus a "Data edits
 *     vs canvas ops" behavior section so Claude picks update_node vs
 *     propose_edit correctly. Load-bearing: without the section, Claude
 *     guesses wrong on natural phrasings like "fix the weight". The new
 *     ceiling leaves ~200 tokens of headroom.
 *
 * Tokens are estimated as `chars / 4` (a conservative approximation for the
 * Claude tokenizer on English+JSON text). The real tokenizer is slightly
 * more efficient, so passing this test means we're comfortably under budget.
 *
 * If this test fails, the fix is NEVER to add data to the prompt. Add a tool
 * instead and let the model query for it.
 */

import { describe, expect, it } from "vitest"
import { buildSystemPrompt } from "@/lib/agent/system-prompt"
import { loadSeedData } from "@/lib/agent/seed-data"

const TOKEN_BUDGET = 3800
const CHARS_PER_TOKEN = 4

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

describe("system prompt size", () => {
  it("loadSeedData returns the empty string (no inlined seed)", () => {
    expect(loadSeedData()).toBe("")
  })

  it("buildSystemPrompt with empty project state stays under the token budget", () => {
    const prompt = buildSystemPrompt(loadSeedData(), "{}")
    const tokens = estimateTokens(prompt)
    expect(tokens).toBeLessThan(TOKEN_BUDGET)
  })

  it("buildSystemPrompt with a realistic project state stays under the token budget", () => {
    const realisticState = JSON.stringify({
      nodes: [
        { id: "n1", type: "task", data: { name: "Pick and place", slug: "pick-and-place" } },
        { id: "n2", type: "robot", data: { name: "Franka Panda", slug: "franka-panda", price_usd: 35000 } },
      ],
      connections: [{ fromId: "n1", toId: "n2", status: "compatible" }],
    }, null, 2)
    const prompt = buildSystemPrompt(loadSeedData(), realisticState)
    const tokens = estimateTokens(prompt)
    expect(tokens).toBeLessThan(TOKEN_BUDGET)
  })

  it("the prompt does NOT contain inlined seed data sections", () => {
    const prompt = buildSystemPrompt("### ROBOTS\n[{...big seed...}]", "{}")
    // The signature accepts a seedData arg for backwards-compat with the route
    // call site, but it must NOT splice that arg into the output.
    expect(prompt).not.toContain("ROBOTS")
    expect(prompt).not.toContain("big seed")
  })

  it("the prompt instructs the model to call API tools, not invent records", () => {
    const prompt = buildSystemPrompt("", "{}")
    expect(prompt).toMatch(/search_robots/)
    expect(prompt).toMatch(/search_policies/)
    expect(prompt).toMatch(/search_compatibility/)
    expect(prompt).toMatch(/Never invent/i)
  })
})
