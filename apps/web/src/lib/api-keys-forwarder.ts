/**
 * Spec 027 phase B. apps/web no longer talks to Postgres directly. This
 * module forwards api_keys CRUD to the Express API, gated by
 * FESTIVUS_MODERATOR_KEY. The API runs as the single writer to Supabase.
 *
 * Called only from server-side Next.js Route Handlers, never from the
 * browser — the moderator key never leaves the Vercel function.
 */

export interface IApiKeyListRow {
  id: number
  name: string | null
  tier: string
  owner_email: string | null
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export interface IApiKeyCreateResponse {
  id: number
  name: string | null
  tier: string
  owner_email: string | null
  plaintext: string
  created_at: string
}

export type ICreatableTier = "keyed" | "write"

function apiBaseUrl(): string {
  return (
    process.env["FESTIVUS_DATASET_API_URL"] ?? "https://api.festivus.hapticlabs.ai"
  ).replace(/\/$/, "")
}

function moderatorKey(): string {
  const key = process.env["FESTIVUS_MODERATOR_KEY"]
  if (!key) {
    throw new Error(
      "FESTIVUS_MODERATOR_KEY is not set. Run `pnpm --filter @festivus/api exec tsx src/scripts/mint-moderator-web-key.ts`, paste into apps/web/.env.local (dev) or Vercel env vars (prod).",
    )
  }
  return key
}

export async function listKeysFor(userId: string): Promise<IApiKeyListRow[]> {
  const url = `${apiBaseUrl()}/v1/internal/api-keys?user_id=${encodeURIComponent(userId)}`
  const res = await fetch(url, {
    headers: { "x-api-key": moderatorKey() },
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`listKeysFor failed: ${res.status} ${await res.text()}`)
  }
  const body = (await res.json()) as { keys: IApiKeyListRow[] }
  return body.keys
}

export async function createKeyFor(
  userId: string,
  name: string | null,
  tier?: ICreatableTier,
  ownerEmail?: string | null,
): Promise<IApiKeyCreateResponse> {
  const url = `${apiBaseUrl()}/v1/internal/api-keys`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-api-key": moderatorKey(),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      user_id: userId,
      name,
      ...(tier ? { tier } : {}),
      ...(ownerEmail ? { owner_email: ownerEmail } : {}),
    }),
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`createKeyFor failed: ${res.status} ${await res.text()}`)
  }
  const body = (await res.json()) as { key: IApiKeyCreateResponse }
  return body.key
}

export async function revokeKeyFor(userId: string, id: number): Promise<boolean> {
  const url = `${apiBaseUrl()}/v1/internal/api-keys/${id}?user_id=${encodeURIComponent(userId)}`
  const res = await fetch(url, {
    method: "DELETE",
    headers: { "x-api-key": moderatorKey() },
    cache: "no-store",
  })
  if (res.status === 404) return false
  if (!res.ok) {
    throw new Error(`revokeKeyFor failed: ${res.status} ${await res.text()}`)
  }
  return true
}
