import express from "express"
import request from "supertest"
import { describe, expect, it, vi } from "vitest"
import type { IOneclickClient } from "../clients/oneclick.js"
import { OneclickError } from "../clients/oneclick.js"
import { buildSimulationsGroupsRouter } from "./simulations.js"

/**
 * Unit tests for the /v1/simulations groups route (spec 026 Phase 2.4 + 3.2).
 *
 * The route calls a narrow subset of Prisma (`simulations`, `policies`,
 * `episodes.update`, `$transaction`); the tests mock that shape with vi.fn
 * stubs so no live Prisma client is needed.
 */

interface ISimRow {
  id: string
  slug: string
  policy_slug: string
  environment_slug: string
  task_slug: string | null
  robot_slug: string | null
  created_at: Date
  _count: { episodes: number }
  /**
   * Issue #56: the list route now selects every episode's pollable fields
   * so it can lazy-poll pending/running ones. Tests mirror the real shape.
   */
  episodes: Array<{
    id: string
    episode_index: number
    status: "pending" | "running" | "done" | "failed"
    video_url: string | null
    oneclick_job_id: string | null
  }>
}

function makePrismaStub(overrides: {
  count?: number
  rows?: readonly ISimRow[]
  detail?: unknown
  policy?: { slug: string; data: { hf_repo_id?: string | null } } | null
  transactionFails?: Error
  createSimulation?: { id: string; slug: string }
  episodeIds?: readonly string[]
} = {}) {
  const rows = overrides.rows ?? []
  const count = overrides.count ?? rows.length
  const episodeUpdates: Array<{ id: string; data: Record<string, unknown> }> = []
  const txCalls: Array<{ simCreateData: unknown; episodeCreates: unknown[] }> = []
  return {
    simulations: {
      count: vi.fn(async () => count),
      findMany: vi.fn(async () => rows),
      findUnique: vi.fn(async () => overrides.detail ?? null),
    },
    policies: {
      findUnique: vi.fn(async () => overrides.policy ?? null),
    },
    episodes: {
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        episodeUpdates.push({ id: where.id, data })
        return { id: where.id, ...data }
      }),
    },
    $transaction: vi.fn(
      async <T,>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
        if (overrides.transactionFails) throw overrides.transactionFails
        const episodeCreates: unknown[] = []
        const txCallRef = { simCreateData: undefined as unknown, episodeCreates }
        txCalls.push(txCallRef)
        const tx = {
          simulations: {
            create: vi.fn(async ({ data }: { data: unknown }) => {
              txCallRef.simCreateData = data
              return (
                overrides.createSimulation ?? {
                  id: "sim-new-id",
                  slug: (data as { slug: string }).slug,
                }
              )
            }),
          },
          episodes: {
            create: vi.fn(async ({ data }: { data: unknown }) => {
              episodeCreates.push(data)
              const idx = episodeCreates.length - 1
              const id = overrides.episodeIds?.[idx] ?? `ep-${idx}`
              return { id, simulation_id: "sim-new-id", episode_index: idx }
            }),
          },
        }
        return fn(tx)
      },
    ),
    // Test helpers — not part of the ISimulationsPrisma contract.
    _episodeUpdates: episodeUpdates,
    _txCalls: txCalls,
  }
}

function makeOneclickMock(overrides: Partial<IOneclickClient> = {}): IOneclickClient {
  return {
    submit: vi.fn(async () => ({ job_id: `job-${Math.random().toString(36).slice(2, 8)}` })),
    getJob: vi.fn(async () => ({ status: "running" as const })),
    ...overrides,
  }
}

function makeApp(
  prisma: ReturnType<typeof makePrismaStub>,
  oneclick?: IOneclickClient,
) {
  const app = express()
  app.use(express.json())
  app.use(
    "/v1/simulations",
    buildSimulationsGroupsRouter({ prisma: prisma as never, oneclick }),
  )
  return app
}

