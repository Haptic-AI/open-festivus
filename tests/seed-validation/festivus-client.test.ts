/**
 * FestivusClient behavior tests.
 *
 * Verifies that the API client:
 *   - Sends an X-API-Key header when configured
 *   - Builds URLs from the base + path + query params
 *   - Returns null when the network call throws
 *   - Returns null when the HTTP status is non-2xx
 *   - Returns null when the response body is not JSON
 *   - Returns null when the response shape fails Zod parse
 *   - Drops individual records that fail Zod parse from get_robot_full
 *
 * No live server: every test passes a stubbed `fetchImpl` to the constructor.
 */

import { describe, expect, it } from "vitest"
import { FestivusClient } from "@/lib/api/festivus-client"

function makeFetch(handler: (req: { url: URL; headers: Headers }) => Response | Promise<Response>): typeof fetch {
  return async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input.toString())
    const headers = new Headers(init?.headers)
    return handler({ url, headers })
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

const sampleRobot = {
  id: "r1",
  slug: "franka-panda",
  name: "Franka Panda",
  manufacturer: "Franka Robotics",
  type: "arm",
  dof: 7,
  sensors: ["joint encoders"],
  actuators: "torque-controlled",
  price_usd: 35000,
  weight_kg: 18,
  build_paths: [{ path: "buy", cost_usd: 35000, build_time_days: 30, purchase_url: "https://franka.de" }],
  deploy_readiness: "ce_marked",
  compatible_policy_slugs: [],
  compatible_env_slugs: [],
  image_url: "https://example.com/franka.png",
  community_size: "large",
  description: "7-DoF arm.",
  taxonomy: null,
  product_page_url: "https://franka.de/products",
  category: "Cobot arm / industrial",
  form_factor: "arm-fixed",
  price_availability: "on_request",
}

const samplePolicy = {
  id: "p1",
  slug: "diffusion-policy-pusht",
  name: "Diffusion Policy",
  author: "Columbia",
  framework: "PyTorch",
  license: "mit",
  task_description: "diffusion model",
  skill_type: "manipulation",
  action_space: { type: "ee-pose", dimensions: 2, frequency_hz: 10 },
  observation_space: { type: "image", components: ["rgb"] },
  compatible_robot_slugs: [],
  compatible_env_slugs: [],
  benchmarks: [],
  hf_repo_id: "lerobot/diffusion_pusht",
  paper_arxiv_url: "https://arxiv.org/abs/2303.04137",
  evidence_level: "verified",
  taxonomy: null,
}

// ── Header / URL construction ─────────────────────────────────────

describe("FestivusClient request construction", () => {
  it("sends the X-API-Key header when an apiKey is configured", async () => {
    let captured: Headers | null = null
    const client = new FestivusClient({
      baseUrl: "http://api.example.com",
      apiKey: "secret-token",
      fetchImpl: makeFetch(({ headers }) => {
        captured = headers
        return jsonResponse({ count: 0, limit: 10, offset: 0, results: [] })
      }),
    })
    await client.searchRobots({})
    expect(captured).not.toBeNull()
    expect((captured as unknown as Headers).get("X-API-Key")).toBe("secret-token")
  })

  it("does NOT send X-API-Key when no apiKey is configured", async () => {
    let captured: Headers | null = null
    const client = new FestivusClient({
      baseUrl: "http://api.example.com",
      fetchImpl: makeFetch(({ headers }) => {
        captured = headers
        return jsonResponse({ count: 0, limit: 10, offset: 0, results: [] })
      }),
    })
    await client.searchRobots({})
    expect((captured as unknown as Headers).get("X-API-Key")).toBeNull()
  })

  it("strips a trailing slash from baseUrl so paths concatenate cleanly", async () => {
    let captured: URL | null = null
    const client = new FestivusClient({
      baseUrl: "http://api.example.com/",
      fetchImpl: makeFetch(({ url }) => {
        captured = url
        return jsonResponse({ count: 0, limit: 10, offset: 0, results: [] })
      }),
    })
    await client.searchRobots({})
    expect((captured as unknown as URL).toString()).toContain("http://api.example.com/v1/robots")
    expect((captured as unknown as URL).toString()).not.toContain("//v1")
  })

  it("forwards filters as query params and skips undefined/null", async () => {
    let captured: URL | null = null
    const client = new FestivusClient({
      baseUrl: "http://api.example.com",
      fetchImpl: makeFetch(({ url }) => {
        captured = url
        return jsonResponse({ count: 0, limit: 10, offset: 0, results: [] })
      }),
    })
    await client.searchRobots({ type: "arm", manufacturer: undefined, price_min: 0, has_policies: true })
    const url = captured as unknown as URL
    expect(url.searchParams.get("type")).toBe("arm")
    expect(url.searchParams.get("manufacturer")).toBeNull()
    expect(url.searchParams.get("price_min")).toBe("0")
    expect(url.searchParams.get("has_policies")).toBe("true")
  })
})

