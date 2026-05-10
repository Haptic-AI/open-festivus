import { PrismaClient } from "@prisma/client"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { backfillAttribution } from "./backfill-attribution.js"

const POSTGRES_URL = process.env["POSTGRES_URL"]
const run = POSTGRES_URL ? describe : describe.skip

/**
 * Spec 029 Step 1.5. Backfill is tested end-to-end against the local
 * Supabase dev DB because the logic is largely SQL and $executeRaw is
 * painful to mock. Gated on POSTGRES_URL so `pnpm test` stays docker-free.
 *
 * Test fixtures use the Clerk-id prefix `bfill_` so cleanup is precise and
 * repeated runs do not pollute each other or the real dev dataset.
 *
 * Note: uses `describe` vs `describe.skip` chosen up-front rather than
 * `describe.skipIf` — the latter still executes the factory, which would
 * crash on PrismaClient construction when no URL is set (CI). Same pattern
 * as users.test.ts and prisma.parity.test.ts.
 */
run("backfillAttribution (integration, real pg)", () => {
  let prisma: PrismaClient

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: POSTGRES_URL } } })
    // Clean up any prior run.
    await prisma.mutations.deleteMany({ where: { table_name: "robots", slug: "bfill_fixture_slug" } })
    await prisma.api_keys.deleteMany({ where: { user_id: { startsWith: "bfill_" } } })
    await prisma.users.deleteMany({ where: { clerk_user_id: { startsWith: "bfill_" } } })
  })

  afterAll(async () => {
    await prisma.mutations.deleteMany({ where: { table_name: "robots", slug: "bfill_fixture_slug" } })
    await prisma.api_keys.deleteMany({ where: { user_id: { startsWith: "bfill_" } } })
    await prisma.users.deleteMany({ where: { clerk_user_id: { startsWith: "bfill_" } } })
    await prisma.$disconnect()
  })

  it("upserts a users row per distinct Clerk id and stamps api_keys.owner_id", async () => {
    // Seed: two api_keys for the same Clerk user, one key for a different user.
    await prisma.api_keys.createMany({
      data: [
        { user_id: "bfill_user_alpha", key_hash: "bfill_hash_1", name: "alpha-key-1" },
        { user_id: "bfill_user_alpha", key_hash: "bfill_hash_2", name: "alpha-key-2" },
        { user_id: "bfill_user_beta", key_hash: "bfill_hash_3", name: "beta-key-1" },
      ],
    })

    const summary = await backfillAttribution(prisma)
    expect(summary.clerk_ids_seen).toBeGreaterThanOrEqual(2)
    expect(summary.users_upserted).toBeGreaterThanOrEqual(2)
    expect(summary.api_keys_backfilled).toBeGreaterThanOrEqual(3)

    const alphaRows = await prisma.api_keys.findMany({ where: { user_id: "bfill_user_alpha" } })
    expect(alphaRows).toHaveLength(2)
    expect(alphaRows[0]?.owner_id).toBe(alphaRows[1]?.owner_id)
    expect(alphaRows[0]?.owner_id).not.toBeNull()

    const betaRow = await prisma.api_keys.findFirst({ where: { user_id: "bfill_user_beta" } })
    expect(betaRow?.owner_id).not.toBeNull()
    expect(betaRow?.owner_id).not.toBe(alphaRows[0]?.owner_id)

    const alphaUser = await prisma.users.findUnique({ where: { clerk_user_id: "bfill_user_alpha" } })
    expect(alphaUser).not.toBeNull()
    expect(alphaUser?.id).toBe(alphaRows[0]?.owner_id)
  })

  it("stamps mutations.author_id by joining actor_id -> api_keys.id -> owner_id", async () => {
    // Re-use the alpha api_key from the previous test. Find its numeric id.
    const key = await prisma.api_keys.findFirst({ where: { user_id: "bfill_user_alpha" } })
    if (!key) throw new Error("test fixture missing")

    await prisma.mutations.create({
      data: {
        table_name: "robots",
        slug: "bfill_fixture_slug",
        field_path: "weight_kg",
        actor_id: String(key.id),
        patch: { weight_kg: 89 },
        old_values: { weight_kg: null },
        new_values: { weight_kg: 89 },
      },
    })

    const summary = await backfillAttribution(prisma)
    expect(summary.mutations_backfilled).toBeGreaterThanOrEqual(1)

    const mut = await prisma.mutations.findFirst({ where: { slug: "bfill_fixture_slug" } })
    expect(mut?.author_id).toBe(key.owner_id)
    expect(mut?.author_id).not.toBeNull()
  })

  it("is idempotent — running twice produces zero additional updates on pass 2", async () => {
    const secondPass = await backfillAttribution(prisma)
    expect(secondPass.api_keys_backfilled).toBe(0)
    expect(secondPass.mutations_backfilled).toBe(0)
  })
})