describe("GET /v1/simulations", () => {
  it("returns the empty envelope when no Simulations exist", async () => {
    const prisma = makePrismaStub({ rows: [] })
    const res = await request(makeApp(prisma)).get("/v1/simulations")

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      count: 0,
      limit: 50,
      offset: 0,
      results: [],
    })
  })

  it("maps _count.episodes to episode_count in the response", async () => {
    const rows: ISimRow[] = [
      {
        id: "sim-a",
        slug: "sac-humanoid-v3-isaac-aaa1",
        policy_slug: "sac-humanoid-v3",
        environment_slug: "isaac-lab-humanoid",
        task_slug: null,
        robot_slug: null,
        created_at: new Date("2026-04-22T00:00:00Z"),
        _count: { episodes: 3 },
        episodes: [{
          id: "ep-a-0",
          episode_index: 0,
          status: "done",
          video_url: "https://example.com/first.mp4",
          oneclick_job_id: "job-a-0",
        }],
      },
      {
        id: "sim-b",
        slug: "sac-humanoid-v3-mujoco-bbb2",
        policy_slug: "sac-humanoid-v3",
        environment_slug: "mujoco-humanoid-cloth",
        task_slug: "humanoid-locomotion",
        robot_slug: null,
        created_at: new Date("2026-04-22T01:00:00Z"),
        _count: { episodes: 2 },
        episodes: [],
      },
    ]
    const prisma = makePrismaStub({ rows, count: rows.length })
    const res = await request(makeApp(prisma)).get("/v1/simulations")

    expect(res.status).toBe(200)
    expect(res.body.count).toBe(2)
    expect(res.body.results).toHaveLength(2)
    expect(res.body.results[0]).toMatchObject({
      id: "sim-a",
      slug: "sac-humanoid-v3-isaac-aaa1",
      policy_slug: "sac-humanoid-v3",
      environment_slug: "isaac-lab-humanoid",
      episode_count: 3,
    })
    expect(res.body.results[1]).toMatchObject({
      task_slug: "humanoid-locomotion",
      episode_count: 2,
    })
    // _count is internal to Prisma — must not leak to the response.
    expect(res.body.results[0]).not.toHaveProperty("_count")
  })

  it("surfaces first_episode_video_url from the nested first-done-episode select", async () => {
    const rows: ISimRow[] = [
      {
        id: "sim-with-video",
        slug: "with-video",
        policy_slug: "p",
        environment_slug: "e",
        task_slug: null,
        robot_slug: null,
        created_at: new Date(),
        _count: { episodes: 2 },
        episodes: [{
          id: "ep-0",
          episode_index: 0,
          status: "done",
          video_url: "https://cdn.example/ep0.mp4",
          oneclick_job_id: "job-done",
        }],
      },
      {
        id: "sim-without-video",
        slug: "without-video",
        policy_slug: "p",
        environment_slug: "e",
        task_slug: null,
        robot_slug: null,
        created_at: new Date(),
        _count: { episodes: 2 },
        episodes: [],
      },
    ]
    const prisma = makePrismaStub({ rows, count: rows.length })
    const res = await request(makeApp(prisma)).get("/v1/simulations")

    expect(res.status).toBe(200)
    expect(res.body.results[0].first_episode_video_url).toBe("https://cdn.example/ep0.mp4")
    expect(res.body.results[1].first_episode_video_url).toBeNull()
  })

  it("respects limit and offset query params via parseListFilters", async () => {
    const prisma = makePrismaStub({ rows: [], count: 0 })
    const res = await request(makeApp(prisma)).get("/v1/simulations?limit=10&offset=5")

    expect(res.status).toBe(200)
    expect(res.body.limit).toBe(10)
    expect(res.body.offset).toBe(5)
    expect(prisma.simulations.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 5 }),
    )
  })

  it("ANDs strict facet filters into the where clause", async () => {
    const prisma = makePrismaStub({ rows: [], count: 0 })
    const res = await request(makeApp(prisma)).get(
      "/v1/simulations?policy_slug=p1&environment_slug=e1&task_slug=t1&robot_slug=r1",
    )
    expect(res.status).toBe(200)
    expect(prisma.simulations.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          policy_slug: "p1",
          environment_slug: "e1",
          task_slug: "t1",
          robot_slug: "r1",
        },
      }),
    )
    // count uses the same where so the envelope reflects the filtered total.
    expect(prisma.simulations.count).toHaveBeenCalledWith({
      where: {
        policy_slug: "p1",
        environment_slug: "e1",
        task_slug: "t1",
        robot_slug: "r1",
      },
    })
  })

  describe("issue #56 list-side lazy-poll", () => {
    const makeRow = (
      id: string,
      slug: string,
      episodes: ISimRow["episodes"],
    ): ISimRow => ({
      id,
      slug,
      policy_slug: "p",
      environment_slug: "e",
      task_slug: null,
      robot_slug: null,
      created_at: new Date(),
      _count: { episodes: episodes.length },
      episodes,
    })

    it("polls every pending/running episode across the page concurrently", async () => {
      const rows: ISimRow[] = [
        makeRow("sim-a", "a", [
          { id: "ep-a-0", episode_index: 0, status: "running", video_url: null, oneclick_job_id: "job-a-0" },
        ]),
        makeRow("sim-b", "b", [
          { id: "ep-b-0", episode_index: 0, status: "pending", video_url: null, oneclick_job_id: "job-b-0" },
        ]),
      ]
      const prisma = makePrismaStub({ rows, count: rows.length })
      const oneclick = makeOneclickMock({
        getJob: vi.fn(async (jobId: string) => {
          if (jobId === "job-a-0") {
            return { status: "done" as const, video_url: "https://cdn.example/a.mp4" }
          }
          return { status: "done" as const, video_url: "https://cdn.example/b.mp4" }
        }),
      })
      const res = await request(makeApp(prisma, oneclick)).get("/v1/simulations")

      expect(res.status).toBe(200)
      expect(oneclick.getJob).toHaveBeenCalledTimes(2)
      expect(oneclick.getJob).toHaveBeenCalledWith("job-a-0")
      expect(oneclick.getJob).toHaveBeenCalledWith("job-b-0")
      // Fresh video URLs surface in the response envelope without a second fetch.
      expect(res.body.results[0].first_episode_video_url).toBe("https://cdn.example/a.mp4")
      expect(res.body.results[1].first_episode_video_url).toBe("https://cdn.example/b.mp4")
      // Each polled episode got one update call.
      expect(prisma._episodeUpdates).toHaveLength(2)
    })

    it("skips done/failed episodes — no oneclick traffic when nothing is pending/running", async () => {
      const rows: ISimRow[] = [
        makeRow("sim-done", "done-already", [
          { id: "ep-d-0", episode_index: 0, status: "done", video_url: "https://cdn.example/cached.mp4", oneclick_job_id: "job-d-0" },
        ]),
      ]
      const prisma = makePrismaStub({ rows, count: rows.length })
      const oneclick = makeOneclickMock()
      const res = await request(makeApp(prisma, oneclick)).get("/v1/simulations")

      expect(res.status).toBe(200)
      expect(oneclick.getJob).not.toHaveBeenCalled()
      expect(res.body.results[0].first_episode_video_url).toBe("https://cdn.example/cached.mp4")
    })

    it("keeps peer rows intact when one row's getJob throws", async () => {
      const rows: ISimRow[] = [
        makeRow("sim-ok", "ok", [
          { id: "ep-ok-0", episode_index: 0, status: "running", video_url: null, oneclick_job_id: "job-ok-0" },
        ]),
        makeRow("sim-bad", "bad", [
          { id: "ep-bad-0", episode_index: 0, status: "running", video_url: null, oneclick_job_id: "job-bad-0" },
        ]),
      ]
      const prisma = makePrismaStub({ rows, count: rows.length })
      const oneclick = makeOneclickMock({
        getJob: vi.fn(async (jobId: string) => {
          if (jobId === "job-bad-0") {
            throw new OneclickError("oneclick getJob failed (502)", 502)
          }
          return { status: "done" as const, video_url: "https://cdn.example/ok.mp4" }
        }),
      })
      const res = await request(makeApp(prisma, oneclick)).get("/v1/simulations")

      expect(res.status).toBe(200)
      // ok row got its fresh URL, bad row surfaces null (episode marked failed).
      expect(res.body.results[0].first_episode_video_url).toBe("https://cdn.example/ok.mp4")
      expect(res.body.results[1].first_episode_video_url).toBeNull()
      // Both rows' episodes hit the update path.
      const failedUpdate = prisma._episodeUpdates.find((u) => u.id === "ep-bad-0")
      expect(failedUpdate?.data["status"]).toBe("failed")
      expect(failedUpdate?.data["error_message"]).toMatch(/oneclick getJob failed/)
    })

    it("does not poll when oneclick is not wired (read-only dev server)", async () => {
      const rows: ISimRow[] = [
        makeRow("sim-a", "a", [
          { id: "ep-a-0", episode_index: 0, status: "running", video_url: null, oneclick_job_id: "job-a-0" },
        ]),
      ]
      const prisma = makePrismaStub({ rows, count: rows.length })
      const res = await request(makeApp(prisma /* no oneclick */)).get("/v1/simulations")

      expect(res.status).toBe(200)
      expect(prisma._episodeUpdates).toHaveLength(0)
      // Still returns the row shape with null video_url.
      expect(res.body.results[0].first_episode_video_url).toBeNull()
    })
  })

  it("omits facet filters that are missing or empty", async () => {
    const prisma = makePrismaStub({ rows: [], count: 0 })
    await request(makeApp(prisma)).get("/v1/simulations?policy_slug=p1&task_slug=")
    expect(prisma.simulations.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { policy_slug: "p1" } }),
    )
  })
})

