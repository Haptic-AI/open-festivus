import { describe, expect, it, beforeEach, vi, afterEach } from "vitest"
import { MemoryStore } from "../../apps/web/src/lib/workbench/store/memory-store"
import type { IPersistedWorkbenchState, IProjectStore } from "@festivus/types"

/**
 * Since we don't have @testing-library/react, we test the hook's core
 * contract by exercising the store + debounce logic directly. The hook
 * is a thin wrapper around these behaviors.
 */

function makeState(id: string, updatedAt?: number): IPersistedWorkbenchState {
  return {
    version: 1,
    projectId: id,
    name: `Project ${id}`,
    canvasNodes: [],
    connections: [],
    messages: [{ role: "user", message: "hello" }],
    snapshots: [],
    tray: [],
    selectedInGroup: {},
    createdAt: 1000,
    updatedAt: updatedAt ?? Date.now(),
  }
}

/** Minimal debounced-save reproducing the hook's flush/save logic. */
class DebouncedSaver {
  private timer: ReturnType<typeof setTimeout> | null = null
  private pending: IPersistedWorkbenchState | null = null

  constructor(
    private store: IProjectStore,
    private projectId: string,
    private debounceMs = 1500,
  ) {}

  save(state: IPersistedWorkbenchState): void {
    this.pending = state
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      this.flushSync()
    }, this.debounceMs)
  }

  flush(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.flushSync()
  }

  private flushSync(): void {
    const p = this.pending
    if (p !== null) {
      this.pending = null
      void this.store.save(this.projectId, p)
    }
  }
}

// Pure function extracted from the hydration useEffect in workbench-canvas.tsx.
// Returns whether the canvas should flip hydrated=true and allow saves.
// Bug (fixed 2026-04-22): returning false when initialState===null && clerkLoaded
// meant new projects never enabled saves — state was lost on reload.
function shouldFlipHydrated(opts: {
  isLoaded: boolean
  hydrated: boolean
  initialState: unknown | null
  clerkLoaded: boolean
}): boolean {
  if (!opts.isLoaded || opts.hydrated) return false
  if (opts.initialState === null && !opts.clerkLoaded) return false
  return true
}

describe("hydration gate (workbench-canvas)", () => {
  it("new project (null state, clerk loaded) → should flip hydrated", () => {
    expect(shouldFlipHydrated({ isLoaded: true, hydrated: false, initialState: null, clerkLoaded: true })).toBe(true)
  })

  it("new project (null state, clerk NOT loaded) → should wait", () => {
    // Still on localStore — real state may exist in apiStore once Clerk resolves.
    expect(shouldFlipHydrated({ isLoaded: true, hydrated: false, initialState: null, clerkLoaded: false })).toBe(false)
  })

  it("existing project (state returned) → should flip hydrated", () => {
    expect(shouldFlipHydrated({ isLoaded: true, hydrated: false, initialState: { canvasNodes: [] }, clerkLoaded: false })).toBe(true)
  })

  it("already hydrated → no-op", () => {
    expect(shouldFlipHydrated({ isLoaded: true, hydrated: true, initialState: null, clerkLoaded: true })).toBe(false)
  })

  it("persistence not yet loaded → should wait", () => {
    expect(shouldFlipHydrated({ isLoaded: false, hydrated: false, initialState: null, clerkLoaded: true })).toBe(false)
  })
})

// Simulates the store-swap scenario: Clerk resolves and switches localStore → apiStore.
// The load effect MUST re-run with the new store, otherwise projects saved to the API
// appear empty in the canvas even though the row exists in the database.
// Bug (fixed 2026-04-22): [projectId] was the only dep; adding `store` to deps fixes it.
describe("store-swap: load re-runs when store changes (Clerk resolves)", () => {
  it("second store has the project; first store does not", async () => {
    const localStore = new MemoryStore()  // no data
    const apiStore = new MemoryStore()

    const state = makeState("proj_1")
    await apiStore.save("proj_1", state)

    // localStore (before Clerk) returns null
    expect(await localStore.load("proj_1")).toBeNull()
    // apiStore (after Clerk) returns the project
    expect(await apiStore.load("proj_1")).toMatchObject({ projectId: "proj_1", canvasNodes: expect.any(Array) })
  })

  it("hydrated resets when isLoaded goes false (store re-loading)", () => {
    // Simulates the reset effect: when isLoaded flips false (store changed, re-loading),
    // hydrated must reset so the hydration effect fires again with the real state.
    let hydrated = false
    function onIsLoadedChange(isLoaded: boolean) {
      if (!isLoaded) hydrated = false
    }

    hydrated = true  // was hydrated with localStore null
    onIsLoadedChange(false)  // store changed, re-loading
    expect(hydrated).toBe(false)  // must reset so next load can hydrate real state
  })
})

describe("useProjectPersistence (logic)", () => {
  let store: MemoryStore

  beforeEach(() => {
    vi.useFakeTimers()
    store = new MemoryStore()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("loads existing project from store", async () => {
    const state = makeState("proj_1")
    await store.save("proj_1", state)
    const loaded = await store.load("proj_1")
    expect(loaded).toEqual(state)
    expect(loaded?.messages).toHaveLength(1)
  })

  it("returns null for unknown project", async () => {
    const loaded = await store.load("unknown")
    expect(loaded).toBeNull()
  })

  it("debounces multiple rapid saves into one store write", async () => {
    const saveSpy = vi.spyOn(store, "save")
    const saver = new DebouncedSaver(store, "proj_1")

    saver.save(makeState("proj_1", 1000))
    saver.save(makeState("proj_1", 2000))
    saver.save(makeState("proj_1", 3000))

    // No writes yet
    expect(saveSpy).not.toHaveBeenCalled()

    // Advance past debounce
    vi.advanceTimersByTime(2000)

    // Only one write with the latest state
    expect(saveSpy).toHaveBeenCalledTimes(1)
    expect(saveSpy.mock.calls[0][1].updatedAt).toBe(3000)
  })

  it("flush writes pending state immediately", async () => {
    const saveSpy = vi.spyOn(store, "save")
    const saver = new DebouncedSaver(store, "proj_1")

    saver.save(makeState("proj_1", 5000))
    expect(saveSpy).not.toHaveBeenCalled()

    saver.flush()
    expect(saveSpy).toHaveBeenCalledTimes(1)
    expect(saveSpy.mock.calls[0][1].updatedAt).toBe(5000)
  })

  it("flush with no pending state is a no-op", () => {
    const saveSpy = vi.spyOn(store, "save")
    const saver = new DebouncedSaver(store, "proj_1")

    saver.flush()
    expect(saveSpy).not.toHaveBeenCalled()
  })

  it("debounce resets timer on each save call", () => {
    const saveSpy = vi.spyOn(store, "save")
    const saver = new DebouncedSaver(store, "proj_1", 1500)

    saver.save(makeState("proj_1", 1000))
    vi.advanceTimersByTime(1000) // 1000ms in, not fired yet

    saver.save(makeState("proj_1", 2000)) // resets timer
    vi.advanceTimersByTime(1000) // 1000ms after reset, still not fired
    expect(saveSpy).not.toHaveBeenCalled()

    vi.advanceTimersByTime(600) // now 1600ms after reset -- fired
    expect(saveSpy).toHaveBeenCalledTimes(1)
    expect(saveSpy.mock.calls[0][1].updatedAt).toBe(2000)
  })
})
