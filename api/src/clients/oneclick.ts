/**
 * HTTP client for the oneclick-policy render service (spec 025).
 *
 * Wraps POST /auto_deploy and GET /job/{id} on https://oneclick-policy.hapticlabs.ai.
 * All calls are server-side — the `ONECLICK_API_KEY` never leaves the api/ workspace.
 *
 * Why a wrapper? (1) One place to read the API key. (2) Normalize the upstream's
 * status strings ("queued" / "processing" / "completed" / "error" / …) into our
 * `SimulationStatus` enum, so downstream code never branches on free-form text.
 * (3) Testable: the factory takes an injectable `fetch` so unit tests can mock
 * the network without touching the real service.
 */

export type ISimulationStatus = "pending" | "running" | "done" | "failed"

export interface IOneclickSubmitResponse {
  job_id: string
}

export interface IOneclickJobResponse {
  status: ISimulationStatus
  video_url?: string
  error?: string
  /**
   * Human-readable progress text from oneclick (e.g. "Claude is analyzing
   * the repository…"). Only populated for non-terminal statuses; for failed
   * jobs the same string gets routed to `error` via `pickErrorMessage`.
   */
  message?: string
}

export interface IOneclickClient {
  submit(hfUrl: string): Promise<IOneclickSubmitResponse>
  getJob(jobId: string): Promise<IOneclickJobResponse>
}

export interface IOneclickClientOptions {
  apiKey?: string
  baseUrl?: string
  fetchImpl?: typeof fetch
}

const DEFAULT_BASE_URL = "https://oneclick-policy.hapticlabs.ai"

export class OneclickError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = "OneclickError"
  }
}

/**
 * Pick the best playable video URL from an oneclick /job/{id} response.
 *
 * Priority: absolute `gcs_video_url` → absolute `video_url` → relative
 * `video_url` resolved against the oneclick base. Returns undefined when
 * neither field is a usable string.
 */
