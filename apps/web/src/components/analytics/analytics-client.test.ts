import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// Static text-level guard. The Vercel build error
// "useSearchParams() should be wrapped in a suspense boundary" only shows
// up at static prerender time when VERCEL_ENV === "production" gates
// SiteAnalytics on, which `pnpm test` never sets. So instead of a render
// test, pin the source-level shape that prevents the regression.
//
// What this regression test actually pins:
//   1. analytics-client.tsx imports Suspense and wraps both useSearchParams
//      consumers (GoogleAnalytics, TelemetryDeckTracker).
//   2. layout.tsx mounts SiteAnalytics INSIDE ClerkProvider — required
//      because TelemetryDeckTracker calls useUser().

const ANALYTICS_CLIENT_PATH = join(__dirname, "analytics-client.tsx")
const LAYOUT_PATH = join(__dirname, "..", "..", "app", "layout.tsx")

function read(p: string): string {
  return readFileSync(p, "utf8")
}

describe("analytics-client.tsx Suspense wrapping", () => {
  const src = read(ANALYTICS_CLIENT_PATH)

  it("imports Suspense from react", () => {
    expect(src).toMatch(/import\s+\{[^}]*\bSuspense\b[^}]*\}\s+from\s+"react"/)
  })

  it("wraps GoogleAnalytics in <Suspense>", () => {
    expect(src).toMatch(/<Suspense[^>]*>\s*<GoogleAnalytics\b/)
  })

  it("wraps TelemetryDeckTracker in <Suspense>", () => {
    expect(src).toMatch(/<Suspense[^>]*>\s*<TelemetryDeckTracker\b/)
  })
})

describe("layout.tsx ClerkProvider scoping", () => {
  const src = read(LAYOUT_PATH)

  it("mounts SiteAnalytics inside ClerkProvider so useUser() has context", () => {
    // SiteAnalytics must be inside ClerkProvider — useUser() requires it.
    const openIdx = src.indexOf("<ClerkProvider")
    const closeIdx = src.indexOf("</ClerkProvider>")
    const siteIdx = src.indexOf("<SiteAnalytics")
    expect(openIdx).toBeGreaterThan(-1)
    expect(closeIdx).toBeGreaterThan(openIdx)
    expect(siteIdx).toBeGreaterThan(openIdx)
    expect(siteIdx).toBeLessThan(closeIdx)
  })
})
