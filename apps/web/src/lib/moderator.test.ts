import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { getModeratorEmails, isModerator } from "./moderator"

describe("isModerator", () => {
  const original = process.env["MODERATOR_EMAILS"]

  beforeEach(() => {
    process.env["MODERATOR_EMAILS"] = "alice@example.com,bob@example.com,carol@example.com"
  })

  afterEach(() => {
    if (original === undefined) {
      delete process.env["MODERATOR_EMAILS"]
    } else {
      process.env["MODERATOR_EMAILS"] = original
    }
  })

  it("accepts every exact moderator email parsed from MODERATOR_EMAILS", () => {
    for (const m of getModeratorEmails()) {
      expect(isModerator(m)).toBe(true)
    }
  })

  it("strips surrounding whitespace", () => {
    expect(isModerator("  alice@example.com  ")).toBe(true)
  })

  it("rejects null, undefined, and empty string", () => {
    expect(isModerator(null)).toBe(false)
    expect(isModerator(undefined)).toBe(false)
    expect(isModerator("")).toBe(false)
  })

  it("rejects emails outside the configured list (exact match only)", () => {
    expect(isModerator("alice@example.com.evil.com")).toBe(false)
    expect(isModerator("evil+alice@example.com")).toBe(false)
    expect(isModerator("notlisted@example.com")).toBe(false)
  })

  it("returns an empty list and rejects everyone when MODERATOR_EMAILS is unset", () => {
    delete process.env["MODERATOR_EMAILS"]
    expect(getModeratorEmails()).toEqual([])
    expect(isModerator("alice@example.com")).toBe(false)
  })
})
