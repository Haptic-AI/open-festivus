/**
 * Filters for SSE stream text to prevent tool call JSON from leaking into the sidebar.
 * Extracted for testability — this is the most common visual bug in the workbench.
 */

const TOOL_NAMES = ["add_node", "show_agent_message", "set_canvas_status", "update_node", "connect_nodes", "ask_user", "update_recipe"]
const TOOL_NAME_PATTERN = new RegExp(`"name"\\s*:\\s*"(${TOOL_NAMES.join("|")})"`, "g")

/** Strip tool-call-like content from streaming text accumulator */
export function cleanStreamingText(text: string): string {
  return text
    .replace(/\[tool:.*?\]/g, "")
    .replace(/"tool_use"/g, "")
    .replace(TOOL_NAME_PATTERN, "")
    .trim()
}

/** Check if a full text block contains tool JSON that should not be shown */
export function isToolText(text: string): boolean {
  return text.includes("[tool:") || text.includes('"tool_use"') || text.includes('"name":"add_node"')
}

/** Check if a sidebar message contains leaked tool JSON */
export function containsLeakedToolJson(message: string): boolean {
  if (message.includes("[tool:")) return true
  if (message.includes('"tool_use"')) return true
  for (const name of TOOL_NAMES) {
    if (message.includes(`"name":"${name}"`)) return true
  }
  return false
}
