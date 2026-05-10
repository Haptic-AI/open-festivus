import express from "express"
import request from "supertest"
import { describe, expect, it, vi } from "vitest"
import type {
  IOneclickClient,
  IOneclickJobResponse,
} from "../clients/oneclick.js"
import { OneclickError } from "../clients/oneclick.js"
import {
  buildEpisodesRouter,
  type IEpisodeRow,
  type IEpisodeStore,
  type IUpdateEpisodeInput,
} from "./episodes.js"

/**
 * In-memory IEpisodeStore for tests. Mirrors the Prisma contract (read +
 * update only — spec 026 Phase 3.3 retired standalone Episode creation).
 */
class MemoryStore implements IEpisodeStore {
  private readonly rows = new Map<string, IEpisodeRow>()
  private nextId = 1

  /** Test helper — seeds an Episode row directly, bypassing the retired POST path. */
  seed(input: { hf_url: string; env_slug: string }): IEpisodeRow {
    const id = `ep-${String(this.nextId++).padStart(4, "0")}`
    const now = new Date()
    const row: IEpisodeRow = {
      id,
      hf_url: input.hf_url,
      env_slug: input.env_slug,
      policy_slug: null,
      task_slug: null,
      oneclick_job_id: null,
      status: "pending",
      video_url: null,
      error_message: null,
      created_at: now,
      updated_at: now,
    }
    this.rows.set(id, row)
    return row
  }

  async findById(id: string): Promise<IEpisodeRow | null> {
    return this.rows.get(id) ?? null
  }

  async update(id: string, patch: IUpdateEpisodeInput): Promise<IEpisodeRow> {
    const existing = this.rows.get(id)
    if (!existing) throw new Error(`no episode with id=${id}`)
    const next: IEpisodeRow = {
      ...existing,
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.oneclick_job_id !== undefined
        ? { oneclick_job_id: patch.oneclick_job_id }
        : {}),
      ...(patch.video_url !== undefined ? { video_url: patch.video_url } : {}),
      ...(patch.error_message !== undefined
        ? { error_message: patch.error_message }
        : {}),
      updated_at: new Date(),
    }
    this.rows.set(id, next)
    return next
  }
}

function makeOneclickMock(overrides: Partial<IOneclickClient> = {}): IOneclickClient {
  return {
    submit: vi.fn(async () => ({ job_id: "job-xyz" })),
    getJob: vi.fn(
      async (): Promise<IOneclickJobResponse> => ({ status: "running" }),
    ),
    ...overrides,
  }
}

function makeApp(store: IEpisodeStore, oneclick: IOneclickClient) {
  const app = express()
  app.use(express.json())
  app.use("/v1/episodes", buildEpisodesRouter({ store, oneclick }))
  return app
}

const VALID_BODY = {
  hf_url: "https://huggingface.co/sb3/sac-Humanoid-v3",
  env_slug: "isaac-lab-humanoid",
}

describe("POST /v1/episodes (retired)", () => {
  it("returns 410 with a pointer to POST /v1/simulations", async () => {
    const res = await request(makeApp(new MemoryStore(), makeOneclickMock()))
      .post("/v1/episodes")
      .send(VALID_BODY)

    expect(res.status).toBe(410)
    expect(res.body).toMatchObject({ error: "episode_post_retired" })
    expect(res.body.detail).toMatch(/POST \/v1\/simulations/)
  })
})

