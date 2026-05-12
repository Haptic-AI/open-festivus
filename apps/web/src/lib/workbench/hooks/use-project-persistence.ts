import { useCallback, useEffect, useRef, useState } from "react"
import type { IPersistedWorkbenchState, IProjectStore } from "@festivus/types"

const DEBOUNCE_MS = 1500

interface IUseProjectPersistenceResult {
  initialState: IPersistedWorkbenchState | null
  isLoaded: boolean
  save: (state: IPersistedWorkbenchState) => void
}

export function useProjectPersistence(
  projectId: string | undefined,
  store: IProjectStore,
): IUseProjectPersistenceResult {
  const [initialState, setInitialState] = useState<IPersistedWorkbenchState | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<IPersistedWorkbenchState | null>(null)
  const storeRef = useRef(store)
  const projectIdRef = useRef(projectId)
  storeRef.current = store
  projectIdRef.current = projectId

  // Load when projectId or store changes. `store` changes when Clerk resolves and
  // swaps localStore → apiStore. Without store in deps, the load runs once with
  // localStore (returns null from localStorage) and never re-runs with apiStore,
  // leaving initialState=null even when the project exists in the database.
  useEffect(() => {
    if (projectId === undefined) {
      setIsLoaded(true)
      return
    }
    setIsLoaded(false)
    setInitialState(null)
    let cancelled = false
    void store.load(projectId).then((loaded) => {
      if (!cancelled) {
        setInitialState(loaded)
        setIsLoaded(true)
      }
    }).catch(() => {
      if (!cancelled) {
        setIsLoaded(true)
      }
    })
    return () => { cancelled = true }
  }, [projectId, store])

  // Flush helper
  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const pending = pendingRef.current
    const pid = projectIdRef.current
    if (pending !== null && pid !== undefined) {
      pendingRef.current = null
      void storeRef.current.save(pid, pending)
    }
  }, [])

  // Flush on beforeunload and cleanup
  useEffect(() => {
    const handler = () => flush()
    window.addEventListener("beforeunload", handler)
    return () => {
      window.removeEventListener("beforeunload", handler)
      flush()
    }
  }, [flush])

  // Debounced save
  const save = useCallback((state: IPersistedWorkbenchState) => {
    pendingRef.current = state
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      const pending = pendingRef.current
      const pid = projectIdRef.current
      if (pending !== null && pid !== undefined) {
        pendingRef.current = null
        void storeRef.current.save(pid, pending)
      }
    }, DEBOUNCE_MS)
  }, [])

  return { initialState, isLoaded, save }
}
