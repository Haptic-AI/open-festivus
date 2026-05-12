import { describe, expect, it, vi } from "vitest"
import {
  createOneclickClient,
  normalizeStatus,
  OneclickError,
  pickErrorMessage,
  pickVideoUrl,
} from "./oneclick.js"

/**
 * Tests for the oneclick-policy client (spec 025). All HTTP calls are mocked —
 * the real oneclick service is only hit during the Phase 4 manual smoke.
 *
 * Expected oneclick response shapes (per task-brief API references in spec 025):
 *   POST /auto_deploy { url } -> 200 { job_id: string }
 *   GET  /job/{id}            -> 200 { status: string, video_url?: string,
 *                                      error?: string, error_message?: string }
 */

function mockFetchResponse(init: {
  ok: boolean
  status: number
  statusText?: string
  body: unknown
}): Response {
  const body = typeof init.body === "string" ? init.body : JSON.stringify(init.body)
  return {
    ok: init.ok,
    status: init.status,
    statusText: init.statusText ?? "",
    json: async () => (typeof init.body === "string" ? JSON.parse(body) : init.body),
    text: async () => body,
  } as unknown as Response
}

describe("normalizeStatus", () => {
  it("maps queued/pending to pending", () => {
    expect(normalizeStatus("queued")).toBe("pending")
    expect(normalizeStatus("pending")).toBe("pending")
  })

  it("maps running/processing to running", () => {
    expect(normalizeStatus("running")).toBe("running")
    expect(normalizeStatus("processing")).toBe("running")
    expect(normalizeStatus("in_progress")).toBe("running")
  })

  it("maps completed/complete/done/success to done", () => {
    expect(normalizeStatus("completed")).toBe("done")
    expect(normalizeStatus("complete")).toBe("done")
    expect(normalizeStatus("done")).toBe("done")
    expect(normalizeStatus("success")).toBe("done")
    expect(normalizeStatus("succeeded")).toBe("done")
  })

  it("maps failed/error/cancelled to failed", () => {
    expect(normalizeStatus("failed")).toBe("failed")
    expect(normalizeStatus("error")).toBe("failed")
    expect(normalizeStatus("cancelled")).toBe("failed")
  })

  it("biases unknown string statuses to running (progress state — keep polling)", () => {
    // Real case from Phase 4 smoke: oneclick returned status="analyzing"
    // during the repo-analyze step. We don't want unknown progress states
    // to terminate the poll as `failed`; the 90s client-side cap is the
    // safety net against genuinely stuck jobs.
    expect(normalizeStatus("analyzing")).toBe("running")
    expect(normalizeStatus("deploying")).toBe("running")
    expect(normalizeStatus("weird-unknown-status")).toBe("running")
  })

  it("biases non-string input to failed (broken response envelope)", () => {
    expect(normalizeStatus(undefined)).toBe("failed")
    expect(normalizeStatus(null)).toBe("failed")
    expect(normalizeStatus(42)).toBe("failed")
  })
})

