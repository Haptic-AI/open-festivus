/**
 * Thin GET proxy to the dataset API's /v1/tasks (spec 026 iter-1).
 */

import { NextResponse } from "next/server"

const API_BASE = (
  process.env["FESTIVUS_DATASET_API_URL"] ?? "https://api.festivus.hapticlabs.ai"
).replace(/\/$/, "")

export async function GET(request: Request): Promise<NextResponse> {
  const { search } = new URL(request.url)
  let upstream: Response
  try {
    upstream = await fetch(`${API_BASE}/v1/tasks${search}`, {
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
