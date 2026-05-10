/**
 * MockFestivusClient — deterministic in-process stand-in for FestivusClient.
 *
 * Lives under src/ so the agent route can import it without crossing the
 * tests/ boundary. Used by `pnpm test:smoke` (Step 3.5) so the smoke test
 * actually verifies that the agent CALLS the API tools and incorporates
 * the returned data into its answer — instead of the old fake-pass test
 * which only checked "no errors, some tool calls happened" (lesson 22).
 *
 * The fixture set is small and deterministic. Every method returns the
 * same data regardless of filters (they're filters into a 5-record world,
 * not a real query engine). The point is that the agent gets back known
 * names like "Franka Panda", "ALOHA 2", "ACT" that the smoke test can
 * grep for in the final answer.
 *
 * Fixture summary:
 *   robots: franka-panda, ur5e, aloha-2, unitree-go2, dji-tello
 *   policies: act-aloha-sim-transfer-cube, diffusion-policy-pusht, octo-base
 *   tasks: pick-and-place, fold-laundry, walk-flat-terrain
 *   edges: 6 spanning all 4 reliability tiers
 */

import type {
  ICompatibilityEdge,
  IDataset,
  IDeployNote,
  IEnvironment,
  IPolicy,
  IRobot,
  IRobotFullResponse,
  ITask,
} from "@festivus/types"
import type {
  ICompatibilityFilters,
  IDatasetFilters,
  IDeployNoteFilters,
  IEnvironmentFilters,
  IFestivusClient,
  IPolicyFilters,
  IRobotFilters,
  ITaskFilters,
} from "@/lib/api/festivus-client"

// ── Fixture data ──────────────────────────────────────────────────
// Exposed as named consts so tests can assert on the same values.

export const MOCK_ROBOTS: IRobot[] = [
  {
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
    compatible_policy_slugs: ["diffusion-policy-pusht", "octo-base"],
    compatible_env_slugs: ["tabletop-clean"],
    image_url: "https://example.com/franka.png",
    community_size: "large",
    description: "7-DoF torque-controlled research arm.",
    taxonomy: null,
    product_page_url: "https://franka.de/products",
    category: "Cobot arm / industrial",
    form_factor: "arm-fixed",
    price_availability: "on_request",
  },
  {
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
    compatible_policy_slugs: ["octo-base"],
    compatible_env_slugs: ["tabletop-clean"],
    image_url: "https://example.com/ur5e.png",
    community_size: "large",
    description: "6-DoF collaborative arm.",
    taxonomy: null,
    product_page_url: "https://www.universal-robots.com/products/ur5e/",
    category: "Cobot arm / industrial",
    form_factor: "arm-fixed",
    price_availability: "public",
  },
  {
    id: "r3",
    slug: "aloha-2",
    name: "ALOHA 2",
    manufacturer: "Stanford / Trossen",
    type: "dual-arm",
    dof: 14,
    sensors: ["joint encoders", "wrist cameras"],
    actuators: "Dynamixel servos",
    price_usd: 21000,
    weight_kg: 16,
    build_paths: [{ path: "kit", cost_usd: 21000, build_time_days: 21, purchase_url: "https://trossenrobotics.com" }],
    deploy_readiness: "lab_only",
    compatible_policy_slugs: ["act-aloha-sim-transfer-cube"],
    compatible_env_slugs: ["mujoco-aloha-bimanual"],
    image_url: "https://example.com/aloha.png",
    community_size: "large",
    description: "Bimanual teleoperation platform.",
    taxonomy: null,
    product_page_url: "https://www.trossenrobotics.com/aloha-2.aspx",
    category: "Cobot arm / industrial",
    form_factor: "arm-fixed",
    price_availability: "public",
  },
  {
    id: "r4",
    slug: "unitree-go2",
    name: "Unitree Go2",
    manufacturer: "Unitree Robotics",
    type: "quadruped",
    dof: 12,
    sensors: ["IMU", "depth camera"],
    actuators: "12 brushless joint motors",
    price_usd: 1600,
    weight_kg: 15,
    build_paths: [{ path: "buy", cost_usd: 1600, build_time_days: 7, purchase_url: "https://unitree.com" }],
    deploy_readiness: "ce_marked",
    compatible_policy_slugs: [],
    compatible_env_slugs: ["flat-terrain"],
    image_url: "https://example.com/go2.png",
    community_size: "medium",
    description: "Quadruped with depth perception.",
    taxonomy: null,
    product_page_url: "https://www.unitree.com/go2/",
    category: "Quadruped / UGV",
    form_factor: "quadruped",
    price_availability: "public",
  },
  {
    id: "r5",
    slug: "dji-tello",
    name: "DJI Tello",
    manufacturer: "DJI",
    type: "drone",
    dof: 4,
    sensors: ["downward camera", "IMU"],
    actuators: "4 brushed motors",
    price_usd: 99,
    weight_kg: 0.08,
    build_paths: [{ path: "buy", cost_usd: 99, build_time_days: 1, purchase_url: "https://dji.com" }],
    deploy_readiness: "ce_marked",
    compatible_policy_slugs: [],
    compatible_env_slugs: ["indoor-flight-cage"],
    image_url: "https://example.com/tello.png",
    community_size: "large",
    description: "Educational quadcopter.",
    taxonomy: null,
    product_page_url: "https://store.dji.com/product/tello",
    category: "Drone",
    form_factor: "drone",
    price_availability: "public",
  },
]

