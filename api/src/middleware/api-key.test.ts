import express from "express"
import request from "supertest"
import { describe, expect, it } from "vitest"
import { apiKeyMiddleware, hashApiKey, type IApiKeyRow, type IQueryable } from "./api-key.js"
import { rateLimitMiddleware } from "./rate-limit.js"
import { TokenBucket } from "./token-bucket.js"

function makeDb(rows: IApiKeyRow[], updateCalls?: unknown[][]): IQueryable {
  return {
    async query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
      if (sql.startsWith("SELECT")) {
        const hash = (params ?? [])[0] as string
        const match = rows.find(
          (r) => hashApiKey("plain-" + String(r.id)) === hash || `hash-${r.id}` === hash,
        )
        return { rows: match ? ([match] as unknown as T[]) : [] }
      }
      if (sql.startsWith("UPDATE")) {
        updateCalls?.push(params ?? [])
        return { rows: [] as T[] }
      }
      return { rows: [] as T[] }
    },
  }
}

function buildApp(db: IQueryable): express.Express {
  const app = express()
  app.set("trust proxy", true)
  const bucket = new TokenBucket()
  app.use(rateLimitMiddleware({ bucket }))
  app.use(apiKeyMiddleware({ db, onAsyncError: () => {} }))
  app.get("/ping", (req, res) => {
    res.json({ tier: req.tier, apiKeyId: req.apiKeyId ?? null })
  })
  return app
}

describe("api-key middleware", () => {
  it("passes through anon when X-API-Key header is absent", async () => {
    const db = makeDb([])
    const app = buildApp(db)
    const res = await request(app).get("/ping").set("X-Forwarded-For", "1.1.1.1")
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ tier: "anon", apiKeyId: null })
  })

  it("accepts a valid key and sets tier=keyed plus apiKeyId", async () => {
    const db = makeDb([{ id: 42, user_id: "user_a", revoked_at: null, tier: "free", owner_email: null, owner_id: null }])
    const app = buildApp(db)
    const plaintext = "plain-42"
    const res = await request(app)
      .get("/ping")
      .set("X-Forwarded-For", "2.2.2.2")
      .set("X-API-Key", plaintext)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ tier: "keyed", apiKeyId: 42 })
  })

  it("rejects a revoked key with 401 invalid_key", async () => {
    const db = makeDb([{ id: 7, user_id: "user_b", revoked_at: "2026-01-01T00:00:00Z", tier: "free", owner_email: null, owner_id: null }])
    const app = buildApp(db)
    const res = await request(app)
      .get("/ping")
      .set("X-Forwarded-For", "3.3.3.3")
      .set("X-API-Key", "plain-7")
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: "invalid_key" })
  })

  it("rejects an unknown key with 401 invalid_key", async () => {
    const db = makeDb([])
    const app = buildApp(db)
    const res = await request(app)
      .get("/ping")
      .set("X-Forwarded-For", "4.4.4.4")
      .set("X-API-Key", "plain-does-not-exist")
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: "invalid_key" })
  })

  it("fires async last_used_at update without blocking the response", async () => {
    const updateCalls: unknown[][] = []
    const db = makeDb([{ id: 99, user_id: "user_c", revoked_at: null, tier: "free", owner_email: null, owner_id: null }], updateCalls)
    const app = buildApp(db)
    const res = await request(app)
      .get("/ping")
      .set("X-Forwarded-For", "6.6.6.6")
      .set("X-API-Key", "plain-99")
    expect(res.status).toBe(200)
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(updateCalls.length).toBe(1)
    expect(updateCalls[0]).toEqual([99])
  })
})

// Spec 029 Step 3.3. The moderator forwarder can act on-behalf-of an end
// user. The middleware swaps req.apiKeyOwnerId and req.user to the target
// user's canonical users.id when X-On-Behalf-Of-User-Id is present.
function makeDbWithUsers(
  apiRows: IApiKeyRow[],
  usersRows: { id: string; clerk_user_id: string; email: string | null }[],
): IQueryable {
  return {
    async query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
      if (sql.includes("FROM api_keys WHERE key_hash")) {
        const hash = (params ?? [])[0] as string
        const match = apiRows.find((r) => hashApiKey("plain-" + String(r.id)) === hash)
        return { rows: match ? ([match] as unknown as T[]) : [] }
      }
      if (sql.includes("FROM users WHERE clerk_user_id")) {
        const clerkId = (params ?? [])[0] as string
        const match = usersRows.find((u) => u.clerk_user_id === clerkId)
        return { rows: match ? ([match] as unknown as T[]) : [] }
      }
      return { rows: [] as T[] }
    },
  }
}

function buildOnBehalfApp(db: IQueryable): express.Express {
  const app = express()
  app.use(apiKeyMiddleware({ db, onAsyncError: () => {} }))
  app.get("/whoami", (req, res) => {
    res.json({
      apiKeyOwnerId: req.apiKeyOwnerId ?? null,
      user: req.user ?? null,
    })
  })
  return app
}

describe("api-key middleware: on-behalf-of (spec 029)", () => {
  const modRow: IApiKeyRow = {
    id: 99,
    user_id: "festivus-moderator-web",
    revoked_at: null,
    tier: "write",
    owner_email: null,
    owner_id: "mod_cuid",
  }

  it("swaps apiKeyOwnerId + user when moderator calls with X-On-Behalf-Of-User-Id", async () => {
    const db = makeDbWithUsers(
      [modRow],
      [{ id: "user_cuid_alice", clerk_user_id: "clerk_alice", email: "alice@example.com" }],
    )
    const res = await request(buildOnBehalfApp(db))
      .get("/whoami")
      .set("X-API-Key", "plain-99")
      .set("X-On-Behalf-Of-User-Id", "clerk_alice")
    expect(res.status).toBe(200)
    expect(res.body.apiKeyOwnerId).toBe("user_cuid_alice")
    expect(res.body.user).toEqual({
      id: "user_cuid_alice",
      clerk_user_id: "clerk_alice",
      email: "alice@example.com",
    })
  })

  it("401s when on-behalf-of Clerk id has no matching users row", async () => {
    const db = makeDbWithUsers([modRow], [])
    const res = await request(buildOnBehalfApp(db))
      .get("/whoami")
      .set("X-API-Key", "plain-99")
      .set("X-On-Behalf-Of-User-Id", "clerk_ghost")
    expect(res.status).toBe(401)
    expect(res.body.error).toBe("unknown_on_behalf_of_user")
  })

  it("ignores X-On-Behalf-Of-User-Id when the caller is NOT the moderator key", async () => {
    const nonModRow: IApiKeyRow = {
      id: 123,
      user_id: "clerk_some_user",
      revoked_at: null,
      tier: "write",
      owner_email: null,
      owner_id: "user_cuid_orig",
    }
    const db = makeDbWithUsers(
      [nonModRow],
      [{ id: "user_cuid_alice", clerk_user_id: "clerk_alice", email: null }],
    )
    const res = await request(buildOnBehalfApp(db))
      .get("/whoami")
      .set("X-API-Key", "plain-123")
      .set("X-On-Behalf-Of-User-Id", "clerk_alice")
    expect(res.status).toBe(200)
    // apiKeyOwnerId stays the original caller's; user is not set by this path.
    expect(res.body.apiKeyOwnerId).toBe("user_cuid_orig")
    expect(res.body.user).toBeNull()
  })
})
