/**
 * Live Festivus data API canary.
 *
 * WHY: the web app ships a Zod-validated `FestivusClient` and unit
 * tests that use stubbed fetch, plus an `api-tools.test.ts` that
 * verifies dispatch semantics — but NOTHING in the fast tier ever
 * touches the real deployed FastAPI. A recent "Dataset offline -
 * using known dual-arm options" observation traced back to an unset
 * `FESTIVUS_DATASET_API_URL` plus a deployed service the onboarding
 * docs did not mention. This canary bridges the gap: one real HTTP
 * round trip per `pnpm test` run, parsed through the exact same
 * `robotSchema` the production client uses, so three regressions
 * become loud instead of silent:
 *
 *   1. Deployed service is down or unreachable — fetch fails and this
 *      test fails with the network error.
 *   2. Response shape drifts out of sync with the TS `robotSchema` —
 *      Zod safeParse surfaces the full issue path.
 *   3. Auth gets added to a previously-open endpoint — non-2xx status
 *      fails the test with the status code and first bytes of the
 *      body.
 *
 * WHY CONDITIONALLY SKIPPED: a fresh clone of the repo must still
 * `pnpm test` green with zero configuration. The canary only runs
 * when `FESTIVUS_DATASET_API_URL` is set in the environment — the
 * same env var the real `FestivusClient` reads. Contributors who
 * want live coverage set it in `apps/web/.env.local` (see
 * `apps/web/.env.local.example`). Vitest loads env vars from
 * `.env.local` via the root setup, so setting it there is enough
 * to activate this test.
 */

import { describe, expect, it } from "vitest"
import { paginatedResponseSchema, robotSchema } from "@/lib/schemas/domain"

const API_URL = process.env["FESTIVUS_DATASET_API_URL"]
const FETCH_TIMEOUT_MS = 5_000

const maybeDescribe = API_URL !== undefined && API_URL.length > 0 ? describe : describe.skip

maybeDescribe("Festivus data API canary (live)", () => {
  it(`GET /v1/robots?limit=1 returns a robot that parses through robotSchema`, async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(`${API_URL}/v1/robots?limit=1`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      })
    } catch (err) {
      throw new Error(
        `canary fetch failed against ${API_URL}: ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      clearTimeout(timer)
    }

    expect(
      res.ok,
      `expected 2xx from ${API_URL}/v1/robots; got ${res.status} ${res.statusText}`,
    ).toBe(true)

    const body = (await res.json()) as unknown

    const parsed = paginatedResponseSchema(robotSchema).safeParse(body)
    if (!parsed.success) {
      const preview = JSON.stringify(body).slice(0, 500)
      throw new Error(
        `robotSchema drift: ${parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}\nbody head: ${preview}`,
      )
    }

    expect(parsed.data.results.length).toBeGreaterThanOrEqual(1)
    const robot = parsed.data.results[0]!
    expect(typeof robot.slug).toBe("string")
    expect(robot.slug.length).toBeGreaterThan(0)
  })
})
