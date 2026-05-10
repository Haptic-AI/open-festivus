/**
 * Tests for the server-side API tool dispatcher.
 *
 * The dispatcher must:
 *   - Call the right FestivusClient method for each tool name
 *   - Pass through filters as typed args
 *   - Clamp the limit to [1, 50]
 *   - Return a stringified JSON payload (not throw)
 *   - Wrap a null client response as {error: "data_unavailable", ...}
 *   - Reject unknown tool names without crashing
 *
 * The tests stub FestivusClient by passing a custom fetch that returns
 * canned responses, so they never need a live API server.
 */

import { describe, expect, it } from "vitest"
import { API_TOOL_NAMES, API_TOOLS, callApiTool } from "@/lib/agent/api-tools"
import { FestivusClient } from "@/lib/api/festivus-client"
import { AGENT_TOOLS, CANVAS_TOOLS } from "@/lib/agent/tools"

// ── Stub fetch ────────────────────────────────────────────────────

function stubFetch(handler: (url: URL) => unknown): typeof fetch {
  return async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" ? input : input.toString())
    const body = handler(url)
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }
}

function failingFetch(): typeof fetch {
  return async () => {
    throw new Error("network error")
  }
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
  compatible_policy_slugs: ["diffusion-policy-pusht"],
  compatible_env_slugs: ["tabletop-clean"],
  image_url: "https://example.com/franka.png",
  community_size: "large",
  description: "7-DoF torque-controlled arm.",
  taxonomy: null,
  product_page_url: "https://franka.de/products",
  category: "Cobot arm / industrial",
  form_factor: "arm-fixed",
  price_availability: "on_request",
}

const samplePolicy = {
  id: "p1",
  slug: "diffusion-policy-pusht",
  name: "Diffusion Policy (PushT)",
  author: "Columbia AI",
  framework: "PyTorch",
  license: "mit",
  task_description: "Diffusion model for visuomotor control.",
  skill_type: "manipulation",
  action_space: { type: "end-effector-pose", dimensions: 2, frequency_hz: 10 },
  observation_space: { type: "image", components: ["rgb"] },
  compatible_robot_slugs: ["franka-panda"],
  compatible_env_slugs: ["tabletop-clean"],
  benchmarks: [],
  hf_repo_id: "lerobot/diffusion_pusht",
  paper_arxiv_url: "https://arxiv.org/abs/2303.04137",
  evidence_level: "verified",
  taxonomy: null,
}

const sampleEdge = {
  slug: "franka-panda__diffusion-policy-pusht__real",
  robot_slug: "franka-panda",
  policy_slug: "diffusion-policy-pusht",
  status: "verified",
  success_rate: 0.91,
  episodes_tested: 200,
  environment: "real",
  source: "paper",
  evidence_url: "https://arxiv.org/abs/2303.04137",
  gaps: [],
  updated_at: "2026-04-10",
}

const sampleTask = {
  id: "t1",
  slug: "pick-and-place",
  name: "Pick and Place",
  category: "manipulation",
  description: "Grasp and place an object.",
  sub_tasks: ["detect", "grasp", "place"],
  required_capabilities: ["vision"],
  compatible_robot_types: ["arm"],
  compatible_policy_slugs: ["diffusion-policy-pusht"],
  difficulty: "easy",
  has_real_world_demo: true,
}

function buildClient(handler: (url: URL) => unknown): FestivusClient {
  return new FestivusClient({ baseUrl: "http://localhost:8000", fetchImpl: stubFetch(handler) })
}

// ── Tool registry sanity ──────────────────────────────────────────

describe("AGENT_TOOLS registry", () => {
  it("exports both canvas and API tools under one array", () => {
    const names = new Set(AGENT_TOOLS.map((t) => t.name))
    expect(names.has("add_node")).toBe(true)
    expect(names.has("search_robots")).toBe(true)
  })

  it("API_TOOL_NAMES matches the API_TOOLS list exactly", () => {
    const declared = new Set(API_TOOLS.map((t) => t.name))
    expect(declared).toEqual(new Set(API_TOOL_NAMES))
  })

  it("canvas and API tool name sets are disjoint", () => {
    const canvasNames = new Set(CANVAS_TOOLS.map((t) => t.name))
    for (const name of API_TOOL_NAMES) {
      expect(canvasNames.has(name)).toBe(false)
    }
  })
})

// ── Dispatcher: happy paths ───────────────────────────────────────

describe("callApiTool: search_robots", () => {
  it("calls /v1/robots and forwards filters", async () => {
    let captured: URL | null = null
    const client = buildClient((url) => {
      captured = url
      return { count: 1, limit: 10, offset: 0, results: [sampleRobot] }
    })

    const out = await callApiTool(
      "search_robots",
      { type: "arm", manufacturer: "Franka", price_max: 50000, limit: 5 },
      { client },
    )

    expect(captured).not.toBeNull()
    const url = captured as unknown as URL
    expect(url.pathname).toBe("/v1/robots")
    expect(url.searchParams.get("type")).toBe("arm")
    expect(url.searchParams.get("manufacturer")).toBe("Franka")
    expect(url.searchParams.get("price_max")).toBe("50000")
    expect(url.searchParams.get("limit")).toBe("5")

    const parsed = JSON.parse(out) as { count: number; results: unknown[] }
    expect(parsed.count).toBe(1)
    expect(parsed.results.length).toBe(1)
  })

  it("clamps limit above MAX_LIMIT (20) to MAX_LIMIT", async () => {
    let captured: URL | null = null
    const client = buildClient((url) => {
      captured = url
      return { count: 0, limit: 20, offset: 0, results: [] }
    })
    await callApiTool("search_robots", { limit: 9999 }, { client })
    expect((captured as unknown as URL).searchParams.get("limit")).toBe("20")
  })

  it("defaults limit to 10 when omitted", async () => {
    let captured: URL | null = null
    const client = buildClient((url) => {
      captured = url
      return { count: 0, limit: 10, offset: 0, results: [] }
    })
    await callApiTool("search_robots", {}, { client })
    expect((captured as unknown as URL).searchParams.get("limit")).toBe("10")
  })
})

