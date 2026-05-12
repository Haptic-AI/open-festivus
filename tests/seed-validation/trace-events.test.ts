/**
 * Trace event constructor tests (spec 014, Step 1).
 *
 * One test per constructor plus a tuple-integrity test. Each test pins
 * the OTEL / festivus field path the spec names and guards against
 * leakage of internal aliases at the top level.
 */

import { describe, expect, it } from "vitest"
import {
  CONSTRUCTOR_REGISTRY,
  TRACE_EVENT_TYPES,
  createApiToolCalled,
  createAssistantMessageChunk,
  createCanvasToolCalled,
  createRequestEnd,
  createRequestStart,
  createRouterClassified,
  createSpecialistActivated,
} from "../../apps/web/src/lib/agent/trace/events"

const REQUEST_ID = "r_test_001"
const T = 1712930000000

const ALLOWED_TOP_LEVEL_KEYS: ReadonlySet<string> = new Set([
  "type",
  "t",
  "request_id",
  "gen_ai",
  "festivus",
  "duration_ms",
])

function assertNoLeaks(event: object): void {
  for (const key of Object.keys(event)) {
    expect(ALLOWED_TOP_LEVEL_KEYS.has(key)).toBe(true)
  }
}

describe("trace event constructors", () => {
  it("TRACE_EVENT_TYPES contains all seven taxonomy members in order", () => {
    expect(TRACE_EVENT_TYPES).toEqual([
      "request_start",
      "router_classified",
      "api_tool_called",
      "canvas_tool_called",
      "specialist_activated",
      "assistant_message_chunk",
      "request_end",
    ])
  })

  it("CONSTRUCTOR_REGISTRY has one entry per trace event type", () => {
    const keys = Object.keys(CONSTRUCTOR_REGISTRY).sort()
    const expected = [...TRACE_EVENT_TYPES].sort()
    expect(keys).toEqual(expected)
  })

  it("createRequestStart emits OTEL gen_ai fields and festivus.question.text", () => {
    const e = createRequestStart({
      t: T,
      request_id: REQUEST_ID,
      system: "anthropic",
      model: "claude-sonnet-4-6",
      question: "what robots can fold laundry?",
    })
    expect(e.type).toBe("request_start")
    expect(e.t).toBe(T)
    expect(e.request_id).toBe(REQUEST_ID)
    expect(e.gen_ai.system).toBe("anthropic")
    expect(e.gen_ai.request.model).toBe("claude-sonnet-4-6")
    expect(e.festivus.question.text).toBe("what robots can fold laundry?")
    assertNoLeaks(e)
  })

  it("createRouterClassified emits festivus.router.shape and confidence", () => {
    const e = createRouterClassified({
      t: T,
      request_id: REQUEST_ID,
      shape: "T->R",
      confidence: 0.97,
    })
    expect(e.type).toBe("router_classified")
    expect(e.festivus.router.shape).toBe("T->R")
    expect(e.festivus.router.confidence).toBe(0.97)
    assertNoLeaks(e)
  })

  it("createApiToolCalled emits OTEL tool name, arguments, result_preview, and duration_ms", () => {
    const e = createApiToolCalled({
      t: T,
      request_id: REQUEST_ID,
      name: "search_robots",
      arguments: { task: "task-laundry-folding" },
      result_preview: "2 results: aloha-2, abb-yumi",
      duration_ms: 340,
    })
    expect(e.type).toBe("api_tool_called")
    expect(e.gen_ai.tool.name).toBe("search_robots")
    expect(e.gen_ai.tool.call.arguments).toEqual({ task: "task-laundry-folding" })
    expect(e.gen_ai.tool.call.result_preview).toBe("2 results: aloha-2, abb-yumi")
    expect(e.duration_ms).toBe(340)
    assertNoLeaks(e)
  })

  it("createCanvasToolCalled emits OTEL tool name and arguments only", () => {
    const e = createCanvasToolCalled({
      t: T,
      request_id: REQUEST_ID,
      name: "add_node",
      arguments: { node_type: "robot" },
    })
    expect(e.type).toBe("canvas_tool_called")
    expect(e.gen_ai.tool.name).toBe("add_node")
    expect(e.gen_ai.tool.call.arguments).toEqual({ node_type: "robot" })
    expect("result_preview" in e.gen_ai.tool.call).toBe(false)
    assertNoLeaks(e)
  })

  it("createSpecialistActivated emits festivus.specialist.name", () => {
    const e = createSpecialistActivated({
      t: T,
      request_id: REQUEST_ID,
      specialist: "hardware",
    })
    expect(e.type).toBe("specialist_activated")
    expect(e.festivus.specialist.name).toBe("hardware")
    assertNoLeaks(e)
  })

  it("createAssistantMessageChunk emits chunk index, bytes, and text", () => {
    const e = createAssistantMessageChunk({
      t: T,
      request_id: REQUEST_ID,
      index: 3,
      bytes: 128,
      text: "hello",
    })
    expect(e.type).toBe("assistant_message_chunk")
    expect(e.festivus.chunk.index).toBe(3)
    expect(e.festivus.chunk.bytes).toBe(128)
    expect(e.festivus.chunk.text).toBe("hello")
    assertNoLeaks(e)
  })

  it("createRequestEnd emits duration_ms and OTEL usage tokens", () => {
    const e = createRequestEnd({
      t: T,
      request_id: REQUEST_ID,
      duration_ms: 1850,
      input_tokens: 4200,
      output_tokens: 310,
    })
    expect(e.type).toBe("request_end")
    expect(e.duration_ms).toBe(1850)
    expect(e.gen_ai.usage.input_tokens).toBe(4200)
    expect(e.gen_ai.usage.output_tokens).toBe(310)
    assertNoLeaks(e)
  })
})
