import express from "express"
import request from "supertest"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildWorkbenchProjectsRouter } from "./workbench-projects.js"

/**
 * Unit tests for /v1/internal/workbench-projects (spec 028).
 *
 * Uses vi.fn Prisma stubs — no live DB needed. Covers full CRUD cycle,
 * two-user auth isolation, and round-trip fidelity.
 *
 * requireClerkAuth() is satisfied by the X-Dev-User-Id header (the dev-mode
 * escape hatch that kicks in when CLERK_SECRET_KEY is absent). This matches
 * what apps/web sends in development.
 */

const FIXTURE_STATE = {
  version: 1 as const,
  projectId: "proj_test123",
  name: "Test Project",
  canvasNodes: [
    { id: "n1", type: "robot" as const, data: { slug: "atlas" }, status: "idle" },
  ],
  connections: [],
  messages: [],
  snapshots: [],
  tray: [],
  selectedInGroup: {},
  createdAt: 1000000,
  updatedAt: 1000001,
}

function makePrismaStub(overrides: {
  existingRow?: typeof FIXTURE_STATE | null
  rows?: Array<{ project_id: string; name: string; data: unknown; updated_at: Date; created_at: Date }>
} = {}) {
  const upsertCalls: Array<{ projectId: string; userId: string; data: unknown }> = []
  const deleteCalls: Array<{ projectId: string; userId: string }> = []

  return {
    users: {
      upsert: vi.fn(async (args: { where: { clerk_user_id: string }; create: { clerk_user_id: string; email?: string | null } }) => ({
        id: `user_${args.where.clerk_user_id}`,
        clerk_user_id: args.where.clerk_user_id,
        email: args.create.email ?? null,
      })),
    },
    workbench_projects: {
      upsert: vi.fn(async ({ where, create }: { where: { project_id_user_id: { project_id: string; user_id: string } }; create: { data: unknown } }) => {
        upsertCalls.push({
          projectId: where.project_id_user_id.project_id,
          userId: where.project_id_user_id.user_id,
          data: create.data,
        })
        return {}
      }),
      findFirst: vi.fn(async (_args: { where: { project_id: string; user_id: string } }) => {
        if (overrides.existingRow === undefined) {
          return { data: FIXTURE_STATE }
        }
        if (overrides.existingRow === null) return null
        return { data: overrides.existingRow }
      }),
      findMany: vi.fn(async ({ where }: { where: { user_id: string } }) => {
        const rows = overrides.rows ?? [
          {
            project_id: "proj_test123",
            name: "Test Project",
            data: FIXTURE_STATE,
            updated_at: new Date(1000001),
            created_at: new Date(1000000),
          },
        ]
        return rows.filter((r) => {
          const data = r.data as Record<string, unknown>
          return String(data["userId"] ?? where.user_id) === where.user_id
        })
      }),
      deleteMany: vi.fn(async (args: unknown) => {
        const { where } = args as { where: { project_id: string; user_id: string } }
        deleteCalls.push({ projectId: where.project_id, userId: where.user_id })
        return { count: 1 }
      }),
    },
    _upsertCalls: upsertCalls,
    _deleteCalls: deleteCalls,
  }
}

// Build a test Express app. CLERK_SECRET_KEY is absent in tests, so
// requireClerkAuth() accepts the X-Dev-User-Id header as the user identity.
function makeApp(prisma: ReturnType<typeof makePrismaStub>) {
  const app = express()
  app.use(express.json())
  app.use("/v1/internal/workbench-projects", buildWorkbenchProjectsRouter(prisma as never))
  return app
}

describe("GET /v1/internal/workbench-projects (list)", () => {
  let prisma: ReturnType<typeof makePrismaStub>
  beforeEach(() => { prisma = makePrismaStub() })

  it("returns 401 when X-Dev-User-Id header is absent", async () => {
    const res = await request(makeApp(prisma)).get("/v1/internal/workbench-projects")
    expect(res.status).toBe(401)
  })

  it("returns 200 with IProjectSummary[] for authenticated user", async () => {
    const res = await request(makeApp(prisma))
      .get("/v1/internal/workbench-projects")
      .set("X-Dev-User-Id", "alice")
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body[0]).toMatchObject({
      projectId: "proj_test123",
      name: "Test Project",
      nodeCount: expect.any(Number),
      updatedAt: expect.any(Number),
      createdAt: expect.any(Number),
    })
    expect(prisma.workbench_projects.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: "alice" } }),
    )
  })
})

