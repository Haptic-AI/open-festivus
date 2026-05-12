/**
 * Sink resolver (spec 014, Step 3).
 *
 * Env-gated factory that returns the trace sink a given request should
 * emit into. FESTIVUS_TRACE_DIR takes precedence; otherwise the dev-mode
 * default lives at <repo_root>/.festivus-traces. Production with no
 * override falls back to NoopTraceSink so server code pays zero I/O.
 * DEFAULT_DEV_DIR is anchored to import.meta.url per Lesson 51 so the
 * path is stable across Next dev, vitest, and the production build.
 */

import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { JSONLFileSink, NoopTraceSink } from "./sinks"
import type { ITraceSink } from "./types"

export const DEFAULT_DEV_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../..",
  ".festivus-traces",
)

export function resolveSink(request_id: string): ITraceSink {
  const override = process.env.FESTIVUS_TRACE_DIR
  if (override !== undefined && override !== "") {
    return new JSONLFileSink(override, request_id)
  }
  if (process.env.NODE_ENV === "development") {
    return new JSONLFileSink(DEFAULT_DEV_DIR, request_id)
  }
  return new NoopTraceSink()
}
