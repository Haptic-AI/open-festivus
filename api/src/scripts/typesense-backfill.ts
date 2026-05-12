/**
 * One-shot backfill: every searchable Postgres row → Typesense.
 *
 * Usage (locally, talking to remote Typesense via SSH tunnel or with the
 * private VPC IP from the festivus-api host):
 *
 *   pnpm --filter @festivus/api typesense:backfill            # idempotent upserts
 *   pnpm --filter @festivus/api typesense:backfill --recreate # drop + recreate collections first
 *
 * Reads the same DATABASE_URL the API uses, so on the box just `dokku enter
 * festivus-api` and run the script in the live container — env is already
 * threaded.
 *
 * Idempotent: re-running with no flags upserts by id (`${table}:${slug}`),
 * so it's safe to invoke from cron as a drift-reconciler. Use `--recreate`
 * only when the schema has changed.
 */
import "../_load-env.js"
import { PrismaClient } from "@prisma/client"
import { environments } from "../db/environments-data.js"
import { PrismaRepo } from "../repo/prisma.js"
import {
  TypesenseError,
  createTypesenseClientFromEnv,
  type ITypesenseClient,
} from "../typesense/client.js"
import { allSchemas, collectionFor, SEARCHABLE_TABLES } from "../typesense/schemas.js"
import { flattenForSearch } from "../typesense/sync.js"

const BATCH_SIZE = 100

async function dropCollection(_client: ITypesenseClient, name: string): Promise<void> {
  // The HTTP client doesn't expose a generic delete-collection helper because
  // it's an explicit destructive op. Inline a fetch with the same key.
  const host = process.env["TYPESENSE_HOST"]
  const port = process.env["TYPESENSE_PORT"]
  const protocol = process.env["TYPESENSE_PROTOCOL"] ?? "http"
  const apiKey = process.env["TYPESENSE_API_KEY"]
  if (!host || !port || !apiKey) return
  const res = await fetch(`${protocol}://${host}:${port}/collections/${name}`, {
    method: "DELETE",
    headers: { "X-TYPESENSE-API-KEY": apiKey },
  })
  if (!res.ok && res.status !== 404) {
    throw new TypesenseError(`drop ${name} failed: ${res.status}`, res.status)
  }
}

async function ensureSchemas(client: ITypesenseClient, recreate: boolean): Promise<void> {
  for (const schema of allSchemas()) {
    if (recreate) {
      console.warn(`[typesense] dropping ${schema.name}`)
      await dropCollection(client, schema.name)
    }
    await client.ensureCollection(schema)
    console.warn(`[typesense] ensured ${schema.name}`)
  }
}

async function backfillTable(
  client: ITypesenseClient,
  repo: PrismaRepo,
  table: (typeof SEARCHABLE_TABLES)[number],
): Promise<number> {
  let offset = 0
  let total = 0
  while (true) {
    const { results } = await repo.list(table, { limit: BATCH_SIZE, offset })
    if (results.length === 0) break
    const docs = results.map((row) => {
      const slug = (row as { slug?: string }).slug
      if (!slug) throw new Error(`row in ${table} at offset ${offset} has no slug`)
      return flattenForSearch(table, slug, row as unknown as Record<string, unknown>)
    })
    await client.importDocuments(collectionFor(table), docs)
    total += docs.length
    if (results.length < BATCH_SIZE) break
    offset += BATCH_SIZE
  }
  return total
}

async function main(): Promise<void> {
  const recreate = process.argv.includes("--recreate")
  const client = createTypesenseClientFromEnv()
  if (!client) {
    console.error("typesense: TYPESENSE_HOST/PORT/API_KEY missing — aborting")
    process.exit(1)
  }
  const prisma = new PrismaClient()
  const repo = new PrismaRepo(prisma, environments)

  await ensureSchemas(client, recreate)

  for (const table of SEARCHABLE_TABLES) {
    const t0 = Date.now()
    const n = await backfillTable(client, repo, table)
    console.warn(`[typesense] indexed ${n} ${table} in ${Date.now() - t0}ms`)
  }

  await prisma.$disconnect()
  console.warn("[typesense] backfill complete")
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
