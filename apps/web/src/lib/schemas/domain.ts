/**
 * Zod schemas for all domain types.
 *
 * These validate data at runtime boundaries:
 * - When loading seed JSON files
 * - When receiving API responses from Festivus data API
 * - When the agent tool calls reference domain entities
 *
 * WHEN DATA CHANGES:
 * 1. Update the TypeScript interface in @festivus/types
 * 2. Update this Zod schema to match
 * 3. pnpm check + pnpm test will catch any mismatch
 *
 * Zod schemas are the RUNTIME safety net. TypeScript interfaces are
 * the COMPILE-TIME safety net. Both must agree.
 */

import { z } from "zod"

// ── Enum schemas ──────────────────────────────────────────────────

export const robotTypeSchema = z.enum(["arm", "dual-arm", "quadruped", "humanoid", "drone", "rover"])

export const skillTypeSchema = z.enum(["manipulation", "locomotion", "navigation", "aerial", "other"])

export const evidenceLevelSchema = z.enum(["verified", "reported", "community", "untested"])

export const deployReadinessSchema = z.enum(["lab_only", "ce_marked", "field_deployed"])

export const formFactorSchema = z.enum(["humanoid", "quadruped", "wheeled", "arm-fixed", "arm-mobile", "drone"])

export const priceAvailabilitySchema = z.enum(["public", "on_request", "not_public", "unknown"])

export const communitySizeSchema = z.enum(["small", "medium", "large"])

export const datasetFormatSchema = z.enum(["lerobot", "rlds", "hdf5", "parquet", "other"])

export const severitySchema = z.enum(["critical", "warning", "info"])

export const simulatorSchema = z.enum([
  "mujoco", "isaac-sim", "isaac-gym", "pybullet", "habitat", "genesis", "coppeliasim", "other",
])

export const benchmarkEnvironmentSchema = z.enum(["sim", "real"])

export const compatibilityStatusSchema = z.enum(["verified", "reported", "inferred", "untested"])

export const buildPathTypeSchema = z.enum(["buy", "print", "kit"])

// ── Nested structure schemas ──────────────────────────────────────

export const buildPathSchema = z.object({
  path: buildPathTypeSchema,
  cost_usd: z.number(),
  build_time_days: z.number(),
  purchase_url: z.string(),
})

export const actionSpaceSchema = z.object({
  type: z.string(),
  dimensions: z.number().nullable(),
  frequency_hz: z.number().nullable(),
})

export const observationSpaceSchema = z.object({
  type: z.string(),
  components: z.array(z.string()),
})

export const benchmarkSchema = z.object({
  robot: z.string(),
  environment: z.string(),
  success_rate: z.number().nullable(),
  episodes: z.number(),
})

export const environmentConditionsSchema = z.object({
  location: z.string(),
  surface: z.string(),
  lighting: z.string(),
  objects: z.string(),
  obstacles: z.string(),
  physics: z.string(),
  scale: z.string(),
})

export const deploymentContextSchema = z.object({
  // Pydantic has @field_validator(mode="before") on these two fields
  // that coerces a bare string into a single-element list, so real
  // API records arrive in either shape. Zod must preprocess to match
  // or parsePaginated returns null and the Hardware Scout sees
  // "unavailable" even when the dataset is healthy (Lesson 59).
  autonomy: z.preprocess(
    (v) => (typeof v === "string" ? [v] : v),
    z.array(z.string()),
  ),
  industry: z.preprocess(
    (v) => (typeof v === "string" ? [v] : v),
    z.array(z.string()),
  ),
})

export const robotTaxonomySchema = z.object({
  embodiment: z.string(),
  mobility: z.string(),
  actuation: z.string(),
  control_interfaces: z.array(z.string()),
  perception: z.array(z.string()),
  deployment_context: deploymentContextSchema,
})

// Bulk records sometimes ship `required_control` and `required_perception`
// as a bare scalar string (one control/perception mode) rather than a list.
// Accept either shape on the wire and normalize to an array so downstream
// consumers see a stable type. One scalar → one-element array; null/undefined
// → empty array, which is equivalent to "unknown".
const stringOrStringArray = z
  .union([z.string(), z.array(z.string()), z.null()])
  .transform((v) => (v === null ? [] : typeof v === "string" ? [v] : v))

