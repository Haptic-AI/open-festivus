/**
 * Canonical types for the Festivus platform.
 *
 * DESIGN DECISIONS:
 * 1. Wire format is snake_case (matches Festivus data API REST API and JSON files)
 * 2. These types describe what the data ACTUALLY looks like, not aspirations
 * 3. Fields that are nullable in the bulk data are explicitly `| null`
 * 4. The `I` prefix convention is kept for consistency with the codebase
 * 5. Zod schemas (in apps/web) provide runtime validation at boundaries
 *
 * WHEN DATA CHANGES:
 * - Update the type here FIRST
 * - pnpm check will fail everywhere the type is consumed — fix forward
 * - Update the Zod schema in apps/web to match
 * - Update the Pydantic model in Festivus data API to match
 */

// ── Enums as union types ──────────────────────────────────────────

/**
 * @deprecated Use taxonomy.embodiment instead. This field exists for backward
 * compatibility with the curated seed data. It uses a different vocabulary than
 * the taxonomy and has wrong values in bulk data (e.g., Cassie listed as "arm").
 * Will be removed once the curated seed migrates to taxonomy-based filtering.
 */
export type IRobotType = "arm" | "dual-arm" | "quadruped" | "humanoid" | "drone" | "rover"

// ── Taxonomy enums ────────────────────────────────────────────────
// Six orthogonal axes. A robot is a point in this 6D space.
// Policy compatibility lives at the intersection of Axis 4 and 5.
// See docs/taxonomy.md for worked examples and rationale.

/** Axis 1: Body plan — shape and topology, independent of how it moves. */
export type IEmbodiment =
  | "manipulator"          // fixed/mounted arm, no mobile base. Panda, UR5e, KUKA iiwa.
  | "mobile_base"          // moves but doesn't manipulate. TurtleBot, Jackal, MiR250.
  | "mobile_manipulator"   // arm(s) on a mobile base. Stretch 3, PAL Tiago, Spot+arm.
  | "humanoid"             // bimanual, bipedal, human-scale. Figure 02, Optimus, G1, Atlas.
  | "quadruped"            // four-legged. Spot, ANYmal, Go2.
  | "aerial"               // flies. Mavic, Skydio, Zipline drones.
  | "underwater"           // submerged. BlueROV2, Saab Seaeye.
  | "soft_continuum"       // deformable, no rigid skeleton. OctArm, Festo BionicSoftArm.
  | "swarm_unit"           // operates in large collectives. Kilobot, RoboBee, Zooids.
  | "wearable_exoskeleton" // worn by a human. Sarcos Guardian XO, Ekso Bionics.

/** Axis 2: How it moves through space. Independent of body plan. */
export type IMobility =
  | "fixed"                    // bolted down. Panda, UR5e, most industrial arms.
  | "wheeled_differential"     // two driven wheels + casters. TurtleBot, Jackal, Kiva.
  | "wheeled_ackermann"        // car-like steering. F1Tenth, autonomous vehicles.
  | "wheeled_omnidirectional"  // mecanum/omni wheels. KUKA KMR, Toyota HSR.
  | "tracked"                  // treads. PackBot, Milrem THeMIS.
  | "legged_biped"             // Digit, Atlas, Cassie.
  | "legged_quadruped"         // Spot, ANYmal, Go2.
  | "legged_hexapod"           // RHex, research hexapods.
  | "aerial_multirotor"        // Mavic, Skydio.
  | "aerial_fixed_wing"        // Wingcopter, military ISR drones.
  | "aerial_hybrid_vtol"       // vertical takeoff, horizontal cruise. Wingcopter 198.
  | "underwater_propeller"     // BlueROV2.
  | "underwater_bioinspired"   // MIT SoFi, Aquanaut.
  | "limbless"                 // snake robots. CMU modular snakes.

/** Axis 3: How degrees of freedom are driven. Matters for compliance, sim-to-real. */
export type IActuation =
  | "electric_geared"        // most cobots and humanoids. Panda, UR5e, Digit.
  | "electric_direct_drive"  // low gear ratio, high backdrivability. Mini Cheetah, Unitree.
  | "hydraulic"              // high power density. Atlas (hydraulic gen), HyQ.
  | "pneumatic"              // air-driven, often soft. Festo BionicSoftArm, soft grippers.
  | "cable_driven"           // motors remote from joints. Shadow Hand, surgical robots.
  | "series_elastic"         // spring between motor and output. Baxter, Sawyer.
  | "shape_memory_alloy"     // research soft robots.

