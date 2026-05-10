/**
 * Destructive reset of the `laundry_compat_edges` table from
 * data/laundry_compat_edges.json.
 *
 * Wraps TRUNCATE + bulk INSERT in a single transaction so a partial failure
 * leaves the table untouched. Safe to run repeatedly. Mirrors
 * reset-compatibility-edges.ts.
 *
 * Spec: specs/021-laundry-folding-compat-dataset.md
 *
 * Usage:
 *   pnpm --filter @festivus/api reset:laundry-compat-edges
 */
import "../src/_load-env.js"

import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { PrismaClient, Prisma } from "@prisma/client"

const __dirname = dirname(fileURLToPath(import.meta.url))
const SEED_PATH = resolve(__dirname, "../../data/laundry_compat_edges.json")

interface ISeedEdge {
  slug: string
  [key: string]: unknown
}

async function main(): Promise<void> {
  const raw = readFileSync(SEED_PATH, "utf8")
  const edges = JSON.parse(raw) as ISeedEdge[]

  if (!Array.isArray(edges)) {
    throw new Error(`Seed file is not a JSON array: ${SEED_PATH}`)
  }
  for (const e of edges) {
    if (typeof e.slug !== "string" || e.slug.length === 0) {
      throw new Error(`Seed row missing slug: ${JSON.stringify(e).slice(0, 120)}`)
    }
  }

  const prisma = new PrismaClient()
  try {
    const before = await prisma.laundry_compat_edges.count()
    console.log(`[reset-laundry-compat] before: ${before} rows`)
    console.log(`[reset-laundry-compat] loading ${edges.length} rows from ${SEED_PATH}`)

    await prisma.$transaction([
      prisma.$executeRaw`TRUNCATE TABLE laundry_compat_edges RESTART IDENTITY`,
      ...edges.map((e) =>
        prisma.laundry_compat_edges.create({
          data: { slug: e.slug, data: e as unknown as Prisma.InputJsonValue },
        }),
      ),
    ])

    const after = await prisma.laundry_compat_edges.count()
    console.log(`[reset-laundry-compat] after:  ${after} rows`)
    if (after !== edges.length) {
      throw new Error(`Row count mismatch: expected ${edges.length}, got ${after}`)
    }
    console.log("[reset-laundry-compat] ok")
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
