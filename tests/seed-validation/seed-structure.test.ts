import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const SEED_DIR = join(__dirname, "../../apps/web/src/data/seed")

function load(file: string): unknown[] {
  return JSON.parse(readFileSync(join(SEED_DIR, file), "utf-8")) as unknown[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SeedEntry = Record<string, any>

const robots = load("robots.json") as SeedEntry[]
const policies = load("policies.json") as SeedEntry[]
const environments = load("environments.json") as SeedEntry[]

const robotSlugs = new Set(robots.map((r) => r["slug"] as string))
const policySlugs = new Set(policies.map((p) => p["slug"] as string))
const envSlugs = new Set(environments.map((e) => e["slug"] as string))

// ── Robots ──────────────────────────────────────────────────────────

describe("robots.json", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(robots)).toBe(true)
    expect(robots.length).toBeGreaterThan(0)
  })

  it("every robot has required fields", () => {
    for (const r of robots) {
      expect(r).toHaveProperty("id")
      expect(r).toHaveProperty("slug")
      expect(r).toHaveProperty("name")
      expect(r).toHaveProperty("manufacturer")
      expect(r).toHaveProperty("type")
      expect(r).toHaveProperty("dof")
      expect(r).toHaveProperty("price_usd")
      expect(r).toHaveProperty("deploy_readiness")
      expect(r).toHaveProperty("description")
    }
  })

  it("all slugs are unique", () => {
    const slugs = robots.map((r) => r["slug"])
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it("all IDs are unique", () => {
    const ids = robots.map((r) => r["id"])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("deploy_readiness uses valid vocabulary", () => {
    const valid = new Set(["lab_only", "ce_marked"])
    for (const r of robots) {
      expect(valid.has(r["deploy_readiness"] as string)).toBe(true)
    }
  })

  it("compatible_policy_slugs reference real policies", () => {
    for (const r of robots) {
      const refs = (r["compatible_policy_slugs"] as string[]) ?? []
      for (const slug of refs) {
        expect(policySlugs.has(slug), `Robot ${r["name"]}: unknown policy slug "${slug}"`).toBe(true)
      }
    }
  })

  it("compatible_env_slugs reference real environments", () => {
    for (const r of robots) {
      const refs = (r["compatible_env_slugs"] as string[]) ?? []
      for (const slug of refs) {
        expect(envSlugs.has(slug), `Robot ${r["name"]}: unknown env slug "${slug}"`).toBe(true)
      }
    }
  })
})

// ── Policies ────────────────────────────────────────────────────────

describe("policies.json", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(policies)).toBe(true)
    expect(policies.length).toBeGreaterThan(0)
  })

  it("every policy has required fields", () => {
    for (const p of policies) {
      expect(p).toHaveProperty("id")
      expect(p).toHaveProperty("slug")
      expect(p).toHaveProperty("name")
      expect(p).toHaveProperty("framework")
      expect(p).toHaveProperty("compatible_robot_slugs")
      expect(p).toHaveProperty("benchmarks")
      expect(p).toHaveProperty("action_space")
      expect(p).toHaveProperty("observation_space")
    }
  })

  it("all slugs are unique", () => {
    const slugs = policies.map((p) => p["slug"])
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it("compatible_robot_slugs reference real robots", () => {
    for (const p of policies) {
      const refs = (p["compatible_robot_slugs"] as string[]) ?? []
      for (const slug of refs) {
        expect(robotSlugs.has(slug), `Policy ${p["name"]}: unknown robot slug "${slug}"`).toBe(true)
      }
    }
  })

  it("compatible_env_slugs reference real environments", () => {
    for (const p of policies) {
      const refs = (p["compatible_env_slugs"] as string[]) ?? []
      for (const slug of refs) {
        expect(envSlugs.has(slug), `Policy ${p["name"]}: unknown env slug "${slug}"`).toBe(true)
      }
    }
  })

  it("benchmarks have required shape", () => {
    for (const p of policies) {
      const benchmarks = p["benchmarks"] as SeedEntry[]
      expect(Array.isArray(benchmarks), `Policy ${p["name"]}: benchmarks should be array`).toBe(true)
      for (const b of benchmarks) {
        expect(b).toHaveProperty("robot")
        expect(b).toHaveProperty("environment")
        expect(b).toHaveProperty("episodes")
      }
    }
  })

  it("action_space has type and dimensions", () => {
    for (const p of policies) {
      const as_ = p["action_space"] as SeedEntry
      expect(as_).toHaveProperty("type")
      expect(as_).toHaveProperty("dimensions")
      expect(typeof as_["dimensions"]).toBe("number")
    }
  })
})

// ── Environments ────────────────────────────────────────────────────

describe("environments.json", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(environments)).toBe(true)
    expect(environments.length).toBeGreaterThan(0)
  })

  it("every environment has required fields", () => {
    for (const e of environments) {
      expect(e).toHaveProperty("id")
      expect(e).toHaveProperty("slug")
      expect(e).toHaveProperty("name")
      expect(e).toHaveProperty("simulator")
      expect(e).toHaveProperty("description")
    }
  })

  it("all slugs are unique", () => {
    const slugs = environments.map((e) => e["slug"])
    expect(new Set(slugs).size).toBe(slugs.length)
  })
})

// ── Cross-reference symmetry ────────────────────────────────────────

describe("cross-reference symmetry", () => {
  it("if a robot lists a policy, that policy lists the robot back", () => {
    for (const r of robots) {
      const rSlug = r["slug"] as string
      const policyRefs = (r["compatible_policy_slugs"] as string[]) ?? []
      for (const pSlug of policyRefs) {
        const policy = policies.find((p) => p["slug"] === pSlug)
        if (policy === undefined) continue // caught by other test
        const robotRefs = (policy["compatible_robot_slugs"] as string[]) ?? []
        expect(
          robotRefs.includes(rSlug),
          `Robot ${r["name"]} lists policy "${pSlug}" but that policy does not list robot "${rSlug}" back`,
        ).toBe(true)
      }
    }
  })
})
