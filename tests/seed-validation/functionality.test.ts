import { describe, expect, it } from "vitest"
import {
  buildFallbackAskUser,
  buildFallbackDeployment,
} from "../../apps/web/src/lib/agent/fallbacks"
import {
  computeCompatibility,
  normalizeSuccessRate,
  COMPAT_GREEN,
  COMPAT_AMBER,
  COMPAT_RED,
} from "../../apps/web/src/lib/workbench/compatibility"
import { buildSystemPrompt } from "../../apps/web/src/lib/agent/system-prompt"
import { AGENT_TOOLS } from "../../apps/web/src/lib/agent/tools"

// ── Fallback ask_user builder ───────────────────────────────────

describe("buildFallbackAskUser", () => {
  it("returns ask_user tool call shape", () => {
    const result = buildFallbackAskUser(["robot"], ["SO-100 ($110)"])
    expect(result["type"]).toBe("tool_call")
    expect(result["name"]).toBe("ask_user")
    const input = result["input"] as Record<string, unknown>
    expect(input["allow_freeform"]).toBe(true)
    expect(input["question"]).toBeDefined()
  })

  it("generates robot-specific options with names", () => {
    const result = buildFallbackAskUser(["task", "robot", "robot"], ["SO-100 ($110)", "Koch v1.1 ($250)"])
    const input = result["input"] as Record<string, unknown>
    const options = input["options"] as string[]
    expect(options.some((o) => o.includes("SO-100"))).toBe(true)
    expect(options.some((o) => o.includes("policies"))).toBe(true)
  })

  it("generates comparison option when 2+ robots", () => {
    const result = buildFallbackAskUser(["robot", "robot"], ["SO-100", "Koch v1.1"])
    const input = result["input"] as Record<string, unknown>
    const options = input["options"] as string[]
    expect(options.some((o) => o.includes("vs"))).toBe(true)
  })

  it("generates policy-specific options", () => {
    const result = buildFallbackAskUser(["policy"], ["ACT"])
    const input = result["input"] as Record<string, unknown>
    const options = input["options"] as string[]
    expect(options.some((o) => o.includes("ACT"))).toBe(true)
    expect(options.some((o) => o.includes("simulation"))).toBe(true)
  })

  it("generates environment-specific options", () => {
    const result = buildFallbackAskUser(["environment"], ["tabletop-clean"])
    const input = result["input"] as Record<string, unknown>
    const options = input["options"] as string[]
    expect(options.some((o) => o.includes("tabletop-clean"))).toBe(true)
  })

  it("generates generic options when no lane nodes", () => {
    const result = buildFallbackAskUser(["task"], [])
    const input = result["input"] as Record<string, unknown>
    const options = input["options"] as string[]
    expect(options.length).toBeGreaterThanOrEqual(2)
  })

  it("always includes catch-all as last option", () => {
    const result = buildFallbackAskUser(["robot"], ["SO-100"])
    const input = result["input"] as Record<string, unknown>
    const options = input["options"] as string[]
    const last = options[options.length - 1]
    expect(last).toContain("pick the best")
  })

  it("handles empty arrays gracefully", () => {
    const result = buildFallbackAskUser([], [])
    const input = result["input"] as Record<string, unknown>
    const options = input["options"] as string[]
    expect(options.length).toBeGreaterThanOrEqual(2)
  })
})

// ── Fallback deployment builder ─────────────────────────────────

describe("buildFallbackDeployment", () => {
  it("returns show_agent_message with deployment specialist", () => {
    const result = buildFallbackDeployment(["SO-100 ($110)"])
    expect(result["type"]).toBe("tool_call")
    expect(result["name"]).toBe("show_agent_message")
    const input = result["input"] as Record<string, unknown>
    expect(input["specialist"]).toBe("deployment")
  })

  it("includes robot names in the message", () => {
    const result = buildFallbackDeployment(["SO-100 ($110)", "Koch v1.1 ($250)"])
    const input = result["input"] as Record<string, unknown>
    const message = input["message"] as string
    expect(message).toContain("SO-100")
    expect(message).toContain("Koch v1.1")
  })

  it("uses generic text when no names provided", () => {
    const result = buildFallbackDeployment([])
    const input = result["input"] as Record<string, unknown>
    const message = input["message"] as string
    expect(message).toContain("suggested robots")
  })

  it("includes thinking field", () => {
    const result = buildFallbackDeployment(["SO-100"])
    const input = result["input"] as Record<string, unknown>
    expect(input["thinking"]).toBeDefined()
    expect(typeof input["thinking"]).toBe("string")
  })
})

// ── System prompt construction ──────────────────────────────────

