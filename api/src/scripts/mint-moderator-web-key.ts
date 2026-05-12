/**
 * Mint a write-tier api_keys row for apps/web's /moderate forwarder (spec 027).
 *
 * Generates a fresh `fek_<32 hex>` plaintext, SHA-256 hashes it, and inserts
 * (or updates) the `festivus-moderator-web` row in api_keys. Prints the
 * plaintext once — copy it into:
 *
 *   apps/web/.env.local              (local dev)
 *   Vercel → festivus project env    (production, as FESTIVUS_MODERATOR_KEY)
 *
 * Re-running rotates the key: the hash is updated, the previous plaintext
 * stops working on the next request, and the new plaintext replaces it.
 *
 * Usage:
 *   pnpm --filter @festivus/api exec tsx src/scripts/mint-moderator-web-key.ts
 *
 * Targets the `POSTGRES_URL` you have exported. For prod, ssh into the Dokku
 * host and run via `docker exec`; for local, just run against the supabase
 * dev DB.
 */

import { createHash, randomBytes } from "node:crypto"
import { PrismaClient } from "@prisma/client"

const USER_ID = "festivus-moderator-web"
const NAME = "apps/web moderator forwarder key"

async function main(): Promise<void> {
  const plaintext = `fek_${randomBytes(16).toString("hex")}`
  const keyHash = createHash("sha256").update(plaintext).digest("hex")

  const prisma = new PrismaClient()
  try {
    const existing = await prisma.api_keys.findFirst({ where: { user_id: USER_ID } })
    if (existing) {
      await prisma.api_keys.update({
        where: { id: existing.id },
        data: { key_hash: keyHash, revoked_at: null, tier: "write", name: NAME },
      })
      console.log(`[mint-moderator] rotated key id=${existing.id}`)
    } else {
      const row = await prisma.api_keys.create({
        data: { user_id: USER_ID, key_hash: keyHash, tier: "write", name: NAME },
      })
      console.log(`[mint-moderator] created key id=${row.id}`)
    }
    console.log("")
    console.log("Copy this into apps/web/.env.local (dev) or Vercel (prod) as FESTIVUS_MODERATOR_KEY:")
    console.log("")
    console.log(`  FESTIVUS_MODERATOR_KEY=${plaintext}`)
    console.log("")
    console.log("The plaintext is NOT stored anywhere. Re-run this script to rotate.")
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
