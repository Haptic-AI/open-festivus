// ── Workbench seed data for scripted agent flow ─────────────────────

export interface IRobotOption {
  slug: string
  name: string
  path: "buy" | "kit" | "print"
  price: number
  buildTime: string
  policyCount: number
  timeToFirstExperiment: string
  purchaseUrl: string
  imageUrl?: string
  specs: { dof: number; type: string; servos: string }
}

export interface ITaskOption {
  slug: string
  name: string
  skillType: string
  description: string
}

export interface IPolicyOption {
  slug: string
  name: string
  evidence: string
  successRate: number
  author: string
  thumbnailUrl?: string
}

export interface IEnvOption {
  slug: string
  name: string
  simulator: string
  description: string
  deployCommand: string
  previewUrl?: string
}

export interface IRolloutResult {
  id: number
  status: "success" | "failure" | "running" | "queued"
  note?: string
  delay: number
}

export const ROBOT_OPTIONS: IRobotOption[] = [
  {
    slug: "so-100",
    name: "SO-100",
    path: "buy",
    price: 300,
    buildTime: "Ships in 2 weeks",
    policyCount: 8,
    timeToFirstExperiment: "1 day",
    purchaseUrl: "https://www.therobotstudio.com/products/so-100/",
    imageUrl: "https://github.com/TheRobotStudio/SO-ARM100/raw/main/media/Leader_And_Follower_SO100.jpg",
    specs: { dof: 6, type: "arm", servos: "Feetech STS3215" },
  },
  {
    slug: "koch-v11",
    name: "Koch v1.1",
    path: "kit",
    price: 200,
    buildTime: "8 hour build",
    policyCount: 5,
    timeToFirstExperiment: "2 days",
    purchaseUrl: "https://github.com/jess-moss/koch-v1-1",
    imageUrl: "https://raw.githubusercontent.com/jess-moss/koch-v1-1/main/pictures/Follower_And_Leader_Arm.jpg",
    specs: { dof: 6, type: "arm", servos: "Dynamixel XL430" },
  },
  {
    slug: "so-arm101",
    name: "SO-ARM101",
    path: "print",
    price: 80,
    buildTime: "20 hour build + print time",
    policyCount: 3,
    timeToFirstExperiment: "1 week",
    purchaseUrl: "https://github.com/TheRobotStudio/SO-ARM100",
    imageUrl: "https://github.com/TheRobotStudio/SO-ARM100/raw/main/media/SO101_Follower.webp",
    specs: { dof: 6, type: "arm", servos: "Feetech STS3215" },
  },
]

export const TASK_OPTIONS: ITaskOption[] = [
  { slug: "pick-place", name: "Pick and place", skillType: "manipulation", description: "Pick up objects and place them at target locations" },
  { slug: "sort-objects", name: "Sort objects", skillType: "manipulation", description: "Sort objects by color, size, or shape" },
  { slug: "pour-liquid", name: "Pour liquid", skillType: "manipulation", description: "Precision pouring between containers" },
]

export const POLICY_OPTIONS: IPolicyOption[] = [
  { slug: "act-aloha-sim-transfer-cube", name: "ACT/AlohaTransferCube", evidence: "verified", successRate: 96, author: "lerobot" },
  { slug: "diffusion-policy-pusht", name: "DiffusionPolicy/PushT", evidence: "verified", successRate: 94, author: "real-stanford" },
  { slug: "so100-pick-place-act", name: "ACT/SO100PickPlace", evidence: "verified", successRate: 80, author: "lerobot" },
]

export const ENV_OPTIONS: IEnvOption[] = [
  { slug: "mujoco-tabletop", name: "MuJoCo Tabletop", simulator: "MuJoCo", description: "Flat table, randomized object positions", deployCommand: "python -m mujoco_env.load --scene tabletop --robot $ROBOT", previewUrl: "https://github.com/google-deepmind/mujoco/raw/main/banner.png" },
  { slug: "mujoco-cluttered", name: "MuJoCo Cluttered Bin", simulator: "MuJoCo", description: "Cluttered bin with varied objects", deployCommand: "python -m mujoco_env.load --scene cluttered_bin --robot $ROBOT", previewUrl: "https://github.com/google-deepmind/mujoco_playground/raw/main/assets/banner.png" },
  { slug: "isaac-kitchen", name: "Isaac Sim Kitchen", simulator: "Isaac Sim", description: "Photorealistic kitchen counter", deployCommand: "isaacsim --scene /environments/kitchen --robot $ROBOT" },
]

export const ROLLOUT_RESULTS: IRolloutResult[] = [
  { id: 1, status: "success", delay: 800 },
  { id: 2, status: "success", delay: 1200 },
  { id: 3, status: "failure", note: "Dropped near table edge", delay: 1800 },
  { id: 4, status: "success", delay: 2200 },
  { id: 5, status: "success", delay: 2800 },
  { id: 6, status: "failure", note: "Grasp slip on smooth object", delay: 3200 },
  { id: 7, status: "success", delay: 3800 },
  { id: 8, status: "success", delay: 4200 },
  { id: 9, status: "success", delay: 4800 },
  { id: 10, status: "success", delay: 5200 },
  { id: 11, status: "failure", note: "Object too small to grasp", delay: 5800 },
  { id: 12, status: "success", delay: 6200 },
]

export type AgentRole = "sim-builder" | "policy-scout" | "evaluator" | "reporter"

export const AGENT_ROLE_COLORS: Record<AgentRole, { bg: string; label: string }> = {
  "sim-builder": { bg: "bg-green-500", label: "Sim Builder" },
  "policy-scout": { bg: "bg-blue-500", label: "Policy Scout" },
  evaluator: { bg: "bg-yellow-500", label: "Evaluator" },
  reporter: { bg: "bg-purple-500", label: "Reporter" },
}

export const AGENT_PLAN_STEPS = [
  { label: "Analyzing your project", duration: 1200 },
  { label: "Selecting robot options", duration: 800 },
  { label: "Finding compatible policies", duration: 1000 },
  { label: "Matching environments", duration: 600 },
  { label: "Preparing evaluation suite", duration: 800 },
] as const