/**
 * Axis 4: How you command it. THE key axis for ML model compatibility.
 * If your model outputs joint torques, it runs on Panda but not stock UR5e.
 */
export type IControlInterface =
  | "joint_position"       // send target angles. Most industrial arms, humanoid high-level.
  | "joint_velocity"       // send angular velocities. Mobile base wheels, some arms.
  | "joint_torque"         // send torques directly. Panda, Spot low-level, RL locomotion.
  | "cartesian_pose"       // "put the gripper here." UR default, VLA models (RT-2, pi0).
  | "cartesian_velocity"   // linear+angular velocity. ROS cmd_vel, mobile bases.
  | "waypoint_trajectory"  // "follow this path." Drones (MAVLink), AMRs.
  | "learned_latent"       // policy outputs latent, decoder maps to joints. Foundation models.

/** Axis 5: What it senses. Determines which models can run on the platform. */
export type IPerception =
  | "proprioception"   // joint encoders, IMU. Minimum for any robot.
  | "monocular_rgb"    // single camera. Many drones, low-cost arms with wrist cam.
  | "stereo_rgbd"      // depth + color. RealSense on most research robots.
  | "lidar_2d"         // TurtleBot, older AMRs.
  | "lidar_3d"         // Velodyne/Ouster on AVs, Spot optional, ANYmal.
  | "tactile"          // fingertip sensors. GelSight, DIGIT, BioTac.
  | "force_torque"     // wrist F/T sensors on most cobots.
  | "event_camera"     // Prophesee sensors on research drones.
  | "sonar"            // underwater robots.
  | "gps"              // outdoor mobile robots, drones, AVs.

/** Axis 6a: How autonomously it operates. */
export type IAutonomyLevel =
  | "teleoperated"      // human in the loop for every action. da Vinci, most humanoid demos.
  | "shared_autonomy"   // human sets goals, robot executes. Stretch, inspection drones.
  | "fully_autonomous"  // no human needed. Kiva warehouse, Waymo, Roomba.

/** Axis 6b: Where it operates. A robot can serve multiple industries. */
export type IIndustry =
  | "research"
  | "manufacturing"
  | "warehouse"
  | "agriculture"
  | "healthcare"
  | "home"
  | "defense"
  | "inspection"
  | "construction"
  | "delivery"
  | "surgical"
  | "consumer"

export type ISkillType = "manipulation" | "locomotion" | "navigation" | "aerial" | "other"

export type IEvidenceLevel = "verified" | "reported" | "community" | "untested"

export type IDeployReadiness = "lab_only" | "ce_marked" | "field_deployed"

/** Spec 017: closed-set form factor enum. Used for filtering/search. */
export type IFormFactor = "humanoid" | "quadruped" | "wheeled" | "arm-fixed" | "arm-mobile" | "drone"

/** Spec 017: whether a price is publicly knowable, distinct from not-yet-scraped. */
export type IPriceAvailability = "public" | "on_request" | "not_public" | "unknown"

export type ICommunitySize = "small" | "medium" | "large"

export type IDatasetFormat = "lerobot" | "rlds" | "hdf5" | "parquet" | "other"

export type ISeverity = "critical" | "warning" | "info"

export type ISimulator = "mujoco" | "isaac-sim" | "isaac-gym" | "pybullet" | "habitat" | "genesis" | "coppeliasim" | "other"

export type IBenchmarkEnvironment = "sim" | "real"

export type ICompatibilityStatus = "verified" | "reported" | "inferred" | "untested"

export type IBuildPathType = "buy" | "print" | "kit"

// ── Nested structures ─────────────────────────────────────────────

export interface IBuildPath {
  path: IBuildPathType
  cost_usd: number
  build_time_days: number
  purchase_url: string
}

export interface IActionSpace {
  type: string
  dimensions: number | null
  frequency_hz: number | null
}

export interface IObservationSpace {
  type: string
  components: string[]
}

export interface IBenchmark {
  robot: string
  environment: string
  success_rate: number | null
  episodes: number
}

export interface IEnvironmentConditions {
  location: string
  surface: string
  lighting: string
  objects: string
  obstacles: string
  physics: string
  scale: string
}

