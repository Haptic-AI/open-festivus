import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const SEED_DIR = join(__dirname, "../../apps/web/src/data/seed")

interface ISeedEntry {
  name?: string
  slug?: string
  image_url?: string | null
}

function loadSeedFile(filename: string): ISeedEntry[] {
  const raw = readFileSync(join(SEED_DIR, filename), "utf-8")
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) return []
  return parsed as ISeedEntry[]
}

function getSeedFiles(): string[] {
  return readdirSync(SEED_DIR).filter((f) => f.endsWith(".json"))
}

describe("seed data image URLs", () => {
  const files = getSeedFiles()

  for (const file of files) {
    const entries = loadSeedFile(file)
    const withImages = entries.filter((e) => typeof e.image_url === "string")

    if (withImages.length === 0) continue

    describe(file, () => {
      for (const entry of withImages) {
        const label = entry.name ?? entry.slug ?? "unknown"
        const url = entry.image_url as string

        it(`${label} image_url is a valid URL`, () => {
          expect(() => new URL(url)).not.toThrow()
        })

        it(`${label} image_url returns HTTP 200`, async () => {
          const res = await fetch(url, { method: "HEAD" })
          // Some servers reject HEAD, retry with GET
          if (res.status === 405) {
            const getRes = await fetch(url)
            expect(getRes.status).toBe(200)
            return
          }
          expect(res.status).toBe(200)
        })

        it(`${label} image_url returns an image content-type`, async () => {
          const res = await fetch(url, { method: "HEAD" })
          const ct = res.headers.get("content-type") ?? ""
          expect(ct).toMatch(/image\//)
        })
      }
    })
  }
})
