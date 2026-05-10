import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import sitemap from "./sitemap"

// The sitemap goes to network for every list endpoint. Stub `fetch` so
// tests are hermetic and we can assert the loop stops on a short page.
//
// Shape contract mirrored from the live API:
//   { count: number, results: Array<{ slug?: string; id?: string }> }

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

/**
 * Build a fetch stub that hands back the right `pages` array based on the
 * endpoint encoded in the request URL. Each entry's value is the list of
 * pages (each page = a `results` array). Endpoints not listed return an
 * immediate empty page.
 */
function endpointFetch(map: Record<string, ReadonlyArray<ReadonlyArray<{ slug?: string; id?: string }>>>): typeof fetch {
  const cursors: Record<string, number> = {}
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
    const path = new URL(url).pathname
    const pages = map[path] ?? [[]]
    cursors[path] ??= 0
    const idx = cursors[path]!
    const results = pages[idx] ?? []
    cursors[path] = idx + 1
    return new Response(JSON.stringify({ count: 9999, results }), { status: 200, headers: { "content-type": "application/json" } })
  }) as unknown as typeof fetch
}

describe("sitemap", () => {
  beforeEach(() => {
    // Defensive: any test that forgets to stub `fetch` should fail loudly
    // rather than reach the live data API from CI.
    globalThis.fetch = (async () => {
      throw new Error("fetch not stubbed")
    }) as unknown as typeof fetch
  })

  it("includes static routes plus a slug entry for every entity type", async () => {
    globalThis.fetch = endpointFetch({
      "/v1/robots": [[{ slug: "unitree-g1" }]],
      "/v1/policies": [[{ slug: "openvla-7b" }]],
      "/v1/datasets": [[{ slug: "open-x-embodiment" }]],
      "/v1/benchmarks": [[{ slug: "moright" }]],
      "/v1/simulations": [[{ slug: "warehouse-sim" }]],
      "/v1/tasks": [[{ slug: "pick-place" }]],
      "/v1/deploy-notes": [[{ slug: "g1-mark-1" }]],
      "/v1/environments": [[{ slug: "mujoco-warehouse" }]],
      "/v1/papers": [[{ id: "paper-abc" }]],
    })

    const entries = await sitemap()
    const urls = entries.map((e) => e.url)

    // Static routes present
    expect(urls).toContain("https://festivus.hapticlabs.ai/")
    expect(urls).toContain("https://festivus.hapticlabs.ai/explore")
    // Every entity type emitted a slug entry
    expect(urls).toContain("https://festivus.hapticlabs.ai/data/robots/unitree-g1")
    expect(urls).toContain("https://festivus.hapticlabs.ai/data/datasets/open-x-embodiment")
    expect(urls).toContain("https://festivus.hapticlabs.ai/data/benchmarks/moright")
    expect(urls).toContain("https://festivus.hapticlabs.ai/data/simulations/warehouse-sim")
    expect(urls).toContain("https://festivus.hapticlabs.ai/data/tasks/pick-place")
    expect(urls).toContain("https://festivus.hapticlabs.ai/data/deploys/g1-mark-1")
    expect(urls).toContain("https://festivus.hapticlabs.ai/data/environments/mujoco-warehouse")
    expect(urls).toContain("https://festivus.hapticlabs.ai/data/papers/paper-abc")
    // Policy emitted under BOTH prefixes
    expect(urls).toContain("https://festivus.hapticlabs.ai/data/policies/openvla-7b")
    expect(urls).toContain("https://festivus.hapticlabs.ai/policies/openvla-7b")
  })

  it("paginates a list endpoint until a short page comes back", async () => {
    // Two full pages of 500 each, then a page of 3 — loop must stop after
    // page 3 and emit 1003 robots URLs.
    const page1 = Array.from({ length: 500 }, (_, i) => ({ slug: `r-${i}` }))
    const page2 = Array.from({ length: 500 }, (_, i) => ({ slug: `r-${500 + i}` }))
    const page3 = Array.from({ length: 3 }, (_, i) => ({ slug: `r-${1000 + i}` }))
    globalThis.fetch = endpointFetch({ "/v1/robots": [page1, page2, page3] })

    const entries = await sitemap()
    const robotEntries = entries.filter((e) => e.url.startsWith("https://festivus.hapticlabs.ai/data/robots/"))
    expect(robotEntries).toHaveLength(1003)
    expect(robotEntries[0]!.url).toBe("https://festivus.hapticlabs.ai/data/robots/r-0")
    expect(robotEntries[1002]!.url).toBe("https://festivus.hapticlabs.ai/data/robots/r-1002")
  })

  it("falls back to id when slug is missing (papers endpoint)", async () => {
    globalThis.fetch = endpointFetch({ "/v1/papers": [[{ id: "paper-abc-123" }]] })
    const entries = await sitemap()
    const slugEntry = entries.find((e) => e.url.endsWith("/data/papers/paper-abc-123"))
    expect(slugEntry).toBeDefined()
  })

  it("emits each policy under both /data/policies and /policies", async () => {
    globalThis.fetch = endpointFetch({
      "/v1/policies": [[{ slug: "openvla-7b" }, { slug: "pi0" }]],
    })
    const entries = await sitemap()
    const policyUrls = entries
      .filter((e) => /\/policies\/[^/]+$/.test(e.url))
      .map((e) => e.url)
      .sort()
    expect(policyUrls).toEqual([
      "https://festivus.hapticlabs.ai/data/policies/openvla-7b",
      "https://festivus.hapticlabs.ai/data/policies/pi0",
      "https://festivus.hapticlabs.ai/policies/openvla-7b",
      "https://festivus.hapticlabs.ai/policies/pi0",
    ])
  })

  it("survives fetch throwing on an endpoint", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
      if (url.includes("/v1/robots")) throw new Error("network down")
      return new Response(JSON.stringify({ count: 0, results: [] }), { status: 200, headers: { "content-type": "application/json" } })
    }) as unknown as typeof fetch

    const entries = await sitemap()
    // Static routes still emit; no robots slug entries.
    expect(entries.length).toBeGreaterThan(0)
    const robotSlugEntries = entries.filter((e) => /\/data\/robots\/[^/]+$/.test(e.url))
    expect(robotSlugEntries).toHaveLength(0)
  })

  it("URL-encodes slugs that contain spaces", async () => {
    globalThis.fetch = endpointFetch({
      "/v1/robots": [[{ slug: "weird name with spaces" }]],
    })
    const entries = await sitemap()
    const e = entries.find((x) => x.url.includes("weird"))
    expect(e?.url).toBe("https://festivus.hapticlabs.ai/data/robots/weird%20name%20with%20spaces")
  })
})