/**
 * Robot taxonomy — 6 orthogonal axes classifying every robot.
 *
 * Values use the taxonomy enums above. Bulk data may have values
 * outside the enum (scraped/inferred) — the string fallback handles that.
 * Curated data should strictly use the enum values.
 *
 * deployment_context uses arrays because robots serve multiple
 * industries and operate at multiple autonomy levels.
 */
export interface IRobotTaxonomy {
  embodiment: IEmbodiment | string
  mobility: IMobility | string
  actuation: IActuation | string
  control_interfaces: (IControlInterface | string)[]
  perception: (IPerception | string)[]
  deployment_context: {
    autonomy: (IAutonomyLevel | string)[]
    industry: (IIndustry | string)[]
  }
}

/**
 * Policy taxonomy — what a policy REQUIRES from a robot.
 *
 * The matching rule: a policy is compatible with a robot when:
 * 1. At least one of required_control matches robot's control_interfaces
 * 2. All of required_perception are in robot's perception
 * 3. action_dimensions matches robot's DoF (or policy is dimension-agnostic)
 *
 * required_control is a LIST because some policies can work with
 * multiple control interfaces (e.g., Octo accepts joint_position or cartesian_pose).
 */
export interface IPolicyTaxonomy {
  required_control: (IControlInterface | string)[]
  required_perception: (IPerception | string)[]
  action_dimensions: number | null
}

// ── Core domain entities ──────────────────────────────────────────

/**
 * Robot record — matches Festivus data API /v1/robots response.
 *
 * Curated records have all fields populated.
 * Bulk-scraped records may have nulls for price_usd, dof, weight_kg.
 */
export interface IRobot {
  id: string
  slug: string
  name: string
  manufacturer: string
  /**
   * @deprecated Use taxonomy.embodiment for filtering. This field uses a
   * different vocabulary ("arm" vs "manipulator") and has wrong values in
   * bulk data. Kept for backward compat with curated seed and UI display.
   */
  type: IRobotType | string
  dof: number | null
  sensors: string[]
  actuators: string | null
  price_usd: number | null
  weight_kg: number | null
  build_paths: IBuildPath[]
  deploy_readiness: IDeployReadiness
  compatible_policy_slugs: string[]
  compatible_env_slugs: string[]
  /** Bulk-scraped robots may have a null image (no thumbnail in source). */
  image_url: string | null
  community_size: ICommunitySize
  description: string
  /**
   * The 6-axis taxonomy. Source of truth for classification.
   * Curated records may have `null` (not yet enriched); bulk records always
   * have an object. The Zod schema accepts `null | undefined | object`.
   */
  taxonomy?: IRobotTaxonomy | null

  // ── Spec 017: Corpus reset invariants ────────────────────────────
  /** Manufacturer-authoritative product page. MUST NOT be a repo-host URL. */
  product_page_url: string
  /** Free-form user-facing category, e.g. "Cobot arm / industrial". */
  category: string
  /** Machine-readable form factor for filtering. Closed enum. */
  form_factor: IFormFactor
  /** Whether a price is publicly listed, on request, not public, or unknown. */
  price_availability: IPriceAvailability
  /** Optional: URL where the image was sourced (e.g. an aggregator). */
  image_source_url?: string | null
  /** Optional: alternate names the search layer should match. */
  aliases?: string[] | null
  /**
   * Optional: LLM-enriched fields with per-field confidence. Written by
   * api/src/scripts/enrich-robots.ts. Below-threshold values are stored here
   * for audit even though the top-level field is null.
   */
  enrichment?: IRobotEnrichment | null
  /**
   * Optional per-robot hardware composition — the sensors/actuators/DOF
   * breakdown used by policy detail pages. Stored inline on the robot
   * blob rather than a separate table, since it's a 1:1 relation and the
   * JSONB pattern handles arbitrary optional shapes natively.
   * Populated by seed/enrichment for robots where this detail is curated.
   */
  hardware?: IHardware | null
}

/**
 * Spec 017: LLM enrichment audit trail. One entry per extractable field.
 * Top-level IRobot fields reflect only values whose confidence ≥ threshold
 * (default 0.7); the full {value, confidence} record lives here.
 */
