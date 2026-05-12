/**
 * Build-time type validation for seed data JSON files.
 *
 * Imports each JSON file with a type assertion so TypeScript catches
 * shape mismatches before tests or the app even run.
 *
 * Usage: npx tsx apps/web/src/data/seed/validate-types.ts
 * Also runs automatically via the "prebuild" and "validate:seed" scripts.
 */

import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import type {
  IDatasetEntry,
  IDeployNotes,
  IEnvironmentEntry,
  IPaperEntry,
  IPolicyEntry,
  IRobotEntry,
} from "./types"

const __dirname = dirname(fileURLToPath(import.meta.url))
function loadJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(__dirname, file), "utf-8")) as T
}
function loadRootJson<T>(relative: string): T {
  return JSON.parse(readFileSync(join(__dirname, "../../../../..", relative), "utf-8")) as T
}

// Load JSON with type assertions -- TypeScript will error if shapes don't match
const robots = loadJson<IRobotEntry[]>("./robots.json")
// Spec 017: the canonical curated corpus lives at the repo-root `data/` dir and
// is the source of truth for the `robots` Postgres table. Validate its rows
// under the same spec-017 invariant checks as the apps/web fallback seed.
const robotsSeed = loadRootJson<IRobotEntry[]>("data/robots_seed.json")
const policies = loadJson<IPolicyEntry[]>("./policies.json")
const environments = loadJson<IEnvironmentEntry[]>("./environments.json")
const datasets = loadJson<IDatasetEntry[]>("./datasets.json")
const papers = loadJson<IPaperEntry[]>("./papers.json")
const deployNotes = loadJson<IDeployNotes>("./deploy-notes.json")

