import type { NextFunction, Request, Response } from "express"
import type { TokenBucket } from "./token-bucket.js"
import "./request-augmentation.js"

export interface IRateLimitOptions {
  bucket: TokenBucket
}

export function rateLimitMiddleware(options: IRateLimitOptions) {
  const { bucket } = options

  return (req: Request, res: Response, next: NextFunction): void => {
    const hasKey = typeof req.header("x-api-key") === "string"
    const tier: "anon" | "keyed" = hasKey ? "keyed" : "anon"
    const key = req.ip ?? "unknown"

    if (bucket.take(key, tier)) {
      req.tier = tier
      next()
      return
    }

    res.status(429).json({ error: "rate_limit", tier })
  }
}
