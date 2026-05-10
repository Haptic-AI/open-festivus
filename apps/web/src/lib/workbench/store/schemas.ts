import { z } from "zod"
import type { IPersistedWorkbenchState } from "@festivus/types"

const canvasNodeSchema = z.object({
  id: z.string(),
  type: z.enum(["robot", "task", "policy", "environment", "dataset", "results", "deployment"]),
  data: z.record(z.string(), z.unknown()),
  status: z.string(),
  explorationGroup: z.string().optional(),
  positionHint: z.string().optional(),
})

const connectionSchema = z.object({
  fromId: z.string(),
  toId: z.string(),
  status: z.string(),
  label: z.string().optional(),
})

const agentApiCallSchema = z.object({
  name: z.string(),
  url: z.string(),
  duration_ms: z.number(),
})

const agentMessageSchema = z.object({
  role: z.enum(["agent", "user"]),
  specialist: z.string().optional(),
  message: z.string(),
  thinking: z.string().optional(),
  api_calls: z.array(agentApiCallSchema).optional(),
})

const trayItemSchema = z.object({
  node: canvasNodeSchema,
  addedAt: z.number(),
})

const snapshotSchema = z.object({
  label: z.string(),
  canvasNodes: z.array(canvasNodeSchema),
  connections: z.array(connectionSchema),
  tray: z.array(trayItemSchema),
  timestamp: z.number(),
})

export const persistedWorkbenchStateSchema = z.object({
  version: z.literal(1),
  projectId: z.string(),
  name: z.string(),
  canvasNodes: z.array(canvasNodeSchema),
  connections: z.array(connectionSchema),
  messages: z.array(agentMessageSchema),
  snapshots: z.array(snapshotSchema),
  tray: z.array(trayItemSchema),
  selectedInGroup: z.record(z.string(), z.string()),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export function parsePersistedState(raw: unknown): IPersistedWorkbenchState | null {
  const result = persistedWorkbenchStateSchema.safeParse(raw)
  if (result.success) {
    return result.data
  }
  return null
}
