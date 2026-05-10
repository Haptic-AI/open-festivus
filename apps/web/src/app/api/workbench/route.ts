import { NextResponse } from "next/server"
import { getRequestUser } from "@/lib/auth"
import { getClerkToken } from "@/lib/workbench/get-clerk-token"
import { buildAuthHeaders, workbenchApiList } from "@/lib/workbench/workbench-api-client"

export async function GET(): Promise<NextResponse> {
  const user = await getRequestUser()
  if (user === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const clerkToken = await getClerkToken()
  const authHeaders = buildAuthHeaders(user.id, clerkToken)

  try {
    const res = await workbenchApiList(authHeaders)
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch projects" }, { status: res.status })
    }
    const data: unknown = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
