import express, { type Express } from "express"
import type { IOneclickClient } from "./clients/oneclick.js"
import { apiKeyMiddleware, type IQueryable } from "./middleware/api-key.js"
import { corsMiddleware } from "./middleware/cors.js"
import { rateLimitMiddleware } from "./middleware/rate-limit.js"
import { requestLogMiddleware } from "./middleware/request-log.js"
import { TokenBucket } from "./middleware/token-bucket.js"
import type { IRepository } from "./repo/types.js"
import type { ITypesenseClient } from "./typesense/client.js"
import { buildAsk404Router } from "./routes/ask-404.js"
import { buildBenchmarksRouter } from "./routes/benchmarks.js"
import { buildCompatibilityEdgesRouter } from "./routes/compatibility-edges.js"
import { buildDatasetsRouter } from "./routes/datasets.js"
import { buildDeployNotesRouter } from "./routes/deploy-notes.js"
import { buildEnvironmentsRouter } from "./routes/environments.js"
import { buildHardwareRouter } from "./routes/hardware.js"
import { buildLaundryCompatEdgesRouter } from "./routes/laundry-compat-edges.js"
import { buildPapersRouter } from "./routes/papers.js"
import { buildPoliciesRouter } from "./routes/policies.js"
import { buildRobotsRouter } from "./routes/robots.js"
import { buildSearchRouter } from "./routes/search.js"
import {
  buildEpisodesRouter,
  type IEpisodeStore,
} from "./routes/episodes.js"
import { buildSimulationsGroupsRouter } from "./routes/simulations.js"
import { buildStatsRouter } from "./routes/stats.js"
import { buildTasksRouter } from "./routes/tasks.js"
import type { PrismaClient } from "@prisma/client"
import { buildInternalApiKeysRouter } from "./routes/internal-api-keys.js"
import { buildWorkbenchProjectsRouter } from "./routes/workbench-projects.js"
import { buildMutationsRouter } from "./routes/mutations.js"
import { buildOpenApiRouter } from "./routes/openapi.js"
import { buildMetricsRouter, setRateLimitBucketSizeProvider } from "./routes/metrics.js"
import { httpMetricsMiddleware } from "./middleware/metrics.js"
import { buildWriteRouter, type IBuildWriteRouterOptions } from "./routes/write.js"

export interface ICreateServerOptions {
  bucket?: TokenBucket
  // Injectable query interface for the api-key middleware. When omitted, the
  // middleware is not mounted — used by FixtureRepo-only unit tests that never
  // exercise keyed requests. Production bootstrap always provides it.
  db?: IQueryable
  // Spec 025 iter-1 / 026: render submissions via oneclick-policy. Both must
  // be provided together; when either is absent the /v1/episodes routes are
  // not mounted (keeps FixtureRepo-only tests unaffected).
  episodes?: {
    store: IEpisodeStore
    oneclick: IOneclickClient
  }
  // Spec 026: Simulation groups (read + POST). When omitted the
  // /v1/simulations route is not mounted — lets FixtureRepo-only tests stay
  // self-contained. `oneclick` is only required for POST; GET works without.
  simulations?: {
    prisma: import("./routes/simulations.js").ISimulationsPrisma
    oneclick?: IOneclickClient
  }
  // Spec 027 (agent API keys): override the write router's rate limit.
  // Tests use small caps to exercise the 429 path without seeding 200 rows.
  writeRouter?: IBuildWriteRouterOptions
  // Spec 027 phase B: mount /v1/internal/api-keys so apps/web can forward
  // api_keys CRUD through the API instead of hitting Postgres directly.
  // Only mounts when prisma is supplied (tests with FixtureRepo skip it).
  prisma?: PrismaClient
  // When provided, /v1/search routes through Typesense. Without it the
  // existing Postgres-based repo.search() handles the request.
  typesense?: ITypesenseClient | null
}

