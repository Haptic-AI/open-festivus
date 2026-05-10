import type { IRobot } from "@festivus/types"
import request from "supertest"
import { describe, expect, it } from "vitest"
import type { IQueryable } from "../middleware/api-key.js"
import { FixtureRepo } from "../repo/fixture.js"
import { createServer } from "../server.js"

// Issue #64 regression. An agent patching a paraphrased/hallucinated column
// name (e.g. `degrees_of_freedom` instead of `dof`) must get a loud 422 so
// it can self-correct, not a silent 200 no-op that makes it think the edit
// landed.

function stubDb(): IQueryable {
  return {
    async query<T = unknown>(sql: string): Promise<{ rows: T[] }> {
      if (sql.includes("FROM api_keys WHERE key_hash")) {
        return {
          rows: [
            {
              id: 42,
              user_id: "test-user",
              revoked_at: null,
              tier: "write",
              owner_email: "submitter@example.com",
              owner_id: "user_cuid_test",
            },
          ] as unknown as T[],
        }
      }
      return { rows: [] }
    },
  }
}

function fixture(): FixtureRepo {
  return new FixtureRepo({
    robots: [
      { slug: "agility-digit", name: "Digit", dof: 21 },
    ] as unknown as IRobot[],
  })
}

describe("PATCH /v1/write/:table/:slug rejects unknown columns (issue #64)", () => {
  it("returns 422 field_not_agent_editable with valid_fields when the patch names a column outside the allowlist", async () => {
    const app = createServer(fixture(), { db: stubDb() })
    const res = await request(app)
      .patch("/v1/write/robots/agility-digit")
      .set("x-api-key", "fek_test")
      .send({ patch: { degrees_of_freedom: 16 } })

    expect(res.status).toBe(422)
    expect(res.body.error).toBe("field_not_agent_editable")
    expect(res.body.table).toBe("robots")
    expect(res.body.field_rejections[0]).toMatchObject({
      code: "field_not_agent_editable",
      field: "degrees_of_freedom",
      table: "robots",
    })
    expect(Array.isArray(res.body.valid_fields)).toBe(true)
    expect(res.body.valid_fields).toEqual(expect.arrayContaining(["dof", "weight_kg"]))
    // Sanity: the rejected key should NOT be in the allowlist.
    expect(res.body.valid_fields).not.toContain("degrees_of_freedom")
  })

  it("returns 422 even when a valid field is mixed in with an unknown one", async () => {
    const app = createServer(fixture(), { db: stubDb() })
    const res = await request(app)
      .patch("/v1/write/robots/agility-digit")
      .set("x-api-key", "fek_test")
      .send({ patch: { weight_kg: 89, made_up_column: "x" } })

    expect(res.status).toBe(422)
    expect(res.body.error).toBe("field_not_agent_editable")
    expect(res.body.field_rejections[0]?.field).toBe("made_up_column")
    expect(res.body.valid_fields).toEqual(expect.arrayContaining(["dof", "weight_kg"]))
  })

  it("still returns 200 no_op for a valid field patched to its current value", async () => {
    const repo = new FixtureRepo({
      robots: [
        { slug: "agility-digit", name: "Digit", dof: 21, weight_kg: 45 },
      ] as unknown as IRobot[],
    })
    const app = createServer(repo, { db: stubDb() })
    const res = await request(app)
      .patch("/v1/write/robots/agility-digit")
      .set("x-api-key", "fek_test")
      .send({ patch: { weight_kg: 45 } })
    expect(res.status).toBe(200)
    expect(res.body.no_op).toBe(true)
  })
})
