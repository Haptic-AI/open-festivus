import "../_load-env.js"
import type { IPolicy, IRobot } from "@festivus/types"
import pg from "pg"

/**
 * Local end-to-end smoke test for postgres + api (:8000) + web (:3000).
 *
 * Proves the stack is actually wired together, not just that individual
 * services return 200. The end-to-end /api/agent check is the one that
 * catches FESTIVUS_DATASET_API_URL misrouting — both the agent route and
 * the data api return 200 in isolation even when nothing connects them.
 *
 * Usage:   pnpm --filter @festivus/api smoke
 *   env:   API_URL, WEB_URL, POSTGRES_URL, PG_CONTAINER (optional overrides)
 */

const API_URL = (process.env["API_URL"] ?? "http://localhost:8000").replace(/\/$/, "")
const WEB_URL = (process.env["WEB_URL"] ?? "http://localhost:3000").replace(/\/$/, "")
const POSTGRES_URL = process.env["POSTGRES_URL"] ?? "postgres://festivus:festivus@localhost:5432/festivus"

const GREEN = "\x1b[32m"
const RED = "\x1b[31m"
const BOLD = "\x1b[1m"
const DIM = "\x1b[2m"
const RESET = "\x1b[0m"

interface ICheckResult {
  readonly label: string
  readonly ok: boolean
  readonly detail?: string
}

interface IListResponse<T> {
  count: number
  limit: number
  offset: number
  results: T[]
}

function isListResponse<T>(value: unknown, rowGuard: (row: unknown) => row is T): value is IListResponse<T> {
  if (typeof value !== "object" || value === null) return false
  const obj = value as Record<string, unknown>
  if (typeof obj["count"] !== "number") return false
  if (!Array.isArray(obj["results"])) return false
  return obj["results"].every(rowGuard)
}

function looksLikeRobot(row: unknown): row is IRobot {
  if (typeof row !== "object" || row === null) return false
  const obj = row as Record<string, unknown>
  return typeof obj["slug"] === "string" && typeof obj["name"] === "string"
}

function looksLikePolicy(row: unknown): row is IPolicy {
  if (typeof row !== "object" || row === null) return false
  const obj = row as Record<string, unknown>
  return typeof obj["slug"] === "string"
}

async function fetchJson(url: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, { headers: { Accept: "application/json" } })
  const text = await res.text()
  let body: unknown = null
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  return { status: res.status, body }
}

