import { createHash } from "node:crypto"
import { PrismaClient } from "@prisma/client"

/**
 * Backfill owner_email on a single api_keys row, keyed by the plaintext key.
 *
 * Usage:
 *   pnpm --filter @festivus/api exec tsx src/scripts/set-api-key-email.ts <plaintext_key> <email>
 *
 * Existed only to bridge keys minted before the owner_email column landed.
 * Future keys snapshot owner_email at mint time via /v1/internal/api-keys.
 */
async function main(): Promise<void> {
  const [, , plaintext, email] = process.argv
  if (!plaintext || !email) {
    console.error("Usage: set-api-key-email.ts <plaintext_key> <email>")
    process.exit(1)
  }

  const keyHash = createHash("sha256").update(plaintext).digest("hex")
  const prisma = new PrismaClient()

  try {
    const match = await prisma.api_keys.findUnique({
      where: { key_hash: keyHash },
      select: { id: true, user_id: true, owner_email: true },
    })
    if (!match) {
      console.error(`No api_keys row matches that plaintext. (hash=${keyHash.slice(0, 12)}…)`)
      process.exit(2)
    }

    await prisma.api_keys.update({
      where: { id: match.id },
      data: { owner_email: email },
    })

    console.log(
      `Updated api_keys.id=${match.id} user_id=${match.user_id}: owner_email ${match.owner_email ?? "(null)"} → ${email}`,
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
