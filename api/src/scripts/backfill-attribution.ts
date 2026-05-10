/**
 * Spec 029 Step 1.5. Backfill attribution FKs on rows created before the
 * spec landed.
 *
 * Algorithm (pure SQL — no Clerk SDK required; Lesson 1 in the plan):
 *   1. SELECT DISTINCT user_id FROM api_keys WHERE owner_id IS NULL.
 *      These are Clerk user ids already; Prisma.users.upsert canonicalises
 *      each into the `users` table (client generates cuid on insert).
 *   2. UPDATE api_keys SET owner_id = users.id WHERE api_keys.user_id =
 *      users.clerk_user_id AND api_keys.owner_id IS NULL.
 *   3. UPDATE mutations SET author_id = api_keys.owner_id WHERE
 *      mutations.actor_id::int = api_keys.id AND mutations.author_id IS NULL
 *      AND api_keys.owner_id IS NOT NULL.
 *
 * Idempotent. Re-runnable. Prints a summary with counts.
 *
 * Usage (local dev):
 *   pnpm --filter @festivus/api exec tsx src/scripts/backfill-attribution.ts
 *
 * Targets the `POSTGRES_URL` you have exported. Production run is a separate
 * deploy decision out of scope for spec 029.
 */

import { PrismaClient } from "@prisma/client"

export interface IBackfillSummary {
  clerk_ids_seen: number
  users_upserted: number
  api_keys_backfilled: number
  mutations_backfilled: number
  mutations_left_null_no_api_key: number
  mutations_left_null_orphan_actor: number
}

/**
 * Runs the backfill against the supplied Prisma client. Returns a summary so
 * tests can assert on counts and the CLI can pretty-print it.
 */
export async function backfillAttribution(prisma: PrismaClient): Promise<IBackfillSummary> {
  // Step 1: distinct Clerk ids across api_keys rows that still need owner_id.
  const rows = await prisma.api_keys.findMany({
    where: { owner_id: null },
    select: { user_id: true },
    distinct: ["user_id"],
  })
  const clerkIds = rows.map((r) => r.user_id).filter((id): id is string => typeof id === "string" && id.length > 0)

  // Step 2: upsert a users row per distinct Clerk id. Email is unknown here,
  // so we leave it null; a later touchpoint (next mint, next login) populates.
  let usersUpserted = 0
  for (const clerkId of clerkIds) {
    await prisma.users.upsert({
      where: { clerk_user_id: clerkId },
      create: { clerk_user_id: clerkId, email: null },
      update: {},
    })
    usersUpserted += 1
  }

  // Step 3: stamp api_keys.owner_id from users.id by clerk_user_id match.
  const apiKeyUpdate = await prisma.$executeRaw`
    UPDATE api_keys
    SET owner_id = users.id
    FROM users
    WHERE api_keys.user_id = users.clerk_user_id
      AND api_keys.owner_id IS NULL
  `

  // Step 4: stamp mutations.author_id by joining through the api_keys row
  // whose id matches the mutation's actor_id (stored as text of the numeric
  // api_keys.id).
  const mutationUpdate = await prisma.$executeRaw`
    UPDATE mutations
    SET author_id = api_keys.owner_id
    FROM api_keys
    WHERE mutations.actor_id ~ '^[0-9]+$'
      AND mutations.actor_id::int = api_keys.id
      AND mutations.author_id IS NULL
      AND api_keys.owner_id IS NOT NULL
  `

  // Diagnostic counts for mutations still NULL after the sweep.
  const leftNullRows = await prisma.mutations.findMany({
    where: { author_id: null },
    select: { id: true, actor_id: true },
  })
  let leftNullNoKey = 0
  let leftNullOrphan = 0
  for (const m of leftNullRows) {
    if (/^\d+$/.test(m.actor_id)) {
      const apiKeyId = Number.parseInt(m.actor_id, 10)
      const match = await prisma.api_keys.findUnique({ where: { id: apiKeyId } })
      if (!match) leftNullOrphan += 1
      else if (match.owner_id === null) leftNullNoKey += 1
    } else {
      leftNullOrphan += 1
    }
  }

  return {
    clerk_ids_seen: clerkIds.length,
    users_upserted: usersUpserted,
    api_keys_backfilled: Number(apiKeyUpdate),
    mutations_backfilled: Number(mutationUpdate),
    mutations_left_null_no_api_key: leftNullNoKey,
    mutations_left_null_orphan_actor: leftNullOrphan,
  }
}

function formatSummary(s: IBackfillSummary): string {
  return [
    `[backfill-attribution] spec 029 step 1.5`,
    `  clerk_ids_seen:                  ${s.clerk_ids_seen}`,
    `  users_upserted:                  ${s.users_upserted}`,
    `  api_keys_backfilled:             ${s.api_keys_backfilled}`,
    `  mutations_backfilled:            ${s.mutations_backfilled}`,
    `  mutations_left_null_no_api_key:  ${s.mutations_left_null_no_api_key}`,
    `  mutations_left_null_orphan_actor: ${s.mutations_left_null_orphan_actor}`,
  ].join("\n")
}

async function main(): Promise<void> {
  const prisma = new PrismaClient()
  try {
    const summary = await backfillAttribution(prisma)
    console.log(formatSummary(summary))
  } finally {
    await prisma.$disconnect()
  }
}

// Only run main when executed directly. Importing this module (e.g. from
// tests) just exposes `backfillAttribution` without side effects.
const invokedDirectly = process.argv[1]?.endsWith("backfill-attribution.ts") ||
  process.argv[1]?.endsWith("backfill-attribution.js")
if (invokedDirectly) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
