import { Router } from "express"
import type { IRepository } from "../repo/types.js"

export function buildStatsRouter(repo: IRepository): Router {
  const router = Router()
  router.get("/", async (_req, res, next) => {
    try {
      const stats = await repo.stats()
      res.json(stats)
    } catch (err) {
      next(err)
    }
  })
  return router
}
