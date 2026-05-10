/**
 * Issue #57 — seed `data/tasks.json` into the tasks table.
 *
 * The tasks table ships empty in every environment. This script upserts a
 * curated starter batch (20 rows as of 2026-04-24) so the /data/simulations
 * task filter, the workbench sim-test task picker, and FK lookups from
 * `laundry_compat_edges` all have real slugs to resolve.
 *
 * Idempotent: upserts by slug. Safe to re-run on the same DB or against prod
 * after local verification.
 *
 * Usage (local):
 *   pnpm --filter @festivus/api seed:tasks
 *
 * Usage (prod, via the Dokku host):
 *   ssh dokku@3.149.60.233 run festivus-api \
 *     pnpm --filter @festivus/api exec tsx src/scripts/seed-tasks.ts
 */

import "../_load-env.js"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { PrismaClient } from "@prisma/client"

const SEED_PATH = resolve(
  fileURLToPath(import.meta.url),
  "../../../..",
  "data",
  "tasks.json",
)

interface ITaskRecord {
  slug: string
  name: string
  category: string
  description: string
  sub_tasks: string[]
  required_capabilities: string[]
  compatible_robot_types: string[]
  compatible_policy_slugs: string[]
  difficulty: "easy" | "medium" | "hard" | "unsolved"
  has_real_world_demo: boolean
}

async function main(): Promise<void> {
  const raw = readFileSync(SEED_PATH, "utf-8")
  const records: ITaskRecord[] = JSON.parse(raw)
  if (!Array.isArray(records) || records.length === 0) {
    console.error(`[seed-tasks] no records in ${SEED_PATH}`)
    process.exit(1)
  }

  const prisma = new PrismaClient()
  try {
    console.warn(`[seed-tasks] upserting ${records.length} task(s)`)
    let created = 0
    let updated = 0

    for (const rec of records) {
      const existing = await prisma.tasks.findUnique({ where: { slug: rec.slug } })
      // The tasks table stores everything but slug in the JSONB `data` column;
      // slug is the natural key. Mirror how robots/policies/datasets do it.
      const data = {
        name: rec.name,
        slug: rec.slug,
        category: rec.category,
        description: rec.description,
        sub_tasks: rec.sub_tasks,
        required_capabilities: rec.required_capabilities,
        compatible_robot_types: rec.compatible_robot_types,
        compatible_policy_slugs: rec.compatible_policy_slugs,
        difficulty: rec.difficulty,
        has_real_world_demo: rec.has_real_world_demo,
      }

      await prisma.tasks.upsert({
        where: { slug: rec.slug },
        create: { slug: rec.slug, data },
        update: { data },
      })
      if (existing) {
        updated++
        console.warn(`[seed-tasks] updated · ${rec.slug}`)
      } else {
        created++
        console.warn(`[seed-tasks] created · ${rec.slug}`)
      }
    }

    console.warn(`[seed-tasks] done · ${created} created, ${updated} updated`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err: unknown) => {
  console.error("[seed-tasks] fatal:", err)
  process.exit(1)
})