describe("GET /v1/simulations/:slug", () => {
  it("returns 404 when the slug is not found", async () => {
    const prisma = makePrismaStub({ detail: null })
    const res = await request(makeApp(prisma)).get("/v1/simulations/does-not-exist")

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ error: "not_found", slug: "does-not-exist" })
  })

  it("lazy-polls every pending/running episode concurrently via oneclick.getJob", async () => {
    const detail = {
      id: "sim-z",
      slug: "z",
      policy_slug: "p",
      environment_slug: "e",
      task_slug: null,
      robot_slug: null,
      created_at: new Date(),
      updated_at: new Date(),
      episodes: [
        {
          id: "ep-0",
          simulation_id: "sim-z",
          episode_index: 0,
          status: "running",
          video_url: null,
          oneclick_job_id: "job-0",
          error_message: null,
        },
        {
          id: "ep-1",
          simulation_id: "sim-z",
          episode_index: 1,
          status: "running",
          video_url: null,
          oneclick_job_id: "job-1",
          error_message: null,
        },
        {
          id: "ep-2",
          simulation_id: "sim-z",
          episode_index: 2,
          status: "done",
          video_url: "https://cdn.example/ep-2.mp4",
          oneclick_job_id: "job-2",
          error_message: null,
        },
      ],
    }
    const prisma = makePrismaStub({ detail })
    const oneclick = makeOneclickMock({
      getJob: vi.fn(async (jobId: string) => {
        if (jobId === "job-0") {
          return {
            status: "done" as const,
            video_url: "https://cdn.example/ep-0.mp4",
          }
        }
        if (jobId === "job-1") {
          return { status: "failed" as const, error: "CUDA OOM" }
        }
        // job-2 is already terminal — should not be polled.
        return { status: "running" as const }
      }),
    })

    const res = await request(makeApp(prisma, oneclick)).get("/v1/simulations/z")

    expect(res.status).toBe(200)
    // ep-0 + ep-1 polled (both pending/running with job_id); ep-2 skipped.
    expect(oneclick.getJob).toHaveBeenCalledTimes(2)
    expect(oneclick.getJob).toHaveBeenCalledWith("job-0")
    expect(oneclick.getJob).toHaveBeenCalledWith("job-1")
    expect(oneclick.getJob).not.toHaveBeenCalledWith("job-2")
    // Each polled episode → one episodes.update call.
    const updates = prisma._episodeUpdates
    expect(updates.find((u) => u.id === "ep-0")?.data["status"]).toBe("done")
    expect(updates.find((u) => u.id === "ep-0")?.data["video_url"]).toBe(
      "https://cdn.example/ep-0.mp4",
    )
    expect(updates.find((u) => u.id === "ep-1")?.data["status"]).toBe("failed")
    expect(updates.find((u) => u.id === "ep-1")?.data["error_message"]).toBe("CUDA OOM")
    expect(updates.find((u) => u.id === "ep-2")).toBeUndefined()
    // The response shape reflects the fresh state.
    const ep0 = res.body.episodes.find((e: { id: string }) => e.id === "ep-0")
    expect(ep0.status).toBe("done")
    expect(ep0.video_url).toBe("https://cdn.example/ep-0.mp4")
    const ep1 = res.body.episodes.find((e: { id: string }) => e.id === "ep-1")
    expect(ep1.status).toBe("failed")
  })

  it("keeps peer episodes intact when one episode's getJob throws", async () => {
    const detail = {
      id: "sim-z",
      slug: "z",
      policy_slug: "p",
      environment_slug: "e",
      task_slug: null,
      robot_slug: null,
      created_at: new Date(),
      updated_at: new Date(),
      episodes: [
        {
          id: "ep-a",
          simulation_id: "sim-z",
          episode_index: 0,
          status: "running",
          video_url: null,
          oneclick_job_id: "job-a",
          error_message: null,
        },
        {
          id: "ep-b",
          simulation_id: "sim-z",
          episode_index: 1,
          status: "running",
          video_url: null,
          oneclick_job_id: "job-b",
          error_message: null,
        },
      ],
    }
    const prisma = makePrismaStub({ detail })
    const oneclick = makeOneclickMock({
      getJob: vi.fn(async (jobId: string) => {
        if (jobId === "job-a") {
          throw new OneclickError("oneclick getJob failed (502)", 502)
        }
        return {
          status: "done" as const,
          video_url: "https://cdn.example/ep-b.mp4",
        }
      }),
    })

    const res = await request(makeApp(prisma, oneclick)).get("/v1/simulations/z")

    expect(res.status).toBe(200)
    const updates = prisma._episodeUpdates
    // ep-a marked failed via the throw branch (peer-independent).
    expect(updates.find((u) => u.id === "ep-a")?.data["status"]).toBe("failed")
    expect(updates.find((u) => u.id === "ep-a")?.data["error_message"]).toMatch(
      /oneclick getJob failed/,
    )
    // ep-b transitioned to done.
    expect(updates.find((u) => u.id === "ep-b")?.data["status"]).toBe("done")
  })

  it("does not call oneclick when no episodes are pending/running", async () => {
    const detail = {
      id: "sim-z",
      slug: "z",
      policy_slug: "p",
      environment_slug: "e",
      task_slug: null,
      robot_slug: null,
      created_at: new Date(),
      updated_at: new Date(),
      episodes: [
        {
          id: "ep-0",
          simulation_id: "sim-z",
          episode_index: 0,
          status: "done",
          video_url: "https://cdn.example/ep-0.mp4",
          oneclick_job_id: "job-0",
          error_message: null,
        },
      ],
    }
    const prisma = makePrismaStub({ detail })
    const oneclick = makeOneclickMock()

    await request(makeApp(prisma, oneclick)).get("/v1/simulations/z")
    expect(oneclick.getJob).not.toHaveBeenCalled()
  })

  it("returns the Simulation with its episodes ordered by episode_index", async () => {
    const detail = {
      id: "sim-a",
      slug: "sac-humanoid-v3-isaac-aaa1",
      policy_slug: "sac-humanoid-v3",
      environment_slug: "isaac-lab-humanoid",
      task_slug: null,
      robot_slug: null,
      created_at: new Date("2026-04-22T00:00:00Z"),
      updated_at: new Date("2026-04-22T00:00:00Z"),
      episodes: [
        {
          id: "ep-0",
          simulation_id: "sim-a",
          episode_index: 0,
          status: "done",
          video_url: "https://example.com/0.mp4",
        },
        {
          id: "ep-1",
          simulation_id: "sim-a",
          episode_index: 1,
          status: "running",
          video_url: null,
        },
      ],
    }
    const prisma = makePrismaStub({ detail })
    const res = await request(makeApp(prisma)).get(
      "/v1/simulations/sac-humanoid-v3-isaac-aaa1",
    )

    expect(res.status).toBe(200)
    expect(res.body.slug).toBe("sac-humanoid-v3-isaac-aaa1")
    expect(res.body.episodes).toHaveLength(2)
    expect(res.body.episodes[0].episode_index).toBe(0)
    expect(res.body.episodes[1].episode_index).toBe(1)
    // Prisma received the orderBy: episode_index asc hint.
    expect(prisma.simulations.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: "sac-humanoid-v3-isaac-aaa1" },
        include: expect.objectContaining({
          episodes: expect.objectContaining({
            orderBy: { episode_index: "asc" },
          }),
        }),
      }),
    )
  })
})

