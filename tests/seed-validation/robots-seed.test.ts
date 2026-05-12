/**
 * Spec 017: `data/robots_seed.json` regression gate.
 *
 * Why this test exists: the validator at `apps/web/src/data/seed/validate-types.ts`
 * catches per-row invariants (no GitHub URLs, no zero-as-unknown, closed enums).
 * That is necessary but not sufficient — a future PR could silently add or drop
 * rows and still pass the validator. This test pins the row count and asserts
 * each `form_factor` bucket is represented, so any size drift is a deliberate
 * edit to BOTH the JSON and this test.
 */

import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const seedPath = join(__dirname, "../../data/robots_seed.json")
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const seed = JSON.parse(readFileSync(seedPath, "utf-8")) as any[]

const EXPECTED_ROW_COUNT = 60

describe("data/robots_seed.json (spec 017 curated corpus)", () => {
  it(`has exactly ${EXPECTED_ROW_COUNT} rows`, () => {
    expect(seed.length).toBe(EXPECTED_ROW_COUNT)
  })

  it("has at least one row per form_factor value", () => {
    const expectedFormFactors = ["humanoid", "quadruped", "wheeled", "arm-fixed", "arm-mobile", "drone"]
    for (const ff of expectedFormFactors) {
      const count = seed.filter((r) => r.form_factor === ff).length
      expect(count, `form_factor="${ff}" should have at least one row`).toBeGreaterThan(0)
    }
  })

  it("every row has a non-empty manufacturer-authoritative product_page_url", () => {
    const repoHost = /(github|gitlab|bitbucket)\.com/i
    for (const r of seed) {
      expect(typeof r.product_page_url).toBe("string")
      expect(r.product_page_url.length).toBeGreaterThan(0)
      expect(repoHost.test(r.product_page_url), `${r.slug} has a repo-host URL`).toBe(false)
    }
  })

  it("every row has a manufacturer-prefixed slug (at least one hyphen)", () => {
    const slugRe = /^[a-z0-9-]+-[a-z0-9-]+$/
    for (const r of seed) {
      expect(slugRe.test(r.slug), `${r.slug} fails manufacturer-prefix pattern`).toBe(true)
    }
  })

  it("every row has a non-null dof/price_usd value equal to null or positive (never zero)", () => {
    for (const r of seed) {
      if (r.dof !== null) expect(r.dof).toBeGreaterThan(0)
      if (r.price_usd !== null) expect(r.price_usd).toBeGreaterThan(0)
    }
  })

  it("slugs are unique (no collisions after SKU split)", () => {
    const slugs = seed.map((r) => r.slug)
    const unique = new Set(slugs)
    expect(unique.size).toBe(slugs.length)
  })
})
