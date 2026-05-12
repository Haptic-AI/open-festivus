import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

// Invariant from spec 023: FestivusClient defaults to the production Dokku
// API. Regression guard — if someone flips this back to localhost:8000 the
// test fires before a deploy silently points web traffic at a dev machine.

const ROOT = resolve(__dirname, "../..")
const CLIENT_SRC = resolve(ROOT, "apps/web/src/lib/api/festivus-client.ts")

const PROD_BASE = "https://api.festivus.hapticlabs.ai"

describe("FestivusClient default baseUrl", () => {
  const src = readFileSync(CLIENT_SRC, "utf8")

  it("includes the production base URL as the default", () => {
    expect(src).toContain(PROD_BASE)
  })

  it("does not fall back to localhost in the constructor default chain", () => {
    // Match the exact default-chain line so we catch a flip back to localhost.
    const line = src.match(
      /this\.baseUrl\s*=\s*\(options\.baseUrl\s*\?\?\s*process\.env\[[^\]]+\]\s*\?\?\s*"([^"]+)"\)/,
    )
    expect(line?.[1]).toBe(PROD_BASE)
  })
})
