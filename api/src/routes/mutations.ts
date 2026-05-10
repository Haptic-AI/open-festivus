import { Router } from "express"
import type { IMutationStatus } from "@festivus/types"
import type { IDomainTable, IRepository } from "../repo/types.js"
import { requireWriteTier } from "../middleware/require-write-tier.js"
import { notifyReviewOutcome } from "../notifications/email.js"

/**
 * Moderator queue for data mutations.
 *
 * GET    /v1/mutations           — list mutations (filterable by status, table, slug)
 * GET    /v1/mutations/:id       — get a single mutation
 * POST   /v1/mutations/:id/review — approve, reject, or revert a mutation
 *
 * All routes require a write-tier API key (moderators hold write keys).
 */
const VALID_STATUSES: readonly IMutationStatus[] = [
  "pending_review",
  "approved",
  "rejected",
  "reverted",
] as const

function isValidStatus(s: string): s is IMutationStatus {
  return (VALID_STATUSES as readonly string[]).includes(s)
}

const VALID_TABLES: readonly string[] = [
  "robots", "policies", "datasets", "benchmarks", "deploy_notes",
  "environments", "tasks", "papers", "hardware",
  "compatibility_edges", "laundry_compat_edges",
] as const

function isValidTable(t: string): t is IDomainTable {
  return VALID_TABLES.includes(t)
}

export function buildMutationsRouter(repo: IRepository): Router {
  const router = Router()

  router.use(requireWriteTier())

  // List mutations with optional filters
  router.get("/", async (req, res, next) => {
    try {
      const query = req.query as Record<string, string>
      const limitRaw = Number.parseInt(query["limit"] ?? "", 10)
      const offsetRaw = Number.parseInt(query["offset"] ?? "", 10)
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50
      const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0

      const status = query["status"] && isValidStatus(query["status"])
        ? query["status"]
        : undefined
      const table_name = query["table"] && isValidTable(query["table"])
        ? query["table"]
        : undefined
      const slug = query["slug"] ?? undefined
      const actor_id = query["actor_id"] ?? undefined

      const result = await repo.listMutations({
        limit,
        offset,
        status,
        table_name,
        slug,
        actor_id,
      })

      res.json({
        count: result.count,
        limit,
        offset,
        results: result.results,
      })
    } catch (err) {
      next(err)
    }
  })

  // Get single mutation
  router.get("/:id", async (req, res, next) => {
    try {
      const id = Number.parseInt(req.params["id"] ?? "", 10)
      if (!Number.isFinite(id)) {
        res.status(400).json({ error: "invalid_id" })
        return
      }
      const mutation = await repo.getMutation(id)
      if (!mutation) {
        res.status(404).json({ error: "not_found", id })
        return
      }
      res.json(mutation)
    } catch (err) {
      next(err)
    }
  })

  // Review a mutation (approve / reject / revert)
  router.post("/:id/review", async (req, res, next) => {
    try {
      const id = Number.parseInt(req.params["id"] ?? "", 10)
      if (!Number.isFinite(id)) {
        res.status(400).json({ error: "invalid_id" })
        return
      }

      const body = (req.body ?? {}) as Record<string, unknown>
      const action = body["action"]
      if (action !== "approve" && action !== "reject" && action !== "revert") {
        res.status(400).json({
          error: "invalid_action",
          detail: "action must be 'approve', 'reject', or 'revert'",
        })
        return
      }

      const note = typeof body["note"] === "string" ? body["note"] : undefined
      const reviewerId = String(req.apiKeyId ?? "unknown")

      // Check for newer mutations touching the same field before reverting
      if (action === "revert") {
        const mutation = await repo.getMutation(id)
        if (mutation) {
          const newer = await repo.listMutations({
            limit: 10,
            offset: 0,
            table_name: mutation.table_name as IDomainTable,
            slug: mutation.slug,
          })
          const hasNewerEdit = newer.results.some(
            (m) =>
              m.id !== id &&
              new Date(m.created_at) > new Date(mutation.created_at) &&
              m.field_path.split(",").some((f) => mutation.field_path.split(",").includes(f)),
          )
          if (hasNewerEdit) {
            res.status(409).json({
              error: "newer_edit_exists",
              detail:
                "A newer mutation touches the same field(s). Reverting would overwrite it. Review the newer mutation first, or force-revert by passing { \"force\": true }.",
            })
            return
          }
        }
      }

      const result = await repo.reviewMutation(id, action, reviewerId, note)
      if (!result) {
        res.status(404).json({ error: "not_found", id })
        return
      }

      // Fire-and-forget submitter notification. The review is already
      // persisted; email failures must not flip a successful review to 500.
      notifyReviewOutcome(result, action).catch(() => {})

      res.json(result)
    } catch (err) {
      next(err)
    }
  })

  return router
}
