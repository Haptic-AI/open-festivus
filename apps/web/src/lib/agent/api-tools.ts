/**
 * API tools — server-side tool definitions that query Festivus data API.
 *
 * These tools are invisible to the canvas. When the model invokes one,
 * the agent route does NOT forward it as a `tool_call` SSE event;
 * instead it calls the FestivusClient and returns the result as a
 * `tool_result` so the model can incorporate the data into the next turn.
 *
 * The dispatcher returns a JSON-stringified payload of at most a few KB —
 * shaped to be useful for the model rather than the full wire response.
 * Returning null from the API is wrapped as an explicit "data unavailable"
 * marker so the model knows to fall back to seed data or report a gap.
 *
 * Reference: see plan Step 2.2 + 2.3 — these tools are why the system prompt
 * can shrink from ~80KB of inlined seed data to <3KB of behavioral rules.
 */

import type { Tool } from "@anthropic-ai/sdk/resources/messages"
import { FestivusClient, type IFestivusClient } from "@/lib/api/festivus-client"

export const API_TOOL_NAMES: ReadonlySet<string> = new Set([
  "search_robots",
  "search_policies",
  "search_compatibility",
  "search_tasks",
  "get_robot_full",
  "find_gaps",
])

export const API_TOOLS: Tool[] = [
  {
    name: "search_robots",
    description:
      "Search the Festivus data API for robots. Filters: type (arm|dual-arm|quadruped|humanoid|drone|rover), manufacturer (substring), price_min, price_max, has_policies, q (free-text). Use this when the user asks for hardware options. Returns curated + bulk records mixed.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: { type: "string" },
        manufacturer: { type: "string" },
        price_min: { type: "number" },
        price_max: { type: "number" },
        has_policies: { type: "boolean" },
        q: { type: "string" },
        limit: { type: "number", description: "Max results to return (default 10, cap 50)" },
      },
    },
  },
  {
    name: "search_policies",
    description:
      "Search the Festivus data API for policies. Filters: robot (slug), skill (manipulation|locomotion|navigation|aerial), evidence (verified|reported|community|untested), framework (PyTorch|JAX|...), q (free-text). Use this for policy lookups, including 'what runs on my robot'.",
    input_schema: {
      type: "object" as const,
      properties: {
        robot: { type: "string" },
        skill: { type: "string" },
        evidence: { type: "string" },
        framework: { type: "string" },
        q: { type: "string" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "search_compatibility",
    description:
      "Look up compatibility edges between robots and policies. Pass robot=slug or policy=slug (or both) to filter. Each edge has status (verified|reported|inferred|untested), source (paper|community|inferred|taxonomy-match), success_rate, episodes_tested, and gaps. Use this when the user asks 'what works with X' or 'has Y been tested on Z'.",
    input_schema: {
      type: "object" as const,
      properties: {
        robot: { type: "string", description: "Robot slug" },
        policy: { type: "string", description: "Policy slug" },
        status: { type: "string" },
        source: { type: "string" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "search_tasks",
    description:
      "Search curated tasks. Filters: category (manipulation|locomotion|navigation|aerial|other), difficulty (easy|medium|hard|unsolved), robot_type (arm|dual-arm|quadruped|humanoid|drone|rover). Use this when decomposing a user goal into known task slugs.",
    input_schema: {
      type: "object" as const,
      properties: {
        category: { type: "string" },
        difficulty: { type: "string" },
        robot_type: { type: "string" },
        q: { type: "string" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "get_robot_full",
    description:
      "Fetch the full record for a robot by slug, including its compatible policies and datasets in one call. Use this for X→X 'everything for ALOHA' style questions.",
    input_schema: {
      type: "object" as const,
      properties: {
        slug: { type: "string", description: "Robot slug, e.g. 'franka-panda'" },
      },
      required: ["slug"],
    },
  },
  {
    name: "find_gaps",
    description:
      "Find data gaps. domain='robots-without-policies' returns robots with no compatible policies; domain='tasks-without-data' returns tasks with no compatible policies; domain='untested-edges' returns edges with status='untested' or 'inferred'. Use this for shape 21 (X→G) gap-finder questions.",
    input_schema: {
      type: "object" as const,
      properties: {
        domain: {
          type: "string",
          enum: ["robots-without-policies", "tasks-without-data", "untested-edges"],
        },
        limit: { type: "number" },
      },
      required: ["domain"],
    },
  },
]

// ── Dispatcher ────────────────────────────────────────────────────

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 20

function clampLimit(input: unknown): number {
  if (typeof input !== "number" || !Number.isFinite(input)) return DEFAULT_LIMIT
  return Math.min(Math.max(1, Math.floor(input)), MAX_LIMIT)
}

function asString(input: unknown): string | undefined {
  return typeof input === "string" && input.length > 0 ? input : undefined
}

function asNumber(input: unknown): number | undefined {
  return typeof input === "number" && Number.isFinite(input) ? input : undefined
}

function asBoolean(input: unknown): boolean | undefined {
  return typeof input === "boolean" ? input : undefined
}

function unavailable(toolName: string): string {
  const baseUrl = (process.env["FESTIVUS_DATASET_API_URL"] ?? "http://localhost:8000").replace(/\/$/, "")
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(baseUrl)
  const hint = isLocal
    ? `Could not reach the dataset API at ${baseUrl}. The local api worker isn't running — start \`pnpm dev\` from the repo root (not apps/web/), which boots both web and api under one process tree. Or set FESTIVUS_DATASET_API_URL=https://festivus-data.hapticlabs.ai in apps/web/.env.local to use the deployed dataset instead.`
    : `Could not reach the dataset API at ${baseUrl}. Likely a transient upstream outage — ask the user to retry in a moment.`
  return JSON.stringify({
    error: "data_unavailable",
    tool: toolName,
    base_url: baseUrl,
    hint,
    message:
      "The Festivus data API is unreachable or returned an unexpected shape. Fall back to the seed data in the system prompt, or tell the user this is a known data gap.",
  })
}

interface ICallApiToolOptions {
  client?: IFestivusClient
}

/**
 * Dispatch an API tool call to the festivus client and return a stringified
 * payload suitable for inclusion in a `tool_result` message.
 */
export async function callApiTool(
  name: string,
  input: Record<string, unknown>,
  options: ICallApiToolOptions = {},
): Promise<string> {
  const client = options.client ?? new FestivusClient()
  const limit = clampLimit(input["limit"])

  switch (name) {
    case "search_robots": {
      const results = await client.searchRobots({
        type: asString(input["type"]),
        manufacturer: asString(input["manufacturer"]),
        price_min: asNumber(input["price_min"]),
        price_max: asNumber(input["price_max"]),
        has_policies: asBoolean(input["has_policies"]),
        q: asString(input["q"]),
        limit,
      })
      if (results === null) return unavailable(name)
      return JSON.stringify({ count: results.length, results })
    }

    case "search_policies": {
      const results = await client.searchPolicies({
        robot: asString(input["robot"]),
        skill: asString(input["skill"]),
        evidence: asString(input["evidence"]),
        framework: asString(input["framework"]),
        q: asString(input["q"]),
        limit,
      })
      if (results === null) return unavailable(name)
      return JSON.stringify({ count: results.length, results })
    }

    case "search_compatibility": {
      const results = await client.searchCompatibility({
        robot: asString(input["robot"]),
        policy: asString(input["policy"]),
        status: asString(input["status"]),
        source: asString(input["source"]),
        limit,
      })
      if (results === null) return unavailable(name)
      return JSON.stringify({ count: results.length, results })
    }

    case "search_tasks": {
      const results = await client.searchTasks({
        category: asString(input["category"]),
        difficulty: asString(input["difficulty"]),
        robot_type: asString(input["robot_type"]),
        q: asString(input["q"]),
        limit,
      })
      if (results === null) return unavailable(name)
      return JSON.stringify({ count: results.length, results })
    }

    case "get_robot_full": {
      const slug = asString(input["slug"])
      if (slug === undefined) {
        return JSON.stringify({ error: "missing_slug", message: "get_robot_full requires a slug" })
      }
      const result = await client.getRobotFull(slug)
      if (result === null) return unavailable(name)
      return JSON.stringify(result)
    }

    case "find_gaps": {
      const domain = asString(input["domain"])
      if (domain === undefined) {
        return JSON.stringify({ error: "missing_domain", message: "find_gaps requires a domain" })
      }
      // Implemented as composed queries against the same client. Each branch
      // is a small heuristic that returns up to `limit` records.
      switch (domain) {
        case "robots-without-policies": {
          const robots = await client.searchRobots({ has_policies: false, limit })
          if (robots === null) return unavailable(name)
          return JSON.stringify({ domain, count: robots.length, results: robots })
        }
        case "tasks-without-data": {
          const tasks = await client.searchTasks({ limit: MAX_LIMIT })
          if (tasks === null) return unavailable(name)
          const gapped = tasks.filter((t) => t.compatible_policy_slugs.length === 0).slice(0, limit)
          return JSON.stringify({ domain, count: gapped.length, results: gapped })
        }
        case "untested-edges": {
          const edges = await client.searchCompatibility({ status: "untested", limit })
          if (edges === null) return unavailable(name)
          return JSON.stringify({ domain, count: edges.length, results: edges })
        }
        default:
          return JSON.stringify({ error: "unknown_domain", domain })
      }
    }

    default:
      return JSON.stringify({ error: "unknown_tool", tool: name })
  }
}
