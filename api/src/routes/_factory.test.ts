import { describe, expect, it } from "vitest"
import { parseListFilters } from "./_factory.js"

describe("parseListFilters", () => {
  it("defaults limit to 50 and offset to 0 when missing", () => {
    expect(parseListFilters({})).toEqual({ limit: 50, offset: 0 })
  })

  it("clamps limit to MAX_LIMIT (500)", () => {
    expect(parseListFilters({ limit: "9999" })).toEqual({ limit: 500, offset: 0 })
  })

  it("floors negative offset to 0", () => {
    expect(parseListFilters({ offset: "-1" })).toEqual({ limit: 50, offset: 0 })
  })

  it("rejects zero and negative limit, falls back to default", () => {
    expect(parseListFilters({ limit: "0" })).toEqual({ limit: 50, offset: 0 })
    expect(parseListFilters({ limit: "-5" })).toEqual({ limit: 50, offset: 0 })
  })

  it("ignores NaN limit/offset", () => {
    expect(parseListFilters({ limit: "abc", offset: "xyz" })).toEqual({ limit: 50, offset: 0 })
  })

  it("passes q through when non-empty", () => {
    expect(parseListFilters({ q: "franka" })).toEqual({ limit: 50, offset: 0, q: "franka" })
  })

  it("drops empty q", () => {
    expect(parseListFilters({ q: "" })).toEqual({ limit: 50, offset: 0 })
  })

  it("honors valid limit + offset + q together", () => {
    expect(parseListFilters({ limit: "10", offset: "20", q: "ur5e" })).toEqual({
      limit: 10,
      offset: 20,
      q: "ur5e",
    })
  })
})
