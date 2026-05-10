import { Router } from "express"
import { Prisma, PrismaClient } from "@prisma/client"
import { requireClerkAuth } from "../middleware/require-clerk-auth.js"

/**
 * Spec 028. CRUD surface for `workbench_projects` rows.
 *
 * All routes are authenticated by requireClerkAuth() — the Clerk session JWT
 * is forwarded by apps/web. userId comes from the verified JWT (req.clerkUserId),
 * never from a query parameter, so users can only access their own rows.
 *
 * Routes:
 *   GET    /v1/internal/workbench-projects           — list summaries for caller
 *   GET    /v1/internal/workbench-projects/:id       — load full state
 *   PUT    /v1/internal/workbench-projects/:id       — upsert full state
 *   DELETE /v1/internal/workbench-projects/:id       — delete
 */

export function buildWorkbenchProjectsRouter(prisma: PrismaClient): Router {
  const router = Router()

  router.use(requireClerkAuth({ prisma }))

  // GET /  — list summaries for the authenticated user, sorted by updated_at DESC
  router.get("/", async (req, res, next) => {
    try {
      const userId = req.clerkUserId!
      const rows = await prisma.workbench_projects.findMany({
        where: { user_id: userId },
        select: {
          project_id: true,
          name: true,
          data: true,
          updated_at: true,
          created_at: true,
        },
        orderBy: { updated_at: "desc" },
      })
      const summaries = rows.map((r) => {
        const data = r.data as Record<string, unknown>
        return {
          projectId: r.project_id,
          name: r.name,
          nodeCount: Array.isArray(data["canvasNodes"]) ? (data["canvasNodes"] as unknown[]).length : 0,
          updatedAt: r.updated_at.getTime(),
          createdAt: r.created_at.getTime(),
        }
      })
      res.json(summaries)
    } catch (err) {
      next(err)
    }
  })

  // GET /:projectId  — load full state for (project_id, user_id)
  router.get("/:projectId", async (req, res, next) => {
    try {
      const projectId = String(req.params["projectId"] ?? "").trim()
      if (!projectId) {
        res.status(400).json({ error: "missing_project_id" })
        return
      }
      const userId = req.clerkUserId!
      const row = await prisma.workbench_projects.findFirst({
        where: { project_id: projectId, user_id: userId },
        select: { data: true },
      })
      if (!row) {
        res.status(404).json({ error: "not_found" })
        return
      }
      res.json(row.data)
    } catch (err) {
      next(err)
    }
  })

  // PUT /:projectId  — upsert full state; body is IPersistedWorkbenchState
  router.put("/:projectId", async (req, res, next) => {
    try {
      const projectId = String(req.params["projectId"] ?? "").trim()
      if (!projectId) {
        res.status(400).json({ error: "missing_project_id" })
        return
      }
      const userId = req.clerkUserId!
      const body = req.body as Record<string, unknown>
      if (!body || typeof body !== "object") {
        res.status(400).json({ error: "invalid_body" })
        return
      }
      const name = typeof body["name"] === "string" && body["name"].trim().length > 0
        ? body["name"].trim().slice(0, 255)
        : projectId
      const jsonBody = body as unknown as Prisma.InputJsonValue
      await prisma.workbench_projects.upsert({
        where: { project_id_user_id: { project_id: projectId, user_id: userId } },
        create: { project_id: projectId, user_id: userId, name, data: jsonBody },
        update: { name, data: jsonBody, updated_at: new Date() },
      })
      res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  })

  // DELETE /:projectId  — remove row for (project_id, user_id), 204
  router.delete("/:projectId", async (req, res, next) => {
    try {
      const projectId = String(req.params["projectId"] ?? "").trim()
      if (!projectId) {
        res.status(400).json({ error: "missing_project_id" })
        return
      }
      const userId = req.clerkUserId!
      await prisma.workbench_projects.deleteMany({
        where: { project_id: projectId, user_id: userId },
      })
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  })

  return router
}
