/**
 * Server-side forwarder for creating new compatibility_edges rows.
 *
 * Browser flow:
 *   browser → /api/contribute/compatibility-edges (Next.js Route Handler)
 *           → here (this module, runs on Vercel function)
 *           → PUT /v1/write/compatibility-edges/<slug> (Express API on Dokku)
 *
 * The Express API gates writes behind tier='write' API keys. We forward with
 * FESTIVUS_MODERATOR_KEY so the moderator key never leaves the Vercel
 * function — same pattern as api-keys-forwarder.ts.
 */

import type { ICompatibilityEdge } from "@festivus/types"

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

/**
 * PUT a compatibility edge by slug. Upsert semantics — replaces the whole
 * row if it exists, creates it if it doesn't. The dual-write Typesense
 * decorator on the API repo mirrors the change into Typesense fire-and-forget.
 */
export async function upsertCompatibilityEdge(
  edge: ICompatibilityEdge,
): Promise<ICompatibilityEdge> {
  const url = `${apiBaseUrl()}/v1/write/compatibility-edges/${encodeURIComponent(edge.slug)}`
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "x-api-key": moderatorKey(),
      "content-type": "application/json",
    },
    body: JSON.stringify(edge),
    cache: "no-store",
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`upsertCompatibilityEdge failed: ${res.status} ${text}`)
  }
  return (await res.json()) as ICompatibilityEdge
}
