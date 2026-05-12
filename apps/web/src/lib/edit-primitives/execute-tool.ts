import { signConfirmationToken, verifyConfirmationToken } from "./confirmation-token"
import { AGENT_EDITABLE_FIELDS, type IAgentEditableTable } from "./allowlist"

/**
 * Server-side tool executor for the agent-chat SSE loop (spec 029).
 *
 * Each tool maps to one function in this module. They all run on the
 * Node.js side — the browser never issues these calls. Errors return
 * structured payloads that Claude can reason about in the next turn.
 */

export interface IToolExecutorDeps {
  /** Read-side API base. Defaults to FESTIVUS_DATASET_API_URL or prod. */
  readApiUrl: string
  /** Write-side API base. Same service; kept separate for easy stubbing. */
  writeApiUrl: string
  /** Moderator key used to forward writes on behalf of the user. */
  moderatorKey: string
  /** Current user's Clerk id. Stamped into confirmation tokens + on-behalf-of
   *  headers. The canonical users.id is resolved server-side by api's
   *  apiKeyMiddleware when it sees X-On-Behalf-Of-User-Id. Keeping apps/web
   *  on Clerk ids only keeps this module Postgres-free (spec 027). */
  userClerkId: string
  /** Optional fetch override — tests pass a mock. Defaults to global fetch. */
  fetchImpl?: typeof fetch
}

function isAllowedField(table: string, field: string): boolean {
  const list = AGENT_EDITABLE_FIELDS[table as IAgentEditableTable]
  return Array.isArray(list) && list.includes(field)
}

export async function executeListCandidates(
  deps: IToolExecutorDeps,
  input: { table: string; field: string; limit?: number },
): Promise<unknown> {
  if (!(input.table in AGENT_EDITABLE_FIELDS)) {
    return { error: "unknown_table", table: input.table }
  }
  if (!isAllowedField(input.table, input.field)) {
    return {
      error: "field_not_agent_editable",
      table: input.table,
      field: input.field,
      allowed: AGENT_EDITABLE_FIELDS[input.table as IAgentEditableTable],
    }
  }
  const limit = Math.min(Math.max(1, input.limit ?? 10), 25)
  const url = `${deps.readApiUrl.replace(/\/$/, "")}/v1/${input.table}?limit=${limit}`
  const fetchImpl = deps.fetchImpl ?? fetch
  const res = await fetchImpl(url, { cache: "no-store" })
  if (!res.ok) {
    return { error: "read_api_failed", status: res.status, detail: await res.text() }
  }
  const body = (await res.json()) as { count?: number; results?: Array<Record<string, unknown>> }
  const rows = body.results ?? []
  const candidates = rows
    .filter((r) => {
      const v = r[input.field]
      return v === null || v === undefined || v === ""
    })
    .slice(0, limit)
    .map((r) => ({
      slug: r["slug"],
      name: r["name"] ?? r["title"] ?? r["slug"],
      current_value: r[input.field] ?? null,
    }))
  return { count: candidates.length, candidates }
}

export async function executeProposeEdit(
  deps: IToolExecutorDeps,
  input: { table: string; slug: string; field: string; value: unknown; reason?: string },
): Promise<unknown> {
  if (!isAllowedField(input.table, input.field)) {
    return {
      error: "field_not_agent_editable",
      table: input.table,
      field: input.field,
      allowed: AGENT_EDITABLE_FIELDS[input.table as IAgentEditableTable] ?? [],
    }
  }
  const token = signConfirmationToken({
    table: input.table,
    slug: input.slug,
    field: input.field,
    value: input.value,
    user_id: deps.userClerkId,
  })
  return {
    confirmation_token: token,
    table: input.table,
    slug: input.slug,
    field: input.field,
    value: input.value,
    reason: input.reason ?? null,
    ttl_seconds: 300,
  }
}

export async function executeApplyEdit(
  deps: IToolExecutorDeps,
  input: { confirmation_token: string; reason?: string },
): Promise<unknown> {
  const verified = verifyConfirmationToken(input.confirmation_token)
  if (!verified.ok) {
    return { error: "invalid_confirmation_token", reason: verified.reason }
  }
  if (verified.payload.user_id !== deps.userClerkId) {
    return { error: "token_user_mismatch" }
  }

  const { table, slug, field, value } = verified.payload
  const url = `${deps.writeApiUrl.replace(/\/$/, "")}/v1/write/${table}/${slug}`
  const fetchImpl = deps.fetchImpl ?? fetch

  const res = await fetchImpl(url, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-api-key": deps.moderatorKey,
      "x-on-behalf-of-user-id": deps.userClerkId,
    },
    body: JSON.stringify({ patch: { [field]: value }, reason: input.reason ?? null }),
    cache: "no-store",
  })

  const text = await res.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = { raw: text }
  }

  if (res.status >= 200 && res.status < 300) {
    return { ok: true, status: res.status, body: parsed }
  }
  return { ok: false, status: res.status, body: parsed }
}
