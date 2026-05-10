import type { NextFunction, Request, Response } from "express"
import "./request-augmentation.js"

/**
 * Gate for CRUD routes. Requires the incoming request to have been
 * authenticated by `apiKeyMiddleware` with a key whose `tier` column
 * is exactly "write". All other tiers (free, keyed, web, anon) return 403.
 *
 * Spec 021 §Writes. Keep strict — never upgrade an unknown tier string.
 */
export function requireWriteTier() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.apiKeyTier !== "write") {
      res.status(403).json({
        error: "write_tier_required",
        detail:
          "This endpoint requires an API key with tier='write'. Pass a valid key via the x-api-key header.",
      })
      return
    }
    next()
  }
}
