import { beforeEach, describe, expect, it, vi } from "vitest"

const mockGetRequestUser = vi.fn()
vi.mock("@/lib/auth", () => ({
  getRequestUser: mockGetRequestUser,
}))

const mockRevokeKeyFor = vi.fn()
vi.mock("@/lib/api-keys-forwarder", () => ({
  revokeKeyFor: mockRevokeKeyFor,
}))

describe("DELETE /api/api-keys/[id]", () => {
  beforeEach(() => {
    mockGetRequestUser.mockReset()
    mockRevokeKeyFor.mockReset()
  })

  it("returns 401 when unauthenticated", async () => {
    mockGetRequestUser.mockResolvedValue(null)
    const mod = await import("./route")
    const res = await mod.DELETE(new Request("http://local/api/api-keys/42"), {
      params: Promise.resolve({ id: "42" }),
    })
    expect(res.status).toBe(401)
    expect(mockRevokeKeyFor).not.toHaveBeenCalled()
  })

  it("returns 400 on non-numeric id", async () => {
    mockGetRequestUser.mockResolvedValue({ id: "user_abc", email: null, name: null, imageUrl: null })
    const mod = await import("./route")
    const res = await mod.DELETE(new Request("http://local/api/api-keys/abc"), {
      params: Promise.resolve({ id: "abc" }),
    })
    expect(res.status).toBe(400)
  })

  it("returns 404 when the forwarder reports not_found", async () => {
    mockGetRequestUser.mockResolvedValue({ id: "user_abc", email: null, name: null, imageUrl: null })
    mockRevokeKeyFor.mockResolvedValue(false)
    const mod = await import("./route")
    const res = await mod.DELETE(new Request("http://local/api/api-keys/42"), {
      params: Promise.resolve({ id: "42" }),
    })
    expect(res.status).toBe(404)
  })

  it("returns 200 with revoked=true on success and scopes to the caller", async () => {
    mockGetRequestUser.mockResolvedValue({ id: "user_abc", email: null, name: null, imageUrl: null })
    mockRevokeKeyFor.mockResolvedValue(true)
    const mod = await import("./route")
    const res = await mod.DELETE(new Request("http://local/api/api-keys/42"), {
      params: Promise.resolve({ id: "42" }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ revoked: true })
    expect(mockRevokeKeyFor).toHaveBeenCalledWith("user_abc", 42)
  })

  it("502s when the forwarder throws", async () => {
    mockGetRequestUser.mockResolvedValue({ id: "user_abc", email: null, name: null, imageUrl: null })
    mockRevokeKeyFor.mockRejectedValue(new Error("upstream 500"))
    const mod = await import("./route")
    const res = await mod.DELETE(new Request("http://local/api/api-keys/42"), {
      params: Promise.resolve({ id: "42" }),
    })
    expect(res.status).toBe(502)
  })
})