export const policyTaxonomySchema = z.object({
  required_control: stringOrStringArray,
  required_perception: stringOrStringArray,
  action_dimensions: z.number().nullable(),
})

// ── Provenance overlay (Phase 5.2) ────────────────────────────────
// Per-field provenance lives in an optional `_meta` envelope on every record.
// Captures HOW each field was populated (paper, vendor PDF, type default,
// scraped HF). Same principle as compatibility edge tiers but at the field
// level. Most records don't carry it yet — the envelope is purely additive.

export const fieldProvenanceSchema = z.object({
  source: z.string().nullish(),       // "paper" | "vendor-pdf" | "type-default" | "scraped-hf" | ...
  confidence: z.string().nullish(),   // "high" | "medium" | "low"
  needs_review: z.boolean().optional(),
  notes: z.string().nullish(),
  updated_at: z.string().nullish(),
}).passthrough()

// RecordMeta is dict-keyed by field name. Pydantic uses model_config={"extra":"allow"}
// for arbitrary keys; the Zod equivalent is z.record(z.string(), provenance).
export const recordMetaSchema = z.record(z.string(), fieldProvenanceSchema)

// ── Core domain entity schemas ────────────────────────────────────

// Robot schema must accept BOTH curated (taxonomy=null, image_url present)
// AND bulk-scraped (taxonomy=object, image_url=null, dof/price/weight=null) shapes.
// See plan lessons 1, 5 — Pydantic tolerates both formats; the wire response mixes them.
export const robotSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  manufacturer: z.string(),
  type: robotTypeSchema,
  dof: z.number().nullable(),
  sensors: z.array(z.string()),
  actuators: z.string().nullable(),
  price_usd: z.number().nullable(),
  weight_kg: z.number().nullable(),
  build_paths: z.array(buildPathSchema),
  deploy_readiness: deployReadinessSchema,
  compatible_policy_slugs: z.array(z.string()),
  compatible_env_slugs: z.array(z.string()),
  image_url: z.string().nullable(),
  community_size: communitySizeSchema,
  description: z.string(),
  taxonomy: robotTaxonomySchema.nullish(),
  _meta: recordMetaSchema.nullish(),
  // Spec 017: corpus reset invariants
  product_page_url: z.string(),
  category: z.string(),
  form_factor: formFactorSchema,
  price_availability: priceAvailabilitySchema,
  image_source_url: z.string().nullish(),
  aliases: z.array(z.string()).nullish(),
})

export const policySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  author: z.string(),
  framework: z.string(),
  license: z.string(),
  task_description: z.string(),
  skill_type: z.string(),  // union with string for bulk data flexibility
  action_space: actionSpaceSchema,
  observation_space: observationSpaceSchema,
  compatible_robot_slugs: z.array(z.string()),
  compatible_env_slugs: z.array(z.string()),
  benchmarks: z.array(benchmarkSchema),
  hf_repo_id: z.string().nullable(),
  paper_arxiv_url: z.string().nullable(),
  evidence_level: evidenceLevelSchema,
  taxonomy: policyTaxonomySchema.nullish(),
  _meta: recordMetaSchema.nullish(),
})

export const datasetSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  episodes: z.number().nullable(),
  robots: z.number(),
  robot_names: z.array(z.string()),
  source: z.string(),
  hf_dataset_id: z.string().nullable(),
  format: z.string(),
  compatible_policy_slugs: z.array(z.string()),
  _meta: recordMetaSchema.nullish(),
})

export const environmentKindSchema = z.enum(["simulated", "physical", "both"]).nullable()

export const environmentSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  /**
   * Sim vs physical discriminator. Optional on the wire so legacy
   * environment records that predate this field still parse — we coerce
   * a missing value to null ("unclassified") rather than rejecting.
   */
  kind: environmentKindSchema.default(null),
  simulator: z.string(),
  scene: z.string(),
  description: z.string(),
  conditions: environmentConditionsSchema,
  compatible_robot_slugs: z.array(z.string()),
  deploy_command: z.string(),
  preview_description: z.string(),
  _meta: recordMetaSchema.nullish(),
})

