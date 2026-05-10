import { Router } from "express"
import { PrismaClient, Prisma } from "@prisma/client"
import { z } from "zod"
import { randomBytes } from "node:crypto"
import type { IOneclickClient } from "../clients/oneclick.js"
import { OneclickError } from "../clients/oneclick.js"
import { parseListFilters } from "./_factory.js"

/**
 * Simulation groups — spec 026 taxonomy.
 *
 *   GET  /v1/simulations            — list Simulation rows, each with its
 *                                      episode count (paginated envelope).
 *   GET  /v1/simulations/:slug      — one Simulation plus its ordered
 *                                      episodes array.
 *   POST /v1/simulations            — create a Simulation row + N Episode
 *                                      rows atomically, then fan out oneclick
 *                                      submits concurrently (spec 026 I1 + I3).
 *
 * A Simulation is a policy × environment (× task? × robot?) grouping that
 * owns N Episodes (individual oneclick renders). The flat per-Episode shape
 * lives at /v1/episodes; callers that want the grouped view use this route.
 */

const MIN_EPISODES = 1
const MAX_EPISODES = 5

const createBodySchema = z.object({
  policy_slug: z.string().trim().min(1),
  environment_slug: z.string().trim().min(1),
  task_slug: z.string().trim().min(1).optional(),
  robot_slug: z.string().trim().min(1).optional(),
  episode_count: z.number().int().min(MIN_EPISODES).max(MAX_EPISODES),
})

type ICreateSimulationBody = z.infer<typeof createBodySchema>

/**
 * Narrow shape of the Prisma methods this router actually uses. Keeping it
 * loose lets unit tests substitute a mock without caring about the 80+
 * unrelated fields on the real PrismaClient.
 */
export interface ISimulationsPrisma {
  simulations: Pick<
    PrismaClient["simulations"],
    "count" | "findMany" | "findUnique"
  >
  policies: Pick<PrismaClient["policies"], "findUnique">
  episodes: Pick<PrismaClient["episodes"], "update">
  $transaction: <T>(fn: (tx: ITransactionClient) => Promise<T>) => Promise<T>
}

/** Subset of Prisma.TransactionClient the POST path touches. */
export interface ITransactionClient {
  simulations: {
    create(args: {
      data: {
        slug: string
        policy_slug: string
        environment_slug: string
        task_slug?: string | null
        robot_slug?: string | null
      }
    }): Promise<{ id: string; slug: string }>
  }
  episodes: {
    create(args: {
      data: {
        simulation_id: string
        episode_index: number
        hf_url: string
        env_slug: string
        policy_slug: string
      }
    }): Promise<{ id: string; simulation_id: string | null; episode_index: number | null }>
  }
}

export interface IBuildSimulationsGroupsRouterOptions {
  prisma: ISimulationsPrisma
  oneclick?: IOneclickClient
}

