/**
 * Thin proxy to the dataset API's /v1/simulations (spec 026).
 *   GET   — list Simulation groups (envelope, with episode_count per row).
 *   POST  — create a Simulation + N Episodes atomically.
 *
 * The previous /api/simulations proxy from spec 025 served per-Episode
 * traffic and was renamed to /api/episodes in Step 2.3. This file is the new
 * groups proxy; it does not collide with the old one because the old one no
 * longer exists.
 */

import { NextResponse } from "next/server"

const API_BASE = (
  process.env["FESTIVUS_DATASET_API_URL"] ?? "https://api.festivus.hapticlabs.ai"
).replace(/\/$/, "")

async function forward(method: "GET" | "POST", request: Request): Promise<NextResponse> {
  const { search } = new URL(request.url)
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
    },
  }
  if (method === "POST") {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "invalid_json", detail: "request body must be JSON" },
        { status: 400 },
      )
    }
    init.body = JSON.stringify(body)
  }

  let upstream: Response
  try {
    upstream = await fetch(`${API_BASE}/v1/simulations${method === "GET" ? search : ""}`, init)
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

export async function GET(request: Request): Promise<NextResponse> {
  return forward("GET", request)
}

export async function POST(request: Request): Promise<NextResponse> {
  return forward("POST", request)
}
