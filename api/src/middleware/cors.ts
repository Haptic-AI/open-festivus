import type { NextFunction, Request, Response } from "express"

// Browsers calling this API directly (e.g. `festivus.hapticlabs.ai/data` loads
// stats client-side) need CORS. curl, SSR, and server-to-server traffic do
// not — they're unaffected by this middleware.
//
// The allow-list is intentionally narrow. Writes (`/v1/write/*`) travel the
// same path, so a browser on an allowed origin with a `write`-tier API key
// can mutate data — CORS is not the auth gate, `require-write-tier.ts` is.
//
// Previews: Vercel assigns `*.vercel.app` URLs. We match the pattern rather
// than try to maintain a list of individual preview URLs.

const ALLOWED_ORIGINS: readonly string[] = [
  "https://festivus.hapticlabs.ai",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]

const PREVIEW_ORIGIN_PATTERN = /^https:\/\/[a-z0-9-]+\.vercel\.app$/

const ALLOWED_METHODS = "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS"
const ALLOWED_HEADERS = "Content-Type, X-API-Key"
const PREFLIGHT_MAX_AGE_SECONDS = "86400"

export function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true
  return PREVIEW_ORIGIN_PATTERN.test(origin)
}

export function corsMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.header("origin")
    if (origin !== undefined && isAllowedOrigin(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin)
      res.setHeader("Vary", "Origin")
      res.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS)
      res.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS)
      res.setHeader("Access-Control-Max-Age", PREFLIGHT_MAX_AGE_SECONDS)
    }

    if (req.method === "OPTIONS") {
      res.status(204).end()
      return
    }

    next()
  }
}
