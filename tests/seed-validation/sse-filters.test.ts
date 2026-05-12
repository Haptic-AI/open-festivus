import { describe, expect, it } from "vitest"
import {
  cleanStreamingText,
  isToolText,
  containsLeakedToolJson,
} from "../../apps/web/src/lib/workbench/sse-filters"

describe("cleanStreamingText", () => {
  it("strips [tool:...] patterns", () => {
    const input = 'Here is my response [tool: add_node({"id":"robot1"})] and more text'
    expect(cleanStreamingText(input)).not.toContain("[tool:")
    expect(cleanStreamingText(input)).toContain("Here is my response")
  })

  it("strips tool_use JSON", () => {
    expect(cleanStreamingText('"tool_use" block here')).not.toContain("tool_use")
  })

  it("strips tool name patterns", () => {
    expect(cleanStreamingText('"name": "add_node"')).toBe("")
    expect(cleanStreamingText('"name":"show_agent_message"')).toBe("")
    expect(cleanStreamingText('"name": "set_canvas_status"')).toBe("")
  })

  it("preserves normal text", () => {
    expect(cleanStreamingText("Found 3 robots for your task")).toBe("Found 3 robots for your task")
  })

  it("handles empty string", () => {
    expect(cleanStreamingText("")).toBe("")
  })

  it("handles mixed content", () => {
    const input = 'Searching... "name": "add_node" more stuff [tool: set_canvas_status({})]'
    const result = cleanStreamingText(input)
    expect(result).not.toContain("add_node")
    expect(result).not.toContain("[tool:")
    expect(result).toContain("Searching...")
  })
})

describe("isToolText", () => {
  it("detects [tool: prefix", () => {
    expect(isToolText('[tool: add_node({"id":"1"})]')).toBe(true)
  })

  it("detects tool_use", () => {
    expect(isToolText('{"type":"tool_use","name":"add_node"}')).toBe(true)
  })

  it("detects add_node name", () => {
    expect(isToolText('"name":"add_node"')).toBe(true)
  })

  it("passes normal text", () => {
    expect(isToolText("Found 3 robots")).toBe(false)
  })
})

describe("containsLeakedToolJson", () => {
  it("catches [tool: in messages", () => {
    expect(containsLeakedToolJson("[tool: set_canvas_status({})]")).toBe(true)
  })

  it("catches all tool names", () => {
    expect(containsLeakedToolJson('"name":"show_agent_message"')).toBe(true)
    expect(containsLeakedToolJson('"name":"update_node"')).toBe(true)
    expect(containsLeakedToolJson('"name":"connect_nodes"')).toBe(true)
    expect(containsLeakedToolJson('"name":"ask_user"')).toBe(true)
    expect(containsLeakedToolJson('"name":"update_recipe"')).toBe(true)
  })

  it("passes clean agent messages", () => {
    expect(containsLeakedToolJson("ALOHA 2 ($21k) is the gold standard for bimanual folding.")).toBe(false)
    expect(containsLeakedToolJson("Found 3 policies. ACT has the best benchmark at 96%.")).toBe(false)
  })

  it("passes messages with 'tool' as a normal word", () => {
    expect(containsLeakedToolJson("This tool is useful for folding")).toBe(false)
  })
})