export const MOCK_POLICIES: IPolicy[] = [
  {
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
    benchmarks: [{ robot: "ALOHA 2", environment: "sim (MuJoCo)", success_rate: 0.96, episodes: 500 }],
    hf_repo_id: "lerobot/act_aloha",
    paper_arxiv_url: "https://arxiv.org/abs/2304.13705",
    evidence_level: "verified",
    taxonomy: null,
  },
  {
    id: "p2",
    slug: "diffusion-policy-pusht",
    name: "Diffusion Policy (PushT)",
    author: "Cheng Chi",
    framework: "PyTorch",
    license: "mit",
    task_description: "PushT visuomotor control.",
    skill_type: "manipulation",
    action_space: { type: "ee-pose", dimensions: 2, frequency_hz: 10 },
    observation_space: { type: "image", components: ["rgb"] },
    compatible_robot_slugs: ["franka-panda"],
    compatible_env_slugs: ["tabletop-clean"],
    benchmarks: [{ robot: "Franka Panda", environment: "real", success_rate: 0.91, episodes: 200 }],
    hf_repo_id: "lerobot/diffusion_pusht",
    paper_arxiv_url: "https://arxiv.org/abs/2303.04137",
    evidence_level: "verified",
    taxonomy: null,
  },
  {
    id: "p3",
    slug: "octo-base",
    name: "Octo Base",
    author: "Octo team",
    framework: "JAX",
    license: "mit",
    task_description: "Generalist manipulation policy.",
    skill_type: "manipulation",
    action_space: { type: "ee-pose", dimensions: 7, frequency_hz: 5 },
    observation_space: { type: "image+language", components: ["rgb", "language_instruction"] },
    compatible_robot_slugs: ["franka-panda", "ur5e"],
    compatible_env_slugs: ["tabletop-clean"],
    benchmarks: [{ robot: "Franka Panda", environment: "real", success_rate: 0.78, episodes: 200 }],
    hf_repo_id: "octo/octo-base",
    paper_arxiv_url: "https://arxiv.org/abs/2405.12213",
    evidence_level: "verified",
    taxonomy: null,
  },
]

export const MOCK_TASKS: ITask[] = [
  {
    id: "t1",
    slug: "pick-and-place",
    name: "Pick and Place",
    category: "manipulation",
    description: "Grasp and place an object.",
    sub_tasks: ["detect", "grasp", "transport", "place"],
    required_capabilities: ["vision", "grasp-planning"],
    compatible_robot_types: ["arm", "dual-arm"],
    compatible_policy_slugs: ["octo-base"],
    difficulty: "easy",
    has_real_world_demo: true,
  },
  {
    id: "t2",
    slug: "fold-laundry",
    name: "Fold Laundry",
    category: "manipulation",
    description: "Fold cloth items bimanually.",
    sub_tasks: ["detect-fabric", "grasp-edge", "fold"],
    required_capabilities: ["bimanual-coordination", "deformable-object"],
    compatible_robot_types: ["dual-arm", "humanoid"],
    compatible_policy_slugs: ["act-aloha-sim-transfer-cube"],
    difficulty: "hard",
    has_real_world_demo: false,
  },
  {
    id: "t3",
    slug: "walk-flat-terrain",
    name: "Walk on Flat Terrain",
    category: "locomotion",
    description: "Stable locomotion on level ground.",
    sub_tasks: ["balance", "gait-generation"],
    required_capabilities: ["proprioception", "balance-control"],
    compatible_robot_types: ["quadruped", "humanoid"],
    compatible_policy_slugs: [],
    difficulty: "easy",
    has_real_world_demo: true,
  },
]

