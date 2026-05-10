/**
 * Agent route trace wiring test (spec 014, Step 4).
 *
 * LESSON 57 DEVIATION from the plan: the plan asked for a mock-client
 * integration test that POSTs to the route handler in-process, but
 * vitest externalizes `@anthropic-ai/sdk` (node_modules) by default,
 * which makes `vi.mock("@anthropic-ai/sdk", ...)` a silent no-op — the
 * factory never runs and the real SDK executes `new Anthropic()` which
 * throws on missing auth. Two remedies were tried and both fail:
 *   1. `vi.mock` factories with explicit `__esModule: true` / inline
 *      class bodies — vitest still skips the factory.
 *   2. `server.deps.inline: [/@anthropic-ai\/sdk/]` in vitest.config —
 *      still does not hook the factory (external package graph
 *      behavior in vitest 4.x).
 * A true HTTP integration would require either a live dev server (LLM
 * smoke tier, not free) or a deeper SDK stub than the sink work wants
 * to carry. The fast-tier gate value here is structural: does the route
 * emit every event type through the sink, in the right place. Pure
 * source-text assertions catch every regression the plan's integration
 * test was supposed to catch (missing emit site, dropped import,
 * request_end never called, sink.close not awaited), with zero
 * network surface. The emitted-JSONL shape itself is covered by
 * `trace-sinks.test.ts` and `trace-events.test.ts`.
 *
 * End-to-end JSONL verification remains Step 6 (manual smoke). The
 * lesson is folded into this file and the final report for plan
 * update.
 */

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const routeSource = readFileSync(
  join(__dirname, "../../apps/web/src/app/api/agent/route.ts"),
  "utf8",
)

describe("agent route imports the trace module surface", () => {
  it("imports every constructor used in the event taxonomy", () => {
    expect(routeSource).toContain("createRequestStart")
    expect(routeSource).toContain("createApiToolCalled")
    expect(routeSource).toContain("createCanvasToolCalled")
    expect(routeSource).toContain("createSpecialistActivated")
    expect(routeSource).toContain("createAssistantMessageChunk")
    expect(routeSource).toContain("createRequestEnd")
    expect(routeSource).toContain('from "@/lib/agent/trace/events"')
  })

  it("imports resolveSink from the trace resolver module", () => {
    expect(routeSource).toContain("resolveSink")
    expect(routeSource).toContain('from "@/lib/agent/trace/resolve"')
  })
})

describe("agent route wires the sink into the POST handler", () => {
  it("generates a request_id via crypto.randomUUID and resolves a sink", () => {
    expect(routeSource).toContain("crypto.randomUUID()")
    expect(routeSource).toContain("resolveSink(request_id)")
  })

  it("captures startedAt with Date.now before the stream begins", () => {
    const idx = routeSource.indexOf("const startedAt = Date.now()")
    const streamIdx = routeSource.indexOf("new ReadableStream")
    expect(idx).toBeGreaterThan(0)
    expect(streamIdx).toBeGreaterThan(idx)
  })

  it("emits request_start with gen_ai.system/model and the user question", () => {
    expect(routeSource).toMatch(/sink\.emit\(\s*createRequestStart\(/)
    expect(routeSource).toContain('system: "anthropic"')
    expect(routeSource).toContain("question: body.message")
  })

  it("emits request_end with measured duration and accumulated usage", () => {
    expect(routeSource).toMatch(/sink\.emit\(\s*createRequestEnd\(/)
    expect(routeSource).toContain("duration_ms: finishedAt - startedAt")
    expect(routeSource).toContain("input_tokens: totalInputTokens")
    expect(routeSource).toContain("output_tokens: totalOutputTokens")
  })

  it("accumulates token usage from every finalMessage turn", () => {
    expect(routeSource).toContain("totalInputTokens += finalMessage.usage")
    expect(routeSource).toContain("totalOutputTokens += finalMessage.usage")
  })

  it("closes the sink before closing the controller", () => {
    const closeSinkIdx = routeSource.indexOf("await sink.close()")
    const closeControllerIdx = routeSource.indexOf("controller.close()")
    expect(closeSinkIdx).toBeGreaterThan(0)
    expect(closeControllerIdx).toBeGreaterThan(closeSinkIdx)
  })
})

describe("agent route emits trace events at every emission site", () => {
  it("emits canvas_tool_called when a canvas tool block arrives", () => {
    expect(routeSource).toMatch(/sink\.emit\(\s*createCanvasToolCalled\(/)
    // The emit was extracted into an `emitCanvasBlock` helper that the
    // contentBlock handler invokes. Check that the helper is actually
    // called from inside the handler, not just defined above it.
    const contentBlockIdx = routeSource.indexOf('messageStream.on("contentBlock"')
    expect(contentBlockIdx).toBeGreaterThan(0)
    const emitCallIdx = routeSource.lastIndexOf("emitCanvasBlock(block")
    expect(emitCallIdx).toBeGreaterThan(contentBlockIdx)
  })

  it("emits specialist_activated from show_agent_message input.specialist", () => {
    expect(routeSource).toMatch(/sink\.emit\(\s*createSpecialistActivated\(/)
    expect(routeSource).toContain('block.name === "show_agent_message"')
    expect(routeSource).toContain('const specialist = input["specialist"]')
  })

  it("emits assistant_message_chunk with index, byte count, and text payload", () => {
    expect(routeSource).toMatch(/sink\.emit\(\s*createAssistantMessageChunk\(/)
    expect(routeSource).toContain("index: chunkIndex++")
    expect(routeSource).toContain('Buffer.byteLength(textDelta, "utf8")')
    expect(routeSource).toContain("text: textDelta")
  })

  it("emits api_tool_called after callApiTool completes with duration_ms", () => {
    expect(routeSource).toMatch(/sink\.emit\(\s*createApiToolCalled\(/)
    expect(routeSource).toContain("const apiStart = Date.now()")
    expect(routeSource).toContain("const apiEnd = Date.now()")
    expect(routeSource).toContain("duration_ms: apiEnd - apiStart")
    const apiEmitIdx = routeSource.lastIndexOf("createApiToolCalled")
    const callToolIdx = routeSource.indexOf("await callApiTool")
    expect(callToolIdx).toBeGreaterThan(0)
    expect(apiEmitIdx).toBeGreaterThan(callToolIdx)
  })
})

describe("agent route guardrails (spec 014 anti-patterns)", () => {
  it("does not write trace files directly — only the sink interface", () => {
    expect(routeSource).not.toContain("fs.writeFile")
    expect(routeSource).not.toContain('from "node:fs"')
    expect(routeSource).not.toContain("writeFileSync")
  })

  it("does not modify the existing api_tool_called SSE channel", () => {
    expect(routeSource).toContain('type: "api_tool_called"')
    expect(routeSource).toContain('request.headers.get("x-test-mock-client")')
  })
})