export interface IRobotEnrichment {
  input_hash: string
  extracted_at: string
  dof?: { value: number | null; confidence: number }
  weight_kg?: { value: number | null; confidence: number }
  price_usd?: { value: number | null; confidence: number }
  price_availability?: { value: IPriceAvailability; confidence: number }
  description_sentence?: { value: string | null; confidence: number }
  description_paragraph?: { value: string | null; confidence: number }
  sensors?: { value: string[] | null; confidence: number }
  actuators?: { value: string | null; confidence: number }
}

/**
 * Policy record — matches Festivus data API /v1/policies response.
 */
export interface IPolicy {
  id: string
  slug: string
  name: string
  author: string
  framework: string
  license: string
  task_description: string
  skill_type: ISkillType | string   // bulk data has values beyond the enum
  action_space: IActionSpace
  observation_space: IObservationSpace
  compatible_robot_slugs: string[]
  compatible_env_slugs: string[]
  benchmarks: IBenchmark[]
  /** Bulk-scraped policies without a HuggingFace repo id are null. */
  hf_repo_id: string | null
  paper_arxiv_url: string | null
  evidence_level: IEvidenceLevel
  taxonomy?: IPolicyTaxonomy | null
}

/**
 * Dataset record — matches Festivus data API /v1/datasets response.
 */
export interface IDataset {
  id: string
  slug: string
  name: string
  description: string
  episodes: number | null
  robots: number
  robot_names: string[]
  source: string
  hf_dataset_id: string | null
  format: IDatasetFormat | string   // bulk data has values beyond the enum
  compatible_policy_slugs: string[]
}

/**
 * Benchmark record — matches Festivus data API /v1/benchmarks response.
 */
export interface IBenchmarkRecord {
  id: string
  slug: string
  name: string
  description: string
  task_scope: string
  metric: string
  linked_policy_slugs: string[]
  linked_dataset_slugs: string[]
  source_url: string
  environment: IBenchmarkEnvironment
  difficulty: string
  baseline_results: Record<string, unknown>[]
}

/**
 * Simulation environment — matches Festivus data API /v1/environments response.
 */
/**
 * Environment kind discriminator. A given environment can apply to
 * simulation, physical deployment, both, or have it unspecified.
 * - "simulated": exists only in a simulator (e.g., ManiSkill kitchen)
 * - "physical":  real-world location (e.g., warehouse aisle)
 * - "both":      a real location AND a faithful sim twin
 * - null:        not yet classified
 */
export type IEnvironmentKind = "simulated" | "physical" | "both" | null

export interface IEnvironment {
  id: string
  slug: string
  name: string
  /** Whether this environment is simulated, physical, both, or unclassified. */
  kind: IEnvironmentKind
  simulator: ISimulator | string    // bulk may have unlisted simulators
  scene: string
  description: string
  conditions: IEnvironmentConditions
  compatible_robot_slugs: string[]
  deploy_command: string
  preview_description: string
}

/**
 * Catalog SKU for a real, purchasable piece of robot hardware — one
 * specific product (a camera model, a servo, a compute module, etc.).
 * Stored one-row-per-SKU in the `hardware` table.
 *
 * Distinct from `IHardware`, which is a UI-side composite breakdown of
 * a whole robot's physical components for policy detail pages.
 */
export type IHardwareKind = "sensor" | "actuator" | "compute" | "power" | "other"

export interface IHardwareSKU {
  id: string
  slug: string
  name: string
  kind: IHardwareKind
  manufacturer: string
  description: string
  specs: Record<string, string | number | boolean>
}

/**
 * Deployment/safety note.
 */
export interface IDeployNote {
  id: string
  slug: string
  name: string
  robot_type: IRobotType
  severity: ISeverity
  description: string
}

/**
 * Academic paper reference.
 */
export interface IPaper {
  id: string
  title: string
  authors: string[]
  venue: string
  date: string
  arxiv_url: string | null
  citations: number
  robot_tags: string[]
  policy_tags: string[]
  task_tags: string[]
  abstract: string
}

/**
 * Task entity — a concrete robotics task that connects questions to robots/policies.
 * NEW: did not exist before. Added because tasks are first-class in every query shape.
 */
export interface ITask {
  id: string
  slug: string
  name: string
  category: ISkillType
  description: string
  sub_tasks: string[]
  required_capabilities: string[]
  compatible_robot_types: IRobotType[]
  compatible_policy_slugs: string[]
  difficulty: "easy" | "medium" | "hard" | "unsolved"
  has_real_world_demo: boolean
}

