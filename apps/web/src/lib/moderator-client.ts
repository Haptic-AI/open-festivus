/**
 * Server-side forwarder to the Express API for moderator ops.
 *
 * Uses FESTIVUS_MODERATOR_KEY (a write-tier api_keys row provisioned per env
 * via `pnpm --filter @festivus/api exec tsx src/scripts/mint-moderator-web-key.ts`).
 *
 * The plaintext key never leaves the server — every caller in /moderate runs
 * inside a Server Component or Server Action, never a browser fetch.
 */

import type { IMutation } from "@festivus/types"

function apiBaseUrl(): string {
  return (
    process.env["FESTIVUS_DATASET_API_URL"] ?? "https://api.festivus.hapticlabs.ai"
  ).replace(/\/$/, "")
}

function moderatorKey(): string {
  const key = process.env["FESTIVUS_MODERATOR_KEY"]
  if (!key) {
    throw new Error(
      "FESTIVUS_MODERATOR_KEY is not set. Run `pnpm --filter @festivus/api exec tsx src/scripts/mint-moderator-web-key.ts`, paste the plaintext into apps/web/.env.local (dev) or Vercel env vars (prod).",
    )
  }
  return key
}

export interface IMutationListResponse {
  count: number
  limit: number
  offset: number
  results: IMutation[]
}

export async function listPendingMutations(limit = 50): Promise<IMutationListResponse> {
  const url = `${apiBaseUrl()}/v1/mutations?status=pending_review&limit=${limit}`
  const res = await fetch(url, {
    headers: { "x-api-key": moderatorKey() },
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`listPendingMutations failed: ${res.status} ${await res.text()}`)
  }
  return res.json() as Promise<IMutationListResponse>
}

export async function reviewMutation(
  id: number,
  action: "approve" | "reject" | "revert",
  note?: string,
): Promise<IMutation> {
  const url = `${apiBaseUrl()}/v1/mutations/${id}/review`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-api-key": moderatorKey(),
      "content-type": "application/json",
    },
    body: JSON.stringify({ action, ...(note ? { note } : {}) }),
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`reviewMutation failed: ${res.status} ${await res.text()}`)
  }
  return res.json() as Promise<IMutation>
}