describe("pickVideoUrl", () => {
  const base = "https://oneclick-policy.hapticlabs.ai"

  it("prefers absolute gcs_video_url when present", () => {
    expect(
      pickVideoUrl(
        {
          video_url: "/video/abc.mp4",
          gcs_video_url: "https://oneclick-policy.hapticlabs.ai/video/abc.mp4",
        },
        base,
      ),
    ).toBe("https://oneclick-policy.hapticlabs.ai/video/abc.mp4")
  })

  it("passes through an absolute video_url", () => {
    expect(pickVideoUrl({ video_url: "https://cdn.example.com/abc.mp4" }, base)).toBe(
      "https://cdn.example.com/abc.mp4",
    )
  })

  it("resolves a relative video_url against the oneclick base (real shape, 2026-04-21)", () => {
    // Observed live: oneclick returns video_url as a relative path like
    // "/video/7858f844.mp4" when the job completes. If we pass that to the
    // browser as-is, it tries to fetch localhost:3000/video/... and 404s.
    expect(pickVideoUrl({ video_url: "/video/7858f844.mp4" }, base)).toBe(
      "https://oneclick-policy.hapticlabs.ai/video/7858f844.mp4",
    )
    // Also handles path without a leading slash defensively.
    expect(pickVideoUrl({ video_url: "video/7858f844.mp4" }, base)).toBe(
      "https://oneclick-policy.hapticlabs.ai/video/7858f844.mp4",
    )
  })

  it("returns undefined when neither field is a usable string", () => {
    expect(pickVideoUrl({}, base)).toBeUndefined()
    expect(pickVideoUrl({ video_url: null, gcs_video_url: null }, base)).toBeUndefined()
    expect(pickVideoUrl({ video_url: "" }, base)).toBeUndefined()
  })

  it("ignores gcs_video_url when it isn't http(s)", () => {
    expect(
      pickVideoUrl({ video_url: "/video/a.mp4", gcs_video_url: "not a url" }, base),
    ).toBe("https://oneclick-policy.hapticlabs.ai/video/a.mp4")
  })
})

describe("pickErrorMessage", () => {
  it("prefers `message` over `error` over `error_message` over `last_error`", () => {
    expect(pickErrorMessage({ message: "a", error: "b", error_message: "c", last_error: "d" })).toBe("a")
    expect(pickErrorMessage({ error: "b", error_message: "c", last_error: "d" })).toBe("b")
    expect(pickErrorMessage({ error_message: "c", last_error: "d" })).toBe("c")
    expect(pickErrorMessage({ last_error: "line1\nline2\nfinal line" })).toBe("final line")
  })

  it("returns undefined for empty / missing fields", () => {
    expect(pickErrorMessage({})).toBeUndefined()
    expect(pickErrorMessage({ message: "" })).toBeUndefined()
    expect(pickErrorMessage({ message: "   " })).toBeUndefined()
  })
})

describe("createOneclickClient", () => {
  it("throws at construction if apiKey is missing and env is empty", () => {
    const prior = process.env["ONECLICK_API_KEY"]
    delete process.env["ONECLICK_API_KEY"]
    try {
      expect(() => createOneclickClient()).toThrow(/ONECLICK_API_KEY/)
    } finally {
      if (prior !== undefined) process.env["ONECLICK_API_KEY"] = prior
    }
  })
})

describe("oneclick submit()", () => {
  it("happy path: POSTs to /auto_deploy and returns job_id", async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      expect(url).toBe("https://oneclick-policy.hapticlabs.ai/auto_deploy")
      expect(init?.method).toBe("POST")
      const headers = init?.headers as Record<string, string>
      expect(headers["X-API-Key"]).toBe("test-key")
      expect(headers["Content-Type"]).toBe("application/json")
      expect(init?.body).toBe(JSON.stringify({ url: "https://huggingface.co/sb3/sac-Humanoid-v3" }))
      return mockFetchResponse({ ok: true, status: 200, body: { job_id: "job-abc-123" } })
    }) as unknown as typeof fetch

    const client = createOneclickClient({ apiKey: "test-key", fetchImpl })
    const result = await client.submit("https://huggingface.co/sb3/sac-Humanoid-v3")
    expect(result).toEqual({ job_id: "job-abc-123" })
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it("throws OneclickError with status on 4xx response", async () => {
    const fetchImpl = vi.fn(
      async () =>
        mockFetchResponse({
          ok: false,
          status: 422,
          statusText: "Unprocessable Entity",
          body: { detail: "bad hf_url" },
        }),
    ) as unknown as typeof fetch

    const client = createOneclickClient({ apiKey: "test-key", fetchImpl })
    await expect(client.submit("not-a-valid-url")).rejects.toMatchObject({
      name: "OneclickError",
      status: 422,
    })
  })

  it("wraps network errors in OneclickError", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch")
    }) as unknown as typeof fetch

    const client = createOneclickClient({ apiKey: "test-key", fetchImpl })
    await expect(
      client.submit("https://huggingface.co/sb3/sac-Humanoid-v3"),
    ).rejects.toThrow(OneclickError)
  })

  it("throws if the response is missing job_id", async () => {
    const fetchImpl = vi.fn(
      async () =>
        mockFetchResponse({ ok: true, status: 200, body: { something_else: "x" } }),
    ) as unknown as typeof fetch

    const client = createOneclickClient({ apiKey: "test-key", fetchImpl })
    await expect(
      client.submit("https://huggingface.co/sb3/sac-Humanoid-v3"),
    ).rejects.toThrow(/no job_id/)
  })
})

