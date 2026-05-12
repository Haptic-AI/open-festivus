import type { IRobot } from "@festivus/types"
import request from "supertest"
import { beforeEach, describe, expect, it } from "vitest"
import type { IQueryable } from "../middleware/api-key.js"
import { FixtureRepo } from "../repo/fixture.js"
import { createServer } from "../server.js"

// Stub IQueryable that pretends any known key hash belongs to a write-tier row.
function stubDb(
  tier: "write" | "keyed" | "free" = "write",
  ownerEmail: string | null = "submitter@example.com",
  ownerId: string | null = "user_cuid_test",
): IQueryable {
  return {
    async query<T = unknown>(sql: string): Promise<{ rows: T[] }> {
      if (sql.includes("FROM api_keys WHERE key_hash")) {
        return {
          rows: [
            { id: 42, user_id: "test-user", revoked_at: null, tier, owner_email: ownerEmail, owner_id: ownerId },
          ] as unknown as T[],
        }
      }
      return { rows: [] }
    },
  }
}

function fixture(): FixtureRepo {
  const robots = [
    { slug: "atlas", name: "Atlas", weight_kg: null, price_usd: null },
  ] as unknown as IRobot[]
  return new FixtureRepo({ robots })
}

describe("PATCH /v1/write/:table/:slug (spec 027 pending-by-default)", () => {
  let repo: FixtureRepo

  beforeEach(() => {
    repo = fixture()
  })

  it("applies the patch live AND logs the mutation, returns 202 (spec 029 optimistic)", async () => {
    const app = createServer(repo, { db: stubDb("write") })
    const res = await request(app)
      .patch("/v1/write/robots/atlas")
      .set("x-api-key", "fek_test")
      .send({ patch: { weight_kg: 89 }, reason: "weight correction" })

    expect(res.status).toBe(202)
    expect(res.body).toMatchObject({
      status: "pending_review",
      table: "robots",
      slug: "atlas",
      changed_fields: ["weight_kg"],
    })
    expect(res.body.mutation_id).toBeGreaterThan(0)

    // The domain row IS live immediately (spec 029 optimistic apply).
    const row = await repo.getBySlug("robots", "atlas")
    expect(row?.weight_kg).toBe(89)

    // Audit trail: a mutation row is logged with pending_review status so
    // moderators can revert if needed.
    const muts = await repo.listMutations({ limit: 10, offset: 0 })
    expect(muts.count).toBe(1)
    expect(muts.results[0]?.status).toBe("pending_review")
    expect(muts.results[0]?.old_values).toMatchObject({ weight_kg: null })
    expect(muts.results[0]?.new_values).toMatchObject({ weight_kg: 89 })
  })

  it("returns 200 no-op for patches that match current values", async () => {
    repo = new FixtureRepo({
      robots: [{ slug: "atlas", name: "Atlas", weight_kg: 89 }] as unknown as IRobot[],
    })
    const app = createServer(repo, { db: stubDb("write") })
    const res = await request(app)
      .patch("/v1/write/robots/atlas")
      .set("x-api-key", "fek_test")
      .send({ patch: { weight_kg: 89 } })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ no_op: true })
    const muts = await repo.listMutations({ limit: 10, offset: 0 })
    expect(muts.count).toBe(0)
  })

  it("422s invalid field values", async () => {
    const app = createServer(repo, { db: stubDb("write") })
    const res = await request(app)
      .patch("/v1/write/robots/atlas")
      .set("x-api-key", "fek_test")
      .send({ patch: { weight_kg: "eighty-nine" } })

    expect(res.status).toBe(422)
    expect(res.body.error).toBe("validation_failed")
  })

  it("404s an unknown slug", async () => {
    const app = createServer(repo, { db: stubDb("write") })
    const res = await request(app)
      .patch("/v1/write/robots/ghost")
      .set("x-api-key", "fek_test")
      .send({ patch: { weight_kg: 10 } })

    expect(res.status).toBe(404)
  })

  it("403s a keyed-tier (non-write) key", async () => {
    const app = createServer(repo, { db: stubDb("keyed") })
    const res = await request(app)
      .patch("/v1/write/robots/atlas")
      .set("x-api-key", "fek_keyed")
      .send({ patch: { weight_kg: 89 } })

    expect(res.status).toBe(403)
    expect(res.body.error).toBe("write_tier_required")
  })

  it("400s an unknown table", async () => {
    const app = createServer(repo, { db: stubDb("write") })
    const res = await request(app)
      .patch("/v1/write/galaxies/milky-way")
      .set("x-api-key", "fek_test")
      .send({ patch: { name: "MW" } })

    expect(res.status).toBe(400)
  })

  // Spec 029 Step 1.4
  it("stamps mutation.author_id from api_keys.owner_id (CLI / x-api-key path)", async () => {
    const app = createServer(repo, { db: stubDb("write", "cli@example.com", "user_cuid_abc") })
    const res = await request(app)
      .patch("/v1/write/robots/atlas")
      .set("x-api-key", "fek_test")
      .send({ patch: { weight_kg: 89 } })
    expect(res.status).toBe(202)

    const muts = await repo.listMutations({ limit: 10, offset: 0 })
    expect(muts.results[0]?.author_id).toBe("user_cuid_abc")
  })

  it("leaves author_id null when api_keys.owner_id is null (pre-backfill rows)", async () => {
    const app = createServer(repo, { db: stubDb("write", "cli@example.com", null) })
    const res = await request(app)
      .patch("/v1/write/robots/atlas")
      .set("x-api-key", "fek_test")
      .send({ patch: { weight_kg: 89 } })
    expect(res.status).toBe(202)

    const muts = await repo.listMutations({ limit: 10, offset: 0 })
    expect(muts.results[0]?.author_id).toBeNull()
  })
})
