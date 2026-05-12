import { describe, expect, it } from "vitest"

describe("vercel handler shape (api/api/index.ts)", () => {
  it("has a default export that is a function accepting (req, res)", async () => {
    const mod = await import("./index.js")
    expect(typeof mod.default).toBe("function")
    expect(mod.default.length).toBe(2)
  })
})
