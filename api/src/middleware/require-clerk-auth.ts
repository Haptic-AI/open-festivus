import type { NextFunction, Request, Response } from "express"
import { verifyToken } from "@clerk/backend"
import "./request-augmentation.js"

/**
 * Narrow view of the PrismaClient surface this middleware needs. Lets tests
 * inject a stub without pulling in the full client generic.
 */
export interface IUserUpserter {
  users: {
    upsert: (args: {
      where: { clerk_user_id: string }
      create: { clerk_user_id: string; email?: string | null }
      update: { email?: string | null }
    }) => Promise<{ id: string; clerk_user_id: string; email: string | null }>
  }
}

/**
 * Middleware for user-owned routes (spec 028). Verifies the Clerk session JWT
 * forwarded by apps/web, upserts a canonical `users` row keyed on the Clerk
 * user id (spec 029), and attaches both `req.clerkUserId` and `req.user`.
 *
 * In production (CLERK_SECRET_KEY present): verifies the Bearer token in the
 * Authorization header and extracts the userId from the sub claim.
 *
 * In dev (CLERK_SECRET_KEY absent, NODE_ENV !== "production"): trusts the
 * X-Dev-User-Id header forwarded by apps/web when Clerk is not configured.
 * This escape hatch is intentionally blocked in production.
 *
 * Spec 029: every authenticated write must have an attributable `users.id`.
 * Upsert-on-first-sight keeps the write path simple — no separate onboarding.
 */
export function requireClerkAuth(deps: { prisma: IUserUpserter }) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const secretKey = process.env["CLERK_SECRET_KEY"]

    let clerkUserId: string | undefined
    let email: string | null = null

    if (!secretKey) {
      if (process.env["NODE_ENV"] === "production") {
        res.status(500).json({ error: "CLERK_SECRET_KEY not configured" })
        return
      }
      const devUserId = req.headers["x-dev-user-id"]
      if (typeof devUserId === "string" && devUserId.trim()) {
        clerkUserId = devUserId.trim()
      } else {
        res.status(401).json({ error: "unauthorized" })
        return
      }
    } else {
      const authHeader = req.headers["authorization"]
      if (!authHeader?.startsWith("Bearer ")) {
        res.status(401).json({ error: "unauthorized", detail: "Bearer token required" })
        return
      }
      try {
        const payload = await verifyToken(authHeader.slice(7), { secretKey })
        clerkUserId = payload.sub
        const claimEmail = (payload as { email?: unknown })["email"]
        if (typeof claimEmail === "string") email = claimEmail
      } catch {
        res.status(401).json({ error: "unauthorized", detail: "Invalid or expired token" })
        return
      }
    }

    if (!clerkUserId) {
      res.status(401).json({ error: "unauthorized" })
      return
    }

    req.clerkUserId = clerkUserId

    try {
      const userRow = await deps.prisma.users.upsert({
        where: { clerk_user_id: clerkUserId },
        create: { clerk_user_id: clerkUserId, email },
        update: email ? { email } : {},
      })
      req.user = {
        id: userRow.id,
        clerk_user_id: userRow.clerk_user_id,
        email: userRow.email,
      }
      next()
    } catch (err) {
      next(err)
    }
  }
}