export const MOCK_EDGES: ICompatibilityEdge[] = [
  // Tier 1: paper-verified
  {
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
  },
  {
    slug: "franka-panda__diffusion-policy-pusht__real",
    robot_slug: "franka-panda",
    policy_slug: "diffusion-policy-pusht",
    status: "verified",
    success_rate: 0.91,
    episodes_tested: 200,
    environment: "real",
    source: "paper",
    evidence_url: "https://arxiv.org/abs/2303.04137",
    gaps: [],
    updated_at: "2026-04-10",
  },
  // Tier 2: community-reported
  {
    slug: "franka-panda__octo-base__real",
    robot_slug: "franka-panda",
    policy_slug: "octo-base",
    status: "verified",
    success_rate: 0.78,
    episodes_tested: 200,
    environment: "real",
    source: "community",
    evidence_url: null,
    gaps: ["community-reproduced, no peer review"],
    updated_at: "2026-04-10",
  },
  // Tier 3: hand-inferred
  {
    slug: "ur5e__octo-base__global",
    robot_slug: "ur5e",
    policy_slug: "octo-base",
    status: "untested",
    success_rate: null,
    episodes_tested: null,
    environment: null,
    source: "inferred",
    evidence_url: null,
    gaps: ["matching action space and observation space, no real-world test performed"],
    updated_at: "2026-04-10",
  },
  // Tier 4: taxonomy-match (UNTESTED)
  {
    slug: "unitree-go2__octo-base__global",
    robot_slug: "unitree-go2",
    policy_slug: "octo-base",
    status: "inferred",
    success_rate: null,
    episodes_tested: null,
    environment: null,
    source: "taxonomy-match",
    evidence_url: null,
    gaps: [
      "robot control_interfaces inferred from type default",
      "policy required_perception scraped from HF metadata",
      "no real-world or sim test performed",
    ],
    updated_at: "2026-04-12",
  },
  {
    slug: "dji-tello__octo-base__global",
    robot_slug: "dji-tello",
    policy_slug: "octo-base",
    status: "inferred",
    success_rate: null,
    episodes_tested: null,
    environment: null,
    source: "taxonomy-match",
    evidence_url: null,
    gaps: ["taxonomy match between drone and manipulation policy is implausible"],
    updated_at: "2026-04-12",
  },
]

export const MOCK_DEPLOY_NOTES: IDeployNote[] = [
  {
    id: "dn1",
    slug: "deploy-arm-1",
    name: "arm safety",
    robot_type: "arm",
    severity: "critical",
    description: "Pinch and crush hazards: keep fingers out of the workspace, use an e-stop.",
  },
  {
    id: "dn2",
    slug: "deploy-quadruped-1",
    name: "quadruped safety",
    robot_type: "quadruped",
    severity: "warning",
    description: "Watch for unexpected falls on rough terrain. Keep operators clear of legs.",
  },
]

export const MOCK_DATASETS: IDataset[] = [
  {
    id: "ds1",
    slug: "lerobot-pusht",
    name: "PushT",
    description: "PushT demonstration dataset.",
    episodes: 206,
    robots: 1,
    robot_names: ["franka-panda"],
    source: "lerobot",
    hf_dataset_id: "lerobot/pusht",
    format: "lerobot",
    compatible_policy_slugs: ["diffusion-policy-pusht"],
  },
]

export const MOCK_ENVIRONMENTS: IEnvironment[] = [
  {
    id: "e1",
    slug: "tabletop-clean",
    name: "Tabletop Clean",
    kind: "simulated",
    simulator: "mujoco",
    scene: "tabletop_clean.xml",
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
    compatible_robot_slugs: ["franka-panda", "ur5e"],
    deploy_command: "mujoco_run tabletop_clean.xml",
    preview_description: "Empty tabletop preview.",
  },
]

// ── Mock client ───────────────────────────────────────────────────

export class MockFestivusClient implements IFestivusClient {
  /**
   * Every call appended here so tests can verify which tools the agent
   * actually invoked. Reset between tests via clear().
   */
  public readonly calls: { method: string; args: unknown }[] = []

  clear(): void {
    this.calls.length = 0
  }

  async searchRobots(filters: IRobotFilters = {}): Promise<IRobot[] | null> {
    this.calls.push({ method: "searchRobots", args: filters })
    let results = MOCK_ROBOTS
    if (filters.type !== undefined) {
      results = results.filter((r) => r.type === filters.type)
    }
    if (filters.has_policies === true) {
      results = results.filter((r) => r.compatible_policy_slugs.length > 0)
    }
    if (filters.has_policies === false) {
      results = results.filter((r) => r.compatible_policy_slugs.length === 0)
    }
    if (filters.price_max !== undefined) {
      results = results.filter((r) => r.price_usd !== null && r.price_usd <= (filters.price_max as number))
    }
    return results.slice(0, filters.limit ?? 10)
  }

