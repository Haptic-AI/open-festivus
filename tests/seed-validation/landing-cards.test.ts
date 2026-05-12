import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

// Read the workbench canvas source to extract landing card data
const canvasSource = readFileSync(
  join(__dirname, "../../apps/web/src/app/workbench/workbench-canvas.tsx"),
  "utf-8",
)

// Extract all prompt strings from landing cards
const promptMatches = canvasSource.match(/prompt: "([^"]+)"/g) ?? []
const prompts = promptMatches.map((m) => m.replace(/prompt: "/, "").replace(/"$/, ""))

// Extract all card titles
const titleMatches = canvasSource.match(/title: "([^"]+)"/g) ?? []
const titles = titleMatches.map((m) => m.replace(/title: "/, "").replace(/"$/, ""))

// Extract all card IDs
const idMatches = canvasSource.match(/id: "([^"]+)"/g) ?? []

// Extract group labels
const groupLabelMatches = canvasSource.match(/label: "([^"]+)", cards:/g) ?? []
const groupLabels = groupLabelMatches.map((m) => m.replace(/label: "/, "").replace(/", cards:/, ""))

describe("landing cards", () => {
  it("has at least 15 cards", () => {
    expect(prompts.length).toBeGreaterThanOrEqual(15)
  })

  it("every card with a prompt has non-empty text", () => {
    for (const p of prompts) {
      expect(p.trim().length).toBeGreaterThan(5)
    }
  })

  it("no duplicate prompts", () => {
    expect(new Set(prompts).size).toBe(prompts.length)
  })

  it("no duplicate titles", () => {
    // Filter to landing card titles (inside GROUPS definition)
    expect(new Set(titles).size).toBe(titles.length)
  })

  it("has all 5 groups", () => {
    expect(groupLabels).toContain("I Have a Task")
    expect(groupLabels).toContain("I Have a Robot")
    expect(groupLabels).toContain("I Have a Policy")
    expect(groupLabels).toContain("Explore by Capability")
    expect(groupLabels).toContain("Advanced")
  })

  it("Create My Own card has no prompt (focuses prompt bar instead)", () => {
    // The create card should NOT appear in prompts
    const createPrompt = prompts.find((p) => p.toLowerCase().includes("create my own"))
    expect(createPrompt).toBeUndefined()
  })

  it("Create My Own card has dashed border", () => {
    expect(canvasSource).toContain('id: "create"')
    expect(canvasSource).toContain("dashed: true")
  })
})
