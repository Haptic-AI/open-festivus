/**
 * Zod domain schema tests.
 *
 * The Festivus data API returns BOTH curated and bulk-scraped records in
 * the same list response. The Zod schemas in @/lib/schemas/domain must accept
 * both shapes or the agent will throw on every API call.
 *
 * Curated shape: hand-written, all fields populated, taxonomy=null.
 * Bulk shape:    HuggingFace-scraped, taxonomy object present, image_url
 *                / dof / price_usd / weight_kg / hf_repo_id may be null.
 *
 * These fixtures mirror real records from `data/*.json`. If
 * the wire format changes, update the fixtures here AND in the Zod schema.
 */

import { describe, expect, it } from "vitest"
import {
  compatibilityEdgeSchema,
  datasetSchema,
  deployNoteSchema,
  deploymentContextSchema,
  environmentSchema,
  paperSchema,
  parsePolicies,
  parseRobots,
  policySchema,
  robotSchema,
  taskSchema,
} from "@/lib/schemas/domain"

// ── Curated fixtures (hand-written records) ───────────────────────

const curatedRobot = {
  id: "r9",
  slug: "ur5e",
  name: "Universal Robots UR5e",
  manufacturer: "Universal Robots",
  type: "arm",
  dof: 6,
  sensors: ["Joint position encoders", "Built-in F/T sensor"],
  actuators: "6x brushless DC motors with harmonic drive gearing",
  price_usd: 35000,
  weight_kg: 20.6,
  build_paths: [{ path: "buy", cost_usd: 35000, build_time_days: 14, purchase_url: "https://example.com" }],
  deploy_readiness: "ce_marked",
  compatible_policy_slugs: ["octo-base", "rt-1"],
  compatible_env_slugs: ["tabletop-clean"],
  image_url: "https://example.com/ur5e.png",
  community_size: "large",
  description: "6-DoF collaborative arm.",
  taxonomy: null,
  product_page_url: "https://www.universal-robots.com/products/ur5e/",
  category: "Cobot arm / industrial",
  form_factor: "arm-fixed",
  price_availability: "public",
}

const curatedPolicy = {
  id: "p16",
  slug: "openvla-7b",
  name: "OpenVLA",
  author: "Stanford",
  framework: "PyTorch",
  license: "mit",
  task_description: "7B-parameter VLA.",
  skill_type: "manipulation",
  action_space: { type: "end-effector-pose", dimensions: 7, frequency_hz: 5 },
  observation_space: { type: "multimodal", components: ["primary_rgb", "language_instruction"] },
  compatible_robot_slugs: ["widowx-250", "franka-panda"],
  compatible_env_slugs: ["tabletop-clean"],
  benchmarks: [{ robot: "WidowX 250", environment: "real", success_rate: 0.72, episodes: 500 }],
  hf_repo_id: "openvla/openvla-7b",
  paper_arxiv_url: "https://arxiv.org/abs/2406.09246",
  evidence_level: "verified",
  taxonomy: null,
}

// ── Bulk fixtures (HF-scraped records) ────────────────────────────

const bulkRobot = {
  id: "rb1",
  slug: "agilex-piper",
  name: "Piper",
  manufacturer: "Agilex",
  type: "arm",
  dof: null,
  sensors: [],
  actuators: "See MuJoCo model XML",
  price_usd: null,
  weight_kg: null,
  build_paths: [],
  deploy_readiness: "lab_only",
  compatible_policy_slugs: ["openvla-openvla-7b"],
  compatible_env_slugs: [],
  image_url: null,
  community_size: "small",
  description: "Scraped from HuggingFace model card.",
  product_page_url: "https://www.agilex.ai/products/piper",
  category: "Cobot arm / industrial",
  form_factor: "arm-fixed",
  price_availability: "unknown",
  taxonomy: {
    embodiment: "manipulator",
    mobility: "fixed",
    actuation: "electric_geared",
    control_interfaces: ["joint_position", "cartesian_pose"],
    perception: ["monocular_rgb", "proprioception"],
    deployment_context: { autonomy: ["shared_autonomy"], industry: ["research"] },
  },
}

