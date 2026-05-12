/**
 * Festivus dataset API client.
 *
 * Talks to the Festivus data API (Express, `api/` workspace). Every method validates the
 * response through the matching Zod schema and returns null on parse failure
 * (rather than throwing) so callers can degrade gracefully when the data
 * shape drifts.
 *
 * Configuration via env vars:
 *   FESTIVUS_DATASET_API_URL  base URL (default https://api.festivus.hapticlabs.ai)
 *   FESTIVUS_DATASET_API_KEY  optional API key sent as `X-API-Key`
 *
 * Wire-format notes (see plan lessons 5-10):
 *   - Curated and bulk records coexist in every list response.
 *   - Curated robots have taxonomy=null; bulk robots have a taxonomy object.
 *   - Bulk robots may have null image_url, dof, price_usd, weight_kg.
 *   - Bulk policies may have null hf_repo_id and paper_arxiv_url.
 *   - Compatibility has 36K+ edges — always paginate.
 */

import {
  parseCompatibilityEdgesResponse,
  parseDataset,
  parseDatasetsResponse,
  parseDeployNotesResponse,
  parseEnvironmentsResponse,
  parsePoliciesResponse,
  parsePolicy,
  parseRobot,
  parseRobotsResponse,
  parseTask,
  parseTasksResponse,
} from "@/lib/schemas/domain"
import type {
  ICompatibilityEdge,
  IDataset,
  IDeployNote,
  IEnvironment,
  IPolicy,
  IRobot,
  IRobotFullResponse,
  ITask,
} from "@festivus/types"

// ── Filter types ──────────────────────────────────────────────────

export interface IRobotFilters {
  type?: string
  manufacturer?: string
  price_min?: number
  price_max?: number
  has_policies?: boolean
  q?: string
  sort?: string
  limit?: number
  offset?: number
}

export interface IPolicyFilters {
  robot?: string
  skill?: string
  evidence?: string
  framework?: string
  q?: string
  sort?: string
  limit?: number
  offset?: number
}

export interface IDatasetFilters {
  format?: string
  q?: string
  sort?: string
  limit?: number
  offset?: number
}

export interface ITaskFilters {
  category?: string
  difficulty?: string
  robot_type?: string
  q?: string
  sort?: string
  limit?: number
  offset?: number
}

export interface ICompatibilityFilters {
  robot?: string
  policy?: string
  status?: string
  source?: string
  q?: string
  limit?: number
  offset?: number
}

export interface IDeployNoteFilters {
  robot_type?: string
  severity?: string
  limit?: number
  offset?: number
}

export interface IEnvironmentFilters {
  simulator?: string
  q?: string
  limit?: number
  offset?: number
}

// ── Client interface (for dependency injection) ───────────────────
//
// MockFestivusClient implements this same shape so the agent route can
// swap in a deterministic mock for smoke tests without changing call sites.

export interface IFestivusClient {
  searchRobots(filters?: IRobotFilters): Promise<IRobot[] | null>
  searchPolicies(filters?: IPolicyFilters): Promise<IPolicy[] | null>
  searchDatasets(filters?: IDatasetFilters): Promise<IDataset[] | null>
  searchTasks(filters?: ITaskFilters): Promise<ITask[] | null>
  searchCompatibility(filters?: ICompatibilityFilters): Promise<ICompatibilityEdge[] | null>
  searchDeployNotes(filters?: IDeployNoteFilters): Promise<IDeployNote[] | null>
  searchEnvironments(filters?: IEnvironmentFilters): Promise<IEnvironment[] | null>
  getRobot(slug: string): Promise<IRobot | null>
  getPolicy(slug: string): Promise<IPolicy | null>
  getDataset(slug: string): Promise<IDataset | null>
  getTask(slug: string): Promise<ITask | null>
  getRobotFull(slug: string): Promise<IRobotFullResponse | null>
}

// ── Client ────────────────────────────────────────────────────────

export interface IFestivusClientOptions {
  baseUrl?: string
  apiKey?: string
  fetchImpl?: typeof fetch
  /**
   * Called once per outbound request with the fully-constructed URL string,
   * just before the fetch fires. Used by the agent route to surface the real
   * wire URL in the "Show process" disclosure on the workbench canvas.
   * Non-reentrant and non-awaited — keep the callback synchronous.
   */
  onRequest?: (url: string) => void
}

export class FestivusClient implements IFestivusClient {
  private readonly baseUrl: string
  private readonly apiKey: string | null
  private readonly fetchImpl: typeof fetch
  private readonly onRequest: ((url: string) => void) | null

