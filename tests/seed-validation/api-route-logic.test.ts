import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const routeSource = readFileSync(
  join(__dirname, "../../apps/web/src/app/api/agent/route.ts"),
  "utf-8",
)

const canvasSource = readFileSync(
  join(__dirname, "../../apps/web/src/app/workbench/workbench-canvas.tsx"),
  "utf-8",
)

// ── Fallback ask_user constant ──────────────────────────────────

describe("fallback imports in route", () => {
  it("imports buildFallbackAskUser from fallbacks module", () => {
    expect(routeSource).toContain("buildFallbackAskUser")
    expect(routeSource).toContain("@/lib/agent/fallbacks")
  })

  it("imports buildFallbackDeployment from fallbacks module", () => {
    expect(routeSource).toContain("buildFallbackDeployment")
  })

  it("uses fallbacks in the guaranteed fallback section", () => {
    expect(routeSource).toContain("buildFallbackDeployment(addedNodeNames)")
    expect(routeSource).toContain("buildFallbackAskUser(addedNodeTypes, addedNodeNames)")
  })
})

// ── Retry logic ─────────────────────────────────────────────────

describe("retry logic", () => {
  it("has MAX_RETRIES constant", () => {
    expect(routeSource).toContain("MAX_RETRIES")
  })

  it("MAX_RETRIES is at least 2", () => {
    const match = routeSource.match(/MAX_RETRIES\s*=\s*(\d+)/)
    expect(match).not.toBeNull()
    expect(Number(match![1])).toBeGreaterThanOrEqual(2)
  })

  it("has RETRY_BASE_MS constant", () => {
    expect(routeSource).toContain("RETRY_BASE_MS")
  })

  it("checks for overloaded/529 errors", () => {
    expect(routeSource).toContain("overloaded")
    expect(routeSource).toContain("529")
  })

  it("uses linear or exponential backoff", () => {
    // Should multiply base by attempt number
    expect(routeSource).toMatch(/RETRY_BASE_MS\s*\*/)
  })

  it("retry logic wraps the streaming call", () => {
    expect(routeSource).toContain("messages.stream")
    expect(routeSource).toContain("attempt")
  })
})

// ── Tool result nudging ─────────────────────────────────────────

describe("tool result nudging", () => {
  it("checks for exploration_group in tool results", () => {
    expect(routeSource).toContain("exploration_group")
  })

  it("nudge message mentions ask_user", () => {
    expect(routeSource).toContain("MUST call")
    expect(routeSource).toContain("ask_user")
  })

  it("nudge only fires when ask_user has not been called", () => {
    expect(routeSource).toContain("!askedUser")
  })

  it("nudge only fires on last tool result", () => {
    // Should check if current tool is the last in the array
    expect(routeSource).toContain("toolUseBlocks[toolUseBlocks.length - 1]")
  })
})

// ── Fallback injection logic ────────────────────────────────────

describe("fallback injection logic", () => {
  it("tracks askedUser state", () => {
    expect(routeSource).toContain("let askedUser = false")
  })

  it("tracks addedNodeTypes", () => {
    expect(routeSource).toContain("addedNodeTypes")
  })

  it("sets askedUser to true when ask_user is called", () => {
    expect(routeSource).toContain('block.name === "ask_user"')
    expect(routeSource).toContain("askedUser = true")
  })

  it("tracks robot/policy/environment node types", () => {
    expect(routeSource).toContain('"robot"')
    expect(routeSource).toContain('"policy"')
    expect(routeSource).toContain('"environment"')
  })

  it("fallback fires AFTER the while loop (guaranteed)", () => {
    // The fallback should be outside the while loop, after the catch
    // It checks hasLaneNodes and !askedUser
    expect(routeSource).toContain("hasLaneNodes")
    expect(routeSource).toContain("buildFallbackAskUser")
  })

  it("fallback fires after loop and catch (guaranteed path)", () => {
    expect(routeSource).toContain("GUARANTEED FALLBACK")
    const guaranteedIndex = routeSource.indexOf("GUARANTEED FALLBACK")
    const closeIndex = routeSource.indexOf("controller.close()", guaranteedIndex)
    expect(guaranteedIndex).toBeGreaterThan(0)
    expect(closeIndex).toBeGreaterThan(guaranteedIndex)
  })

  it("tracks node names for context-aware fallback", () => {
    expect(routeSource).toContain("addedNodeNames")
  })
})

