import { readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

// Every /data/<kind> href in the Overview StatGrid must resolve to an
// actual page.tsx in apps/web/src/app. Prevents dead links in the
// overview cards when adding or removing stat cells.

const ROOT = resolve(__dirname, "../..")
const DATA_OVERVIEW = resolve(
  ROOT,
  "apps/web/src/app/data/data-overview-sections.tsx",
)

function extractStatCellHrefs(): string[] {
  const src = readFileSync(DATA_OVERVIEW, "utf8")
  // Pattern: href="/data/<kind>" inside <StatCell ... />
  const statCellBlock = /<StatCell[^>]*href="\/data\/([a-z-]+)"[^>]*\/>/g
  const hits = new Set<string>()
  for (const match of src.matchAll(statCellBlock)) {
    const kind = match[1]
    if (kind !== undefined) hits.add(kind)
  }
  return [...hits].sort()
}

function pageExists(kind: string): boolean {
  const path = resolve(ROOT, "apps/web/src/app/data", kind, "page.tsx")
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

describe("/data overview stat-grid links", () => {
  const kinds = extractStatCellHrefs()

  it("extracts at least one stat cell", () => {
    expect(kinds.length).toBeGreaterThan(0)
  })

  it("every StatCell href resolves to a real page.tsx", () => {
    const missing = kinds.filter((k) => !pageExists(k))
    expect(missing).toEqual([])
  })
})
