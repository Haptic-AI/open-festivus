import { Router } from "express"
import type { IDomainTable } from "../repo/types.js"
import { getPatchOpenApiSchema } from "../validation/patch-schemas.js"

/**
 * Spec 027 phase 4. OpenAPI 3.1 document describing the public read surface
 * plus the Agent write paths Claude needs to edit data.
 *
 * Deliberately hand-written, not generated. Budget: under ~20 KB so an LLM
 * can fetch it once per session without dominating its context window.
 *
 * Issue #65: the write path used to be a single `/v1/write/{table}/{slug}`
 * with `additionalProperties: true` on the patch body. That gave LLMs no
 * way to know which columns are writable without a separate schema probe.
 * Now we emit one concrete path per table, each with a strict per-table
 * patch body generated from the same Zod schemas the runtime validator
 * uses — the manifest can never drift from the gate.
 *
 * Update this file when adding a new endpoint users should see. Internal
 * routes (/v1/mutations/*, /health) are intentionally omitted from the doc.
 */

export function buildOpenApiRouter(): Router {
  const router = Router()

  const DOMAIN_TABLES: IDomainTable[] = [
    "robots", "policies", "datasets", "benchmarks", "deploy_notes",
    "environments", "tasks", "papers", "hardware",
    "compatibility_edges", "laundry_compat_edges",
  ]

  // Issue #65: per-table patch body schemas, derived from Zod.
  // Schema name convention: `<SingularPascal>PatchBody`.
  function tableSchemaName(table: IDomainTable): string {
    const singular = table.endsWith("s") && !table.endsWith("ss") ? table.slice(0, -1) : table
    const pascal = singular
      .split("_")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join("")
    return `${pascal}PatchBody`
  }

  const perTableSchemas: Record<string, unknown> = {}
  const perTableRequestSchemas: Record<string, unknown> = {}
  for (const table of DOMAIN_TABLES) {
    const bodyName = tableSchemaName(table)
    const requestName = `${bodyName}Request`
    perTableSchemas[bodyName] = getPatchOpenApiSchema(table)
    perTableRequestSchemas[requestName] = {
      type: "object",
      properties: {
        patch: { $ref: `#/components/schemas/${bodyName}` },
        reason: {
          type: "string",
          description: "Human-readable explanation for the moderator reviewing this edit.",
        },
      },
      required: ["patch"],
      additionalProperties: false,
    }
  }

  // Shared across all per-table PATCH paths. Defining it once here instead of
  // inlining on each path keeps the manifest under the size budget.
  const sharedPatchResponses = {
    "202": {
      description: "Queued for review.",
      content: { "application/json": { schema: { $ref: "#/components/schemas/PatchResponse" } } },
    },
    "200": { description: "No-op." },
    "401": { description: "Missing/invalid API key." },
    "403": { description: "Key tier is not 'write'." },
    "404": { description: "Slug not found." },
    "422": {
      description: "Unknown column or type mismatch.",
      content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
    },
    "429": { description: "Rate limited (200/24h/user)." },
  }

  function patchPath(table: IDomainTable): Record<string, unknown> {
    const requestName = `${tableSchemaName(table)}Request`
    return {
      patch: {
        tags: ["write"],
        summary: `Edit a ${table} row. Shallow-merges patch; logged as moderator-reviewable mutation.`,
        security: [{ AgentApiKey: [] }],
        parameters: [
          { name: "slug", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: `#/components/schemas/${requestName}` },
            },
          },
        },
        responses: sharedPatchResponses,
      },
    }
  }

  const perTablePaths: Record<string, unknown> = {}
  for (const table of DOMAIN_TABLES) {
    perTablePaths[`/v1/write/${table}/{slug}`] = patchPath(table)
  }

  const doc = {
    openapi: "3.1.0",
    info: {
      title: "Festivus API",
      version: "1.0.0",
      description:
        "Open-source Physical AI catalog. Public reads are key-free. Edits require an Agent API key (minted at https://festivus.hapticlabs.ai/settings/api-keys) and are queued for moderator review.",
      contact: { name: "Festivus", url: "https://festivus.hapticlabs.ai" },
    },
    servers: [
      { url: "https://api.festivus.hapticlabs.ai", description: "Production" },
    ],
    tags: [
      { name: "read", description: "Public reads. No auth required." },
      { name: "write", description: "Agent writes. Require x-api-key with tier=write. Queued for moderator review." },
    ],
    components: {
      securitySchemes: {
        AgentApiKey: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
          description:
            "Agent API key (fek_<32 hex>). Mint at /settings/api-keys with tier=write.",
        },
      },
      parameters: {
        limit: {
          name: "limit",
          in: "query",
          schema: { type: "integer", minimum: 1, maximum: 500, default: 50 },
        },
        offset: {
          name: "offset",
          in: "query",
          schema: { type: "integer", minimum: 0, default: 0 },
        },
        q: {
          name: "q",
          in: "query",
          description: "Full-text search term.",
          schema: { type: "string" },
        },
      },
      schemas: {
        ListEnvelope: {
          type: "object",
          properties: {
            count: { type: "integer" },
            limit: { type: "integer" },
            offset: { type: "integer" },
            results: { type: "array", items: { type: "object" } },
          },
          required: ["count", "limit", "offset", "results"],
        },
        // Issue #65: concrete per-table patch bodies with additionalProperties:
        // false so the manifest rejects unknown columns before the runtime
        // does. Spliced in from Zod so the allowlist stays single-sourced.
        ...perTableSchemas,
        ...perTableRequestSchemas,
        PatchResponse: {
          type: "object",
          properties: {
            mutation_id: { type: "integer" },
            status: { type: "string", enum: ["pending_review"] },
            table: { type: "string" },
            slug: { type: "string" },
            changed_fields: { type: "array", items: { type: "string" } },
            message: { type: "string" },
          },
          required: ["mutation_id", "status", "table", "slug", "changed_fields"],
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
            detail: { type: "string" },
          },
          required: ["error"],
        },
      },
    },
    paths: {
      "/v1/robots": {
        get: {
          tags: ["read"],
          summary: "List robots.",
          parameters: [
            { $ref: "#/components/parameters/limit" },
            { $ref: "#/components/parameters/offset" },
            { $ref: "#/components/parameters/q" },
          ],
          responses: {
            "200": {
              description: "A page of robots.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ListEnvelope" } } },
            },
          },
        },
      },
      "/v1/robots/{slug}": {
        get: {
          tags: ["read"],
          summary: "Get a single robot by slug.",
          parameters: [
            { name: "slug", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "Robot record." },
            "404": {
              description: "Slug not found.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
          },
        },
      },
      "/v1/policies": {
        get: { tags: ["read"], summary: "List policies.", parameters: [{ $ref: "#/components/parameters/limit" }, { $ref: "#/components/parameters/offset" }, { $ref: "#/components/parameters/q" }], responses: { "200": { description: "Page" } } },
      },
      "/v1/datasets": {
        get: { tags: ["read"], summary: "List datasets.", parameters: [{ $ref: "#/components/parameters/limit" }, { $ref: "#/components/parameters/offset" }, { $ref: "#/components/parameters/q" }], responses: { "200": { description: "Page" } } },
      },
      "/v1/benchmarks": {
        get: { tags: ["read"], summary: "List benchmarks.", parameters: [{ $ref: "#/components/parameters/limit" }, { $ref: "#/components/parameters/offset" }, { $ref: "#/components/parameters/q" }], responses: { "200": { description: "Page" } } },
      },
      "/v1/environments": {
        get: { tags: ["read"], summary: "List environments.", parameters: [{ $ref: "#/components/parameters/limit" }, { $ref: "#/components/parameters/offset" }, { $ref: "#/components/parameters/q" }], responses: { "200": { description: "Page" } } },
      },
      "/v1/search": {
        get: {
          tags: ["read"],
          summary: "Full-text search across all domain tables.",
          parameters: [
            { $ref: "#/components/parameters/q" },
            { $ref: "#/components/parameters/limit" },
            { $ref: "#/components/parameters/offset" },
          ],
          responses: { "200": { description: "Ranked results." } },
        },
      },
      "/v1/stats": {
        get: { tags: ["read"], summary: "Row counts for every domain table.", responses: { "200": { description: "Counts object." } } },
      },
      // Issue #65: one concrete path per writable table. Each one's
      // requestBody references a per-table schema with additionalProperties
      // set to false and every column enumerated.
      ...perTablePaths,
    },
  } as Record<string, unknown>

  router.get("/", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=300")
    res.json(doc)
  })

  return router
}
