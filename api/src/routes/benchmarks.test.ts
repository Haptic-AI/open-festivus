import type { IBenchmarkRecord } from "@festivus/types"
import request from "supertest"
import { describe, expect, it } from "vitest"
import { FixtureRepo } from "../repo/fixture.js"
import { createServer } from "../server.js"

function fixture(): FixtureRepo {
  const benchmarks = [
    { slug: "libero", name: "LIBERO" },
    { slug: "rlbench", name: "RLBench" },
  ] as unknown as IBenchmarkRecord[]
  return new FixtureRepo({ benchmarks })
}

describe("GET /v1/benchmarks", () => {
  it("envelope", async () => {
    const res = await request(createServer(fixture())).get("/v1/benchmarks").query({ limit: 10 })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ count: 2, limit: 10, offset: 0 })
  })
  it("getBySlug", async () => {
    const res = await request(createServer(fixture())).get("/v1/benchmarks/libero")
    expect(res.status).toBe(200)
    expect(res.body.slug).toBe("libero")
  })
  it("404", async () => {
    const res = await request(createServer(fixture())).get("/v1/benchmarks/nope")
    expect(res.status).toBe(404)
  })
})