  constructor(options: IFestivusClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? process.env["FESTIVUS_DATASET_API_URL"] ?? "https://api.festivus.hapticlabs.ai").replace(/\/$/, "")
    this.apiKey = options.apiKey ?? process.env["FESTIVUS_DATASET_API_KEY"] ?? null
    this.fetchImpl = options.fetchImpl ?? fetch
    this.onRequest = options.onRequest ?? null
    announceBaseUrl(this.baseUrl)
  }

  // ── List endpoints ──

  async searchRobots(filters: IRobotFilters = {}): Promise<IRobot[] | null> {
    const raw = await this.get("/v1/robots", filters)
    if (raw === null) return null
    return parseRobotsResponse(raw)
  }

  async searchPolicies(filters: IPolicyFilters = {}): Promise<IPolicy[] | null> {
    const raw = await this.get("/v1/policies", filters)
    if (raw === null) return null
    return parsePoliciesResponse(raw)
  }

  async searchDatasets(filters: IDatasetFilters = {}): Promise<IDataset[] | null> {
    const raw = await this.get("/v1/datasets", filters)
    if (raw === null) return null
    return parseDatasetsResponse(raw)
  }

  async searchTasks(filters: ITaskFilters = {}): Promise<ITask[] | null> {
    const raw = await this.get("/v1/tasks", filters)
    if (raw === null) return null
    return parseTasksResponse(raw)
  }

  async searchCompatibility(filters: ICompatibilityFilters = {}): Promise<ICompatibilityEdge[] | null> {
    const raw = await this.get("/v1/compatibility-edges", filters)
    if (raw === null) return null
    return parseCompatibilityEdgesResponse(raw)
  }

  async searchDeployNotes(filters: IDeployNoteFilters = {}): Promise<IDeployNote[] | null> {
    const raw = await this.get("/v1/deploy-notes", filters)
    if (raw === null) return null
    return parseDeployNotesResponse(raw)
  }

  async searchEnvironments(filters: IEnvironmentFilters = {}): Promise<IEnvironment[] | null> {
    const raw = await this.get("/v1/environments", filters)
    if (raw === null) return null
    return parseEnvironmentsResponse(raw)
  }

  // ── Single-record endpoints ──

  async getRobot(slug: string): Promise<IRobot | null> {
    const raw = await this.get(`/v1/robots/${encodeURIComponent(slug)}`)
    if (raw === null) return null
    return parseRobot(raw)
  }

  async getPolicy(slug: string): Promise<IPolicy | null> {
    const raw = await this.get(`/v1/policies/${encodeURIComponent(slug)}`)
    if (raw === null) return null
    return parsePolicy(raw)
  }

  async getDataset(slug: string): Promise<IDataset | null> {
    const raw = await this.get(`/v1/datasets/${encodeURIComponent(slug)}`)
    if (raw === null) return null
    return parseDataset(raw)
  }

  async getTask(slug: string): Promise<ITask | null> {
    const raw = await this.get(`/v1/tasks/${encodeURIComponent(slug)}`)
    if (raw === null) return null
    return parseTask(raw)
  }

  /**
   * Joined response: robot + its compatible policies + its compatible datasets.
   * Powers Shape 13 (X→X) and "everything for ALOHA" style queries.
   * Returns the raw shape (with its own Zod parse) since it bundles three entities.
   */
  async getRobotFull(slug: string): Promise<IRobotFullResponse | null> {
    const raw = await this.get(`/v1/robots/${encodeURIComponent(slug)}/full`)
    if (raw === null || typeof raw !== "object") return null
    const obj = raw as Record<string, unknown>
    const robot = parseRobot(obj["robot"])
    if (robot === null) return null
    const rawPolicies = obj["policies"]
    const rawDatasets = obj["datasets"]
    if (!Array.isArray(rawPolicies) || !Array.isArray(rawDatasets)) return null
    const policies: IPolicy[] = []
    for (const p of rawPolicies) {
      const parsed = parsePolicy(p)
      if (parsed !== null) policies.push(parsed)
    }
    const datasets: IDataset[] = []
    for (const d of rawDatasets) {
      const parsed = parseDataset(d)
      if (parsed !== null) datasets.push(parsed)
    }
    return { robot, policies, datasets }
  }

  // ── Internal ──

  private async get(path: string, params: object = {}): Promise<unknown | null> {
    const url = new URL(this.baseUrl + path)
    for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
      if (value === undefined || value === null) continue
      url.searchParams.set(key, String(value))
    }
    const headers: Record<string, string> = { Accept: "application/json" }
    if (this.apiKey !== null) headers["X-API-Key"] = this.apiKey

    const finalUrl = url.toString()
    this.onRequest?.(finalUrl)
    let response: Response
    try {
      response = await this.fetchImpl(finalUrl, { headers })
    } catch {
      return null
    }
    if (!response.ok) return null
    try {
      return await response.json()
    } catch {
      return null
    }
  }
}

let defaultClient: FestivusClient | null = null

export function getFestivusClient(): FestivusClient {
  if (defaultClient === null) defaultClient = new FestivusClient()
  return defaultClient
}

// One-time per-process visibility into which data api the client is pointing
// at. The silent-misrouting footgun (local web talking to stale prod while
// both layers return 200) becomes impossible to miss once the base URL is
// printed on first use. Suppressed in tests so vitest output stays clean.
const announcedBaseUrls = new Set<string>()
function announceBaseUrl(baseUrl: string): void {
  if (process.env["NODE_ENV"] === "test") return
  if (announcedBaseUrls.has(baseUrl)) return
  announcedBaseUrls.add(baseUrl)
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(baseUrl)
  const tag = isLocal ? "local" : "REMOTE"
  console.warn(`[festivus] data client → ${baseUrl} (${tag})`)
}
