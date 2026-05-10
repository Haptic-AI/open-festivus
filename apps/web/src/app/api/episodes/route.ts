/**
 * Thin server-side proxy to the dataset API's POST /v1/episodes (spec 026).
 * Client components call `fetch("/api/episodes", …)` so they don't need CORS
 * or a hardcoded localhost:8000. The server forwards the JSON body to
 * `${FESTIVUS_DATASET_API_URL}/v1/episodes`.
 *
 * In local dev, set `FESTIVUS_DATASET_API_URL=http://localhost:8000` in
 * apps/web/.env.local (the prod default is the Dokku api, which does not
 * have /v1/episodes mounted yet — iter-1 deploys only hit local).
 */

import { NextResponse } from "next/server"

const API_BASE = (
  process.env["FESTIVUS_DATASET_API_URL"] ?? "https://api.festivus.hapticlabs.ai"
).replace(/\/$/, "")

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "invalid_json", detail: "request body must be JSON" },
      { status: 400 },
    )
  }

  let upstream: Response
  try {
    upstream = await fetch(`${API_BASE}/v1/episodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
    headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
  })
}
