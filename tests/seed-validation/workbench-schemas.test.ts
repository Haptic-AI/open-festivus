import { describe, expect, it } from "vitest"
import { parsePersistedState, persistedWorkbenchStateSchema } from "../../apps/web/src/lib/workbench/store/schemas"
import type { IPersistedWorkbenchState } from "@festivus/types"

function makeValidState(overrides?: Partial<IPersistedWorkbenchState>): IPersistedWorkbenchState {
  return {
    version: 1,
    projectId: "proj_test123",
    name: "Test Project",
    canvasNodes: [],
    connections: [],
    messages: [],
    snapshots: [],
    tray: [],
    selectedInGroup: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

describe("persistedWorkbenchStateSchema", () => {
  it("accepts a valid state with empty arrays", () => {
    const state = makeValidState()
    const result = persistedWorkbenchStateSchema.safeParse(state)
    expect(result.success).toBe(true)
  })

  it("accepts a valid state with populated arrays", () => {
    const state = makeValidState({
      canvasNodes: [
        { id: "n1", type: "robot", data: { name: "SO-100" }, status: "confirmed" },
      ],
      connections: [
        { fromId: "n1", toId: "n2", status: "active" },
      ],
      messages: [
        { role: "user", message: "hello" },
        { role: "agent", specialist: "task", message: "hi", thinking: "..." },
      ],
      tray: [
        { node: { id: "n3", type: "policy", data: {}, status: "pending" }, addedAt: 1000 },
      ],
      snapshots: [
        {
          label: "Snapshot 1",
          canvasNodes: [{ id: "n1", type: "robot", data: {}, status: "confirmed" }],
          connections: [],
          tray: [],
          timestamp: Date.now(),
        },
      ],
      selectedInGroup: { group1: "n1" },
    })
    const result = persistedWorkbenchStateSchema.safeParse(state)
    expect(result.success).toBe(true)
  })

  it("rejects missing required fields", () => {
    const result = persistedWorkbenchStateSchema.safeParse({ version: 1, projectId: "x" })
    expect(result.success).toBe(false)
  })

  it("rejects wrong version number", () => {
    const state = makeValidState()
    const result = persistedWorkbenchStateSchema.safeParse({ ...state, version: 2 })
    expect(result.success).toBe(false)
  })

  it("rejects invalid canvasNode type", () => {
    const state = makeValidState({
      canvasNodes: [{ id: "n1", type: "invalid" as "robot", data: {}, status: "ok" }],
    })
    const result = persistedWorkbenchStateSchema.safeParse(state)
    expect(result.success).toBe(false)
  })

  it("strips extra fields", () => {
    const state = { ...makeValidState(), extraField: "should be removed" }
    const result = persistedWorkbenchStateSchema.safeParse(state)
    expect(result.success).toBe(true)
    if (result.success) {
      expect("extraField" in result.data).toBe(false)
    }
  })
})

describe("parsePersistedState", () => {
  it("returns valid state on good input", () => {
    const state = makeValidState()
    const parsed = parsePersistedState(state)
    expect(parsed).not.toBeNull()
    expect(parsed?.projectId).toBe("proj_test123")
  })

  it("returns null on malformed input", () => {
    expect(parsePersistedState("not json")).toBeNull()
    expect(parsePersistedState(null)).toBeNull()
    expect(parsePersistedState(undefined)).toBeNull()
    expect(parsePersistedState(42)).toBeNull()
    expect(parsePersistedState({})).toBeNull()
  })

  it("returns null on wrong version", () => {
    const state = { ...makeValidState(), version: 99 }
    expect(parsePersistedState(state)).toBeNull()
  })
})
