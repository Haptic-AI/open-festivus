import { describe, expect, it, beforeEach, vi } from "vitest"
import { ApiProjectStore } from "../../apps/web/src/lib/workbench/store/api-store"
import type { IPersistedWorkbenchState, IProjectSummary } from "@festivus/types"

function makeState(id: string, updatedAt?: number): IPersistedWorkbenchState {
  return {
    version: 1,
    projectId: id,
    name: `Project ${id}`,
    canvasNodes: [{ id: "n1", type: "robot", data: {}, status: "confirmed" }],
    connections: [],
    messages: [],
    snapshots: [],
    tray: [],
    selectedInGroup: {},
    createdAt: 1000,
    updatedAt: updatedAt ?? Date.now(),
  }
}

function mockFetchResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

describe("ApiProjectStore", () => {
  let store: ApiProjectStore

  beforeEach(() => {
    vi.restoreAllMocks()
    store = new ApiProjectStore()
  })

  it("save calls PUT with correct URL and body", async () => {
    const state = makeState("proj_1")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockFetchResponse({ ok: true }))

    await store.save("proj_1", state)

    expect(fetchSpy).toHaveBeenCalledWith("/api/workbench/proj_1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
      keepalive: true,
    })
  })

  it("load calls GET and parses response", async () => {
    const state = makeState("proj_1")
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockFetchResponse(state))

    const loaded = await store.load("proj_1")
    expect(loaded).toEqual(state)
  })

  it("load returns null on 404", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockFetchResponse(null, 404))

    const loaded = await store.load("nonexistent")
    expect(loaded).toBeNull()
  })

  it("load returns null on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network error"))

    const loaded = await store.load("proj_1")
    expect(loaded).toBeNull()
  })

  it("load returns null when schema validation fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockFetchResponse({ version: 99 }))

    const loaded = await store.load("proj_1")
    expect(loaded).toBeNull()
  })

  it("list calls GET and returns summaries", async () => {
    const summaries: IProjectSummary[] = [
      { projectId: "a", name: "A", nodeCount: 1, updatedAt: 2000, createdAt: 1000 },
    ]
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockFetchResponse(summaries))

    const list = await store.list()
    expect(list).toEqual(summaries)
  })

  it("list returns empty array on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"))

    const list = await store.list()
    expect(list).toEqual([])
  })

  it("delete calls DELETE with correct URL", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockFetchResponse(null, 204))

    await store.delete("proj_1")

    expect(fetchSpy).toHaveBeenCalledWith("/api/workbench/proj_1", { method: "DELETE" })
  })

  it("delete does not throw on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"))

    await expect(store.delete("proj_1")).resolves.toBeUndefined()
  })

  it("save does not throw on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"))

    await expect(store.save("proj_1", makeState("proj_1"))).resolves.toBeUndefined()
  })
})
