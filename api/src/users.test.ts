import { PrismaClient } from "@prisma/client"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

/**
 * Behavioral test for the `users` table (spec 029 Step 1.1).
 *
 * Runs against the live local Postgres (Supabase) to exercise the real
 * UNIQUE constraint on clerk_user_id — the one invariant that a vi.fn stub
 * cannot prove. Isolated by a test-run-unique prefix on clerk_user_id so it
 * cannot collide with other tests running in parallel or with seed data.
 *
 * Gated on POSTGRES_URL so `pnpm test` stays docker-free in CI. The
 * working pattern matches prisma.parity.test.ts: pick `describe` vs
 * `describe.skip` up-front (skipIf still executes the factory and would
 * crash on PrismaClient construction with no URL), and defer the
 * PrismaClient instantiation into beforeAll so the skipped path never
 * touches Prisma.
 */

const POSTGRES_URL = process.env["POSTGRES_URL"]
const run = POSTGRES_URL ? describe : describe.skip
const PREFIX = `test_users_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_`

run("users table (integration, real pg)", () => {
  let prisma: PrismaClient

  beforeAll(() => {
    prisma = new PrismaClient({ datasources: { db: { url: POSTGRES_URL } } })
  })

  async function cleanup() {
    await prisma.users.deleteMany({
      where: { clerk_user_id: { startsWith: PREFIX } },
    })
  }

  afterEach(cleanup)
  afterAll(async () => {
    await cleanup()
    await prisma.$disconnect()
  })

  it("accepts two users with distinct clerk_user_ids", async () => {
    const a = await prisma.users.create({
      data: { clerk_user_id: `${PREFIX}alice`, email: "alice@example.com" },
    })
    const b = await prisma.users.create({
      data: { clerk_user_id: `${PREFIX}bob`, email: "bob@example.com" },
    })

    expect(a.id).not.toBe(b.id)
    expect(a.clerk_user_id).toBe(`${PREFIX}alice`)
    expect(b.clerk_user_id).toBe(`${PREFIX}bob`)
  })

  it("rejects a duplicate clerk_user_id via UNIQUE constraint", async () => {
    await prisma.users.create({
      data: { clerk_user_id: `${PREFIX}duplicate`, email: "first@example.com" },
    })

    await expect(
      prisma.users.create({
        data: { clerk_user_id: `${PREFIX}duplicate`, email: "second@example.com" },
      }),
    ).rejects.toThrow(/unique constraint|P2002/i)
  })

  it("findUnique by clerk_user_id returns exactly one row", async () => {
    await prisma.users.create({
      data: { clerk_user_id: `${PREFIX}lookup`, email: "lookup@example.com" },
    })

    const found = await prisma.users.findUnique({
      where: { clerk_user_id: `${PREFIX}lookup` },
    })

    expect(found).not.toBeNull()
    expect(found?.email).toBe("lookup@example.com")
    expect(found?.created_at).toBeInstanceOf(Date)
  })

  it("email is optional (nullable)", async () => {
    const u = await prisma.users.create({
      data: { clerk_user_id: `${PREFIX}noemail` },
    })
    expect(u.email).toBeNull()
  })
})
