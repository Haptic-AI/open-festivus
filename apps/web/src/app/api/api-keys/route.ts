import { NextResponse } from "next/server"
import { z } from "zod"
import { getRequestUser } from "@/lib/auth"
import { createKeyFor, listKeysFor } from "@/lib/api-keys-forwarder"

// `keyed` = raises rate limits (read-only). `write` = grants PATCH/PUT/DELETE on
// /v1/write/*. Any signed-in user can self-mint either for now — P0 self-hosted
// mode. Before public launch, gate `tier: 'write'` behind a Clerk role allowlist.
//
// Spec 027 phase B: this route no longer touches Postgres. It Clerk-authenticates,
// validates, then forwards to the Express API's /v1/internal/api-keys with
// FESTIVUS_MODERATOR_KEY so the DB write happens in one place.
const CreateKeySchema = z.object({
  name: z.string().trim().min(1).max(64).nullable().optional(),
  tier: z.enum(["keyed", "write"]).optional(),
})

export async function GET(): Promise<NextResponse> {
  const user = await getRequestUser()
  if (!user) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } },
    )
  }
  try {
    const keys = await listKeysFor(user.id)
    return NextResponse.json({ keys })
  } catch (err) {
    return NextResponse.json(
      { error: "upstream_failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    )
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getRequestUser()
  if (!user) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } },
    )
  }

  let parsed: z.infer<typeof CreateKeySchema>
  try {
    const raw = (await request.json()) as unknown
    parsed = CreateKeySchema.parse(raw ?? {})
  } catch (err) {
    return NextResponse.json(
      { error: "invalid_request", detail: err instanceof Error ? err.message : "bad json" },
      { status: 400 },
    )
  }

  try {
    const created = await createKeyFor(user.id, parsed.name ?? null, parsed.tier, user.email)
    return NextResponse.json({ key: created }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: "upstream_failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    )
  }
}