function slugifyFragment(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Deterministic-ish slug: {policy_slug}-{environment_slug}-{4-hex-chars}.
 * The suffix is a fresh random 4-hex-char string so concurrent POSTs with
 * identical (policy, env) pairs don't collide. On the extremely unlikely
 * event of a collision (1/65536), the DB UNIQUE constraint rejects the
 * INSERT and we surface 409 — retry is the client's job.
 */
function buildSimulationSlug(policySlug: string, envSlug: string): string {
  const suffix = randomBytes(2).toString("hex")
  return `${slugifyFragment(policySlug)}-${slugifyFragment(envSlug)}-${suffix}`
}

function extractHfRepoId(policyData: unknown): string | null {
  if (!policyData || typeof policyData !== "object") return null
  const raw = (policyData as Record<string, unknown>)["hf_repo_id"]
  if (typeof raw !== "string" || raw.trim() === "") return null
  return raw.trim()
}

export function buildSimulationsGroupsRouter(
  options: IBuildSimulationsGroupsRouterOptions,
): Router {
  const { prisma, oneclick } = options
  const router = Router()

  router.get("/", async (req, res, next) => {
    try {
      const filters = parseListFilters(req.query as Record<string, unknown>)
      // Strict facet filters: each one ANDs into the where clause; missing
      // filters are skipped. task_slug + robot_slug are NULL on simulations
      // that didn't pick one — strict semantics excludes them when filtered.
      const q = req.query as Record<string, unknown>
      const where: Record<string, string> = {}
      const facet = (key: string): string | undefined => {
        const v = q[key]
        return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined
      }
      const policySlug = facet("policy_slug")
      const envSlug = facet("environment_slug")
      const taskSlug = facet("task_slug")
      const robotSlug = facet("robot_slug")
      if (policySlug) where["policy_slug"] = policySlug
      if (envSlug) where["environment_slug"] = envSlug
      if (taskSlug) where["task_slug"] = taskSlug
      if (robotSlug) where["robot_slug"] = robotSlug

      const [count, rows] = await Promise.all([
        prisma.simulations.count({ where }),
        prisma.simulations.findMany({
          where,
          take: filters.limit,
          skip: filters.offset,
          orderBy: { created_at: "desc" },
          select: {
            id: true,
            slug: true,
            policy_slug: true,
            environment_slug: true,
            task_slug: true,
            robot_slug: true,
            created_at: true,
            _count: { select: { episodes: true } },
            // Iter-2 (issue #56): pull every episode's pollable fields so
            // the lazy-poll below can refresh pending/running rows and the
            // recomputed first_episode_video_url below reflects fresh state.
            // Bounded: MAX_EPISODES=5 per sim × filters.limit rows per page.
            episodes: {
              orderBy: { episode_index: "asc" },
              select: {
                id: true,
                episode_index: true,
                status: true,
                video_url: true,
                oneclick_job_id: true,
              },
            },
          },
        }),
      ])

      // Issue #56 lazy-poll. Same pattern as GET /:slug — poll every
      // pending/running episode across the page concurrently so the list
      // surfaces fresh video_urls without waiting for a detail-page visit.
      // TTFB is bounded by the slowest single getJob (~200ms), not the sum.
      // A throw on one episode's getJob marks ONLY that episode failed; peers
      // are unaffected.
      if (oneclick) {
        interface IPollable {
          id: string
          rowIndex: number
          status: string
          video_url: string | null
          oneclick_job_id: string | null
        }
        const pollable: IPollable[] = []
        rows.forEach((r, rowIndex) => {
          for (const ep of r.episodes) {
            if (
              (ep.status === "pending" || ep.status === "running") &&
              ep.oneclick_job_id
            ) {
              pollable.push({
                id: ep.id,
                rowIndex,
                status: ep.status,
                video_url: ep.video_url,
                oneclick_job_id: ep.oneclick_job_id,
              })
            }
          }
        })
        if (pollable.length > 0) {
          const updates = await Promise.all(
            pollable.map(async (ep) => {
              try {
                const job = await oneclick.getJob(ep.oneclick_job_id as string)
                if (
                  job.status !== ep.status ||
                  job.video_url ||
                  job.error
                ) {
                  // Invariant I5: status is monotonic. Don't transition a
                  // terminal row backwards.
                  if (
                    (ep.status === "done" || ep.status === "failed") &&
                    job.status !== ep.status
                  ) {
                    return null
                  }
                  const patch: Record<string, unknown> = { status: job.status }
                  if (job.video_url) patch["video_url"] = job.video_url
                  if (job.error) patch["error_message"] = job.error
                  const patched = await prisma.episodes.update({
                    where: { id: ep.id },
                    data: patch as never,
                  })
                  return { rowIndex: ep.rowIndex, patched }
                }
                return null
              } catch (err) {
                const detail =
                  err instanceof OneclickError
                    ? err.message
                    : err instanceof Error
                      ? err.message
                      : String(err)
                const patched = await prisma.episodes.update({
                  where: { id: ep.id },
                  data: { status: "failed", error_message: detail },
                })
                return { rowIndex: ep.rowIndex, patched }
              }
            }),
          )
          // Apply updates back into the in-memory rows so the response
          // reflects fresh state without a second findMany.
          const byRowAndId = new Map<string, Record<string, unknown>>()
          for (const u of updates) {
            if (u) byRowAndId.set(`${u.rowIndex}:${u.patched.id}`, u.patched as never)
          }
          if (byRowAndId.size > 0) {
            rows.forEach((r, rowIndex) => {
              r.episodes = r.episodes.map((ep) => {
                const key = `${rowIndex}:${ep.id}`
                const fresh = byRowAndId.get(key)
                return fresh ? ({ ...ep, ...fresh } as typeof ep) : ep
              })
            })
          }
        }
      }

      const results = rows.map((r) => {
        // Pick the lowest-episode_index done episode's video_url as the
        // list-page thumbnail. Post-lazy-poll, this reflects the freshest
        // state available.
        const firstDone = r.episodes.find((ep) => ep.status === "done")
        return {
          id: r.id,
          slug: r.slug,
          policy_slug: r.policy_slug,
          environment_slug: r.environment_slug,
          task_slug: r.task_slug,
          robot_slug: r.robot_slug,
          created_at: r.created_at,
          episode_count: r._count.episodes,
          first_episode_video_url: firstDone?.video_url ?? null,
        }
      })
      res.json({
        count,
        limit: filters.limit,
        offset: filters.offset,
        results,
      })
    } catch (err) {
      next(err)
    }
  })

  router.get("/:slug", async (req, res, next) => {
    try {
      const slug = req.params["slug"] ?? ""
      const sim = await prisma.simulations.findUnique({
        where: { slug },
        include: {
          episodes: {
            orderBy: { episode_index: "asc" },
          },
        },
      })
      if (!sim) {
        res.status(404).json({ error: "not_found", slug })
        return
      }

      // Spec 026 design goal "Episodes are atomic" + invariant I5 (status
      // monotonicity). Lazy-poll any pending/running episodes via concurrent
      // oneclick.getJob calls — TTFB stays bounded by the slowest single
      // call (~200 ms), not the sum. A throw on one episode's getJob marks
      // ONLY that episode failed; peers are unaffected.
      if (oneclick) {
        const pollable = sim.episodes.filter(
          (ep) =>
            (ep.status === "pending" || ep.status === "running") &&
            Boolean(ep.oneclick_job_id),
        )
        if (pollable.length > 0) {
          const updates = await Promise.all(
            pollable.map(async (ep) => {
              try {
                const job = await oneclick.getJob(ep.oneclick_job_id as string)
                if (
                  job.status !== ep.status ||
                  job.video_url ||
                  job.error
                ) {
                  // Invariant I5: status is monotonic. Don't transition a
                  // terminal row backwards.
                  if (
                    (ep.status === "done" || ep.status === "failed") &&
                    job.status !== ep.status
                  ) {
                    return null
                  }
                  const patch: Record<string, unknown> = { status: job.status }
                  if (job.video_url) patch["video_url"] = job.video_url
                  if (job.error) patch["error_message"] = job.error
                  return await prisma.episodes.update({
                    where: { id: ep.id },
                    data: patch as never,
                  })
                }
                return null
              } catch (err) {
                const detail =
                  err instanceof OneclickError
                    ? err.message
                    : err instanceof Error
                      ? err.message
                      : String(err)
                return await prisma.episodes.update({
                  where: { id: ep.id },
                  data: { status: "failed", error_message: detail },
                })
              }
            }),
          )
          // Apply the updates back into the response shape so the client
          // sees the fresh state without a second fetch.
          const byId = new Map<string, (typeof updates)[number]>()
          for (const u of updates) {
            if (u) byId.set(u.id, u)
          }
          if (byId.size > 0) {
            sim.episodes = sim.episodes.map((ep) =>
              byId.has(ep.id) ? { ...ep, ...byId.get(ep.id) } : ep,
            )
          }
        }
      }

      res.json(sim)
    } catch (err) {
      next(err)
    }
  })

  router.post("/", async (req, res, next) => {
    try {
      if (!oneclick) {
        res.status(503).json({
          error: "oneclick_unavailable",
          detail: "POST /v1/simulations requires ONECLICK_API_KEY to be configured",
        })
        return
      }

      const parsed = createBodySchema.safeParse(req.body ?? {})
      if (!parsed.success) {
        res.status(400).json({
          error: "invalid_input",
          detail: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        })
        return
      }
      const body: ICreateSimulationBody = parsed.data

      // Look up the policy's hf_repo_id server-side. Trust nothing from the
      // client; the picker-selected slug is the only thing we trust.
      const policy = await prisma.policies.findUnique({
        where: { slug: body.policy_slug },
      })
      if (!policy) {
        res.status(400).json({
          error: "unknown_policy",
          detail: `no policy with slug="${body.policy_slug}"`,
        })
        return
      }
      const hfRepoId = extractHfRepoId((policy as { data?: unknown }).data)
      if (!hfRepoId) {
        res.status(400).json({
          error: "policy_missing_hf_repo_id",
          detail: `policy "${body.policy_slug}" has no hf_repo_id — pick a policy with an HF repo`,
        })
        return
      }
      const hfUrl = `https://huggingface.co/${hfRepoId}`
      const slug = buildSimulationSlug(body.policy_slug, body.environment_slug)

      // Atomic: if any INSERT fails, zero rows land. The Simulation + all N
      // Episode rows either all persist or none do.
      const { simulationId, episodeRows } = await prisma.$transaction(
        async (tx) => {
          const created = await tx.simulations.create({
            data: {
              slug,
              policy_slug: body.policy_slug,
              environment_slug: body.environment_slug,
              task_slug: body.task_slug ?? null,
              robot_slug: body.robot_slug ?? null,
            },
          })
          const episodes: Array<{ id: string }> = []
          for (let i = 0; i < body.episode_count; i++) {
            const ep = await tx.episodes.create({
              data: {
                simulation_id: created.id,
                episode_index: i,
                hf_url: hfUrl,
                env_slug: body.environment_slug,
                policy_slug: body.policy_slug,
              },
            })
            episodes.push({ id: ep.id })
          }
          return { simulationId: created.id, episodeRows: episodes }
        },
      )

      // Outside the transaction: concurrent oneclick submits. Each submit
      // owns its own episode row; one failure does not unwind the others
      // (spec design goal "failed episodes don't poison the parent").
      // Promise.all bounds POST latency by the slowest single submit, not
      // the sum.
      await Promise.all(
        episodeRows.map(async (ep) => {
          try {
            const { job_id } = await oneclick.submit(hfUrl)
            await prisma.episodes.update({
              where: { id: ep.id },
              data: { oneclick_job_id: job_id, status: "running" },
            })
          } catch (err) {
            const detail =
              err instanceof OneclickError
                ? err.message
                : err instanceof Error
                  ? err.message
                  : String(err)
            await prisma.episodes.update({
              where: { id: ep.id },
              data: { status: "failed", error_message: detail },
            })
          }
        }),
      )

      res.status(200).json({ id: simulationId, slug })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        res.status(409).json({
          error: "slug_collision",
          detail: err.message,
        })
        return
      }
      next(err)
    }
  })

  return router
}
