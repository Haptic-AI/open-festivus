/**
 * One-off cleanup: DELETE FROM "simulations" (CASCADE wipes episodes).
 *
 * Guarded by the CONFIRM_WIPE=yes env var so accidental invocation can't
 * clear prod data. Used to clean up CF-blocked oneclick rows (GH #50).
 *
 *   CONFIRM_WIPE=yes pnpm --filter @festivus/api wipe:simulations
 */

import "../_load-env.js"
import { PrismaClient } from "@prisma/client"

async function main() {
  if (process.env["CONFIRM_WIPE"] !== "yes") {
    console.error("[wipe-simulations] refusing to run without CONFIRM_WIPE=yes")
    process.exit(2)
  }
  const prisma = new PrismaClient()
  try {
    const [sims, eps] = await Promise.all([
      prisma.simulations.count(),
      prisma.episodes.count(),
    ])
    console.warn(`[wipe-simulations] before: ${sims} simulations, ${eps} episodes`)
    const result = await prisma.simulations.deleteMany()
    const [simsAfter, epsAfter] = await Promise.all([
      prisma.simulations.count(),
      prisma.episodes.count(),
    ])
    console.warn(
      `[wipe-simulations] deleted ${result.count} simulations (CASCADE on episodes).`,
    )
    console.warn(`[wipe-simulations] after:  ${simsAfter} simulations, ${epsAfter} episodes`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err: unknown) => {
  console.error("[wipe-simulations] fatal:", err)
  process.exit(1)
})