export function pickVideoUrl(
  body: Record<string, unknown>,
  baseUrl: string,
): string | undefined {
  const gcs = body["gcs_video_url"]
  if (typeof gcs === "string" && /^https?:\/\//.test(gcs)) return gcs
  const raw = body["video_url"]
  if (typeof raw !== "string" || raw.trim() === "") return undefined
  if (/^https?:\/\//.test(raw)) return raw
  const cleanBase = baseUrl.replace(/\/$/, "")
  const cleanPath = raw.startsWith("/") ? raw : `/${raw}`
  return `${cleanBase}${cleanPath}`
}

/**
 * Extract a human-readable error message from an oneclick /job/{id} response.
 * Prefers `message` (the structured reason), falls back to `error` and
 * `error_message` (backstop shapes), then `last_error` trimmed to its final
 * line (the raw Python traceback is too wide for a UI badge).
 */
export function pickErrorMessage(body: Record<string, unknown>): string | undefined {
  if (typeof body["message"] === "string" && body["message"].trim() !== "") {
    return body["message"]
  }
  if (typeof body["error"] === "string" && body["error"].trim() !== "") {
    return body["error"]
  }
  if (typeof body["error_message"] === "string" && body["error_message"].trim() !== "") {
    return body["error_message"]
  }
  if (typeof body["last_error"] === "string" && body["last_error"].trim() !== "") {
    const lines = body["last_error"].trim().split("\n").filter((l) => l.trim() !== "")
    return lines[lines.length - 1]
  }
  return undefined
}

/**
 * Map oneclick's free-form status strings to our `SimulationStatus` enum.
 *
 * Terminal states (`done`/`completed`/`success`/`succeeded` and
 * `failed`/`error`/`errored`/`cancelled`) are matched explicitly. Known
 * pending/running states are matched explicitly. Anything else — including
 * progress states oneclick may add later, e.g. `"analyzing"` or `"deploying"` —
 * is treated as `running` so the caller keeps polling. The 90-second
 * client-side poll cap is the safety net against genuinely stuck jobs.
 *
 * Non-string input (null, number, undefined) biases to `failed` because that
 * signals a broken response envelope, not a progress state we haven't seen.
 */
export function normalizeStatus(raw: unknown): ISimulationStatus {
  if (typeof raw !== "string") return "failed"
  const s = raw.toLowerCase()
  if (s === "queued" || s === "pending") return "pending"
  if (s === "running" || s === "processing" || s === "in_progress") return "running"
  if (
    s === "done" ||
    s === "complete" ||
    s === "completed" ||
    s === "success" ||
    s === "succeeded"
  ) {
    return "done"
  }
  if (s === "failed" || s === "error" || s === "errored" || s === "cancelled") {
    return "failed"
  }
  return "running"
}

export function createOneclickClient(options: IOneclickClientOptions = {}): IOneclickClient {
  const apiKey = options.apiKey ?? process.env["ONECLICK_API_KEY"]
  if (!apiKey || apiKey.trim() === "") {
    throw new OneclickError(
      "ONECLICK_API_KEY is not set — add it to api/.env.local (spec 025).",
    )
  }
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "")
  const doFetch = options.fetchImpl ?? fetch

  async function submit(hfUrl: string): Promise<IOneclickSubmitResponse> {
    let response: Response
    try {
      response = await doFetch(`${baseUrl}/auto_deploy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey as string,
        },
        body: JSON.stringify({ url: hfUrl }),
      })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      throw new OneclickError(`oneclick submit network error: ${detail}`)
    }
    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new OneclickError(
        `oneclick submit failed (${response.status}): ${text || response.statusText}`,
        response.status,
      )
    }
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
    const jobId = typeof body["job_id"] === "string" ? body["job_id"] : undefined
    if (!jobId) {
      throw new OneclickError(
        `oneclick submit returned no job_id (body keys: ${Object.keys(body).join(",")})`,
      )
    }
    return { job_id: jobId }
  }

  async function getJob(jobId: string): Promise<IOneclickJobResponse> {
    let response: Response
    try {
      response = await doFetch(`${baseUrl}/job/${encodeURIComponent(jobId)}`, {
        method: "GET",
        headers: { "X-API-Key": apiKey as string },
      })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      throw new OneclickError(`oneclick getJob network error: ${detail}`)
    }
    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new OneclickError(
        `oneclick getJob failed (${response.status}): ${text || response.statusText}`,
        response.status,
      )
    }
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
    const status = normalizeStatus(body["status"])
    // Observed oneclick responses populate `video_url` (often a relative path
    // like "/video/abc.mp4"), and sometimes a companion `gcs_video_url` with
    // the same file served as an absolute URL. Prefer the absolute form;
    // resolve a relative `video_url` against the oneclick base so the
    // browser can fetch it directly without a proxy.
    const videoUrl = pickVideoUrl(body, baseUrl)
    // Only treat `message` (or its aliases) as an error when the status is
    // actually `failed`. During progress oneclick populates `message` with
    // human-readable step text (e.g. "Claude is analyzing the repository…");
    // if we grabbed that as an error, downstream would mistake a live job for
    // a dead one. Phase 4 smoke caught this the first time a card was clicked.
    const errorMsg = status === "failed" ? pickErrorMessage(body) : undefined
    // Expose the progress `message` on non-terminal statuses so the UI can
    // narrate what oneclick is doing while the poll waits. Swallow it on
    // failed status because `errorMsg` already carries the failure reason.
    const progressMsg =
      status !== "failed" && typeof body["message"] === "string" && body["message"].trim() !== ""
        ? body["message"]
        : undefined
    const result: IOneclickJobResponse = { status }
    if (videoUrl !== undefined) result.video_url = videoUrl
    if (errorMsg !== undefined) result.error = errorMsg
    if (progressMsg !== undefined) result.message = progressMsg
    return result
  }

  return { submit, getJob }
}
