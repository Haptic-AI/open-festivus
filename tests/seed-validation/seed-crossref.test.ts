import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// Slug-drift check between the system prompt and seed data was removed in
// Step 2.3 (2026-04-12) when the prompt stopped embedding a slug whitelist —
// the model now fetches slugs from the Festivus data API on demand.
// The remaining tests in this file still validate seed-data internal
// consistency (cross-refs, deploy-notes coverage, paper backrefs).

const SEED_DIR = join(__dirname, "../../apps/web/src/data/seed")

function load(file: string): unknown[] {
  return JSON.parse(readFileSync(join(SEED_DIR, file), "utf-8")) as unknown[]
}

function loadJson(file: string): unknown {
  return JSON.parse(readFileSync(join(SEED_DIR, file), "utf-8"))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SeedEntry = Record<string, any>

const robots = load("robots.json") as SeedEntry[]
const policies = load("policies.json") as SeedEntry[]
const environments = load("environments.json") as SeedEntry[]
const datasets = load("datasets.json") as SeedEntry[]
const papers = load("papers.json") as SeedEntry[]
const deployNotes = loadJson("deploy-notes.json") as SeedEntry

const policySlugs = new Set(policies.map((p) => p["slug"] as string))

// ── Deploy-notes coverage ─────────────────────────────────���────────

describe("deploy-notes coverage", () => {
  const robotTypes = new Set(robots.map((r) => r["type"] as string))
  const deployTypes = new Set(
    Object.keys(deployNotes["by_robot_type"] as Record<string, unknown>)
  )

  it("every robot type in robots.json has deploy notes", () => {
    for (const t of robotTypes) {
      // dual-arm maps to arm notes
      const lookupType = t === "dual-arm" ? "arm" : t
      expect(
        deployTypes.has(lookupType),
        `Robot type "${t}" (lookup: "${lookupType}") has no entry in deploy-notes.json`,
      ).toBe(true)
    }
  })

  it("deploy notes are non-empty for each type", () => {
    const byType = deployNotes["by_robot_type"] as Record<string, SeedEntry[]>
    for (const [type, notes] of Object.entries(byType)) {
      expect(notes.length, `deploy-notes for "${type}" is empty`).toBeGreaterThan(0)
    }
  })

  it("deploy notes have valid severity levels", () => {
    const validSeverities = new Set(["critical", "warning", "info"])
    const byType = deployNotes["by_robot_type"] as Record<string, SeedEntry[]>
    for (const [type, notes] of Object.entries(byType)) {
      for (const note of notes) {
        expect(
          validSeverities.has(note["severity"] as string),
          `deploy-notes "${type}": invalid severity "${note["severity"]}"`,
        ).toBe(true)
      }
    }
  })
})

// ── Compatibility symmetry (reverse direction) ─────────────────────

describe("policy → robot compatibility symmetry", () => {
  it("if a policy lists a robot, that robot lists the policy back", () => {
    for (const p of policies) {
      const pSlug = p["slug"] as string
      const robotRefs = (p["compatible_robot_slugs"] as string[]) ?? []
      for (const rSlug of robotRefs) {
        const robot = robots.find((r) => r["slug"] === rSlug)
        if (robot === undefined) continue // caught by structure test
        const policyRefs = (robot["compatible_policy_slugs"] as string[]) ?? []
        expect(
          policyRefs.includes(pSlug),
          `Policy "${p["name"]}" lists robot "${rSlug}" but that robot does not list policy "${pSlug}" back`,
        ).toBe(true)
      }
    }
  })

  it("if an env lists compatible robots, those robots list the env back", () => {
    for (const e of environments) {
      const eSlug = e["slug"] as string
      const robotRefs = (e["compatible_robot_slugs"] as string[]) ?? []
      for (const rSlug of robotRefs) {
        const robot = robots.find((r) => r["slug"] === rSlug)
        if (robot === undefined) continue
        const envRefs = (robot["compatible_env_slugs"] as string[]) ?? []
        expect(
          envRefs.includes(eSlug),
          `Env "${e["name"]}" lists robot "${rSlug}" but that robot does not list env "${eSlug}" back`,
        ).toBe(true)
      }
    }
  })
})

// ── Datasets cross-references ──────────────────────────────────────

describe("datasets.json cross-references", () => {
  it("compatible_policy_slugs reference real policies", () => {
    for (const d of datasets) {
      const refs = (d["compatible_policy_slugs"] as string[]) ?? []
      for (const slug of refs) {
        expect(
          policySlugs.has(slug),
          `Dataset "${d["name"]}": unknown policy slug "${slug}"`,
        ).toBe(true)
      }
    }
  })

  it("all datasets have required fields", () => {
    for (const d of datasets) {
      expect(d, `Dataset missing 'slug'`).toHaveProperty("slug")
      expect(d, `Dataset missing 'name'`).toHaveProperty("name")
      expect(d, `Dataset missing 'episodes'`).toHaveProperty("episodes")
      expect(d, `Dataset missing 'format'`).toHaveProperty("format")
      expect(typeof d["episodes"], `Dataset "${d["name"]}": episodes should be number`).toBe("number")
    }
  })

  it("all dataset slugs are unique", () => {
    const slugs = datasets.map((d) => d["slug"])
    expect(new Set(slugs).size).toBe(slugs.length)
  })
})

// ── Papers cross-references ────────────────────────────────────────

describe("papers.json", () => {
  it("all papers have required fields", () => {
    for (const p of papers) {
      expect(p).toHaveProperty("title")
      expect(p).toHaveProperty("arxiv_url")
      expect(p).toHaveProperty("venue")
      expect(p).toHaveProperty("authors")
      expect((p["authors"] as string[]).length).toBeGreaterThan(0)
    }
  })

  it("arxiv URLs are valid format when present", () => {
    for (const p of papers) {
      const url = p["arxiv_url"] as string | null | undefined
      if (url) {
        expect(
          url.startsWith("https://arxiv.org/abs/"),
          `Paper "${p["title"]}": invalid arxiv URL "${url}"`,
        ).toBe(true)
      }
    }
  })

  it("policies with paper_arxiv_url reference a real paper", () => {
    const paperUrls = new Set(papers.map((p) => p["arxiv_url"] as string))
    for (const p of policies) {
      const url = p["paper_arxiv_url"] as string | undefined
      if (url) {
        expect(
          paperUrls.has(url),
          `Policy "${p["name"]}": paper_arxiv_url "${url}" not found in papers.json`,
        ).toBe(true)
      }
    }
  })
})

// ── Tool schema coverage ───────────────────────────────────────────

describe("tool schema coverage", () => {
  it("every node_type enum has at least one seed data entry", () => {
    // node_type enum from tools.ts: robot, task, policy, environment, dataset, results
    // task and results are generated, not in seed — only check data-backed types
    const dataBackedTypes: Record<string, unknown[]> = {
      robot: robots,
      policy: policies,
      environment: environments,
      dataset: datasets,
    }
    for (const [type, data] of Object.entries(dataBackedTypes)) {
      expect(data.length, `node_type "${type}" has no seed data entries`).toBeGreaterThan(0)
    }
  })
})
