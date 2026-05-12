import type { IPersistedWorkbenchState, IProjectStore, IProjectSummary } from "@festivus/types"
import { parsePersistedState } from "./schemas"

export class ApiProjectStore implements IProjectStore {
  async save(projectId: string, state: IPersistedWorkbenchState): Promise<void> {
    try {
      // keepalive: true flushes on tab close/beforeunload. The Fetch spec caps
      // keepalive body at 64KB; typical workbench state (5–10 nodes + messages)
      // is ~15–30KB so we are well within the limit. Heavy snapshot use could
      // approach the cap; revisit if projects regularly exceed 50KB (spec 028).
      await fetch(`/api/workbench/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
        keepalive: true,
      })
    } catch {
      // Network error -- silently skip
    }
  }

  async load(projectId: string): Promise<IPersistedWorkbenchState | null> {
    try {
      const res = await fetch(`/api/workbench/${projectId}`)
      if (!res.ok) return null
      const data: unknown = await res.json()
      return parsePersistedState(data)
    } catch {
      return null
    }
  }

  async list(): Promise<IProjectSummary[]> {
    try {
      const res = await fetch("/api/workbench")
      if (!res.ok) return []
      return (await res.json()) as IProjectSummary[]
    } catch {
      return []
    }
  }

  async delete(projectId: string): Promise<void> {
    try {
      await fetch(`/api/workbench/${projectId}`, { method: "DELETE" })
    } catch {
      // Network error -- silently skip
    }
  }
}
