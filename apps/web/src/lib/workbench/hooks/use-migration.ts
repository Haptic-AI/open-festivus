import { useEffect, useRef, useState } from "react"
import type { IProjectStore } from "@festivus/types"
import { LocalProjectStore } from "../store/local-store"

const localStore = new LocalProjectStore()

export function useMigration(
  isSignedIn: boolean,
  apiStore: IProjectStore,
): { isMigrating: boolean } {
  const [isMigrating, setIsMigrating] = useState(false)
  const migrated = useRef(false)
  const prevSignedIn = useRef(isSignedIn)

  useEffect(() => {
    const justSignedIn = isSignedIn && !prevSignedIn.current
    prevSignedIn.current = isSignedIn

    if (!justSignedIn || migrated.current) return
    migrated.current = true
    setIsMigrating(true)

    void (async () => {
      try {
        const projects = await localStore.list()
        for (const summary of projects) {
          const state = await localStore.load(summary.projectId)
          if (state !== null) {
            await apiStore.save(summary.projectId, state)
            await localStore.delete(summary.projectId)
          }
        }
      } catch {
        // Migration failure is non-fatal -- projects stay in localStorage
      } finally {
        setIsMigrating(false)
      }
    })()
  }, [isSignedIn, apiStore])

  return { isMigrating }
}
