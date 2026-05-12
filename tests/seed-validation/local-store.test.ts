import { describe, expect, it, beforeEach, vi } from "vitest"
import { LocalProjectStore } from "../../apps/web/src/lib/workbench/store/local-store"
import type { IPersistedWorkbenchState } from "@festivus/types"

// Minimal localStorage mock
function createLocalStorageMock(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value) },
    removeItem: (key: string) => { store.delete(key) },
    clear: () => store.clear(),
    get length() { return store.size },
    key: (index: number) => [...store.keys()][index] ?? null,
  }
}

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

describe("LocalProjectStore", () => {
  let store: LocalProjectStore

  beforeEach(() => {
    const mock = createLocalStorageMock()
    vi.stubGlobal("localStorage", mock)
    store = new LocalProjectStore()
  })

  it("save then load round-trips correctly", async () => {
    const state = makeState("proj_1")
    await store.save("proj_1", state)
    const loaded = await store.load("proj_1")
    expect(loaded).toEqual(state)
  })

  it("load returns null for nonexistent project", async () => {
    const loaded = await store.load("nonexistent")
    expect(loaded).toBeNull()
  })

  it("load returns null for corrupt JSON", async () => {
    localStorage.setItem("workbench_project:bad", "not valid json {{{{")
    const loaded = await store.load("bad")
    expect(loaded).toBeNull()
  })

  it("load returns null for valid JSON that fails schema validation", async () => {
    localStorage.setItem("workbench_project:bad2", JSON.stringify({ version: 99, garbage: true }))
    const loaded = await store.load("bad2")
    expect(loaded).toBeNull()
  })

  it("list returns summaries sorted by updatedAt descending", async () => {
    await store.save("old", makeState("old", 1000))
    await store.save("new", makeState("new", 3000))
    await store.save("mid", makeState("mid", 2000))

    const list = await store.list()
    expect(list.map((s) => s.projectId)).toEqual(["new", "mid", "old"])
    expect(list[0].nodeCount).toBe(1)
  })

  it("delete removes the project", async () => {
    await store.save("proj_1", makeState("proj_1"))
    await store.delete("proj_1")
    const loaded = await store.load("proj_1")
    expect(loaded).toBeNull()
  })

  it("list after delete excludes the deleted project", async () => {
    await store.save("a", makeState("a", 1000))
    await store.save("b", makeState("b", 2000))
    await store.delete("a")
    const list = await store.list()
    expect(list.map((s) => s.projectId)).toEqual(["b"])
  })

  it("handles localStorage throwing gracefully on load", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("blocked") },
      setItem: () => { throw new Error("blocked") },
      removeItem: () => {},
      clear: () => {},
      length: 0,
      key: () => null,
    })
    const failStore = new LocalProjectStore()
    const loaded = await failStore.load("proj_1")
    expect(loaded).toBeNull()
  })

  it("handles localStorage throwing gracefully on save", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("blocked") },
      setItem: () => { throw new Error("blocked") },
      removeItem: () => {},
      clear: () => {},
      length: 0,
      key: () => null,
    })
    const failStore = new LocalProjectStore()
    // Should not throw
    await expect(failStore.save("proj_1", makeState("proj_1"))).resolves.toBeUndefined()
  })
})
