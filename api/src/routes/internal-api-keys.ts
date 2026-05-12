import { createHash, randomBytes } from "node:crypto"
import { Router } from "express"
import { PrismaClient } from "@prisma/client"
import { requireWriteTier } from "../middleware/require-write-tier.js"

/**
 * Spec 027 phase 1+. CRUD surface for `api_keys` rows, owned by the API
 * (the only writer to Supabase per the spec). `apps/web` stops talking to
 * Postgres directly and forwards here with FESTIVUS_MODERATOR_KEY.
 *
 * The plaintext is generated here, returned once, and never stored.
 * Hash-on-storage, never-on-wire (G10 carry-over).
 *
 * Routes (all require x-api-key with tier='write'):
 *
 *   GET    /v1/internal/api-keys?user_id=X   — list X's keys (never key_hash)
 *   POST   /v1/internal/api-keys              — mint a new key; body {user_id, name?, tier}
 *   DELETE /v1/internal/api-keys/:id?user_id=X — revoke; cascades pending mutations
 *
 * All routes scope by user_id so the caller (apps/web, Clerk-verified) can
 * only act on its own user's rows, even with the shared moderator key.
 */

const KEY_PREFIX = "fek_"

function sha256(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex")
}

function generatePlaintext(): string {
  return KEY_PREFIX + randomBytes(16).toString("hex")
}

interface IListRow {
  id: number
  name: string | null
  tier: string
  owner_email: string | null
  created_at: Date
  last_used_at: Date | null
  revoked_at: Date | null
}

function toWire(r: IListRow) {
  return {
    id: r.id,
    name: r.name,
    tier: r.tier,
    owner_email: r.owner_email,
    created_at: r.created_at.toISOString(),
    last_used_at: r.last_used_at ? r.last_used_at.toISOString() : null,
    revoked_at: r.revoked_at ? r.revoked_at.toISOString() : null,
  }
}

export function buildInternalApiKeysRouter(prisma: PrismaClient): Router {
  const router = Router()

  router.use(requireWriteTier())

  router.get("/", async (req, res, next) => {
    try {
      const userId = String(req.query["user_id"] ?? "").trim()
      if (!userId) {
        res.status(400).json({ error: "missing_user_id" })
        return
      }
      const rows = await prisma.api_keys.findMany({
        where: { user_id: userId },
        select: {
          id: true,
          name: true,
          tier: true,
          owner_email: true,
          created_at: true,
          last_used_at: true,
          revoked_at: true,
        },
        orderBy: { created_at: "desc" },
      })
      res.json({ keys: rows.map(toWire) })
    } catch (err) {
      next(err)
    }
  })

  router.post("/", async (req, res, next) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>
      const userId = typeof body["user_id"] === "string" ? body["user_id"].trim() : ""
      const name = typeof body["name"] === "string" && body["name"].trim().length > 0
        ? body["name"].trim().slice(0, 64)
        : null
      const tierRaw = typeof body["tier"] === "string" ? body["tier"] : undefined
      const tier = tierRaw === "write" || tierRaw === "keyed" ? tierRaw : undefined
      const ownerEmail = typeof body["owner_email"] === "string" && body["owner_email"].trim().length > 0
        ? body["owner_email"].trim().slice(0, 320)
        : null

      if (!userId) {
        res.status(400).json({ error: "missing_user_id" })
        return
      }

      const plaintext = generatePlaintext()
      const keyHash = sha256(plaintext)

      // Spec 029: canonicalise the user in `users` on mint so api_keys.owner_id
      // points at a real row. Pre-spec keys stay owner_id=NULL until the
      // Step 1.5 backfill catches up.
      const userRow = await prisma.users.upsert({
        where: { clerk_user_id: userId },
        create: { clerk_user_id: userId, email: ownerEmail },
        update: ownerEmail ? { email: ownerEmail } : {},
        select: { id: true },
      })

      const row = await prisma.api_keys.create({
        data: {
          user_id: userId,
          key_hash: keyHash,
          name,
          owner_email: ownerEmail,
          owner_id: userRow.id,
          ...(tier ? { tier } : {}),
        },
        select: { id: true, name: true, tier: true, owner_email: true, created_at: true },
      })

      res.status(201).json({
        key: {
          id: row.id,
          name: row.name,
          tier: row.tier,
          owner_email: row.owner_email,
          plaintext,
          created_at: row.created_at.toISOString(),
        },
      })
    } catch (err) {
      next(err)
    }
  })

  router.delete("/:id", async (req, res, next) => {
    try {
      const id = Number.parseInt(String(req.params["id"] ?? ""), 10)
      const userId = String(req.query["user_id"] ?? "").trim()
      if (!Number.isFinite(id)) {
        res.status(400).json({ error: "invalid_id" })
        return
      }
      if (!userId) {
        res.status(400).json({ error: "missing_user_id" })
        return
      }

      // Revoke scoped to user_id + not-already-revoked. Returns the row so
      // we can cascade with the right id (prisma's updateMany returns a
      // count only, not the row).
      const match = await prisma.api_keys.findFirst({
        where: { id, user_id: userId, revoked_at: null },
        select: { id: true },
      })
      if (!match) {
        res.status(404).json({ error: "not_found" })
        return
      }
      await prisma.api_keys.update({
        where: { id: match.id },
        data: { revoked_at: new Date() },
      })

      // Spec 027 phase 9 cascade: any pending mutations from this key are
      // auto-rejected. actor_id on mutations stores api_keys.id as text.
      await prisma.mutations.updateMany({
        where: { actor_id: String(match.id), status: "pending_review" },
        data: {
          status: "rejected",
          reviewed_by: "system:key-revoked",
          reviewed_at: new Date(),
          review_note: "Auto-rejected: key was revoked",
        },
      })

      res.json({ revoked: true })
    } catch (err) {
      next(err)
    }
  })

  return router
}