export function createServer(repo: IRepository, options: ICreateServerOptions = {}): Express {
  const app = express()
  app.set("trust proxy", true)
  // Pretty-print every JSON response with 2-space indentation. Clients
  // parsing the body don't care about whitespace, and the readability
  // win for humans hitting the API via curl / browser is large.
  app.set("json spaces", 2)
  app.use(express.json())

  // /metrics is mounted FIRST — before CORS, rate-limit, and api-key —
  // so the festivus-prometheus Dokku app's scrape (every 15s) doesn't burn
  // anon-tier tokens or carry CORS preflights. The route is
  // unauthenticated by design; access is gated at the network layer
  // (festivus-prometheus reaches it via the Dokku-internal docker network
  // as `festivus-api.web:5000/metrics`, never through Cloudflare).
  app.use("/metrics", buildMetricsRouter())

  // CORS first — preflights must short-circuit before rate-limit so browsers
  // calling the API from festivus.hapticlabs.ai (spec 023 client-side pages)
  // don't burn anon tokens on OPTIONS checks.
  app.use(corsMiddleware())

  const bucket = options.bucket ?? new TokenBucket()
  setRateLimitBucketSizeProvider(() => bucket.size())
  app.use(rateLimitMiddleware({ bucket }))
  if (options.db) {
    app.use(apiKeyMiddleware({ db: options.db }))
  }
  app.use(requestLogMiddleware())
  // After api-key middleware so the histogram/counter sees req.tier =
  // 'keyed' | 'anon'. Mounting earlier would label every request 'unknown'.
  app.use(httpMetricsMiddleware())

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", deployProbe: "noop-2026-04-21" })
  })

  // Well-known alias for agent tooling that expects a `.json` suffix.
  app.get("/agents.json", (_req, res) => {
    res.redirect(307, "/v1/openapi.json")
  })

  app.use("/v1/robots", buildRobotsRouter(repo))
  app.use("/v1/policies", buildPoliciesRouter(repo))
  app.use("/v1/datasets", buildDatasetsRouter(repo))
  app.use("/v1/benchmarks", buildBenchmarksRouter(repo))
  app.use("/v1/deploy-notes", buildDeployNotesRouter(repo))
  app.use("/v1/environments", buildEnvironmentsRouter(repo))
  app.use("/v1/tasks", buildTasksRouter(repo))
  app.use("/v1/papers", buildPapersRouter(repo))
  app.use("/v1/hardware", buildHardwareRouter(repo))
  app.use("/v1/compatibility-edges", buildCompatibilityEdgesRouter(repo))
  // Back-compat alias: legacy clients still call /v1/compatibility. Mount the
  // same router at the old path so no client has to change in lockstep with
  // this rename. Remove once every caller has been migrated.
  app.use("/v1/compatibility", buildCompatibilityEdgesRouter(repo))
  app.use("/v1/laundry-compat-edges", buildLaundryCompatEdgesRouter(repo))
  app.use("/v1/stats", buildStatsRouter(repo))
  app.use("/v1/search", buildSearchRouter(repo, { typesense: options.typesense ?? null }))
  app.use("/v1/ask", buildAsk404Router())
  // OpenAPI 3.1 doc for Claude / agents to discover the write surface (spec 027).
  app.use("/v1/openapi.json", buildOpenApiRouter())
  // Write surface — CRUD on every JSONB table, guarded by tier='write' API key.
  // Spec 021. Mounted last so the read routes above are not masked by a catch-all.
  app.use("/v1/write", buildWriteRouter(repo, options.writeRouter))
  // Moderator queue — list, inspect, approve/reject/revert mutations.
  app.use("/v1/mutations", buildMutationsRouter(repo))

  // Internal api_keys CRUD. apps/web forwards here with FESTIVUS_MODERATOR_KEY
  // so the Postgres write path stays on api/ only (spec 027 phase B).
  if (options.prisma) {
    app.use("/v1/internal/api-keys", buildInternalApiKeysRouter(options.prisma))
    app.use("/v1/internal/workbench-projects", buildWorkbenchProjectsRouter(options.prisma))
  }

  // Spec 025 iter-1 / 026: per-Episode render submissions. Only mounted when
  // the host supplies a store + oneclick client, so test harnesses that use
  // FixtureRepo stay self-contained.
  if (options.episodes) {
    app.use(
      "/v1/episodes",
      buildEpisodesRouter({
        store: options.episodes.store,
        oneclick: options.episodes.oneclick,
      }),
    )
  }

  // Spec 026: Simulation groups (parent rows owning N Episodes). GET works
  // without oneclick; POST requires it (returns 503 when absent).
  if (options.simulations) {
    app.use(
      "/v1/simulations",
      buildSimulationsGroupsRouter({
        prisma: options.simulations.prisma,
        oneclick: options.simulations.oneclick,
      }),
    )
  }

  return app
}
