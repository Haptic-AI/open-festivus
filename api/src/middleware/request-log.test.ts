import express from "express"
import request from "supertest"
import { describe, expect, it } from "vitest"
import { type IRequestLogLine, requestLogMiddleware } from "./request-log.js"

describe("request-log middleware", () => {
  it("emits one structured line per request with all five fields", async () => {
    const lines: IRequestLogLine[] = []
    const app = express()
    app.use((req, _res, next) => {
      req.tier = "anon"
      next()
    })
    app.use(requestLogMiddleware({ log: (line) => lines.push(line) }))
    app.get("/ping", (_req, res) => {
      res.status(200).json({ ok: true })
    })

    const res = await request(app).get("/ping?foo=1")
    expect(res.status).toBe(200)
    expect(lines).toHaveLength(1)
    const line = lines[0]
    expect(line).toBeDefined()
    expect(line?.method).toBe("GET")
    expect(line?.path).toContain("/ping")
    expect(line?.status).toBe(200)
    expect(line?.tier).toBe("anon")
    expect(typeof line?.duration_ms).toBe("number")
  })

  it("falls back to tier=unknown when not set", async () => {
    const lines: IRequestLogLine[] = []
    const app = express()
    app.use(requestLogMiddleware({ log: (line) => lines.push(line) }))
    app.get("/ping", (_req, res) => {
      res.status(200).json({ ok: true })
    })
    await request(app).get("/ping")
    expect(lines[0]?.tier).toBe("unknown")
  })
})
