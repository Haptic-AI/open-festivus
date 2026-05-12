import { NextResponse } from "next/server"
import { getRequestUser } from "@/lib/auth"
import { getClerkToken } from "@/lib/workbench/get-clerk-token"
import {
  buildAuthHeaders,
  workbenchApiGet,
  workbenchApiPut,
  workbenchApiDelete,
} from "@/lib/workbench/workbench-api-client"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
): Promise<NextResponse> {
  const user = await getRequestUser()
  if (user === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { projectId } = await params
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 })
  }

  const clerkToken = await getClerkToken()
  const authHeaders = buildAuthHeaders(user.id, clerkToken)

  try {
    const res = await workbenchApiGet(authHeaders, projectId)
    if (res.status === 404) {
      // New project — no row yet. Return 200+null so the browser never logs a
      // red console error for an expected "not found" on first open.
      return NextResponse.json(null)
    }
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to load project" }, { status: res.status })
    }
    const data: unknown = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
): Promise<NextResponse> {
  const user = await getRequestUser()
  if (user === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { projectId } = await params
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const clerkToken = await getClerkToken()
  const authHeaders = buildAuthHeaders(user.id, clerkToken)

  try {
    const res = await workbenchApiPut(authHeaders, projectId, body)
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to save project" }, { status: res.status })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
): Promise<NextResponse> {
  const user = await getRequestUser()
  if (user === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { projectId } = await params
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 })
  }

  const clerkToken = await getClerkToken()
  const authHeaders = buildAuthHeaders(user.id, clerkToken)

  try {
    const res = await workbenchApiDelete(authHeaders, projectId)
    if (!res.ok && res.status !== 204) {
      return NextResponse.json({ error: "Failed to delete project" }, { status: res.status })
    }
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
