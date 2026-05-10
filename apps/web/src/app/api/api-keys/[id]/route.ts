import { NextResponse } from "next/server"
import { getRequestUser } from "@/lib/auth"
import { revokeKeyFor } from "@/lib/api-keys-forwarder"

// Spec 027 phase B: forwards to api/ instead of hitting Postgres directly.
// The cascade (auto-reject pending mutations from this key) runs on the
// api/ side inside the same revoke flow.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const user = await getRequestUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const numericId = Number.parseInt(id, 10)
  if (!Number.isFinite(numericId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 })
  }

  try {
    const revoked = await revokeKeyFor(user.id, numericId)
    if (!revoked) {
      return NextResponse.json({ error: "not_found" }, { status: 404 })
    }
    return NextResponse.json({ revoked: true })
  } catch (err) {
    return NextResponse.json(
      { error: "upstream_failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    )
  }
}
