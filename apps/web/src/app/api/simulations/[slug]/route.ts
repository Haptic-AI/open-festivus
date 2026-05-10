/**
 * Proxy to /v1/simulations/:slug (spec 026 detail route). Returns the
 * Simulation plus its ordered episodes. The workbench poll loop uses
 * this to read episode status + error_message + video_url per turn.
 */

import { NextResponse } from "next/server"

const API_BASE = (
  process.env["FESTIVUS_DATASET_API_URL"] ?? "https://api.festivus.hapticlabs.ai"
).replace(/\/$/, "")

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params
  let upstream: Response
  try {
    upstream = await fetch(`${API_BASE}/v1/simulations/${encodeURIComponent(slug)}`, {
      headers: { accept: "application/json" },
    })
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
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
    },
  })
}
