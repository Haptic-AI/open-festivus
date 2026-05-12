import type { IHardwareSKU } from "@festivus/types"
import request from "supertest"
import { describe, expect, it } from "vitest"
import { FixtureRepo } from "../repo/fixture.js"
import { createServer } from "../server.js"

function fixture(): FixtureRepo {
  const hardware = [
    { slug: "hw-1", name: "Intel RealSense D435" },
    { slug: "hw-2", name: "Dynamixel XM430" },
  ] as unknown as IHardwareSKU[]
  return new FixtureRepo({ hardware })
}

describe("GET /v1/hardware", () => {
  it("envelope", async () => {
    const res = await request(createServer(fixture())).get("/v1/hardware").query({ limit: 1 })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ count: 2, limit: 1, offset: 0 })
    expect(res.body.results).toHaveLength(1)
  })
  it("getBySlug", async () => {
    const res = await request(createServer(fixture())).get("/v1/hardware/hw-1")
    expect(res.status).toBe(200)
    expect(res.body.slug).toBe("hw-1")
  })
  it("404", async () => {
    const res = await request(createServer(fixture())).get("/v1/hardware/nope")
    expect(res.status).toBe(404)
  })
})
