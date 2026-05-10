/**
 * Thin server-side proxy over the dataset API's /v1/compatibility endpoint.
 *
 * Exists so client components (e.g. PolicyCard) can read compat edges
 * without hardcoding the dataset API URL or exposing it to the browser.
 * The server reads FESTIVUS_DATASET_API_URL from its own env (defaulting to
 * http://localhost:8000), forwards robot + policy filters, and streams the
 * JSON body back unchanged.
 *
 * Note: we use the FestivusClient here so the response is validated through
 * the same Zod schemas the agent relies on — including the scalar-array
 * normalization on taxonomy.required_control. That guarantees a card that
 * consumes this route sees the same shape everywhere else in the app does.
 */

import { NextResponse } from "next/server"
import { FestivusClient } from "@/lib/api/festivus-client"

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url)
  const robot = url.searchParams.get("robot") ?? undefined
  const policy = url.searchParams.get("policy") ?? undefined
  if (robot === undefined && policy === undefined) {
    return NextResponse.json({ error: "missing_filter", message: "robot or policy is required" }, { status: 400 })
  }
  const client = new FestivusClient()
  const edges = await client.searchCompatibility({ robot, policy, limit: 10 })
  if (edges === null) {
    return NextResponse.json({ count: 0, results: [] })
  }
  return NextResponse.json({ count: edges.length, results: edges })
}
