import type { IMutation } from "@festivus/types"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const sendMock = vi.fn(async () => ({}))

class MockSendEmailCommand {
  input: unknown
  constructor(input: unknown) {
    this.input = input
  }
}

class MockSESClient {
  send = sendMock
}

vi.mock("@aws-sdk/client-ses", () => ({
  SESClient: MockSESClient,
  SendEmailCommand: MockSendEmailCommand,
}))

function fixtureMutation(overrides: Partial<IMutation> = {}): IMutation {
  return {
    id: 101,
    created_at: "2026-04-22T00:00:00Z",
    table_name: "robots",
    slug: "unitree-h1",
    field_path: "price_usd",
    actor_id: "42",
    actor_email: "submitter@example.com",
    author_id: null,
    reason: "Public list price",
    patch: { price_usd: 90000 },
    old_values: { price_usd: null },
    new_values: { price_usd: 90000 },
    status: "pending_review",
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
    ...overrides,
  }
}

describe("notifications/email", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    sendMock.mockClear()
    vi.resetModules()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it("notifyModerator no-ops when SES_ENABLED is unset (local dev stays silent)", async () => {
    delete process.env["SES_ENABLED"]
    const { notifyModerator } = await import("./email.js")
    await notifyModerator(fixtureMutation())
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("notifyModerator no-ops when MODERATOR_EMAILS is unset (no shipped fallback list)", async () => {
    process.env["SES_ENABLED"] = "true"
    delete process.env["MODERATOR_EMAILS"]
    delete process.env["MODERATOR_EMAIL"]
    const { notifyModerator } = await import("./email.js")
    await notifyModerator(fixtureMutation())
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("notifyModerator honours MODERATOR_EMAILS comma-split override", async () => {
    process.env["SES_ENABLED"] = "true"
    process.env["MODERATOR_EMAILS"] = "a@x.com, b@y.com ,c@z.com"
    const { notifyModerator } = await import("./email.js")
    await notifyModerator(fixtureMutation())
    const firstCall = sendMock.mock.calls[0] as unknown as [{ input: { Destination: { ToAddresses: string[] } } }]
    const cmd = firstCall[0]
    expect(cmd.input.Destination.ToAddresses).toEqual(["a@x.com", "b@y.com", "c@z.com"])
  })

  it("notifySubmitter skips when actor_email is null (legacy key without owner_email)", async () => {
    process.env["SES_ENABLED"] = "true"
    const { notifySubmitter } = await import("./email.js")
    await notifySubmitter(fixtureMutation({ actor_email: null }))
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("notifySubmitter sends to actor_email on successful PATCH", async () => {
    process.env["SES_ENABLED"] = "true"
    const { notifySubmitter } = await import("./email.js")
    await notifySubmitter(fixtureMutation())
    expect(sendMock).toHaveBeenCalledTimes(1)
    const firstCall = sendMock.mock.calls[0] as unknown as [
      { input: { Destination: { ToAddresses: string[] }; Message: { Subject: { Data: string } } } },
    ]
    const cmd = firstCall[0]
    expect(cmd.input.Destination.ToAddresses).toEqual(["submitter@example.com"])
    expect(cmd.input.Message.Subject.Data).toContain("is live")
  })

  it("notifyReviewOutcome sends an approved-status email to the submitter", async () => {
    process.env["SES_ENABLED"] = "true"
    const { notifyReviewOutcome } = await import("./email.js")
    await notifyReviewOutcome(fixtureMutation({ status: "approved", reviewed_at: "2026-04-22T01:00:00Z" }), "approve")
    const firstCall = sendMock.mock.calls[0] as unknown as [
      { input: { Destination: { ToAddresses: string[] }; Message: { Subject: { Data: string } } } },
    ]
    const cmd = firstCall[0]
    expect(cmd.input.Destination.ToAddresses).toEqual(["submitter@example.com"])
    expect(cmd.input.Message.Subject.Data).toContain("approved")
  })
})
