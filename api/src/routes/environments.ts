// /v1/environments is called by FestivusClient but has no FastAPI handler or
// Postgres table upstream. Environments is a validation-only domain, so the
// route serves it from an in-memory copy of data/environments.json.

import { Router } from "express"
import type { IPaginatedResponse, IEnvironment } from "@festivus/types"
import type { IRepository } from "../repo/types.js"
import { parseListFilters } from "./_factory.js"

export function buildEnvironmentsRouter(repo: IRepository): Router {
  const router = Router()

  router.get("/", async (req, res, next) => {
    try {
      const filters = parseListFilters(req.query as Record<string, unknown>)
      const { count, results } = await repo.listEnvironments(filters)
      const body: IPaginatedResponse<IEnvironment> = {
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

  return router
}
