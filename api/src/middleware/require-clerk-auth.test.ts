import express from "express"
import request from "supertest"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { requireClerkAuth, type IUserUpserter } from "./require-clerk-auth.js"

/**
 * Spec 029 Step 1.3. Middleware must:
 *   (a) first-sight Clerk user creates a `users` row (upsert)
 *   (b) repeat call does NOT create a duplicate (upsert idempotent)
 *   (c) X-Dev-User-Id path upserts a dev-user row
 *   (d) req.user.id is present after the middleware runs
 *
 * These tests run with CLERK_SECRET_KEY absent (the dev-mode escape hatch),
 * so they exercise the X-Dev-User-Id branch. The upsert is the same code
 * path for the Clerk-verified branch — exercised via integration tests.
 */

function makeStubPrisma(existingRowsByClerkId: Record<string, { id: string; email: string | null }> = {}): {
  prisma: IUserUpserter
  upsertCalls: Array<{ clerkId: string; email: string | null | undefined }>
} {
  const upsertCalls: Array<{ clerkId: string; email: string | null | undefined }> = []
  const prisma: IUserUpserter = {
    users: {
      upsert: vi.fn(async (args) => {
        upsertCalls.push({ clerkId: args.where.clerk_user_id, email: args.create.email })
        const existing = existingRowsByClerkId[args.where.clerk_user_id]
        if (existing) {
          return {
            id: existing.id,
            clerk_user_id: args.where.clerk_user_id,
            email: args.update.email ?? existing.email,
          }
        }
        return {
          id: `user_${args.where.clerk_user_id}`,
          clerk_user_id: args.where.clerk_user_id,
          email: args.create.email ?? null,
        }
      }),
    },
  }
  return { prisma, upsertCalls }
}

function buildApp(prisma: IUserUpserter) {
  const app = express()
  app.get("/whoami", requireClerkAuth({ prisma }), (req, res) => {
    res.json({ clerkUserId: req.clerkUserId ?? null, user: req.user ?? null })
  })
  return app
}

describe("requireClerkAuth middleware (spec 029)", () => {
  beforeEach(() => {
    delete process.env["CLERK_SECRET_KEY"]
    delete process.env["NODE_ENV"]
  })

  it("401s when neither Clerk secret nor X-Dev-User-Id is present", async () => {
    const { prisma, upsertCalls } = makeStubPrisma()
    const res = await request(buildApp(prisma)).get("/whoami")
    expect(res.status).toBe(401)
    expect(upsertCalls).toHaveLength(0)
  })

  it("first-sight X-Dev-User-Id creates a users row and attaches req.user", async () => {
    const { prisma, upsertCalls } = makeStubPrisma()
    const res = await request(buildApp(prisma))
      .get("/whoami")
      .set("X-Dev-User-Id", "alice")
    expect(res.status).toBe(200)
    expect(res.body.clerkUserId).toBe("alice")
    expect(res.body.user).toEqual({
      id: "user_alice",
      clerk_user_id: "alice",
      email: null,
    })
    expect(upsertCalls).toEqual([{ clerkId: "alice", email: null }])
  })

  it("repeat X-Dev-User-Id calls hit upsert but do not create duplicates (idempotent)", async () => {
    const { prisma, upsertCalls } = makeStubPrisma({
      alice: { id: "user_alice", email: null },
    })
    await request(buildApp(prisma)).get("/whoami").set("X-Dev-User-Id", "alice")
    await request(buildApp(prisma)).get("/whoami").set("X-Dev-User-Id", "alice")
    expect(upsertCalls).toHaveLength(2)
    // Same where clause both times — Postgres upsert on unique clerk_user_id
    // is idempotent, so two calls produce one row.
    expect(upsertCalls.every((c) => c.clerkId === "alice")).toBe(true)
  })

  it("blocks X-Dev-User-Id escape hatch when NODE_ENV=production", async () => {
    const { prisma, upsertCalls } = makeStubPrisma()
    process.env["NODE_ENV"] = "production"
    const res = await request(buildApp(prisma))
      .get("/whoami")
      .set("X-Dev-User-Id", "alice")
    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({ error: "CLERK_SECRET_KEY not configured" })
    expect(upsertCalls).toHaveLength(0)
  })
})
