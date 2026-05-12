import express from "express"
import request from "supertest"
import { describe, expect, it } from "vitest"
import { corsMiddleware, isAllowedOrigin } from "./cors.js"

function buildApp(): express.Express {
  const app = express()
  app.use(corsMiddleware())
  app.get("/ping", (_req, res) => {
    res.json({ ok: true })
  })
  app.post("/v1/write/robots", (_req, res) => {
    res.json({ ok: true })
  })
  return app
}

describe("isAllowedOrigin", () => {
  it("accepts the prod origin", () => {
    expect(isAllowedOrigin("https://festivus.hapticlabs.ai")).toBe(true)
  })

  it("accepts localhost dev origins", () => {
    expect(isAllowedOrigin("http://localhost:3000")).toBe(true)
    expect(isAllowedOrigin("http://127.0.0.1:3000")).toBe(true)
  })

  it("accepts vercel preview origins", () => {
    expect(isAllowedOrigin("https://festivus-abc123.vercel.app")).toBe(true)
    expect(isAllowedOrigin("https://festivus-git-feature-team.vercel.app")).toBe(true)
  })

  it("rejects other origins", () => {
    expect(isAllowedOrigin("https://evil.example.com")).toBe(false)
    expect(isAllowedOrigin("http://festivus.hapticlabs.ai")).toBe(false)
    expect(isAllowedOrigin("https://festivus.hapticlabs.ai.evil.com")).toBe(false)
  })

  it("rejects http vercel.app (must be https)", () => {
    expect(isAllowedOrigin("http://preview.vercel.app")).toBe(false)
  })
})

describe("cors middleware", () => {
  it("echoes the origin on allowed GET requests", async () => {
    const app = buildApp()
    const res = await request(app).get("/ping").set("Origin", "https://festivus.hapticlabs.ai")
    expect(res.status).toBe(200)
    expect(res.headers["access-control-allow-origin"]).toBe("https://festivus.hapticlabs.ai")
    expect(res.headers["vary"]).toContain("Origin")
  })

  it("omits ACAO on disallowed origins", async () => {
    const app = buildApp()
    const res = await request(app).get("/ping").set("Origin", "https://evil.example.com")
    expect(res.status).toBe(200)
    expect(res.headers["access-control-allow-origin"]).toBeUndefined()
  })

  it("responds 204 to OPTIONS preflight with allow headers for allowed origins", async () => {
    const app = buildApp()
    const res = await request(app)
      .options("/v1/write/robots")
      .set("Origin", "https://festivus.hapticlabs.ai")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type, x-api-key")
    expect(res.status).toBe(204)
    expect(res.headers["access-control-allow-origin"]).toBe("https://festivus.hapticlabs.ai")
    expect(res.headers["access-control-allow-methods"]).toContain("POST")
    expect(res.headers["access-control-allow-headers"]).toContain("X-API-Key")
  })

  it("responds 204 to OPTIONS preflight even from disallowed origins (no ACAO header — browser will block)", async () => {
    const app = buildApp()
    const res = await request(app).options("/ping").set("Origin", "https://evil.example.com")
    expect(res.status).toBe(204)
    expect(res.headers["access-control-allow-origin"]).toBeUndefined()
  })

  it("passes through requests with no Origin header untouched", async () => {
    const app = buildApp()
    const res = await request(app).get("/ping")
    expect(res.status).toBe(200)
    expect(res.headers["access-control-allow-origin"]).toBeUndefined()
    expect(res.body).toEqual({ ok: true })
  })
})
