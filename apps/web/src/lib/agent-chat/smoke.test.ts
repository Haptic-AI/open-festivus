import Anthropic from "@anthropic-ai/sdk"
import { afterAll, describe, expect, it } from "vitest"
import { AGENT_CHAT_SYSTEM_PROMPT } from "./system-prompt"
import { buildTools } from "@/lib/edit-primitives/tools"

/**
 * Spec 029 Step 3.2. Does Claude respond to plain-English edit requests
 * by calling list_candidates with the correct table+field, and no
 * premature apply_edit? Three single-turn checks cover the three
 * domains named in Success criterion #4: robots × weight_kg,
 * policies × license, deploy_notes × severity.
 *
 * LLM-tier test. ~3 real Anthropic round trips, ~$0.02 total.
 * Skips when ANTHROPIC_API_KEY is absent so CI stays free.
 */

const ANTHROPIC_API_KEY = process.env["ANTHROPIC_API_KEY"]
const MODEL = "claude-sonnet-4-20250514"

interface IToolUseBlock {
  type: "tool_use"
  name: string
  input: Record<string, unknown>
}
interface ITextBlock {
  type: "text"
  text: string
}
type IBlock = IToolUseBlock | ITextBlock | { type: string }

interface ICase {
  label: string
  userMessage: string
  expectTable: string
  expectField: string
}

const cases: ICase[] = [
  {
    label: "robots × weight_kg",
    userMessage:
      "Find a few humanoid robots whose weight_kg is null or missing so I can fill one in.",
    expectTable: "robots",
    expectField: "weight_kg",
  },
  {
    label: "policies × license",
    userMessage:
      "Which policies are missing a license field? Show me three so I can add one.",
    expectTable: "policies",
    expectField: "license",
  },
  {
    label: "deploy_notes × severity",
    userMessage:
      "Show me deploy_notes rows where the severity is missing so I can set it.",
    expectTable: "deploy_notes",
    expectField: "severity",
  },
]

describe.skipIf(!ANTHROPIC_API_KEY)("agent-chat smoke (spec 029)", () => {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY! })

  afterAll(() => {
    // eslint-disable-next-line no-console
    console.log("[agent-chat-smoke] real Anthropic round-trips complete.")
  })

  for (const c of cases) {
    it(`${c.label}: Claude calls list_candidates with table=${c.expectTable} field=${c.expectField}`, async () => {
      const tools = buildTools()
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 512,
        system: AGENT_CHAT_SYSTEM_PROMPT,
        tools: tools as never,
        messages: [{ role: "user", content: c.userMessage }],
      })

      const blocks = res.content as IBlock[]
      const toolUses = blocks.filter((b): b is IToolUseBlock => b.type === "tool_use")
      const names = toolUses.map((t) => t.name)

      expect(names, `expected list_candidates, got: ${names.join(", ")}`).toContain(
        "list_candidates",
      )
      // Claude must never auto-apply without a confirmation loop.
      expect(names).not.toContain("apply_edit")

      const listCall = toolUses.find((t) => t.name === "list_candidates")
      expect(listCall?.input["table"]).toBe(c.expectTable)
      expect(listCall?.input["field"]).toBe(c.expectField)
    }, 30000)
  }
})
