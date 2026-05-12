import { Router } from "express"

const MESSAGE =
  "The /v1/ask endpoint is intentionally unavailable. Agent question-answering lives in apps/web/src/app/api/agent. See specs/015 §Non-goals."

export function buildAsk404Router(): Router {
  const router = Router()
  router.all("/", (_req, res) => {
    res.status(404).json({ error: "moved", message: MESSAGE })
  })
  return router
}