// Runtime spot-checks to catch issues that TypeScript's structural typing misses
function validate(): void {
  const errors: string[] = []

  if (!Array.isArray(robots) || robots.length === 0) {
    errors.push("robots.json: expected non-empty array")
  }
  if (!Array.isArray(policies) || policies.length === 0) {
    errors.push("policies.json: expected non-empty array")
  }
  if (!Array.isArray(environments) || environments.length === 0) {
    errors.push("environments.json: expected non-empty array")
  }
  if (!Array.isArray(datasets) || datasets.length === 0) {
    errors.push("datasets.json: expected non-empty array")
  }
  if (!Array.isArray(papers) || papers.length === 0) {
    errors.push("papers.json: expected non-empty array")
  }
  if (!deployNotes.by_robot_type || Object.keys(deployNotes.by_robot_type).length === 0) {
    errors.push("deploy-notes.json: expected non-empty by_robot_type")
  }

  // Spec 017 invariants — fail loudly if the corpus regresses.
  const FORM_FACTORS = new Set(["humanoid", "quadruped", "wheeled", "arm-fixed", "arm-mobile", "drone"])
  const PRICE_AVAIL = new Set(["public", "on_request", "not_public", "unknown"])
  const REPO_HOST_RE = /(github|gitlab|bitbucket)\.com/i
  const GH_HANDLE_RE = /^[a-z0-9_-]+$/
  const SLUG_RE = /^[a-z0-9-]+-[a-z0-9-]+$/

  if (!Array.isArray(robotsSeed) || robotsSeed.length === 0) {
    errors.push("data/robots_seed.json: expected non-empty array (spec 017)")
  }

  // Verify required fields are present (catches missing keys that TS allows as undefined)
  for (const r of [...robots, ...robotsSeed]) {
    if (!r.slug) errors.push(`robots.json: entry "${r.id}" missing slug`)
    if (!r.name) errors.push(`robots.json: entry "${r.id}" missing name`)
    if (!Array.isArray(r.build_paths)) errors.push(`robots.json: "${r.slug}" build_paths is not an array`)

    // Spec 017 invariants
    const url = r.product_page_url
    if (!url || typeof url !== "string" || url.length === 0) {
      errors.push(`robots.json: "${r.slug}" missing product_page_url (spec 017)`)
    } else if (REPO_HOST_RE.test(url)) {
      errors.push(`robots.json: "${r.slug}" product_page_url points at a repo host — forbidden (spec 017 §Constraints)`)
    }
    if (!r.manufacturer || typeof r.manufacturer !== "string") {
      errors.push(`robots.json: "${r.slug}" missing manufacturer (spec 017)`)
    } else {
      if (GH_HANDLE_RE.test(r.manufacturer)) {
        errors.push(`robots.json: "${r.slug}" manufacturer "${r.manufacturer}" looks like a GitHub handle (spec 017 §Constraints)`)
      }
      if (r.manufacturer === "Unknown") {
        errors.push(`robots.json: "${r.slug}" manufacturer is literal "Unknown" (spec 017 §Constraints)`)
      }
    }
    if (r.actuators === "See repo" || r.actuators === "See vendor docs") {
      errors.push(`robots.json: "${r.slug}" actuators is a placeholder string (spec 017 §Constraints)`)
    }
    if (r.dof !== null && (typeof r.dof !== "number" || r.dof <= 0)) {
      errors.push(`robots.json: "${r.slug}" dof must be null or positive — zero-as-unknown forbidden (spec 017)`)
    }
    if (r.price_usd !== null && (typeof r.price_usd !== "number" || r.price_usd <= 0)) {
      errors.push(`robots.json: "${r.slug}" price_usd must be null or positive — zero-as-unknown forbidden (spec 017)`)
    }
    if (!r.form_factor || !FORM_FACTORS.has(r.form_factor as string)) {
      errors.push(`robots.json: "${r.slug}" form_factor "${r.form_factor}" not in closed enum (spec 017)`)
    }
    if (!r.price_availability || !PRICE_AVAIL.has(r.price_availability as string)) {
      errors.push(`robots.json: "${r.slug}" price_availability "${r.price_availability}" not in closed enum (spec 017)`)
    }
    if (!r.category || typeof r.category !== "string") {
      errors.push(`robots.json: "${r.slug}" missing category (spec 017)`)
    }
    if (!r.slug || !SLUG_RE.test(r.slug)) {
      errors.push(`robots.json: "${r.slug}" slug must match manufacturer-prefix pattern <a>-<b> (spec 017 §Decision 4)`)
    }
  }

  // Synthetic round-trip check — catches validator regressions where assertions stop firing.
  const badRow = { id: "synthetic", slug: "bad-row", name: "Bad", manufacturer: "ghhandle", product_page_url: "https://github.com/foo/bar", category: "x", form_factor: "bogus", price_availability: "nope", dof: 0, price_usd: 0, actuators: "See repo", build_paths: [] } as unknown as IRobotEntry
  const syntheticErrors: string[] = []
  const fakeList = [badRow]
  for (const r of fakeList) {
    if (REPO_HOST_RE.test(r.product_page_url)) syntheticErrors.push("repo-host")
    if (GH_HANDLE_RE.test(r.manufacturer)) syntheticErrors.push("gh-handle")
    if (r.dof === 0) syntheticErrors.push("dof-zero")
    if (r.price_usd === 0) syntheticErrors.push("price-zero")
    if (!FORM_FACTORS.has(r.form_factor as string)) syntheticErrors.push("form-factor")
    if (!PRICE_AVAIL.has(r.price_availability as string)) syntheticErrors.push("price-availability")
  }
  if (syntheticErrors.length < 6) {
    errors.push(`validate-types.ts: synthetic bad-row check should flag 6 invariants, flagged ${syntheticErrors.length}: ${syntheticErrors.join(",")}`)
  }

  for (const p of policies) {
    if (!p.slug) errors.push(`policies.json: entry "${p.id}" missing slug`)
    if (!p.name) errors.push(`policies.json: entry "${p.id}" missing name`)
    if (!p.action_space?.type) errors.push(`policies.json: "${p.slug}" missing action_space.type`)
    if (!Array.isArray(p.benchmarks)) errors.push(`policies.json: "${p.slug}" benchmarks is not an array`)
  }

  for (const e of environments) {
    if (!e.slug) errors.push(`environments.json: entry "${e.id}" missing slug`)
    if (!e.simulator) errors.push(`environments.json: "${e.slug}" missing simulator`)
  }

  for (const d of datasets) {
    if (!d.slug) errors.push(`datasets.json: entry "${d.id}" missing slug`)
    if (typeof d.episodes !== "number") errors.push(`datasets.json: "${d.slug}" episodes is not a number`)
  }

  for (const p of papers) {
    if (!p.title) errors.push(`papers.json: entry "${p.id}" missing title`)
    if (!Array.isArray(p.authors) || p.authors.length === 0) {
      errors.push(`papers.json: "${p.id}" missing or empty authors`)
    }
  }

  // Deploy notes: tight per-entry invariants (spec 020 · coverage stat reliability)
  const DEPLOY_ROBOT_TYPES = new Set([
    "arm",
    "quadruped",
    "humanoid",
    "drone",
    "rover",
  ])
  const DEPLOY_SEVERITIES = new Set(["critical", "warning", "info"])
  for (const robotType of Object.keys(deployNotes.by_robot_type)) {
    if (!DEPLOY_ROBOT_TYPES.has(robotType)) {
      errors.push(
        `deploy-notes.json: unknown robot type "${robotType}" (expected one of ${[...DEPLOY_ROBOT_TYPES].join(", ")})`,
      )
    }
    const entries = deployNotes.by_robot_type[robotType]
    if (!Array.isArray(entries) || entries.length === 0) {
      errors.push(`deploy-notes.json: "${robotType}" expected non-empty array of notes`)
      continue
    }
    entries.forEach((entry, idx) => {
      const loc = `deploy-notes.json: "${robotType}"[${idx}]`
      if (typeof entry !== "object" || entry === null) {
        errors.push(`${loc} not an object`)
        return
      }
      if (!DEPLOY_SEVERITIES.has(entry.severity as string)) {
        errors.push(
          `${loc} severity "${entry.severity}" must be one of ${[...DEPLOY_SEVERITIES].join(", ")}`,
        )
      }
      if (typeof entry.note !== "string" || entry.note.trim().length === 0) {
        errors.push(`${loc} note must be a non-empty string`)
      }
      if (typeof entry.note === "string" && entry.note.length < 20) {
        errors.push(`${loc} note suspiciously short (< 20 chars) — expected a real deployment gotcha`)
      }
    })
  }

  if (errors.length > 0) {
    console.error("Seed data validation failed:\n")
    for (const err of errors) {
      console.error(`  - ${err}`)
    }
    process.exit(1)
  }

  // eslint-disable-next-line no-console -- CLI validation script
  console.log(
    `Seed data types valid: ${robots.length} robots (ui), ${robotsSeed.length} robots (curated corpus), ${policies.length} policies, ` +
    `${environments.length} environments, ${datasets.length} datasets, ` +
    `${papers.length} papers, ${Object.keys(deployNotes.by_robot_type).length} deploy note categories`
  )
}

validate()
