import type { NextFunction, Request, Response } from "express"
import type { IRepository } from "../repo/types.js"
import "./request-augmentation.js"

/**
 * Spec 027 phase 3. Caps writes per user.
 *
 * Runs after apiKeyMiddleware and requireWriteTier. The apiKeyUserId on the
 * request lets us count across every key the user has minted in the last
 * N hours. 429 when over the cap; the response names the window so the
 * caller can back off sensibly.
 *
 * Safe-by-default: if user_id is missing (misconfigured middleware) we
 * refuse the request rather than silently passing.
 */

export interface IRateLimitWritesOptions {
  repo: IRepository
  windowHours?: number
  maxWrites?: number
}

export function rateLimitWritesMiddleware(options: IRateLimitWritesOptions) {
  const windowHours = options.windowHours ?? 24
  const maxWrites = options.maxWrites ?? 200

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Spec 029: count by the end user's Clerk id. On the chat path the
    // caller is the moderator key (shared across all users), so falling
    // back to req.apiKeyUserId would dump every chat user into one
    // bucket. req.user.clerk_user_id is populated by apiKeyMiddleware's
    // on-behalf-of branch.
    const userId = req.user?.clerk_user_id ?? req.apiKeyUserId
    if (!userId) {
      res.status(500).json({
        error: "rate_limit_misconfigured",
        detail: "apiKeyUserId missing on request. apiKeyMiddleware must run before this.",
      })
      return
    }

    try {
      const count = await options.repo.countMutationsByUserSince(userId, windowHours)
      if (count >= maxWrites) {
        res.status(429).json({
          error: "rate_limited",
          detail: `Write cap reached: ${maxWrites} writes per ${windowHours}h per user. You have ${count} in the last ${windowHours} hours.`,
          retry_after_hours: windowHours,
          limit: maxWrites,
          used: count,
        })
        return
      }
      next()
    } catch (err) {
      next(err)
    }
  }
}
