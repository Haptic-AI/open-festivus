/**
 * API-level fallbacks that fire when the LLM fails to call required tools.
 * Extracted to a module for testability.
 */

export function buildFallbackAskUser(nodeTypes: string[], nodeNames: string[]): Record<string, unknown> {
  const options: string[] = []
  const primaryType = nodeTypes.find((t) => t === "robot" || t === "policy" || t === "environment") ?? "option"

  if (primaryType === "robot" && nodeNames.length > 0) {
    options.push(`Select ${nodeNames[0]} and find compatible policies`)
    if (nodeNames.length > 1) {
      options.push(`${nodeNames[0]} vs ${nodeNames[1]} — which is better for my use case?`)
    }
    options.push("What are the deployment and safety considerations?")
    options.push("Just pick the best one and move forward")
  } else if (primaryType === "policy" && nodeNames.length > 0) {
    options.push(`Select ${nodeNames[0]} and set up a simulation`)
    options.push("How do these benchmark scores translate to real-world performance?")
    options.push("What training data do I need for fine-tuning?")
    options.push("Just pick the best one and move forward")
  } else if (primaryType === "environment" && nodeNames.length > 0) {
    options.push(`Select ${nodeNames[0]} and run evaluation`)
    options.push("What are the sim-to-real transfer risks?")
    options.push("Just pick the best one and move forward")
  } else {
    options.push("Tell me more about the trade-offs")
    options.push("What should I consider before deciding?")
    options.push("Just pick the best one and move forward")
  }

  return {
    type: "tool_call",
    name: "ask_user",
    input: {
      question: "What would you like to do next?",
      options,
      allow_freeform: true,
    },
  }
}

export function buildFallbackDeployment(nodeNames: string[]): Record<string, unknown> {
  const robotList = nodeNames.length > 0 ? nodeNames.join(", ") : "the suggested robots"
  return {
    type: "tool_call",
    name: "show_agent_message",
    input: {
      specialist: "deployment",
      message: `Safety note for ${robotList}: check deployment readiness and safety certifications before real-world use. Most low-cost arms are lab-only with no safety certification.`,
      thinking: "API fallback: deployment annotation was missing after robot nodes were added.",
    },
  }
}

export function buildFallbackHardwareSummary(nodeNames: string[]): Record<string, unknown> {
  const count = nodeNames.length
  const list = count > 0 ? nodeNames.join(", ") : "the selected hardware"
  const message = count === 0
    ? "I looked at the dataset for robots that could handle this task. See the options in the canvas."
    : count === 1
      ? `I surfaced ${list} from the dataset. It's lab-only hardware, so plan on significant integration work before you can run real experiments.`
      : `I compared ${list} from the dataset. They're all lab-only research platforms — expect integration effort and lean toward the one with the most documented policies for your target task.`
  return {
    type: "tool_call",
    name: "show_agent_message",
    input: {
      specialist: "hardware",
      message,
      thinking: "API fallback: hardware summary was missing after robot nodes were added.",
    },
  }
}
