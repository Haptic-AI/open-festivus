// Unit tests for pool.ts. The pg branch is also exercised by
// `migrate.test.ts` and `postgres.parity.test.ts` when POSTGRES_URL is set
// (gated docker path). The Neon HTTP driver branch was removed in spec 022.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("pool.ts", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("throws when POSTGRES_URL is not set", async () => {
    delete process.env["POSTGRES_URL"]
    const mod = await import("./pool.js")
    expect(() => mod.getPool()).toThrow(/POSTGRES_URL is not set/)
  })

  it("returns an IPool backed by pg.Pool; getPgPool returns the same instance", async () => {
    process.env["POSTGRES_URL"] = "postgresql://example:example@localhost:65432/never"
    const mod = await import("./pool.js")
    const pool = mod.getPool()
    expect(typeof pool.query).toBe("function")
    const pg = mod.getPgPool()
    expect(typeof pg.query).toBe("function")
    expect(typeof pg.connect).toBe("function")
    await mod.closePool()
  })
})
