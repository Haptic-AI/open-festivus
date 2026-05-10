import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { isProtectedPage } from "./middleware"

function req(path: string): NextRequest {
  return new NextRequest(new URL(`https://festivus.hapticlabs.ai${path}`))
}

describe("middleware route classification", () => {
  it("classifies /settings/* as page-protected", () => {
    expect(isProtectedPage(req("/settings"))).toBe(true)
    expect(isProtectedPage(req("/settings/api-keys"))).toBe(true)
    expect(isProtectedPage(req("/settings/profile"))).toBe(true)
  })

  it("does NOT page-protect API routes", () => {
    // API auth happens in the route handler via getRequestUser(). Putting
    // /api/* under a Clerk page matcher caused a 404 rewrite that Vercel
    // cached for 17h, then made middleware-bound `auth()` return null for
    // signed-in users — both blocking /settings/api-keys mint.
    expect(isProtectedPage(req("/api/api-keys"))).toBe(false)
    expect(isProtectedPage(req("/api/api-keys/42"))).toBe(false)
    expect(isProtectedPage(req("/api/workbench/projects"))).toBe(false)
    expect(isProtectedPage(req("/api/workbench/projects/abc"))).toBe(false)
    expect(isProtectedPage(req("/api/agent"))).toBe(false)
  })

  it("leaves the homepage and other public pages alone", () => {
    expect(isProtectedPage(req("/"))).toBe(false)
    expect(isProtectedPage(req("/data/robots/franka-research-3"))).toBe(false)
    expect(isProtectedPage(req("/contribute"))).toBe(false)
  })
})
