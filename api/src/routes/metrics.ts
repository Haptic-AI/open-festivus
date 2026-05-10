import { Router, type Router as IRouter } from "express"
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "prom-client"

// One Registry per process. Default metrics (CPU, memory, GC, eventloop lag,
// active handles) cover the host-level signals the festivus-prometheus Dokku
// app already wants. The HTTP counter + histogram below add request-rate +
// latency by route+status without exploding label cardinality.
//
// Path label is the route's *template* (e.g. /v1/robots), not the resolved
// URL — request handlers set req.metricsRoute when they want to be tracked.
// Anything that doesn't set it lands in the "unknown" bucket so we still see
// a baseline rate without 10k unique paths from /v1/robots/<slug> calls.

const registry = new Registry()
collectDefaultMetrics({
  register: registry,
  prefix: "festivus_api_",
})

export const httpRequestsTotal = new Counter({
  name: "festivus_api_http_requests_total",
  help: "Total HTTP requests handled, labelled by method, route template, and status code.",
  labelNames: ["method", "route", "status", "tier"] as const,
  registers: [registry],
})

export const httpRequestDurationSeconds = new Histogram({
  name: "festivus_api_http_request_duration_seconds",
  help: "HTTP request duration in seconds, labelled by method, route template, and status code.",
  labelNames: ["method", "route", "status"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
})

// Number of live entries in the in-memory rate-limit token bucket. Wired in
// server.ts via setRateLimitBucketSizeProvider — left as a no-op here so this
// module stays free of middleware imports. Watch this on Grafana to confirm
// the idle-eviction sweep is actually capping growth.
let bucketSizeProvider: (() => number) | null = null
export function setRateLimitBucketSizeProvider(fn: () => number): void {
  bucketSizeProvider = fn
}

export const rateLimitBucketSize = new Gauge({
  name: "festivus_api_rate_limit_buckets",
  help: "Live entries in the per-IP token-bucket rate limiter. Should plateau, not climb.",
  registers: [registry],
  collect(): void {
    if (bucketSizeProvider) this.set(bucketSizeProvider())
  },
})

export function buildMetricsRouter(): IRouter {
  const r = Router()
  r.get("/", async (_req, res) => {
    res.set("Content-Type", registry.contentType)
    res.send(await registry.metrics())
  })
  return r
}

export function metricsRegistry(): Registry {
  return registry
}
