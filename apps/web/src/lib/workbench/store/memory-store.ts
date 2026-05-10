import type { IPersistedWorkbenchState, IProjectStore, IProjectSummary } from "@festivus/types"

export class MemoryStore implements IProjectStore {
  private data = new Map<string, IPersistedWorkbenchState>()

  async save(projectId: string, state: IPersistedWorkbenchState): Promise<void> {
    this.data.set(projectId, structuredClone(state))
  }

  async load(projectId: string): Promise<IPersistedWorkbenchState | null> {
    const entry = this.data.get(projectId)
    return entry !== undefined ? structuredClone(entry) : null
  }

  async list(): Promise<IProjectSummary[]> {
    const summaries: IProjectSummary[] = []
    for (const state of this.data.values()) {
      summaries.push({
        projectId: state.projectId,
        name: state.name,
        nodeCount: state.canvasNodes.length,
        updatedAt: state.updatedAt,
        createdAt: state.createdAt,
      })
    }
    return summaries.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async delete(projectId: string): Promise<void> {
    this.data.delete(projectId)
  }
}
