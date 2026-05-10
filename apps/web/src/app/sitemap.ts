import type { MetadataRoute } from "next"

const SITE_URL = "https://festivus.hapticlabs.ai"
const API_BASE = (process.env["FESTIVUS_DATASET_API_URL"] ?? "https://api.festivus.hapticlabs.ai").replace(/\/$/, "")

// Cache the rendered sitemap for 1 hour. Google re-reads at most a few
// times per day, so 3600s amortizes the data-API cost without going stale.
export const revalidate = 3600

const STATIC_ROUTES: ReadonlyArray<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/agent-native", priority: 0.7, changeFrequency: "monthly" },
  { path: "/contribute", priority: 0.6, changeFrequency: "monthly" },
  { path: "/explore", priority: 0.8, changeFrequency: "weekly" },
  { path: "/open-source", priority: 0.6, changeFrequency: "monthly" },
  { path: "/robotics-first", priority: 0.6, changeFrequency: "monthly" },
  { path: "/policies", priority: 0.8, changeFrequency: "weekly" },
  { path: "/data", priority: 0.8, changeFrequency: "weekly" },
  { path: "/data/gaps", priority: 0.5, changeFrequency: "weekly" },
  { path: "/data/benchmarks", priority: 0.6, changeFrequency: "weekly" },
  { path: "/data/datasets", priority: 0.7, changeFrequency: "weekly" },
  { path: "/data/deploys", priority: 0.6, changeFrequency: "weekly" },
  { path: "/data/environments", priority: 0.7, changeFrequency: "weekly" },
  { path: "/data/papers", priority: 0.7, changeFrequency: "weekly" },
  { path: "/data/policies", priority: 0.7, changeFrequency: "weekly" },
  { path: "/data/robots", priority: 0.7, changeFrequency: "weekly" },
  { path: "/data/simulations", priority: 0.6, changeFrequency: "weekly" },
  { path: "/data/tasks", priority: 0.6, changeFrequency: "weekly" },
]

// API-imposed page size. Asking for more is silently capped server-side, so
// pinning the request to the cap keeps us from over-fetching mid-loop.
const PAGE_SIZE = 500

// Hard ceiling on the whole sitemap. Google's per-sitemap cap is 50,000
// URLs; we keep clearance below that. If the corpus ever crosses this we
// should split into a sitemap index rather than ship an invalid sitemap.
const MAX_URLS = 49000

/**
 * Pull every record's slug from a paginated list endpoint.
 *
 * The data API caps `limit` at 500, so we walk via `offset` until a short
 * page comes back. Any network failure short-circuits to `[]` rather than
 * throwing — a partial sitemap is better than a 500.
 */
async function fetchAllSlugs(endpoint: string): Promise<string[]> {
  const slugs: string[] = []
  let offset = 0
  // Defensive cap: don't loop forever if the API misreports `count`.
  const MAX_ITERATIONS = 100
  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    const url = `${API_BASE}${endpoint}?limit=${PAGE_SIZE}&offset=${offset}`
    let res: Response
    try {
      res = await fetch(url, {
        headers: { accept: "application/json" },
        next: { revalidate: 3600 },
      })
    } catch {
      break
    }
    if (!res.ok) break
    let body: { results?: ReadonlyArray<{ slug?: unknown; id?: unknown }> }
    try {
      body = (await res.json()) as typeof body
    } catch {
      break
    }
    const results = body.results ?? []
    for (const row of results) {
      // Prefer `slug`; fall back to `id` for endpoints that only expose an
      // id (papers' detail page is /data/papers/<id>, so id IS the URL
      // segment).
      const candidate = typeof row.slug === "string" && row.slug.length > 0 ? row.slug : typeof row.id === "string" && row.id.length > 0 ? row.id : null
      if (candidate !== null) slugs.push(candidate)
    }
    if (results.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return slugs
}

/**
 * Single-file sitemap covering every indexable URL on festivus.hapticlabs.ai.
 *
 * Why single-file (not `generateSitemaps()`): the auto-split approach moves
 * the URL to `/sitemap/<id>.xml` and does NOT generate a `/sitemap.xml`
 * index — robots.txt advertises `/sitemap.xml`, so the site has to serve
 * exactly that path. Total URL count (~32K) is comfortably under Google's
 * 50K-per-sitemap ceiling, so a single file is the right call until the
 * corpus crosses ~45K records.
 *
 * Wire-shape contract: every list endpoint returns
 *   { count: number, results: Array<{ slug?: string; id?: string }> }
 * with a server-side hard cap of `limit=500` per request.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date()

  // Fan out across every entity in parallel. Each fetch fails independently
  // (returns []) so a flaky endpoint doesn't sink the whole sitemap.
  const [robots, policies, datasets, benchmarks, simulations, tasks, deployNotes, environments, papers] = await Promise.all([
    fetchAllSlugs("/v1/robots"),
    fetchAllSlugs("/v1/policies"),
    fetchAllSlugs("/v1/datasets"),
    fetchAllSlugs("/v1/benchmarks"),
    fetchAllSlugs("/v1/simulations"),
    fetchAllSlugs("/v1/tasks"),
    fetchAllSlugs("/v1/deploy-notes"),
    fetchAllSlugs("/v1/environments"),
    fetchAllSlugs("/v1/papers"),
  ])

  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }))

  function pushSlugs(slugs: ReadonlyArray<string>, prefix: string, priority: number): void {
    for (const slug of slugs) {
      if (entries.length >= MAX_URLS) return
      entries.push({
        url: `${SITE_URL}${prefix}/${encodeURIComponent(slug)}`,
        lastModified,
        changeFrequency: "weekly",
        priority,
      })
    }
  }

  pushSlugs(robots, "/data/robots", 0.6)
  pushSlugs(datasets, "/data/datasets", 0.6)
  pushSlugs(benchmarks, "/data/benchmarks", 0.6)
  pushSlugs(simulations, "/data/simulations", 0.5)
  pushSlugs(environments, "/data/environments", 0.6)
  pushSlugs(tasks, "/data/tasks", 0.5)
  pushSlugs(deployNotes, "/data/deploys", 0.5)
  pushSlugs(papers, "/data/papers", 0.6)

  // Policies live under both /data/policies/<slug> (the canonical record
  // page) and /policies/<slug> (the curated featured-policies entrypoint).
  // Both routes return real content, both should be indexed.
  pushSlugs(policies, "/data/policies", 0.6)
  pushSlugs(policies, "/policies", 0.7)

  return entries
}
