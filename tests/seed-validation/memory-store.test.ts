import { describe, expect, it, beforeEach } from "vitest"
import { MemoryStore } from "../../apps/web/src/lib/workbench/store/memory-store"
import type { IPersistedWorkbenchState } from "@festivus/types"

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

describe("MemoryStore", () => {
  let store: MemoryStore

  beforeEach(() => {
    store = new MemoryStore()
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

  it("save returns a defensive copy (mutations do not affect store)", async () => {
    const state = makeState("proj_1")
    await store.save("proj_1", state)
    state.name = "mutated"
    const loaded = await store.load("proj_1")
    expect(loaded?.name).toBe("Project proj_1")
  })
})
