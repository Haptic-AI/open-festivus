/**
 * Sink resolver tests (spec 014, Step 3).
 *
 * Pins the three-branch env gate (override / dev-default / prod-noop),
 * the DEFAULT_DEV_DIR path anchor, and unique-per-call filenames. Env
 * vars are mutated in-process and restored in afterEach so test order
 * does not leak. Temp dirs via mkdtempSync + rmSync per Lesson 45.
 */

import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  DEFAULT_DEV_DIR,
  resolveSink,
} from "../../apps/web/src/lib/agent/trace/resolve"
import {
  JSONLFileSink,
  NoopTraceSink,
} from "../../apps/web/src/lib/agent/trace/sinks"

let tmpDir: string

const envBackup: { FESTIVUS_TRACE_DIR: string | undefined; NODE_ENV: string | undefined } = {
  FESTIVUS_TRACE_DIR: process.env.FESTIVUS_TRACE_DIR,
  NODE_ENV: process.env.NODE_ENV,
}

function restoreEnv(): void {
  if (envBackup.FESTIVUS_TRACE_DIR === undefined) {
    delete process.env.FESTIVUS_TRACE_DIR
  } else {
    process.env.FESTIVUS_TRACE_DIR = envBackup.FESTIVUS_TRACE_DIR
  }
  if (envBackup.NODE_ENV === undefined) {
    delete process.env.NODE_ENV
  } else {
    process.env.NODE_ENV = envBackup.NODE_ENV
  }
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "festivus-resolve-"))
})

afterEach(() => {
  restoreEnv()
  try {
    rmSync(tmpDir, { recursive: true, force: true })
  } catch {
    // swallow: cleanup failure must not fail the test (Lesson 45)
  }
})

describe("DEFAULT_DEV_DIR", () => {
  it("resolves to .festivus-traces at the repo root", () => {
    expect(basename(DEFAULT_DEV_DIR)).toBe(".festivus-traces")
    const repoRoot = dirname(DEFAULT_DEV_DIR)
    expect(existsSync(join(repoRoot, "package.json"))).toBe(true)
    expect(existsSync(join(repoRoot, "pnpm-workspace.yaml"))).toBe(true)
  })
})

describe("resolveSink", () => {
  it("FESTIVUS_TRACE_DIR override returns JSONL sink writing to that dir", async () => {
    process.env.FESTIVUS_TRACE_DIR = tmpDir
    process.env.NODE_ENV = "production"
    const sink = resolveSink("r_override")
    expect(sink).toBeInstanceOf(JSONLFileSink)
    const jsonl = sink as JSONLFileSink
    expect(jsonl.filepath.startsWith(tmpDir)).toBe(true)
    expect(jsonl.filepath.endsWith("-r_override.jsonl")).toBe(true)
    await sink.close()
  })

  it("NODE_ENV=production with no override returns NoopTraceSink", async () => {
    delete process.env.FESTIVUS_TRACE_DIR
    process.env.NODE_ENV = "production"
    const sink = resolveSink("r_prod")
    expect(sink).toBeInstanceOf(NoopTraceSink)
    await sink.close()
    expect(readdirSync(tmpDir)).toEqual([])
  })

  it("NODE_ENV=development with no override defaults to DEFAULT_DEV_DIR", async () => {
    delete process.env.FESTIVUS_TRACE_DIR
    process.env.NODE_ENV = "development"
    const sink = resolveSink("r_dev_default")
    try {
      expect(sink).toBeInstanceOf(JSONLFileSink)
      const jsonl = sink as JSONLFileSink
      expect(jsonl.filepath.startsWith(DEFAULT_DEV_DIR)).toBe(true)
      expect(jsonl.filepath.endsWith("-r_dev_default.jsonl")).toBe(true)
    } finally {
      await sink.close()
      try {
        rmSync((sink as JSONLFileSink).filepath)
      } catch {
        // swallow
      }
    }
  })

  it("empty FESTIVUS_TRACE_DIR falls through to the NODE_ENV branch", async () => {
    process.env.FESTIVUS_TRACE_DIR = ""
    process.env.NODE_ENV = "production"
    const sink = resolveSink("r_empty_override")
    expect(sink).toBeInstanceOf(NoopTraceSink)
    await sink.close()
  })

  it("two sequential calls with different request_ids produce different filenames", async () => {
    process.env.FESTIVUS_TRACE_DIR = tmpDir
    const a = resolveSink("r_seq_a") as JSONLFileSink
    const b = resolveSink("r_seq_b") as JSONLFileSink
    expect(a.filepath).not.toBe(b.filepath)
    await a.close()
    await b.close()
  })
})
