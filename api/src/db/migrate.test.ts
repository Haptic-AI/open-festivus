// Migrator idempotence. Gated by POSTGRES_URL so pnpm test stays docker-free.

import { afterAll, describe, expect, it } from "vitest"
import { closePool, getPool } from "./pool.js"
import { migrate } from "./migrate.js"
import { DOMAINS } from "./seed.js"

const run = process.env["POSTGRES_URL"] ? describe : describe.skip

run("migrate() is idempotent", () => {
  afterAll(async () => {
    await closePool()
  })

  it("runs twice in a row with no error and same table set", async () => {
    await migrate()
    await migrate()
    const pool = getPool()
    for (const cfg of Object.values(DOMAINS)) {
      const res = await pool.query<{ exists: boolean }>(
        "SELECT to_regclass($1) IS NOT NULL AS exists",
        [cfg.table],
      )
      expect(res.rows[0]?.exists).toBe(true)
    }
  })
})
