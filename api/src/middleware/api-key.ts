import { createHash } from "node:crypto"
import type { NextFunction, Request, Response } from "express"
import "./request-augmentation.js"

export interface IQueryable {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
}

export interface IApiKeyRow {
  id: number
  user_id: string
  revoked_at: string | null
  tier: string
  owner_email: string | null
  owner_id: string | null
}

export interface IApiKeyMiddlewareOptions {
  db: IQueryable
  // Injectable for tests. Defaults to console.warn.
  onAsyncError?: (err: unknown) => void
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex")
}

export function apiKeyMiddleware(options: IApiKeyMiddlewareOptions) {
  const { db } = options
  const onAsyncError =
    options.onAsyncError ?? ((err) => console.warn("api-key: async last_used_at update failed", err))

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const plaintext = req.header("x-api-key")
    if (!plaintext) {
      // No key → anon tier (already set by rate-limit). Continue.
      next()
      return
    }

    const keyHash = hashApiKey(plaintext)
    let row: IApiKeyRow | undefined
    try {
      const result = await db.query<IApiKeyRow>(
        "SELECT id, user_id, revoked_at, tier, owner_email, owner_id FROM api_keys WHERE key_hash = $1",
        [keyHash],
      )
      row = result.rows[0]
    } catch (err) {
      // DB error: treat as 500 so ops sees it; do not silently downgrade to anon.
      next(err)
      return
    }

    if (!row || row.revoked_at !== null) {
      res.status(401).json({ error: "invalid_key" })
      return
    }

    req.tier = "keyed"
    req.apiKeyId = row.id
    req.apiKeyTier = row.tier
    req.apiKeyUserId = row.user_id
    req.apiKeyOwnerEmail = row.owner_email
    req.apiKeyOwnerId = row.owner_id

    // Spec 029: when the moderator forwarder calls on behalf of an end user
    // (agent-chat flow), X-On-Behalf-Of-User-Id carries the target Clerk id.
    // We look up the target user's canonical id and swap it into
    // req.apiKeyOwnerId so the downstream write handler stamps attribution to
    // the user, not the moderator. actor_id stays the moderator's key id so
    // the audit trail still records "moderator-forwarded on behalf of X".
    const onBehalfOf = req.header("x-on-behalf-of-user-id")
    if (onBehalfOf && row.user_id === "festivus-moderator-web") {
      try {
        const lookup = await db.query<{ id: string; clerk_user_id: string; email: string | null }>(
          "SELECT id, clerk_user_id, email FROM users WHERE clerk_user_id = $1",
          [onBehalfOf],
        )
        const target = lookup.rows[0]
        if (!target) {
          res.status(401).json({ error: "unknown_on_behalf_of_user", clerk_user_id: onBehalfOf })
          return
        }
        req.apiKeyOwnerId = target.id
        req.user = {
          id: target.id,
          clerk_user_id: target.clerk_user_id,
          email: target.email,
        }
      } catch (err) {
        next(err)
        return
      }
    }

    // Best-effort async update — does not block the response, swallows errors.
    void db
      .query("UPDATE api_keys SET last_used_at = now() WHERE id = $1", [row.id])
      .catch(onAsyncError)

    next()
  }
}
