/**
 * Destructive reset of the `robots` table from data/robots_seed.json.
 *
 * Wraps TRUNCATE + bulk INSERT in a single transaction so a partial failure
 * leaves the table untouched. Designed to be safe to run repeatedly against
 * any environment whose DATABASE_URL is in scope.
 *
 * Usage:
 *   pnpm --filter @festivus/api reset:robots
 */
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { PrismaClient, Prisma } from "@prisma/client"

const __dirname = dirname(fileURLToPath(import.meta.url))
const SEED_PATH = resolve(__dirname, "../../data/robots_seed.json")

interface ISeedRobot {
  slug: string
  [key: string]: unknown
}

async function main(): Promise<void> {
  const raw = readFileSync(SEED_PATH, "utf8")
  const robots = JSON.parse(raw) as ISeedRobot[]

  if (!Array.isArray(robots) || robots.length === 0) {
    throw new Error(`No robots found in ${SEED_PATH}`)
  }
  for (const r of robots) {
    if (typeof r.slug !== "string" || r.slug.length === 0) {
      throw new Error(`Seed row missing slug: ${JSON.stringify(r).slice(0, 120)}`)
    }
  }

  const prisma = new PrismaClient()
  try {
    const before = await prisma.robots.count()
    console.log(`[reset-robots] before: ${before} rows`)
    console.log(`[reset-robots] loading ${robots.length} rows from ${SEED_PATH}`)

    await prisma.$transaction([
      prisma.$executeRaw`TRUNCATE TABLE robots RESTART IDENTITY`,
      ...robots.map((r) =>
        prisma.robots.create({
          data: { slug: r.slug, data: r as unknown as Prisma.InputJsonValue },
        }),
      ),
    ])

    const after = await prisma.robots.count()
    console.log(`[reset-robots] after:  ${after} rows`)
    if (after !== robots.length) {
      throw new Error(`Row count mismatch: expected ${robots.length}, got ${after}`)
    }
    console.log("[reset-robots] ok")
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
