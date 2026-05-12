/**
 * Seed the fold-laundry happy path (user ask 2026-04-23).
 *
 * Before this ran, the fold-laundry task's `compatible_policy_slugs` pointed
 * at `pi0-base` and `octo-base` — both 404 on /v1/policies. This script
 * upserts the real policies the community uses for fold-laundry manipulation
 * and repoints the task:
 *
 *   - lerobot/pi0_base       — Physical Intelligence pi0 base (VLA, gemma)
 *   - lerobot/pi05_base      — Physical Intelligence pi0.5 base (newer)
 *   - lerobot/pi0fast-base   — pi0 + FAST action tokenizer (faster)
 *   - figure-ai-helix        — Figure AI Helix (curated stub, closed source)
 *
 * Helix has no HF weights released publicly. We ship a stub row with
 * evidence=reported and a verified_via_url pointing at Figure's announcement
 * so users can see it on the canvas. Sim won't render for Helix.
 *
 * Idempotent: re-runs upsert + patch. Safe to run multiple times.
 *
 * Usage (prod):
 *   ssh dokku@3.149.60.233 run festivus-api \
 *     pnpm --filter @festivus/api exec tsx src/scripts/seed-fold-laundry-policies.ts
 */

import "../_load-env.js"
import { PrismaClient } from "@prisma/client"

interface IPolicyData {
  id: string
  name: string
  slug: string
  author: string
  license: string
  hf_url: string | null
  hf_repo_id: string | null
  framework: string
  skill_type: string
  evidence_level: "verified" | "reported" | "community" | "untested"
  task_description: string
  paper_arxiv_url: string | null
  verified_via_url: string | null
  verified_at: string | null
  verified_hardware: string[]
  verified_hardware_note: string | null
  g1_compatible: boolean
  g1_compatible_note: string | null
  compatible_robot_slugs: string[]
  compatible_env_slugs: string[]
  benchmarks: Array<Record<string, unknown>>
  taxonomy: {
    required_control: string
    action_dimensions: number
    required_perception: string[]
  }
  action_space: { type: string; dimensions: number; frequency_hz: number }
  observation_space: { type: string; components: Array<Record<string, unknown>> }
}

function mkPolicy(partial: Pick<IPolicyData,
  | "id" | "name" | "slug" | "author" | "license" | "hf_url" | "hf_repo_id"
  | "framework" | "evidence_level" | "task_description" | "paper_arxiv_url"
  | "verified_via_url" | "verified_at" | "verified_hardware_note"
  | "g1_compatible" | "g1_compatible_note"
>): IPolicyData {
  return {
    ...partial,
    skill_type: "manipulation",
    verified_hardware: [],
    compatible_robot_slugs: ["unitree-g1", "boston-dynamics-atlas", "1x-neo", "tesla-optimus-gen2"],
    compatible_env_slugs: ["mujoco-humanoid-cloth"],
    benchmarks: [],
    taxonomy: {
      required_control: "joint_position",
      action_dimensions: 0,
      required_perception: ["proprioception", "monocular_rgb"],
    },
    action_space: { type: "other", dimensions: 0, frequency_hz: 0 },
    observation_space: { type: "other", components: [] },
  }
}