describe("oneclick getJob()", () => {
  it("returns running status while the job is still processing", async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      expect(url).toBe("https://oneclick-policy.hapticlabs.ai/job/job-abc-123")
      expect(init?.method).toBe("GET")
      return mockFetchResponse({ ok: true, status: 200, body: { status: "processing" } })
    }) as unknown as typeof fetch

    const client = createOneclickClient({ apiKey: "test-key", fetchImpl })
    const result = await client.getJob("job-abc-123")
    expect(result).toEqual({ status: "running" })
  })

  it("returns done + video_url when completed", async () => {
    const fetchImpl = vi.fn(
      async () =>
        mockFetchResponse({
          ok: true,
          status: 200,
          body: {
            status: "completed",
            video_url: "https://oneclick-policy.hapticlabs.ai/video/job-abc-123",
          },
        }),
    ) as unknown as typeof fetch

    const client = createOneclickClient({ apiKey: "test-key", fetchImpl })
    const result = await client.getJob("job-abc-123")
    expect(result).toEqual({
      status: "done",
      video_url: "https://oneclick-policy.hapticlabs.ai/video/job-abc-123",
    })
  })

  it("returns failed + error message when the job failed", async () => {
    const fetchImpl = vi.fn(
      async () =>
        mockFetchResponse({
          ok: true,
          status: 200,
          body: { status: "failed", error: "policy load failed: CUDA OOM" },
        }),
    ) as unknown as typeof fetch

    const client = createOneclickClient({ apiKey: "test-key", fetchImpl })
    const result = await client.getJob("job-abc-123")
    expect(result).toEqual({
      status: "failed",
      error: "policy load failed: CUDA OOM",
    })
  })

  it("accepts `error_message` as an alias for `error`", async () => {
    const fetchImpl = vi.fn(
      async () =>
        mockFetchResponse({
          ok: true,
          status: 200,
          body: { status: "error", error_message: "quota exhausted" },
        }),
    ) as unknown as typeof fetch

    const client = createOneclickClient({ apiKey: "test-key", fetchImpl })
    const result = await client.getJob("job-abc-123")
    expect(result.status).toBe("failed")
    expect(result.error).toBe("quota exhausted")
  })

  it("does NOT surface `message` as an error during progress states (Phase 4 smoke regression)", async () => {
    // Observed during Phase 4 smoke: oneclick returns progress text in
    // `message` while the job is still running (e.g. "Claude is analyzing
    // the repository…"). If the client grabs that as an error the UI thinks
    // a live job is dead. Guard: only extract `error` when status is failed.
    const fetchImpl = vi.fn(
      async () =>
        mockFetchResponse({
          ok: true,
          status: 200,
          body: {
            job_id: "job-in-progress",
            status: "running",
            message: "Claude is analyzing the repository...",
          },
        }),
    ) as unknown as typeof fetch

    const client = createOneclickClient({ apiKey: "test-key", fetchImpl })
    const result = await client.getJob("job-in-progress")
    expect(result.status).toBe("running")
    expect(result.error).toBeUndefined()
    expect(result.message).toBe("Claude is analyzing the repository...")
  })

  it("handles the real `status=complete` terminal shape end-to-end (observed 2026-04-21)", async () => {
    // Actual oneclick response captured live after credits refilled.
    // Status = "complete" (NOT in the classic "completed"/"done" set).
    // video_url is relative; gcs_video_url is the absolute form.
    const fetchImpl = vi.fn(
      async () =>
        mockFetchResponse({
          ok: true,
          status: 200,
          body: {
            job_id: "7858f844",
            status: "complete",
            message: "Done",
            video_url: "/video/7858f844.mp4",
            gcs_video_url: "https://oneclick-policy.hapticlabs.ai/video/7858f844.mp4",
            file_size: 2012275,
          },
        }),
    ) as unknown as typeof fetch

    const client = createOneclickClient({ apiKey: "test-key", fetchImpl })
    const result = await client.getJob("7858f844")
    expect(result.status).toBe("done")
    expect(result.video_url).toBe(
      "https://oneclick-policy.hapticlabs.ai/video/7858f844.mp4",
    )
    expect(result.error).toBeUndefined()
  })

  it("reads the `message` field as the error reason (observed shape, 2026-04-21)", async () => {
    // Real oneclick /job/{id} response captured during Phase 2 smoke — status
    // is "error" (not "failed"), error text is in `message`, and the raw
    // Python traceback is in `last_error`. Both paths are covered below.
    const fetchImpl = vi.fn(
      async () =>
        mockFetchResponse({
          ok: true,
          status: 200,
          body: {
            job_id: "0bfa6f80",
            status: "error",
            message: "Error code: 400 — Your credit balance is too low …",
            url: "https://huggingface.co/sb3/sac-Humanoid-v3",
            video_url: null,
            gcs_video_url: null,
          },
        }),
    ) as unknown as typeof fetch

    const client = createOneclickClient({ apiKey: "test-key", fetchImpl })
    const result = await client.getJob("0bfa6f80")
    expect(result.status).toBe("failed")
    expect(result.error).toMatch(/credit balance is too low/)
  })

  it("falls back to `gcs_video_url` when `video_url` is absent", async () => {
    const fetchImpl = vi.fn(
      async () =>
        mockFetchResponse({
          ok: true,
          status: 200,
          body: {
            status: "completed",
            video_url: null,
            gcs_video_url: "https://storage.googleapis.com/ocp/job-xyz.mp4",
          },
        }),
    ) as unknown as typeof fetch

    const client = createOneclickClient({ apiKey: "test-key", fetchImpl })
    const result = await client.getJob("job-xyz")
    expect(result.status).toBe("done")
    expect(result.video_url).toBe(
      "https://storage.googleapis.com/ocp/job-xyz.mp4",
    )
  })

  it("trims `last_error` down to its final line when that's all we have", async () => {
    const traceback = [
      "Traceback (most recent call last):",
      "  File '/app/main.py', line 590, in _run_autonomous",
      "anthropic.BadRequestError: Error code: 400 - credit balance too low",
    ].join("\n")
    const fetchImpl = vi.fn(
      async () =>
        mockFetchResponse({
          ok: true,
          status: 200,
          body: { status: "error", last_error: traceback },
        }),
    ) as unknown as typeof fetch

    const client = createOneclickClient({ apiKey: "test-key", fetchImpl })
    const result = await client.getJob("job-xyz")
    expect(result.error).toMatch(/credit balance too low/)
    expect(result.error).not.toContain("Traceback")
  })

  it("url-encodes the jobId when building the path", async () => {
    const fetchImpl = vi.fn(async (url) => {
      expect(url).toBe("https://oneclick-policy.hapticlabs.ai/job/job%2Fwith%20chars")
      return mockFetchResponse({ ok: true, status: 200, body: { status: "queued" } })
    }) as unknown as typeof fetch

    const client = createOneclickClient({ apiKey: "test-key", fetchImpl })
    const result = await client.getJob("job/with chars")
    expect(result.status).toBe("pending")
  })
})