/**
 * Compatibility edge — an explicit row linking a robot to a policy with evidence.
 * NEW: replaces the loose compatible_*_slugs arrays with structured evidence.
 * This is the moat. Without it, cross-domain queries return nothing.
 */
export interface ICompatibilityEdge {
  /**
   * Synthetic unique key, required by the JSONB domain table pattern.
   * Convention: `${robot_slug}__${policy_slug}__${environment ?? 'global'}`.
   * Seeding code is responsible for populating it deterministically so
   * re-seeds upsert cleanly.
   */
  slug: string
  robot_slug: string
  policy_slug: string
  status: ICompatibilityStatus
  success_rate: number | null
  episodes_tested: number | null
  environment: string | null
  source: "paper" | "community" | "inferred" | "taxonomy-match"
  evidence_url: string | null
  gaps: string[]
  updated_at: string
}

/**
 * Task-scoped compatibility edge for the "does policy X work on robot Y
 * for task T?" question. Introduced for spec 021 (laundry folding). Kept
 * separate from ICompatibilityEdge so task-specific fields (tier, license
 * shorthand, evidence URLs) don't pollute the general edge shape.
 */
export interface ILaundryCompatEdge {
  slug: string
  robot_slug: string
  policy_slug: string
  policy_name: string
  policy_hf_url: string | null
  task_slug: "fold-laundry"
  tier: 1 | 2 | 3
  status: "validated" | "plausible-untested" | "reported-failed" | "incompatible"
  environment: string
  simulator_first: boolean
  evidence_type: string
  evidence_url: string | null
  additional_evidence_urls: string[]
  policy_license: string
  license_short: "commercial-ok" | "non-commercial" | "check-terms"
  confidence: "high" | "medium" | "low"
  notes: string
  sourced_at: string
}

// ── Deploy notes by robot type (festivus app seed format) ─────────

export interface IDeployNoteEntry {
  severity: ISeverity
  note: string
}

export interface IDeployNotesByType {
  by_robot_type: Record<string, IDeployNoteEntry[]>
}

// ── API response wrappers ─────────────────────────────────────────

export interface IPaginatedResponse<T> {
  count: number
  limit: number
  offset: number
  results: T[]
}

export interface IRobotFullResponse {
  robot: IRobot
  policies: IPolicy[]
  datasets: IDataset[]
}

// ── Workbench Canvas ────────────────────────────────────────────────

export interface ICanvasNode {
  id: string
  type: "robot" | "task" | "policy" | "environment" | "dataset" | "results" | "deployment"
  data: Record<string, unknown>
  status: string
  explorationGroup?: string
  positionHint?: string
}

export interface IConnection {
  fromId: string
  toId: string
  status: string
  label?: string
}

/**
 * One API request made by the agent while assembling this message.
 * Captured from the server-side FestivusClient and forwarded over the SSE
 * stream so the workbench "Show process" disclosure can display the exact
 * wire URLs. Users can copy/paste the URL into a browser tab to inspect
 * the same JSON the agent saw.
 */
export interface IAgentApiCall {
  /** Tool name the model invoked, e.g. "search_robots". */
  name: string
  /** Fully-constructed URL that was fetched, including query string. */
  url: string
  /** Wall-clock time the request took on the server. */
  duration_ms: number
}

export interface IAgentMessage {
  role: "agent" | "user"
  specialist?: string
  message: string
  thinking?: string
  /**
   * API calls the agent made in the turn that produced this message.
   * Present on agent messages only; absent on user messages and on agent
   * messages that didn't touch the dataset API.
   */
  api_calls?: IAgentApiCall[]
}

export interface ITrayItem {
  node: ICanvasNode
  addedAt: number
}

export interface ISnapshot {
  label: string
  canvasNodes: ICanvasNode[]
  connections: IConnection[]
  tray: ITrayItem[]
  timestamp: number
}

// ── Workbench Persistence ───────────────────────────────────────────

export interface IPersistedWorkbenchState {
  version: 1
  projectId: string
  name: string
  canvasNodes: ICanvasNode[]
  connections: IConnection[]
  messages: IAgentMessage[]
  snapshots: ISnapshot[]
  tray: ITrayItem[]
  selectedInGroup: Record<string, string>
  createdAt: number
  updatedAt: number
}

