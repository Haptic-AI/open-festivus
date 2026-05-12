import type { IPolicy } from "@festivus/types"
import request from "supertest"
import { describe, expect, it } from "vitest"
import { FixtureRepo } from "../repo/fixture.js"
import { createServer } from "../server.js"

function fixture(): FixtureRepo {
  const policies = [
    { slug: "act", name: "ACT" },
    { slug: "diffusion-policy", name: "Diffusion Policy" },
  ] as unknown as IPolicy[]
  return new FixtureRepo({ policies })
}

describe("GET /v1/policies", () => {
  it("envelope shape", async () => {
    const res = await request(createServer(fixture())).get("/v1/policies").query({ limit: 1 })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ count: 2, limit: 1, offset: 0 })
    expect(res.body.results).toHaveLength(1)
  })
  it("getBySlug", async () => {
    const res = await request(createServer(fixture())).get("/v1/policies/act")
    expect(res.status).toBe(200)
    expect(res.body.slug).toBe("act")
  })
  it("404 unknown", async () => {
    const res = await request(createServer(fixture())).get("/v1/policies/nope")
    expect(res.status).toBe(404)
  })
})
