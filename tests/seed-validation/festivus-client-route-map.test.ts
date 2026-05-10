import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

// Audit that every /v1/* path FestivusClient calls is either:
//   (a) implemented by a route in api/src/routes/*.ts, OR
//   (b) explicitly on the documented-404 list.
//
// This prevents pre-existing 404 behavior from regressing silently, and
// ensures newly-added client calls get a matching server route.

const ROOT = resolve(__dirname, "../..")

const IMPLEMENTED_PATH_PREFIXES = [
  "/v1/robots",
  "/v1/policies",
  "/v1/datasets",
  "/v1/benchmarks",
  "/v1/deploy-notes",
  "/v1/environments",
  "/v1/stats",
  "/v1/search",
  "/v1/tasks",
  "/v1/compatibility-edges",
  "/v1/write",
  "/v1/mutations",
]

// Paths FestivusClient calls that intentionally 404 against the new API.
// Kept defensively: /v1/compatibility is a server-side alias retained for
// back-compat but not called by the client; /v1/ask is intentionally removed.
const DOCUMENTED_404_PREFIXES = ["/v1/compatibility", "/v1/ask"]

function extractClientPaths(): string[] {
  const src = readFileSync(resolve(ROOT, "apps/web/src/lib/api/festivus-client.ts"), "utf8")
  const literal = /["']\/v1\/[a-z0-9\-_/]+["']/gi
  const template = /`\/v1\/[a-z0-9\-_/]+/gi
  const hits = new Set<string>()
  for (const m of src.matchAll(literal)) hits.add(m[0].slice(1, -1))
  for (const m of src.matchAll(template)) {
    const raw = m[0].slice(1)
    const prefix = raw.split("${")[0]?.replace(/\/$/, "") ?? ""
    if (prefix) hits.add(prefix)
  }
  return [...hits]
}

function classify(p: string): "implemented" | "documented-404" | "unknown" {
  for (const prefix of IMPLEMENTED_PATH_PREFIXES) {
    if (p === prefix || p.startsWith(`${prefix}/`)) return "implemented"
  }
  for (const prefix of DOCUMENTED_404_PREFIXES) {
    if (p === prefix || p.startsWith(`${prefix}/`)) return "documented-404"
  }
  return "unknown"
}

describe("FestivusClient ↔ route map", () => {
  const paths = extractClientPaths()

  it("extracts at least the core /v1 paths from the client", () => {
    expect(paths.length).toBeGreaterThanOrEqual(5)
    expect(paths).toContain("/v1/robots")
    expect(paths).toContain("/v1/policies")
  })

  it("every client path is either implemented or documented-404", () => {
    const unknown = paths.filter((p) => classify(p) === "unknown")
    expect(unknown, `Unmatched /v1 paths in festivus-client.ts: ${unknown.join(", ")}`).toEqual([])
  })
})
