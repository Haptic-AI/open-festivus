import type { IRobot } from "@festivus/types"
import request from "supertest"
import { describe, expect, it, vi } from "vitest"
import { FixtureRepo } from "../repo/fixture.js"
import { createServer } from "../server.js"
import type { ITypesenseClient } from "../typesense/client.js"

describe("GET /v1/search", () => {
  it("400s without ?q=", async () => {
    const res = await request(createServer(new FixtureRepo())).get("/v1/search")
    expect(res.status).toBe(400)
  })
  it("returns hits across tables (Postgres fallback)", async () => {
    const robots = [
      { slug: "franka-panda", name: "Franka Panda" },
      { slug: "ur5e", name: "UR5e" },
    ] as unknown as IRobot[]
    const res = await request(createServer(new FixtureRepo({ robots })))
      .get("/v1/search")
      .query({ q: "franka" })
    expect(res.status).toBe(200)
    expect(res.body.count).toBe(1)
    expect(res.body.results[0]).toMatchObject({ table: "robots", slug: "franka-panda" })
  })

  it("routes through Typesense when client is provided", async () => {
    const multiSearch = vi.fn(async () => [
      [
        {
          document: {
            id: "robots:franka-panda",
            slug: "franka-panda",
            table: "robots",
            data: { slug: "franka-panda", name: "Franka Panda" },
          },
          text_match: 100,
        },
      ],
      // Empty results for the rest of the searchable tables.
      [], [], [], [], [], [], [],
    ])
    const typesense: ITypesenseClient = {
      multiSearch,
      upsertDocument: vi.fn(),
      deleteDocument: vi.fn(),
      importDocuments: vi.fn(),
      ensureCollection: vi.fn(),
    }
    const res = await request(
      createServer(new FixtureRepo(), { typesense }),
    )
      .get("/v1/search")
      .query({ q: "franka" })
    expect(res.status).toBe(200)
    expect(multiSearch).toHaveBeenCalledOnce()
    expect(res.body.count).toBe(1)
    expect(res.body.results[0]).toMatchObject({
      table: "robots",
      slug: "franka-panda",
      data: { name: "Franka Panda" },
    })
  })
})
