import type { ICompatibilityEdge } from "@festivus/types"
import request from "supertest"
import { describe, expect, it } from "vitest"
import { FixtureRepo } from "../repo/fixture.js"
import { createServer } from "../server.js"

function fixture(): FixtureRepo {
  const compatibility_edges = [
    {
      slug: "franka__rt2-base__kitchen",
      robot_slug: "franka",
      policy_slug: "rt2-base",
      environment: "kitchen",
      status: "known-good",
    },
    {
      slug: "ur5e__octo__global",
      robot_slug: "ur5e",
      policy_slug: "octo",
      environment: null,
      status: "inferred",
    },
  ] as unknown as ICompatibilityEdge[]
  return new FixtureRepo({ compatibility_edges })
}

describe("GET /v1/compatibility-edges", () => {
  it("envelope", async () => {
    const res = await request(createServer(fixture()))
      .get("/v1/compatibility-edges")
      .query({ limit: 1 })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ count: 2, limit: 1, offset: 0 })
    expect(res.body.results).toHaveLength(1)
  })
  it("getBySlug", async () => {
    const res = await request(createServer(fixture())).get(
      "/v1/compatibility-edges/franka__rt2-base__kitchen",
    )
    expect(res.status).toBe(200)
    expect(res.body.slug).toBe("franka__rt2-base__kitchen")
  })
  it("404", async () => {
    const res = await request(createServer(fixture())).get("/v1/compatibility-edges/nope")
    expect(res.status).toBe(404)
  })
})
