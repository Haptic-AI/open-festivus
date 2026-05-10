import type { IPersistedWorkbenchState, IProjectStore, IProjectSummary } from "@festivus/types"
import { parsePersistedState } from "./schemas"

const KEY_PREFIX = "workbench_project:"

function isLocalStorageAvailable(): boolean {
  try {
    const test = "__ls_test__"
    localStorage.setItem(test, "1")
    localStorage.removeItem(test)
    return true
  } catch {
    return false
  }
}

export class LocalProjectStore implements IProjectStore {
  async save(projectId: string, state: IPersistedWorkbenchState): Promise<void> {
    if (!isLocalStorageAvailable()) return
    try {
      localStorage.setItem(`${KEY_PREFIX}${projectId}`, JSON.stringify(state))
    } catch {
      // Quota exceeded or other write failure -- silently skip
    }
  }

  async load(projectId: string): Promise<IPersistedWorkbenchState | null> {
    if (!isLocalStorageAvailable()) return null
    try {
      const raw = localStorage.getItem(`${KEY_PREFIX}${projectId}`)
      if (raw === null) return null
      return parsePersistedState(JSON.parse(raw))
    } catch {
      return null
    }
  }

  async list(): Promise<IProjectSummary[]> {
    if (!isLocalStorageAvailable()) return []
    const summaries: IProjectSummary[] = []
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key === null || !key.startsWith(KEY_PREFIX)) continue
        try {
          const raw = localStorage.getItem(key)
          if (raw === null) continue
          const state = parsePersistedState(JSON.parse(raw))
          if (state === null) continue
          summaries.push({
            projectId: state.projectId,
            name: state.name,
            nodeCount: state.canvasNodes.length,
            updatedAt: state.updatedAt,
            createdAt: state.createdAt,
          })
        } catch {
          // Skip corrupt entries
        }
      }
    } catch {
      return []
    }
    return summaries.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async delete(projectId: string): Promise<void> {
    if (!isLocalStorageAvailable()) return
    try {
      localStorage.removeItem(`${KEY_PREFIX}${projectId}`)
    } catch {
      // Silently skip
    }
  }
}
