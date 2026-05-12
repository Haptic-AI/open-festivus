import type { IDataset } from "@festivus/types"
import request from "supertest"
import { describe, expect, it } from "vitest"
import { FixtureRepo } from "../repo/fixture.js"
import { createServer } from "../server.js"

function fixture(): FixtureRepo {
  const datasets = [
    { slug: "lerobot-pusht", name: "LeRobot PushT" },
    { slug: "rlds-open-x", name: "RLDS Open X" },
  ] as unknown as IDataset[]
  return new FixtureRepo({ datasets })
}

describe("GET /v1/datasets", () => {
  it("envelope", async () => {
    const res = await request(createServer(fixture())).get("/v1/datasets").query({ limit: 5 })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ count: 2, limit: 5, offset: 0 })
    expect(res.body.results).toHaveLength(2)
  })
  it("getBySlug", async () => {
    const res = await request(createServer(fixture())).get("/v1/datasets/lerobot-pusht")
    expect(res.status).toBe(200)
    expect(res.body.slug).toBe("lerobot-pusht")
  })
  it("404", async () => {
    const res = await request(createServer(fixture())).get("/v1/datasets/nope")
    expect(res.status).toBe(404)
  })
})
