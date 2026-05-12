/**
 * Thin GET proxy to the dataset API's /v1/search.
 *
 * Goes through this Next.js route instead of letting the browser hit
 * api.festivus.hapticlabs.ai directly so the search bar stays same-origin
 * (no preflight, no CORS surprises) and the API base URL is centralized.
 */

import { NextResponse } from "next/server"

const API_BASE = (
  process.env["FESTIVUS_DATASET_API_URL"] ?? "https://api.festivus.hapticlabs.ai"
).replace(/\/$/, "")

export async function GET(request: Request): Promise<NextResponse> {
  const { search } = new URL(request.url)
  let upstream: Response
  try {
    upstream = await fetch(`${API_BASE}/v1/search${search}`, {
      headers: { accept: "application/json" },
      // Type-ahead requests are noisy; let upstream cache identical strings
      // for a few seconds via the API's own response cache (when present).
      cache: "no-store",
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
