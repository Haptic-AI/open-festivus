import type { IMutation } from "@festivus/types"
import { describe, expect, it } from "vitest"
import { computeConflictKeys } from "./moderate-conflicts"

function m(overrides: Partial<IMutation>): IMutation {
  return {
    id: 1,
    created_at: "2026-04-21T00:00:00Z",
    table_name: "robots",
    slug: "atlas",
    field_path: "weight_kg",
    actor_id: "user_1",
    actor_email: null,
    author_id: null,
    reason: null,
    patch: {},
    old_values: {},
    new_values: {},
    status: "pending_review",
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
    ...overrides,
  }
}

describe("computeConflictKeys", () => {
  it("returns empty when no field overlaps", () => {
    const result = computeConflictKeys([
      m({ id: 1, field_path: "weight_kg" }),
      m({ id: 2, slug: "spot", field_path: "weight_kg" }),
      m({ id: 3, field_path: "price_usd" }),
    ])
    expect(result.size).toBe(0)
  })

  it("flags the same field on the same row touched by two mutations", () => {
    const result = computeConflictKeys([
      m({ id: 1, field_path: "weight_kg" }),
      m({ id: 2, field_path: "weight_kg" }),
    ])
    expect([...result]).toEqual(["robots:atlas:weight_kg"])
  })

  it("treats different rows as non-conflicting", () => {
    const result = computeConflictKeys([
      m({ id: 1, slug: "atlas", field_path: "weight_kg" }),
      m({ id: 2, slug: "spot", field_path: "weight_kg" }),
    ])
    expect(result.size).toBe(0)
  })

  it("handles multi-field mutations — only overlapping fields are flagged", () => {
    const result = computeConflictKeys([
      m({ id: 1, field_path: "weight_kg,price_usd" }),
      m({ id: 2, field_path: "price_usd,description" }),
    ])
    expect([...result]).toEqual(["robots:atlas:price_usd"])
  })

  it("flags a triple-way conflict", () => {
    const result = computeConflictKeys([
      m({ id: 1, field_path: "weight_kg" }),
      m({ id: 2, field_path: "weight_kg" }),
      m({ id: 3, field_path: "weight_kg" }),
    ])
    expect([...result]).toEqual(["robots:atlas:weight_kg"])
  })

  it("different tables do not collide even for same slug+field", () => {
    const result = computeConflictKeys([
      m({ id: 1, table_name: "robots", slug: "atlas", field_path: "name" }),
      m({ id: 2, table_name: "policies", slug: "atlas", field_path: "name" }),
    ])
    expect(result.size).toBe(0)
  })
})