const bulkPolicy = {
  id: "pb1",
  slug: "openvla-openvla-7b",
  name: "openvla-7b",
  author: "openvla",
  framework: "PyTorch",
  license: "mit",
  task_description: "Policy model from openvla.",
  skill_type: "other",
  action_space: { type: "other", dimensions: null, frequency_hz: null },
  observation_space: { type: "other", components: [] },
  compatible_robot_slugs: ["agilex-piper"],
  compatible_env_slugs: [],
  benchmarks: [],
  hf_repo_id: null,
  paper_arxiv_url: null,
  evidence_level: "community",
  taxonomy: { required_control: ["learned_latent"], required_perception: ["proprioception"], action_dimensions: 0 },
}

// ── Robot schema ──────────────────────────────────────────────────

describe("robotSchema", () => {
  it("accepts a curated record (taxonomy=null, all fields populated)", () => {
    const result = robotSchema.safeParse(curatedRobot)
    expect(result.success).toBe(true)
  })

  it("accepts a bulk record (taxonomy=object, image_url=null, numeric fields=null)", () => {
    const result = robotSchema.safeParse(bulkRobot)
    expect(result.success).toBe(true)
  })

  it("accepts a record with taxonomy field omitted entirely", () => {
    const { taxonomy: _t, ...withoutTaxonomy } = curatedRobot
    const result = robotSchema.safeParse(withoutTaxonomy)
    expect(result.success).toBe(true)
  })

  it("rejects a record missing the slug field", () => {
    const { slug: _s, ...broken } = curatedRobot
    const result = robotSchema.safeParse(broken)
    expect(result.success).toBe(false)
  })

  it("rejects a record with an unknown deploy_readiness value", () => {
    const result = robotSchema.safeParse({ ...curatedRobot, deploy_readiness: "ul_listed" })
    expect(result.success).toBe(false)
  })

  it("accepts a bulk record with string-shaped deployment_context.autonomy/industry (Lesson 59)", () => {
    const stringShaped = {
      ...bulkRobot,
      taxonomy: {
        ...bulkRobot.taxonomy,
        deployment_context: { autonomy: "research", industry: "research" },
      },
    }
    const result = robotSchema.safeParse(stringShaped)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.taxonomy?.deployment_context.autonomy).toEqual(["research"])
      expect(result.data.taxonomy?.deployment_context.industry).toEqual(["research"])
    }
  })

  it("accepts a bulk record with array-shaped deployment_context.autonomy/industry", () => {
    const arrayShaped = {
      ...bulkRobot,
      taxonomy: {
        ...bulkRobot.taxonomy,
        deployment_context: {
          autonomy: ["shared_autonomy", "supervised"],
          industry: ["research", "manufacturing"],
        },
      },
    }
    const result = robotSchema.safeParse(arrayShaped)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.taxonomy?.deployment_context.autonomy).toEqual([
        "shared_autonomy",
        "supervised",
      ])
      expect(result.data.taxonomy?.deployment_context.industry).toEqual([
        "research",
        "manufacturing",
      ])
    }
  })

  it("rejects a record with the wrong type for build_paths", () => {
    const result = robotSchema.safeParse({ ...curatedRobot, build_paths: "buy" })
    expect(result.success).toBe(false)
  })
})

// ── deploymentContextSchema coercion (Lesson 59) ──────────────────

describe("deploymentContextSchema string->array coercion", () => {
  it("coerces a bare string autonomy into a single-element array", () => {
    const result = deploymentContextSchema.safeParse({
      autonomy: "research",
      industry: ["research"],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.autonomy).toEqual(["research"])
    }
  })

  it("coerces a bare string industry into a single-element array", () => {
    const result = deploymentContextSchema.safeParse({
      autonomy: ["shared_autonomy"],
      industry: "manufacturing",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.industry).toEqual(["manufacturing"])
    }
  })

  it("passes an already-array autonomy through unchanged", () => {
    const result = deploymentContextSchema.safeParse({
      autonomy: ["full_autonomy", "shared_autonomy"],
      industry: ["research"],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.autonomy).toEqual(["full_autonomy", "shared_autonomy"])
    }
  })

  it("passes an already-array industry through unchanged", () => {
    const result = deploymentContextSchema.safeParse({
      autonomy: ["research"],
      industry: ["research", "manufacturing"],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.industry).toEqual(["research", "manufacturing"])
    }
  })
})

