import { describe, expect, it, beforeEach, vi } from "vitest"
import type { IPersistedWorkbenchState, IUser } from "@festivus/types"

// Mock auth — controls which user is "logged in"
let mockUser: IUser | null = { id: "test-user", email: "test@test.com", name: "Test", imageUrl: null }

vi.mock("@/lib/auth", () => ({
  getRequestUser: vi.fn(async () => mockUser),
}))

// Route handlers call getClerkToken() from this wrapper. Return null in tests
// (no Next.js request context) → buildAuthHeaders falls back to X-Dev-User-Id.
vi.mock("@/lib/workbench/get-clerk-token", () => ({
  getClerkToken: vi.fn(async () => null),
}))

// In-memory store keyed by "userId:projectId" — simulates the api/ db layer
type Row = { project_id: string; user_id: string; name: string; data: unknown; updated_at: Date; created_at: Date }
const db = new Map<string, Row>()

function userIdFromHeaders(headers: Record<string, string>): string {
  return headers["X-Dev-User-Id"] ?? headers["Authorization"]?.replace("Bearer ", "") ?? ""
}

// Mock the workbench API client. Route handlers now pass authHeaders as first param.
vi.mock("@/lib/workbench/workbench-api-client", () => ({
  buildAuthHeaders: vi.fn((userId: string, clerkToken: string | null) => {
    if (clerkToken) return { Authorization: `Bearer ${clerkToken}` }
    return { "X-Dev-User-Id": userId }
  }),

  workbenchApiList: vi.fn(async (authHeaders: Record<string, string>) => {
    const userId = userIdFromHeaders(authHeaders)
    const rows = [...db.values()].filter((r) => r.user_id === userId)
      .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())
    const summaries = rows.map((r) => ({
      projectId: r.project_id,
      name: r.name,
      nodeCount: Array.isArray((r.data as Record<string, unknown>)["canvasNodes"])
        ? ((r.data as Record<string, unknown>)["canvasNodes"] as unknown[]).length
        : 0,
      updatedAt: r.updated_at.getTime(),
      createdAt: r.created_at.getTime(),
    }))
    return new Response(JSON.stringify(summaries), { status: 200 })
  }),

  workbenchApiGet: vi.fn(async (authHeaders: Record<string, string>, projectId: string) => {
    const userId = userIdFromHeaders(authHeaders)
    const row = db.get(`${userId}:${projectId}`)
    if (!row) return new Response(JSON.stringify({ error: "not_found" }), { status: 404 })
    return new Response(JSON.stringify(row.data), { status: 200 })
  }),

  workbenchApiPut: vi.fn(async (authHeaders: Record<string, string>, projectId: string, body: unknown) => {
    const userId = userIdFromHeaders(authHeaders)
    const data = body as Record<string, unknown>
    const now = new Date()
    const name = typeof data["name"] === "string" ? data["name"] : projectId
    db.set(`${userId}:${projectId}`, {
      project_id: projectId,
      user_id: userId,
      name,
      data,
      updated_at: now,
      created_at: now,
    })
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }),

  workbenchApiDelete: vi.fn(async (authHeaders: Record<string, string>, projectId: string) => {
    const userId = userIdFromHeaders(authHeaders)
    db.delete(`${userId}:${projectId}`)
    return new Response(null, { status: 204 })
  }),
}))

const projectRoute = await import("../../apps/web/src/app/api/workbench/[projectId]/route")
const listRoute = await import("../../apps/web/src/app/api/workbench/route")

function makeState(id: string): IPersistedWorkbenchState {
  return {
    version: 1,
    projectId: id,
    name: `Project ${id}`,
    canvasNodes: [{ id: "n1", type: "robot", data: {}, status: "confirmed" }],
    connections: [],
    messages: [],
    snapshots: [],
    tray: [],
    selectedInGroup: {},
    createdAt: 1000,
    updatedAt: Date.now(),
  }
}

function makeParams(projectId: string) {
  return { params: Promise.resolve({ projectId }) }
}

