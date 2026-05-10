/**
 * Seed a canonical mujoco-cloth-fold env + pre-render a pi0-base sim
 * on it. End-to-end airtight happy path for fold-laundry on workbench.
 *
 * Usage (prod):
 *   ssh dokku@3.149.60.233 run festivus-api \
 *     pnpm --filter @festivus/api exec tsx \
 *     src/scripts/seed-fold-laundry-env-and-sim.ts
 *
 * Idempotent on the env row (upsert). The sim POST is NOT idempotent —
 * each run creates a new Simulation + Episode row. Rerunning is fine
 * for development but avoid in prod.
 */

import "../_load-env.js"
import { PrismaClient } from "@prisma/client"

const ENV_SLUG = "mujoco-cloth-fold"
const POLICY_SLUG = "lerobot-pi0-base"
const ROBOT_SLUG = "unitree-g1"
const API_BASE = process.env["API_SELF_URL"] ?? "http://localhost:8000"

const ENV_DATA = {
  id: "env-mujoco-cloth-fold",
  name: "MuJoCo Cloth Fold",
  slug: ENV_SLUG,
  simulator: "mujoco",
  scene: "cloth-fold-tabletop",
  description:
    "MuJoCo scene with a rectangular garment on a flat surface. Canonical benchmark for dexterous cloth manipulation and laundry-folding research. Bimanual arms or humanoid torsos required.",
  conditions: {
    location: "simulated kitchen / laundry room",
    surface: "flat tabletop, 0.8m × 1.2m",
    lighting: "uniform simulated overhead",
    objects: "one rectangular garment (100-400 vertices deformable mesh)",
    obstacles: "none",
    physics: "MuJoCo (dt=0.002s, soft-body contact model)",
    scale: "1:1 real-world",
  },
  compatible_robot_slugs: [
    "unitree-g1",
    "1x-neo",
    "tesla-optimus-gen2",
    "boston-dynamics-atlas",
  ],
  deploy_command:
    "python eval.py --env mujoco-cloth-fold --policy lerobot/pi0_base --episodes 5",
  preview_description:
    "Bimanual or humanoid agent stands in front of a tabletop. A rumpled garment rests in the centre. The agent lifts, aligns, and folds it in half twice.",
}

async function main() {
  const prisma = new PrismaClient()
  try {
    console.warn(`[seed-env] upserting ${ENV_SLUG}...`)
    await prisma.environments.upsert({
      where: { slug: ENV_SLUG },
      update: { data: ENV_DATA as unknown as object },
      create: { slug: ENV_SLUG, data: ENV_DATA as unknown as object },
    })
    console.warn(`  ✓ env ${ENV_SLUG} upserted`)

    // POST /v1/simulations runs through the normal route handler which
    // extracts the policy's hf_repo_id and submits to oneclick. We call
    // the local api instance (same container) rather than going through
    // Cloudflare.
    console.warn(`[seed-env] POST /v1/simulations for (${POLICY_SLUG}, ${ENV_SLUG})...`)
    const res = await fetch(`${API_BASE}/v1/simulations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        policy_slug: POLICY_SLUG,
        environment_slug: ENV_SLUG,
        task_slug: "fold-laundry",
        robot_slug: ROBOT_SLUG,
        episode_count: 1,
      }),
    })
    const body = await res.text()
    if (!res.ok) {
      console.error(
        `[seed-env] sim submit failed (${String(res.status)}): ${body.slice(0, 500)}`,
      )
      process.exit(1)
    }
    const parsed = JSON.parse(body) as { id: string; slug: string }
    console.warn(`  ✓ sim submitted: ${parsed.slug} (id=${parsed.id})`)
    console.warn(
      `[seed-env] oneclick render runs async. Poll /v1/simulations/${parsed.slug} for status.`,
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
