/**
 * Per-table Zod schemas for validating PATCH payloads.
 *
 * Spec 029: the schemas are **allowlists** of agent-editable scalar fields.
 * Any field not explicitly listed is rejected with a structured error shape:
 *
 *   { error: "field_not_agent_editable", field: <name>, table: <table> }
 *
 * The allowlist is documented in `docs/exec-plans/active/029-field-allowlist.md`
 * and intentionally excludes: `name`, `slug`, `id`, `*_id`, `hf_*`, arrays,
 * nested-object / JSONB fields. Moderation and mint flows still use other
 * validators; only this one is the PATCH-for-agent gate.
 *
 * These mirror the TypeScript interfaces in @festivus/types but live here
 * because @festivus/types is types-only (no runtime deps). The Zod schemas
 * in apps/web/src/lib/schemas/domain.ts serve the frontend; these serve
 * the API write path.
 */
import { z } from "zod"
import type { IDomainTable } from "../repo/types.js"

// ── Shared enum schemas ─────────────────────────────────────────────
// Only enums referenced by ✅ fields appear here. Nested-object /
// array sub-schemas (e.g. buildPathSchema) are intentionally absent
// because the fields that used them are all ❌ per the allowlist.

const robotTypeSchema = z.enum(["arm", "dual-arm", "quadruped", "humanoid", "drone", "rover"])
const deployReadinessSchema = z.enum(["lab_only", "ce_marked", "field_deployed"])
const formFactorSchema = z.enum(["humanoid", "quadruped", "wheeled", "arm-fixed", "arm-mobile", "drone"])
const priceAvailabilitySchema = z.enum(["public", "on_request", "not_public", "unknown"])
const communitySizeSchema = z.enum(["small", "medium", "large"])
const evidenceLevelSchema = z.enum(["verified", "reported", "community", "untested"])
const skillTypeSchema = z.enum(["manipulation", "locomotion", "navigation", "aerial", "other"])
const severitySchema = z.enum(["critical", "warning", "info"])
const compatibilityStatusSchema = z.enum(["verified", "reported", "inferred", "untested"])

// ── Per-table allowlist schemas (strict + partial) ──────────────────
// .strict() makes Zod reject unknown keys instead of stripping them,
// so forbidden fields surface as `unrecognized_keys` errors and get
// translated to field_not_agent_editable by validatePatch below.
// .partial() makes every field optional — PATCH callers only send
// what they're changing.

const robotPatchSchema = z.object({
  manufacturer: z.string(),
  type: robotTypeSchema,
  dof: z.number().nullable(),
  actuators: z.string().nullable(),
  price_usd: z.number().nullable(),
  weight_kg: z.number().nullable(),
  deploy_readiness: deployReadinessSchema,
  image_url: z.string().nullable(),
  community_size: communitySizeSchema,
  description: z.string(),
  product_page_url: z.string(),
  category: z.string(),
  form_factor: formFactorSchema,
  price_availability: priceAvailabilitySchema,
}).strict().partial()

const policyPatchSchema = z.object({
  author: z.string(),
  framework: z.string(),
  license: z.string(),
  task_description: z.string(),
  skill_type: z.string(),
  paper_arxiv_url: z.string().nullable(),
  evidence_level: evidenceLevelSchema,
}).strict().partial()

const datasetPatchSchema = z.object({
  description: z.string(),
  episodes: z.number().nullable(),
  robots: z.number(),
  source: z.string(),
  format: z.string(),
}).strict().partial()

const benchmarkRecordPatchSchema = z.object({
  description: z.string(),
  task_scope: z.string(),
  metric: z.string(),
  source_url: z.string(),
  environment: z.enum(["sim", "real"]),
  difficulty: z.string(),
}).strict().partial()

const environmentPatchSchema = z.object({
  kind: z.enum(["simulated", "physical", "both"]).nullable(),
  simulator: z.string(),
  scene: z.string(),
  description: z.string(),
  deploy_command: z.string(),
  preview_description: z.string(),
}).strict().partial()

const deployNotePatchSchema = z.object({
  robot_type: robotTypeSchema,
  severity: severitySchema,
  description: z.string(),
}).strict().partial()

const paperPatchSchema = z.object({
  venue: z.string(),
  date: z.string(),
  arxiv_url: z.string().nullable(),
  citations: z.number(),
  abstract: z.string(),
}).strict().partial()

