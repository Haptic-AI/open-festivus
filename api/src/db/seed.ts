import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type pg from "pg"
import { closePool, getPgPool } from "./pool.js"

const __dirname = dirname(fileURLToPath(import.meta.url))

export interface IDomainConfig {
  file: string
  table: string
}

export const DOMAINS: Record<string, IDomainConfig> = {
  // Spec 017: robots loads from the curated ~60-row seed, not the old 4,378-row bulk.
  robots: { file: "robots_seed.json", table: "robots" },
  policies: { file: "policies_bulk.json", table: "policies" },
  datasets: { file: "datasets_bulk.json", table: "datasets" },
  benchmarks: { file: "benchmarks_bulk.json", table: "benchmarks" },
  deploy_notes: { file: "deploy-notes.json", table: "deploy_notes" },
}

/**
 * Spec 017: domains whose loader should TRUNCATE before re-inserting on every
 * run, rather than skipping when the table is non-empty. Used to wipe the old
 * bulk corpus in favor of the curated seed. Other domains keep the legacy
 * skip-if-populated behavior to preserve their existing data during seed reruns.
 */
const TRUNCATE_DOMAINS = new Set<string>(["robots"])

export interface ISeedRecord {
  slug: string
  [key: string]: unknown
}

export function normalizeRecords(records: unknown[], domain: string): ISeedRecord[] {
  const out: ISeedRecord[] = []
  for (let i = 0; i < records.length; i++) {
    const rec = records[i]
    if (!rec || typeof rec !== "object") {
      throw new Error(`[${domain}] record ${i} is not an object`)
    }
    const obj = rec as Record<string, unknown>
    const slug = typeof obj["slug"] === "string" ? obj["slug"].trim() : ""
    if (!slug) {
      throw new Error(`[${domain}] record ${i} missing required non-empty string slug`)
    }
    out.push({ ...obj, slug })
  }
  return out
}

function dataDir(): string {
  return resolve(__dirname, "../../../data")
}

async function tableCount(pool: pg.Pool, table: string): Promise<number> {
  const r = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${table}`)
  return Number.parseInt(r.rows[0]?.count ?? "0", 10)
}

export async function seedAll(): Promise<void> {
  // Seed uses the vanilla pg path explicitly — it needs `pool.connect()` for
  // transactional batch inserts, which the Neon HTTP adapter does not expose.
  // Seed is a local/deploy-time operation, never a Vercel runtime path.
  const pool = getPgPool()
  const dir = dataDir()
  for (const [domain, cfg] of Object.entries(DOMAINS)) {
    const existing = await tableCount(pool, cfg.table)
    const shouldTruncate = TRUNCATE_DOMAINS.has(domain)
    if (existing > 0 && !shouldTruncate) {
      console.warn(`seed: ${cfg.table} already has ${existing} rows — skipping`)
      continue
    }
    const raw = readFileSync(resolve(dir, cfg.file), "utf8")
    const parsed = JSON.parse(raw) as unknown[]
    const records = normalizeRecords(parsed, domain)
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      if (shouldTruncate) {
        console.warn(`seed: truncating ${cfg.table} (${existing} existing rows) before re-insert — spec 017`)
        await client.query(`TRUNCATE TABLE ${cfg.table} RESTART IDENTITY`)
      }
      for (const rec of records) {
        await client.query(
          `INSERT INTO ${cfg.table} (slug, data) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING`,
          [rec.slug, JSON.stringify(rec)],
        )
      }
      await client.query("COMMIT")
    } catch (err) {
      await client.query("ROLLBACK")
      throw err
    } finally {
      client.release()
    }
    console.warn(`seed: loaded ${records.length} rows into ${cfg.table}`)
  }
}

const isMain =
  process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`

if (isMain) {
  seedAll()
    .then(async () => {
      await closePool()
    })
    .catch(async (err) => {
      console.error("seed: failed", err)
      await closePool()
      process.exit(1)
    })
}
