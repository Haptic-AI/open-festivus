import { describe, expect, it, vi } from "vitest"
import { DevAuthProvider } from "../../apps/web/src/lib/auth/dev-provider"

// Mock Clerk's server module to avoid server-only import errors.
// ClerkAuthProvider is a thin wrapper around Clerk SDK -- we test it
// via the API route integration tests instead.
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}))

describe("DevAuthProvider", () => {
  it("always returns the dev user", async () => {
    const provider = new DevAuthProvider()
    const user = await provider.getUser()
    expect(user).toEqual({
      id: "dev-user",
      email: "dev@localhost",
      name: "Dev User",
      imageUrl: null,
    })
  })

  it("returns the same user on repeated calls", async () => {
    const provider = new DevAuthProvider()
    const user1 = await provider.getUser()
    const user2 = await provider.getUser()
    expect(user1).toEqual(user2)
  })
})

describe("getAuthProvider", () => {
  it("returns DevAuthProvider when CLERK_SECRET_KEY is unset", async () => {
    delete process.env["CLERK_SECRET_KEY"]
    const { getAuthProvider } = await import("../../apps/web/src/lib/auth/index")
    const provider = getAuthProvider()
    const user = await provider.getUser()
    expect(user?.id).toBe("dev-user")
  })

  it("getRequestUser returns dev user when Clerk is not configured", async () => {
    delete process.env["CLERK_SECRET_KEY"]
    const { getRequestUser } = await import("../../apps/web/src/lib/auth/index")
    const user = await getRequestUser()
    expect(user?.id).toBe("dev-user")
    expect(user?.email).toBe("dev@localhost")
  })
})
