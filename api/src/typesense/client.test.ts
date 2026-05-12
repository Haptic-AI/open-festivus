import { describe, expect, it, vi } from "vitest"
import { TypesenseError, createTypesenseClient } from "./client.js"

function fakeFetchOk(body: unknown): typeof fetch {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  })) as unknown as typeof fetch
}

function fakeFetchStatus(status: number, body = ""): typeof fetch {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  })) as unknown as typeof fetch
}

describe("HttpTypesenseClient", () => {
  it("multiSearch unwraps `results` into per-search hit arrays", async () => {
    const fetchImpl = fakeFetchOk({
      results: [
        { hits: [{ document: { id: "robots:a", slug: "a" } }] },
        { hits: [] },
      ],
    })
    const client = createTypesenseClient({
      host: "h", port: 8108, apiKey: "k", fetchImpl,
    })
    const out = await client.multiSearch([
      { collection: "festivus_robots", q: "a", query_by: "name" },
      { collection: "festivus_policies", q: "a", query_by: "name" },
    ])
    expect(out).toHaveLength(2)
    expect(out[0]).toHaveLength(1)
    expect(out[1]).toHaveLength(0)
  })

  it("ensureCollection swallows 409 (already exists)", async () => {
    const client = createTypesenseClient({
      host: "h", port: 8108, apiKey: "k",
      fetchImpl: fakeFetchStatus(409),
    })
    await expect(
      client.ensureCollection({ name: "festivus_robots", fields: [] }),
    ).resolves.toBeUndefined()
  })

  it("ensureCollection rethrows non-409 errors", async () => {
    const client = createTypesenseClient({
      host: "h", port: 8108, apiKey: "k",
      fetchImpl: fakeFetchStatus(500, "boom"),
    })
    await expect(
      client.ensureCollection({ name: "festivus_robots", fields: [] }),
    ).rejects.toBeInstanceOf(TypesenseError)
  })

  it("deleteDocument swallows 404", async () => {
    const client = createTypesenseClient({
      host: "h", port: 8108, apiKey: "k",
      fetchImpl: fakeFetchStatus(404),
    })
    await expect(
      client.deleteDocument("festivus_robots", "robots:gone"),
    ).resolves.toBeUndefined()
  })
})
