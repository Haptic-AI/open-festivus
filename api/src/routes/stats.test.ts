import type { IRobot, IPolicy } from "@festivus/types"
import request from "supertest"
import { describe, expect, it } from "vitest"
import { FixtureRepo } from "../repo/fixture.js"
import { createServer } from "../server.js"

describe("GET /v1/stats", () => {
  it("returns counts per table", async () => {
    const repo = new FixtureRepo({
      robots: [{ slug: "a" }, { slug: "b" }] as unknown as IRobot[],
      policies: [{ slug: "p" }] as unknown as IPolicy[],
    })
    const res = await request(createServer(repo)).get("/v1/stats")
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      robots: 2,
      policies: 1,
      datasets: 0,
      benchmarks: 0,
      deploy_notes: 0,
      environments: 0,
      tasks: 0,
      papers: 0,
      hardware: 0,
      compatibility_edges: 0,
      laundry_compat_edges: 0,
    })
  })
})
