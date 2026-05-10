import request from "supertest"
import { describe, expect, it } from "vitest"
import { FixtureRepo } from "./repo/fixture.js"
import { createServer } from "./server.js"

describe("GET /health", () => {
  it("returns ok", async () => {
    const app = createServer(new FixtureRepo())
    const res = await request(app).get("/health")
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: "ok", deployProbe: "noop-2026-04-21" })
  })
})

describe("GET /agents.json", () => {
  it("307s to /v1/openapi.json", async () => {
    const app = createServer(new FixtureRepo())
    const res = await request(app).get("/agents.json").redirects(0)
    expect(res.status).toBe(307)
    expect(res.headers["location"]).toBe("/v1/openapi.json")
  })
})