// ── SSE event format ────────────────────────────────────────────

describe("SSE event format", () => {
  it("streams data: prefix on every event", () => {
    // sseEvent helper formats all events with 'data: ' prefix
    expect(routeSource).toContain('`data: ${JSON.stringify(data)}\\n\\n`')
    // All controller.enqueue calls use sseEvent
    const sseEventCalls = routeSource.match(/sseEvent\(/g) ?? []
    expect(sseEventCalls.length).toBeGreaterThanOrEqual(4)
  })

  it("streams tool_call events with name and input", () => {
    expect(routeSource).toContain('type: "tool_call"')
    expect(routeSource).toContain("name: block.name")
    expect(routeSource).toContain("input: block.input")
    // Uses contentBlock event for streaming tool calls
    expect(routeSource).toContain("contentBlock")
  })

  it("streams text delta events for typewriter effect", () => {
    expect(routeSource).toContain('type: "text_delta"')
    expect(routeSource).toContain("text: textDelta")
  })

  it("streams done event at the end", () => {
    expect(routeSource).toContain('type: "done"')
  })

  it("guards text_delta against tool-like content", () => {
    // The text delta handler should filter out text that looks like tool JSON
    expect(routeSource).toContain("textAccumulator")
    expect(routeSource).toContain("tool_use")
    expect(routeSource).toContain("add_node")
    expect(routeSource).toContain("show_agent_message")
  })

  it("streams error events on failure", () => {
    expect(routeSource).toContain('type: "error"')
  })

  it("uses double newline SSE delimiter in sseEvent helper", () => {
    // The sseEvent helper uses \\n\\n as SSE delimiter
    expect(routeSource).toContain("\\n\\n")
  })
})

// ── Loop bounds ─────────────────────────────────────────────────

describe("loop bounds", () => {
  it("MAX_TURNS prevents infinite loops", () => {
    const match = routeSource.match(/MAX_TURNS\s*=\s*(\d+)/)
    expect(match).not.toBeNull()
    const maxTurns = Number(match![1])
    // Floor: enough for the basic Task -> Hardware -> Deploy -> ask_user
    // pipeline with one-tool-per-turn pacing observed in traces.
    // Ceiling: prevent runaway loops but allow a deep multi-lane
    // conversation (Task -> Hardware -> Policy -> Sim -> Deploy + retries).
    expect(maxTurns).toBeGreaterThanOrEqual(10)
    expect(maxTurns).toBeLessThanOrEqual(60)
  })

  it("breaks on end_turn stop reason", () => {
    expect(routeSource).toContain('stop_reason === "tool_use"')
    expect(routeSource).toContain("break")
  })

  it("continues loop on tool_use stop reason", () => {
    expect(routeSource).toContain("messages.push")
    expect(routeSource).toContain("tool_result")
  })
})

// ── Frontend: sidebar purity guards ────────────────────────────

describe("frontend sidebar purity", () => {
  it("cleans up _streaming messages after response completes", () => {
    // After streaming ends, _streaming messages should be filtered out
    expect(canvasSource).toContain('m.specialist !== "_streaming"')
    expect(canvasSource).toContain("prev.filter")
  })

  it("text_delta handler filters tool-like content via cleanStreamingText", () => {
    expect(canvasSource).toContain("cleanStreamingText")
  })

  it("tool_call events go to handleToolCall, not to messages", () => {
    // tool_call events should call handleToolCall, not setMessages
    expect(canvasSource).toContain("handleToolCall(event.name")
  })

  it("tool call summary strings are stored in conversationRef, not messages", () => {
    // The [tool: ...] strings go into assistantActions → conversationRef, not setMessages
    expect(canvasSource).toContain("assistantActions.push")
    expect(canvasSource).toContain("conversationRef.current.push")
  })

  it("sidebar skips _streaming specialist avatar", () => {
    expect(canvasSource).toContain('specialist !== "_streaming"')
  })
})
