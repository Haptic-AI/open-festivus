import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// getRequestUser mocked at the module boundary — Clerk auth can't run
// outside a real Next.js request context.
const mockGetRequestUser = vi.fn()
vi.mock("@/lib/auth", () => ({
  getRequestUser: mockGetRequestUser,
}))

// Spec 027 phase B: /api/api-keys no longer hits Postgres. It forwards to
// the Express API via api-keys-forwarder. Mock the forwarder so tests stay
// hermetic and we can assert the handler's wiring.
const mockListKeysFor = vi.fn()
const mockCreateKeyFor = vi.fn()
vi.mock("@/lib/api-keys-forwarder", () => ({
  listKeysFor: mockListKeysFor,
  createKeyFor: mockCreateKeyFor,
}))

describe("/api/api-keys route handlers (G8 explicit auth per handler)", () => {
  beforeEach(() => {
    mockGetRequestUser.mockReset()
    mockListKeysFor.mockReset()
    mockCreateKeyFor.mockReset()
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe("GET /api/api-keys", () => {
    it("returns 401 + cache-control: no-store when getRequestUser returns null", async () => {
      // The cache-control matters: on a prior incident an upstream Clerk
      // middleware rewrote anon to /404 and Vercel cached that for 17h,
      // serving stale 404s to signed-in users. Pinning no-store here is
      // belt-and-suspenders even though dynamic route handlers aren't
      // cached by default.
      mockGetRequestUser.mockResolvedValue(null)
      const mod = await import("./route")
      const res = await mod.GET()
      expect(res.status).toBe(401)
      expect(res.headers.get("cache-control")).toBe("no-store")
      expect(mockListKeysFor).not.toHaveBeenCalled()
    })

    it("returns the user's keys when authenticated", async () => {
      mockGetRequestUser.mockResolvedValue({
        id: "user_abc",
        email: null,
        name: null,
        imageUrl: null,
      })
      mockListKeysFor.mockResolvedValue([
        {
          id: 1,
          name: "prod",
          tier: "free",
          created_at: "2026-04-13T00:00:00Z",
          last_used_at: null,
          revoked_at: null,
        },
      ])
      const mod = await import("./route")
      const res = await mod.GET()
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.keys).toHaveLength(1)
      expect(mockListKeysFor).toHaveBeenCalledWith("user_abc")
    })

    it("returns 502 when the forwarder throws (upstream down)", async () => {
      mockGetRequestUser.mockResolvedValue({
        id: "user_abc",
        email: null,
        name: null,
        imageUrl: null,
      })
      mockListKeysFor.mockRejectedValue(new Error("upstream 500"))
      const mod = await import("./route")
      const res = await mod.GET()
      expect(res.status).toBe(502)
    })
  })

  describe("POST /api/api-keys", () => {
    it("returns 401 + cache-control: no-store when getRequestUser returns null", async () => {
      mockGetRequestUser.mockResolvedValue(null)
      const mod = await import("./route")
      const res = await mod.POST(new Request("https://x.test/api/api-keys", {
        method: "POST",
        body: JSON.stringify({ tier: "keyed" }),
      }))
      expect(res.status).toBe(401)
      expect(res.headers.get("cache-control")).toBe("no-store")
      expect(mockCreateKeyFor).not.toHaveBeenCalled()
    })


    it("returns 401 when unauthenticated", async () => {
      mockGetRequestUser.mockResolvedValue(null)
      const mod = await import("./route")
      const res = await mod.POST(
        new Request("http://local/api/api-keys", { method: "POST", body: "{}" }),
      )
      expect(res.status).toBe(401)
      expect(mockCreateKeyFor).not.toHaveBeenCalled()
    })

    it("creates a key and returns the plaintext exactly once (G10)", async () => {
      mockGetRequestUser.mockResolvedValue({
        id: "user_abc",
        email: null,
        name: null,
        imageUrl: null,
      })
      mockCreateKeyFor.mockResolvedValue({
        id: 9,
        name: "ci",
        tier: "keyed",
        plaintext: "fek_TEST-FIXTURE-not-a-real-key-aaaa",
        created_at: "2026-04-21T00:00:00Z",
      })
      const mod = await import("./route")
      const res = await mod.POST(
        new Request("http://local/api/api-keys", {
          method: "POST",
          body: JSON.stringify({ name: "ci" }),
        }),
      )
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.key.plaintext).toMatch(/^fek_/)
      expect(mockCreateKeyFor).toHaveBeenCalledWith("user_abc", "ci", undefined, null)
    })

    it("forwards the authenticated user's email so the api_keys row can snapshot it", async () => {
      mockGetRequestUser.mockResolvedValue({
        id: "user_xyz",
        email: "alice@example.com",
        name: "Alice",
        imageUrl: null,
      })
      mockCreateKeyFor.mockResolvedValue({
        id: 11,
        name: "claude",
        tier: "write",
        owner_email: "alice@example.com",
        plaintext: "fek_TEST-FIXTURE-not-a-real-key-cccc",
        created_at: "2026-04-22T00:00:00Z",
      })
      const mod = await import("./route")
      const res = await mod.POST(
        new Request("http://local/api/api-keys", {
          method: "POST",
          body: JSON.stringify({ name: "claude", tier: "write" }),
        }),
      )
      expect(res.status).toBe(201)
      expect(mockCreateKeyFor).toHaveBeenCalledWith(
        "user_xyz",
        "claude",
        "write",
        "alice@example.com",
      )
    })

    it("forwards tier=write when requested", async () => {
      mockGetRequestUser.mockResolvedValue({
        id: "user_abc",
        email: null,
        name: null,
        imageUrl: null,
      })
      mockCreateKeyFor.mockResolvedValue({
        id: 10,
        name: "claude",
        tier: "write",
        plaintext: "fek_TEST-FIXTURE-not-a-real-key-bbbb",
        created_at: "2026-04-21T00:00:00Z",
      })
      const mod = await import("./route")
      const res = await mod.POST(
        new Request("http://local/api/api-keys", {
          method: "POST",
          body: JSON.stringify({ name: "claude", tier: "write" }),
        }),
      )
      expect(res.status).toBe(201)
      expect(mockCreateKeyFor).toHaveBeenCalledWith("user_abc", "claude", "write", null)
    })

    it("400s an unknown tier value at the zod boundary", async () => {
      mockGetRequestUser.mockResolvedValue({
        id: "user_abc",
        email: null,
        name: null,
        imageUrl: null,
      })
      const mod = await import("./route")
      const res = await mod.POST(
        new Request("http://local/api/api-keys", {
          method: "POST",
          body: JSON.stringify({ name: "x", tier: "root" }),
        }),
      )
      expect(res.status).toBe(400)
      expect(mockCreateKeyFor).not.toHaveBeenCalled()
    })

    it("400s on invalid json body", async () => {
      mockGetRequestUser.mockResolvedValue({
        id: "user_abc",
        email: null,
        name: null,
        imageUrl: null,
      })
      const mod = await import("./route")
      const res = await mod.POST(
        new Request("http://local/api/api-keys", {
          method: "POST",
          body: "not-json",
        }),
      )
      expect(res.status).toBe(400)
      expect(mockCreateKeyFor).not.toHaveBeenCalled()
    })

    it("502s when the forwarder throws", async () => {
      mockGetRequestUser.mockResolvedValue({
        id: "user_abc",
        email: null,
        name: null,
        imageUrl: null,
      })
      mockCreateKeyFor.mockRejectedValue(new Error("upstream 500"))
      const mod = await import("./route")
      const res = await mod.POST(
        new Request("http://local/api/api-keys", {
          method: "POST",
          body: JSON.stringify({ name: "ci" }),
        }),
      )
      expect(res.status).toBe(502)
    })
  })
})