// ── Policy schema ─────────────────────────────────────────────────

describe("policySchema", () => {
  it("accepts a curated record (taxonomy=null)", () => {
    const result = policySchema.safeParse(curatedPolicy)
    expect(result.success).toBe(true)
  })

  it("accepts a bulk record (hf_repo_id=null, paper_arxiv_url=null, taxonomy object with action_dimensions=0)", () => {
    const result = policySchema.safeParse(bulkPolicy)
    expect(result.success).toBe(true)
  })

  it("accepts a record with skill_type values outside the strict enum (bulk uses 'other')", () => {
    const result = policySchema.safeParse({ ...curatedPolicy, skill_type: "feature-extraction" })
    expect(result.success).toBe(true)
  })

  it("rejects a record missing the action_space field", () => {
    const { action_space: _a, ...broken } = curatedPolicy
    const result = policySchema.safeParse(broken)
    expect(result.success).toBe(false)
  })

  it("rejects a record where benchmarks is not an array", () => {
    const result = policySchema.safeParse({ ...curatedPolicy, benchmarks: null })
    expect(result.success).toBe(false)
  })

  // Bulk records from the live API ship `required_control` as a bare
  // scalar string instead of an array. Before the permissive normalization,
  // every such record failed parse, `parsePaginated` returned null, and
  // the agent saw a false data_unavailable — surfaced to the user as
  // "dataset API is offline" even though /v1/policies returned 200.
  it("normalizes scalar taxonomy.required_control to a single-element array (bulk API shape)", () => {
    const bulkWithScalarControl = {
      ...bulkPolicy,
      taxonomy: { ...bulkPolicy.taxonomy, required_control: "learned_latent" },
    }
    const result = policySchema.safeParse(bulkWithScalarControl)
    expect(result.success).toBe(true)
    if (result.success && result.data.taxonomy !== null && result.data.taxonomy !== undefined) {
      expect(result.data.taxonomy.required_control).toEqual(["learned_latent"])
    }
  })

  it("normalizes scalar taxonomy.required_perception to a single-element array", () => {
    const bulkWithScalarPerception = {
      ...bulkPolicy,
      taxonomy: { ...bulkPolicy.taxonomy, required_perception: "monocular_rgb" },
    }
    const result = policySchema.safeParse(bulkWithScalarPerception)
    expect(result.success).toBe(true)
    if (result.success && result.data.taxonomy !== null && result.data.taxonomy !== undefined) {
      expect(result.data.taxonomy.required_perception).toEqual(["monocular_rgb"])
    }
  })

  it("normalizes null taxonomy.required_control to an empty array", () => {
    const bulkWithNullControl = {
      ...bulkPolicy,
      taxonomy: { ...bulkPolicy.taxonomy, required_control: null },
    }
    const result = policySchema.safeParse(bulkWithNullControl)
    expect(result.success).toBe(true)
    if (result.success && result.data.taxonomy !== null && result.data.taxonomy !== undefined) {
      expect(result.data.taxonomy.required_control).toEqual([])
    }
  })
})

// ── Other entity schemas ──────────────────────────────────────────

describe("datasetSchema", () => {
  it("accepts a curated dataset", () => {
    const result = datasetSchema.safeParse({
      id: "ds1",
      slug: "lerobot-pusht",
      name: "PushT",
      description: "PushT demonstrations.",
      episodes: 206,
      robots: 1,
      robot_names: ["franka-panda"],
      source: "lerobot",
      hf_dataset_id: "lerobot/pusht",
      format: "lerobot",
      compatible_policy_slugs: ["diffusion-policy-pusht"],
    })
    expect(result.success).toBe(true)
  })

  it("accepts a bulk dataset with episodes=null and hf_dataset_id=null", () => {
    const result = datasetSchema.safeParse({
      id: "dsb1",
      slug: "scraped-dataset",
      name: "scraped",
      description: "scraped from HF",
      episodes: null,
      robots: 0,
      robot_names: [],
      source: "scraped",
      hf_dataset_id: null,
      format: "other",
      compatible_policy_slugs: [],
    })
    expect(result.success).toBe(true)
  })
})

