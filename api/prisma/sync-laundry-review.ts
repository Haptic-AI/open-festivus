/**
 * Targeted sync of policy + dataset rows that were updated as part of the
 * G1 laundry-folding review (spec 021).
 *
 * Reads:
 *   - data/review/g1-laundry-review/01-new-policies.json       (2 slugs)
 *   - data/review/g1-laundry-review/03-existing-policy-tagging.json (15 slugs)
 *   - data/review/g1-laundry-review/02-new-datasets.json        (6 slugs)
 *
 * For every slug in those lists, reads the current record from the bulk file
 * (data/policies_bulk.json or data/datasets_bulk.json) and UPSERTS into the
 * corresponding table. Does NOT touch the ~9300 other rows.
 *
 * Usage:
 *   pnpm --filter @festivus/api sync:laundry-review
 */
import "../src/_load-env.js"

import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { PrismaClient, Prisma } from "@prisma/client"

const __dirname = dirname(fileURLToPath(import.meta.url))

const REVIEW_DIR = resolve(__dirname, "../../data/review/g1-laundry-review")
const POLICIES_BULK = resolve(__dirname, "../../data/policies_bulk.json")
const DATASETS_BULK = resolve(__dirname, "../../data/datasets_bulk.json")

interface ISlugged {
  slug: string
  [key: string]: unknown
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

async function main(): Promise<void> {
  const newPolicies = loadJson<ISlugged[]>(
    resolve(REVIEW_DIR, "01-new-policies.json"),
  )
  const newDatasets = loadJson<ISlugged[]>(
    resolve(REVIEW_DIR, "02-new-datasets.json"),
  )
  const tagging = loadJson<Array<{ slug: string }>>(
    resolve(REVIEW_DIR, "03-existing-policy-tagging.json"),
  )
  const bulkPolicies = loadJson<ISlugged[]>(POLICIES_BULK)
  const bulkDatasets = loadJson<ISlugged[]>(DATASETS_BULK)

  const policyBySlug = new Map(bulkPolicies.map((p) => [p.slug, p]))
  const datasetBySlug = new Map(bulkDatasets.map((d) => [d.slug, d]))

  const policySlugs = [
    ...newPolicies.map((p) => p.slug),
    ...tagging.map((t) => t.slug),
  ]
  const datasetSlugs = newDatasets.map((d) => d.slug)

  const prisma = new PrismaClient()
  try {
    console.log(`[sync] upserting ${policySlugs.length} policies…`)
    let polUpdated = 0
    let polInserted = 0
    for (const slug of policySlugs) {
      const row = policyBySlug.get(slug)
      if (!row) {
        console.warn(`[sync] policy slug not in bulk: ${slug}`)
        continue
      }
      const result = await prisma.policies.upsert({
        where: { slug },
        create: { slug, data: row as unknown as Prisma.InputJsonValue },
        update: { data: row as unknown as Prisma.InputJsonValue },
      })
      // Prisma doesn't directly tell us insert vs update; check id age via count pre/post
      // Simpler: assume upsert wrote; just tally
      polUpdated += result ? 1 : 0
    }
    console.log(`[sync] policies: ${polUpdated} upserts`)

    console.log(`[sync] upserting ${datasetSlugs.length} datasets…`)
    let dsUpserts = 0
    for (const slug of datasetSlugs) {
      const row = datasetBySlug.get(slug)
      if (!row) {
        console.warn(`[sync] dataset slug not in bulk: ${slug}`)
        continue
      }
      await prisma.datasets.upsert({
        where: { slug },
        create: { slug, data: row as unknown as Prisma.InputJsonValue },
        update: { data: row as unknown as Prisma.InputJsonValue },
      })
      dsUpserts += 1
    }
    console.log(`[sync] datasets: ${dsUpserts} upserts`)

    // Sanity check: pull one of the updated Unitree policies
    const check = await prisma.policies.findUnique({
      where: { slug: "unitreerobotics-unifolm-vla-base" },
    })
    const checkData = check?.data as Record<string, unknown> | null
    if (checkData && Array.isArray(checkData.compatible_robot_slugs)) {
      console.log(
        `[sync] verify: unitreerobotics-unifolm-vla-base compat = ${JSON.stringify(
          checkData.compatible_robot_slugs,
        )}`,
      )
    }
    console.log("[sync] ok")
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