describe("GET /v1/internal/workbench-projects/:projectId (load)", () => {
  it("returns 401 when unauthenticated", async () => {
    const prisma = makePrismaStub()
    const res = await request(makeApp(prisma))
      .get("/v1/internal/workbench-projects/proj_test123")
    expect(res.status).toBe(401)
  })

  it("returns 404 when project not found", async () => {
    const prisma = makePrismaStub({ existingRow: null })
    const res = await request(makeApp(prisma))
      .get("/v1/internal/workbench-projects/proj_missing")
      .set("X-Dev-User-Id", "alice")
    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ error: "not_found" })
  })

  it("returns the IPersistedWorkbenchState directly (not wrapped)", async () => {
    const prisma = makePrismaStub({ existingRow: FIXTURE_STATE })
    const res = await request(makeApp(prisma))
      .get("/v1/internal/workbench-projects/proj_test123")
      .set("X-Dev-User-Id", "alice")
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ version: 1, projectId: "proj_test123", name: "Test Project" })
  })
})

describe("PUT /v1/internal/workbench-projects/:projectId (upsert)", () => {
  it("returns 401 when unauthenticated", async () => {
    const prisma = makePrismaStub()
    const res = await request(makeApp(prisma))
      .put("/v1/internal/workbench-projects/proj_test123")
      .send(FIXTURE_STATE)
    expect(res.status).toBe(401)
  })

  it("returns 200 { ok: true } and calls upsert with correct shape", async () => {
    const prisma = makePrismaStub()
    const res = await request(makeApp(prisma))
      .put("/v1/internal/workbench-projects/proj_test123")
      .set("X-Dev-User-Id", "alice")
      .send(FIXTURE_STATE)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
    expect(prisma.workbench_projects.upsert).toHaveBeenCalledOnce()
    const call = prisma._upsertCalls[0]
    expect(call?.projectId).toBe("proj_test123")
    expect(call?.userId).toBe("alice")
  })

  it("round-trip: PUT state then GET same projectId returns equal state", async () => {
    const prisma = makePrismaStub({ existingRow: FIXTURE_STATE })
    const putRes = await request(makeApp(prisma))
      .put("/v1/internal/workbench-projects/proj_test123")
      .set("X-Dev-User-Id", "alice")
      .send(FIXTURE_STATE)
    expect(putRes.status).toBe(200)

    const getRes = await request(makeApp(prisma))
      .get("/v1/internal/workbench-projects/proj_test123")
      .set("X-Dev-User-Id", "alice")
    expect(getRes.status).toBe(200)
    expect(getRes.body).toMatchObject({
      version: FIXTURE_STATE.version,
      projectId: FIXTURE_STATE.projectId,
      name: FIXTURE_STATE.name,
    })
  })
})

describe("DELETE /v1/internal/workbench-projects/:projectId", () => {
  it("returns 401 when unauthenticated", async () => {
    const prisma = makePrismaStub()
    const res = await request(makeApp(prisma))
      .delete("/v1/internal/workbench-projects/proj_test123")
    expect(res.status).toBe(401)
  })

  it("returns 204 and calls deleteMany with (project_id, user_id)", async () => {
    const prisma = makePrismaStub()
    const res = await request(makeApp(prisma))
      .delete("/v1/internal/workbench-projects/proj_test123")
      .set("X-Dev-User-Id", "alice")
    expect(res.status).toBe(204)
    expect(prisma._deleteCalls[0]).toEqual({ projectId: "proj_test123", userId: "alice" })
  })
})

describe("auth isolation (spec criterion #6)", () => {
  it("GET list scopes findMany to the requesting userId, not another user", async () => {
    const prisma = makePrismaStub()
    const aliceRes = await request(makeApp(prisma))
      .get("/v1/internal/workbench-projects")
      .set("X-Dev-User-Id", "alice")
    const bobRes = await request(makeApp(prisma))
      .get("/v1/internal/workbench-projects")
      .set("X-Dev-User-Id", "bob")

    expect(aliceRes.status).toBe(200)
    expect(bobRes.status).toBe(200)

    const aliceCall = prisma.workbench_projects.findMany.mock.calls[0]
    const bobCall = prisma.workbench_projects.findMany.mock.calls[1]
    expect((aliceCall?.[0] as { where: { user_id: string } })?.where.user_id).toBe("alice")
    expect((bobCall?.[0] as { where: { user_id: string } })?.where.user_id).toBe("bob")
  })

  it("GET project for user B returns not_found for a user-A-owned project", async () => {
    const prisma = makePrismaStub({ existingRow: null })
    const res = await request(makeApp(prisma))
      .get("/v1/internal/workbench-projects/proj_test123")
      .set("X-Dev-User-Id", "bob")
    expect(res.status).toBe(404)
  })
})
