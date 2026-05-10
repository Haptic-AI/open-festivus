/**
 * Spec 026 Phase 4.4 — seed `data/simulations.json` into the local DB.
 *
 * One-shot: re-uses the same POST /v1/simulations transaction path so the
 * seed flow exercises identical code to the user-driven creation flow. If
 * oneclick is down the script exits non-zero; rerun when it's back up.
 *
 *   pnpm --filter @festivus/api seed:simulations
 */

import "../_load-env.js"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const PORT_ENV = process.env["PORT"] ?? "8000"
// Default: local dev api. Override with FESTIVUS_SEED_API_BASE to point at
// prod (e.g. https://api.festivus.hapticlabs.ai) when seeding from a laptop.
const API_BASE =
  process.env["FESTIVUS_SEED_API_BASE"] ?? `http://localhost:${PORT_ENV}`
const SEED_PATH = resolve(
  fileURLToPath(import.meta.url),
  "../../../..",
  "data",
  "simulations.json",
)

interface ISeedRecord {
  policy_slug: string
  environment_slug: string
  task_slug?: string
  robot_slug?: string
  episode_count: number
}

async function main() {
  const raw = readFileSync(SEED_PATH, "utf-8")
  const records: ISeedRecord[] = JSON.parse(raw)
  if (!Array.isArray(records) || records.length === 0) {
    console.error(`[seed-simulations] no records in ${SEED_PATH}`)
    process.exit(1)
  }
  console.warn(`[seed-simulations] seeding ${records.length} simulation(s) via ${API_BASE}/v1/simulations`)

  let failures = 0
  for (const rec of records) {
    const res = await fetch(`${API_BASE}/v1/simulations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rec),
    })
    const body = await res.text()
    if (!res.ok) {
      console.error(
        `[seed-simulations] ${res.status} for policy=${rec.policy_slug} env=${rec.environment_slug}: ${body.slice(0, 300)}`,
      )
      failures++
      continue
    }
    const parsed = JSON.parse(body) as { id: string; slug: string }
    console.warn(
      `[seed-simulations] OK · slug=${parsed.slug} · ${rec.episode_count} episode(s)`,
    )
  }

  if (failures > 0) {
    console.error(`[seed-simulations] ${failures} failure(s); exit 1`)
    process.exit(1)
  }
  console.warn(`[seed-simulations] done.`)
}

main().catch((err: unknown) => {
  console.error("[seed-simulations] fatal:", err)
  process.exit(1)
})
