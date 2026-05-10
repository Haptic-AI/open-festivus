import { describe, expect, it } from "vitest"
import request from "supertest"
import { createServer } from "../server.js"
import { FixtureRepo } from "../repo/fixture.js"

describe("GET /metrics", () => {
  it("returns 200 with Prometheus text exposition format", async () => {
    const app = createServer(new FixtureRepo())
    const res = await request(app).get("/metrics")
    expect(res.status).toBe(200)
    expect(res.headers["content-type"]).toMatch(/text\/plain/)
    expect(res.text).toContain("festivus_api_process_cpu_user_seconds_total")
    expect(res.text).toContain("festivus_api_nodejs_eventloop_lag_seconds")
  })

  it("does not require an API key (scraped over VPC by festivus-prometheus)", async () => {
    const app = createServer(new FixtureRepo())
    // No x-api-key header — should still succeed.
    const res = await request(app).get("/metrics")
    expect(res.status).toBe(200)
  })
})
