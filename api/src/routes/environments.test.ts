import type { IEnvironment } from "@festivus/types"
import request from "supertest"
import { describe, expect, it } from "vitest"
import { FixtureRepo } from "../repo/fixture.js"
import { createServer } from "../server.js"

function fixture(): FixtureRepo {
  const environments = [
    { slug: "lab", name: "Lab" },
    { slug: "warehouse", name: "Warehouse" },
  ] as unknown as IEnvironment[]
  return new FixtureRepo({ environments })
}

describe("GET /v1/environments", () => {
  it("envelope", async () => {
    const res = await request(createServer(fixture())).get("/v1/environments")
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ count: 2, offset: 0 })
    expect(res.body.results).toHaveLength(2)
  })
})