// ── Failure modes return null instead of throwing ─────────────────

describe("FestivusClient failure modes", () => {
  it("returns null when fetch throws", async () => {
    const client = new FestivusClient({
      baseUrl: "http://api.example.com",
      fetchImpl: async () => {
        throw new Error("network down")
      },
    })
    expect(await client.searchRobots({})).toBeNull()
  })

  it("returns null on a 500 response", async () => {
    const client = new FestivusClient({
      baseUrl: "http://api.example.com",
      fetchImpl: makeFetch(() => new Response("upstream broken", { status: 500 })),
    })
    expect(await client.searchRobots({})).toBeNull()
  })

  it("returns null on a 404 response", async () => {
    const client = new FestivusClient({
      baseUrl: "http://api.example.com",
      fetchImpl: makeFetch(() => new Response("not found", { status: 404 })),
    })
    expect(await client.getRobot("nonexistent")).toBeNull()
  })

  it("returns null when the body is not valid JSON", async () => {
    const client = new FestivusClient({
      baseUrl: "http://api.example.com",
      fetchImpl: makeFetch(() => new Response("not json", { status: 200, headers: { "Content-Type": "text/plain" } })),
    })
    expect(await client.searchRobots({})).toBeNull()
  })

  it("returns null when the response shape fails Zod parse", async () => {
    const client = new FestivusClient({
      baseUrl: "http://api.example.com",
      fetchImpl: makeFetch(() => jsonResponse({ unexpected: "shape" })),
    })
    expect(await client.searchRobots({})).toBeNull()
  })

  it("returns null when a single-record response is missing required fields", async () => {
    const client = new FestivusClient({
      baseUrl: "http://api.example.com",
      fetchImpl: makeFetch(() => jsonResponse({ slug: "x" })),
    })
    expect(await client.getRobot("x")).toBeNull()
  })
})

// ── Happy paths ───────────────────────────────────────────────────

describe("FestivusClient happy paths", () => {
  it("searchRobots returns the parsed results array", async () => {
    const client = new FestivusClient({
      baseUrl: "http://api.example.com",
      fetchImpl: makeFetch(() => jsonResponse({ count: 1, limit: 10, offset: 0, results: [sampleRobot] })),
    })
    const out = await client.searchRobots({ type: "arm" })
    expect(out?.length).toBe(1)
    expect(out?.[0]?.slug).toBe("franka-panda")
  })

  it("getRobotFull returns the joined shape and drops malformed nested records", async () => {
    const client = new FestivusClient({
      baseUrl: "http://api.example.com",
      fetchImpl: makeFetch(() =>
        jsonResponse({
          robot: sampleRobot,
          policies: [samplePolicy, { slug: "broken" }],
          datasets: [],
        }),
      ),
    })
    const out = await client.getRobotFull("franka-panda")
    expect(out).not.toBeNull()
    expect(out?.robot.slug).toBe("franka-panda")
    expect(out?.policies.length).toBe(1)
    expect(out?.policies[0]?.slug).toBe("diffusion-policy-pusht")
  })

  it("getRobotFull returns null when the top-level robot fails parse", async () => {
    const client = new FestivusClient({
      baseUrl: "http://api.example.com",
      fetchImpl: makeFetch(() => jsonResponse({ robot: { slug: "broken" }, policies: [], datasets: [] })),
    })
    expect(await client.getRobotFull("broken")).toBeNull()
  })
})
