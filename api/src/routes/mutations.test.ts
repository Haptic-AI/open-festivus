import type { IRobot } from "@festivus/types"
import request from "supertest"
import { beforeEach, describe, expect, it } from "vitest"
import type { IQueryable } from "../middleware/api-key.js"
import { FixtureRepo } from "../repo/fixture.js"
import { createServer } from "../server.js"

function stubDb(): IQueryable {
  return {
    async query<T = unknown>(sql: string): Promise<{ rows: T[] }> {
      if (sql.includes("FROM api_keys WHERE key_hash")) {
        return {
          rows: [
            { id: 42, user_id: "test-user", revoked_at: null, tier: "write", owner_email: null },
          ] as unknown as T[],
        }
      }
      return { rows: [] }
    },
  }
}

/**
 * Spec 029 optimistic flow: simulate a real PATCH — apply the patch to
 * the live row first, then log the mutation.
 */
async function seedLiveEdit(repo: FixtureRepo, patch: Record<string, unknown>) {
  await repo.patchBySlug("robots", "atlas", patch as never)
  return repo.createMutation({
    table_name: "robots",
    slug: "atlas",
    field_path: Object.keys(patch).join(","),
    actor_id: "test-user",
    patch,
    old_values: { weight_kg: null },
    new_values: patch,
  })
}

describe("POST /v1/mutations/:id/review (spec 029 optimistic flow)", () => {
  let repo: FixtureRepo

  beforeEach(() => {
    repo = new FixtureRepo({
      robots: [{ slug: "atlas", name: "Atlas", weight_kg: null }] as unknown as IRobot[],
    })
  })

  it("approve flips status only — the live row already carries the patch", async () => {
    const mutation = await seedLiveEdit(repo, { weight_kg: 89 })
    const app = createServer(repo, { db: stubDb() })

    const res = await request(app)
      .post(`/v1/mutations/${mutation.id}/review`)
      .set("x-api-key", "fek_test")
      .send({ action: "approve", note: "looks right" })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe("approved")
    expect(res.body.reviewed_by).toBeDefined()

    const row = await repo.getBySlug("robots", "atlas")
    expect(row?.weight_kg).toBe(89)
  })

  it("reject reverts the live row to old_values", async () => {
    const mutation = await seedLiveEdit(repo, { weight_kg: 89 })
    const app = createServer(repo, { db: stubDb() })

    const res = await request(app)
      .post(`/v1/mutations/${mutation.id}/review`)
      .set("x-api-key", "fek_test")
      .send({ action: "reject", note: "wrong source" })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe("rejected")

    const row = await repo.getBySlug("robots", "atlas")
    expect(row?.weight_kg).toBeNull()
  })

  it("approve twice is idempotent — no re-application, no corruption", async () => {
    const mutation = await seedLiveEdit(repo, { weight_kg: 89 })
    const app = createServer(repo, { db: stubDb() })

    await request(app)
      .post(`/v1/mutations/${mutation.id}/review`)
      .set("x-api-key", "fek_test")
      .send({ action: "approve" })

    // A follow-up out-of-band change should survive a re-approve (status only).
    await repo.patchBySlug("robots", "atlas", { weight_kg: 100 } as never)

    await request(app)
      .post(`/v1/mutations/${mutation.id}/review`)
      .set("x-api-key", "fek_test")
      .send({ action: "approve" })

    const row = await repo.getBySlug("robots", "atlas")
    expect(row?.weight_kg).toBe(100)
  })

  it("revert restores old_values (same as reject)", async () => {
    const mutation = await seedLiveEdit(repo, { weight_kg: 89 })
    const app = createServer(repo, { db: stubDb() })

    await request(app)
      .post(`/v1/mutations/${mutation.id}/review`)
      .set("x-api-key", "fek_test")
      .send({ action: "approve" })

    const res = await request(app)
      .post(`/v1/mutations/${mutation.id}/review`)
      .set("x-api-key", "fek_test")
      .send({ action: "revert", note: "revert test" })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe("reverted")

    const row = await repo.getBySlug("robots", "atlas")
    expect(row?.weight_kg).toBeNull()
  })

  it("400s invalid action", async () => {
    const mutation = await seedLiveEdit(repo, { weight_kg: 89 })
    const app = createServer(repo, { db: stubDb() })

    const res = await request(app)
      .post(`/v1/mutations/${mutation.id}/review`)
      .set("x-api-key", "fek_test")
      .send({ action: "lolwhat" })

    expect(res.status).toBe(400)
  })

  it("404s unknown id", async () => {
    const app = createServer(repo, { db: stubDb() })
    const res = await request(app)
      .post("/v1/mutations/99999/review")
      .set("x-api-key", "fek_test")
      .send({ action: "approve" })

    expect(res.status).toBe(404)
  })
})
