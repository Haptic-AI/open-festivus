/**
 * Sink implementation tests (spec 014, Step 2).
 *
 * Pins the sink contract: noop is silent, JSONL writes one valid JSON
 * object per line with a fingerprint regex, directory creation is
 * recursive, result_preview is truncated at RESULT_PREVIEW_LIMIT bytes,
 * and 100 sequential emits arrive in order. Temp dirs via mkdtempSync
 * + per-test rmSync cleanup (Lesson 45).
 */

import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  createApiToolCalled,
  createAssistantMessageChunk,
  createRequestEnd,
  createRequestStart,
} from "../../apps/web/src/lib/agent/trace/events"
import {
  JSONLFileSink,
  NoopTraceSink,
  RESULT_PREVIEW_LIMIT,
} from "../../apps/web/src/lib/agent/trace/sinks"

const REQUEST_ID = "r_sink_test"
const T = 1712930000000

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "festivus-trace-"))
})

afterEach(() => {
  try {
    rmSync(tmpDir, { recursive: true, force: true })
  } catch {
    // swallow: cleanup failure must not fail the test (Lesson 45)
  }
})

describe("NoopTraceSink", () => {
  it("emit and close do not throw and create no files", async () => {
    const sink = new NoopTraceSink()
    expect(() =>
      sink.emit(
        createRequestStart({
          t: T,
          request_id: REQUEST_ID,
          system: "anthropic",
          model: "claude-sonnet-4-6",
        }),
      ),
    ).not.toThrow()
    await expect(sink.close()).resolves.toBeUndefined()
    expect(readdirSync(tmpDir)).toEqual([])
  })
})

describe("JSONLFileSink", () => {
  it("writes one valid JSON object per line for a 3-event sequence", async () => {
    const sink = new JSONLFileSink(tmpDir, REQUEST_ID)
    const events = [
      createRequestStart({
        t: T,
        request_id: REQUEST_ID,
        system: "anthropic",
        model: "claude-sonnet-4-6",
      }),
      createApiToolCalled({
        t: T + 1,
        request_id: REQUEST_ID,
        name: "search_robots",
        arguments: { task: "task-laundry-folding" },
        result_preview: "2 results",
        duration_ms: 10,
      }),
      createRequestEnd({
        t: T + 2,
        request_id: REQUEST_ID,
        duration_ms: 20,
        input_tokens: 100,
        output_tokens: 50,
      }),
    ]
    for (const e of events) sink.emit(e)
    await sink.close()

    const contents = readFileSync(sink.filepath, "utf8")
    const lines = contents.split("\n").filter(Boolean)
    expect(lines).toHaveLength(3)
    expect(lines.map((l) => JSON.parse(l))).toEqual(events)
  })

  it("file format fingerprint matches /^(\\{.*\\}\\n)+$/", async () => {
    const sink = new JSONLFileSink(tmpDir, REQUEST_ID)
    sink.emit(
      createRequestStart({
        t: T,
        request_id: REQUEST_ID,
        system: "anthropic",
        model: "claude-sonnet-4-6",
      }),
    )
    sink.emit(
      createRequestEnd({
        t: T + 1,
        request_id: REQUEST_ID,
        duration_ms: 5,
        input_tokens: 1,
        output_tokens: 1,
      }),
    )
    await sink.close()

    const contents = readFileSync(sink.filepath, "utf8")
    expect(contents).toMatch(/^(\{.*\}\n)+$/)
  })

  it("creates the target directory recursively when missing", async () => {
    const deep = join(tmpDir, "a", "b", "c")
    expect(existsSync(deep)).toBe(false)
    const sink = new JSONLFileSink(deep, REQUEST_ID)
    sink.emit(
      createRequestStart({
        t: T,
        request_id: REQUEST_ID,
        system: "anthropic",
        model: "claude-sonnet-4-6",
      }),
    )
    await sink.close()
    expect(existsSync(sink.filepath)).toBe(true)
  })

  it("truncates a 50KB api tool result_preview at RESULT_PREVIEW_LIMIT", async () => {
    const huge = "x".repeat(50 * 1024)
    const sink = new JSONLFileSink(tmpDir, REQUEST_ID)
    sink.emit(
      createApiToolCalled({
        t: T,
        request_id: REQUEST_ID,
        name: "search_robots",
        arguments: {},
        result_preview: huge,
        duration_ms: 5,
      }),
    )
    await sink.close()

    const line = readFileSync(sink.filepath, "utf8").trim()
    const parsed = JSON.parse(line)
    expect(parsed.gen_ai.tool.call.result_preview.length).toBe(RESULT_PREVIEW_LIMIT)
    expect(parsed.gen_ai.tool.call.result_preview).toBe("x".repeat(RESULT_PREVIEW_LIMIT))
  })

  it("100 sequential emits produce 100 lines in chronological order", async () => {
    const sink = new JSONLFileSink(tmpDir, REQUEST_ID)
    for (let i = 0; i < 100; i++) {
      sink.emit(
        createAssistantMessageChunk({
          t: T + i,
          request_id: REQUEST_ID,
          index: i,
          bytes: 16,
        }),
      )
    }
    await sink.close()

    const lines = readFileSync(sink.filepath, "utf8").split("\n").filter(Boolean)
    expect(lines).toHaveLength(100)
    const indices = lines.map((l) => JSON.parse(l).festivus.chunk.index)
    expect(indices).toEqual(Array.from({ length: 100 }, (_, i) => i))
  })
})
