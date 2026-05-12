import type { ITask } from "@festivus/types"
import request from "supertest"
import { describe, expect, it } from "vitest"
import { FixtureRepo } from "../repo/fixture.js"
import { createServer } from "../server.js"

function fixture(): FixtureRepo {
  const tasks = [
    { slug: "task-1", name: "Pick and place" },
    { slug: "task-2", name: "Door opening" },
  ] as unknown as ITask[]
  return new FixtureRepo({ tasks })
}

describe("GET /v1/tasks", () => {
  it("envelope", async () => {
    const res = await request(createServer(fixture())).get("/v1/tasks").query({ limit: 1 })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ count: 2, limit: 1, offset: 0 })
    expect(res.body.results).toHaveLength(1)
  })
  it("getBySlug", async () => {
    const res = await request(createServer(fixture())).get("/v1/tasks/task-1")
    expect(res.status).toBe(200)
    expect(res.body.slug).toBe("task-1")
  })
  it("404", async () => {
    const res = await request(createServer(fixture())).get("/v1/tasks/nope")
    expect(res.status).toBe(404)
  })
})
