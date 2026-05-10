/**
 * Seed data loader — DEPRECATED.
 *
 * Step 2.3 removed the inlined seed JSON from the system prompt. The agent
 * now fetches every record on demand via the API tools defined in
 * `apps/web/src/lib/agent/api-tools.ts`. This shrinks the prompt from
 * ~80KB to under 3KB and lets the model see the full 27K-record dataset
 * instead of a curated 30-record subset.
 *
 * The function signature is kept so the route call site still compiles,
 * but it returns an empty string. Once `route.ts` is updated to stop
 * passing this through, delete the file entirely.
 */

export function loadSeedData(): string {
  return ""
}
