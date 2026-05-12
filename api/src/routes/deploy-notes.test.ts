import type { IDeployNote } from "@festivus/types"
import request from "supertest"
import { describe, expect, it } from "vitest"
import { FixtureRepo } from "../repo/fixture.js"
import { createServer } from "../server.js"

function fixture(): FixtureRepo {
  const deploy_notes = [
    { slug: "note-1", title: "First" },
    { slug: "note-2", title: "Second" },
  ] as unknown as IDeployNote[]
  return new FixtureRepo({ deploy_notes })
}

describe("GET /v1/deploy-notes", () => {
  it("envelope", async () => {
    const res = await request(createServer(fixture())).get("/v1/deploy-notes").query({ limit: 1 })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ count: 2, limit: 1, offset: 0 })
    expect(res.body.results).toHaveLength(1)
  })
  it("getBySlug", async () => {
    const res = await request(createServer(fixture())).get("/v1/deploy-notes/note-1")
    expect(res.status).toBe(200)
    expect(res.body.slug).toBe("note-1")
  })
  it("404", async () => {
    const res = await request(createServer(fixture())).get("/v1/deploy-notes/nope")
    expect(res.status).toBe(404)
  })
})