describe("buildSystemPrompt", () => {
  const prompt = buildSystemPrompt("SEED_DATA_HERE", '{"nodes":[]}')

  it("does NOT splice the seedData arg into the output (Step 2.3 deleted that injection)", () => {
    expect(prompt).not.toContain("SEED_DATA_HERE")
  })

  it("includes project state in the output", () => {
    expect(prompt).toContain('"nodes":[]')
  })

  it("returns a non-empty string", () => {
    expect(prompt.length).toBeGreaterThan(1000)
  })

  it("names all 6 specialists by their lowercase slugs", () => {
    expect(prompt).toContain("task")
    expect(prompt).toContain("hardware")
    expect(prompt).toContain("policy")
    expect(prompt).toContain("simulation")
    expect(prompt).toContain("community")
    expect(prompt).toContain("deployment")
  })

  it("contains the never-go-silent rule (rule 10)", () => {
    expect(prompt).toMatch(/Never go silent|never go silent/i)
  })

  it("documents the API tool surface instead of an inlined slug list", () => {
    expect(prompt).toContain("search_robots")
    expect(prompt).toContain("search_policies")
    expect(prompt).not.toContain("Valid robot slugs:")
  })
})

// ── Tool definitions ────────────────────────────────────────────

describe("AGENT_TOOLS", () => {
  it("is an array of tool definitions", () => {
    expect(Array.isArray(AGENT_TOOLS)).toBe(true)
    expect(AGENT_TOOLS.length).toBeGreaterThanOrEqual(5)
  })

  it("every tool has name and input_schema", () => {
    for (const tool of AGENT_TOOLS) {
      expect(tool.name).toBeDefined()
      expect(typeof tool.name).toBe("string")
      expect(tool.input_schema).toBeDefined()
    }
  })

  it("has all required tools", () => {
    const names = AGENT_TOOLS.map((t) => t.name)
    expect(names).toContain("add_node")
    expect(names).toContain("update_node")
    expect(names).toContain("connect_nodes")
    expect(names).toContain("show_agent_message")
    expect(names).toContain("set_canvas_status")
    expect(names).toContain("ask_user")
  })

  it("add_node has node_type enum", () => {
    const addNode = AGENT_TOOLS.find((t) => t.name === "add_node")
    expect(addNode).toBeDefined()
    const schema = addNode!.input_schema as Record<string, unknown>
    const props = schema["properties"] as Record<string, unknown>
    const nodeType = props["node_type"] as Record<string, unknown>
    expect(nodeType["enum"]).toBeDefined()
    const enums = nodeType["enum"] as string[]
    expect(enums).toContain("robot")
    expect(enums).toContain("policy")
    expect(enums).toContain("environment")
  })
})

// ── Compatibility scoring (functional tests) ────────────────────

describe("compatibility scoring integration", () => {
  it("end-to-end: real seed-like data produces correct scores", () => {
    const actPolicy = {
      compatible_robot_slugs: ["aloha-2"],
      benchmarks: [
        { robot: "ALOHA 2", success_rate: 0.96, episodes: 500, environment: "sim" },
      ],
    }

    // Compatible robot with benchmark
    const aloha = computeCompatibility(actPolicy, "aloha-2", "ALOHA 2")
    expect(aloha.score).toBe(96)
    expect(aloha.color).toBe(COMPAT_GREEN)

    // Incompatible robot
    const so100 = computeCompatibility(actPolicy, "so-100", "SO-100")
    expect(so100.score).toBe(0)
    expect(so100.color).toBe(COMPAT_RED)
  })

  it("normalizeSuccessRate handles all seed data formats", () => {
    // Decimal format (most policies)
    expect(normalizeSuccessRate(0.96)).toBe(96)
    expect(normalizeSuccessRate(0.63)).toBe(63)
    // Already percentage (shouldn't happen but defensive)
    expect(normalizeSuccessRate(96)).toBe(96)
    // Edge: exactly 1.0
    expect(normalizeSuccessRate(1.0)).toBe(100)
    // Edge: 0
    expect(normalizeSuccessRate(0)).toBe(0)
  })

  it("amber zone boundaries are correct", () => {
    const policy = {
      compatible_robot_slugs: ["test"],
      benchmarks: [{ robot: "test", success_rate: 0.40, episodes: 100 }],
    }
    expect(computeCompatibility(policy, "test", "test").color).toBe(COMPAT_AMBER)

    policy.benchmarks[0]!.success_rate = 0.75
    expect(computeCompatibility(policy, "test", "test").color).toBe(COMPAT_AMBER)

    policy.benchmarks[0]!.success_rate = 0.76
    expect(computeCompatibility(policy, "test", "test").color).toBe(COMPAT_GREEN)

    policy.benchmarks[0]!.success_rate = 0.39
    expect(computeCompatibility(policy, "test", "test").color).toBe(COMPAT_RED)
  })
})
