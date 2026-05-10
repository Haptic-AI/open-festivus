import { describe, expect, it } from "vitest"
import { readSseFrames } from "./use-agent-chat"

/**
 * Spec 029 Step 4.2. Only the pure SSE parser is unit-testable without
 * jsdom + RTL. Stateful UI behavior gets covered by Playwright in 4.3/4.4.
 */

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let i = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close()
        return
      }
      const current = chunks[i]
      if (typeof current === "string") controller.enqueue(encoder.encode(current))
      i += 1
    },
  })
}

describe("readSseFrames (spec 029 Step 4.2)", () => {
  it("parses a single text_delta frame", async () => {
    const events: Record<string, unknown>[] = []
    for await (const e of readSseFrames(streamOf([
      'data: {"type":"text_delta","text":"hello"}\n\n',
    ]))) {
      events.push(e)
    }
    expect(events).toEqual([{ type: "text_delta", text: "hello" }])
  })

  it("coalesces a frame split across multiple chunks", async () => {
    const events: Record<string, unknown>[] = []
    for await (const e of readSseFrames(streamOf([
      'data: {"type":"text',
      '_delta","text":"',
      'hello"}\n\n',
    ]))) {
      events.push(e)
    }
    expect(events).toEqual([{ type: "text_delta", text: "hello" }])
  })

  it("skips malformed JSON without failing the whole stream", async () => {
    const events: Record<string, unknown>[] = []
    for await (const e of readSseFrames(streamOf([
      'data: not valid json\n\ndata: {"type":"done"}\n\n',
    ]))) {
      events.push(e)
    }
    expect(events).toEqual([{ type: "done" }])
  })

  it("emits every frame in order", async () => {
    const events: Record<string, unknown>[] = []
    for await (const e of readSseFrames(streamOf([
      'data: {"type":"text_delta","text":"hi "}\n\n',
      'data: {"type":"tool_result","name":"propose_edit"}\n\n',
      'data: {"type":"done"}\n\n',
    ]))) {
      events.push(e)
    }
    expect(events.map((e) => e["type"])).toEqual(["text_delta", "tool_result", "done"])
  })
})