describe("GET /v1/episodes/:id", () => {
  async function seedRunning(store: MemoryStore): Promise<IEpisodeRow> {
    const row = store.seed(VALID_BODY)
    return store.update(row.id, {
      status: "running",
      oneclick_job_id: "job-xyz",
    })
  }

  it("returns 404 for unknown id", async () => {
    const res = await request(makeApp(new MemoryStore(), makeOneclickMock()))
      .get("/v1/episodes/sim-nonexistent")
    expect(res.status).toBe(404)
  })

  it("lazy-polls while running and refreshes state", async () => {
    const store = new MemoryStore()
    const row = await seedRunning(store)
    const oneclick = makeOneclickMock({
      getJob: vi.fn(async (): Promise<IOneclickJobResponse> => ({ status: "running" })),
    })
    const res = await request(makeApp(store, oneclick))
      .get(`/v1/episodes/${row.id}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: row.id, status: "running" })
    expect(oneclick.getJob).toHaveBeenCalledWith("job-xyz")
  })

  it("surfaces oneclick's progress `message` as `progress_message` on the response", async () => {
    const store = new MemoryStore()
    const row = await seedRunning(store)
    const oneclick = makeOneclickMock({
      getJob: vi.fn(async (): Promise<IOneclickJobResponse> => ({
        status: "running",
        message: "Claude is analyzing the repository...",
      })),
    })
    const res = await request(makeApp(store, oneclick))
      .get(`/v1/episodes/${row.id}`)

    expect(res.status).toBe(200)
    expect(res.body.status).toBe("running")
    expect(res.body.progress_message).toBe("Claude is analyzing the repository...")
    // Not persisted — the column doesn't exist on the row itself.
    const persisted = await store.findById(row.id)
    expect(persisted?.error_message).toBeNull()
  })

  it("returns progress_message: null on terminal rows (no poll happens)", async () => {
    const store = new MemoryStore()
    const row = store.seed(VALID_BODY)
    await store.update(row.id, {
      status: "done",
      oneclick_job_id: "job-xyz",
      video_url: "https://example.com/v.mp4",
    })
    const res = await request(makeApp(store, makeOneclickMock()))
      .get(`/v1/episodes/${row.id}`)

    expect(res.body.status).toBe("done")
    expect(res.body.progress_message).toBeNull()
  })

  it("transitions to done + video_url when oneclick reports completed", async () => {
    const store = new MemoryStore()
    const row = await seedRunning(store)
    const oneclick = makeOneclickMock({
      getJob: vi.fn(async (): Promise<IOneclickJobResponse> => ({
        status: "done",
        video_url: "https://oneclick-policy.hapticlabs.ai/video/job-xyz",
      })),
    })
    const res = await request(makeApp(store, oneclick))
      .get(`/v1/episodes/${row.id}`)

    expect(res.status).toBe(200)
    expect(res.body.status).toBe("done")
    expect(res.body.video_url).toBe(
      "https://oneclick-policy.hapticlabs.ai/video/job-xyz",
    )
    const persisted = await store.findById(row.id)
    expect(persisted?.status).toBe("done")
    expect(persisted?.video_url).toBe(
      "https://oneclick-policy.hapticlabs.ai/video/job-xyz",
    )
  })

  it("transitions to failed + error when oneclick reports failure", async () => {
    const store = new MemoryStore()
    const row = await seedRunning(store)
    const oneclick = makeOneclickMock({
      getJob: vi.fn(async (): Promise<IOneclickJobResponse> => ({
        status: "failed",
        error: "CUDA OOM",
      })),
    })
    const res = await request(makeApp(store, oneclick))
      .get(`/v1/episodes/${row.id}`)

    expect(res.status).toBe(200)
    expect(res.body.status).toBe("failed")
    expect(res.body.error_message).toBe("CUDA OOM")
  })

  it("marks the row failed when the upstream getJob call throws", async () => {
    const store = new MemoryStore()
    const row = await seedRunning(store)
    const oneclick = makeOneclickMock({
      getJob: vi.fn(async () => {
        throw new OneclickError("oneclick getJob failed (500): boom", 500)
      }),
    })
    const res = await request(makeApp(store, oneclick))
      .get(`/v1/episodes/${row.id}`)

    expect(res.status).toBe(200)
    expect(res.body.status).toBe("failed")
    expect(res.body.error_message).toMatch(/oneclick getJob failed/)
  })

  it("does NOT call oneclick once the row is terminal (done)", async () => {
    const store = new MemoryStore()
    const row = store.seed(VALID_BODY)
    await store.update(row.id, {
      status: "done",
      oneclick_job_id: "job-xyz",
      video_url: "https://oneclick-policy.hapticlabs.ai/video/job-xyz",
    })
    const oneclick = makeOneclickMock()
    const res = await request(makeApp(store, oneclick))
      .get(`/v1/episodes/${row.id}`)

    expect(res.status).toBe(200)
    expect(res.body.status).toBe("done")
    expect(oneclick.getJob).not.toHaveBeenCalled()
  })
})
