/**
 * Task entity tests.
 *
 * Tasks are first-class in every question shape (T→R, T→P, T→D, X→X, etc.).
 * The 15 curated tasks in `data/tasks.json` reference
 * compatible_robot_types (a strict enum) and compatible_policy_slugs (free-form
 * slugs that may live in either the curated or bulk policy file).
 *
 * The Zod schema enforces:
 *   - difficulty in {easy, medium, hard, unsolved}
 *   - category in skill_type enum
 *   - compatible_robot_types are valid IRobotType values
 *
 * Cross-ref check: every compatible_policy_slug should be a non-empty string.
 * (Whether the slug actually resolves in the policy data is enforced by the
 * Pydantic test_crossrefs.py on the data side, not here.)
 */

import { describe, expect, it } from "vitest"
import { parseTasks, taskSchema } from "@/lib/schemas/domain"

const validTask = {
  id: "t1",
  slug: "pick-and-place",
  name: "Pick and Place",
  category: "manipulation",
  description: "Grasp an object and place it elsewhere.",
  sub_tasks: ["detect-object", "plan-grasp", "execute-grasp", "place-at-target"],
  required_capabilities: ["vision", "grasp-planning"],
  compatible_robot_types: ["arm", "dual-arm"],
  compatible_policy_slugs: ["octo-base", "rt-1", "diffusion-policy-robomimic-can"],
  difficulty: "easy",
  has_real_world_demo: true,
}

const locomotionTask = {
  id: "t6",
  slug: "walk-flat-terrain",
  name: "Walk on Flat Terrain",
  category: "locomotion",
  description: "Stable walking on flat ground.",
  sub_tasks: ["balance", "gait-generation"],
  required_capabilities: ["proprioception", "balance-control"],
  compatible_robot_types: ["quadruped", "humanoid"],
  compatible_policy_slugs: ["walk-these-ways-go2", "g1-whole-body-control"],
  difficulty: "easy",
  has_real_world_demo: true,
}

const unsolvedTask = {
  id: "t12",
  slug: "whole-body-locomotion",
  name: "Humanoid Whole-Body Locomotion",
  category: "locomotion",
  description: "Bipedal walking with whole-body balance.",
  sub_tasks: ["balance-standing", "step-generation"],
  required_capabilities: ["proprioception", "whole-body-control"],
  compatible_robot_types: ["humanoid"],
  compatible_policy_slugs: ["g1-whole-body-control"],
  difficulty: "unsolved",
  has_real_world_demo: true,
}

describe("taskSchema", () => {
  it("accepts a curated manipulation task", () => {
    const result = taskSchema.safeParse(validTask)
    expect(result.success).toBe(true)
  })

  it("accepts a locomotion task", () => {
    const result = taskSchema.safeParse(locomotionTask)
    expect(result.success).toBe(true)
  })

  it("accepts the unsolved difficulty value", () => {
    const result = taskSchema.safeParse(unsolvedTask)
    expect(result.success).toBe(true)
  })

  it("accepts a task with empty compatible_policy_slugs (no policy yet exists)", () => {
    const result = taskSchema.safeParse({ ...validTask, compatible_policy_slugs: [] })
    expect(result.success).toBe(true)
  })

  it("rejects an unknown difficulty value", () => {
    const result = taskSchema.safeParse({ ...validTask, difficulty: "trivial" })
    expect(result.success).toBe(false)
  })

  it("rejects an unknown category value", () => {
    const result = taskSchema.safeParse({ ...validTask, category: "cooking" })
    expect(result.success).toBe(false)
  })

  it("rejects an unknown compatible_robot_types value", () => {
    const result = taskSchema.safeParse({ ...validTask, compatible_robot_types: ["spider"] })
    expect(result.success).toBe(false)
  })

  it("rejects a task missing the slug field", () => {
    const broken = { ...validTask } as Record<string, unknown>
    delete broken["slug"]
    const result = taskSchema.safeParse(broken)
    expect(result.success).toBe(false)
  })

  it("rejects a task where has_real_world_demo is not a boolean", () => {
    const result = taskSchema.safeParse({ ...validTask, has_real_world_demo: "yes" })
    expect(result.success).toBe(false)
  })
})

describe("parseTasks (list helper)", () => {
  it("parses a list of valid tasks", () => {
    const parsed = parseTasks([validTask, locomotionTask, unsolvedTask])
    expect(parsed).not.toBeNull()
    expect(parsed?.length).toBe(3)
  })

  it("returns null when any task in the list is malformed", () => {
    const parsed = parseTasks([validTask, { ...locomotionTask, difficulty: "trivial" }])
    expect(parsed).toBeNull()
  })

  it("every parsed task has non-empty slug and at least one compatible robot type", () => {
    const parsed = parseTasks([validTask, locomotionTask, unsolvedTask])
    expect(parsed).not.toBeNull()
    for (const task of parsed ?? []) {
      expect(task.slug.length).toBeGreaterThan(0)
      expect(task.compatible_robot_types.length).toBeGreaterThan(0)
    }
  })

  it("every compatible_policy_slug is a non-empty string", () => {
    const parsed = parseTasks([validTask, locomotionTask, unsolvedTask])
    for (const task of parsed ?? []) {
      for (const slug of task.compatible_policy_slugs) {
        expect(typeof slug).toBe("string")
        expect(slug.length).toBeGreaterThan(0)
      }
    }
  })
})