export const deployNoteSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  robot_type: robotTypeSchema,
  severity: severitySchema,
  description: z.string(),
  _meta: recordMetaSchema.nullish(),
})

export const paperSchema = z.object({
  id: z.string(),
  title: z.string(),
  authors: z.array(z.string()),
  venue: z.string(),
  date: z.string(),
  arxiv_url: z.string().nullable(),
  citations: z.number(),
  robot_tags: z.array(z.string()),
  policy_tags: z.array(z.string()),
  task_tags: z.array(z.string()),
  abstract: z.string(),
  _meta: recordMetaSchema.nullish(),
})

export const taskSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  category: skillTypeSchema,
  description: z.string(),
  sub_tasks: z.array(z.string()),
  required_capabilities: z.array(z.string()),
  compatible_robot_types: z.array(robotTypeSchema),
  compatible_policy_slugs: z.array(z.string()),
  difficulty: z.enum(["easy", "medium", "hard", "unsolved"]),
  has_real_world_demo: z.boolean(),
  _meta: recordMetaSchema.nullish(),
})

// Reliability tier matrix. Every (source, status) pair must map to a tier in
// {1, 2, 3, 4} or the edge is rejected as impossible. See spec section
// "Compatibility edge reliability tiers" — the whole point of the system is
// to expose gaps instead of hallucinate confidence, so a paper-source edge
// MUST claim verification, not inference.
//
// Tier 1: paper-verified            (cite arxiv, real benchmark)
// Tier 2: community-reported        (claimed by practitioners, no paper)
// Tier 3: hand-inferred / untested  (a human reasoned about it but didn't run it)
// Tier 4: taxonomy-match            (a script matched it, nobody tested it)
export type IReliabilityTier = 1 | 2 | 3 | 4

const VALID_TIER_COMBOS: Record<string, IReliabilityTier> = {
  "paper:verified": 1,
  "paper:reported": 2,
  "community:verified": 2,
  "community:reported": 2,
  "inferred:untested": 3,
  "inferred:inferred": 3,
  "taxonomy-match:inferred": 4,
  "taxonomy-match:untested": 4,
}

/**
 * Compute the reliability tier for an edge from its source + status.
 * Returns null when the combo is impossible — callers should treat
 * a null tier as "do NOT display this edge as compatibility evidence".
 */
export function reliabilityTier(edge: { source: string; status: string }): IReliabilityTier | null {
  return VALID_TIER_COMBOS[`${edge.source}:${edge.status}`] ?? null
}

// Base shape (without the source/status refinement). Exposed for tooling that
// needs to introspect `.shape` (e.g., the zod-pydantic-agreement contract test).
// Always parse via `compatibilityEdgeSchema` instead, not the base directly.
export const compatibilityEdgeBaseSchema = z.object({
  /**
   * Synthetic unique key for the `compatibility_edges` JSONB table. Convention:
   * `${robot_slug}__${policy_slug}__${environment ?? 'global'}`. Producers
   * (seed scripts, mock fixtures) must populate it deterministically so
   * upserts stay stable across re-seeds.
   */
  slug: z.string(),
  robot_slug: z.string(),
  policy_slug: z.string(),
  status: compatibilityStatusSchema,
  success_rate: z.number().nullable(),
  episodes_tested: z.number().nullable(),
  environment: z.string().nullable(),
  source: z.enum(["paper", "community", "inferred", "taxonomy-match"]),
  evidence_url: z.string().nullable(),
  gaps: z.array(z.string()),
  updated_at: z.string(),
  /** Phase 1.5: API injects this on every edge from /v1/compatibility. */
  reliability_tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).nullish(),
  _meta: recordMetaSchema.nullish(),
})

export const compatibilityEdgeSchema = compatibilityEdgeBaseSchema.superRefine((edge, ctx) => {
  if (reliabilityTier(edge) === null) {
    ctx.addIssue({
      code: "custom",
      message: `impossible source+status combo: source=${edge.source} status=${edge.status}`,
    })
  }
})

