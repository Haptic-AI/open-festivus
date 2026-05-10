import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Spec 029 Step 3.3. Unit tests for the SSE route's gates + leak
 * invariants. Anthropic and the api forwarder are stubbed so the test
 * runs offline, under 1s.
 */

// Stub getRequestUser before importing the route.
const mockGetRequestUser = vi.fn()
vi.mock("@/lib/auth", () => ({
  getRequestUser: () => mockGetRequestUser(),
}))

// Stub the api-keys-forwarder so we control whether the user has an active key.
const mockListKeysFor = vi.fn()
vi.mock("@/lib/api-keys-forwarder", () => ({
  listKeysFor: (...args: unknown[]) => mockListKeysFor(...args),
}))

// Stub Anthropic so we can capture the `system` arg without a real network call.
const mockMessagesCreate = vi.fn()
class MockAnthropic {
  messages = { create: mockMessagesCreate }
}
vi.mock("@anthropic-ai/sdk", () => ({
  default: MockAnthropic,
}))

async function readStreamToString(res: Response): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return ""
  const decoder = new TextDecoder()
  let text = ""
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    text += decoder.decode(value, { stream: true })
  }
  return text
}

describe("POST /api/agent-chat (spec 029)", () => {
  beforeEach(() => {
    mockGetRequestUser.mockReset()
    mockListKeysFor.mockReset()
    mockMessagesCreate.mockReset()
    process.env["FESTIVUS_MODERATOR_KEY"] = "fek_mock_moderator_key"
    process.env["ANTHROPIC_API_KEY"] = "sk-ant-stub-for-env-gate"
    process.env["FESTIVUS_AGENT_CHAT_SECRET"] = "x".repeat(64)
  })

  it("returns 401 when unauthenticated", async () => {
    mockGetRequestUser.mockResolvedValueOnce(null)
    const { POST } = await import("./route")
    const res = await POST(
      new Request("http://localhost/api/agent-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "hello" }),
      }),
    )
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ error: "unauthorized" })
  })

  it("emits needs_api_key when the user has zero active fek_*", async () => {
    mockGetRequestUser.mockResolvedValueOnce({ id: "clerk_alice", email: "a@b.c" })
    mockListKeysFor.mockResolvedValueOnce([
      { id: 1, tier: "write", revoked_at: "2026-04-01T00:00:00Z", name: "old", owner_email: null, created_at: "x", last_used_at: null },
    ])
    const { POST } = await import("./route")
    const res = await POST(
      new Request("http://localhost/api/agent-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "fix a robot weight" }),
      }),
    )
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/event-stream")
    const body = await readStreamToString(res)
    expect(body).toContain('"needs_api_key"')
    expect(body).toContain("/settings/api-keys?source=agent")
    expect(body).toContain('"done"')
  })

  it("emits anthropic_unconfigured when ANTHROPIC_API_KEY is absent", async () => {
    mockGetRequestUser.mockResolvedValueOnce({ id: "clerk_alice", email: null })
    mockListKeysFor.mockResolvedValueOnce([
      { id: 2, tier: "write", revoked_at: null, name: "active", owner_email: null, created_at: "x", last_used_at: null },
    ])
    delete process.env["ANTHROPIC_API_KEY"]
    const { POST } = await import("./route")
    const res = await POST(
      new Request("http://localhost/api/agent-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "x" }),
      }),
    )
    const body = await readStreamToString(res)
    expect(body).toContain("anthropic_unconfigured")
  })

  it("pins the active field into the system prompt when context.field is set", async () => {
    mockGetRequestUser.mockResolvedValueOnce({ id: "clerk_alice", email: null })
    mockListKeysFor.mockResolvedValueOnce([
      { id: 2, tier: "write", revoked_at: null, name: "active", owner_email: null, created_at: "x", last_used_at: null },
    ])
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "ok" }],
      stop_reason: "end_turn",
    })
    const { POST } = await import("./route")
    const res = await POST(
      new Request("http://localhost/api/agent-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: "help me",
          context: {
            table: "robots",
            slug: "atlas",
            recordName: "Atlas",
            field: "weight_kg",
          },
        }),
      }),
    )
    expect(res.status).toBe(200)
    await readStreamToString(res)
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1)
    // After spec 029 phase 3.8 caching, `system` is an array of text
    // blocks — concat their text for the substring asserts.
    const systemArg = mockMessagesCreate.mock.calls[0]?.[0]?.system as
      | string
      | Array<{ type: string; text: string }>
      | undefined
    const systemText = typeof systemArg === "string"
      ? systemArg
      : (systemArg ?? []).map((b) => b.text).join("\n\n")
    expect(systemText).toContain("## Active page context (authoritative)")
    expect(systemText).toContain("robots/atlas")
    expect(systemText).toContain("weight_kg")
  })

  it("omits the field line when context.field is absent", async () => {
    mockGetRequestUser.mockResolvedValueOnce({ id: "clerk_alice", email: null })
    mockListKeysFor.mockResolvedValueOnce([
      { id: 2, tier: "write", revoked_at: null, name: "active", owner_email: null, created_at: "x", last_used_at: null },
    ])
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "ok" }],
      stop_reason: "end_turn",
    })
    const { POST } = await import("./route")
    const res = await POST(
      new Request("http://localhost/api/agent-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: "help me",
          context: { table: "robots", slug: "atlas", recordName: "Atlas" },
        }),
      }),
    )
    expect(res.status).toBe(200)
    await readStreamToString(res)
    const systemArg = mockMessagesCreate.mock.calls[0]?.[0]?.system as
      | string
      | Array<{ type: string; text: string }>
      | undefined
    const systemText = typeof systemArg === "string"
      ? systemArg
      : (systemArg ?? []).map((b) => b.text).join("\n\n")
    expect(systemText).toContain("robots/atlas")
    expect(systemText).not.toContain("The user opened the chat from the")
  })

  it("never streams the moderator key, fek_*, or sk-ant- substrings in any SSE chunk", async () => {
    mockGetRequestUser.mockResolvedValueOnce({ id: "clerk_alice", email: null })
    mockListKeysFor.mockResolvedValueOnce([
      { id: 2, tier: "write", revoked_at: null, name: "active", owner_email: null, created_at: "x", last_used_at: null },
    ])
    // Force the Anthropic branch to fail early so no real network call occurs.
    // The route's error scrubber is still exercised; we grep the scrubbed output.
    process.env["ANTHROPIC_API_KEY"] = "sk-ant-invalid-will-401"
    const { POST } = await import("./route")
    const res = await POST(
      new Request("http://localhost/api/agent-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "hello" }),
      }),
    )
    const body = await readStreamToString(res)
    expect(body).not.toContain("fek_mock_moderator_key")
    expect(body).not.toMatch(/sk-ant-(?!stub-for-env-gate\b)[A-Za-z0-9_-]{10}/)
  })
})
