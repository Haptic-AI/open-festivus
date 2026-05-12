import type { IRobot } from "@festivus/types"
import request from "supertest"
import { describe, expect, it } from "vitest"
import type { IQueryable } from "./api-key.js"
import { FixtureRepo } from "../repo/fixture.js"
import { createServer } from "../server.js"

// Stub that authenticates any x-api-key as a write-tier key owned by userId.
function stubDb(userId: string): IQueryable {
  return {
    async query<T = unknown>(sql: string): Promise<{ rows: T[] }> {
      if (sql.includes("FROM api_keys WHERE key_hash")) {
        return {
          rows: [
            { id: 42, user_id: userId, revoked_at: null, tier: "write", owner_email: null },
          ] as unknown as T[],
        }
      }
      return { rows: [] }
    },
  }
}

describe("rate-limit-writes middleware (spec 027 phase 3)", () => {
  it("429s when the user is over the cap", async () => {
    const repo = new FixtureRepo({
      robots: [{ slug: "atlas", name: "Atlas", weight_kg: null }] as unknown as IRobot[],
    })
    // Seed 3 recent mutations from this user (actor_id = user_id in fixture mode).
    for (let i = 0; i < 3; i++) {
      await repo.createMutation({
        table_name: "robots",
        slug: "atlas",
        field_path: "weight_kg",
        actor_id: "heavy-user",
        patch: { weight_kg: i + 1 },
        old_values: { weight_kg: null },
        new_values: { weight_kg: i + 1 },
      })
    }

    const app = createServer(repo, {
      db: stubDb("heavy-user"),
      writeRouter: { rateLimit: { maxWrites: 3, windowHours: 24 } },
    })

    const res = await request(app)
      .patch("/v1/write/robots/atlas")
      .set("x-api-key", "fek_heavy")
      .send({ patch: { weight_kg: 4 } })

    expect(res.status).toBe(429)
    expect(res.body).toMatchObject({
      error: "rate_limited",
      limit: 3,
      used: 3,
      retry_after_hours: 24,
    })
  })

  it("passes through when the user is under the cap", async () => {
    const repo = new FixtureRepo({
      robots: [{ slug: "atlas", name: "Atlas", weight_kg: null }] as unknown as IRobot[],
    })
    const app = createServer(repo, {
      db: stubDb("light-user"),
      writeRouter: { rateLimit: { maxWrites: 10, windowHours: 24 } },
    })

    const res = await request(app)
      .patch("/v1/write/robots/atlas")
      .set("x-api-key", "fek_light")
      .send({ patch: { weight_kg: 89 } })

    expect(res.status).toBe(202)
  })

  it("500s with a clear error when user_id is missing (middleware misconfigured)", async () => {
    const repo = new FixtureRepo({
      robots: [{ slug: "atlas", name: "Atlas", weight_kg: null }] as unknown as IRobot[],
    })
    // Stub with user_id missing to simulate a misconfig.
    const misstub: IQueryable = {
      async query<T = unknown>(sql: string): Promise<{ rows: T[] }> {
        if (sql.includes("FROM api_keys WHERE key_hash")) {
          return {
            rows: [
              { id: 42, user_id: null, revoked_at: null, tier: "write", owner_email: null },
            ] as unknown as T[],
          }
        }
        return { rows: [] }
      },
    }
    const app = createServer(repo, { db: misstub })
    const res = await request(app)
      .patch("/v1/write/robots/atlas")
      .set("x-api-key", "fek_broken")
      .send({ patch: { weight_kg: 10 } })

    expect(res.status).toBe(500)
    expect(res.body.error).toBe("rate_limit_misconfigured")
  })
})
