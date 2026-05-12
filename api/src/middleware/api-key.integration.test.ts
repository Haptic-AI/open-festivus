import express from "express"
import pg from "pg"
import request from "supertest"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { apiKeyMiddleware, hashApiKey } from "./api-key.js"
import { rateLimitMiddleware } from "./rate-limit.js"
import { TokenBucket } from "./token-bucket.js"

const POSTGRES_URL = process.env["POSTGRES_URL"]

// Integration test — gated on POSTGRES_URL so `pnpm test` stays docker-free
// (invariant #2). Run with: POSTGRES_URL=postgresql://... pnpm --filter @festivus/api test -- api-key.integration
describe.skipIf(!POSTGRES_URL)("api-key middleware (integration, real pg)", () => {
  let pool: pg.Pool
  let insertedKeyId: number
  const plaintext = "fek_integration_test_plaintext_1234567890abcdef"
  const keyHash = hashApiKey(plaintext)

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: POSTGRES_URL })
    // Ensure schema exists.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        key_hash TEXT UNIQUE NOT NULL,
        name TEXT,
        tier TEXT NOT NULL DEFAULT 'free',
        owner_email TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_used_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ
      )
    `)
    // Columns added after initial CREATE TABLE — idempotent migrations.
    await pool.query(`ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS owner_email TEXT`)
    await pool.query(`DELETE FROM api_keys WHERE user_id = $1`, ["integration-test-user"])
    const res = await pool.query<{ id: number }>(
      `INSERT INTO api_keys (user_id, key_hash, name) VALUES ($1, $2, $3) RETURNING id`,
      ["integration-test-user", keyHash, "integration-test"],
    )
    const row = res.rows[0]
    if (!row) throw new Error("failed to insert integration test key")
    insertedKeyId = row.id
  })

  afterAll(async () => {
    if (pool) {
      await pool.query(`DELETE FROM api_keys WHERE user_id = $1`, ["integration-test-user"])
      await pool.end()
    }
  })

  it("accepts a valid key stored in pg and updates last_used_at async", async () => {
    const app = express()
    app.set("trust proxy", true)
    app.use(rateLimitMiddleware({ bucket: new TokenBucket() }))
    app.use(apiKeyMiddleware({ db: pool }))
    app.get("/ping", (req, res) => {
      res.json({ tier: req.tier, apiKeyId: req.apiKeyId ?? null })
    })

    const res = await request(app).get("/ping").set("X-API-Key", plaintext)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ tier: "keyed", apiKeyId: insertedKeyId })

    // Wait for async last_used_at update to land.
    await new Promise((resolve) => setTimeout(resolve, 150))
    const { rows } = await pool.query<{ last_used_at: Date | null }>(
      `SELECT last_used_at FROM api_keys WHERE id = $1`,
      [insertedKeyId],
    )
    expect(rows[0]?.last_used_at).not.toBeNull()
  })

  it("rejects a revoked key with 401", async () => {
    await pool.query(`UPDATE api_keys SET revoked_at = now() WHERE id = $1`, [insertedKeyId])
    const app = express()
    app.set("trust proxy", true)
    app.use(rateLimitMiddleware({ bucket: new TokenBucket() }))
    app.use(apiKeyMiddleware({ db: pool }))
    app.get("/ping", (_req, res) => res.json({ ok: true }))

    const res = await request(app).get("/ping").set("X-API-Key", plaintext)
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: "invalid_key" })

    // Un-revoke for other tests.
    await pool.query(`UPDATE api_keys SET revoked_at = NULL WHERE id = $1`, [insertedKeyId])
  })
})