const POLICIES: IPolicyData[] = [
  mkPolicy({
    id: "p-pi0-base",
    name: "pi0 base",
    slug: "lerobot-pi0-base",
    author: "lerobot",
    license: "gemma",
    hf_url: "https://huggingface.co/lerobot/pi0_base",
    hf_repo_id: "lerobot/pi0_base",
    framework: "LeRobot",
    evidence_level: "community",
    paper_arxiv_url: "https://arxiv.org/abs/2410.24164",
    verified_via_url: "https://huggingface.co/lerobot/pi0_base",
    verified_at: "2026-04-23",
    task_description:
      "Physical Intelligence pi0 vision-language-action base policy. 3.5B params, trained on cross-embodiment manipulation data. Strong baseline for dexterous manipulation including fold-laundry.",
    verified_hardware_note:
      "Cross-embodiment VLA. Community-tested on bimanual arm setups; no verified G1 run.",
    g1_compatible: false,
    g1_compatible_note:
      "Cross-embodiment architecture but no G1-specific action head. Fine-tune required for G1 deployment.",
  }),
  mkPolicy({
    id: "p-pi05-base",
    name: "pi0.5 base",
    slug: "lerobot-pi05-base",
    author: "lerobot",
    license: "gemma",
    hf_url: "https://huggingface.co/lerobot/pi05_base",
    hf_repo_id: "lerobot/pi05_base",
    framework: "LeRobot",
    evidence_level: "community",
    paper_arxiv_url: null,
    verified_via_url: "https://huggingface.co/lerobot/pi05_base",
    verified_at: "2026-04-23",
    task_description:
      "Physical Intelligence pi0.5 base — successor to pi0 with improved training recipe. 3.6B params, vision-language-action. Strong on manipulation including fold-laundry.",
    verified_hardware_note:
      "Cross-embodiment VLA. Newer than pi0; community-tested on bimanual arms.",
    g1_compatible: false,
    g1_compatible_note:
      "Same architecture family as pi0 — fine-tune required for humanoid targets.",
  }),
  mkPolicy({
    id: "p-pi0fast-base",
    name: "pi0-fast base",
    slug: "lerobot-pi0fast-base",
    author: "lerobot",
    license: "gemma",
    hf_url: "https://huggingface.co/lerobot/pi0fast-base",
    hf_repo_id: "lerobot/pi0fast-base",
    framework: "LeRobot",
    evidence_level: "community",
    paper_arxiv_url: "https://arxiv.org/abs/2501.09747",
    verified_via_url: "https://huggingface.co/lerobot/pi0fast-base",
    verified_at: "2026-04-23",
    task_description:
      "pi0 variant with FAST action tokenizer for higher-frequency control. 5x inference throughput vs pi0-base. Strong manipulation including fold-laundry.",
    verified_hardware_note: "FAST tokenizer enables real-time 10-20Hz control on commodity GPUs.",
    g1_compatible: false,
    g1_compatible_note: "Same fine-tune story as pi0.",
  }),
  mkPolicy({
    id: "p-figure-ai-helix",
    name: "Helix",
    slug: "figure-ai-helix",
    author: "figure-ai",
    license: "proprietary",
    hf_url: null,
    hf_repo_id: null,
    framework: "proprietary",
    evidence_level: "reported",
    paper_arxiv_url: null,
    verified_via_url: "https://www.figure.ai/news/helix",
    verified_at: "2026-04-23",
    task_description:
      "Figure AI Helix — proprietary generalist VLA for humanoid robots. Demos include cloth manipulation and folding. Not open-sourced; weights unavailable. Listed here because Figure's reported results are load-bearing for the humanoid fold-laundry landscape.",
    verified_hardware_note: "Figure 02 humanoid only (per Figure's reporting).",
    g1_compatible: false,
    g1_compatible_note: "Closed-source; no inference API or weights available.",
  }),
]

async function main() {
  const prisma = new PrismaClient()

  try {
    console.warn(`[seed-fold-laundry] upserting ${String(POLICIES.length)} policies...`)
    for (const p of POLICIES) {
      await prisma.policies.upsert({
        where: { slug: p.slug },
        update: { data: p as unknown as object },
        create: { slug: p.slug, data: p as unknown as object },
      })
      console.warn(`  ✓ ${p.slug}`)
    }

    // Patch fold-laundry task to point at the real slugs.
    const task = await prisma.tasks.findUnique({ where: { slug: "fold-laundry" } })
    if (!task) {
      console.error(`[seed-fold-laundry] fold-laundry task not found; skipping patch`)
      return
    }
    const taskData = task.data as Record<string, unknown>
    const newPolicySlugs = POLICIES.map((p) => p.slug)
    const updated = { ...taskData, compatible_policy_slugs: newPolicySlugs }
    await prisma.tasks.update({
      where: { slug: "fold-laundry" },
      data: { data: updated },
    })
    console.warn(`[seed-fold-laundry] patched fold-laundry.compatible_policy_slugs → [${newPolicySlugs.join(", ")}]`)

    // Add compat edges for humanoid fold-laundry pairings.
    const humanoidRobots = ["unitree-g1", "1x-neo", "boston-dynamics-atlas", "tesla-optimus-gen2"]
    let edgesCreated = 0
    for (const policy of POLICIES) {
      for (const robot of humanoidRobots) {
        // Helix is Figure-02 only per its reporting — skip for other humanoids.
        if (policy.slug === "figure-ai-helix") continue
        const edgeSlug = `${robot}__${policy.slug}`
        const edgeData = {
          slug: edgeSlug,
          robot_slug: robot,
          policy_slug: policy.slug,
          status: "reported",
          source: "community",
          reliability_tier: 2,
          success_rate: null,
          notes: "Community-tested cross-embodiment VLA; fine-tune required for exact humanoid match.",
        }
        await prisma.compatibility_edges.upsert({
          where: { slug: edgeSlug },
          update: { data: edgeData },
          create: { slug: edgeSlug, data: edgeData },
        })
        edgesCreated++
      }
    }
    console.warn(`[seed-fold-laundry] upserted ${String(edgesCreated)} compat edges`)

    console.warn(`[seed-fold-laundry] done.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