const taskPatchSchema = z.object({
  category: skillTypeSchema,
  description: z.string(),
  difficulty: z.enum(["easy", "medium", "hard", "unsolved"]),
  has_real_world_demo: z.boolean(),
}).strict().partial()

const hardwarePatchSchema = z.object({
  kind: z.enum(["sensor", "actuator", "compute", "power", "other"]),
  manufacturer: z.string(),
  description: z.string(),
}).strict().partial()

const compatibilityEdgePatchSchema = z.object({
  status: compatibilityStatusSchema,
  success_rate: z.number().nullable(),
  episodes_tested: z.number().nullable(),
  environment: z.string().nullable(),
  source: z.enum(["paper", "community", "inferred", "taxonomy-match"]),
  evidence_url: z.string().nullable(),
}).strict().partial()

const laundryCompatEdgePatchSchema = z.object({
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  status: z.enum(["validated", "plausible-untested", "reported-failed", "incompatible"]),
  environment: z.string(),
  simulator_first: z.boolean(),
  evidence_type: z.string(),
  evidence_url: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  notes: z.string(),
}).strict().partial()

// ── Lookup ──────────────────────────────────────────────────────────

const PATCH_SCHEMAS: Record<IDomainTable, z.ZodType> = {
  robots: robotPatchSchema,
  policies: policyPatchSchema,
  datasets: datasetPatchSchema,
  benchmarks: benchmarkRecordPatchSchema,
  deploy_notes: deployNotePatchSchema,
  environments: environmentPatchSchema,
  tasks: taskPatchSchema,
  papers: paperPatchSchema,
  hardware: hardwarePatchSchema,
  compatibility_edges: compatibilityEdgePatchSchema,
  laundry_compat_edges: laundryCompatEdgePatchSchema,
}

/**
 * Issue #64: when the validator rejects a field, callers want the list of
 * *allowed* fields so they can self-correct on the next try. Reading the
 * Zod schema's shape is the single source of truth — the allowlist can never
 * drift from what the validator accepts.
 *
 * The underlying schema is `z.object(...).strict().partial()`. Zod v4 exposes
 * the shape through `._def.innerType._def.innerType.shape` for nested
 * wrappers, but `ZodObject#keyof()` and `.shape` work on the outermost
 * wrapper too. We use `.shape` which is the most stable public-ish path.
 */
export function getValidFields(table: IDomainTable): string[] {
  const schema = PATCH_SCHEMAS[table]
  if (!schema) return []
  // `.strict().partial()` wraps z.object(...), but zod 4 keeps `.shape`
  // accessible on the wrapped type. Fall back to walking `_def` if the
  // public accessor ever moves.
  const shape = (schema as unknown as { shape?: Record<string, unknown> }).shape
  if (shape) return Object.keys(shape).sort()
  const inner = (schema as unknown as { _def?: { shape?: () => Record<string, unknown> } })._def
  const shapeFn = inner?.shape
  if (typeof shapeFn === "function") return Object.keys(shapeFn()).sort()
  return []
}

/**
 * Issue #65: emit an OpenAPI-flavored description of the per-table patch
 * schema so `/v1/openapi.json` can enumerate writable columns with their
 * types instead of advertising `additionalProperties: true`. Walks the Zod
 * shape of `PATCH_SCHEMAS[table]` — the same source of truth that
 * validatePatch uses at runtime — so the manifest can never drift from the
 * gate.
 *
 * Keeps the translator narrow: only the Zod constructs that actually appear
 * in patch-schemas.ts are handled. Unknown shapes fall through to
 * `{ type: "string" }` so the manifest still parses; test coverage forces
 * us to extend this when a new Zod construct lands.
 */
export interface IOpenApiPropertySchema {
  type: "string" | "number" | "boolean" | "integer"
  enum?: (string | number)[]
  nullable?: true
  description?: string
}

export interface IOpenApiPatchBody {
  type: "object"
  properties: Record<string, IOpenApiPropertySchema>
  additionalProperties: false
}