  async searchPolicies(filters: IPolicyFilters = {}): Promise<IPolicy[] | null> {
    this.calls.push({ method: "searchPolicies", args: filters })
    let results = MOCK_POLICIES
    if (filters.robot !== undefined) {
      results = results.filter((p) => p.compatible_robot_slugs.includes(filters.robot as string))
    }
    if (filters.skill !== undefined) {
      results = results.filter((p) => p.skill_type === filters.skill)
    }
    if (filters.evidence !== undefined) {
      results = results.filter((p) => p.evidence_level === filters.evidence)
    }
    return results.slice(0, filters.limit ?? 10)
  }

  async searchDatasets(filters: IDatasetFilters = {}): Promise<IDataset[] | null> {
    this.calls.push({ method: "searchDatasets", args: filters })
    return MOCK_DATASETS.slice(0, filters.limit ?? 10)
  }

  async searchTasks(filters: ITaskFilters = {}): Promise<ITask[] | null> {
    this.calls.push({ method: "searchTasks", args: filters })
    let results = MOCK_TASKS
    if (filters.category !== undefined) {
      results = results.filter((t) => t.category === filters.category)
    }
    if (filters.robot_type !== undefined) {
      results = results.filter((t) => t.compatible_robot_types.includes(filters.robot_type as never))
    }
    return results.slice(0, filters.limit ?? 10)
  }

  async searchCompatibility(filters: ICompatibilityFilters = {}): Promise<ICompatibilityEdge[] | null> {
    this.calls.push({ method: "searchCompatibility", args: filters })
    let results = MOCK_EDGES
    if (filters.robot !== undefined) {
      results = results.filter((e) => e.robot_slug === filters.robot)
    }
    if (filters.policy !== undefined) {
      results = results.filter((e) => e.policy_slug === filters.policy)
    }
    if (filters.status !== undefined) {
      results = results.filter((e) => e.status === filters.status)
    }
    return results.slice(0, filters.limit ?? 50)
  }

  async searchDeployNotes(filters: IDeployNoteFilters = {}): Promise<IDeployNote[] | null> {
    this.calls.push({ method: "searchDeployNotes", args: filters })
    let results = MOCK_DEPLOY_NOTES
    if (filters.robot_type !== undefined) {
      results = results.filter((n) => n.robot_type === filters.robot_type)
    }
    return results.slice(0, filters.limit ?? 10)
  }

  async searchEnvironments(filters: IEnvironmentFilters = {}): Promise<IEnvironment[] | null> {
    this.calls.push({ method: "searchEnvironments", args: filters })
    return MOCK_ENVIRONMENTS.slice(0, filters.limit ?? 10)
  }

  async getRobot(slug: string): Promise<IRobot | null> {
    this.calls.push({ method: "getRobot", args: { slug } })
    return MOCK_ROBOTS.find((r) => r.slug === slug) ?? null
  }

  async getPolicy(slug: string): Promise<IPolicy | null> {
    this.calls.push({ method: "getPolicy", args: { slug } })
    return MOCK_POLICIES.find((p) => p.slug === slug) ?? null
  }

  async getDataset(slug: string): Promise<IDataset | null> {
    this.calls.push({ method: "getDataset", args: { slug } })
    return MOCK_DATASETS.find((d) => d.slug === slug) ?? null
  }

  async getTask(slug: string): Promise<ITask | null> {
    this.calls.push({ method: "getTask", args: { slug } })
    return MOCK_TASKS.find((t) => t.slug === slug) ?? null
  }

  async getRobotFull(slug: string): Promise<IRobotFullResponse | null> {
    this.calls.push({ method: "getRobotFull", args: { slug } })
    const robot = MOCK_ROBOTS.find((r) => r.slug === slug) ?? null
    if (robot === null) return null
    const policies = MOCK_POLICIES.filter((p) => robot.compatible_policy_slugs.includes(p.slug))
    const datasets = MOCK_DATASETS.filter((d) => policies.some((p) => d.compatible_policy_slugs.includes(p.slug)))
    return { robot, policies, datasets }
  }
}

// Module-level singleton, refreshed at the start of every test request
// in route.ts (so tests don't share state across runs).
let processSingleton: MockFestivusClient | null = null
export function getProcessMockClient(): MockFestivusClient {
  if (processSingleton === null) processSingleton = new MockFestivusClient()
  return processSingleton
}
export function resetProcessMockClient(): void {
  processSingleton = null
}
