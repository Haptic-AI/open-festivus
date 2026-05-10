import { describe, expect, it } from "vitest"
import { AGENT_TOOLS } from "../../apps/web/src/lib/agent/tools"

describe("tool definitions", () => {
  it("defines all expected tools", () => {
    const names = AGENT_TOOLS.map((t) => t.name)
    expect(names).toContain("add_node")
    expect(names).toContain("update_node")
    expect(names).toContain("connect_nodes")
    expect(names).toContain("show_agent_message")
    expect(names).toContain("set_canvas_status")
    expect(names).toContain("ask_user")
    expect(names).toContain("update_recipe")
  })

  it("show_agent_message specialist enum includes task", () => {
    const tool = AGENT_TOOLS.find((t) => t.name === "show_agent_message")
    const specialistProp = (tool?.input_schema as Record<string, unknown>)["properties"] as Record<string, Record<string, unknown>>
    const specialistEnum = specialistProp["specialist"]["enum"] as string[]
    expect(specialistEnum).toContain("task")
    expect(specialistEnum).toContain("hardware")
    expect(specialistEnum).toContain("policy")
    expect(specialistEnum).toContain("simulation")
    expect(specialistEnum).toContain("community")
    expect(specialistEnum).toContain("deployment")
  })

  it("set_canvas_status specialist enum includes task", () => {
    const tool = AGENT_TOOLS.find((t) => t.name === "set_canvas_status")
    const specialistProp = (tool?.input_schema as Record<string, unknown>)["properties"] as Record<string, Record<string, unknown>>
    const specialistEnum = specialistProp["specialist"]["enum"] as string[]
    expect(specialistEnum).toContain("task")
  })

  it("add_node has all required node types", () => {
    const tool = AGENT_TOOLS.find((t) => t.name === "add_node")
    const props = (tool?.input_schema as Record<string, unknown>)["properties"] as Record<string, Record<string, unknown>>
    const nodeTypes = props["node_type"]["enum"] as string[]
    expect(nodeTypes).toContain("robot")
    expect(nodeTypes).toContain("task")
    expect(nodeTypes).toContain("policy")
    expect(nodeTypes).toContain("environment")
  })

  it("ask_user has options and allow_freeform fields", () => {
    const tool = AGENT_TOOLS.find((t) => t.name === "ask_user")
    const props = (tool?.input_schema as Record<string, unknown>)["properties"] as Record<string, unknown>
    expect(props).toHaveProperty("question")
    expect(props).toHaveProperty("options")
    expect(props).toHaveProperty("allow_freeform")
  })

  it("every tool has a description", () => {
    for (const tool of AGENT_TOOLS) {
      expect(tool.description.length).toBeGreaterThan(10)
    }
  })
})
