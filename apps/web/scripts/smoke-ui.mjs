/**
 * Headless smoke for user-facing pages.
 *
 * Run via /smoke-ui. Not auto-wired into `pnpm check` because it needs a live
 * dev server on :3000. See .claude/commands/smoke-ui.md for the full protocol,
 * especially the notes on Clerk dev-browser headers (NOT errors) and cold-boot
 * compile delays (NOT errors either).
 *
 *   Usage: node smoke-ui.mjs                     (uses default page list)
 *          node smoke-ui.mjs /foo /bar/baz       (override page list)
 */

import { chromium } from "playwright"

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000"

// Each entry: path + text the rendered page MUST contain.
// Default list covers the spec-020 /data surface. Override per-PR when needed.
const DEFAULT_PAGES = [
  { path: "/", expect: ["Physical AI", "for the Rest of Us"] },
  { path: "/data", expect: ["Open Data", "Pick a gap"] },
  { path: "/data/gaps", expect: ["Ready-to-fill gaps", "Claim"] },
  { path: "/explore", expect: ["Open Data"] }, // 307 → /data
  { path: "/workbench", expect: [] }, // client-heavy; just assert no errors
]

const argvPages = process.argv.slice(2).map((p) => ({ path: p, expect: [] }))
const pages = argvPages.length > 0 ? argvPages : DEFAULT_PAGES

const errors = []
const browser = await chromium.launch()
const ctx = await browser.newContext()
const page = await ctx.newPage()

page.on("pageerror", (e) => errors.push(`pageerror @ ${page.url()}: ${e.message}`))
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console.error @ ${page.url()}: ${m.text()}`)
})
page.on("requestfailed", (r) => {
  const f = r.failure()?.errorText ?? "unknown"
  // Cosmetic: raw.githubusercontent.com images are often ORB-blocked.
  if (f.includes("ERR_BLOCKED_BY_ORB")) return
  // Cosmetic: Clerk dev-browser analytics pings can fail in automation.
  if (r.url().includes("/clerk-telemetry")) return
  errors.push(`requestfailed ${r.method()} ${r.url()}: ${f}`)
})

for (const p of pages) {
  process.stdout.write(`→ ${p.path}\n`)
  const res = await page.goto(BASE + p.path, { waitUntil: "networkidle", timeout: 30000 })
  const status = res?.status() ?? 0
  if (status >= 400) errors.push(`${p.path} → HTTP ${status}`)
  if (p.expect.length > 0) {
    const body = await page.content()
    for (const needle of p.expect) {
      if (!body.includes(needle)) errors.push(`${p.path} missing expected text: "${needle}"`)
    }
  }
  const fileName = p.path === "/" ? "home" : p.path.replace(/[/:]/g, "_").slice(1)
  await page.screenshot({ path: `/tmp/smoke-${fileName}.png`, fullPage: true })
}

await browser.close()

if (errors.length > 0) {
  process.stderr.write("SMOKE FAILED:\n")
  for (const e of errors) process.stderr.write(`  ${e}\n`)
  process.exit(1)
}
process.stdout.write(`SMOKE OK — ${pages.length} pages, screenshots in /tmp/smoke-*.png\n`)