describe("environmentSchema", () => {
  it("accepts a curated environment", () => {
    const result = environmentSchema.safeParse({
      id: "e1",
      slug: "tabletop-clean",
      name: "Tabletop Clean",
      simulator: "mujoco",
      scene: "tabletop_v2.xml",
      description: "Empty tabletop.",
      conditions: {
        location: "indoor lab",
        surface: "smooth wood",
        lighting: "uniform LED",
        objects: "none",
        obstacles: "none",
        physics: "rigid body",
        scale: "tabletop",
      },
      compatible_robot_slugs: ["franka-panda"],
      deploy_command: "mujoco_run tabletop_clean.xml",
      preview_description: "Empty tabletop preview.",
    })
    expect(result.success).toBe(true)
  })
})

describe("paperSchema", () => {
  it("accepts a paper with arxiv_url=null", () => {
    const result = paperSchema.safeParse({
      id: "pp1",
      title: "ACT",
      authors: ["Tony Z. Zhao"],
      venue: "RSS 2023",
      date: "2023-04-23",
      arxiv_url: null,
      citations: 100,
      robot_tags: ["aloha-2"],
      policy_tags: ["act"],
      task_tags: ["bimanual"],
      abstract: "Action chunking transformer.",
    })
    expect(result.success).toBe(true)
  })
})

describe("deployNoteSchema", () => {
  it("accepts a curated deploy note", () => {
    const result = deployNoteSchema.safeParse({
      id: "dn1",
      slug: "deploy-arm-1",
      name: "arm safety note",
      robot_type: "arm",
      severity: "critical",
      description: "Pinch hazards.",
    })
    expect(result.success).toBe(true)
  })
})

describe("compatibilityEdgeSchema", () => {
  it("accepts a paper-sourced verified edge", () => {
    const result = compatibilityEdgeSchema.safeParse({
      slug: "aloha-2__act-aloha-sim-transfer-cube__sim-mujoco",
      robot_slug: "aloha-2",
      policy_slug: "act-aloha-sim-transfer-cube",
      status: "verified",
      success_rate: 0.96,
      episodes_tested: 500,
      environment: "sim (MuJoCo)",
      source: "paper",
      evidence_url: "https://arxiv.org/abs/2304.13705",
      gaps: [],
      updated_at: "2026-04-10",
    })
    expect(result.success).toBe(true)
  })

  it("accepts a taxonomy-matched edge with nulls", () => {
    const result = compatibilityEdgeSchema.safeParse({
      slug: "agilex-piper__openvla-openvla-7b__global",
      robot_slug: "agilex-piper",
      policy_slug: "openvla-openvla-7b",
      status: "inferred",
      success_rate: null,
      episodes_tested: null,
      environment: null,
      source: "taxonomy-match",
      evidence_url: null,
      gaps: ["no published benchmark"],
      updated_at: "2026-04-12",
    })
    expect(result.success).toBe(true)
  })
})

describe("taskSchema", () => {
  it("accepts a curated task with valid difficulty enum", () => {
    const result = taskSchema.safeParse({
      id: "t1",
      slug: "pick-and-place",
      name: "Pick and Place",
      category: "manipulation",
      description: "Grasp and place an object.",
      sub_tasks: ["detect", "grasp", "place"],
      required_capabilities: ["vision", "grasping"],
      compatible_robot_types: ["arm", "dual-arm"],
      compatible_policy_slugs: ["octo-base"],
      difficulty: "easy",
      has_real_world_demo: true,
    })
    expect(result.success).toBe(true)
  })
})

// ── List parse helpers ────────────────────────────────────────────

describe("parseRobots / parsePolicies (mixed curated + bulk lists)", () => {
  it("parses a mixed list of curated + bulk robots", () => {
    const result = parseRobots([curatedRobot, bulkRobot])
    expect(result).not.toBeNull()
    expect(result?.length).toBe(2)
  })

  it("parses a mixed list of curated + bulk policies", () => {
    const result = parsePolicies([curatedPolicy, bulkPolicy])
    expect(result).not.toBeNull()
    expect(result?.length).toBe(2)
  })

  it("returns null when any record in the list is malformed", () => {
    const result = parseRobots([curatedRobot, { ...curatedRobot, deploy_readiness: "bogus" }])
    expect(result).toBeNull()
  })
})
