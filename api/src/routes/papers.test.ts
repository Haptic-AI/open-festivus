import type { IPaper } from "@festivus/types"
import request from "supertest"
import { describe, expect, it } from "vitest"
import { FixtureRepo } from "../repo/fixture.js"
import { createServer } from "../server.js"

function fixture(): FixtureRepo {
  const papers = [
    { slug: "paper-1", title: "RT-2: Vision-Language-Action Models" },
    { slug: "paper-2", title: "Octo: Open-Source Generalist Robot Policy" },
  ] as unknown as IPaper[]
  return new FixtureRepo({ papers })
}

describe("GET /v1/papers", () => {
  it("envelope", async () => {
    const res = await request(createServer(fixture())).get("/v1/papers").query({ limit: 1 })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ count: 2, limit: 1, offset: 0 })
    expect(res.body.results).toHaveLength(1)
  })
  it("getBySlug", async () => {
    const res = await request(createServer(fixture())).get("/v1/papers/paper-1")
    expect(res.status).toBe(200)
    expect(res.body.slug).toBe("paper-1")
  })
  it("404", async () => {
    const res = await request(createServer(fixture())).get("/v1/papers/nope")
    expect(res.status).toBe(404)
  })
})
