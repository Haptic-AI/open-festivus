import request from "supertest"
import { describe, expect, it } from "vitest"
import { FixtureRepo } from "../repo/fixture.js"
import { createServer } from "../server.js"

describe("POST /v1/ask", () => {
  it("returns 404 with explanatory JSON", async () => {
    const res = await request(createServer(new FixtureRepo())).post("/v1/ask").send({})
    expect(res.status).toBe(404)
    expect(res.body.error).toBe("moved")
    expect(res.body.message).toMatch(/apps\/web\/src\/app\/api\/agent/)
  })
})