function zodFieldToOpenApi(fieldSchema: unknown): IOpenApiPropertySchema {
  // Zod v4 wraps every `.partial()` field in an Optional. Unwrap it first.
  const optDef = (fieldSchema as { _def?: { type?: string; innerType?: unknown } })._def
  if (optDef?.type === "optional" && optDef.innerType) {
    return zodFieldToOpenApi(optDef.innerType)
  }

  const def = (fieldSchema as { _def?: { type?: string; innerType?: unknown; entries?: Record<string, unknown>; options?: unknown[] } })._def
  if (!def) return { type: "string" }

  // Nullable wrapper: translate the inner type, add nullable:true.
  if (def.type === "nullable" && def.innerType) {
    const inner = zodFieldToOpenApi(def.innerType)
    return { ...inner, nullable: true }
  }
  if (def.type === "string") return { type: "string" }
  if (def.type === "number") return { type: "number" }
  if (def.type === "boolean") return { type: "boolean" }
  if (def.type === "enum" && def.entries) {
    return { type: "string", enum: Object.keys(def.entries) }
  }
  if (def.type === "union" && Array.isArray(def.options)) {
    // Literal unions like z.union([z.literal(1), z.literal(2), z.literal(3)])
    // collapse into a single-type enum. Heterogeneous unions fall through.
    const literals = def.options
      .map((o) => (o as { _def?: { type?: string; values?: unknown[] } })._def)
      .filter((d) => d?.type === "literal" && Array.isArray(d.values) && d.values.length === 1)
      .map((d) => d!.values![0])
    if (literals.length === def.options.length && literals.length > 0) {
      const allNumbers = literals.every((v) => typeof v === "number")
      const allIntegers = allNumbers && literals.every((v) => Number.isInteger(v as number))
      if (allIntegers) {
        return { type: "integer", enum: literals as number[] }
      }
      if (allNumbers) {
        return { type: "number", enum: literals as number[] }
      }
      return { type: "string", enum: literals as string[] }
    }
  }
  return { type: "string" }
}

export function getPatchOpenApiSchema(table: IDomainTable): IOpenApiPatchBody {
  const schema = PATCH_SCHEMAS[table]
  // `.strict().partial()` keeps `.shape` accessible on the outer wrapper.
  const shape = (schema as unknown as { shape?: Record<string, unknown> }).shape ?? {}
  const properties: Record<string, IOpenApiPropertySchema> = {}
  for (const [name, fieldSchema] of Object.entries(shape)) {
    properties[name] = zodFieldToOpenApi(fieldSchema)
  }
  return {
    type: "object",
    properties,
    additionalProperties: false,
  }
}

/**
 * Structured error entry. When `code === "field_not_agent_editable"`, the
 * chat SSE stream surfaces the specific field + table to Claude so the model
 * can apologise coherently to the user.
 */
export interface IFieldRejection {
  code: "field_not_agent_editable"
  field: string
  table: IDomainTable
}

export interface IValidationResult {
  valid: boolean
  data?: Record<string, unknown>
  /** Zod issue messages (type mismatches, format errors, etc). */
  errors?: string[]
  /** Forbidden-field rejections (one entry per offending key). */
  field_rejections?: IFieldRejection[]
}

/**
 * Validate a patch payload against the schema for the given table.
 * Returns validated (stripped) data on success, or a structured error
 * on failure:
 *
 *   - `field_rejections` populated when the patch names a field outside
 *     the per-table allowlist (spec 029). `valid` is `false`.
 *   - `errors` populated when the field exists but its value doesn't
 *     match the expected type (ordinary Zod validation failure).
 *
 * `id` and `slug` are always stripped silently as a pre-step — they
 * represent identifiers and pre-date spec 029's allowlist regime.
 */
export function validatePatch(table: IDomainTable, patch: Record<string, unknown>): IValidationResult {
  const schema = PATCH_SCHEMAS[table]
  if (!schema) {
    return { valid: false, errors: [`no patch schema for table: ${table}`] }
  }

  const { id: _id, slug: _slug, ...rest } = patch
  const result = schema.safeParse(rest)

  if (result.success) {
    return { valid: true, data: result.data as Record<string, unknown> }
  }

  const fieldRejections: IFieldRejection[] = []
  const otherErrors: string[] = []
  for (const issue of result.error.issues) {
    if (issue.code === "unrecognized_keys") {
      const keys = (issue as { keys?: string[] }).keys ?? []
      for (const key of keys) {
        fieldRejections.push({ code: "field_not_agent_editable", field: key, table })
      }
    } else {
      otherErrors.push(`${issue.path.join(".")}: ${issue.message}`)
    }
  }

  if (fieldRejections.length > 0) {
    return {
      valid: false,
      field_rejections: fieldRejections,
      ...(otherErrors.length > 0 ? { errors: otherErrors } : {}),
    }
  }
  return { valid: false, errors: otherErrors }
}
