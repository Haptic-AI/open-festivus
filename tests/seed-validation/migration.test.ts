import { describe, expect, it, beforeEach } from "vitest"
import { MemoryStore } from "../../apps/web/src/lib/workbench/store/memory-store"
import type { IPersistedWorkbenchState } from "@festivus/types"

function makeState(id: string, updatedAt?: number): IPersistedWorkbenchState {
  return {
    version: 1,
    projectId: id,
    name: `Project ${id}`,
    canvasNodes: [],
    connections: [],
    messages: [],
    snapshots: [],
    tray: [],
    selectedInGroup: {},
    createdAt: 1000,
    updatedAt: updatedAt ?? Date.now(),
  }
}

/**
 * Tests the migration logic directly (without React hooks) since we
 * don't have @testing-library/react. The useMigration hook is a thin
 * wrapper around this same sequence.
 */
async function migrate(localStore: MemoryStore, apiStore: MemoryStore): Promise<number> {
  const projects = await localStore.list()
  let count = 0
  for (const summary of projects) {
    const state = await localStore.load(summary.projectId)
    if (state !== null) {
      await apiStore.save(summary.projectId, state)
      await localStore.delete(summary.projectId)
      count++
    }
  }
  return count
}

describe("migration: localStorage to API", () => {
  let localStore: MemoryStore
  let apiStore: MemoryStore

  beforeEach(() => {
    localStore = new MemoryStore()
    apiStore = new MemoryStore()
  })

  it("copies all projects from local to API store", async () => {
    await localStore.save("proj_1", makeState("proj_1"))
    await localStore.save("proj_2", makeState("proj_2"))

    await migrate(localStore, apiStore)

    expect(await apiStore.load("proj_1")).not.toBeNull()
    expect(await apiStore.load("proj_2")).not.toBeNull()
  })

  it("clears local store after migration", async () => {
    await localStore.save("proj_1", makeState("proj_1"))

    await migrate(localStore, apiStore)

    expect(await localStore.load("proj_1")).toBeNull()
    const list = await localStore.list()
    expect(list).toHaveLength(0)
  })

  it("empty local store is a no-op", async () => {
    const count = await migrate(localStore, apiStore)
    expect(count).toBe(0)

    const apiList = await apiStore.list()
    expect(apiList).toHaveLength(0)
  })

  it("preserves project data during migration", async () => {
    const state = makeState("proj_1", 5000)
    state.name = "My Special Project"
    await localStore.save("proj_1", state)

    await migrate(localStore, apiStore)

    const loaded = await apiStore.load("proj_1")
    expect(loaded?.name).toBe("My Special Project")
    expect(loaded?.updatedAt).toBe(5000)
  })
})
