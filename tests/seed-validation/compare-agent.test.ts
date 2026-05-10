/**
 * Compare agent tests (Step 3.3).
 *
 * Verifies the structured-diff helpers used by shapes 18 (RxR→C) and
 * 19 (PxP→C). The plan calls for "Unit test: compare('franka-panda',
 * 'ur5e') → structured diff" — done plus a handful of axis-level
 * assertions and a self-comparison guard.
 */

import { describe, expect, it } from "vitest"
import { compareRobots, comparePolicies } from "@/lib/agent/compare"
import type { IPolicy, IRobot } from "@festivus/types"

const franka: IRobot = {
  id: "r1",
  slug: "franka-panda",
  name: "Franka Panda",
  manufacturer: "Franka Robotics",
  type: "arm",
  dof: 7,
  sensors: ["joint encoders", "torque sensors"],
  actuators: "torque-controlled",
  price_usd: 35000,
  weight_kg: 18,
  build_paths: [{ path: "buy", cost_usd: 35000, build_time_days: 30, purchase_url: "https://franka.de" }],
  deploy_readiness: "ce_marked",
  compatible_policy_slugs: ["diffusion-policy-pusht", "octo-base", "rt-1"],
  compatible_env_slugs: ["tabletop-clean"],
  image_url: "https://example.com/franka.png",
  community_size: "large",
  description: "7-DoF torque-controlled arm.",
  taxonomy: {
    embodiment: "manipulator",
    mobility: "fixed",
    actuation: "electric_geared",
    control_interfaces: ["joint_position", "joint_torque", "cartesian_pose"],
    perception: ["proprioception", "force_torque"],
    deployment_context: { autonomy: ["shared_autonomy"], industry: ["research"] },
  },
}

const ur5e: IRobot = {
  id: "r2",
  slug: "ur5e",
  name: "UR5e",
  manufacturer: "Universal Robots",
  type: "arm",
  dof: 6,
  sensors: ["joint encoders", "F/T sensor"],
  actuators: "brushless DC + harmonic drive",
  price_usd: 30000,
  weight_kg: 20.6,
  build_paths: [{ path: "buy", cost_usd: 30000, build_time_days: 14, purchase_url: "https://ur.com" }],
  deploy_readiness: "ce_marked",
  compatible_policy_slugs: ["octo-base", "rt-1", "rt-2-x"],
  compatible_env_slugs: ["tabletop-clean", "tabletop-cluttered"],
  image_url: "https://example.com/ur5e.png",
  community_size: "large",
  description: "6-DoF collaborative arm.",
  taxonomy: {
    embodiment: "manipulator",
    mobility: "fixed",
    actuation: "electric_geared",
    control_interfaces: ["joint_position", "cartesian_pose"],
    perception: ["proprioception", "force_torque"],
    deployment_context: { autonomy: ["shared_autonomy"], industry: ["manufacturing"] },
  },
}

describe("compareRobots — franka-panda vs ur5e (the spec's canonical test)", () => {
  const result = compareRobots(franka, ur5e)

  it("returns the names and slugs on left/right", () => {
    expect(result.left).toEqual({ slug: "franka-panda", name: "Franka Panda" })
    expect(result.right).toEqual({ slug: "ur5e", name: "UR5e" })
  })

  it("includes Price as an axis where lower wins (UR5e is cheaper)", () => {
    const price = result.axes.find((a) => a.label === "Price (USD)")
    expect(price).toBeDefined()
    expect(price?.leftValue).toBe(35000)
    expect(price?.rightValue).toBe(30000)
    expect(price?.winner).toBe("right")
  })

  it("includes Degrees of freedom where higher wins (Franka has more)", () => {
    const dof = result.axes.find((a) => a.label === "Degrees of freedom")
    expect(dof?.winner).toBe("left")
  })

  it("includes Weight where lower wins (Franka is lighter)", () => {
    const w = result.axes.find((a) => a.label === "Weight (kg)")
    expect(w?.winner).toBe("left")
  })

  it("includes Compatible policies as a list overlap with the shared+only-X breakdown", () => {
    const axis = result.axes.find((a) => a.label === "Compatible policies")
    expect(axis).toBeDefined()
    expect(axis?.note).toContain("shared")
    expect(axis?.note).toContain("octo-base")
    expect(axis?.note).toContain("rt-1")
  })

  it("includes taxonomy axes when both robots have taxonomy populated", () => {
    const labels = result.axes.map((a) => a.label)
    expect(labels).toContain("Embodiment")
    expect(labels).toContain("Mobility")
    expect(labels).toContain("Control interfaces")
  })

  it("control interfaces axis surfaces the joint_torque difference (Franka only)", () => {
    const axis = result.axes.find((a) => a.label === "Control interfaces")
    expect(axis?.note).toContain("only left: joint_torque")
  })

  it("summary mentions which robot is cheaper", () => {
    expect(result.summary.toLowerCase()).toContain("cheaper")
    expect(result.summary).toContain("UR5e")
  })

  it("summary mentions which robot has more DoF", () => {
    expect(result.summary).toContain("Franka")
    expect(result.summary).toContain("DoF")
  })
})

