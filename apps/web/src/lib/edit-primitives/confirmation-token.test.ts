import { describe, expect, it, beforeAll } from "vitest"
import { signConfirmationToken, verifyConfirmationToken } from "./confirmation-token"

beforeAll(() => {
  process.env["FESTIVUS_AGENT_CHAT_SECRET"] = "x".repeat(64)
})

describe("confirmation-token (spec 029)", () => {
  it("sign -> verify round-trip preserves every field", () => {
    const token = signConfirmationToken({
      table: "robots",
      slug: "atlas",
      field: "weight_kg",
      value: 89,
      user_id: "user_cuid_alice",
    })
    const r = verifyConfirmationToken(token)
    if (!r.ok) throw new Error("verify failed: " + r.reason)
    expect(r.payload.table).toBe("robots")
    expect(r.payload.slug).toBe("atlas")
    expect(r.payload.field).toBe("weight_kg")
    expect(r.payload.value).toBe(89)
    expect(r.payload.user_id).toBe("user_cuid_alice")
    expect(r.payload.nonce).toMatch(/^[0-9a-f]{16}$/)
  })

  it("rejects a malformed token", () => {
    const r = verifyConfirmationToken("not a valid token")
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe("malformed")
  })

  it("rejects a token with a tampered payload", () => {
    const token = signConfirmationToken({
      table: "robots",
      slug: "atlas",
      field: "weight_kg",
      value: 89,
      user_id: "user_cuid_alice",
    })
    // Mutate the payload portion only; signature stays the same.
    const [, sig] = token.split(".")
    const tampered = Buffer.from(
      JSON.stringify({ table: "robots", slug: "spot", field: "weight_kg", value: 89, user_id: "user_cuid_alice", nonce: "0000000000000000", exp: Date.now() + 60_000 }),
      "utf-8",
    ).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
    const r = verifyConfirmationToken(`${tampered}.${sig}`)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe("bad_signature")
  })

  it("rejects an expired token", () => {
    const pastNow = Date.now() - 10 * 60 * 1000
    const token = signConfirmationToken(
      {
        table: "robots",
        slug: "atlas",
        field: "weight_kg",
        value: 89,
        user_id: "user_cuid_alice",
      },
      pastNow,
    )
    const r = verifyConfirmationToken(token)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe("expired")
  })
})
