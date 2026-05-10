import { Router } from "express"
import type { IPaginatedResponse } from "@festivus/types"
import type {
  IDomainRecordMap,
  IDomainTable,
  IListFilters,
  IRepository,
} from "../repo/types.js"

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 500

export function parseListFilters(query: Record<string, unknown>): IListFilters {
  const limitRaw = Number.parseInt(String(query["limit"] ?? ""), 10)
  const offsetRaw = Number.parseInt(String(query["offset"] ?? ""), 10)
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_LIMIT) : DEFAULT_LIMIT
  const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0
  const q = typeof query["q"] === "string" && query["q"] !== "" ? (query["q"] as string) : undefined
  return q ? { limit, offset, q } : { limit, offset }
}

export function buildDomainRouter<K extends IDomainTable>(
  table: K,
  repo: IRepository,
): Router {
  const router = Router()

  router.get("/", async (req, res, next) => {
    try {
      const filters = parseListFilters(req.query as Record<string, unknown>)
      const { count, results } = await repo.list(table, filters)
      const body: IPaginatedResponse<IDomainRecordMap[K]> = {
        count,
        limit: filters.limit,
        offset: filters.offset,
        results,
      }
      res.json(body)
    } catch (err) {
      next(err)
    }
  })

  router.get("/:slug", async (req, res, next) => {
    try {
      const slug = req.params["slug"] ?? ""
      const record = await repo.getBySlug(table, slug)
      if (!record) {
        res.status(404).json({ error: "not_found", slug })
        return
      }
      res.json(record)
    } catch (err) {
      next(err)
    }
  })

  return router
}
