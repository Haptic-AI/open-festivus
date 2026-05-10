import { describe, expect, it } from "vitest"
import { normalizeRecords } from "./seed.js"

describe("normalizeRecords", () => {
  it("passes through a record with a valid slug", () => {
    const out = normalizeRecords([{ slug: "franka-panda", name: "Franka Panda" }], "robots")
    expect(out).toHaveLength(1)
    expect(out[0]?.slug).toBe("franka-panda")
  })

  it("throws on a record missing slug", () => {
    expect(() =>
      normalizeRecords([{ slug: "ok" }, { name: "no-slug" }], "robots"),
    ).toThrow(/record 1 missing required non-empty string slug/)
  })

  it("throws on a record with an empty-string slug", () => {
    expect(() =>
      normalizeRecords([{ slug: "  " }], "policies"),
    ).toThrow(/missing required non-empty string slug/)
  })
})
