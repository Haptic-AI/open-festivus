import { Router } from "express"
import type { IRobotFullResponse } from "@festivus/types"
import type { IRepository } from "../repo/types.js"
import { buildDomainRouter } from "./_factory.js"

export function buildRobotsRouter(repo: IRepository): Router {
  const router = buildDomainRouter("robots", repo)

  router.get("/:slug/full", async (req, res, next) => {
    try {
      const slug = req.params["slug"] ?? ""
      const robot = await repo.getBySlug("robots", slug)
      if (!robot) {
        res.status(404).json({ error: "not_found", slug })
        return
      }
      const policies = await repo.list("policies", { limit: 500, offset: 0 })
      const datasets = await repo.list("datasets", { limit: 500, offset: 0 })
      const body: IRobotFullResponse = {
        robot,
        policies: policies.results,
        datasets: datasets.results,
      }
      res.json(body)
    } catch (err) {
      next(err)
    }
  })

  return router
}