const HAPPY_POLICY = {
  slug: "sac-humanoid-v3",
  data: { hf_repo_id: "sb3/sac-Humanoid-v3" },
}

const HAPPY_BODY = {
  policy_slug: "sac-humanoid-v3",
  environment_slug: "isaac-lab-humanoid",
  episode_count: 3,
}

describe("POST /v1/simulations", () => {
  it("creates a Simulation + N Episodes atomically, fires N oneclick submits, and returns {id, slug}", async () => {
    const prisma = makePrismaStub({
      policy: HAPPY_POLICY,
      episodeIds: ["ep-a", "ep-b", "ep-c"],
    })
    const oneclick = makeOneclickMock()
    const res = await request(makeApp(prisma, oneclick))
      .post("/v1/simulations")
      .send(HAPPY_BODY)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: "sim-new-id" })
    expect(res.body.slug).toMatch(/^sac-humanoid-v3-isaac-lab-humanoid-[0-9a-f]{4}$/)
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(prisma._txCalls).toHaveLength(1)
    expect(prisma._txCalls[0]?.episodeCreates).toHaveLength(3)
    // All three episodes got the derived hf_url + shared env.
    for (let i = 0; i < 3; i++) {
      expect(prisma._txCalls[0]?.episodeCreates[i]).toMatchObject({
        episode_index: i,
        hf_url: "https://huggingface.co/sb3/sac-Humanoid-v3",
        env_slug: "isaac-lab-humanoid",
        policy_slug: "sac-humanoid-v3",
      })
    }
    // 3 oneclick submits fired — one per Episode.
    expect(oneclick.submit).toHaveBeenCalledTimes(3)
    // Each successful submit → status=running + oneclick_job_id patch.
    const runningUpdates = prisma._episodeUpdates.filter(
      (u) => u.data["status"] === "running",
    )
    expect(runningUpdates).toHaveLength(3)
  })

  it("returns 400 when episode_count is 0", async () => {
    const prisma = makePrismaStub({ policy: HAPPY_POLICY })
    const res = await request(makeApp(prisma, makeOneclickMock()))
      .post("/v1/simulations")
      .send({ ...HAPPY_BODY, episode_count: 0 })
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: "invalid_input" })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("returns 400 when episode_count is 6", async () => {
    const prisma = makePrismaStub({ policy: HAPPY_POLICY })
    const res = await request(makeApp(prisma, makeOneclickMock()))
      .post("/v1/simulations")
      .send({ ...HAPPY_BODY, episode_count: 6 })
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: "invalid_input" })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("returns 400 when policy_slug is missing", async () => {
    const prisma = makePrismaStub({ policy: HAPPY_POLICY })
    const res = await request(makeApp(prisma, makeOneclickMock()))
      .post("/v1/simulations")
      .send({
        environment_slug: HAPPY_BODY.environment_slug,
        episode_count: HAPPY_BODY.episode_count,
      })
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: "invalid_input" })
  })

  it("returns 400 when policy_slug is not found in policies", async () => {
    const prisma = makePrismaStub({ policy: null })
    const res = await request(makeApp(prisma, makeOneclickMock()))
      .post("/v1/simulations")
      .send(HAPPY_BODY)
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: "unknown_policy" })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("returns 400 when the policy has no hf_repo_id", async () => {
    const prisma = makePrismaStub({
      policy: { slug: "sac-humanoid-v3", data: { hf_repo_id: null } },
    })
    const res = await request(makeApp(prisma, makeOneclickMock()))
      .post("/v1/simulations")
      .send(HAPPY_BODY)
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: "policy_missing_hf_repo_id" })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("marks peer episodes status=failed with error_message when one oneclick submit throws, but 200 still returns", async () => {
    const prisma = makePrismaStub({
      policy: HAPPY_POLICY,
      episodeIds: ["ep-a", "ep-b", "ep-c"],
    })
    let callCount = 0
    const oneclick = makeOneclickMock({
      submit: vi.fn(async () => {
        callCount++
        if (callCount === 2) {
          throw new OneclickError("oneclick submit failed (502): bad gateway", 502)
        }
        return { job_id: `job-${callCount}` }
      }),
    })
    const res = await request(makeApp(prisma, oneclick)).post("/v1/simulations").send(HAPPY_BODY)

    expect(res.status).toBe(200)
    expect(oneclick.submit).toHaveBeenCalledTimes(3)
    // ep-a + ep-c success, ep-b failure.
    const failedUpdates = prisma._episodeUpdates.filter(
      (u) => u.data["status"] === "failed",
    )
    expect(failedUpdates).toHaveLength(1)
    expect(failedUpdates[0]?.data["error_message"]).toMatch(/oneclick submit failed/)
    const runningUpdates = prisma._episodeUpdates.filter(
      (u) => u.data["status"] === "running",
    )
    expect(runningUpdates).toHaveLength(2)
  })

  it("rolls back ALL INSERTs when the transaction throws mid-flight", async () => {
    const prisma = makePrismaStub({
      policy: HAPPY_POLICY,
      transactionFails: new Error("simulated mid-transaction DB error"),
    })
    const oneclick = makeOneclickMock()
    const res = await request(makeApp(prisma, oneclick)).post("/v1/simulations").send(HAPPY_BODY)

    // Error bubbles up via express default error handler → 500-ish.
    expect(res.status).toBeGreaterThanOrEqual(500)
    // No oneclick submits fire when the transaction fails.
    expect(oneclick.submit).not.toHaveBeenCalled()
    // No post-tx episode updates either.
    expect(prisma._episodeUpdates).toHaveLength(0)
  })

  it("returns 503 when oneclick is not wired (key missing at boot)", async () => {
    const prisma = makePrismaStub({ policy: HAPPY_POLICY })
    const res = await request(makeApp(prisma /* no oneclick */)).post("/v1/simulations").send(HAPPY_BODY)
    expect(res.status).toBe(503)
    expect(res.body).toMatchObject({ error: "oneclick_unavailable" })
  })
})
