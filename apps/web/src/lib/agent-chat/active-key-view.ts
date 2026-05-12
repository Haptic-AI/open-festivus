/**
 * Pure decision for "does the user need to see the Mint API Key card?".
 *
 * The agent-chat drawer mounts and eagerly fetches GET /api/api-keys to
 * decide whether to surface the Mint card. The four input states this
 * helper covers are:
 *
 *   1. 200 OK + at least one un-revoked key  → has active key, hide Mint
 *   2. 200 OK + zero keys (or all revoked)   → no active key, show Mint
 *   3. 401 / 403 from the route              → signed-out or no Clerk
 *                                              session, show Mint card
 *                                              (its CTA Clerk-redirects)
 *   4. 5xx / network throw                   → optimistic-true; do not
 *                                              false-alarm someone who
 *                                              DOES have a key when the
 *                                              server is just hiccuping
 *
 * Extracted from ChatDrawer.tsx so the four states can be pinned with a
 * vitest test (Codified Rule 28: no .test.tsx; pin presentation logic
 * via a pure helper instead).
 */

export type IKeyCheckInput =
  | { kind: "ok"; keys: ReadonlyArray<{ revoked_at: string | null }> }
  | { kind: "unauthorized" }
  | { kind: "upstream-error" }

export function deriveHasActiveKey(input: IKeyCheckInput): boolean {
  if (input.kind === "ok") {
    return input.keys.some((k) => k.revoked_at === null)
  }
  if (input.kind === "unauthorized") return false
  return true
}

/**
 * Convert a fetch Response (already-checked .ok) into the pure input
 * shape this module's decision consumes. Caller still does the network
 * I/O and JSON parse.
 */
export function classifyKeyCheckResponse(
  status: number,
  body: { keys?: ReadonlyArray<{ revoked_at: string | null }> } | null,
): IKeyCheckInput {
  if (status >= 200 && status < 300 && body !== null) {
    return { kind: "ok", keys: body.keys ?? [] }
  }
  if (status === 401 || status === 403) {
    return { kind: "unauthorized" }
  }
  return { kind: "upstream-error" }
}
