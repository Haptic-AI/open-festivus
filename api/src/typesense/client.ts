/**
 * Tiny HTTP client for self-hosted Typesense (festivus-typesense Dokku app).
 *
 * Uses raw `fetch` instead of the official `typesense` npm package because the
 * surface we need is small (multi_search, document upsert, document delete,
 * collection create/upsert) and adding a dependency would cost a postinstall
 * + bundle weight for ~300 lines of glue.
 *
 * Read TYPESENSE_HOST / TYPESENSE_PORT / TYPESENSE_API_KEY at startup. When any
 * of these are missing the factory returns `null` and callers fall back to the
 * Postgres-based `repo.search()` — local dev without the typesense host stays
 * functional.
 */
import type {
  ITypesenseCollectionSchema,
  ITypesenseDocument,
  ITypesenseSearchHit,
  ITypesenseSearchRequest,
} from "./types.js"

export interface ITypesenseClient {
  multiSearch(searches: ITypesenseSearchRequest[]): Promise<ITypesenseSearchHit[][]>
  upsertDocument(collection: string, doc: ITypesenseDocument): Promise<void>
  deleteDocument(collection: string, id: string): Promise<void>
  importDocuments(collection: string, docs: ITypesenseDocument[]): Promise<void>
  ensureCollection(schema: ITypesenseCollectionSchema): Promise<void>
}

export interface ITypesenseClientOptions {
  host: string
  port: number
  protocol?: "http" | "https"
  apiKey: string
  /** Test seam — defaults to global fetch. */
  fetchImpl?: typeof fetch
  /** Per-request timeout in ms. */
  timeoutMs?: number
}

export class TypesenseError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = "TypesenseError"
  }
}

class HttpTypesenseClient implements ITypesenseClient {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number

  constructor(opts: ITypesenseClientOptions) {
    const protocol = opts.protocol ?? "http"
    this.baseUrl = `${protocol}://${opts.host}:${opts.port}`
    this.apiKey = opts.apiKey
    this.fetchImpl = opts.fetchImpl ?? fetch
    this.timeoutMs = opts.timeoutMs ?? 5000
  }

  private async req<T>(
    method: string,
    path: string,
    body?: unknown,
    contentType: "json" | "ndjson" = "json",
  ): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const headers: Record<string, string> = {
        "X-TYPESENSE-API-KEY": this.apiKey,
      }
      let payload: string | undefined
      if (body !== undefined) {
        if (contentType === "ndjson") {
          headers["Content-Type"] = "text/plain"
          payload = body as string
        } else {
          headers["Content-Type"] = "application/json"
          payload = JSON.stringify(body)
        }
      }
      const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: payload,
        signal: controller.signal,
      })
      const text = await res.text()
      if (!res.ok) {
        throw new TypesenseError(
          `typesense ${method} ${path} failed: ${res.status} ${text}`,
          res.status,
        )
      }
      // ndjson responses are line-delimited JSON — caller may not care.
      if (!text) return undefined as T
      try {
        return JSON.parse(text) as T
      } catch {
        return text as unknown as T
      }
    } finally {
      clearTimeout(timer)
    }
  }

  async multiSearch(searches: ITypesenseSearchRequest[]): Promise<ITypesenseSearchHit[][]> {
    const out = await this.req<{ results: { hits?: ITypesenseSearchHit[] }[] }>(
      "POST",
      "/multi_search",
      { searches },
    )
    return out.results.map((r) => r.hits ?? [])
  }

  async upsertDocument(collection: string, doc: ITypesenseDocument): Promise<void> {
    await this.req("POST", `/collections/${collection}/documents?action=upsert`, doc)
  }

  async deleteDocument(collection: string, id: string): Promise<void> {
    try {
      await this.req("DELETE", `/collections/${collection}/documents/${encodeURIComponent(id)}`)
    } catch (err) {
      // 404 = already gone. Treat as success so callers can call deleteDocument
      // unconditionally on row delete without branching on existence.
      if (err instanceof TypesenseError && err.status === 404) return
      throw err
    }
  }

  async importDocuments(collection: string, docs: ITypesenseDocument[]): Promise<void> {
    if (docs.length === 0) return
    const ndjson = docs.map((d) => JSON.stringify(d)).join("\n")
    await this.req(
      "POST",
      `/collections/${collection}/documents/import?action=upsert`,
      ndjson,
      "ndjson",
    )
  }

  async ensureCollection(schema: ITypesenseCollectionSchema): Promise<void> {
    try {
      await this.req("POST", "/collections", schema)
    } catch (err) {
      // 409 = already exists. Treat as a no-op so this is idempotent on
      // every boot. We deliberately do NOT diff the schema here — schema
      // migrations are explicit (drop + recreate via the backfill script).
      if (err instanceof TypesenseError && err.status === 409) return
      throw err
    }
  }
}

/**
 * Read env vars and return a configured client, or `null` when any required
 * var is missing. Callers should treat `null` as "no Typesense — fall back to
 * Postgres search". Logs at warn level on missing env so missing config is
 * visible in Dokku logs but doesn't crash the API.
 */
export function createTypesenseClientFromEnv(): ITypesenseClient | null {
  const host = process.env["TYPESENSE_HOST"]
  const portStr = process.env["TYPESENSE_PORT"]
  const apiKey = process.env["TYPESENSE_API_KEY"]
  const protocol = (process.env["TYPESENSE_PROTOCOL"] as "http" | "https" | undefined) ?? "http"
  if (!host || !portStr || !apiKey) {
    console.warn(
      "typesense: env vars missing (TYPESENSE_HOST/PORT/API_KEY) — search will fall back to Postgres",
    )
    return null
  }
  const port = Number.parseInt(portStr, 10)
  if (!Number.isFinite(port)) {
    console.warn(`typesense: TYPESENSE_PORT="${portStr}" is not a number — falling back to Postgres`)
    return null
  }
  return new HttpTypesenseClient({ host, port, protocol, apiKey })
}

export function createTypesenseClient(opts: ITypesenseClientOptions): ITypesenseClient {
  return new HttpTypesenseClient(opts)
}
