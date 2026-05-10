import { Router } from "express"
import type { IDomainTable, IRepository } from "../repo/types.js"
import { rateLimitWritesMiddleware } from "../middleware/rate-limit-writes.js"
import { requireWriteTier } from "../middleware/require-write-tier.js"
import { getValidFields, validatePatch } from "../validation/patch-schemas.js"
import { notifyModerator, notifySubmitter } from "../notifications/email.js"

/**
 * CRUD write surface. One router for all tables.
 *
 * Routes (all require x-api-key with tier='write'):
 *
 *   PUT    /v1/write/:table/:slug   — upsert; body replaces the whole record (optimistic, v1)
 *   PATCH  /v1/write/:table/:slug   — enqueue a pending mutation (spec 027)
 *   DELETE /v1/write/:table/:slug   — delete by slug (optimistic, v1)
 *
 * PATCH is pending-by-default as of spec 027. The handler:
 *   1. Validates the patch against per-table Zod schemas
 *   2. Reads the current record to compute the diff (old/new values)
 *   3. Enqueues a mutation row with status='pending_review' — does NOT apply
 *   4. Fires an async email notification (non-blocking)
 *   5. Returns 202 Accepted + { mutation_id, status, changed_fields }
 *
 * PUT and DELETE still apply optimistically in v1. v2 will gate them the same
 * way once the moderator UI can handle the richer action types.
 */
const ALLOWED_TABLES: readonly IDomainTable[] = [
  "robots",
  "policies",
  "datasets",
  "benchmarks",
  "deploy_notes",
  "environments",
  "tasks",
  "papers",
  "hardware",
  "compatibility_edges",
  "laundry_compat_edges",
] as const

function isAllowed(t: string): t is IDomainTable {
  return (ALLOWED_TABLES as readonly string[]).includes(t)
}

/**
 * Diff two objects, returning only the keys present in `patch` whose
 * values actually differ from `current`. This avoids logging no-op
 * "changes" when the patch includes a field with the same value.
 */
function diffPatch(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
): { changedFields: string[]; oldValues: Record<string, unknown>; newValues: Record<string, unknown> } {
  const changedFields: string[] = []
  const oldValues: Record<string, unknown> = {}
  const newValues: Record<string, unknown> = {}
  for (const key of Object.keys(patch)) {
    const oldVal = current[key]
    const newVal = patch[key]
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changedFields.push(key)
      oldValues[key] = oldVal
      newValues[key] = newVal
    }
  }
  return { changedFields, oldValues, newValues }
}

export interface IBuildWriteRouterOptions {
  rateLimit?: { windowHours?: number; maxWrites?: number }
}