export interface IProjectSummary {
  projectId: string
  name: string
  nodeCount: number
  updatedAt: number
  createdAt: number
}

export interface IProjectStore {
  save(projectId: string, state: IPersistedWorkbenchState): Promise<void>
  load(projectId: string): Promise<IPersistedWorkbenchState | null>
  list(): Promise<IProjectSummary[]>
  delete(projectId: string): Promise<void>
}

// ── Auth ────────────────────────────────────────────────────────────

export interface IUser {
  id: string
  email: string | null
  name: string | null
  imageUrl: string | null
}

export interface IAuthProvider {
  getUser(request?: Request): Promise<IUser | null>
}

// ── Mutations (agentic data updates) ──────────────────────────────

/** Status of a mutation in the moderator queue. */
export type IMutationStatus = "pending_review" | "approved" | "rejected" | "reverted"

/**
 * A recorded data mutation. Every PATCH to a domain record creates one
 * of these. Edits land optimistically (live immediately) and sit in
 * pending_review until a moderator approves, rejects, or reverts.
 */
export interface IMutation {
  id: number
  created_at: string
  table_name: string
  slug: string
  field_path: string
  actor_id: string
  actor_email: string | null
  // FK to users.id (spec 029). Null for pre-spec rows, populated for all
  // rows created after Step 1.4 when the caller's api_key.owner_id or
  // req.user.id resolves to a known user.
  author_id: string | null
  reason: string | null
  patch: Record<string, unknown>
  old_values: Record<string, unknown>
  new_values: Record<string, unknown>
  status: IMutationStatus
  reviewed_by: string | null
  reviewed_at: string | null
  review_note: string | null
}

/** Body for POST /v1/mutations/:id/review */
export interface IMutationReviewPayload {
  action: "approve" | "reject" | "revert"
  note?: string
}

/** Body for PATCH /v1/write/:table/:slug (extended with actor context) */
export interface IPatchPayload {
  patch: Record<string, unknown>
  reason?: string
}

// ═══════════════════════════════════════════════════════════════════
// APP-SPECIFIC UI TYPES
//
// These types are used by the festivus web app's rich UI pages
// (policy detail, evaluator, explore). They are NOT part of the
// Festivus data API wire format. They will eventually be replaced
// by richer API responses, but for now they power the frontend.
//
// DO NOT confuse these with the wire-format types above.
// ═══════════════════════════════════════════════════════════════════

// ── Rich hardware specs (used by seed.ts policy detail pages) ─────

export interface ISensor {
  type: "camera" | "imu" | "force-torque" | "lidar" | "joint-encoder" | "tactile" | "other"
  name: string
  specs?: Record<string, string>
}

export interface IActuator {
  type: "servo" | "bldc" | "stepper" | "hydraulic" | "pneumatic" | "other"
  name: string
  count: number
}

/**
 * Rich hardware description for UI display.
 * NOT the same as IRobot (wire format). This is a structured breakdown
 * of a robot's physical components for the policy detail pages.
 */
export interface IHardware {
  id: string
  name: string
  manufacturer: string
  type: "arm" | "quadruped" | "biped" | "mobile" | "dual-arm" | "other"
  degreesOfFreedom: number
  sensors: ISensor[]
  actuators: IActuator[]
  description: string
}

// ── Sim environment (lightweight, for evaluator UI) ───────────────

/**
 * Lightweight sim environment for the evaluator page.
 * The wire-format IEnvironment has more fields (conditions, deploy_command, etc.)
 */
export interface ISimEnvironment {
  id: string
  name: string
  simulator: "mujoco" | "isaac-sim" | "pybullet" | "isaac-gym" | "habitat" | "genesis" | "other"
  scene: string
  description: string
}

// ── Policy detail (rich per-robot evidence) ───────────────────────

export type ITestStatus = "tested" | "not-tested" | "no-data"

export type IHardwareCompatibility = "yes" | "partial" | "no" | "untested"

export interface ICompatibilityEntry {
  robotName: string
  robotSlug: string
  hardwareCompatibility: IHardwareCompatibility
  compatibilityNote?: string
  realWorld: {
    status: ITestStatus
    successRate?: number
    episodes?: number
    hoursLogged?: number
    videoUrl?: string
    environment?: string
  }
  simulation: {
    status: ITestStatus
    successRate?: number
    episodes?: number
    simulator?: string
    scene?: string
    videoUrl?: string
  }
  tasksTested: string[]
}