// ── Edge aggregation helpers ──────────────────────────────────────
// These helpers exist so the UI never displays a flat "N compatible
// policies" count that conflates tier-1 verified evidence with tier-4
// taxonomy guesses. Always group, never sum.

export interface IEdgeTierSummary {
  tier1: number
  tier2: number
  tier3: number
  tier4: number
  unknown: number
}

export function summarizeEdgesByTier(edges: { source: string; status: string }[]): IEdgeTierSummary {
  const summary: IEdgeTierSummary = { tier1: 0, tier2: 0, tier3: 0, tier4: 0, unknown: 0 }
  for (const edge of edges) {
    const tier = reliabilityTier(edge)
    if (tier === 1) summary.tier1 += 1
    else if (tier === 2) summary.tier2 += 1
    else if (tier === 3) summary.tier3 += 1
    else if (tier === 4) summary.tier4 += 1
    else summary.unknown += 1
  }
  return summary
}

// ── Deploy notes by type (app seed format) ────────────────────────

export const deployNoteEntrySchema = z.object({
  severity: severitySchema,
  note: z.string(),
})

export const deployNotesByTypeSchema = z.object({
  by_robot_type: z.record(z.string(), z.array(deployNoteEntrySchema)),
})

// ── API response wrappers ─────────────────────────────────────────

export const paginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    count: z.number(),
    limit: z.number(),
    offset: z.number(),
    results: z.array(itemSchema),
  })

// ── Parse helpers ─────────────────────────────────────────────────
// Use these at boundaries. They return null on invalid data (log, don't crash).
// Single-record helpers parse one entity (e.g., /v1/robots/{slug}).
// Paginated helpers parse a {count, limit, offset, results} response and return
// just the results array.

function parseList<T extends z.ZodType>(itemSchema: T, raw: unknown):
  z.infer<T>[] | null {
  const result = z.array(itemSchema).safeParse(raw)
  return result.success ? result.data : null
}

function parseOne<T extends z.ZodType>(itemSchema: T, raw: unknown):
  z.infer<T> | null {
  const result = itemSchema.safeParse(raw)
  return result.success ? result.data : null
}

function parsePaginated<T extends z.ZodType>(itemSchema: T, raw: unknown):
  z.infer<T>[] | null {
  const result = paginatedResponseSchema(itemSchema).safeParse(raw)
  return result.success ? result.data.results : null
}

export function parseRobots(raw: unknown) { return parseList(robotSchema, raw) }
export function parseRobot(raw: unknown) { return parseOne(robotSchema, raw) }
export function parseRobotsResponse(raw: unknown) { return parsePaginated(robotSchema, raw) }

export function parsePolicies(raw: unknown) { return parseList(policySchema, raw) }
export function parsePolicy(raw: unknown) { return parseOne(policySchema, raw) }
export function parsePoliciesResponse(raw: unknown) { return parsePaginated(policySchema, raw) }

export function parseDatasets(raw: unknown) { return parseList(datasetSchema, raw) }
export function parseDataset(raw: unknown) { return parseOne(datasetSchema, raw) }
export function parseDatasetsResponse(raw: unknown) { return parsePaginated(datasetSchema, raw) }

export function parseTasks(raw: unknown) { return parseList(taskSchema, raw) }
export function parseTask(raw: unknown) { return parseOne(taskSchema, raw) }
export function parseTasksResponse(raw: unknown) { return parsePaginated(taskSchema, raw) }

export function parseCompatibilityEdges(raw: unknown) { return parseList(compatibilityEdgeSchema, raw) }
export function parseCompatibilityEdgesResponse(raw: unknown) { return parsePaginated(compatibilityEdgeSchema, raw) }

export function parseEnvironments(raw: unknown) { return parseList(environmentSchema, raw) }
export function parseEnvironmentsResponse(raw: unknown) { return parsePaginated(environmentSchema, raw) }

export function parseDeployNotes(raw: unknown) { return parseList(deployNoteSchema, raw) }
export function parseDeployNotesResponse(raw: unknown) { return parsePaginated(deployNoteSchema, raw) }