export function buildWriteRouter(
  repo: IRepository,
  options: IBuildWriteRouterOptions = {},
): Router {
  const router = Router()

  router.use(requireWriteTier())
  router.use(rateLimitWritesMiddleware({ repo, ...options.rateLimit }))

  router.put("/:table/:slug", async (req, res, next) => {
    try {
      const table = String(req.params["table"] ?? "")
      const slug = String(req.params["slug"] ?? "")
      if (!isAllowed(table)) {
        res.status(400).json({ error: "unknown_table", table })
        return
      }
      if (!slug) {
        res.status(400).json({ error: "missing_slug" })
        return
      }
      const body = (req.body ?? {}) as Record<string, unknown>
      const data = { ...body, slug } as never
      const out = await repo.upsertBySlug(table, slug, data)
      res.status(200).json(out)
    } catch (err) {
      next(err)
    }
  })

  router.patch("/:table/:slug", async (req, res, next) => {
    try {
      const table = String(req.params["table"] ?? "")
      const slug = String(req.params["slug"] ?? "")
      if (!isAllowed(table)) {
        res.status(400).json({ error: "unknown_table", table })
        return
      }
      if (!slug) {
        res.status(400).json({ error: "missing_slug" })
        return
      }

      // Parse the request body. Supports both the structured format
      // { patch: {...}, reason: "..." } and the legacy flat format where
      // the body IS the patch.
      const rawBody = (req.body ?? {}) as Record<string, unknown>
      const isStructured = rawBody["patch"] !== undefined && typeof rawBody["patch"] === "object"
      const rawPatch = isStructured
        ? (rawBody["patch"] as Record<string, unknown>)
        : rawBody
      const reason = isStructured && typeof rawBody["reason"] === "string"
        ? (rawBody["reason"] as string)
        : undefined

      const validation = validatePatch(table, rawPatch)
      if (!validation.valid) {
        // Spec 029: separate shapes for forbidden-field vs type errors so
        // the chat SSE stream can render a specific apology per field.
        if (validation.field_rejections && validation.field_rejections.length > 0) {
          // Issue #64: include `valid_fields` so the caller (an agent, a CLI
          // user, a curl-fiddler) can self-correct on the next try without
          // having to read the OpenAPI doc or GET the row first.
          res.status(422).json({
            error: "field_not_agent_editable",
            table,
            slug,
            field_rejections: validation.field_rejections,
            valid_fields: getValidFields(table as IDomainTable),
            ...(validation.errors ? { details: validation.errors } : {}),
          })
          return
        }
        res.status(422).json({
          error: "validation_failed",
          table,
          slug,
          details: validation.errors,
        })
        return
      }
      const patch = validation.data!

      const current = await repo.getBySlug(table, slug)
      if (!current) {
        res.status(404).json({ error: "not_found", table, slug })
        return
      }

      const { changedFields, oldValues, newValues } = diffPatch(
        current as unknown as Record<string, unknown>,
        patch,
      )

      // No-op patch: nothing to queue. Return 200 with the current row.
      if (changedFields.length === 0) {
        res.status(200).json({ no_op: true, row: current })
        return
      }

      const actorId = String(req.apiKeyId ?? "unknown")
      // Prefer the end user's email (set on chat path via on-behalf-of) over
      // the raw api_keys owner_email (which on the chat path is the moderator
      // forwarder's, not the actual user's). Falls back to the api key owner
      // for CLI-only writes where no users row was resolved.
      const actorEmail = req.user?.email ?? req.apiKeyOwnerEmail ?? undefined
      // Spec 029: stamp the canonical users.id when we know it. The chat
      // path (Clerk auth) sets req.user; the CLI path (api-key auth) carries
      // it through api_keys.owner_id on the authenticating row. Either
      // resolves to the same users row.
      const authorId = req.user?.id ?? req.apiKeyOwnerId ?? null

      // Spec 029 update: optimistic apply. Edits go live immediately AND
      // the mutation row logs for moderator review. Moderator approve is
      // a status flip; moderator reject restores old_values.
      await repo.patchBySlug(table, slug, patch as never)

      const mutation = await repo.createMutation({
        table_name: table,
        slug,
        field_path: changedFields.join(","),
        actor_id: actorId,
        actor_email: actorEmail,
        author_id: authorId,
        reason,
        patch,
        old_values: oldValues,
        new_values: newValues,
      })

      // Fire-and-forget — the mutation is already persisted; email failures
      // must never block the 202 or leak a 500.
      notifyModerator(mutation).catch(() => {})
      notifySubmitter(mutation).catch(() => {})

      res.status(202).json({
        mutation_id: mutation.id,
        status: mutation.status,
        table,
        slug,
        changed_fields: changedFields,
        message: "Edit live. Moderator review can revert if needed.",
      })
    } catch (err) {
      next(err)
    }
  })

  router.delete("/:table/:slug", async (req, res, next) => {
    try {
      const table = String(req.params["table"] ?? "")
      const slug = String(req.params["slug"] ?? "")
      if (!isAllowed(table)) {
        res.status(400).json({ error: "unknown_table", table })
        return
      }
      if (!slug) {
        res.status(400).json({ error: "missing_slug" })
        return
      }
      const deleted = await repo.deleteBySlug(table, slug)
      if (!deleted) {
        res.status(404).json({ error: "not_found", table, slug })
        return
      }
      res.status(200).json({ deleted: true, table, slug })
    } catch (err) {
      next(err)
    }
  })

  return router
}
