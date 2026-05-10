/**
 * Sink implementations for the agent trace (spec 014, Step 2).
 *
 * NoopTraceSink drops events silently. JSONLFileSink writes one JSON
 * object per line to `<dir>/<ISO>-<request_id>.jsonl` using synchronous
 * fs so `tail -f` observes writes live. api_tool_called result_preview
 * is truncated to RESULT_PREVIEW_LIMIT bytes to keep trace files small.
 * Sinks are the ONLY path out of the route per spec 014.
 */

import { closeSync, mkdirSync, openSync, writeSync } from "node:fs"
import { join } from "node:path"

import type { IAgentTraceEvent, ITraceSink } from "./types"

export const RESULT_PREVIEW_LIMIT = 1024

export class NoopTraceSink implements ITraceSink {
  emit(): void {}
  async close(): Promise<void> {}
}

export class JSONLFileSink implements ITraceSink {
  readonly filepath: string
  private fd: number | null

  constructor(dir: string, request_id: string) {
    mkdirSync(dir, { recursive: true })
    const iso = new Date().toISOString().replace(/:/g, "-")
    this.filepath = join(dir, `${iso}-${request_id}.jsonl`)
    this.fd = openSync(this.filepath, "a")
  }

  emit(event: IAgentTraceEvent): void {
    if (this.fd === null) return
    const line = `${JSON.stringify(truncateResultPreview(event))}\n`
    writeSync(this.fd, line)
  }

  async close(): Promise<void> {
    if (this.fd !== null) {
      closeSync(this.fd)
      this.fd = null
    }
  }
}

function truncateResultPreview(event: IAgentTraceEvent): IAgentTraceEvent {
  if (event.type !== "api_tool_called") return event
  const preview = event.gen_ai.tool.call.result_preview
  if (preview.length <= RESULT_PREVIEW_LIMIT) return event
  return {
    ...event,
    gen_ai: {
      ...event.gen_ai,
      tool: {
        ...event.gen_ai.tool,
        call: {
          ...event.gen_ai.tool.call,
          result_preview: preview.slice(0, RESULT_PREVIEW_LIMIT),
        },
      },
    },
  }
}
