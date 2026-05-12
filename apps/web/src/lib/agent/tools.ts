import type { Tool } from "@anthropic-ai/sdk/resources/messages"
import { API_TOOLS } from "@/lib/agent/api-tools"
import { buildTools as buildEditTools } from "@/lib/edit-primitives/tools"

export const CANVAS_TOOLS: Tool[] = [
  {
    name: "add_node",
    description: "Add a node to the canvas (robot, task, policy, environment, dataset, results, or deployment). Use exploration_group to show multiple options side by side. Use node_type='deployment' for Deploy Advisor assessments — one per robot.",
    input_schema: {
      type: "object" as const,
      properties: {
        node_type: { type: "string", enum: ["robot", "task", "policy", "environment", "dataset", "results", "deployment"] },
        id: { type: "string", description: "Unique node ID" },
        data: { type: "object" as const, description: "Node-specific data (name, specs, benchmarks, etc.)" },
        position_hint: { type: "string", enum: ["left", "center", "right", "below_current"] },
        exploration_group: { type: "string", description: "If set, groups this node with others for parallel comparison" },
      },
      required: ["node_type", "id", "data"],
    },
  },
  {
    name: "update_node",
    description: "Update an existing node's data or status",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string" },
        updates: { type: "object" as const, description: "Partial data to merge into the node" },
        status: { type: "string", enum: ["idle", "exploring", "selected", "rejected", "building", "ready", "error"] },
      },
      required: ["id"],
    },
  },
  {
    name: "connect_nodes",
    description: "Draw a connection between two nodes on the canvas",
    input_schema: {
      type: "object" as const,
      properties: {
        from_id: { type: "string" },
        to_id: { type: "string" },
        status: { type: "string", enum: ["compatible", "untested", "incompatible", "suggested"] },
        label: { type: "string" },
      },
      required: ["from_id", "to_id"],
    },
  },
  {
    name: "show_agent_message",
    description: "Show a message in the agent sidebar panel. Always specify which specialist is speaking.",
    input_schema: {
      type: "object" as const,
      properties: {
        specialist: { type: "string", enum: ["task", "hardware", "policy", "simulation", "community", "deployment"] },
        message: { type: "string" },
        thinking: { type: "string", description: "Collapsible reasoning chain (Show process)" },
      },
      required: ["specialist", "message"],
    },
  },
  {
    name: "set_canvas_status",
    description: "Set a floating status badge on the canvas near a node. Use warm language like 'Scouting options...' not 'Searching...'",
    input_schema: {
      type: "object" as const,
      properties: {
        node_id: { type: "string", description: "Node to attach status to. Omit for canvas-level status." },
        status_text: { type: "string" },
        specialist: { type: "string", enum: ["task", "hardware", "policy", "simulation", "community", "deployment"] },
      },
      required: ["status_text", "specialist"],
    },
  },
  {
    name: "ask_user",
    description: "Ask the user a question with suggested clickable options",
    input_schema: {
      type: "object" as const,
      properties: {
        question: { type: "string" },
        options: { type: "array" as const, items: { type: "string" } },
        allow_freeform: { type: "boolean" },
      },
      required: ["question"],
    },
  },
  {
    name: "update_recipe",
    description: "Update the auto-generated recipe card with current project state",
    input_schema: {
      type: "object" as const,
      properties: {
        robot: { type: "object" as const },
        task: { type: "object" as const },
        policy: { type: "object" as const },
        environment: { type: "object" as const },
        results: { type: "object" as const },
        deploy_notes: { type: "array" as const, items: { type: "string" } },
      },
    },
  },
]

// Combined tool list passed to Anthropic. Canvas tools are forwarded as SSE
// tool_call events; API tools are dispatched server-side and the result is
// returned as a tool_result on the next turn (see route.ts). Edit tools
// (list_candidates / propose_edit / apply_edit) come from edit-primitives
// so both agents share the same Zod-derived schemas.
export const AGENT_TOOLS: Tool[] = [
  ...CANVAS_TOOLS,
  ...API_TOOLS,
  ...(buildEditTools() as Tool[]),
]
