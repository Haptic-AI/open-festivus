import request from "supertest"
import { describe, expect, it } from "vitest"
import type { IDomainTable } from "../repo/types.js"
import type { IQueryable } from "../middleware/api-key.js"
import { FixtureRepo } from "../repo/fixture.js"
import { createServer } from "../server.js"

// Spec 029 Step 2.3. Paired defense-in-depth coverage across every
// table: a name / hf_* / array field on each table must be rejected
// with 422 and field_not_agent_editable. A positive-control row
// confirms a legit scalar PATCH still returns 202.

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

interface ITableCase {
  table: IDomainTable
  slug: string
  /** Any one field name the allowlist forbids. */
  forbiddenName: string
  /** Any one array field on the table (if any). */
  forbiddenArray?: { field: string; value: unknown }
  /** Any one hf_* identifier field (if any). */
  forbiddenHf?: string
  /** A ✅ field + value for the positive control. */
  allowedField: { name: string; value: unknown }
}

// Seed rows — one per table — so the PATCH handler passes its
// existence check (404 short-circuit) and reaches the Zod gate.
const cases: ITableCase[] = [
  {
    table: "robots",
    slug: "atlas",
    forbiddenName: "name",
    forbiddenArray: { field: "sensors", value: ["lidar"] },
    allowedField: { name: "weight_kg", value: 89 },
  },
  {
    table: "policies",
    slug: "act-v2",
    forbiddenName: "name",
    forbiddenArray: { field: "compatible_robot_slugs", value: ["atlas"] },
    forbiddenHf: "hf_repo_id",
    allowedField: { name: "license", value: "MIT" },
  },
  {
    table: "datasets",
    slug: "example-ds",
    forbiddenName: "name",
    forbiddenArray: { field: "robot_names", value: ["atlas"] },
    forbiddenHf: "hf_dataset_id",
    allowedField: { name: "episodes", value: 500 },
  },
  {
    table: "benchmarks",
    slug: "bench-x",
    forbiddenName: "name",
    forbiddenArray: { field: "linked_policy_slugs", value: ["p1"] },
    allowedField: { name: "difficulty", value: "medium" },
  },
  {
    table: "deploy_notes",
    slug: "note-1",
    forbiddenName: "name",
    allowedField: { name: "severity", value: "warning" },
  },
  {
    table: "environments",
    slug: "kitchen",
    forbiddenName: "name",
    forbiddenArray: { field: "compatible_robot_slugs", value: ["atlas"] },
    allowedField: { name: "simulator", value: "MuJoCo" },
  },
  {
    table: "tasks",
    slug: "pick-place",
    forbiddenName: "name",
    forbiddenArray: { field: "sub_tasks", value: ["pick"] },
    allowedField: { name: "difficulty", value: "hard" },
  },
  {
    table: "papers",
    slug: "paper-1",
    forbiddenName: "title",
    forbiddenArray: { field: "authors", value: ["Alice"] },
    allowedField: { name: "citations", value: 42 },
  },
  {
    table: "hardware",
    slug: "intel-cpu",
    forbiddenName: "name",
    allowedField: { name: "manufacturer", value: "Intel" },
  },
  {
    table: "compatibility_edges",
    slug: "atlas--act-v2",
    forbiddenName: "robot_slug",
    forbiddenArray: { field: "gaps", value: ["x"] },
    allowedField: { name: "success_rate", value: 0.5 },
  },
  {
    table: "laundry_compat_edges",
    slug: "atlas--laundry-v1",
    forbiddenName: "policy_name",
    allowedField: { name: "notes", value: "works" },
  },
]

function buildSeedForCases(): ConstructorParameters<typeof FixtureRepo>[0] {
  const seed: Record<string, { slug: string }[]> = {}
  for (const c of cases) {
    const arr = seed[c.table] ?? []
    arr.push({ slug: c.slug })
    seed[c.table] = arr
  }
  return seed as never
}

describe("spec 029 Step 2.3: field lockdown across all 11 tables", () => {
  const repo = new FixtureRepo(buildSeedForCases())
  const app = createServer(repo, { db: stubDb() })

  for (const c of cases) {
    describe(c.table, () => {
      it(`rejects ${c.forbiddenName} (name-like identifier)`, async () => {
        const res = await request(app)
          .patch(`/v1/write/${c.table}/${c.slug}`)
          .set("x-api-key", "fek_test")
          .send({ patch: { [c.forbiddenName]: "evil" } })
        expect(res.status).toBe(422)
        expect(res.body.error).toBe("field_not_agent_editable")
        expect(res.body.field_rejections[0]).toEqual({
          code: "field_not_agent_editable",
          field: c.forbiddenName,
          table: c.table,
        })
      })

      if (c.forbiddenArray) {
        it(`rejects ${c.forbiddenArray.field} (array)`, async () => {
          const res = await request(app)
            .patch(`/v1/write/${c.table}/${c.slug}`)
            .set("x-api-key", "fek_test")
            .send({ patch: { [c.forbiddenArray!.field]: c.forbiddenArray!.value } })
          expect(res.status).toBe(422)
          expect(res.body.error).toBe("field_not_agent_editable")
          expect(res.body.field_rejections[0]?.field).toBe(c.forbiddenArray!.field)
        })
      }

      if (c.forbiddenHf) {
        it(`rejects ${c.forbiddenHf} (hf_* identifier)`, async () => {
          const res = await request(app)
            .patch(`/v1/write/${c.table}/${c.slug}`)
            .set("x-api-key", "fek_test")
            .send({ patch: { [c.forbiddenHf!]: "org/repo" } })
          expect(res.status).toBe(422)
          expect(res.body.error).toBe("field_not_agent_editable")
          expect(res.body.field_rejections[0]?.field).toBe(c.forbiddenHf)
        })
      }
    })
  }

  // Positive control: one allowed scalar PATCH still returns 202.
  it("positive control: robots.weight_kg PATCH returns 202", async () => {
    const res = await request(app)
      .patch("/v1/write/robots/atlas")
      .set("x-api-key", "fek_test")
      .send({ patch: { weight_kg: 89 } })
    expect(res.status).toBe(202)
    expect(res.body.status).toBe("pending_review")
  })
})