describe("callApiTool: search_policies", () => {
  it("calls /v1/policies and forwards the robot filter", async () => {
    let captured: URL | null = null
    const client = buildClient((url) => {
      captured = url
      return { count: 1, limit: 10, offset: 0, results: [samplePolicy] }
    })
    const out = await callApiTool("search_policies", { robot: "franka-panda" }, { client })
    expect((captured as unknown as URL).pathname).toBe("/v1/policies")
    expect((captured as unknown as URL).searchParams.get("robot")).toBe("franka-panda")
    const parsed = JSON.parse(out) as { count: number }
    expect(parsed.count).toBe(1)
  })
})

describe("callApiTool: search_compatibility", () => {
  it("returns a list of edges shaped for the model", async () => {
    const client = buildClient(() => ({ count: 1, limit: 10, offset: 0, results: [sampleEdge] }))
    const out = await callApiTool("search_compatibility", { robot: "franka-panda" }, { client })
    const parsed = JSON.parse(out) as { count: number; results: { robot_slug: string }[] }
    expect(parsed.count).toBe(1)
    expect(parsed.results[0]?.robot_slug).toBe("franka-panda")
  })
})

describe("callApiTool: search_tasks", () => {
  it("returns curated tasks", async () => {
    const client = buildClient(() => ({ count: 1, limit: 10, offset: 0, results: [sampleTask] }))
    const out = await callApiTool("search_tasks", { category: "manipulation" }, { client })
    const parsed = JSON.parse(out) as { count: number; results: { slug: string }[] }
    expect(parsed.results[0]?.slug).toBe("pick-and-place")
  })
})

describe("callApiTool: get_robot_full", () => {
  it("returns the joined robot+policies+datasets shape", async () => {
    const client = buildClient(() => ({ robot: sampleRobot, policies: [samplePolicy], datasets: [] }))
    const out = await callApiTool("get_robot_full", { slug: "franka-panda" }, { client })
    const parsed = JSON.parse(out) as { robot: { slug: string }; policies: unknown[]; datasets: unknown[] }
    expect(parsed.robot.slug).toBe("franka-panda")
    expect(parsed.policies.length).toBe(1)
  })

  it("returns a missing_slug error when slug is omitted", async () => {
    const client = buildClient(() => ({}))
    const out = await callApiTool("get_robot_full", {}, { client })
    const parsed = JSON.parse(out) as { error: string }
    expect(parsed.error).toBe("missing_slug")
  })
})

describe("callApiTool: find_gaps", () => {
  it("robots-without-policies forwards has_policies=false", async () => {
    let captured: URL | null = null
    const client = buildClient((url) => {
      captured = url
      return { count: 0, limit: 10, offset: 0, results: [] }
    })
    await callApiTool("find_gaps", { domain: "robots-without-policies" }, { client })
    expect((captured as unknown as URL).pathname).toBe("/v1/robots")
    expect((captured as unknown as URL).searchParams.get("has_policies")).toBe("false")
  })

  it("tasks-without-data filters tasks where compatible_policy_slugs is empty", async () => {
    const tasks = [
      { ...sampleTask, slug: "with-data", compatible_policy_slugs: ["x"] },
      { ...sampleTask, slug: "no-data", compatible_policy_slugs: [] },
    ]
    const client = buildClient(() => ({ count: 2, limit: 50, offset: 0, results: tasks }))
    const out = await callApiTool("find_gaps", { domain: "tasks-without-data" }, { client })
    const parsed = JSON.parse(out) as { count: number; results: { slug: string }[] }
    expect(parsed.count).toBe(1)
    expect(parsed.results[0]?.slug).toBe("no-data")
  })

  it("returns missing_domain when domain omitted", async () => {
    const client = buildClient(() => ({}))
    const out = await callApiTool("find_gaps", {}, { client })
    const parsed = JSON.parse(out) as { error: string }
    expect(parsed.error).toBe("missing_domain")
  })
})

// ── Dispatcher: failure modes ─────────────────────────────────────

describe("callApiTool: failure modes", () => {
  it("returns data_unavailable when the client throws", async () => {
    const client = new FestivusClient({ baseUrl: "http://localhost:8000", fetchImpl: failingFetch() })
    const out = await callApiTool("search_robots", {}, { client })
    const parsed = JSON.parse(out) as { error: string }
    expect(parsed.error).toBe("data_unavailable")
  })

  it("returns data_unavailable when the response shape fails Zod parse", async () => {
    const client = buildClient(() => ({ wrong: "shape" }))
    const out = await callApiTool("search_robots", {}, { client })
    const parsed = JSON.parse(out) as { error: string }
    expect(parsed.error).toBe("data_unavailable")
  })

  it("returns unknown_tool for an unrecognized tool name", async () => {
    const out = await callApiTool("nonexistent_tool", {})
    const parsed = JSON.parse(out) as { error: string }
    expect(parsed.error).toBe("unknown_tool")
  })
})
