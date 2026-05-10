import { describe, expect, it } from "vitest"
import { validatePatch } from "./patch-schemas.js"

// Spec 029 Step 2.2. Per-table Zod schemas must:
//   (a) accept allowlisted ✅ fields
//   (b) reject name, slug, hf_* prefixed, and array fields with
//       field_not_agent_editable
//   (c) reject truly-unknown fields with the same shape
//       (translated from Zod's unrecognized_keys)
describe("validatePatch: per-table allowlist (spec 029)", () => {
  describe("robots", () => {
    it("accepts an allowed scalar (weight_kg)", () => {
      const r = validatePatch("robots", { weight_kg: 89 })
      expect(r.valid).toBe(true)
      expect(r.data).toEqual({ weight_kg: 89 })
    })

    it("accepts manufacturer (borderline ✅ per allowlist)", () => {
      const r = validatePatch("robots", { manufacturer: "Boston Dynamics" })
      expect(r.valid).toBe(true)
    })

    it("rejects name with field_not_agent_editable", () => {
      const r = validatePatch("robots", { name: "Spot Mini" })
      expect(r.valid).toBe(false)
      expect(r.field_rejections).toContainEqual({
        code: "field_not_agent_editable",
        field: "name",
        table: "robots",
      })
    })

    it("rejects compatible_policy_slugs (array)", () => {
      const r = validatePatch("robots", { compatible_policy_slugs: ["foo"] })
      expect(r.valid).toBe(false)
      expect(r.field_rejections?.[0]?.field).toBe("compatible_policy_slugs")
    })

    it("rejects sensors (array)", () => {
      const r = validatePatch("robots", { sensors: ["lidar"] })
      expect(r.valid).toBe(false)
      expect(r.field_rejections?.[0]?.field).toBe("sensors")
    })

    it("rejects build_paths (array of objects)", () => {
      const r = validatePatch("robots", { build_paths: [] })
      expect(r.valid).toBe(false)
      expect(r.field_rejections?.[0]?.field).toBe("build_paths")
    })

    it("rejects an unknown field", () => {
      const r = validatePatch("robots", { completely_made_up: "nope" })
      expect(r.valid).toBe(false)
      expect(r.field_rejections?.[0]?.field).toBe("completely_made_up")
    })

    it("reports type mismatches as errors, not field_rejections", () => {
      const r = validatePatch("robots", { weight_kg: "not a number" })
      expect(r.valid).toBe(false)
      expect(r.field_rejections).toBeUndefined()
      expect(r.errors).toBeDefined()
      expect(r.errors?.[0]).toContain("weight_kg")
    })
  })

  describe("policies", () => {
    it("accepts license", () => {
      const r = validatePatch("policies", { license: "MIT" })
      expect(r.valid).toBe(true)
    })

    it("rejects hf_repo_id (hf_* identifier)", () => {
      const r = validatePatch("policies", { hf_repo_id: "foo/bar" })
      expect(r.valid).toBe(false)
      expect(r.field_rejections?.[0]?.field).toBe("hf_repo_id")
    })

    it("rejects action_space (nested object)", () => {
      const r = validatePatch("policies", { action_space: { type: "box", dimensions: 7, frequency_hz: 30 } })
      expect(r.valid).toBe(false)
      expect(r.field_rejections?.[0]?.field).toBe("action_space")
    })
  })

  describe("datasets", () => {
    it("accepts episodes", () => {
      const r = validatePatch("datasets", { episodes: 500 })
      expect(r.valid).toBe(true)
    })

    it("rejects hf_dataset_id", () => {
      const r = validatePatch("datasets", { hf_dataset_id: "lerobot/example" })
      expect(r.valid).toBe(false)
      expect(r.field_rejections?.[0]?.field).toBe("hf_dataset_id")
    })
  })

  describe("benchmarks", () => {
    it("accepts difficulty", () => {
      const r = validatePatch("benchmarks", { difficulty: "hard" })
      expect(r.valid).toBe(true)
    })

    it("rejects linked_policy_slugs (array)", () => {
      const r = validatePatch("benchmarks", { linked_policy_slugs: ["x"] })
      expect(r.valid).toBe(false)
      expect(r.field_rejections?.[0]?.field).toBe("linked_policy_slugs")
    })
  })

  describe("deploy_notes", () => {
    it("accepts severity", () => {
      const r = validatePatch("deploy_notes", { severity: "warning" })
      expect(r.valid).toBe(true)
    })

    it("rejects name", () => {
      const r = validatePatch("deploy_notes", { name: "x" })
      expect(r.valid).toBe(false)
      expect(r.field_rejections?.[0]?.field).toBe("name")
    })
  })

  describe("environments", () => {
    it("accepts simulator", () => {
      const r = validatePatch("environments", { simulator: "MuJoCo" })
      expect(r.valid).toBe(true)
    })

    it("rejects conditions (nested object)", () => {
      const r = validatePatch("environments", { conditions: {} })
      expect(r.valid).toBe(false)
      expect(r.field_rejections?.[0]?.field).toBe("conditions")
    })
  })

  describe("tasks", () => {
    it("accepts difficulty", () => {
      const r = validatePatch("tasks", { difficulty: "medium" })
      expect(r.valid).toBe(true)
    })

    it("rejects required_capabilities (array)", () => {
      const r = validatePatch("tasks", { required_capabilities: [] })
      expect(r.valid).toBe(false)
      expect(r.field_rejections?.[0]?.field).toBe("required_capabilities")
    })
  })

  describe("papers", () => {
    it("accepts citations", () => {
      const r = validatePatch("papers", { citations: 42 })
      expect(r.valid).toBe(true)
    })

    it("rejects title (name-equivalent)", () => {
      const r = validatePatch("papers", { title: "A paper" })
      expect(r.valid).toBe(false)
      expect(r.field_rejections?.[0]?.field).toBe("title")
    })

    it("rejects authors (array)", () => {
      const r = validatePatch("papers", { authors: ["X"] })
      expect(r.valid).toBe(false)
      expect(r.field_rejections?.[0]?.field).toBe("authors")
    })
  })

  describe("hardware", () => {
    it("accepts manufacturer", () => {
      const r = validatePatch("hardware", { manufacturer: "Intel" })
      expect(r.valid).toBe(true)
    })

    it("rejects specs (nested record)", () => {
      const r = validatePatch("hardware", { specs: { ram: "16gb" } })
      expect(r.valid).toBe(false)
      expect(r.field_rejections?.[0]?.field).toBe("specs")
    })
  })

  describe("compatibility_edges", () => {
    it("accepts success_rate", () => {
      const r = validatePatch("compatibility_edges", { success_rate: 0.75 })
      expect(r.valid).toBe(true)
    })

    it("rejects robot_slug (*_slug)", () => {
      const r = validatePatch("compatibility_edges", { robot_slug: "atlas" })
      expect(r.valid).toBe(false)
      expect(r.field_rejections?.[0]?.field).toBe("robot_slug")
    })

    it("rejects updated_at (timestamp)", () => {
      const r = validatePatch("compatibility_edges", { updated_at: "2026-04-23" })
      expect(r.valid).toBe(false)
      expect(r.field_rejections?.[0]?.field).toBe("updated_at")
    })
  })

  describe("laundry_compat_edges", () => {
    it("accepts notes", () => {
      const r = validatePatch("laundry_compat_edges", { notes: "works" })
      expect(r.valid).toBe(true)
    })

    it("rejects policy_name (name)", () => {
      const r = validatePatch("laundry_compat_edges", { policy_name: "Laundry v2" })
      expect(r.valid).toBe(false)
      expect(r.field_rejections?.[0]?.field).toBe("policy_name")
    })
  })

  it("strips id and slug silently (pre-existing guard)", () => {
    const r = validatePatch("robots", { id: 1, slug: "atlas", weight_kg: 89 })
    expect(r.valid).toBe(true)
    expect(r.data).toEqual({ weight_kg: 89 })
  })
})