describe("compareRobots — defensive", () => {
  it("throws when comparing a robot to itself (almost always a bug)", () => {
    expect(() => compareRobots(franka, franka)).toThrow(/itself/)
  })

  it("handles a robot with no taxonomy (skips taxonomy axes)", () => {
    const noTax: IRobot = { ...franka, taxonomy: undefined }
    const result = compareRobots(noTax, ur5e)
    const labels = result.axes.map((a) => a.label)
    expect(labels).not.toContain("Embodiment")
  })

  it("handles null numeric fields without crashing", () => {
    const partial: IRobot = { ...franka, slug: "partial", price_usd: null, dof: null, weight_kg: null }
    const result = compareRobots(partial, ur5e)
    const price = result.axes.find((a) => a.label === "Price (USD)")
    expect(price?.winner).toBe("n/a")
  })
})

// ── Policy compare ────────────────────────────────────────────────

const act: IPolicy = {
  id: "p1",
  slug: "act-aloha-sim-transfer-cube",
  name: "ACT (Action Chunking Transformer)",
  author: "Tony Z. Zhao",
  framework: "PyTorch",
  license: "mit",
  task_description: "Bimanual transfer.",
  skill_type: "manipulation",
  action_space: { type: "joint-position", dimensions: 14, frequency_hz: 50 },
  observation_space: { type: "image+state", components: ["rgb", "joint_pos"] },
  compatible_robot_slugs: ["aloha-2"],
  compatible_env_slugs: ["mujoco-aloha-bimanual"],
  benchmarks: [{ robot: "ALOHA 2", environment: "sim", success_rate: 0.96, episodes: 500 }],
  hf_repo_id: "lerobot/act_aloha",
  paper_arxiv_url: "https://arxiv.org/abs/2304.13705",
  evidence_level: "verified",
  taxonomy: {
    required_control: ["joint_position"],
    required_perception: ["proprioception", "monocular_rgb"],
    action_dimensions: 14,
  },
}

const diffusion: IPolicy = {
  id: "p2",
  slug: "diffusion-policy-pusht",
  name: "Diffusion Policy (PushT)",
  author: "Cheng Chi",
  framework: "PyTorch",
  license: "mit",
  task_description: "PushT visuomotor.",
  skill_type: "manipulation",
  action_space: { type: "ee-pose", dimensions: 2, frequency_hz: 10 },
  observation_space: { type: "image", components: ["rgb"] },
  compatible_robot_slugs: ["franka-panda"],
  compatible_env_slugs: ["tabletop-clean"],
  benchmarks: [{ robot: "Franka Panda", environment: "real", success_rate: 0.91, episodes: 200 }],
  hf_repo_id: "lerobot/diffusion_pusht",
  paper_arxiv_url: "https://arxiv.org/abs/2303.04137",
  evidence_level: "verified",
  taxonomy: {
    required_control: ["cartesian_pose"],
    required_perception: ["monocular_rgb"],
    action_dimensions: 2,
  },
}

describe("comparePolicies — ACT vs Diffusion Policy", () => {
  const result = comparePolicies(act, diffusion)

  it("returns names + slugs", () => {
    expect(result.left.slug).toBe("act-aloha-sim-transfer-cube")
    expect(result.right.slug).toBe("diffusion-policy-pusht")
  })

  it("includes action dimensions where higher wins", () => {
    const axis = result.axes.find((a) => a.label === "Action dimensions")
    expect(axis?.winner).toBe("left")  // ACT has 14, Diffusion has 2
  })

  it("includes best benchmark success rate", () => {
    const axis = result.axes.find((a) => a.label === "Best benchmark success rate")
    expect(axis?.leftValue).toBe(0.96)
    expect(axis?.rightValue).toBe(0.91)
    expect(axis?.winner).toBe("left")
  })

  it("includes required_control axis when both policies have taxonomy", () => {
    const axis = result.axes.find((a) => a.label === "Required control")
    expect(axis).toBeDefined()
    expect(axis?.note).toContain("only left: joint_position")
    expect(axis?.note).toContain("only right: cartesian_pose")
  })

  it("includes Compatible robots axis", () => {
    const axis = result.axes.find((a) => a.label === "Compatible robots")
    expect(axis).toBeDefined()
    expect(axis?.note).toContain("only left: aloha-2")
    expect(axis?.note).toContain("only right: franka-panda")
  })

  it("summary highlights the higher benchmark rate", () => {
    expect(result.summary).toContain("ACT")
    expect(result.summary).toMatch(/96/)
  })

  it("summary notes there are no shared robots", () => {
    expect(result.summary.toLowerCase()).toContain("no robot overlap")
  })
})

describe("comparePolicies — defensive", () => {
  it("throws when comparing a policy to itself", () => {
    expect(() => comparePolicies(act, act)).toThrow(/itself/)
  })
})
