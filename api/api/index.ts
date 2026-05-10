// Vercel serverless entrypoint for the Festivus public API.
//
// This is a THIN wrapper around `createServer` from `src/server.ts`. Invariant #3
// of spec 016 says "local `pnpm dev` and Vercel run the identical Express app" —
// so any logic that belongs in the server lives in `src/`, not here.
//
// Module-scope memoization: Vercel reuses warm Node function instances, so the
// first invocation builds the Express app and the bucket, and subsequent warm
// invocations reuse them. On a cold start, everything is rebuilt (G4 — the
// token bucket resets on every cold start, which is the documented cost of the
// in-process rate-limiter choice).

import type { IncomingMessage, ServerResponse } from "node:http"
import { PrismaClient } from "@prisma/client"
import { environments } from "../src/db/environments-data.js"
import { getPool } from "../src/db/pool.js"
import { PrismaRepo } from "../src/repo/prisma.js"
import { createServer } from "../src/server.js"

type VercelHandler = (req: IncomingMessage, res: ServerResponse) => void

let cachedApp: VercelHandler | null = null

function buildApp(): VercelHandler {
  const prisma = new PrismaClient()
  const repo = new PrismaRepo(prisma, environments)
  const pool = getPool()
  const app = createServer(repo, {
    db: pool,
  })
  return app as unknown as VercelHandler
}

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  if (!cachedApp) {
    cachedApp = buildApp()
  }
  cachedApp(req, res)
}
