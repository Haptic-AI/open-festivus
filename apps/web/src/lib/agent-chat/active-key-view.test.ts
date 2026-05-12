import { describe, expect, it } from "vitest"
import {
  classifyKeyCheckResponse,
  deriveHasActiveKey,
  type IKeyCheckInput,
} from "./active-key-view"

describe("deriveHasActiveKey", () => {
  it("true when at least one key has revoked_at: null", () => {
    const input: IKeyCheckInput = {
      kind: "ok",
      keys: [
        { revoked_at: "2026-04-01T00:00:00Z" },
        { revoked_at: null },
      ],
    }
    expect(deriveHasActiveKey(input)).toBe(true)
  })

  it("false when 200 OK but the keys array is empty", () => {
    // Fresh signed-in user, never minted a key. Drawer should show the
    // Mint card so they know what to do.
    expect(deriveHasActiveKey({ kind: "ok", keys: [] })).toBe(false)
  })

  it("false when every key is revoked", () => {
    expect(
      deriveHasActiveKey({
        kind: "ok",
        keys: [
          { revoked_at: "2026-04-01T00:00:00Z" },
          { revoked_at: "2026-05-02T00:00:00Z" },
        ],
      }),
    ).toBe(false)
  })

  it("false on 401 / 403 (Mint card still surfaces, CTA redirects)", () => {
    expect(deriveHasActiveKey({ kind: "unauthorized" })).toBe(false)
  })

  it("optimistic-true on upstream errors so transient hiccups do not false-alarm", () => {
    // Pre-spec ChatDrawer assumed-true unconditionally and hid the Mint
    // card on a 401, leaving the user staring at "HTTP 401" with no clue
    // what to do. The fix is: 401/403 → false (above), 5xx → true.
    expect(deriveHasActiveKey({ kind: "upstream-error" })).toBe(true)
  })
})

describe("classifyKeyCheckResponse", () => {
  it("classifies 200 + body as ok and forwards the keys array", () => {
    const out = classifyKeyCheckResponse(200, {
      keys: [{ revoked_at: null }, { revoked_at: "x" }],
    })
    expect(out).toEqual({
      kind: "ok",
      keys: [{ revoked_at: null }, { revoked_at: "x" }],
    })
  })

  it("classifies 200 + missing keys field as ok with []", () => {
    const out = classifyKeyCheckResponse(200, {})
    expect(out).toEqual({ kind: "ok", keys: [] })
  })

  it("classifies 401 as unauthorized", () => {
    expect(classifyKeyCheckResponse(401, null)).toEqual({ kind: "unauthorized" })
  })

  it("classifies 403 as unauthorized", () => {
    expect(classifyKeyCheckResponse(403, null)).toEqual({ kind: "unauthorized" })
  })

  it("classifies 500 / 502 / 503 as upstream-error", () => {
    expect(classifyKeyCheckResponse(500, null)).toEqual({ kind: "upstream-error" })
    expect(classifyKeyCheckResponse(502, null)).toEqual({ kind: "upstream-error" })
    expect(classifyKeyCheckResponse(503, null)).toEqual({ kind: "upstream-error" })
  })

  it("classifies 200 with null body as upstream-error (defensive)", () => {
    // If JSON parsing fails upstream of this helper, caller passes null —
    // treat as transient, optimistic-true downstream.
    expect(classifyKeyCheckResponse(200, null)).toEqual({ kind: "upstream-error" })
  })
})