export interface IRobotBenchmarkEntry {
  environment: string
  successRate: number
  episodes: number
  realOrSim: "real" | "sim"
}

export interface IRobotTaskResult {
  task: string
  successRate: number
  notes?: string
}

export interface IRobotBenchmark {
  robotSlug: string
  robotName: string
  benchmarks: IRobotBenchmarkEntry[]
  taskResults: IRobotTaskResult[]
  failureModes: string[]
  alternatives?: {
    policyName: string
    successRate: number
    episodes: number
  }[]
}

export interface IPolicyDetail {
  policySlug: string
  compatibility: ICompatibilityEntry[]
  robotBenchmarks?: IRobotBenchmark[]
  paperUrl?: string
  trainingDataset?: string
  verifiedBy?: string
}

// ── Evaluator (canvas-style policy testing) ─────────────────────────

export type ICompatibilityCheckStatus = "compatible" | "partial" | "incompatible"

export interface ICompatibilityCheck {
  status: ICompatibilityCheckStatus
  actionSpaceMatch: boolean
  controlFrequencyMatch: boolean
  reason?: string
}

export interface IEvaluationResult {
  successRate: number
  episodes: number
  videoUrl?: string
  failureModes: string[]
  notes?: string
}

export interface IEvaluationConfig {
  policySlug: string
  robots: {
    robotSlug: string
    robotName: string
    compatibility: ICompatibilityCheck
    environments: {
      environmentId: string
      result?: IEvaluationResult
    }[]
  }[]
  environments: ISimEnvironment[]
}

// ── Rich benchmark (for app UI, not wire format) ────────────────────

export interface IBenchmarkResult {
  metric: string
  value: number
  unit: string
  environment: "sim" | "real"
  details?: string
}

// ── Rich policy (for seed.ts, policy browse/detail pages) ──────────

/**
 * Rich policy type used by seed.ts and policy pages.
 * Contains hardware references, download stats, paper references etc.
 * NOT the wire format — see IPolicy above for API data.
 */
export interface IRichPolicy {
  id: string
  slug: string
  name: string
  description: string
  taskDescription: string
  author: string
  task: string
  skillType: ISkillType
  tags: string[]
  framework: string
  license: string
  hardware: IHardware[]
  actionSpace: {
    type: string
    dimensions: number
    controlFrequencyHz: number
    description?: string
  }
  observationSpace: {
    type: string
    components: { name: string; type: string; shape?: number[] }[]
    description?: string
  }
  simulationConfig?: {
    environment: string
    environmentVersion?: string
    scene?: string
    domainRandomization: boolean
    description?: string
  }
  benchmarks: IBenchmarkResult[]
  evidence: {
    level: "verified" | "sim-tested" | "model-card-only"
    realWorldVideos: number
    simVideos: number
    realWorldEpisodes: number
    simEpisodes: number
    testedRobots: number
    testedEnvironments: number
  }
  downloads?: { lastMonth: number; trend: number[] }
  paper?: {
    title: string
    arxivUrl: string
    publishedDate: string
    citations: number
    authors: { name: string; affiliation?: string; hfUrl?: string; githubUrl?: string; avatarUrl?: string }[]
  }
  trainingDataset?: {
    name: string
    episodes: number
    robots: number
    source: string
    hfDatasetId?: string
  }
  thumbnailUrl?: string
  hfRepoId?: string
  createdAt: string
  updatedAt: string
}

// ── Rich robot (for seed.ts, camelCase with nested hardware) ────────

/**
 * Rich robot type used by seed.ts and robot detail pages.
 * Contains nested IHardware, camelCase fields.
 * NOT the wire format — see IRobot above for API data.
 */
export interface IRichRobot {
  id: string
  slug: string
  name: string
  manufacturer: string
  description: string
  hardware: IHardware
  compatiblePolicySlugs: string[]
  imageUrl?: string
  urdfUrl?: string
  createdAt: string
}

// ── Rich dataset (for explore page, camelCase) ──────────────────────

/**
 * Dataset type for explore-data.ts (camelCase, app-specific).
 * Wire format IDataset uses snake_case.
 */
export interface IRichDataset {
  id: string
  slug: string
  name: string
  description: string
  episodes: number
  robots: number
  robotNames: string[]
  source: string
  hfDatasetId?: string
  policySlug?: string
}
