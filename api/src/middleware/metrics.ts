import type { NextFunction, Request, Response } from "express"
import {
  httpRequestDurationSeconds,
  httpRequestsTotal,
} from "../routes/metrics.js"
import "./request-augmentation.js"

// Express middleware that increments the festivus_api HTTP counter +
// histogram on every response. Pulls the route template from
// req.route?.path (set by Express after the matching route handler runs)
// so cardinality stays bounded — `/v1/robots/abc-123` becomes `/v1/robots/:slug`
// or whatever the route template is, not the literal URL.

export function httpMetricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = process.hrtime.bigint()
    res.on("finish", () => {
      const seconds = Number(process.hrtime.bigint() - start) / 1e9
      const route = req.route?.path ?? req.baseUrl ?? "unknown"
      const labels = {
        method: req.method,
        route,
        status: String(res.statusCode),
      }
      httpRequestDurationSeconds.observe(labels, seconds)
      httpRequestsTotal.inc({ ...labels, tier: req.tier ?? "unknown" })
    })
    next()
  }
}
