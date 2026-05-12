/**
 * POST /api/contribute/compatibility-edges
 *
 * Signed-in users submit a new (or updated) Robot × Policy compatibility edge.
 * The Next.js handler validates the payload, computes the slug
 * (`${robot}__${policy}` or `${robot}__${policy}__${environment}`), and
 * forwards an upsert to the Express API via the moderator key.
 *
 * Returns 201 with the saved edge on success.
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import type { ICompatibilityEdge } from "@festivus/types"
import { getRequestUser } from "@/lib/auth"
import { upsertCompatibilityEdge } from "@/lib/compat-edges-forwarder"

const NewEdgeSchema = z.object({
  robot_slug: z.string().trim().min(1).max(120),
  policy_slug: z.string().trim().min(1).max(120),
  status: z.enum(["verified", "reported", "inferred", "untested"]),
  source: z.enum(["paper", "community", "inferred", "taxonomy-match"]),
  notes: z.string().trim().min(20).max(2000),
  environment: z.string().trim().max(120).nullable().optional(),
  evidence_url: z.string().trim().url().max(500).nullable().optional(),
  success_rate: z.number().min(0).max(1).nullable().optional(),
  episodes_tested: z.number().int().min(0).nullable().optional(),
  gaps: z.array(z.string().trim().min(1).max(500)).max(10).optional(),
})

function buildSlug(robot: string, policy: string, env: string | null | undefined): string {
  return env ? `${robot}__${policy}__${env}` : `${robot}__${policy}`
}

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getRequestUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let parsed: z.infer<typeof NewEdgeSchema>
  try {
    const raw = (await request.json()) as unknown
    parsed = NewEdgeSchema.parse(raw ?? {})
  } catch (err) {
    return NextResponse.json(
      { error: "invalid_request", detail: err instanceof Error ? err.message : "bad json" },
      { status: 400 },
    )
  }

  const slug = buildSlug(parsed.robot_slug, parsed.policy_slug, parsed.environment ?? null)
  const edge: ICompatibilityEdge & { notes: string } = {
    slug,
    robot_slug: parsed.robot_slug,
    policy_slug: parsed.policy_slug,
    status: parsed.status,
    source: parsed.source,
    success_rate: parsed.success_rate ?? null,
    episodes_tested: parsed.episodes_tested ?? null,
    environment: parsed.environment ?? null,
    evidence_url: parsed.evidence_url ?? null,
    gaps: parsed.gaps ?? [],
    updated_at: new Date().toISOString(),
    notes: parsed.notes,
  }

  try {
    const saved = await upsertCompatibilityEdge(edge)
    return NextResponse.json({ edge: saved, slug }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: "upstream_failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    )
  }
}