describe("API route: /api/workbench/[projectId]", () => {
  beforeEach(() => {
    db.clear()
    mockUser = { id: "test-user", email: "test@test.com", name: "Test", imageUrl: null }
  })

  it("PUT then GET round-trips correctly", async () => {
    const state = makeState("proj_1")
    const putReq = new Request("http://localhost/api/workbench/proj_1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    })

    const putRes = await projectRoute.PUT(putReq, makeParams("proj_1"))
    expect(putRes.status).toBe(200)

    const getReq = new Request("http://localhost/api/workbench/proj_1")
    const getRes = await projectRoute.GET(getReq, makeParams("proj_1"))
    expect(getRes.status).toBe(200)

    const body = await getRes.json()
    expect(body.projectId).toBe("proj_1")
    expect(body.version).toBe(1)
  })

  it("new-project autosave: PUT without prior GET creates row, subsequent GET returns state", async () => {
    // Regression: canvas opens new project (GET → 200+null, no row yet), agent
    // adds nodes, autosave fires PUT. Reload must restore state. Bug: hydrated
    // flag was never set for new projects so saves never fired.
    const getFirst = new Request("http://localhost/api/workbench/proj_new")
    const getNull = await projectRoute.GET(getFirst, makeParams("proj_new"))
    expect(getNull.status).toBe(200)
    expect(await getNull.json()).toBeNull()

    const state = makeState("proj_new")
    const putReq = new Request("http://localhost/api/workbench/proj_new", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    })
    const putRes = await projectRoute.PUT(putReq, makeParams("proj_new"))
    expect(putRes.status).toBe(200)

    const getReq = new Request("http://localhost/api/workbench/proj_new")
    const getRes = await projectRoute.GET(getReq, makeParams("proj_new"))
    expect(getRes.status).toBe(200)
    const body = await getRes.json()
    expect(body.projectId).toBe("proj_new")
    expect(body.canvasNodes).toHaveLength(1)
  })

  it("GET nonexistent returns 200+null (no red console error for new projects)", async () => {
    const req = new Request("http://localhost/api/workbench/nope")
    const res = await projectRoute.GET(req, makeParams("nope"))
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  it("DELETE then GET returns 200+null", async () => {
    const state = makeState("proj_1")
    const putReq = new Request("http://localhost/api/workbench/proj_1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    })
    await projectRoute.PUT(putReq, makeParams("proj_1"))

    const delReq = new Request("http://localhost/api/workbench/proj_1", { method: "DELETE" })
    const delRes = await projectRoute.DELETE(delReq, makeParams("proj_1"))
    expect(delRes.status).toBe(204)

    const getReq = new Request("http://localhost/api/workbench/proj_1")
    const getRes = await projectRoute.GET(getReq, makeParams("proj_1"))
    expect(getRes.status).toBe(200)
    expect(await getRes.json()).toBeNull()
  })

  it("unauthenticated GET returns 401", async () => {
    mockUser = null
    const req = new Request("http://localhost/api/workbench/proj_1")
    const res = await projectRoute.GET(req, makeParams("proj_1"))
    expect(res.status).toBe(401)
  })

  it("unauthenticated PUT returns 401", async () => {
    mockUser = null
    const req = new Request("http://localhost/api/workbench/proj_1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeState("proj_1")),
    })
    const res = await projectRoute.PUT(req, makeParams("proj_1"))
    expect(res.status).toBe(401)
  })

  it("user A cannot see user B projects", async () => {
    mockUser = { id: "user-a", email: null, name: null, imageUrl: null }
    const putReq = new Request("http://localhost/api/workbench/proj_1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeState("proj_1")),
    })
    await projectRoute.PUT(putReq, makeParams("proj_1"))

    mockUser = { id: "user-b", email: null, name: null, imageUrl: null }
    const getReq = new Request("http://localhost/api/workbench/proj_1")
    const getRes = await projectRoute.GET(getReq, makeParams("proj_1"))
    // Returns 200+null, not 404 — "not found for this user" is not an error
    expect(getRes.status).toBe(200)
    expect(await getRes.json()).toBeNull()
  })
})

describe("API route: /api/workbench", () => {
  beforeEach(() => {
    db.clear()
    mockUser = { id: "test-user", email: "test@test.com", name: "Test", imageUrl: null }
  })

  it("GET returns project summaries for current user", async () => {
    for (const id of ["a", "b"]) {
      const req = new Request(`http://localhost/api/workbench/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeState(id)),
      })
      await projectRoute.PUT(req, makeParams(id))
    }

    const res = await listRoute.GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)
    expect(body[0]).toMatchObject({ projectId: expect.any(String), name: expect.any(String), nodeCount: 1 })
  })

  it("unauthenticated GET returns 401", async () => {
    mockUser = null
    const res = await listRoute.GET()
    expect(res.status).toBe(401)
  })

  it("list only returns own projects", async () => {
    mockUser = { id: "user-a", email: null, name: null, imageUrl: null }
    const req = new Request("http://localhost/api/workbench/proj_a", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeState("proj_a")),
    })
    await projectRoute.PUT(req, makeParams("proj_a"))

    mockUser = { id: "user-b", email: null, name: null, imageUrl: null }
    const res = await listRoute.GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })
})