async function check(label: string, fn: () => Promise<string | void>): Promise<ICheckResult> {
  try {
    const detail = await fn()
    return { label, ok: true, ...(detail !== undefined ? { detail } : {}) }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return { label, ok: false, detail }
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

// ── Section runners ─────────────────────────────────────────────────

async function postgresChecks(): Promise<ICheckResult[]> {
  const pool = new pg.Pool({ connectionString: POSTGRES_URL })
  try {
    const results: ICheckResult[] = []

    results.push(await check("postgres reachable", async () => {
      const r = await pool.query<{ ok: number }>("SELECT 1 AS ok")
      assert(r.rows[0]?.ok === 1, "SELECT 1 returned no row")
    }))

    results.push(await check("robots table has rows", async () => {
      const r = await pool.query<{ n: string }>("SELECT COUNT(*)::text AS n FROM robots")
      const n = Number.parseInt(r.rows[0]?.n ?? "0", 10)
      assert(n > 0, `robots table is empty (load a dump or run the seed)`)
      return `${n} rows`
    }))

    results.push(await check("policies table has rows", async () => {
      const r = await pool.query<{ n: string }>("SELECT COUNT(*)::text AS n FROM policies")
      const n = Number.parseInt(r.rows[0]?.n ?? "0", 10)
      assert(n > 0, `policies table is empty`)
      return `${n} rows`
    }))

    results.push(await check("datasets table has rows", async () => {
      const r = await pool.query<{ n: string }>("SELECT COUNT(*)::text AS n FROM datasets")
      const n = Number.parseInt(r.rows[0]?.n ?? "0", 10)
      assert(n > 0, `datasets table is empty`)
      return `${n} rows`
    }))

    return results
  } finally {
    await pool.end()
  }
}

async function apiChecks(): Promise<ICheckResult[]> {
  const results: ICheckResult[] = []

  results.push(await check(`GET ${API_URL}/health is ok`, async () => {
    const { status, body } = await fetchJson(`${API_URL}/health`)
    assert(status === 200, `expected 200, got ${status}`)
    assert(
      typeof body === "object" && body !== null && (body as Record<string, unknown>)["status"] === "ok",
      `expected {status:"ok"}, got ${JSON.stringify(body).slice(0, 120)}`,
    )
  }))

  results.push(await check(`GET /v1/robots returns typed, non-empty results`, async () => {
    const { status, body } = await fetchJson(`${API_URL}/v1/robots?limit=5`)
    assert(status === 200, `expected 200, got ${status}`)
    assert(isListResponse(body, looksLikeRobot), `response did not match IListResponse<IRobot>`)
    const list = body as IListResponse<IRobot>
    assert(list.count > 0, `count=0 — api is live but data is empty`)
    assert(list.results.length > 0, `results[] is empty`)
    return `count=${list.count}, first=${list.results[0]?.slug}`
  }))

  results.push(await check(`GET /v1/policies returns typed, non-empty results`, async () => {
    const { status, body } = await fetchJson(`${API_URL}/v1/policies?limit=1`)
    assert(status === 200, `expected 200, got ${status}`)
    assert(isListResponse(body, looksLikePolicy), `response did not match IListResponse<IPolicy>`)
    const list = body as IListResponse<IPolicy>
    assert(list.count > 0, `count=0`)
    return `count=${list.count}`
  }))

  results.push(await check(`GET /v1/search?q=franka finds matches`, async () => {
    const { status, body } = await fetchJson(`${API_URL}/v1/search?q=franka&limit=3`)
    assert(status === 200, `expected 200, got ${status}`)
    const text = JSON.stringify(body).toLowerCase()
    assert(text.includes("franka"), `no 'franka' in response`)
  }))

  return results
}

async function webChecks(): Promise<ICheckResult[]> {
  const results: ICheckResult[] = []

  results.push(await check(`GET ${WEB_URL}/ returns 200`, async () => {
    const res = await fetch(WEB_URL)
    assert(res.status === 200, `expected 200, got ${res.status}`)
  }))

  return results
}

async function endToEndCheck(): Promise<ICheckResult> {
  // End-to-end: the agent route must (a) emit at least one add_node tool_call
  // and (b) NOT return the data_unavailable fallback language. If the agent
  // is seeing the data api (i.e. FESTIVUS_DATASET_API_URL points at the local
  // api on :8000), search_robots returns real rows and the model wires them
  // up as nodes. If it's misrouted, we see data_unavailable instead.
  return await check(`POST /api/agent emits add_node from live data`, async () => {
    const res = await fetch(`${WEB_URL}/api/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "I need a dual arm robot",
        projectState: { nodes: [], connections: [] },
        conversationHistory: [],
      }),
    })
    assert(res.status === 200, `expected 200, got ${res.status}`)
    const text = await res.text()
    const addNodeCount = (text.match(/"name":"add_node"/g) ?? []).length
    const offline = /data_unavailable|dataset API is (currently )?offline/i.test(text)
    assert(!offline, `agent returned offline fallback — check apps/web/.env.local:FESTIVUS_DATASET_API_URL`)
    assert(addNodeCount > 0, `agent emitted no add_node tool_calls`)
    return `${addNodeCount} add_node tool_calls`
  })
}

// ── Runner ──────────────────────────────────────────────────────────

interface ISection {
  readonly title: string
  readonly run: () => Promise<ICheckResult[]> | Promise<ICheckResult>
}

function formatResult(r: ICheckResult): string {
  const icon = r.ok ? `${GREEN}ok${RESET}  ` : `${RED}FAIL${RESET}`
  const detail = r.detail !== undefined ? ` ${DIM}${r.detail}${RESET}` : ""
  return `  ${icon}  ${r.label}${detail}`
}

async function main(): Promise<void> {
  const sections: ISection[] = [
    { title: `postgres ${DIM}(${POSTGRES_URL.replace(/:[^:@]*@/, ":***@")})${RESET}`, run: postgresChecks },
    { title: `data api ${DIM}(${API_URL})${RESET}`, run: apiChecks },
    { title: `web ${DIM}(${WEB_URL})${RESET}`, run: webChecks },
    { title: `end-to-end ${DIM}(${WEB_URL}/api/agent → ${API_URL})${RESET}`, run: async () => [await endToEndCheck()] },
  ]

  let passed = 0
  let failed = 0
  const failures: ICheckResult[] = []

  for (const section of sections) {
    console.warn(`\n${BOLD}${section.title}${RESET}`)
    const out = await section.run()
    const results = Array.isArray(out) ? out : [out]
    for (const r of results) {
      console.warn(formatResult(r))
      if (r.ok) passed++
      else {
        failed++
        failures.push(r)
      }
    }
  }

  console.warn(`\n${BOLD}summary${RESET}`)
  console.warn(`  passed: ${passed}`)
  console.warn(`  failed: ${failed}`)

  if (failed > 0) {
    console.warn(`\n${BOLD}first failure detail${RESET}`)
    for (const f of failures) {
      console.warn(`  ${RED}${f.label}${RESET}`)
      if (f.detail !== undefined) console.warn(`    ${f.detail}`)
    }
    process.exit(1)
  }
}

main().catch((err: unknown) => {
  console.error("smoke-local: unexpected failure", err)
  process.exit(1)
})
