import type { IRobot } from "@festivus/types"
import request from "supertest"
import { describe, expect, it } from "vitest"
import { FixtureRepo } from "../repo/fixture.js"
import { createServer } from "../server.js"

function fixture(): FixtureRepo {
  const robots = [
    { slug: "franka-panda", name: "Franka Panda" },
    { slug: "ur5e", name: "UR5e" },
    { slug: "spot", name: "Spot" },
  ] as unknown as IRobot[]
  return new FixtureRepo({ robots })
}

describe("GET /v1/robots", () => {
  it("returns envelope with count/limit/offset/results", async () => {
    const app = createServer(fixture())
    const res = await request(app).get("/v1/robots").query({ limit: 1 })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ count: 3, limit: 1, offset: 0 })
    expect(res.body.results).toHaveLength(1)
  })

  it("returns a single robot by slug", async () => {
    const app = createServer(fixture())
    const res = await request(app).get("/v1/robots/ur5e")
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ slug: "ur5e" })
  })

  it("404s an unknown slug", async () => {
    const app = createServer(fixture())
    const res = await request(app).get("/v1/robots/nope")
    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ error: "not_found" })
  })
})
