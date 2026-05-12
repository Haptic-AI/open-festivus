import { Router } from "express"
import { PrismaClient } from "@prisma/client"
import type {
  IOneclickClient,
  ISimulationStatus,
} from "../clients/oneclick.js"
import { OneclickError } from "../clients/oneclick.js"

/**
 * Episode render submissions for the oneclick-policy service (spec 025 iter-1 / 026).
 *
 *   POST /v1/episodes               — submit a single render (hf_url + env_slug)
 *   GET  /v1/episodes/:id           — read status; lazy-polls oneclick when the
 *                                     row is still pending/running
 *
 * An Episode is one oneclick render. Spec 026 adds a parent Simulation that
 * groups N Episodes together (see api/src/routes/simulations.ts); this route
 * continues to serve the flat per-Episode shape for internal callers.
 *
 * The route owns a tiny storage interface so unit tests can substitute an
 * in-memory Map without spinning up Prisma. In production, PrismaEpisodeStore
 * (below) is wired from api/src/index.ts.
 */

export interface IEpisodeRow {
  id: string
  hf_url: string
  env_slug: string
  policy_slug: string | null
  task_slug: string | null
  oneclick_job_id: string | null
  status: ISimulationStatus
  video_url: string | null
  error_message: string | null
  created_at: Date
  updated_at: Date
}

export interface IUpdateEpisodeInput {
  status?: ISimulationStatus
  oneclick_job_id?: string | null
  video_url?: string | null
  error_message?: string | null
}

export interface IEpisodeStore {
  findById(id: string): Promise<IEpisodeRow | null>
  update(id: string, patch: IUpdateEpisodeInput): Promise<IEpisodeRow>
}

export interface IBuildEpisodesRouterOptions {
  store: IEpisodeStore
  oneclick: IOneclickClient
}

export function buildEpisodesRouter(
  options: IBuildEpisodesRouterOptions,
): Router {
  const { store, oneclick } = options
  const router = Router()

  // POST /v1/episodes was retired in spec 026 Phase 3.3 — Episodes are now
  // children of a parent Simulation and must be created via POST
  // /v1/simulations. Returning 410 (instead of removing the route) gives
  // pre-026 clients a readable error rather than a misleading 404.
  router.post("/", (_req, res) => {
    res.status(410).json({
      error: "episode_post_retired",
      detail: "POST /v1/simulations creates Simulation+N-Episodes atomically; orphan Episodes are no longer permitted (spec 026 invariant I1)",
    })
  })

  router.get("/:id", async (req, res, next) => {
    try {
      const id = req.params["id"] ?? ""
      if (!id) {
        res.status(400).json({ error: "invalid_id" })
        return
      }
      let row = await store.findById(id)
      if (!row) {
        res.status(404).json({ error: "not_found", id })
        return
      }

      // Volatile, not persisted — the latest oneclick progress string (e.g.
      // "Claude is analyzing the repository…"), surfaced only for non-terminal
      // rows so the UI can narrate the wait. Refreshed on every poll.
      let progress_message: string | undefined

      // Lazy poll: if the row is still pending/running and we have a oneclick
      // job id, ask the upstream for the current state and update the row.
      if ((row.status === "pending" || row.status === "running") && row.oneclick_job_id) {
        try {
          const job = await oneclick.getJob(row.oneclick_job_id)
          if (job.status !== row.status || job.video_url || job.error) {
            const patch: IUpdateEpisodeInput = { status: job.status }
            if (job.video_url) patch.video_url = job.video_url
            if (job.error) patch.error_message = job.error
            row = await store.update(row.id, patch)
          }
          if (job.message && (row.status === "pending" || row.status === "running")) {
            progress_message = job.message
          }
        } catch (err) {
          const detail =
            err instanceof OneclickError
              ? err.message
              : err instanceof Error
                ? err.message
                : String(err)
          row = await store.update(row.id, {
            status: "failed",
            error_message: detail,
          })
        }
      }

      res.status(200).json({ ...row, progress_message: progress_message ?? null })
    } catch (err) {
      next(err)
    }
  })

  return router
}

/**
 * Production store backed by Prisma. Kept here (not in repo/) because the
 * episodes table has typed columns, not the JSONB shape that IRepository
 * abstracts over.
 */
export class PrismaEpisodeStore implements IEpisodeStore {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<IEpisodeRow | null> {
    const row = await this.prisma.episodes.findUnique({ where: { id } })
    return (row as IEpisodeRow | null) ?? null
  }

  async update(id: string, patch: IUpdateEpisodeInput): Promise<IEpisodeRow> {
    const row = await this.prisma.episodes.update({
      where: { id },
      data: patch,
    })
    return row as IEpisodeRow
  }
}
