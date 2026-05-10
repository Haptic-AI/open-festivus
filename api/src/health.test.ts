import { describe, expect, it } from "vitest"
import { PORT } from "./index.js"

describe("api harness", () => {
  it("PORT is 8000", () => {
    expect(PORT).toBe(8000)
  })
})
