/**
 * Proxy for the dataset API's GET /v1/episodes/:id (spec 026). Same env
 * convention as POST /api/episodes (./route.ts). Forwards the upstream body
 * and status unchanged — the client reads the row shape directly.
 */

import { NextResponse } from "next/server"

const API_BASE = (
  process.env["FESTIVUS_DATASET_API_URL"] ?? "https://api.festivus.hapticlabs.ai"
).replace(/\/$/, "")

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 })
  }

  let upstream: Response
  try {
    upstream = await fetch(`${API_BASE}/v1/episodes/${encodeURIComponent(id)}`)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: "upstream_unreachable", detail, api_base: API_BASE },
      { status: 502 },
    )
  }

  const text = await upstream.text()
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
  })
}
